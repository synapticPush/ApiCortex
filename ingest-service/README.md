# ingest-service

ApiCortex data-plane telemetry ingestion service implemented in Go. It receives high-volume raw API telemetry, validates required fields, batches events in-memory, and publishes gzip-compressed JSON batches to Kafka topic `telemetry.raw`.

## Architecture

- HTTP Ingest API: `POST /v1/telemetry`
- Interactive API docs: `GET /swagger` (Swagger UI)
- Validation: strict schema and rule checks for required ingestion and model-processing fields
- Buffering: lock-free channel queue with backpressure
- Batching: flush on `batch_size >= 500` or `flush_interval >= 2s`
- Publish: worker goroutines push compressed batches to Kafka over mTLS
- Observability: `/metrics`, `/health`, `/ready`
- Security middleware: API key auth, request ID propagation, recovery, and hardened headers
- Abuse protection: per-IP token-bucket rate limiting

## Project Layout

```text
ingest-service/
├── cmd/server/main.go
├── internal/api/handler.go
├── internal/buffer/batcher.go
├── internal/config/config.go
├── internal/kafka/producer.go
├── internal/metrics/metrics.go
├── internal/model/telemetry.go
├── Dockerfile
├── go.mod
└── README.md
```

## Event Schema

```json
{
  "timestamp": "RFC3339",
  "org_id": "uuid",
  "api_id": "uuid",
  "endpoint": "/users/{id}",
  "method": "GET",
  "status": 200,
  "latency_ms": 120,
  "request_size_bytes": 512,
  "response_size_bytes": 2048,
  "schema_hash": "sha256",
  "schema_version": "v1",
  "client_region": "ap-south-1"
}
```

## API

### POST /v1/telemetry

- Request body: JSON array of telemetry events
- Max events per request: `1000`
- Response: `202 Accepted` when queued
- Backpressure: `429 Too Many Requests` when in-memory queue is full

### GET /health

Returns process health.

### GET /ready

Returns readiness based on queue saturation.

### GET /metrics

Prometheus-style counters:

- `ingest_requests_total`
- `events_received_total`
- `events_published_total`
- `kafka_errors_total`
- `batch_flush_total`

### GET /swagger

Swagger UI for endpoint testing (similar to FastAPI `/docs`).

### GET /swagger/openapi.json

OpenAPI 3.0 schema served by the ingest service.

## Validation Rules

Required fields:

- `timestamp`
- `org_id`
- `api_id`
- `endpoint`
- `method`
- `status`
- `latency_ms`

Rule checks:

- `timestamp` must be RFC3339
- `org_id`, `api_id` must be valid UUID
- `latency_ms >= 0`
- `status` must be `100..599`
- `endpoint` length must be `< 256`
- `method` must be uppercase HTTP verb

## Model Input Schema Check

The ingestion validator enforces all fields needed by downstream feature generation from raw telemetry:

- Request identity and tenancy: `org_id`, `api_id`, `endpoint`, `method`, `timestamp`
- Failure and latency signals: `status`, `latency_ms`
- Optional enrichers for future features: `request_size_bytes`, `response_size_bytes`, `schema_hash`, `schema_version`, `client_region`

This guarantees each accepted raw event can be transformed into time-windowed aggregates consumed by the ApiCortex ML training and inference pipeline.

## Environment Variables

Required:

- `KAFKA_SERVICE_URI` (comma-separated brokers)
- `KAFKA_CA_CERT_PATH`
- `KAFKA_SERVICE_CERT_PATH`
- `KAFKA_SERVICE_KEY_PATH`

Optional:

- `PORT` (default `8080`)
- `BATCH_SIZE` (default `500`)
- `FLUSH_INTERVAL_SECONDS` (default `2`)
- `MAX_BUFFER_CAPACITY` (default `50000`)
- `MAX_EVENTS_PER_REQUEST` (default `1000`)
- `PUBLISH_WORKER_COUNT` (default `4`)
- `REQUIRE_API_KEY` (default `true`)
- `INGEST_API_KEY` (required when `REQUIRE_API_KEY=true`)
- `RATE_LIMIT_RPS` (default `4000`)
- `RATE_LIMIT_BURST` (default `8000`)

## Run Locally

```bash
go mod tidy
export INGEST_API_KEY='replace-with-strong-key'
go run ./cmd/server
```

Auth headers for `POST /v1/telemetry`:

- `X-API-Key: <INGEST_API_KEY>`
- `Authorization: Bearer <INGEST_API_KEY>`

## Build Docker Image

```bash
docker build -t apicortex-ingest-service .
docker run --rm -p 8080:8080 \
  -e KAFKA_SERVICE_URI=broker:9093 \
  -e KAFKA_CA_CERT_PATH=/certs/ca.pem \
  -e KAFKA_SERVICE_CERT_PATH=/certs/service.cert \
  -e KAFKA_SERVICE_KEY_PATH=/certs/service.key \
  -v $(pwd)/certs:/certs \
  apicortex-ingest-service
```

## Performance Notes

- Buffered queue with atomic full-batch enqueue for consistent backpressure behavior
- Batched compressed writes reduce Kafka overhead
- Concurrent publish workers improve throughput under sustained load
- Tight validation and decoding path minimizes per-event processing cost
- Per-IP token bucket protects service under traffic spikes and abuse
