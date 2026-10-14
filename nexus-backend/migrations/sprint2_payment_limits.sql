-- TASK 2.1: Criar tabela company_payment_limits
-- Armazena limites de segurança configuráveis por empresa.
-- Empresas sem registro usam defaults do código Python.
-- Executar este SQL na VPS antes de deploy da Sprint 2.

CREATE TABLE IF NOT EXISTS company_payment_limits (
    company_id              INT PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
    max_pending_withdrawals INT            NOT NULL DEFAULT 3,
    daily_withdrawal_limit  NUMERIC(12,2)  NOT NULL DEFAULT 50000.00,
    single_withdrawal_limit NUMERIC(12,2)  NOT NULL DEFAULT 10000.00,
    min_charge_amount       NUMERIC(12,2)  NOT NULL DEFAULT 1.00,
    max_charge_amount       NUMERIC(12,2)  NOT NULL DEFAULT 100000.00,
    pix_key_cooldown_hours  INT            NOT NULL DEFAULT 24,
    require_2fa_above       NUMERIC(12,2)  NOT NULL DEFAULT 500.00,
    updated_at              TIMESTAMPTZ    DEFAULT now()
);

-- Trigger para auto-update de updated_at
CREATE OR REPLACE FUNCTION update_company_payment_limits_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_company_payment_limits_updated
    BEFORE UPDATE ON company_payment_limits
    FOR EACH ROW
    EXECUTE FUNCTION update_company_payment_limits_timestamp();

COMMENT ON TABLE company_payment_limits IS 'Limites anti-fraude por empresa (TASK 2.1)';
