"""add ai_cost_usd to usage_logs

Revision ID: a1b2c3d4e5f6
Revises: 7e0f5200f524
Create Date: 2026-04-03 07:00:00.000000

Adds:
  - ai_cost_usd: real cost in USD per billing period
  - Performance index on (company_id, year, month)
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision = 'a1b2c3d4e5f6'
down_revision = '7e0f5200f524'   # actual head: add_instagram_campaign_tables
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Use raw SQL with IF NOT EXISTS — idempotent, safe to run on existing DBs
    # (Column may already exist if it was manually added before this migration)
    op.execute("""
        ALTER TABLE usage_logs
        ADD COLUMN IF NOT EXISTS ai_cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0
    """)

    # Performance index for monthly cost aggregation queries
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_usage_cost_period
        ON usage_logs (company_id, year, month)
    """)


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_usage_cost_period")
    op.drop_column('usage_logs', 'ai_cost_usd')

