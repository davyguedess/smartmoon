-- Limpar FAQs antigos de integrations (manter IDs 15, 16 que atualizamos)
DELETE FROM luna_knowledge WHERE category = 'integrations' AND id NOT IN (15, 16);

-- Atualizar sort_order dos existentes
UPDATE luna_knowledge SET sort_order = 2 WHERE id = 15;
UPDATE luna_knowledge SET sort_order = 3 WHERE id = 16;

-- ══════════════════════════════════════════════════════════
-- VISAO GERAL
-- ══════════════════════════════════════════════════════════

INSERT INTO luna_knowledge (category, question, answer, tour_config, is_active, sort_order) VALUES
('integrations', 'O que e a pagina de Integracoes?',
 'A pagina de Integracoes e o centro de controle de todas as conexoes externas da plataforma SmartMoon. Ela esta dividida em 6 secoes: Mensageria para WhatsApp e Telegram, Google Cloud para Gmail e Calendar, Provedores de IA como GPT-4 e Gemini, Voz e Audio para text-to-speech, Midia e Trafego para Meta Ads, e Memoria e Armazenamento para Notion, Drive e mais. Cada empresa tem suas proprias credenciais isoladas e seguras. Use as abas Catalogo para configurar e Conexoes Ativas para monitorar.',
 '{"steps": [{"selector": "[data-tour=''integration-tabs'']", "label": "Use as abas para alternar entre Catalogo e Conexoes Ativas", "action": "ghost_cursor"}, {"selector": "[data-tour=''integration-cards'']", "label": "Todas as integracoes organizadas por categoria", "action": "highlight"}]}',
 true, 0),

-- ══════════════════════════════════════════════════════════
-- MENSAGERIA
-- ══════════════════════════════════════════════════════════

('integrations', 'O que e o WhatsApp SmartMoon?',
 'O WhatsApp Direto SmartMoon e nosso motor de WhatsApp proprio. Diferente de APIs terceiras, ele nao cobra taxas por numero e inclui anti-ban inteligente. Voce pode criar multiplas instancias, cada uma com seu proprio numero. Basta escanear o QR Code e vincular um fluxo. Exemplo de uso: crie um bot de atendimento que responde perguntas frequentes, envia boletos PIX automaticamente, ou transfere para um atendente humano quando necessario.',
 '{"steps": [{"selector": "[data-tour=''section-messaging'']", "label": "Secao Mensageria - canais de comunicacao", "action": "ghost_cursor"}, {"selector": "[data-tour=''add-instance-btn'']", "label": "Clique aqui para criar uma nova instancia WhatsApp", "action": "ghost_cursor"}]}',
 true, 2),

('integrations', 'O que e o Telegram Bot?',
 'O Telegram Bot permite criar e gerenciar multiplos bots no Telegram, cada um com seu proprio fluxo independente. Voce cria o bot pelo @BotFather no Telegram, copia o token, e registra aqui. Exemplo de uso: um bot para suporte tecnico que responde duvidas com IA, um bot de notificacoes que avisa sobre novos pedidos, ou um bot de vendas que envia catalogo de produtos com precos atualizados automaticamente.',
 '{"steps": [{"selector": "[data-tour=''section-messaging'']", "label": "Secao Mensageria - seus bots e canais", "action": "ghost_cursor"}]}',
 true, 3),

-- ══════════════════════════════════════════════════════════
-- GOOGLE CLOUD
-- ══════════════════════════════════════════════════════════

('integrations', 'O que e o Google OAuth2?',
 'O Google OAuth2 e a porta de entrada para todos os servicos Google. Com uma unica autorizacao, voce conecta Gmail, Contacts, Calendar e Sheets de uma vez. Primeiro faca upload do JSON de credenciais do Google Cloud Console, depois clique em Autorizar. Cada empresa tem sua propria conexao isolada - seus emails e contatos sao privados. Exemplo: autorize uma vez e use o Gmail para enviar emails automaticos, o Calendar para agendar reunioes, e os Contacts para importar sua base de clientes.',
 '{"steps": [{"selector": "[data-tour=''section-google'']", "label": "Secao Google Cloud - todos os servicos Google", "action": "ghost_cursor"}, {"selector": "[data-tour=''google-oauth-card'']", "label": "Card Google OAuth2 - autorizacao centralizada", "action": "ghost_cursor"}]}',
 true, 4),

('integrations', 'O que o Gmail pode fazer na plataforma?',
 'Com o Gmail integrado, seus agentes de IA podem ler emails recebidos, responder automaticamente, e enviar emails em seu nome. Exemplo: um fluxo que monitora sua caixa de entrada, quando recebe um email de cliente, a IA resume o conteudo, classifica por urgencia, e envia uma resposta automatica. Ou um agente que envia relatorios diarios por email com metricas de vendas. Requer autorizacao Google OAuth2.',
 '{"steps": [{"selector": "[data-tour=''section-google'']", "label": "Gmail fica na secao Google Cloud", "action": "ghost_cursor"}]}',
 true, 5),

('integrations', 'O que o Google Contacts faz?',
 'O Google Contacts importa toda sua lista de contatos e separa quem tem WhatsApp de quem nao tem. Isso e essencial para campanhas de marketing segmentadas. Exemplo: importe 500 contatos, filtre os que tem WhatsApp, e envie uma promocao automatica via bot. Ou use a lista para criar cobranças PIX personalizadas para cada cliente. Requer autorizacao Google OAuth2.',
 '{"steps": [{"selector": "[data-tour=''section-google'']", "label": "Google Contacts na secao Google Cloud", "action": "ghost_cursor"}]}',
 true, 6),

('integrations', 'O que o Google Calendar faz?',
 'O Google Calendar permite criar e consultar eventos automaticamente via IA. Exemplo: um bot de WhatsApp que agenda reunioes quando o cliente solicita, ou um fluxo que cria lembretes automaticos de cobrancas pendentes. A IA pode verificar sua disponibilidade e sugerir horarios para o cliente escolher. Requer autorizacao Google OAuth2.',
 '{"steps": [{"selector": "[data-tour=''section-google'']", "label": "Google Calendar na secao Google Cloud", "action": "ghost_cursor"}]}',
 true, 7),

('integrations', 'O que o Google Analytics GA4 faz?',
 'O Google Analytics GA4 monitora metricas do seu site e gera alertas automaticos. Quando a taxa de conversao cai abaixo do seu limite definido, a plataforma te notifica imediatamente. Exemplo: receba um alerta no WhatsApp ou Telegram quando seu site tiver queda de 20 porcento no trafego, ou quando uma campanha especifica parar de converter. Configure o Property ID do GA4 para comecar.',
 '{"steps": [{"selector": "[data-tour=''section-google'']", "label": "Google Analytics na secao Google Cloud", "action": "ghost_cursor"}]}',
 true, 8),

-- ══════════════════════════════════════════════════════════
-- PROVEDORES DE IA
-- ══════════════════════════════════════════════════════════

('integrations', 'O que e o OpenAI GPT-4o?',
 'O OpenAI GPT-4o e um dos modelos de IA mais avancados do mundo. Ele entende texto, imagens e codigo com alta precisao. Na plataforma, voce usa o GPT-4o para respostas avancadas nos seus agentes, analise de documentos, geracao de conteudo, e classificacao inteligente de mensagens. Exemplo: um agente de vendas que analisa a foto do produto do cliente e sugere o melhor plano. Cole sua API Key da OpenAI e selecione o modelo. Custo: pago por uso pela OpenAI.',
 '{"steps": [{"selector": "[data-tour=''section-ai'']", "label": "Secao Provedores de IA - modelos cloud", "action": "ghost_cursor"}]}',
 true, 9),

('integrations', 'O que e o Google Gemini?',
 'O Google Gemini e o modelo multimodal do Google. Ele analisa imagens, PDFs, audio e texto com um unico modelo. E otimo para tarefas que envolvem multiplos formatos. Exemplo: envie uma foto de um contrato pelo WhatsApp e o Gemini extrai os dados automaticamente. Ou envie um audio e ele transcreve e responde. O Gemini Flash e rapido e barato, ideal para uso em larga escala. Cole sua API Key do Google AI Studio.',
 '{"steps": [{"selector": "[data-tour=''section-ai'']", "label": "Google Gemini na secao de IA", "action": "ghost_cursor"}]}',
 true, 10),

('integrations', 'O que e o Anthropic Claude?',
 'O Anthropic Claude e especialista em documentos longos e raciocinio complexo. Ele consegue processar ate 200 mil tokens de contexto, perfeito para analise de contratos, textos juridicos e documentos extensos. Exemplo: envie um PDF de 100 paginas e peca um resumo executivo, ou analise um contrato e destaque clausulas de risco. Cole sua API Key da Anthropic para comecar.',
 '{"steps": [{"selector": "[data-tour=''section-ai'']", "label": "Anthropic Claude na secao de IA", "action": "ghost_cursor"}]}',
 true, 11),

('integrations', 'O que e o Groq Ultra-Rapido?',
 'O Groq e um provedor de inferencia que roda modelos como Llama3 70B com velocidade 10 a 100 vezes maior que outros provedores. E ideal quando voce precisa de respostas instantaneas. Exemplo: um bot de atendimento que responde em menos de 1 segundo, ou classificacao em tempo real de mensagens de alta demanda. O Groq tem um plano gratuito generoso para comecar. Cole sua API Key do console.groq.com.',
 '{"steps": [{"selector": "[data-tour=''section-ai'']", "label": "Groq na secao de IA", "action": "ghost_cursor"}]}',
 true, 12),

-- ══════════════════════════════════════════════════════════
-- VOZ E AUDIO
-- ══════════════════════════════════════════════════════════

('integrations', 'O que e o ElevenLabs TTS?',
 'O ElevenLabs converte texto em audio com vozes ultra-realistas. Na plataforma, quando um agente responde via texto, o ElevenLabs pode gerar o audio e enviar como mensagem de voz no WhatsApp ou Telegram. Exemplo: um bot de suporte que responde por audio em vez de texto, dando uma experiencia mais humana ao cliente. Escolha uma voz em portugues e o sistema faz tudo automaticamente. Cole sua API Key e o Voice ID desejado.',
 '{"steps": [{"selector": "[data-tour=''section-voice'']", "label": "Secao Voz e Audio - text-to-speech", "action": "ghost_cursor"}]}',
 true, 13),

('integrations', 'O que e o OpenAI Whisper STT?',
 'O Whisper e o sistema de transcricao de audio da OpenAI. Ele converte audios de voz em texto com alta precisao, mesmo em portugues brasileiro. Na plataforma, quando um cliente envia um audio no WhatsApp ou Telegram, o Whisper transcreve automaticamente antes de enviar para o agente de IA processar. Assim seu bot entende audios, nao apenas texto. Usa a mesma chave da OpenAI, sem configuracao extra.',
 '{"steps": [{"selector": "[data-tour=''section-voice'']", "label": "Whisper STT - transcricao de audio", "action": "ghost_cursor"}]}',
 true, 14),

-- ══════════════════════════════════════════════════════════
-- MIDIA E TRAFEGO
-- ══════════════════════════════════════════════════════════

('integrations', 'O que e o Meta Ads?',
 'O Meta Ads conecta Facebook e Instagram Ads a plataforma. Voce pode ativar e pausar campanhas automaticamente apos confirmacao de pagamento. Exemplo: cliente paga um boleto PIX, o sistema confirma o pagamento e ativa a campanha de anuncios automaticamente. Ou quando o orcamento acaba, pausa a campanha e notifica voce. Configure o App ID, Access Token e Ad Account ID do Business Manager da Meta.',
 '{"steps": [{"selector": "[data-tour=''section-meta'']", "label": "Secao Midia e Trafego - anuncios automaticos", "action": "ghost_cursor"}]}',
 true, 15),

-- ══════════════════════════════════════════════════════════
-- MEMORIA E ARMAZENAMENTO
-- ══════════════════════════════════════════════════════════

('integrations', 'O que e o Google Drive e Sheets?',
 'O Google Drive salva arquivos gerados pelos agentes diretamente no seu Drive pessoal. O Google Sheets permite ler e escrever planilhas automaticamente - ideal para relatorios, DRE, fluxo de caixa e controles financeiros. Exemplo: um fluxo que recebe dados de venda pelo WhatsApp e atualiza uma planilha Google automaticamente. Ou um agente que gera um relatorio semanal e salva no Drive. Ambos requerem Google OAuth2.',
 '{"steps": [{"selector": "[data-tour=''section-storage'']", "label": "Secao Memoria e Armazenamento", "action": "ghost_cursor"}]}',
 true, 16),

('integrations', 'O que e o Notion?',
 'O Notion permite criar paginas, salvar notas de reunioes, bases de dados e resultados de pesquisa diretamente no seu workspace Notion. Exemplo: um agente que registra automaticamente cada atendimento como uma pagina no Notion, com resumo da conversa, dados do cliente e proximos passos. Configure o Integration Token do Notion e o ID da pagina raiz.',
 '{"steps": [{"selector": "[data-tour=''section-storage'']", "label": "Notion na secao de Armazenamento", "action": "ghost_cursor"}]}',
 true, 17),

('integrations', 'O que e o Amazon S3 e Cloudflare R2?',
 'O Amazon S3 e Cloudflare R2 sao servicos de armazenamento em nuvem para arquivos, audios, relatorios e backups em escala. Ideal para guardar midias geradas pelos agentes, gravar conversas, ou fazer backup automatico dos dados. Exemplo: cada audio transcrito pelo Whisper e salvo no S3 para consulta futura, ou imagens geradas pela IA sao armazenadas no R2 com custo zero de saida.',
 '{"steps": [{"selector": "[data-tour=''section-storage'']", "label": "S3 e R2 na secao de Armazenamento", "action": "ghost_cursor"}]}',
 true, 18),

('integrations', 'O que e o Pinecone e o Redis?',
 'O Pinecone e um banco de dados vetorial para memoria semantica de longo prazo. Ele permite que seus agentes lembrem de conversas passadas e encontrem informacoes relevantes por similaridade. O Redis e um cache ultra-rapido que reduz latencia e economiza tokens. Exemplo: um agente de vendas que lembra do historico de compras do cliente sem gastar tokens buscando no banco toda vez. O Redis ja esta rodando localmente pelo Docker.',
 '{"steps": [{"selector": "[data-tour=''section-storage'']", "label": "Pinecone e Redis para memoria inteligente", "action": "ghost_cursor"}]}',
 true, 19);
