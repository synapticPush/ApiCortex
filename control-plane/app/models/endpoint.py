import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Endpoint(Base):
	__tablename__ = "endpoints"
	__table_args__ = (UniqueConstraint("api_id", "path", "method", name="uq_endpoint_api_path_method"),)

	id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
	api_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("apis.id", ondelete="CASCADE"), index=True, nullable=False)
	org_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), index=True, nullable=False)
	path: Mapped[str] = mapped_column(String(1024), nullable=False)
	method: Mapped[str] = mapped_column(String(16), nullable=False)
	created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

	api = relationship("API", back_populates="endpoints")
	contracts = relationship("Contract", back_populates="endpoint", cascade="all, delete-orphan")
