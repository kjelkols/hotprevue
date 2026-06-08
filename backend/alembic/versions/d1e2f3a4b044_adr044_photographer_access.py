"""ADR-044: fotograf som identitet og tilgangskontroll

Revision ID: d1e2f3a4b044
Revises: c3d4e5f6a040
Create Date: 2026-06-08
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "d1e2f3a4b044"
down_revision: Union[str, None] = "c3d4e5f6a040"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add access_level to photographers (default 'guest')
    op.add_column(
        "photographers",
        sa.Column("access_level", sa.Text(), nullable=False, server_default="guest"),
    )

    # 2. Promote photographers linked to owner-role machines
    op.execute(
        """
        UPDATE photographers
        SET access_level = 'owner'
        WHERE id IN (
            SELECT DISTINCT photographer_id
            FROM machines
            WHERE role = 'owner'
              AND photographer_id IS NOT NULL
        )
        """
    )

    # 3. Extend machine_invite_codes for scenario B/C
    op.add_column(
        "machine_invite_codes",
        sa.Column("access_level", sa.Text(), nullable=True),
    )
    op.add_column(
        "machine_invite_codes",
        sa.Column(
            "target_photographer_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )
    op.create_foreign_key(
        "fk_invite_code_target_photographer",
        "machine_invite_codes",
        "photographers",
        ["target_photographer_id"],
        ["id"],
    )

    # 4. Remove role from machines (now on photographer)
    op.drop_column("machines", "role")


def downgrade() -> None:
    # Re-add role to machines (default 'owner' so existing rows are safe)
    op.add_column(
        "machines",
        sa.Column("role", sa.Text(), nullable=False, server_default="owner"),
    )

    # Restore role values from photographer access_level
    op.execute(
        """
        UPDATE machines m
        SET role = p.access_level
        FROM photographers p
        WHERE m.photographer_id = p.id
        """
    )

    op.drop_constraint(
        "fk_invite_code_target_photographer", "machine_invite_codes", type_="foreignkey"
    )
    op.drop_column("machine_invite_codes", "target_photographer_id")
    op.drop_column("machine_invite_codes", "access_level")
    op.drop_column("photographers", "access_level")
