-- TASK 5.1: Criar tabela gateway_api_keys
-- Chaves de API para acesso ao Open Gateway (API pública).
-- Cada empresa pode ter múltiplas chaves (live/test).

CREATE TABLE IF NOT EXISTS gateway_api_keys (
    id              SERIAL PRIMARY KEY,
    company_id      INT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    key_hash        VARCHAR(128) NOT NULL UNIQUE,   -- SHA-256 da chave (nunca armazena raw)
    key_prefix      VARCHAR(12)  NOT NULL,           -- ex: "nxs_live_abc" para identificação
    label           VARCHAR(200) NOT NULL DEFAULT 'Default',
    environment     VARCHAR(10)  NOT NULL DEFAULT 'live' CHECK (environment IN ('live', 'test')),
    is_active       BOOLEAN      NOT NULL DEFAULT true,
    permissions     JSONB        NOT NULL DEFAULT '["charges.create","charges.read","balance.read"]',
    rate_limit_rpm  INT          NOT NULL DEFAULT 60,   -- requests per minute
    last_used_at    TIMESTAMPTZ,
    ip_whitelist    JSONB        DEFAULT '[]',           -- lista de IPs permitidos (vazio = todos)
    created_at      TIMESTAMPTZ  DEFAULT now(),
    expires_at      TIMESTAMPTZ                          -- NULL = nunca expira
);

CREATE INDEX ix_gak_company   ON gateway_api_keys(company_id);
CREATE INDEX ix_gak_prefix    ON gateway_api_keys(key_prefix);
CREATE INDEX ix_gak_active    ON gateway_api_keys(is_active, environment);

COMMENT ON TABLE gateway_api_keys IS 'API Keys do Open Gateway para clientes externos (TASK 5.1)';
