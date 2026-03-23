from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
import asyncio

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
from app.services.alert_subscriber import AlertSubscriber
from app.services.job_worker import JobWorker
import app.models
from app.routers import apis, auth, contracts, dashboard, orgs, predictions, telemetry, testing

@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    if settings.should_auto_create_tables:
        Base.metadata.create_all(bind=engine)
    stop_event = asyncio.Event()
    worker_task = asyncio.create_task(JobWorker().run(stop_event))
    alert_subscriber = AlertSubscriber(settings)
    alert_subscriber.start()
    yield
    stop_event.set()
    await worker_task
    alert_subscriber.stop()


app = FastAPI(title=settings.app_name, version="1.0.0", lifespan=lifespan)

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
app.include_router(telemetry.router, prefix="/telemetry", tags=["telemetry"], dependencies=[Depends(get_current_claims)])
app.include_router(predictions.router, prefix="/predictions", tags=["predictions"], dependencies=[Depends(get_current_claims)])
app.include_router(testing.router, prefix="/testing", tags=["testing"], dependencies=[Depends(get_current_claims)])


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
