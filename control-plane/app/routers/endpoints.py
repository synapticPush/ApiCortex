import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.security import require_role
from app.db.session import get_db
from app.schemas.api import EndpointCreate, EndpointDirectCreate, EndpointOut, EndpointUpdate
from app.services.api_service import APIService


router = APIRouter()


@router.post("", response_model=EndpointOut)
def create_endpoint_direct(
    payload: EndpointDirectCreate,
    request: Request,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("admin")),
):
    org_id = uuid.UUID(str(request.state.org_id))
    endpoint_payload = EndpointCreate(
        path=payload.path,
        method=payload.method,
        monitoring_enabled=payload.monitoring_enabled,
        poll_interval_seconds=payload.poll_interval_seconds,
        timeout_ms=payload.timeout_ms,
        poll_headers_json=payload.poll_headers_json,
    )
    try:
        return APIService.create_endpoint(db, org_id=org_id, api_id=payload.api_id, payload=endpoint_payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.patch("/{endpoint_id}", response_model=EndpointOut)
def update_endpoint(
    endpoint_id: uuid.UUID,
    payload: EndpointUpdate,
    request: Request,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("admin")),
):
    org_id = uuid.UUID(str(request.state.org_id))
    try:
        return APIService.update_endpoint(db, org_id=org_id, endpoint_id=endpoint_id, payload=payload)
    except ValueError as exc:
        if str(exc) == "Endpoint not found":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete("/{endpoint_id}")
def delete_endpoint(
    endpoint_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("admin")),
):
    org_id = uuid.UUID(str(request.state.org_id))
    try:
        APIService.delete_endpoint(db, org_id=org_id, endpoint_id=endpoint_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    return {"status": "deleted"}
