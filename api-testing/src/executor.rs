//! Test executor for HTTP, GraphQL, and WebSocket protocols with network diagnostics.

use std::collections::HashMap;
use std::net::SocketAddr;
use std::time::{Duration, Instant};

use futures_util::{SinkExt, StreamExt};
use reqwest::{Client, Method, Url};
use serde_json::{json, Value};
use thiserror::Error;
use tokio::net::TcpStream;
use tokio::time::timeout;
use tokio_native_tls::TlsConnector;
use tokio_tungstenite::{client_async_with_config, tungstenite::protocol::Message};

use crate::models::{
    ExecuteRequest, ExecuteResult, HttpResult, NetworkDiagnostics, Protocol, WsConfig, WsMessage,
    WsResult, WsStrategy,
};

/// Executor error types.
#[derive(Debug, Error)]
pub enum ExecutorError {
    #[error("invalid URL: {0}")]
    InvalidUrl(String),
    #[error("HTTP client error: {0}")]
    HttpClient(#[from] reqwest::Error),
    #[error("WebSocket error: {0}")]
    WebSocket(String),
    #[error("DNS resolution failed: {0}")]
    DnsResolution(String),
    #[error("connection timeout")]
    ConnectionTimeout,
    #[error("request timeout")]
    RequestTimeout,
    #[error("blocked IP address: {0}")]
    BlockedIp(String),
    #[error("unsupported method: {0}")]
    UnsupportedMethod(String),
}

/// Test executor for protocol-specific request handling.
pub struct Executor {
    pub allow_private_ips: bool,
}

impl Executor {
    /// Creates a new executor with default security settings.
    pub fn new() -> Self {
        Self {
            allow_private_ips: false,
        }
    }

    #[allow(dead_code)]
    pub fn new_unsecured() -> Self {
        Self {
            allow_private_ips: true,
        }
    }

    fn build_client(
        &self,
        follow_redirects: bool,
        pinned_resolution: Option<(&str, SocketAddr)>,
    ) -> Result<Client, ExecutorError> {
        let redirect_policy = if follow_redirects {
            reqwest::redirect::Policy::limited(10)
        } else {
            reqwest::redirect::Policy::none()
        };

        let mut builder = Client::builder()
            .use_rustls_tls()
            .gzip(true)
            .deflate(true)
            .redirect(redirect_policy)
            .danger_accept_invalid_certs(false);

        if let Some((host, addr)) = pinned_resolution {
            builder = builder.resolve(host, addr);
        }

        builder.build().map_err(ExecutorError::HttpClient)
    }

    fn is_blocked_ip(&self, addr: std::net::IpAddr) -> bool {
        if self.allow_private_ips {
            return false;
        }

        if addr.is_loopback() || addr.is_unspecified() || addr.is_multicast() {
            return true;
        }

        match addr {
            std::net::IpAddr::V4(v4) => {
                v4.is_private() || v4.is_link_local() || v4.is_broadcast() || v4.is_documentation()
            }
            std::net::IpAddr::V6(v6) => {
                (v6.segments()[0] & 0xfe00 == 0xfc00) || (v6.segments()[0] & 0xffc0 == 0xfe80)
            }
        }
    }

    /// Executes a test request based on protocol type.
    pub async fn execute(&self, req: ExecuteRequest) -> Result<ExecuteResult, ExecutorError> {
        match req.protocol {
            Protocol::Http => {
                let result = self.execute_http(&req, false).await?;
                Ok(ExecuteResult::Http(result))
            }
            Protocol::Graphql => {
                let result = self.execute_http(&req, true).await?;
                Ok(ExecuteResult::Graphql(result))
            }
            Protocol::Websocket => {
                let ws_config = req.ws_config.clone().unwrap_or(WsConfig {
                    initial_message: None,
                    strategy: WsStrategy::Single,
                    listen_duration_ms: None,
                    message_count: None,
                    timeout_ms: Some(5000),
                    connection_timeout_ms: Some(5000),
                });
                let result = self.execute_ws(&req.url, &req.headers, ws_config).await?;
                Ok(ExecuteResult::Websocket(result))
            }
        }
    }

    async fn execute_http(
        &self,
        req: &ExecuteRequest,
        is_graphql: bool,
    ) -> Result<HttpResult, ExecutorError> {
        let url = Url::parse(&req.url)
            .map_err(|e| ExecutorError::InvalidUrl(e.to_string()))?;

        let method_str = req
            .method
            .as_deref()
            .unwrap_or(if is_graphql { "POST" } else { "GET" })
            .to_uppercase();

        let method = match method_str.as_str() {
            "GET" => Method::GET,
            "POST" => Method::POST,
            "PUT" => Method::PUT,
            "DELETE" => Method::DELETE,
            "PATCH" => Method::PATCH,
            "HEAD" => Method::HEAD,
            "OPTIONS" => Method::OPTIONS,
            other => return Err(ExecutorError::UnsupportedMethod(other.to_string())),
        };

        let timeout_ms = req.timeout_ms.unwrap_or(30_000);
        let request_timeout = Duration::from_millis(timeout_ms);
        let follow_redirects = req.follow_redirects.unwrap_or(true);

        let overall_start = Instant::now();

        let dns_start = Instant::now();
        let host = url.host_str().unwrap_or("");
        let port = url.port_or_known_default().unwrap_or(80);
        let resolved = tokio::net::lookup_host((host, port))
            .await
            .map_err(|e| ExecutorError::DnsResolution(e.to_string()))?
            .collect::<Vec<_>>();

        if resolved.is_empty() {
            return Err(ExecutorError::DnsResolution("no addresses found".to_string()));
        }

        let mut pinned_addr = None;
        for addr_info in resolved {
            let addr = addr_info.ip();
            if self.is_blocked_ip(addr) {
                return Err(ExecutorError::BlockedIp(addr.to_string()));
            }
            if pinned_addr.is_none() {
                pinned_addr = Some(addr_info);
            }
        }
        let dns_elapsed_ms = dns_start.elapsed().as_secs_f64() * 1000.0;
        let selected_addr = pinned_addr.ok_or_else(|| {
            ExecutorError::DnsResolution("no non-blocked addresses found".to_string())
        })?;

        let mut builder = self
            .build_client(follow_redirects, Some((host, selected_addr)))?
            .request(method, url)
            .timeout(request_timeout);


        for (key, value) in &req.headers {
            builder = builder.header(key.as_str(), value.as_str());
        }

        if is_graphql {
            let gql_body = req.body.clone().unwrap_or(Value::Null);
            builder = builder
                .header("Content-Type", "application/json")
                .json(&gql_body);
        } else if let Some(body) = &req.body {
            let content_type = req
                .headers
                .iter()
                .find(|(k, _)| k.to_lowercase() == "content-type")
                .map(|(_, v)| v.as_str())
                .unwrap_or("application/json");

            if content_type.contains("application/json") {
                builder = builder.json(body);
            } else if let Value::String(raw) = body {
                builder = builder.body(raw.clone());
            } else {
                builder = builder.json(body);
            }
        }

        let ttfb_start = Instant::now();
        let fut = builder.send();
        let response = timeout(request_timeout, fut)
            .await
            .map_err(|_| ExecutorError::RequestTimeout)?
            .map_err(ExecutorError::HttpClient)?;

        let ttfb_ms = ttfb_start.elapsed().as_secs_f64() * 1000.0;
        let status_code = response.status().as_u16();

        let mut resp_headers: HashMap<String, String> = HashMap::new();
        for (key, value) in response.headers() {
            if let Ok(v) = value.to_str() {
                resp_headers.insert(key.as_str().to_string(), v.to_string());
            }
        }

        let body_bytes = response.bytes().await.map_err(ExecutorError::HttpClient)?;
        let body_size_bytes = body_bytes.len();

        let total_ms = overall_start.elapsed().as_secs_f64() * 1000.0;

        let body: Value = serde_json::from_slice(&body_bytes).unwrap_or_else(|_| {
            json!(String::from_utf8_lossy(&body_bytes).to_string())
        });

        Ok(HttpResult {
            status_code,
            headers: resp_headers,
            body,
            body_size_bytes,
            diagnostics: NetworkDiagnostics {
                dns_resolution_time_ms: Some(dns_elapsed_ms),
                tcp_handshake_time_ms: None,
                tls_negotiation_time_ms: None,
                time_to_first_byte_ms: Some(ttfb_ms),
                total_time_ms: total_ms,
            },
        })
    }

    async fn execute_ws(
        &self,
        url: &str,
        extra_headers: &HashMap<String, String>,
        config: WsConfig,
    ) -> Result<WsResult, ExecutorError> {
        let connection_timeout_ms = config.connection_timeout_ms.unwrap_or(5_000);
        let connection_timeout = Duration::from_millis(connection_timeout_ms);
        let overall_start = Instant::now();

        let parsed_url = Url::parse(url).map_err(|e| ExecutorError::InvalidUrl(e.to_string()))?;
        let host = parsed_url.host_str().ok_or_else(|| ExecutorError::InvalidUrl("missing host".to_string()))?;
        let port = parsed_url.port_or_known_default().unwrap_or(80);

        let resolved = tokio::net::lookup_host((host, port))
            .await
            .map_err(|e| ExecutorError::DnsResolution(e.to_string()))?
            .collect::<Vec<_>>();

        if resolved.is_empty() {
            return Err(ExecutorError::DnsResolution("no addresses found".to_string()));
        }

        let mut pinned_addr = None;
        for addr_info in resolved {
            let addr = addr_info.ip();
            if self.is_blocked_ip(addr) {
                return Err(ExecutorError::BlockedIp(addr.to_string()));
            }
            if pinned_addr.is_none() {
                pinned_addr = Some(addr_info);
            }
        }

        let selected_addr = pinned_addr.ok_or_else(|| {
            ExecutorError::DnsResolution("no non-blocked addresses found".to_string())
        })?;

        let mut request = tokio_tungstenite::tungstenite::client::IntoClientRequest::into_client_request(url)
            .map_err(|e| ExecutorError::WebSocket(e.to_string()))?;

        for (key, value) in extra_headers {
            let name = tokio_tungstenite::tungstenite::http::header::HeaderName::from_bytes(
                key.as_bytes(),
            )
            .map_err(|e| ExecutorError::WebSocket(e.to_string()))?;
            let val = tokio_tungstenite::tungstenite::http::header::HeaderValue::from_str(value)
                .map_err(|e| ExecutorError::WebSocket(e.to_string()))?;
            request.headers_mut().insert(name, val);
        }

        let tcp_stream = timeout(connection_timeout, TcpStream::connect(selected_addr))
            .await
            .map_err(|_| ExecutorError::ConnectionTimeout)?
            .map_err(|e: std::io::Error| ExecutorError::WebSocket(format!("TCP connection failed: {}", e)))?;

        let stream = if url.starts_with("wss") {
            let connector = native_tls::TlsConnector::builder()
                .build()
                .map_err(|e: native_tls::Error| ExecutorError::WebSocket(format!("TLS builder error: {}", e)))?;
            let connector = TlsConnector::from(connector);
            let tls_stream = connector
                .connect(host, tcp_stream)
                .await
                .map_err(|e: tokio_native_tls::native_tls::Error| ExecutorError::WebSocket(format!("TLS handshake failed: {}", e)))?;
            tokio_tungstenite::MaybeTlsStream::NativeTls(tls_stream)
        } else {
            tokio_tungstenite::MaybeTlsStream::Plain(tcp_stream)
        };

        
        let (ws_stream, _) = timeout(
            connection_timeout,
            client_async_with_config(request, stream, None),
        )
        .await
        .map_err(|_| ExecutorError::ConnectionTimeout)?
        .map_err(|e| ExecutorError::WebSocket(e.to_string()))?;

        let (mut write, mut read) = ws_stream.split();

        if let Some(ref msg) = config.initial_message {
            write
                .send(Message::Text(msg.clone().into()))
                .await
                .map_err(|e| ExecutorError::WebSocket(e.to_string()))?;
        }

        let mut messages: Vec<WsMessage> = Vec::new();
        let mut timed_out = false;

        match config.strategy {
            WsStrategy::Single => {
                let wait_ms = config.timeout_ms.unwrap_or(5_000);
                let wait = Duration::from_millis(wait_ms);
                match timeout(wait, read.next()).await {
                    Ok(Some(Ok(msg))) => {
                        let data = extract_ws_message_text(msg);
                        let elapsed = overall_start.elapsed().as_secs_f64() * 1000.0;
                        messages.push(WsMessage { index: 0, data, received_at_ms: elapsed });
                    }
                    Ok(Some(Err(e))) => {
                        return Err(ExecutorError::WebSocket(e.to_string()));
                    }
                    Ok(None) => {}
                    Err(_) => {
                        timed_out = true;
                    }
                }
            }

            WsStrategy::Duration => {
                let duration_ms = config.listen_duration_ms.unwrap_or(3_000);
                let listen_deadline = Duration::from_millis(duration_ms);
                let deadline_at = tokio::time::Instant::now() + listen_deadline;

                loop {
                    let remaining = deadline_at.saturating_duration_since(tokio::time::Instant::now());
                    if remaining.is_zero() {
                        break;
                    }
                    match timeout(remaining, read.next()).await {
                        Ok(Some(Ok(msg))) => {
                            let data = extract_ws_message_text(msg);
                            let elapsed = overall_start.elapsed().as_secs_f64() * 1000.0;
                            let idx = messages.len();
                            messages.push(WsMessage { index: idx, data, received_at_ms: elapsed });
                        }
                        Ok(Some(Err(e))) => {
                            if e.to_string().contains("Connection reset") {
                                break;
                            }
                            return Err(ExecutorError::WebSocket(e.to_string()));
                        }
                        Ok(None) | Err(_) => break,
                    }
                }
            }

            WsStrategy::Count => {
                let target = config.message_count.unwrap_or(1);
                let abs_timeout_ms = config.timeout_ms.unwrap_or(10_000);
                let abs_deadline = tokio::time::Instant::now() + Duration::from_millis(abs_timeout_ms);

                while messages.len() < target {
                    let remaining = abs_deadline.saturating_duration_since(tokio::time::Instant::now());
                    if remaining.is_zero() {
                        timed_out = true;
                        break;
                    }
                    match timeout(remaining, read.next()).await {
                        Ok(Some(Ok(msg))) => {
                            let data = extract_ws_message_text(msg);
                            let elapsed = overall_start.elapsed().as_secs_f64() * 1000.0;
                            let idx = messages.len();
                            messages.push(WsMessage { index: idx, data, received_at_ms: elapsed });
                        }
                        Ok(Some(Err(e))) => {
                            if e.to_string().contains("Connection reset") {
                                timed_out = true;
                                break;
                            }
                            return Err(ExecutorError::WebSocket(e.to_string()));
                        }
                        Ok(None) | Err(_) => {
                            timed_out = true;
                            break;
                        }
                    }
                }
            }
        }

        let _ = write.close().await;

        let total_ms = overall_start.elapsed().as_secs_f64() * 1000.0;
        let count = messages.len();

        Ok(WsResult {
            messages,
            total_time_ms: total_ms,
            timed_out,
            message_count: count,
        })
    }
}

fn extract_ws_message_text(msg: Message) -> String {
    match msg {
        Message::Text(t) => t.to_string(),
        Message::Binary(b) => format!("<binary {} bytes>", b.len()),
        Message::Ping(_) => "<ping>".to_string(),
        Message::Pong(_) => "<pong>".to_string(),
        Message::Close(_) => "<close>".to_string(),
        Message::Frame(_) => "<frame>".to_string(),
    }
}
