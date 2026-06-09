"""machines: legg til role-kolonne

Revision ID: c4d5e6f7a046
Revises: b2c3d4e5f045
Create Date: 2026-06-09
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c4d5e6f7a046"
down_revision: Union[str, Sequence[str], None] = "b2c3d4e5f045"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "machines",
        sa.Column("role", sa.String(), nullable=False, server_default="owner"),
    )


def downgrade() -> None:
    op.drop_column("machines", "role")
