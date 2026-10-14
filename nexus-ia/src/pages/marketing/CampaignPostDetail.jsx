import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Instagram, ArrowLeft, Image, FileText, Send, BarChart2, List,
  CheckCircle, XCircle, RotateCcw, Clock, AlertCircle, Zap,
  ChevronRight, Upload, Sparkles, ThumbsUp, ThumbsDown
} from 'lucide-react';
import { api } from '../../api';

// ── Shared styles ────────────────────────────────────────────────────────────
const card  = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 12, padding: '18px 20px' };
const label = { display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: '#475569', marginBottom: 6 };
const input = { width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '9px 12px', color: '#f1f5f9', fontSize: 13, outline: 'none', fontFamily: 'inherit' };
const btnPrimary = { padding: '8px 16px', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', color: '#a78bfa', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s' };
const btnSuccess = { padding: '8px 14px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 };
const btnDanger  = { padding: '8px 14px', background: 'rgba(239,68,68,0.08)',  border: '1px solid rgba(239,68,68,0.2)',  color: '#ef4444', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 };

const STATUS_LABELS = {
  draft_created:'Rascunho', gathering_inputs:'Coletando', creative_generation:'Gerando Criativo',
  creative_pending_approval:'Rev. Criativo', creative_approved:'Criativo OK',
  caption_generation:'Gerando Legenda', caption_pending_approval:'Rev. Legenda', caption_approved:'Legenda OK',
  publish_confirmation_pending:'Aguard. Confirmação', ads_offer_pending:'Aguard. Tráfego',
  audience_analysis_generation:'Analisando', audience_analysis_pending_approval:'Rev. Análise',
  ready_to_publish:'Pronto', publishing:'Publicando…', published:'Publicado',
  rejected:'Rejeitado', needs_revision:'Em Revisão', canceled:'Cancelado', error:'Erro',
};
const STATUS_COLOR = { published:'#10b981', ready_to_publish:'#06b6d4', publishing:'#f59e0b', error:'#ef4444', rejected:'#ef4444', canceled:'#475569', draft_created:'#8b5cf6', needs_revision:'#f97316' };

// ── Briefing Tab ─────────────────────────────────────────────────────────────
function BriefingTab({ campaign, onSave }) {
  const [form, setForm] = useState({
    campaign_name: campaign.campaign_name || '',
    objective: campaign.objective || 'engagement',
    post_type: campaign.post_type || 'image',
    niche: campaign.niche || '',
    product_or_service: campaign.product_or_service || '',
    cta_text: campaign.cta_text || '',
    target_audience_summary: campaign.target_audience_summary || '',
    briefing_text: campaign.briefing_text || '',
    notes: campaign.notes || '',
  });
  const [saving, setSaving] = useState(false);
  const f = (k, v) => setForm(x => ({ ...x, [k]: v }));

  const save = async () => {
    setSaving(true);
    try { await api.campaignUpdate(campaign.id, form); onSave(); } finally { setSaving(false); }
  };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div><label style={label}>Nome da Campanha</label><input style={input} value={form.campaign_name} onChange={e => f('campaign_name', e.target.value)} /></div>
        <div><label style={label}>Objetivo</label>
          <select style={input} value={form.objective} onChange={e => f('objective', e.target.value)}>
            <option value="engagement">Engajamento</option><option value="branding">Branding</option>
            <option value="lead_generation">Captação de Leads</option><option value="sales">Vendas</option>
          </select>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <div><label style={label}>Tipo de Post</label>
          <select style={input} value={form.post_type} onChange={e => f('post_type', e.target.value)}>
            <option value="image">Imagem</option><option value="video">Vídeo</option>
            <option value="reel">Reel</option><option value="carousel">Carrossel</option>
          </select>
        </div>
        <div><label style={label}>Nicho</label><input style={input} value={form.niche} onChange={e => f('niche', e.target.value)} /></div>
        <div><label style={label}>Produto / Serviço</label><input style={input} value={form.product_or_service} onChange={e => f('product_or_service', e.target.value)} /></div>
      </div>
      <div><label style={label}>Call to Action</label><input style={input} value={form.cta_text} onChange={e => f('cta_text', e.target.value)} /></div>
      <div><label style={label}>Público-alvo</label><input style={input} value={form.target_audience_summary} onChange={e => f('target_audience_summary', e.target.value)} placeholder="Ex: Mulheres 25–45, interesse em beleza" /></div>
      <div><label style={label}>Briefing</label><textarea style={{ ...input, resize: 'vertical', minHeight: 90 }} value={form.briefing_text} onChange={e => f('briefing_text', e.target.value)} /></div>
      <div><label style={label}>Observações</label><textarea style={{ ...input, resize: 'vertical', minHeight: 56 }} value={form.notes} onChange={e => f('notes', e.target.value)} /></div>
      <div style={{ textAlign: 'right' }}>
        <button style={{ ...btnPrimary, background: 'rgba(139,92,246,0.2)' }} onClick={save} disabled={saving}>
          <CheckCircle size={13} />{saving ? 'Salvando…' : 'Salvar Briefing'}
        </button>
      </div>
    </div>
  );
}

// ── Asset Card ───────────────────────────────────────────────────────────────
function AssetCard({ asset, onApprove, onReject }) {
  return (
    <div style={{ ...card, borderColor: asset.approval_status === 'approved' ? 'rgba(16,185,129,0.2)' : asset.approval_status === 'rejected' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.07)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 11, color: '#475569' }}>v{asset.version_number} · {asset.origin === 'ai' ? 'IA' : 'Manual'}</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {asset.approval_status === 'approved' && <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><CheckCircle size={11} /> Aprovado</span>}
          {asset.approval_status === 'rejected' && <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}><XCircle size={11} /> Rejeitado</span>}
          {asset.approval_status === 'pending' && (
            <>
              <button style={btnSuccess} onClick={onApprove}><ThumbsUp size={11} /> Aprovar</button>
              <button style={btnDanger}  onClick={onReject}><ThumbsDown size={11} /> Rejeitar</button>
            </>
          )}
        </div>
      </div>
      <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: '#94a3b8', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
        {asset.content_text || '(sem conteúdo)'}
      </div>
    </div>
  );
}

// ── Criativo Tab ──────────────────────────────────────────────────────────────
function CriativoTab({ campaign, onRefresh }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  const fetch = useCallback(async () => {
    try { const d = await api.campaignListAssets(campaign.id, 'image'); setAssets(Array.isArray(d) ? d : []); } catch(_) {}
  }, [campaign.id]);
  useEffect(() => { fetch(); }, [fetch]);

  const generate = async () => {
    setLoading(true); setMsg(null);
    try { await api.campaignGenerateImage(campaign.id); setMsg({ type: 'ok', text: 'Criativo gerado' }); fetch(); onRefresh(); }
    catch(e) { setMsg({ type: 'err', text: e.message }); } finally { setLoading(false); }
  };

  const approve = async () => { try { await api.campaignApproveStep(campaign.id, 'creative_approval', 'Aprovado'); fetch(); onRefresh(); } catch(e) { setMsg({type:'err', text:e.message}); } };
  const reject  = async () => { try { await api.campaignRejectStep(campaign.id, 'creative_approval', 'Rejeitado'); fetch(); onRefresh(); } catch(e) { setMsg({type:'err', text:e.message}); } };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <button style={btnPrimary} onClick={generate} disabled={loading}>
          <Sparkles size={13} />{loading ? 'Gerando…' : 'Gerar com IA'}
        </button>
        <button style={{ ...btnPrimary, color: '#64748b', borderColor: 'rgba(255,255,255,0.07)', background: 'transparent' }}>
          <Upload size={13} /> Upload manual
        </button>
      </div>
      {msg && <p style={{ margin: 0, fontSize: 12, color: msg.type === 'ok' ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', gap: 6 }}>
        {msg.type === 'ok' ? <CheckCircle size={12} /> : <AlertCircle size={12} />}{msg.text}
      </p>}
      {assets.length === 0
        ? <div style={{ ...card, textAlign: 'center', padding: '40px 20px', color: '#334155' }}>
            <Image size={24} color="#334155" style={{ margin: '0 auto 10px', display: 'block' }} />
            <p style={{ margin: 0, fontSize: 13 }}>Nenhum criativo gerado ainda</p>
          </div>
        : assets.map(a => <AssetCard key={a.id} asset={a} onApprove={approve} onReject={reject} />)
      }
    </div>
  );
}

// ── Legenda Tab ───────────────────────────────────────────────────────────────
function LegendaTab({ campaign, onRefresh }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tone, setTone] = useState('profissional');
  const [msg, setMsg] = useState(null);

  const fetch = useCallback(async () => {
    try { const d = await api.campaignListAssets(campaign.id, 'caption'); setAssets(Array.isArray(d) ? d : []); } catch(_) {}
  }, [campaign.id]);
  useEffect(() => { fetch(); }, [fetch]);

  const generate = async () => {
    setLoading(true); setMsg(null);
    try {
      await api.campaignGenerateCaption(campaign.id, { tone, length:'medium', include_cta:true, include_hashtags:true, num_hashtags:10, language:'pt-BR' });
      setMsg({ type:'ok', text:'Legenda gerada via Ollama' }); fetch(); onRefresh();
    } catch(e) { setMsg({ type:'err', text:e.message }); } finally { setLoading(false); }
  };

  const approve = async () => { try { await api.campaignApproveStep(campaign.id, 'caption_approval', 'Aprovada'); fetch(); onRefresh(); } catch(e) { setMsg({type:'err', text:e.message}); } };
  const reject  = async () => { try { await api.campaignRejectStep(campaign.id, 'caption_approval', 'Rejeitada'); fetch(); onRefresh(); } catch(e) { setMsg({type:'err', text:e.message}); } };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={tone} onChange={e => setTone(e.target.value)} style={{ ...input, width: 'auto', padding: '8px 12px' }}>
          <option value="profissional">Tom: Profissional</option>
          <option value="casual">Tom: Casual</option>
          <option value="inspirador">Tom: Inspirador</option>
          <option value="divertido">Tom: Divertido</option>
        </select>
        <button style={btnPrimary} onClick={generate} disabled={loading}>
          <Sparkles size={13} />{loading ? 'Gerando via Ollama…' : 'Gerar Legenda'}
        </button>
      </div>
      {msg && <p style={{ margin: 0, fontSize: 12, color: msg.type === 'ok' ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', gap: 6 }}>
        {msg.type === 'ok' ? <CheckCircle size={12} /> : <AlertCircle size={12} />}{msg.text}
      </p>}
      {assets.length === 0
        ? <div style={{ ...card, textAlign: 'center', padding: '40px 20px', color: '#334155' }}>
            <FileText size={24} color="#334155" style={{ margin: '0 auto 10px', display: 'block' }} />
            <p style={{ margin: 0, fontSize: 13 }}>Nenhuma legenda gerada ainda</p>
          </div>
        : assets.map(a => <AssetCard key={a.id} asset={a} onApprove={approve} onReject={reject} />)
      }
    </div>
  );
}

// ── Publicação Tab ────────────────────────────────────────────────────────────
function PublicacaoTab({ campaign, onRefresh }) {
  const [publishing, setPublishing] = useState(false);
  const [log, setLog] = useState(null);
  const [msg, setMsg] = useState(null);
  const isReady = ['ready_to_publish','publish_confirmation_pending'].includes(campaign.status);

  const publish = async () => {
    if (!window.confirm('Publicar agora no Instagram?')) return;
    setPublishing(true); setMsg(null);
    try { const l = await api.campaignPublish(campaign.id); setLog(l); setMsg({ type: l.publish_status === 'success' ? 'ok' : 'err', text: l.publish_status === 'success' ? 'Publicado com sucesso!' : l.error_message }); onRefresh(); }
    catch(e) { setMsg({ type:'err', text:e.message }); } finally { setPublishing(false); }
  };

  const skipAds = async () => { try { await api.campaignNextStep(campaign.id, 'ready_to_publish'); onRefresh(); } catch(_) {} };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {campaign.status === 'caption_approved' && (
        <div style={{ ...card, borderColor: 'rgba(139,92,246,0.2)' }}>
          <p style={{ margin: '0 0 6px', fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>Análise de Tráfego Pago</p>
          <p style={{ margin: '0 0 14px', fontSize: 12, color: '#475569' }}>Gerar análise de público antes de publicar?</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={btnPrimary} onClick={async () => { try { await api.campaignGenerateAnalysis(campaign.id); onRefresh(); } catch(_) {} }}><BarChart2 size={13} /> Gerar Análise</button>
            <button style={{ ...btnPrimary, color: '#475569', borderColor: 'rgba(255,255,255,0.07)', background:'transparent' }} onClick={skipAds}>Pular <ChevronRight size={12} /></button>
          </div>
        </div>
      )}
      <div style={card}>
        <p style={{ margin: '0 0 6px', fontSize: 13, color: '#e2e8f0', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Instagram size={15} color="#a78bfa" /> Publicar no Instagram
        </p>
        <p style={{ margin: '0 0 14px', fontSize: 12, color: '#475569' }}>
          Status: <strong style={{ color: STATUS_COLOR[campaign.status] || '#94a3b8' }}>{STATUS_LABELS[campaign.status]}</strong>
        </p>
        {!campaign.integration_id && (
          <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 12, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={13} /> Nenhuma conta Instagram vinculada
          </div>
        )}
        <button
          onClick={isReady ? publish : undefined}
          disabled={!isReady || publishing}
          style={{ ...isReady ? { ...btnPrimary, background: 'rgba(16,185,129,0.15)', borderColor: 'rgba(16,185,129,0.3)', color: '#10b981' } : { ...btnPrimary, background: 'transparent', borderColor: 'rgba(255,255,255,0.05)', color: '#334155', cursor: 'not-allowed' } }}
        >
          <Send size={13} />{publishing ? 'Publicando…' : 'Publicar'}
        </button>
      </div>
      {msg && (
        <div style={{ ...card, borderColor: msg.type === 'ok' ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.2)' }}>
          <p style={{ margin: 0, fontSize: 13, color: msg.type === 'ok' ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', gap: 8 }}>
            {msg.type === 'ok' ? <CheckCircle size={14} /> : <AlertCircle size={14} />}{msg.text}
          </p>
          {log && <p style={{ margin: '6px 0 0', fontSize: 11, color: '#475569' }}>Container: {log.container_id || '—'} · Media: {log.media_id || '—'}</p>}
        </div>
      )}
    </div>
  );
}

// ── Tráfego Pago Tab ──────────────────────────────────────────────────────────
function TrafegoPagoTab({ campaign, onRefresh }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => { api.campaignGetAnalysis(campaign.id).then(setAnalysis).catch(() => {}); }, [campaign.id]);

  const generate = async () => {
    setLoading(true); setMsg(null);
    try { const d = await api.campaignGenerateAnalysis(campaign.id); setAnalysis(d); setMsg({ type:'ok', text:'Análise gerada' }); onRefresh(); }
    catch(e) { setMsg({ type:'err', text:e.message }); } finally { setLoading(false); }
  };

  const approve = async () => { try { await api.campaignApproveStep(campaign.id, 'ads_analysis_approval', 'Aprovada'); onRefresh(); } catch(_) {} };

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', gap: 10 }}>
        <button style={btnPrimary} onClick={generate} disabled={loading}><BarChart2 size={13} />{loading ? 'Analisando…' : 'Gerar Análise'}</button>
        {analysis && <button style={btnSuccess} onClick={approve}><ThumbsUp size={13} /> Aprovar</button>}
      </div>
      {msg && <p style={{ margin: 0, fontSize: 12, color: msg.type === 'ok' ? '#10b981' : '#ef4444' }}>{msg.text}</p>}
      {!analysis
        ? <div style={{ ...card, textAlign: 'center', padding: '40px 20px', color: '#334155' }}>
            <BarChart2 size={24} color="#334155" style={{ margin: '0 auto 10px', display: 'block' }} />
            <p style={{ margin: 0, fontSize: 13 }}>Nenhuma análise ainda</p>
          </div>
        : <>
          {[
            { title: 'Resumo do Nicho', key: 'niche_summary' },
            { title: 'Perfil do Público', key: 'audience_profile' },
            { title: 'Investimento Estimado', key: 'estimated_budget_range' },
          ].filter(x => analysis[x.key]).map(({ title, key }) => (
            <div key={key} style={card}>
              <p style={{ margin: '0 0 8px', fontSize: 11, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#475569' }}>{title}</p>
              <p style={{ margin: 0, fontSize: 13, color: '#cbd5e1', lineHeight: 1.6 }}>{analysis[key]}</p>
            </div>
          ))}
          {analysis.recommended_interests_json?.length > 0 && (
            <div style={card}>
              <p style={{ margin: '0 0 10px', fontSize: 11, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#475569' }}>Interesses Recomendados</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {analysis.recommended_interests_json.map(i => (
                  <span key={i} style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: '#a78bfa', borderRadius: 6, padding: '3px 8px', fontSize: 11 }}>{i}</span>
                ))}
              </div>
            </div>
          )}
        </>
      }
    </div>
  );
}

// ── Logs Tab ──────────────────────────────────────────────────────────────────
function LogsTab({ campaign, approvals }) {
  const [logs, setLogs] = useState([]);
  useEffect(() => { api.campaignPublishLogs(campaign.id).then(setLogs).catch(() => {}); }, [campaign.id]);
  const statusColor = STATUS_COLOR[campaign.status] || '#64748b';

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div style={{ ...card, borderColor: `${statusColor}30` }}>
        <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#475569' }}>Status Atual</p>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: statusColor }}>{STATUS_LABELS[campaign.status] || campaign.status}</p>
      </div>
      {approvals.length > 0 && (
        <div style={card}>
          <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#475569' }}>Aprovações</p>
          <div style={{ display: 'grid', gap: 6 }}>
            {approvals.map(a => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
                <span style={{ fontSize: 12, color: '#94a3b8' }}>{a.step_name.replace(/_/g,' ')}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: a.status==='approved'?'#10b981':a.status==='rejected'?'#ef4444':'#f59e0b', display:'flex',alignItems:'center',gap:4 }}>
                  {a.status==='approved'?<CheckCircle size={10}/>:a.status==='rejected'?<XCircle size={10}/>:<Clock size={10}/>}
                  {a.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      {logs.length > 0 && (
        <div style={card}>
          <p style={{ margin: '0 0 12px', fontSize: 11, fontWeight: 700, letterSpacing: '0.6px', textTransform: 'uppercase', color: '#475569' }}>Histórico de Publicação</p>
          {logs.map(l => (
            <div key={l.id} style={{ padding:'10px 12px', background:'rgba(255,255,255,0.02)', borderRadius:8, marginBottom:6, fontSize:12, color:'#94a3b8' }}>
              <div>Status: <strong style={{ color: l.publish_status==='success'?'#10b981':'#ef4444' }}>{l.publish_status}</strong></div>
              {l.error_message && <div style={{ color:'#ef4444', marginTop:4 }}>{l.error_message}</div>}
              <div style={{ fontSize:10, color:'#334155', marginTop:4 }}>{new Date(l.created_at).toLocaleString('pt-BR')}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'briefing',   label: 'Briefing',     icon: FileText },
  { id: 'criativo',   label: 'Criativo',     icon: Image },
  { id: 'legenda',    label: 'Legenda',      icon: FileText },
  { id: 'publicacao', label: 'Publicação',   icon: Send },
  { id: 'trafego',    label: 'Tráfego Pago', icon: BarChart2 },
  { id: 'logs',       label: 'Logs',         icon: List },
];

export default function CampaignPostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState(null);
  const [approvals, setApprovals] = useState([]);
  const [tab, setTab] = useState('briefing');
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      const [c, a] = await Promise.all([api.campaignGet(id), api.campaignListApprovals(id).catch(() => [])]);
      setCampaign(c); setApprovals(Array.isArray(a) ? a : []);
    } catch(_) {} finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetch(); }, [fetch]);

  if (loading) return <div style={{ padding: 40, color: '#475569', textAlign: 'center', fontSize: 14 }}>Carregando…</div>;
  if (!campaign) return <div style={{ padding: 40, color: '#ef4444', textAlign: 'center', fontSize: 14 }}>Campanha não encontrada</div>;

  const statusColor = STATUS_COLOR[campaign.status] || '#64748b';

  return (
    <div style={{ padding: '24px 32px', minHeight: '100vh', color: '#f1f5f9', fontFamily: "'Inter', sans-serif" }}>
      {/* Back */}
      <button onClick={() => navigate('/campaigns')} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 12, marginBottom: 16, padding: 0 }}>
        <ArrowLeft size={13} /> Voltar às campanhas
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Instagram size={18} color="#a78bfa" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#f1f5f9', letterSpacing: '-0.3px' }}>{campaign.campaign_name}</h1>
            <p style={{ margin: 0, fontSize: 12, color: '#475569' }}>#{campaign.id} · {campaign.objective} · {campaign.post_type}</p>
          </div>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: `${statusColor}15`, color: statusColor, border: `1px solid ${statusColor}30`, borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700 }}>
          {STATUS_LABELS[campaign.status] || campaign.status}
        </span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 22 }}>
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: active ? '#a78bfa' : '#475569', borderBottom: `2px solid ${active ? '#8b5cf6' : 'transparent'}`, marginBottom: -1, transition: 'all 0.15s' }}>
              <Icon size={13} />{t.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {tab === 'briefing'   && <BriefingTab   campaign={campaign} onSave={fetch} />}
      {tab === 'criativo'   && <CriativoTab   campaign={campaign} onRefresh={fetch} />}
      {tab === 'legenda'    && <LegendaTab    campaign={campaign} onRefresh={fetch} />}
      {tab === 'publicacao' && <PublicacaoTab campaign={campaign} onRefresh={fetch} />}
      {tab === 'trafego'    && <TrafegoPagoTab campaign={campaign} onRefresh={fetch} />}
      {tab === 'logs'       && <LogsTab campaign={campaign} approvals={approvals} />}
    </div>
  );
}
