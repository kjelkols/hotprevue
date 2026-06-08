import uuid
from datetime import datetime

from sqlalchemy import DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base


class Stack(Base):
    __tablename__ = "stacks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    photos: Mapped[list["Photo"]] = relationship(  # noqa: F821
        "Photo",
        back_populates="stack",
        foreign_keys="[Photo.stack_id]",
    )
