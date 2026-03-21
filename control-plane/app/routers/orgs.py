import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import require_role
from app.db.session import get_db
from app.models.membership import Membership
from app.models.organization import Organization
from app.models.user import User
from app.schemas.user import IngestKeyRotateOut, IngestKeyStatusOut, MemberInvite, MembershipOut, MemberRoleUpdate, OrgOut, OrgUpdate
from app.services.ingest_key_service import IngestKeyService


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


@router.patch("/{org_id}", response_model=OrgOut)
def update_org(
    org_id: uuid.UUID,
    org_update: OrgUpdate,
    request: Request,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("owner")),
):
    current_org_id = getattr(request.state, "org_id", None)
    if str(org_id) != str(current_org_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot update other organization")
    org = db.get(Organization, org_id)
    if not org:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Organization not found")
    
    if org_update.name is not None:
        org.name = org_update.name
    if org_update.plan is not None:
        org.plan = org_update.plan

    db.commit()
    db.refresh(org)
    return org


@router.get("/{org_id}/members", response_model=list[MembershipOut])
def list_members(
    org_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("admin")),
):
    current_org_id = getattr(request.state, "org_id", None)
    if str(org_id) != str(current_org_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot view other organization members")
    rows = list(
        db.execute(
            select(Membership, User)
            .join(User, User.id == Membership.user_id)
            .where(Membership.org_id == org_id)
        ).all()
    )
    return [
        MembershipOut(
            user_id=membership.user_id,
            org_id=membership.org_id,
            role=membership.role,
            email=user.email,
            name=user.name,
        )
        for membership, user in rows
    ]


@router.post("/{org_id}/members", response_model=MembershipOut)
def add_member(
    org_id: uuid.UUID,
    payload: MemberInvite,
    request: Request,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("admin")),
):
    current_org_id = getattr(request.state, "org_id", None)
    if str(org_id) != str(current_org_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot add members to other organization")

    target_role = payload.role.lower()
    if target_role not in {"member", "admin", "owner"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role")

    user = db.scalar(select(User).where(User.email == payload.email))
    if not user:
        user = User(email=payload.email, name=payload.name, provider="manual")
        db.add(user)
        db.flush()

    membership = db.scalar(select(Membership).where(Membership.org_id == org_id, Membership.user_id == user.id))
    if membership:
        membership.role = target_role
    else:
        membership = Membership(org_id=org_id, user_id=user.id, role=target_role)
        db.add(membership)

    db.commit()
    return MembershipOut(
        user_id=membership.user_id,
        org_id=membership.org_id,
        role=membership.role,
        email=user.email,
        name=user.name,
    )


@router.patch("/{org_id}/members/{user_id}", response_model=MembershipOut)
def update_member_role(
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    payload: MemberRoleUpdate,
    request: Request,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("owner")),
):
    current_org_id = getattr(request.state, "org_id", None)
    if str(org_id) != str(current_org_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot update members in other organization")

    role = payload.role.lower()
    if role not in {"member", "admin", "owner"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid role")

    membership = db.scalar(select(Membership).where(Membership.org_id == org_id, Membership.user_id == user_id))
    if not membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membership not found")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    membership.role = role
    db.add(membership)
    db.commit()
    return MembershipOut(
        user_id=membership.user_id,
        org_id=membership.org_id,
        role=membership.role,
        email=user.email,
        name=user.name,
    )


@router.delete("/{org_id}/members/{user_id}")
def remove_member(
    org_id: uuid.UUID,
    user_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("owner")),
):
    current_org_id = getattr(request.state, "org_id", None)
    current_user_id = getattr(request.state, "user_id", None)
    if str(org_id) != str(current_org_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot remove members from other organization")
    if str(user_id) == str(current_user_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot remove yourself")

    membership = db.scalar(select(Membership).where(Membership.org_id == org_id, Membership.user_id == user_id))
    if not membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membership not found")

    db.delete(membership)
    db.commit()
    return {"status": "deleted"}


@router.get("/{org_id}/ingest-key", response_model=IngestKeyStatusOut)
def get_ingest_key_status(
    org_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("admin")),
):
    current_org_id = getattr(request.state, "org_id", None)
    if str(org_id) != str(current_org_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot view ingest key status for other organization")
    record = IngestKeyService.get_org_key(db, org_id)
    return IngestKeyStatusOut(configured=record is not None, updated_at=record.updated_at if record else None)


@router.post("/{org_id}/ingest-key/rotate", response_model=IngestKeyRotateOut)
def rotate_ingest_key(
    org_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    _: dict = Depends(require_role("owner")),
):
    current_org_id = getattr(request.state, "org_id", None)
    if str(org_id) != str(current_org_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot rotate ingest key for other organization")
    key, record = IngestKeyService.rotate_org_key(db, org_id)
    return IngestKeyRotateOut(api_key=key, updated_at=record.updated_at)
