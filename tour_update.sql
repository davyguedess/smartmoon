-- Atualizar o FAQ "O que é a página de Integrações?" com tour completo de 10 steps
UPDATE luna_knowledge SET
  answer = 'A pagina de Integracoes e o centro de controle de todas as conexoes externas da plataforma. Vou te guiar por cada secao. Primeiro temos as abas: Catalogo para configurar e Conexoes Ativas para monitorar. Na Mensageria voce conecta WhatsApp e Telegram. Na secao Google Cloud voce autoriza Gmail, Calendar, Contacts e Sheets com um unico clique via OAuth. Nos Provedores de IA voce configura GPT-4, Gemini, Claude e Groq com suas API Keys. Em Voz e Audio voce ativa o ElevenLabs para respostas por voz e o Whisper para entender audios. Na secao Midia e Trafego voce conecta Meta Ads para automacao de campanhas. E por fim, em Memoria e Armazenamento voce configura Google Drive, Notion, S3, Pinecone e Redis. Cada empresa tem suas proprias credenciais isoladas e seguras.',
  tour_config = '{"steps": [
    {"selector": "[data-tour=''integration-tabs'']", "label": "Abas: Catalogo para configurar, Conexoes Ativas para monitorar status", "action": "ghost_cursor"},
    {"selector": "[data-tour=''section-messaging'']", "label": "Secao Mensageria: conecte WhatsApp SmartMoon e Telegram Bot aqui", "action": "ghost_cursor"},
    {"selector": "[data-tour=''add-instance-btn'']", "label": "Botao Add Instance: crie novas conexoes WhatsApp ou Telegram", "action": "ghost_cursor"},
    {"selector": "[data-tour=''section-google'']", "label": "Secao Google Cloud: Gmail, Contacts, Calendar, Sheets e Analytics", "action": "ghost_cursor"},
    {"selector": "[data-tour=''google-oauth-card'']", "label": "Google OAuth2: autorize uma vez e todos os servicos Google ficam disponiveis", "action": "ghost_cursor"},
    {"selector": "[data-tour=''section-ai'']", "label": "Provedores de IA: OpenAI GPT-4o, Gemini, Claude e Groq", "action": "ghost_cursor"},
    {"selector": "[data-tour=''section-voice'']", "label": "Voz e Audio: ElevenLabs para falar e Whisper para ouvir", "action": "ghost_cursor"},
    {"selector": "[data-tour=''section-meta'']", "label": "Midia e Trafego: Meta Ads para automacao de campanhas Facebook e Instagram", "action": "ghost_cursor"},
    {"selector": "[data-tour=''section-storage'']", "label": "Memoria e Armazenamento: Drive, Notion, S3, Pinecone e Redis", "action": "ghost_cursor"},
    {"selector": "[data-tour=''integration-cards'']", "label": "Pronto! Agora voce conhece todas as secoes. Clique em qualquer card para configurar.", "action": "highlight"}
  ]}'
WHERE category = 'integrations' AND question = 'O que e a pagina de Integracoes?';
