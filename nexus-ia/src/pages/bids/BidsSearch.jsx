import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, Filter, Zap, BookMarked, Trash2, ExternalLink, ChevronDown, Loader, MapPin, Timer, Landmark, DollarSign, CheckCircle, XCircle, Database, Heart, ThumbsDown, Inbox } from 'lucide-react'
import { api } from '../../api'

const STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO']
const MODALITIES = ['Pregão Eletrônico','Pregão Presencial','Concorrência','Tomada de Preços','Convite','RDC','Dispensa','Inexigibilidade']
const LEVEL_COLORS = { 'Excelente': '#22c55e', 'Alta': '#3b82f6', 'Média': '#f59e0b', 'Baixa': '#ef4444' }

export default function BidsSearch() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [keywords, setKeywords] = useState('')
  const [uf, setUf] = useState('')
  const [modality, setModality] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [actionStates, setActionStates] = useState({}) // bid_id: 'saved'|'discarded'|'saving'

  const [searchError, setSearchError] = useState(null)

  // Tabs: live | saved
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') === 'saved' ? 'saved' : 'live')
  const [savedResults, setSavedResults] = useState([])
  const [loadingSaved, setLoadingSaved] = useState(false)
  // Sub-filter for saved tab: all | saved | discarded | pending
  const [subFilter, setSubFilter] = useState(searchParams.get('filter') || 'all')

  // Carrega importadas ao mudar para aba saved ou sub-filtro
  useEffect(() => {
    if (activeTab === 'saved') loadSaved()
  }, [activeTab, subFilter])

  useEffect(() => {
    if (searchParams.get('tab') === 'saved') {
      setActiveTab('saved')
      if (searchParams.get('filter')) setSubFilter(searchParams.get('filter'))
    }
  }, [searchParams])

  const loadSaved = async () => {
    setLoadingSaved(true)
    try {
      const query = subFilter !== 'all' ? `?action=${subFilter}` : ''
      const r = await api.get(`/bids/search-results${query}`)
      setSavedResults(r || [])
    } catch { setSavedResults([]) }
    finally { setLoadingSaved(false) }
  }

  const search = async () => {
    setLoading(true)
    setSearched(true)
    setSearchError(null)
    setActiveTab('live')
    try {
      const r = await api.post('/bids/search', { keywords, uf: uf || null, page: 1, page_size: 30, save_results: true })
      setResults(r.results || [])
      if (r.partial) {
        setSearchError('Algumas fontes não responderam — resultado parcial')
      }
    } catch (e) {
      console.error('[BidsSearch] erro:', e.message)
      setSearchError(`Erro na busca: ${e.message}`)
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const doAction = async (bid, action) => {
    const key = bid.id || bid.external_bid_id
    if (!key) return
    setActionStates(s => ({ ...s, [key]: 'saving' }))
    try {
      // Se não tem id do banco, buscar primeiro
      let bidId = bid.id
      if (!bidId && bid.external_bid_id) {
        // Busca no banco pelo external_bid_id (já persistido pelo search com save_results:true)
        try {
          const found = await api.get(`/bids/search-results?page_size=1`)
          const match = (found || []).find(b => b.external_bid_id === bid.external_bid_id)
          if (match) bidId = match.id
        } catch { /* ignore */ }
      }
      if (!bidId) {
        setActionStates(s => ({ ...s, [key]: null }))
        return
      }
      await api.post(`/bids/${bidId}/${action}`)
      const newState = action === 'save' ? 'saved' : 'discarded'
      setActionStates(s => ({ ...s, [key]: newState }))
      // Also update the saved results if in that view
      if (activeTab === 'saved') {
        setSavedResults(prev => prev.map(b =>
          b.id === bidId ? { ...b, user_action: newState } : b
        ))
      }
    } catch {
      setActionStates(s => ({ ...s, [key]: null }))
    }
  }

  const currentList = activeTab === 'saved' ? savedResults : results
  const isLoading = activeTab === 'saved' ? loadingSaved : loading

  const SUB_FILTERS = [
    { key: 'all', label: 'Todas', icon: Database },
    { key: 'pending', label: 'Pendentes', icon: Inbox },
    { key: 'saved', label: 'Selecionadas', icon: Heart },
    { key: 'discarded', label: 'Descartadas', icon: ThumbsDown },
  ]

  return (
    <div style={{ padding: '2rem', fontFamily: 'Inter, sans-serif', color: '#e2e8f0' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, background: 'linear-gradient(135deg,#a78bfa,#60a5fa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Busca de Licitações
        </h1>
        <p style={{ color: '#94a3b8', margin: '4px 0 0', fontSize: 14 }}>Busca em tempo real: PNCP · ComprasGov · Portal de Compras Públicas</p>
      </div>

      {/* Main Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'rgba(15,23,42,0.5)', borderRadius: 12, padding: 4 }}>
        {[
          { key: 'live', label: 'Busca ao Vivo', icon: Search, count: results.length },
          { key: 'saved', label: 'Importadas', icon: Database, count: savedResults.length },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '10px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
              fontWeight: activeTab === t.key ? 600 : 400, fontSize: 14,
              background: activeTab === t.key ? 'rgba(139,92,246,0.2)' : 'transparent',
              color: activeTab === t.key ? '#a78bfa' : '#64748b',
              transition: 'all 0.2s ease',
            }}
          >
            <t.icon size={15} />
            {t.label}
            {t.count > 0 && <span style={{ background: `${activeTab === t.key ? '#a78bfa' : '#475569'}30`, padding: '1px 8px', borderRadius: 10, fontSize: 12 }}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* Sub-filters for Importadas tab */}
      {activeTab === 'saved' && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {SUB_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setSubFilter(f.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 14px', borderRadius: 20, fontSize: 13,
                border: subFilter === f.key ? '1px solid rgba(139,92,246,0.5)' : '1px solid rgba(255,255,255,0.08)',
                background: subFilter === f.key ? 'rgba(139,92,246,0.15)' : 'rgba(15,23,42,0.5)',
                color: subFilter === f.key ? '#a78bfa' : '#94a3b8',
                cursor: 'pointer', fontWeight: subFilter === f.key ? 600 : 400,
                transition: 'all 0.2s',
              }}
            >
              <f.icon size={13} /> {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Search bar — only on live tab */}
      {activeTab === 'live' && (
        <div style={{ background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 14, padding: '1.2rem', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <Search size={18} color='#6366f1' style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                value={keywords} onChange={e => setKeywords(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && search()}
                placeholder="Ex: tecnologia da informação, obras, serviços de limpeza..."
                style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '10px 12px 10px 40px', color: '#e2e8f0', fontSize: 15, boxSizing: 'border-box', outline: 'none' }}
              />
            </div>
            <button onClick={() => setShowFilters(!showFilters)} style={{ background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 10, padding: '0 14px', color: '#a5b4fc', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Filter size={16} /> Filtros <ChevronDown size={14} />
            </button>
            <button onClick={search} disabled={loading} style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', border: 'none', borderRadius: 10, padding: '0 20px', color: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
              {loading ? <Loader size={16} className="spin" /> : <Search size={16} />}
              {loading ? 'Buscando...' : 'Buscar'}
            </button>
          </div>

          {showFilters && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
              <select value={uf} onChange={e => setUf(e.target.value)} style={selectStyle}>
                <option value=''>Todos os estados</option>
                {STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <select value={modality} onChange={e => setModality(e.target.value)} style={selectStyle}>
                <option value=''>Todas as modalidades</option>
                {MODALITIES.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {searchError && (
        <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, padding: '10px 14px', marginBottom: 12, color: '#f59e0b', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Landmark size={14} /> {searchError}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', padding: '3rem', color: '#a78bfa' }}>
          <Loader size={20} style={{ animation: 'spin 1s linear infinite' }} /> {activeTab === 'saved' ? 'Carregando licitações...' : 'Buscando licitações...'}
        </div>
      )}

      {/* Empty states */}
      {!isLoading && activeTab === 'live' && searched && results.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#475569' }}>
          <Landmark size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
          <p>Nenhuma licitação encontrada. Tente outros termos ou verifique a conexão com as fontes.</p>
        </div>
      )}

      {!isLoading && activeTab === 'saved' && savedResults.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#475569' }}>
          {subFilter === 'pending' ? (
            <><CheckCircle size={40} style={{ marginBottom: 12, opacity: 0.3, color: '#22c55e' }} /><p>Nenhuma licitação pendente de revisão!</p></>
          ) : subFilter === 'saved' ? (
            <><Heart size={40} style={{ marginBottom: 12, opacity: 0.3, color: '#f472b6' }} /><p>Nenhuma licitação selecionada ainda. Busque e marque as de interesse.</p></>
          ) : subFilter === 'discarded' ? (
            <><ThumbsDown size={40} style={{ marginBottom: 12, opacity: 0.3 }} /><p>Nenhuma licitação descartada.</p></>
          ) : (
            <><Database size={40} style={{ marginBottom: 12, opacity: 0.3 }} /><p>Nenhuma licitação importada. Faça uma busca para importar.</p>
              <button onClick={() => setActiveTab('live')} style={{ marginTop: 8, background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 10, padding: '8px 16px', color: '#a78bfa', cursor: 'pointer', fontSize: 14 }}>
                <Search size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Ir para Busca
              </button>
            </>
          )}
        </div>
      )}

      {/* Results list */}
      {!isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {currentList.map((bid, i) => {
            const score = bid.adherence_score
            const level = bid.adherence_level
            const color = LEVEL_COLORS[level] || '#6b7280'
            // Determine action state from local state or from API data
            const localAction = actionStates[bid.id || bid.external_bid_id]
            const apiAction = bid.user_action  // from enriched API response
            const action = localAction || apiAction
            const isSaved = action === 'saved'
            const isDiscarded = action === 'discarded'
            const isSaving = action === 'saving'
            const isActioned = isSaved || isDiscarded

            return (
              <div
                key={bid.id || i}
                style={{
                  background: isSaved
                    ? 'rgba(34,197,94,0.05)' : isDiscarded
                    ? 'rgba(100,116,139,0.08)' : 'rgba(15,23,42,0.8)',
                  border: `1px solid ${isSaved
                    ? 'rgba(34,197,94,0.2)' : isDiscarded
                    ? 'rgba(100,116,139,0.15)' : 'rgba(255,255,255,0.07)'}`,
                  borderRadius: 14, padding: '1.2rem',
                  transition: 'all .2s', position: 'relative', overflow: 'hidden',
                  opacity: isDiscarded ? 0.6 : 1,
                }}
              >
                {/* Action badge */}
                {isActioned && (
                  <div style={{
                    position: 'absolute', top: 0, right: 0,
                    background: isSaved ? '#22c55e' : '#64748b',
                    color: '#fff', fontSize: 11, fontWeight: 600,
                    padding: '3px 12px 3px 8px', borderRadius: '0 14px 0 10px',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    {isSaved ? <><Heart size={11} /> Selecionada</> : <><ThumbsDown size={11} /> Descartada</>}
                  </div>
                )}

                {/* Score badge */}
                {score !== undefined && score !== null && !isActioned && (
                  <div style={{ position: 'absolute', top: 12, right: 12, background: `${color}22`, border: `1px solid ${color}55`, borderRadius: 20, padding: '4px 12px', fontSize: 13, fontWeight: 700, color }}>
                    {Math.round(score)} — {level}
                  </div>
                )}

                <div style={{ paddingRight: 100 }}>
                  {/* Meta line */}
                  <div style={{ fontSize: 13, color: '#6366f1', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ background: 'rgba(99,102,241,0.15)', borderRadius: 6, padding: '2px 8px' }}>{bid.source?.toUpperCase()}</span>
                    {bid.state && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><MapPin size={11} /> {bid.state}</span>}
                    {bid.modality && <span style={{ color: '#94a3b8' }}>· {bid.modality}</span>}
                  </div>

                  {/* Title — clickable to detail */}
                  <h3
                    onClick={() => bid.id && navigate(`/bids/${bid.id}`)}
                    style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600, color: '#e2e8f0', lineHeight: 1.4, cursor: bid.id ? 'pointer' : 'default' }}
                    onMouseEnter={e => { if (bid.id) e.target.style.color = '#a78bfa' }}
                    onMouseLeave={e => { e.target.style.color = '#e2e8f0' }}
                  >
                    {bid.title || bid.object_text?.slice(0, 120) || 'Sem título'}
                  </h3>

                  {/* Info line */}
                  <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Landmark size={12} /> {bid.organ_name || '—'}</span>
                    {bid.municipality && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><MapPin size={11} /> {bid.municipality}</span>}
                    {bid.estimated_value > 0 && <span style={{ color: '#22c55e', display: 'flex', alignItems: 'center', gap: 3 }}><DollarSign size={12} /> R$ {bid.estimated_value?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>}
                    {bid.deadline_date && <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 3 }}><Timer size={11} /> {new Date(bid.deadline_date).toLocaleDateString('pt-BR')}</span>}
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Main action buttons — only show if not yet actioned */}
                    {!isActioned && (
                      <>
                        <button
                          onClick={e => { e.stopPropagation(); doAction(bid, 'save') }}
                          disabled={isSaving}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.4)',
                            borderRadius: 10, padding: '8px 16px', color: '#22c55e',
                            cursor: 'pointer', fontWeight: 600, fontSize: 13,
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(34,197,94,0.25)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(34,197,94,0.12)' }}
                        >
                          {isSaving ? <Loader size={14} className="spin" /> : <Heart size={14} />}
                          Tenho Interesse
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); doAction(bid, 'discard') }}
                          disabled={isSaving}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            background: 'rgba(100,116,139,0.1)', border: '1px solid rgba(100,116,139,0.3)',
                            borderRadius: 10, padding: '8px 16px', color: '#94a3b8',
                            cursor: 'pointer', fontWeight: 500, fontSize: 13,
                            transition: 'all 0.2s',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(100,116,139,0.2)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(100,116,139,0.1)' }}
                        >
                          <ThumbsDown size={14} /> Sem Interesse
                        </button>
                      </>
                    )}

                    {/* Secondary actions — always available */}
                    <div style={{ display: 'flex', gap: 6, marginLeft: isActioned ? 0 : 'auto' }}>
                      {bid.source_url && (
                        <a href={bid.source_url} target='_blank' rel='noreferrer' onClick={e => e.stopPropagation()}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#818cf8', textDecoration: 'none', padding: '4px 8px', borderRadius: 6, background: 'rgba(99,102,241,0.08)' }}>
                          <ExternalLink size={12} /> Ver edital
                        </a>
                      )}
                      {bid.id && (
                        <button onClick={e => { e.stopPropagation(); navigate(`/bids/${bid.id}`) }} style={{ ...smallBtn('#a78bfa') }}>
                          <Zap size={12} /> Analisar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  )
}

const selectStyle = { background: 'rgba(15,23,42,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '8px 12px', color: '#e2e8f0', fontSize: 14, outline: 'none' }
const smallBtn = (color) => ({ background: `${color}15`, border: `1px solid ${color}40`, color, borderRadius: 8, padding: '4px 10px', fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 })
