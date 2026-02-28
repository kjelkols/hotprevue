"""exif_per_imagefile

Revision ID: 0007
Revises: 0006
Create Date: 2026-02-28

Changes:
  - image_files.exif_data  JSONB NOT NULL DEFAULT '{}'
  - image_files.width      INT NULL
  - image_files.height     INT NULL
  - photos.exif_data       DROP (moved to image_files)
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = "0007"
down_revision: Union[str, Sequence[str], None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "image_files",
        sa.Column("exif_data", JSONB(), nullable=False, server_default="{}"),
    )
    op.add_column("image_files", sa.Column("width", sa.Integer(), nullable=True))
    op.add_column("image_files", sa.Column("height", sa.Integer(), nullable=True))
    op.drop_column("photos", "exif_data")


def downgrade() -> None:
    op.add_column(
        "photos",
        sa.Column("exif_data", JSONB(), nullable=False, server_default="{}"),
    )
    op.drop_column("image_files", "height")
    op.drop_column("image_files", "width")
    op.drop_column("image_files", "exif_data")
