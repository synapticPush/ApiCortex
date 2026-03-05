import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Membership(Base):
    __tablename__ = "memberships"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), primary_key=True)
    role: Mapped[str] = mapped_column(String(32), nullable=False, default="owner")

    user = relationship("User", back_populates="memberships")
    organization = relationship("Organization", back_populates="memberships")
