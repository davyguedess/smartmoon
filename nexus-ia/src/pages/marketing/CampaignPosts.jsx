import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Instagram, Plus, Search, Filter, Calendar, Image, Video, Film, Layout,
  Target, Heart, Users, TrendingUp, CheckCircle, AlertCircle, Clock, XCircle,
  Layers, ZapOff, RotateCcw
} from 'lucide-react';
import { api } from '../../api';
import { useToast } from '../../components/ui/Toast';

// ── Status config ────────────────────────────────────────────────────────────
const STATUS = {
  draft_created:                    { label: 'Rascunho',          color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)', icon: Clock },
  gathering_inputs:                 { label: 'Coletando',         color: '#06b6d4', bg: 'rgba(6,182,212,0.08)',  icon: Layers },
  creative_generation:              { label: 'Gerando Criativo',  color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', icon: Clock },
  creative_pending_approval:        { label: 'Rev. Criativo',     color: '#f97316', bg: 'rgba(249,115,22,0.08)', icon: AlertCircle },
  creative_approved:                { label: 'Criativo OK',       color: '#10b981', bg: 'rgba(16,185,129,0.08)', icon: CheckCircle },
  caption_generation:               { label: 'Gerando Legenda',   color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', icon: Clock },
  caption_pending_approval:         { label: 'Rev. Legenda',      color: '#f97316', bg: 'rgba(249,115,22,0.08)', icon: AlertCircle },
  caption_approved:                 { label: 'Legenda OK',        color: '#10b981', bg: 'rgba(16,185,129,0.08)', icon: CheckCircle },
  publish_confirmation_pending:     { label: 'Aguard. Confirm.',  color: '#06b6d4', bg: 'rgba(6,182,212,0.08)',  icon: Clock },
  ads_offer_pending:                { label: 'Aguard. Tráfego',   color: '#a855f7', bg: 'rgba(168,85,247,0.08)', icon: Clock },
  audience_analysis_generation:     { label: 'Analisando',        color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', icon: TrendingUp },
  audience_analysis_pending_approval:{ label: 'Rev. Análise',     color: '#f97316', bg: 'rgba(249,115,22,0.08)', icon: AlertCircle },
  ready_to_publish:                 { label: 'Pronto',            color: '#06b6d4', bg: 'rgba(6,182,212,0.08)',  icon: CheckCircle },
  publishing:                       { label: 'Publicando…',       color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', icon: Clock },
  published:                        { label: 'Publicado',         color: '#10b981', bg: 'rgba(16,185,129,0.08)', icon: CheckCircle },
  rejected:                         { label: 'Rejeitado',         color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  icon: XCircle },
  needs_revision:                   { label: 'Em Revisão',        color: '#f97316', bg: 'rgba(249,115,22,0.08)', icon: RotateCcw },
  canceled:                         { label: 'Cancelado',         color: '#475569', bg: 'rgba(71,85,105,0.08)',  icon: ZapOff },
  error:                            { label: 'Erro',              color: '#ef4444', bg: 'rgba(239,68,68,0.08)',  icon: AlertCircle },
};

const OBJECTIVES = {
  engagement:     { label: 'Engajamento',  icon: Heart },
  branding:       { label: 'Branding',     icon: Target },
  lead_generation:{ label: 'Leads',        icon: Users },
  sales:          { label: 'Vendas',       icon: TrendingUp },
};
const POST_TYPES = {
  image:    { label: 'Imagem',    icon: Image },
  video:    { label: 'Vídeo',     icon: Video },
  reel:     { label: 'Reel',      icon: Film },
  carousel: { label: 'Carrossel', icon: Layout },
};

function StatusBadge({ status }) {
  const cfg = STATUS[status] || { label: status, color: '#64748b', bg: 'rgba(100,116,139,0.08)', icon: Clock };
  const Icon = cfg.icon;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}25`, borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 600, letterSpacing: '0.3px' }}>
      <Icon size={10} />
      {cfg.label}
    </span>
  );
}

// ── Modal de criação ────────────────────────────────────────────────────────
function NewCampaignModal({ onClose, onCreate }) {
  const [form, setForm] = useState({
    campaign_name: '', objective: 'engagement', post_type: 'image',
    source_type: 'ai_generated', niche: '', product_or_service: '',
    cta_text: '', briefing_text: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const field = (key, value) => setForm(f => ({ ...f, [key]: value }));

  const labelSt = { display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#475569', marginBottom: 6 };
  const inputSt = { width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '9px 12px', color: '#f1f5f9', fontSize: 13, outline: 'none', fontFamily: 'inherit' };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.campaign_name.trim()) { setError('Nome obrigatório'); return; }
    setLoading(true);
    try { const d = await api.campaignCreate(form); onCreate(d); }
    catch (err) { setError(err.message || 'Erro ao criar'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: 28, width: '100%', maxWidth: 520, boxShadow: '0 32px 64px rgba(0,0,0,0.6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Instagram size={16} color="#a78bfa" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>Nova Campanha</h3>
            <p style={{ margin: 0, fontSize: 12, color: '#475569' }}>Instagram Campaign Publisher</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <label style={labelSt}>Nome</label>
              <input style={inputSt} value={form.campaign_name} onChange={e => field('campaign_name', e.target.value)} placeholder="Ex: Lançamento Produto X — Jul 25" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelSt}>Objetivo</label>
                <select style={inputSt} value={form.objective} onChange={e => field('objective', e.target.value)}>
                  <option value="engagement">Engajamento</option>
                  <option value="branding">Branding</option>
                  <option value="lead_generation">Captação de Leads</option>
                  <option value="sales">Vendas</option>
                </select>
              </div>
              <div>
                <label style={labelSt}>Tipo de Post</label>
                <select style={inputSt} value={form.post_type} onChange={e => field('post_type', e.target.value)}>
                  <option value="image">Imagem</option>
                  <option value="video">Vídeo</option>
                  <option value="reel">Reel</option>
                  <option value="carousel">Carrossel</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelSt}>Nicho</label>
                <input style={inputSt} value={form.niche} onChange={e => field('niche', e.target.value)} placeholder="Ex: Beleza e estética" />
              </div>
              <div>
                <label style={labelSt}>Produto / Serviço</label>
                <input style={inputSt} value={form.product_or_service} onChange={e => field('product_or_service', e.target.value)} placeholder="Ex: Preenchimento labial" />
              </div>
            </div>
            <div>
              <label style={labelSt}>Call to Action</label>
              <input style={inputSt} value={form.cta_text} onChange={e => field('cta_text', e.target.value)} placeholder="Ex: Agende sua consulta" />
            </div>
            <div>
              <label style={labelSt}>Briefing</label>
              <textarea style={{ ...inputSt, resize: 'vertical', minHeight: 72 }} value={form.briefing_text} onChange={e => field('briefing_text', e.target.value)} placeholder="Descreva o briefing completo…" />
            </div>
            <div>
              <label style={labelSt}>Origem do Material</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                {[
                  ['ai_generated', 'Gerar com IA'],
                  ['user_supplied', 'Material pronto'],
                  ['mixed', 'Misto'],
                ].map(([val, lbl]) => (
                  <button key={val} type="button" onClick={() => field('source_type', val)} style={{ padding: '8px 6px', border: `1px solid ${form.source_type === val ? 'rgba(139,92,246,0.5)' : 'rgba(255,255,255,0.06)'}`, background: form.source_type === val ? 'rgba(139,92,246,0.12)' : 'transparent', borderRadius: 8, color: form.source_type === val ? '#a78bfa' : '#475569', fontSize: 11, cursor: 'pointer', fontWeight: 600, transition: 'all 0.15s' }}>
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 12 }}>{error}</p>}

          <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{ padding: '9px 18px', border: '1px solid rgba(255,255,255,0.07)', background: 'transparent', color: '#64748b', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
              Cancelar
            </button>
            <button type="submit" disabled={loading} style={{ padding: '9px 22px', background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', border: 'none', color: '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: loading ? 0.7 : 1 }}>
              {loading ? 'Criando…' : 'Criar Campanha'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────
export default function CampaignPosts() {
  const navigate = useNavigate();
  const toast = useToast();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');

  const fetch = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.campaignList(filterStatus ? { status: filterStatus } : {});
      setCampaigns(Array.isArray(data) ? data : []);
    } catch (e) { setCampaigns([]); toast.error('Erro ao carregar campanhas: ' + (e.message || '')); }
    finally { setLoading(false); }
  }, [filterStatus]);

  useEffect(() => { fetch(); }, [fetch]);

  const handleCreate = (c) => {
    setShowModal(false);
    toast.success(`Campanha "${c.campaign_name || 'Nova'}" criada com sucesso!`);
    navigate(`/campaigns/${c.id}`);
  };

  const filtered = campaigns.filter(c =>
    !search || (c.campaign_name || '').toLowerCase().includes(search.toLowerCase()) || (c.niche || '').toLowerCase().includes(search.toLowerCase())
  );

  const stats = [
    { label: 'Total', value: campaigns.length, color: '#8b5cf6' },
    { label: 'Publicadas', value: campaigns.filter(c => c.status === 'published').length, color: '#10b981' },
    { label: 'Em progresso', value: campaigns.filter(c => !['published','canceled','error','rejected','draft_created'].includes(c.status)).length, color: '#06b6d4' },
    { label: 'Pendentes', value: campaigns.reduce((a, c) => a + (c.pending_approvals || 0), 0), color: '#f59e0b' },
  ];

  return (
    <div style={{ padding: '28px 32px', minHeight: '100vh', color: '#f1f5f9', fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Instagram size={20} color="#a78bfa" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.3px' }}>Campanhas IG</h1>
            <p style={{ margin: 0, fontSize: 12, color: '#475569', fontWeight: 500 }}>Instagram Campaign Publisher</p>
          </div>
        </div>
        <button
          onClick={() => setShowModal(true)}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa', borderRadius: 9, cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.15s' }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(139,92,246,0.25)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(139,92,246,0.15)'}
        >
          <Plus size={14} />
          Nova Campanha
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {stats.map(s => (
          <div key={s.label} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 3, height: 32, borderRadius: 2, background: s.color }} />
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: 11, color: '#475569', fontWeight: 600, marginTop: 2 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '0 12px' }}>
          <Search size={13} color="#475569" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou nicho…" style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: '#f1f5f9', fontSize: 13, padding: '9px 0', fontFamily: 'inherit' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8, padding: '0 12px' }}>
          <Filter size={12} color="#475569" />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ background: 'none', border: 'none', outline: 'none', color: '#64748b', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
            <option value="">Todos os status</option>
            {Object.entries(STATUS).map(([val, cfg]) => <option key={val} value={val}>{cfg.label}</option>)}
          </select>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', color: '#475569', padding: '60px 0', fontSize: 14 }}>Carregando campanhas…</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Instagram size={24} color="#7c3aed" />
          </div>
          <h3 style={{ color: '#475569', marginBottom: 6, fontWeight: 600 }}>Nenhuma campanha</h3>
          <p style={{ color: '#334155', fontSize: 13 }}>Crie sua primeira campanha para começar</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 16 }}>
          {filtered.map(c => {
            const TypeIcon = POST_TYPES[c.post_type]?.icon || Image;
            const ObjIcon = OBJECTIVES[c.objective]?.icon || Target;
            return (
              <div
                key={c.id}
                onClick={() => navigate(`/campaigns/${c.id}`)}
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '18px 20px', cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.transform = 'none'; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <TypeIcon size={13} color="#64748b" />
                    </div>
                    <div style={{ width: 28, height: 28, borderRadius: 7, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ObjIcon size={13} color="#64748b" />
                    </div>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
                <h3 style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#e2e8f0', letterSpacing: '-0.1px' }}>{c.campaign_name}</h3>
                <p style={{ margin: '0 0 14px', fontSize: 12, color: '#475569' }}>{c.niche || 'Sem nicho definido'}</p>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 12 }}>
                  <span style={{ fontSize: 11, color: '#334155', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Layers size={10} color="#334155" /> {c.assets_count || 0} assets
                  </span>
                  {c.pending_approvals > 0 && (
                    <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <AlertCircle size={10} /> {c.pending_approvals} pendente{c.pending_approvals > 1 ? 's' : ''}
                    </span>
                  )}
                  <span style={{ fontSize: 11, color: '#334155', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Calendar size={10} /> {new Date(c.created_at).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && <NewCampaignModal onClose={() => setShowModal(false)} onCreate={handleCreate} />}
    </div>
  );
}
