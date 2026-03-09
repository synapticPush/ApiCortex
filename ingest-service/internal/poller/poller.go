package poller

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/rs/zerolog"

	"ingest-service/internal/metrics"
	"ingest-service/internal/model"
	"ingest-service/internal/tracker"
)

type Batcher interface {
	TryEnqueue(events []model.TelemetryEvent) bool
	QueueLen() int
	QueueCap() int
}

type Target struct {
	Name            string
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
	ExpectedSuccess []int
}

type Poller struct {
	targets       []Target
	batcher       Batcher
	metrics       *metrics.Registry
	tracker       *tracker.LiveTracker
	logger        zerolog.Logger
	defaultClient *http.Client
	wg            sync.WaitGroup
}

func New(targets []Target, batcher Batcher, metricsRegistry *metrics.Registry, liveTracker *tracker.LiveTracker, logger zerolog.Logger) *Poller {
	cleanTargets := make([]Target, 0, len(targets))
	for _, t := range targets {
		if strings.TrimSpace(t.OrgID) == "" || strings.TrimSpace(t.APIID) == "" || strings.TrimSpace(t.BaseURL) == "" || strings.TrimSpace(t.Path) == "" {
			continue
		}
		if t.Interval <= 0 {
			t.Interval = 30 * time.Second
		}
		if t.Timeout <= 0 {
			t.Timeout = 5 * time.Second
		}
		if strings.TrimSpace(t.Method) == "" {
			t.Method = http.MethodGet
		}
		t.Method = strings.ToUpper(strings.TrimSpace(t.Method))
		if strings.TrimSpace(t.SchemaVersion) == "" {
			t.SchemaVersion = "active-poll.v1"
		}
		cleanTargets = append(cleanTargets, t)
	}

	return &Poller{
		targets: cleanTargets,
		batcher: batcher,
		metrics: metricsRegistry,
		tracker: liveTracker,
		logger:  logger,
		defaultClient: &http.Client{
			Timeout: 5 * time.Second,
		},
	}
}

func (p *Poller) Start(ctx context.Context) {
	for i := range p.targets {
		target := p.targets[i]
		p.wg.Add(1)
		go p.runTarget(ctx, target)
	}
}

func (p *Poller) Wait() {
	p.wg.Wait()
}

func (p *Poller) runTarget(ctx context.Context, target Target) {
	defer p.wg.Done()
	ticker := time.NewTicker(target.Interval)
	defer ticker.Stop()

	p.pollOnce(ctx, target)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			p.pollOnce(ctx, target)
		}
	}
}

func (p *Poller) pollOnce(ctx context.Context, target Target) {
	requestURL, err := joinURL(target.BaseURL, target.Path)
	if err != nil {
		p.metrics.IncPollingErrors()
		p.logger.Error().Err(err).Str("target", target.Name).Str("base_url", target.BaseURL).Str("path", target.Path).Msg("invalid polling URL")
		return
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
		p.logger.Error().Err(err).Str("target", target.Name).Msg("failed to create polling request")
		return
	}
	for k, v := range target.Headers {
		req.Header.Set(k, v)
	}

	client := p.defaultClient
	if target.Timeout > 0 && target.Timeout != client.Timeout {
		client = &http.Client{Timeout: target.Timeout}
	}

	resp, reqErr := client.Do(req)
	latencyMS := int(time.Since(start).Milliseconds())
	if latencyMS < 0 {
		latencyMS = 0
	}

	evt := model.TelemetryEvent{
		Timestamp:     time.Now().UTC().Format(time.RFC3339),
		OrgID:         target.OrgID,
		APIID:         target.APIID,
		Endpoint:      target.Path,
		Method:        target.Method,
		Status:        http.StatusServiceUnavailable,
		LatencyMS:     latencyMS,
		ClientRegion:  target.ClientRegion,
		SchemaVersion: target.SchemaVersion,
	}

	if reqErr != nil {
		p.metrics.IncPollingErrors()
		p.logger.Warn().Err(reqErr).Str("target", target.Name).Str("url", requestURL).Int("latency_ms", latencyMS).Msg("poll request failed")
		p.enqueueEvent(evt)
		return
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
		p.logger.Warn().Err(readErr).Str("target", target.Name).Str("url", requestURL).Int("status", resp.StatusCode).Msg("failed to read poll response body")
	}

	p.enqueueEvent(evt)
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
