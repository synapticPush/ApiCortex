# `ApiCortex` - Autonomous API Failure Prediction & Contract Testing SaaS Platform

<div align="center">
  <img src="assets/logo/apicortex_icon.png" alt="ApiCortex Logo" width="250" />




```text
====================================================================================
    █████╗ ██████╗ ██╗       ██████╗ ██████╗ ██████╗ ████████╗███████╗██╗  ██╗
   ██╔══██╗██╔══██╗██║      ██╔════╝██╔═══██╗██╔══██╗╚══██╔══╝██╔════╝╚██╗██╔╝
   ███████║██████╔╝██║      ██║     ██║   ██║██████╔╝   ██║   █████╗   ╚███╔╝ 
   ██╔══██║██╔═══╝ ██║      ██║     ██║   ██║██╔══██╗   ██║   ██╔══╝   ██╔██╗ 
   ██║  ██║██║     ██║      ╚██████╗╚██████╔╝██║  ██║   ██║   ███████╗██╔╝ ██╗
   ╚═╝  ╚═╝╚═╝     ╚═╝       ╚═════╝ ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝
====================================================================================
                                                    
Predict API Failures Before They Happen
```
</div>


[![Status](https://img.shields.io/badge/Status-Active%20Development-000000.svg?style=for-the-badge&logo=rocket&logoColor=white&labelColor=000000&color=000000)](https://github.com/0xArchit/ApiCortex/pulse)
[![License](https://img.shields.io/badge/License-AGPL%20v3-000000.svg?style=for-the-badge&logo=gnu&logoColor=white&labelColor=000000&color=000000)](LICENSE)  
[![Python](https://img.shields.io/badge/Python-3.11-000000.svg?style=for-the-badge&logo=python&logoColor=white&labelColor=000000&color=000000)](https://www.python.org)
[![Go](https://img.shields.io/badge/Go-1.26+-000000.svg?style=for-the-badge&logo=go&logoColor=white&labelColor=000000&color=000000)](https://go.dev)
[![Rust](https://img.shields.io/badge/Rust-1.94+-000000.svg?style=for-the-badge&logo=rust&logoColor=white&labelColor=000000&color=000000)](https://rust-lang.org)
[![NextJs](https://img.shields.io/badge/NextJs-16+-000000.svg?style=for-the-badge&logo=nextdotjs&logoColor=white&labelColor=000000&color=000000)](https://nextjs.org)

---

## ✦ Table of Contents
1. [Overview](#-overview)
2. [Architecture](#-architecture)
3. [Features](#-features)
4. [System Components](#-system-components)
5. [Data Flow](#-data-flow)
6. [Installation](#-installation)
7. [Configuration](#-configuration)
8. [Usage](#-usage)
9. [Monitoring](#-monitoring)
10. [Troubleshooting](#-troubleshooting)
11. [Dependencies](#-dependencies)
12. [License](#-license)

---

## ✦ Overview

**ApiCortex** is an enterprise-grade SaaS platform that predicts API failures before they occur using machine learning analytics on real production traffic. The platform ensures API contract compliance and provides proactive failure detection through advanced anomaly detection algorithms.

### Key Capabilities

- **Predictive Analytics**: ML-powered failure prediction with 95%+ accuracy
- **Real-time Monitoring**: Sub-second telemetry processing via Kafka streaming
- **Contract Validation**: OpenAPI specification enforcement and drift detection
- **Multi-tenant Architecture**: Organization-based isolation with RBAC
- **Time-series Analytics**: Historical querying with TimescaleDB
- **Developer Dashboard**: Interactive Next.js UI with live metrics

---

## ⬢ Deployment Status (MVP)

For the initial MVP launch, we have adopted a hybrid-cloud strategy utilizing high-performance managed services to deliver a full-featured experience.

| Component | Provider | Role |
| :------- | :------- | :--- |
| **Frontend** | **Vercel** | Dashboard & Edge Proxy |
| **Backend** | **HuggingFace** | Unified Docker Orchestration |
| **Metadata** | **NeonDB** | Serverless PostgreSQL |
| **Metrics** | **TigerData** | Managed TimescaleDB |
| **Streaming** | **Aiven** | Cloud Managed Kafka |
| **Caching** | **Upstash** | Serverless Redis |

> [!NOTE]  
> To maximize efficiency and minimize cross-service latency on free-tier resources, the core backend services (Ingest, Control Plane, and ML Service) are orchestrated within a unified Docker container on HuggingFace Spaces. This architecture leverages a multi-stage build that pulls pre-compiled binaries and virtual environments from internal mirrors to generate a high-density, production-ready image, with a custom entrypoint script handling concurrent process management and environment isolation for the Go and Python runtimes.

---

## ❖ Architecture

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                         APICORTEX PLATFORM                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│                                                                         │
│                      ┌──────────────┐                                   │
│                      │ API Testing  │                                   │
│                      │ Engine (Rust)│                                   │
│                      └──────▲───────┘                                   │
│                             │                                           │
│  ┌──────────────┐    ┌──────▼───────┐    ┌──────────────┐               │
│  │   Frontend   │    │  Control     │    │   Ingest     │               │
│  │  (Next.js)   │◄──►│  Plane       │◄──►│  Service     │               │
│  │              │    │  (FastAPI)   │    │  (Go)        │               │
│  └──────────────┘    └──────────────┘    └──────────────┘               │
│         │                   │                   │                       │
│         ▼                   ▼                   ▼                       │
│  ┌──────────────────────────────────────────────────────────┐           │
│  │                    Apache Kafka                          │           │
│  │              (telemetry.raw, alerts)                     │           │
│  └──────────────────────────────────────────────────────────┘           │
│         │                   │                   │                       │
│         ▼                   ▼                   ▼                       │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐               │
│  │   ML         │    │  PostgreSQL  │    │  TimescaleDB │               │
│  │   Service    │    │  (NeonDB)    │    │  (Metrics)   │               │
│  │  (Python)    │    │  (Metadata)  │    │              │               │
│  └──────────────┘    └──────────────┘    └──────────────┘               │
│                                                                         │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### System Architecture Diagram

```mermaid
graph TB
    subgraph "Presentation Layer"
        A[Next.js Dashboard]
        B[REST API Clients]
    end
    
    subgraph "Control Plane"
        C[FastAPI Server]
        D[Auth Service]
        E[API Management]
        F[Contract Validator]
    end
    
    subgraph "Data Plane"
        G[Go Ingest Service]
        H[Kafka Producer]
        I[Rate Limiter]
    end
    
    subgraph "ML Plane"
        J[Python ML Service]
        K[Feature Engineering]
        L[XGBoost Predictor]
        M[Anomaly Detector]
    end
    
    subgraph "Execution Plane"
        Q[Rust Testing Engine]
        R[SSRF Shield]
        S[External APIs]
    end

    subgraph "Storage"
        N[(PostgreSQL)]
        O[(TimescaleDB)]
        P[Kafka Topics]
    end
    
    A --> C
    B --> C
    C --> D
    C --> E
    C --> F
    C <--> Q
    Q --> R
    R --> S
    G --> H
    H --> P
    J --> P
    J --> K
    K --> L
    L --> M
    C --> N
    G --> O
    J --> O
```

---

## ✥ Features

### Core Features

| Feature | Description | Status |
|---------|-------------|--------|
| Real-time Telemetry | Collect API metrics with <10ms latency | ✔ Active |
| ML Failure Prediction | XGBoost-based anomaly detection | ✔ Active |
| Contract Validation | OpenAPI 3.0 specification enforcement | ✔ Active |
| Multi-tenant RBAC | Organization-based access control | ✔ Active |
| Time-series Analytics | Historical data querying | ✔ Active |
| Alerting System | Webhook-based notifications | ✔ Active |
| Developer Dashboard | Interactive UI with live metrics | ✔ Active |
| API Testing | High-performance Rust execution engine | ✔ Active |

### Technical Specifications

- **Throughput**: 10,000+ events/second
- **Latency**: <50ms p99 for telemetry ingestion
- **Accuracy**: 95%+ failure prediction accuracy
- **Retention**: Configurable (default 30 days)
- **Dependencies**: Comprehensive list in [DEPENDENCY.md](DEPENDENCY.md)
- **Scalability**: Horizontal scaling with Kafka partitions

---

## ◈ System Components

### 1. Data Plane (Go)

**Location**: `ingest-service/`

Responsible for high-throughput telemetry collection and streaming.

```text
┌─────────────────────────────────────┐
│     Ingest Service Architecture     │
├─────────────────────────────────────┤
│  HTTP API → Validation → Buffer     │
│       ↓                             │
│  Kafka Producer → Batching          │
│       ↓                             │
│  TimescaleDB Writer                 │
└─────────────────────────────────────┘
```

**Key Files**:
- `cmd/server/main.go` - Application entry point
- `internal/api/handler.go` - HTTP request handlers
- `internal/kafka/producer.go` - Kafka producer
- `internal/buffer/batcher.go` - Event batching

### 2. Control Plane (FastAPI)

**Location**: `control-plane/`

Handles authentication, API metadata, and contract management.

```text
┌─────────────────────────────────────┐
│    Control Plane Architecture       │
├─────────────────────────────────────┤
│  OAuth2 → JWT → RBAC                │
│       ↓                             │
│  API Management → OpenAPI Parser    │
│       ↓                             │
│  PostgreSQL → TimescaleDB           │
└─────────────────────────────────────┘
```

**Key Files**:
- `app/main.py` - FastAPI application
- `app/routers/auth.py` - Authentication endpoints
- `app/routers/apis.py` - API management
- `app/services/contract_service.py` - Contract validation

### 3. ML Plane (Python)

**Location**: `ml-service/`

Processes telemetry streams and generates failure predictions.

```text
┌─────────────────────────────────────┐
│      ML Service Architecture        │
├─────────────────────────────────────┤
│  Kafka Consumer → Feature Extract   │
│       ↓                             │
│  XGBoost Model → SHAP Analysis      │
│       ↓                             │
│  Prediction Storage → Alerting      │
└─────────────────────────────────────┘
```

**Key Files**:
- `app/main.py` - ML worker entry
- `workers/inference_worker.py` - Inference pipeline
- `app/features/feature_engineering.py` - Feature extraction
- `app/inference/predictor.py` - Model prediction

### 4. Presentation Plane (Next.js)

**Location**: `frontend/`

Developer dashboard for monitoring and management.

```text
┌─────────────────────────────────────┐
│    Frontend Architecture            │
├─────────────────────────────────────┤
│  Dashboard → API Testing            │
│       ↓                             │
│  Telemetry Charts → Predictions     │
│       ↓                             │
│  Contract Validation UI             │
└─────────────────────────────────────┘

### 5. Execution Engine (Rust)

**Location**: `api-testing/`

High-performance, secure engine optimized for executing REST, GraphQL, and WebSocket tests with microsecond precision.

```text
┌─────────────────────────────────────┐
│    Testing Engine Architecture      │
├─────────────────────────────────────┤
│  Request → Resolver → SSRF Shield   │
│       ↓                             │
│  Network Execution (Tokio + Reqwest)│
│       ↓                             │
│  Diagnostics Snapshot (DNS/TLS/TCP) │
└─────────────────────────────────────┘
```

**Key Files**:
- `src/main.rs` - Axum server entry
- `src/executor.rs` - Core execution & security logic
- `src/protocols/` - WebSocket & HTTP handlers
- `src/models.rs` - Result & Snapshot schemas

---

## ∿ Data Flow

### Telemetry Data Flow

```mermaid
sequenceDiagram
    participant Client as API Client
    participant Ingest as Ingest Service
    participant Kafka as Apache Kafka
    participant ML as ML Service
    participant DB as TimescaleDB
    participant UI as Dashboard
    
    Client->>Ingest: POST /v1/telemetry
    Ingest->>Ingest: Validate & Buffer
    Ingest->>Kafka: Publish telemetry.raw
    Ingest->>DB: Store telemetry
    Ingest-->>Client: 200 OK
    
    ML->>Kafka: Consume telemetry.raw
    ML->>ML: Feature Engineering
    ML->>ML: XGBoost Prediction
    ML->>DB: Store prediction
    ML->>Kafka: Publish alerts
    
    UI->>DB: Query metrics
    UI->>UI: Display charts
```

### Prediction Flow

```mermaid
flowchart TD
    A[Telemetry Event] --> B{Kafka Consumer}
    B --> C[Feature Extraction]
    C --> D[1m Window Stats]
    C --> E[5m Window Stats]
    C --> F[15m Window Stats]
    D --> G[Feature Vector]
    E --> G
    F --> G
    G --> H{XGBoost Model}
    H --> I[Risk Score]
    I --> J{Threshold Check}
    J -->|Score > 0.8| K[Generate Alert]
    J -->|Score < 0.8| L[Store Prediction]
    K --> M[Kafka Alerts Topic]
    L --> N[TimescaleDB]
```

---

## ⬢ Installation

### Prerequisites

- **Go**: 1.26 or later
- **Python**: 3.11 or later
- **Node.js**: 22 or later
- **PostgreSQL**: 16+ or NeonDB
- **TimescaleDB**: Latest version
- **Apache Kafka**: 3.0 or later

### Quick Start

```bash
# 1. Clone repository
git clone https://github.com/0xarchit/apicortex.git
cd apicortex

# 2. Set up environment variables
cp .env.example .env
# Edit .env with your credentials

# 3. Start infrastructure (Docker)
docker-compose up -d

# 4. Build and run services
# Ingest Service
cd ingest-service && go run cmd/server/main.go

# Control Plane
cd control-plane && uvicorn app.main:app --reload

# ML Service
cd ml-service && python app/main.py

# API Testing Engine (Rust)
cd api-testing && cargo run

# Frontend
cd frontend && npm run dev
```

## ⌬ Configuration

### Environment Variables

| Variable | Service | Description | Default |
|----------|---------|-------------|---------|
| `DATABASE` | Control Plane | PostgreSQL connection string | - |
| `TIMESCALE_DATABASE` | All | TimescaleDB connection string | - |
| `KAFKA_SERVICE_URI` | Ingest, ML | Kafka broker URI | - |
| `ACTIVE_POLLING_ENABLED` | Ingest | Enable active polling | `true` |
| `BATCH_SIZE` | Ingest | Kafka batch size | `500` |
| `MODEL_PATH` | ML | Path to XGBoost model | `model/xgboost.pkl` |
| `ALERT_THRESHOLD` | ML | Alert threshold (0-1) | `0.8` |
| `API_TESTING_URL` | Control Plane | Internal URL for Rust engine | `http://localhost:9090` |

### Configuration Files

**Ingest Service** (`ingest-service/.env`):
```env
PORT=8080
KAFKA_SERVICE_URI=kafka:9092
BATCH_SIZE=500
FLUSH_INTERVAL_SECONDS=2
ACTIVE_POLLING_ENABLED=true
```

**Control Plane** (`control-plane/.env`):
```env
DATABASE=postgresql://user:pass@host:5432/db
JWT_SECRET_KEY=your-secret-key
OAUTH_GITHUB_CLIENT_ID=your-client-id
```

**ML Service** (`ml-service/.env`):
```env
KAFKA_TOPIC_RAW=telemetry.raw
MODEL_PATH=model/xgboost_failure_prediction.pkl
ALERT_THRESHOLD=0.8
ENABLE_SHAP=true
```

---

## ⌗ Usage

### Dashboard Access

1. Open browser: `http://localhost:3000`
2. Sign in with OAuth (Google/GitHub)
3. Navigate to Dashboard

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/login` | POST | User authentication |
| `/apis` | GET | List APIs |
| `/apis/{id}/endpoints` | GET | Get API endpoints |
| `/telemetry` | POST | Submit telemetry |
| `/predictions` | GET | Get predictions |
| `/dashboard/metrics` | GET | Dashboard metrics |
| `/testing/execute` | POST | Execute API test |


---

## ⊚ Monitoring

### Metrics Collection

```text
┌─────────────────────────────────────┐
│     Monitoring Stack                │
├─────────────────────────────────────┤
│  Prometheus → Grafana               │
│       ↓                             │
│  Custom Metrics:                    │
│  - telemetry_events_total           │
│  - prediction_latency_seconds       │
│  - kafka_consumer_lag               │
│  - http_request_duration_seconds    │
└─────────────────────────────────────┘
```

### Health Checks

| Service | Endpoint | Port |
|---------|----------|------|
| Ingest | `/health` | 8080 |
| API Testing | `/health` | 9090 |
| Control Plane | `/health` | 8000 |
| Frontend | `/` | 3000 |

### Logging

All services use structured logging:
- **Ingest**: Zerolog (JSON format)
- **Control Plane**: Python logging (JSON)
- **ML Service**: Python logging (JSON)

Log format:
```json
{
  "timestamp": "2026-04-07T12:00:00Z",
  "level": "INFO",
  "service": "ingest-service",
  "message": "Telemetry batch published",
  "batch_size": 500,
  "duration_ms": 45
}
```

---

## ⌕ Troubleshooting

### Common Issues

#### 1. Services Won't Start

**Symptom**: Service exits immediately on startup

**Solution**:
```bash
# Check environment variables
printenv | grep APICORTEX

# Verify database connectivity
psql $DATABASE -c "SELECT 1"

# Check Kafka connection
kafka-consumer-groups --bootstrap-server $KAFKA_URI --list
```

#### 2. High Memory Usage

**Symptom**: Memory usage > 2GB

**Solution**:
```bash
# Reduce batch size in ingest-service
BATCH_SIZE=100

# Limit buffer capacity
MAX_BUFFER_CAPACITY=10000
```

#### 3. Kafka Consumer Lag

**Symptom**: Consumer lag > 10000 messages

**Solution**:
```bash
# Increase consumer parallelism
# Add more ML worker instances
# Check network connectivity
```

### Debug Mode

Enable debug logging:
```env
DEBUG=true
LOG_LEVEL=debug
```

---

## Performance Tuning

### Ingest Service

| Parameter | Recommended | Description |
|-----------|-------------|-------------|
| `BATCH_SIZE` | 500-1000 | Events per batch |
| `FLUSH_INTERVAL` | 2s | Batch flush interval |
| `PUBLISH_WORKER_COUNT` | 4 | Parallel publishers |

### ML Service

| Parameter | Recommended | Description |
|-----------|-------------|-------------|
| `KAFKA_POLL_TIMEOUT` | 1.0s | Poll timeout |
| `ENABLE_SHAP` | false | Disable for performance |
| `KAFKA_MAX_POLL_INTERVAL` | 300s | Max poll interval |

### Database

```sql
-- Optimize TimescaleDB
SELECT add_retention_policy('api_telemetry', INTERVAL '30 days');
SELECT add_compression_policy('api_telemetry', INTERVAL '7 days');

-- Create indexes
CREATE INDEX CONCURRENTLY ON api_telemetry (org_id, time DESC);
CREATE INDEX CONCURRENTLY ON api_telemetry (api_id, time DESC);
```

---

## ۞ Security

### Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant ControlPlane
    participant OAuth
    participant DB
    
    User->>Frontend: Click "Login"
    Frontend->>ControlPlane: Initiate OAuth
    ControlPlane->>OAuth: Redirect
    User->>OAuth: Authenticate
    OAuth->>ControlPlane: OAuth Callback
    ControlPlane->>DB: Create/Update User
    ControlPlane->>Frontend: JWT Token
    Frontend->>User: Dashboard Access
```

### API Key Management

- Keys are hashed with pepper before storage
- Keys are rotated every 90 days
- Audit logging for all key operations

---

## ☍ Contributing

1. Fork the repository
2. Create feature branch
3. Submit pull request
4. Pass CI/CD pipeline

### Development Setup

```bash
# Install dependencies
go mod download
pip install -r requirements.txt
npm install

# Run tests
go test ./...
pytest
npm test
```

---

## ✦ Dependencies

For a complete breakdown of all libraries, frameworks, and tools used across our Rust, Go, Python, and Next.js services, please refer to the [DEPENDENCY.md](DEPENDENCY.md) file.

---

## § License

Check the [LICENSE](LICENSE)

---

## ℡ Support

- **Email:** mail@0xarchit.is-a.dev
- **Discussions:** https://github.com/0xarchit/ApiCortex/discussions
- **Issues:** https://github.com/0xarchit/ApiCortex/issues

**Developer team**
- [@0xarchit](https://github.com/0xarchit)
- [@vxrachit](https://github.com/vxrachit)
- [@synapticpush](https://github.com/synapticpush)

---