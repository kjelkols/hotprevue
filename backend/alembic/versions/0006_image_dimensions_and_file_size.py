"""image_dimensions_and_file_size

Revision ID: 0006
Revises: 0005
Create Date: 2026-02-28

Changes:
  - photos.width INT NULL
  - photos.height INT NULL
  - image_files.file_size_bytes BIGINT NULL
  - image_files.last_verified_at TIMESTAMPTZ NULL
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: Union[str, Sequence[str], None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("photos", sa.Column("width", sa.Integer(), nullable=True))
    op.add_column("photos", sa.Column("height", sa.Integer(), nullable=True))
    op.add_column("image_files", sa.Column("file_size_bytes", sa.BigInteger(), nullable=True))
    op.add_column("image_files", sa.Column("last_verified_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("image_files", "last_verified_at")
    op.drop_column("image_files", "file_size_bytes")
    op.drop_column("photos", "height")
    op.drop_column("photos", "width")
