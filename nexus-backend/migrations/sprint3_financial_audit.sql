-- TASK 3.1: Criar tabela financial_audit_log
-- Log imutável de todas as operações financeiras.
-- Executar na VPS antes de deploy da Sprint 3.

CREATE TABLE IF NOT EXISTS financial_audit_log (
    id            SERIAL PRIMARY KEY,
    company_id    INT NOT NULL,
    entity_type   VARCHAR(30) NOT NULL,    -- 'withdrawal' | 'charge' | 'wallet' | 'limits'
    entity_id     INT NOT NULL,
    action        VARCHAR(50) NOT NULL,    -- 'credit' | 'debit' | 'hold' | 'release' | 'requested' | etc.
    performed_by  INT,                     -- user_id (NULL = sistema)
    ip_address    VARCHAR(45),
    user_agent    TEXT,
    old_values    JSONB,
    new_values    JSONB,
    created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ix_fal_company   ON financial_audit_log(company_id, created_at DESC);
CREATE INDEX ix_fal_entity    ON financial_audit_log(entity_type, entity_id);
CREATE INDEX ix_fal_action    ON financial_audit_log(action, created_at DESC);

COMMENT ON TABLE financial_audit_log IS 'Log imutável de operações financeiras (TASK 3.1)';
