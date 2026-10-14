"""merge_heads_for_payment_gateway

Revision ID: 205a15533059
Revises: add_superadmin_001, d1e2f3g4h5i6
Create Date: 2026-04-06 05:02:00.554381
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '205a15533059'
down_revision: Union[str, None] = ('add_superadmin_001', 'd1e2f3g4h5i6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
