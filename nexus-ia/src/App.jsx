/**
 * App.jsx — Smart Moon Frontend Router v3
 *
 * DOIS FLUXOS SEPARADOS:
 * 1. /admin/* → AdminLayout (superadmin apenas)
 * 2. /* → AppLayout (cliente que usa as ferramentas Smart Moon)
 *
 * Sidebar: expansível/retrátil, logout acima do nome, ícones modernos.
 */
import React, { useState, useEffect, useCallback, useRef, Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, NavLink, useLocation, Outlet, Navigate, useNavigate } from 'react-router-dom'
import { usePlan } from './hooks/usePlan'
import {
  LayoutDashboard, GitBranch, Play, Plug2, Cpu,
  Settings, ChevronRight, WifiOff, Activity, MessageSquare,
  Server, CreditCard, Volume2, Instagram, Landmark, ChevronDown,
  Bot, Zap, Sparkles, LogOut, PanelLeftClose, PanelLeftOpen,
  ChevronLeft, Store, Layers, Headphones, Radio, Menu, X,
  ShoppingBag, Palette, Image, ShieldCheck, FileCode, Users, Gavel, Briefcase, Wallet,
} from 'lucide-react'
import { api, impersonation } from './api'
import { NexusLogo } from './components/brand/NexusLogo'
import { ToastProvider } from './components/ui/Toast'
import LunaCopilot from './components/luna/LunaCopilot'
import LandingPage from './pages/LandingPage'

// ── useIsMobile hook ──────────────────────────────────────────────────────
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= breakpoint)
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`)
    const handler = (e) => setIsMobile(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [breakpoint])
  return isMobile
}
import ErrorBoundary from './components/ErrorBoundary'

// ── ImpersonationBanner ───────────────────────────────────────────────
function ImpersonationBanner() {
  const [active, setActive] = React.useState(false)
  const [name, setName] = React.useState('')
  const navigate = useNavigate()

  // Re-check on every render (banner mounts inside router)
  React.useEffect(() => {
    const timer = setInterval(() => {
      const is = impersonation.isActive()
      setActive(is)
      if (is) setName(impersonation.getName())
    }, 500)
    return () => clearInterval(timer)
  }, [])

  if (!active) return null

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, zIndex: 99999,
      background: 'linear-gradient(90deg, #dc2626, #b91c1c)',
      color: 'white', fontSize: 13, fontWeight: 700,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
      padding: '8px 20px', boxShadow: '0 2px 16px rgba(220,38,38,0.4)',
    }}>
      <span>👻 Modo Impersonação: logado como <strong>{name}</strong></span>
      <button
        onClick={() => {
          impersonation.stop()
          setActive(false)
          navigate('/admin/users')
        }}
        style={{
          padding: '4px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.4)',
          background: 'rgba(255,255,255,0.12)', color: 'white', fontSize: 12,
          fontWeight: 700, cursor: 'pointer', backdropFilter: 'blur(4px)',
        }}
      >✕ Sair da Impersonação</button>
    </div>
  )
}

// ── Eager (crítico) ────────────────────────────────────────────────────────────
import Dashboard from './pages/dashboard/Dashboard'
import Login from './pages/auth/Login'
const Register = lazy(() => import('./pages/auth/Register'))
const Checkout = lazy(() => import('./pages/auth/Checkout'))

// ── Lazy (por rota) ────────────────────────────────────────────────────────────
const Chat                       = lazy(() => import('./pages/chat/Chat'))
const AdminServer                = lazy(() => import('./pages/admin/AdminServer'))
const Agents                     = lazy(() => import('./pages/agents/Agents'))
const SalesAgentConfig           = lazy(() => import('./pages/monitoring/SalesAgentConfig'))
const FlowsPage                  = lazy(() => import('./pages/flows/FlowsPage'))
const FlowBuilderPage            = lazy(() => import('./pages/flows/FlowBuilderPage'))
const VoiceSettings              = lazy(() => import('./pages/voice/VoiceSettings'))
const VoiceSettingsV2            = lazy(() => import('./pages/voice/VoiceSettingsV2'))
const CampaignPosts              = lazy(() => import('./pages/marketing/CampaignPosts'))
const CampaignPostDetail         = lazy(() => import('./pages/marketing/CampaignPostDetail'))
const BrandKitPage               = lazy(() => import('./pages/marketing/BrandKitPage'))
const StudioPage                 = lazy(() => import('./pages/marketing/StudioPage'))
const StudioLibraryPage          = lazy(() => import('./pages/marketing/StudioLibraryPage'))
const Integrations               = lazy(() => import('./pages/integrations/Integrations'))
const TelegramBots               = lazy(() => import('./pages/integrations/TelegramBots'))
const ApiPublicRequestPage       = lazy(() => import('./pages/integrations/ApiPublicRequestPage'))
const Profile                    = lazy(() => import('./pages/account/Profile'))
const Billing                    = lazy(() => import('./pages/account/Billing'))
const TokenStorePage             = lazy(() => import('./pages/billing/TokenStorePage'))

const Executions                 = lazy(() => import('./pages/monitoring/Executions'))
const TelegramMonitor            = lazy(() => import('./pages/monitoring/TelegramMonitor'))
const TelegramConversationDetail = lazy(() => import('./pages/monitoring/TelegramConversationDetail'))
const BidsDashboard              = lazy(() => import('./pages/bids/BidsDashboard'))
const BidsSearch                 = lazy(() => import('./pages/bids/BidsSearch'))
const BidDetail                  = lazy(() => import('./pages/bids/BidDetail'))
const BidsAlerts                 = lazy(() => import('./pages/bids/BidsAlerts'))
const BidsNiches                 = lazy(() => import('./pages/bids/BidsNiches'))
const SkillsStorePage            = lazy(() => import('./pages/store/SkillsStorePage'))
const AgentsStorePage            = lazy(() => import('./pages/store/AgentsStorePage'))
const PaymentsPage               = lazy(() => import('./pages/payments/PaymentsPage'))
const CRMContacts                = lazy(() => import('./pages/crm/CRMContacts'))
const CRMDashboard               = lazy(() => import('./pages/crm/CRMDashboard'))
const CRMBroadcasts              = lazy(() => import('./pages/crm/CRMBroadcasts'))
const CRMFunnel                  = lazy(() => import('./pages/crm/CRMFunnel'))
const CRMTeam                    = lazy(() => import('./pages/crm/CRMTeam'))
const CRMReception               = lazy(() => import('./pages/crm/CRMReception'))
const AcceptInvite               = lazy(() => import('./pages/crm/AcceptInvite'))
const CRMApiDocsPage             = lazy(() => import('./pages/integrations/CRMApiDocsPage'))
const GatewayApiDocsPage         = lazy(() => import('./pages/payments/GatewayApiDocsPage'))
const TwoFactorSetup             = lazy(() => import('./components/security/TwoFactorSetup'))
const ProjectsListPage           = lazy(() => import('./pages/projects/ProjectsListPage'))
const ProjectDashboard           = lazy(() => import('./pages/projects/ProjectDashboard'))
const ProjectAnalytics           = lazy(() => import('./pages/projects/ProjectAnalytics'))
const ProjectTeamPage            = lazy(() => import('./pages/projects/ProjectTeamPage'))
const ProjectMarketingPage       = lazy(() => import('./pages/projects/ProjectMarketingPage'))
const PublicProjectLogin         = lazy(() => import('./pages/projects/PublicProjectLogin'))
const PublicProjectDashboard     = lazy(() => import('./pages/projects/PublicProjectDashboard'))
const FinancialPage              = lazy(() => import('./pages/financial/Financial'))

// ── Admin Panel (lazy) ─────────────────────────────────────────────────────────
const AdminLayout                = lazy(() => import('./components/admin/AdminLayout'))
const AdminOverviewPage          = lazy(() => import('./pages/admin/AdminOverviewPage'))
const AdminUsersPage             = lazy(() => import('./pages/admin/AdminUsersPage'))
const AdminUserDetailPage        = lazy(() => import('./pages/admin/AdminUserDetailPage'))
const AdminAgentsPage            = lazy(() => import('./pages/admin/AdminAgentsPage'))
const AdminSkillsPage            = lazy(() => import('./pages/admin/AdminSkillsPage'))
const AdminAgentStorePage        = lazy(() => import('./pages/admin/AdminAgentStorePage'))
const AdminCreditsPage           = lazy(() => import('./pages/admin/AdminCreditsPage'))
const AdminVoicePage             = lazy(() => import('./pages/admin/AdminVoicePage'))
const AdminVoiceCloningPage      = lazy(() => import('./pages/admin/AdminVoiceCloningPage'))
const AdminVoiceAgentsPage       = lazy(() => import('./pages/admin/AdminVoiceAgentsPage'))
const AdminMarketingPage         = lazy(() => import('./pages/admin/AdminMarketingPage'))
const AdminTemplatesPage         = lazy(() => import('./pages/admin/AdminTemplatesPage'))
const AdminCampaignsPage         = lazy(() => import('./pages/admin/AdminCampaignsPage'))
const AdminLicitationPage        = lazy(() => import('./pages/admin/AdminLicitationPage'))
const AdminFlowsPage             = lazy(() => import('./pages/admin/AdminFlowsPage'))
const AdminIntegrationsPage      = lazy(() => import('./pages/admin/AdminIntegrationsPage'))
const AdminSalesPage             = lazy(() => import('./pages/admin/AdminSalesPage'))
const AdminLogsPage              = lazy(() => import('./pages/admin/AdminLogsPage'))
const AdminPlansPage             = lazy(() => import('./pages/admin/AdminPlansPage'))
const AdminFeatureOverridesPage  = lazy(() => import('./pages/admin/AdminFeatureOverridesPage'))
const AdminAuditPage             = lazy(() => import('./pages/admin/AdminAuditPage'))
const AdminHealthPage            = lazy(() => import('./pages/admin/AdminHealthPage'))
const AdminSettingsPage          = lazy(() => import('./pages/admin/AdminSettingsPage'))
const AdminPaymentsPage          = lazy(() => import('./pages/admin/AdminPaymentsPage'))
const AdminGatewayPage           = lazy(() => import('./pages/admin/AdminGatewayPage'))
const AdminAITokensPage          = lazy(() => import('./pages/admin/AdminAITokensPage'))
const AdminSmartMoonPage         = lazy(() => import('./pages/admin/AdminSmartMoonPage'))
const AdminApiPublicPage         = lazy(() => import('./pages/admin/AdminApiPublicPage'))
const AdminApiDocsPage           = lazy(() => import('./pages/admin/AdminApiDocsPage'))
const AdminLunaPage              = lazy(() => import('./pages/admin/AdminLunaPage'))
const AdminLoginPage             = lazy(() => import('./pages/admin/AdminLoginPage'))
const IAStorePage                = lazy(() => import('./pages/store/IAStorePage'))

// ── Loading fallback ───────────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100%', color: 'var(--text-muted)', fontSize: 13, gap: 10,
    }}>
      <div style={{
        width: 20, height: 20, borderRadius: '50%',
        border: '2px solid var(--nexus-violet)',
        borderTopColor: 'transparent',
        animation: 'spin 0.7s linear infinite',
      }} />
      Carregando...
      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  )
}

// ── Plan config ────────────────────────────────────────────────────────────────
const PLAN_ICONS = { free: '🌱', starter: '🌙', pro: '⚡', enterprise: '🚀' }
const PLAN_COLORS = {
  free:       { bg: 'rgba(107,114,128,0.15)', text: '#9ca3af', border: 'rgba(107,114,128,0.3)' },
  starter:    { bg: 'rgba(139,92,246,0.12)',  text: '#c084fc', border: 'rgba(139,92,246,0.3)'  },
  pro:        { bg: 'rgba(59,130,246,0.12)',  text: '#60a5fa', border: 'rgba(59,130,246,0.3)'  },
  enterprise: { bg: 'rgba(0,212,255,0.1)',    text: '#00d4ff', border: 'rgba(0,212,255,0.25)'  },
}

// ── Nav items ── cada item tem `module` para filtrar por plano ─────────────────
const NAV_GROUPS = [
  {
    label: null,
    items: [
      { path: '/inicio', icon: LayoutDashboard, label: 'Dashboard', exact: true, module: null, color: '#8b5cf6' },
      { path: '/chat', icon: MessageSquare,   label: 'Chat IA',               module: null, color: '#00d4ff' },
    ],
  },
  {
    label: 'Automação',
    items: [
      { path: '/flows',        icon: GitBranch,  label: 'Fluxos',         module: null,          color: '#10b981' },
      { path: '/executions',   icon: Play,       label: 'Execuções',      module: null,          color: '#f59e0b' },
      { path: '/agents',       icon: Cpu,        label: 'Agentes IA',     module: 'agentes',     color: '#3b82f6' },
      { path: '/integrations', icon: Plug2,      label: 'Integrações',    module: null,          color: '#8b5cf6' },
      { path: '/integrations/api-publica', icon: Radio, label: 'API Pública', module: null,     color: '#0ea5e9' },

    ],
  },
  {
    label: 'CRM WhatsApp',
    items: [
      { path: '/crm', icon: Users, label: 'CRM Contatos', module: null, color: '#10b981', badge: 'NOVO' },
      { path: '/crm-recepcao', icon: Radio, label: 'Recepção', module: null, color: '#f59e0b', badge: 'NOVO' },
      { path: '/crm-funil', icon: Activity, label: 'Funil de Vendas', module: null, color: '#f43f5e', badge: 'NOVO' },
      { path: '/crm-equipe', icon: Users, label: 'Equipe', module: null, color: '#22c55e', badge: 'NOVO' },
      { path: '/crm-dashboard', icon: Activity, label: 'Dashboard CRM', module: null, color: '#8b5cf6' },
      { path: '/crm-campanhas', icon: Radio, label: 'Campanhas', module: null, color: '#f59e0b' },
      { path: '/crm-api-docs', icon: FileCode, label: 'API Docs', module: null, color: '#0ea5e9' },
    ],
  },
  {
    label: 'Marketing',
    items: [
      { path: '/studio',    icon: Image,     label: 'Studio',       module: 'marketing', color: '#ec4899', badge: 'NOVO' },
      { path: '/brand-kit', icon: Palette,   label: 'Brand Kit',    module: 'marketing', color: '#f472b6' },
      { path: '/campaigns', icon: Instagram, label: 'Campanhas IG', module: 'marketing', color: '#e1306c' },
    ],
  },
  {
    label: 'Projetos',
    items: [
      { path: '/projects', icon: Briefcase, label: 'Projetos', module: null, color: '#8b5cf6', badge: 'NOVO' },
    ],
  },
  {
    label: 'Licitações',
    items: [
      { path: '/bids',         icon: Gavel,  label: 'Radar',    module: 'licitacao', color: '#f59e0b' },
      { path: '/bids/search',  icon: Layers, label: 'Busca',    module: 'licitacao', color: '#eab308' },
      { path: '/bids/alerts',  icon: Activity, label: 'Alertas', module: 'licitacao', color: '#ef4444' },
      { path: '/bids/niches',  icon: Sparkles, label: 'Nichos',  module: 'licitacao', color: '#8b5cf6' },
    ],
  },
  {
    label: 'Financeiro',
    items: [
      { path: '/financial',           icon: Wallet,     label: 'Agente Financeiro', module: null, color: '#10b981', badge: 'NOVO' },
      { path: '/payments',            icon: Landmark,   label: 'Gateway PIX',       module: null, color: '#10b981' },
      { path: '/payments/api-docs',   icon: FileCode,   label: 'API Docs',          module: null, color: '#64748b' },
      { path: '/billing',             icon: CreditCard, label: 'Plano & Uso',       module: null, color: '#3b82f6' },
    ],
  },
  {
    label: 'Marketplace',
    items: [
      { path: '/store/ia',     icon: Sparkles, label: 'IA Store',      module: null,          color: '#00d4ff' },
      { path: '/store/skills', icon: Zap,      label: 'Skills Store',  module: 'skills',      color: '#f59e0b' },
      { path: '/store/agents', icon: Bot,      label: 'Agentes Store', module: 'agent_store', color: '#8b5cf6' },
    ],
  },
  {
    label: 'Telegram',
    items: [
      { path: '/telegram/bots',       icon: Radio,    label: 'Bots Telegram',    module: 'telegram', color: '#3b82f6' },
      { path: '/telegram/monitoring', icon: Activity, label: 'Monitor Telegram', module: 'telegram', color: '#10b981' },
    ],
  },
  {
    label: 'Configurações',
    items: [
      { path: '/settings/voice',    icon: Headphones, label: 'Voz da IA',     module: 'voz',  color: '#8b5cf6' },
      { path: '/settings/security', icon: ShieldCheck, label: 'Segurança 2FA', module: null,   color: '#10b981' },
    ],
  },
]


// ── FeatureRoute ───────────────────────────────────────────────────────────────
function FeatureRoute({ feature, children }) {
  const { hasFeature, loading } = usePlan()
  if (loading) return null
  if (!hasFeature(feature)) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100%', gap: 16, padding: 40,
      }}>
        <div style={{ fontSize: 48 }}>🔒</div>
        <h2 style={{ margin: 0, fontSize: 20 }}>Funcionalidade não disponível</h2>
        <p style={{ color: 'var(--text-secondary)', margin: 0, textAlign: 'center', maxWidth: 380, fontSize: 14 }}>
          Esta funcionalidade não está incluída no seu plano atual.
          Faça upgrade para ter acesso.
        </p>
        <a href="/billing" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '11px 24px', borderRadius: 12,
          background: 'linear-gradient(135deg, var(--nexus-violet), #6366f1)',
          color: '#fff', fontWeight: 700, fontSize: 14,
          textDecoration: 'none',
        }}>Ver planos</a>
      </div>
    )
  }
  return children
}

// ── RootRoute — rota pública "/": visitante vê a Landing, logado vai ao app ──
// Fica FORA do AppLayout de propósito: a landing não deve montar a sidebar/header
// (que chamam usePlan → /billing/quota → 401 e redirecionam o anônimo pro login).
function RootRoute() {
  const [state, setState] = useState('loading') // 'loading' | 'auth' | 'anon'

  useEffect(() => {
    api.me()
      .then(me => setState(me?.id ? 'auth' : 'anon'))
      .catch(() => setState('anon'))
  }, [])

  if (state === 'loading') return null
  if (state === 'auth') return <Navigate to="/inicio" replace />
  return <LandingPage />
}

// ── NavSidebar (desktop + mobile drawer) ──────────────────────────────────────
function NavSidebar({ apiOnline, ollamaOnline, user, collapsed, onToggle, isMobile, mobileOpen, onMobileClose }) {
  const planIcon    = PLAN_ICONS[user?.plan_name] || '🌱'
  const userName    = user?.name || '...'
  const userInitial = userName.charAt(0).toUpperCase()
  const isSuperAdmin = user?.is_superadmin === true
  const [showLogout, setShowLogout] = useState(false)
  const logoutRef = useRef(null)

  const { plan, planLabel, planColor, features, credits, loading: planLoading, paymentPending } = usePlan()
  const modules = features

  const hasModule = (mod) => {
    if (mod === null) return true
    if (modules.includes('*')) return true
    return modules.includes(mod)
  }

  const handleLogout = async () => {
    try { await api.post('/auth/logout') } catch {}
    localStorage.clear()
    window.location.href = '/login'
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (logoutRef.current && !logoutRef.current.contains(e.target)) {
        setShowLogout(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const W = isMobile ? 280 : (collapsed ? 64 : 220)
  const sidebarCollapsed = isMobile ? false : collapsed

  return (
    <>
      {/* Mobile backdrop */}
      {isMobile && mobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={onMobileClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 998,
            background: 'rgba(0,0,0,0.7)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            animation: 'fadeIn 0.2s ease',
          }}
        />
      )}
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideIn { from { transform: translateX(-100%) } to { transform: translateX(0) } }
        .nav-sidebar {
          width: ${W}px;
          transition: ${isMobile ? 'transform' : 'width'} 0.3s cubic-bezier(0.4,0,0.2,1);
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          background: var(--bg-surface);
          border-right: 1px solid var(--border-subtle);
          height: 100%;
          overflow: hidden;
          position: ${isMobile ? 'fixed' : 'relative'};
          ${isMobile ? `
            z-index: 999;
            top: 0; left: 0; bottom: 0;
            transform: translateX(${mobileOpen ? '0' : '-100%'});
            box-shadow: ${mobileOpen ? '8px 0 40px rgba(0,0,0,0.5)' : 'none'};
          ` : ''}
        }
        .sidebar-logo {
          padding: 14px 12px;
          border-bottom: 1px solid var(--border-subtle);
          display: flex;
          align-items: center;
          justify-content: ${sidebarCollapsed ? 'center' : 'space-between'};
          gap: 8px;
          min-height: 52px;
        }
        .sidebar-toggle {
          background: none;
          border: none;
          cursor: pointer;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          padding: 4px;
          border-radius: 6px;
          transition: all 0.15s;
          flex-shrink: 0;
        }
        .sidebar-toggle:hover { background: var(--bg-card); color: var(--text-primary); }
        .nav-scroll {
          flex: 1;
          padding: ${sidebarCollapsed ? '10px 6px' : '10px 8px'};
          overflow-y: auto;
          overflow-x: hidden;
          -webkit-overflow-scrolling: touch;
        }
        .nav-group-label {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 1.2px;
          color: var(--text-muted);
          padding: 6px 10px 4px;
          text-transform: uppercase;
          white-space: nowrap;
          overflow: hidden;
          opacity: ${sidebarCollapsed ? 0 : 1};
          height: ${sidebarCollapsed ? '0px' : 'auto'};
          transition: opacity 0.2s, height 0.2s;
        }
        .nav-item {
          display: flex;
          align-items: center;
          gap: ${sidebarCollapsed ? 0 : '9px'};
          padding: ${sidebarCollapsed ? '10px' : '8px 10px'};
          border-radius: 9px;
          margin-bottom: 2px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          text-decoration: none;
          transition: all 0.15s ease;
          justify-content: ${sidebarCollapsed ? 'center' : 'flex-start'};
          position: relative;
          white-space: nowrap;
          overflow: hidden;
        }
        .nav-item span.nav-label {
          opacity: ${sidebarCollapsed ? 0 : 1};
          width: ${sidebarCollapsed ? '0px' : 'auto'};
          overflow: hidden;
          transition: opacity 0.2s, width 0.2s;
        }
        .nav-item-active {
          color: var(--text-primary) !important;
          background: var(--bg-card);
          border-left: 3px solid var(--nexus-violet);
        }
        .nav-item-inactive {
          color: var(--text-muted);
          background: transparent;
          border-left: 3px solid transparent;
        }
        .nav-item:hover {
          background: var(--bg-card) !important;
          color: var(--text-primary) !important;
        }
        .nav-item-admin-active {
          color: var(--text-primary) !important;
          background: var(--bg-card);
          border-left: 3px solid var(--nexus-amber);
        }
        .sidebar-footer {
          padding: ${sidebarCollapsed ? '10px 6px' : '10px 12px'};
          border-top: 1px solid var(--border-subtle);
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .sidebar-status {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 10px;
          font-weight: 600;
          justify-content: ${sidebarCollapsed ? 'center' : 'flex-start'};
        }
        .sidebar-status-text {
          opacity: ${sidebarCollapsed ? 0 : 1};
          width: ${sidebarCollapsed ? '0px' : 'auto'};
          overflow: hidden;
          transition: opacity 0.2s;
          white-space: nowrap;
        }
        .logout-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: ${sidebarCollapsed ? '8px' : '7px 10px'};
          border-radius: 8px;
          border: 1px solid var(--border-subtle);
          background: transparent;
          cursor: pointer;
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
          transition: all 0.15s;
          justify-content: ${sidebarCollapsed ? 'center' : 'flex-start'};
        }
        .logout-btn:hover {
          background: #ef444415;
          border-color: #ef444440;
          color: #ef4444;
        }
        .logout-label {
          opacity: ${sidebarCollapsed ? 0 : 1};
          width: ${sidebarCollapsed ? '0px' : 'auto'};
          overflow: hidden;
          transition: opacity 0.2s;
          white-space: nowrap;
        }
        .user-card {
          display: flex;
          align-items: center;
          gap: ${sidebarCollapsed ? 0 : '8px'};
          padding: ${sidebarCollapsed ? '6px' : '8px 10px'};
          background: var(--bg-card);
          border-radius: 10px;
          border: 1px solid var(--border-subtle);
          cursor: pointer;
          text-decoration: none;
          transition: border-color 0.15s;
          justify-content: ${sidebarCollapsed ? 'center' : 'flex-start'};
          overflow: hidden;
        }
        .user-card:hover { border-color: var(--nexus-violet); }
        .user-info {
          flex: 1;
          min-width: 0;
          opacity: ${sidebarCollapsed ? 0 : 1};
          width: ${sidebarCollapsed ? '0px' : 'auto'};
          overflow: hidden;
          transition: opacity 0.2s;
        }
        .credits-badge {
          margin-top: 6px;
          padding: ${sidebarCollapsed ? '6px' : '8px 10px'};
          border-radius: 10px;
          cursor: pointer;
          transition: all 0.15s;
          overflow: hidden;
        }
        .credits-inner {
          display: flex;
          align-items: center;
          justify-content: ${sidebarCollapsed ? 'center' : 'space-between'};
        }
        .credits-label {
          font-size: 9px;
          color: var(--text-muted);
          margin-bottom: 3px;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          font-weight: 700;
          opacity: ${sidebarCollapsed ? 0 : 1};
          height: ${sidebarCollapsed ? '0px' : 'auto'};
          transition: opacity 0.2s;
        }
        .nav-tooltip {
          position: absolute;
          left: 72px;
          background: var(--bg-card);
          color: var(--text-primary);
          font-size: 12px;
          font-weight: 600;
          padding: 6px 10px;
          border-radius: 6px;
          border: 1px solid var(--border-subtle);
          white-space: nowrap;
          pointer-events: none;
          z-index: 9999;
          opacity: 0;
          transition: opacity 0.15s;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        }
        .nav-item:hover .nav-tooltip { opacity: ${sidebarCollapsed ? 1 : 0}; }
      `}</style>

      <nav className="nav-sidebar">
        {/* Logo + toggle */}
        <div className="sidebar-logo">
          {!sidebarCollapsed && <NexusLogo variant="horizontal" size={28} />}
          <button className="sidebar-toggle" onClick={isMobile ? onMobileClose : onToggle} title={isMobile ? 'Fechar menu' : (sidebarCollapsed ? 'Expandir menu' : 'Recolher menu')}>
            {isMobile ? <X size={18} /> : (sidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />)}
          </button>
        </div>

        {/* Nav groups */}
        <div className="nav-scroll">
          {/* Payment pending banner */}
          {paymentPending && !sidebarCollapsed && (
            <div
              onClick={() => window.location.href = '/billing'}
              style={{
                margin: '0 4px 10px', padding: '10px 12px', borderRadius: 12,
                background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(239,68,68,0.1))',
                border: '1px solid rgba(245,158,11,0.3)',
                cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 14 }}>⚠️</span>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#f59e0b', letterSpacing: 0.5 }}>
                  PAGAMENTO PENDENTE
                </span>
              </div>
              <div style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.4 }}>
                Módulos limitados até a confirmação do pagamento
              </div>
              <div style={{
                marginTop: 6, padding: '4px 10px', borderRadius: 6, fontSize: 9, fontWeight: 800,
                background: 'linear-gradient(135deg, #f59e0b, #ef4444)',
                color: 'white', textAlign: 'center', letterSpacing: 0.5,
              }}>PAGAR AGORA</div>
            </div>
          )}
          {NAV_GROUPS.map((group, gi) => {
            const visibleItems = group.items.filter(item => hasModule(item.module))
            if (visibleItems.length === 0) return null
            return (
              <div key={group.label || `group-${gi}`} style={{ marginBottom: 4 }}>
                {group.label && (
                  <div className="nav-group-label" style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: sidebarCollapsed ? '8px 0 4px' : '10px 10px 4px',
                    justifyContent: sidebarCollapsed ? 'center' : 'flex-start',
                  }}>
                    {!sidebarCollapsed && (
                      <>
                        <span style={{ flex: 1, height: 1, background: 'var(--border-subtle)', display: 'block' }} />
                        <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.1em', color: 'var(--text-muted)', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                          {group.label}
                        </span>
                        <span style={{ flex: 1, height: 1, background: 'var(--border-subtle)', display: 'block' }} />
                      </>
                    )}
                  </div>
                )}
                {visibleItems.map(item => {
                  const Icon = item.icon
                  const itemColor = item.color || 'var(--nexus-violet)'
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      end={item.exact}
                      className={({ isActive }) =>
                        `nav-item ${isActive ? 'nav-item-active' : 'nav-item-inactive'}`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <div style={{
                            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                            background: isActive ? `${itemColor}22` : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            transition: 'background 0.15s',
                          }}>
                            <Icon size={14} color={isActive ? itemColor : 'var(--text-muted)'} />
                          </div>
                          <span className="nav-label" style={{ flex: 1 }}>{item.label}</span>
                          {item.badge && !sidebarCollapsed && (
                            <span style={{
                              fontSize: 8, fontWeight: 800, padding: '2px 5px',
                              borderRadius: 4, background: `${itemColor}25`,
                              color: itemColor, letterSpacing: '0.05em',
                              border: `1px solid ${itemColor}40`,
                            }}>{item.badge}</span>
                          )}
                          {sidebarCollapsed && <span className="nav-tooltip">{item.label}</span>}
                        </>
                      )}
                    </NavLink>
                  )
                })}
              </div>
            )
          })}


          {/* Credits badge */}
          {!planLoading && credits && (
            <div
              className="credits-badge"
              style={{
                background: credits.balance < 100 ? '#ef444415' : 'var(--bg-surface)',
                border: `1px solid ${credits.balance < 100 ? '#ef444430' : 'var(--border-subtle)'}`,
              }}
              onClick={() => window.location.href = '/billing'}
            >
              <div className="credits-label">Créditos</div>
              <div className="credits-inner">
                <span style={{
                  fontSize: 14, fontWeight: 900,
                  color: credits.balance < 100 ? '#ef4444' : '#f59e0b',
                }}>🪙 {sidebarCollapsed ? '' : (credits.balance || 0).toLocaleString('pt-BR')}</span>
                {!sidebarCollapsed && credits.balance < 100 && (
                  <span style={{ fontSize: 9, color: '#ef4444', fontWeight: 700 }}>BAIXO</span>
                )}
              </div>
            </div>
          )}

          {/* Admin link */}
          {isSuperAdmin && (
            <div style={{ marginTop: 6, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
              {!sidebarCollapsed && (
                <div style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: 1.2,
                  color: 'var(--nexus-amber)', padding: '6px 10px 4px',
                  textTransform: 'uppercase',
                }}>Admin</div>
              )}
              <NavLink
                to="/admin/overview"
                className={({ isActive }) =>
                  `nav-item ${isActive ? 'nav-item-admin-active' : 'nav-item-inactive'}`
                }
              >
                {({ isActive }) => (
                  <>
                    <Server size={15} color={isActive ? 'var(--nexus-amber)' : 'var(--text-muted)'} style={{ flexShrink: 0 }} />
                    <span className="nav-label">Painel Admin</span>
                    {sidebarCollapsed && <span className="nav-tooltip">Painel Admin</span>}

                  </>
                )}
              </NavLink>
            </div>
          )}
        </div>

        {/* Footer: status + logout + user */}
        <div className="sidebar-footer">
          {/* Status indicators */}
          <div className="sidebar-status">
            {apiOnline
              ? <><Activity size={11} color="var(--nexus-green)" style={{ flexShrink: 0 }} /><span className="sidebar-status-text" style={{ color: 'var(--nexus-green)' }}>API Online</span></>
              : <><WifiOff size={11} color="var(--nexus-red)" style={{ flexShrink: 0 }} /><span className="sidebar-status-text" style={{ color: 'var(--nexus-red)' }}>API Offline</span></>
            }
          </div>

          {/* Logout button */}
          <button className="logout-btn" onClick={handleLogout} title="Sair da conta">
            <LogOut size={13} style={{ flexShrink: 0 }} />
            <span className="logout-label">Sair da conta</span>
          </button>

          {/* User card → profile */}
          <NavLink to="/profile" className="user-card">
            <div style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              background: `linear-gradient(135deg, ${planColor || 'var(--nexus-violet)'}, var(--nexus-cyan))`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700, color: 'white',
            }}>{userInitial}</div>
            <div className="user-info">
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {userName.split(' ')[0]}
              </div>
              <div style={{ fontSize: 9, color: planColor || 'var(--nexus-violet)', fontWeight: 700 }}>
                {planIcon} {planLabel}
              </div>
            </div>
            {!sidebarCollapsed && <Settings size={11} color="var(--text-muted)" style={{ flexShrink: 0 }} />}
          </NavLink>
        </div>
      </nav>
    </>
  )
}

// ── BottomNavBar (mobile only) ─────────────────────────────────────────────────
const BOTTOM_NAV_ITEMS = [
  { path: '/inicio', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { path: '/chat', icon: MessageSquare, label: 'Chat' },
  { path: '/flows', icon: GitBranch, label: 'Fluxos' },
  { path: '/store/ia', icon: ShoppingBag, label: 'Loja' },
]

function BottomNavBar({ onMenuClick }) {
  const location = useLocation()

  const isActive = (item) => item.exact
    ? location.pathname === item.path
    : location.pathname.startsWith(item.path)

  return (
    <>
      <style>{`
        .bottom-nav {
          position: fixed;
          bottom: 0; left: 0; right: 0;
          z-index: 997;
          background: rgba(13,10,31,0.95);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-top: 1px solid rgba(255,255,255,0.06);
          display: flex;
          align-items: stretch;
          height: 60px;
          padding-bottom: env(safe-area-inset-bottom, 0px);
          box-shadow: 0 -4px 24px rgba(0,0,0,0.5);
        }
        .bottom-nav-item {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 3px;
          background: transparent;
          border: none;
          cursor: pointer;
          text-decoration: none;
          padding: 6px 0;
          transition: all 0.2s;
          position: relative;
        }
        .bottom-nav-item .bnav-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px; height: 32px;
          border-radius: 10px;
          transition: all 0.2s;
        }
        .bottom-nav-item.active .bnav-icon {
          background: rgba(139,92,246,0.15);
        }
        .bottom-nav-item .bnav-label {
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.3px;
          color: var(--text-muted, #64748b);
          transition: color 0.2s;
          font-family: 'Inter', system-ui, sans-serif;
        }
        .bottom-nav-item.active .bnav-label {
          color: #a78bfa;
        }
        .bottom-nav-item.active::before {
          content: '';
          position: absolute;
          top: 0; left: 25%; right: 25%;
          height: 2px;
          background: linear-gradient(90deg, #7c3aed, #38bdf8);
          border-radius: 0 0 4px 4px;
        }
      `}</style>
      <nav className="bottom-nav">
        {BOTTOM_NAV_ITEMS.map(item => {
          const Icon = item.icon
          const active = isActive(item)
          return (
            <NavLink key={item.path} to={item.path} end={item.exact} className={`bottom-nav-item ${active ? 'active' : ''}`}>
              <div className="bnav-icon">
                <Icon size={20} color={active ? '#a78bfa' : 'var(--text-muted, #64748b)'} />
              </div>
              <span className="bnav-label">{item.label}</span>
            </NavLink>
          )
        })}
        <button className="bottom-nav-item" onClick={onMenuClick}>
          <div className="bnav-icon">
            <Menu size={20} color="var(--text-muted, #64748b)" />
          </div>
          <span className="bnav-label">Menu</span>
        </button>
      </nav>
    </>
  )
}

// ── PageHeader ─────────────────────────────────────────────────────────────────
function PageHeader({ isMobile, onHamburgerClick }) {
  const location = useLocation()
  const allItems = NAV_GROUPS.flatMap(g => g.items)
  const current = allItems.find(n => n.exact ? location.pathname === n.path : location.pathname.startsWith(n.path))
  const { credits, planLabel, planColor } = usePlan()
  const bal = credits?.balance ?? 0

  return (
    <div style={{
      padding: isMobile ? '0 12px' : '0 16px 0 20px',
      height: isMobile ? 50 : 42,
      flexShrink: 0,
      borderBottom: '1px solid var(--border-subtle)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: 'var(--bg-surface)',
      gap: 8,
    }}>
      {/* Left: hamburger (mobile) + breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
        {isMobile && (
          <button
            onClick={onHamburgerClick}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
              padding: 4, borderRadius: 8, flexShrink: 0,
            }}
          >
            <Menu size={20} />
          </button>
        )}
        {isMobile ? (
          <NexusLogo variant="horizontal" size={22} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Smart Moon</span>
            {current && <>
              <ChevronRight size={11} color="var(--text-muted)" />
              <span style={{ fontSize: 12, fontWeight: 600 }}>{current.label}</span>
            </>}
          </div>
        )}
      </div>

      {/* Credits badge */}
      <a href="/billing" style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: bal < 100 ? '#ef444415' : 'var(--bg-card)',
        border: `1px solid ${bal < 100 ? '#ef444430' : 'var(--border-subtle)'}`,
        borderRadius: 20, padding: '3px 12px 3px 8px',
        textDecoration: 'none', transition: 'all 0.2s',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 13 }}>🪙</span>
        <span style={{
          fontSize: 12, fontWeight: 800,
          color: bal < 100 ? '#ef4444' : '#f59e0b',
          animation: bal < 100 ? 'pulse 1.5s ease-in-out infinite' : 'none',
        }}>{bal.toLocaleString('pt-BR')}</span>
        {!isMobile && (
          <span style={{
            fontSize: 9, fontWeight: 700, color: '#fff',
            background: planColor || '#6366f1',
            padding: '1px 6px', borderRadius: 20, marginLeft: 2,
          }}>{planLabel}</span>
        )}
      </a>
    </div>
  )
}

// ── AppLayout ──────────────────────────────────────────────────────────────────
function AppLayout({ apiOnline, ollamaOnline, user }) {
  const isMobile = useIsMobile()
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()

  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar_collapsed') === 'true' } catch { return false }
  })

  // Close drawer on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  const toggleSidebar = () => {
    setCollapsed(prev => {
      const next = !prev
      try { localStorage.setItem('sidebar_collapsed', String(next)) } catch {}
      return next
    })
  }

  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: 'var(--bg-base)', fontFamily: 'Inter, sans-serif',
    }}>
      <ImpersonationBanner />
      <NavSidebar
        apiOnline={apiOnline}
        ollamaOnline={ollamaOnline}
        user={user}
        collapsed={collapsed}
        onToggle={toggleSidebar}
        isMobile={isMobile}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        paddingBottom: isMobile ? 60 : 0,
      }}>
        <PageHeader
          isMobile={isMobile}
          onHamburgerClick={() => setMobileOpen(true)}
        />
        <div id="main-scroll-container" style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <Suspense fallback={<PageLoader />}>
            <Outlet />
          </Suspense>
        </div>
      </div>
      {isMobile && (
        <BottomNavBar onMenuClick={() => setMobileOpen(prev => !prev)} />
      )}
      {user && <LunaCopilot />}
    </div>
  )
}

// ── App (root) ─────────────────────────────────────────────────────────────────
function App() {
  const [apiOnline, setApiOnline]       = useState(null)
  const [ollamaOnline, setOllamaOnline] = useState(null)
  const [user, setUser]                 = useState(null)

  const loadUser = useCallback(async () => {
    try {
      const me = await api.me()
      setUser(me)
    } catch {
      // Not authenticated
    }
  }, [])

  useEffect(() => {
    if (['/', '/login', '/register', '/checkout', '/landing'].includes(window.location.pathname)) return
    const check = async () => {
      const [h, o] = await Promise.allSettled([api.health(), api.ollamaRunning()])
      setApiOnline(h.value?.status === 'ok')
      setOllamaOnline(o.value === true)
    }
    check()
    loadUser()
    const t = setInterval(check, 15000)
    return () => clearInterval(t)
  }, [loadUser])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/landing" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Suspense fallback={<PageLoader />}><Register /></Suspense>} />
        <Route path="/aceitar-convite" element={<Suspense fallback={<PageLoader />}><AcceptInvite /></Suspense>} />
        <Route path="/checkout" element={<Suspense fallback={<PageLoader />}><Checkout /></Suspense>} />
        
        {/* Public Project Manager Routes */}
        <Route path="/p/:slug" element={<Suspense fallback={<PageLoader />}><PublicProjectLogin /></Suspense>} />
        <Route path="/p/:slug/dashboard" element={<Suspense fallback={<PageLoader />}><PublicProjectDashboard /></Suspense>} />

        {/* "/" é pública: landing para visitante, redirect para /inicio se logado */}
        <Route path="/" element={<RootRoute />} />

        <Route element={<AppLayout apiOnline={apiOnline} ollamaOnline={ollamaOnline} user={user} />}>
          <Route path="/inicio" element={<Dashboard />} />
          <Route path="/flows" element={<FlowsPage />} />
          <Route path="/flows/:id/builder" element={<FlowBuilderPage />} />
          <Route path="/executions" element={<Executions />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/integrations" element={<Integrations />} />
          <Route path="/integrations/api-publica" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><ApiPublicRequestPage /></Suspense></ErrorBoundary>} />
          <Route path="/clients" element={<Navigate to="/integrations" replace />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/agents/:id/sales-config" element={<SalesAgentConfig />} />
          <Route path="/billing" element={<Billing />} />
          <Route path="/billing/tokens" element={<TokenStorePage />} />
          <Route path="/voice-settings" element={<VoiceSettings />} />
          <Route path="/settings/voice" element={<VoiceSettingsV2 />} />
          <Route path="/telegram/bots" element={<TelegramBots />} />
          <Route path="/telegram/monitoring" element={<TelegramMonitor />} />
          <Route path="/telegram/monitoring/:id" element={<TelegramConversationDetail />} />
          <Route path="/campaigns" element={<CampaignPosts />} />
          <Route path="/campaigns/:id" element={<CampaignPostDetail />} />
          <Route path="/brand-kit" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><BrandKitPage /></Suspense></ErrorBoundary>} />
          <Route path="/studio" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><StudioPage /></Suspense></ErrorBoundary>} />
          <Route path="/studio/library" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><StudioLibraryPage /></Suspense></ErrorBoundary>} />
          <Route path="/crm" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><CRMContacts /></Suspense></ErrorBoundary>} />
          <Route path="/crm-recepcao" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><CRMReception /></Suspense></ErrorBoundary>} />
          <Route path="/crm-funil" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><CRMFunnel /></Suspense></ErrorBoundary>} />
          <Route path="/crm-equipe" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><CRMTeam /></Suspense></ErrorBoundary>} />
          <Route path="/crm-dashboard" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><CRMDashboard /></Suspense></ErrorBoundary>} />
          <Route path="/crm-campanhas" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><CRMBroadcasts /></Suspense></ErrorBoundary>} />
          <Route path="/crm-api-docs" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><CRMApiDocsPage /></Suspense></ErrorBoundary>} />
          <Route path="/bids" element={<BidsDashboard />} />
          <Route path="/bids/search" element={<BidsSearch />} />
          <Route path="/bids/alerts" element={<BidsAlerts />} />
          <Route path="/bids/niches" element={<BidsNiches />} />
          <Route path="/bids/:bidId" element={<BidDetail />} />
          <Route path="/projects" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><ProjectsListPage /></Suspense></ErrorBoundary>} />
          <Route path="/projects/:id" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><ProjectDashboard /></Suspense></ErrorBoundary>} />
          <Route path="/projects/:id/analytics" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><ProjectAnalytics /></Suspense></ErrorBoundary>} />
          <Route path="/projects/:id/team" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><ProjectTeamPage /></Suspense></ErrorBoundary>} />
          <Route path="/projects/:id/marketing" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><ProjectMarketingPage /></Suspense></ErrorBoundary>} />
          <Route path="/financial" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><FinancialPage /></Suspense></ErrorBoundary>} />
          <Route path="/admin-server" element={<AdminServer />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings/security" element={<Suspense fallback={<PageLoader />}><TwoFactorSetup /></Suspense>} />
          <Route path="/store/skills" element={<Suspense fallback={<PageLoader />}><SkillsStorePage /></Suspense>} />
          <Route path="/store/agents" element={<Suspense fallback={<PageLoader />}><AgentsStorePage /></Suspense>} />
          <Route path="/store/ia" element={<Suspense fallback={<PageLoader />}><IAStorePage /></Suspense>} />
          <Route path="/payments" element={<Suspense fallback={<PageLoader />}><PaymentsPage /></Suspense>} />
          <Route path="/payments/api-docs" element={<Suspense fallback={<PageLoader />}><GatewayApiDocsPage /></Suspense>} />
          <Route path="/store" element={<Navigate to="/store/skills" replace />} />
        </Route>

        {/* Admin Login — public route, no layout guard */}
        <Route path="/admin/login" element={<Suspense fallback={<PageLoader />}><AdminLoginPage /></Suspense>} />

        {/* Admin Panel — protected by AdminLayout (is_superadmin check) */}
        <Route path="/admin" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><AdminLayout /></Suspense></ErrorBoundary>}>
          <Route path="overview"          element={<ErrorBoundary><Suspense fallback={<PageLoader />}><AdminOverviewPage /></Suspense></ErrorBoundary>} />
          <Route path="users"             element={<ErrorBoundary><Suspense fallback={<PageLoader />}><AdminUsersPage /></Suspense></ErrorBoundary>} />
          <Route path="users/:id"         element={<ErrorBoundary><Suspense fallback={<PageLoader />}><AdminUserDetailPage /></Suspense></ErrorBoundary>} />
          <Route path="agents"            element={<ErrorBoundary><Suspense fallback={<PageLoader />}><AdminAgentsPage /></Suspense></ErrorBoundary>} />
          <Route path="skills"            element={<ErrorBoundary><Suspense fallback={<PageLoader />}><AdminSkillsPage /></Suspense></ErrorBoundary>} />
          <Route path="agent-store"       element={<ErrorBoundary><Suspense fallback={<PageLoader />}><AdminAgentStorePage /></Suspense></ErrorBoundary>} />
          <Route path="credits"           element={<ErrorBoundary><Suspense fallback={<PageLoader />}><AdminCreditsPage /></Suspense></ErrorBoundary>} />
          <Route path="voice"             element={<ErrorBoundary><Suspense fallback={<PageLoader />}><AdminVoicePage /></Suspense></ErrorBoundary>} />
          <Route path="voice-cloning"     element={<ErrorBoundary><Suspense fallback={<PageLoader />}><AdminVoiceCloningPage /></Suspense></ErrorBoundary>} />
          <Route path="voice-agents"      element={<ErrorBoundary><Suspense fallback={<PageLoader />}><AdminVoiceAgentsPage /></Suspense></ErrorBoundary>} />
          <Route path="marketing"         element={<ErrorBoundary><Suspense fallback={<PageLoader />}><AdminMarketingPage /></Suspense></ErrorBoundary>} />
          <Route path="templates"         element={<ErrorBoundary><Suspense fallback={<PageLoader />}><AdminTemplatesPage /></Suspense></ErrorBoundary>} />
          <Route path="campaigns"         element={<ErrorBoundary><Suspense fallback={<PageLoader />}><AdminCampaignsPage /></Suspense></ErrorBoundary>} />
          <Route path="licitation"        element={<ErrorBoundary><Suspense fallback={<PageLoader />}><AdminLicitationPage /></Suspense></ErrorBoundary>} />
          <Route path="flows"             element={<ErrorBoundary><Suspense fallback={<PageLoader />}><AdminFlowsPage /></Suspense></ErrorBoundary>} />
          <Route path="integrations"      element={<ErrorBoundary><Suspense fallback={<PageLoader />}><AdminIntegrationsPage /></Suspense></ErrorBoundary>} />
          <Route path="sales"             element={<ErrorBoundary><Suspense fallback={<PageLoader />}><AdminSalesPage /></Suspense></ErrorBoundary>} />
          <Route path="logs"              element={<ErrorBoundary><Suspense fallback={<PageLoader />}><AdminLogsPage /></Suspense></ErrorBoundary>} />
          <Route path="plans"             element={<ErrorBoundary><Suspense fallback={<PageLoader />}><AdminPlansPage /></Suspense></ErrorBoundary>} />
          <Route path="feature-overrides" element={<ErrorBoundary><Suspense fallback={<PageLoader />}><AdminFeatureOverridesPage /></Suspense></ErrorBoundary>} />
          <Route path="audit"             element={<ErrorBoundary><Suspense fallback={<PageLoader />}><AdminAuditPage /></Suspense></ErrorBoundary>} />
          <Route path="health"            element={<ErrorBoundary><Suspense fallback={<PageLoader />}><AdminHealthPage /></Suspense></ErrorBoundary>} />
          <Route path="settings"          element={<ErrorBoundary><Suspense fallback={<PageLoader />}><AdminSettingsPage /></Suspense></ErrorBoundary>} />
          <Route path="payments"          element={<ErrorBoundary><Suspense fallback={<PageLoader />}><AdminPaymentsPage /></Suspense></ErrorBoundary>} />
          <Route path="gateway"           element={<ErrorBoundary><Suspense fallback={<PageLoader />}><AdminGatewayPage /></Suspense></ErrorBoundary>} />
          <Route path="ai-tokens"         element={<ErrorBoundary><Suspense fallback={<PageLoader />}><AdminAITokensPage /></Suspense></ErrorBoundary>} />
          <Route path="smartmoon"          element={<ErrorBoundary><Suspense fallback={<PageLoader />}><AdminSmartMoonPage /></Suspense></ErrorBoundary>} />
          <Route path="api-publica"         element={<ErrorBoundary><Suspense fallback={<PageLoader />}><AdminApiPublicPage /></Suspense></ErrorBoundary>} />
          <Route path="api-docs"            element={<ErrorBoundary><Suspense fallback={<PageLoader />}><AdminApiDocsPage /></Suspense></ErrorBoundary>} />
          <Route path="luna"               element={<ErrorBoundary><Suspense fallback={<PageLoader />}><AdminLunaPage /></Suspense></ErrorBoundary>} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default function AppWithToast() {
  return (
    <ToastProvider>
      <App />
    </ToastProvider>
  )
}
