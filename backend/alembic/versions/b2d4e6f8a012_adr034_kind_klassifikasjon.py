"""ADR-034: kind-klassifikasjon for events og bilder"""
from typing import Union, Sequence
import uuid

import sqlalchemy as sa
from alembic import op

revision: str = "b2d4e6f8a012"
down_revision: Union[str, None] = "a1b3c5d7e902"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

DEFAULT_KIND_ID = "00000000-0000-0000-0000-000000000001"


def upgrade() -> None:
    op.create_table(
        "kinds",
        sa.Column("id", sa.dialects.postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("color", sa.String(), nullable=True),
        sa.Column("hidden_by_default", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index(
        "ix_kinds_is_default_unique",
        "kinds",
        ["is_default"],
        unique=True,
        postgresql_where=sa.text("is_default = true"),
    )

    op.execute(
        f"INSERT INTO kinds (id, name, is_default) VALUES ('{DEFAULT_KIND_ID}', 'Generelt', true)"
    )

    op.add_column("events", sa.Column("kind_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column("photos", sa.Column("kind_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True))

    op.execute(f"UPDATE events SET kind_id = '{DEFAULT_KIND_ID}'")
    op.execute(f"UPDATE photos SET kind_id = '{DEFAULT_KIND_ID}'")

    op.alter_column("events", "kind_id", nullable=False)
    op.alter_column("photos", "kind_id", nullable=False)

    op.create_foreign_key("fk_events_kind_id", "events", "kinds", ["kind_id"], ["id"])
    op.create_foreign_key("fk_photos_kind_id", "photos", "kinds", ["kind_id"], ["id"])


def downgrade() -> None:
    op.drop_constraint("fk_photos_kind_id", "photos", type_="foreignkey")
    op.drop_constraint("fk_events_kind_id", "events", type_="foreignkey")
    op.drop_column("photos", "kind_id")
    op.drop_column("events", "kind_id")
    op.drop_index("ix_kinds_is_default_unique", table_name="kinds")
    op.drop_table("kinds")
