from datetime import datetime

from sqlalchemy import DateTime, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


class MachineLock(Base):
    """Advisory lock for coordinating multi-machine access.

    One row per lock type. A machine acquires a lock before starting a
    registration session or large batch operation. Other machines check this
    table before starting and warn the user if a lock is held.

    Locks expire automatically via expires_at (TTL: 30 minutes) to handle
    crashes and unexpected disconnects.

    See docs/decisions/010-multi-machine-locking.md
    """

    __tablename__ = "machine_locks"

    lock_type: Mapped[str] = mapped_column(Text, primary_key=True)  # e.g. 'registration'
    locked_by: Mapped[str] = mapped_column(Text, nullable=False)    # instance_name
    locked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
