import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base


class Collection(Base):
    __tablename__ = "collections"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    cover_hothash: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())

    items: Mapped[list["CollectionItem"]] = relationship(
        "CollectionItem",
        back_populates="collection",
        cascade="all, delete-orphan",
        order_by="CollectionItem.position",
    )


class CollectionItem(Base):
    __tablename__ = "collection_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    collection_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("collections.id", ondelete="CASCADE"),
        nullable=False,
    )
    hothash: Mapped[str | None] = mapped_column(String, nullable=True)
    text_item_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("text_items.id", ondelete="SET NULL"),
        nullable=True,
    )
    position: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    caption: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    collection: Mapped["Collection"] = relationship("Collection", back_populates="items")
    text_item: Mapped["TextItem | None"] = relationship(  # noqa: F821
        "TextItem", back_populates="collection_items"
    )
