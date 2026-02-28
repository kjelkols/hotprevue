import uuid
from datetime import datetime

from sqlalchemy import DateTime, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


class Machine(Base):
    """One row per machine that has used this database."""

    __tablename__ = "machines"

    machine_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    machine_name: Mapped[str] = mapped_column(Text, nullable=False, default="")
    settings: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
