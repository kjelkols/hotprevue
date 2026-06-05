"""ADR-021: teknisk bildekvalitet — sharpness, exposure, noise

Revision ID: f6b2e1d4c028
Revises: e5a2f8b3c901
Create Date: 2026-06-05
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f6b2e1d4c028"
down_revision: Union[str, Sequence[str], None] = "e5a2f8b3c901"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("photos", sa.Column("sharpness_score", sa.Float(), nullable=True))
    op.add_column("photos", sa.Column("exposure_mean", sa.Float(), nullable=True))
    op.add_column("photos", sa.Column("exposure_clipping", sa.Float(), nullable=True))
    op.add_column("photos", sa.Column("noise_score", sa.Float(), nullable=True))
    op.create_index("ix_photos_sharpness_score", "photos", ["sharpness_score"])
    op.create_index("ix_photos_exposure_clipping", "photos", ["exposure_clipping"])


def downgrade() -> None:
    op.drop_index("ix_photos_exposure_clipping", table_name="photos")
    op.drop_index("ix_photos_sharpness_score", table_name="photos")
    op.drop_column("photos", "noise_score")
    op.drop_column("photos", "exposure_clipping")
    op.drop_column("photos", "exposure_mean")
    op.drop_column("photos", "sharpness_score")
