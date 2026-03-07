from __future__ import annotations

from datetime import datetime

from pydantic import AliasChoices, BaseModel, Field, field_validator


class TelemetryEvent(BaseModel):
    timestamp: datetime
    org_id: str
    api_id: str
    endpoint: str
    method: str
    status: int
    latency_ms: int
    request_size_bytes: int = Field(
        default=0,
        validation_alias=AliasChoices("request_size_bytes", "request_size"),
    )
    response_size_bytes: int = Field(
        default=0,
        validation_alias=AliasChoices("response_size_bytes", "response_size"),
    )
    schema_hash: str | None = None
    schema_version: str | None = None

    @field_validator("org_id", "api_id", "endpoint", "method", mode="before")
    @classmethod
    def _trim_required_strings(cls, value: str) -> str:
        if not isinstance(value, str) or not value.strip():
            raise ValueError("required string field cannot be empty")
        return value.strip()

    @field_validator("method", mode="after")
    @classmethod
    def _normalize_method(cls, value: str) -> str:
        return value.upper()

    @field_validator("status")
    @classmethod
    def _status_range(cls, value: int) -> int:
        if value < 100 or value > 599:
            raise ValueError("status must be between 100 and 599")
        return value

    @field_validator("latency_ms", "request_size_bytes", "response_size_bytes")
    @classmethod
    def _non_negative_int(cls, value: int) -> int:
        if value < 0:
            raise ValueError("numeric telemetry fields must be non-negative")
        return value

    model_config = {
        "populate_by_name": True,
        "extra": "ignore",
    }
