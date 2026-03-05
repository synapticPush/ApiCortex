import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.membership import Membership
from app.models.organization import Organization
from app.models.user import User


class AuthService:
    @staticmethod
    def get_or_create_user(db: Session, email: str, name: str, provider: str) -> User:
        user = db.scalar(select(User).where(User.email == email))
        if user:
            if user.name != name or user.provider != provider:
                user.name = name
                user.provider = provider
                db.add(user)
                db.commit()
                db.refresh(user)
            return user
        user = User(email=email, name=name, provider=provider)
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def ensure_default_org_membership(db: Session, user: User) -> tuple[Organization, Membership]:
        membership = db.scalar(select(Membership).where(Membership.user_id == user.id))
        if membership:
            org = db.get(Organization, membership.org_id)
            return org, membership
        org = Organization(name=f"{user.name}'s Organization", plan="free")
        db.add(org)
        db.flush()
        membership = Membership(user_id=user.id, org_id=org.id, role="owner")
        db.add(membership)
        db.commit()
        db.refresh(org)
        db.refresh(membership)
        return org, membership

    @staticmethod
    def get_user_org_membership(db: Session, user_id: uuid.UUID, org_id: uuid.UUID) -> tuple[Organization, Membership]:
        membership = db.scalar(select(Membership).where(Membership.user_id == user_id, Membership.org_id == org_id))
        if not membership:
            raise ValueError("Membership not found")
        org = db.get(Organization, org_id)
        if not org:
            raise ValueError("Organization not found")
        return org, membership
