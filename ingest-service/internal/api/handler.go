package api

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"

	"github.com/rs/zerolog"

	"ingest-service/internal/buffer"
	"ingest-service/internal/metrics"
	"ingest-service/internal/model"
	"ingest-service/internal/tracker"
)

type Handler struct {
	batcher         *buffer.Batcher
	metrics         *metrics.Registry
	tracker         *tracker.LiveTracker
	logger          zerolog.Logger
	maxEventsPerReq int
	orgValidator    OrgValidator
	masterAPIKey    string
}

type OrgValidator interface {
	Validate(ctx context.Context, orgID string) (bool, error)
	ValidateIngestKey(ctx context.Context, orgID string, providedAPIKey string) (bool, error)
}

func NewHandler(b *buffer.Batcher, m *metrics.Registry, t *tracker.LiveTracker, logger zerolog.Logger, maxEventsPerReq int, orgValidator OrgValidator, masterAPIKey string) *Handler {
	return &Handler{batcher: b, metrics: m, tracker: t, logger: logger, maxEventsPerReq: maxEventsPerReq, orgValidator: orgValidator, masterAPIKey: masterAPIKey}
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

	providedAPIKey := ProvidedAPIKeyFromContext(r.Context())
	if h.masterAPIKey != "" && !secureEqual(providedAPIKey, h.masterAPIKey) && h.orgValidator == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	if h.orgValidator != nil {
		validatedOrgs := make(map[string]struct{}, len(events))
		for i := range events {
			orgID := events[i].OrgID
			if _, exists := validatedOrgs[orgID]; exists {
				continue
			}
			ok, err := h.orgValidator.Validate(r.Context(), orgID)
			if err != nil {
				http.Error(w, "organization validation unavailable", http.StatusServiceUnavailable)
				return
			}
			if !ok {
				http.Error(w, fmt.Sprintf("event[%d] unknown organization", i), http.StatusForbidden)
				return
			}
			validatedOrgs[orgID] = struct{}{}
		}
		if !secureEqual(providedAPIKey, h.masterAPIKey) {
			if len(validatedOrgs) != 1 {
				http.Error(w, "org-scoped ingest key requires single-org payload", http.StatusBadRequest)
				return
			}
			for orgID := range validatedOrgs {
				keyValid, err := h.orgValidator.ValidateIngestKey(r.Context(), orgID, providedAPIKey)
				if err != nil {
					http.Error(w, "ingest key validation unavailable", http.StatusServiceUnavailable)
					return
				}
				if !keyValid {
					http.Error(w, "unauthorized", http.StatusUnauthorized)
					return
				}
			}
		}
	}

	if !h.batcher.TryEnqueue(events) {
		h.logger.Warn().Int("events", len(events)).Int("queue_len", h.batcher.QueueLen()).Int("queue_cap", h.batcher.QueueCap()).Msg("buffer overflow")
		http.Error(w, "buffer at capacity", http.StatusTooManyRequests)
		return
	}

	h.metrics.AddEventsReceived(len(events))
	for i := range events {
		h.tracker.Observe(events[i])
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	_ = json.NewEncoder(w).Encode(map[string]any{
		"accepted": len(events),
		"status":   "queued",
	})
}

func (h *Handler) ListLiveEndpoints(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	limit := 100
	rawLimit := r.URL.Query().Get("limit")
	if rawLimit != "" {
		parsedLimit, err := strconv.Atoi(rawLimit)
		if err != nil {
			http.Error(w, "invalid limit", http.StatusBadRequest)
			return
		}
		limit = parsedLimit
	}

	orgID := r.URL.Query().Get("org_id")
	apiID := r.URL.Query().Get("api_id")
	method := r.URL.Query().Get("method")
	endpointContains := r.URL.Query().Get("endpoint_contains")

	items := h.tracker.List(limit, orgID, apiID, method, endpointContains)

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"count": len(items),
		"items": items,
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
