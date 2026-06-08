"""ADR-037: Partial indexes for EXIF search fields

Revision ID: b2c3d4e5f606
Revises: a1b2c3d4e505
Create Date: 2026-06-08
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b2c3d4e5f606"
down_revision: Union[str, None] = "a1b2c3d4e505"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        "ix_photos_iso",
        "photos",
        ["iso"],
        postgresql_where=sa.text("iso IS NOT NULL"),
    )
    op.create_index(
        "ix_photos_aperture",
        "photos",
        ["aperture"],
        postgresql_where=sa.text("aperture IS NOT NULL"),
    )
    op.create_index(
        "ix_photos_focal_length",
        "photos",
        ["focal_length"],
        postgresql_where=sa.text("focal_length IS NOT NULL"),
    )
    op.create_index(
        "ix_photos_location",
        "photos",
        ["location_lat", "location_lng"],
        postgresql_where=sa.text("location_lat IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_photos_location", table_name="photos")
    op.drop_index("ix_photos_focal_length", table_name="photos")
    op.drop_index("ix_photos_aperture", table_name="photos")
    op.drop_index("ix_photos_iso", table_name="photos")
