export interface User {
  id: string;
  email: string;
  name: string;
  provider: string;
  created_at: string;
}
export interface Organization {
  id: string;
  name: string;
  plan: "free" | "pro" | "business";
  created_at: string;
}
export interface API {
  id: string;
  name: string;
  org_id: string;
  base_url: string;
  created_at: string;
}
export interface Endpoint {
  id: string;
  api_id: string;
  path: string;
  method: string;
  created_at: string;
}
export interface OpenAPISpec {
  id: string;
  api_id: string;
  version: string;
  uploaded_at: string;
}
export interface OpenAPIUploadResult {
  spec_id: string;
  api_id: string;
  version: string;
  uploaded_at: string;
  api_created: boolean;
  endpoints_synced: number;
}
export interface DashboardMetrics {
  p95_latency_ms: number;
  error_rate: number;
  request_count: number;
}
export interface AuthSession {
  user_id: string;
  org_id: string;
  role: "owner" | "admin" | "member";
  plan: string;
}
export interface ApiTelemetry {
  endpoint: string;
  method: string;
  request_count: number;
  p95_latency_ms: number;
  error_rate: number;
  traffic_rps: number;
}
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

export interface Membership {
  user_id: string;
  org_id: string;
  role: "owner" | "admin" | "member";
  email: string;
  name: string;
}

export interface IngestKeyStatus {
  configured: boolean;
  updated_at: string | null;
}

export interface IngestKeyRotateResult {
  api_key: string;
  updated_at: string;
}

export interface ContractValidation {
  status: "valid" | "warning" | "missing";
  endpoint_id: string | null;
  path: string;
  method: string;
  contract_hash: string | null;
  observed_hash: string | null;
}
