import { useState, useEffect, useCallback } from 'react'
import {
  Palette, Monitor, Radio, Instagram, Search, ChevronDown, ChevronUp,
  Edit3, Check, X, RefreshCw, TrendingUp, Users, Zap, Image
} from 'lucide-react'
import { api } from '../../api'
import { useToast } from '../../components/ui/Toast'

// ── Helpers ────────────────────────────────────────────────────────────────────

const MODULE_CONFIG = {
  has_brand_kit:    { label: 'Brand Kit',     icon: Palette,  color: '#a78bfa', desc: 'Identidade visual + pré-prompt IA' },
  has_studio:       { label: 'Studio',        icon: Image,    color: '#06b6d4', desc: 'Editor de artes tipo Canva' },
  has_traffic_pro:  { label: 'Tráfego Pro',   icon: Radio,    color: '#f59e0b', desc: 'Meta Ads gerenciado por IA' },
  has_ig_campaigns: { label: 'Campanhas IG',  icon: Instagram,color: '#10b981', desc: 'Publicação orgânica no Instagram' },
}

function ModuleToggle({ moduleKey, value, limit, onToggle, onLimitChange }) {
  const cfg = MODULE_CONFIG[moduleKey]
  const Icon = cfg.icon
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '10px 14px', borderRadius: 10,
      background: value ? `${cfg.color}12` : 'rgba(255,255,255,0.03)',
      border: `1px solid ${value ? cfg.color + '30' : 'rgba(255,255,255,0.07)'}`,
      transition: 'all 0.2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: value ? `${cfg.color}20` : 'rgba(255,255,255,0.06)',
        }}>
          <Icon size={15} color={value ? cfg.color : '#475569'} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: value ? '#f1f5f9' : '#64748b' }}>{cfg.label}</div>
          <div style={{ fontSize: 11, color: '#475569' }}>{cfg.desc}</div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {moduleKey === 'has_studio' && value && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 11, color: '#475569' }}>Limite/mês:</span>
            <input
              type="number" value={limit || 50} min={0}
              onChange={e => onLimitChange(parseInt(e.target.value))}
              style={{
                width: 60, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6, color: '#f1f5f9', fontSize: 12, padding: '3px 6px', outline: 'none',
              }}
            />
          </div>
        )}
        <button
          onClick={() => onToggle(moduleKey, !value)}
          style={{
            width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
            background: value ? cfg.color : 'rgba(255,255,255,0.1)',
            position: 'relative', transition: 'all 0.2s',
          }}
        >
          <span style={{
            position: 'absolute', top: 3, left: value ? 23 : 3,
            width: 18, height: 18, borderRadius: '50%', background: '#fff',
            transition: 'left 0.2s',
          }} />
        </button>
      </div>
    </div>
  )
}

// ── Row de empresa ─────────────────────────────────────────────────────────────

function CompanyRow({ company, onModuleChange }) {
  const toast = useToast()
  const [expanded, setExpanded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [mods, setMods] = useState({
    has_brand_kit: company.has_brand_kit,
    has_studio: company.has_studio,
    has_traffic_pro: company.has_traffic_pro,
    has_ig_campaigns: company.has_ig_campaigns,
    studio_limit: company.studio_limit,
  })
  const [notes, setNotes] = useState(company.notes || '')

  const activeCount = Object.keys(MODULE_CONFIG).filter(k => mods[k]).length

  const handleToggle = (key, val) => setMods(m => ({ ...m, [key]: val }))
  const handleLimit = (val) => setMods(m => ({ ...m, studio_limit: val }))

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    try {
      await api.patch(`/admin/marketing/clients/${company.company_id}/modules`, { ...mods, notes })
      toast.success(`Módulos de "${company.company_name}" atualizados!`)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      onModuleChange()
    } catch (e) {
      toast.error('Erro ao salvar: ' + (e.message || 'verifique o console'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 12, overflow: 'hidden', transition: 'all 0.2s',
    }}>
      {/* Header */}
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', cursor: 'pointer' }}
        onClick={() => setExpanded(e => !e)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg, #6366f1, #a78bfa)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 700, color: '#fff',
          }}>{(company.company_name || 'E')[0].toUpperCase()}</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9' }}>{company.company_name}</div>
            <div style={{ fontSize: 11, color: '#475569' }}>Plano: {company.plan || '—'}</div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Badges dos módulos ativos */}
          <div style={{ display: 'flex', gap: 4 }}>
            {Object.entries(MODULE_CONFIG).map(([key, cfg]) => {
              const Icon = cfg.icon
              return mods[key] ? (
                <span key={key} style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 24, height: 24, borderRadius: 6,
                  background: `${cfg.color}20`, border: `1px solid ${cfg.color}40`,
                  title: cfg.label,
                }}>
                  <Icon size={11} color={cfg.color} />
                </span>
              ) : null
            })}
            {activeCount === 0 && (
              <span style={{ fontSize: 11, color: '#334155' }}>Nenhum módulo ativo</span>
            )}
          </div>

          {company.has_brand_kit_data && (
            <span style={{
              fontSize: 10, fontWeight: 700, color: '#a78bfa',
              background: 'rgba(167,139,250,0.1)', padding: '2px 7px', borderRadius: 20,
              border: '1px solid rgba(167,139,250,0.2)',
            }}>Brand Kit ✓</span>
          )}

          {expanded ? <ChevronUp size={14} color="#475569" /> : <ChevronDown size={14} color="#475569" />}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ padding: '0 18px 18px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          <div style={{ display: 'grid', gap: 8, marginTop: 16 }}>
            {Object.keys(MODULE_CONFIG).map(key => (
              <ModuleToggle
                key={key}
                moduleKey={key}
                value={mods[key]}
                limit={mods.studio_limit}
                onToggle={handleToggle}
                onLimitChange={handleLimit}
              />
            ))}
          </div>

          <div style={{ marginTop: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>
              Observações (admin)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Notas internas sobre esta empresa..."
              style={{
                width: '100%', boxSizing: 'border-box', minHeight: 60,
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8, color: '#f1f5f9', fontSize: 12, padding: '8px 12px',
                outline: 'none', fontFamily: 'inherit', resize: 'vertical',
              }}
            />
          </div>

          <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            {company.studio_used_this_month > 0 && (
              <span style={{ fontSize: 11, color: '#475569', alignSelf: 'center' }}>
                Studio: {company.studio_used_this_month}/{mods.studio_limit} gerações/mês
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 18px', borderRadius: 8,
                background: saved ? 'rgba(16,185,129,0.2)' : 'rgba(99,102,241,0.2)',
                border: `1px solid ${saved ? 'rgba(16,185,129,0.4)' : 'rgba(99,102,241,0.4)'}`,
                color: saved ? '#10b981' : '#a78bfa', fontSize: 13, fontWeight: 600,
                cursor: saving ? 'wait' : 'pointer', transition: 'all 0.2s',
              }}
            >
              {saving ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Salvando...</> : saved ? <><Check size={13} /> Salvo!</> : 'Salvar módulos'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Página principal ───────────────────────────────────────────────────────────

export default function AdminMarketingPage() {
  const [companies, setCompanies] = useState([])
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [moduleFilter, setModuleFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [dash, comps] = await Promise.all([
        api.get('/admin/marketing/dashboard'),
        api.get(`/admin/marketing/clients?search=${search}&module=${moduleFilter}`),
      ])
      setDashboard(dash)
      setCompanies(Array.isArray(comps) ? comps : [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [search, moduleFilter])

  useEffect(() => { load() }, [load])

  const kpis = dashboard ? [
    { label: 'Empresas c/ Marketing', value: dashboard.companies_with_marketing, icon: Users, color: '#a78bfa' },
    { label: 'Brand Kits cadastrados', value: dashboard.brand_kits_registered, icon: Palette, color: '#06b6d4' },
    { label: 'Estúdio ativos', value: dashboard.has_studio, icon: Image, color: '#f59e0b' },
    { label: 'Gerações Studio/mês', value: dashboard.studio_generations_this_month, icon: Zap, color: '#10b981' },
  ] : []

  return (
    <div style={{ padding: '28px 32px', color: '#f1f5f9', fontFamily: "'Inter', sans-serif", minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.3px' }}>
          Marketing Pro — Gerenciamento
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#475569' }}>
          Ative e gerencie os módulos Marketing Pro por empresa
        </p>
      </div>

      {/* KPIs */}
      {dashboard && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
          {kpis.map(k => {
            const Icon = k.icon
            return (
              <div key={k.label} style={{
                background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 12, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14,
              }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: `${k.color}15`, border: `1px solid ${k.color}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={18} color={k.color} />
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: k.color, lineHeight: 1 }}>{k.value ?? '—'}</div>
                  <div style={{ fontSize: 11, color: '#475569', marginTop: 3 }}>{k.label}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{
          flex: 1, minWidth: 220, display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 8, padding: '0 12px',
        }}>
          <Search size={13} color="#475569" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar empresa..."
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#f1f5f9', fontSize: 13, padding: '9px 0', fontFamily: 'inherit' }}
          />
        </div>
        <select
          value={moduleFilter} onChange={e => setModuleFilter(e.target.value)}
          style={{
            background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 8, color: '#64748b', fontSize: 13, padding: '0 12px',
            cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
          }}
        >
          <option value="">Todos os módulos</option>
          <option value="brand_kit">Brand Kit</option>
          <option value="studio">Studio</option>
          <option value="traffic_pro">Tráfego Pro</option>
          <option value="ig_campaigns">Campanhas IG</option>
        </select>
      </div>

      {/* Lista */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#475569' }}>Carregando...</div>
      ) : companies.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0', color: '#334155' }}>
          Nenhuma empresa encontrada
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {companies.map(c => (
            <CompanyRow key={c.company_id} company={c} onModuleChange={load} />
          ))}
        </div>
      )}
    </div>
  )
}
