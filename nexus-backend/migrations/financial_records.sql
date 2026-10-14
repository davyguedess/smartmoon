-- ═══════════════════════════════════════════════════════════════
-- Financial Records — Migration
-- Tabela de registros financeiros para o Agente Financeiro
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS financial_records (
    id              SERIAL PRIMARY KEY,
    company_id      INTEGER NOT NULL REFERENCES companies(id),
    agent_id        INTEGER REFERENCES agent_profiles(id),
    session_id      VARCHAR(100),
    recorded_by_phone VARCHAR(30),

    -- Dados do registro
    record_date     DATE NOT NULL DEFAULT CURRENT_DATE,
    record_time     VARCHAR(8),
    description     TEXT NOT NULL,
    amount          NUMERIC(12, 2),
    category        VARCHAR(50) NOT NULL DEFAULT 'compra',
    supplier_name   VARCHAR(300),
    payment_method  VARCHAR(50),

    -- Nota fiscal
    has_invoice     BOOLEAN NOT NULL DEFAULT FALSE,
    invoice_pending BOOLEAN NOT NULL DEFAULT FALSE,
    invoice_image_url VARCHAR(500),
    invoice_number  VARCHAR(100),

    -- Metadados
    input_type      VARCHAR(20) DEFAULT 'text',
    raw_message     TEXT,
    status          VARCHAR(20) DEFAULT 'confirmed',
    notes           TEXT,
    tags            JSONB DEFAULT '[]'::jsonb,

    -- Timestamps
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para consultas rápidas
CREATE INDEX IF NOT EXISTS ix_financial_company_date
    ON financial_records(company_id, record_date);

CREATE INDEX IF NOT EXISTS ix_financial_company_category
    ON financial_records(company_id, category);

CREATE INDEX IF NOT EXISTS ix_financial_company_status
    ON financial_records(company_id, status);

-- Comentários
COMMENT ON TABLE financial_records IS 'Registros financeiros protocolados pelo Agente Financeiro via WhatsApp';
COMMENT ON COLUMN financial_records.category IS 'compra|fornecedor|colaborador|operacional|outro';
COMMENT ON COLUMN financial_records.input_type IS 'text|audio|image — como a informação chegou';
COMMENT ON COLUMN financial_records.status IS 'confirmed|cancelled|pending';
