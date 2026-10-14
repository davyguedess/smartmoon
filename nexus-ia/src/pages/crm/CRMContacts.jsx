/**
 * CRM Contacts — Main CRM page with contact list, chat, and profile panel.
 * 
 * Layout: [Contacts List] | [Chat Panel] | [Contact Profile]
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../../api'
import './CRM.css'

// ── Icons ─────────────────────────────────────────────────────────────────
const SearchIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
const PlusIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14"/></svg>
const SendIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m22 2-7 20-4-9-9-4z"/></svg>
const TagIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2H2v10l9.29 9.29a1 1 0 001.42 0l6.58-6.58a1 1 0 000-1.42L12 2z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>
const UploadIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
const UserIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
const ZapIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
const PhoneIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
const MailIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 01-2.06 0L2 7"/></svg>
const CloseIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>

export default function CRMContacts() {
  const [contacts, setContacts] = useState([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [selectedTag, setSelectedTag] = useState('')
  const [tags, setTags] = useState([])
  const [operators, setOperators] = useState([])
  const [quickReplies, setQuickReplies] = useState([])
  const [selectedContact, setSelectedContact] = useState(null)
  const [activeOperator, setActiveOperator] = useState(null)
  const [messageText, setMessageText] = useState('')
  const [chatHistory, setChatHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [page, setPage] = useState(1)
  const [convMode, setConvMode] = useState('ai')   // 'ai' | 'human'
  const [modeBusy, setModeBusy] = useState(false)

  // Modals
  const [showNewContact, setShowNewContact] = useState(false)
  const [showCSVImport, setShowCSVImport] = useState(false)
  const [showNewTag, setShowNewTag] = useState(false)
  const [showQuickReplies, setShowQuickReplies] = useState(false)

  // New contact form
  const [newContact, setNewContact] = useState({ phone: '', name: '', email: '', tags: [] })
  const [newTag, setNewTag] = useState({ name: '', color: '#6366f1' })
  const [csvFile, setCsvFile] = useState(null)
  const [csvTags, setCsvTags] = useState('')
  const [importResult, setImportResult] = useState(null)

  const chatEndRef = useRef(null)
  const fileRef = useRef(null)

  // ── Load data ─────────────────────────────────────────────────────
  const loadContacts = useCallback(async () => {
    try {
      const params = { page, per_page: 50 }
      if (search) params.search = search
      if (selectedTag) params.tag = selectedTag
      const data = await api.crm.listContacts(params)
      setContacts(data.contacts)
      setTotal(data.total)
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [page, search, selectedTag])

  const loadMeta = useCallback(async () => {
    try {
      const [t, o, q, me] = await Promise.all([
        api.crm.listTags(),
        api.crm.listOperators(),
        api.crm.listQuickReplies(),
        api.crm.myOperator().catch(() => null),
      ])
      setTags(t.tags || [])
      setOperators(o.operators || [])
      setQuickReplies(q.quick_replies || [])
      if (!activeOperator) {
        // envia como o usuário logado (assinatura por quem atende)
        setActiveOperator(me || o.operators?.[0] || null)
      }
    } catch (e) { console.error(e) }
  }, [activeOperator])

  useEffect(() => { loadContacts() }, [loadContacts])
  useEffect(() => { loadMeta() }, [])

  // Abrir contato vindo da Recepção (/crm?c=<id>)
  useEffect(() => {
    const cid = new URLSearchParams(window.location.search).get('c')
    if (cid && contacts.length && (!selectedContact || String(selectedContact.id) !== cid)) {
      const found = contacts.find(c => String(c.id) === cid)
      if (found) setSelectedContact(found)
    }
  }, [contacts])

  // ── Contact selected ──────────────────────────────────────────────
  useEffect(() => {
    if (!selectedContact) return
    api.crm.messageHistory(selectedContact.id).then(data => {
      setChatHistory(data.messages || [])
    }).catch(() => setChatHistory([]))
    api.crm.conversationMode(selectedContact.id).then(d => setConvMode(d.mode || 'ai')).catch(() => setConvMode('ai'))
  }, [selectedContact])

  const toggleMode = async () => {
    if (!selectedContact) return
    setModeBusy(true)
    try {
      if (convMode === 'ai') {
        await api.crm.handoffToHuman(selectedContact.id)
        setConvMode('human')
      } else {
        await api.crm.resumeAI(selectedContact.id)
        setConvMode('ai')
      }
    } catch (e) { alert(e.message) }
    setModeBusy(false)
  }

  const transferTo = async (operatorId) => {
    if (!selectedContact || !operatorId) return
    try {
      await api.crm.assignContact(selectedContact.id, +operatorId)
      const op = operators.find(o => o.id === +operatorId)
      alert(`Conversa transferida para ${op?.display_name || 'operador'}.`)
    } catch (e) { alert(e.message) }
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  // ── Handlers ──────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!messageText.trim() || !selectedContact || !activeOperator) return
    setSending(true)
    try {
      await api.crm.sendMessage({
        contact_id: selectedContact.id,
        operator_id: activeOperator.id,
        text: messageText,
      })
      setChatHistory(prev => [...prev, {
        id: Date.now(),
        type: 'message_sent',
        direction: 'outbound',
        content: messageText,
        operator: activeOperator.display_name,
        created_at: new Date().toISOString(),
      }])
      setMessageText('')
    } catch (e) { alert(e.message) }
    setSending(false)
  }

  const handleSendFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !selectedContact || !activeOperator) return
    setSending(true)
    try {
      const r = await api.crm.sendMedia(selectedContact.id, activeOperator.id, file, messageText)
      setChatHistory(prev => [...prev, {
        id: r.interaction_id || Date.now(), type: 'message_sent', direction: 'outbound',
        content: messageText || '', operator: activeOperator.display_name,
        media_type: r.media_type, media_url: r.media_url, media_name: file.name,
        created_at: new Date().toISOString(),
      }])
      setMessageText('')
    } catch (err) { alert(err.message) }
    setSending(false)
  }

  const handleCreateContact = async () => {
    if (!newContact.phone) return
    try {
      await api.crm.createContact(newContact)
      setShowNewContact(false)
      setNewContact({ phone: '', name: '', email: '', tags: [] })
      loadContacts()
    } catch (e) { alert(e.message) }
  }

  const handleCSVImport = async () => {
    if (!csvFile) return
    try {
      const result = await api.crm.importCSV(csvFile, csvTags)
      setImportResult(result)
      loadContacts()
    } catch (e) { alert(e.message) }
  }

  const handleCreateTag = async () => {
    if (!newTag.name) return
    try {
      await api.crm.createTag(newTag)
      setNewTag({ name: '', color: '#6366f1' })
      setShowNewTag(false)
      loadMeta()
    } catch (e) { alert(e.message) }
  }

  const handleQuickReply = (qr) => {
    let text = qr.content
    if (selectedContact?.name) {
      text = text.replace('{{contact_name}}', selectedContact.name)
    }
    setMessageText(text)
    setShowQuickReplies(false)
  }

  const formatPhone = (phone) => {
    if (!phone || phone.length < 10) return phone
    const p = phone.replace(/^55/, '')
    return `(${p.slice(0, 2)}) ${p.slice(2, 7)}-${p.slice(7)}`
  }

  const formatDate = (iso) => {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="crm-layout">
      {/* ── Left: Contact List ────────────────────────────── */}
      <div className="crm-sidebar">
        <div className="crm-sidebar-header">
          <h2>CRM WhatsApp</h2>
          <div className="crm-sidebar-actions">
            <button className="crm-btn-icon" onClick={() => setShowCSVImport(true)} title="Importar CSV">
              <UploadIcon />
            </button>
            <button className="crm-btn-icon" onClick={() => setShowNewTag(true)} title="Nova Tag">
              <TagIcon />
            </button>
            <button className="crm-btn-primary" onClick={() => setShowNewContact(true)}>
              <PlusIcon /> Contato
            </button>
          </div>
        </div>

        <div className="crm-search-bar">
          <SearchIcon />
          <input
            type="text"
            placeholder="Buscar contatos..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
        </div>

        {tags.length > 0 && (
          <div className="crm-tag-filter">
            <button
              className={`crm-tag-chip ${!selectedTag ? 'active' : ''}`}
              onClick={() => setSelectedTag('')}
            >
              Todos
            </button>
            {tags.map(t => (
              <button
                key={t.id}
                className={`crm-tag-chip ${selectedTag === t.name ? 'active' : ''}`}
                style={{ '--tag-color': t.color }}
                onClick={() => setSelectedTag(selectedTag === t.name ? '' : t.name)}
              >
                {t.icon} {t.name}
              </button>
            ))}
          </div>
        )}

        <div className="crm-contact-list">
          {loading ? (
            <div className="crm-loading">Carregando...</div>
          ) : contacts.length === 0 ? (
            <div className="crm-empty">
              <UserIcon />
              <p>Nenhum contato encontrado</p>
            </div>
          ) : (
            contacts.map(c => (
              <div
                key={c.id}
                className={`crm-contact-item ${selectedContact?.id === c.id ? 'selected' : ''}`}
                onClick={() => setSelectedContact(c)}
              >
                <div className="crm-contact-avatar">
                  {c.name ? c.name[0].toUpperCase() : '?'}
                </div>
                <div className="crm-contact-info">
                  <div className="crm-contact-name">{c.name || formatPhone(c.phone)}</div>
                  <div className="crm-contact-phone">{formatPhone(c.phone)}</div>
                </div>
                <div className="crm-contact-meta">
                  {c.tags?.length > 0 && (
                    <div className="crm-contact-tags">
                      {c.tags.slice(0, 2).map(t => {
                        const tagDef = tags.find(td => td.name === t)
                        return (
                          <span key={t} className="crm-mini-tag" style={{ background: tagDef?.color || '#6366f1' }}>
                            {t}
                          </span>
                        )
                      })}
                    </div>
                  )}
                  <div className="crm-contact-time">{formatDate(c.last_contact_at)}</div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="crm-sidebar-footer">
          <span>{total} contatos</span>
          {total > 50 && (
            <div className="crm-pagination">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>←</button>
              <span>Pág {page}</span>
              <button onClick={() => setPage(p => p + 1)}>→</button>
            </div>
          )}
        </div>
      </div>

      {/* ── Center: Chat Panel ────────────────────────────── */}
      <div className="crm-chat-panel">
        {selectedContact ? (
          <>
            <div className="crm-chat-header">
              <div className="crm-chat-header-info">
                <div className="crm-chat-avatar">{selectedContact.name?.[0]?.toUpperCase() || '?'}</div>
                <div>
                  <div className="crm-chat-name">{selectedContact.name || formatPhone(selectedContact.phone)}</div>
                  <div className="crm-chat-status">{formatPhone(selectedContact.phone)}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 12,
                  background: convMode === 'human' ? '#f59e0b22' : '#10b98122',
                  color: convMode === 'human' ? '#b45309' : '#059669',
                }}>
                  {convMode === 'human' ? '🙋 Atendimento humano' : '🤖 IA ativa'}
                </span>
                <button
                  onClick={toggleMode}
                  disabled={modeBusy}
                  title={convMode === 'ai' ? 'Assumir conversa (pausa a IA)' : 'Devolver para a IA'}
                  style={{
                    fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
                    border: 'none', color: '#fff',
                    background: convMode === 'ai' ? '#f59e0b' : '#10b981',
                  }}
                >
                  {convMode === 'ai' ? 'Assumir' : 'Devolver p/ IA'}
                </button>
                {operators.length > 0 && (
                  <select
                    defaultValue=""
                    onChange={e => { transferTo(e.target.value); e.target.value = '' }}
                    title="Transferir para operador"
                    style={{ fontSize: 12, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--border,#e5e7eb)' }}
                  >
                    <option value="" disabled>↔ Transferir</option>
                    {operators.map(o => <option key={o.id} value={o.id}>{o.display_name}</option>)}
                  </select>
                )}
              </div>
            </div>

            <div className="crm-chat-messages">
              {chatHistory.length === 0 ? (
                <div className="crm-chat-empty">
                  <p>Nenhuma interação registrada</p>
                  <p className="crm-chat-empty-sub">Envie a primeira mensagem</p>
                </div>
              ) : (
                chatHistory.map(msg => (
                  <div key={msg.id} className={`crm-chat-bubble ${msg.direction === 'outbound' || msg.type === 'message_sent' ? 'outbound' : 'inbound'}`}>
                    {msg.operator && <div className="crm-bubble-operator">{msg.operator}</div>}
                    {msg.media_url && msg.media_type === 'image' && (
                      <img src={msg.media_url} alt="imagem" style={{ maxWidth: 240, borderRadius: 8, display: 'block', marginBottom: 4 }} />
                    )}
                    {msg.media_url && msg.media_type === 'audio' && (
                      <audio controls src={msg.media_url} style={{ width: 220, marginBottom: 4 }} />
                    )}
                    {msg.media_url && msg.media_type === 'document' && (
                      <a href={msg.media_url} target="_blank" rel="noreferrer" style={{ color: 'inherit', textDecoration: 'underline', display: 'block', marginBottom: 4 }}>📎 {msg.media_name || 'arquivo'}</a>
                    )}
                    {(msg.content || msg.notes) && <div className="crm-bubble-text">{msg.content || msg.notes}</div>}
                    <div className="crm-bubble-time">{formatDate(msg.created_at)}</div>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="crm-chat-input">
              <div className="crm-chat-input-top">
                <select
                  className="crm-operator-select"
                  value={activeOperator?.id || ''}
                  onChange={e => setActiveOperator(operators.find(o => o.id === +e.target.value))}
                >
                  {operators.map(o => (
                    <option key={o.id} value={o.id}>👤 {o.display_name}</option>
                  ))}
                </select>
                <button className="crm-btn-quick" onClick={() => setShowQuickReplies(true)}>
                  <ZapIcon /> Rápidas
                </button>
              </div>
              <div className="crm-chat-input-row">
                <input ref={fileRef} type="file" style={{ display: 'none' }}
                  accept="image/*,audio/*,application/pdf,.doc,.docx,.xls,.xlsx,.csv,.txt" onChange={handleSendFile} />
                <button className="crm-btn-send" onClick={() => fileRef.current?.click()} disabled={sending} title="Anexar imagem, áudio ou arquivo" style={{ background: 'var(--bg-elevated, #192236)' }}>
                  📎
                </button>
                <textarea
                  placeholder="Digite sua mensagem..."
                  value={messageText}
                  onChange={e => setMessageText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                  rows={2}
                />
                <button
                  className="crm-btn-send"
                  onClick={handleSend}
                  disabled={sending || !messageText.trim()}
                >
                  <SendIcon />
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="crm-chat-placeholder">
            <div className="crm-chat-placeholder-icon">💬</div>
            <h3>Selecione um contato</h3>
            <p>Escolha um contato na lista para iniciar uma conversa</p>
          </div>
        )}
      </div>

      {/* ── Right: Contact Profile ─────────────────────────── */}
      {selectedContact && (
        <div className="crm-profile-panel">
          <div className="crm-profile-header">
            <div className="crm-profile-avatar">
              {selectedContact.name?.[0]?.toUpperCase() || '?'}
            </div>
            <h3>{selectedContact.name || 'Sem nome'}</h3>
            <span className="crm-profile-source">{selectedContact.source}</span>
          </div>

          <div className="crm-profile-details">
            <div className="crm-profile-row">
              <PhoneIcon />
              <span>{formatPhone(selectedContact.phone)}</span>
            </div>
            {selectedContact.email && (
              <div className="crm-profile-row">
                <MailIcon />
                <span>{selectedContact.email}</span>
              </div>
            )}
          </div>

          {selectedContact.tags?.length > 0 && (
            <div className="crm-profile-section">
              <h4>Tags</h4>
              <div className="crm-profile-tags">
                {selectedContact.tags.map(t => {
                  const tagDef = tags.find(td => td.name === t)
                  return (
                    <span key={t} className="crm-tag-badge" style={{ background: tagDef?.color || '#6366f1' }}>
                      {t}
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {selectedContact.notes && (
            <div className="crm-profile-section">
              <h4>Notas</h4>
              <p className="crm-profile-notes">{selectedContact.notes}</p>
            </div>
          )}

          <div className="crm-profile-section">
            <h4>Histórico</h4>
            <div className="crm-profile-stats">
              <div className="crm-stat">
                <span className="crm-stat-value">{chatHistory.filter(h => h.type === 'message_sent').length}</span>
                <span className="crm-stat-label">Enviadas</span>
              </div>
              <div className="crm-stat">
                <span className="crm-stat-value">{chatHistory.filter(h => h.type === 'message_received').length}</span>
                <span className="crm-stat-label">Recebidas</span>
              </div>
              <div className="crm-stat">
                <span className="crm-stat-value">{chatHistory.filter(h => h.type === 'sale').length}</span>
                <span className="crm-stat-label">Vendas</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modals ────────────────────────────────────────── */}
      {showNewContact && (
        <div className="crm-modal-overlay" onClick={() => setShowNewContact(false)}>
          <div className="crm-modal" onClick={e => e.stopPropagation()}>
            <div className="crm-modal-header">
              <h3>Novo Contato</h3>
              <button onClick={() => setShowNewContact(false)}><CloseIcon /></button>
            </div>
            <div className="crm-modal-body">
              <label>Telefone *</label>
              <input placeholder="11999998888" value={newContact.phone} onChange={e => setNewContact({...newContact, phone: e.target.value})} />
              <label>Nome</label>
              <input placeholder="Nome do contato" value={newContact.name} onChange={e => setNewContact({...newContact, name: e.target.value})} />
              <label>Email</label>
              <input placeholder="email@exemplo.com" value={newContact.email} onChange={e => setNewContact({...newContact, email: e.target.value})} />
              {tags.length > 0 && (
                <>
                  <label>Tags</label>
                  <div className="crm-tag-select">
                    {tags.map(t => (
                      <button
                        key={t.id}
                        className={`crm-tag-chip ${newContact.tags.includes(t.name) ? 'active' : ''}`}
                        style={{ '--tag-color': t.color }}
                        onClick={() => {
                          setNewContact(prev => ({
                            ...prev,
                            tags: prev.tags.includes(t.name)
                              ? prev.tags.filter(x => x !== t.name)
                              : [...prev.tags, t.name]
                          }))
                        }}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="crm-modal-footer">
              <button className="crm-btn-secondary" onClick={() => setShowNewContact(false)}>Cancelar</button>
              <button className="crm-btn-primary" onClick={handleCreateContact}>Criar Contato</button>
            </div>
          </div>
        </div>
      )}

      {showCSVImport && (
        <div className="crm-modal-overlay" onClick={() => { setShowCSVImport(false); setImportResult(null) }}>
          <div className="crm-modal" onClick={e => e.stopPropagation()}>
            <div className="crm-modal-header">
              <h3>Importar CSV</h3>
              <button onClick={() => { setShowCSVImport(false); setImportResult(null) }}><CloseIcon /></button>
            </div>
            <div className="crm-modal-body">
              {importResult ? (
                <div className="crm-import-result">
                  <div className="crm-import-stat success">✅ {importResult.created} criados</div>
                  <div className="crm-import-stat warn">⚠️ {importResult.duplicates} duplicados</div>
                  {importResult.errors?.length > 0 && (
                    <div className="crm-import-errors">
                      {importResult.errors.map((e, i) => <div key={i}>❌ {e}</div>)}
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <p className="crm-import-hint">
                    O CSV deve ter colunas: <code>telefone</code>, <code>nome</code>, <code>email</code>
                  </p>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={e => setCsvFile(e.target.files[0])}
                    className="crm-file-input"
                  />
                  <label>Tags para aplicar (separadas por vírgula)</label>
                  <input
                    placeholder="lead, importado"
                    value={csvTags}
                    onChange={e => setCsvTags(e.target.value)}
                  />
                </>
              )}
            </div>
            <div className="crm-modal-footer">
              <button className="crm-btn-secondary" onClick={() => { setShowCSVImport(false); setImportResult(null) }}>Fechar</button>
              {!importResult && (
                <button className="crm-btn-primary" onClick={handleCSVImport} disabled={!csvFile}>
                  <UploadIcon /> Importar
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showNewTag && (
        <div className="crm-modal-overlay" onClick={() => setShowNewTag(false)}>
          <div className="crm-modal crm-modal-sm" onClick={e => e.stopPropagation()}>
            <div className="crm-modal-header">
              <h3>Nova Tag</h3>
              <button onClick={() => setShowNewTag(false)}><CloseIcon /></button>
            </div>
            <div className="crm-modal-body">
              <label>Nome</label>
              <input placeholder="Ex: VIP" value={newTag.name} onChange={e => setNewTag({...newTag, name: e.target.value})} />
              <label>Cor</label>
              <input type="color" value={newTag.color} onChange={e => setNewTag({...newTag, color: e.target.value})} />
            </div>
            <div className="crm-modal-footer">
              <button className="crm-btn-secondary" onClick={() => setShowNewTag(false)}>Cancelar</button>
              <button className="crm-btn-primary" onClick={handleCreateTag}>Criar Tag</button>
            </div>
          </div>
        </div>
      )}

      {showQuickReplies && (
        <div className="crm-modal-overlay" onClick={() => setShowQuickReplies(false)}>
          <div className="crm-modal" onClick={e => e.stopPropagation()}>
            <div className="crm-modal-header">
              <h3>Mensagens Rápidas</h3>
              <button onClick={() => setShowQuickReplies(false)}><CloseIcon /></button>
            </div>
            <div className="crm-modal-body">
              {quickReplies.length === 0 ? (
                <p className="crm-empty">Nenhuma mensagem rápida criada</p>
              ) : (
                <div className="crm-quick-list">
                  {quickReplies.map(qr => (
                    <div key={qr.id} className="crm-quick-item" onClick={() => handleQuickReply(qr)}>
                      <div className="crm-quick-title">
                        <ZapIcon /> {qr.title}
                        {qr.shortcut && <code>{qr.shortcut}</code>}
                      </div>
                      <div className="crm-quick-preview">{qr.content.slice(0, 100)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
