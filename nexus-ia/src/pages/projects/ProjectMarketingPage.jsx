import React, { useState, useEffect, useCallback } from 'react'
import { useParams, NavLink } from 'react-router-dom'
import { api } from '../../api'
import {
  ChevronLeft, Loader2, Trophy, Megaphone, CreditCard, MapPin,
  CheckCircle2, Circle, Clock, AlertCircle, Users, DollarSign,
  TrendingUp, ShieldAlert, Zap, BarChart3, Target, ArrowRight,
  ChevronDown, ChevronUp, Plus, Save, X
} from 'lucide-react'

const ACTIONS = [
  {
    id: 'copa_do_mundo',
    title: 'Copa do Mundo',
    subtitle: 'Ativação por Brindes Coletivos',
    icon: Trophy,
    color: '#f59e0b',
    gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
    budget: 'R$ 100,00/cliente',
    minProtocol: 'R$ 1.200,00',
    duration: '30 dias',
    team: ['Douglas', 'Flavia', 'Geovana'],
    tasks: [
      { id: 'copa_1', text: 'Cotação e compra de Camisas (R$ 70)', responsible: 'Flavia', days: 5 },
      { id: 'copa_2', text: 'Cotação e compra de Bonés (R$ 30)', responsible: 'Flavia', days: 5 },
      { id: 'copa_3', text: 'Estruturar oferta do Protocolo Y (mín R$ 1.200)', responsible: 'Douglas', days: 3 },
      { id: 'copa_4', text: 'Criar arte de divulgação campanha Copa', responsible: 'Douglas', days: 5 },
      { id: 'copa_5', text: 'Treinar Geovana no pitch de vendas Copa', responsible: 'Geovana', days: 3 },
    ],
    kpis: [
      { label: 'Custo Brinde/Lead', target: '≤ R$ 100', icon: DollarSign },
      { label: 'Protocolo Mín.', target: 'R$ 1.200', icon: Target },
      { label: 'Margem Brinde', target: '< 9%', icon: TrendingUp },
    ],
  },
  {
    id: 'propagacao',
    title: 'Propagação & Divulgação',
    subtitle: 'Tráfego 35% / 15% / 50%',
    icon: Megaphone,
    color: '#6366f1',
    gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    budget: 'R$ 3k–5k/mês',
    duration: 'Contínuo',
    team: ['Douglas', 'Geovana', 'Davy'],
    tasks: [
      { id: 'prop_1', text: 'Configurar campanha 35% Reconhecimento (Público Frio)', responsible: 'Douglas', days: 5 },
      { id: 'prop_2', text: 'Subir lista de clientes no Meta/Google Ads (15% Remarketing)', responsible: 'Douglas', days: 3 },
      { id: 'prop_3', text: 'Configurar campanha 50% Conversão Direta → Checkout', responsible: 'Douglas', days: 5 },
      { id: 'prop_4', text: 'Validar checkout automatizado sem quedas', responsible: 'Davy', days: 3 },
      { id: 'prop_5', text: 'Mapear carrinhos abandonados para Geovana atuar', responsible: 'Geovana', days: 2 },
    ],
    kpis: [
      { label: 'Reconhecimento', target: '35%', icon: BarChart3 },
      { label: 'Remarketing', target: '15%', icon: Users },
      { label: 'Conversão', target: '50%', icon: Zap },
    ],
  },
  {
    id: 'all_win',
    title: 'All Win — Fintechs',
    subtitle: 'Parcelamento & BNPL',
    icon: CreditCard,
    color: '#10b981',
    gradient: 'linear-gradient(135deg, #10b981, #059669)',
    budget: 'Taxa 4%–12%',
    duration: '15 dias',
    team: ['Flavia', 'Jota', 'Davy'],
    tasks: [
      { id: 'win_1', text: 'Cadastro institucional na CAPIM (Financiamento e Carnê)', responsible: 'Flavia', days: 7 },
      { id: 'win_2', text: 'Cadastro na CONTSELF (Saúde Pay/Parcelamento Pay)', responsible: 'Flavia', days: 7 },
      { id: 'win_3', text: 'Cadastro na PROVU (Boleto Parcelado)', responsible: 'Flavia', days: 7 },
      { id: 'win_4', text: 'Aprovação jurídica dos contratos fintech', responsible: 'Jota', days: 10 },
      { id: 'win_5', text: 'Integração técnica checkout + CLINICORP', responsible: 'Davy', days: 10 },
    ],
    kpis: [
      { label: 'Ticket Médio', target: 'R$ 3k–10k', icon: DollarSign },
      { label: 'Inadimplência', target: 'Zero', icon: ShieldAlert },
      { label: 'Plataformas', target: '3 ativas', icon: Zap },
    ],
  },
  {
    id: 'rua_estruturada',
    title: 'Rua Estruturada',
    subtitle: 'Panfletagem → QR Code → Lead',
    icon: MapPin,
    color: '#ec4899',
    gradient: 'linear-gradient(135deg, #ec4899, #db2777)',
    budget: 'R$ 800–1.200/ação',
    duration: 'Sex & Sáb',
    team: ['Douglas', 'Fabiani'],
    tasks: [
      { id: 'rua_1', text: 'Criar arte do panfleto com QR Code obrigatório', responsible: 'Douglas', days: 5 },
      { id: 'rua_2', text: 'Criar Landing Page de captura (Nome + WhatsApp + Email)', responsible: 'Davy', days: 5 },
      { id: 'rua_3', text: 'Imprimir 5.000 panfletos de alta qualidade', responsible: 'Douglas', days: 7 },
      { id: 'rua_4', text: 'Contratar 2 promotores de rua', responsible: 'Fabiani', days: 5 },
      { id: 'rua_5', text: 'Preparar recepção para novos cadastros', responsible: 'Fabiani', days: 3 },
    ],
    kpis: [
      { label: 'Panfletos', target: '5.000', icon: Target },
      { label: 'Leads/Ação', target: 'Rastrear', icon: TrendingUp },
      { label: 'Custo/Ação', target: '≤ R$ 1.200', icon: DollarSign },
    ],
  },
]

function ActionCard({ action, taskStates, onToggleTask, expanded, onToggleExpand }) {
  const Icon = action.icon
  const completedCount = action.tasks.filter(t => taskStates[t.id]).length
  const totalTasks = action.tasks.length
  const progress = Math.round((completedCount / totalTasks) * 100)

  return (
    <div style={{
      background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(99,102,241,0.12)',
      borderRadius: 20, overflow: 'hidden', transition: 'border-color 0.2s',
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = `${action.color}40`}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(99,102,241,0.12)'}
    >
      {/* Header */}
      <div style={{ padding: '20px 24px', cursor: 'pointer' }} onClick={onToggleExpand}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `${action.color}15`, border: `1px solid ${action.color}30`,
              boxShadow: `0 0 20px ${action.color}10`,
            }}>
              <Icon style={{ width: 22, height: 22, color: action.color }} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.02em' }}>{action.title}</div>
              <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{action.subtitle}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: action.color }}>{progress}%</div>
              <div style={{ fontSize: 10, color: '#475569', fontWeight: 600 }}>{completedCount}/{totalTasks}</div>
            </div>
            {expanded
              ? <ChevronUp style={{ width: 18, height: 18, color: '#475569' }} />
              : <ChevronDown style={{ width: 18, height: 18, color: '#475569' }} />}
          </div>
        </div>
        {/* Progress bar */}
        <div style={{ marginTop: 14, height: 4, borderRadius: 4, background: 'rgba(148,163,184,0.08)', overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 4, transition: 'width 0.5s ease',
            width: `${progress}%`, background: action.gradient,
            boxShadow: `0 0 8px ${action.color}40`,
          }} />
        </div>
      </div>

      {/* KPIs */}
      <div style={{
        display: 'grid', gridTemplateColumns: `repeat(${action.kpis.length}, 1fr)`,
        borderTop: '1px solid rgba(99,102,241,0.06)', borderBottom: expanded ? '1px solid rgba(99,102,241,0.06)' : 'none',
      }}>
        {action.kpis.map((kpi, i) => (
          <div key={i} style={{
            padding: '12px 10px', textAlign: 'center',
            borderRight: i < action.kpis.length - 1 ? '1px solid rgba(99,102,241,0.06)' : 'none',
          }}>
            <kpi.icon style={{ width: 14, height: 14, color: action.color, margin: '0 auto 4px', opacity: 0.7 }} />
            <div style={{ fontSize: 13, fontWeight: 800, color: '#e2e8f0' }}>{kpi.target}</div>
            <div style={{ fontSize: 9, color: '#475569', fontWeight: 600, marginTop: 2, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Meta */}
      {expanded && (
        <div style={{ padding: '12px 24px', display: 'flex', gap: 12, flexWrap: 'wrap', borderBottom: '1px solid rgba(99,102,241,0.06)' }}>
          {[
            { label: 'Orçamento', value: action.budget },
            { label: 'Duração', value: action.duration },
            { label: 'Equipe', value: action.team.join(', ') },
          ].map((m, i) => (
            <div key={i} style={{ padding: '6px 12px', borderRadius: 8, background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(99,102,241,0.06)', fontSize: 11 }}>
              <span style={{ color: '#475569', fontWeight: 700 }}>{m.label}: </span>
              <span style={{ color: '#94a3b8', fontWeight: 600 }}>{m.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tasks */}
      {expanded && (
        <div style={{ padding: '16px 24px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#475569', marginBottom: 10 }}>
            Checklist de Tarefas
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {action.tasks.map(task => {
              const done = taskStates[task.id]
              return (
                <div key={task.id}
                  onClick={() => onToggleTask(task.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                    borderRadius: 12, cursor: 'pointer', transition: 'all 0.15s',
                    background: done ? `${action.color}08` : 'rgba(15,23,42,0.4)',
                    border: done ? `1px solid ${action.color}20` : '1px solid rgba(99,102,241,0.06)',
                  }}
                  onMouseEnter={e => { if (!done) e.currentTarget.style.background = 'rgba(99,102,241,0.04)' }}
                  onMouseLeave={e => { if (!done) e.currentTarget.style.background = 'rgba(15,23,42,0.4)' }}
                >
                  {done
                    ? <CheckCircle2 style={{ width: 18, height: 18, color: action.color, flexShrink: 0 }} />
                    : <Circle style={{ width: 18, height: 18, color: '#334155', flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 600, color: done ? '#64748b' : '#e2e8f0',
                      textDecoration: done ? 'line-through' : 'none',
                    }}>{task.text}</div>
                    <div style={{ fontSize: 10, color: '#475569', marginTop: 2, display: 'flex', gap: 8 }}>
                      <span>👤 {task.responsible}</span>
                      <span>⏱ {task.days} dias</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ProjectMarketingPage() {
  const { id } = useParams()
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [expandedCards, setExpandedCards] = useState({ copa_do_mundo: true })
  const [taskStates, setTaskStates] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`mkt_tasks_${id}`) || '{}') } catch { return {} }
  })

  useEffect(() => {
    api.get(`/projects/${id}/dashboard`).then(r => { setProject(r.project); setLoading(false) }).catch(() => setLoading(false))
  }, [id])

  useEffect(() => {
    localStorage.setItem(`mkt_tasks_${id}`, JSON.stringify(taskStates))
  }, [taskStates, id])

  const toggleTask = useCallback((taskId) => {
    setTaskStates(prev => ({ ...prev, [taskId]: !prev[taskId] }))
  }, [])

  const toggleExpand = useCallback((actionId) => {
    setExpandedCards(prev => ({ ...prev, [actionId]: !prev[actionId] }))
  }, [])

  const totalTasks = ACTIONS.reduce((s, a) => s + a.tasks.length, 0)
  const totalDone = ACTIONS.reduce((s, a) => s + a.tasks.filter(t => taskStates[t.id]).length, 0)
  const globalProgress = totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <Loader2 style={{ width: 36, height: 36, color: '#6366f1', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto', overflowY: 'auto', height: '100%', scrollbarWidth: 'thin', scrollbarColor: 'rgba(99,102,241,0.2) transparent' }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <NavLink to={`/projects/${id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(148,163,184,0.5)', textDecoration: 'none', marginBottom: 20 }}>
          <ChevronLeft style={{ width: 14, height: 14 }} /> Voltar ao Dashboard
        </NavLink>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 900, color: '#f1f5f9', letterSpacing: '-0.03em', margin: 0 }}>
              📈 Ações de Marketing
            </h1>
            <p style={{ fontSize: 14, color: '#475569', marginTop: 6, fontWeight: 500 }}>
              {project?.name} · Plano Estratégico de Crescimento
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: '#6366f1' }}>{globalProgress}%</div>
              <div style={{ fontSize: 11, color: '#475569', fontWeight: 600 }}>{totalDone}/{totalTasks} tarefas</div>
            </div>
            <div style={{ width: 56, height: 56, borderRadius: 16, border: '3px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <svg width="50" height="50" viewBox="0 0 50 50">
                <circle cx="25" cy="25" r="20" fill="none" stroke="rgba(99,102,241,0.1)" strokeWidth="4" />
                <circle cx="25" cy="25" r="20" fill="none" stroke="#6366f1" strokeWidth="4"
                  strokeDasharray={`${globalProgress * 1.256} 999`} strokeLinecap="round"
                  transform="rotate(-90 25 25)" style={{ transition: 'stroke-dasharray 0.5s ease' }} />
              </svg>
              <TrendingUp style={{ position: 'absolute', width: 16, height: 16, color: '#6366f1' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Voucher Veto Alert */}
      <div style={{
        padding: '16px 20px', borderRadius: 16, marginBottom: 24,
        background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12, flexShrink: 0,
          background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <ShieldAlert style={{ width: 20, height: 20, color: '#f87171' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#fca5a5', marginBottom: 3 }}>
            🚫 VETO ABSOLUTO: Vouchers de 100%
          </div>
          <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
            Toda ação promocional exige <strong style={{ color: '#fca5a5' }}>co-participação mínima de 10%–20%</strong> do valor do serviço.
            Proibido distribuir cortesias gratuitas — desvaloriza os procedimentos e atrai o público errado.
          </div>
        </div>
      </div>

      {/* Traffic Distribution Overview */}
      <div style={{
        padding: '20px 24px', borderRadius: 16, marginBottom: 24,
        background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(99,102,241,0.1)',
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#475569', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          <BarChart3 style={{ width: 13, height: 13, color: '#6366f1' }} /> Distribuição de Tráfego Pago
        </div>
        <div style={{ display: 'flex', gap: 4, height: 28, borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ width: '35%', background: 'linear-gradient(90deg, #6366f1, #818cf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff' }}>
            35% Reconhecimento
          </div>
          <div style={{ width: '15%', background: 'linear-gradient(90deg, #f59e0b, #fbbf24)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#000' }}>
            15%
          </div>
          <div style={{ width: '50%', background: 'linear-gradient(90deg, #10b981, #34d399)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff' }}>
            50% Conversão Direta
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, color: '#475569' }}>
          <span>Público Frio</span>
          <span>Remarketing</span>
          <span>Checkout Automatizado</span>
        </div>
      </div>

      {/* Action Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {ACTIONS.map(action => (
          <ActionCard
            key={action.id}
            action={action}
            taskStates={taskStates}
            onToggleTask={toggleTask}
            expanded={!!expandedCards[action.id]}
            onToggleExpand={() => toggleExpand(action.id)}
          />
        ))}
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
