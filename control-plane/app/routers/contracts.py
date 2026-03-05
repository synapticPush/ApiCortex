import uuid
import json

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from sqlalchemy.orm import Session

from app.core.security import require_role
from app.db.session import get_db
from app.schemas.api import ContractCreate, ContractOut, OpenAPIUploadOut, OpenAPIUploadRequest, OpenAPISpecCreate, OpenAPISpecOut
from app.services.contract_service import ContractService
from app.services.job_service import JobService


router = APIRouter()


def _parse_openapi_file(file: UploadFile) -> dict:
    try:
        raw = file.file.read()
        text = raw.decode("utf-8")
        data = json.loads(text)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid OpenAPI JSON file") from exc
    if not isinstance(data, dict):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="OpenAPI document must be a JSON object")
    return data


@router.post("/openapi", response_model=OpenAPIUploadOut)
def upload_openapi_flexible(
    request: Request,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("admin")),
    file: UploadFile = File(...),
    version: str = Form(...),
    api_id: str | None = Form(default=None),
    api_name: str | None = Form(default=None),
    base_url: str | None = Form(default=None),
):
    org_id = uuid.UUID(str(request.state.org_id))
    plan = str(getattr(request.state, "plan", "free"))
    resolved_api_id = None
    if api_id:
        try:
            resolved_api_id = uuid.UUID(api_id)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid api_id") from exc
    raw_spec = _parse_openapi_file(file)
    payload = OpenAPIUploadRequest(
        api_id=resolved_api_id,
        api_name=api_name,
        base_url=base_url,
        version=version,
        raw_spec=raw_spec,
    )
    try:
        spec, api, api_created, endpoints_synced = ContractService.upload_openapi_with_api_resolution(
            db=db,
            org_id=org_id,
            payload=payload,
            plan=plan,
        )
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    JobService.enqueue_job(
        db,
        org_id=org_id,
        job_type="openapi_contract_sync",
        payload={"api_id": str(api.id), "spec_id": str(spec.id)},
    )
    return {
        "spec_id": spec.id,
        "api_id": api.id,
        "version": spec.version,
        "uploaded_at": spec.uploaded_at,
        "api_created": api_created,
        "endpoints_synced": endpoints_synced,
    }


@router.post("/openapi/{api_id}", response_model=OpenAPISpecOut)
def upload_openapi(
    api_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("admin")),
    file: UploadFile = File(...),
    version: str = Form(...),
):
    org_id = uuid.UUID(str(request.state.org_id))
    payload = OpenAPISpecCreate(version=version, raw_spec=_parse_openapi_file(file))
    try:
        spec = ContractService.upload_openapi_spec(db, org_id=org_id, api_id=api_id, payload=payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    JobService.enqueue_job(
        db,
        org_id=org_id,
        job_type="openapi_contract_sync",
        payload={"api_id": str(api_id), "spec_id": str(spec.id)},
    )
    return spec


@router.get("/openapi/{api_id}", response_model=list[OpenAPISpecOut])
def list_openapi_specs(api_id: uuid.UUID, request: Request, db: Session = Depends(get_db)):
    org_id = uuid.UUID(str(request.state.org_id))
    return ContractService.list_specs(db, org_id=org_id, api_id=api_id)


@router.post("/endpoint/{endpoint_id}", response_model=ContractOut)
def create_contract(
    endpoint_id: uuid.UUID,
    payload: ContractCreate,
    request: Request,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("admin")),
):
    org_id = uuid.UUID(str(request.state.org_id))
    try:
        return ContractService.create_contract(db, org_id=org_id, endpoint_id=endpoint_id, payload=payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/jobs/claim")
def claim_job(request: Request, db: Session = Depends(get_db), _: dict = Depends(require_role("admin"))):
    org_id = uuid.UUID(str(request.state.org_id))
    job = JobService.claim_next_job(db, org_id=org_id)
    if not job:
        return {"status": "empty"}
    return {
        "id": str(job.id),
        "type": job.type,
        "payload": job.payload,
        "attempts": job.attempts,
    }


@router.post("/jobs/{job_id}/complete")
def complete_job(job_id: uuid.UUID, db: Session = Depends(get_db), _: dict = Depends(require_role("admin"))):
    from app.models.job import Job

    job = db.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    JobService.mark_job_completed(db, job)
    return {"status": "completed"}


@router.post("/jobs/{job_id}/fail")
def fail_job(job_id: uuid.UUID, db: Session = Depends(get_db), _: dict = Depends(require_role("admin"))):
    from app.models.job import Job

    job = db.get(Job, job_id)
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    updated = JobService.mark_job_failed_with_backoff(db, job)
    return {"status": updated.status, "attempts": updated.attempts, "run_at": updated.run_at.isoformat()}
