"""collection_item: card_type, notes, card_data

Revision ID: 0003
Revises: 0002
Create Date: 2026-02-26

Changes:
  - collection_items.is_text_card  BOOLEAN  → dropped
  - collection_items.card_type     TEXT NULL → added (None = photo, 'text' = text card)
  - collection_items.notes         TEXT NULL → added (presenter/speaker notes)
  - collection_items.card_data     JSONB NULL → added (escape hatch for future card types)
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0003"
down_revision: Union[str, Sequence[str], None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Migrate existing text cards before dropping the boolean
    op.add_column("collection_items", sa.Column("card_type", sa.Text(), nullable=True))
    op.execute("UPDATE collection_items SET card_type = 'text' WHERE is_text_card = TRUE")
    op.drop_column("collection_items", "is_text_card")

    op.add_column("collection_items", sa.Column("notes", sa.Text(), nullable=True))
    op.add_column("collection_items", sa.Column("card_data", JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("collection_items", "card_data")
    op.drop_column("collection_items", "notes")

    op.add_column("collection_items", sa.Column("is_text_card", sa.Boolean(), nullable=True))
    op.execute("UPDATE collection_items SET is_text_card = (card_type IS NOT NULL)")
    op.alter_column("collection_items", "is_text_card", nullable=False)
    op.drop_column("collection_items", "card_type")
