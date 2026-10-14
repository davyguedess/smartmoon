"""add is_superadmin to users

Revision ID: add_superadmin_001
Revises: 
Create Date: 2026-04-05

"""
from alembic import op
import sqlalchemy as sa

revision = 'add_superadmin_001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('is_superadmin', sa.Boolean(), nullable=False, server_default='false')
    )


def downgrade() -> None:
    op.drop_column('users', 'is_superadmin')
