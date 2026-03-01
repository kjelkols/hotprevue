"""file_content_hash

Revision ID: 0009
Revises: 0008
Create Date: 2026-03-01

Changes:
  - image_files.file_content_hash  TEXT NULL  (SHA256 hex of raw file bytes)

NULL for files registered before this migration.
Retroactive computation requires reading the original files from disk.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0009"
down_revision: Union[str, Sequence[str], None] = "0008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("image_files", sa.Column("file_content_hash", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("image_files", "file_content_hash")
