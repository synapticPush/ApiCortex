package metrics

import (
	"fmt"
	"net/http"
	"strings"
	"sync/atomic"
)

// Registry tracks metrics for telemetry ingestion, publishing, and polling operations.
//
// Uses atomic operations for thread-safe counter updates.
// Metrics are exposed in Prometheus text format via ServeHTTP().
type Registry struct {
	ingestRequestsTotal int64
	eventsReceivedTotal int64
	eventsPublished     int64
	telemetryStored     int64
	kafkaErrorsTotal    int64
	storageErrorsTotal  int64
	batchFlushTotal     int64
	polledEventsQueued  int64
	pollingErrorsTotal  int64
	pollingDroppedTotal int64
	pollerTargetsActive int64
	pollerSyncTotal     int64
	pollerSyncErrors    int64
	pollerTargetStarted int64
	pollerTargetStopped int64
}

// NewRegistry creates a new metrics registry with all counters initialized to zero.
func NewRegistry() *Registry {
	return &Registry{}
}

// IncIngestRequests increments the ingest request counter.
func (r *Registry) IncIngestRequests() {
	atomic.AddInt64(&r.ingestRequestsTotal, 1)
}

// AddEventsReceived adds n to the total events received counter.
func (r *Registry) AddEventsReceived(n int) {
	atomic.AddInt64(&r.eventsReceivedTotal, int64(n))
}

// AddEventsPublished adds n to the total events published counter.
func (r *Registry) AddEventsPublished(n int) {
	atomic.AddInt64(&r.eventsPublished, int64(n))
}

// AddTelemetryStored adds n to the total telemetry stored counter.
func (r *Registry) AddTelemetryStored(n int) {
	atomic.AddInt64(&r.telemetryStored, int64(n))
}

// IncKafkaErrors increments the Kafka error counter.
func (r *Registry) IncKafkaErrors() {
	atomic.AddInt64(&r.kafkaErrorsTotal, 1)
}

// IncStorageErrors increments the storage error counter.
func (r *Registry) IncStorageErrors() {
	atomic.AddInt64(&r.storageErrorsTotal, 1)
}

// IncBatchFlush increments the batch flush counter.
func (r *Registry) IncBatchFlush() {
	atomic.AddInt64(&r.batchFlushTotal, 1)
}

// IncPolledEventsQueued increments the polled events queued counter.
func (r *Registry) IncPolledEventsQueued() {
	atomic.AddInt64(&r.polledEventsQueued, 1)
}

// IncPollingErrors increments the polling error counter.
func (r *Registry) IncPollingErrors() {
	atomic.AddInt64(&r.pollingErrorsTotal, 1)
}

// IncPollingDropped increments the polling dropped events counter.
func (r *Registry) IncPollingDropped() {
	atomic.AddInt64(&r.pollingDroppedTotal, 1)
}

// SetPollerTargetsActive sets the active poller targets gauge to the given value.
//
// Negative values are clamped to zero.
func (r *Registry) SetPollerTargetsActive(value int) {
	if value < 0 {
		value = 0
	}
	atomic.StoreInt64(&r.pollerTargetsActive, int64(value))
}

// IncPollerSync increments the poller sync counter.
func (r *Registry) IncPollerSync() {
	atomic.AddInt64(&r.pollerSyncTotal, 1)
}

// IncPollerSyncError increments the poller sync error counter.
func (r *Registry) IncPollerSyncError() {
	atomic.AddInt64(&r.pollerSyncErrors, 1)
}

// IncPollerTargetStarted increments the poller target started counter.
func (r *Registry) IncPollerTargetStarted() {
	atomic.AddInt64(&r.pollerTargetStarted, 1)
}

// IncPollerTargetStopped increments the poller target stopped counter.
func (r *Registry) IncPollerTargetStopped() {
	atomic.AddInt64(&r.pollerTargetStopped, 1)
}

// ServeHTTP renders metrics in Prometheus format for HTTP endpoints.
func (r *Registry) ServeHTTP(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
	_, _ = w.Write([]byte(r.Render()))
}

func (r *Registry) Render() string {
	var b strings.Builder
	appendCounter(&b, "ingest_requests_total", atomic.LoadInt64(&r.ingestRequestsTotal))
	appendCounter(&b, "events_received_total", atomic.LoadInt64(&r.eventsReceivedTotal))
	appendCounter(&b, "events_published_total", atomic.LoadInt64(&r.eventsPublished))
	appendCounter(&b, "telemetry_stored_total", atomic.LoadInt64(&r.telemetryStored))
	appendCounter(&b, "kafka_errors_total", atomic.LoadInt64(&r.kafkaErrorsTotal))
	appendCounter(&b, "storage_errors_total", atomic.LoadInt64(&r.storageErrorsTotal))
	appendCounter(&b, "batch_flush_total", atomic.LoadInt64(&r.batchFlushTotal))
	appendCounter(&b, "polled_events_queued_total", atomic.LoadInt64(&r.polledEventsQueued))
	appendCounter(&b, "polling_errors_total", atomic.LoadInt64(&r.pollingErrorsTotal))
	appendCounter(&b, "polling_dropped_total", atomic.LoadInt64(&r.pollingDroppedTotal))
	appendGauge(&b, "poller_targets_active", atomic.LoadInt64(&r.pollerTargetsActive))
	appendCounter(&b, "poller_sync_total", atomic.LoadInt64(&r.pollerSyncTotal))
	appendCounter(&b, "poller_sync_errors_total", atomic.LoadInt64(&r.pollerSyncErrors))
	appendCounter(&b, "poller_targets_started_total", atomic.LoadInt64(&r.pollerTargetStarted))
	appendCounter(&b, "poller_targets_stopped_total", atomic.LoadInt64(&r.pollerTargetStopped))
	return b.String()
}

func appendCounter(b *strings.Builder, name string, value int64) {
	_, _ = fmt.Fprintf(b, "# TYPE %s counter\n", name)
	_, _ = fmt.Fprintf(b, "%s %d\n", name, value)
}

func appendGauge(b *strings.Builder, name string, value int64) {
	_, _ = fmt.Fprintf(b, "# TYPE %s gauge\n", name)
	_, _ = fmt.Fprintf(b, "%s %d\n", name, value)
}
