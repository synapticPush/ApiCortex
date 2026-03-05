import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, HttpUrl


class APICreate(BaseModel):
    name: str
    base_url: HttpUrl


class APIOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    base_url: str
    created_at: datetime


class EndpointCreate(BaseModel):
    path: str
    method: str


class EndpointOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    api_id: uuid.UUID
    path: str
    method: str
    created_at: datetime


class OpenAPISpecCreate(BaseModel):
    version: str
    raw_spec: dict[str, Any]


class OpenAPIUploadRequest(BaseModel):
    api_id: uuid.UUID | None = None
    api_name: str | None = None
    base_url: HttpUrl | None = None
    version: str
    raw_spec: dict[str, Any]


class OpenAPIUploadOut(BaseModel):
    spec_id: uuid.UUID
    api_id: uuid.UUID
    version: str
    uploaded_at: datetime
    api_created: bool
    endpoints_synced: int


class OpenAPISpecOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    api_id: uuid.UUID
    version: str
    uploaded_at: datetime


class ContractCreate(BaseModel):
    schema_hash: str


class ContractOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    endpoint_id: uuid.UUID
    schema_hash: str
    created_at: datetime


class DashboardSummaryOut(BaseModel):
    p95_latency_ms: float
    error_rate: float
    request_count: int
