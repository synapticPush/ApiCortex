import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class OpenAPISpec(Base):
    __tablename__ = "openapi_specs"
    __table_args__ = (UniqueConstraint("api_id", "version", name="uq_openapi_api_version"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    api_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("apis.id", ondelete="CASCADE"), index=True, nullable=False)
    org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=False)
    version: Mapped[str] = mapped_column(String(64), nullable=False)
    raw_spec: Mapped[dict] = mapped_column(JSONB, nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    api = relationship("API", back_populates="specs")
