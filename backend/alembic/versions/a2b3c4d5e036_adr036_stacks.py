"""ADR-036: stack-tabell med kind-felt

Revision ID: a2b3c4d5e036
Revises: f6b2e1d4c028
Create Date: 2026-06-08
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "a2b3c4d5e036"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e035"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "stacks",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("kind", sa.String(), nullable=False, server_default="selection"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )

    # Migrer eksisterende stack_id-verdier fra photos: lag én stack-rad per distinkt UUID
    op.execute(
        """
        INSERT INTO stacks (id, kind, created_at)
        SELECT DISTINCT stack_id, 'selection', now()
        FROM photos
        WHERE stack_id IS NOT NULL
        """
    )

    # Sett is_stack_cover=true på første bilde per stack (lavest registered_at)
    op.execute(
        """
        UPDATE photos p
        SET is_stack_cover = true
        FROM (
            SELECT DISTINCT ON (stack_id) id
            FROM photos
            WHERE stack_id IS NOT NULL
            ORDER BY stack_id, registered_at ASC
        ) AS first
        WHERE p.id = first.id
        """
    )

    # Sett is_stack_cover=false på alle andre bilder i stacks
    op.execute(
        """
        UPDATE photos
        SET is_stack_cover = false
        WHERE stack_id IS NOT NULL
          AND id NOT IN (
              SELECT DISTINCT ON (stack_id) id
              FROM photos
              WHERE stack_id IS NOT NULL
              ORDER BY stack_id, registered_at ASC
          )
        """
    )

    # Legg til FK-constraint (stack_id var allerede en kolonne uten FK)
    op.drop_index("ix_photos_stack_id", table_name="photos")
    op.create_foreign_key(
        "photos_stack_id_fkey",
        "photos",
        "stacks",
        ["stack_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_photos_stack_id", "photos", ["stack_id"])


def downgrade() -> None:
    op.drop_constraint("photos_stack_id_fkey", "photos", type_="foreignkey")
    op.drop_index("ix_photos_stack_id", table_name="photos")
    op.create_index("ix_photos_stack_id", "photos", ["stack_id"])
    op.drop_table("stacks")
