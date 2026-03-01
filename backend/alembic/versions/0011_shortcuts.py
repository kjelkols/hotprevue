"""shortcuts

Revision ID: 0011
Revises: 0010
Create Date: 2026-03-01

Changes:
  - CREATE TABLE shortcuts (machine-specific directory bookmarks)
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "shortcuts",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "machine_id",
            UUID(as_uuid=True),
            sa.ForeignKey("machines.machine_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("path", sa.Text(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_shortcuts_machine_id", "shortcuts", ["machine_id"])


def downgrade() -> None:
    op.drop_index("ix_shortcuts_machine_id", table_name="shortcuts")
    op.drop_table("shortcuts")
