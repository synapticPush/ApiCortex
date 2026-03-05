package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/rs/zerolog"

	"ingest-service/internal/buffer"
	"ingest-service/internal/metrics"
	"ingest-service/internal/model"
)

type Handler struct {
	batcher         *buffer.Batcher
	metrics         *metrics.Registry
	logger          zerolog.Logger
	maxEventsPerReq int
}

func NewHandler(b *buffer.Batcher, m *metrics.Registry, logger zerolog.Logger, maxEventsPerReq int) *Handler {
	return &Handler{batcher: b, metrics: m, logger: logger, maxEventsPerReq: maxEventsPerReq}
}

func (h *Handler) IngestTelemetry(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	h.metrics.IncIngestRequests()

	body := http.MaxBytesReader(w, r.Body, 20*1024*1024)
	defer body.Close()

	decoder := json.NewDecoder(body)
	decoder.DisallowUnknownFields()

	var events []model.TelemetryEvent
	if err := decoder.Decode(&events); err != nil {
		if err == io.EOF {
			http.Error(w, "empty body", http.StatusBadRequest)
			return
		}
		http.Error(w, fmt.Sprintf("invalid JSON body: %v", err), http.StatusBadRequest)
		return
	}
	if len(events) == 0 {
		http.Error(w, "request must include at least one event", http.StatusBadRequest)
		return
	}
	if len(events) > h.maxEventsPerReq {
		http.Error(w, fmt.Sprintf("max events per request is %d", h.maxEventsPerReq), http.StatusBadRequest)
		return
	}

	for i := range events {
		if err := events[i].ValidateForModelProcessing(); err != nil {
			http.Error(w, fmt.Sprintf("event[%d] validation failed: %v", i, err), http.StatusBadRequest)
			return
		}
	}

	if !h.batcher.TryEnqueue(events) {
		h.logger.Warn().Int("events", len(events)).Int("queue_len", h.batcher.QueueLen()).Int("queue_cap", h.batcher.QueueCap()).Msg("buffer overflow")
		http.Error(w, "buffer at capacity", http.StatusTooManyRequests)
		return
	}

	h.metrics.AddEventsReceived(len(events))

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"accepted": len(events),
		"status":   "queued",
	})
}

func (h *Handler) Health(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func (h *Handler) Ready(w http.ResponseWriter, _ *http.Request) {
	if h.batcher.QueueLen() >= h.batcher.QueueCap() {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusServiceUnavailable)
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "degraded"})
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "ready"})
}
