package metrics

import (
	"fmt"
	"net/http"
	"strings"
	"sync/atomic"
)

type Registry struct {
	ingestRequestsTotal int64
	eventsReceivedTotal int64
	eventsPublished     int64
	kafkaErrorsTotal    int64
	batchFlushTotal     int64
	polledEventsQueued  int64
	pollingErrorsTotal  int64
	pollingDroppedTotal int64
}

func NewRegistry() *Registry {
	return &Registry{}
}

func (r *Registry) IncIngestRequests() {
	atomic.AddInt64(&r.ingestRequestsTotal, 1)
}

func (r *Registry) AddEventsReceived(n int) {
	atomic.AddInt64(&r.eventsReceivedTotal, int64(n))
}

func (r *Registry) AddEventsPublished(n int) {
	atomic.AddInt64(&r.eventsPublished, int64(n))
}

func (r *Registry) IncKafkaErrors() {
	atomic.AddInt64(&r.kafkaErrorsTotal, 1)
}

func (r *Registry) IncBatchFlush() {
	atomic.AddInt64(&r.batchFlushTotal, 1)
}

func (r *Registry) IncPolledEventsQueued() {
	atomic.AddInt64(&r.polledEventsQueued, 1)
}

func (r *Registry) IncPollingErrors() {
	atomic.AddInt64(&r.pollingErrorsTotal, 1)
}

func (r *Registry) IncPollingDropped() {
	atomic.AddInt64(&r.pollingDroppedTotal, 1)
}

func (r *Registry) ServeHTTP(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
	_, _ = w.Write([]byte(r.Render()))
}

func (r *Registry) Render() string {
	var b strings.Builder
	appendCounter(&b, "ingest_requests_total", atomic.LoadInt64(&r.ingestRequestsTotal))
	appendCounter(&b, "events_received_total", atomic.LoadInt64(&r.eventsReceivedTotal))
	appendCounter(&b, "events_published_total", atomic.LoadInt64(&r.eventsPublished))
	appendCounter(&b, "kafka_errors_total", atomic.LoadInt64(&r.kafkaErrorsTotal))
	appendCounter(&b, "batch_flush_total", atomic.LoadInt64(&r.batchFlushTotal))
	appendCounter(&b, "polled_events_queued_total", atomic.LoadInt64(&r.polledEventsQueued))
	appendCounter(&b, "polling_errors_total", atomic.LoadInt64(&r.pollingErrorsTotal))
	appendCounter(&b, "polling_dropped_total", atomic.LoadInt64(&r.pollingDroppedTotal))
	return b.String()
}

func appendCounter(b *strings.Builder, name string, value int64) {
	_, _ = fmt.Fprintf(b, "# TYPE %s counter\n", name)
	_, _ = fmt.Fprintf(b, "%s %d\n", name, value)
}
