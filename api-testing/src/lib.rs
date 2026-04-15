//! API testing executor service for HTTP, GraphQL, and WebSocket protocols.

use std::sync::Arc;

use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use tower_http::{cors::CorsLayer, trace::TraceLayer};

pub mod executor;
pub mod models;

use executor::Executor;
use models::{ExecuteRequest, ExecuteResponse};

/// Application state holding the test executor.
#[derive(Clone)]
pub struct AppState {
    pub executor: Arc<Executor>,
}

/// Health check endpoint.
pub async fn health() -> impl IntoResponse {
    Json(serde_json::json!({ "status": "ok" }))
}

/// Executes an HTTP, GraphQL, or WebSocket test.
pub async fn execute_handler(
    State(state): State<AppState>,
    Json(payload): Json<ExecuteRequest>,
) -> impl IntoResponse {
    let test_id = payload.test_id.clone();
    match state.executor.execute(payload).await {
        Ok(result) => {
            let resp = ExecuteResponse::ok(test_id, result);
            (StatusCode::OK, Json(resp)).into_response()
        }
        Err(e) => {
            let resp = ExecuteResponse::err(test_id, e.to_string());
            (StatusCode::OK, Json(resp)).into_response()
        }
    }
}

/// Creates the Axum application with routes and middleware.
pub fn create_app(state: AppState) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/v1/execute", post(execute_handler))
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
