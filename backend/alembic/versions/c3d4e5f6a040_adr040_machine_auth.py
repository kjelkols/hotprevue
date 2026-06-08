"""ADR-040: Maskinidentitet via invitasjonskode og API-token

Revision ID: c3d4e5f6a040
Revises: b2c3d4e5f606
Create Date: 2026-06-08
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "c3d4e5f6a040"
down_revision: Union[str, None] = "b2c3d4e5f606"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "machine_invite_codes",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("code", sa.String(), nullable=False),
        sa.Column("role", sa.String(), nullable=False, server_default="guest"),
        sa.Column("photographer_name", sa.String(), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("used_by_machine", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("code"),
    )

    op.add_column(
        "machines",
        sa.Column("role", sa.String(), nullable=False, server_default="owner"),
    )
    op.add_column(
        "machines",
        sa.Column(
            "enrolled_via_invite",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("machine_invite_codes.id"),
            nullable=True,
        ),
    )

    op.create_table(
        "machine_tokens",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("machine_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("token_hash", sa.String(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("label", sa.String(), nullable=True),
        sa.ForeignKeyConstraint(
            ["machine_id"], ["machines.machine_id"], ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token_hash"),
    )


def downgrade() -> None:
    op.drop_table("machine_tokens")
    op.drop_column("machines", "enrolled_via_invite")
    op.drop_column("machines", "role")
    op.drop_table("machine_invite_codes")
