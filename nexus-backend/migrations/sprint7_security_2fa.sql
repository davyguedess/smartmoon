-- SPRINT 7: Segurança Avançada — 2FA TOTP
-- Adiciona campos 2FA no User model

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS totp_secret       VARCHAR(64)  DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS totp_enabled       BOOLEAN      NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS totp_verified_at   TIMESTAMPTZ  DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS totp_backup_codes  JSONB        DEFAULT '[]';

-- Tabela de sessões seguras (para invalidação granular)
CREATE TABLE IF NOT EXISTS secure_sessions (
    id              SERIAL PRIMARY KEY,
    user_id         INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_hash    VARCHAR(128) NOT NULL UNIQUE,
    ip_address      VARCHAR(45),
    user_agent      TEXT,
    created_at      TIMESTAMPTZ DEFAULT now(),
    last_active     TIMESTAMPTZ DEFAULT now(),
    is_active       BOOLEAN NOT NULL DEFAULT true
);

CREATE INDEX ix_ss_user     ON secure_sessions(user_id, is_active);
CREATE INDEX ix_ss_hash     ON secure_sessions(session_hash);

-- Tabela de security events (audit de segurança separado)
CREATE TABLE IF NOT EXISTS security_events (
    id              SERIAL PRIMARY KEY,
    user_id         INT REFERENCES users(id) ON DELETE SET NULL,
    event_type      VARCHAR(50) NOT NULL,  -- login_success, login_failed, 2fa_setup, 2fa_verified, suspicious_activity
    ip_address      VARCHAR(45),
    user_agent      TEXT,
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX ix_se_user     ON security_events(user_id);
CREATE INDEX ix_se_type     ON security_events(event_type);
CREATE INDEX ix_se_created  ON security_events(created_at);

COMMENT ON TABLE secure_sessions IS 'Sessões seguras com tracking de IP/UA (SPRINT 7)';
COMMENT ON TABLE security_events IS 'Audit log de eventos de segurança (SPRINT 7)';
