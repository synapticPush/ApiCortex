/** Authenticated user profile returned by identity endpoints. */
export interface User {
  id: string;
  email: string;
  name: string;
  provider: string;
  created_at: string;
}

/** Organization metadata used for tenant-aware dashboard context. */
export interface Organization {
  id: string;
  name: string;
  plan: "free" | "pro" | "business";
  created_at: string;
}

/** Top-level API domain tracked within an organization. */
export interface API {
  id: string;
  name: string;
  org_id: string;
  base_url: string;
  created_at: string;
}

/** Route-level endpoint registered under an API domain. */
export interface Endpoint {
  id: string;
  api_id: string;
  path: string;
  method: string;
  created_at: string;
}

/** Stored OpenAPI document version for an API domain. */
export interface OpenAPISpec {
  id: string;
  api_id: string;
  version: string;
  uploaded_at: string;
}

/** Summary response returned after uploading and synchronizing an OpenAPI file. */
export interface OpenAPIUploadResult {
  spec_id: string;
  api_id: string;
  version: string;
  uploaded_at: string;
  api_created: boolean;
  endpoints_synced: number;
}

/** Core KPIs shown on the dashboard overview. */
export interface DashboardMetrics {
  p95_latency_ms: number;
  error_rate: number;
  request_count: number;
}

/** Session claims used for role-aware UI and authorization decisions. */
export interface AuthSession {
  user_id: string;
  org_id: string;
  role: "owner" | "admin" | "member";
  plan: string;
}

/** Aggregated traffic and reliability metrics per endpoint. */
export interface ApiTelemetry {
  endpoint: string;
  method: string;
  request_count: number;
  p95_latency_ms: number;
  error_rate: number;
  traffic_rps: number;
}

/** Inference output row for endpoint risk prediction screens. */
export interface Prediction {
  time: string;
  endpoint: string;
  method: string;
  risk_score: number;
  prediction: string;
  confidence: number;
  top_features: Array<{
    name: string;
    value: number;
    contribution: number;
  }>;
}

/** User membership details for organization access management. */
export interface Membership {
  user_id: string;
  org_id: string;
  role: "owner" | "admin" | "member";
  email: string;
  name: string;
}

/** Ingest key provisioning status for telemetry ingestion. */
export interface IngestKeyStatus {
  configured: boolean;
  updated_at: string | null;
}

/** Response returned when rotating an ingest key. */
export interface IngestKeyRotateResult {
  api_key: string;
  updated_at: string;
}

/** Contract validation outcome for observed traffic vs declared API contract. */
export interface ContractValidation {
  status: "valid" | "warning" | "missing";
  endpoint_id: string | null;
  path: string;
  method: string;
  contract_hash: string | null;
  observed_hash: string | null;
}

/** Runtime options for websocket-based test execution. */
export interface ExecuteWsConfig {
  initial_message?: string;
  strategy?: "single" | "duration" | "count";
  listen_duration_ms?: number;
  message_count?: number;
  timeout_ms?: number;
  connection_timeout_ms?: number;
}

/** Request payload used by the API testing execute endpoint. */
export interface ExecuteRequest {
  test_id?: string;
  protocol: "http" | "graphql" | "websocket";
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  follow_redirects?: boolean;
  timeout_ms?: number;
  ws_config?: ExecuteWsConfig;
}

/** Network-level timing diagnostics captured during HTTP execution. */
export interface ExecuteNetworkDiagnostics {
  dns_resolution_time_ms?: number;
  tcp_handshake_time_ms?: number;
  tls_negotiation_time_ms?: number;
  time_to_first_byte_ms?: number;
  total_time_ms: number;
}

/** Individual websocket message observed during an execution run. */
export interface ExecuteWsMessage {
  index: number;
  data: string;
  received_at_ms: number;
}

/** HTTP execution result payload from the testing service. */
export interface ExecuteHttpResult {
  status_code: number;
  headers: Record<string, string>;
  body: unknown;
  body_size_bytes: number;
  diagnostics: ExecuteNetworkDiagnostics;
}

/** Websocket execution result payload from the testing service. */
export interface ExecuteWsResult {
  messages: ExecuteWsMessage[];
  total_time_ms: number;
  timed_out: boolean;
  message_count: number;
}

/** Unified execute response envelope for HTTP, GraphQL, and websocket tests. */
export interface ExecuteResponse {
  test_id?: string;
  success: boolean;
  result?: ExecuteHttpResult | ExecuteWsResult;
  error?: string;
}
