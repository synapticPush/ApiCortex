# Control Plane - API Cortex Backend

FastAPI-based control plane for API monitoring, testing, and anomaly detection in a multi-tenant SaaS platform.

## Overview

The control plane is the core backend service that manages:
- **Multi-tenant API registry** - Monitor external APIs
- **Authentication & Authorization** - OAuth2 providers (Google, GitHub) with JWT
- **API Contract Management** - OpenAPI spec validation and contract enforcement
- **Anomaly Detection** - Real-time ML-based failure predictions
- **Telemetry Aggregation** - Time-series metrics stored in TimescaleDB
- **Async Job Queue** - Background task processing for cleanup and validation
- **Rate Limiting & Quotas** - Plan-based API usage enforcement

## Architecture

```text
┌─────────────────────────────────────────────────┐
│          HTTP Request                           │
└──────────────────┬──────────────────────────────┘
                   │
        ┌──────────▼──────────┐
        │  Middleware Stack   │
        │  ├─ RequestContext  │
        │  ├─ RateLimit       │
        │  ├─ JWTAuth         │
        │  ├─ OrgScope        │
        │  ├─ PlanEnforcement │
        │  └─ CSRF            │
        └──────────┬──────────┘
                   │
        ┌──────────▼──────────┐
        │   Router Layers     │
        │  ├─ /auth           │
        │  ├─ /apis           │
        │  ├─ /endpoints      │
        │  ├─ /contracts      │
        │  ├─ /dashboard      │
        │  ├─ /predictions    │
        │  ├─ /telemetry      │
        │  ├─ /orgs           │
        │  └─ /test           │
        └──────────┬──────────┘
                   │
        ┌──────────▼──────────┐
        │  Service Layer      │
        │  ├─ AuthService     │
        │  ├─ APIService      │
        │  ├─ PlanService     │
        │  ├─ ContractService │
        │  ├─ JobService      │
        │  ├─ DashboardSvc    │
        │  └─ IngestKeyService|
        └──────────┬──────────┘
                   │
        ┌──────────▼──────────┐
        │   Data Layer        │
        │  ├─ PostgreSQL      │
        │  ├─ TimescaleDB     │
        │  └─ Kafka (async)   │
        └─────────────────────┘
```

## Module Documentation

### 1. `app/core/` - Infrastructure & Configuration

#### `config.py`
Settings management with environment variable binding via Pydantic.

**Key Configuration:**
- Database URLs (PostgreSQL, TimescaleDB)
- JWT secrets and token expiration
- OAuth provider credentials (Google, GitHub)
- CORS origins and cookie settings
- Rate limiting thresholds
- API key pepper for hashing

**Usage:**
```python
from app.core.config import settings
db_url = settings.database_url
jwt_secret = settings.jwt_secret_key
```

#### `security.py`
Authentication, authorization, and token management utilities.

**Key Functions:**
- `create_token()` - Base JWT creation with custom expiration
- `create_access_token()` - Short-lived access tokens (15 min)
- `create_refresh_token()` - Long-lived refresh tokens (7 days)
- `decode_token()` - JWT verification with expiration validation
- `generate_csrf_token()` - CSRF token generation
- `set_auth_cookies()` - HTTPOnly cookie configuration
- `clear_auth_cookies()` - Session logout
- `get_current_claims()` - FastAPI dependency for authenticated endpoints
- `require_role(role)` - Role-based access control (member, admin, owner)

**Security Features:**
- JWT stored in httponly cookies (XSS protection)
- Double-submit CSRF pattern
- Role-based access control (RBAC)
- Stateless authentication

**Usage:**
```python
from fastapi import Depends
from app.core.security import get_current_claims, require_role

@router.get("/admin")
async def admin_only(claims = Depends(require_role("admin"))):
    return {"message": "Admin access"}
```

#### `middleware.py`
HTTP middleware stack for request handling, security, and observability.

**Middleware Classes:**

1. **RequestContextMiddleware** - Request tracking
   - Generates unique request IDs
   - Tracks request latency
   - Structured logging

2. **RateLimitMiddleware** - Per-IP rate limiting
   - Sliding-window request counting (60s window)
   - Configurable limit: 100 req/min per IP
   - Returns 429 on limit exceeded

3. **JWTAuthMiddleware** - Cookie-based JWT validation
   - Extracts JWT from httponly cookies
   - Validates token signature and expiration
   - Attaches claims to request state

4. **OrgScopeMiddleware** - Multi-tenant isolation
   - Enforces organization scope from JWT claims
   - Prevents cross-org data access

5. **PlanEnforcementMiddleware** - API quota enforcement
   - Resolves feature flags and quotas
   - Checks rate limits per organization plan
   - Caches quota count results (15s TTL)

6. **CSRFMiddleware** - CSRF protection
   - Validates CSRF tokens for state-changing operations
   - Checks origin headers
   - Exempts safe methods (GET, HEAD, OPTIONS)

---

### 2. `app/db/` - Database Configuration

#### `base.py`
SQLAlchemy declarative base with naming conventions for constraints.

**Naming Conventions:**
- Indexes: `ix_%(column_0_name)s`
- Unique constraints: `uq_%(table_name)s_%(column_0_name)s`
- Foreign keys: `fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s`
- Primary keys: `pk_%(table_name)s`

#### `session.py`
Database engine and session factory with FastAPI dependency.

**Key Components:**
- `engine` - SQLAlchemy engine with connection pooling
- `SessionLocal` - Session factory for ORM operations
- `get_db()` - FastAPI dependency injecting database session

**Usage:**
```python
from fastapi import Depends
from app.db.session import get_db

@router.get("/data")
async def get_data(db = Depends(get_db)):
    result = db.execute(query)
    return result
```

---

### 3. `app/models/` - ORM Entity Definitions

SQLAlchemy models for multi-tenant SaaS with PostgreSQL UUID and JSONB support.

#### Core Entities:

| Model | Purpose | Key Fields |
|-------|---------|-----------|
| `User` | Authentication entity | `id`, `email`, `name`, `provider`, `provider_id` |
| `Organization` | Tenant entity | `id`, `name`, `plan` (free/pro/business) |
| `API` | Monitored external API | `id`, `org_id`, `name`, `base_url`, `status` |
| `Endpoint` | Individual API route | `id`, `api_id`, `path`, `method`, `poll_interval`, `timeout` |
| `Contract` | Request/response schema | `id`, `endpoint_id`, `request_schema`, `response_schema`, `hash` |
| `Membership` | User-Org relationship | `user_id`, `org_id`, `role` (member/admin/owner) |
| `Job` | Async task queue | `id`, `org_id`, `type`, `status`, `payload`, `run_at` |
| `FeatureFlag` | Plan-based features | `id`, `org_id`, `name`, `quota_limit`, `enabled` |
| `OpenAPISpec` | Versioned API docs | `id`, `api_id`, `spec_content`, `version` |
| `OrganizationIngestKey` | Data ingestion auth | `org_id`, `key_hash` |

**Multi-tenancy Pattern:**
- Every entity has `org_id` for data isolation
- Foreign keys cascade delete on org removal
- Indexes on `(org_id, id)` for efficient scoping

---

### 4. `app/routers/` - HTTP Endpoint Layers

FastAPI route handlers organized by feature domain.

#### `/auth/` - Authentication & Session Management
- `POST /auth/login` - OAuth login redirect
- `POST /auth/callback` - OAuth callback handler
- `POST /auth/refresh` - Token refresh
- `POST /auth/logout` - Session termination
- `GET /auth/me` - Current user profile

**Features:**
- OAuth2 with Google & GitHub providers
- JWT + httponly cookie authentication
- Automatic organization creation on first signup

#### `/apis/` - API Management (CRUD)
- `GET /apis/` - List monitored APIs
- `POST /apis/` - Create API
- `PATCH /apis/{api_id}` - Update API
- `DELETE /apis/{api_id}` - Delete API (cascades to endpoints, contracts, telemetry)

**Features:**
- Org-scoped queries
- Validation of base URL
- Plan quota enforcement

#### `/apis/{api_id}/endpoints/` - Endpoint Management
- `POST /apis/{api_id}/endpoints` - Create endpoint
- `GET /apis/{api_id}/endpoints` - List endpoints
- `DELETE /apis/{api_id}/endpoints/{endpoint_id}` - Delete endpoint

**Features:**
- Polling interval configuration
- Timeout settings
- Contract association

#### `/apis/{api_id}/contracts/` - Contract Upload & Validation
- `POST /apis/{api_id}/contracts` - Upload OpenAPI spec
- `POST /apis/{api_id}/contracts/validate` - Validate contract

**Features:**
- OpenAPI spec parsing
- Request/response schema extraction
- Hash-based change detection

#### `/dashboard/` - Aggregated Metrics
- `GET /dashboard/summary` - Organization-wide statistics

**Metrics:**
- API count
- Endpoint count
- Failure rate (last 24h)
- Availability percentage
- Avg response time

#### `/predictions/` - ML Anomaly Predictions
- `GET /predictions/` - List predictions
- `GET /predictions/analysis` - Anomaly analysis

**Features:**
- Real-time failure predictions
- Time-series anomaly detection
- Explainability scores

#### `/telemetry/` - Endpoint Statistics
- `GET /telemetry/stats/{endpoint_id}` - Endpoint metrics
- `POST /telemetry/publish` - Data ingestion (Kafka)

**Metrics:**
- Response times (min/max/avg/p99)
- Error counts
- Request count

#### `/orgs/` - Organization & Membership Management
- `GET /orgs/` - List user's organizations
- `POST /orgs/` - Create organization
- `GET /orgs/{org_id}/members` - List members
- `POST /orgs/{org_id}/members` - Add member
- `DELETE /orgs/{org_id}/members/{user_id}` - Remove member

**Features:**
- Multi-org user support
- Role-based membership
- Plan management

#### `/test/` - API Testing & Contract Validation
- `POST /test/request` - Test registered API call (org-allowlisted)
- `POST /test/execute` - Test any public URL (executor-backed)

**`/request` Features:**
- Organization-scoped allowlist (restricted to registered `API.base_url` entries)
- API contract validation
- Real-time response schema verification

**`/execute` Features:**
- Allows testing any public URL
- Protocol support: HTTP, GraphQL, WebSocket (via Rust executor)
- SSRF protection enforced in executor layer (`api-testing/src/executor.rs`)
- Timeout configuration per request

---

### 5. `app/schemas/` - Request/Response Validation

Pydantic models for request/response serialization and validation.

#### API Management Schemas:
- `APICreate` - Create API request
- `APIUpdate` - Update API request
- `APIOut` - API response

#### User & Auth Schemas:
- `UserOut` - User profile response
- `AuthSessionOut` - Login response with tokens

#### ML Prediction Schemas:
- `PredictionFeatureOut` - Feature importance
- `PredictionRecordOut` - Prediction result

#### Telemetry Schemas:
- `TelemetryEndpointStatsOut` - Endpoint metrics response

#### API Testing Schemas:
- `TestRequest` - API proxy request
- `ContractValidation` - Contract validation request

**Features:**
- `ConfigDict(from_attributes=True)` for ORM conversion
- Nested validation
- Custom validators

---

### 6. `app/services/` - Business Logic Layer

Separation of concerns with service classes encapsulating business logic.

#### `AuthService`
User authentication and organization provisioning.

**Key Methods:**
- `get_or_create_user()` - OAuth provider user sync
- `ensure_default_org_membership()` - Auto-org creation on signup

#### `APIService`
API monitoring lifecycle management.

**Key Methods:**
- `list_apis()` - Org-scoped API listing
- `create_api()` - Create API with validation
- `update_api()` - Update API configuration
- `delete_api()` - Delete API with cascading cleanup
- `create_endpoint()` - Create monitored endpoint

#### `PlanService`
Feature flag and quota management.

**Key Methods:**
- `resolve_api_quota_limit()` - Resolve feature quota
- `check_api_quota()` - Quota enforcement check

#### `ContractService`
OpenAPI spec management and validation.

**Key Methods:**
- `upload_openapi_with_api_resolution()` - Contract upload

#### `JobService`
Async job queue operations.

**Key Methods:**
- `enqueue_job()` - Enqueue background task
- `claim_next_job()` - Claim job for processing

#### `JobWorker`
Background job processor running in async loop.

**Features:**
- Poll-based job claiming
- Lock-free claiming with SKIP LOCKED
- Periodic cleanup tasks

#### `DashboardService`
Aggregated metrics from TimescaleDB.

**Key Methods:**
- `summary()` - Organization summary stats

**Queries:**
- Count queries on models
- Time-series aggregations
- Failure rate calculations

#### `AlertSubscriber`
Kafka consumer for anomaly alerts.

**Features:**
- Subscribes to ML service predictions
- Stores predictions in TimescaleDB
- Webhook notifications

#### `IngestKeyService`
API key management for data ingestion.

**Key Methods:**
- `hash_key()` - Bcrypt hashing with pepper
- `get_org_key()` - Retrieve current key
- `rotate_org_key()` - Generate new key

#### `TimescaleCleanupService`
Telemetry data cleanup.

**Key Methods:**
- `delete_api_data()` - Delete API telemetry and predictions

---

## Development Setup

### Prerequisites
- Python 3.11+
- PostgreSQL with TimescaleDB extension
- Kafka (for async messaging)
- Redis (optional, for caching)

### Installation

```bash
cd control-plane

python -m venv .venv

# Windows
.\.venv\Scripts\activate
# Unix
source .venv/bin/activate

pip install -r requirements.txt
```

### Configuration

Create `.env` file:
```env
DATABASE_URL=postgresql://user:pass@localhost/apicortex_db
TIMESCALE_URL=postgresql://user:pass@localhost/apicortex_timescale

JWT_SECRET_KEY=your-secret-key
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

GOOGLE_CLIENT_ID=your-google-id
GOOGLE_CLIENT_SECRET=your-google-secret

GITHUB_CLIENT_ID=your-github-id
GITHUB_CLIENT_SECRET=your-github-secret

INGEST_KEY_PEPPER=random-pepper-string

KAFKA_BROKER=localhost:9092
KAFKA_TOPIC_PREDICTIONS=predictions

CORS_ORIGINS=http://localhost:3000,https://app.example.com
```

### Running Locally

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Running Tests

```bash
pytest tests/ -v
```

---

## API Documentation

Interactive OpenAPI docs available at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

---

## Security Considerations

1. **Authentication**: JWT in httponly cookies prevents XSS token theft
2. **CSRF Protection**: Double-submit CSRF tokens for state-changing operations
3. **Authorization**: Role-based access control with org scoping
4. **Rate Limiting**: Per-IP limiting with configurable thresholds
5. **API Key Security**: Bcrypt hashing with pepper for ingest keys
6. **SSRF Prevention**: Domain whitelist for API proxy operations
7. **SQL Injection**: SQLAlchemy parameterized queries throughout

---

## Deployment

### Docker Build

```bash
docker build -t apicortex-control-plane .
```

### Docker Compose

See `../docker-compose.yml` for full stack setup.

---

## Contributing

- Follow PEP 8 style guide
- Add docstrings to all public functions and classes
- Write tests for new features
- Update this README for architectural changes

---

## License

See LICENSE file in repository root.
