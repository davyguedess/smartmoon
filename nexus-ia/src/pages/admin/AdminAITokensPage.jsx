/**
 * AdminAITokensPage — Reescrito com UX limpa e fluxo claro
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Zap, Plus, Pencil, Trash2, RefreshCw, CheckCircle2,
  Package, Users, Activity, Save, X, Gift, DollarSign,
  Coins, BarChart2, TrendingUp, Clock, AlertCircle,
  ToggleLeft, ToggleRight,
} from 'lucide-react';
import { api } from '../../api';

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtTokens(n) {
  if (!n) return '0';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}
function fmtBRL(v) {
  if (!v || v == 0) return 'GRÁTIS';
  return `R$ ${Number(v).toFixed(2).replace('.', ',')}`;
}
function fmt(n) { return (n || 0).toLocaleString('pt-BR'); }

const TIER_COLORS = { free: '#10b981', starter: '#4285F4', pro: '#a78bfa', enterprise: '#f59e0b' };
const EMPTY_PACK = {
  name: '', description: '', badge_text: '', provider: 'any',
  tokens_included: 1000000, price_brl: 0, price_credits: 0,
  is_highlighted: false, tier: 'starter', sort_order: 0,
  renews_monthly: false, color: '#a78bfa', icon: 'zap', is_active: true,
};

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast) return null;
  const isErr = toast.type === 'error';
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      display: 'flex', alignItems: 'center', gap: 10,
      background: isErr ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
      border: `1px solid ${isErr ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
      color: isErr ? '#ef4444' : '#10b981',
      padding: '12px 18px', borderRadius: 12, fontWeight: 600, fontSize: 13,
      boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
      backdropFilter: 'blur(8px)',
      animation: 'slideInRight 0.3s ease',
    }}>
      {isErr ? <AlertCircle size={15} /> : <CheckCircle2 size={15} />}
      {toast.msg}
    </div>
  );
}

// ── Modal Pack ────────────────────────────────────────────────────────────────
function PackModal({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({ ...EMPTY_PACK, ...initial });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Nome é obrigatório'); return; }
    setSaving(true); setError('');
    try { await onSave(form); }
    catch (e) { setError(e?.message || 'Erro ao salvar'); setSaving(false); }
  };

  return (
    <div onClick={onCancel} style={{
        position:'fixed', inset:0, zIndex:1100,
        background:'rgba(0,0,0,0.8)', backdropFilter:'blur(6px)',
        display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem',
      }}>
      <div onClick={e => e.stopPropagation()} style={{
        width:'100%', maxWidth:520, maxHeight:'90vh', overflow:'auto',
        background:'#12151f', border:'1px solid #1e2130',
        borderRadius:16, boxShadow:'0 24px 64px rgba(0,0,0,0.6)',
        textAlign:'left', padding:0,
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)',
          background: `linear-gradient(135deg, ${form.color}12, transparent)`,
        }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>
              {initial?.id ? `Editar Pack #${initial.id}` : 'Novo Pack de Tokens'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              Packs aparecem na loja para os clientes comprarem
            </div>
          </div>
          <button onClick={onCancel} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', padding: 4,
          }}><X size={18} /></button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && (
            <div style={{
              padding: '10px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444',
            }}>{error}</div>
          )}

          {/* Nome + Badge */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Nome *
              </label>
              <input
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #2a2d3a', background: '#0d1117', color: '#e2e8f0', fontSize: 13, boxSizing: 'border-box' }}
                value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="Ex: Pro — 10M Tokens"
              />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Badge
              </label>
              <input
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #2a2d3a', background: '#0d1117', color: '#e2e8f0', fontSize: 13, boxSizing: 'border-box' }}
                value={form.badge_text || ''} onChange={e => set('badge_text', e.target.value)}
                placeholder="POPULAR"
              />
            </div>
          </div>

          {/* Tokens + Preço */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Tokens incluídos
              </label>
              <input
                type="number" min={0}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #2a2d3a', background: '#0d1117', color: '#e2e8f0', fontSize: 13, boxSizing: 'border-box' }}
                value={form.tokens_included} onChange={e => set('tokens_included', Number(e.target.value))}
              />
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>= {fmtTokens(form.tokens_included)} tokens</div>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Preço (R$)
              </label>
              <input
                type="number" min={0} step="0.01"
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #2a2d3a', background: '#0d1117', color: '#e2e8f0', fontSize: 13, boxSizing: 'border-box' }}
                value={form.price_brl} onChange={e => set('price_brl', Number(e.target.value))}
              />
              <div style={{ fontSize: 10, color: '#10b981', marginTop: 3 }}>
                {form.price_brl == 0 ? '⭐ Pack gratuito' : `R$ ${Number(form.price_brl).toFixed(2)}`}
              </div>
            </div>
          </div>

          {/* Tier + Provider */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tier</label>
              <select
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #2a2d3a', background: '#0d1117', color: '#e2e8f0', fontSize: 13, boxSizing: 'border-box' }}
                value={form.tier} onChange={e => set('tier', e.target.value)}
              >
                {['free', 'starter', 'pro', 'enterprise'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Provider</label>
              <select
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #2a2d3a', background: '#0d1117', color: '#e2e8f0', fontSize: 13, boxSizing: 'border-box' }}
                value={form.provider} onChange={e => set('provider', e.target.value)}
              >
                {['any', 'openai', 'gemini', 'groq', 'claude', 'ollama'].map(p => <option key={p} value={p}>{p === 'any' ? 'any (todos)' : p}</option>)}
              </select>
            </div>
          </div>

          {/* Cor de destaque */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Cor do pack</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {['#a78bfa', '#4285F4', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#f472b6'].map(c => (
                <button key={c} onClick={() => set('color', c)} style={{
                  width: 28, height: 28, borderRadius: '50%', border: 'none', background: c, cursor: 'pointer',
                  outline: form.color === c ? `3px solid ${c}` : '2px solid transparent',
                  outlineOffset: 2, transition: 'all 0.15s',
                }} />
              ))}
              <input type="color" value={form.color} onChange={e => set('color', e.target.value)}
                style={{ width: 28, height: 28, borderRadius: 6, border: 'none', cursor: 'pointer', padding: 0 }} />
            </div>
          </div>

          {/* Toggles */}
          <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', padding: '12px 14px', background: '#1a1d2a', borderRadius: 10, border: '1px solid #2a2d3a' }}>
            {[
              { key: 'is_highlighted', label: 'Destacado na loja', color: form.color },
              { key: 'renews_monthly', label: 'Renova mensalmente', color: '#4285F4' },
              { key: 'is_active', label: 'Ativo (visível)', color: '#10b981' },
            ].map(({ key, label, color }) => (
              <label key={key} onClick={() => set(key, !form[key])} style={{
                display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer',
                fontSize: 12, fontWeight: 600, color: form[key] ? color : 'var(--text-muted)', userSelect: 'none',
              }}>
                {form[key] ? <ToggleRight size={20} style={{ color }} /> : <ToggleLeft size={20} />}
                {label}
              </label>
            ))}
          </div>


        </div>

        {/* Footer */}{/* Footer */}
        <div style={{
          display: 'flex', gap: 10, padding: '16px 24px',
          borderTop: '1px solid #1e2130', background: '#0d1117',
        }}>
          <button onClick={onCancel} style={{
            flex: 1, padding: '11px', borderRadius: 10, border: '1px solid #2a2d3a',
            background: 'transparent', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} style={{
            flex: 2, padding: '11px', borderRadius: 10, border: 'none',
            background: saving ? '#1e2130' : form.color,
            color: 'white', fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: saving ? 'none' : `0 4px 16px ${form.color}50`,
          }}>
            {saving ? <RefreshCw size={14} className="spinning" /> : <Save size={14} />}
            {saving ? 'Salvando…' : initial?.id ? 'Salvar alterações' : 'Criar Pack'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Grant Modal ───────────────────────────────────────────────────────────────
function GrantModal({ company, onClose, onGrant }) {
  const [form, setForm] = useState({ tokens: 1000000, provider: 'any', reason: '' });
  const [saving, setSaving] = useState(false);

  const handleGrant = async () => {
    setSaving(true);
    try { await onGrant({ ...form, company_id: company.company_id }); onClose(); }
    catch (e) { setSaving(false); }
  };

  return (
    <div className="ia-modal-overlay" onClick={onClose} style={{ zIndex: 1200 }}>
      <div className="ia-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 400, textAlign: 'left', padding: 0 }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(167,139,250,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Gift size={18} style={{ color: '#a78bfa' }} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 14 }}>Conceder Tokens</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{company.company_name}</div>
            </div>
          </div>
        </div>
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { label: 'Quantidade de tokens', type: 'number', key: 'tokens', min: 1 },
            { label: 'Motivo (opcional)', type: 'text', key: 'reason', placeholder: 'Ex: Bonificação, compensação...' },
          ].map(({ label, type, key, min, placeholder }) => (
            <div key={key}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</label>
              <input type={type} min={min} placeholder={placeholder} value={form[key]}
                onChange={e => setForm(f => ({ ...f, [key]: type === 'number' ? parseInt(e.target.value) || 0 : e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #2a2d3a', background: '#0d1117', color: '#e2e8f0', fontSize: 13, boxSizing: 'border-box' }}
              />
            </div>
          ))}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Provider</label>
            <select value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #2a2d3a', background: '#0d1117', color: '#e2e8f0', fontSize: 13, boxSizing: 'border-box' }}>
              {['any', 'openai', 'gemini', 'groq', 'claude', 'ollama'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '0 24px 20px', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={handleGrant} disabled={saving || form.tokens <= 0} style={{
            padding: '9px 16px', borderRadius: 8, border: 'none', background: '#a78bfa', color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, opacity: saving ? 0.7 : 1,
          }}>
            {saving ? <RefreshCw size={13} className="spinning" /> : <Gift size={13} />}
            {saving ? 'Concedendo…' : `Conceder ${(form.tokens || 0).toLocaleString('pt-BR')}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Página Principal ──────────────────────────────────────────────────────────
export default function AdminAITokensPage() {
  const [packs, setPacks]         = useState([]);
  const [usage, setUsage]         = useState(null);
  const [balances, setBalances]   = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [loadingBal, setLoadingBal] = useState(false);
  const [loadingPur, setLoadingPur] = useState(false);
  const [tab, setTab]             = useState('packs');
  const [editing, setEditing]     = useState(null);
  const [deleting, setDeleting]   = useState(null);
  const [grantTarget, setGrantTarget] = useState(null);
  const [toast, setToast]         = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadPacks = useCallback(async () => {
    setLoading(true);
    try { const r = await api.get('/admin/ai-tokens/packs'); setPacks(r.packs || []); }
    catch { showToast('Erro ao carregar pacotes', 'error'); }
    finally { setLoading(false); }
  }, []);

  const loadUsage = useCallback(async () => {
    try { const r = await api.get('/admin/ai-tokens/usage'); setUsage(r); }
    catch (e) { console.error(e); }
  }, []);

  const loadBalances = useCallback(async () => {
    setLoadingBal(true);
    try { const r = await api.get('/admin/ai-tokens/balances'); setBalances(r.balances || []); }
    catch { showToast('Erro ao carregar saldos', 'error'); }
    finally { setLoadingBal(false); }
  }, []);

  const loadPurchases = useCallback(async () => {
    setLoadingPur(true);
    try { const r = await api.get('/admin/ai-tokens/purchases'); setPurchases(r.purchases || []); }
    catch { showToast('Erro ao carregar compras', 'error'); }
    finally { setLoadingPur(false); }
  }, []);

  useEffect(() => { loadPacks(); loadUsage(); }, [loadPacks, loadUsage]);
  useEffect(() => {
    if (tab === 'balances') loadBalances();
    if (tab === 'purchases') loadPurchases();
  }, [tab]);

  const handleSavePack = async (data) => {
    if (editing === 'new') await api.post('/admin/ai-tokens/packs', data);
    else await api.patch(`/admin/ai-tokens/packs/${editing.id}`, data);
    showToast(editing === 'new' ? '✅ Pack criado!' : '✅ Pack atualizado!');
    setEditing(null);
    loadPacks();
  };

  const handleDelete = async (pack) => {
    try {
      await api.delete(`/admin/ai-tokens/packs/${pack.id}`);
      showToast('Pack desativado');
      setDeleting(null);
      loadPacks();
    } catch { showToast('Erro ao desativar', 'error'); }
  };

  const handleGrant = async (data) => {
    await api.post('/admin/ai-tokens/grant', {
      company_id: data.company_id,
      tokens: data.tokens,
      provider: data.provider,
      reason: data.reason || 'Concessão administrativa',
    });
    showToast('✅ Tokens concedidos!');
    loadBalances();
  };

  const summary = usage?.summary || {};
  const metrics = [
    { label: 'Empresas com tokens', value: summary.companies_using || 0, icon: <Users size={16} />, color: '#4285F4' },
    { label: 'Total emitido', value: fmtTokens(summary.total_issued), icon: <Zap size={16} />, color: '#a78bfa' },
    { label: 'Total consumido', value: fmtTokens(summary.total_consumed), icon: <Activity size={16} />, color: '#f59e0b' },
    { label: 'Packs ativos', value: packs.filter(p => p.is_active).length, icon: <Package size={16} />, color: '#10b981' },
  ];

  const TABS = [
    { id: 'packs', label: 'Catálogo', icon: <Package size={13} /> },
    { id: 'balances', label: 'Saldos', icon: <Coins size={13} /> },
    { id: 'purchases', label: 'Compras', icon: <DollarSign size={13} /> },
    { id: 'usage', label: 'Consumo', icon: <BarChart2 size={13} /> },
  ];

  return (
    <div style={{ padding: '0 0 40px' }}>
      <Toast toast={toast} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Zap size={22} style={{ color: '#a78bfa' }} /> Tokens de IA
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text-muted)' }}>
            Gerencie pacotes, saldos e consumo de tokens das empresas
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { loadPacks(); loadUsage(); }} className="btn-secondary" style={{ padding: '8px 14px', fontSize: 12 }}>
            <RefreshCw size={13} /> Atualizar
          </button>
          <button onClick={() => setEditing('new')} className="btn-primary">
            <Plus size={15} /> Novo Pack
          </button>
        </div>
      </div>

      {/* Métricas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {metrics.map((m, i) => (
          <div key={i} style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
            borderRadius: 12, padding: '16px 18px',
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10, flexShrink: 0,
              background: `${m.color}15`, color: m.color,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{m.icon}</div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{m.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, marginTop: 2 }}>{m.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 4, borderBottom: '1px solid var(--border-subtle)',
        marginBottom: 20,
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 16px', background: 'none', border: 'none',
            borderBottom: `2px solid ${tab === t.id ? '#a78bfa' : 'transparent'}`,
            color: tab === t.id ? '#a78bfa' : 'var(--text-muted)',
            fontSize: 13, fontWeight: tab === t.id ? 700 : 500,
            cursor: 'pointer', transition: 'all 0.15s', marginBottom: -1,
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ═══ TAB: PACKS ═══ */}
      {tab === 'packs' && (
        loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
            <RefreshCw size={22} className="spinning" style={{ marginBottom: 8 }} />
            <div>Carregando pacotes…</div>
          </div>
        ) : packs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
            <Package size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Nenhum pack criado ainda</div>
            <div style={{ fontSize: 13, marginBottom: 20 }}>Crie o primeiro pacote de tokens para seus clientes</div>
            <button onClick={() => setEditing('new')} className="btn-primary"><Plus size={15} /> Criar primeiro pack</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {packs.map(pack => {
              const tc = TIER_COLORS[pack.tier] || '#888';
              return (
                <div key={pack.id} style={{
                  background: 'var(--bg-card)',
                  border: `1px solid ${pack.is_highlighted ? pack.color + '50' : 'var(--border-subtle)'}`,
                  borderRadius: 14, overflow: 'hidden',
                  opacity: pack.is_active ? 1 : 0.55,
                  transition: 'border 0.2s',
                  position: 'relative',
                }}>
                  {pack.is_highlighted && (
                    <div style={{
                      position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                      background: `linear-gradient(90deg, ${pack.color}, ${pack.color}80)`,
                    }} />
                  )}
                  <div style={{ padding: '16px 16px 14px' }}>
                    {/* Top */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 14 }}>{pack.name}</div>
                        {pack.badge_text && (
                          <span style={{
                            fontSize: 9, fontWeight: 800, padding: '2px 8px', borderRadius: 20, marginTop: 4,
                            background: `${pack.color}20`, color: pack.color, textTransform: 'uppercase', display: 'inline-block',
                          }}>{pack.badge_text}</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 5 }}>
                        <button onClick={() => setEditing(pack)} style={{
                          width: 28, height: 28, borderRadius: 7, border: 'none',
                          background: 'var(--bg-elevated)', color: 'var(--text-muted)',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}><Pencil size={12} /></button>
                        <button onClick={() => setDeleting(pack)} style={{
                          width: 28, height: 28, borderRadius: 7, border: 'none',
                          background: 'rgba(239,68,68,0.08)', color: '#ef4444',
                          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}><Trash2 size={12} /></button>
                      </div>
                    </div>

                    {/* Tokens + Preço */}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between',
                      padding: '10px 0', borderTop: '1px solid var(--border-subtle)', marginTop: 4,
                    }}>
                      <div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Tokens</div>
                        <div style={{ fontWeight: 800, fontSize: 18, color: pack.color }}>{fmtTokens(pack.tokens_included)}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Preço</div>
                        <div style={{ fontWeight: 800, fontSize: 16, color: pack.price_brl == 0 ? '#10b981' : 'var(--text-primary)' }}>
                          {fmtBRL(pack.price_brl)}
                        </div>
                      </div>
                    </div>

                    {/* Tags */}
                    <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 20, background: `${tc}15`, color: tc, fontWeight: 700 }}>{pack.tier}</span>
                      <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 20, background: 'var(--bg-elevated)', color: 'var(--text-muted)', fontWeight: 600 }}>{pack.provider}</span>
                      {pack.renews_monthly && <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 20, background: 'rgba(66,133,244,0.1)', color: '#4285F4', fontWeight: 600 }}>mensal</span>}
                      <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 20, background: pack.is_active ? 'rgba(16,185,129,0.1)' : 'rgba(107,114,128,0.1)', color: pack.is_active ? '#10b981' : '#6b7280', fontWeight: 700 }}>
                        {pack.is_active ? '● Ativo' : '● Inativo'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* ═══ TAB: SALDOS ═══ */}
      {tab === 'balances' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Saldo de tokens por empresa</div>
            <button onClick={loadBalances} className="btn-secondary" style={{ fontSize: 12, padding: '6px 12px' }}>
              <RefreshCw size={12} /> Atualizar
            </button>
          </div>
          {loadingBal ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}><RefreshCw size={20} className="spinning" /></div>
          ) : balances.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
              <Coins size={36} style={{ opacity: 0.2, marginBottom: 8 }} />
              <div>Nenhum saldo de tokens registrado ainda.</div>
            </div>
          ) : (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', padding: '10px 16px', background: 'var(--bg-elevated)', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <span>Empresa</span><span>Provider</span><span>Saldo</span><span>Comprado</span><span>Usado</span><span>Ação</span>
              </div>
              {balances.map((b, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto', padding: '12px 16px', borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{b.company_name}</span>
                  <span style={{ fontSize: 11 }}><span style={{ padding: '2px 8px', borderRadius: 20, background: 'rgba(167,139,250,0.15)', color: '#a78bfa', fontWeight: 700 }}>{b.provider}</span></span>
                  <span style={{ fontWeight: 800, color: '#10b981', fontSize: 13 }}>{fmtTokens(b.balance_tokens)}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{fmtTokens(b.total_purchased)}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{fmtTokens(b.total_used)}</span>
                  <button onClick={() => setGrantTarget(b)} style={{
                    fontSize: 11, padding: '5px 12px', background: 'rgba(167,139,250,0.1)',
                    border: '1px solid rgba(167,139,250,0.3)', borderRadius: 8,
                    cursor: 'pointer', color: '#a78bfa', fontWeight: 700,
                  }}>+ Grant</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: COMPRAS ═══ */}
      {tab === 'purchases' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Histórico de compras de pacotes</div>
            <button onClick={loadPurchases} className="btn-secondary" style={{ fontSize: 12, padding: '6px 12px' }}>
              <RefreshCw size={12} /> Atualizar
            </button>
          </div>
          {loadingPur ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}><RefreshCw size={20} className="spinning" /></div>
          ) : purchases.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
              <DollarSign size={36} style={{ opacity: 0.2, marginBottom: 8 }} />
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Nenhuma compra realizada ainda</div>
              <div style={{ fontSize: 13 }}>As compras aparecerão aqui após o primeiro pagamento PIX confirmado</div>
            </div>
          ) : (
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 1.2fr 1fr', padding: '10px 16px', background: 'var(--bg-elevated)', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                <span>Empresa</span><span>Pack</span><span>Valor</span><span>Tokens</span><span>Status</span><span>Data</span>
              </div>
              {purchases.map((p, i) => {
                const statusColors = { paid: '#10b981', pending: '#f59e0b', expired: '#6b7280', cancelled: '#ef4444', waiting_payment: '#4285F4' };
                const sc = statusColors[p.status] || '#6b7280';
                return (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr 1.2fr 1fr', padding: '12px 16px', borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{p.company_name}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.pack_name || '—'}</span>
                    <span style={{ fontWeight: 700, color: '#10b981' }}>R$ {Number(p.amount || 0).toFixed(2).replace('.', ',')}</span>
                    <span style={{ fontWeight: 600, fontSize: 12 }}>{fmtTokens(p.tokens_to_credit)}</span>
                    <span><span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: sc + '20', color: sc, fontWeight: 700 }}>{p.status}</span></span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR') : '—'}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB: CONSUMO ═══ */}
      {tab === 'usage' && (
        <div>
          {!usage ? (
            <div style={{ textAlign: 'center', padding: 48 }}><RefreshCw size={20} className="spinning" /></div>
          ) : (usage.top_companies || []).length === 0 ? (
            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
              <Activity size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Nenhum consumo registrado ainda</div>
              <div style={{ fontSize: 13 }}>O consumo de tokens aparecerá aqui conforme os clientes usarem o sistema</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Top empresas */}
              <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '20px 24px' }}>
                <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <TrendingUp size={15} style={{ color: '#a78bfa' }} /> Top Empresas por Consumo
                </div>
                {(usage.top_companies || []).map((c, i) => {
                  const maxVal = Math.max(...(usage.top_companies || []).map(x => x.consumed), 1);
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#a78bfa', width: 24 }}>#{i+1}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, width: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                      <div style={{ flex: 1, height: 6, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, (c.consumed / maxVal) * 100)}%`, background: 'linear-gradient(90deg, #a78bfa, #4285F4)', borderRadius: 3 }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, width: 80, textAlign: 'right' }}>{fmt(c.consumed)}</span>
                    </div>
                  );
                })}
              </div>

              {/* Transações recentes */}
              {(usage.transactions || []).length > 0 && (
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, overflow: 'hidden' }}>
                  <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Clock size={14} style={{ color: '#a78bfa' }} /> Transações Recentes
                  </div>
                  {(usage.transactions || []).map((tx, i) => (
                    <div key={tx.id} style={{ display: 'grid', gridTemplateColumns: '0.5fr 1.5fr 0.8fr 1fr 2fr 0.8fr', padding: '11px 20px', borderTop: i > 0 ? '1px solid var(--border-subtle)' : 'none', alignItems: 'center', fontSize: 12 }}>
                      <span style={{ color: 'var(--text-muted)' }}>#{tx.id}</span>
                      <span style={{ fontWeight: 600 }}>{tx.company_name}</span>
                      <span><span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: tx.type === 'consume' ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', color: tx.type === 'consume' ? '#ef4444' : '#10b981', fontWeight: 700 }}>{tx.type}</span></span>
                      <span style={{ fontWeight: 700 }}>{fmt(tx.amount)}</span>
                      <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.description || '—'}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{tx.created_at ? new Date(tx.created_at).toLocaleDateString('pt-BR') : '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modal: Criar/Editar Pack */}
      {editing && (
        <PackModal
          initial={editing === 'new' ? {} : editing}
          onSave={handleSavePack}
          onCancel={() => setEditing(null)}
        />
      )}

      {/* Modal: Confirmar desativação */}
      {deleting && (
        <div className="ia-modal-overlay" onClick={() => setDeleting(null)}>
          <div className="ia-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(239,68,68,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Trash2 size={22} style={{ color: '#ef4444' }} />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 800 }}>Desativar pack?</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-muted)' }}>
              O pack <strong>"{deleting.name}"</strong> ficará invisível na loja. Nenhum dado é apagado — você pode reativar depois.
            </p>
            <div className="ia-modal-btns">
              <button onClick={() => setDeleting(null)} className="ia-modal-done">Cancelar</button>
              <button onClick={() => handleDelete(deleting)} className="ia-modal-done" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)' }}>
                <Trash2 size={13} /> Desativar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Grant tokens */}
      {grantTarget && (
        <GrantModal
          company={grantTarget}
          onClose={() => setGrantTarget(null)}
          onGrant={handleGrant}
        />
      )}
    </div>
  );
}
