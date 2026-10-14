/**
 * AdminGatewayPage.jsx — Gateway de Pagamento (Superadmin)
 * 4 Abas: Dashboard | KYC | Carteiras | Configurações
 * Configurações unifica: Credenciais + Gerenciar + Webhooks
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../../api'

// ── SVG Icons ──────────────────────────────────────────────────────────────────
const Icon = {
  dashboard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
    </svg>
  ),
  kyc: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  ),
  wallet: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>
    </svg>
  ),
  settings: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ),
  arrowUp: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 19V5M5 12l7-7 7 7"/></svg>,
  arrowDown: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>,
  refresh: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M21 3v5h-5M3 21v-5h5"/></svg>,
  trophy: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>,
  shield: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  key: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78Zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>,
  globe: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>,
  lock: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  creditCard: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>,
}

// ── helpers ────────────────────────────────────────────────────────────────────
const fmtBRL  = (v) => `R$ ${Number(v||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}`
const fmtDate = (s) => s ? new Date(s).toLocaleString('pt-BR') : '—'
const fmtDateShort = (s) => s ? new Date(s).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) + ' ' + new Date(s).toLocaleDateString('pt-BR') : '—'

const TX_TYPE_COLORS = { credit:'#10b981', debit:'#ef4444', hold:'#f59e0b', release:'#6366f1', refund:'#ec4899', fee:'#94a3b8', adjustment:'#0ea5e9' }
const TX_TYPE_LABELS = { credit:'Crédito', debit:'Débito', hold:'Bloqueio', release:'Liberação', refund:'Estorno', fee:'Taxa', adjustment:'Ajuste' }

// ── api calls ──────────────────────────────────────────────────────────────────
// NOTE: api.get/post already return parsed JSON directly (not axios {data} wrapper)
const fetchConfig    = () => api.get('/admin/gateway/config')
const saveConfig     = (b) => api.post('/admin/gateway/config',b)
const testGateway    = (p) => api.post('/admin/gateway/test',{provider:p})
const fetchDashboard = () => api.get('/admin/gateway/dashboard')
const fetchWebhooks  = (s='') => api.get(`/admin/gateway/webhooks${s}`)
const fetchWallets   = (p=1,q='') => api.get(`/admin/gateway/wallets?page=${p}&limit=50&q=${q}`)
const fetchKYC       = (s='',p=1) => api.get(`/admin/gateway/kyc?status=${s}&page=${p}`)
const approveKYC     = (id) => api.post(`/admin/gateway/kyc/${id}/approve`)
const rejectKYC      = (id,reason) => api.post(`/admin/gateway/kyc/${id}/reject`,{reason})
const fetchControls  = () => api.get('/admin/gateway/controls')
const saveControls   = (b) => api.post('/admin/gateway/controls',b)
const blockWd        = (company_id,blocked) => api.post('/admin/gateway/controls/block-withdrawal',{company_id,blocked})
const fetchCompanies = () => api.get('/admin/companies-list').then(r=>Array.isArray(r)?r:(r.companies||r.items||[]))

// ── Shared styles ──────────────────────────────────────────────────────────────
const S = {
  card: {
    background:'rgba(30,41,59,0.6)', backdropFilter:'blur(12px)',
    border:'1px solid rgba(99,102,241,0.08)', borderRadius:16, padding:24,
  },
  input: {
    width:'100%', padding:'11px 14px',
    background:'rgba(15,23,42,0.8)', border:'1px solid rgba(51,65,85,0.6)',
    borderRadius:10, color:'#e2e8f0', fontSize:13,
    fontFamily:'Inter,sans-serif', outline:'none', boxSizing:'border-box',
    transition:'border-color 0.2s',
  },
  label: {
    display:'block', fontSize:11, fontWeight:700,
    color:'#94a3b8', marginBottom:6,
    textTransform:'uppercase', letterSpacing:'0.8px',
  },
  btn: (color='#6366f1') => ({
    padding:'10px 20px', background:color, color:'#fff',
    border:'none', borderRadius:10, cursor:'pointer',
    fontSize:13, fontWeight:600, transition:'opacity 0.2s',
  }),
  btnSm: (color='#6366f1') => ({
    padding:'6px 14px', background:color, color:'#fff',
    border:'none', borderRadius:8, cursor:'pointer',
    fontSize:12, fontWeight:600,
  }),
  tag: (color='#6366f1') => ({
    display:'inline-flex', alignItems:'center', gap:4,
    padding:'3px 10px', background: color+'18', color,
    borderRadius:20, fontSize:11, fontWeight:700,
    border:`1px solid ${color}22`,
  }),
  sectionTitle: {
    fontSize:13, fontWeight:700, color:'#94a3b8', marginBottom:16,
    textTransform:'uppercase', letterSpacing:'0.6px',
    display:'flex', alignItems:'center', gap:10,
  },
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({toast}) {
  if (!toast) return null
  const bg = toast.type==='error'?'linear-gradient(135deg,#ef4444,#dc2626)':toast.type==='warn'?'linear-gradient(135deg,#f59e0b,#d97706)':'linear-gradient(135deg,#10b981,#059669)'
  return (
    <div style={{
      position:'fixed', bottom:24, right:24, zIndex:9999,
      background:bg, color:'#fff', padding:'12px 20px',
      borderRadius:12, fontSize:13, fontWeight:600,
      boxShadow:'0 8px 32px rgba(0,0,0,0.4)', maxWidth:360,
    }}>
      {toast.msg}
    </div>
  )
}

// ── Metric Card ───────────────────────────────────────────────────────────────
function MetricCard({label, value, sub, color='#6366f1', icon}) {
  return (
    <div style={{
      ...S.card, minWidth:170, flex:1,
      background:`linear-gradient(135deg, ${color}08, ${color}04)`,
      border:`1px solid ${color}15`,
    }}>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
        <div style={{
          width:32, height:32, borderRadius:10,
          background:`${color}15`, display:'flex',
          alignItems:'center', justifyContent:'center', color,
        }}>{icon}</div>
        <span style={{fontSize:11,fontWeight:700,color:'#64748b',textTransform:'uppercase',letterSpacing:'0.6px'}}>{label}</span>
      </div>
      <div style={{fontSize:24,fontWeight:800,color,lineHeight:1}}>{value}</div>
      {sub && <div style={{fontSize:11,color:'#64748b',marginTop:6}}>{sub}</div>}
    </div>
  )
}

// ── Toggle Switch ─────────────────────────────────────────────────────────────
function Toggle({value, onChange, label, sub, disabled}) {
  return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',
      padding:'16px 18px', background:'rgba(15,23,42,0.6)', borderRadius:12,
      border:`1px solid ${value?'rgba(16,185,129,0.2)':'rgba(51,65,85,0.4)'}`,marginBottom:10,
      transition:'border-color 0.2s'}}>
      <div>
        <div style={{fontSize:13,fontWeight:600,color:'#e2e8f0'}}>{label}</div>
        {sub && <div style={{fontSize:11,color:'#64748b',marginTop:3}}>{sub}</div>}
      </div>
      <button onClick={()=>!disabled&&onChange(!value)} style={{
        width:48, height:26, borderRadius:13, border:'none',
        background: value?'#10b981':'#334155',
        position:'relative', cursor:disabled?'not-allowed':'pointer',
        transition:'background 0.25s',
      }}>
        <span style={{
          position:'absolute', top:3, left: value?22:3,
          width:20, height:20, borderRadius:'50%', background:'#fff',
          transition:'left 0.25s', display:'block',
          boxShadow:'0 1px 3px rgba(0,0,0,0.3)',
        }}/>
      </button>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════
function TabDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const timerRef = useRef(null)

  const load = useCallback(async() => {
    try {
      setError(null)
      const result = await fetchDashboard()
      console.log('[Dashboard] API response:', result)
      setData(result)
    } catch(e) {
      console.error('[Dashboard] Fetch error:', e)
      setError(e?.response?.data?.detail || e?.message || 'Erro desconhecido')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => {
    load()
    timerRef.current = setInterval(load, 30000)
    return () => clearInterval(timerRef.current)
  }, [load])

  if (loading) return <div style={{color:'#64748b',padding:40,textAlign:'center'}}>Carregando dashboard...</div>
  if (error) return (
    <div style={{padding:40}}>
      <div style={{color:'#ef4444',fontSize:14,fontWeight:600,marginBottom:8}}>Erro ao carregar dashboard</div>
      <div style={{color:'#94a3b8',fontSize:12,marginBottom:16}}>{error}</div>
      <button onClick={()=>{setLoading(true);setError(null);load()}} style={{...S.btn(),fontSize:12}}>Tentar novamente</button>
    </div>
  )
  if (!data) return <div style={{color:'#ef4444',padding:40}}>Sem dados</div>

  const {monthly, totals, top_movers, live_ledger} = data

  return (
    <div style={{display:'flex',flexDirection:'column',gap:20}}>
      <div style={{display:'flex',alignItems:'center',gap:8}}>
        <span style={{width:8,height:8,borderRadius:'50%',background:'#10b981',display:'inline-block',boxShadow:'0 0 0 3px #10b98133',animation:'pulse 2s infinite'}}/>
        <span style={{fontSize:11,fontWeight:700,color:'#10b981',letterSpacing:'0.6px'}}>AO VIVO — atualiza a cada 30s</span>
      </div>

      <div style={{display:'flex',gap:14,flexWrap:'wrap'}}>
        <MetricCard icon={Icon.arrowUp} label="Depósitos (mês)" value={fmtBRL(monthly.deposits)} color="#10b981"/>
        <MetricCard icon={Icon.arrowDown} label="Saques (mês)" value={fmtBRL(monthly.withdrawals)} color="#ef4444"/>
        <MetricCard icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>} label="Líquido (mês)" value={fmtBRL(monthly.net)} color={monthly.net>=0?"#10b981":"#ef4444"}/>
        <MetricCard icon={Icon.wallet} label="Saldo Total" value={fmtBRL(totals.balance)} color="#6366f1"/>
        <MetricCard icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12,6 12,12 16,14"/></svg>} label="Pendentes" value={totals.pending_charges} color="#f59e0b" sub={`${totals.pending_withdrawals} saques pendentes`}/>
      </div>

      {/* Top Movers */}
      <div style={S.card}>
        <div style={S.sectionTitle}>{Icon.trophy}<span>Top Movimentadores</span></div>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
          <thead>
            <tr style={{color:'#64748b'}}>
              <th style={{textAlign:'left',padding:'6px 0'}}>Empresa</th>
              <th style={{textAlign:'right',padding:'6px 0'}}>Recebido Total</th>
              <th style={{textAlign:'right',padding:'6px 0'}}>Sacado</th>
              <th style={{textAlign:'right',padding:'6px 0'}}>Saldo</th>
            </tr>
          </thead>
          <tbody>
            {top_movers.map((m,i) => (
              <tr key={m.company_id} style={{borderTop:'1px solid rgba(30,41,59,0.8)'}}>
                <td style={{padding:'8px 0'}}>
                  <span style={{color:'#64748b',marginRight:8,fontSize:10,fontWeight:800}}>#{i+1}</span>
                  <span style={{color:'#e2e8f0',fontWeight:600}}>{m.company_name}</span>
                </td>
                <td style={{textAlign:'right',color:'#10b981',fontWeight:700}}>{fmtBRL(m.total_received)}</td>
                <td style={{textAlign:'right',color:'#ef4444'}}>{fmtBRL(m.total_withdrawn)}</td>
                <td style={{textAlign:'right',color:'#6366f1',fontWeight:700}}>{fmtBRL(m.balance)}</td>
              </tr>
            ))}
            {top_movers.length===0 && (
              <tr><td colSpan={4} style={{color:'#64748b',padding:'16px 0',textAlign:'center'}}>Nenhuma movimentação ainda</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Extrato ao vivo */}
      <div style={S.card}>
        <div style={{...S.sectionTitle,justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M16 13H8M16 17H8M10 9H8"/></svg>
            <span>Extrato ao Vivo</span>
          </div>
          <button onClick={load} style={{...S.btnSm('rgba(51,65,85,0.6)'),display:'flex',alignItems:'center',gap:4}}>{Icon.refresh} Atualizar</button>
        </div>
        <div style={{maxHeight:400,overflowY:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead style={{position:'sticky',top:0,background:'rgba(30,41,59,0.95)'}}>
              <tr style={{color:'#64748b'}}>
                <th style={{textAlign:'left',padding:'6px 8px'}}>Hora</th>
                <th style={{textAlign:'left',padding:'6px 8px'}}>Empresa</th>
                <th style={{textAlign:'left',padding:'6px 8px'}}>Tipo</th>
                <th style={{textAlign:'right',padding:'6px 8px'}}>Valor</th>
                <th style={{textAlign:'right',padding:'6px 8px'}}>Saldo Após</th>
                <th style={{textAlign:'left',padding:'6px 8px'}}>Descrição</th>
              </tr>
            </thead>
            <tbody>
              {live_ledger.map(tx => (
                <tr key={tx.id} style={{borderTop:'1px solid rgba(15,23,42,0.8)'}}>
                  <td style={{padding:'7px 8px',color:'#94a3b8',whiteSpace:'nowrap'}}>{fmtDateShort(tx.created_at)}</td>
                  <td style={{padding:'7px 8px',color:'#cbd5e1',fontWeight:600,maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{tx.company_name}</td>
                  <td style={{padding:'7px 8px'}}>
                    <span style={S.tag(TX_TYPE_COLORS[tx.type]||'#6366f1')}>{TX_TYPE_LABELS[tx.type]||tx.type}</span>
                  </td>
                  <td style={{padding:'7px 8px',textAlign:'right',fontWeight:700,color:tx.type==='credit'?'#10b981':'#ef4444'}}>
                    {tx.type==='credit'?'+':'-'}{fmtBRL(tx.amount)}
                  </td>
                  <td style={{padding:'7px 8px',textAlign:'right',color:'#94a3b8'}}>{fmtBRL(tx.balance_after)}</td>
                  <td style={{padding:'7px 8px',color:'#64748b',maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{tx.description||'—'}</td>
                </tr>
              ))}
              {live_ledger.length===0 && (
                <tr><td colSpan={6} style={{color:'#64748b',padding:'20px',textAlign:'center'}}>Nenhuma transação ainda</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: KYC
// ══════════════════════════════════════════════════════════════════════════════
const KYC_STATUS_COLOR = { pending:'#f59e0b', approved:'#10b981', rejected:'#ef4444', reviewing:'#6366f1' }

function TabKYC() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [toast, setToast] = useState(null)
  const showToast=(msg,type='success')=>{setToast({msg,type});setTimeout(()=>setToast(null),4000)}

  const load=async(s='')=>{setLoading(true);try{const d=await fetchKYC(s);setItems(d.items||[])}catch{showToast('Erro ao carregar KYC','error')}finally{setLoading(false)}}
  useEffect(()=>{load()},[])

  const handleApprove=async(id)=>{try{await approveKYC(id);showToast('KYC aprovado!');load(filter)}catch{showToast('Erro','error')}}
  const handleReject=async(id)=>{const reason=window.prompt('Motivo da reprovação:');if(reason===null)return;try{await rejectKYC(id,reason);showToast('KYC reprovado');load(filter)}catch{showToast('Erro','error')}}

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      <Toast toast={toast}/>
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        {['','pending','approved','rejected'].map(s=>(
          <button key={s} onClick={()=>{setFilter(s);load(s)}}
            style={{...S.btnSm(filter===s?'#6366f1':'rgba(51,65,85,0.6)'),borderRadius:20}}>
            {s==='pending'?'Pendentes':s==='approved'?'Aprovados':s==='rejected'?'Rejeitados':'Todos'}
          </button>
        ))}
      </div>

      <div style={S.card}>
        {loading ? (
          <div style={{color:'#64748b',textAlign:'center',padding:24}}>Carregando...</div>
        ) : items.length===0 ? (
          <div style={{textAlign:'center',padding:32}}>
            <div style={{width:48,height:48,borderRadius:14,background:'rgba(99,102,241,0.1)',display:'inline-flex',alignItems:'center',justifyContent:'center',marginBottom:12,color:'#6366f1'}}>{Icon.kyc}</div>
            <div style={{color:'#64748b'}}>Nenhuma solicitação KYC {filter?`com status "${filter}"`:''}</div>
            <div style={{fontSize:11,marginTop:6,color:'#475569'}}>Solicitações aparecerão aqui quando clientes enviarem documentos</div>
          </div>
        ) : (
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead><tr style={{color:'#64748b'}}>
              <th style={{textAlign:'left',padding:'8px'}}>Empresa</th>
              <th style={{textAlign:'left',padding:'8px'}}>Status</th>
              <th style={{textAlign:'left',padding:'8px'}}>Enviado em</th>
              <th style={{textAlign:'left',padding:'8px'}}>Docs</th>
              <th style={{textAlign:'left',padding:'8px'}}>Ações</th>
            </tr></thead>
            <tbody>
              {items.map(item=>(
                <tr key={item.id} style={{borderTop:'1px solid rgba(15,23,42,0.8)'}}>
                  <td style={{padding:'10px 8px',color:'#e2e8f0',fontWeight:600}}>{item.company_name}</td>
                  <td style={{padding:'10px 8px'}}><span style={S.tag(KYC_STATUS_COLOR[item.status]||'#94a3b8')}>{item.status}</span></td>
                  <td style={{padding:'10px 8px',color:'#94a3b8'}}>{fmtDate(item.submitted_at)}</td>
                  <td style={{padding:'10px 8px',color:'#64748b'}}>{(item.docs_urls||[]).length} arquivo(s)</td>
                  <td style={{padding:'10px 8px'}}>
                    <div style={{display:'flex',gap:6}}>
                      {item.status==='pending' && <>
                        <button onClick={()=>handleApprove(item.id)} style={S.btnSm('#10b981')}>✓ Aprovar</button>
                        <button onClick={()=>handleReject(item.id)} style={S.btnSm('#ef4444')}>✗ Reprovar</button>
                      </>}
                      {item.status==='rejected'&&item.rejection_reason&&<span style={{color:'#94a3b8',fontSize:11}}>Motivo: {item.rejection_reason}</span>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: CARTEIRAS
// ══════════════════════════════════════════════════════════════════════════════
function TabWallets() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')

  const load=async(p=1,search='')=>{setLoading(true);try{setData(await fetchWallets(p,search))}catch{}finally{setLoading(false)}}
  useEffect(()=>{load()},[])

  const wallets = data?.wallets || []
  const total = data?.total || 0
  const totalPages = Math.ceil(total/50)

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'flex',gap:10,alignItems:'center'}}>
        <input type="text" style={{...S.input,flex:1,maxWidth:280}} placeholder="🔍 Buscar empresa..." value={q}
          onChange={e=>{setQ(e.target.value);load(1,e.target.value)}}/>
        <span style={{color:'#64748b',fontSize:12}}>{total} carteiras</span>
      </div>

      <div style={S.card}>
        {loading ? (
          <div style={{color:'#64748b',padding:24,textAlign:'center'}}>Carregando...</div>
        ) : (
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead><tr style={{color:'#64748b'}}>
              <th style={{textAlign:'left',padding:'6px 8px'}}>Empresa</th>
              <th style={{textAlign:'right',padding:'6px 8px'}}>Saldo</th>
              <th style={{textAlign:'right',padding:'6px 8px'}}>Total Recebido</th>
              <th style={{textAlign:'right',padding:'6px 8px'}}>Total Sacado</th>
              <th style={{textAlign:'left',padding:'6px 8px'}}>Moeda</th>
            </tr></thead>
            <tbody>
              {wallets.map(w=>(
                <tr key={w.id} style={{borderTop:'1px solid rgba(15,23,42,0.8)'}}>
                  <td style={{padding:'10px 8px'}}>
                    <div style={{color:'#e2e8f0',fontWeight:600}}>{w.company_name}</div>
                    <div style={{color:'#475569',fontSize:10}}>ID #{w.company_id}</div>
                  </td>
                  <td style={{padding:'10px 8px',textAlign:'right',fontWeight:700,color:w.balance>0?'#10b981':'#64748b'}}>{fmtBRL(w.balance)}</td>
                  <td style={{padding:'10px 8px',textAlign:'right',color:'#6366f1'}}>{fmtBRL(w.total_received)}</td>
                  <td style={{padding:'10px 8px',textAlign:'right',color:'#ef4444'}}>{fmtBRL(w.total_withdrawn)}</td>
                  <td style={{padding:'10px 8px',color:'#64748b'}}>{w.currency}</td>
                </tr>
              ))}
              {wallets.length===0 && (
                <tr><td colSpan={5} style={{padding:'20px',textAlign:'center',color:'#64748b'}}>Nenhuma carteira encontrada</td></tr>
              )}
            </tbody>
          </table>
        )}

        {totalPages > 1 && (
          <div style={{display:'flex',gap:8,justifyContent:'center',marginTop:16}}>
            <button onClick={()=>{setPage(p=>p-1);load(page-1,q)}} disabled={page===1} style={S.btnSm('rgba(51,65,85,0.6)')}>‹ Anterior</button>
            <span style={{color:'#64748b',fontSize:12,alignSelf:'center'}}>{page}/{totalPages}</span>
            <button onClick={()=>{setPage(p=>p+1);load(page+1,q)}} disabled={page===totalPages} style={S.btnSm('rgba(51,65,85,0.6)')}>Próximo ›</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: CONFIGURAÇÕES (Credenciais + Gerenciar + Webhooks)
// ══════════════════════════════════════════════════════════════════════════════
function TabSettings() {
  const [section, setSection] = useState('credentials')
  const sections = [
    {id:'credentials', label:'Credenciais', icon: Icon.key},
    {id:'manage',      label:'Gerenciar',   icon: Icon.creditCard},
    {id:'webhooks',    label:'Webhooks',    icon: Icon.globe},
  ]

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      {/* Sub-nav */}
      <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
        {sections.map(s=>(
          <button key={s.id} onClick={()=>setSection(s.id)} style={{
            display:'flex',alignItems:'center',gap:6,
            padding:'8px 16px', borderRadius:10, border:'none',
            background: section===s.id ? 'rgba(99,102,241,0.15)' : 'rgba(51,65,85,0.3)',
            color: section===s.id ? '#a78bfa' : '#94a3b8',
            fontWeight: section===s.id ? 700 : 500,
            fontSize:12, cursor:'pointer', transition:'all 0.15s',
            border: section===s.id ? '1px solid rgba(99,102,241,0.2)' : '1px solid transparent',
          }}>
            {s.icon}{s.label}
          </button>
        ))}
      </div>

      {section==='credentials' && <SettingsCredentials/>}
      {section==='manage' && <SettingsManage/>}
      {section==='webhooks' && <SettingsWebhooks/>}
    </div>
  )
}

// ── Settings: Credentials ─────────────────────────────────────────────────────
function SettingsCredentials() {
  const [form,setForm] = useState({})
  const [loading,setLoading] = useState(true)
  const [saving,setSaving] = useState(false)
  const [testing,setTesting] = useState(false)
  const [toast,setToast] = useState(null)
  const [testResult,setTestResult] = useState(null)
  const showToast=(msg,type='success')=>{setToast({msg,type});setTimeout(()=>setToast(null),4000)}
  const f=(k)=>({value:form[k]||'',onChange:e=>setForm(p=>({...p,[k]:e.target.value}))})

  useEffect(()=>{
    fetchConfig().then(d=>{
      const mp=d?.mercadopago||{}
      setForm({active_provider:d?.active_provider||'mercadopago',access_token:mp.access_token||'',public_key:mp.public_key||'',webhook_secret:mp.webhook_secret||'',sandbox_mode:mp.sandbox_mode||false,platform_fee_percent:mp.platform_fee_percent||'0',auto_approve_pix:mp.auto_approve_pix!==false})
    }).catch(()=>showToast('Erro ao carregar','error')).finally(()=>setLoading(false))
  },[])

  const handleSave=async()=>{setSaving(true);try{await saveConfig({active_provider:form.active_provider,mercadopago:{access_token:form.access_token,public_key:form.public_key,webhook_secret:form.webhook_secret,sandbox_mode:form.sandbox_mode,platform_fee_percent:form.platform_fee_percent,auto_approve_pix:form.auto_approve_pix}});showToast('Configurações salvas!')}catch{showToast('Erro ao salvar','error')}finally{setSaving(false)}}
  const handleTest=async()=>{setTesting(true);setTestResult(null);try{setTestResult(await testGateway(form.active_provider||'mercadopago'))}catch{setTestResult({success:false,message:'Erro de rede'})}finally{setTesting(false)}}

  if (loading) return <div style={{color:'#64748b',padding:24}}>Carregando...</div>

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>
      <Toast toast={toast}/>
      <div style={{...S.card,background:'rgba(99,102,241,0.04)',border:'1px solid rgba(99,102,241,0.12)'}}>
        <div style={{fontSize:11,fontWeight:700,color:'#6366f1',marginBottom:6,textTransform:'uppercase',display:'flex',alignItems:'center',gap:6}}>{Icon.globe} URL do Webhook (Mercado Pago)</div>
        <code style={{color:'#a78bfa',fontSize:13}}>https://smartmoon.online/api/mercadopago</code>
      </div>
      {form.sandbox_mode && (
        <div style={{background:'rgba(245,158,11,0.08)',border:'1px solid rgba(245,158,11,0.2)',borderRadius:10,padding:'10px 16px',color:'#f59e0b',fontSize:12,fontWeight:600,display:'flex',alignItems:'center',gap:6}}>
          {Icon.shield} Modo Sandbox ativo — cobranças são simuladas
        </div>
      )}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
        {[{k:'access_token',label:'Access Token',type:'password'},{k:'public_key',label:'Public Key',type:'text'},{k:'webhook_secret',label:'Webhook Secret',type:'password'},{k:'platform_fee_percent',label:'Taxa da Plataforma (%)',type:'number'}].map(({k,label,type})=>(
          <div key={k}><label style={S.label}>{label}</label><input type={type} style={S.input} {...f(k)} placeholder="••••••••"/></div>
        ))}
      </div>
      <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
        <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',color:'#e2e8f0',fontSize:13}}>
          <input type="checkbox" checked={form.sandbox_mode||false} onChange={e=>setForm(p=>({...p,sandbox_mode:e.target.checked}))}/> Modo Sandbox
        </label>
        <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',color:'#e2e8f0',fontSize:13}}>
          <input type="checkbox" checked={form.auto_approve_pix!==false} onChange={e=>setForm(p=>({...p,auto_approve_pix:e.target.checked}))}/> Aprovar PIX automaticamente
        </label>
      </div>
      <div style={{display:'flex',gap:12}}>
        <button onClick={handleSave} disabled={saving} style={S.btn()}>{saving?'Salvando...':'Salvar Configurações'}</button>
        <button onClick={handleTest} disabled={testing} style={S.btn('#0ea5e9')}>{testing?'Testando...':'Testar Conexão'}</button>
      </div>
      {testResult && (
        <div style={{...S.card,background:testResult.success?'rgba(16,185,129,0.05)':'rgba(239,68,68,0.05)',border:`1px solid ${testResult.success?'rgba(16,185,129,0.2)':'rgba(239,68,68,0.2)'}`}}>
          <span style={{color:testResult.success?'#10b981':'#ef4444',fontWeight:600,fontSize:13}}>{testResult.success?'✓':'✗'} {testResult.message}</span>
        </div>
      )}
    </div>
  )
}

// ── Settings: Manage ──────────────────────────────────────────────────────────
function SettingsManage() {
  const [controls,setControls] = useState(null)
  const [loading,setLoading] = useState(true)
  const [saving,setSaving] = useState(false)
  const [toast,setToast] = useState(null)
  const [blockId,setBlockId] = useState('')
  const [companies,setCompanies] = useState([])
  const showToast=(msg,type='success')=>{setToast({msg,type});setTimeout(()=>setToast(null),4000)}

  const load=async()=>{setLoading(true);try{const[c,comp]=await Promise.all([fetchControls(),fetchCompanies()]);setControls(c);setCompanies(comp.companies||comp.items||comp)}catch{showToast('Erro','error')}finally{setLoading(false)}}
  useEffect(()=>{load()},[])

  const patchControl=async(key,value)=>{setSaving(true);try{await saveControls({[key]:value});setControls(p=>({...p,[key]:value}));showToast('Salvo!')}catch{showToast('Erro','error')}finally{setSaving(false)}}
  const handleBlock=async(cid,blocked)=>{try{await blockWd(Number(cid),blocked);showToast(blocked?'Saque bloqueado!':'Desbloqueado!');load()}catch{showToast('Erro','error')}}

  if (loading) return <div style={{color:'#64748b',padding:24}}>Carregando...</div>

  const PROVIDERS = controls?.available_providers || []

  return (
    <div style={{display:'flex',flexDirection:'column',gap:18}}>
      <Toast toast={toast}/>
      <div style={S.card}>
        <div style={S.sectionTitle}>{Icon.creditCard}<span>Controles Globais</span></div>
        <Toggle label="Saques Automáticos" sub="Saques são aprovados e processados automaticamente" value={controls?.auto_withdrawal_enabled!==false} disabled={saving} onChange={v=>patchControl('auto_withdrawal_enabled',v)}/>
        <Toggle label="Recebimento de Depósitos" sub="Permite que clientes recebam novos depósitos via PIX" value={controls?.deposits_enabled!==false} disabled={saving} onChange={v=>patchControl('deposits_enabled',v)}/>
      </div>

      <div style={S.card}>
        <div style={S.sectionTitle}>{Icon.creditCard}<span>Provedor de Pagamento</span></div>
        <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
          {PROVIDERS.map(p=>(
            <div key={p.id} onClick={()=>p.available&&patchControl('active_provider',p.id)} style={{
              padding:'16px 20px',borderRadius:12,
              border:`2px solid ${controls?.active_provider===p.id?'rgba(99,102,241,0.4)':p.available?'rgba(51,65,85,0.4)':'rgba(30,41,59,0.4)'}`,
              background:controls?.active_provider===p.id?'rgba(99,102,241,0.08)':'rgba(15,23,42,0.6)',
              cursor:p.available?'pointer':'not-allowed',opacity:p.available?1:0.5,minWidth:160,transition:'all 0.2s',
            }}>
              <div style={{fontSize:13,fontWeight:700,color:controls?.active_provider===p.id?'#a78bfa':'#e2e8f0'}}>
                {controls?.active_provider===p.id?'✓ ':''}{p.name}
              </div>
              <div style={{fontSize:11,marginTop:4,color:'#64748b'}}>{p.available?(controls?.active_provider===p.id?'Ativo':'Disponível'):'Em breve'}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={S.card}>
        <div style={S.sectionTitle}>{Icon.lock}<span>Controle de Saque por Cliente</span></div>
        {(controls?.blocked_companies||[]).length > 0 && (
          <div style={{marginBottom:16}}>
            <div style={{fontSize:11,color:'#64748b',marginBottom:8}}>Empresas bloqueadas:</div>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {(controls?.blocked_companies||[]).map(b=>(
                <div key={b.company_id} style={{display:'flex',alignItems:'center',gap:8,background:'rgba(239,68,68,0.08)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:8,padding:'6px 12px',fontSize:12}}>
                  <span style={{color:'#ef4444',fontWeight:600}}>{b.name}</span>
                  <button onClick={()=>handleBlock(b.company_id,false)} style={{background:'none',border:'none',color:'#ef4444',cursor:'pointer',fontSize:14,padding:0}}>×</button>
                </div>
              ))}
            </div>
          </div>
        )}
        <div style={{display:'flex',gap:10}}>
          <select style={{...S.input,flex:1}} value={blockId} onChange={e=>setBlockId(e.target.value)}>
            <option value="">Selecione uma empresa...</option>
            {companies.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={()=>blockId&&handleBlock(blockId,true)} disabled={!blockId} style={S.btn('#ef4444')}>Bloquear</button>
        </div>
      </div>
    </div>
  )
}

// ── Settings: Webhooks ────────────────────────────────────────────────────────
function SettingsWebhooks() {
  const [data,setData] = useState(null)
  const [loading,setLoading] = useState(true)
  const [filter,setFilter] = useState('')

  const load=async(s='')=>{setLoading(true);try{setData(await fetchWebhooks(s?`?status=${s}`:''))}catch{}finally{setLoading(false)}}
  useEffect(()=>{load()},[])

  const events = data?.events || []

  return (
    <div style={{display:'flex',flexDirection:'column',gap:14}}>
      <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
        {['','processed','pending','error'].map(s=>(
          <button key={s} onClick={()=>{setFilter(s);load(s)}} style={{...S.btnSm(filter===s?'#6366f1':'rgba(51,65,85,0.6)'),borderRadius:20}}>
            {s==='processed'?'Processados':s==='pending'?'Pendentes':s==='error'?'Erros':'Todos'}
          </button>
        ))}
        <button onClick={()=>load(filter)} style={{...S.btnSm('rgba(51,65,85,0.6)'),marginLeft:'auto',display:'flex',alignItems:'center',gap:4}}>{Icon.refresh}</button>
      </div>

      <div style={S.card}>
        {loading ? <div style={{color:'#64748b',padding:24,textAlign:'center'}}>Carregando...</div> : (
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead><tr style={{color:'#64748b'}}>
              <th style={{textAlign:'left',padding:'6px 8px'}}>ID</th>
              <th style={{textAlign:'left',padding:'6px 8px'}}>Tipo</th>
              <th style={{textAlign:'left',padding:'6px 8px'}}>Event ID</th>
              <th style={{textAlign:'left',padding:'6px 8px'}}>Charge</th>
              <th style={{textAlign:'left',padding:'6px 8px'}}>Status</th>
              <th style={{textAlign:'left',padding:'6px 8px'}}>Recebido</th>
              <th style={{textAlign:'left',padding:'6px 8px'}}>Erro</th>
            </tr></thead>
            <tbody>
              {events.map(e=>(
                <tr key={e.id} style={{borderTop:'1px solid rgba(15,23,42,0.8)'}}>
                  <td style={{padding:'8px',color:'#64748b'}}>#{e.id}</td>
                  <td style={{padding:'8px',color:'#a78bfa'}}>{e.event_type||'—'}</td>
                  <td style={{padding:'8px',color:'#64748b',maxWidth:120,overflow:'hidden',textOverflow:'ellipsis'}}>{e.provider_event_id||'—'}</td>
                  <td style={{padding:'8px',color:'#94a3b8'}}>{e.charge_id?`#${e.charge_id}`:'—'}</td>
                  <td style={{padding:'8px'}}><span style={S.tag(e.processed?'#10b981':'#f59e0b')}>{e.processed?'OK':'Pendente'}</span></td>
                  <td style={{padding:'8px',color:'#64748b',whiteSpace:'nowrap'}}>{fmtDate(e.received_at)}</td>
                  <td style={{padding:'8px',color:'#ef4444',fontSize:11,maxWidth:160,overflow:'hidden',textOverflow:'ellipsis'}}>{e.processing_error||''}</td>
                </tr>
              ))}
              {events.length===0 && <tr><td colSpan={7} style={{padding:'20px',textAlign:'center',color:'#64748b'}}>Nenhum webhook registrado</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// TAB: API KEYS (Open Gateway)
// ══════════════════════════════════════════════════════════════════════════════
const PERM_OPTIONS = [
  {id:'charges.create', label:'Criar Cobranças', color:'#10b981'},
  {id:'charges.read',   label:'Consultar Cobranças', color:'#6366f1'},
  {id:'balance.read',   label:'Consultar Saldo', color:'#0ea5e9'},
  {id:'payouts.create', label:'Criar Saques', color:'#f59e0b'},
]

function TabApiKeys() {
  const [keys, setKeys] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [newKey, setNewKey] = useState(null)
  const [toast, setToast] = useState(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({
    label: '',
    environment: 'live',
    permissions: ['charges.create','charges.read','balance.read'],
    rate_limit_rpm: 60,
    ip_whitelist: '',
  })
  const showToast = (msg,type='success')=>{setToast({msg,type});setTimeout(()=>setToast(null),4000)}

  const load = async()=>{
    setLoading(true)
    try {
      const data = await api.get('/api/payments/gateway/keys')
      setKeys(Array.isArray(data)?data:[])
    } catch(e) {
      showToast('Erro ao carregar API Keys','error')
    } finally { setLoading(false) }
  }
  useEffect(()=>{load()},[])

  const handleCreate = async()=>{
    if (!form.label.trim()) {showToast('Informe um label','warn');return}
    setCreating(true)
    try {
      const ips = form.ip_whitelist.split(',').map(s=>s.trim()).filter(Boolean)
      const data = await api.post('/api/payments/gateway/keys',{
        label: form.label,
        environment: form.environment,
        permissions: form.permissions,
        rate_limit_rpm: form.rate_limit_rpm,
        ip_whitelist: ips,
      })
      setNewKey(data.raw_key)
      showToast('API Key criada com sucesso!')
      load()
    } catch(e) {
      showToast(e.message||'Erro ao criar','error')
    } finally { setCreating(false) }
  }

  const handleToggle = async(id,active)=>{
    try {
      await api.patch(`/api/payments/gateway/keys/${id}`,{is_active:!active})
      showToast(!active?'Key ativada':'Key desativada')
      load()
    } catch { showToast('Erro','error') }
  }

  const handleDelete = async(id,prefix)=>{
    if (!window.confirm(`Revogar permanentemente a key ${prefix}***? Esta ação é irreversível.`)) return
    try {
      await api.delete(`/api/payments/gateway/keys/${id}`)
      showToast('Key revogada permanentemente')
      load()
    } catch { showToast('Erro','error') }
  }

  const togglePerm = (perm)=>{
    setForm(p=>({
      ...p,
      permissions: p.permissions.includes(perm)
        ? p.permissions.filter(x=>x!==perm)
        : [...p.permissions, perm]
    }))
  }

  return (
    <div style={{display:'flex',flexDirection:'column',gap:18}}>
      <Toast toast={toast}/>

      {/* New key reveal */}
      {newKey && (
        <div style={{
          ...S.card,
          background:'linear-gradient(135deg,rgba(16,185,129,0.06),rgba(16,185,129,0.02))',
          border:'1px solid rgba(16,185,129,0.25)',
        }}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12}}>
            {Icon.shield}
            <span style={{fontSize:13,fontWeight:700,color:'#10b981'}}>🔑 Nova API Key Criada</span>
          </div>
          <div style={{
            background:'rgba(15,23,42,0.8)',borderRadius:10,padding:'14px 18px',
            fontFamily:'monospace',fontSize:13,color:'#fbbf24',wordBreak:'break-all',
            border:'1px solid rgba(251,191,36,0.15)',marginBottom:12,
          }}>
            {newKey}
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <button onClick={()=>{navigator.clipboard.writeText(newKey);showToast('Copiado!')}}
              style={S.btnSm('#10b981')}>📋 Copiar</button>
            <span style={{fontSize:11,color:'#ef4444',fontWeight:600}}>
              ⚠️ Salve esta chave agora! Ela NÃO será exibida novamente.
            </span>
          </div>
          <button onClick={()=>setNewKey(null)} style={{
            marginTop:12,background:'none',border:'none',color:'#64748b',cursor:'pointer',fontSize:11,
          }}>Entendi, fechar</button>
        </div>
      )}

      {/* Header + Create */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12}}>
        <div>
          <div style={{fontSize:14,fontWeight:700,color:'#e2e8f0'}}>API Keys — Open Gateway</div>
          <div style={{fontSize:11,color:'#64748b',marginTop:2}}>
            Chaves para integrações externas via API pública
          </div>
        </div>
        <button onClick={()=>{setShowCreate(!showCreate);setNewKey(null)}}
          style={{...S.btn('#6366f1'),display:'flex',alignItems:'center',gap:6}}>
          {Icon.key} {showCreate?'Cancelar':'+ Nova API Key'}
        </button>
      </div>

      {/* Create form */}
      {showCreate && !newKey && (
        <div style={{...S.card,background:'rgba(99,102,241,0.04)',border:'1px solid rgba(99,102,241,0.12)'}}>
          <div style={S.sectionTitle}>{Icon.key}<span>Nova API Key</span></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:16}}>
            <div>
              <label style={S.label}>Label</label>
              <input style={S.input} placeholder="Ex: Integração ERP" value={form.label}
                onChange={e=>setForm(p=>({...p,label:e.target.value}))}/>
            </div>
            <div>
              <label style={S.label}>Ambiente</label>
              <select style={S.input} value={form.environment}
                onChange={e=>setForm(p=>({...p,environment:e.target.value}))}>
                <option value="live">🟢 Produção (live)</option>
                <option value="test">🟡 Teste (sandbox)</option>
              </select>
            </div>
            <div>
              <label style={S.label}>Rate Limit (req/min)</label>
              <input style={S.input} type="number" min="1" max="1000" value={form.rate_limit_rpm}
                onChange={e=>setForm(p=>({...p,rate_limit_rpm:parseInt(e.target.value)||60}))}/>
            </div>
            <div>
              <label style={S.label}>IP Whitelist (opcional, separar por vírgula)</label>
              <input style={S.input} placeholder="Ex: 177.10.0.1, 200.0.0.5" value={form.ip_whitelist}
                onChange={e=>setForm(p=>({...p,ip_whitelist:e.target.value}))}/>
            </div>
          </div>

          <div style={{marginBottom:16}}>
            <label style={S.label}>Permissões</label>
            <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
              {PERM_OPTIONS.map(p=>(
                <button key={p.id} onClick={()=>togglePerm(p.id)} style={{
                  ...S.tag(form.permissions.includes(p.id)?p.color:'#475569'),
                  cursor:'pointer',padding:'6px 14px',fontSize:12,
                  opacity:form.permissions.includes(p.id)?1:0.5,
                  transition:'all 0.15s',
                }}>
                  {form.permissions.includes(p.id)?'✓ ':''}{p.label}
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleCreate} disabled={creating} style={S.btn('#10b981')}>
            {creating?'Criando...':'Criar API Key'}
          </button>
        </div>
      )}

      {/* Keys list */}
      <div style={S.card}>
        <div style={{...S.sectionTitle,marginBottom:12}}>{Icon.key}<span>Chaves Ativas</span>
          <span style={{marginLeft:'auto',fontSize:11,color:'#64748b',fontWeight:400}}>{keys.length} chave(s)</span>
        </div>

        {loading ? (
          <div style={{color:'#64748b',padding:24,textAlign:'center'}}>Carregando...</div>
        ) : keys.length===0 ? (
          <div style={{textAlign:'center',padding:32}}>
            <div style={{width:48,height:48,borderRadius:14,background:'rgba(99,102,241,0.1)',display:'inline-flex',alignItems:'center',justifyContent:'center',marginBottom:12,color:'#6366f1'}}>{Icon.key}</div>
            <div style={{color:'#64748b'}}>Nenhuma API Key criada</div>
            <div style={{fontSize:11,color:'#475569',marginTop:4}}>Crie uma chave para começar a usar o Open Gateway</div>
          </div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {keys.map(k=>(
              <div key={k.id} style={{
                background:'rgba(15,23,42,0.5)',borderRadius:12,padding:'16px 20px',
                border:`1px solid ${k.is_active?'rgba(99,102,241,0.1)':'rgba(239,68,68,0.15)'}`,
                transition:'border-color 0.2s',
              }}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:12,flexWrap:'wrap'}}>
                  <div>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                      <span style={{fontFamily:'monospace',fontSize:13,color:'#a78bfa',fontWeight:700}}>{k.key_prefix}***</span>
                      <span style={{
                        ...S.tag(k.is_active?'#10b981':'#ef4444'),
                        fontSize:10,
                      }}>
                        {k.is_active?'Ativa':'Inativa'}
                      </span>
                      <span style={{
                        ...S.tag(k.environment==='live'?'#10b981':'#f59e0b'),
                        fontSize:10,
                      }}>
                        {k.environment==='live'?'Produção':'Teste'}
                      </span>
                    </div>
                    <div style={{fontSize:13,color:'#e2e8f0',fontWeight:600,marginBottom:4}}>{k.label}</div>
                    <div style={{display:'flex',gap:12,fontSize:11,color:'#64748b',flexWrap:'wrap'}}>
                      <span>⏱ {k.rate_limit_rpm} req/min</span>
                      <span>📅 Criada: {fmtDate(k.created_at)}</span>
                      {k.last_used_at && <span>🕐 Último uso: {fmtDate(k.last_used_at)}</span>}
                      {k.expires_at && <span style={{color:'#f59e0b'}}>⏳ Expira: {fmtDate(k.expires_at)}</span>}
                    </div>
                    <div style={{display:'flex',gap:4,marginTop:6,flexWrap:'wrap'}}>
                      {(k.permissions||[]).map(p=>{
                        const opt = PERM_OPTIONS.find(o=>o.id===p)
                        return <span key={p} style={{...S.tag(opt?.color||'#6366f1'),fontSize:10}}>{opt?.label||p}</span>
                      })}
                    </div>
                    {(k.ip_whitelist||[]).length>0 && (
                      <div style={{fontSize:10,color:'#475569',marginTop:4}}>
                        🔒 IPs: {k.ip_whitelist.join(', ')}
                      </div>
                    )}
                  </div>
                  <div style={{display:'flex',gap:6,flexShrink:0}}>
                    <button onClick={()=>handleToggle(k.id,k.is_active)}
                      style={S.btnSm(k.is_active?'#f59e0b':'#10b981')}>
                      {k.is_active?'Desativar':'Ativar'}
                    </button>
                    <button onClick={()=>handleDelete(k.id,k.key_prefix)}
                      style={S.btnSm('#ef4444')}>Revogar</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Docs preview */}
      <div style={{...S.card,background:'rgba(99,102,241,0.04)',border:'1px solid rgba(99,102,241,0.1)'}}>
        <div style={S.sectionTitle}>{Icon.globe}<span>Referência Rápida — API</span></div>
        <div style={{fontFamily:'monospace',fontSize:12,lineHeight:1.8,color:'#94a3b8'}}>
          <div><span style={{color:'#10b981'}}>POST</span> <span style={{color:'#e2e8f0'}}>/api/v1/gateway/charges</span> <span style={{color:'#475569'}}>— Criar cobrança PIX</span></div>
          <div><span style={{color:'#6366f1'}}>GET</span>  <span style={{color:'#e2e8f0'}}>/api/v1/gateway/charges/:id</span> <span style={{color:'#475569'}}>— Consultar status</span></div>
          <div><span style={{color:'#ef4444'}}>DEL</span>  <span style={{color:'#e2e8f0'}}>/api/v1/gateway/charges/:id</span> <span style={{color:'#475569'}}>— Cancelar cobrança</span></div>
          <div><span style={{color:'#6366f1'}}>GET</span>  <span style={{color:'#e2e8f0'}}>/api/v1/gateway/balance</span> <span style={{color:'#475569'}}>— Consultar saldo</span></div>
          <div><span style={{color:'#6366f1'}}>GET</span>  <span style={{color:'#e2e8f0'}}>/api/v1/gateway/health</span> <span style={{color:'#475569'}}>— Health check</span></div>
        </div>
        <div style={{marginTop:12,padding:'12px 16px',background:'rgba(15,23,42,0.7)',borderRadius:8}}>
          <div style={{fontSize:11,color:'#64748b',marginBottom:6}}>Exemplo de requisição:</div>
          <code style={{fontSize:11,color:'#a78bfa',lineHeight:1.6,display:'block',whiteSpace:'pre'}}>
{`curl -X POST https://api.nexus.ia/api/v1/gateway/charges \\
  -H "X-API-Key: nxs_live_xxxx..." \\
  -H "Content-Type: application/json" \\
  -d '{"amount": 99.90, "description": "Plano Pro"}'`}
          </code>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════════════════════
const TABS = [
  {id:'dashboard',  label:'Dashboard',     icon: Icon.dashboard},
  {id:'kyc',        label:'KYC',           icon: Icon.kyc},
  {id:'wallets',    label:'Carteiras',     icon: Icon.wallet},
  {id:'apikeys',    label:'API Keys',      icon: Icon.key},
  {id:'settings',   label:'Configurações', icon: Icon.settings},
]

export default function AdminGatewayPage() {
  const [tab, setTab] = useState('dashboard')

  return (
    <div style={{padding:'24px',fontFamily:'Inter,sans-serif',minHeight:'100vh',color:'#e2e8f0'}}>
      <style>{`
        @keyframes pulse {
          0%,100%{box-shadow:0 0 0 3px #10b98133}
          50%{box-shadow:0 0 0 6px #10b98111}
        }
        select option{background:#0f172a}
        ::-webkit-scrollbar{width:6px;height:6px}
        ::-webkit-scrollbar-track{background:#0f172a}
        ::-webkit-scrollbar-thumb{background:#334155;border-radius:4px}
        input:focus,select:focus{border-color:rgba(99,102,241,0.5)!important}
      `}</style>

      {/* Header */}
      <div style={{marginBottom:28}}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:4}}>
          <div style={{width:40,height:40,borderRadius:12,background:'linear-gradient(135deg,#6366f1,#8b5cf6)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',boxShadow:'0 4px 12px rgba(99,102,241,0.3)'}}>
            {Icon.creditCard}
          </div>
          <div>
            <h1 style={{margin:0,fontSize:22,fontWeight:800,background:'linear-gradient(135deg,#e2e8f0,#a78bfa)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>
              Gateway de Pagamento
            </h1>
            <p style={{margin:0,color:'#64748b',fontSize:12}}>Gerenciamento financeiro centralizado — Smart Moon / Mercado Pago</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:4,marginBottom:24,flexWrap:'wrap',
        background:'rgba(15,23,42,0.6)',padding:6,borderRadius:14,border:'1px solid rgba(30,41,59,0.8)',
        backdropFilter:'blur(8px)'}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            display:'flex',alignItems:'center',gap:7,
            padding:'9px 18px', borderRadius:10, border:'none',
            background: tab===t.id ? 'rgba(30,41,59,0.8)' : 'transparent',
            color: tab===t.id ? '#a78bfa' : '#64748b',
            fontWeight: tab===t.id ? 700 : 500,
            fontSize:12, cursor:'pointer', transition:'all 0.2s',
            boxShadow: tab===t.id ? '0 2px 8px rgba(0,0,0,0.25)' : 'none',
          }}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab==='dashboard' && <TabDashboard/>}
      {tab==='kyc'       && <TabKYC/>}
      {tab==='wallets'   && <TabWallets/>}
      {tab==='apikeys'   && <TabApiKeys/>}
      {tab==='settings'  && <TabSettings/>}
    </div>
  )
}
