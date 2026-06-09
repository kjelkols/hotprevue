"""ADR-045: offentlig bildedeling via relay

Revision ID: b2c3d4e5f045
Revises: a1b2c3d4e039
Create Date: 2026-06-09
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b2c3d4e5f045"
down_revision: Union[str, None] = "a1b2c3d4e039"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("system_settings", sa.Column("public_share_relay_url", sa.Text(), nullable=True))
    op.add_column("system_settings", sa.Column("public_share_base_url", sa.Text(), nullable=True))
    op.add_column("system_settings", sa.Column("public_share_api_key", sa.Text(), nullable=True))
    op.add_column("system_settings", sa.Column("public_share_default_ttl_days", sa.Integer(), nullable=False, server_default="30"))

    op.add_column("photos", sa.Column("public_share_token", sa.Text(), nullable=True))
    op.add_column("photos", sa.Column("public_share_expires_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_photos_public_share_token", "photos", ["public_share_token"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_photos_public_share_token", table_name="photos")
    op.drop_column("photos", "public_share_expires_at")
    op.drop_column("photos", "public_share_token")
    op.drop_column("system_settings", "public_share_default_ttl_days")
    op.drop_column("system_settings", "public_share_api_key")
    op.drop_column("system_settings", "public_share_base_url")
    op.drop_column("system_settings", "public_share_relay_url")
