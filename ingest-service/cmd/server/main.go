package main

import (
	"context"
	"errors"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"ingest-service/internal/api"
	"ingest-service/internal/buffer"
	"ingest-service/internal/config"
	"ingest-service/internal/kafka"
	"ingest-service/internal/metrics"
)

func main() {
	zerolog.TimeFieldFormat = time.RFC3339Nano
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stdout})

	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("failed to load config")
	}

	metricsRegistry := metrics.NewRegistry()

	producer, err := kafka.NewProducer(
		cfg.KafkaServiceURI,
		cfg.KafkaCACertPath,
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

	batcher := buffer.NewBatcher(
		cfg.MaxBufferCapacity,
		cfg.BatchSize,
		cfg.FlushInterval,
		cfg.PublishWorkerCount,
		producer,
		metricsRegistry,
		log.Logger,
	)
	batcher.Start(ctx)
	defer batcher.Stop()

	h := api.NewHandler(batcher, metricsRegistry, log.Logger, cfg.MaxEventsPerReq)
	rateLimiter := api.NewRateLimiter(cfg.RateLimitRPS, cfg.RateLimitBurst, 5*time.Minute)

	mux := http.NewServeMux()
	mux.HandleFunc("/v1/telemetry", h.IngestTelemetry)
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
	log.Info().Msg("ingest-service stopped")
}

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

func clientIP(remoteAddr string) string {
	host := strings.TrimSpace(remoteAddr)
	if host == "" {
		return ""
	}
	idx := strings.LastIndex(host, ":")
	if idx <= 0 {
		return host
	}
	return host[:idx]
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (s *statusWriter) WriteHeader(code int) {
	s.status = code
	s.ResponseWriter.WriteHeader(code)
}

func (s *statusWriter) Write(b []byte) (int, error) {
	if s.status == 0 {
		s.status = http.StatusOK
	}
	return s.ResponseWriter.Write(b)
}
