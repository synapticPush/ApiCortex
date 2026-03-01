import json
import time
import uuid
from collections import defaultdict, deque
from collections.abc import Callable
from datetime import UTC, datetime
from threading import Lock

from fastapi import HTTPException, Request, status
from sqlalchemy import func, select
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response

from app.core.config import settings
from app.core.security import decode_token
from app.db.session import SessionLocal
from app.models.api import API


UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}
PUBLIC_EXACT_PATHS = {
    "/",
    "/favicon.ico",
}
PUBLIC_PATH_PREFIXES = {
    "/health",
    "/ready",
    "/auth/login",
    "/auth/callback",
    "/auth/refresh",
    "/openapi.json",
    "/docs",
    "/redoc",
}
CSRF_EXCLUDED_PATH_PREFIXES = {"/auth/callback", "/auth/login"}


def _is_public_path(path: str) -> bool:
    if path in PUBLIC_EXACT_PATHS:
        return True
    return any(path.startswith(prefix) for prefix in PUBLIC_PATH_PREFIXES)


def _is_csrf_excluded(path: str) -> bool:
    return any(path.startswith(prefix) for prefix in CSRF_EXCLUDED_PATH_PREFIXES)


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = request_id
        start = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
        response.headers["X-Request-ID"] = request_id
        payload = {
            "timestamp": datetime.now(UTC).isoformat(),
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "latency_ms": elapsed_ms,
            "org_id": str(getattr(request.state, "org_id", "")),
            "user_id": str(getattr(request.state, "user_id", "")),
        }
        print(json.dumps(payload))
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    _buckets: dict[str, deque[float]] = defaultdict(deque)
    _lock = Lock()

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if request.method == "OPTIONS":
            return await call_next(request)
        ip = request.client.host if request.client else "unknown"
        now = time.time()
        with self._lock:
            bucket = self._buckets[ip]
            while bucket and now - bucket[0] > 60:
                bucket.popleft()
            if len(bucket) >= settings.rate_limit_per_minute:
                return JSONResponse(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    content={"detail": "Rate limit exceeded"},
                )
            bucket.append(now)
        return await call_next(request)


class JWTAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path
        if request.method == "OPTIONS" or _is_public_path(path):
            return await call_next(request)
        token = request.cookies.get(settings.access_cookie_name)
        if not token:
            return JSONResponse(status_code=status.HTTP_401_UNAUTHORIZED, content={"detail": "Authentication required"})
        try:
            claims = decode_token(token, expected_type="access")
        except HTTPException as exc:
            return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
        request.state.claims = claims
        request.state.user_id = claims.get("sub")
        request.state.org_id = claims.get("org_id")
        request.state.role = claims.get("role")
        request.state.plan = claims.get("plan")
        return await call_next(request)


class OrgScopeMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path
        if request.method == "OPTIONS" or _is_public_path(path):
            return await call_next(request)
        org_id = getattr(request.state, "org_id", None)
        if not org_id:
            return JSONResponse(status_code=status.HTTP_403_FORBIDDEN, content={"detail": "Organization scope missing"})
        return await call_next(request)


class PlanEnforcementMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        if request.method == "POST" and request.url.path == "/apis":
            plan = (getattr(request.state, "plan", "free") or "free").lower()
            org_id = getattr(request.state, "org_id", None)
            limit = {"free": 1, "pro": 10, "business": None}.get(plan, 1)
            if org_id and limit is not None:
                with SessionLocal() as db:
                    total = db.scalar(select(func.count(API.id)).where(API.org_id == org_id))
                    if total is not None and total >= limit:
                        return JSONResponse(
                            status_code=status.HTTP_403_FORBIDDEN,
                            content={"detail": f"Plan limit reached for plan '{plan}'"},
                        )
        return await call_next(request)


class CSRFMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        path = request.url.path
        if request.method in UNSAFE_METHODS and not _is_public_path(path) and not _is_csrf_excluded(path):
            csrf_cookie = request.cookies.get(settings.csrf_cookie_name)
            csrf_header = request.headers.get(settings.csrf_header_name)
            if not csrf_cookie or not csrf_header:
                return JSONResponse(status_code=status.HTTP_403_FORBIDDEN, content={"detail": "Missing CSRF token"})
            if csrf_cookie != csrf_header:
                return JSONResponse(status_code=status.HTTP_403_FORBIDDEN, content={"detail": "Invalid CSRF token"})
            origin = request.headers.get("origin")
            if origin and settings.cors_origins and origin not in settings.cors_origins:
                return JSONResponse(status_code=status.HTTP_403_FORBIDDEN, content={"detail": "Invalid request origin"})
        return await call_next(request)
