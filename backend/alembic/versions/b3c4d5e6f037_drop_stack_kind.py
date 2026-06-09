"""Fjern kind-kolonne fra stacks

Revision ID: b3c4d5e6f037
Revises: a2b3c4d5e036
Create Date: 2026-06-08
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b3c4d5e6f037"
down_revision: Union[str, Sequence[str], None] = "a2b3c4d5e036"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE stacks DROP COLUMN IF EXISTS kind")


def downgrade() -> None:
    op.add_column(
        "stacks",
        sa.Column("kind", sa.String(), nullable=False, server_default="selection"),
    )
