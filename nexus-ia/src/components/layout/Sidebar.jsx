import { useState } from 'react'
import { Search, Zap, Brain, Wrench, GitBranch, Clock, ChevronDown } from 'lucide-react'
import { NxIcon } from '../flows/nodes/TriggerNode'



const SECTIONS = [
  {
    key: 'triggers', label: 'Gatilhos', icon: Zap, color: '#10b981',
    nodes: [
      { label: '🌙 SmartMoon WA', detail: 'Mensagem recebida (engine nativo)', subtype: 'smartmoon_trigger', svgIcon: 'smartmoonTrigger', nodeType: 'trigger' },
      { label: 'WhatsApp (Meta)', detail: 'Mensagem recebida via Cloud API', subtype: 'whatsapp_trigger', svgIcon: 'whatsapp', nodeType: 'trigger' },
      { label: 'WhatsApp Z-API', detail: 'Mensagem recebida (Z-API)', subtype: 'zapi_trigger', svgIcon: 'zapiTrigger', nodeType: 'trigger' },
      { label: 'Telegram', detail: 'Mensagem no grupo / bot', subtype: 'telegram_trigger', svgIcon: 'telegram', nodeType: 'trigger' },
      { label: 'Instagram DM', detail: 'Mensagem direta recebida', subtype: 'instagram_trigger', svgIcon: 'instagram', nodeType: 'trigger' },
      { label: 'Gmail Inbox', detail: 'E-mail recebido', subtype: 'gmail_inbox', svgIcon: 'gmail', nodeType: 'trigger' },
      { label: 'Webhook', detail: 'HTTP POST externo', subtype: 'webhook_trigger', svgIcon: 'webhook', nodeType: 'trigger' },
      { label: 'Agendamento', detail: 'Cron / tempo fixo', subtype: 'schedule', svgIcon: 'schedule', nodeType: 'trigger' },
      { label: 'Disparo Manual', detail: 'Acionamento via API', subtype: 'manual', svgIcon: 'manual', nodeType: 'trigger' },
    ],
  },
  {
    key: 'ai_local', label: 'IA Local — Ollama', icon: Brain, color: '#3b82f6',
    nodes: [
      { label: 'Agente Treinado', detail: 'Usa perfil em Agentes IA', subtype: 'trained_agent', svgIcon: 'agent', nodeType: 'ai' },
      { label: 'Agente Roteador', detail: 'llama3.2 · classifica intenção', subtype: 'router', svgIcon: 'router', nodeType: 'ai', model: 'llama3.2' },
      { label: 'Classificador', detail: 'Detecta intenção / entidade', subtype: 'classifier', svgIcon: 'classifier', nodeType: 'ai' },
      { label: 'Gemma 3', detail: 'gemma3 · análise de texto', subtype: 'ollama', svgIcon: 'gemma', nodeType: 'ai', model: 'gemma3' },
      { label: 'Base de Conhecimento', detail: 'RAG + Qdrant (memória)', subtype: 'rag', svgIcon: 'rag', nodeType: 'ai' },
    ],
  },
  {
    key: 'ai_cloud', label: 'IA Cloud', icon: Brain, color: '#8b5cf6',
    nodes: [
      { label: 'OpenAI GPT-4o', detail: 'Resposta avançada · análise', subtype: 'openai', svgIcon: 'openai', nodeType: 'ai' },
      { label: 'Google Gemini', detail: 'Multimodal: imagem / PDF / áudio', subtype: 'gemini', svgIcon: 'gemini', nodeType: 'ai' },
      { label: 'Claude Sonnet', detail: 'Documentos longos · raciocínio', subtype: 'claude', svgIcon: 'claude', nodeType: 'ai' },
      { label: 'Groq Ultra-rápido', detail: 'llama3-70b em milliseconds', subtype: 'groq', svgIcon: 'groq', nodeType: 'ai' },
      { label: 'Whisper STT', detail: 'Transcreve áudios recebidos', subtype: 'whisper', svgIcon: 'whisper', nodeType: 'ai' },
      { label: 'Luna Voice', detail: 'IA de voz inteligente (Tutorial/Chat)', subtype: 'luna', svgIcon: 'luna', nodeType: 'luna' },
      { label: 'ElevenLabs TTS', detail: 'Converte texto em áudio WA', subtype: 'elevenlabs', svgIcon: 'tts', nodeType: 'action' },
    ],
  },
  {
    key: 'google', label: 'Google Workspace', icon: GitBranch, color: '#4285f4',
    nodes: [
      { label: 'Google Contacts', detail: 'Importa e busca contatos', subtype: 'google_contacts', svgIcon: 'contacts', nodeType: 'action' },
      { label: 'Verificar WhatsApp', detail: 'Tem WA? → roteia canal', subtype: 'check_whatsapp', svgIcon: 'checkWA', nodeType: 'logic' },
      { label: 'Enviar Email', detail: 'Gmail API → envia e-mail', subtype: 'send_email', svgIcon: 'sendEmail', nodeType: 'action' },
      { label: 'Criar Evento', detail: 'Google Calendar', subtype: 'create_event', svgIcon: 'calendar', nodeType: 'action' },
      { label: 'Google Sheets', detail: 'Ler / escrever planilhas', subtype: 'update_sheet', svgIcon: 'sheets', nodeType: 'action' },
    ],
  },
  {
    key: 'actions', label: 'Ações — Mensagens', icon: Wrench, color: '#f59e0b',
    nodes: [
      { label: '🌙 Enviar SmartMoon', detail: 'WhatsApp via engine nativo', subtype: 'smartmoon_send', svgIcon: 'smartmoonSend', nodeType: 'action' },
      { label: 'Enviar WhatsApp', detail: 'Meta Cloud API', subtype: 'send_whatsapp', svgIcon: 'sendWA', nodeType: 'action' },
      { label: 'Enviar Z-API', detail: 'WhatsApp via Z-API', subtype: 'zapi_send', svgIcon: 'sendZAPI', nodeType: 'action' },
      { label: 'Enviar Telegram', detail: 'Bot → grupo / usuário', subtype: 'send_telegram', svgIcon: 'sendTG', nodeType: 'action' },
      { label: 'Enviar Email', detail: 'Gmail API → envia e-mail', subtype: 'send_email', svgIcon: 'sendEmail', nodeType: 'action' },
      { label: 'Multi-Canal', detail: 'WA ou Email dependendo do canal', subtype: 'multi_channel', svgIcon: 'multichannel', nodeType: 'logic' },
    ],
  },
  {
    key: 'payments', label: 'Pagamentos & CRM', icon: Wrench, color: '#10b981',
    nodes: [
      { label: 'PIX Mercado Pago', detail: 'Gerar cobrança / link PIX', subtype: 'create_pix', svgIcon: 'pix', nodeType: 'action' },
      { label: 'Asaas', detail: 'Cobranças PIX / boleto / cartão', subtype: 'asaas_charge', svgIcon: 'asaas', nodeType: 'action' },
      { label: 'HubSpot CRM', detail: 'Criar / atualizar contato e deal', subtype: 'hubspot', svgIcon: 'hubspot', nodeType: 'action' },
      { label: 'RD Station', detail: 'Lead / oportunidade / funil', subtype: 'rdstation', svgIcon: 'rdstation', nodeType: 'action' },
      { label: 'Notion', detail: 'Criar / atualizar página/DB', subtype: 'notion', svgIcon: 'notion', nodeType: 'action' },
      { label: 'Meta Ads', detail: 'Ativar / pausar campanha', subtype: 'meta_ads', svgIcon: 'meta', nodeType: 'action' },
      { label: 'HTTP Request', detail: 'Chamar qualquer API externa', subtype: 'http', svgIcon: 'http', nodeType: 'action' },
    ],
  },
  {
    key: 'external_apis', label: 'APIs Externas', icon: Wrench, color: '#ec4899',
    nodes: [
      { label: '🩺 Duarte Booking', detail: 'Agendamentos · clientes · slots', subtype: 'duarte_booking', svgIcon: 'http', nodeType: 'action' },
      { label: '🔌 API Externa', detail: 'Chamar API exclusiva configurada', subtype: 'external_api', svgIcon: 'http', nodeType: 'action' },
    ],
  },
  {
    key: 'flow', label: 'Controle de Fluxo', icon: Clock, color: '#ec4899',
    nodes: [
      { label: 'Condição', detail: 'Se / Então / Senão', subtype: 'condition', svgIcon: 'condition', nodeType: 'logic' },
      { label: 'Definir Variável', detail: 'Salva valor para usar no fluxo', subtype: 'set_variable', svgIcon: 'setVar', nodeType: 'logic' },
      { label: 'Loop', detail: 'Repetir para cada item da lista', subtype: 'loop', svgIcon: 'loop', nodeType: 'logic' },
      { label: 'Aguardar Pagamento', detail: 'Pausa até confirmação MP', subtype: 'wait_payment', svgIcon: 'waitPayment', nodeType: 'wait' },
      { label: 'Aguardar Resposta', detail: 'Pausa até cliente responder', subtype: 'wait_webhook', svgIcon: 'waitWebhook', nodeType: 'wait' },
      { label: 'Delay', detail: 'Esperar X minutos / horas', subtype: 'delay', svgIcon: 'delay', nodeType: 'wait' },
      { label: 'Retry', detail: 'Tentar novamente N vezes', subtype: 'retry', svgIcon: 'retry', nodeType: 'logic' },
      { label: 'Sub-Fluxo', detail: 'Chamar outro fluxo como etapa', subtype: 'subflow', svgIcon: 'subflow', nodeType: 'action' },
      { label: 'Encerrar Fluxo', detail: 'Finaliza a execução aqui', subtype: 'stop', svgIcon: 'stop', nodeType: 'logic' },
    ],
  },
]

// Mapeamento de nodeType → fundo do ícone (cor sutil)
const typeAccent = { trigger: '#10b98118', ai: '#3b82f618', action: '#8b5cf618', wait: '#f59e0b18', logic: '#ec489918' }

export default function Sidebar() {
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState({})

  const onDragStart = (event, node) => {
    // Mantém compatibilidade passando icon='' para nodes antigos
    event.dataTransfer.setData('application/nexus-node', JSON.stringify({ ...node, icon: '' }))
    event.dataTransfer.effectAllowed = 'move'
  }

  const filteredSections = SECTIONS.map((section) => ({
    ...section,
    nodes: section.nodes.filter(
      (n) => !search || n.label.toLowerCase().includes(search.toLowerCase()) || n.detail.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter((s) => !search || s.nodes.length > 0)

  const toggleSection = (key) => setCollapsed((c) => ({ ...c, [key]: !c[key] }))

  return (
    <aside className="sidebar flow-sidebar" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Search */}
      <div className="sidebar-search">
        <div className="search-input-wrap">
          <Search size={13} color="var(--text-muted)" />
          <input
            placeholder="Buscar blocos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <span style={{ cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12, lineHeight: 1 }} onClick={() => setSearch('')}>×</span>
          )}
        </div>
      </div>

      {/* Sections */}
      <div className="sidebar-content" style={{ flex: 1, overflowY: 'auto' }}>
        {filteredSections.map((section) => {
          const Icon = section.icon
          const isCollapsed = collapsed[section.key]

          return (
            <div className="sidebar-section" key={section.key}>
              <div
                className="sidebar-section-title"
                style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: 6 }}
                onClick={() => toggleSection(section.key)}
              >
                <Icon size={11} style={{ color: section.color, flexShrink: 0 }} />
                <span style={{ color: section.color, flex: 1 }}>{section.label}</span>
                <ChevronDown
                  size={11}
                  style={{ color: 'var(--text-muted)', transform: isCollapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s' }}
                />
              </div>

              {!isCollapsed && section.nodes.map((node) => (
                <div
                  key={node.label}
                  className={`node-block ${node.subtype === 'luna' ? 'node-luna' : ''} ${node.nodeType === 'trigger' ? 'trigger' : node.nodeType === 'ai' ? 'ai' : node.nodeType === 'action' ? 'action' : 'logic'}`}
                  draggable
                  onDragStart={(e) => onDragStart(e, node)}
                  title={`Arraste para o canvas: ${node.label}`}
                >
                  <NxIcon subtype={node.subtype} />
                  <div className="node-block-info">
                    <div className="node-block-name">{node.label}</div>
                    <div className="node-block-desc">{node.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="ai-assistant-card">
          <div className="ai-assistant-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 1 0 10 10"/><path d="M15 2.5A17.5 17.5 0 0 1 17.5 12"/><path d="M12 2v4"/><path d="M8 2.5A17.5 17.5 0 0 0 6.5 12"/></svg>
          </div>
          <div className="ai-assistant-info">
            <div className="ai-assistant-label">IA Assistente</div>
            <div className="ai-assistant-hint">Descreva em linguagem natural...</div>
          </div>
        </div>
      </div>
    </aside>
  )
}
