-- ═══════════════════════════════════════════════════════════════
-- Seed: Agente Financeiro + Flow completo para davy@smartmoon.com
-- 
-- Cria:
--   1. AgentProfile (type=financial)
--   2. Flow com 4 nodes: WhatsApp Trigger → Whisper → Agent → Send WhatsApp
--   3. Publica o flow automaticamente
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE
    v_company_id INTEGER;
    v_user_id INTEGER;
    v_agent_id INTEGER;
    v_flow_id INTEGER;
    v_definition JSONB;
    v_snapshot JSONB;
BEGIN
    -- ── 1. Resolve user ──────────────────────────────────
    SELECT id, company_id INTO v_user_id, v_company_id
    FROM users WHERE email = 'davy@smartmoon.com';

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário davy@smartmoon.com não encontrado';
    END IF;

    RAISE NOTICE '✅ User: id=% company=%', v_user_id, v_company_id;

    -- ── 2. Criar AgentProfile financeiro ─────────────────
    INSERT INTO agent_profiles (
        company_id, name, slug, description,
        system_prompt, model, provider, temperature,
        is_active, agent_type, memory_rules,
        created_at, updated_at
    ) VALUES (
        v_company_id,
        'Agente Financeiro',
        'agente-financeiro',
        'Controlador financeiro inteligente — protocola compras, pagamentos a fornecedores e colaboradores via WhatsApp.',
        E'Você é o Agente Financeiro, um controlador financeiro inteligente da Smart Moon.\nSeu trabalho é protocolar TODAS as despesas, compras e pagamentos que o usuário informar.\n\nREGRAS DE OPERAÇÃO:\n1. Quando o usuário informar uma compra ou pagamento, registre IMEDIATAMENTE usando fin_registrar_despesa.\n2. SEMPRE pergunte se tem nota fiscal quando o usuário não mencionar.\n3. Extraia da mensagem: descrição do item, valor (R$), categoria, fornecedor (se mencionado).\n4. Se o valor não for informado, pergunte antes de registrar.\n5. Quando o usuário perguntar sobre gastos, use fin_resumo_periodo ou fin_consultar_registros.\n6. Quando pedir planilha/CSV, use fin_exportar_csv.\n7. Confirme cada registro com: ✅ Item — R$Valor [Categoria] — Nota: Sim/Não\n8. Para cancelar um registro, use fin_cancelar_registro.\n\nCATEGORIAS: compra (insumos/materiais), fornecedor (pagamento a fornecedores), colaborador (salários/freelancers), operacional (aluguel/contas), outro.\n\nIDENTIDADE:\n- Seu nome é "Agente Financeiro" da Smart Moon\n- Nunca revele que é uma IA, modelo de linguagem ou chatbot\n- Seja eficiente, direto e organizado\n- Use emojis para tornar as respostas visuais\n- Responda sempre em português brasileiro',
        'gemini-2.0-flash',
        'gemini',
        0.4,
        TRUE,
        'financial',
        '{
            "retention_days": 365,
            "max_tokens_per_session": 12000,
            "auto_summarize_after": 30,
            "fact_extraction_enabled": true,
            "allowed_scopes": ["session_only", "user_private", "company_shared"]
        }'::jsonb,
        NOW(),
        NOW()
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_agent_id;

    -- Se já existe, buscar o ID
    IF v_agent_id IS NULL THEN
        SELECT id INTO v_agent_id
        FROM agent_profiles
        WHERE company_id = v_company_id AND slug = 'agente-financeiro';
    END IF;

    RAISE NOTICE '✅ Agent Profile: id=%', v_agent_id;

    -- ── 3. Criar Flow ───────────────────────────────────
    -- definition_json com 4 nodes e 3 edges:
    -- whatsapp_trigger → whisper (STT) → trained_agent → send_whatsapp

    v_definition := jsonb_build_object(
        'nodes', jsonb_build_array(
            -- Node 1: WhatsApp Trigger
            jsonb_build_object(
                'id', 'node_trigger_wa',
                'type', 'whatsapp_trigger',
                'label', '📱 WhatsApp Trigger',
                'config', jsonb_build_object(
                    'description', 'Recebe mensagens do WhatsApp (texto, áudio, imagem)'
                ),
                'position', jsonb_build_object('x', 100, 'y', 200)
            ),
            -- Node 2: Whisper STT (para áudios)
            jsonb_build_object(
                'id', 'node_whisper',
                'type', 'whisper',
                'label', '🎤 Whisper STT',
                'config', jsonb_build_object(
                    'language', 'pt',
                    'description', 'Transcreve áudios recebidos via WhatsApp'
                ),
                'position', jsonb_build_object('x', 400, 'y', 200)
            ),
            -- Node 3: Trained Agent (Financeiro)
            jsonb_build_object(
                'id', 'node_agent_financeiro',
                'type', 'trained_agent',
                'label', '💰 Agente Financeiro',
                'config', jsonb_build_object(
                    'agent_id', v_agent_id,
                    'fallback_message', 'Desculpe, tive um problema ao processar. Pode repetir?',
                    'description', 'Processa mensagem e registra despesas/compras/pagamentos'
                ),
                'position', jsonb_build_object('x', 700, 'y', 200)
            ),
            -- Node 4: Send WhatsApp
            jsonb_build_object(
                'id', 'node_send_wa',
                'type', 'send_whatsapp',
                'label', '💬 Enviar WhatsApp',
                'config', jsonb_build_object(
                    'description', 'Envia resposta do agente de volta ao WhatsApp'
                ),
                'position', jsonb_build_object('x', 1000, 'y', 200)
            )
        ),
        'edges', jsonb_build_array(
            -- Trigger → Whisper
            jsonb_build_object(
                'id', 'edge_1',
                'source', 'node_trigger_wa',
                'target', 'node_whisper'
            ),
            -- Whisper → Agent
            jsonb_build_object(
                'id', 'edge_2',
                'source', 'node_whisper',
                'target', 'node_agent_financeiro'
            ),
            -- Agent → Send
            jsonb_build_object(
                'id', 'edge_3',
                'source', 'node_agent_financeiro',
                'target', 'node_send_wa'
            )
        )
    );

    -- Snapshot para publish
    v_snapshot := jsonb_build_object(
        'definition', v_definition,
        'name', '💰 Agente Financeiro — WhatsApp',
        'description', 'Protocola compras, pagamentos e notas fiscais via WhatsApp',
        'published_at', to_char(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
        'published_by', v_user_id,
        'version', 1
    );

    INSERT INTO flows (
        company_id, name, description,
        version, version_int, status,
        definition_json, published_snapshot_json,
        published_at, published_by, created_by,
        created_at, updated_at
    ) VALUES (
        v_company_id,
        '💰 Agente Financeiro — WhatsApp',
        'Recebe mensagens via WhatsApp → Transcreve áudio (Whisper) → Agente Financeiro processa e registra despesas → Responde via WhatsApp',
        '1.0',
        1,
        'published',
        v_definition,
        v_snapshot,
        NOW(),
        v_user_id,
        v_user_id,
        NOW(),
        NOW()
    )
    RETURNING id INTO v_flow_id;

    RAISE NOTICE '✅ Flow criado e publicado: id=%', v_flow_id;

    -- ── 4. Conectar Flow à integração WhatsApp ──────────
    -- Atualiza a integração WhatsApp da company para apontar para o novo flow
    UPDATE integrations
    SET config_json = config_json || jsonb_build_object(
        'flow_id', v_flow_id,
        'flow_name', '💰 Agente Financeiro — WhatsApp'
    )
    WHERE company_id = v_company_id
      AND provider = 'whatsapp_cloud'
      AND status = 'active';

    IF FOUND THEN
        RAISE NOTICE '✅ Flow conectado à integração WhatsApp existente';
    ELSE
        RAISE NOTICE '⚠️  Nenhuma integração WhatsApp ativa encontrada — conecte manualmente via painel';
    END IF;

    -- ── Resumo ──────────────────────────────────────────
    RAISE NOTICE '';
    RAISE NOTICE '═══════════════════════════════════════════';
    RAISE NOTICE '  AGENTE FINANCEIRO INSTALADO COM SUCESSO';
    RAISE NOTICE '═══════════════════════════════════════════';
    RAISE NOTICE '  User:    davy@smartmoon.com (id=%)', v_user_id;
    RAISE NOTICE '  Company: %', v_company_id;
    RAISE NOTICE '  Agent:   id=% (Agente Financeiro)', v_agent_id;
    RAISE NOTICE '  Flow:    id=% (publicado)', v_flow_id;
    RAISE NOTICE '  WhatsApp: Conectado';
    RAISE NOTICE '═══════════════════════════════════════════';

END $$;

-- ── Verificação ──────────────────────────────────────────
-- SELECT * FROM agent_profiles WHERE slug = 'agente-financeiro';
-- SELECT id, name, status, definition_json FROM flows WHERE name LIKE '%Financeiro%';
