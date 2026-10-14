-- Luna Knowledge Base — Tours para todos os módulos + novos itens
-- Executar via: docker exec -i nexus_postgres psql -U nexus -d nexus_db < /tmp/luna_seed.sql

-- ═══ Atualizar tours existentes ═══

UPDATE luna_knowledge SET tour_config = '{"steps":[{"selector":"[data-tour=''wallet-hero'']","action":"highlight","wait_for_click":false,"label":"Sua Carteira Digital"},{"selector":"[data-tour=''quick-actions'']","action":"ghost_cursor","wait_for_click":true,"label":"PIX, Cobrar, Sacar"}]}' WHERE id = 1;

UPDATE luna_knowledge SET tour_config = '{"steps":[{"selector":"[data-tour=''quick-actions'']","action":"ghost_cursor","wait_for_click":true,"label":"Clique em PIX Rapido"}]}' WHERE id = 2;

UPDATE luna_knowledge SET tour_config = '{"steps":[{"selector":"[data-tour=''quick-actions'']","action":"ghost_cursor","wait_for_click":true,"label":"Clique em Sacar"}]}' WHERE id = 3;

UPDATE luna_knowledge SET tour_config = '{"steps":[{"selector":"[data-tour=''wallet-card'']","action":"highlight","wait_for_click":false,"label":"Saldo de Creditos SM"}]}' WHERE id = 4;

UPDATE luna_knowledge SET tour_config = '{"steps":[{"selector":"[data-tour=''publish-btn'']","action":"ghost_cursor","wait_for_click":false,"label":"Publicar seu Fluxo"}]}' WHERE id = 5;

UPDATE luna_knowledge SET tour_config = '{"steps":[{"selector":"[data-tour=''create-agent-btn'']","action":"ghost_cursor","wait_for_click":true,"label":"Criar novo Agente"},{"selector":"[data-tour=''agent-list'']","action":"highlight","wait_for_click":false,"label":"Seus agentes"}]}' WHERE id = 6;

-- ═══ Novos itens ═══

INSERT INTO luna_knowledge (category, question, answer, sort_order, is_active, tour_config) VALUES
('chat', 'Como usar o Chat IA?', 'O Chat IA permite conversar com multiplos provedores de inteligencia artificial. Voce pode alternar entre OpenAI, Gemini, Claude, Groq e outros. Cada conversa fica salva em threads separadas. Use o seletor de modelo no topo para escolher o provedor e modelo desejado.', 1, true, '{"steps":[{"selector":"[data-tour=''model-selector'']","action":"ghost_cursor","wait_for_click":true,"label":"Selecione o provedor de IA"},{"selector":"[data-tour=''chat-input'']","action":"ghost_cursor","wait_for_click":true,"label":"Digite sua mensagem aqui"},{"selector":"[data-tour=''chat-history'']","action":"highlight","wait_for_click":false,"label":"Historico de conversas"}]}');

INSERT INTO luna_knowledge (category, question, answer, sort_order, is_active, tour_config) VALUES
('chat', 'O que sao Threads?', 'Threads sao conversas separadas. Cada thread mantem seu proprio contexto e historico. Voce pode criar varias threads para organizar assuntos diferentes.', 2, true, '{"steps":[{"selector":"[data-tour=''chat-history'']","action":"ghost_cursor","wait_for_click":true,"label":"Suas threads ficam aqui"}]}');

INSERT INTO luna_knowledge (category, question, answer, sort_order, is_active, tour_config) VALUES
('integrations', 'Como conectar o WhatsApp?', 'Para integrar o WhatsApp, va ate Integracoes e clique em Nova Instancia. Insira o ID da instancia Z-API, o token e o client-token. Apos conectar, escaneie o QR Code para vincular seu numero.', 1, true, '{"steps":[{"selector":"[data-tour=''add-instance-btn'']","action":"ghost_cursor","wait_for_click":true,"label":"Adicionar nova instancia"},{"selector":"[data-tour=''instance-list'']","action":"highlight","wait_for_click":false,"label":"Instancias conectadas"}]}');

INSERT INTO luna_knowledge (category, question, answer, sort_order, is_active, tour_config) VALUES
('integrations', 'Como conectar o Telegram?', 'Para integrar o Telegram, crie um bot via @BotFather, copie o token gerado e cole em Integracoes, aba Telegram. O bot comecara a receber mensagens automaticamente.', 2, true, '{"steps":[{"selector":"[data-tour=''integration-cards'']","action":"ghost_cursor","wait_for_click":true,"label":"Encontre a aba Telegram"}]}');

INSERT INTO luna_knowledge (category, question, answer, sort_order, is_active, tour_config) VALUES
('marketing', 'O que e o Marketing Studio?', 'O Marketing Studio e onde voce cria conteudo para redes sociais com IA. Gere posts, legendas, hashtags e imagens profissionais em segundos. A IA usa seu Brand Kit para manter a identidade visual consistente.', 1, true, NULL);

INSERT INTO luna_knowledge (category, question, answer, sort_order, is_active, tour_config) VALUES
('marketing', 'O que e o Brand Kit?', 'O Brand Kit e a identidade visual da sua marca dentro da plataforma. Defina cores, fontes, logo e tom de voz. A IA usa essas informacoes para gerar conteudo alinhado com a sua marca.', 2, true, NULL);

INSERT INTO luna_knowledge (category, question, answer, sort_order, is_active, tour_config) VALUES
('geral', 'Como funciona a Luna?', 'Eu sou a Luna, sua assistente inteligente! Estou aqui para te guiar por todos os modulos da plataforma. Clique nas perguntas frequentes para ver explicacoes, ou use os tours interativos para que eu te mostre exatamente onde clicar.', 1, true, NULL);

INSERT INTO luna_knowledge (category, question, answer, sort_order, is_active, tour_config) VALUES
('geral', 'O que sao os Tours Interativos?', 'Os Tours Interativos sao guias visuais onde eu aponto exatamente para os botoes e elementos que voce precisa usar. Quando uma pergunta tem o badge Tour, significa que ao clicar nela, um cursor vermelho aparece na tela mostrando onde clicar.', 2, true, NULL);
