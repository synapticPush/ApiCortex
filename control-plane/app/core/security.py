import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import Depends, HTTPException, Request, Response, Security, status
from fastapi.security import APIKeyCookie
from jose import JWTError, jwt

from app.core.config import settings


access_cookie_scheme = APIKeyCookie(name=settings.access_cookie_name, auto_error=False)


def _now_utc() -> datetime:
    return datetime.now(UTC)


def _jwt_signing_key() -> str:
    return settings.effective_jwt_private_key


def _jwt_verify_key() -> str:
    return settings.effective_jwt_public_key


def create_token(payload: dict[str, Any], expires_delta: timedelta, token_type: str) -> str:
    exp = _now_utc() + expires_delta
    to_encode = {**payload, "exp": exp, "type": token_type}
    key = _jwt_signing_key()
    if not key:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="JWT keys are not configured")
    return jwt.encode(to_encode, key, algorithm=settings.effective_jwt_algorithm)


def create_access_token(payload: dict[str, Any]) -> str:
    return create_token(payload, timedelta(minutes=settings.access_token_exp_minutes), "access")


def create_refresh_token(payload: dict[str, Any]) -> str:
    return create_token(payload, timedelta(days=settings.refresh_token_exp_days), "refresh")


def decode_token(token: str, expected_type: str | None = None) -> dict[str, Any]:
    key = _jwt_verify_key()
    if not key:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="JWT keys are not configured")
    try:
        payload = jwt.decode(token, key, algorithms=[settings.effective_jwt_algorithm])
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc
    if expected_type and payload.get("type") != expected_type:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
    return payload


def generate_csrf_token() -> str:
    return secrets.token_urlsafe(32)


def set_auth_cookies(response: Response, access_token: str, refresh_token: str, csrf_token: str) -> None:
    common = {
        "secure": settings.use_secure_cookies,
        "domain": settings.cookie_domain,
        "samesite": settings.cookie_samesite,
        "path": "/",
    }
    response.set_cookie(
        key=settings.access_cookie_name,
        value=access_token,
        httponly=True,
        max_age=settings.access_token_exp_minutes * 60,
        **common,
    )
    response.set_cookie(
        key=settings.refresh_cookie_name,
        value=refresh_token,
        httponly=True,
        max_age=settings.refresh_token_exp_days * 24 * 3600,
        **common,
    )
    response.set_cookie(
        key=settings.csrf_cookie_name,
        value=csrf_token,
        httponly=False,
        max_age=settings.refresh_token_exp_days * 24 * 3600,
        **common,
    )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(settings.access_cookie_name, path="/", domain=settings.cookie_domain)
    response.delete_cookie(settings.refresh_cookie_name, path="/", domain=settings.cookie_domain)
    response.delete_cookie(settings.csrf_cookie_name, path="/", domain=settings.cookie_domain)


def get_current_claims(
    request: Request,
    access_token: str | None = Security(access_cookie_scheme),
) -> dict[str, Any]:
    claims = getattr(request.state, "claims", None)
    if claims:
        return claims
    if access_token:
        decoded = decode_token(access_token, expected_type="access")
        request.state.claims = decoded
        request.state.user_id = decoded.get("sub")
        request.state.org_id = decoded.get("org_id")
        request.state.role = decoded.get("role")
        request.state.plan = decoded.get("plan")
        return decoded
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")


def require_role(min_role: str):
    role_order = {"member": 1, "admin": 2, "owner": 3}

    def dependency(claims: dict[str, Any] = Depends(get_current_claims)) -> dict[str, Any]:
        current = claims.get("role", "member")
        if role_order.get(current, 0) < role_order.get(min_role, 0):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return claims

    return dependency
