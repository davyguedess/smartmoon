/**
 * AdminLayout — Smart Moon Central Admin Panel
 * Premium dark layout with collapsible sidebar and module tabs
 * GUARD: only superadmin users can access /admin/* routes
 */
import React, { useState, useEffect, useRef } from 'react'
import { NavLink, Outlet, useLocation, useNavigate, Navigate } from 'react-router-dom'
import {
  LayoutDashboard, Users, Cpu, Zap, ShoppingBag, Sparkles,
  Volume2, Mic, Radio, Megaphone, Target, Landmark,
  GitBranch, Plug2, ShoppingCart, ScrollText, CreditCard,
  ToggleLeft, Shield, Activity, ChevronRight, Search,
  Bell, Settings, LogOut, Menu, X, ChevronDown,
  TrendingUp, Database, AlertTriangle, Globe, Coins,
  MessageSquare
} from 'lucide-react'

const ADMIN_MODULES = [
  {
    group: 'Overview',
    items: [
      { path: '/admin/overview', icon: LayoutDashboard, label: 'Visão Geral', color: '--nexus-cyan' },
      { path: '/admin/health', icon: Activity, label: 'Health', color: '--nexus-green' },
    ]
  },
  {
    group: 'Usuários & Planos',
    items: [
      { path: '/admin/users', icon: Users, label: 'Usuários', color: '--nexus-blue' },
      { path: '/admin/plans', icon: CreditCard, label: 'Planos', color: '--nexus-violet' },
      { path: '/admin/sales', icon: ShoppingCart, label: 'Vendas', color: '--nexus-green' },
      { path: '/admin/feature-overrides', icon: ToggleLeft, label: 'Overrides', color: '--nexus-amber' },
    ]
  },
  {
    group: 'Plataforma',
    items: [
      { path: '/admin/agents', icon: Cpu, label: 'Agentes', color: '--nexus-blue' },
      { path: '/admin/skills', icon: Zap, label: 'Skills Store', color: '--nexus-purple' },
      { path: '/admin/agent-store', icon: ShoppingBag, label: 'Agent Store', color: '--nexus-pink' },
      { path: '/admin/credits', icon: Coins, label: 'Créditos', color: '--nexus-amber' },
      { path: '/admin/flows', icon: GitBranch, label: 'Fluxos', color: '--nexus-amber' },
      { path: '/admin/integrations', icon: Plug2, label: 'Integrações', color: '--nexus-cyan' },
    ]
  },
  {
    group: 'Voz',
    items: [
      { path: '/admin/voice', icon: Volume2, label: 'Voz', color: '--nexus-cyan' },
      { path: '/admin/voice-cloning', icon: Mic, label: 'Clonagem', color: '--nexus-purple' },
      { path: '/admin/voice-agents', icon: Radio, label: 'Voice Agents', color: '--nexus-blue' },
    ]
  },
  {
    group: 'Marketing & Licitação',
    items: [
      { path: '/admin/marketing', icon: Megaphone, label: 'Marketing', color: '--nexus-pink' },
      { path: '/admin/campaigns', icon: Target, label: 'Campanhas IA', color: '--nexus-amber' },
      { path: '/admin/licitation', icon: Landmark, label: 'Licitação', color: '--nexus-green' },
    ]
  },
  {
    group: 'Observabilidade',
    items: [
      { path: '/admin/logs', icon: ScrollText, label: 'Logs', color: '--nexus-red' },
      { path: '/admin/audit', icon: Shield, label: 'Auditoria', color: '--nexus-violet' },
    ]
  },
  {
    group: '🌙 SmartMoon Engine',
    items: [
      { path: '/admin/smartmoon',   icon: MessageSquare, label: 'SM Overview',   color: '--nexus-cyan' },
      { path: '/admin/api-publica', icon: Globe,         label: '🌐 API Pública', color: '--nexus-violet' },
      { path: '/admin/api-docs',    icon: ScrollText,    label: '📄 Documentação', color: '--nexus-blue' },
      { path: '/admin/luna',        icon: Sparkles,      label: 'Luna Assistant', color: '--nexus-purple' },
    ]
  },
  {
    group: 'Financeiro',
    items: [
      { path: '/admin/payments', icon: Database, label: 'Gateway PIX', color: '--nexus-green' },
      { path: '/admin/gateway', icon: CreditCard, label: 'Configurar Gateway', color: '--nexus-cyan' },
      { path: '/admin/ai-tokens', icon: Sparkles, label: 'Tokens IA', color: '--nexus-violet' },
    ]
  },
]

function AdminSidebar({ collapsed, onToggle }) {
  const location = useLocation()

  return (
    <aside style={{
      width: collapsed ? 52 : 220,
      flexShrink: 0,
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      transition: 'width 0.2s ease',
      overflow: 'hidden',
      position: 'relative',
      zIndex: 10,
    }}>
      {/* Logo */}
      <div style={{
        padding: collapsed ? '14px 10px' : '14px 16px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexShrink: 0,
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 8, flexShrink: 0,
          background: 'linear-gradient(135deg, #7c3aed, #06b6d4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16,
          boxShadow: '0 0 16px rgba(124,58,237,0.4)',
        }}>🌙</div>
        {!collapsed && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1, color: '#a78bfa' }}>
              SM ADMIN
            </div>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 0.5 }}>
              Smart Moon
            </div>
          </div>
        )}
      </div>

      {/* Nav items */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {ADMIN_MODULES.map((group) => (
          <div key={group.group} style={{ marginBottom: 4 }}>
            {!collapsed && (
              <div style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 1.2, color: 'var(--text-muted)',
                padding: '8px 14px 4px', textTransform: 'uppercase',
              }}>
                {group.group}
              </div>
            )}
            {group.items.map(item => {
              const Icon = item.icon
              const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/')
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  title={collapsed ? item.label : undefined}
                  style={{
                    display: 'flex', alignItems: 'center',
                    gap: collapsed ? 0 : 8,
                    padding: collapsed ? '9px 14px' : '7px 12px',
                    margin: '1px 6px',
                    borderRadius: 8,
                    textDecoration: 'none',
                    color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                    background: isActive ? 'rgba(239,68,68,0.08)' : 'transparent',
                    borderLeft: isActive ? `2px solid #ef4444` : '2px solid transparent',
                    transition: 'all 0.15s ease',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) e.currentTarget.style.background = 'var(--bg-card)'
                  }}
                  onMouseLeave={e => {
                    if (!isActive) e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <Icon
                    size={14}
                    color={isActive ? '#ef4444' : 'var(--text-muted)'}
                    style={{ flexShrink: 0 }}
                  />
                  {!collapsed && (
                    <span style={{ fontSize: 12, fontWeight: isActive ? 700 : 500 }}>
                      {item.label}
                    </span>
                  )}
                </NavLink>
              )
            })}
          </div>
        ))}
      </div>

      {/* Collapse toggle */}
      <div style={{
        padding: '10px 8px',
        borderTop: '1px solid var(--border-subtle)',
      }}>
        <button
          onClick={onToggle}
          style={{
            width: '100%', padding: '7px',
            background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
            borderRadius: 8, cursor: 'pointer', color: 'var(--text-muted)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            fontSize: 11, fontWeight: 600, transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = '#ef4444'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-subtle)'}
        >
          <Menu size={13} />
          {!collapsed && <span>Recolher</span>}
        </button>
      </div>
    </aside>
  )
}

function AdminHeader() {
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  const currentModule = ADMIN_MODULES
    .flatMap(g => g.items)
    .find(i => i.path === location.pathname || location.pathname.startsWith(i.path + '/'))

  // Close on click outside
  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    if (menuOpen) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuOpen])

  // Close on route change
  useEffect(() => { setMenuOpen(false) }, [location.pathname])

  const handleLogout = async () => {
    try {
      const { api } = await import('../../api')
      await api.post('/auth/logout')
    } catch {}
    localStorage.removeItem('token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('admin_token')
    sessionStorage.clear()
    navigate('/admin/login', { replace: true })
  }

  const menuItems = [
    { icon: Settings, label: 'Configurações', desc: 'SMTP, Termos, Identidade', action: () => navigate('/admin/settings') },
    { icon: Activity, label: 'Health Check', desc: 'Status dos serviços', action: () => navigate('/admin/health') },
    { divider: true },
    { icon: LogOut, label: 'Encerrar Sessão', desc: 'Sair do painel admin', action: handleLogout, danger: true },
  ]

  return (
    <header style={{
      height: 50, flexShrink: 0,
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border-subtle)',
      display: 'flex', alignItems: 'center',
      padding: '0 20px', gap: 12,
    }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
        <button
          onClick={() => navigate('/admin/overview')}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12 }}
        >
          Smart Moon Admin
        </button>
        {currentModule && (
          <>
            <ChevronRight size={11} color="var(--text-muted)" />
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
              {currentModule.label}
            </span>
          </>
        )}
      </div>

      {/* Search */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
        borderRadius: 8, padding: '5px 12px', width: 240,
      }}>
        <Search size={12} color="var(--text-muted)" />
        <input
          placeholder="Buscar usuário, agente, tenant..."
          style={{ background: 'none', border: 'none', outline: 'none', fontSize: 12, color: 'var(--text-primary)', width: '100%' }}
        />
      </div>

      {/* Alerts */}
      <button style={{
        width: 34, height: 34, borderRadius: 8,
        background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', position: 'relative', color: 'var(--text-muted)',
      }}>
        <Bell size={14} />
        <span style={{
          position: 'absolute', top: 6, right: 6,
          width: 7, height: 7, borderRadius: '50%',
          background: '#ef4444',
          boxShadow: '0 0 6px rgba(239,68,68,0.6)',
        }} />
      </button>

      {/* Admin badge → Dropdown */}
      <div ref={menuRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: menuOpen ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${menuOpen ? 'rgba(239,68,68,0.4)' : 'rgba(239,68,68,0.2)'}`,
            borderRadius: 8, padding: '5px 12px', cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <Shield size={12} color="#ef4444" />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#ef4444' }}>SUPERADMIN</span>
          <ChevronDown size={11} color="#ef4444" style={{
            transition: 'transform 0.2s',
            transform: menuOpen ? 'rotate(180deg)' : 'rotate(0)',
          }} />
        </button>

        {/* Dropdown Menu */}
        {menuOpen && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0,
            width: 260, background: 'rgba(13, 10, 31, 0.97)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 14, overflow: 'hidden',
            boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
            animation: 'adminDropIn 0.15s ease-out',
            zIndex: 100,
          }}>
            {/* Profile section */}
            <div style={{
              padding: '16px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'linear-gradient(135deg, #7c3aed, #ef4444)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, boxShadow: '0 0 12px rgba(124,58,237,0.4)',
              }}>🌙</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#fff' }}>Smart Moon</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#ef4444', letterSpacing: 0.5 }}>Superadmin ativo</div>
              </div>
            </div>

            {/* Menu Items */}
            <div style={{ padding: '6px' }}>
              {menuItems.map((item, i) => {
                if (item.divider) {
                  return <div key={i} style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 8px' }} />
                }
                const Icon = item.icon
                return (
                  <button
                    key={i}
                    onClick={item.action}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 12px', borderRadius: 10, border: 'none',
                      background: 'transparent', cursor: 'pointer',
                      transition: 'all 0.15s ease', textAlign: 'left',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = item.danger ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.05)'
                    }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                  >
                    <div style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: item.danger ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.04)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Icon size={14} color={item.danger ? '#ef4444' : 'var(--text-muted)'} />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: item.danger ? '#ef4444' : '#e2e8f0' }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>{item.desc}</div>
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Footer */}
            <div style={{
              padding: '8px 16px 10px', borderTop: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 9, color: '#475569', fontWeight: 600, letterSpacing: 0.5 }}>
                Smart Moon v1.0.0
              </span>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes adminDropIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </header>
  )
}

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [authStatus, setAuthStatus] = useState('loading') // 'loading' | 'allowed' | 'denied'
  const navigate = useNavigate()

  useEffect(() => {
    // Verify superadmin status on every mount — prevents URL-bar bypass
    import('../../api').then(({ api }) => {
      api.me().then(user => {
        if (user?.is_superadmin === true) {
          setAuthStatus('allowed')
        } else {
          setAuthStatus('denied')
        }
      }).catch(() => {
        setAuthStatus('denied')
      })
    })
  }, [])

  if (authStatus === 'loading') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: 'var(--bg-base)', flexDirection: 'column', gap: 16,
      }}>
        <div style={{
          width: 40, height: 40, border: '3px solid var(--border-subtle)',
          borderTopColor: '#7c3aed', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Verificando permissões...</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (authStatus === 'denied') {
    return <Navigate to="/admin/login" replace />
  }

  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      background: 'var(--bg-base)', fontFamily: 'Inter, sans-serif',
    }}>
      <AdminSidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <AdminHeader />
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <Outlet />
        </div>
      </div>
    </div>
  )
}
