from typing import Dict, Any, List

# Base de Conhecimento Estática da Luna
# Conteúdo para respostas instantâneas (0ms de geração)
LUNA_TUTORIALS: Dict[str, Any] = {
    "dashboard": {
        "title": "Dashboard de Controle",
        "description": "Aqui é onde você monitora toda a sua operação em tempo real. Vou te mostrar os pontos principais.",
        "steps": [
            { 
                "text": "Aqui em cima, você vê o Status do Sistema. Se estiver verde e pulsando, significa que todos os nossos motores de IA e conexões estão prontos para agir.", 
                "selector": "[data-tour='global-status']" 
            },
            { 
                "text": "Esta é a sua Carteira Digital. Aqui você vê seu saldo disponível para saque e o resumo financeiro. É o seu centro de comando monetário na SmartMoon.", 
                "selector": "[data-tour='wallet-hero']" 
            },
            { 
                "text": "Neste gráfico, acompanhamos sua receita dos últimos 30 dias. Você pode ver o que já foi faturado e o que ainda está pendente de recebimento.", 
                "selector": "[data-tour='main-chart']" 
            },
            { 
                "text": "Aqui estão os seus atalhos de ação rápida. PIX Rápido, Cobranças, Saques e Créditos SM estão todos a apenas um clique de distância.", 
                "selector": "[data-tour='quick-actions']" 
            },
            { 
                "text": "Por fim, este quadro mostra a 'saúde' da sua automação: execuções de IA, fluxos ativos e canais conectados — tudo em tempo real!", 
                "selector": "[data-tour='metrics-grid']" 
            }
        ],
        "image_url": "https://placehold.co/800x450/1e1e2e/ffffff?text=Dashboard+Tutorial",
        "audio_path": "tutorials/pt_br/luna_dashboard_intro.ogg"
    },
    "flow_builder": {
        "title": "Dominando o Flow Builder",
        "description": "O Flow Builder é onde a mágica acontece! Você arrasta blocos e cria caminhos inteligentes para seus robôs.",
        "steps": [
            { "text": "Aqui é o Flow Builder — o coração da automação! 💜 Nesta barra lateral você encontra todos os blocos disponíveis: gatilhos, condições, ações e nós de IA.", "selector": ".flow-sidebar" },
            { "text": "Esta é a tela principal (canvas). Arraste os blocos da barra e solte aqui. Conecte-os criando linhas entre as portas.", "selector": ".react-flow__pane" },
            { "text": "Dica especial: o nó 'Luna IA' sou EU! 🌙 Quando você me coloca num fluxo, eu passo a atender os clientes automaticamente.", "selector": ".node-luna" },
            { "text": "Quando tudo estiver pronto, clique em 'Publicar' aqui em cima para ativar seu robô!", "selector": "[data-tour='publish-btn']" },
            { "text": "Ah, e não esqueça: você pode testar o fluxo antes de publicar usando o botão de simulação. Seguro e sem risco!", "selector": "[data-tour='simulate-btn']" }
        ],
        "image_url": "https://placehold.co/800x450/1e1e2e/ffffff?text=Flow+Builder+Tutorial",
        "audio_path": "tutorials/pt_br/luna_flow_builder.ogg"
    },
    "chat": {
        "title": "Central de Chat IA",
        "description": "Aqui você conversa diretamente com os modelos mais potentes do mundo em uma interface unificada.",
        "steps": [
            { "text": "Este é o Chat IA — aqui você conversa diretamente com os modelos de inteligência artificial 🤖", "selector": ".chat-container" },
            { "text": "Neste seletor aqui em cima, você escolhe qual modelo usar: GPT-4, Claude, Gemini, DeepSeek e mais!", "selector": "[data-tour='model-selector']" },
            { "text": "É só digitar sua pergunta aqui embaixo e pressionar Enter. Eu respondo em segundos!", "selector": "[data-tour='chat-input']" },
            { "text": "E no painel lateral esquerdo ficam seus chats salvos. Você pode retomar qualquer conversa a qualquer momento.", "selector": "[data-tour='chat-history']" }
        ],
        "image_url": "https://placehold.co/800x450/1e1e2e/ffffff?text=Chat+IA+Tutorial",
        "audio_path": "tutorials/pt_br/luna_chat_ia.ogg"
    },
    "agents": {
        "title": "Gestão de Agentes",
        "description": "Crie e treine agentes especializados com personalidades únicas para cada setor do seu negócio.",
        "steps": [
            { "text": "Bem-vindo à Central de Agentes! 🧠 Aqui você cria e gerencia suas IAs personalizadas.", "selector": ".agents-page-header" },
            { "text": "Clique neste botão para criar um novo agente. Você pode definir nome, personalidade, prompt de sistema e habilidades.", "selector": "[data-tour='create-agent-btn']" },
            { "text": "Sua lista de agentes aparece aqui. Cada card mostra status, modelo e ações rápidas.", "selector": "[data-tour='agent-list']" },
            { "text": "E aqui embaixo está a Skill Store — instale habilidades como 'Vendas', 'Suporte' ou 'Qualificação de Leads' nos seus agentes!", "selector": "[data-tour='skill-store-catalog']" }
        ],
        "image_url": "https://placehold.co/800x450/1e1e2e/ffffff?text=Agents+Tutorial",
        "audio_path": "tutorials/pt_br/luna_agents.ogg"
    },
    "integrations": {
        "title": "Central de Integrações",
        "description": "Conecte sua empresa ao mundo! WhatsApp, Instagram, Telegram e muito mais em um só lugar.",
        "steps": [
            { "text": "Aqui é a Central de Integrações — onde você conecta o Smart Moon ao mundo exterior! 🌍", "selector": ".integrations-grid" },
            { "text": "Escolha a plataforma que quer conectar: WhatsApp, Telegram, Instagram ou HTTP personalizado.", "selector": "[data-tour='integration-cards']" },
            { "text": "Suas instâncias ativas ficam listadas aqui. Verde = conectado, vermelho = desconectado.", "selector": "[data-tour='instance-list']" },
            { "text": "Para adicionar uma nova conexão, clique neste botão e siga o passo a passo. Leva menos de 2 minutos!", "selector": "[data-tour='add-instance-btn']" }
        ],
        "image_url": "https://placehold.co/800x450/1e1e2e/ffffff?text=Integrations+Tutorial",
        "audio_path": "tutorials/pt_br/luna_integrations.ogg"
    },
    "payments": {
        "title": "Gateway de Pagamentos",
        "description": "Sua central financeira. Controle faturamento, saldos e cobranças automáticas via PIX.",
        "steps": [
            { "text": "Este é seu Gateway de Pagamentos 💰 Aqui você gerencia toda a parte financeira da operação.", "selector": ".payments-overview-card" },
            { "text": "O card principal mostra seu saldo, total recebido e total sacado. Tudo em tempo real!", "selector": "[data-tour='wallet-card']" },
            { "text": "Aqui embaixo você vê suas cobranças — pagas, pendentes e expiradas. Filtre e busque como quiser.", "selector": "[data-tour='transactions-list']" },
            { "text": "E nestes botões rápidos você pode Depositar, Sacar ou Criar uma Nova Cobrança PIX instantaneamente!", "selector": "[data-tour='payment-settings']" }
        ],
        "image_url": "https://placehold.co/800x450/1e1e2e/ffffff?text=Tutorial+Pagamentos",
        "audio_path": "tutorials/pt_br/luna_payments.ogg"
    },
    "bids": {
        "title": "Radar de Licitações IA",
        "description": "Aqui você monitora e descobre oportunidades de licitações públicas com inteligência artificial.",
        "steps": [
            {
                "text": "Este é o Radar de Licitações! Nosso motor de IA conecta direto com o PNCP e ComprasGov para trazer oportunidades públicas relevantes para o seu negócio.",
                "selector": "[data-tour='bids-header']"
            },
            {
                "text": "Aqui estão seus botões de ação rápida: Buscar novas licitações, Gerenciar Alertas automáticos, configurar seus Nichos de interesse e ver as licitações que você já Salvou.",
                "selector": "[data-tour='bids-actions']"
            },
            {
                "text": "Estes cards mostram seus indicadores: total de licitações importadas, quantas têm score alto de relevância, pendentes para análise, já selecionadas e alertas ativos.",
                "selector": "[data-tour='bids-kpis']"
            },
            {
                "text": "E aqui embaixo, a distribuição geográfica e por modalidade. Clique em qualquer estado ou modalidade para expandir e ver as licitações daquela categoria.",
                "selector": "[data-tour='bids-distribution']"
            }
        ],
        "image_url": "https://placehold.co/800x450/1e1e2e/ffffff?text=Licitacoes+Tutorial",
        "audio_path": "tutorials/pt_br/luna_bids_intro.ogg"
    }
}

LUNA_FAQ: List[Dict[str, Any]] = [
    {
        "question": "Por que meu robô não está respondendo no WhatsApp?",
        "answer": "Isso pode ocorrer por três razões: 1. Instância Desconectada (vá em Integrações). 2. Fluxo não Publicado (clique em Publicar no Builder). 3. Falta de Créditos (veja seu saldo em Consumo).",
        "category": "suporte_tecnico"
    },
    {
        "question": "Como configuro os pagamentos via PIX automático?",
        "answer": "Integramos com Mercado Pago e Asaas. Em Financeiro -> Configurações, insira suas chaves de API. Depois, use o nó 'Criar PIX' no seu fluxo para gerar cobranças automáticas.",
        "category": "financeiro"
    },
    {
        "question": "Como criar meu primeiro fluxo de automação?",
        "answer": "Vá em 'Fluxos', clique em 'Criar Novo', escolha um nome e use o Builder para arrastar os blocos. Não esqueça de conectar o gatilho de 'Mensagem Recebida'!",
        "category": "automacao"
    },
    {
        "question": "A Luna pode atender via áudio?",
        "answer": "Sim! Basta usar o meu nó 'Luna Voice' no Flow Builder. Eu converto texto em áudio humanizado para responder seus clientes.",
        "category": "luna_ia"
    },
    {
        "question": "Qual a diferença entre os modelos GPT-4 e Claude?",
        "answer": "O GPT-4 é excelente para lógica e raciocínio complexo. O Claude tende a ser mais criativo e segue melhor instruções longas. Você pode testar ambos no Chat IA!",
        "category": "ia_modelos"
    },
    {
        "question": "Como funciona o sistema de créditos?",
        "answer": "Cada mensagem enviada consome uma pequena quantia de 'Tokens'. Você pode comprar pacotes de créditos na aba 'Consumo' para manter seus robôs ativos.",
        "category": "financeiro"
    },
    {
        "question": "Posso usar mais de um número de WhatsApp?",
        "answer": "Sim! Você pode conectar múltiplas instâncias em 'Integrações'. O limite depende do seu plano atual.",
        "category": "integracoes"
    },
    {
        "question": "Como funciona a Agent Store?",
        "answer": "É o nosso marketplace de IAs prontas! Você pode baixar agentes já configurados para nichos específicos (ex: Imobiliária, Estética) e começar a usar na hora.",
        "category": "marketplace"
    },
    {
        "question": "Meu QR Code expirou, o que eu faço?",
        "answer": "Vá em Integrações -> WhatsApp, clique na sua instância e gere um novo QR Code. Escaneie pelo celular e a conexão voltará na hora.",
        "category": "suporte_tecnico"
    },
    {
        "question": "Como faço para sacar meu saldo do PIX?",
        "answer": "No módulo de Pagamentos, clique em 'Sacar'. Insira sua chave PIX e o valor desejado. O processamento é instantâneo na maioria dos casos.",
        "category": "financeiro"
    },
    {
        "question": "Posso usar a plataforma no celular?",
        "answer": "Sim! Nossa interface é 100% responsiva. Você pode gerenciar seus chats, fluxos e faturamento diretamente do navegador do seu smartphone.",
        "category": "geral"
    },
    {
        "question": "Como integrar com CRMs externos?",
        "answer": "Use o nó 'HTTP Request' no Flow Builder. Ele permite enviar dados para Zapier, Make, Pipedrive ou qualquer API que você utilize.",
        "category": "integracoes"
    },
    {
        "question": "A Luna entende outros idiomas?",
        "answer": "Com certeza! Eu falo e entendo mais de 50 idiomas, incluindo Português, Inglês e Espanhol. Meus nós de IA traduzem automaticamente se necessário.",
        "category": "luna_ia"
    },
    {
        "question": "É possível clonar minha própria voz?",
        "answer": "Sim! Na aba 'Voz' do painel admin (ou perfil), você pode subir amostras da sua voz. Eu usarei essa clonagem para falar com seus clientes!",
        "category": "customizacao"
    },
    {
        "question": "Como cancelar ou trocar meu plano?",
        "answer": "Vá em Perfil -> Assinatura. Lá você pode fazer upgrade para desbloquear mais recursos ou gerenciar o cancelamento da recorrência.",
        "category": "conta"
    }
]

def get_tutorial(module_key: str) -> Dict[str, Any]:
    """Retorna os dados de tutorial para um módulo específico."""
    return LUNA_TUTORIALS.get(module_key, {})

def search_faq(query: str = None) -> List[Dict[str, Any]]:
    """Busca simples na base de FAQ (pode ser expandida para busca vetorial)."""
    if not query:
        return LUNA_FAQ
    query = query.lower()
    return [item for item in LUNA_FAQ if query in item["question"].lower() or query in item["answer"].lower()]
