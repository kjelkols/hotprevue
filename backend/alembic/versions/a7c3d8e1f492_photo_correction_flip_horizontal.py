"""PhotoCorrection: legg til flip_horizontal

Revision ID: a7c3d8e1f492
Revises: f6b2e1d4c028
Create Date: 2026-06-05
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a7c3d8e1f492"
down_revision: Union[str, Sequence[str], None] = "f6b2e1d4c028"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "photo_corrections",
        sa.Column("flip_horizontal", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("photo_corrections", "flip_horizontal")
