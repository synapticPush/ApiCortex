import ipaddress
import posixpath
import socket
import time
import uuid
from urllib.parse import parse_qsl, unquote, urlsplit

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.api import API
from app.schemas.testing import (
    ContractValidation,
    ExecuteRequest,
    ExecuteResponse,
    TestRequest,
    TestResponse,
)
from app.services.contract_service import ContractService

router = APIRouter()


def _is_blocked_ip(ip: ipaddress.IPv4Address | ipaddress.IPv6Address) -> bool:
    return (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    )


def _normalized_origin(raw_url: str) -> tuple[str, str, int]:
    parsed = urlsplit(raw_url)
    scheme = (parsed.scheme or "").lower()
    host = (parsed.hostname or "").strip().lower()
    port = parsed.port or (443 if scheme == "https" else 80)

    if scheme not in {"http", "https"}:
        raise HTTPException(status_code=400, detail="Only http/https URLs are allowed")
    if not host:
        raise HTTPException(status_code=400, detail="Invalid target URL")
    if host == "localhost":
        raise HTTPException(status_code=400, detail="Local/internal targets are not allowed")

    return scheme, host, port


def _origin_base_url(scheme: str, host: str, port: int) -> str:
    if (scheme == "http" and port == 80) or (scheme == "https" and port == 443):
        return f"{scheme}://{host}"
    return f"{scheme}://{host}:{port}"


def _validate_public_target(host: str, port: int) -> None:

    try:
        ip = ipaddress.ip_address(host)
        if _is_blocked_ip(ip):
            raise HTTPException(status_code=400, detail="Private/internal targets are not allowed")
        return
    except ValueError:
        pass

    try:
        infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except socket.gaierror:
        raise HTTPException(status_code=400, detail="Target host cannot be resolved")

    for info in infos:
        resolved = ipaddress.ip_address(info[4][0])
        if _is_blocked_ip(resolved):
            raise HTTPException(status_code=400, detail="Target resolves to private/internal IP")


def _sanitize_relative_path(path: str) -> str:
    decoded = unquote(path or "/")
    if not decoded.startswith("/"):
        decoded = "/" + decoded
    normalized = posixpath.normpath(decoded)
    if not normalized.startswith("/"):
        raise HTTPException(status_code=400, detail="Invalid path")
    if normalized.startswith("//"):
        raise HTTPException(status_code=400, detail="Invalid path")
    if normalized in {".", ".."} or normalized.startswith("/../"):
        raise HTTPException(status_code=400, detail="Invalid path")
    return normalized


def _resolve_outbound_target(raw_url: str, allowed_base_urls: list[str]) -> tuple[str, str, list[tuple[str, str]]]:
    requested = urlsplit(raw_url)
    scheme, host, port = _normalized_origin(raw_url)
    _validate_public_target(host, port)

    allowed_origins: set[tuple[str, str, int]] = set()
    for base_url in allowed_base_urls:
        try:
            allowed_origins.add(_normalized_origin(str(base_url)))
        except HTTPException:
            continue

    if (scheme, host, port) not in allowed_origins:
        raise HTTPException(status_code=403, detail="Target host is not registered for this organization")

    relative_url = _sanitize_relative_path(requested.path or "/")
    query_params = parse_qsl(requested.query, keep_blank_values=True)

    return _origin_base_url(scheme, host, port), relative_url, query_params


@router.post("/request", response_model=TestResponse)
async def proxy_test_request(payload: TestRequest, request: Request, db: Session = Depends(get_db)):
    headers = payload.headers or {}
    start_time = time.time()
    org_id_raw = getattr(request.state, "org_id", None)
    if org_id_raw is None:
        raise HTTPException(status_code=401, detail="Unauthorized")

    try:
        org_id = uuid.UUID(str(org_id_raw))
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Unauthorized")

    allowed_base_urls = list(db.scalars(select(API.base_url).where(API.org_id == org_id)).all())
    if not allowed_base_urls:
        raise HTTPException(status_code=403, detail="No API base URL registered for this organization")

    base_url, relative_url, query_params = _resolve_outbound_target(str(payload.url), allowed_base_urls)

    async with httpx.AsyncClient(base_url=base_url, follow_redirects=False, timeout=httpx.Timeout(10.0, connect=3.0)) as client:
        try:
            response = await client.request(
                method=payload.method,
                url=relative_url,
                params=query_params or None,
                headers=headers,
                json=payload.body if isinstance(payload.body, (dict, list)) else None,
                data=payload.body if isinstance(payload.body, str) else None,
            )
            elapsed_ms = int((time.time() - start_time) * 1000)

            try:
                resp_body = response.json()
            except ValueError:
                resp_body = response.text

            contract_validation: dict = {
                "status": "missing",
                "endpoint_id": None,
                "path": str(payload.url.path),
                "method": payload.method.upper(),
                "contract_hash": None,
                "observed_hash": None,
            }
            if org_id:
                contract_validation = ContractService.validate_runtime_response(
                    db=db,
                    org_id=org_id,
                    method=payload.method,
                    request_url_or_path=str(payload.url),
                    response_body=resp_body,
                )

            return TestResponse(
                status=response.status_code,
                time_ms=elapsed_ms,
                size_bytes=len(response.content),
                body=resp_body,
                headers=dict(response.headers),
                contract_validation=contract_validation,
            )
        except httpx.RequestError as exc:
            raise HTTPException(status_code=502, detail=f"Proxy error: {str(exc)}")


@router.post("/execute", response_model=ExecuteResponse)
async def execute_test(payload: ExecuteRequest, request: Request) -> ExecuteResponse:
    org_id_raw = getattr(request.state, "org_id", None)
    if org_id_raw is None:
        raise HTTPException(status_code=401, detail="Unauthorized")

    try:
        uuid.UUID(str(org_id_raw))
    except (TypeError, ValueError):
        raise HTTPException(status_code=401, detail="Unauthorized")

    executor_url = settings.api_testing_url.rstrip("/") + "/v1/execute"
    timeout_sec = (payload.timeout_ms or 30_000) / 1000.0 + 5.0

    async with httpx.AsyncClient(timeout=httpx.Timeout(timeout_sec, connect=5.0)) as client:
        try:
            resp = await client.post(
                executor_url,
                content=payload.model_dump_json(),
                headers={"Content-Type": "application/json"},
            )
            resp.raise_for_status()
            try:
                return ExecuteResponse.model_validate(resp.json())
            except (ValueError, ValidationError) as exc:
                raise HTTPException(
                    status_code=502,
                    detail="Execution engine returned an invalid response",
                ) from exc
        except httpx.TimeoutException:
            raise HTTPException(status_code=504, detail="Execution engine timed out")
        except httpx.HTTPStatusError as exc:
            raise HTTPException(status_code=502, detail=f"Executor error: {exc.response.status_code}")
        except httpx.RequestError as exc:
            raise HTTPException(status_code=503, detail=f"Cannot reach execution engine: {str(exc)}")
