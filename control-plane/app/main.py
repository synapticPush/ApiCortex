from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from starlette.middleware.sessions import SessionMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.core.config import settings
from app.core.security import get_current_claims
from app.core.middleware import (
    CSRFMiddleware,
    JWTAuthMiddleware,
    OrgScopeMiddleware,
    PlanEnforcementMiddleware,
    RateLimitMiddleware,
    RequestContextMiddleware,
)
from app.db.base import Base
from app.db.session import engine
import app.models
from app.routers import apis, auth, contracts, dashboard, orgs


app = FastAPI(title=settings.app_name, version="1.0.0")

app.add_middleware(CSRFMiddleware)
app.add_middleware(PlanEnforcementMiddleware)
app.add_middleware(OrgScopeMiddleware)
app.add_middleware(JWTAuthMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.session_secret_key,
    https_only=settings.is_production,
    same_site=settings.cookie_samesite,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.trusted_hosts)
app.add_middleware(RequestContextMiddleware)

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(orgs.router, prefix="/orgs", tags=["orgs"], dependencies=[Depends(get_current_claims)])
app.include_router(apis.router, prefix="/apis", tags=["apis"], dependencies=[Depends(get_current_claims)])
app.include_router(contracts.router, prefix="/contracts", tags=["contracts"], dependencies=[Depends(get_current_claims)])
app.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"], dependencies=[Depends(get_current_claims)])


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/")
def root() -> dict:
    return {
        "service": settings.app_name,
        "environment": settings.app_env,
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health",
        "ready": "/ready",
    }


@app.get("/ready")
def ready() -> dict:
    db_status = "ok"
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception:
        db_status = "error"
    return {
        "status": "ok" if db_status == "ok" else "degraded",
        "database": db_status,
        "environment": settings.app_env,
    }


@app.on_event("startup")
def on_startup() -> None:
    if settings.should_auto_create_tables:
        Base.metadata.create_all(bind=engine)
