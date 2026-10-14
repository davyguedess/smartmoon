/**
 * AdminIntegrationsPage — Smart Moon Admin
 *
 * Painel completo de gerenciamento de integrações da plataforma:
 * - Catálogo de todas as APIs disponíveis (cards por categoria)
 * - Toggle global para ativar/desativar cada integração
 * - Painel expandido de configuração de API key (plataforma)
 * - Custos por modelo (NEXUS tokens)
 * - Teste de conexão em tempo real
 * - Associação com planos
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Plug2, RefreshCw, X, Users, CheckCircle, XCircle,
  ToggleLeft, ToggleRight, AlertCircle, Search, Building2,
  ExternalLink, Settings, ChevronDown, ChevronUp, Filter,
  Eye, EyeOff, Zap, Save, Trash2, Plus, Loader, Shield,
  Key, DollarSign, Activity, Globe, TestTube2,
} from 'lucide-react'
import { adminApi } from '../../api'

// ── Category icons ─────────────────────────────────────────────────────────────
const CATEGORY_META = {
  ai:        { label: '🤖 Inteligência Artificial', color: '#7c3aed' },
  voice:     { label: '🎙️ Voz & Áudio',            color: '#e11d48' },
  messaging: { label: '💬 Mensageria & Canais',     color: '#0088cc' },
  cloud:     { label: '☁️ Google Cloud',             color: '#4285f4' },
  payments:  { label: '💳 Pagamentos',               color: '#009ee3' },
  crm:       { label: '🗂️ CRM & Produtividade',     color: '#ff7a59' },
}

// ── Catalog (visual only, synced with DB seed) ────────────────────────────────
const CATALOG_META = {
  openai:         { icon: '🧠', color: '#10a37f', docsUrl: 'https://platform.openai.com' },
  gemini:         { icon: '🔷', color: '#4285f4', docsUrl: 'https://aistudio.google.com' },
  claude:         { icon: '🟣', color: '#7c3aed', docsUrl: 'https://console.anthropic.com' },
  groq:           { icon: '⚡', color: '#f59e0b', docsUrl: 'https://console.groq.com' },
  deepseek:       { icon: '🔮', color: '#6366f1', docsUrl: 'https://platform.deepseek.com' },
  mistral:        { icon: '🌊', color: '#0ea5e9', docsUrl: 'https://console.mistral.ai' },
  together:       { icon: '🤝', color: '#8b5cf6', docsUrl: 'https://api.together.xyz' },
  xai:            { icon: '𝕏',  color: '#000000', docsUrl: 'https://x.ai' },
  elevenlabs:     { icon: '🎙️', color: '#e11d48', docsUrl: 'https://elevenlabs.io' },
  telegram:       { icon: '✈️', color: '#0088cc', docsUrl: 'https://core.telegram.org/bots' },
  whatsapp_evo:   { icon: '💬', color: '#25d366', docsUrl: 'https://doc.evolution-api.com' },
  whatsapp_zapi:  { icon: '📲', color: '#128c7e', docsUrl: 'https://developer.z-api.io' },
  whatsapp_meta:  { icon: '🌐', color: '#1877f2', docsUrl: 'https://developers.facebook.com/docs/whatsapp' },
  google_oauth:   { icon: '🔑', color: '#ea4335', docsUrl: 'https://console.cloud.google.com' },
  google_sheets:  { icon: '📊', color: '#34a853', docsUrl: 'https://console.cloud.google.com' },
  gmail:          { icon: '📧', color: '#ea4335', docsUrl: 'https://console.cloud.google.com' },
  mercadopago:    { icon: '💳', color: '#009ee3', docsUrl: 'https://www.mercadopago.com.br/developers' },
  stripe:         { icon: '💰', color: '#635bff', docsUrl: 'https://stripe.com' },
  hubspot:        { icon: '🧡', color: '#ff7a59', docsUrl: 'https://developers.hubspot.com' },
  notion:         { icon: '📓', color: '#e2e2e2', docsUrl: 'https://developers.notion.com' },
  github:         { icon: '🐙', color: '#6e40c9', docsUrl: 'https://docs.github.com' },
}

// ── Shared styles ─────────────────────────────────────────────────────────────
const s = {
  card: {
    background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
    borderRadius: 14, overflow: 'hidden', transition: 'all 0.2s ease',
  },
  btn: {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    padding: '7px 14px', fontSize: 12, fontWeight: 700,
    border: 'none', borderRadius: 8, cursor: 'pointer',
  },
  input: {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)',
    color: 'var(--text-primary)', fontSize: 12, boxSizing: 'border-box',
    outline: 'none', transition: 'border-color 0.15s',
  },
  label: {
    fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
    textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4,
    display: 'block',
  },
}

// ── Status badge component ────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const config = {
    ok:      { bg: 'rgba(16,185,129,0.1)',  color: '#10b981', label: '✅ OK' },
    error:   { bg: 'rgba(239,68,68,0.1)',   color: '#ef4444', label: '❌ Erro' },
    unknown: { bg: 'rgba(107,114,128,0.1)', color: '#6b7280', label: '⚪ N/A' },
  }
  const c = config[status] || config.unknown
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
      background: c.bg, color: c.color,
    }}>{c.label}</span>
  )
}

// ── Model cost row ────────────────────────────────────────────────────────────
function ModelCostRow({ cost, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    cost_input_per_1k: cost.cost_input_per_1k,
    cost_output_per_1k: cost.cost_output_per_1k,
    is_free: cost.is_free,
    is_default: cost.is_default,
  })

  const save = async () => {
    await onUpdate({ ...cost, ...form })
    setEditing(false)
  }

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr 80px 80px 60px 60px 60px',
      gap: 8, alignItems: 'center', padding: '8px 0',
      borderBottom: '1px solid var(--border-subtle)',
      fontSize: 12,
    }}>
      <div style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: 11 }}>{cost.model}</div>
      {editing ? (
        <>
          <input
            type="number" value={form.cost_input_per_1k}
            onChange={e => setForm({ ...form, cost_input_per_1k: +e.target.value })}
            style={{ ...s.input, padding: '4px 6px', fontSize: 11, textAlign: 'center' }}
          />
          <input
            type="number" value={form.cost_output_per_1k}
            onChange={e => setForm({ ...form, cost_output_per_1k: +e.target.value })}
            style={{ ...s.input, padding: '4px 6px', fontSize: 11, textAlign: 'center' }}
          />
          <label style={{ textAlign: 'center', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_free}
              onChange={e => setForm({ ...form, is_free: e.target.checked, cost_input_per_1k: e.target.checked ? 0 : form.cost_input_per_1k, cost_output_per_1k: e.target.checked ? 0 : form.cost_output_per_1k })}
            />
          </label>
          <button onClick={save} style={{ ...s.btn, padding: '3px 8px', background: '#10b981', color: '#fff', fontSize: 10 }}>
            <Save size={10} />
          </button>
        </>
      ) : (
        <>
          <div style={{ textAlign: 'center', color: cost.is_free ? '#10b981' : 'var(--text-primary)' }}>
            {cost.is_free ? 'Grátis' : cost.cost_input_per_1k}
          </div>
          <div style={{ textAlign: 'center', color: cost.is_free ? '#10b981' : 'var(--text-primary)' }}>
            {cost.is_free ? 'Grátis' : cost.cost_output_per_1k}
          </div>
          <div style={{ textAlign: 'center' }}>
            {cost.is_default && <span style={{ fontSize: 9, background: 'rgba(124,58,237,0.15)', color: '#7c3aed', padding: '2px 6px', borderRadius: 4, fontWeight: 700 }}>Padrão</span>}
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setEditing(true)} title="Editar" style={{ ...s.btn, padding: '3px 6px', background: 'var(--bg-elevated)', color: 'var(--text-muted)', fontSize: 10 }}>
              <Settings size={10} />
            </button>
            <button onClick={() => onDelete(cost.id)} title="Excluir" style={{ ...s.btn, padding: '3px 6px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: 10 }}>
              <Trash2 size={10} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// ── Expanded config panel ─────────────────────────────────────────────────────
function ConfigPanel({ item, onSave, onTest, onSaveModelCost, onDeleteModelCost }) {
  const [form, setForm] = useState({
    api_key: '',
    default_model: item.default_model || '',
    base_url: item.base_url || '',
    webhook_url: item.webhook_url || '',
    notes: item.notes || '',
  })
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [newModel, setNewModel] = useState({ model: '', cost_input_per_1k: 5, cost_output_per_1k: 10, is_free: false, is_default: false })
  const [showAddModel, setShowAddModel] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave({
        provider: item.provider,
        ...(form.api_key ? { api_key: form.api_key } : {}),
        default_model: form.default_model || null,
        base_url: form.base_url || null,
        webhook_url: form.webhook_url || null,
        notes: form.notes || null,
      })
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await onTest(item.provider)
      setTestResult(result)
    } catch (err) {
      setTestResult({ status: 'error', error: err.message || 'Falha no teste' })
    } finally {
      setTesting(false)
    }
  }

  const handleAddModel = async () => {
    if (!newModel.model.trim()) return
    await onSaveModelCost({
      provider: item.provider,
      ...newModel,
    })
    setNewModel({ model: '', cost_input_per_1k: 5, cost_output_per_1k: 10, is_free: false, is_default: false })
    setShowAddModel(false)
  }

  return (
    <div style={{
      padding: '20px 24px', borderTop: '1px solid var(--border-subtle)',
      background: 'var(--bg-elevated)',
    }}>
      {/* ── API Key ── */}
      <div style={{ marginBottom: 16 }}>
        <label style={s.label}><Key size={10} style={{ verticalAlign: 'middle' }} /> API Key da Plataforma</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              type={showKey ? 'text' : 'password'}
              value={form.api_key}
              onChange={e => setForm({ ...form, api_key: e.target.value })}
              placeholder={item.has_key ? '••••••••••••••••(já configurada — digite para alterar)' : 'Insira a API key...'}
              style={{ ...s.input, paddingRight: 36, fontFamily: 'monospace', fontSize: 11 }}
            />
            <button onClick={() => setShowKey(!showKey)} style={{
              position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4,
            }}>
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <button onClick={handleTest} disabled={testing || (!item.has_key && !form.api_key)} style={{
            ...s.btn, padding: '7px 16px',
            background: testing ? 'var(--bg-card)' : 'linear-gradient(135deg, #0ea5e9, #06b6d4)',
            color: '#fff', opacity: (testing || (!item.has_key && !form.api_key)) ? 0.5 : 1,
          }}>
            {testing ? <Loader size={12} className="spin" /> : <TestTube2 size={12} />}
            {testing ? 'Testando...' : 'Testar'}
          </button>
        </div>
        {item.has_key && !form.api_key && (
          <div style={{ fontSize: 10, color: '#10b981', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Shield size={10} /> Chave configurada e encriptada
          </div>
        )}
        {testResult && (
          <div style={{
            marginTop: 8, padding: '8px 12px', borderRadius: 8, fontSize: 11,
            background: testResult.status === 'ok' ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${testResult.status === 'ok' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
            color: testResult.status === 'ok' ? '#10b981' : '#ef4444',
          }}>
            {testResult.status === 'ok' ? '✅ Conexão OK!' : `❌ Erro: ${testResult.error}`}
            {testResult.latency_ms && <span style={{ marginLeft: 8, opacity: 0.7 }}>({testResult.latency_ms}ms)</span>}
            {testResult.bot_name && <span style={{ marginLeft: 8 }}>Bot: @{testResult.bot_name}</span>}
          </div>
        )}
      </div>

      {/* ── Grid: Model, URL, Webhook ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
        <div>
          <label style={s.label}>Modelo Padrão</label>
          <input
            value={form.default_model}
            onChange={e => setForm({ ...form, default_model: e.target.value })}
            placeholder="ex: gpt-4o-mini"
            style={{ ...s.input, fontFamily: 'monospace', fontSize: 11 }}
          />
        </div>
        <div>
          <label style={s.label}>Base URL (opcional)</label>
          <input
            value={form.base_url}
            onChange={e => setForm({ ...form, base_url: e.target.value })}
            placeholder="https://api.openai.com"
            style={{ ...s.input, fontFamily: 'monospace', fontSize: 11 }}
          />
        </div>
        <div>
          <label style={s.label}>Webhook URL (opcional)</label>
          <input
            value={form.webhook_url}
            onChange={e => setForm({ ...form, webhook_url: e.target.value })}
            placeholder="https://..."
            style={{ ...s.input, fontFamily: 'monospace', fontSize: 11 }}
          />
        </div>
        <div>
          <label style={s.label}>Notas</label>
          <input
            value={form.notes}
            onChange={e => setForm({ ...form, notes: e.target.value })}
            placeholder="Notas internas..."
            style={s.input}
          />
        </div>
      </div>

      {/* ── Model Costs ── */}
      {(item.model_costs && item.model_costs.length > 0 || item.category === 'ai' || item.category === 'voice') && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={{ ...s.label, marginBottom: 0 }}>
              <DollarSign size={10} style={{ verticalAlign: 'middle' }} /> Custos por Modelo (SM Tokens / 1K)
            </label>
            <button onClick={() => setShowAddModel(!showAddModel)} style={{
              ...s.btn, padding: '4px 10px', fontSize: 10,
              background: showAddModel ? 'rgba(239,68,68,0.1)' : 'rgba(124,58,237,0.1)',
              color: showAddModel ? '#ef4444' : '#7c3aed',
            }}>
              {showAddModel ? <X size={10} /> : <Plus size={10} />}
              {showAddModel ? 'Cancelar' : 'Adicionar Modelo'}
            </button>
          </div>

          {/* Header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 80px 80px 60px 60px 60px',
            gap: 8, padding: '6px 0', borderBottom: '2px solid var(--border-subtle)',
            fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase',
          }}>
            <div>Modelo</div>
            <div style={{ textAlign: 'center' }}>Input</div>
            <div style={{ textAlign: 'center' }}>Output</div>
            <div style={{ textAlign: 'center' }}>Free</div>
            <div></div>
            <div></div>
          </div>

          {/* Rows */}
          {(item.model_costs || []).map(mc => (
            <ModelCostRow
              key={mc.id}
              cost={mc}
              onUpdate={async (updated) => {
                await onSaveModelCost({
                  provider: item.provider,
                  model: updated.model,
                  cost_input_per_1k: updated.cost_input_per_1k,
                  cost_output_per_1k: updated.cost_output_per_1k,
                  is_free: updated.is_free,
                  is_default: updated.is_default,
                })
              }}
              onDelete={onDeleteModelCost}
            />
          ))}

          {/* Add new model */}
          {showAddModel && (
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 80px 80px 60px auto',
              gap: 8, alignItems: 'center', padding: '10px 0', marginTop: 4,
              borderTop: '1px dashed var(--border-subtle)',
            }}>
              <input
                value={newModel.model}
                onChange={e => setNewModel({ ...newModel, model: e.target.value })}
                placeholder="nome-do-modelo"
                style={{ ...s.input, padding: '5px 8px', fontSize: 11, fontFamily: 'monospace' }}
              />
              <input
                type="number" value={newModel.cost_input_per_1k}
                onChange={e => setNewModel({ ...newModel, cost_input_per_1k: +e.target.value })}
                style={{ ...s.input, padding: '5px 6px', fontSize: 11, textAlign: 'center' }}
              />
              <input
                type="number" value={newModel.cost_output_per_1k}
                onChange={e => setNewModel({ ...newModel, cost_output_per_1k: +e.target.value })}
                style={{ ...s.input, padding: '5px 6px', fontSize: 11, textAlign: 'center' }}
              />
              <label style={{ textAlign: 'center', cursor: 'pointer', fontSize: 11 }}>
                <input type="checkbox" checked={newModel.is_free}
                  onChange={e => setNewModel({ ...newModel, is_free: e.target.checked })}
                /> Free
              </label>
              <button onClick={handleAddModel} style={{
                ...s.btn, padding: '5px 12px', background: '#7c3aed', color: '#fff', fontSize: 10,
              }}>
                <Plus size={10} /> Adicionar
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Save button ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button onClick={handleSave} disabled={saving} style={{
          ...s.btn, padding: '10px 24px', fontSize: 13,
          background: saving ? 'var(--bg-card)' : 'linear-gradient(135deg, #7c3aed, #a855f7)',
          color: '#fff', boxShadow: '0 4px 12px rgba(124,58,237,0.3)',
        }}>
          {saving ? <Loader size={14} className="spin" /> : <Save size={14} />}
          {saving ? 'Salvando...' : 'Salvar Configurações'}
        </button>
      </div>
    </div>
  )
}

// ── Integration Card ──────────────────────────────────────────────────────────
function IntegrationCard({ item, onToggle, onSave, onTest, onSaveModelCost, onDeleteModelCost }) {
  const [expanded, setExpanded] = useState(false)
  const meta = CATALOG_META[item.provider] || { icon: '🔌', color: '#6b7280', docsUrl: '#' }

  return (
    <div style={{
      ...s.card,
      borderColor: expanded ? meta.color + '40' : 'var(--border-subtle)',
      boxShadow: expanded ? `0 0 20px ${meta.color}15` : 'none',
    }}>
      {/* Header */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px',
          cursor: 'pointer', userSelect: 'none',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        {/* Icon */}
        <div style={{
          width: 42, height: 42, borderRadius: 12, flexShrink: 0,
          background: `linear-gradient(135deg, ${meta.color}20, ${meta.color}08)`,
          border: `1px solid ${meta.color}25`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
        }}>
          {meta.icon}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            {item.display_name}
            {item.has_key && (
              <span style={{
                fontSize: 9, background: 'rgba(16,185,129,0.12)', color: '#10b981',
                padding: '2px 7px', borderRadius: 4, fontWeight: 700,
              }}>🔑 Configurada</span>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{item.provider}</span>
            {item.default_model && <span style={{ fontFamily: 'monospace', fontSize: 10, opacity: 0.8 }}>· {item.default_model}</span>}
            {item.last_tested_at && <StatusBadge status={item.test_status} />}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {/* Toggle */}
          <button
            onClick={e => { e.stopPropagation(); onToggle(item.provider, !item.is_active) }}
            title={item.is_active ? 'Desativar' : 'Ativar'}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: item.is_active ? '#10b981' : '#6b7280', padding: 4 }}
          >
            {item.is_active ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
          </button>

          {/* Docs link */}
          <a
            href={meta.docsUrl}
            target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            title="Documentação"
            style={{
              width: 30, height: 30, borderRadius: 8, display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
              color: 'var(--text-muted)', textDecoration: 'none',
            }}
          >
            <ExternalLink size={13} />
          </a>

          {/* Expand */}
          <div style={{
            width: 30, height: 30, borderRadius: 8, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: expanded ? meta.color + '15' : 'var(--bg-elevated)',
            border: `1px solid ${expanded ? meta.color + '30' : 'var(--border-subtle)'}`,
            color: expanded ? meta.color : 'var(--text-muted)',
          }}>
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </div>
        </div>
      </div>

      {/* Model costs count badge */}
      {(item.model_costs?.length > 0) && !expanded && (
        <div style={{
          padding: '0 20px 12px', display: 'flex', gap: 6, flexWrap: 'wrap',
        }}>
          {item.model_costs.slice(0, 4).map(mc => (
            <span key={mc.id} style={{
              fontSize: 9, fontFamily: 'monospace', padding: '2px 7px', borderRadius: 4,
              background: mc.is_free ? 'rgba(16,185,129,0.08)' : 'rgba(124,58,237,0.05)',
              color: mc.is_free ? '#10b981' : 'var(--text-muted)',
              border: `1px solid ${mc.is_free ? 'rgba(16,185,129,0.15)' : 'var(--border-subtle)'}`,
            }}>
              {mc.model} {mc.is_free ? '(grátis)' : `${mc.cost_input_per_1k}/${mc.cost_output_per_1k}`}
            </span>
          ))}
          {item.model_costs.length > 4 && (
            <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>+{item.model_costs.length - 4} mais</span>
          )}
        </div>
      )}

      {/* Expanded panel */}
      {expanded && (
        <ConfigPanel
          item={item}
          onSave={onSave}
          onTest={onTest}
          onSaveModelCost={onSaveModelCost}
          onDeleteModelCost={onDeleteModelCost}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════════════════════════
export default function AdminIntegrationsPage() {
  const [keys, setKeys] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filterCategory, setFilterCategory] = useState(null)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await adminApi.getPlatformKeys(filterCategory)
      setKeys(res.keys || [])
    } catch (err) {
      setError('Erro ao carregar integrações: ' + (err.message || 'desconhecido'))
    } finally {
      setLoading(false)
    }
  }, [filterCategory])

  useEffect(() => { load() }, [load])

  // ── Handlers ──
  const handleToggle = async (provider, active) => {
    try {
      await adminApi.savePlatformKey({ provider, is_active: active })
      showToast(`${provider} ${active ? 'ativado' : 'desativado'}`)
      await load()
    } catch { showToast('Erro ao alterar status', 'error') }
  }

  const handleSave = async (data) => {
    try {
      await adminApi.savePlatformKey(data)
      showToast(`${data.provider} salvo com sucesso!`)
      await load()
    } catch (err) { showToast('Erro ao salvar: ' + err.message, 'error') }
  }

  const handleTest = async (provider) => {
    const result = await adminApi.testPlatformKey(provider)
    await load()
    return result
  }

  const handleSaveModelCost = async (data) => {
    try {
      await adminApi.saveModelCost(data)
      showToast(`Modelo ${data.model} salvo`)
      await load()
    } catch (err) { showToast('Erro: ' + err.message, 'error') }
  }

  const handleDeleteModelCost = async (costId) => {
    if (!window.confirm('Excluir este modelo?')) return
    try {
      await adminApi.deleteModelCost(costId)
      showToast('Modelo excluído')
      await load()
    } catch (err) { showToast('Erro: ' + err.message, 'error') }
  }

  // ── Group by category ──
  const grouped = {}
  const filtered = keys.filter(k =>
    !search || k.display_name.toLowerCase().includes(search.toLowerCase()) ||
    k.provider.toLowerCase().includes(search.toLowerCase())
  )
  filtered.forEach(k => {
    const cat = k.category || 'other'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(k)
  })

  // ── Summary stats ──
  const summary = {
    total: keys.length,
    configured: keys.filter(k => k.has_key).length,
    active: keys.filter(k => k.is_active).length,
    ok: keys.filter(k => k.test_status === 'ok').length,
  }

  const categories = ['ai', 'voice', 'messaging', 'cloud', 'payments', 'crm']

  return (
    <div style={{ position: 'relative' }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          padding: '12px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700,
          background: toast.type === 'error' ? 'rgba(239,68,68,0.95)' : 'rgba(16,185,129,0.95)',
          color: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          animation: 'fadeIn 0.2s ease',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 24, flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Plug2 size={24} /> Integrações da Plataforma
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
            Gerenciamento de API keys, modelos e custos para todas as integrações
          </p>
        </div>
        <button onClick={load} disabled={loading} style={{
          ...s.btn, padding: '10px 18px',
          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          color: 'var(--text-primary)',
        }}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Atualizar
        </button>
      </div>

      {/* Stats bar */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 12, marginBottom: 20,
      }}>
        {[
          { label: 'Total', value: summary.total, icon: <Plug2 size={16} />, color: '#6b7280' },
          { label: 'Configuradas', value: summary.configured, icon: <Key size={16} />, color: '#7c3aed' },
          { label: 'Ativas', value: summary.active, icon: <Activity size={16} />, color: '#10b981' },
          { label: 'Testadas OK', value: summary.ok, icon: <CheckCircle size={16} />, color: '#0ea5e9' },
        ].map((stat, i) => (
          <div key={i} style={{
            padding: '14px 16px', borderRadius: 12,
            background: `linear-gradient(135deg, ${stat.color}08, ${stat.color}03)`,
            border: `1px solid ${stat.color}20`,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ color: stat.color }}>{stat.icon}</div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 900, color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20,
        flexWrap: 'wrap',
      }}>
        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 320 }}>
          <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar integração..."
            style={{ ...s.input, paddingLeft: 34 }}
          />
        </div>
        <button
          onClick={() => setFilterCategory(null)}
          style={{
            ...s.btn, padding: '8px 14px',
            background: !filterCategory ? '#7c3aed' : 'var(--bg-card)',
            color: !filterCategory ? '#fff' : 'var(--text-muted)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          Todos
        </button>
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setFilterCategory(filterCategory === cat ? null : cat)}
            style={{
              ...s.btn, padding: '8px 14px',
              background: filterCategory === cat ? (CATEGORY_META[cat]?.color || '#6b7280') : 'var(--bg-card)',
              color: filterCategory === cat ? '#fff' : 'var(--text-muted)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {(CATEGORY_META[cat]?.label || cat).split(' ')[0]}
          </button>
        ))}
      </div>

      {/* Loading / Error */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <Loader size={28} className="spin" style={{ margin: '0 auto 12px' }} />
          <div style={{ fontSize: 13 }}>Carregando integrações...</div>
        </div>
      )}

      {error && (
        <div style={{
          padding: '16px 20px', borderRadius: 12, background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444', fontSize: 13, marginBottom: 20,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Cards by category */}
      {!loading && !error && Object.keys(grouped).length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <Plug2 size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
          <div style={{ fontSize: 15, fontWeight: 700 }}>Nenhuma integração encontrada</div>
        </div>
      )}

      {!loading && categories.map(cat => {
        if (!grouped[cat]) return null
        const catMeta = CATEGORY_META[cat] || { label: cat, color: '#6b7280' }
        return (
          <div key={cat} style={{ marginBottom: 28 }}>
            <h3 style={{
              fontSize: 14, fontWeight: 800, marginBottom: 12,
              display: 'flex', alignItems: 'center', gap: 8,
              color: catMeta.color,
            }}>
              {catMeta.label}
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                background: catMeta.color + '12', color: catMeta.color,
              }}>{grouped[cat].length}</span>
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {grouped[cat].map(item => (
                <IntegrationCard
                  key={item.provider}
                  item={item}
                  onToggle={handleToggle}
                  onSave={handleSave}
                  onTest={handleTest}
                  onSaveModelCost={handleSaveModelCost}
                  onDeleteModelCost={handleDeleteModelCost}
                />
              ))}
            </div>
          </div>
        )
      })}

      {/* ═══════════════════════════════════════════════════════════════════
          SEÇÃO: APIs Externas (exclusivas por conta)
          ═══════════════════════════════════════════════════════════════════ */}
      <ExternalApisSection />

      {/* Spin animation */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        .spin { animation: spin 1s linear infinite; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// External APIs Section — APIs exclusivas vinculadas a contas específicas
// ═══════════════════════════════════════════════════════════════════════════════

function ExternalApisSection() {
  const [apis, setApis] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [companies, setCompanies] = useState([])
  const [toast, setToast] = useState(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const load = async () => {
    setLoading(true)
    try {
      const res = await adminApi.listExternalApis()
      setApis(res.apis || [])
      const comps = await adminApi.listCompanies()
      setCompanies(comps.companies || comps || [])
    } catch (err) {
      console.error('Erro ao carregar APIs externas:', err)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (data) => {
    try {
      await adminApi.createExternalApi(data)
      showToast(`API "${data.display_name}" criada!`)
      setShowCreate(false)
      await load()
    } catch (err) { showToast('Erro: ' + err.message, 'error') }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Remover esta API externa? Os bindings serão removidos.')) return
    try {
      await adminApi.deleteExternalApi(id)
      showToast('API removida')
      await load()
    } catch (err) { showToast('Erro: ' + err.message, 'error') }
  }

  const handleTest = async (id) => {
    try {
      const result = await adminApi.testExternalApi(id)
      if (result.status === 'ok') {
        showToast('✅ Conexão OK!')
      } else {
        showToast(`❌ Erro: ${result.error || 'Falha no teste'}`, 'error')
      }
    } catch (err) { showToast('Erro: ' + err.message, 'error') }
  }

  const handleAddBinding = async (apiId, companyId, apiKeyOverride = '') => {
    try {
      await adminApi.createExternalApiBinding(apiId, {
        company_id: companyId,
        api_key_override: apiKeyOverride || null,
      })
      showToast('Empresa vinculada!')
      await load()
    } catch (err) { showToast('Erro: ' + err.message, 'error') }
  }

  const handleRemoveBinding = async (apiId, bindingId) => {
    try {
      await adminApi.deleteExternalApiBinding(apiId, bindingId)
      showToast('Vínculo removido')
      await load()
    } catch (err) { showToast('Erro: ' + err.message, 'error') }
  }

  return (
    <div style={{ marginTop: 40 }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          padding: '12px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700,
          background: toast.type === 'error' ? 'rgba(239,68,68,0.95)' : 'rgba(16,185,129,0.95)',
          color: '#fff', boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          animation: 'fadeIn 0.2s ease',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16,
      }}>
        <div>
          <h3 style={{
            margin: 0, fontSize: 18, fontWeight: 900,
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            🔌 APIs Externas — Exclusivas por Conta
          </h3>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted)' }}>
            APIs de terceiros vinculadas a empresas específicas. Usáveis no Flow Builder.
          </p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} style={{
          ...s.btn, padding: '10px 18px',
          background: showCreate ? 'rgba(239,68,68,0.1)' : 'linear-gradient(135deg, #ec4899, #8b5cf6)',
          color: showCreate ? '#ef4444' : '#fff',
          boxShadow: showCreate ? 'none' : '0 4px 12px rgba(236,72,153,0.3)',
        }}>
          {showCreate ? <><X size={14} /> Cancelar</> : <><Plus size={14} /> Nova API</>}
        </button>
      </div>

      {/* Create form */}
      {showCreate && <CreateExternalApiForm onSubmit={handleCreate} />}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
          <Loader size={24} className="spin" style={{ margin: '0 auto 8px' }} />
          <div style={{ fontSize: 12 }}>Carregando APIs externas...</div>
        </div>
      )}

      {/* List */}
      {!loading && apis.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '40px 20px',
          background: 'var(--bg-card)', borderRadius: 14,
          border: '1px dashed var(--border-subtle)',
        }}>
          <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.4 }}>🔌</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)' }}>Nenhuma API externa cadastrada</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
            Clique em "Nova API" para cadastrar a primeira
          </div>
        </div>
      )}

      {!loading && apis.map(api => (
        <ExternalApiCard
          key={api.id}
          api={api}
          expanded={expandedId === api.id}
          onToggle={() => setExpandedId(expandedId === api.id ? null : api.id)}
          onTest={() => handleTest(api.id)}
          onDelete={() => handleDelete(api.id)}
          onAddBinding={handleAddBinding}
          onRemoveBinding={handleRemoveBinding}
          companies={companies}
          onUpdate={async (data) => {
            try {
              await adminApi.updateExternalApi(api.id, data)
              showToast('API atualizada!')
              await load()
            } catch (err) { showToast('Erro: ' + err.message, 'error') }
          }}
        />
      ))}
    </div>
  )
}


// ── Create External API Form ──────────────────────────────────────────────────

function CreateExternalApiForm({ onSubmit }) {
  const [form, setForm] = useState({
    slug: '', display_name: '', description: '', base_url: '',
    auth_type: 'header', auth_header_name: 'X-API-Key', auth_query_param: 'api_key',
    default_api_key: '', icon: '🔌', color: '#ec4899',
    endpoints_json: {},
  })
  const [endpointKey, setEndpointKey] = useState('')
  const [endpointMethod, setEndpointMethod] = useState('GET')
  const [endpointPath, setEndpointPath] = useState('')
  const [endpointDesc, setEndpointDesc] = useState('')

  const addEndpoint = () => {
    if (!endpointKey.trim() || !endpointPath.trim()) return
    setForm(f => ({
      ...f,
      endpoints_json: {
        ...f.endpoints_json,
        [endpointKey.trim()]: { method: endpointMethod, path: endpointPath, description: endpointDesc },
      },
    }))
    setEndpointKey(''); setEndpointPath(''); setEndpointDesc('')
  }

  const removeEndpoint = (key) => {
    setForm(f => {
      const copy = { ...f.endpoints_json }
      delete copy[key]
      return { ...f, endpoints_json: copy }
    })
  }

  return (
    <div style={{
      padding: 20, borderRadius: 14, marginBottom: 16,
      background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
    }}>
      <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        ✨ Cadastrar Nova API Externa
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div>
          <label style={s.label}>Slug (identificador)</label>
          <input value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })}
            placeholder="duarte_booking" style={{ ...s.input, fontFamily: 'monospace', fontSize: 11 }} />
        </div>
        <div>
          <label style={s.label}>Nome de Exibição</label>
          <input value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })}
            placeholder="Duarte Estética — Agendamentos" style={s.input} />
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <label style={s.label}>Base URL</label>
          <input value={form.base_url} onChange={e => setForm({ ...form, base_url: e.target.value })}
            placeholder="https://esteticaduarte.com/booking/api_bookings" style={{ ...s.input, fontFamily: 'monospace', fontSize: 11 }} />
        </div>
        <div>
          <label style={s.label}>Tipo de Autenticação</label>
          <select value={form.auth_type} onChange={e => setForm({ ...form, auth_type: e.target.value })}
            style={{ ...s.input, cursor: 'pointer' }}>
            <option value="header">Header (X-API-Key)</option>
            <option value="query">Query Param (?api_key=)</option>
            <option value="bearer">Bearer Token</option>
            <option value="none">Sem autenticação</option>
          </select>
        </div>
        <div>
          <label style={s.label}>API Key Padrão</label>
          <input value={form.default_api_key} onChange={e => setForm({ ...form, default_api_key: e.target.value })}
            placeholder="drt_api_..." type="password" style={{ ...s.input, fontFamily: 'monospace', fontSize: 11 }} />
        </div>
      </div>

      {/* Endpoints */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ ...s.label, marginBottom: 8 }}>📡 Endpoints</label>
        {Object.entries(form.endpoints_json).map(([key, ep]) => (
          <div key={key} style={{
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6,
            padding: '6px 10px', borderRadius: 8, background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)', fontSize: 11,
          }}>
            <span style={{ fontWeight: 700, color: '#ec4899', minWidth: 80 }}>{key}</span>
            <span style={{
              padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 800,
              background: ep.method === 'POST' ? 'rgba(236,72,153,0.15)' : 'rgba(16,185,129,0.15)',
              color: ep.method === 'POST' ? '#ec4899' : '#10b981',
            }}>{ep.method}</span>
            <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)', flex: 1 }}>{ep.path}</span>
            <span style={{ color: 'var(--text-muted)', flex: 1, fontSize: 10 }}>{ep.description}</span>
            <button onClick={() => removeEndpoint(key)} style={{
              ...s.btn, padding: '2px 6px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: 10,
            }}>
              <Trash2 size={10} />
            </button>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6 }}>
          <input value={endpointKey} onChange={e => setEndpointKey(e.target.value)}
            placeholder="slug (ex: lookup)" style={{ ...s.input, width: 110, fontSize: 11 }} />
          <select value={endpointMethod} onChange={e => setEndpointMethod(e.target.value)}
            style={{ ...s.input, width: 80, fontSize: 11, cursor: 'pointer' }}>
            <option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option>
          </select>
          <input value={endpointPath} onChange={e => setEndpointPath(e.target.value)}
            placeholder="/path" style={{ ...s.input, width: 140, fontFamily: 'monospace', fontSize: 11 }} />
          <input value={endpointDesc} onChange={e => setEndpointDesc(e.target.value)}
            placeholder="Descrição" style={{ ...s.input, flex: 1, fontSize: 11 }} />
          <button onClick={addEndpoint} style={{
            ...s.btn, padding: '7px 12px', background: '#ec4899', color: '#fff', fontSize: 10,
          }}>
            <Plus size={10} /> Add
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => onSubmit(form)} style={{
          ...s.btn, padding: '10px 24px',
          background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
          color: '#fff', fontSize: 13, fontWeight: 700,
          boxShadow: '0 4px 12px rgba(236,72,153,0.3)',
        }}>
          <Save size={14} /> Criar API
        </button>
      </div>
    </div>
  )
}


// ── External API Card ─────────────────────────────────────────────────────────

function ExternalApiCard({ api, expanded, onToggle, onTest, onDelete, onAddBinding, onRemoveBinding, companies, onUpdate }) {
  const [newCompanyId, setNewCompanyId] = useState('')
  const [newKeyOverride, setNewKeyOverride] = useState('')

  const boundCompanyIds = new Set((api.bindings || []).map(b => b.company_id))

  return (
    <div style={{
      ...s.card, marginBottom: 10,
      borderColor: expanded ? (api.color || '#ec4899') + '40' : 'var(--border-subtle)',
      boxShadow: expanded ? `0 0 20px ${api.color || '#ec4899'}15` : 'none',
    }}>
      {/* Header */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px',
          cursor: 'pointer', userSelect: 'none',
        }}
        onClick={onToggle}
      >
        <div style={{
          width: 42, height: 42, borderRadius: 12, flexShrink: 0, fontSize: 20,
          background: `linear-gradient(135deg, ${api.color || '#ec4899'}20, ${api.color || '#ec4899'}08)`,
          border: `1px solid ${api.color || '#ec4899'}25`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {api.icon || '🔌'}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            {api.display_name}
            <span style={{
              fontSize: 9, padding: '2px 7px', borderRadius: 4, fontWeight: 700,
              background: api.is_active ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
              color: api.is_active ? '#10b981' : '#ef4444',
            }}>
              {api.is_active ? '✅ Ativa' : '❌ Inativa'}
            </span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: 'monospace', fontSize: 10 }}>{api.slug}</span>
            <span>·</span>
            <span>{api.endpoints_count} endpoints</span>
            <span>·</span>
            <span style={{ color: '#ec4899' }}>{api.bindings_count} empresa{api.bindings_count !== 1 ? 's' : ''}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button onClick={e => { e.stopPropagation(); onTest() }} title="Testar" style={{
            ...s.btn, padding: '6px 12px', background: 'rgba(14,165,233,0.1)', color: '#0ea5e9', fontSize: 10,
          }}>
            <TestTube2 size={12} /> Testar
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete() }} title="Remover" style={{
            ...s.btn, padding: '6px 8px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: 10,
          }}>
            <Trash2 size={12} />
          </button>
          <div style={{
            width: 28, height: 28, borderRadius: 8, display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            background: expanded ? (api.color || '#ec4899') + '15' : 'var(--bg-elevated)',
            border: `1px solid ${expanded ? (api.color || '#ec4899') + '30' : 'var(--border-subtle)'}`,
            color: expanded ? (api.color || '#ec4899') : 'var(--text-muted)',
          }}>
            {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div style={{
          padding: '20px 24px', borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-elevated)',
        }}>
          {/* Base info */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={s.label}>Base URL</label>
              <div style={{
                padding: '8px 12px', borderRadius: 8, background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)', fontFamily: 'monospace', fontSize: 11,
                color: 'var(--text-primary)', wordBreak: 'break-all',
              }}>
                {api.base_url}
              </div>
            </div>
            <div>
              <label style={s.label}>Autenticação</label>
              <div style={{
                padding: '8px 12px', borderRadius: 8, background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)', fontSize: 12,
              }}>
                {api.auth_type === 'header' ? `Header: ${api.auth_header_name}` :
                 api.auth_type === 'query' ? `Query: ?${api.auth_query_param}=` :
                 api.auth_type === 'bearer' ? 'Bearer Token' : 'Sem autenticação'}
                {api.has_default_key && (
                  <span style={{ marginLeft: 8, fontSize: 9, color: '#10b981', fontWeight: 700 }}>🔑 Chave padrão configurada</span>
                )}
              </div>
            </div>
          </div>

          {/* Endpoints */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ ...s.label, marginBottom: 8 }}>📡 Endpoints Disponíveis</label>
            {Object.entries(api.endpoints_json || {}).map(([key, ep]) => (
              <div key={key} style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4,
                padding: '6px 10px', borderRadius: 8, background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)', fontSize: 11,
              }}>
                <span style={{ fontWeight: 700, color: '#ec4899', minWidth: 100 }}>{key}</span>
                <span style={{
                  padding: '2px 6px', borderRadius: 4, fontSize: 9, fontWeight: 800,
                  background: ep.method === 'POST' ? 'rgba(236,72,153,0.15)' : 'rgba(16,185,129,0.15)',
                  color: ep.method === 'POST' ? '#ec4899' : '#10b981',
                }}>{ep.method}</span>
                <span style={{ fontFamily: 'monospace', color: 'var(--text-muted)' }}>{ep.path}</span>
                <span style={{ flex: 1, color: 'var(--text-muted)', fontSize: 10 }}>{ep.description}</span>
              </div>
            ))}
          </div>

          {/* Bindings — Empresas vinculadas */}
          <div>
            <label style={{ ...s.label, marginBottom: 8 }}>
              <Building2 size={10} style={{ verticalAlign: 'middle' }} /> Empresas Vinculadas
            </label>

            {(api.bindings || []).map(b => (
              <div key={b.id} style={{
                display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6,
                padding: '8px 12px', borderRadius: 8, background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                  background: 'rgba(236,72,153,0.1)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  <Building2 size={13} color="#ec4899" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>
                    Empresa #{b.company_id}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', gap: 8 }}>
                    {b.has_key_override && <span style={{ color: '#f59e0b' }}>🔑 Chave própria</span>}
                    <span style={{ color: b.is_active ? '#10b981' : '#ef4444' }}>
                      {b.is_active ? '✅ Ativo' : '❌ Inativo'}
                    </span>
                  </div>
                </div>
                <button onClick={() => onRemoveBinding(api.id, b.id)} style={{
                  ...s.btn, padding: '4px 8px', background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: 10,
                }}>
                  <Trash2 size={10} />
                </button>
              </div>
            ))}

            {/* Add new binding */}
            <div style={{
              display: 'flex', gap: 8, alignItems: 'center', marginTop: 8,
              padding: '8px 12px', borderRadius: 8,
              border: '1px dashed var(--border-subtle)',
            }}>
              <select
                value={newCompanyId}
                onChange={e => setNewCompanyId(e.target.value)}
                style={{ ...s.input, width: 200, fontSize: 11, cursor: 'pointer' }}
              >
                <option value="">Selecionar empresa...</option>
                {companies.filter(c => !boundCompanyIds.has(c.id)).map(c => (
                  <option key={c.id} value={c.id}>#{c.id} — {c.name}</option>
                ))}
              </select>
              <input
                value={newKeyOverride}
                onChange={e => setNewKeyOverride(e.target.value)}
                placeholder="API Key override (opcional)"
                type="password"
                style={{ ...s.input, flex: 1, fontSize: 11, fontFamily: 'monospace' }}
              />
              <button
                onClick={() => {
                  if (!newCompanyId) return
                  onAddBinding(api.id, parseInt(newCompanyId), newKeyOverride)
                  setNewCompanyId(''); setNewKeyOverride('')
                }}
                disabled={!newCompanyId}
                style={{
                  ...s.btn, padding: '7px 14px',
                  background: newCompanyId ? '#ec4899' : 'var(--bg-card)',
                  color: newCompanyId ? '#fff' : 'var(--text-muted)',
                  fontSize: 11, opacity: newCompanyId ? 1 : 0.5,
                }}
              >
                <Plus size={12} /> Vincular
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
