//! Integration tests for the api-testing executor service.

use std::collections::HashMap;
use std::net::SocketAddr;
use std::time::Duration;

use axum_test::TestServer;
use futures_util::{SinkExt, StreamExt};
use serde_json::{json, Value};
use tokio::net::TcpListener;
use tokio_tungstenite::tungstenite::protocol::Message;
use wiremock::matchers::{header, method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

use api_testing::executor::Executor;
use api_testing::models::{
    ExecuteRequest, ExecuteResult, Protocol, WsConfig, WsStrategy,
};
use api_testing::{create_app, AppState};
use std::sync::Arc;

/// Creates an HTTP test request with common defaults.
fn make_http_req(url: &str, http_method: &str, body: Option<Value>) -> ExecuteRequest {
    ExecuteRequest {
        test_id: Some("test-1".to_string()),
        protocol: Protocol::Http,
        url: url.to_string(),
        method: Some(http_method.to_string()),
        headers: HashMap::new(),
        body,
        follow_redirects: Some(true),
        timeout_ms: Some(5000),
        ws_config: None,
    }
}

/// Starts a simple echo WebSocket server for testing.
async fn start_echo_ws_server() -> (SocketAddr, tokio::task::JoinHandle<()>) {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();

    let handle = tokio::spawn(async move {
        while let Ok((stream, _)) = listener.accept().await {
            tokio::spawn(async move {
                let ws = tokio_tungstenite::accept_async(stream).await.unwrap();
                let (mut sink, mut source) = ws.split();
                while let Some(Ok(msg)) = source.next().await {
                    if msg.is_text() || msg.is_binary() {
                        let _ = sink.send(msg).await;
                    }
                }
            });
        }
    });

    (addr, handle)
}

/// Starts a WebSocket server that sends a burst of messages on connection.
async fn start_burst_ws_server(burst_count: usize) -> (SocketAddr, tokio::task::JoinHandle<()>) {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();

    let handle = tokio::spawn(async move {
        while let Ok((stream, _)) = listener.accept().await {
            let count = burst_count;
            tokio::spawn(async move {
                let ws = tokio_tungstenite::accept_async(stream).await.unwrap();
                let (mut sink, mut source) = ws.split();
                let _ = source.next().await;
                for i in 0..count {
                    let _ = sink
                        .send(Message::Text(format!("burst-{}", i).into()))
                        .await;
                    tokio::time::sleep(Duration::from_millis(50)).await;
                }
            });
        }
    });

    (addr, handle)
}

#[tokio::test]
async fn test_http_get() {
    let mock_server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/get"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"ok": true})))
        .mount(&mock_server)
        .await;

    let executor = Executor::new_unsecured();
    let req = make_http_req(&format!("{}/get", mock_server.uri()), "GET", None);
    let result = executor.execute(req).await.unwrap();

    match result {
        ExecuteResult::Http(r) => {
            assert_eq!(r.status_code, 200);
            assert_eq!(r.body["ok"], true);
            assert!(r.diagnostics.total_time_ms > 0.0);
            assert!(r.diagnostics.dns_resolution_time_ms.is_some());
        }
        _ => panic!("expected Http variant"),
    }
}

#[tokio::test]
async fn test_http_post() {
    let mock_server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/post"))
        .respond_with(
            ResponseTemplate::new(201).set_body_json(json!({"created": true})),
        )
        .mount(&mock_server)
        .await;

    let executor = Executor::new_unsecured();
    let req = make_http_req(
        &format!("{}/post", mock_server.uri()),
        "POST",
        Some(json!({"name": "test"})),
    );
    let result = executor.execute(req).await.unwrap();

    match result {
        ExecuteResult::Http(r) => assert_eq!(r.status_code, 201),
        _ => panic!("expected Http variant"),
    }
}

#[tokio::test]
async fn test_http_put() {
    let mock_server = MockServer::start().await;
    Mock::given(method("PUT"))
        .and(path("/put"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"updated": true})))
        .mount(&mock_server)
        .await;

    let executor = Executor::new_unsecured();
    let req = make_http_req(
        &format!("{}/put", mock_server.uri()),
        "PUT",
        Some(json!({"val": 1})),
    );
    let result = executor.execute(req).await.unwrap();
    match result {
        ExecuteResult::Http(r) => assert_eq!(r.status_code, 200),
        _ => panic!("expected Http"),
    }
}

#[tokio::test]
async fn test_http_delete() {
    let mock_server = MockServer::start().await;
    Mock::given(method("DELETE"))
        .and(path("/del"))
        .respond_with(ResponseTemplate::new(204))
        .mount(&mock_server)
        .await;

    let executor = Executor::new_unsecured();
    let req = make_http_req(&format!("{}/del", mock_server.uri()), "DELETE", None);
    let result = executor.execute(req).await.unwrap();
    match result {
        ExecuteResult::Http(r) => assert_eq!(r.status_code, 204),
        _ => panic!("expected Http"),
    }
}

#[tokio::test]
async fn test_http_patch() {
    let mock_server = MockServer::start().await;
    Mock::given(method("PATCH"))
        .and(path("/patch"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"patched": true})))
        .mount(&mock_server)
        .await;

    let executor = Executor::new_unsecured();
    let req = make_http_req(
        &format!("{}/patch", mock_server.uri()),
        "PATCH",
        Some(json!({"x": 1})),
    );
    let result = executor.execute(req).await.unwrap();
    match result {
        ExecuteResult::Http(r) => assert_eq!(r.status_code, 200),
        _ => panic!("expected Http"),
    }
}

#[tokio::test]
async fn test_graphql_query() {
    let mock_server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/graphql"))
        .respond_with(
            ResponseTemplate::new(200)
                .set_body_json(json!({"data": {"user": {"id": "1"}}})),
        )
        .mount(&mock_server)
        .await;

    let executor = Executor::new_unsecured();
    let req = ExecuteRequest {
        test_id: Some("gql-1".to_string()),
        protocol: Protocol::Graphql,
        url: format!("{}/graphql", mock_server.uri()),
        method: Some("POST".to_string()),
        headers: HashMap::new(),
        body: Some(json!({"query": "{ user { id } }", "variables": {}})),
        follow_redirects: Some(true),
        timeout_ms: Some(5000),
        ws_config: None,
    };

    let result = executor.execute(req).await.unwrap();
    match result {
        ExecuteResult::Graphql(r) => {
            assert_eq!(r.status_code, 200);
            assert!(r.body["data"]["user"]["id"] == "1");
        }
        _ => panic!("expected Graphql variant"),
    }
}

#[tokio::test]
async fn test_http_custom_headers_and_cors_bypass() {
    let mock_server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/headers"))
        .and(header("Origin", "https://custom-origin.com"))
        .and(header("Referer", "https://referer.example.com"))
        .and(header("User-Agent", "ApiCortex-Tester/1.0"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"ok": true})))
        .mount(&mock_server)
        .await;

    let mut headers = HashMap::new();
    headers.insert("Origin".to_string(), "https://custom-origin.com".to_string());
    headers.insert("Referer".to_string(), "https://referer.example.com".to_string());
    headers.insert("User-Agent".to_string(), "ApiCortex-Tester/1.0".to_string());

    let executor = Executor::new_unsecured();
    let req = ExecuteRequest {
        test_id: None,
        protocol: Protocol::Http,
        url: format!("{}/headers", mock_server.uri()),
        method: Some("GET".to_string()),
        headers,
        body: None,
        follow_redirects: Some(false),
        timeout_ms: Some(5000),
        ws_config: None,
    };

    let result = executor.execute(req).await.unwrap();
    match result {
        ExecuteResult::Http(r) => assert_eq!(r.status_code, 200),
        _ => panic!("expected Http"),
    }
}

#[tokio::test]
async fn test_http_bad_dns() {
    let executor = Executor::new_unsecured();
    let req = make_http_req("http://this-host-absolutely-does-not-exist.invalid/path", "GET", None);
    let result = executor.execute(req).await;
    assert!(result.is_err(), "bad DNS should return an error");
}

#[tokio::test]
async fn test_http_timeout() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();

    tokio::spawn(async move {
        let _ = listener.accept().await;
        tokio::time::sleep(Duration::from_secs(60)).await;
    });

    let executor = Executor::new_unsecured();
    let req = ExecuteRequest {
        test_id: None,
        protocol: Protocol::Http,
        url: format!("http://{}/slow", addr),
        method: Some("GET".to_string()),
        headers: HashMap::new(),
        body: None,
        follow_redirects: Some(false),
        timeout_ms: Some(200),
        ws_config: None,
    };
    let result = executor.execute(req).await;
    assert!(result.is_err(), "timeout should return error");
}

#[tokio::test]
async fn test_http_non_json_body() {
    let mock_server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/text"))
        .respond_with(
            ResponseTemplate::new(200)
                .set_body_string("plain text response")
                .insert_header("content-type", "text/plain"),
        )
        .mount(&mock_server)
        .await;

    let executor = Executor::new_unsecured();
    let req = make_http_req(&format!("{}/text", mock_server.uri()), "GET", None);
    let result = executor.execute(req).await.unwrap();
    match result {
        ExecuteResult::Http(r) => {
            assert_eq!(r.status_code, 200);
            assert!(r.body.is_string());
        }
        _ => panic!("expected Http"),
    }
}

#[tokio::test]
async fn test_ws_single_strategy() {
    let (addr, _handle) = start_echo_ws_server().await;
    let executor = Executor::new_unsecured();
    let req = ExecuteRequest {
        test_id: Some("ws-single".to_string()),
        protocol: Protocol::Websocket,
        url: format!("ws://{}/ws", addr),
        method: None,
        headers: HashMap::new(),
        body: None,
        follow_redirects: None,
        timeout_ms: None,
        ws_config: Some(WsConfig {
            initial_message: Some(r#"{"ping": true}"#.to_string()),
            strategy: WsStrategy::Single,
            listen_duration_ms: None,
            message_count: None,
            timeout_ms: Some(3000),
            connection_timeout_ms: Some(3000),
        }),
    };

    let result = executor.execute(req).await.unwrap();
    match result {
        ExecuteResult::Websocket(r) => {
            assert_eq!(r.message_count, 1);
            assert!(!r.timed_out);
            assert!(r.messages[0].data.contains("ping"));
        }
        _ => panic!("expected Websocket"),
    }
}

#[tokio::test]
async fn test_ws_duration_strategy() {
    let (addr, _handle) = start_burst_ws_server(5).await;
    let executor = Executor::new_unsecured();
    let req = ExecuteRequest {
        test_id: Some("ws-duration".to_string()),
        protocol: Protocol::Websocket,
        url: format!("ws://{}/ws", addr),
        method: None,
        headers: HashMap::new(),
        body: None,
        follow_redirects: None,
        timeout_ms: None,
        ws_config: Some(WsConfig {
            initial_message: Some("start".to_string()),
            strategy: WsStrategy::Duration,
            listen_duration_ms: Some(500),
            message_count: None,
            timeout_ms: None,
            connection_timeout_ms: Some(3000),
        }),
    };

    let result = executor.execute(req).await.unwrap();
    match result {
        ExecuteResult::Websocket(r) => {
            assert!(r.message_count >= 1, "should receive at least 1 burst message");
            assert!(r.total_time_ms > 0.0);
        }
        _ => panic!("expected Websocket"),
    }
}

#[tokio::test]
async fn test_ws_count_strategy() {
    let (addr, _handle) = start_burst_ws_server(10).await;
    let executor = Executor::new_unsecured();
    let req = ExecuteRequest {
        test_id: Some("ws-count".to_string()),
        protocol: Protocol::Websocket,
        url: format!("ws://{}/ws", addr),
        method: None,
        headers: HashMap::new(),
        body: None,
        follow_redirects: None,
        timeout_ms: None,
        ws_config: Some(WsConfig {
            initial_message: Some("start".to_string()),
            strategy: WsStrategy::Count,
            listen_duration_ms: None,
            message_count: Some(3),
            timeout_ms: Some(5000),
            connection_timeout_ms: Some(3000),
        }),
    };

    let result = executor.execute(req).await.unwrap();
    match result {
        ExecuteResult::Websocket(r) => {
            assert_eq!(r.message_count, 3);
            assert!(!r.timed_out);
        }
        _ => panic!("expected Websocket"),
    }
}

#[tokio::test]
async fn test_ws_single_timeout() {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let addr = listener.local_addr().unwrap();

    tokio::spawn(async move {
        while let Ok((stream, _)) = listener.accept().await {
            tokio::spawn(async move {
                let _ws = tokio_tungstenite::accept_async(stream).await.unwrap();
                tokio::time::sleep(Duration::from_secs(60)).await;
            });
        }
    });

    let executor = Executor::new_unsecured();
    let req = ExecuteRequest {
        test_id: None,
        protocol: Protocol::Websocket,
        url: format!("ws://{}/ws", addr),
        method: None,
        headers: HashMap::new(),
        body: None,
        follow_redirects: None,
        timeout_ms: None,
        ws_config: Some(WsConfig {
            initial_message: Some("ping".to_string()),
            strategy: WsStrategy::Single,
            listen_duration_ms: None,
            message_count: None,
            timeout_ms: Some(300),
            connection_timeout_ms: Some(3000),
        }),
    };

    let result = executor.execute(req).await.unwrap();
    match result {
        ExecuteResult::Websocket(r) => {
            assert!(r.timed_out, "should have timed out");
            assert_eq!(r.message_count, 0);
        }
        _ => panic!("expected Websocket"),
    }
}

#[tokio::test]
async fn test_ws_count_timeout_when_server_stops_early() {
    let (addr, _handle) = start_burst_ws_server(2).await;
    let executor = Executor::new_unsecured();
    let req = ExecuteRequest {
        test_id: None,
        protocol: Protocol::Websocket,
        url: format!("ws://{}/ws", addr),
        method: None,
        headers: HashMap::new(),
        body: None,
        follow_redirects: None,
        timeout_ms: None,
        ws_config: Some(WsConfig {
            initial_message: Some("start".to_string()),
            strategy: WsStrategy::Count,
            listen_duration_ms: None,
            message_count: Some(10),
            timeout_ms: Some(1000),
            connection_timeout_ms: Some(3000),
        }),
    };

    let result = executor.execute(req).await.unwrap();
    match result {
        ExecuteResult::Websocket(r) => {
            assert!(r.timed_out || r.message_count < 10, "should timeout or not reach 10 msgs");
        }
        _ => panic!("expected Websocket"),
    }
}

#[tokio::test]
async fn test_axum_health_endpoint() {
    let state = AppState {
        executor: Arc::new(Executor::new_unsecured()),
    };
    let app = create_app(state);
    let server = TestServer::new(app).unwrap();

    let resp = server.get("/health").await;
    resp.assert_status_ok();
    let body: Value = resp.json();
    assert_eq!(body["status"], "ok");
}

#[tokio::test]
async fn test_axum_execute_endpoint_http() {
    let mock_server = MockServer::start().await;
    Mock::given(method("GET"))
        .and(path("/ping"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!({"pong": true})))
        .mount(&mock_server)
        .await;

    let state = AppState {
        executor: Arc::new(Executor::new_unsecured()),
    };
    let app = create_app(state);
    let server = TestServer::new(app).unwrap();

    let payload = json!({
        "protocol": "http",
        "url": format!("{}/ping", mock_server.uri()),
        "method": "GET"
    });

    let resp = server.post("/v1/execute").json(&payload).await;
    resp.assert_status_ok();
    let body: Value = resp.json();
    assert!(body["success"].as_bool().unwrap_or(false));
}

#[tokio::test]
async fn test_ssrf_block_loopback() {
    let executor = Executor::new();
    let req = make_http_req("http://127.0.0.1:8080/admin", "GET", None);
    let result = executor.execute(req).await;
    
    match result {
        Err(api_testing::executor::ExecutorError::BlockedIp(ip)) => {
            assert!(ip.contains("127.0.0.1"));
        }
        _ => panic!("expected BlockedIp error for 127.0.0.1, got {:?}", result),
    }
}

#[tokio::test]
async fn test_ssrf_block_metadata_service() {
    let executor = Executor::new();
    let req = make_http_req("http://169.254.169.254/latest/meta-data/", "GET", None);
    let result = executor.execute(req).await;
    
    match result {
        Err(api_testing::executor::ExecutorError::BlockedIp(_)) => {}
        _ => panic!("expected BlockedIp error for metadata service IP"),
    }
}

#[tokio::test]
async fn test_unsupported_http_method_errors() {
    let executor = Executor::new_unsecured();
    let req = ExecuteRequest {
        test_id: None,
        protocol: Protocol::Http,
        url: "http://localhost:9999/path".to_string(), // Dummy local URL
        method: Some("CONNECT".to_string()),
        headers: HashMap::new(),
        body: None,
        follow_redirects: None,
        timeout_ms: Some(5000),
        ws_config: None,
    };
    let result = executor.execute(req).await;
    
    match result {
        Err(api_testing::executor::ExecutorError::UnsupportedMethod(m)) => {
            assert_eq!(m, "CONNECT");
        }
        _ => panic!("expected UnsupportedMethod error, got {:?}", result),
    }
}
