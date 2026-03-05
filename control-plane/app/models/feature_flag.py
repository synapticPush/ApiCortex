import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class FeatureFlag(Base):
    __tablename__ = "feature_flags"
    __table_args__ = (UniqueConstraint("plan", "feature_key", name="uq_feature_flag_plan_feature"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    plan: Mapped[str] = mapped_column(String(32), index=True, nullable=False)
    feature_key: Mapped[str] = mapped_column(String(128), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    limit: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
