"""perceptual_hashes

Revision ID: 0008
Revises: 0007
Create Date: 2026-02-28

Changes:
  - photos.dct_perceptual_hash  BIGINT NULL  (DCT-based pHash, 64-bit)
  - photos.difference_hash      BIGINT NULL  (difference dHash, 64-bit)

Both fields are NULL for photos registered before this migration.
Use POST /photos/compute-perceptual-hashes to populate retroactively
from the stored hotpreview_b64 — no original files needed.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0008"
down_revision: Union[str, Sequence[str], None] = "0007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("photos", sa.Column("dct_perceptual_hash", sa.BigInteger(), nullable=True))
    op.add_column("photos", sa.Column("difference_hash", sa.BigInteger(), nullable=True))


def downgrade() -> None:
    op.drop_column("photos", "difference_hash")
    op.drop_column("photos", "dct_perceptual_hash")
