import uuid

from fastapi import APIRouter, Request

from app.schemas.api import DashboardSummaryOut
from app.services.dashboard_service import DashboardService


router = APIRouter()


@router.get("/summary", response_model=DashboardSummaryOut)
def summary(request: Request, window_hours: int = 24):
    org_id = uuid.UUID(str(request.state.org_id))
    window_hours = max(1, min(window_hours, 168))
    return DashboardService.summary(org_id=org_id, window_hours=window_hours)
