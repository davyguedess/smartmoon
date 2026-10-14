"""s1_studio_templates - Create studio_templates table for Canva-like template library

Revision ID: s1_studio_templates
Revises: r1_marketing_pro
Create Date: 2026-04-09
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 's1_studio_templates'
down_revision = 'r1_marketing_pro'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'studio_templates',
        sa.Column('id',            sa.Integer(),     primary_key=True, index=True),
        sa.Column('name',          sa.String(120),   nullable=False),
        sa.Column('description',   sa.String(500)),
        sa.Column('category',      sa.String(50),    nullable=False, server_default='Marketing'),
        sa.Column('format',        sa.String(20),    nullable=False, server_default='feed'),
        sa.Column('tags',          postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('is_premium',    sa.Boolean(),     nullable=False, server_default='false'),
        sa.Column('price_credits', sa.Integer(),     nullable=False, server_default='0'),
        sa.Column('thumbnail_url', sa.Text()),
        sa.Column('konva_json',    postgresql.JSONB(), nullable=False, server_default='{}'),
        sa.Column('status',        sa.String(20),    nullable=False, server_default='draft'),
        sa.Column('created_by',    sa.Integer(),     sa.ForeignKey('users.id'), nullable=True),
        sa.Column('view_count',    sa.Integer(),     nullable=False, server_default='0'),
        sa.Column('use_count',     sa.Integer(),     nullable=False, server_default='0'),
        sa.Column('created_at',    sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at',    sa.DateTime(timezone=True), onupdate=sa.func.now()),
    )
    op.create_index('ix_studio_tpl_status_cat', 'studio_templates', ['status', 'category'])
    op.create_index('ix_studio_tpl_format',     'studio_templates', ['format'])
    op.create_index('ix_studio_tpl_premium',    'studio_templates', ['is_premium'])


def downgrade():
    op.drop_index('ix_studio_tpl_premium',    table_name='studio_templates')
    op.drop_index('ix_studio_tpl_format',     table_name='studio_templates')
    op.drop_index('ix_studio_tpl_status_cat', table_name='studio_templates')
    op.drop_table('studio_templates')
