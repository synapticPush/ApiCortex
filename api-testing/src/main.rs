//! Entrypoint for the api-testing executor service.

use std::sync::Arc;
use tracing::info;
use tracing_subscriber::{fmt, EnvFilter};

use api_testing::{create_app, AppState};
use api_testing::executor::Executor;

#[tokio::main]
async fn main() {
    fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .json()
        .init();

    let state = AppState {
        executor: Arc::new(Executor::new()),
    };

    let app = create_app(state);

    let addr = std::env::var("BIND_ADDR").unwrap_or_else(|_| "0.0.0.0:9090".to_string());
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .expect("failed to bind");

    info!(addr = %addr, "api-testing executor started");

    axum::serve(listener, app).await.expect("server error");
}
