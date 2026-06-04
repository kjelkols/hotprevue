"""index on image_files.file_path for prefix search

Revision ID: e5a2f8b3c901
Revises: d4f9e1b2c833
Create Date: 2026-06-05

Needed for efficient LIKE '/path/%' queries in folder-event-lookup (ADR-024 steg 6).
"""
from typing import Sequence, Union

from alembic import op

revision: str = "e5a2f8b3c901"
down_revision: Union[str, Sequence[str], None] = "d4f9e1b2c833"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_image_files_file_path",
        "image_files",
        ["file_path"],
        postgresql_ops={"file_path": "text_pattern_ops"},
    )


def downgrade() -> None:
    op.drop_index("ix_image_files_file_path", table_name="image_files")
