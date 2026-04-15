//! Data models for test requests and responses.

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Supported protocol types for testing.
#[derive(Debug, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Protocol {
    Http,
    Graphql,
    Websocket,
}

/// WebSocket message collection strategy.
#[derive(Debug, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum WsStrategy {
    Single,
    Duration,
    Count,
}

impl Default for WsStrategy {
    fn default() -> Self {
        WsStrategy::Single
    }
}

/// WebSocket connection configuration.
#[derive(Debug, Deserialize, Clone)]
pub struct WsConfig {
    pub initial_message: Option<String>,
    #[serde(default)]
    pub strategy: WsStrategy,
    pub listen_duration_ms: Option<u64>,
    pub message_count: Option<usize>,
    pub timeout_ms: Option<u64>,
    pub connection_timeout_ms: Option<u64>,
}

/// Test execution request.
#[derive(Debug, Deserialize, Clone)]
pub struct ExecuteRequest {
    pub test_id: Option<String>,
    pub protocol: Protocol,
    pub url: String,
    pub method: Option<String>,
    #[serde(default)]
    pub headers: std::collections::HashMap<String, String>,
    pub body: Option<Value>,
    pub follow_redirects: Option<bool>,
    pub timeout_ms: Option<u64>,
    pub ws_config: Option<WsConfig>,
}

/// Network timing diagnostics.
#[derive(Debug, Serialize, Default)]
pub struct NetworkDiagnostics {
    pub dns_resolution_time_ms: Option<f64>,
    pub tcp_handshake_time_ms: Option<f64>,
    pub tls_negotiation_time_ms: Option<f64>,
    pub time_to_first_byte_ms: Option<f64>,
    pub total_time_ms: f64,
}

/// HTTP response result with diagnostics.
#[derive(Debug, Serialize)]
pub struct HttpResult {
    pub status_code: u16,
    pub headers: std::collections::HashMap<String, String>,
    pub body: Value,
    pub body_size_bytes: usize,
    pub diagnostics: NetworkDiagnostics,
}

/// WebSocket message received.
#[derive(Debug, Serialize)]
pub struct WsMessage {
    pub index: usize,
    pub data: String,
    pub received_at_ms: f64,
}

/// WebSocket connection result.
#[derive(Debug, Serialize)]
pub struct WsResult {
    pub messages: Vec<WsMessage>,
    pub total_time_ms: f64,
    pub timed_out: bool,
    pub message_count: usize,
}

/// Test execution result.
#[derive(Debug, Serialize)]
#[serde(tag = "protocol", rename_all = "lowercase")]
pub enum ExecuteResult {
    Http(HttpResult),
    Graphql(HttpResult),
    Websocket(WsResult),
}

/// Test execution response.
#[derive(Debug, Serialize)]
pub struct ExecuteResponse {
    pub test_id: Option<String>,
    pub success: bool,
    pub result: Option<ExecuteResult>,
    pub error: Option<String>,
}

impl ExecuteResponse {
    /// Creates a successful response.
    pub fn ok(test_id: Option<String>, result: ExecuteResult) -> Self {
        Self {
            test_id,
            success: true,
            result: Some(result),
            error: None,
        }
    }

    /// Creates an error response.
    pub fn err(test_id: Option<String>, msg: impl Into<String>) -> Self {
        Self {
            test_id,
            success: false,
            result: None,
            error: Some(msg.into()),
        }
    }
}
