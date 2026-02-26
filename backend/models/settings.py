import uuid

from sqlalchemy import Boolean, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


class SystemSettings(Base):
    """Always exactly one row. Created automatically on first startup."""

    __tablename__ = "system_settings"

    installation_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    instance_name: Mapped[str] = mapped_column(String, nullable=False, default="")
    owner_name: Mapped[str] = mapped_column(String, nullable=False, default="")
    owner_website: Mapped[str | None] = mapped_column(String, nullable=True)
    owner_bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    default_sort: Mapped[str] = mapped_column(String, nullable=False, default="taken_at_desc")
    show_deleted_in_gallery: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    browse_buffer_size: Mapped[int] = mapped_column(Integer, nullable=False, default=100)
    coldpreview_max_px: Mapped[int] = mapped_column(Integer, nullable=False, default=1200)
    coldpreview_quality: Mapped[int] = mapped_column(Integer, nullable=False, default=85)
