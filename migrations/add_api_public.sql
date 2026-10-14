-- ================================================================
-- Migration: SmartMoon API Pública
-- Executar em produção antes de ativar ENABLE_PUBLIC_API=true
-- ================================================================

-- 1. Coluna na tabela integrations
ALTER TABLE integrations
ADD COLUMN IF NOT EXISTS external_webhook_url VARCHAR(500);

COMMENT ON COLUMN integrations.external_webhook_url IS
'URL do sistema externo que receberá mensagens via API Pública SmartMoon';

-- 2. Tabela de API Keys
CREATE TABLE IF NOT EXISTS api_keys (
    id               SERIAL PRIMARY KEY,
    company_id       INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    name             VARCHAR(100) NOT NULL,
    key_prefix       VARCHAR(16) NOT NULL,
    key_hash         VARCHAR(64) NOT NULL UNIQUE,
    scopes           JSONB DEFAULT '["send","receive","instances"]',
    rate_limit_rpm   INTEGER DEFAULT 60,
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    last_used_at     TIMESTAMPTZ,
    expires_at       TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela de logs de uso
CREATE TABLE IF NOT EXISTS api_usage_logs (
    id          SERIAL PRIMARY KEY,
    api_key_id  INTEGER REFERENCES api_keys(id) ON DELETE SET NULL,
    company_id  INTEGER NOT NULL,
    endpoint    VARCHAR(100),
    method      VARCHAR(10),
    instance_id VARCHAR(100),
    status_code INTEGER,
    msgs_sent   INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Índices
CREATE INDEX IF NOT EXISTS ix_api_keys_company ON api_keys(company_id);
CREATE INDEX IF NOT EXISTS ix_api_keys_active ON api_keys(company_id, is_active);
CREATE INDEX IF NOT EXISTS ix_api_usage_company ON api_usage_logs(company_id, created_at);

-- Índice funcional JSONB no webhook (performance lookup por instance_id)
CREATE INDEX IF NOT EXISTS ix_integrations_instance_id
ON integrations ((config_json->>'instance_id'))
WHERE provider = 'smartmoon';

SELECT 'Migration concluída com sucesso!' AS status;
