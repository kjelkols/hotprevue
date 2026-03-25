"""adr011 machine photographer coupling

Revision ID: a3f8c2d1e905
Revises: 460a1e4a0716
Create Date: 2026-03-25

ADR-011: legg til photographer_id på machines og collections,
og registered_by_machine_id på photos.

Alle nye kolonner er nullable på DB-nivå for migrasjonssikkerhet.
App-koden håndhever NOT NULL for nye rader på machines og collections.
registered_by_machine_id er nullable by design (ADR-011).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a3f8c2d1e905'
down_revision: Union[str, Sequence[str], None] = '460a1e4a0716'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('machines',
        sa.Column('photographer_id', sa.UUID(), nullable=True)
    )
    op.create_foreign_key(
        'fk_machines_photographer_id',
        'machines', 'photographers',
        ['photographer_id'], ['id'],
        ondelete='RESTRICT',
    )

    op.add_column('photos',
        sa.Column('registered_by_machine_id', sa.UUID(), nullable=True)
    )
    op.create_foreign_key(
        'fk_photos_registered_by_machine_id',
        'photos', 'machines',
        ['registered_by_machine_id'], ['machine_id'],
        ondelete='SET NULL',
    )

    op.add_column('collections',
        sa.Column('photographer_id', sa.UUID(), nullable=True)
    )
    op.create_foreign_key(
        'fk_collections_photographer_id',
        'collections', 'photographers',
        ['photographer_id'], ['id'],
        ondelete='RESTRICT',
    )


def downgrade() -> None:
    op.drop_constraint('fk_collections_photographer_id', 'collections', type_='foreignkey')
    op.drop_column('collections', 'photographer_id')

    op.drop_constraint('fk_photos_registered_by_machine_id', 'photos', type_='foreignkey')
    op.drop_column('photos', 'registered_by_machine_id')

    op.drop_constraint('fk_machines_photographer_id', 'machines', type_='foreignkey')
    op.drop_column('machines', 'photographer_id')
