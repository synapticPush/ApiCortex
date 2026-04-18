# ingest-service

ApiCortex data-plane telemetry ingestion service implemented in Go. It receives high-volume raw API telemetry, validates required fields, batches events in-memory, and publishes gzip-compressed JSON batches to Kafka topic `telemetry.raw`.

## Table of Contents

- [Architecture](#architecture)
- [Module Reference](#module-reference)
- [Event Schema](#event-schema)
- [API Reference](#api-reference)
- [Validation Rules](#validation-rules)
- [Configuration](#configuration)
- [Deployment](#deployment)
- [Development Setup](#development-setup)
- [Security Considerations](#security-considerations)
- [Performance Notes](#performance-notes)

## Architecture

High-level service topology:

```text
HTTP Client
    ↓
┌─────────────────────────────────────┐
│   HTTP API Handler & Middleware     │
│  (Security, Rate Limiting, Auth)    │
└──────────────┬──────────────────────┘
               ↓
┌──────────────────────────────┐
│  Telemetry Validator         │
│  (Schema + Rule Enforcement) │
└──────────────┬───────────────┘
               ↓
┌──────────────────────────────────┐
│  In-Memory Event Batcher         │
│  (Lock-free Channel + Workers)   │
├──────────────────────────────────┤
│  Buffer: Flush on size or time   │
└──────────────┬─────────────────────────────────┐
               ↓                                 ↓
        ┌─────────────┐              ┌────────────────────┐
        │ Kafka       │              │ TimescaleDB        │
        │ Publisher   │              │ Writer             │
        │ (mTLS)      │              │ (PostgreSQL)       │
        └─────────────┘              └────────────────────┘
               ↓
        ┌──────────────┐
        │ telemetry.raw│
        │ Topic        │
        └──────────────┘

```

**Key Characteristics:**
- Horizontal scalability: stateless HTTP service with async Kafka publishing
- High throughput: batched writes, worker pool pattern, gzip compression
- Fault tolerance: at-least-once semantics (Kafka RequireAll acks); database writes use local transaction rollback on errors
- Observability: structured logging (zerolog), Prometheus metrics, request IDs
- Security: mTLS to Kafka/database, API key validation, org-scoped data isolation, rate limiting
- Optional active polling: concurrent target monitoring with configurable intervals and backoff

## Module Reference

### cmd/server/main.go

**Purpose:** Application entry point and initialization.

**Responsibilities:**
- Load configuration from environment variables and `.env` file
- Initialize infrastructure (Kafka producer, database connections, metrics registry)
- Set up HTTP middleware stack (CORS, security headers, rate limiting, API key auth, request logging)
- Register HTTP endpoints and handlers
- Manage service lifecycle (graceful shutdown, signal handling)
- Optionally start active polling service with target reconciliation loop

**Key Functions:**
- `main()`: Service initialization and HTTP server start
- `buildStaticTargets()`: Convert configuration polling targets to internal format
- `mergeTargets()`: Dedup and merge static + database-loaded targets
- `pollingTargetKey()`: Generate unique key for target deduplication
- `pollSyncState`: Track sync state across reconciliation attempts
- `withRequestLogging()`: Add structured logging middleware

### internal/config/config.go

**Purpose:** Configuration management with environment variable binding.

**Structs:**
- `Config`: 28+ settings (database URLs, Kafka endpoints, API limits, polling config)
- `PollTargetConfig`: Static polling target definition (URL, method, interval, headers, etc.)

**Functions:**
- `Load()`: Read from `.env` file + environment variables (env vars override file)

**Configuration Hierarchy:**
1. Defaults in code
2. `.env` file values (optional)
3. Environment variable overrides (highest priority)

### internal/api/handler.go

**Purpose:** HTTP request handlers for telemetry ingestion and endpoint tracking.

**Types:**
- `Handler`: Main request router with dependencies (batcher, metrics, validator)
- `OrgValidator`: Interface for validating organization membership and ingest keys

**Handlers:**
- `IngestTelemetry()`: POST `/v1/telemetry`
  - Validates request format (max 20MB, max 1000 events)
  - Enforces organization membership
  - Enqueues to batcher (returns 202 Accepted)
  - Backpressure: 429 Too Many Requests if queue full
- `ListLiveEndpoints()`: GET `/v1/endpoints/live`
  - Returns rolling aggregates keyed by org_id, api_id, endpoint, method
  - Query params: limit (1-1000), org_id, api_id, method, endpoint_contains
- `Health()`: GET `/health` - process health check
- `Ready()`: GET `/ready` - readiness based on queue saturation

**Authentication:**
- Master API key bypass (if configured)
- Per-organization ingest key validation (bcrypt comparison with pepper)

### internal/api/middleware.go

**Purpose:** HTTP middleware stack for security and observability.

**Middleware Functions:**
1. `Chain()`: Compose middleware stack
2. `RecoverMiddleware()`: Panic recovery with error logging
3. `RequestIDMiddleware()`: Generate request ID for tracing
4. `SecurityHeadersMiddleware()`: Hardened response headers (X-Content-Type-Options, X-Frame-Options, etc.)
5. `RateLimitMiddleware()`: Per-IP token bucket rate limiting
6. `APIKeyAuthMiddleware()`: Master API key validation (if required)
7. `CORSMiddleware()`: CORS headers with allowlist

**Rate Limiter:**
- Token bucket per IP address
- Configurable RPS (requests per second) and burst capacity
- Automatic cleanup of stale entries every 2 minutes (TTL: 5 minutes)

### internal/api/swagger.go

**Purpose:** OpenAPI documentation and Swagger UI.

**Functions:**
- `SwaggerUI()`: GET `/swagger` - Interactive Swagger UI (HTML)
- `SwaggerSpec()`: GET `/swagger/openapi.json` - OpenAPI 3.0 schema (JSON)

**Schema Coverage:**
- Request/response models
- All endpoints with descriptions
- Security schemes (API Key header and bearer token)
- Status codes and error responses

### internal/buffer/batcher.go

**Purpose:** Event batching and publishing to Kafka and TimescaleDB.

**Architecture:**
- Single collector goroutine: receives events from `eventCh` (buffered channel)
- N publisher workers: dequeue batches, publish to Kafka + TimescaleDB
- Flush triggers: batch size >= 500 OR time >= 2s (configurable)

**Types:**
- `Batcher`: Main buffering orchestrator
- `batch`: Internal batch representation

**Methods:**
- `NewBatcher()`: Initialize with capacity, batch size, flush interval, worker count
- `Start()`: Begin collector and publisher goroutines
- `Stop()`: Graceful shutdown (flush pending, wait for workers)
- `TryEnqueue()`: Non-blocking batch insert (returns false if queue full)
- `QueueLen()`: Current event count
- `QueueCap()`: Maximum event capacity

**Backpressure Pattern:**
- Queue full → caller receives `429 Too Many Requests` (no retry)
- Publishers slow → queue fills, ingest API rejects requests
- Ensures memory-bounded operation under sustained load

### internal/buffer/errors.go

**Purpose:** Error handling and categorization.

Defines error types for diagnostics and metrics.

### internal/kafka/producer.go

**Purpose:** Kafka event publishing with TLS authentication.

**Types:**
- `Producer`: Kafka writer with connection management

**Methods:**
- `NewProducer()`: Initialize with broker URLs and TLS credentials (CA, cert, key)
- `PublishBatch()`: Send events to `telemetry.raw` topic
- `Close()`: Graceful shutdown

**Publishing Details:**
- Compression: gzip
- Batching: events grouped into single Kafka message
- Message headers: schema version, content-type, content-encoding
- Acknowledgment: RequireAll (all replicas)
- Balancer: LeastBytes (even distribution across partitions)
- Semantics: at-least-once (no idempotency key)

### internal/metrics/metrics.go

**Purpose:** Prometheus-format metrics tracking.

**Types:**
- `Registry`: Prometheus-compatible collector with 15+ metrics

**Metrics Tracked:**
- `ingest_requests_total`: HTTP POST /v1/telemetry requests
- `events_received_total`: Telemetry events accepted by validator
- `events_published_total`: Events successfully sent to Kafka
- `telemetry_stored_total`: Events written to TimescaleDB
- `kafka_errors_total`: Kafka publish failures
- `storage_errors_total`: Database write failures
- `batch_flush_total`: Batch flushes (timer vs size)
- `polled_events_queued_total`: Events generated by active polling
- `polling_errors_total`: Polling request failures
- `polling_dropped_total`: Dropped poll results (invalid schema)
- `poller_targets_active`: Currently active polling targets
- Plus: queue depth gauges, latency histograms

**Thread Safety:** All methods use atomic operations.

### internal/model/telemetry.go

**Purpose:** Telemetry event data model and validation.

**Types:**
- `TelemetryEvent`: 12 fields (timestamp, org_id, api_id, endpoint, method, status, latency_ms, sizes, schema metadata)

**Validation Methods:**
- `Validate()`: Enforces required ingestion fields (org_id, api_id, endpoint, method, status, latency_ms, timestamp)
- `ValidateForModelProcessing()`: Stricter checks for ML pipeline (timestamps in RFC3339, UUIDs valid, HTTP status 100-599, latency >= 0)

**Field Rules:**
- `timestamp`: RFC3339 format (required)
- `org_id`, `api_id`, `endpoint_id` (optional): Valid UUID
- `status`: HTTP status code (100-599)
- `latency_ms`: Non-negative integer
- `endpoint`: Max 256 characters
- `method`: Uppercase HTTP verb (GET, POST, PUT, DELETE, etc.)
- `request_size_bytes`, `response_size_bytes`: Non-negative (optional)

### internal/orgvalidator/validator.go

**Purpose:** Organization and ingest key validation against control-plane database.

**Types:**
- `Validator`: Validates org membership and ingest key credentials
- `cacheEntry`: Cached org validation result (TTL: 5 minutes default)
- `keyCacheEntry`: Cached ingest key validation (bcrypt pepper)

**Methods:**
- `New()`: Initialize with control-plane database URL
- `Validate()`: Check if org_id exists (cached)
- `ValidateIngestKey()`: Verify ingest key with bcrypt comparison
- `Close()`: Clean database connection

**Caching Strategy:**
- In-memory TTL cache with automatic cleanup
- Cache key: org_id for Validate(), ingest_key hash for ValidateIngestKey()
- Improves throughput by avoiding repeated database lookups

**Nil Behavior:** Validator can be nil for passthrough mode (no org validation).

### internal/poller/poller.go

**Purpose:** Concurrent polling of monitored API endpoints with telemetry publishing.

**Types:**
- `Target`: Polling configuration (URL, method, interval, timeout, headers, body, expected status codes)
- `TargetStatus`: Current polling state (last status, latency, error, consecutive failures)
- `targetRunner`: Per-target polling goroutine
- `Poller`: Manages target lifecycle and concurrent runners

**Methods:**
- `New()`: Initialize with target list, batcher, metrics, logger
- `Start()`: Begin polling all targets
- `Wait()`: Block until all target goroutines complete
- `AddOrUpdateTarget()`: Add new target or replace existing (returns target key + bool)
- `Reconcile()`: Sync desired targets (start new, stop removed, update existing)
- `ActiveTargetCount()`: Current active poller count
- `Snapshot()`: Export all target statuses

**Concurrency:**
- One goroutine per target (exponential backoff on failures)
- HTTP transport: 256 max idle conns, 64 per-host, 90s idle timeout
- Lock-free target deduplication via fingerprinting

**Target Reconciliation:**
- Desired state from config + database
- Merge static + dynamic targets (static takes precedence on conflict)
- Add/update/remove targets to match desired state

### internal/poller/store.go

**Purpose:** Polling target persistence in PostgreSQL.

**Types:**
- `DBTargetStore`: Loads polling targets from control-plane database

**Methods:**
- `NewDBTargetStore()`: Initialize with database URL and default polling params
- `ListTargets()`: Query all active targets from `api_endpoint` table
- `Close()`: Close database connection

**Database Connection:**
- Max 8 open connections, 4 idle (connection pooling)
- 15-minute connection lifetime

**Nil Behavior:** Returns nil store if database URL is empty (passthrough mode).

### internal/storage/timescale_writer.go

**Purpose:** TimescaleDB hypertable storage for long-term telemetry.

**Types:**
- `TimescaleWriter`: Manages database writes to `api_telemetry` hypertable

**Methods:**
- `NewTimescaleWriter()`: Initialize with database URL
- `WriteBatch()`: Insert batch of events in transaction
- `Close()`: Close database connection

**Database Constraints:**
- Max 8 open connections, 4 idle (connection pooling)
- 30-minute connection lifetime
- Prepared statements for performance
- Nil write early if database is nil (passthrough mode)

**Schema:**
- Hypertable: `api_telemetry`
- Partitioning: Time-based (TimescaleDB internals)
- Fields: time, org_id, api_id, endpoint, method, status, latency_ms, request_size, response_size

### internal/tracker/live_tracker.go

**Purpose:** Real-time endpoint state tracking for live API.

**Types:**
- `LiveTracker`: Maintains rolling statistics for monitored endpoints
- `endpointState`: Per-endpoint aggregates (request count, error rate, latency)
- `endpointKey`: Unique identifier (org_id, api_id, endpoint, method)

**Methods:**
- `NewLiveTracker()`: Initialize with retention period (TTL)
- `Observe()`: Record telemetry event, update endpoint stats
- `List()`: Export endpoint states with filtering/pagination

**Stats Maintained:**
- Request count (total, successes, errors)
- Error rate percentage
- Average latency (running average)
- Last status and latency
- Last observation timestamp

**Retention:** Data older than retention period is automatically removed.

## Event Schema

```json
{
  "timestamp": "2023-01-15T10:30:45.123456Z",
  "org_id": "550e8400-e29b-41d4-a716-446655440000",
  "api_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "endpoint": "/users/{id}",
  "method": "GET",
  "status": 200,
  "latency_ms": 125,
  "request_size_bytes": 512,
  "response_size_bytes": 2048,
  "schema_hash": "sha256:abc123...",
  "schema_version": "v1",
  "client_region": "ap-south-1"
}
```

**Required Fields:** timestamp, org_id, api_id, endpoint, method, status, latency_ms

**Optional Fields:** request_size_bytes, response_size_bytes, schema_hash, schema_version, client_region

## API Reference

### POST /v1/telemetry

Ingest telemetry events.

**Request:**
```bash
curl -X POST http://localhost:8080/v1/telemetry \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '[
    {
      "timestamp": "2023-01-15T10:30:45Z",
      "org_id": "550e8400-e29b-41d4-a716-446655440000",
      "api_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "endpoint": "/users",
      "method": "GET",
      "status": 200,
      "latency_ms": 100
    }
  ]'
```

**Response (202 Accepted):**
```json
{
  "accepted": 1,
  "status": "queued"
}
```

**Error Responses:**
- `400 Bad Request`: Invalid JSON or schema violation
- `401 Unauthorized`: Missing or invalid API key
- `429 Too Many Requests`: Queue full or rate limit exceeded
- `503 Service Unavailable`: Validation service unavailable

### GET /v1/endpoints/live

List live endpoint statistics.

**Query Parameters:**
- `limit` (1-1000, default 100): Number of results
- `org_id` (optional): Filter by organization
- `api_id` (optional): Filter by API
- `method` (optional): Filter by HTTP method
- `endpoint_contains` (optional): Substring match on endpoint path

**Request:**
```bash
curl "http://localhost:8080/v1/endpoints/live?org_id=550e8400-e29b-41d4-a716-446655440000&limit=50"
```

**Response:**
```json
{
  "count": 1,
  "items": [
    {
      "org_id": "550e8400-e29b-41d4-a716-446655440000",
      "api_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "endpoint": "/users",
      "method": "GET",
      "requests": 1250,
      "successes": 1200,
      "errors": 50,
      "error_rate": 0.04,
      "avg_latency_ms": 125.5,
      "last_latency_ms": 132,
      "last_status": 200,
      "last_seen_at": "2023-01-15T10:35:20Z"
    }
  ]
}
```

### GET /v1/endpoints/live/status

Polling service status and sync state (when active polling enabled).

**Response:**
```json
{
  "monitoring_enabled": true,
  "active_targets": 12,
  "sync": {
    "last_attempt": "2023-01-15T10:35:20Z",
    "last_success": "2023-01-15T10:35:20Z",
    "last_error": "",
    "active_count": 12
  },
  "items": [
    {
      "target_key": "...",
      "name": "users-health",
      "endpoint_id": "...",
      "org_id": "...",
      "api_id": "...",
      "endpoint": "/health",
      "method": "GET",
      "active": true,
      "last_status": 200,
      "last_latency_ms": 15,
      "last_error": "",
      "last_polled_at": "2023-01-15T10:35:18Z",
      "next_poll_at": "2023-01-15T10:35:33Z",
      "consecutive_failures": 0
    }
  ]
}
```

### GET /health

Process health check.

**Response (200 OK):**
```json
{
  "status": "ok"
}
```

### GET /ready

Readiness probe (based on queue saturation).

**Response (200 OK):** Service is ready
**Response (503 Service Unavailable):** Queue capacity exceeded

### GET /metrics

Prometheus-format metrics.

**Example Output:**
```text
# HELP ingest_requests_total Total HTTP POST /v1/telemetry requests
# TYPE ingest_requests_total counter
ingest_requests_total{status="2xx"} 45000
ingest_requests_total{status="4xx"} 120
ingest_requests_total{status="5xx"} 5

# HELP events_received_total Total telemetry events accepted by validator
# TYPE events_received_total counter
events_received_total 450000

# HELP events_published_total Total events successfully sent to Kafka
# TYPE events_published_total counter
events_published_total 448000
```

### GET /swagger, /swagger/

Swagger UI for interactive API testing.

### GET /swagger/openapi.json

OpenAPI 3.0 schema in JSON format.

## Validation Rules

### Ingestion Validation

Required fields must be present:
- `timestamp`: RFC3339 format
- `org_id`: Valid UUID
- `api_id`: Valid UUID
- `endpoint`: Non-empty, max 256 characters
- `method`: Non-empty, uppercase HTTP verb (e.g., GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS)
- `status`: HTTP status code (100-599)
- `latency_ms`: Non-negative integer

### Model Processing Validation

Stricter checks for ML feature generation:
- All ingestion rules apply (see above)
- `endpoint_id`, `request_size_bytes`, `response_size_bytes` should be present (optional but recommended)
- `client_region` recommended for geo-distributed systems

### Examples

**Valid Event:**
```json
{
  "timestamp": "2023-01-15T10:30:45.123Z",
  "org_id": "550e8400-e29b-41d4-a716-446655440000",
  "api_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "endpoint": "/users/123",
  "method": "GET",
  "status": 200,
  "latency_ms": 125
}
```

**Invalid Event (missing status):**
```json
{
  "timestamp": "2023-01-15T10:30:45.123Z",
  "org_id": "550e8400-e29b-41d4-a716-446655440000",
  "api_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "endpoint": "/users/123",
  "method": "GET",
  "latency_ms": 125
}
```

## Configuration

### Environment Variables

**Required:**
- `KAFKA_SERVICE_URI`: Comma-separated Kafka brokers (e.g., `broker1:9093,broker2:9093`)
- `KAFKA_CA_CERT`: PEM-encoded CA certificate for Kafka mTLS
- `KAFKA_SERVICE_CERT`: PEM-encoded client certificate for Kafka mTLS
- `KAFKA_SERVICE_KEY`: PEM-encoded client key for Kafka mTLS

**Optional:**
- `PORT` (default: `8080`): HTTP listen port
- `LOG_LEVEL` (default: `info`): Logging level (debug, info, warn, error)
- `BATCH_SIZE` (default: `500`): Events per batch before flush
- `FLUSH_INTERVAL_SECONDS` (default: `2`): Max time between flushes
- `MAX_BUFFER_CAPACITY` (default: `50000`): In-memory queue capacity
- `MAX_EVENTS_PER_REQUEST` (default: `1000`): Max events per POST request
- `PUBLISH_WORKER_COUNT` (default: `4`): Concurrent Kafka publishers
- `REQUIRE_API_KEY` (default: `true`): Enforce API key authentication
- `INGEST_API_KEY`: API key (required if `REQUIRE_API_KEY=true`)
- `RATE_LIMIT_RPS` (default: `4000`): Requests per second per IP
- `RATE_LIMIT_BURST` (default: `8000`): Burst capacity per IP
- `DATABASE` (optional): PostgreSQL URL for org validation and polling targets
- `ORG_VALIDATION_TTL_SECONDS` (default: `60`): Cache TTL for org lookups
- `INGEST_KEY_PEPPER` (default: `""`): Pepper string for bcrypt key validation
- `TIMESCALE_DATABASE` (optional): TimescaleDB URL for telemetry storage
- `LIVE_TRACK_RETENTION_MINUTES` (default: `120`): Retention for live endpoint stats
- `ACTIVE_POLLING_ENABLED` (default: `false`): Enable active endpoint polling
- `ACTIVE_POLL_TARGETS` (optional): JSON array of static polling targets
- `DEFAULT_POLL_INTERVAL_SECONDS` (default: `30`): Default polling interval
- `DEFAULT_POLL_TIMEOUT_MS` (default: `5000`): Default polling timeout
- `POLLING_BACKOFF_MAX_SECONDS` (default: `300`): Max backoff on poll failures
- `POLLING_SYNC_INTERVAL_SECONDS` (default: `30`): Interval for target reconciliation

### Example .env File

```env
PORT=8080
LOG_LEVEL=info

# Kafka
KAFKA_SERVICE_URI=broker1:9093,broker2:9093
KAFKA_CA_CERT=-----BEGIN CERTIFICATE-----\n...
KAFKA_SERVICE_CERT=-----BEGIN CERTIFICATE-----\n...
KAFKA_SERVICE_KEY=-----BEGIN RSA PRIVATE KEY-----\n...

# API
INGEST_API_KEY=super-secret-key-change-in-prod
RATE_LIMIT_RPS=4000
RATE_LIMIT_BURST=8000

# Buffering
BATCH_SIZE=500
FLUSH_INTERVAL_SECONDS=2
MAX_BUFFER_CAPACITY=50000
MAX_EVENTS_PER_REQUEST=1000
PUBLISH_WORKER_COUNT=4

# Storage & Validation
DATABASE=postgresql://user:pass@localhost:5432/control-plane
TIMESCALE_DATABASE=postgresql://user:pass@localhost:5432/timescale
ORG_VALIDATION_TTL_SECONDS=60
INGEST_KEY_PEPPER=pepper-value-for-bcrypt

# Polling (optional)
ACTIVE_POLLING_ENABLED=false
DEFAULT_POLL_INTERVAL_SECONDS=30
DEFAULT_POLL_TIMEOUT_MS=5000
POLLING_BACKOFF_MAX_SECONDS=300
POLLING_SYNC_INTERVAL_SECONDS=30
LIVE_TRACK_RETENTION_MINUTES=120
```

## Deployment

### Docker Build

```bash
docker build -t apicortex-ingest-service:latest .
```

### Docker Run

```bash
docker run --rm -p 8080:8080 \
  -e KAFKA_SERVICE_URI=broker:9093 \
  -e KAFKA_CA_CERT="$(cat /path/to/ca.pem)" \
  -e KAFKA_SERVICE_CERT="$(cat /path/to/service.cert)" \
  -e KAFKA_SERVICE_KEY="$(cat /path/to/service.key)" \
  -e INGEST_API_KEY="your-api-key" \
  apicortex-ingest-service:latest
```


## Development Setup

### Prerequisites
- Go 1.26+
- PostgreSQL 12+
- Kafka 3.0+

### Local Development

1. **Clone repository:**
```bash
git clone https://github.com/0xarchit/ApiCortex.git
cd ApiCortex/ingest-service
```

2. **Install dependencies:**
```bash
go mod tidy
```

3. **Create `.env` file:**
```bash
cp .env.example .env
# Edit .env with local settings
```

4. **Run service:**
```bash
go run ./cmd/server
```

5. **Test ingestion:**
```bash
curl -X POST http://localhost:8080/v1/telemetry \
  -H "Content-Type: application/json" \
  -H "X-API-Key: local-dev-key" \
  -d '[
    {
      "timestamp": "2023-01-15T10:30:45Z",
      "org_id": "550e8400-e29b-41d4-a716-446655440000",
      "api_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
      "endpoint": "/health",
      "method": "GET",
      "status": 200,
      "latency_ms": 50
    }
  ]'
```

### Running Tests

```bash
go test ./...
```

### Code Quality

```bash
# Linting
golangci-lint run

# Format check
go fmt ./...

# Vet
go vet ./...
```

## Security Considerations

### Authentication & Authorization

1. **API Key Validation**
   - Per-request header: `X-API-Key` or `Authorization: Bearer <key>`
   - Master key (all orgs) or per-org ingest key
   - Bcrypt with pepper for ingest key hashing

2. **Organization Scoping**
   - Every ingested event must include valid `org_id`
   - Validator checks org exists in control-plane
   - Cache with 5-minute TTL reduces database load

### Transport Security

1. **Kafka mTLS**
   - Client certificate authentication to Kafka cluster
   - Encrypted in-transit communication
   - Supports certificate-based mTLS; rotate certificates via controlled restart/redeploy

2. **Database Connections**
   - PostgreSQL connection pooling with credential management
   - Connection timeout and lifecycle management
   - No credentials in logs (structured logging sanitizes sensitive data)

### Rate Limiting

- Per-IP token bucket (configurable RPS/burst)
- Protects against abuse and DDoS
- Automatic cleanup of stale entries

### Data Isolation

- Multi-tenant: all queries scoped to `org_id`
- PostgreSQL connection pooling isolates credentials
- No cross-org data leakage

### Validation

- Strict schema enforcement at ingestion boundary
- UUID validation for identifiers
- Range checks for numeric fields
- Max size constraints for strings

## Performance Notes

- **Throughput:** Designed for high-volume event ingestion (horizontal scaling via stateless service replicas)
- **Latency:** Minimal ingestion latency (before batcher queueing)
- **Memory:** Bounded by in-memory queue capacity (default 50K events)
- **Kafka:** Batched gzip compression reduces network overhead
- **Database:** Connection pooling and prepared statements minimize query overhead
- **Polling:** Per-target goroutines; target count doesn't impact ingestion path
- **Metrics:** Atomic operations avoid mutex contention

### Optimization Tips

1. **Batch Size:** Increase for higher latency tolerance and lower Kafka overhead
2. **Worker Count:** Increase for higher throughput (coordinate with Kafka partition count)
3. **Buffer Capacity:** Increase if experiencing backpressure (`429 Too Many Requests`)
4. **Polling Intervals:** Increase interval to reduce load (fewer synthetic events)
5. **Cache TTL:** Increase org validation TTL if database is bottleneck (trade-off: stale data)
