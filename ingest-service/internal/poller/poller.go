package poller

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog"

	"ingest-service/internal/metrics"
	"ingest-service/internal/model"
	"ingest-service/internal/tracker"
)

// Batcher interface for enqueuing telemetry events.
type Batcher interface {
	TryEnqueue(events []model.TelemetryEvent) bool
	QueueLen() int
	QueueCap() int
}

// Target represents a polling configuration for a monitored API endpoint.
//
// Defines the HTTP request to make, interval, timeout, and expected behavior.
type Target struct {
	Name            string
	EndpointID      string
	OrgID           string
	APIID           string
	BaseURL         string
	Path            string
	Method          string
	Interval        time.Duration
	Timeout         time.Duration
	Headers         map[string]string
	Body            string
	ClientRegion    string
	SchemaVersion   string
	MaxBackoff      time.Duration
	ExpectedSuccess []int
}

// TargetStatus represents the current polling state and history for a target.
type TargetStatus struct {
	TargetKey           string    `json:"target_key"`
	Name                string    `json:"name"`
	EndpointID          string    `json:"endpoint_id"`
	OrgID               string    `json:"org_id"`
	APIID               string    `json:"api_id"`
	Endpoint            string    `json:"endpoint"`
	Method              string    `json:"method"`
	Active              bool      `json:"active"`
	LastStatus          int       `json:"last_status"`
	LastLatencyMS       int       `json:"last_latency_ms"`
	LastError           string    `json:"last_error"`
	LastPolledAt        time.Time `json:"last_polled_at"`
	NextPollAt          time.Time `json:"next_poll_at"`
	ConsecutiveFailures int       `json:"consecutive_failures"`
}

// targetRunner manages polling for a single target endpoint.
type targetRunner struct {
	target      Target
	fingerprint string
	cancel      context.CancelFunc
	done        chan struct{}
	status      TargetStatus
}

// Poller manages concurrent polling of multiple API endpoints.
//
// Handles target lifecycle (add, update, remove) and publishes telemetry events
// for each poll attempt to the event batcher.
type Poller struct {
	initialTargets []Target
	batcher        Batcher
	metrics        *metrics.Registry
	tracker        *tracker.LiveTracker
	logger         zerolog.Logger
	defaultClient  *http.Client
	wg             sync.WaitGroup
	mu             sync.RWMutex
	ctx            context.Context
	started        bool
	runners        map[string]*targetRunner
}

// New creates a new Poller with initial targets and configured dependencies.
//
// Sanitizes targets before storing. Configures HTTP transport with connection pooling.
func New(targets []Target, batcher Batcher, metricsRegistry *metrics.Registry, liveTracker *tracker.LiveTracker, logger zerolog.Logger) *Poller {
	cleanTargets := make([]Target, 0, len(targets))
	for _, target := range targets {
		cleaned, ok := sanitizeTarget(target)
		if !ok {
			continue
		}
		cleanTargets = append(cleanTargets, cleaned)
	}

	transport := &http.Transport{
		MaxIdleConns:        256,
		MaxIdleConnsPerHost: 64,
		IdleConnTimeout:     90 * time.Second,
	}

	return &Poller{
		initialTargets: cleanTargets,
		batcher:        batcher,
		metrics:        metricsRegistry,
		tracker:        liveTracker,
		logger:         logger,
		defaultClient:  &http.Client{Transport: transport},
		runners:        make(map[string]*targetRunner),
	}
}

// Start begins polling all targets in background goroutines.
func (p *Poller) Start(ctx context.Context) {
	p.mu.Lock()
	if p.started {
		p.mu.Unlock()
		return
	}
	p.started = true
	p.ctx = ctx
	bootstrapTargets := make([]Target, len(p.initialTargets))
	copy(bootstrapTargets, p.initialTargets)
	p.mu.Unlock()

	for i := range bootstrapTargets {
		_, _ = p.AddOrUpdateTarget(bootstrapTargets[i])
	}
}

// Wait blocks until all poller goroutines complete.
func (p *Poller) Wait() {
	p.wg.Wait()
}

// AddOrUpdateTarget adds a new polling target or updates an existing one.
//
// Returns (targetKey, true) when a new target is added or existing target is updated.
// Returns ("", false) if sanitization fails, poller has not been started, or a target with the same fingerprint exists.
func (p *Poller) AddOrUpdateTarget(target Target) (string, bool) {
	cleaned, ok := sanitizeTarget(target)
	if !ok {
		return "", false
	}
	key := targetKey(cleaned)
	fingerprint := fingerprintTarget(cleaned)

	p.mu.Lock()
	defer p.mu.Unlock()

	if !p.started || p.ctx == nil {
		return "", false
	}

	if existing, exists := p.runners[key]; exists {
		if existing.fingerprint == fingerprint {
			return key, false
		}
		existing.cancel()
		delete(p.runners, key)
		p.metrics.IncPollerTargetStopped()
	}

	runnerCtx, cancel := context.WithCancel(p.ctx)
	runner := &targetRunner{
		target:      cleaned,
		fingerprint: fingerprint,
		cancel:      cancel,
		done:        make(chan struct{}),
		status: TargetStatus{
			TargetKey:  key,
			Name:       cleaned.Name,
			EndpointID: cleaned.EndpointID,
			OrgID:      cleaned.OrgID,
			APIID:      cleaned.APIID,
			Endpoint:   cleaned.Path,
			Method:     cleaned.Method,
			Active:     true,
			NextPollAt: time.Now().UTC(),
		},
	}
	p.runners[key] = runner
	p.metrics.IncPollerTargetStarted()
	p.metrics.SetPollerTargetsActive(len(p.runners))

	p.wg.Add(1)
	go p.runTarget(runnerCtx, key, runner)

	p.logger.Info().
		Str("target_key", key).
		Str("org_id", cleaned.OrgID).
		Str("api_id", cleaned.APIID).
		Str("endpoint_id", cleaned.EndpointID).
		Str("base_url", cleaned.BaseURL).
		Str("path", cleaned.Path).
		Str("method", cleaned.Method).
		Msg("poll target started")

	return key, true
}

func (p *Poller) RemoveTarget(key string) bool {
	key = strings.TrimSpace(key)
	if key == "" {
		return false
	}

	p.mu.Lock()
	runner, exists := p.runners[key]
	if !exists {
		p.mu.Unlock()
		return false
	}
	delete(p.runners, key)
	runner.cancel()
	p.metrics.IncPollerTargetStopped()
	p.metrics.SetPollerTargetsActive(len(p.runners))
	p.mu.Unlock()

	p.logger.Info().Str("target_key", key).Msg("poll target stopped")
	return true
}

func (p *Poller) Reconcile(targets []Target) {
	desired := make(map[string]Target, len(targets))
	for i := range targets {
		cleaned, ok := sanitizeTarget(targets[i])
		if !ok {
			continue
		}
		desired[targetKey(cleaned)] = cleaned
	}

	p.mu.RLock()
	existingKeys := make([]string, 0, len(p.runners))
	for key := range p.runners {
		existingKeys = append(existingKeys, key)
	}
	p.mu.RUnlock()

	for _, key := range existingKeys {
		if _, ok := desired[key]; !ok {
			_ = p.RemoveTarget(key)
		}
	}

	for _, target := range desired {
		_, _ = p.AddOrUpdateTarget(target)
	}
}

func (p *Poller) ActiveTargetCount() int {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return len(p.runners)
}

func (p *Poller) Snapshot() []TargetStatus {
	p.mu.RLock()
	items := make([]TargetStatus, 0, len(p.runners))
	for _, runner := range p.runners {
		items = append(items, runner.status)
	}
	p.mu.RUnlock()

	sort.Slice(items, func(i, j int) bool {
		if items[i].LastPolledAt.Equal(items[j].LastPolledAt) {
			return items[i].TargetKey < items[j].TargetKey
		}
		return items[i].LastPolledAt.After(items[j].LastPolledAt)
	})
	return items
}

func (p *Poller) runTarget(ctx context.Context, key string, runner *targetRunner) {
	defer p.wg.Done()
	defer close(runner.done)

	initialDelay := boundedJitter(minDuration(runner.target.Interval/5, 2*time.Second))
	if initialDelay > 0 {
		timer := time.NewTimer(initialDelay)
		select {
		case <-ctx.Done():
			if !timer.Stop() {
				<-timer.C
			}
			return
		case <-timer.C:
		}
	}

	consecutiveFailures := 0
	nextDelay := time.Duration(0)

	for {
		if nextDelay > 0 {
			timer := time.NewTimer(nextDelay)
			select {
			case <-ctx.Done():
				if !timer.Stop() {
					<-timer.C
				}
				return
			case <-timer.C:
			}
		}

		statusCode, latencyMS, pollErr, success := p.pollOnce(ctx, runner.target)

		now := time.Now().UTC()
		if success {
			consecutiveFailures = 0
		} else {
			consecutiveFailures++
		}

		baseDelay := runner.target.Interval
		if !success {
			baseDelay = backoffDelay(runner.target.Interval, runner.target.MaxBackoff, consecutiveFailures)
		}
		nextDelay = baseDelay + boundedJitter(baseDelay/10)

		p.mu.Lock()
		if current, ok := p.runners[key]; ok {
			current.status.LastPolledAt = now
			current.status.LastLatencyMS = latencyMS
			current.status.LastStatus = statusCode
			current.status.ConsecutiveFailures = consecutiveFailures
			current.status.NextPollAt = now.Add(nextDelay)
			if pollErr != nil {
				current.status.LastError = pollErr.Error()
			} else {
				current.status.LastError = ""
			}
		}
		p.mu.Unlock()

		if ctx.Err() != nil {
			return
		}
	}
}

func (p *Poller) pollOnce(ctx context.Context, target Target) (int, int, error, bool) {
	requestURL, err := joinURL(target.BaseURL, target.Path)
	if err != nil {
		p.metrics.IncPollingErrors()
		p.logger.Error().Err(err).Str("target", target.Name).Str("base_url", target.BaseURL).Str("path", target.Path).Str("endpoint_id", target.EndpointID).Msg("invalid polling URL")
		return http.StatusServiceUnavailable, 0, err, false
	}

	start := time.Now()
	reqCtx, cancel := context.WithTimeout(ctx, target.Timeout)
	defer cancel()

	var body io.Reader
	if strings.TrimSpace(target.Body) != "" {
		body = bytes.NewBufferString(target.Body)
	}

	req, err := http.NewRequestWithContext(reqCtx, target.Method, requestURL, body)
	if err != nil {
		p.metrics.IncPollingErrors()
		p.logger.Error().Err(err).Str("target", target.Name).Str("endpoint_id", target.EndpointID).Msg("failed to create polling request")
		return http.StatusServiceUnavailable, 0, err, false
	}
	for k, v := range target.Headers {
		req.Header.Set(k, v)
	}

	resp, reqErr := p.defaultClient.Do(req)
	latencyMS := int(time.Since(start).Milliseconds())
	if latencyMS < 0 {
		latencyMS = 0
	}

	evt := model.TelemetryEvent{
		Timestamp:     time.Now().UTC().Format(time.RFC3339),
		OrgID:         target.OrgID,
		APIID:         target.APIID,
		EndpointID:    target.EndpointID,
		Endpoint:      target.Path,
		Method:        target.Method,
		Status:        http.StatusServiceUnavailable,
		LatencyMS:     latencyMS,
		ClientRegion:  target.ClientRegion,
		SchemaVersion: target.SchemaVersion,
	}

	if reqErr != nil {
		p.metrics.IncPollingErrors()
		p.logger.Warn().Err(reqErr).Str("target", target.Name).Str("url", requestURL).Str("endpoint_id", target.EndpointID).Int("latency_ms", latencyMS).Msg("poll request failed")
		p.enqueueEvent(evt)
		return evt.Status, latencyMS, reqErr, false
	}
	defer resp.Body.Close()

	responseBody, readErr := io.ReadAll(io.LimitReader(resp.Body, 4*1024*1024))
	evt.Status = resp.StatusCode
	evt.ResponseSizeBytes = len(responseBody)
	if target.Body != "" {
		evt.RequestSizeBytes = len(target.Body)
	}

	if readErr != nil {
		p.metrics.IncPollingErrors()
		p.logger.Warn().Err(readErr).Str("target", target.Name).Str("url", requestURL).Str("endpoint_id", target.EndpointID).Int("status", resp.StatusCode).Msg("failed to read poll response body")
	}

	p.enqueueEvent(evt)

	if readErr != nil {
		return evt.Status, latencyMS, readErr, false
	}
	if len(target.ExpectedSuccess) > 0 {
		if !containsInt(target.ExpectedSuccess, resp.StatusCode) {
			return evt.Status, latencyMS, fmt.Errorf("status %d not in expected success codes", resp.StatusCode), false
		}
		return evt.Status, latencyMS, nil, true
	}
	if resp.StatusCode >= http.StatusInternalServerError {
		return evt.Status, latencyMS, fmt.Errorf("status %d treated as failure", resp.StatusCode), false
	}
	return evt.Status, latencyMS, nil, true
}

func (p *Poller) enqueueEvent(evt model.TelemetryEvent) {
	if !p.batcher.TryEnqueue([]model.TelemetryEvent{evt}) {
		p.metrics.IncPollingDropped()
		p.logger.Warn().
			Str("org_id", evt.OrgID).
			Str("api_id", evt.APIID).
			Str("endpoint", evt.Endpoint).
			Int("queue_len", p.batcher.QueueLen()).
			Int("queue_cap", p.batcher.QueueCap()).
			Msg("dropping polled telemetry event due to full queue")
		return
	}
	p.metrics.IncPolledEventsQueued()
	if p.tracker != nil {
		p.tracker.Observe(evt)
	}
}

func sanitizeTarget(target Target) (Target, bool) {
	target.EndpointID = strings.TrimSpace(target.EndpointID)
	target.Name = strings.TrimSpace(target.Name)
	target.OrgID = strings.TrimSpace(target.OrgID)
	target.APIID = strings.TrimSpace(target.APIID)
	target.BaseURL = strings.TrimSpace(target.BaseURL)
	target.Path = strings.TrimSpace(target.Path)
	target.Method = strings.ToUpper(strings.TrimSpace(target.Method))
	target.ClientRegion = strings.TrimSpace(target.ClientRegion)
	target.SchemaVersion = strings.TrimSpace(target.SchemaVersion)
	if target.Name == "" {
		target.Name = target.Path
	}
	if target.OrgID == "" || target.APIID == "" || target.BaseURL == "" || target.Path == "" {
		return Target{}, false
	}
	if target.Interval <= 0 {
		target.Interval = 30 * time.Second
	}
	if target.Timeout <= 0 {
		target.Timeout = 5 * time.Second
	}
	if target.MaxBackoff <= 0 {
		target.MaxBackoff = 5 * time.Minute
	}
	if target.Method == "" {
		target.Method = http.MethodGet
	}
	if target.SchemaVersion == "" {
		target.SchemaVersion = "active-poll.v2"
	}
	if target.Headers == nil {
		target.Headers = map[string]string{}
	}
	return target, true
}

func targetKey(target Target) string {
	if target.EndpointID != "" {
		return strings.Join([]string{target.OrgID, target.APIID, target.EndpointID}, "|")
	}
	return strings.Join([]string{target.OrgID, target.APIID, target.Method, target.Path}, "|")
}

func fingerprintTarget(target Target) string {
	headersParts := make([]string, 0, len(target.Headers))
	for k, v := range target.Headers {
		headersParts = append(headersParts, strings.ToLower(strings.TrimSpace(k))+"="+strings.TrimSpace(v))
	}
	sort.Strings(headersParts)
	return strings.Join([]string{
		target.Name,
		target.EndpointID,
		target.OrgID,
		target.APIID,
		target.BaseURL,
		target.Path,
		target.Method,
		target.Interval.String(),
		target.Timeout.String(),
		target.Body,
		target.ClientRegion,
		target.SchemaVersion,
		target.MaxBackoff.String(),
		strings.Join(headersParts, ";"),
	}, "|")
}

func containsInt(items []int, value int) bool {
	for i := range items {
		if items[i] == value {
			return true
		}
	}
	return false
}

func backoffDelay(base, max time.Duration, consecutiveFailures int) time.Duration {
	if consecutiveFailures <= 0 {
		return base
	}
	if base <= 0 {
		base = 1 * time.Second
	}
	if max < base {
		max = base
	}
	if consecutiveFailures > 8 {
		consecutiveFailures = 8
	}
	delay := base
	for i := 0; i < consecutiveFailures; i++ {
		delay *= 2
		if delay >= max {
			return max
		}
	}
	if delay > max {
		return max
	}
	return delay
}

func boundedJitter(max time.Duration) time.Duration {
	if max <= 0 {
		return 0
	}
	nanos := time.Now().UTC().UnixNano()
	if nanos < 0 {
		nanos = -nanos
	}
	return time.Duration(nanos % int64(max))
}

func minDuration(left, right time.Duration) time.Duration {
	if left < right {
		return left
	}
	return right
}

func joinURL(base, path string) (string, error) {
	parsedBase, err := url.Parse(strings.TrimSpace(base))
	if err != nil {
		return "", err
	}
	if parsedBase.Scheme == "" || parsedBase.Host == "" {
		return "", fmt.Errorf("base_url must include scheme and host")
	}
	cleanPath := "/" + strings.TrimPrefix(strings.TrimSpace(path), "/")
	if strings.HasSuffix(parsedBase.Path, "/") {
		cleanPath = strings.TrimSuffix(parsedBase.Path, "/") + cleanPath
	}
	parsedBase.Path = cleanPath
	return parsedBase.String(), nil
}
