CREATE TABLE IF NOT EXISTS plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    description TEXT DEFAULT '',
    price DECIMAL(10,2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'BRL',
    billing_cycle VARCHAR(20) DEFAULT 'monthly',
    duration_days INT DEFAULT 30,
    max_flows INT DEFAULT 5,
    max_agents INT DEFAULT 2,
    max_skills INT DEFAULT 3,
    max_integrations INT DEFAULT 2,
    max_voice_profiles INT DEFAULT 0,
    max_campaigns INT DEFAULT 0,
    modules JSONB DEFAULT '[]'::jsonb,
    free_skills JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,
    sort_order INT DEFAULT 0,
    color VARCHAR(7) DEFAULT '#6366f1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO plans (name, display_name, description, price, billing_cycle, duration_days, max_flows, max_agents, max_skills, max_integrations, max_voice_profiles, max_campaigns, modules, is_active, is_featured, sort_order, color) VALUES
('free', 'Free', 'Plano gratuito para explorar a plataforma', 0, 'monthly', 30, 3, 1, 2, 1, 0, 0, '["agentes","skills","flows"]'::jsonb, true, false, 1, '#64748b'),
('starter', 'Starter', 'Ideal para empreendedores iniciantes', 97, 'monthly', 30, 10, 3, 5, 3, 1, 1, '["agentes","skills","flows","integracoes","voz"]'::jsonb, true, false, 2, '#3b82f6'),
('pro', 'Pro', 'Para empresas em crescimento com necessidades avancadas', 197, 'monthly', 30, 30, 10, 15, 8, 3, 5, '["agentes","skills","agent_store","flows","integracoes","voz","clonagem_voz","marketing"]'::jsonb, true, true, 3, '#6366f1'),
('business', 'Business', 'Solucao completa para operacoes empresariais', 497, 'monthly', 30, 100, 30, 50, 20, 10, 20, '["agentes","skills","agent_store","flows","integracoes","voz","clonagem_voz","voice_agents","marketing","campanhas_ia"]'::jsonb, true, false, 4, '#ec4899'),
('enterprise', 'Enterprise', 'Plano ilimitado com suporte dedicado e personalizacao total', 997, 'monthly', 30, -1, -1, -1, -1, -1, -1, '["agentes","skills","agent_store","flows","integracoes","voz","clonagem_voz","voice_agents","marketing","campanhas_ia","licitacao"]'::jsonb, true, false, 5, '#f59e0b')
ON CONFLICT (name) DO NOTHING;
