package buffer

import (
	"context"
	"sync"
	"time"

	"github.com/rs/zerolog"

	"ingest-service/internal/kafka"
	"ingest-service/internal/metrics"
	"ingest-service/internal/model"
)

type Batcher struct {
	eventCh       chan model.TelemetryEvent
	flushCh       chan []model.TelemetryEvent
	batchSize     int
	flushInterval time.Duration
	producer      *kafka.Producer
	metrics       *metrics.Registry
	logger        zerolog.Logger
	workers       int
	wg            sync.WaitGroup
	enqueueMu     sync.Mutex
}

func NewBatcher(maxCapacity, batchSize int, flushInterval time.Duration, workers int, producer *kafka.Producer, m *metrics.Registry, logger zerolog.Logger) *Batcher {
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
	}
}

func (b *Batcher) Start(_ context.Context) {
	b.wg.Add(1)
	go b.runCollector()

	for i := 0; i < b.workers; i++ {
		b.wg.Add(1)
		go b.runPublisher(i)
	}
}

func (b *Batcher) Stop() {
	close(b.eventCh)
	b.wg.Wait()
}

func (b *Batcher) QueueLen() int {
	return len(b.eventCh)
}

func (b *Batcher) QueueCap() int {
	return cap(b.eventCh)
}

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
	b.logger.Debug().Int("worker_id", workerID).Int("batch_size", len(batch)).Msg("published telemetry batch")
}
