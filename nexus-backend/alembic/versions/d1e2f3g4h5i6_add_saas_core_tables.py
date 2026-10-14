"""add_saas_core_tables

Creates:
  - platform_skills     (skills marketplace)
  - platform_agents     (agents marketplace)
  - skill_installs      (tracks installations per company)
  - agent_installs      (tracks agent installations per company)
  - user_credits        (balance ledger per company)
  - credit_transactions (immutable credit movements)
  - credits_per_month   (column added to plans table)

Also adds missing columns to existing plans table if not present.

Revision ID: d1e2f3g4h5i6
Revises: b1c2d3e4f5g6
Create Date: 2026-04-06

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers
revision = 'd1e2f3g4h5i6'
down_revision = ('a1b2c3d4e5f6', 'b1c2d3e4f5g6')  # merge both heads
branch_labels = None
depends_on = None



def upgrade():
    conn = op.get_bind()

    # ── Add credits_per_month to plans table (if not exists) ─────────────────
    try:
        conn.execute(sa.text(
            "ALTER TABLE plans ADD COLUMN IF NOT EXISTS credits_per_month INTEGER NOT NULL DEFAULT 0"
        ))
    except Exception:
        pass  # column may already exist

    # ── platform_skills ───────────────────────────────────────────────────────
    op.create_table(
        'platform_skills',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('slug', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('long_description', sa.Text(), nullable=True),
        sa.Column('icon', sa.String(10), nullable=True, server_default='🔧'),
        sa.Column('category', sa.String(100), nullable=True, server_default='Geral'),
        sa.Column('price_credits', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('prompt_patch', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_exclusive', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('exclusive_company_id', sa.Integer(), sa.ForeignKey('companies.id'), nullable=True),
        sa.Column('allowed_plans', postgresql.JSONB(), nullable=False, server_default='[]'),
        sa.Column('tags', postgresql.JSONB(), nullable=False, server_default='[]'),
        sa.Column('install_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slug', name='uq_platform_skills_slug'),
    )
    op.create_index('ix_platform_skills_slug', 'platform_skills', ['slug'], unique=True)

    # ── platform_agents ───────────────────────────────────────────────────────
    op.create_table(
        'platform_agents',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('slug', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('long_description', sa.Text(), nullable=True),
        sa.Column('icon', sa.String(10), nullable=True, server_default='🤖'),
        sa.Column('category', sa.String(100), nullable=True, server_default='Geral'),
        sa.Column('agent_type', sa.String(50), nullable=True, server_default='general'),
        sa.Column('system_prompt', sa.Text(), nullable=True),
        sa.Column('model', sa.String(100), nullable=True, server_default='gpt-4o-mini'),
        sa.Column('provider', sa.String(50), nullable=True, server_default='openai'),
        sa.Column('temperature', sa.String(10), nullable=True, server_default='0.7'),
        sa.Column('price_credits', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('is_exclusive', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('exclusive_company_id', sa.Integer(), sa.ForeignKey('companies.id'), nullable=True),
        sa.Column('allowed_plans', postgresql.JSONB(), nullable=False, server_default='[]'),
        sa.Column('tags', postgresql.JSONB(), nullable=False, server_default='[]'),
        sa.Column('install_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slug', name='uq_platform_agents_slug'),
    )
    op.create_index('ix_platform_agents_slug', 'platform_agents', ['slug'], unique=True)

    # ── skill_installs ────────────────────────────────────────────────────────
    op.create_table(
        'skill_installs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('company_id', sa.Integer(), sa.ForeignKey('companies.id'), nullable=False),
        sa.Column('skill_id', sa.Integer(), sa.ForeignKey('platform_skills.id'), nullable=False),
        sa.Column('installed_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('credits_spent', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('installed_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('company_id', 'skill_id', name='uq_skill_installs_company_skill'),
    )
    op.create_index('ix_skill_installs_company', 'skill_installs', ['company_id'])

    # ── agent_installs ────────────────────────────────────────────────────────
    op.create_table(
        'agent_installs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('company_id', sa.Integer(), sa.ForeignKey('companies.id'), nullable=False),
        sa.Column('agent_id', sa.Integer(), sa.ForeignKey('platform_agents.id'), nullable=False),
        sa.Column('installed_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('credits_spent', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('installed_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('config_snapshot', postgresql.JSONB(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('company_id', 'agent_id', name='uq_agent_installs_company_agent'),
    )
    op.create_index('ix_agent_installs_company', 'agent_installs', ['company_id'])

    # ── user_credits ──────────────────────────────────────────────────────────
    op.create_table(
        'user_credits',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('company_id', sa.Integer(), sa.ForeignKey('companies.id'), nullable=False),
        sa.Column('balance', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('total_earned', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('total_spent', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('company_id', name='uq_user_credits_company'),
    )
    op.create_index('ix_user_credits_company', 'user_credits', ['company_id'], unique=True)

    # ── credit_transactions ───────────────────────────────────────────────────
    # Create ENUM type
    conn.execute(sa.text(
        "DO $$ BEGIN "
        "CREATE TYPE credit_tx_type AS ENUM ('grant','purchase','spend','refund','bonus','expiry'); "
        "EXCEPTION WHEN duplicate_object THEN null; "
        "END $$;"
    ))

    op.create_table(
        'credit_transactions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('company_id', sa.Integer(), sa.ForeignKey('companies.id'), nullable=False),
        sa.Column('amount', sa.Integer(), nullable=False),
        sa.Column('balance_after', sa.Integer(), nullable=False),
        sa.Column('transaction_type', postgresql.ENUM(
            'grant', 'purchase', 'spend', 'refund', 'bonus', 'expiry',
            name='credit_tx_type', create_type=False
        ), nullable=False),
        sa.Column('description', sa.String(500), nullable=True),
        sa.Column('reference_id', sa.String(100), nullable=True),
        sa.Column('reference_type', sa.String(50), nullable=True),
        sa.Column('performed_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_credit_tx_company_created', 'credit_transactions', ['company_id', 'created_at'])


def downgrade():
    op.drop_table('credit_transactions')
    op.drop_table('user_credits')
    op.drop_table('agent_installs')
    op.drop_table('skill_installs')
    op.drop_table('platform_agents')
    op.drop_table('platform_skills')

    # Drop ENUM
    op.get_bind().execute(sa.text("DROP TYPE IF EXISTS credit_tx_type"))
