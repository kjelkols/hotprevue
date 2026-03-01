"""file_copy

Revision ID: 0010
Revises: 0009
Create Date: 2026-03-01

Changes:
  - CREATE TABLE file_copy_operations
  - CREATE TABLE file_copy_skips
  - system_settings.copy_verify_after_copy  BOOLEAN NOT NULL DEFAULT true
  - system_settings.copy_include_videos     BOOLEAN NOT NULL DEFAULT false
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "0010"
down_revision: Union[str, Sequence[str], None] = "0009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "file_copy_operations",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("source_path", sa.Text(), nullable=False),
        sa.Column("destination_path", sa.Text(), nullable=False),
        sa.Column("device_label", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("files_total", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("files_copied", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("files_skipped", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("bytes_total", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("bytes_copied", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("verify_after_copy", sa.Boolean(), nullable=False),
        sa.Column("include_videos", sa.Boolean(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.Column(
            "input_session_id",
            UUID(as_uuid=True),
            sa.ForeignKey("input_sessions.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )

    op.create_table(
        "file_copy_skips",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "operation_id",
            UUID(as_uuid=True),
            sa.ForeignKey("file_copy_operations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("source_path", sa.Text(), nullable=False),
        sa.Column("reason", sa.String(), nullable=False),
        sa.Column("skipped_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )

    op.add_column(
        "system_settings",
        sa.Column("copy_verify_after_copy", sa.Boolean(), nullable=False, server_default="true"),
    )
    op.add_column(
        "system_settings",
        sa.Column("copy_include_videos", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("system_settings", "copy_include_videos")
    op.drop_column("system_settings", "copy_verify_after_copy")
    op.drop_table("file_copy_skips")
    op.drop_table("file_copy_operations")
