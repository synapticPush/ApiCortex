import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    email: EmailStr
    name: str
    provider: str
    created_at: datetime


class AuthSessionOut(BaseModel):
    user_id: uuid.UUID
    org_id: uuid.UUID
    role: str
    plan: str


class OrgOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    plan: str
    created_at: datetime


class OrgUpdate(BaseModel):
    name: str | None = None
    plan: str | None = None


class UserProfileUpdate(BaseModel):
    name: str


class MembershipOut(BaseModel):
    user_id: uuid.UUID
    org_id: uuid.UUID
    role: str
    email: EmailStr
    name: str


class MemberInvite(BaseModel):
    email: EmailStr
    name: str
    role: str = "member"


class MemberRoleUpdate(BaseModel):
    role: str


class IngestKeyStatusOut(BaseModel):
    configured: bool
    updated_at: datetime | None = None


class IngestKeyRotateOut(BaseModel):
    api_key: str
    updated_at: datetime
