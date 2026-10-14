import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Zap, AlertTriangle, CheckCircle, ChevronRight, ExternalLink, Loader, Download, FileText, Search, XCircle, HelpCircle, Clock, Landmark, Building, MapPin, DollarSign, Timer, Sparkles, Bot, Eye, ClipboardList, History, BookOpen, Scale, Wrench, Banknote, StickyNote, Pin, MessageSquare, Send, X } from 'lucide-react'
import { api } from '../../api'

const TAB_ICONS = [Eye, BookOpen, Bot, ClipboardList, History]
const TABS = ['Visão Geral', 'Edital', 'Análise IA', 'Checklist', 'Histórico']
const LEVEL_COLORS = { 'Excelente': '#22c55e', 'Alta': '#3b82f6', 'Média': '#f59e0b', 'Baixa': '#ef4444' }
const REC_COLORS = { participar: '#22c55e', avaliar_com_cautela: '#f59e0b', descartar: '#ef4444' }
const REC_LABELS = { participar: 'Participar', avaliar_com_cautela: 'Avaliar com Cautela', descartar: 'Descartar' }

const STATUS_CONFIG = {
  simples: { color: '#22c55e', label: 'Simples' },
  medio: { color: '#f59e0b', label: 'Médio' },
  complexo: { color: '#ef4444', label: 'Complexo' },
}
const CATEGORY_LABELS = {
  juridica: { Icon: Scale, label: 'Habilitação Jurídica', color: '#818cf8' },
  fiscal: { Icon: Landmark, label: 'Regularidade Fiscal', color: '#60a5fa' },
  tecnica: { Icon: Wrench, label: 'Qualificação Técnica', color: '#34d399' },
  economica: { Icon: Banknote, label: 'Qualificação Econômica', color: '#fbbf24' },
  proposta: { Icon: StickyNote, label: 'Proposta', color: '#f472b6' },
  outras: { Icon: Pin, label: 'Outras Exigências', color: '#94a3b8' },
}

// ── Toast Notification System ─────────────────────────────────────────────────
function Toast({ message, type = 'info', onClose }) {
  const [visible, setVisible] = useState(true)
  const colors = {
    info: { bg: 'rgba(99,102,241,0.12)', border: 'rgba(99,102,241,0.35)', text: '#a5b4fc', icon: '💡' },
    success: { bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.35)', text: '#86efac', icon: '✅' },
    error: { bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.35)', text: '#fca5a5', icon: '⚠️' },
    warning: { bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.35)', text: '#fcd34d', icon: '⏳' },
    agent: { bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.35)', text: '#c4b5fd', icon: '🤖' },
  }
  const c = colors[type] || colors.info

  useEffect(() => {
    const t = setTimeout(() => { setVisible(false); setTimeout(onClose, 300) }, 5000)
    return () => clearTimeout(t)
  }, [onClose])

  return (
    <div style={{
      background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10,
      padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10,
      fontSize: 13, color: c.text, animation: visible ? 'toastIn 0.3s ease' : 'toastOut 0.3s ease',
      opacity: visible ? 1 : 0, transition: 'opacity 0.3s ease',
    }}>
      <span style={{ fontSize: 16 }}>{c.icon}</span>
      <span style={{ flex: 1, lineHeight: 1.4 }}>{message}</span>
      <button onClick={() => { setVisible(false); setTimeout(onClose, 300) }} style={{
        background: 'none', border: 'none', color: c.text, cursor: 'pointer', padding: 2,
        opacity: 0.6, flexShrink: 0,
      }}>
        <X size={14} />
      </button>
    </div>
  )
}

function ToastContainer({ toasts, removeToast }) {
  return (
    <div style={{
      position: 'fixed', top: 16, right: 16, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 420, minWidth: 280,
    }}>
      {toasts.map(t => (
        <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
      ))}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function BidDetail() {
  const { bidId } = useParams()
  const navigate = useNavigate()
  const [bid, setBid] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [editalData, setEditalData] = useState(null)
  const [editalAnalysis, setEditalAnalysis] = useState(null)
  const [tab, setTab] = useState(0)
  const [analyzing, setAnalyzing] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [analyzingEdital, setAnalyzingEdital] = useState(false)
  const [loading, setLoading] = useState(true)
  const [expandedReqs, setExpandedReqs] = useState({})
  const [toasts, setToasts] = useState([])

  // ── Toast helpers ──────────────────────────────────────────────────────────
  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
  }, [])
  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // ── Send task to agent chat ───────────────────────────────────────────────
  const sendToAgent = useCallback((prompt) => {
    // Store the prompt to auto-send in chat
    localStorage.setItem('nexus_agent_pending_message', prompt)
    addToast('Enviando tarefa para o agente IA...', 'agent')
    setTimeout(() => navigate('/chat'), 600)
  }, [navigate, addToast])

  // ── Load data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const loadData = async () => {
      try {
        const bidData = await api.get(`/bids/${bidId}`).catch(() => null)
        if (bidData) setBid(bidData)
      } catch { /* silently fail */ }

      try {
        const analysisData = await api.get(`/bids/${bidId}/analysis`).catch(() => null)
        if (analysisData) setAnalysis(analysisData)
      } catch { /* silently fail */ }

      try {
        const edital = await api.get(`/bids/${bidId}/edital`).catch(() => null)
        if (edital && edital.text_length > 0) setEditalData(edital)
      } catch { /* silently fail */ }

      setLoading(false)
    }
    loadData()
  }, [bidId])

  // ── Helper: get edital text snippet for agent context ─────────────────────
  const getEditalSnippet = (maxChars = 4000) => {
    const text = editalData?.text_content || editalData?.text_preview || ''
    if (!text) return ''
    return `\n\n--- TEXTO DO EDITAL (primeiros ${Math.min(text.length, maxChars)} de ${text.length} caracteres) ---\n${text.slice(0, maxChars)}${text.length > maxChars ? '\n[... texto truncado ...]' : ''}\n--- FIM DO EDITAL ---`
  }

  // ── Action: Download Edital (backend only — now works with pdfplumber) ───
  const downloadEdital = async () => {
    setDownloading(true)
    addToast('Baixando edital do portal PNCP...', 'warning')
    try {
      const r = await api.post(`/bids/${bidId}/download-edital`)
      if (r.text_length > 0) {
        setEditalData(r)
        setTab(1)
        addToast(`Edital baixado com sucesso! ${r.text_length.toLocaleString()} caracteres extraídos.`, 'success')
      } else {
        // PDF baixado mas sem texto extraído
        setEditalData(r)
        addToast('PDF baixado, mas não foi possível extrair o texto. Tente a análise pela IA.', 'warning')
      }
    } catch (e) {
      const msg = e?.response?.data?.detail || e.message || 'Erro ao baixar edital'
      addToast(`Erro no download: ${msg}`, 'error')
    } finally {
      setDownloading(false)
    }
  }

  // ── Action: Analyze Edital Requirements ──────────────────────────────────
  const analyzeEdital = async () => {
    if (!editalData) {
      addToast('Baixe o edital primeiro antes de analisar.', 'warning')
      return
    }

    setAnalyzingEdital(true)
    addToast('Iniciando análise profunda com IA...', 'warning')
    try {
      const r = await api.post(`/bids/${bidId}/edital/analyze`)
      setEditalAnalysis(r.analysis)
      setTab(3)
      addToast(`Análise concluída: ${r.analysis?.summary?.total_requirements || 0} exigências identificadas!`, 'success')
    } catch (e) {
      addToast(`Análise backend falhou. Enviando texto do edital para o agente...`, 'error')
      // Delegate to agent WITH actual edital text
      setTimeout(() => {
        sendToAgent(
          `Analise as exigências do edital da licitação #${bidId}` +
          (bid ? ` — "${bid.title}" (${bid.organ_name}, ${bid.state})` : '') +
          `.${getEditalSnippet(6000)}` +
          `\n\nCom base no texto acima, identifique TODAS as exigências de habilitação e participação, categorizando em:\n` +
          `1. **Jurídica** (documentos societários, registros)\n` +
          `2. **Fiscal** (certidões negativas, regularidade fiscal)\n` +
          `3. **Técnica** (atestados, qualificações)\n` +
          `4. **Econômica** (capital social, balanço patrimonial)\n` +
          `5. **Proposta** (formato, prazos, preços)\n\n` +
          `Para cada exigência, indique a complexidade (simples/médio/complexo) e a ação necessária.\n` +
          `Ao final, dê uma recomendação geral: PARTICIPAR, AVALIAR COM CAUTELA, ou DESCARTAR.`
        )
      }, 1500)
    } finally {
      setAnalyzingEdital(false)
    }
  }

  // ── Action: AI Analysis ──────────────────────────────────────────────────
  const runAnalysis = async () => {
    setAnalyzing(true)
    addToast('Solicitando análise IA da licitação...', 'warning')
    try {
      const r = await api.post(`/bids/${bidId}/analyze`, { analysis_level: 'profunda' })
      setAnalysis(r)
      setTab(2)
      addToast(`Análise IA concluída — Recomendação: ${REC_LABELS[r.recommendation] || r.recommendation}`, 'success')
    } catch (e) {
      addToast(`Análise backend falhou. Delegando para agente com contexto completo...`, 'error')
      // Delegate to agent with full context including edital
      setTimeout(() => {
        sendToAgent(
          `Faça uma análise completa da licitação #${bidId}` +
          (bid ? ` — "${bid.title}"` : '') +
          (bid ? `\n\nInformações da Licitação:\n- Órgão: ${bid.organ_name}\n- Estado: ${bid.state}\n- Modalidade: ${bid.modality || 'N/A'}\n- Valor: R$ ${bid.estimated_value?.toLocaleString('pt-BR') || 'N/A'}\n- Prazo: ${bid.deadline_date || 'N/A'}\n- Objeto: ${bid.object_text || bid.title}` : '') +
          getEditalSnippet(4000) +
          `\n\nQuero saber:\n1. Resumo executivo\n2. Potencial comercial (alto/médio/baixo)\n3. Complexidade de participação\n4. Requisitos principais de habilitação\n5. Riscos identificados\n6. Documentos necessários\n7. Recomendação: PARTICIPAR, AVALIAR COM CAUTELA ou DESCARTAR\n8. Justificativa detalhada`
        )
      }, 1500)
    } finally {
      setAnalyzing(false)
    }
  }

  // ── Action: Ask agent about this bid ─────────────────────────────────────
  const askAgent = () => {
    sendToAgent(
      `Preciso de ajuda com a licitação #${bidId}` +
      (bid ? ` — "${bid.title}" do órgão ${bid.organ_name} (${bid.state}).` : '.') +
      (bid?.estimated_value ? ` Valor estimado: R$ ${bid.estimated_value.toLocaleString('pt-BR')}.` : '') +
      (editalData ? getEditalSnippet(3000) : '') +
      ` O que você pode me dizer sobre esta licitação? Quais são os passos para participar?`
    )
  }

  const toggleReq = (id) => setExpandedReqs(p => ({ ...p, [id]: !p[id] }))

  if (loading) return <div style={{ padding: '4rem', textAlign: 'center', color: '#a78bfa' }}>⏳ Carregando licitação...</div>
  if (!bid) return <div style={{ padding: '4rem', textAlign: 'center', color: '#ef4444' }}>Licitação não encontrada.</div>

  const scoreColor = LEVEL_COLORS[bid.adherence_level] || '#6b7280'

  return (
    <div style={{ padding: '2rem', fontFamily: 'Inter, sans-serif', color: '#e2e8f0', maxWidth: 960 }}>
      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* Toast CSS Animations */}
      <style>{`
        @keyframes toastIn { from { transform: translateX(100%); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
        @keyframes toastOut { from { transform: translateX(0); opacity: 1 } to { transform: translateX(100%); opacity: 0 } }
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
      `}</style>

      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6366f1', fontSize: 14, marginBottom: 16, cursor: 'pointer' }} onClick={() => navigate('/bids/search')}>
        ← Voltar à busca
      </div>

      {/* Title + Score */}
      <div style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: '1.5rem', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div style={{ color: '#6366f1', fontSize: 13, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Landmark size={14} /> {bid.source?.toUpperCase()} · {bid.state} · {bid.modality}
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px', lineHeight: 1.4 }}>{bid.title}</h1>
            <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#94a3b8', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Building size={13} /> {bid.organ_name}</span>
              {bid.municipality && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><MapPin size={13} /> {bid.municipality}</span>}
              {bid.estimated_value > 0 && <span style={{ color: '#22c55e', display: 'flex', alignItems: 'center', gap: 4 }}><DollarSign size={13} /> R$ {bid.estimated_value?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>}
              {bid.deadline_date && <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 4 }}><Timer size={13} /> Prazo: {new Date(bid.deadline_date).toLocaleDateString('pt-BR')}</span>}
            </div>
          </div>
          <div>
            {bid.adherence_score != null && (
              <div style={{ textAlign: 'center', background: `${scoreColor}22`, border: `1px solid ${scoreColor}55`, borderRadius: 12, padding: '12px 20px' }}>
                <div style={{ fontSize: 32, fontWeight: 800, color: scoreColor }}>{Math.round(bid.adherence_score)}</div>
                <div style={{ fontSize: 12, color: scoreColor }}>Score · {bid.adherence_level}</div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <button onClick={downloadEdital} disabled={downloading} style={btnStyle(downloading, '#059669', '#065f46')}>
            {downloading ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={16} />}
            {downloading ? 'Baixando...' : editalData ? 'Edital Baixado ✓' : 'Baixar Edital'}
          </button>
          <button onClick={analyzeEdital} disabled={analyzingEdital || !editalData} style={btnStyle(analyzingEdital || !editalData, '#7c3aed', '#4c1d95')} title={!editalData ? 'Baixe o edital primeiro' : ''}>
            {analyzingEdital ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={16} />}
            {analyzingEdital ? 'Analisando...' : 'Analisar Exigências'}
          </button>
          <button onClick={runAnalysis} disabled={analyzing} style={btnStyle(analyzing, '#6366f1', '#312e81')}>
            {analyzing ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={16} />}
            {analyzing ? 'Analisando...' : 'Análise IA'}
          </button>
          <button onClick={askAgent} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)', border: 'none',
            borderRadius: 10, padding: '10px 16px', color: '#fff', cursor: 'pointer',
            fontWeight: 600, fontSize: 13, transition: 'all 0.2s ease',
          }}>
            <MessageSquare size={16} /> Perguntar ao Agente
          </button>
          {bid.source_url && (
            <a href={bid.source_url} target='_blank' rel='noreferrer' style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 10, padding: '10px 16px', color: '#a5b4fc', textDecoration: 'none', fontSize: 14 }}>
              <ExternalLink size={16} /> Ver no Portal
            </a>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
        {TABS.map((t, i) => {
          const TabIcon = TAB_ICONS[i]
          return (
            <button key={t} onClick={() => setTab(i)} style={{
              background: tab === i ? 'rgba(139,92,246,0.2)' : 'transparent',
              border: tab === i ? '1px solid rgba(139,92,246,0.4)' : '1px solid transparent',
              borderRadius: 8, padding: '8px 16px',
              color: tab === i ? '#a78bfa' : '#64748b',
              cursor: 'pointer', fontSize: 13, fontWeight: 500,
              position: 'relative', display: 'flex', alignItems: 'center', gap: 6,
              transition: 'all 0.15s ease',
            }}>
              <TabIcon size={14} />
              {t}
              {i === 1 && editalData && <span style={{ position: 'absolute', top: 4, right: 4, width: 6, height: 6, background: '#22c55e', borderRadius: '50%' }} />}
              {i === 3 && editalAnalysis && <span style={{ position: 'absolute', top: 4, right: 4, width: 6, height: 6, background: '#22c55e', borderRadius: '50%' }} />}
            </button>
          )
        })}
      </div>

      {/* Tab 0: Visão Geral */}
      {tab === 0 && (
        <div style={panelStyle}>
          <h3 style={{ color: '#a78bfa', margin: '0 0 16px', fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}><ClipboardList size={16} /> Objeto da Licitação</h3>
          <p style={{ color: '#e2e8f0', lineHeight: 1.7, margin: '0 0 20px' }}>{bid.object_text || 'Descrição não disponível.'}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              ['Fonte', bid.source?.toUpperCase()],
              ['Estado', bid.state],
              ['Município', bid.municipality || '—'],
              ['Modalidade', bid.modality || '—'],
              ['Publicação', bid.publication_date ? new Date(bid.publication_date).toLocaleDateString('pt-BR') : '—'],
              ['Prazo', bid.deadline_date ? new Date(bid.deadline_date).toLocaleDateString('pt-BR') : '—'],
              ['Com Edital', bid.has_edital ? 'Sim' : 'Não'],
              ['Status', bid.status || '—'],
            ].map(([label, val]) => (
              <div key={label} style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '10px 14px' }}>
                <div style={{ color: '#64748b', fontSize: 12 }}>{label}</div>
                <div style={{ color: '#e2e8f0', fontSize: 14, fontWeight: 500, marginTop: 2 }}>{val || '—'}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 1: Edital */}
      {tab === 1 && (
        <div>
          {!editalData ? (
            <div style={{ ...panelStyle, textAlign: 'center', padding: '3rem' }}>
              <FileText size={48} color="#64748b" style={{ marginBottom: 16 }} />
              <p style={{ color: '#94a3b8', marginBottom: 16 }}>O edital ainda não foi baixado.</p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={downloadEdital} disabled={downloading} style={btnStyle(downloading, '#059669', '#065f46')}>
                  {downloading ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Download size={16} />}
                  {downloading ? 'Baixando edital...' : 'Baixar Edital do PNCP'}
                </button>
                <button onClick={() => sendToAgent(
                  `Baixe o edital da licitação #${bidId}` +
                  (bid ? ` — "${bid.title}" (${bid.organ_name})` : '') +
                  `. Use o portal ${bid?.source_url || 'PNCP'} para encontrar o documento.`
                )} style={btnStyle(false, '#8b5cf6', '#6d28d9')}>
                  <Bot size={16} /> Pedir ao Agente
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Edital Info */}
              <div style={{ ...panelStyle, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <FileText size={24} color="#22c55e" />
                  <div>
                    <div style={{ fontWeight: 600 }}>{editalData.filename || 'Edital baixado'}</div>
                    <div style={{ color: '#64748b', fontSize: 13 }}>
                      {editalData.text_length ? `${(editalData.text_length / 1000).toFixed(1)}k caracteres extraídos` : ''}
                      {editalData.file_size ? ` · ${(editalData.file_size / 1024 / 1024).toFixed(2)} MB` : ''}
                    </div>
                  </div>
                </div>
                <button onClick={analyzeEdital} disabled={analyzingEdital} style={btnStyle(analyzingEdital, '#7c3aed', '#4c1d95')}>
                  {analyzingEdital ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={16} />}
                  Analisar Exigências
                </button>
              </div>

              {/* Available files */}
              {editalData.arquivos_disponiveis?.length > 0 && (
                <div style={{ ...panelStyle, marginBottom: 16 }}>
                  <h3 style={{ color: '#60a5fa', margin: '0 0 12px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}><FileText size={14} /> Arquivos Disponíveis no PNCP</h3>
                  {editalData.arquivos_disponiveis.map((a, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 13 }}>
                      <FileText size={14} color="#818cf8" />
                      <span style={{ color: '#e2e8f0' }}>{a.titulo || a.tipo || `Arquivo ${a.id}`}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Text preview */}
              <div style={panelStyle}>
                <h3 style={{ color: '#a78bfa', margin: '0 0 12px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}><BookOpen size={14} /> Texto do Edital (pré-visualização)</h3>
                <pre style={{ color: '#cbd5e1', fontSize: 12, lineHeight: 1.6, maxHeight: 500, overflow: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: 16, margin: 0 }}>
                  {editalData.text_preview || editalData.text_content?.slice(0, 3000) || 'Texto não disponível'}
                </pre>
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab 2: Análise IA (básica) */}
      {tab === 2 && (
        <div>
          {!analysis ? (
            <div style={{ ...panelStyle, textAlign: 'center', padding: '3rem' }}>
              <Bot size={40} color="#64748b" style={{ marginBottom: 12 }} />
              <p style={{ color: '#94a3b8', marginBottom: 16 }}>Nenhuma análise gerada ainda.</p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button onClick={runAnalysis} disabled={analyzing} style={btnStyle(analyzing, '#6366f1', '#312e81')}>
                  {analyzing ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={16} />}
                  {analyzing ? 'Analisando...' : 'Análise IA'}
                </button>
                <button onClick={askAgent} style={btnStyle(false, '#8b5cf6', '#6d28d9')}>
                  <MessageSquare size={16} /> Perguntar ao Agente
                </button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ background: `${REC_COLORS[analysis.recommendation]}15`, border: `1px solid ${REC_COLORS[analysis.recommendation]}40`, borderRadius: 12, padding: '1rem 1.5rem', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: REC_COLORS[analysis.recommendation] }}>
                  {REC_LABELS[analysis.recommendation] || analysis.recommendation}
                </span>
                <span style={{ fontSize: 13, color: '#94a3b8' }}>Nível: {analysis.analysis_level}</span>
              </div>
              <div style={{ ...panelStyle, marginBottom: 16 }}>
                <h3 style={{ color: '#a78bfa', margin: '0 0 12px', fontSize: 15, display: 'flex', alignItems: 'center', gap: 6 }}><FileText size={15} /> Resumo Executivo</h3>
                <p style={{ color: '#e2e8f0', lineHeight: 1.7, margin: 0 }}>{analysis.executive_summary}</p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div style={panelStyle}>
                  <h3 style={{ color: '#60a5fa', margin: '0 0 12px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}><Zap size={14} /> Métricas</h3>
                  {[
                    ['Potencial Comercial', analysis.commercial_potential],
                    ['Complexidade', analysis.participation_complexity],
                  ].map(([l, v]) => (
                    <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <span style={{ color: '#94a3b8', fontSize: 14 }}>{l}</span>
                      <span style={{ color: '#e2e8f0', textTransform: 'capitalize', fontWeight: 600 }}>{v || '—'}</span>
                    </div>
                  ))}
                </div>
                <div style={panelStyle}>
                  <h3 style={{ color: '#f59e0b', margin: '0 0 12px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={14} /> Principais Riscos</h3>
                  {(analysis.main_risks || []).map((r, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, padding: '4px 0', fontSize: 13, color: '#e2e8f0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <AlertTriangle size={14} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} /> {r}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={panelStyle}>
                  <h3 style={{ color: '#22c55e', margin: '0 0 12px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircle size={14} /> Requisitos Principais</h3>
                  {(analysis.main_requirements || []).map((r, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, padding: '4px 0', fontSize: 13, color: '#e2e8f0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <CheckCircle size={14} color="#22c55e" style={{ flexShrink: 0, marginTop: 2 }} /> {r}
                    </div>
                  ))}
                </div>
                <div style={panelStyle}>
                  <h3 style={{ color: '#818cf8', margin: '0 0 12px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}><FileText size={14} /> Documentos Necessários</h3>
                  {(analysis.documents_needed || []).map((d, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, padding: '4px 0', fontSize: 13, color: '#e2e8f0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <ChevronRight size={14} color="#818cf8" style={{ flexShrink: 0, marginTop: 2 }} /> {d}
                    </div>
                  ))}
                </div>
              </div>
              {analysis.justification && (
                <div style={{ ...panelStyle, marginTop: 16 }}>
                  <h3 style={{ color: '#94a3b8', margin: '0 0 8px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}><HelpCircle size={14} /> Justificativa</h3>
                  <p style={{ color: '#e2e8f0', margin: 0, fontSize: 14, lineHeight: 1.6 }}>{analysis.justification}</p>
                </div>
              )}
              {/* Agent CTA at bottom */}
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <button onClick={() => sendToAgent(
                  `Faça uma análise mais detalhada da licitação #${bidId} — "${bid?.title}". ` +
                  `A análise automática recomendou: ${REC_LABELS[analysis.recommendation] || analysis.recommendation}. ` +
                  `Quero saber mais detalhes sobre riscos, documentação necessária e prazo de preparação.`
                )} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
                  borderRadius: 10, padding: '10px 20px', color: '#c4b5fd', cursor: 'pointer',
                  fontWeight: 600, fontSize: 13, transition: 'all 0.2s ease',
                }}>
                  <Bot size={16} /> Pedir análise mais detalhada ao Agente
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Tab 3: Checklist de Exigências */}
      {tab === 3 && (
        <div>
          {!editalAnalysis ? (
            <div style={{ ...panelStyle, textAlign: 'center', padding: '3rem' }}>
              <Search size={48} color="#64748b" style={{ marginBottom: 16 }} />
              <p style={{ color: '#94a3b8', marginBottom: 8 }}>Análise profunda do edital não realizada.</p>
              <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>
                {!editalData ? 'Primeiro, baixe o edital. Depois clique em "Analisar Exigências".' : 'Clique em "Analisar Exigências" para ver o checklist completo.'}
              </p>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                {editalData && (
                  <button onClick={analyzeEdital} disabled={analyzingEdital} style={btnStyle(analyzingEdital, '#7c3aed', '#4c1d95')}>
                    {analyzingEdital ? <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Search size={16} />}
                    Analisar Exigências do Edital
                  </button>
                )}
                <button onClick={() => sendToAgent(
                  `Analise o edital da licitação #${bidId}` +
                  (bid ? ` — "${bid.title}" (${bid.organ_name})` : '') +
                  `. ${editalData ? 'O texto do edital já está salvo.' : 'O edital ainda não foi baixado, obtenha-o primeiro.'} ` +
                  `Identifique todas as exigências de habilitação e participação, categorizando em: jurídica, fiscal, técnica, econômica e proposta.`
                )} style={btnStyle(false, '#8b5cf6', '#6d28d9')}>
                  <Bot size={16} /> Pedir ao Agente
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Summary Header */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                {[
                  { label: 'Total Exigências', value: editalAnalysis.summary?.total_requirements || 0, color: '#a78bfa' },
                  { label: 'Simples', value: editalAnalysis.summary?.simples || 0, color: '#22c55e' },
                  { label: 'Médio', value: editalAnalysis.summary?.medio || 0, color: '#f59e0b' },
                  { label: 'Complexo', value: editalAnalysis.summary?.complexo || 0, color: '#ef4444' },
                ].map(s => (
                  <div key={s.label} style={{ background: `${s.color}15`, border: `1px solid ${s.color}30`, borderRadius: 12, padding: '16px', textAlign: 'center' }}>
                    <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 12, color: s.color, marginTop: 4 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Recommendation */}
              {editalAnalysis.recommendation && (
                <div style={{ background: `${REC_COLORS[editalAnalysis.recommendation]}15`, border: `1px solid ${REC_COLORS[editalAnalysis.recommendation]}40`, borderRadius: 12, padding: '1rem 1.5rem', marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: REC_COLORS[editalAnalysis.recommendation] }}>
                      {REC_LABELS[editalAnalysis.recommendation] || editalAnalysis.recommendation}
                    </span>
                    {editalAnalysis.estimated_preparation_days && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#94a3b8' }}>
                        <Clock size={14} /> ~{editalAnalysis.estimated_preparation_days} dias de preparação
                      </span>
                    )}
                  </div>
                  {editalAnalysis.recommendation_justification && (
                    <p style={{ color: '#cbd5e1', fontSize: 13, margin: '8px 0 0', lineHeight: 1.5 }}>{editalAnalysis.recommendation_justification}</p>
                  )}
                </div>
              )}

              {/* Edital Summary */}
              {editalAnalysis.edital_summary && (
                <div style={{ ...panelStyle, marginBottom: 16 }}>
                  <h3 style={{ color: '#a78bfa', margin: '0 0 8px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}><ClipboardList size={14} /> Resumo do Edital</h3>
                  <p style={{ color: '#e2e8f0', fontSize: 14, lineHeight: 1.6, margin: 0 }}>{editalAnalysis.edital_summary}</p>
                </div>
              )}

              {/* Checklist by Category */}
              {Object.entries(
                (editalAnalysis.checklist || []).reduce((acc, item) => {
                  const cat = item.category || 'outras'
                  if (!acc[cat]) acc[cat] = []
                  acc[cat].push(item)
                  return acc
                }, {})
              ).map(([category, items]) => {
                const catConfig = CATEGORY_LABELS[category] || CATEGORY_LABELS.outras
                return (
                  <div key={category} style={{ ...panelStyle, marginBottom: 12 }}>
                    <h3 style={{ color: catConfig.color, margin: '0 0 14px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <catConfig.Icon size={14} /> {catConfig.label}
                      <span style={{ fontSize: 12, color: '#64748b', fontWeight: 400 }}>({items.length})</span>
                    </h3>
                    {items.map((req, i) => {
                      const sc = STATUS_CONFIG[req.complexity] || STATUS_CONFIG.medio
                      const isExpanded = expandedReqs[req.id || `${category}-${i}`]
                      return (
                        <div key={req.id || i} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 10, marginBottom: 10 }}>
                          <div
                            onClick={() => toggleReq(req.id || `${category}-${i}`)}
                            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer', gap: 12 }}
                          >
                            <div style={{ display: 'flex', gap: 10, flex: 1 }}>
                              <span style={{ width: 10, height: 10, borderRadius: '50%', background: sc.color, flexShrink: 0, marginTop: 3 }} />
                              <div>
                                <div style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 500, lineHeight: 1.4 }}>{req.requirement}</div>
                                <div style={{ color: '#64748b', fontSize: 11, marginTop: 2 }}>{req.document_section}</div>
                              </div>
                            </div>
                            <span style={{ color: sc.color, fontSize: 11, fontWeight: 600, padding: '2px 8px', background: `${sc.color}20`, borderRadius: 6, flexShrink: 0 }}>
                              {sc.label}
                            </span>
                          </div>

                          {isExpanded && (
                            <div style={{ marginTop: 10, marginLeft: 28, animation: 'fadeIn 0.2s ease' }}>
                              {req.excerpt && (
                                <div style={{ background: 'rgba(99,102,241,0.08)', borderLeft: '3px solid #6366f1', padding: '10px 14px', borderRadius: '0 8px 8px 0', marginBottom: 8 }}>
                                  <div style={{ color: '#64748b', fontSize: 11, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}><FileText size={11} /> Trecho do edital:</div>
                                  <div style={{ color: '#cbd5e1', fontSize: 12, lineHeight: 1.5, fontStyle: 'italic' }}>"{req.excerpt}"</div>
                                </div>
                              )}
                              {req.action_needed && (
                                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 12, color: '#f59e0b', marginBottom: 6 }}>
                                  <HelpCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                                  <span>{req.action_needed}</span>
                                </div>
                              )}
                              {req.common_documents?.length > 0 && (
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                                  {req.common_documents.map((doc, di) => (
                                    <span key={di} style={{ padding: '2px 10px', background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 20, fontSize: 11, color: '#c4b5fd' }}>
                                      {doc}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}

              {/* Risks */}
              {editalAnalysis.risks?.length > 0 && (
                <div style={{ ...panelStyle, marginTop: 4 }}>
                  <h3 style={{ color: '#f59e0b', margin: '0 0 10px', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={14} /> Riscos Identificados</h3>
                  {editalAnalysis.risks.map((r, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', fontSize: 13, color: '#e2e8f0' }}>
                      <AlertTriangle size={14} color="#f59e0b" style={{ flexShrink: 0, marginTop: 2 }} /> {r}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Tab 4: Histórico */}
      {tab === 4 && (
        <div style={panelStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ color: '#a78bfa', margin: 0, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}><History size={16} /> Histórico de Ações</h3>
            <button onClick={() => sendToAgent(
              `Resumo completo das ações tomadas sobre a licitação #${bidId}` +
              (bid ? ` — "${bid.title}"` : '') +
              `. Quais análises foram feitas? Qual o status atual? Quais próximos passos recomendar?`
            )} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)',
              borderRadius: 8, padding: '6px 12px', color: '#c4b5fd', cursor: 'pointer',
              fontWeight: 600, fontSize: 12,
            }}>
              <Bot size={14} /> Consultar Agente
            </button>
          </div>
          <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem 0' }}>
            Histórico de ações internas em desenvolvimento.
            <br /><span style={{ fontSize: 12 }}>Use o botão "Consultar Agente" para obter um resumo das atividades.</span>
          </p>
        </div>
      )}
    </div>
  )
}

const panelStyle = { background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, padding: '1.4rem' }

const btnStyle = (disabled, baseColor, darkColor) => ({
  background: disabled ? 'rgba(99,102,241,0.15)' : `linear-gradient(135deg,${baseColor},${darkColor})`,
  border: 'none', borderRadius: 10, padding: '10px 18px', color: '#fff',
  cursor: disabled ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: 13,
  display: 'flex', alignItems: 'center', gap: 8, opacity: disabled ? 0.5 : 1,
  transition: 'all 0.2s ease',
})
