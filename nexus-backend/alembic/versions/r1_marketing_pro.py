"""
marketing_pro — Brand Kit, Company Marketing Modules, Studio Usage, Meta Campaigns

Revision ID: r1_marketing_pro
Revises: q1_ai_token_store
Create Date: 2026-04-09

Tables:
  - brand_kits                  : identidade visual e pré-prompt por empresa
  - company_marketing_modules   : flags de módulos por empresa (ativado pelo admin)
  - studio_usage                : controle de gerações mensais do Studio
  - meta_campaigns              : campanhas de tráfego pago via Meta API
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "r1_marketing_pro"
down_revision = "q1_ai_token_store"
branch_labels = None
depends_on = None


def upgrade() -> None:

    # ── brand_kits ─────────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS brand_kits (
            id               SERIAL PRIMARY KEY,
            company_id       INTEGER NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,

            brand_name       VARCHAR(200) NOT NULL,
            product          VARCHAR(500),
            niche            VARCHAR(200),
            target_audience  VARCHAR(300),
            city_region      VARCHAR(200),

            logo_url         TEXT,
            color_primary    VARCHAR(7),
            color_secondary  VARCHAR(7),
            color_accent     VARCHAR(7),
            color_background VARCHAR(7),
            font_primary     VARCHAR(100),
            font_secondary   VARCHAR(100),

            visual_styles    TEXT[],
            texture_style    VARCHAR(100),
            comm_tone        VARCHAR(100),
            reference_images TEXT[],

            pre_prompt       TEXT,

            created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_brand_kit_company ON brand_kits(company_id)")

    # ── company_marketing_modules ──────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS company_marketing_modules (
            id                   SERIAL PRIMARY KEY,
            company_id           INTEGER NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,

            has_brand_kit        BOOLEAN NOT NULL DEFAULT FALSE,
            has_studio           BOOLEAN NOT NULL DEFAULT FALSE,
            has_traffic_pro      BOOLEAN NOT NULL DEFAULT FALSE,
            has_ig_campaigns     BOOLEAN NOT NULL DEFAULT FALSE,

            studio_limit         INTEGER NOT NULL DEFAULT 50,
            meta_accounts_limit  INTEGER NOT NULL DEFAULT 1,

            activated_by         INTEGER REFERENCES users(id),
            notes                TEXT,

            created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_mkt_modules_company ON company_marketing_modules(company_id)")

    # ── studio_usage ───────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS studio_usage (
            id                SERIAL PRIMARY KEY,
            company_id        INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            month             VARCHAR(7) NOT NULL,
            generations_used  INTEGER NOT NULL DEFAULT 0,
            generations_limit INTEGER NOT NULL DEFAULT 50,
            UNIQUE(company_id, month)
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_studio_usage_company ON studio_usage(company_id)")

    # ── meta_campaigns ─────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS meta_campaigns (
            id               SERIAL PRIMARY KEY,
            company_id       INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,

            meta_campaign_id VARCHAR(100),
            meta_adset_id    VARCHAR(100),
            meta_ad_id       VARCHAR(100),
            meta_ad_account  VARCHAR(100),

            name             VARCHAR(300) NOT NULL,
            objective        VARCHAR(100),
            status           VARCHAR(50) NOT NULL DEFAULT 'draft',

            budget_daily     NUMERIC(10,2),
            start_date       DATE,
            end_date         DATE,

            location_lat     FLOAT,
            location_lng     FLOAT,
            location_radius  INTEGER,
            location_name    VARCHAR(300),

            target_audience  JSONB,
            ai_strategy      JSONB,
            pdf_report_url   TEXT,

            approved_at      TIMESTAMPTZ,
            approved_by      INTEGER REFERENCES users(id),

            last_metrics     JSONB,
            last_metrics_at  TIMESTAMPTZ,

            created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_meta_campaign_company ON meta_campaigns(company_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_meta_campaign_status  ON meta_campaigns(status)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS meta_campaigns CASCADE")
    op.execute("DROP TABLE IF EXISTS studio_usage CASCADE")
    op.execute("DROP TABLE IF EXISTS company_marketing_modules CASCADE")
    op.execute("DROP TABLE IF EXISTS brand_kits CASCADE")
