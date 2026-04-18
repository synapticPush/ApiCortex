package main

import (
	"context"
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"ingest-service/internal/api"
	"ingest-service/internal/buffer"
	"ingest-service/internal/config"
	"ingest-service/internal/kafka"
	"ingest-service/internal/metrics"
	"ingest-service/internal/orgvalidator"
	"ingest-service/internal/poller"
	"ingest-service/internal/storage"
	"ingest-service/internal/tracker"
)

// main initializes and runs the ApiCortex ingest-service.
//
// Startup sequence:
//   - Load configuration from environment
//   - Initialize metrics registry and live endpoint tracker
//   - Connect to Kafka producer with mTLS
//   - Initialize organization validator and TimescaleDB writer
//   - Create event batcher with worker pool
//   - (Optional) Start active endpoint polling service
//   - Register HTTP handlers and middleware stack
//   - Listen for SIGINT/SIGTERM, perform graceful shutdown
func main() {
	zerolog.TimeFieldFormat = time.RFC3339Nano
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stdout})

	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("failed to load config")
	}

	metricsRegistry := metrics.NewRegistry()
	liveTracker := tracker.NewLiveTracker(cfg.LiveTrackRetention)

	producer, err := kafka.NewProducer(
		cfg.KafkaServiceURI,
		cfg.KafkaCACert,
		cfg.KafkaServiceCert,
		cfg.KafkaServiceKey,
		log.Logger,
		metricsRegistry,
	)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to create kafka producer")
	}
	defer func() {
		if err := producer.Close(); err != nil {
			log.Error().Err(err).Msg("failed to close kafka producer")
		}
	}()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	orgValidator, err := orgvalidator.New(cfg.ControlPlaneDBURL, cfg.OrgValidationTTL, cfg.IngestKeyPepper)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to initialize organization validator")
	}
	if orgValidator != nil {
		defer func() {
			if err := orgValidator.Close(); err != nil {
				log.Error().Err(err).Msg("failed to close organization validator")
			}
		}()
	}

	timescaleWriter, err := storage.NewTimescaleWriter(cfg.TimescaleDatabase)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to initialize timescale writer")
	}
	if timescaleWriter != nil {
		defer func() {
			if err := timescaleWriter.Close(); err != nil {
				log.Error().Err(err).Msg("failed to close timescale writer")
			}
		}()
	}

	batcher := buffer.NewBatcher(
		cfg.MaxBufferCapacity,
		cfg.BatchSize,
		cfg.FlushInterval,
		cfg.PublishWorkerCount,
		producer,
		metricsRegistry,
		log.Logger,
		timescaleWriter,
	)
	batcher.Start(ctx)
	defer batcher.Stop()

	h := api.NewHandler(batcher, metricsRegistry, liveTracker, log.Logger, cfg.MaxEventsPerReq, orgValidator, cfg.IngestAPIKey)
	rateLimiter := api.NewRateLimiter(cfg.RateLimitRPS, cfg.RateLimitBurst, 5*time.Minute)

	var activePoller *poller.Poller
	pollingSyncState := &pollSyncState{}
	if cfg.ActivePolling {
		staticTargets := buildStaticTargets(cfg)
		activePoller = poller.New(staticTargets, batcher, metricsRegistry, liveTracker, log.Logger)
		activePoller.Start(ctx)

		targetStore, err := poller.NewDBTargetStore(
			cfg.ControlPlaneDBURL,
			cfg.DefaultPollInterval,
			cfg.DefaultPollTimeout,
			cfg.PollingBackoffMax,
		)
		if err != nil {
			log.Fatal().Err(err).Msg("failed to initialize polling target store")
		}
		if targetStore != nil {
			defer func() {
				if err := targetStore.Close(); err != nil {
					log.Error().Err(err).Msg("failed to close polling target store")
				}
			}()
		}

		syncTargets := func() {
			pollingSyncState.setAttempt()
			metricsRegistry.IncPollerSync()

			desired := make([]poller.Target, 0, len(staticTargets))
			desired = append(desired, staticTargets...)

			if targetStore != nil {
				dbTargets, dbErr := targetStore.ListTargets(ctx)
				if dbErr != nil {
					metricsRegistry.IncPollerSyncError()
					pollingSyncState.setError(dbErr.Error())
					log.Error().Err(dbErr).Msg("polling target sync failed")
					return
				}
				desired = mergeTargets(desired, dbTargets)
			}

			activePoller.Reconcile(desired)
			activeCount := activePoller.ActiveTargetCount()
			metricsRegistry.SetPollerTargetsActive(activeCount)
			pollingSyncState.setSuccess(activeCount)
			log.Info().Int("targets", activeCount).Msg("polling targets synchronized")
		}

		syncTargets()

		go func() {
			ticker := time.NewTicker(cfg.PollingSyncInterval)
			defer ticker.Stop()
			for {
				select {
				case <-ctx.Done():
					return
				case <-ticker.C:
					syncTargets()
				}
			}
		}()

		log.Info().Int("static_targets", len(staticTargets)).Msg("active endpoint polling started")
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/v1/telemetry", h.IngestTelemetry)
	mux.HandleFunc("/v1/endpoints/live", h.ListLiveEndpoints)
	mux.HandleFunc("/v1/endpoints/live/status", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		if activePoller == nil {
			_, _ = w.Write([]byte(`{"monitoring_enabled":false,"active_targets":0,"items":[]}`))
			return
		}
		payload := map[string]any{
			"monitoring_enabled": true,
			"active_targets":     activePoller.ActiveTargetCount(),
			"sync":               pollingSyncState.snapshot(),
			"items":              activePoller.Snapshot(),
		}
		_ = json.NewEncoder(w).Encode(payload)
	})
	mux.HandleFunc("/health", h.Health)
	mux.HandleFunc("/ready", h.Ready)
	mux.Handle("/metrics", metricsRegistry)
	mux.HandleFunc("/swagger", api.SwaggerUI)
	mux.HandleFunc("/swagger/", api.SwaggerUI)
	mux.HandleFunc("/swagger/openapi.json", api.SwaggerSpec)

	chain := api.Chain(
		api.RecoverMiddleware(log.Logger),
		api.RequestIDMiddleware(),
		api.SecurityHeadersMiddleware(),
		api.RateLimitMiddleware(rateLimiter, log.Logger),
		api.APIKeyAuthMiddleware(cfg.RequireAPIKey, cfg.IngestAPIKey),
		api.CORSMiddleware([]string{
			"http://localhost:3000",
			"http://127.0.0.1:3000",
			"https://apicortex.0xarchit.is-a.dev",
		}),
	)

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           withRequestLogging(chain(mux), log.Logger),
		ReadTimeout:       10 * time.Second,
		ReadHeaderTimeout: 5 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	go func() {
		log.Info().Str("addr", srv.Addr).Msg("ingest-service started")
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatal().Err(err).Msg("http server failed")
		}
	}()

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh

	log.Info().Msg("shutdown signal received")
	cancel()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer shutdownCancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Error().Err(err).Msg("http server shutdown error")
	}
	if activePoller != nil {
		activePoller.Wait()
	}
	log.Info().Msg("ingest-service stopped")
}

// buildStaticTargets converts configuration polling targets into poller.Target objects.
//
// Used for static polling targets loaded from configuration file.
func buildStaticTargets(cfg config.Config) []poller.Target {
	targets := make([]poller.Target, 0, len(cfg.PollTargets))
	for i := range cfg.PollTargets {
		t := cfg.PollTargets[i]
		targets = append(targets, poller.Target{
			Name:          t.Name,
			OrgID:         t.OrgID,
			APIID:         t.APIID,
			BaseURL:       t.BaseURL,
			Path:          t.Path,
			Method:        t.Method,
			Interval:      time.Duration(t.IntervalSeconds) * time.Second,
			Timeout:       time.Duration(t.TimeoutMS) * time.Millisecond,
			Headers:       t.Headers,
			Body:          t.Body,
			ClientRegion:  t.ClientRegion,
			SchemaVersion: t.SchemaVersion,
			MaxBackoff:    cfg.PollingBackoffMax,
		})
	}
	return targets
}

// mergeTargets combines static and database-loaded targets, with primary targets taking precedence.
//
// Args:
//   - primary: static targets from configuration
//   - secondary: targets loaded from control-plane database
//
// Returns merged list with primary targets overriding secondary on key collision.
func mergeTargets(primary []poller.Target, secondary []poller.Target) []poller.Target {
	merged := make(map[string]poller.Target, len(primary)+len(secondary))
	for i := range secondary {
		key := pollingTargetKey(secondary[i])
		if key == "" {
			continue
		}
		merged[key] = secondary[i]
	}
	for i := range primary {
		key := pollingTargetKey(primary[i])
		if key == "" {
			continue
		}
		merged[key] = primary[i]
	}
	out := make([]poller.Target, 0, len(merged))
	for _, target := range merged {
		out = append(out, target)
	}
	return out
}

// pollingTargetKey generates a unique key for deduplication.
//
// Key format: org_id|api_id|endpoint_id (if set) or org_id|api_id|method|path.
// Returns empty string if org_id or api_id is missing.
func pollingTargetKey(target poller.Target) string {
	orgID := strings.TrimSpace(target.OrgID)
	apiID := strings.TrimSpace(target.APIID)
	if orgID == "" || apiID == "" {
		return ""
	}
	if endpointID := strings.TrimSpace(target.EndpointID); endpointID != "" {
		return strings.Join([]string{orgID, apiID, endpointID}, "|")
	}
	return strings.Join([]string{orgID, apiID, strings.ToUpper(strings.TrimSpace(target.Method)), strings.TrimSpace(target.Path)}, "|")
}

// pollSyncState tracks polling target synchronization attempts and status.
//
// Guarded by RWMutex to safely share state across sync goroutines.
type pollSyncState struct {
	mu          sync.RWMutex
	lastAttempt time.Time
	lastSuccess time.Time
	lastError   string
	activeCount int
}

// setAttempt records the timestamp of a sync attempt.
func (s *pollSyncState) setAttempt() {
	s.mu.Lock()
	s.lastAttempt = time.Now().UTC()
	s.mu.Unlock()
}

// setSuccess records successful sync with updated active target count.
func (s *pollSyncState) setSuccess(activeCount int) {
	s.mu.Lock()
	s.lastSuccess = time.Now().UTC()
	s.lastError = ""
	s.activeCount = activeCount
	s.mu.Unlock()
}

// setError records the most recent sync error message.
func (s *pollSyncState) setError(message string) {
	s.mu.Lock()
	s.lastError = message
	s.mu.Unlock()
}

// snapshot returns a thread-safe copy of current sync state.
func (s *pollSyncState) snapshot() map[string]any {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return map[string]any{
		"last_attempt": s.lastAttempt,
		"last_success": s.lastSuccess,
		"last_error":   s.lastError,
		"active_count": s.activeCount,
	}
}

// withRequestLogging wraps an HTTP handler with structured request logging.
//
// Logs method, path, remote IP, response status, and total duration.
func withRequestLogging(next http.Handler, logger zerolog.Logger) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		wrapped := &statusWriter{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(wrapped, r)
		logger.Info().
			Str("request_id", api.RequestIDFromContext(r.Context())).
			Str("method", r.Method).
			Str("path", r.URL.Path).
			Str("remote_ip", clientIP(r.RemoteAddr)).
			Int("status", wrapped.status).
			Dur("duration", time.Since(start)).
			Msg("http_request")
	})
}

// clientIP extracts the IP address from remote address (strips port).
func clientIP(remoteAddr string) string {
	remoteAddr = strings.TrimSpace(remoteAddr)
	if remoteAddr == "" {
		return ""
	}
	host, _, err := net.SplitHostPort(remoteAddr)
	if err == nil {
		return host
	}
	return remoteAddr
}

// statusWriter wraps http.ResponseWriter to capture HTTP status code.
type statusWriter struct {
	http.ResponseWriter
	status int
}

// WriteHeader records the HTTP status code before writing response.
func (s *statusWriter) WriteHeader(code int) {
	s.status = code
	s.ResponseWriter.WriteHeader(code)
}

// Write wraps response writing, defaulting status to 200 if not set.
func (s *statusWriter) Write(b []byte) (int, error) {
	if s.status == 0 {
		s.status = http.StatusOK
	}
	return s.ResponseWriter.Write(b)
}
