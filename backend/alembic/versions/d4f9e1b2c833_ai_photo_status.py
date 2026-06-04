"""ai_photo_status table for AI worker job tracking

Revision ID: d4f9e1b2c833
Revises: c3e7f1a2b845
Create Date: 2026-06-04

Tracks whether a photo has been analyzed by the AI worker per capability
(clip, faces). Embeddings themselves live in Qdrant, not Postgres.
No row = not yet analyzed (worker will pick it up).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d4f9e1b2c833"
down_revision: Union[str, Sequence[str], None] = "c3e7f1a2b845"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ai_photo_status",
        sa.Column("photo_id", sa.UUID(), nullable=False),
        sa.Column("capability", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("qdrant_id", sa.String(), nullable=True),
        sa.Column("face_count", sa.Integer(), nullable=True),
        sa.Column("analyzed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("error", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["photo_id"], ["photos.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("photo_id", "capability"),
    )
    op.create_index("ix_ai_photo_status_capability", "ai_photo_status", ["capability"])


def downgrade() -> None:
    op.drop_index("ix_ai_photo_status_capability", table_name="ai_photo_status")
    op.drop_table("ai_photo_status")
