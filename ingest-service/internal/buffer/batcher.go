package buffer

import (
	"context"
	"sync"
	"time"

	"github.com/rs/zerolog"

	"ingest-service/internal/kafka"
	"ingest-service/internal/metrics"
	"ingest-service/internal/model"
	"ingest-service/internal/storage"
)

// Batcher collects telemetry events and publishes them in batches to Kafka and TimescaleDB.
//
// Events are buffered in a channel and flushed when either batch size is reached
// or flush interval expires. Uses multiple worker goroutines for concurrent publishing.
type Batcher struct {
	eventCh       chan model.TelemetryEvent
	flushCh       chan []model.TelemetryEvent
	batchSize     int
	flushInterval time.Duration
	producer      *kafka.Producer
	metrics       *metrics.Registry
	logger        zerolog.Logger
	workers       int
	telemetrySink *storage.TimescaleWriter
	wg            sync.WaitGroup
	enqueueMu     sync.Mutex
}

// NewBatcher creates a new event batcher with specified configuration.
//
// Args:
//   - maxCapacity: maximum events to buffer in memory
//   - batchSize: target size for flushing batches
//   - flushInterval: maximum time to wait before flushing
//   - workers: number of concurrent publisher goroutines
//   - producer: Kafka producer for publishing events
//   - m: metrics registry for tracking batches and events
//   - logger: structured logger instance
//   - telemetrySink: TimescaleDB writer for telemetry storage
//
// Returns configured Batcher instance ready to Start().
func NewBatcher(maxCapacity, batchSize int, flushInterval time.Duration, workers int, producer *kafka.Producer, m *metrics.Registry, logger zerolog.Logger, telemetrySink *storage.TimescaleWriter) *Batcher {
	if workers < 1 {
		workers = 1
	}
	if batchSize < 1 {
		batchSize = 1
	}
	return &Batcher{
		eventCh:       make(chan model.TelemetryEvent, maxCapacity),
		flushCh:       make(chan []model.TelemetryEvent, 256),
		batchSize:     batchSize,
		flushInterval: flushInterval,
		producer:      producer,
		metrics:       m,
		logger:        logger,
		workers:       workers,
		telemetrySink: telemetrySink,
	}
}

// Start begins the collector and worker goroutines.
//
// Must be called before TryEnqueue() to process events.
func (b *Batcher) Start(_ context.Context) {
	b.wg.Add(1)
	go b.runCollector()

	for i := 0; i < b.workers; i++ {
		b.wg.Add(1)
		go b.runPublisher(i)
	}
}

// Stop gracefully shuts down the batcher, waiting for all pending events to be processed.
func (b *Batcher) Stop() {
	close(b.eventCh)
	b.wg.Wait()
}

// QueueLen returns the current number of events in the buffer.
func (b *Batcher) QueueLen() int {
	return len(b.eventCh)
}

// QueueCap returns the maximum capacity of the event buffer.
func (b *Batcher) QueueCap() int {
	return cap(b.eventCh)
}

// TryEnqueue attempts to enqueue events without blocking.
//
// Returns false if buffer does not have enough space for all events.
// Returns true if all events were enqueued or slice was empty.
func (b *Batcher) TryEnqueue(events []model.TelemetryEvent) bool {
	if len(events) == 0 {
		return true
	}
	b.enqueueMu.Lock()
	defer b.enqueueMu.Unlock()

	if len(events) > (cap(b.eventCh) - len(b.eventCh)) {
		return false
	}
	for _, evt := range events {
		b.eventCh <- evt
	}
	return true
}

func (b *Batcher) runCollector() {
	defer b.wg.Done()
	defer close(b.flushCh)

	ticker := time.NewTicker(b.flushInterval)
	defer ticker.Stop()

	batch := make([]model.TelemetryEvent, 0, b.batchSize)

	flushNow := func() {
		if len(batch) == 0 {
			return
		}
		out := make([]model.TelemetryEvent, len(batch))
		copy(out, batch)
		batch = batch[:0]
		b.metrics.IncBatchFlush()
		b.flushCh <- out
	}

	for {
		select {
		case evt, ok := <-b.eventCh:
			if !ok {
				flushNow()
				return
			}
			batch = append(batch, evt)
			if len(batch) >= b.batchSize {
				flushNow()
			}
		case <-ticker.C:
			flushNow()
		}
	}
}

func (b *Batcher) runPublisher(workerID int) {
	defer b.wg.Done()
	for batch := range b.flushCh {
		b.publish(batch, workerID)
	}
}

func (b *Batcher) publish(batch []model.TelemetryEvent, workerID int) {
	pubCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := b.producer.PublishBatch(pubCtx, batch); err != nil {
		b.logger.Error().Err(err).Int("worker_id", workerID).Int("batch_size", len(batch)).Msg("failed to publish telemetry batch")
		return
	}
	if b.telemetrySink != nil {
		if err := b.telemetrySink.WriteBatch(pubCtx, batch); err != nil {
			b.metrics.IncStorageErrors()
			b.logger.Error().Err(err).Int("worker_id", workerID).Int("batch_size", len(batch)).Msg("failed to persist telemetry batch")
		} else {
			b.metrics.AddTelemetryStored(len(batch))
		}
	}
	b.logger.Debug().Int("worker_id", workerID).Int("batch_size", len(batch)).Msg("published telemetry batch")
}
