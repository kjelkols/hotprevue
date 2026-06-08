import secrets
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base


class MachineInviteCode(Base):
    __tablename__ = "machine_invite_codes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False, default="guest")
    photographer_name: Mapped[str | None] = mapped_column(String, nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    used_by_machine: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())


class Machine(Base):
    """One row per machine that has used this database."""

    __tablename__ = "machines"

    machine_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    machine_name: Mapped[str] = mapped_column(Text, nullable=False, default="")
    photographer_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("photographers.id", ondelete="RESTRICT"),
        nullable=True,  # nullable at DB level for migration safety; app enforces NOT NULL on new rows
    )
    role: Mapped[str] = mapped_column(String, nullable=False, default="owner")
    enrolled_via_invite: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("machine_invite_codes.id"),
        nullable=True,
    )
    settings: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    tokens: Mapped[list["MachineToken"]] = relationship(
        "MachineToken", back_populates="machine", cascade="all, delete-orphan"
    )


class MachineToken(Base):
    __tablename__ = "machine_tokens"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    machine_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("machines.machine_id", ondelete="CASCADE"),
        nullable=False,
    )
    token_hash: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    label: Mapped[str | None] = mapped_column(String, nullable=True)

    machine: Mapped["Machine"] = relationship("Machine", back_populates="tokens")

    @staticmethod
    def generate() -> tuple[str, str]:
        """Returns (raw_token, token_hash). Store only the hash."""
        import hashlib
        raw = f"hp_{secrets.token_hex(16)}"
        h = hashlib.sha256(raw.encode()).hexdigest()
        return raw, h
