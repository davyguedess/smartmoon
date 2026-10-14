/**
 * CRM Funil de Vendas — Kanban board (tema escuro Nexus).
 * Arraste cards entre estágios. Clique num card para abrir a conversa e agir.
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../../api'

const brl = (v) => `R$ ${(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
const fmtPhone = (p) => {
  if (!p) return ''
  const d = p.replace(/@.*/, '').replace(/^55/, '')
  if (d.length < 10) return p.replace(/@.*/, '')
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`
}
const fmtDate = (iso) => iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''

export default function CRMFunnel() {
  const [board, setBoard] = useState([])
  const [loading, setLoading] = useState(true)
  const [dragCard, setDragCard] = useState(null)
  const [dragOver, setDragOver] = useState(null)
  const [operators, setOperators] = useState([])

  // Drawer (conversa)
  const [openCard, setOpenCard] = useState(null)     // {card, stageId}
  const [chat, setChat] = useState([])
  const [chatLoading, setChatLoading] = useState(false)
  const [mode, setMode] = useState('ai')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [sending, setSending] = useState(false)
  const [quickReplies, setQuickReplies] = useState([])
  const [showQuick, setShowQuick] = useState(false)
  const [activeOp, setActiveOp] = useState(null)
  const chatEndRef = useRef(null)
  const fileRef = useRef(null)

  const load = useCallback(async () => {
    try {
      const [b, o, q, me] = await Promise.all([
        api.crm.pipelineBoard(),
        api.crm.listOperators(),
        api.crm.listQuickReplies().catch(() => ({ quick_replies: [] })),
        api.crm.myOperator().catch(() => null),
      ])
      setBoard(b.board || [])
      setOperators(o.operators || [])
      setQuickReplies(q.quick_replies || [])
      // envia SEMPRE como o usuário logado (assinatura por quem atende)
      setActiveOp(prev => prev || me || (o.operators?.[0] || null))
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chat])

  // ── Card → abrir conversa ──
  const openConversation = async (card, stageId) => {
    setOpenCard({ card, stageId })
    setChat([]); setChatLoading(true); setMode('ai')
    try {
      const [h, m] = await Promise.all([
        api.crm.messageHistory(card.id).catch(() => ({ messages: [] })),
        api.crm.conversationMode(card.id).catch(() => ({ mode: 'ai' })),
      ])
      setChat(h.messages || [])
      setMode(m.mode || 'ai')
    } catch (e) { console.error(e) }
    setChatLoading(false)
  }

  const toggleMode = async () => {
    if (!openCard) return
    setBusy(true)
    try {
      if (mode === 'ai') { await api.crm.handoffToHuman(openCard.card.id); setMode('human') }
      else { await api.crm.resumeAI(openCard.card.id); setMode('ai') }
    } catch (e) { alert(e.message) }
    setBusy(false)
  }

  const moveToStage = async (stageId) => {
    if (!openCard) return
    try {
      await api.crm.moveContact(openCard.card.id, +stageId)
      setOpenCard(oc => ({ ...oc, stageId: +stageId }))
      load()
    } catch (e) { alert(e.message) }
  }

  const transfer = async (operatorId) => {
    if (!openCard || !operatorId) return
    try {
      await api.crm.assignContact(openCard.card.id, +operatorId)
      const op = operators.find(o => o.id === +operatorId)
      alert(`Transferido para ${op?.display_name || 'operador'}.`)
      load()
    } catch (e) { alert(e.message) }
  }

  const sendReply = async () => {
    if (!msg.trim() || !openCard || !activeOp) return
    setSending(true)
    const text = msg
    try {
      await api.crm.sendMessage({ contact_id: openCard.card.id, operator_id: activeOp.id, text })
      // otimista: adiciona ao chat já assinado com o nome do atendente
      setChat(prev => [...prev, {
        id: Date.now(), type: 'message_sent', direction: 'outbound',
        content: text, operator: activeOp.display_name, created_at: new Date().toISOString(),
      }])
      setMsg('')
    } catch (e) { alert(e.message) }
    setSending(false)
  }

  const applyQuick = (qr) => {
    let t = qr.content || ''
    if (openCard?.card?.name) t = t.replace(/\{\{contact_name\}\}/g, openCard.card.name)
    setMsg(t)
    setShowQuick(false)
  }

  const sendFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !openCard || !activeOp) return
    setSending(true)
    try {
      const r = await api.crm.sendMedia(openCard.card.id, activeOp.id, file, msg)
      const kind = r.media_type
      setChat(prev => [...prev, {
        id: r.interaction_id || Date.now(), type: 'message_sent', direction: 'outbound',
        content: msg || '', operator: activeOp.display_name, media_type: kind,
        media_url: r.media_url, media_name: file.name, created_at: new Date().toISOString(),
      }])
      setMsg('')
    } catch (err) { alert(err.message) }
    setSending(false)
  }

  const saveDealValue = async (v) => {
    if (!openCard) return
    const value = parseFloat(String(v).replace(',', '.')) || 0
    try {
      await api.crm.moveContact(openCard.card.id, openCard.stageId, value)
      setOpenCard(oc => ({ ...oc, card: { ...oc.card, deal_value: value } }))
      load()
    } catch (e) { alert(e.message) }
  }

  // ── Drag & drop ──
  const onDrop = async (stageId) => {
    setDragOver(null)
    if (!dragCard || dragCard.stageId === stageId) { setDragCard(null); return }
    setBoard(prev => prev
      .map(col => ({
        ...col,
        cards: col.id === stageId ? [dragCard.card, ...col.cards] : col.cards.filter(c => c.id !== dragCard.card.id),
      }))
      .map(col => ({ ...col, count: col.cards.length, total_value: col.cards.reduce((s, c) => s + (c.deal_value || 0), 0) })))
    try { await api.crm.moveContact(dragCard.card.id, stageId) } catch (e) { alert(e.message) }
    setDragCard(null); load()
  }

  const addStage = async () => {
    const name = prompt('Nome do novo estágio:')
    if (!name) return
    try { await api.crm.createStage({ name }); load() } catch (e) { alert(e.message) }
  }
  const renameStage = async (col) => {
    const name = prompt('Renomear estágio:', col.name)
    if (!name || name === col.name) return
    try { await api.crm.updateStage(col.id, { name }); load() } catch (e) { alert(e.message) }
  }
  const removeStage = async (col) => {
    if (!confirm(`Remover "${col.name}"? Os contatos vão para o primeiro estágio.`)) return
    try { await api.crm.deleteStage(col.id); load() } catch (e) { alert(e.message) }
  }

  const totalPipeline = board.reduce((s, c) => s + (c.total_value || 0), 0)
  const totalCards = board.reduce((s, c) => s + (c.count || 0), 0)

  if (loading) return <div style={{ padding: 40, color: 'var(--text-secondary)' }}>Carregando funil...</div>

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div>
          <h1 style={S.title}>🎯 Funil de Vendas</h1>
          <p style={S.subtitle}>
            <b style={{ color: 'var(--text-primary)' }}>{totalCards}</b> oportunidades
            <span style={{ margin: '0 8px', opacity: 0.4 }}>·</span>
            <b style={{ color: 'var(--nexus-green)' }}>{brl(totalPipeline)}</b> no funil
          </p>
        </div>
        <button onClick={addStage} style={S.addBtn}>+ Estágio</button>
      </div>

      {/* Board */}
      <div style={S.board}>
        {board.map(col => (
          <div
            key={col.id}
            onDragOver={e => { e.preventDefault(); setDragOver(col.id) }}
            onDragLeave={() => setDragOver(o => o === col.id ? null : o)}
            onDrop={() => onDrop(col.id)}
            style={{ ...S.column, ...(dragOver === col.id ? S.columnOver : {}) }}
          >
            <div style={{ ...S.colAccent, background: col.color }} />
            <div style={S.colHeader}>
              <span onClick={() => renameStage(col)} title="Renomear" style={S.colName}>{col.name}</span>
              <span style={S.countBadge}>{col.count}</span>
              <span onClick={() => removeStage(col)} title="Remover" style={S.colDelete}>×</span>
            </div>
            <div style={S.colValue}>{col.total_value > 0 ? brl(col.total_value) : '—'}</div>

            <div style={S.cardList}>
              {col.cards.length === 0 ? (
                <div style={S.emptyCol}>Arraste cards para cá</div>
              ) : col.cards.map(card => (
                <div
                  key={card.id}
                  draggable
                  onDragStart={() => setDragCard({ card, stageId: col.id })}
                  onClick={() => openConversation(card, col.id)}
                  style={S.card}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-card-hover)'; e.currentTarget.style.borderColor = 'var(--border-active)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-card)'; e.currentTarget.style.borderColor = 'var(--border-default)' }}
                >
                  <div style={S.cardTop}>
                    <div style={{ ...S.cardAvatar, background: col.color + '33', color: col.color }}>
                      {(card.name || '?')[0].toUpperCase()}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={S.cardName}>{card.name}</div>
                      <div style={S.cardPhone}>{fmtPhone(card.phone)}</div>
                    </div>
                  </div>
                  {card.deal_value > 0 && <div style={S.cardValue}>{brl(card.deal_value)}</div>}
                  {(card.tags?.length > 0) && (
                    <div style={S.tagRow}>
                      {card.tags.slice(0, 3).map(t => <span key={t} style={S.tag}>{t}</span>)}
                    </div>
                  )}
                  <div style={S.cardFoot}>
                    <span style={S.cardOp}>{card.assigned_operator ? `👤 ${card.assigned_operator}` : '⬦ sem responsável'}</span>
                    <span style={S.cardOpen}>abrir ›</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Drawer da conversa */}
      {openCard && (
        <>
          <div style={S.overlay} onClick={() => setOpenCard(null)} />
          <div style={S.drawer}>
            <div style={S.drawerHead}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                <div style={S.drawerAvatar}>{(openCard.card.name || '?')[0].toUpperCase()}</div>
                <div style={{ minWidth: 0 }}>
                  <div style={S.drawerName}>{openCard.card.name}</div>
                  <div style={S.drawerPhone}>{fmtPhone(openCard.card.phone)}</div>
                </div>
              </div>
              <button onClick={() => setOpenCard(null)} style={S.closeBtn}>×</button>
            </div>

            {/* Ações */}
            <div style={S.actions}>
              <span style={{ ...S.modePill, ...(mode === 'human' ? S.modeHuman : S.modeAI) }}>
                {mode === 'human' ? '🙋 Atendimento humano' : '🤖 IA ativa'}
              </span>
              <button onClick={toggleMode} disabled={busy}
                style={{ ...S.actBtn, background: mode === 'ai' ? 'var(--nexus-amber)' : 'var(--nexus-green)' }}>
                {mode === 'ai' ? 'Assumir' : 'Devolver p/ IA'}
              </button>
            </div>
            <div style={S.selectRow}>
              <select value={openCard.stageId || ''} onChange={e => moveToStage(e.target.value)} style={S.select}>
                {board.map(c => <option key={c.id} value={c.id}>Estágio: {c.name}</option>)}
              </select>
              <select defaultValue="" onChange={e => { transfer(e.target.value); e.target.value = '' }} style={S.select}>
                <option value="" disabled>↔ Transferir para…</option>
                {operators.map(o => <option key={o.id} value={o.id}>{o.display_name}</option>)}
              </select>
              <input
                type="text" inputMode="decimal" placeholder="R$ valor"
                defaultValue={openCard.card.deal_value || ''}
                onBlur={e => saveDealValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') e.target.blur() }}
                title="Valor da oportunidade"
                style={{ ...S.select, maxWidth: 96 }}
              />
            </div>

            {/* Conversa */}
            <div style={S.chat}>
              {chatLoading ? (
                <div style={S.chatInfo}>Carregando conversa...</div>
              ) : chat.length === 0 ? (
                <div style={S.chatInfo}>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>💬</div>
                  Nenhuma mensagem registrada com este contato ainda.
                </div>
              ) : chat.map(m => {
                const out = m.direction === 'outbound' || m.type === 'message_sent'
                return (
                  <div key={m.id} style={{ ...S.bubble, ...(out ? S.bubbleOut : S.bubbleIn) }}>
                    {m.operator && <div style={S.bubbleOp}>{m.operator}</div>}
                    {m.media_url && m.media_type === 'image' && (
                      <img src={m.media_url} alt="imagem" style={S.bubbleImg} />
                    )}
                    {m.media_url && m.media_type === 'audio' && (
                      <audio controls src={m.media_url} style={{ width: 200, marginBottom: 4 }} />
                    )}
                    {m.media_url && m.media_type === 'document' && (
                      <a href={m.media_url} target="_blank" rel="noreferrer" style={S.bubbleDoc}>📎 {m.media_name || 'arquivo'}</a>
                    )}
                    {(m.content || '') && <div>{m.content}</div>}
                    <div style={S.bubbleTime}>{fmtDate(m.created_at)}</div>
                  </div>
                )
              })}
              <div ref={chatEndRef} />
            </div>

            {/* Caixa de resposta (atende de dentro do funil) */}
            <div style={S.replyBox}>
              {showQuick && quickReplies.length > 0 && (
                <div style={S.quickList}>
                  {quickReplies.map(qr => (
                    <div key={qr.id} style={S.quickItem} onClick={() => applyQuick(qr)}>
                      <b>⚡ {qr.title}</b>
                      <div style={S.quickPreview}>{(qr.content || '').slice(0, 60)}</div>
                    </div>
                  ))}
                </div>
              )}
              <div style={S.replyMeta}>
                <span>Enviando como <b style={{ color: 'var(--text-purple)' }}>{activeOp?.display_name || '—'}</b></span>
                {quickReplies.length > 0 && (
                  <span style={S.quickToggle} onClick={() => setShowQuick(v => !v)}>⚡ Rápidas</span>
                )}
              </div>
              <div style={S.replyRow}>
                <input ref={fileRef} type="file" style={{ display: 'none' }}
                  accept="image/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" onChange={sendFile} />
                <button onClick={() => fileRef.current?.click()} disabled={sending} style={S.attachBtn} title="Anexar imagem, áudio ou arquivo">
                  📎
                </button>
                <textarea
                  rows={2} placeholder="Escreva uma mensagem..." value={msg}
                  onChange={e => setMsg(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply() } }}
                  style={S.replyInput}
                />
                <button onClick={sendReply} disabled={sending || !msg.trim()} style={S.sendBtn} title="Enviar">
                  ➤
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── estilos (tema escuro Nexus) ──
const S = {
  page: { padding: '24px 28px', height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  title: { fontSize: 24, fontWeight: 800, margin: 0, color: 'var(--text-primary)' },
  subtitle: { fontSize: 13, color: 'var(--text-secondary)', margin: '5px 0 0' },
  addBtn: { background: 'var(--gradient-purple)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 18px', fontWeight: 600, fontSize: 13, cursor: 'pointer', boxShadow: 'var(--glow-purple)' },

  board: { display: 'flex', gap: 14, overflowX: 'auto', flex: 1, minHeight: 0, paddingBottom: 10 },
  column: { minWidth: 286, width: 286, display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: '0 10px 10px', position: 'relative', overflow: 'hidden' },
  columnOver: { border: '1px solid var(--border-active)', background: 'var(--bg-surface)' },
  colAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  colHeader: { display: 'flex', alignItems: 'center', gap: 8, padding: '14px 2px 4px' },
  colName: { fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', cursor: 'pointer', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  countBadge: { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', background: 'var(--bg-elevated)', borderRadius: 10, padding: '2px 9px' },
  colDelete: { cursor: 'pointer', color: 'var(--text-muted)', fontSize: 17, lineHeight: 1 },
  colValue: { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', padding: '0 2px 10px' },
  cardList: { display: 'flex', flexDirection: 'column', gap: 9, overflowY: 'auto', flex: 1, minHeight: 40 },
  emptyCol: { fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '26px 8px', border: '1px dashed var(--border-subtle)', borderRadius: 10 },

  card: { background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 12, padding: 12, cursor: 'pointer', transition: 'background .15s, border-color .15s', boxShadow: 'var(--shadow-sm)' },
  cardTop: { display: 'flex', alignItems: 'center', gap: 9 },
  cardAvatar: { width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 },
  cardName: { fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  cardPhone: { fontSize: 11, color: 'var(--text-secondary)' },
  cardValue: { fontSize: 13, fontWeight: 700, color: 'var(--nexus-green)', marginTop: 8 },
  tagRow: { display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 },
  tag: { fontSize: 10, background: 'rgba(139,92,246,0.15)', color: 'var(--text-purple)', borderRadius: 6, padding: '2px 7px' },
  cardFoot: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, paddingTop: 8, borderTop: '1px solid var(--border-subtle)' },
  cardOp: { fontSize: 11, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  cardOpen: { fontSize: 11, color: 'var(--nexus-cyan)', fontWeight: 600, flexShrink: 0, marginLeft: 6 },

  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 40 },
  drawer: { position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(440px, 94vw)', background: 'var(--bg-panel)', borderLeft: '1px solid var(--border-default)', zIndex: 41, display: 'flex', flexDirection: 'column', boxShadow: 'var(--shadow-xl)' },
  drawerHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid var(--border-subtle)' },
  drawerAvatar: { width: 42, height: 42, borderRadius: 12, background: 'var(--gradient-purple)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 18, flexShrink: 0 },
  drawerName: { fontWeight: 700, fontSize: 16, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  drawerPhone: { fontSize: 12, color: 'var(--text-secondary)' },
  closeBtn: { background: 'var(--bg-elevated)', border: 'none', color: 'var(--text-secondary)', width: 32, height: 32, borderRadius: 8, fontSize: 20, cursor: 'pointer', lineHeight: 1 },

  actions: { display: 'flex', alignItems: 'center', gap: 10, padding: '12px 18px 8px' },
  modePill: { fontSize: 11, fontWeight: 600, padding: '5px 10px', borderRadius: 20, flex: 1, textAlign: 'center' },
  modeAI: { background: 'rgba(16,185,129,0.15)', color: 'var(--nexus-green)' },
  modeHuman: { background: 'rgba(245,158,11,0.15)', color: 'var(--nexus-amber)' },
  actBtn: { color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 600, fontSize: 12, cursor: 'pointer' },
  selectRow: { display: 'flex', gap: 8, padding: '4px 18px 12px', borderBottom: '1px solid var(--border-subtle)' },
  select: { flex: 1, background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '7px 9px', fontSize: 12 },

  chat: { flex: 1, overflowY: 'auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--bg-base)' },
  chatInfo: { margin: 'auto', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, maxWidth: 240 },
  bubble: { maxWidth: '82%', padding: '9px 12px', borderRadius: 12, fontSize: 13, lineHeight: 1.4, color: 'var(--text-primary)', wordBreak: 'break-word' },
  bubbleIn: { alignSelf: 'flex-start', background: 'var(--bg-elevated)', borderBottomLeftRadius: 3 },
  bubbleOut: { alignSelf: 'flex-end', background: 'var(--nexus-violet)', borderBottomRightRadius: 3 },
  bubbleOp: { fontSize: 10, fontWeight: 700, opacity: 0.75, marginBottom: 2 },
  bubbleTime: { fontSize: 9, opacity: 0.6, marginTop: 4, textAlign: 'right' },

  replyBox: { borderTop: '1px solid var(--border-subtle)', padding: '10px 14px 14px', background: 'var(--bg-panel)', position: 'relative' },
  replyMeta: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 7 },
  quickToggle: { cursor: 'pointer', color: 'var(--nexus-cyan)', fontWeight: 600 },
  replyRow: { display: 'flex', gap: 8, alignItems: 'flex-end' },
  replyInput: { flex: 1, background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: 10, padding: '9px 11px', fontSize: 13, resize: 'none', fontFamily: 'inherit' },
  sendBtn: { background: 'var(--gradient-purple)', color: '#fff', border: 'none', borderRadius: 10, width: 42, height: 42, fontSize: 16, cursor: 'pointer', flexShrink: 0 },
  attachBtn: { background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)', borderRadius: 10, width: 42, height: 42, fontSize: 17, cursor: 'pointer', flexShrink: 0 },
  bubbleImg: { maxWidth: '100%', borderRadius: 8, marginBottom: 4, display: 'block' },
  bubbleDoc: { display: 'inline-block', color: 'inherit', textDecoration: 'underline', marginBottom: 4, fontSize: 13 },
  quickList: { position: 'absolute', bottom: '100%', left: 14, right: 14, background: 'var(--bg-elevated)', border: '1px solid var(--border-default)', borderRadius: 10, maxHeight: 200, overflowY: 'auto', boxShadow: 'var(--shadow-lg)', marginBottom: 6 },
  quickItem: { padding: '9px 12px', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)', fontSize: 12, color: 'var(--text-primary)' },
  quickPreview: { fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 },
}
