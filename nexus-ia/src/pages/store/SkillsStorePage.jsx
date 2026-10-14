/**
 * SkillsStorePage — Marketplace de Skills para o usuário.
 *
 * Rotas:
 *   /store/skills       → catálogo completo
 *   /store/my-skills    → instaladas pela empresa
 *
 * Integra com:
 *   GET  /store/skills              lista disponíveis
 *   GET  /store/my-skills           lista instaladas
 *   POST /store/skills/:id/install  instala (debita créditos)
 *   DEL  /store/skills/:id          desinstala
 */
import { useState, useEffect, useCallback } from 'react'
import {
  Zap, Search, ShoppingCart, CheckCircle2, Lock, X,
  RefreshCw, Coins, Star, Package, Sparkles, Filter,
  ChevronDown, ArrowLeft, Trash2, Download,
} from 'lucide-react'
import { api } from '../../api'
import { usePlan } from '../../hooks/usePlan'

// ── Category filter pills ──────────────────────────────────────────────────────
const CATEGORIES = ['Todos', 'Comunicação', 'IA', 'Automação', 'Analytics', 'Integrações', 'Exclusivo']

// ── Card de skill ──────────────────────────────────────────────────────────────
function SkillCard({ skill, installed, onInstall, onUninstall, installing, credits, planFeatures }) {
  const isFree = skill.price_credits === 0
  const canAfford = isFree || credits >= skill.price_credits
  const isExclusive = skill.is_exclusive
  const planOk = !skill.allowed_plans?.length ||
    skill.allowed_plans.includes('*') ||
    planFeatures.includes('*') ||
    skill.allowed_plans.some(p => planFeatures.includes(p) || planFeatures.includes('skills'))

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: `1px solid ${installed ? '#10b98130' : 'var(--border-subtle)'}`,
      borderRadius: 16,
      padding: 20,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      transition: 'all 0.2s',
      position: 'relative',
      overflow: 'hidden',
    }}
      onMouseOver={e => e.currentTarget.style.borderColor = installed ? '#10b98150' : 'var(--nexus-violet)40'}
      onMouseOut={e => e.currentTarget.style.borderColor = installed ? '#10b98130' : 'var(--border-subtle)'}
    >
      {/* Exclusive badge */}
      {isExclusive && (
        <div style={{
          position: 'absolute', top: 10, right: 10,
          background: 'linear-gradient(135deg,#f59e0b,#ef4444)',
          color: '#fff', fontSize: 9, fontWeight: 800,
          padding: '2px 8px', borderRadius: 20, letterSpacing: 0.5,
        }}>EXCLUSIVO</div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          background: installed ? 'linear-gradient(135deg,#10b98120,#6366f120)' : 'var(--bg-surface)',
          border: `1px solid ${installed ? '#10b98140' : 'var(--border-subtle)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
        }}>{skill.icon || '🔧'}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>{skill.name}</div>
          <div style={{
            fontSize: 10, color: 'var(--nexus-violet)', fontWeight: 700,
            background: 'var(--nexus-violet)15', padding: '1px 7px', borderRadius: 20,
            display: 'inline-block',
          }}>{skill.category || 'Geral'}</div>
        </div>
      </div>

      {/* Description */}
      <p style={{
        fontSize: 12, color: 'var(--text-secondary)', margin: 0,
        lineHeight: 1.5, display: '-webkit-box',
        WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
      }}>{skill.description || 'Skill de automação da plataforma.'}</p>

      {/* Tags */}
      {skill.tags?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {skill.tags.slice(0, 3).map(t => (
            <span key={t} style={{
              fontSize: 10, color: 'var(--text-muted)',
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              padding: '1px 7px', borderRadius: 20,
            }}>#{t}</span>
          ))}
        </div>
      )}

      {/* Footer: price + action */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
        {/* Price */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Coins size={13} color={isFree ? '#10b981' : '#f59e0b'} />
          <span style={{
            fontSize: 13, fontWeight: 800,
            color: isFree ? '#10b981' : '#f59e0b',
          }}>
            {isFree ? 'Grátis' : `${skill.price_credits} cr.`}
          </span>
        </div>

        {/* Action button */}
        {installed ? (
          <button
            onClick={() => onUninstall(skill.id)}
            disabled={installing === skill.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '7px 14px', borderRadius: 9, cursor: 'pointer',
              background: '#10b98120', border: '1px solid #10b98140',
              color: '#10b981', fontSize: 11, fontWeight: 700,
              transition: 'all 0.2s',
            }}
            onMouseOver={e => { e.currentTarget.style.background = '#ef444420'; e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.borderColor = '#ef444440' }}
            onMouseOut={e => { e.currentTarget.style.background = '#10b98120'; e.currentTarget.style.color = '#10b981'; e.currentTarget.style.borderColor = '#10b98140' }}
          >
            <CheckCircle2 size={12} />
            Instalado
          </button>
        ) : !planOk ? (
          <button disabled style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '7px 14px', borderRadius: 9, cursor: 'not-allowed',
            background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
            color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, opacity: 0.7,
          }}>
            <Lock size={11} /> Upgrade
          </button>
        ) : !canAfford ? (
          <button disabled style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '7px 14px', borderRadius: 9, cursor: 'not-allowed',
            background: '#ef444415', border: '1px solid #ef444430',
            color: '#ef4444', fontSize: 11, fontWeight: 700,
          }}>
            <Coins size={11} /> Sem créditos
          </button>
        ) : (
          <button
            onClick={() => onInstall(skill)}
            disabled={installing === skill.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '7px 14px', borderRadius: 9, cursor: 'pointer',
              background: 'linear-gradient(135deg, var(--nexus-violet), #6366f1)',
              border: 'none', color: '#fff', fontSize: 11, fontWeight: 700,
              opacity: installing === skill.id ? 0.6 : 1,
              transition: 'opacity 0.2s',
            }}
          >
            {installing === skill.id ? <RefreshCw size={11} style={{ animation: 'spin 0.7s linear infinite' }} /> : <Download size={11} />}
            {isFree ? 'Instalar' : `Instalar — ${skill.price_credits} cr.`}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Confirm install modal ──────────────────────────────────────────────────────
function ConfirmModal({ skill, credits, onConfirm, onCancel, loading }) {
  if (!skill) return null
  const isFree = skill.price_credits === 0
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onCancel}>
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 20, padding: 32, width: '100%', maxWidth: 400,
        animation: 'fadeUp 0.2s ease',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 32, marginBottom: 12, textAlign: 'center' }}>{skill.icon || '🔧'}</div>
        <h3 style={{ margin: '0 0 8px', textAlign: 'center', fontSize: 18 }}>Instalar "{skill.name}"?</h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, textAlign: 'center', margin: '0 0 20px' }}>
          {skill.description}
        </p>

        {!isFree && (
          <div style={{
            background: '#f59e0b15', border: '1px solid #f59e0b30',
            borderRadius: 12, padding: '12px 16px', marginBottom: 20,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Custo</span>
            <span style={{ fontWeight: 800, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Coins size={14} />{skill.price_credits} créditos
            </span>
          </div>
        )}
        {!isFree && (
          <div style={{
            background: 'var(--bg-surface)', borderRadius: 12, padding: '10px 16px',
            marginBottom: 20, display: 'flex', justifyContent: 'space-between',
            fontSize: 12, color: 'var(--text-muted)',
          }}>
            <span>Saldo disponível</span>
            <span style={{ fontWeight: 700, color: credits >= skill.price_credits ? '#10b981' : '#ef4444' }}>
              {credits} cr.
            </span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: '11px 0', borderRadius: 10,
            background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>Cancelar</button>
          <button onClick={onConfirm} disabled={loading} style={{
            flex: 1, padding: '11px 0', borderRadius: 10,
            background: 'linear-gradient(135deg, var(--nexus-violet), #6366f1)',
            border: 'none', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            opacity: loading ? 0.6 : 1,
          }}>
            {loading ? 'Instalando…' : isFree ? 'Instalar grátis' : `Confirmar — ${skill.price_credits} cr.`}
          </button>
        </div>
      </div>
      <style>{`@keyframes fadeUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }`}</style>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function SkillsStorePage() {
  const { credits, features: planFeatures, plan, planLabel, planColor, refresh: refreshPlan } = usePlan()
  const [tab, setTab] = useState('store') // 'store' | 'installed'
  const [skills, setSkills] = useState([])
  const [mySkills, setMySkills] = useState([])
  const [loading, setLoading] = useState(true)
  const [installing, setInstalling] = useState(null) // skill id
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('Todos')
  const [confirmSkill, setConfirmSkill] = useState(null)
  const [toast, setToast] = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [storeData, myData] = await Promise.all([
        api.store.listSkills({ search, category: category !== 'Todos' ? category : '' }),
        api.store.mySkills(),
      ])
      setSkills(storeData?.skills || storeData || [])
      setMySkills(myData?.skills || myData || [])
    } catch (e) {
      console.error('Store load error:', e)
    } finally {
      setLoading(false)
    }
  }, [search, category])

  useEffect(() => { load() }, [load])

  const installedIds = new Set(mySkills.map(s => s.skill_id || s.id))

  const handleInstall = async (skill) => {
    setInstalling(skill.id)
    setConfirmSkill(null)
    try {
      await api.store.installSkill(skill.id)
      showToast(`✅ "${skill.name}" instalada com sucesso!`)
      await load()
      refreshPlan()
    } catch (e) {
      const msg = e?.detail || e?.message || 'Erro ao instalar'
      showToast(`❌ ${msg}`, 'error')
    } finally {
      setInstalling(null)
    }
  }

  const handleUninstall = async (skillId) => {
    setInstalling(skillId)
    try {
      await api.store.uninstallSkill(skillId)
      showToast('Skill removida.')
      await load()
      refreshPlan()
    } catch (e) {
      showToast(`❌ ${e?.detail || 'Erro ao remover'}`, 'error')
    } finally {
      setInstalling(null)
    }
  }

  const filtered = tab === 'installed'
    ? mySkills
    : skills.filter(s => {
      const matchSearch = !search || s.name?.toLowerCase().includes(search.toLowerCase()) || s.description?.toLowerCase().includes(search.toLowerCase())
      const matchCat = category === 'Todos' || s.category === category
      return matchSearch && matchCat
    })

  return (
    <div className="skills-store-page" style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <style>{`
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @media (max-width: 768px) {
          .skills-store-page { padding: 16px !important; }
          .skills-header { flex-direction: column !important; align-items: stretch !important; gap: 12px !important; }
          .skills-header h1 { font-size: 18px !important; }
          .skills-filters { flex-direction: column !important; }
          .skills-categories { overflow-x: auto; -webkit-overflow-scrolling: touch; flex-wrap: nowrap !important; padding-bottom: 4px; }
          .skills-categories button { flex-shrink: 0 !important; }
          .skills-grid { grid-template-columns: 1fr !important; gap: 12px !important; }
          .skills-tabs { font-size: 12px !important; }
          .skills-tabs button { padding: 8px 10px !important; font-size: 12px !important; }
          .skills-confirm-modal { padding: 20px !important; margin: 16px !important; }
        }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 99999,
          background: toast.type === 'error' ? '#ef444420' : '#10b98120',
          border: `1px solid ${toast.type === 'error' ? '#ef4444' : '#10b981'}40`,
          color: toast.type === 'error' ? '#ef4444' : '#10b981',
          padding: '12px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600,
          animation: 'fadeUp 0.2s ease',
          backdropFilter: 'blur(8px)',
        }}>{toast.msg}</div>
      )}

      {/* Header */}
      <div className="skills-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: '0 0 6px', fontSize: 24, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sparkles size={22} color="var(--nexus-violet)" />
            Skills Store
          </h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 13 }}>
            Expanda as capacidades do seu assistente com skills especializadas
          </p>
        </div>

        {/* Credits badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          borderRadius: 12, padding: '10px 16px',
        }}>
          <Coins size={16} color="#f59e0b" />
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, color: '#f59e0b', lineHeight: 1 }}>
              {(credits?.balance ?? 0).toLocaleString('pt-BR')}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>créditos</div>
          </div>
          <div style={{
            fontSize: 10, fontWeight: 700, color: '#fff',
            background: planColor || 'var(--nexus-violet)',
            padding: '2px 8px', borderRadius: 20, marginLeft: 4,
          }}>{planLabel}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="skills-tabs" style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-surface)', borderRadius: 12, padding: 4 }}>
        {[
          { id: 'store', label: 'Explorar Store', icon: ShoppingCart },
          { id: 'installed', label: `Minhas Skills (${mySkills.length})`, icon: Package },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            padding: '9px 16px', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: tab === t.id ? 'var(--bg-card)' : 'transparent',
            border: tab === t.id ? '1px solid var(--border-subtle)' : '1px solid transparent',
            color: tab === t.id ? 'var(--text-primary)' : 'var(--text-muted)',
            transition: 'all 0.15s',
          }}>
            <t.icon size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Filters (only on store tab) */}
      {tab === 'store' && (
        <div className="skills-filters" style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
            borderRadius: 10, padding: '8px 14px', flex: 1, minWidth: 200,
          }}>
            <Search size={14} color="var(--text-muted)" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar skills…"
              style={{
                background: 'transparent', border: 'none', outline: 'none',
                color: 'var(--text-primary)', fontSize: 13, width: '100%',
              }}
            />
            {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}><X size={13} /></button>}
          </div>

          {/* Category pills */}
          <div className="skills-categories" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {CATEGORIES.map(cat => (
              <button key={cat} onClick={() => setCategory(cat)} style={{
                padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: category === cat ? 'var(--nexus-violet)' : 'var(--bg-card)',
                border: `1px solid ${category === cat ? 'var(--nexus-violet)' : 'var(--border-subtle)'}`,
                color: category === cat ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.15s',
              }}>{cat}</button>
            ))}
          </div>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="skills-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {[...Array(6)].map((_, i) => (
            <div key={i} style={{
              height: 200, background: 'var(--bg-card)',
              borderRadius: 16, border: '1px solid var(--border-subtle)',
              animation: 'pulse 1.5s ease-in-out infinite',
              opacity: 0.5,
            }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', paddingTop: 80, color: 'var(--text-muted)' }}>
          <Package size={40} style={{ opacity: 0.3, marginBottom: 12 }} />
          <p style={{ fontSize: 14, margin: 0 }}>
            {tab === 'installed' ? 'Nenhuma skill instalada ainda.' : 'Nenhuma skill encontrada.'}
          </p>
          {tab === 'installed' && (
            <button onClick={() => setTab('store')} style={{
              marginTop: 16, padding: '10px 20px', borderRadius: 10,
              background: 'var(--nexus-violet)', border: 'none',
              color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}>Explorar Store</button>
          )}
        </div>
      ) : (
        <div className="skills-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {filtered.map(skill => (
            <SkillCard
              key={skill.id}
              skill={skill}
              installed={installedIds.has(skill.id)}
              installing={installing}
              credits={credits?.balance ?? 0}
              planFeatures={planFeatures}
              onInstall={(s) => setConfirmSkill(s)}
              onUninstall={handleUninstall}
            />
          ))}
        </div>
      )}

      {/* Confirm modal */}
      <ConfirmModal
        skill={confirmSkill}
        credits={credits?.balance ?? 0}
        onConfirm={() => handleInstall(confirmSkill)}
        onCancel={() => setConfirmSkill(null)}
        loading={installing === confirmSkill?.id}
      />
    </div>
  )
}
