"""
add_payment_gateway_tables — v3 (each statement separate)

Revision ID: p1_payment_gateway
Revises: 205a15533059
Create Date: 2026-04-06
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "p1_payment_gateway"
down_revision: Union[str, None] = "205a15533059"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _exec(sql: str) -> None:
    op.execute(sa.text(sql))


def upgrade() -> None:
    # ── Enums (idempotent via DO block — single statement) ────────────────────
    _exec("""
        DO $$ BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'charge_status_enum') THEN
                CREATE TYPE charge_status_enum AS ENUM (
                    'draft','pending','sent','waiting_payment',
                    'paid','expired','cancelled','failed','refunded'
                );
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'wallet_tx_type_enum') THEN
                CREATE TYPE wallet_tx_type_enum AS ENUM (
                    'credit','debit','hold','release','refund','fee','adjustment'
                );
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'withdrawal_status_enum') THEN
                CREATE TYPE withdrawal_status_enum AS ENUM (
                    'pending','under_review','approved','processing',
                    'completed','rejected','cancelled','failed'
                );
            END IF;
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'pix_key_type_enum') THEN
                CREATE TYPE pix_key_type_enum AS ENUM (
                    'cpf','cnpj','email','phone','random'
                );
            END IF;
        END $$
    """)

    # ── payment_clients ────────────────────────────────────────────────────────
    _exec("""
        CREATE TABLE IF NOT EXISTS payment_clients (
            id          SERIAL PRIMARY KEY,
            company_id  INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
            name        VARCHAR(200) NOT NULL,
            email       VARCHAR(200),
            phone       VARCHAR(30),
            document    VARCHAR(20),
            notes       TEXT,
            metadata    JSONB DEFAULT '{}',
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    _exec("CREATE INDEX IF NOT EXISTS ix_payment_clients_company ON payment_clients(company_id)")
    _exec("CREATE INDEX IF NOT EXISTS ix_payment_clients_phone   ON payment_clients(company_id, phone)")
    _exec("CREATE INDEX IF NOT EXISTS ix_payment_clients_email   ON payment_clients(company_id, email)")

    # ── payment_charges ────────────────────────────────────────────────────────
    _exec("""
        CREATE TABLE IF NOT EXISTS payment_charges (
            id                    SERIAL PRIMARY KEY,
            company_id            INTEGER NOT NULL REFERENCES companies(id),
            client_id             INTEGER REFERENCES payment_clients(id),
            created_by_user_id    INTEGER REFERENCES users(id),
            created_by_agent_id   INTEGER,
            external_provider     VARCHAR(30) NOT NULL DEFAULT 'mercadopago',
            external_payment_id   VARCHAR(100),
            external_reference    VARCHAR(100),
            amount                NUMERIC(12,2) NOT NULL,
            description           TEXT,
            due_date              DATE,
            expires_at            TIMESTAMPTZ,
            status                charge_status_enum NOT NULL DEFAULT 'draft',
            pix_qr_code           TEXT,
            pix_copy_paste_code   TEXT,
            payment_link          VARCHAR(500),
            sent_via              VARCHAR(30),
            sent_at               TIMESTAMPTZ,
            paid_at               TIMESTAMPTZ,
            cancelled_at          TIMESTAMPTZ,
            metadata              JSONB DEFAULT '{}',
            webhook_payload_last  JSONB,
            created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    _exec("ALTER TABLE payment_charges ADD CONSTRAINT uq_charges_external_ref UNIQUE (external_reference)")
    _exec("CREATE INDEX IF NOT EXISTS ix_charges_company ON payment_charges(company_id)")
    _exec("CREATE INDEX IF NOT EXISTS ix_charges_status  ON payment_charges(company_id, status)")
    _exec("CREATE INDEX IF NOT EXISTS ix_charges_ext_ref ON payment_charges(external_reference)")
    _exec("CREATE INDEX IF NOT EXISTS ix_charges_ext_id  ON payment_charges(external_payment_id)")
    _exec("CREATE INDEX IF NOT EXISTS ix_charges_created ON payment_charges(company_id, created_at)")

    # ── wallets ────────────────────────────────────────────────────────────────
    _exec("""
        CREATE TABLE IF NOT EXISTS wallets (
            id              SERIAL PRIMARY KEY,
            company_id      INTEGER NOT NULL REFERENCES companies(id),
            balance         NUMERIC(12,2) NOT NULL DEFAULT 0,
            total_received  NUMERIC(12,2) NOT NULL DEFAULT 0,
            total_withdrawn NUMERIC(12,2) NOT NULL DEFAULT 0,
            currency        VARCHAR(3) NOT NULL DEFAULT 'BRL',
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_wallets_company UNIQUE (company_id)
        )
    """)
    _exec("CREATE UNIQUE INDEX IF NOT EXISTS ix_wallets_company ON wallets(company_id)")

    # ── wallet_transactions ────────────────────────────────────────────────────
    _exec("""
        CREATE TABLE IF NOT EXISTS wallet_transactions (
            id                  SERIAL PRIMARY KEY,
            company_id          INTEGER NOT NULL REFERENCES companies(id),
            wallet_id           INTEGER NOT NULL REFERENCES wallets(id),
            charge_id           INTEGER REFERENCES payment_charges(id),
            withdrawal_id       INTEGER,
            type                wallet_tx_type_enum NOT NULL,
            amount              NUMERIC(12,2) NOT NULL,
            balance_after       NUMERIC(12,2) NOT NULL,
            description         TEXT,
            reference           VARCHAR(100),
            source              VARCHAR(30),
            created_by_system   BOOLEAN NOT NULL DEFAULT true,
            created_by_user_id  INTEGER REFERENCES users(id),
            created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    _exec("CREATE INDEX IF NOT EXISTS ix_wallet_tx_company ON wallet_transactions(company_id, created_at)")
    _exec("CREATE INDEX IF NOT EXISTS ix_wallet_tx_wallet  ON wallet_transactions(wallet_id, created_at)")
    _exec("CREATE INDEX IF NOT EXISTS ix_wallet_tx_charge  ON wallet_transactions(charge_id)")

    # ── withdrawal_requests ────────────────────────────────────────────────────
    _exec("""
        CREATE TABLE IF NOT EXISTS withdrawal_requests (
            id                    SERIAL PRIMARY KEY,
            company_id            INTEGER NOT NULL REFERENCES companies(id),
            wallet_id             INTEGER NOT NULL REFERENCES wallets(id),
            requested_by_user_id  INTEGER REFERENCES users(id),
            amount                NUMERIC(12,2) NOT NULL,
            status                withdrawal_status_enum NOT NULL DEFAULT 'pending',
            pix_key               VARCHAR(200) NOT NULL,
            pix_key_type          pix_key_type_enum NOT NULL,
            mp_transfer_id        VARCHAR(100),
            mp_transfer_status    VARCHAR(50),
            mp_idempotency_key    VARCHAR(100),
            reviewed_by_user_id   INTEGER REFERENCES users(id),
            reviewed_at           TIMESTAMPTZ,
            rejection_reason      TEXT,
            admin_notes           TEXT,
            processed_at          TIMESTAMPTZ,
            metadata              JSONB DEFAULT '{}',
            created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_withdrawal_idempotency UNIQUE (mp_idempotency_key)
        )
    """)
    _exec("CREATE INDEX IF NOT EXISTS ix_withdrawals_company ON withdrawal_requests(company_id)")
    _exec("CREATE INDEX IF NOT EXISTS ix_withdrawals_status  ON withdrawal_requests(status)")

    # ── payment_webhook_events ─────────────────────────────────────────────────
    _exec("""
        CREATE TABLE IF NOT EXISTS payment_webhook_events (
            id                SERIAL PRIMARY KEY,
            provider          VARCHAR(30) NOT NULL,
            provider_event_id VARCHAR(200) NOT NULL,
            event_type        VARCHAR(50),
            charge_id         INTEGER REFERENCES payment_charges(id),
            raw_payload       JSONB NOT NULL,
            processed         BOOLEAN NOT NULL DEFAULT false,
            processed_at      TIMESTAMPTZ,
            processing_error  TEXT,
            created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_payment_webhook_event UNIQUE (provider, provider_event_id)
        )
    """)
    _exec("CREATE INDEX IF NOT EXISTS ix_pwe_provider ON payment_webhook_events(provider, processed)")

    # ── deposit_records ────────────────────────────────────────────────────────
    _exec("""
        CREATE TABLE IF NOT EXISTS deposit_records (
            id                  SERIAL PRIMARY KEY,
            company_id          INTEGER NOT NULL REFERENCES companies(id),
            wallet_id           INTEGER NOT NULL REFERENCES wallets(id),
            charge_id           INTEGER REFERENCES payment_charges(id),
            amount              NUMERIC(12,2) NOT NULL,
            source              VARCHAR(30) NOT NULL,
            provider            VARCHAR(30),
            provider_payment_id VARCHAR(100),
            description         TEXT,
            created_by          INTEGER REFERENCES users(id),
            created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    _exec("CREATE INDEX IF NOT EXISTS ix_deposit_records_company ON deposit_records(company_id, created_at)")


def downgrade() -> None:
    for tbl in [
        "deposit_records", "payment_webhook_events", "withdrawal_requests",
        "wallet_transactions", "wallets", "payment_charges", "payment_clients",
    ]:
        _exec(f"DROP TABLE IF EXISTS {tbl} CASCADE")
