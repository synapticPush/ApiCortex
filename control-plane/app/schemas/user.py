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
