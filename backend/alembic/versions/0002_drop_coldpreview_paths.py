"""drop coldpreview_path columns

Revision ID: 0002
Revises: b8dc19f5ebe9
Create Date: 2026-02-26

Drops:
  - photos.coldpreview_path           (derived from hothash — never needs storing)
  - photo_corrections.corrected_coldpreview_path  (corrections applied on-the-fly at serve time)
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, Sequence[str], None] = "b8dc19f5ebe9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column("photos", "coldpreview_path")
    op.drop_column("photo_corrections", "corrected_coldpreview_path")


def downgrade() -> None:
    op.add_column("photo_corrections", sa.Column("corrected_coldpreview_path", sa.String(), nullable=True))
    op.add_column("photos", sa.Column("coldpreview_path", sa.String(), nullable=True))
