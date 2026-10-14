"""
add_ai_token_store — IA Store tables

Revision ID: q1_ai_token_store
Revises: p1_payment_gateway
Create Date: 2026-04-06

Tables:
  - ai_token_packs      : catálogo de packs de tokens (admin gerencia)
  - ai_token_balances   : saldo de NEXUS tokens por empresa
  - ai_token_transactions: ledger de consumo
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "q1_ai_token_store"
down_revision = "p1_payment_gateway"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── ai_token_packs ──────────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS ai_token_packs (
            id              SERIAL PRIMARY KEY,
            name            TEXT NOT NULL,
            description     TEXT,
            badge_text      TEXT,
            provider        TEXT NOT NULL DEFAULT 'any',
            tokens_included BIGINT NOT NULL DEFAULT 100000,
            price_brl       NUMERIC(10,2) NOT NULL DEFAULT 0,
            price_credits   INTEGER NOT NULL DEFAULT 0,
            is_active       BOOLEAN NOT NULL DEFAULT TRUE,
            is_highlighted  BOOLEAN NOT NULL DEFAULT FALSE,
            tier            TEXT NOT NULL DEFAULT 'free',
            sort_order      INTEGER NOT NULL DEFAULT 0,
            renews_monthly  BOOLEAN NOT NULL DEFAULT TRUE,
            color           TEXT DEFAULT '#a78bfa',
            icon            TEXT DEFAULT 'zap',
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    # ── ai_token_balances ─────────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS ai_token_balances (
            id              SERIAL PRIMARY KEY,
            company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            provider        TEXT NOT NULL DEFAULT 'any',
            balance_tokens  BIGINT NOT NULL DEFAULT 0,
            total_purchased BIGINT NOT NULL DEFAULT 0,
            total_used      BIGINT NOT NULL DEFAULT 0,
            reset_at        TIMESTAMPTZ,
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(company_id, provider)
        )
    """)

    # ── ai_token_transactions ──────────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS ai_token_transactions (
            id              SERIAL PRIMARY KEY,
            company_id      INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            user_id         INTEGER REFERENCES users(id),
            provider        TEXT NOT NULL,
            model           TEXT,
            tokens_in       BIGINT NOT NULL DEFAULT 0,
            tokens_out      BIGINT NOT NULL DEFAULT 0,
            nexus_tokens_cost BIGINT NOT NULL DEFAULT 0,
            tx_type         TEXT NOT NULL DEFAULT 'usage',
            source          TEXT,
            reference_id    TEXT,
            pack_id         INTEGER REFERENCES ai_token_packs(id),
            description     TEXT,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """)

    # ── Índices ────────────────────────────────────────────────────────────────
    op.execute("CREATE INDEX IF NOT EXISTS idx_ai_tok_bal_company ON ai_token_balances(company_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_ai_tok_tx_company ON ai_token_transactions(company_id)")
    op.execute("CREATE INDEX IF NOT EXISTS idx_ai_tok_tx_created ON ai_token_transactions(created_at)")

    # ── Seed: packs padrão ────────────────────────────────────────────────────
    op.execute("""
        INSERT INTO ai_token_packs
            (name, description, badge_text, provider, tokens_included, price_brl,
             is_active, is_highlighted, tier, sort_order, renews_monthly, color, icon)
        VALUES
            ('Gemini Flash Grátis', 'Tokens Gemini Flash renováveis mensalmente — ideal para começar',
             'GRÁTIS', 'gemini', 1000000, 0, true, false, 'free', 1, true, '#4285F4', 'gift'),

            ('Ollama Local Grátis', 'Modelos locais (LLaMA, Mistral) rodando na infraestrutura NEXUS — sem custo',
             'GRÁTIS', 'ollama', 999999999, 0, true, false, 'free', 2, false, '#10b981', 'server'),

            ('Starter — 2M Tokens', 'Pacote inicial com 2 milhões de NEXUS tokens para usar em qualquer provider',
             'POPULAR', 'any', 2000000, 29.90, true, true, 'starter', 3, false, '#a78bfa', 'zap'),

            ('Pro — 10M Tokens', '10 milhões de NEXUS tokens compatíveis com GPT-4o, Claude Sonnet e mais',
             'PRO', 'any', 10000000, 99.90, true, false, 'pro', 4, false, '#f59e0b', 'rocket'),

            ('Enterprise — 50M Tokens', 'Volume máximo para times com alta demanda de IA',
             'ENTERPRISE', 'any', 50000000, 399.90, true, false, 'enterprise', 5, false, '#ef4444', 'crown')
        ON CONFLICT DO NOTHING
    """)


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS ai_token_transactions CASCADE")
    op.execute("DROP TABLE IF EXISTS ai_token_balances CASCADE")
    op.execute("DROP TABLE IF EXISTS ai_token_packs CASCADE")
