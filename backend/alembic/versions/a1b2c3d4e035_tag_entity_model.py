"""ADR-035: tag-entitetsmodell (tags + photo_tags + pg_trgm)"""
from typing import Union, Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = "a1b2c3d4e035"
down_revision: Union[str, None] = "c1d2e3f4a035"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    op.create_table(
        "tags",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.Text, nullable=False),
        sa.Column("slug", sa.String, nullable=False, unique=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_tags_name_trgm", "tags", ["name"], postgresql_using="gin",
                    postgresql_ops={"name": "gin_trgm_ops"})

    op.create_table(
        "photo_tags",
        sa.Column("photo_id", UUID(as_uuid=True), sa.ForeignKey("photos.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("tag_id", UUID(as_uuid=True), sa.ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True),
    )


def downgrade() -> None:
    op.drop_table("photo_tags")
    op.drop_index("ix_tags_name_trgm", table_name="tags")
    op.drop_table("tags")
