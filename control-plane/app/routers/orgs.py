import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import require_role
from app.db.session import get_db
from app.models.organization import Organization
from app.schemas.user import OrgOut


router = APIRouter()


@router.get("/current", response_model=OrgOut)
def current_org(request: Request, db: Session = Depends(get_db)):
    org_id = getattr(request.state, "org_id", None)
    org = db.scalar(select(Organization).where(Organization.id == org_id))
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    return org


@router.delete("/{org_id}")
def delete_org(
    org_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("owner")),
):
    current_org_id = getattr(request.state, "org_id", None)
    if str(org_id) != str(current_org_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot delete other organization")
    org = db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    db.delete(org)
    db.commit()
    return {"status": "deleted"}
