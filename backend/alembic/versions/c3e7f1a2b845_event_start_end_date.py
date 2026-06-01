"""event: rename date to start_date, add end_date

Revision ID: c3e7f1a2b845
Revises: a3f8c2d1e905
Create Date: 2026-06-01
"""
from alembic import op
import sqlalchemy as sa

revision = 'c3e7f1a2b845'
down_revision = 'a3f8c2d1e905'
branch_labels = None
depends_on = None


def upgrade():
    op.alter_column('events', 'date', new_column_name='start_date')
    op.add_column('events', sa.Column('end_date', sa.Date(), nullable=True))


def downgrade():
    op.drop_column('events', 'end_date')
    op.alter_column('events', 'start_date', new_column_name='date')
