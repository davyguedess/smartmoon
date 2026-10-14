import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Search, Bell, BookMarked, Target, TrendingUp, 
  AlertTriangle, Landmark, MapPin, Zap, RefreshCw, 
  Globe, CheckCircle, XCircle, AlertCircle, 
  ChevronDown, ChevronUp, Loader2, FileText, Timer, 
  Inbox, Heart, ThumbsDown, ArrowRight, ShieldCheck, 
  Cpu, Radar
} from 'lucide-react'
import { api } from '../../api'

export default function BidsDashboard() {
  const navigate = useNavigate()
  const [overview, setOverview] = useState(null)
  const [sourcesStatus, setSourcesStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [error, setError] = useState(null)

  const [selectedState, setSelectedState] = useState(null)
  const [selectedModality, setSelectedModality] = useState(null)
  const [stateBids, setStateBids] = useState([])
  const [modalityBids, setModalityBids] = useState([])
  const [loadingState, setLoadingState] = useState(false)
  const [loadingModality, setLoadingModality] = useState(false)

  const loadDashboard = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const r = await api.get('/bids/dashboard/overview')
      setOverview(r)
      setLastUpdated(new Date())
    } catch (e) {
      console.error('[BidsDashboard] erro ao carregar overview:', e.message)
      setError(e.message)
      setOverview({ total_bids: 0, high_score_bids: 0, alerts_active: 0, niches_total: 0, saved: 0, discarded: 0, by_state: [], by_modality: [] })
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
    try {
      const s = await api.get('/bids/sources/status')
      setSourcesStatus(s)
    } catch {
      setSourcesStatus({ pncp: 'unknown', comprasgov: 'unknown', pcp: 'manual_only' })
    }
  }

  const loadBidsByState = async (state) => {
    if (selectedState === state) { setSelectedState(null); setStateBids([]); return }
    setSelectedState(state)
    setLoadingState(true)
    try {
      const bids = await api.get(`/bids/search-results?state=${encodeURIComponent(state)}&page_size=50`)
      setStateBids(Array.isArray(bids) ? bids : bids?.items || [])
    } catch { setStateBids([]) }
    finally { setLoadingState(false) }
  }

  const loadBidsByModality = async (modality) => {
    if (selectedModality === modality) { setSelectedModality(null); setModalityBids([]); return }
    setSelectedModality(modality)
    setLoadingModality(true)
    try {
      const bids = await api.get(`/bids/search-results?modality=${encodeURIComponent(modality)}&page_size=50`)
      setModalityBids(Array.isArray(bids) ? bids : bids?.items || [])
    } catch { setModalityBids([]) }
    finally { setLoadingModality(false) }
  }

  useEffect(() => { loadDashboard() }, [])

  if (loading) return (
    <div className="flex flex-col h-[70vh] items-center justify-center space-y-4">
      <div className="relative">
        <div className="absolute inset-0 rounded-full blur-xl bg-indigo-500/30 animate-pulse"></div>
        <Radar className="w-16 h-16 text-indigo-400 animate-[spin_3s_linear_infinite]" />
      </div>
      <div className="text-indigo-300 font-medium tracking-widest uppercase text-sm animate-pulse">
        Sincronizando Radar Base...
      </div>
    </div>
  )

  const cards = [
    { label: 'Oportunidades Mapeadas', value: overview?.total_bids ?? 0, icon: Landmark, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20', shadow: 'shadow-indigo-500/10' },
    { label: 'Match de IA (≥75%)', value: overview?.high_score_bids ?? 0, icon: Zap, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', shadow: 'shadow-emerald-500/10' },
    { label: 'Em Análise', value: overview?.pending ?? 0, icon: Inbox, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', shadow: 'shadow-amber-500/10', link: '/bids/search?tab=saved&filter=pending' },
    { label: 'Oportunidades Salvas', value: overview?.saved ?? 0, icon: Heart, color: 'text-teal-400', bg: 'bg-teal-500/10', border: 'border-teal-500/20', shadow: 'shadow-teal-500/10', link: '/bids/search?tab=saved&filter=saved' },
    { label: 'Alertas IA Ativos', value: overview?.alerts_active ?? 0, icon: Bell, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20', shadow: 'shadow-rose-500/10' },
  ]

  return (
    <div className="p-6 lg:p-10 max-w-[1600px] mx-auto text-slate-200 font-sans min-h-screen bg-slate-950/50">
      {/* Dynamic Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-3 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-widest mb-4">
            <Cpu className="w-3 h-3" /> Módulo de Inteligência
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-emerald-400 tracking-tight">
            NEXUS BID RADAR
          </h1>
          <p className="text-slate-400 mt-2 text-sm md:text-base max-w-xl leading-relaxed">
            Mapeamento em tempo real de licitações públicas utilizando algoritmos preditivos. Conectado ao PNCP e ComprasGov.
          </p>
        </div>
        
        <div className="flex items-center gap-4 bg-slate-900/80 backdrop-blur-md p-2 rounded-2xl border border-slate-800 shadow-xl">
          <div className="px-4 text-right hidden sm:block">
            <div className="text-xs text-slate-500 font-medium uppercase tracking-wider">Última Varredura</div>
            <div className="text-sm font-semibold text-slate-300">
              {lastUpdated ? lastUpdated.toLocaleTimeString('pt-BR') : '--:--'}
            </div>
          </div>
          <button
            onClick={() => loadDashboard(true)}
            disabled={refreshing}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition-all text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-indigo-500/25 group disabled:opacity-70"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
            {refreshing ? 'Sincronizando...' : 'Forçar Varredura'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-8 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-3 text-rose-400 backdrop-blur-md">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-rose-300">Falha na Sincronização</h3>
            <p className="text-sm mt-1 opacity-80">{error}</p>
          </div>
        </div>
      )}

      {/* Main Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 mb-10">
        {cards.map((c, i) => (
          <div 
            key={i}
            onClick={() => c.link && navigate(c.link)}
            className={`group relative overflow-hidden bg-slate-900/60 backdrop-blur-xl border ${c.border} rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl ${c.shadow} ${c.link ? 'cursor-pointer' : ''}`}
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 transform translate-x-4 -translate-y-4 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500">
              <c.icon className={`w-24 h-24 ${c.color}`} />
            </div>
            
            <div className="relative z-10 flex flex-col h-full justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${c.bg} border ${c.border}`}>
                  <c.icon className={`w-5 h-5 ${c.color}`} />
                </div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{c.label}</span>
              </div>
              
              <div className="flex items-end justify-between">
                <div className={`text-4xl font-black ${c.color} drop-shadow-sm tracking-tight`}>
                  {Number(c.value || 0).toLocaleString('pt-BR')}
                </div>
                {c.link && (
                  <ArrowRight className={`w-5 h-5 ${c.color} opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300`} />
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center gap-4 mb-10 p-4 bg-slate-900/40 backdrop-blur-md border border-slate-800 rounded-2xl">
        <span className="text-sm font-semibold text-slate-500 uppercase tracking-wider px-2">Ações Rápidas:</span>
        <button onClick={() => navigate('/bids/search')} className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-indigo-600/20 text-slate-300 hover:text-indigo-300 border border-slate-700 hover:border-indigo-500/30 rounded-xl text-sm font-medium transition-all group">
          <Search className="w-4 h-4 group-hover:scale-110 transition-transform" /> Realizar Busca Avançada
        </button>
        <button onClick={() => navigate('/bids/alerts')} className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-slate-700 hover:border-rose-500/30 rounded-xl text-sm font-medium transition-all group">
          <Bell className="w-4 h-4 group-hover:rotate-12 transition-transform" /> Configurar Alertas
        </button>
        <button onClick={() => navigate('/bids/niches')} className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border border-slate-700 hover:border-emerald-500/30 rounded-xl text-sm font-medium transition-all group">
          <Target className="w-4 h-4 group-hover:scale-110 transition-transform" /> Gestão de Nichos
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
        {/* Distribuição por Estado */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 lg:p-8 flex flex-col shadow-xl">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold text-white flex items-center gap-3">
              <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg border border-purple-500/20">
                <MapPin className="w-5 h-5" />
              </div>
              Mapa de Calor (Estados)
            </h3>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-900 px-3 py-1 rounded-full border border-slate-800">Interativo</span>
          </div>
          
          <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {(overview?.by_state || []).length === 0 ? (
              <div className="text-center p-10 text-slate-500">Nenhum dado geográfico disponível.</div>
            ) : (
              (overview.by_state).map(({ state, count }) => {
                const isSelected = selectedState === state
                return (
                  <div key={state} className="group">
                    <button
                      onClick={() => loadBidsByState(state)}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all duration-200 border ${isSelected ? 'bg-purple-500/10 border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.1)]' : 'bg-slate-950/50 border-slate-800/50 hover:border-slate-700 hover:bg-slate-800/50'}`}
                    >
                      <span className={`font-bold tracking-wide flex items-center gap-3 ${isSelected ? 'text-purple-300' : 'text-slate-300 group-hover:text-white'}`}>
                        <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-purple-400 shadow-[0_0_8px_rgba(168,85,247,0.8)]' : 'bg-slate-600'}`}></span>
                        {state || 'Não Informado'}
                      </span>
                      <div className="flex items-center gap-4">
                        <span className={`px-3 py-1 rounded-lg text-sm font-bold ${isSelected ? 'bg-purple-500/20 text-purple-300' : 'bg-slate-800 text-slate-400'}`}>
                          {count}
                        </span>
                        {isSelected ? <ChevronUp className="w-4 h-4 text-purple-400" /> : <ChevronDown className="w-4 h-4 text-slate-600" />}
                      </div>
                    </button>
                    
                    {isSelected && (
                      <div className="mt-2 ml-4 p-4 rounded-xl border border-purple-500/10 bg-purple-500/5 space-y-3 animate-in slide-in-from-top-2">
                        {loadingState ? (
                          <div className="flex items-center justify-center gap-2 py-6 text-purple-400/60 text-sm font-medium">
                            <Loader2 className="w-4 h-4 animate-spin" /> Processando dados do estado...
                          </div>
                        ) : stateBids.length === 0 ? (
                          <div className="text-center py-4 text-slate-500 text-sm">Nenhum registro detalhado encontrado.</div>
                        ) : (
                          stateBids.map(bid => <BidMiniCard key={bid.id} bid={bid} navigate={navigate} />)
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* Distribuição por Modalidade */}
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 lg:p-8 flex flex-col shadow-xl">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xl font-bold text-white flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
                <TrendingUp className="w-5 h-5" />
              </div>
              Análise por Modalidade
            </h3>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider bg-slate-900 px-3 py-1 rounded-full border border-slate-800">Interativo</span>
          </div>
          
          <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {(overview?.by_modality || []).length === 0 ? (
              <div className="text-center p-10 text-slate-500">Nenhum dado de modalidade disponível.</div>
            ) : (
              (overview.by_modality).map(({ modality, count }) => {
                const isSelected = selectedModality === modality
                return (
                  <div key={modality} className="group">
                    <button
                      onClick={() => loadBidsByModality(modality)}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all duration-200 border ${isSelected ? 'bg-emerald-500/10 border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.1)]' : 'bg-slate-950/50 border-slate-800/50 hover:border-slate-700 hover:bg-slate-800/50'}`}
                    >
                      <span className={`font-bold tracking-wide flex items-center gap-3 ${isSelected ? 'text-emerald-300' : 'text-slate-300 group-hover:text-white'}`}>
                         <FileText className={`w-4 h-4 ${isSelected ? 'text-emerald-400' : 'text-slate-500'}`} />
                         {modality || 'Diversos'}
                      </span>
                      <div className="flex items-center gap-4">
                        <span className={`px-3 py-1 rounded-lg text-sm font-bold ${isSelected ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
                          {count}
                        </span>
                        {isSelected ? <ChevronUp className="w-4 h-4 text-emerald-400" /> : <ChevronDown className="w-4 h-4 text-slate-600" />}
                      </div>
                    </button>
                    
                    {isSelected && (
                      <div className="mt-2 ml-4 p-4 rounded-xl border border-emerald-500/10 bg-emerald-500/5 space-y-3 animate-in slide-in-from-top-2">
                        {loadingModality ? (
                          <div className="flex items-center justify-center gap-2 py-6 text-emerald-400/60 text-sm font-medium">
                            <Loader2 className="w-4 h-4 animate-spin" /> Processando listagem...
                          </div>
                        ) : modalityBids.length === 0 ? (
                          <div className="text-center py-4 text-slate-500 text-sm">Nenhum registro detalhado encontrado.</div>
                        ) : (
                          modalityBids.map(bid => <BidMiniCard key={bid.id} bid={bid} navigate={navigate} />)
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Source Health Panel */}
      {sourcesStatus && (
        <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-3xl p-6 lg:p-8 shadow-xl">
          <div className="flex items-center gap-3 mb-6">
            <ShieldCheck className="w-6 h-6 text-indigo-400" />
            <h3 className="text-lg font-bold text-white">Status das Conexões Oficiais</h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(sourcesStatus).map(([name, status]) => {
              const isOnline = status === 'online'
              const isManual = status === 'manual_only'
              const colorClass = isOnline ? 'emerald' : isManual ? 'amber' : 'rose'
              const Icon = isOnline ? CheckCircle : isManual ? AlertCircle : XCircle
              const label = isOnline ? 'Online / Sync Ativo' : isManual ? 'Upload Manual Apenas' : status === 'degraded' ? 'Estabilidade Comprometida' : 'Offline / Falha'
              
              return (
                <div key={name} className={`relative overflow-hidden flex flex-col gap-3 bg-${colorClass}-500/5 border border-${colorClass}-500/20 rounded-2xl p-5`}>
                  <div className={`absolute -right-6 -top-6 w-24 h-24 bg-${colorClass}-500/10 rounded-full blur-xl`}></div>
                  <div className="flex items-center justify-between z-10">
                    <span className="text-sm font-black tracking-widest text-white uppercase">{name}</span>
                    <Icon className={`w-5 h-5 text-${colorClass}-400`} />
                  </div>
                  <div className={`z-10 inline-flex self-start items-center gap-2 px-3 py-1 rounded-lg bg-${colorClass}-500/10 border border-${colorClass}-500/20 text-${colorClass}-400 text-xs font-bold`}>
                    <span className={`w-1.5 h-1.5 rounded-full bg-${colorClass}-400 ${isOnline ? 'animate-pulse' : ''}`}></span>
                    {label}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {(overview?.total_bids ?? 0) === 0 && !error && (
        <div className="mt-8 relative overflow-hidden bg-gradient-to-br from-indigo-900/20 to-purple-900/20 border border-indigo-500/20 rounded-3xl p-12 text-center shadow-2xl backdrop-blur-xl">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
          <div className="relative z-10 max-w-2xl mx-auto flex flex-col items-center">
            <div className="w-24 h-24 bg-indigo-500/10 rounded-full flex items-center justify-center mb-6 border border-indigo-500/20 shadow-[0_0_30px_rgba(99,102,241,0.2)]">
              <Search className="w-10 h-10 text-indigo-400" />
            </div>
            <h3 className="text-3xl font-black text-white mb-4 tracking-tight">O Radar está Ocioso</h3>
            <p className="text-slate-400 mb-8 text-lg">Inicie sua primeira varredura inteligente para capturar editais e oportunidades públicas compatíveis com o seu perfil.</p>
            <button onClick={() => navigate('/bids/search')} className="group flex items-center gap-3 px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold shadow-lg shadow-indigo-500/30 transition-all hover:-translate-y-1 active:scale-95">
              <Radar className="w-5 h-5 group-hover:animate-ping" />
              Ativar Busca Inteligente
            </button>
          </div>
        </div>
      )}
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(15, 23, 42, 0.4); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.2); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(99, 102, 241, 0.4); }
      `}</style>
    </div>
  )
}

function BidMiniCard({ bid, navigate }) {
  const val = bid.estimated_value || bid.value || 0
  
  return (
    <div
      onClick={() => navigate(`/bids/${bid.id}`)}
      className="group bg-slate-900 border border-slate-700/50 hover:border-indigo-500/50 hover:bg-slate-800 rounded-xl p-4 cursor-pointer transition-all duration-300 hover:shadow-lg hover:shadow-indigo-500/10"
    >
      <div className="text-sm font-bold text-slate-200 leading-snug mb-3 line-clamp-2 group-hover:text-indigo-300 transition-colors">
        {bid.title}
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="px-2 py-1 text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-400 rounded-md border border-indigo-500/20">
          {bid.source || 'UNK'}
        </span>
        {bid.state && (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 bg-slate-800 px-2 py-1 rounded-md">
            <MapPin className="w-3 h-3" /> {bid.state}
          </span>
        )}
        {val > 0 && (
          <span className="text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20">
            R$ {Number(val).toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
          </span>
        )}
        {bid.deadline_date && (
          <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400 ml-auto bg-amber-500/10 px-2 py-1 rounded-md border border-amber-500/20">
            <Timer className="w-3 h-3" /> {new Date(bid.deadline_date).toLocaleDateString('pt-BR')}
          </span>
        )}
      </div>
    </div>
  )
}
