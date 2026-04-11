import uuid
from typing import Any, Literal

from pydantic import BaseModel, HttpUrl, Field


class TestRequest(BaseModel):
    method: str
    url: HttpUrl
    headers: dict[str, str] | None = None
    body: Any | None = None


class ContractValidation(BaseModel):
    status: Literal["valid", "warning", "missing"]
    endpoint_id: uuid.UUID | None = None
    path: str
    method: str
    contract_hash: str | None = None
    observed_hash: str | None = None


class TestResponse(BaseModel):
    status: int
    time_ms: int
    size_bytes: int
    body: Any
    headers: dict[str, str]
    contract_validation: ContractValidation


class WsConfig(BaseModel):
    initial_message: str | None = None
    strategy: Literal["single", "duration", "count"] = "single"
    listen_duration_ms: int | None = Field(default=None, ge=1)
    message_count: int | None = Field(default=None, ge=1)
    timeout_ms: int | None = Field(default=5000, ge=1)
    connection_timeout_ms: int | None = Field(default=5000, ge=1)


class ExecuteRequest(BaseModel):
    test_id: str | None = None
    protocol: Literal["http", "graphql", "websocket"]
    url: str
    method: str | None = None
    headers: dict[str, str] = {}
    body: Any | None = None
    follow_redirects: bool | None = True
    timeout_ms: int | None = Field(default=30000, ge=1)
    ws_config: WsConfig | None = None


class NetworkDiagnostics(BaseModel):
    dns_resolution_time_ms: float | None = None
    tcp_handshake_time_ms: float | None = None
    tls_negotiation_time_ms: float | None = None
    time_to_first_byte_ms: float | None = None
    total_time_ms: float


class WsMessage(BaseModel):
    index: int
    data: str
    received_at_ms: float


class HttpResult(BaseModel):
    status_code: int
    headers: dict[str, str]
    body: Any
    body_size_bytes: int
    diagnostics: NetworkDiagnostics


class WsResult(BaseModel):
    messages: list[WsMessage]
    total_time_ms: float
    timed_out: bool
    message_count: int


class ExecuteResponse(BaseModel):
    test_id: str | None = None
    success: bool
    result: HttpResult | WsResult | None = None
    error: str | None = None
