import uuid

from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    clear_auth_cookies,
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_csrf_token,
    get_current_claims,
    set_auth_cookies,
)
from app.db.session import get_db
from app.services.auth_service import AuthService


router = APIRouter()
oauth = OAuth()
oauth.register(
    name="google",
    client_id=settings.oauth_google_client_id,
    client_secret=settings.oauth_google_client_secret,
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_kwargs={"scope": "openid email profile"},
)
oauth.register(
    name="github",
    client_id=settings.oauth_github_client_id,
    client_secret=settings.oauth_github_client_secret,
    access_token_url="https://github.com/login/oauth/access_token",
    authorize_url="https://github.com/login/oauth/authorize",
    api_base_url="https://api.github.com/",
    client_kwargs={"scope": "user:email"},
)


@router.get("/login/{provider}")
async def login(provider: str, request: Request):
    if provider not in {"google", "github"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported OAuth provider")
    redirect_uri = f"{settings.oauth_redirect_base_url}/auth/callback/{provider}"
    return await oauth.create_client(provider).authorize_redirect(request, redirect_uri)


@router.get("/callback/{provider}")
async def callback(provider: str, request: Request, db: Session = Depends(get_db)):
    if provider not in {"google", "github"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported OAuth provider")
    client = oauth.create_client(provider)
    token = await client.authorize_access_token(request)
    if provider == "google":
        user_info = token.get("userinfo") or await client.parse_id_token(request, token)
        email = user_info.get("email")
        name = user_info.get("name") or email
    else:
        profile = (await client.get("user", token=token)).json()
        emails = (await client.get("user/emails", token=token)).json()
        primary = next((item.get("email") for item in emails if item.get("primary")), None)
        email = primary or profile.get("email")
        name = profile.get("name") or profile.get("login") or email
    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OAuth provider did not return email")
    user = AuthService.get_or_create_user(db, email=email, name=name, provider=provider)
    org, membership = AuthService.ensure_default_org_membership(db, user)
    claims = {
        "sub": str(user.id),
        "org_id": str(org.id),
        "role": membership.role,
        "plan": org.plan,
    }
    access_token = create_access_token(claims)
    refresh_token = create_refresh_token(claims)
    csrf_token = generate_csrf_token()
    response = RedirectResponse(url="/auth/me", status_code=status.HTTP_302_FOUND)
    set_auth_cookies(response, access_token=access_token, refresh_token=refresh_token, csrf_token=csrf_token)
    return response


@router.post("/refresh")
def refresh(request: Request, response: Response, db: Session = Depends(get_db)):
    refresh_cookie = request.cookies.get(settings.refresh_cookie_name)
    if not refresh_cookie:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing refresh token")
    claims = decode_token(refresh_cookie, expected_type="refresh")
    try:
        user_id = uuid.UUID(claims["sub"])
        org_id = uuid.UUID(claims["org_id"])
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token claims") from exc
    org, membership = AuthService.get_user_org_membership(db, user_id=user_id, org_id=org_id)
    next_claims = {
        "sub": str(user_id),
        "org_id": str(org.id),
        "role": membership.role,
        "plan": org.plan,
    }
    access_token = create_access_token(next_claims)
    refresh_token = create_refresh_token(next_claims)
    csrf_token = generate_csrf_token()
    set_auth_cookies(response, access_token=access_token, refresh_token=refresh_token, csrf_token=csrf_token)
    return {"status": "refreshed"}


@router.post("/logout")
def logout(response: Response):
    clear_auth_cookies(response)
    return {"status": "logged_out"}


@router.get("/me")
def me(claims: dict = Depends(get_current_claims)):
    return claims
