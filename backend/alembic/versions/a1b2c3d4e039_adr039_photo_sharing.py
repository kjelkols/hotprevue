"""ADR-039: enkeltbilde-deling via hothash-URL med OG-tags

Revision ID: a1b2c3d4e039
Revises: d1e2f3a4b044
Create Date: 2026-06-09
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a1b2c3d4e039"
down_revision: Union[str, None] = "d1e2f3a4b044"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("photos", sa.Column("is_shared", sa.Boolean(), nullable=False, server_default="false"))
    op.add_column("photos", sa.Column("share_caption", sa.Text(), nullable=True))
    op.add_column("photos", sa.Column("share_downloads", sa.Boolean(), nullable=False, server_default="true"))
    op.add_column("photos", sa.Column("share_views", sa.Integer(), nullable=False, server_default="0"))


def downgrade() -> None:
    op.drop_column("photos", "share_views")
    op.drop_column("photos", "share_downloads")
    op.drop_column("photos", "share_caption")
    op.drop_column("photos", "is_shared")
