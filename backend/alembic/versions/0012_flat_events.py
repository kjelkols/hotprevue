"""flat_events - fjern parent_id fra events

Revision ID: 0012
Revises: 0011
Create Date: 2026-03-01

Changes:
  - DROP COLUMN events.parent_id (og FK-constraint events_parent_id_fkey)
"""

from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("events_parent_id_fkey", "events", type_="foreignkey")
    op.drop_column("events", "parent_id")


def downgrade() -> None:
    import sqlalchemy as sa
    op.add_column("events", sa.Column("parent_id", sa.UUID(), nullable=True))
    op.create_foreign_key(
        "events_parent_id_fkey", "events", "events", ["parent_id"], ["id"],
        ondelete="RESTRICT",
    )
