import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Sparkles, Zap, Shield, BarChart3, MessageSquare, Bot,
  ArrowRight, ChevronRight, Cpu, Globe, Lock, Eye, Send,
  Users, FileCode, CreditCard, Megaphone, Palette, Search,
  TrendingUp, Clock, CheckCircle, Star, ArrowUp, Menu, X,
  ShoppingBag, Package
} from 'lucide-react'
import './LandingPage.css'

const MODULES = [
  {
    id: 'agents',
    icon: Bot,
    title: 'Agentes de Inteligência Artificial',
    subtitle: 'Seus colaboradores digitais que nunca dormem',
    color: '#8b5cf6',
    desc: 'Crie agentes inteligentes com personalidade, conhecimento e habilidades únicas. Cada agente pode ser treinado com sua base de conhecimento, responder em português natural e atender seus clientes 24 horas por dia, 7 dias por semana — sem intervenção humana.',
    features: ['Treinamento com documentos, PDFs e FAQs', 'Personalidade e tom de voz customizáveis', 'Memória de longo prazo por cliente', 'Integração com WhatsApp, Telegram e Web'],
    image: '/brand/hero-dashboard.png',
  },
  {
    id: 'flows',
    icon: Zap,
    title: 'Flow Builder — Automação Visual',
    subtitle: 'Arraste, conecte e automatize. Sem código.',
    color: '#f59e0b',
    desc: 'Nosso editor visual de fluxos permite que você construa automações complexas arrastando blocos e conectando-os. Integre IA, WhatsApp, e-mail, webhooks, bancos de dados e muito mais — tudo sem escrever uma linha de código.',
    features: ['Editor drag-and-drop intuitivo', '50+ blocos de IA, mensagens e lógica', 'Execução em tempo real com monitoramento', 'Gatilhos: WhatsApp, Telegram, Webhook, Cron'],
  },
  {
    id: 'crm',
    icon: Users,
    title: 'CRM WhatsApp',
    subtitle: 'Gerencie vendas e relacionamentos direto pelo WhatsApp',
    color: '#10b981',
    desc: 'Transforme seu WhatsApp em uma central de vendas profissional. Todos os contatos que enviam mensagens são automaticamente cadastrados no CRM. Gerencie tags, aplique filtros, visualize histórico de conversas e envie campanhas em massa — tudo integrado com identificação de operador.',
    features: ['Auto-criação de contatos via WhatsApp', 'Histórico completo de mensagens por contato', 'Tags personalizadas e filtros avançados', 'Disparos em massa com controle anti-ban'],
    hasApi: true,
    apiRoute: '/crm-api-docs',
  },
  {
    id: 'whatsapp',
    icon: MessageSquare,
    title: 'WhatsApp Bot — Gerenciador de Negócios',
    subtitle: 'Conecte seu WhatsApp e automatize tudo',
    color: '#25d366',
    desc: 'Conecte seu número de WhatsApp à plataforma em segundos via QR Code. A partir desse momento, cada mensagem recebida pode ser processada por IA, roteada para fluxos automáticos, encaminhada para operadores humanos ou respondida instantaneamente com mensagens inteligentes.',
    features: ['Conexão via QR Code em 10 segundos', 'Bot com IA respondendo em tempo real', 'Identificação de operador (assinatura personalizada)', 'Webhook para integração com sistemas externos'],
    hasApi: true,
    apiRoute: '/crm-api-docs',
  },
  {
    id: 'payments',
    icon: CreditCard,
    title: 'Gateway de Pagamento Inteligente',
    subtitle: 'PIX instantâneo, cobranças e saques — monitorados por IA',
    color: '#3b82f6',
    desc: 'Receba pagamentos via PIX de forma rápida e segura, com confirmação instantânea. Nosso gateway trabalha com os melhores provedores do mercado e é monitorado 24 horas por inteligência artificial. Gere cobranças, envie PIX, realize saques e acompanhe tudo em tempo real.',
    features: ['PIX instantâneo com confirmação automática', 'Saques e envios de PIX monitorados por IA 24h', 'Geração de cobranças e QR Codes dinâmicos', 'Dashboard financeiro com métricas em tempo real'],
    hasApi: true,
    apiRoute: '/payments/api-docs',
  },
  {
    id: 'bids',
    icon: Search,
    title: 'Radar de Licitações com IA',
    subtitle: 'Encontre oportunidades públicas antes da concorrência',
    color: '#ef4444',
    desc: 'Nossa inteligência artificial varre diariamente os portais PNCP e ComprasGov para encontrar licitações que combinam com o perfil da sua empresa. Configure nichos de interesse, receba alertas automáticos e nunca mais perca uma oportunidade de negócio com o governo.',
    features: ['Busca automática em PNCP e ComprasGov', 'Filtros por nicho, região e valor', 'Alertas em tempo real por e-mail e WhatsApp', 'Análise de editais com IA'],
  },
  {
    id: 'studio',
    icon: Palette,
    title: 'Marketing Studio',
    subtitle: 'Crie conteúdo profissional com IA generativa',
    color: '#ec4899',
    desc: 'Produza posts para redes sociais, banners, textos publicitários e campanhas completas usando inteligência artificial. Defina seu Brand Kit (cores, fontes, logo) e o Studio cria conteúdo alinhado à identidade visual da sua marca automaticamente.',
    features: ['Geração de posts com IA (texto + imagem)', 'Brand Kit com identidade visual', 'Biblioteca de conteúdo organizada', 'Templates por categoria e formato'],
  },
  {
    id: 'multicanal',
    icon: Globe,
    title: 'Chat Multicanal',
    subtitle: 'WhatsApp, Telegram, Instagram e Web em um só lugar',
    color: '#06b6d4',
    desc: 'Centralize todas as suas conversas em uma única interface. Monitore interações de WhatsApp, Telegram, Instagram e chat web, com histórico completo e IA respondendo automaticamente ou encaminhando para atendentes humanos quando necessário.',
    features: ['WhatsApp via SmartMoon Engine nativo', 'Telegram com bots customizados', 'Chat web embeddável no seu site', 'Monitoramento e takeover humano'],
  },
  {
    id: 'skill-store',
    icon: Package,
    title: 'Skill Store',
    subtitle: 'Habilidades prontas para turbinar seus agentes',
    color: '#f97316',
    desc: 'A Skill Store é o marketplace de habilidades para seus agentes IA. Instale skills pré-configuradas — como agendamento, consulta de CEP, geração de contratos, atendimento SAC — e ative com um clique. Cada skill já vem com prompts otimizados, conexões de API e fluxos prontos para uso.',
    features: ['Marketplace com dezenas de skills prontas', 'Instalação com um clique no seu agente', 'Skills com prompts e APIs já configurados', 'Comunidade: crie e compartilhe suas skills'],
  },
  {
    id: 'agent-store',
    icon: ShoppingBag,
    title: 'Agent Store',
    subtitle: 'Agentes IA completos prontos para trabalhar',
    color: '#14b8a6',
    desc: 'Não quer criar um agente do zero? A Agent Store oferece agentes IA completos e especializados — vendedor, SAC, agendador, nutricionista, advogado, personal trainer e muito mais. Cada agente vem com personalidade definida, base de conhecimento e skills instaladas. É só ativar e colocar para trabalhar.',
    features: ['Agentes especializados por nicho de mercado', 'Personalidade, tom de voz e conhecimento inclusos', 'Skills e integrações já configuradas', 'Customização total após instalação'],
  },
]

const APIS = [
  { name: 'WhatsApp API', desc: 'Crie instâncias, conecte via QR, envie mensagens e configure webhooks.', route: '/crm-api-docs', method: '8 endpoints' },
  { name: 'CRM API', desc: 'Gerencie contatos, tags, campanhas, mensagens e métricas do CRM.', route: '/crm-api-docs', method: '15 endpoints' },
  { name: 'Gateway PIX API', desc: 'Gere cobranças PIX, consulte pagamentos e realize saques.', route: '/payments/api-docs', method: '10 endpoints' },
]

export default function LandingPage() {
  const navigate = useNavigate()
  const [scrollY, setScrollY] = useState(0)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [activeModule, setActiveModule] = useState(null)
  const modulesRef = useRef(null)

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setMobileMenu(false)
  }

  return (
    <div className="lp">
      {/* ── NAV ── */}
      <nav className={`lp-nav ${scrollY > 50 ? 'scrolled' : ''}`}>
        <div className="lp-nav-logo" onClick={() => scrollTo('hero')}>
          <div className="lp-logo-icon"><Cpu size={20} color="white" /></div>
          <span>Smart Moon</span>
        </div>
        <div className="lp-nav-links">
          <button onClick={() => scrollTo('modules')}>Módulos</button>
          <button onClick={() => scrollTo('apis')}>APIs</button>
          <button onClick={() => scrollTo('pricing')}>Planos</button>
        </div>
        <div className="lp-nav-btns">
          <button className="lp-btn-ghost" onClick={() => navigate('/login')}>Entrar</button>
          <button className="lp-btn-primary" onClick={() => navigate('/register')}>Criar Conta</button>
        </div>
        <button className="lp-mobile-toggle" onClick={() => setMobileMenu(!mobileMenu)}>
          {mobileMenu ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {mobileMenu && (
        <div className="lp-mobile-menu">
          <button onClick={() => scrollTo('modules')}>Módulos</button>
          <button onClick={() => scrollTo('apis')}>APIs Públicas</button>
          <button onClick={() => navigate('/login')}>Entrar</button>
          <button onClick={() => navigate('/register')}>Criar Conta</button>
        </div>
      )}

      {/* ── HERO ── */}
      <section className="lp-hero" id="hero">
        <div className="lp-hero-glow" />
        <div className="lp-hero-badge"><Sparkles size={14} /> Plataforma Brasileira de IA</div>
        <h1>
          Automatize seu negócio<br />
          com <span className="lp-gradient-text">Inteligência Artificial</span>
        </h1>
        <p className="lp-hero-desc">
          A Smart Moon é a plataforma completa para criar agentes IA e automatizar processos para sua empresa.
        </p>
        <div className="lp-hero-actions">
          <button className="lp-btn-primary lp-btn-lg" onClick={() => navigate('/register')}>
            Começar Agora <ArrowRight size={18} />
          </button>
          <button className="lp-btn-ghost lp-btn-lg" onClick={() => scrollTo('modules')}>
            Conhecer Módulos <ChevronRight size={18} />
          </button>
        </div>
        <div className="lp-hero-image">
          <img src="/brand/hero-dashboard.png" alt="Smart Moon Dashboard" />
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="lp-stats">
        {[
          { icon: Clock, value: '99.9%', label: 'Uptime' },
          { icon: Globe, value: '50+', label: 'Integrações' },
          { icon: Zap, value: '10K+', label: 'Automações/dia' },
          { icon: Bot, value: '24/7', label: 'IA Ativa' },
        ].map((s, i) => (
          <div key={i} className="lp-stat">
            <s.icon size={20} className="lp-stat-icon" />
            <div className="lp-stat-value">{s.value}</div>
            <div className="lp-stat-label">{s.label}</div>
          </div>
        ))}
      </section>

      {/* ── MODULES ── */}
      <section className="lp-section" id="modules" ref={modulesRef}>
        <div className="lp-section-header">
          <div className="lp-section-badge"><Cpu size={14} /> Plataforma Completa</div>
          <h2>Todos os módulos que você precisa</h2>
          <p>Uma única plataforma com IA integrada para escalar cada aspecto do seu negócio.</p>
        </div>

        {MODULES.map((mod, idx) => (
          <div key={mod.id} className={`lp-module ${idx % 2 === 1 ? 'reverse' : ''}`} id={`mod-${mod.id}`}>
            <div className="lp-module-content">
              <div className="lp-module-icon" style={{ background: mod.color + '20', color: mod.color }}>
                <mod.icon size={28} />
              </div>
              <h3>{mod.title}</h3>
              <p className="lp-module-subtitle">{mod.subtitle}</p>
              <p className="lp-module-desc">{mod.desc}</p>
              <ul className="lp-module-features">
                {mod.features.map((f, i) => (
                  <li key={i}><CheckCircle size={16} color={mod.color} /> {f}</li>
                ))}
              </ul>
              {mod.hasApi && (
                <button className="lp-btn-api" onClick={() => navigate(mod.apiRoute)}>
                  <FileCode size={16} /> Ver Documentação da API <ArrowRight size={14} />
                </button>
              )}
            </div>
            <div className="lp-module-visual">
              <div className="lp-module-card" style={{ '--accent': mod.color }}>
                <div className="lp-module-card-header">
                  <mod.icon size={20} color={mod.color} />
                  <span>{mod.title.split('—')[0].trim()}</span>
                </div>
                <div className="lp-module-card-body">
                  {mod.features.slice(0, 3).map((f, i) => (
                    <div key={i} className="lp-module-card-row">
                      <div className="lp-module-card-dot" style={{ background: mod.color }} />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </section>

      {/* ── APIs ── */}
      <section className="lp-section lp-apis-section" id="apis">
        <div className="lp-section-header">
          <div className="lp-section-badge"><FileCode size={14} /> Para Desenvolvedores</div>
          <h2>APIs Públicas</h2>
          <p>Integre a Smart Moon no seu sistema com nossas APIs RESTful documentadas.</p>
        </div>
        <div className="lp-apis-grid">
          {APIS.map((a, i) => (
            <div key={i} className="lp-api-card" onClick={() => navigate('/login')}>
              <div className="lp-api-badge">{a.method}</div>
              <h4>{a.name}</h4>
              <p>{a.desc}</p>
              <button className="lp-btn-api-sm">
                Ver Documentação <ArrowRight size={14} />
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="lp-cta" id="pricing">
        <div className="lp-cta-glow" />
        <h2>Pronto para transformar seu negócio?</h2>
        <p>Crie sua conta gratuitamente e experimente o poder da automação com IA.</p>
        <button className="lp-btn-primary lp-btn-lg" onClick={() => navigate('/register')}>
          Criar Conta Grátis <ArrowRight size={18} />
        </button>
        <div className="lp-cta-trust">
          <Lock size={14} /> Seus dados protegidos com criptografia de ponta
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="lp-footer">
        <div className="lp-footer-content">
          <div className="lp-footer-brand">
            <div className="lp-logo-icon"><Cpu size={18} color="white" /></div>
            <span>Smart Moon</span>
          </div>
          <div className="lp-footer-links">
            <button onClick={() => scrollTo('modules')}>Módulos</button>
            <button onClick={() => scrollTo('apis')}>APIs</button>
            <button onClick={() => navigate('/login')}>Entrar</button>
          </div>
        </div>
        <div className="lp-footer-copy">
          © {new Date().getFullYear()} Smart Moon — Plataforma de Inteligência Artificial. Todos os direitos reservados.
        </div>
      </footer>

      {scrollY > 400 && (
        <button className="lp-scroll-top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <ArrowUp size={18} />
        </button>
      )}
    </div>
  )
}
