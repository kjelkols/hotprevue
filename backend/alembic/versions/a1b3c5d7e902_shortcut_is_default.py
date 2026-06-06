"""shortcuts.is_default — mark home shortcut as protected

Revision ID: a1b3c5d7e902
Revises: f6b2e1d4c028
Create Date: 2026-06-06
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'a1b3c5d7e902'
down_revision: Union[str, None] = 'a7c3d8e1f492'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('shortcuts', sa.Column('is_default', sa.Boolean(), nullable=False, server_default='false'))
    # Eksisterende Hjemmeområde-snarveier markeres som standard
    op.execute("UPDATE shortcuts SET is_default = true WHERE name = 'Hjemmeområde'")


def downgrade() -> None:
    op.drop_column('shortcuts', 'is_default')
