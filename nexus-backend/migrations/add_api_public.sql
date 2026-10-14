-- ============================================================
-- SmartMoon Public API — Migration
-- SEGURA: só adiciona tabelas e colunas, nunca altera existentes
-- ============================================================

-- Tabela de API Keys por empresa
CREATE TABLE IF NOT EXISTS api_keys (
    id             SERIAL PRIMARY KEY,
    company_id     INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name           VARCHAR(100) NOT NULL,
    key_prefix     VARCHAR(16) NOT NULL,         -- "sm_abc12345" — exibição na UI
    key_hash       VARCHAR(64) NOT NULL UNIQUE,  -- SHA-256 (nunca guardamos a chave real)
    scopes         JSONB DEFAULT '["send","receive","instances"]',
    rate_limit_rpm INTEGER DEFAULT 60,
    is_active      BOOLEAN DEFAULT TRUE,
    last_used_at   TIMESTAMPTZ,
    expires_at     TIMESTAMPTZ,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_api_keys_company ON api_keys(company_id);
CREATE INDEX IF NOT EXISTS ix_api_keys_hash    ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS ix_api_keys_active  ON api_keys(company_id, is_active);

-- Log de uso para billing e auditoria
CREATE TABLE IF NOT EXISTS api_usage_logs (
    id          BIGSERIAL PRIMARY KEY,
    api_key_id  INTEGER REFERENCES api_keys(id) ON DELETE SET NULL,
    company_id  INTEGER NOT NULL,
    endpoint    VARCHAR(100),
    method      VARCHAR(10),
    instance_id VARCHAR(100),
    status_code INTEGER,
    msgs_sent   INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_api_usage_company ON api_usage_logs(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_api_usage_key     ON api_usage_logs(api_key_id, created_at DESC);

-- Coluna para webhook externo nas integracoes SmartMoon
ALTER TABLE integrations
    ADD COLUMN IF NOT EXISTS external_webhook_url VARCHAR(500);

-- Índice crítico: evita full scan a cada mensagem recebida
-- CONCURRENTLY = não trava a tabela durante criação
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_integrations_sm_instance
    ON integrations ((config_json->>'instance_id'))
    WHERE provider = 'smartmoon';
