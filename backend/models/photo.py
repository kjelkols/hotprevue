import uuid
from datetime import datetime, timezone

from sqlalchemy import BigInteger, Boolean, DateTime, Float, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Photo(Base):
    __tablename__ = "photos"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hothash: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    hotpreview_b64: Mapped[str] = mapped_column(Text, nullable=False)

    taken_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    taken_at_source: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    taken_at_accuracy: Mapped[str] = mapped_column(String, nullable=False, default="second")

    location_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    location_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    location_source: Mapped[int | None] = mapped_column(Integer, nullable=True)
    location_accuracy: Mapped[str | None] = mapped_column(String, nullable=True)

    camera_make: Mapped[str | None] = mapped_column(String, nullable=True)
    camera_model: Mapped[str | None] = mapped_column(String, nullable=True)
    lens_model: Mapped[str | None] = mapped_column(String, nullable=True)
    iso: Mapped[int | None] = mapped_column(Integer, nullable=True)
    shutter_speed: Mapped[str | None] = mapped_column(String, nullable=True)
    aperture: Mapped[float | None] = mapped_column(Float, nullable=True)
    focal_length: Mapped[float | None] = mapped_column(Float, nullable=True)

    tags: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=False, default=list)
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("categories.id", ondelete="SET NULL"),
        nullable=True,
    )
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    photographer_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("photographers.id", ondelete="RESTRICT"),
        nullable=False,
    )
    input_session_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("input_sessions.id", ondelete="SET NULL"),
        nullable=True,
    )
    event_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("events.id", ondelete="SET NULL"),
        nullable=True,
    )
    stack_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, index=True)
    is_stack_cover: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)

    registered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    @property
    def has_correction(self) -> bool:
        """Read by PhotoListItem schema (from_attributes=True). Requires correction to be loaded."""
        return self.correction is not None

    image_files: Mapped[list["ImageFile"]] = relationship(
        "ImageFile",
        back_populates="photo",
        cascade="all, delete-orphan",
    )
    duplicate_files: Mapped[list["DuplicateFile"]] = relationship(
        "DuplicateFile",
        back_populates="photo",
        cascade="all, delete-orphan",
    )
    correction: Mapped["PhotoCorrection | None"] = relationship(
        "PhotoCorrection",
        back_populates="photo",
        uselist=False,
        cascade="all, delete-orphan",
    )


# GIN index on tags array for efficient tag filtering
Index("ix_photos_tags_gin", Photo.__table__.c.tags, postgresql_using="gin")


class ImageFile(Base):
    __tablename__ = "image_files"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    photo_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("photos.id", ondelete="CASCADE"),
        nullable=False,
    )
    file_path: Mapped[str] = mapped_column(String, nullable=False)
    file_type: Mapped[str] = mapped_column(String, nullable=False)  # RAW, JPEG, TIFF, PNG, HEIC, XMP
    is_master: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    file_size_bytes: Mapped[int | None] = mapped_column(BigInteger(), nullable=True)
    last_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Per-file EXIF and dimensions — populated at registration
    exif_data: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)

    photo: Mapped["Photo"] = relationship("Photo", back_populates="image_files")


class DuplicateFile(Base):
    __tablename__ = "duplicate_files"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    photo_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("photos.id", ondelete="CASCADE"),
        nullable=False,
    )
    file_path: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    session_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("input_sessions.id", ondelete="CASCADE"),
        nullable=False,
    )
    detected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    photo: Mapped["Photo"] = relationship("Photo", back_populates="duplicate_files")


class PhotoCorrection(Base):
    __tablename__ = "photo_corrections"

    photo_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("photos.id", ondelete="CASCADE"),
        primary_key=True,
    )
    rotation: Mapped[int | None] = mapped_column(Integer, nullable=True)
    horizon_angle: Mapped[float | None] = mapped_column(Float, nullable=True)
    exposure_ev: Mapped[float | None] = mapped_column(Float, nullable=True)
    crop_left: Mapped[float | None] = mapped_column(Float, nullable=True)
    crop_top: Mapped[float | None] = mapped_column(Float, nullable=True)
    crop_right: Mapped[float | None] = mapped_column(Float, nullable=True)
    crop_bottom: Mapped[float | None] = mapped_column(Float, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=_utcnow,
        onupdate=_utcnow,
    )

    photo: Mapped["Photo"] = relationship("Photo", back_populates="correction")
