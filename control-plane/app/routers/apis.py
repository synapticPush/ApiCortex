import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.security import require_role
from app.db.session import get_db
from app.schemas.api import APICreate, APIOut, EndpointCreate, EndpointOut
from app.services.api_service import APIService
from app.services.plan_service import PlanService


router = APIRouter()


@router.get("", response_model=list[APIOut])
def list_apis(request: Request, db: Session = Depends(get_db)):
    org_id = uuid.UUID(str(request.state.org_id))
    return APIService.list_apis(db, org_id=org_id)


@router.post("", response_model=APIOut)
def create_api(
    payload: APICreate,
    request: Request,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("admin")),
):
    org_id = uuid.UUID(str(request.state.org_id))
    plan = getattr(request.state, "plan", "free")
    if not PlanService.check_api_quota(db, org_id=org_id, plan=plan):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Plan API quota exceeded")
    return APIService.create_api(db, org_id=org_id, payload=payload)


@router.get("/{api_id}/endpoints", response_model=list[EndpointOut])
def list_endpoints(api_id: uuid.UUID, request: Request, db: Session = Depends(get_db)):
    org_id = uuid.UUID(str(request.state.org_id))
    return APIService.list_endpoints(db, org_id=org_id, api_id=api_id)


@router.post("/{api_id}/endpoints", response_model=EndpointOut)
def create_endpoint(
    api_id: uuid.UUID,
    payload: EndpointCreate,
    request: Request,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("admin")),
):
    org_id = uuid.UUID(str(request.state.org_id))
    try:
        return APIService.create_endpoint(db, org_id=org_id, api_id=api_id, payload=payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
