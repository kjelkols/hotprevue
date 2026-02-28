"""settings_and_machines: machines table, extra column on system_settings, notes on input_sessions

Revision ID: 0005
Revises: 0004
Create Date: 2026-02-28

Changes:
  - CREATE TABLE machines (machine_id UUID PK, machine_name TEXT, settings JSONB, last_seen_at TIMESTAMPTZ, created_at TIMESTAMPTZ)
  - ADD system_settings.extra JSONB NOT NULL DEFAULT '{}'
  - ADD input_sessions.notes TEXT NULL
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = "0005"
down_revision: Union[str, Sequence[str], None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "machines",
        sa.Column("machine_id", UUID(as_uuid=True), primary_key=True),
        sa.Column("machine_name", sa.Text(), nullable=False, server_default=""),
        sa.Column("settings", JSONB(), nullable=False, server_default="{}"),
        sa.Column(
            "last_seen_at",
            sa.DateTime(timezone=True),
            nullable=True,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )

    op.add_column(
        "system_settings",
        sa.Column("extra", JSONB(), nullable=False, server_default="{}"),
    )

    op.add_column(
        "input_sessions",
        sa.Column("notes", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("input_sessions", "notes")
    op.drop_column("system_settings", "extra")
    op.drop_table("machines")
