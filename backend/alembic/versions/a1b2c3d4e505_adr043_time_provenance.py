"""ADR-043: Tid- og posisjonskorreksjon med provenans

Revision ID: a1b2c3d4e505
Revises: f6b2e1d4c028
Create Date: 2026-06-08
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "a1b2c3d4e505"
down_revision: Union[str, None] = "b3c4d5e6f037"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("photos", sa.Column("taken_at_utc_offset", sa.String(), nullable=True))
    op.add_column("photos", sa.Column("location_accuracy_meters", sa.Float(), nullable=True))

    op.create_table(
        "photo_field_edits",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("photo_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("field_name", sa.String(), nullable=False),
        sa.Column("old_value", postgresql.JSONB(), nullable=False),
        sa.Column("new_value", postgresql.JSONB(), nullable=False),
        sa.Column("edit_method", sa.String(), nullable=False),
        sa.Column("edit_details", postgresql.JSONB(), nullable=True),
        sa.Column("machine_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "edited_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["photo_id"], ["photos.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["machine_id"], ["machines.machine_id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_photo_field_edits_photo_id",
        "photo_field_edits",
        ["photo_id", sa.text("edited_at DESC")],
    )

    # Migrate existing taken_at_source values:
    #   1 (previously "adjusted") → 6 (offset_corrected)
    #   2 (previously BatchTakenAt default = "manual") → 5 (manual)
    #   NULL → 0 (unknown)
    op.execute(
        "UPDATE photos SET taken_at_source = 6 WHERE taken_at_source = 1"
    )
    op.execute(
        "UPDATE photos SET taken_at_source = 5 WHERE taken_at_source = 2"
    )
    op.execute(
        "UPDATE photos SET taken_at_source = 0 WHERE taken_at_source IS NULL"
    )

    # Migrate existing location_source NULL → 0 (unknown)
    op.execute(
        "UPDATE photos SET location_source = 0 WHERE location_source IS NULL"
    )


def downgrade() -> None:
    # Reverse data migration (best effort — 5/6 back to 1/2)
    op.execute(
        "UPDATE photos SET taken_at_source = 2 WHERE taken_at_source = 5"
    )
    op.execute(
        "UPDATE photos SET taken_at_source = 1 WHERE taken_at_source = 6"
    )

    op.drop_index("ix_photo_field_edits_photo_id", table_name="photo_field_edits")
    op.drop_table("photo_field_edits")
    op.drop_column("photos", "location_accuracy_meters")
    op.drop_column("photos", "taken_at_utc_offset")
