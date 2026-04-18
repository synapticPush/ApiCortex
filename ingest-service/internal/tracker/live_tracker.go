package tracker

import (
	"sort"
	"strings"
	"sync"
	"time"

	"ingest-service/internal/model"
)

// endpointKey uniquely identifies an API endpoint for tracking purposes.
type endpointKey struct {
	orgID    string
	apiID    string
	endpoint string
	method   string
}

// endpointState maintains real-time statistics for a monitored API endpoint.
//
// Tracks request counts, error rates, latencies, and most recent status.
type endpointState struct {
	OrgID        string    `json:"org_id"`
	APIID        string    `json:"api_id"`
	Endpoint     string    `json:"endpoint"`
	Method       string    `json:"method"`
	Requests     int64     `json:"requests"`
	Successes    int64     `json:"successes"`
	Errors       int64     `json:"errors"`
	ErrorRate    float64   `json:"error_rate"`
	AvgLatencyMS float64   `json:"avg_latency_ms"`
	LastLatency  int       `json:"last_latency_ms"`
	LastStatus   int       `json:"last_status"`
	LastSeenAt   time.Time `json:"last_seen_at"`

	latencySum int64

	lastUpdated time.Time
}

// LiveTracker maintains real-time statistics for monitored API endpoints.
//
// Records observations from telemetry events and exposes current state
// via List() with filtering and pagination support.
type LiveTracker struct {
	mu        sync.RWMutex
	retention time.Duration
	states    map[endpointKey]*endpointState
}

// NewLiveTracker creates a new live tracker with data retention.
//
// Args:
//   - retention: how long to keep endpoint state data before expiration; defaults to 60 minutes when <= 0
//
// Returns configured tracker ready to receive observations.
func NewLiveTracker(retention time.Duration) *LiveTracker {
	if retention <= 0 {
		retention = 60 * time.Minute
	}
	return &LiveTracker{
		retention: retention,
		states:    make(map[endpointKey]*endpointState, 4096),
	}
}

// Observe records a telemetry event and updates endpoint statistics.
//
// Updates request counts, error metrics, latency averages, and last seen timestamp.
func (t *LiveTracker) Observe(evt model.TelemetryEvent) {
	now := time.Now().UTC()
	seenAt := now
	if parsed, err := time.Parse(time.RFC3339, strings.TrimSpace(evt.Timestamp)); err == nil {
		seenAt = parsed.UTC()
	}

	key := endpointKey{
		orgID:    strings.TrimSpace(evt.OrgID),
		apiID:    strings.TrimSpace(evt.APIID),
		endpoint: strings.TrimSpace(evt.Endpoint),
		method:   strings.ToUpper(strings.TrimSpace(evt.Method)),
	}

	t.mu.Lock()
	state, ok := t.states[key]
	if !ok {
		state = &endpointState{
			OrgID:      key.orgID,
			APIID:      key.apiID,
			Endpoint:   key.endpoint,
			Method:     key.method,
			LastSeenAt: seenAt,
		}
		t.states[key] = state
	}

	state.Requests++
	if evt.Status >= 200 && evt.Status < 500 {
		state.Successes++
	} else {
		state.Errors++
	}
	state.latencySum += int64(evt.LatencyMS)
	state.AvgLatencyMS = float64(state.latencySum) / float64(state.Requests)
	state.ErrorRate = float64(state.Errors) / float64(state.Requests)
	state.LastLatency = evt.LatencyMS
	state.LastStatus = evt.Status
	state.LastSeenAt = seenAt
	state.lastUpdated = now

	t.pruneLocked(now)
	t.mu.Unlock()
}

func (t *LiveTracker) List(limit int, orgID, apiID, method, endpointContains string) []endpointState {
	now := time.Now().UTC()
	if limit <= 0 {
		limit = 100
	}
	if limit > 1000 {
		limit = 1000
	}

	orgID = strings.TrimSpace(orgID)
	apiID = strings.TrimSpace(apiID)
	method = strings.ToUpper(strings.TrimSpace(method))
	endpointContains = strings.ToLower(strings.TrimSpace(endpointContains))

	t.mu.Lock()
	t.pruneLocked(now)
	out := make([]endpointState, 0, len(t.states))
	for _, s := range t.states {
		if orgID != "" && s.OrgID != orgID {
			continue
		}
		if apiID != "" && s.APIID != apiID {
			continue
		}
		if method != "" && s.Method != method {
			continue
		}
		if endpointContains != "" && !strings.Contains(strings.ToLower(s.Endpoint), endpointContains) {
			continue
		}
		out = append(out, *s)
	}
	t.mu.Unlock()

	sort.Slice(out, func(i, j int) bool {
		if out[i].LastSeenAt.Equal(out[j].LastSeenAt) {
			return out[i].Requests > out[j].Requests
		}
		return out[i].LastSeenAt.After(out[j].LastSeenAt)
	})

	if len(out) > limit {
		out = out[:limit]
	}
	return out
}

func (t *LiveTracker) pruneLocked(now time.Time) {
	cutoff := now.Add(-t.retention)
	for k, s := range t.states {
		if s.lastUpdated.Before(cutoff) {
			delete(t.states, k)
		}
	}
}
