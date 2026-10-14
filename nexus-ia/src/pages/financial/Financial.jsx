/**
 * Financial Agent — Workflow + Dashboard Completo
 * Visualização do fluxo de trabalho do agente financeiro,
 * registros, configuração e exportação.
 */
import { useState, useEffect, useCallback } from 'react'
import { api } from '../../api'
import { useToast } from '../../components/ui/Toast'
import {
  DollarSign, FileText, Download, Plus, Trash2, Filter,
  TrendingUp, TrendingDown, Receipt, AlertTriangle, Check,
  Calendar, Search, X, ChevronDown, RefreshCw, MessageSquare,
  Mic, Camera, ArrowRight, ArrowDown, CheckCircle, Clock,
  Settings, Zap, Bot, Smartphone, Volume2, FileSpreadsheet,
  Send, Brain, Eye, ChevronRight, Activity, BarChart3, Wallet
} from 'lucide-react'

// ── Category config ─────────────────────────────────────
const CATEGORIES = {
  // Saídas (despesas)
  compra:       { label: 'Compra',               icon: '🛒', color: '#6366f1' },
  fornecedor:   { label: 'Pagto Fornecedor',     icon: '🏭', color: '#f59e0b' },
  colaborador:  { label: 'Pagto Colaborador',    icon: '👥', color: '#10b981' },
  operacional:  { label: 'Desp. Operacional',    icon: '⚙️', color: '#ef4444' },
  outro:        { label: 'Outro',                icon: '📌', color: '#8b5cf6' },
  // Entradas (receitas)
  venda:        { label: 'Venda',                icon: '💰', color: '#10b981' },
  servico:      { label: 'Serviço',              icon: '🛠️', color: '#06b6d4' },
  recebimento:  { label: 'Recebimento',          icon: '📥', color: '#22c55e' },
  aporte:       { label: 'Aporte',               icon: '🏦', color: '#14b8a6' },
}

const PAYMENT_METHODS = {
  pix: 'PIX', dinheiro: 'Dinheiro', cartao: 'Cartão',
  boleto: 'Boleto', transferencia: 'Transferência',
}

// ── Formatters ──────────────────────────────────────────
const fmt = (v) => v != null ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'
const fmtDate = (d) => d ? new Date(d + 'T12:00:00').toLocaleDateString('pt-BR') : '—'

// ── Tabs ────────────────────────────────────────────────
const TABS = [
  { id: 'workflow', label: 'Dashboard', icon: <Zap size={14} /> },
  { id: 'records',  label: 'Registros', icon: <FileText size={14} /> },
  { id: 'config',   label: 'Configuração', icon: <Settings size={14} /> },
]

// ═══════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════
export default function Financial() {
  const toast = useToast()
  const [tab, setTab] = useState('workflow')
  const [records, setRecords] = useState([])
  const [summary, setSummary] = useState(null)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [filters, setFilters] = useState({ category: '', dateFrom: '', dateTo: '', recordType: '' })

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters.category) params.append('category', filters.category)
      if (filters.recordType) params.append('record_type', filters.recordType)
      if (filters.dateFrom) params.append('date_from', filters.dateFrom)
      if (filters.dateTo) params.append('date_to', filters.dateTo)
      params.append('limit', '100')
      const res = await api.get(`/financial/records?${params}`)
      setRecords(res.records || [])
      setTotal(res.total || 0)
    } catch (e) {
      console.error('[Financial] Erro ao carregar registros:', e)
      toast?.error?.(`Erro ao carregar registros: ${e.message}`)
    }
    setLoading(false)
  }, [filters])

  const fetchSummary = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (filters.dateFrom) params.append('date_from', filters.dateFrom)
      if (filters.dateTo) params.append('date_to', filters.dateTo)
      const res = await api.get(`/financial/summary?${params}`)
      setSummary(res)
    } catch (e) {
      console.error('[Financial] Erro ao carregar resumo:', e)
    }
  }, [filters])

  useEffect(() => { fetchRecords(); fetchSummary() }, [fetchRecords, fetchSummary])

  const handleDelete = async (id) => {
    if (!confirm('Cancelar este registro?')) return
    try {
      await api.delete(`/financial/records/${id}`)
      toast?.success?.('Registro cancelado')
      fetchRecords(); fetchSummary()
    } catch { toast?.error?.('Erro ao cancelar') }
  }

  const handleExport = async () => {
    try {
      const params = new URLSearchParams()
      if (filters.dateFrom) params.append('date_from', filters.dateFrom)
      if (filters.dateTo) params.append('date_to', filters.dateTo)
      const blob = await api.getBlob(`/financial/export/csv?${params}`)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `financeiro_${new Date().toISOString().slice(0, 10)}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
      toast?.success?.('CSV exportado!')
    } catch (e) {
      console.error('[Financial] Erro na exportação:', e)
      toast?.error?.(`Erro na exportação: ${e.message}`)
    }
  }

  const handleCreate = async (data) => {
    try {
      await api.post('/financial/records', data)
      toast?.success?.('Registro criado!')
      setShowModal(false)
      fetchRecords(); fetchSummary()
    } catch { toast?.error?.('Erro ao criar registro') }
  }

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1300 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            💰 Agente Financeiro
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Workflow de protocolo de compras, pagamentos e notas fiscais via WhatsApp
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => { fetchRecords(); fetchSummary() }} style={btnSecondary}>
            <RefreshCw size={14} /> Atualizar
          </button>
          <button onClick={handleExport} style={btnSecondary}>
            <Download size={14} /> Exportar CSV
          </button>
          <button onClick={() => setShowModal(true)} style={btnPrimary}>
            <Plus size={14} /> Novo Registro
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 24, padding: 4, borderRadius: 12,
        background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
        width: 'fit-content',
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700,
            background: tab === t.id ? 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))' : 'transparent',
            border: tab === t.id ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
            color: tab === t.id ? '#6366f1' : 'var(--text-muted)',
            cursor: 'pointer', transition: 'all 0.2s',
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === 'workflow' && <WorkflowTab summary={summary} records={records} />}
      {tab === 'records' && (
        <RecordsTab
          records={records} total={total} loading={loading}
          filters={filters} setFilters={setFilters}
          onDelete={handleDelete}
        />
      )}
      {tab === 'config' && <ConfigTab />}

      {showModal && <CreateRecordModal onClose={() => setShowModal(false)} onCreate={handleCreate} />}
    </div>
  )
}


// ═══════════════════════════════════════════════════════
// WORKFLOW TAB — Visualização do fluxo do agente
// ═══════════════════════════════════════════════════════
function WorkflowTab({ summary, records }) {
  const income = summary?.total_income || 0
  const expense = summary?.total_expense ?? summary?.grand_total ?? 0
  const balance = summary?.balance ?? (income - expense)
  const withInvoice = summary?.invoices?.with_invoice || 0
  const withoutInvoice = summary?.invoices?.without_invoice || 0
  const totalRecords = summary?.grand_count || 0
  const balColor = balance >= 0 ? '#10b981' : '#ef4444'

  const expCats = Object.entries(summary?.by_category || {}).sort((a, b) => b[1].total - a[1].total)
  const incCats = Object.entries(summary?.income_by_category || {}).sort((a, b) => b[1].total - a[1].total)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* KPIs: Entradas / Saídas / Saldo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16 }}>
        <BigStat icon={<TrendingUp size={18} />} label="Entradas" value={fmt(income)} color="#10b981" />
        <BigStat icon={<TrendingDown size={18} />} label="Saídas" value={fmt(expense)} color="#ef4444" />
        <BigStat icon={<Wallet size={18} />} label="Saldo" value={fmt(balance)} color={balColor}
          sub={balance >= 0 ? 'positivo' : 'negativo'} highlight />
        <BigStat icon={<Receipt size={18} />} label="Notas fiscais"
          value={`${withInvoice}/${totalRecords}`} color="#f59e0b"
          sub={`${withoutInvoice} sem nota`} />
      </div>

      {/* Barra Entradas × Saídas */}
      {(income > 0 || expense > 0) && (
        <div style={cardBox}>
          <h3 style={cardTitle}><BarChart3 size={16} style={{ color: '#6366f1' }} /> Entradas × Saídas no período</h3>
          <FlowBar income={income} expense={expense} />
        </div>
      )}

      {/* Quebra por categoria */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
        <CategoryBreakdown title="Saídas por categoria" total={expense} items={expCats} tone="#ef4444" empty="Nenhuma saída no período" />
        <CategoryBreakdown title="Entradas por categoria" total={income} items={incCats} tone="#10b981" empty="Nenhuma entrada no período" />
      </div>

      {/* Workflow Pipeline */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
        borderRadius: 16, padding: '28px 32px',
      }}>
        <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Zap size={18} style={{ color: '#6366f1' }} /> Pipeline do Agente Financeiro
        </h3>

        {/* Pipeline Visual */}
        <div style={{ display: 'flex', gap: 0, alignItems: 'stretch', flexWrap: 'wrap' }}>
          <PipelineStep
            icon="📱" title="Entrada"
            description="Mensagem via WhatsApp"
            details={['Texto: "Comprei 30 de açúcar"', 'Áudio: transcrição via Whisper', 'Imagem: foto da nota fiscal']}
            color="#3b82f6" status="active"
          />
          <PipelineArrow />
          <PipelineStep
            icon="🧠" title="IA Processa"
            description="Gemini extrai dados"
            details={['Identifica: item, valor, categoria', 'Detecta fornecedor', 'Classifica automaticamente']}
            color="#8b5cf6" status="active"
          />
          <PipelineArrow />
          <PipelineStep
            icon="📋" title="Protocola"
            description="Registra no banco"
            details={['Data + Hora automáticos', 'Gera ID do registro', 'Salva no PostgreSQL']}
            color="#6366f1" status="active"
          />
          <PipelineArrow />
          <PipelineStep
            icon="🧾" title="Nota Fiscal"
            description="Verifica comprovante"
            details={['Pergunta se tem nota', 'Registra status: Sim/Não/Pendente', 'Armazena imagem da NF']}
            color="#f59e0b" status="active"
          />
          <PipelineArrow />
          <PipelineStep
            icon="✅" title="Confirma"
            description="Responde ao usuário"
            details={['✅ Item — R$Valor [Cat]', 'Nota: Sim/Não', 'Pronto para consulta']}
            color="#10b981" status="active"
          />
        </div>
      </div>

      {/* Tools do Agente */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
        borderRadius: 16, padding: '28px 32px',
      }}>
        <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Brain size={18} style={{ color: '#8b5cf6' }} /> Function Calling Tools
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          <ToolCard name="fin_registrar_despesa" desc="Registra compra/pagamento" icon="📝" color="#6366f1" />
          <ToolCard name="fin_consultar_registros" desc="Lista registros com filtros" icon="🔍" color="#3b82f6" />
          <ToolCard name="fin_resumo_periodo" desc="Resumo por período" icon="📊" color="#8b5cf6" />
          <ToolCard name="fin_exportar_csv" desc="Gera planilha CSV" icon="📋" color="#10b981" />
          <ToolCard name="fin_cancelar_registro" desc="Cancela/estorna registro" icon="❌" color="#ef4444" />
          <ToolCard name="fin_atualizar_nota" desc="Atualiza status da NF" icon="🧾" color="#f59e0b" />
        </div>
      </div>

      {/* Conversation Examples */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
        borderRadius: 16, padding: '28px 32px',
      }}>
        <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
          <MessageSquare size={18} style={{ color: '#10b981' }} /> Exemplos de Conversa
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <ConversationExample
            user="Comprei 30 reais de açúcar hoje no mercado"
            agent="✅ Registrado! R$30,00 — Açúcar [Compra] — Fornecedor: Mercado. Tem nota fiscal? 🧾"
          />
          <ConversationExample
            user="Não tenho nota"
            agent="Ok, registrado sem nota fiscal ⚠️. Se conseguir a nota depois, me avise que eu atualizo!"
          />
          <ConversationExample
            user="Quanto gastei essa semana?"
            agent="📊 Resumo da semana (17/07 – 23/07):\n🛒 Compras: R$350,00 (5 itens)\n🏭 Fornecedores: R$1.200,00 (2 pagtos)\n⚙️ Operacional: R$89,90 (1 item)\n💰 Total: R$1.639,90"
          />
          <ConversationExample
            user="🎤 [áudio] Paguei mil e duzentos pro fornecedor da tinta hoje"
            agent="✅ Registrado! R$1.200,00 — Pagamento fornecedor tinta [Fornecedor]. Tem nota fiscal? 🧾"
          />
          <ConversationExample
            user="Exporta a planilha do mês"
            agent="📊 Planilha gerada! 23 registros de 01/07 a 23/07. 📎 [financeiro_20260701_20260723.csv]"
          />
        </div>
      </div>

      {/* Canais de Entrada */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
        borderRadius: 16, padding: '28px 32px',
      }}>
        <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Smartphone size={18} style={{ color: '#25D366' }} /> Canais de Entrada
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
          <ChannelCard icon="💬" name="Texto" desc="Mensagens de texto via WhatsApp" status="active" color="#25D366" />
          <ChannelCard icon="🎤" name="Áudio" desc="Mensagens de voz → Whisper STT" status="active" color="#8b5cf6" />
          <ChannelCard icon="📷" name="Imagem" desc="Foto de nota fiscal (futuro: OCR)" status="coming" color="#3b82f6" />
          <ChannelCard icon="🔊" name="Voz IA" desc="Respostas por áudio (ElevenLabs)" status="coming" color="#f59e0b" />
        </div>
      </div>

      {/* Últimos Registros (preview) */}
      {records.length > 0 && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          borderRadius: 16, padding: '28px 32px',
        }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={18} style={{ color: '#6366f1' }} /> Últimos Registros
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {records.slice(0, 5).map(r => (
              <div key={r.id} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px',
                borderRadius: 10, background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
              }}>
                <span style={{ fontSize: 20 }}>{CATEGORIES[r.category]?.icon || '📌'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{r.description}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {fmtDate(r.record_date)} · {r.record_time || ''} · via {r.input_type}
                  </div>
                </div>
                <div style={{ fontWeight: 700, color: '#ef4444', fontFamily: 'JetBrains Mono, monospace', fontSize: 14 }}>
                  {fmt(r.amount)}
                </div>
                <span style={{
                  padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                  background: r.has_invoice ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
                  color: r.has_invoice ? '#10b981' : '#f59e0b',
                  border: `1px solid ${r.has_invoice ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`,
                }}>
                  {r.has_invoice ? '✅ Nota' : '⚠️ S/Nota'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}


// ═══════════════════════════════════════════════════════
// RECORDS TAB — Tabela de registros com filtros
// ═══════════════════════════════════════════════════════
function RecordsTab({ records, total, loading, filters, setFilters, onDelete }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Filters */}
      <div style={{
        display: 'flex', gap: 12, alignItems: 'center',
        padding: '14px 18px', borderRadius: 12,
        background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
      }}>
        <Filter size={14} style={{ color: 'var(--text-muted)' }} />
        <select value={filters.recordType || ''}
          onChange={e => setFilters(f => ({ ...f, recordType: e.target.value }))}
          style={inputStyle}>
          <option value="">Entradas e saídas</option>
          <option value="income">🟢 Só entradas</option>
          <option value="expense">🔴 Só saídas</option>
        </select>
        <input type="date" value={filters.dateFrom}
          onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
          style={inputStyle} />
        <input type="date" value={filters.dateTo}
          onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))}
          style={inputStyle} />
        <select value={filters.category}
          onChange={e => setFilters(f => ({ ...f, category: e.target.value }))}
          style={inputStyle}>
          <option value="">Todas categorias</option>
          {Object.entries(CATEGORIES).map(([k, v]) => (
            <option key={k} value={k}>{v.icon} {v.label}</option>
          ))}
        </select>
        {(filters.category || filters.dateFrom || filters.dateTo || filters.recordType) && (
          <button onClick={() => setFilters({ category: '', dateFrom: '', dateTo: '', recordType: '' })}
            style={{ ...btnSecondary, padding: '8px 12px' }}>
            <X size={13} /> Limpar
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
        borderRadius: 14, overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)' }}>
              {['Data', 'Descrição', 'Valor', 'Categoria', 'Fornecedor', 'Nota', 'Tipo', ''].map(h => (
                <th key={h} style={{
                  padding: '12px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700,
                  color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={emptyCell}>Carregando...</td></tr>
            ) : records.length === 0 ? (
              <tr><td colSpan={8} style={emptyCell}>
                Nenhum registro encontrado. Use o agente financeiro no WhatsApp ou clique em "Novo Registro".
              </td></tr>
            ) : records.map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-elevated)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={cellStyle}>
                  <div style={{ fontWeight: 600 }}>{fmtDate(r.record_date)}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{r.record_time || ''}</div>
                </td>
                <td style={{ ...cellStyle, maxWidth: 250 }}>
                  <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.description}</div>
                  {r.notes && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{r.notes}</div>}
                </td>
                <td style={{ ...cellStyle, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace',
                  color: r.record_type === 'income' ? '#10b981' : '#ef4444' }}>
                  {r.record_type === 'income' ? '+' : '−'} {fmt(r.amount)}
                </td>
                <td style={cellStyle}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                    background: `${CATEGORIES[r.category]?.color || '#666'}18`,
                    color: CATEGORIES[r.category]?.color || '#666',
                    border: `1px solid ${CATEGORIES[r.category]?.color || '#666'}30`,
                  }}>
                    {CATEGORIES[r.category]?.icon} {CATEGORIES[r.category]?.label || r.category}
                  </span>
                </td>
                <td style={cellStyle}>{r.supplier_name || '—'}</td>
                <td style={cellStyle}>
                  {r.has_invoice ? (
                    <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600 }}>
                      <Check size={13} /> Sim
                    </span>
                  ) : r.invoice_pending ? (
                    <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600 }}>
                      <AlertTriangle size={13} /> Pendente
                    </span>
                  ) : (
                    <span style={{ color: '#ef4444', fontSize: 11, fontWeight: 600 }}>Não</span>
                  )}
                </td>
                <td style={cellStyle}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                    background: r.input_type === 'audio' ? 'rgba(139,92,246,0.12)' :
                                r.input_type === 'image' ? 'rgba(16,185,129,0.12)' : 'rgba(99,102,241,0.12)',
                    color: r.input_type === 'audio' ? '#8b5cf6' :
                           r.input_type === 'image' ? '#10b981' : '#6366f1',
                  }}>
                    {r.input_type === 'audio' ? '🎤' : r.input_type === 'image' ? '📷' : '💬'} {r.input_type}
                  </span>
                </td>
                <td style={cellStyle}>
                  <button onClick={() => onDelete(r.id)} title="Cancelar" style={{
                    padding: '6px 8px', borderRadius: 8, cursor: 'pointer',
                    background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                    color: '#ef4444', display: 'flex',
                  }}>
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {total > records.length && (
          <div style={{ padding: '12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
            Mostrando {records.length} de {total}
          </div>
        )}
      </div>
    </div>
  )
}


// ═══════════════════════════════════════════════════════
// CONFIG TAB — Configuração do agente
// ═══════════════════════════════════════════════════════
function ConfigTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Agent Config */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
        borderRadius: 16, padding: '28px 32px',
      }}>
        <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Bot size={18} style={{ color: '#6366f1' }} /> Configuração do Agente
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <ConfigField label="Nome" value="Agente Financeiro" />
          <ConfigField label="Slug" value="agente-financeiro" mono />
          <ConfigField label="Modelo" value="gemini-2.0-flash" />
          <ConfigField label="Provider" value="Gemini" />
          <ConfigField label="Temperature" value="0.4" />
          <ConfigField label="Tipo" value="financial" />
          <ConfigField label="Memory Budget" value="12.000 tokens" />
          <ConfigField label="Retenção" value="365 dias" />
        </div>
      </div>

      {/* Categories Config */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
        borderRadius: 16, padding: '28px 32px',
      }}>
        <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
          <BarChart3 size={18} style={{ color: '#f59e0b' }} /> Categorias Financeiras
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {Object.entries(CATEGORIES).map(([k, v]) => (
            <div key={k} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
              borderRadius: 12, background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              borderLeft: `4px solid ${v.color}`,
            }}>
              <span style={{ fontSize: 22 }}>{v.icon}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{v.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>{k}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* WhatsApp Connection */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
        borderRadius: 16, padding: '28px 32px',
      }}>
        <h3 style={{ margin: '0 0 20px', fontSize: 16, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Smartphone size={18} style={{ color: '#25D366' }} /> Conexão WhatsApp
        </h3>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16, padding: '18px 22px',
          borderRadius: 12, background: 'rgba(37,211,102,0.06)',
          border: '1px solid rgba(37,211,102,0.2)',
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: 'linear-gradient(135deg, #25D366, #128C7E)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24,
          }}>💬</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>davy@smartmoon.com</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Conectado via WhatsApp Business · Agente financeiro responde automaticamente
            </div>
          </div>
          <span style={{
            padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
            background: 'rgba(16,185,129,0.12)', color: '#10b981',
            border: '1px solid rgba(16,185,129,0.3)', marginLeft: 'auto',
          }}>● Ativo</span>
        </div>
        <div style={{
          marginTop: 12, padding: '12px 18px', borderRadius: 10,
          background: 'var(--bg-elevated)', fontSize: 12, color: 'var(--text-muted)',
          borderLeft: '3px solid rgba(99,102,241,0.4)',
        }}>
          💡 Para usar o agente, envie uma mensagem pelo WhatsApp como: <strong>"Comprei 50 reais de papel hoje"</strong>
        </div>
      </div>
    </div>
  )
}


// ═══════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════

const cardBox = {
  background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
  borderRadius: 16, padding: '22px 24px',
}
const cardTitle = {
  margin: '0 0 18px', fontSize: 15, fontWeight: 800,
  display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)',
}

function BigStat({ icon, label, value, sub, color, highlight }) {
  return (
    <div style={{
      background: highlight ? `linear-gradient(135deg, ${color}22, transparent)` : 'var(--bg-card)',
      border: `1px solid ${highlight ? color + '55' : 'var(--border-subtle)'}`,
      borderRadius: 16, padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  )
}

function FlowBar({ income, expense }) {
  const max = Math.max(income, expense, 1)
  const row = (label, val, color) => (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
        <span style={{ color: 'var(--text-muted)' }}>{label}</span>
        <span style={{ fontWeight: 700, color }}>{fmt(val)}</span>
      </div>
      <div style={{ height: 10, borderRadius: 6, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
        <div style={{ width: `${(val / max) * 100}%`, height: '100%', background: color, borderRadius: 6, transition: 'width .4s' }} />
      </div>
    </div>
  )
  return <div>{row('Entradas', income, '#10b981')}{row('Saídas', expense, '#ef4444')}</div>
}

function CategoryBreakdown({ title, total, items, tone, empty }) {
  return (
    <div style={cardBox}>
      <h3 style={cardTitle}>{title}</h3>
      {items.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '10px 0' }}>{empty}</div>
      ) : items.map(([cat, info]) => {
        const c = CATEGORIES[cat] || { label: cat, icon: '•', color: tone }
        const pct = total > 0 ? (info.total / total) * 100 : 0
        return (
          <div key={cat} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
              <span style={{ color: 'var(--text-secondary)' }}>{c.icon} {c.label} <span style={{ color: 'var(--text-muted)' }}>· {info.count}</span></span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{fmt(info.total)}</span>
            </div>
            <div style={{ height: 8, borderRadius: 5, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: c.color, borderRadius: 5 }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StatCard({ icon, label, value, sub, color }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
      borderRadius: 16, padding: '20px 24px', flex: '1 1 200px', minWidth: 200,
      display: 'flex', flexDirection: 'column', gap: 8,
      borderLeft: `4px solid ${color}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-muted)' }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sub}</div>}
    </div>
  )
}

function PipelineStep({ icon, title, description, details, color, status }) {
  return (
    <div style={{
      flex: '1 1 160px', minWidth: 160, padding: '18px 16px', borderRadius: 14,
      background: `${color}08`, border: `1px solid ${color}25`,
      display: 'flex', flexDirection: 'column', gap: 8, position: 'relative',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
        <div>
          <div style={{ fontWeight: 800, fontSize: 13, color }}>{title}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{description}</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
        {details.map((d, i) => (
          <div key={i} style={{
            fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4,
            paddingLeft: 6,
          }}>
            <span style={{ color, fontSize: 8 }}>●</span> {d}
          </div>
        ))}
      </div>
      {status === 'active' && (
        <div style={{
          position: 'absolute', top: 10, right: 10,
          width: 8, height: 8, borderRadius: '50%',
          background: '#10b981', boxShadow: '0 0 6px rgba(16,185,129,0.5)',
        }} />
      )}
    </div>
  )
}

function PipelineArrow() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '0 4px', color: 'var(--text-muted)', flexShrink: 0,
    }}>
      <ChevronRight size={18} />
    </div>
  )
}

function ToolCard({ name, desc, icon, color }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px',
      borderRadius: 12, background: 'var(--bg-elevated)',
      border: '1px solid var(--border-subtle)',
      borderLeft: `3px solid ${color}`,
    }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <div>
        <div style={{ fontWeight: 700, fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color }}>{name}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{desc}</div>
      </div>
    </div>
  )
}

function ConversationExample({ user, agent }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* User message */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{
          maxWidth: '70%', padding: '10px 14px', borderRadius: '14px 14px 4px 14px',
          background: '#005C4B', color: '#e5e5e5', fontSize: 13, lineHeight: 1.5,
        }}>{user}</div>
      </div>
      {/* Agent response */}
      <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
        <div style={{
          maxWidth: '70%', padding: '10px 14px', borderRadius: '14px 14px 14px 4px',
          background: 'var(--bg-elevated)', color: 'var(--text-primary)',
          fontSize: 13, lineHeight: 1.5, border: '1px solid var(--border-subtle)',
          whiteSpace: 'pre-line',
        }}>{agent}</div>
      </div>
    </div>
  )
}

function ChannelCard({ icon, name, desc, status, color }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px',
      borderRadius: 12, background: 'var(--bg-elevated)',
      border: '1px solid var(--border-subtle)',
      opacity: status === 'coming' ? 0.6 : 1,
    }}>
      <span style={{ fontSize: 24 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>{name}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{desc}</div>
      </div>
      <span style={{
        padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700,
        background: status === 'active' ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
        color: status === 'active' ? '#10b981' : '#f59e0b',
      }}>
        {status === 'active' ? '● Ativo' : '🔜 Em breve'}
      </span>
    </div>
  )
}

function ConfigField({ label, value, mono }) {
  return (
    <div style={{
      padding: '12px 16px', borderRadius: 10, background: 'var(--bg-elevated)',
      border: '1px solid var(--border-subtle)',
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{
        fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
        fontFamily: mono ? 'JetBrains Mono, monospace' : 'inherit',
      }}>{value}</div>
    </div>
  )
}


// ═══════════════════════════════════════════════════════
// CREATE RECORD MODAL
// ═══════════════════════════════════════════════════════
function CreateRecordModal({ onClose, onCreate }) {
  const [form, setForm] = useState({
    description: '', amount: '', category: 'compra',
    supplier_name: '', payment_method: '', has_invoice: false,
    invoice_number: '', record_date: new Date().toISOString().slice(0, 10),
    notes: '',
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const submit = () => {
    if (!form.description.trim()) return
    onCreate({
      ...form,
      amount: form.amount ? parseFloat(form.amount) : null,
      payment_method: form.payment_method || null,
      supplier_name: form.supplier_name || null,
      invoice_number: form.invoice_number || null,
      notes: form.notes || null,
    })
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-card)', borderRadius: 20, padding: '28px 32px',
        width: '100%', maxWidth: 520, maxHeight: '85vh', overflow: 'auto',
        border: '1px solid var(--border-subtle)', boxShadow: '0 24px 48px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>💰 Novo Registro</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Field label="Descrição *">
            <input value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="Ex: 30 reais de açúcar" style={modalInput} autoFocus />
          </Field>
          <div style={{ display: 'flex', gap: 12 }}>
            <Field label="Valor (R$)" style={{ flex: 1 }}>
              <input type="number" step="0.01" value={form.amount}
                onChange={e => set('amount', e.target.value)} placeholder="0.00" style={modalInput} />
            </Field>
            <Field label="Data" style={{ flex: 1 }}>
              <input type="date" value={form.record_date}
                onChange={e => set('record_date', e.target.value)} style={modalInput} />
            </Field>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Field label="Categoria" style={{ flex: 1 }}>
              <select value={form.category} onChange={e => set('category', e.target.value)} style={modalInput}>
                {Object.entries(CATEGORIES).map(([k, v]) => (
                  <option key={k} value={k}>{v.icon} {v.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Forma de Pagamento" style={{ flex: 1 }}>
              <select value={form.payment_method} onChange={e => set('payment_method', e.target.value)} style={modalInput}>
                <option value="">Não informado</option>
                {Object.entries(PAYMENT_METHODS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Fornecedor">
            <input value={form.supplier_name} onChange={e => set('supplier_name', e.target.value)}
              placeholder="Nome do fornecedor (opcional)" style={modalInput} />
          </Field>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
              <input type="checkbox" checked={form.has_invoice}
                onChange={e => set('has_invoice', e.target.checked)} />
              Tem nota fiscal
            </label>
            {form.has_invoice && (
              <input value={form.invoice_number} onChange={e => set('invoice_number', e.target.value)}
                placeholder="Nº da nota" style={{ ...modalInput, flex: 1 }} />
            )}
          </div>
          <Field label="Observações">
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
              placeholder="Notas adicionais (opcional)" rows={2}
              style={{ ...modalInput, resize: 'vertical' }} />
          </Field>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
          <button onClick={onClose} style={btnSecondary}>Cancelar</button>
          <button onClick={submit} style={btnPrimary} disabled={!form.description.trim()}>
            <Check size={14} /> Registrar
          </button>
        </div>
      </div>
    </div>
  )
}


// ── Field wrapper ───────────────────────────────────────
function Field({ label, children, style }) {
  return (
    <div style={style}>
      <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4, display: 'block' }}>{label}</label>
      {children}
    </div>
  )
}


// ═══════════════════════════════════════════════════════
// SHARED STYLES
// ═══════════════════════════════════════════════════════
const cellStyle = { padding: '12px 14px', verticalAlign: 'middle' }
const emptyCell = { padding: 40, textAlign: 'center', color: 'var(--text-muted)' }

const inputStyle = {
  padding: '8px 12px', borderRadius: 8, fontSize: 12,
  background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
  color: 'var(--text-primary)', outline: 'none', minWidth: 120,
}

const modalInput = {
  width: '100%', padding: '10px 14px', borderRadius: 10, fontSize: 13,
  background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
  color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
}

const btnPrimary = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '10px 18px', borderRadius: 10, fontSize: 13, fontWeight: 700,
  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
  color: '#fff', border: 'none', cursor: 'pointer',
  boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
}

const btnSecondary = {
  display: 'flex', alignItems: 'center', gap: 6,
  padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
  background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
  color: 'var(--text-secondary)', cursor: 'pointer',
}
