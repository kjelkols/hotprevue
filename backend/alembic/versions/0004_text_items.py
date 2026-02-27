"""text_items: replace card_type/title/text_content/card_data with text_item_id FK

Revision ID: 0004
Revises: 0003
Create Date: 2026-02-27

Changes:
  - CREATE TABLE text_items (id UUID PK, markup TEXT, created_at TIMESTAMPTZ)
  - collection_items.text_item_id UUID FK → text_items.id ON DELETE SET NULL
  - Data migration: card_type='text' rows → INSERT text_items, link via text_item_id
  - ADD CHECK ((hothash IS NOT NULL AND text_item_id IS NULL) OR (hothash IS NULL AND text_item_id IS NOT NULL))
  - DROP collection_items.card_type, title, text_content, card_data
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "0004"
down_revision: Union[str, Sequence[str], None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create text_items table
    op.create_table(
        "text_items",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("markup", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    # 2. Add text_item_id column (nullable for now — constraint added after migration)
    op.add_column(
        "collection_items",
        sa.Column("text_item_id", UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_collection_items_text_item_id",
        "collection_items",
        "text_items",
        ["text_item_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # 3. Data migration: existing text cards → text_items rows
    conn = op.get_bind()
    text_card_rows = conn.execute(
        sa.text(
            "SELECT id, title, text_content FROM collection_items WHERE card_type = 'text'"
        )
    ).fetchall()

    for row in text_card_rows:
        item_id, title, text_content = row
        markup = _build_markup(title, text_content)
        ti_id = conn.execute(
            sa.text(
                "INSERT INTO text_items (id, markup) VALUES (gen_random_uuid(), :markup) RETURNING id"
            ),
            {"markup": markup},
        ).scalar()
        conn.execute(
            sa.text(
                "UPDATE collection_items SET text_item_id = :ti_id WHERE id = :item_id"
            ),
            {"ti_id": ti_id, "item_id": item_id},
        )

    # 4. Add CHECK constraint
    op.create_check_constraint(
        "ck_collection_items_hothash_xor_text_item",
        "collection_items",
        "(hothash IS NOT NULL AND text_item_id IS NULL) OR (hothash IS NULL AND text_item_id IS NOT NULL)",
    )

    # 5. Drop old text-card columns
    op.drop_column("collection_items", "card_data")
    op.drop_column("collection_items", "text_content")
    op.drop_column("collection_items", "title")
    op.drop_column("collection_items", "card_type")


def downgrade() -> None:
    # 1. Drop CHECK constraint
    op.drop_constraint(
        "ck_collection_items_hothash_xor_text_item", "collection_items", type_="check"
    )

    # 2. Re-add old columns
    op.add_column("collection_items", sa.Column("card_type", sa.Text(), nullable=True))
    op.add_column("collection_items", sa.Column("title", sa.Text(), nullable=True))
    op.add_column("collection_items", sa.Column("text_content", sa.Text(), nullable=True))
    op.add_column("collection_items", sa.Column("card_data", JSONB(), nullable=True))

    # 3. Migrate back: text_item rows → card_type='text' + markup in text_content
    conn = op.get_bind()
    conn.execute(
        sa.text(
            """
            UPDATE collection_items ci
            SET card_type = 'text',
                text_content = ti.markup
            FROM text_items ti
            WHERE ci.text_item_id = ti.id
            """
        )
    )

    # 4. Drop text_item_id FK and column
    op.drop_constraint(
        "fk_collection_items_text_item_id", "collection_items", type_="foreignkey"
    )
    op.drop_column("collection_items", "text_item_id")

    # 5. Drop text_items table
    op.drop_table("text_items")


def _build_markup(title: str | None, text_content: str | None) -> str:
    parts = []
    if title:
        parts.append(f"# {title}")
    if text_content:
        parts.append(text_content)
    return "\n\n".join(parts)
