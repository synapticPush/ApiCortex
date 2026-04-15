# api-testing

A lightweight HTTP/GraphQL/WebSocket testing executor service with comprehensive network diagnostics.

## Overview

`api-testing` is a standalone service that executes API tests across multiple protocols (HTTP, GraphQL, WebSocket) and returns detailed network timing diagnostics. It's designed for integration testing, API validation, and performance monitoring.

## Features

- **Multi-Protocol Support**: HTTP, GraphQL, and WebSocket testing
- **Network Diagnostics**: DNS resolution, connection times, and end-to-end latency
- **Security Controls**: Private IP blocking by default, configurable allowlist mode
- **Flexible Configuration**: Timeout management, redirect control, custom headers
- **WebSocket Strategies**: Single message, duration-based, or count-based collection

## Building

```bash
cargo build --release
```

Docker build:
```bash
docker build -t api-testing:latest .
```

## Running

### Binary

```bash
BIND_ADDR=0.0.0.0:9090 ./api-testing
```

### Docker

```bash
docker run -p 9090:9090 api-testing:latest
```

Environment variables:
- `BIND_ADDR`: Bind address (default: `0.0.0.0:9090`)
- `RUST_LOG`: Log level (default: `info`)

## API

### Health Check

```
GET /health
```

Returns service status.

### Execute Test

```
POST /v1/execute
```

Execute an HTTP, GraphQL, or WebSocket test.

#### Request Body

```json
{
  "test_id": "optional-correlation-id",
  "protocol": "http",
  "url": "https://api.example.com/endpoint",
  "method": "POST",
  "headers": {
    "Authorization": "Bearer token"
  },
  "body": {"key": "value"},
  "follow_redirects": true,
  "timeout_ms": 30000
}
```

**Fields:**
- `test_id` (optional): Identifier for correlation
- `protocol` (required): `http`, `graphql`, or `websocket`
- `url` (required): Target URL
- `method`: HTTP method (defaults: GET for HTTP, POST for GraphQL)
- `headers`: Custom request headers
- `body`: Request body (JSON or raw)
- `follow_redirects`: Follow HTTP redirects (default: true)
- `timeout_ms`: Request timeout in milliseconds (default: 30000)
- `ws_config`: WebSocket-specific configuration (required for WebSocket protocol)

#### HTTP Response

```json
{
  "test_id": "optional-correlation-id",
  "success": true,
  "result": {
    "protocol": "http",
    "status_code": 200,
    "headers": {
      "content-type": "application/json"
    },
    "body": {"data": "response"},
    "body_size_bytes": 1024,
    "diagnostics": {
      "dns_resolution_time_ms": 5.2,
      "tcp_handshake_time_ms": null,
      "tls_negotiation_time_ms": 15.8,
      "time_to_first_byte_ms": 45.3,
      "total_time_ms": 125.6
    }
  },
  "error": null
}
```

#### WebSocket Configuration

```json
{
  "initial_message": "optional initial message",
  "strategy": "single",
  "listen_duration_ms": 3000,
  "message_count": 5,
  "timeout_ms": 5000,
  "connection_timeout_ms": 5000
}
```

**Strategies:**
- `single`: Collect one message and close
- `duration`: Collect messages for specified duration
- `count`: Collect a specific number of messages

#### WebSocket Response

```json
{
  "protocol": "websocket",
  "messages": [
    {
      "index": 0,
      "data": "message content",
      "received_at_ms": 42.5
    }
  ],
  "total_time_ms": 150.2,
  "timed_out": false,
  "message_count": 1
}
```

#### Error Response

```json
{
  "test_id": "test-123",
  "success": false,
  "result": null,
  "error": "connection timeout"
}
```

## Security

- **IP Blocking**: Private, loopback, and reserved IP addresses are blocked by default
- **TLS Validation**: Enforces valid certificates (dangerous_accept_invalid_certs disabled)
- **Redirect Limits**: Maximum 10 redirects allowed

Enable private IP mode for testing (development only):
```rust
Executor::new_unsecured()  // Allows private IPs
```

## Testing

```bash
cargo test --lib
cargo test --test integration_test
```