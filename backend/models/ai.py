import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


class AiPhotoStatus(Base):
    """AI analysis status per photo and capability.

    A missing row means the photo has not been analyzed yet (equivalent to pending).
    The worker retries rows with status='error'. Embeddings live in Qdrant, not here.
    """

    __tablename__ = "ai_photo_status"

    photo_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("photos.id", ondelete="CASCADE"),
        primary_key=True,
    )
    capability: Mapped[str] = mapped_column(String, primary_key=True)  # 'clip' | 'faces'
    status: Mapped[str] = mapped_column(String, nullable=False)         # 'done' | 'error'
    qdrant_id: Mapped[str | None] = mapped_column(String, nullable=True)   # point ID in Qdrant (clip)
    face_count: Mapped[int | None] = mapped_column(Integer, nullable=True)  # faces capability only
    analyzed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
