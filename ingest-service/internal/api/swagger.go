package api

import "net/http"

// OpenAPI specification and Swagger UI handlers for the ingest service.

const openAPISpec = `{
  "openapi": "3.0.3",
  "info": {
    "title": "ApiCortex Ingest Service API",
    "version": "1.0.0",
    "description": "Telemetry ingestion API for raw events published to Kafka telemetry.raw"
  },
  "servers": [
    {
      "url": "/"
    }
  ],
  "paths": {
    "/v1/telemetry": {
      "post": {
        "summary": "Ingest telemetry events",
        "description": "Accepts an array of telemetry events and queues them for batched Kafka publish.",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "array",
                "minItems": 1,
                "maxItems": 1000,
                "items": {
                  "$ref": "#/components/schemas/TelemetryEvent"
                }
              }
            }
          }
        },
        "responses": {
          "202": {
            "description": "Accepted",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/IngestResponse"
                }
              }
            }
          },
          "400": {
            "description": "Bad request"
          },
          "401": {
            "description": "Unauthorized"
          },
          "429": {
            "description": "Rate limited or backpressure"
          }
        },
        "security": [
          {
            "ApiKeyHeader": []
          },
          {
            "BearerAuth": []
          }
        ]
      }
    },
    "/v1/endpoints/live": {
      "get": {
        "summary": "Live endpoint telemetry state",
        "description": "Returns rolling live telemetry aggregates per org/api/endpoint/method.",
        "parameters": [
          {
            "name": "limit",
            "in": "query",
            "schema": {"type": "integer", "minimum": 1, "maximum": 1000}
          },
          {
            "name": "org_id",
            "in": "query",
            "schema": {"type": "string", "format": "uuid"}
          },
          {
            "name": "api_id",
            "in": "query",
            "schema": {"type": "string", "format": "uuid"}
          },
          {
            "name": "method",
            "in": "query",
            "schema": {"type": "string"}
          },
          {
            "name": "endpoint_contains",
            "in": "query",
            "schema": {"type": "string"}
          }
        ],
        "responses": {
          "200": {
            "description": "Current live endpoint telemetry state",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/LiveEndpointResponse"
                }
              }
            }
          },
          "400": {
            "description": "Invalid query params"
          },
          "401": {
            "description": "Unauthorized"
          }
        },
        "security": [
          {
            "ApiKeyHeader": []
          },
          {
            "BearerAuth": []
          }
        ]
      }
    },
    "/health": {
      "get": {
        "summary": "Liveness probe",
        "responses": {
          "200": {
            "description": "OK"
          }
        }
      }
    },
    "/ready": {
      "get": {
        "summary": "Readiness probe",
        "responses": {
          "200": {
            "description": "Ready"
          },
          "503": {
            "description": "Degraded"
          }
        }
      }
    },
    "/metrics": {
      "get": {
        "summary": "Prometheus metrics",
        "responses": {
          "200": {
            "description": "Text metrics"
          }
        }
      }
    }
  },
  "components": {
    "securitySchemes": {
      "ApiKeyHeader": {
        "type": "apiKey",
        "in": "header",
        "name": "X-API-Key"
      },
      "BearerAuth": {
        "type": "http",
        "scheme": "bearer"
      }
    },
    "schemas": {
      "TelemetryEvent": {
        "type": "object",
        "required": [
          "timestamp",
          "org_id",
          "api_id",
          "endpoint",
          "method",
          "status",
          "latency_ms"
        ],
        "properties": {
          "timestamp": {"type": "string", "format": "date-time"},
          "org_id": {"type": "string", "format": "uuid"},
          "api_id": {"type": "string", "format": "uuid"},
          "endpoint": {"type": "string", "maxLength": 255},
          "method": {"type": "string", "example": "GET"},
          "status": {"type": "integer", "minimum": 100, "maximum": 599},
          "latency_ms": {"type": "integer", "minimum": 0},
          "request_size_bytes": {"type": "integer", "minimum": 0},
          "response_size_bytes": {"type": "integer", "minimum": 0},
          "schema_hash": {"type": "string"},
          "schema_version": {"type": "string"},
          "client_region": {"type": "string"}
        }
      },
      "IngestResponse": {
        "type": "object",
        "properties": {
          "accepted": {"type": "integer"},
          "status": {"type": "string"}
        }
      },
      "LiveEndpointState": {
        "type": "object",
        "properties": {
          "org_id": {"type": "string", "format": "uuid"},
          "api_id": {"type": "string", "format": "uuid"},
          "endpoint": {"type": "string"},
          "method": {"type": "string"},
          "requests": {"type": "integer"},
          "successes": {"type": "integer"},
          "errors": {"type": "integer"},
          "error_rate": {"type": "number"},
          "avg_latency_ms": {"type": "number"},
          "last_latency_ms": {"type": "integer"},
          "last_status": {"type": "integer"},
          "last_seen_at": {"type": "string", "format": "date-time"}
        }
      },
      "LiveEndpointResponse": {
        "type": "object",
        "properties": {
          "count": {"type": "integer"},
          "items": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/LiveEndpointState"
            }
          }
        }
      }
    }
  }
}`

const swaggerHTML = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>ApiCortex Ingest API Swagger</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.ui = SwaggerUIBundle({
      url: '/swagger/openapi.json',
      dom_id: '#swagger-ui',
      deepLinking: true,
      persistAuthorization: true,
      displayRequestDuration: true,
      tryItOutEnabled: true
    });
  </script>
</body>
</html>`

// SwaggerUI serves the interactive Swagger UI documentation.
func SwaggerUI(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(swaggerHTML))
}

// SwaggerSpec serves the OpenAPI specification in JSON format.
func SwaggerSpec(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(openAPISpec))
}
