"""ADR-035: fjern tags-array fra photos (erstattes av entitetsmodell)"""
from typing import Union, Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "c1d2e3f4a035"
down_revision: Union[str, None] = "b2d4e6f8a012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_index("ix_photos_tags_gin", table_name="photos", postgresql_using="gin")
    op.drop_column("photos", "tags")


def downgrade() -> None:
    op.add_column("photos", sa.Column("tags", postgresql.ARRAY(sa.String()), nullable=False, server_default="{}"))
    op.create_index("ix_photos_tags_gin", "photos", ["tags"], unique=False, postgresql_using="gin")
