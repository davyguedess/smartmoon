-- Insert Agent Profile
INSERT INTO agent_profiles (
    company_id, name, slug, description,
    system_prompt, model, provider, temperature,
    is_active, agent_type, memory_rules,
    created_at, updated_at
) VALUES (
    17,
    'Agente Financeiro',
    'agente-financeiro',
    'Controlador financeiro inteligente via WhatsApp.',
    'Voce e o Agente Financeiro da Smart Moon. Protocole TODAS as despesas usando fin_registrar_despesa. Sempre pergunte pela nota fiscal. Extraia descricao, valor, categoria e fornecedor. Use fin_resumo_periodo para consultas e fin_exportar_csv para planilhas. Confirme registros com emoji. Categorias: compra, fornecedor, colaborador, operacional, outro.',
    'gemini-2.0-flash',
    'gemini',
    0.4,
    TRUE,
    'financial',
    '{"retention_days": 365, "max_tokens_per_session": 12000, "fact_extraction_enabled": true}'::jsonb,
    NOW(),
    NOW()
);

-- Get the agent_id and create flow
INSERT INTO flows (
    company_id, name, description, version, version_int, status,
    definition_json, published_snapshot_json,
    published_at, published_by, created_by, created_at, updated_at
)
SELECT
    17,
    'Agente Financeiro - WhatsApp',
    'WhatsApp > Whisper > Agente Financeiro > Resposta',
    '1.0', 1, 'published',
    jsonb_build_object(
        'nodes', jsonb_build_array(
            jsonb_build_object('id', 'node_trigger', 'type', 'whatsapp_trigger', 'label', 'WhatsApp Trigger', 'config', '{}'::jsonb, 'position', jsonb_build_object('x', 100, 'y', 200)),
            jsonb_build_object('id', 'node_whisper', 'type', 'whisper', 'label', 'Whisper STT', 'config', jsonb_build_object('language', 'pt'), 'position', jsonb_build_object('x', 400, 'y', 200)),
            jsonb_build_object('id', 'node_agent', 'type', 'trained_agent', 'label', 'Agente Financeiro', 'config', jsonb_build_object('agent_id', ap.id), 'position', jsonb_build_object('x', 700, 'y', 200)),
            jsonb_build_object('id', 'node_send', 'type', 'send_whatsapp', 'label', 'Enviar WhatsApp', 'config', '{}'::jsonb, 'position', jsonb_build_object('x', 1000, 'y', 200))
        ),
        'edges', jsonb_build_array(
            jsonb_build_object('id', 'e1', 'source', 'node_trigger', 'target', 'node_whisper'),
            jsonb_build_object('id', 'e2', 'source', 'node_whisper', 'target', 'node_agent'),
            jsonb_build_object('id', 'e3', 'source', 'node_agent', 'target', 'node_send')
        )
    ),
    jsonb_build_object('name', 'Agente Financeiro WhatsApp', 'version', 1),
    NOW(), 17, 17, NOW(), NOW()
FROM agent_profiles ap
WHERE ap.company_id = 17 AND ap.slug = 'agente-financeiro'
LIMIT 1;

-- Connect flow to WhatsApp integration
UPDATE integrations
SET config_json = config_json || jsonb_build_object(
    'flow_id', (SELECT id FROM flows WHERE company_id = 17 AND name = 'Agente Financeiro - WhatsApp' LIMIT 1),
    'flow_name', 'Agente Financeiro'
)
WHERE company_id = 17 AND provider = 'smartmoon' AND status = 'connected';

-- Verify
SELECT 'AGENT' as tipo, id, name FROM agent_profiles WHERE company_id = 17
UNION ALL
SELECT 'FLOW', id, name FROM flows WHERE company_id = 17;
