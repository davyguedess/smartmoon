"""add_agent_custom_skills_table

Revision ID: 5bed77c9c8f9
Revises: 9bcce93b745e
Create Date: 2026-03-25 09:51:24.365117
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '5bed77c9c8f9'
down_revision: Union[str, None] = '9bcce93b745e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'agent_custom_skills',
        sa.Column('id', sa.Integer(), nullable=False, autoincrement=True),
        sa.Column('company_id', sa.Integer(), sa.ForeignKey('companies.id'), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('slug', sa.String(100), nullable=False),
        sa.Column('icon', sa.String(10), nullable=True, server_default='🔧'),
        sa.Column('category', sa.String(50), nullable=True, server_default='Custom'),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('prompt_patch', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()')),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('company_id', 'slug', name='ix_custom_skill_company_slug'),
    )
    op.create_index('ix_agent_custom_skills_id', 'agent_custom_skills', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_agent_custom_skills_id', table_name='agent_custom_skills')
    op.drop_table('agent_custom_skills')
