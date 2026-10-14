/**
 * CRM Recepção — fila de conversas para a equipe atender.
 * Aguardando · Meus atendimentos · Em atendimento (equipe) · IA.
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../../api'

const fmtPhone = (p) => {
  if (!p) return ''
  const d = p.replace(/@.*/, '').replace(/^\+?55/, '')
  if (d.length < 10) return p.replace(/@.*/, '')
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7, 11)}`
}
const ago = (iso) => {
  if (!iso) return ''
  const s = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (s < 60) return 'agora'
  if (s < 3600) return `${Math.floor(s / 60)}min`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

export default function CRMReception() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const nav = useNavigate()

  const load = useCallback(async () => {
    try { setData(await api.crm.reception()) } catch (e) { console.error(e) }
    setLoading(false)
  }, [])
  useEffect(() => {
    load()
    const t = setInterval(load, 20000) // atualiza a cada 20s
    return () => clearInterval(t)
  }, [load])

  const attend = async (item) => {
    setBusy(item.conversation_id)
    try {
      const r = await api.crm.pickup(item.conversation_id)
      nav(`/crm?c=${r.contact_id}`)
    } catch (e) { alert(e.message) }
    setBusy(null)
  }

  const openChat = (item) => { if (item.contact_id) nav(`/crm?c=${item.contact_id}`) }

  if (loading) return <div style={{ padding: 40, color: 'var(--text-secondary)' }}>Carregando recepção...</div>

  const Card = ({ item, action }) => (
    <div style={S.card} onClick={() => openChat(item)}>
      <div style={S.avatar}>{(item.name || '?')[0].toUpperCase()}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={S.name}>{item.name}</div>
        <div style={S.preview}>{item.preview || fmtPhone(item.phone)}</div>
        {item.assigned_operator && <div style={S.op}>👤 {item.assigned_operator}</div>}
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={S.time}>{ago(item.last_message_at)}</div>
        {action}
      </div>
    </div>
  )

  const Col = ({ title, color, items, action, empty }) => (
    <div style={S.col}>
      <div style={{ ...S.colHead, color }}>
        <span style={{ width: 8, height: 8, borderRadius: 4, background: color, display: 'inline-block' }} />
        {title} <span style={S.count}>{items.length}</span>
      </div>
      <div style={S.list}>
        {items.length === 0 ? <div style={S.empty}>{empty}</div>
          : items.map(it => <Card key={it.conversation_id} item={it} action={action?.(it)} />)}
      </div>
    </div>
  )

  return (
    <div style={S.page}>
      <div style={{ marginBottom: 18 }}>
        <h1 style={S.title}>📥 Recepção</h1>
        <p style={S.subtitle}>
          Conversas para a equipe atender. <b style={{ color: 'var(--nexus-green)' }}>{data?.ai_count || 0}</b> sendo atendidas pela IA.
        </p>
      </div>
      <div style={S.board}>
        <Col title="Aguardando" color="var(--nexus-amber)" items={data?.waiting || []} empty="Ninguém na fila 🎉"
          action={(it) => (
            <button disabled={busy === it.conversation_id} onClick={e => { e.stopPropagation(); attend(it) }} style={S.attendBtn}>
              {busy === it.conversation_id ? '...' : 'Atender'}
            </button>
          )} />
        <Col title="Meus atendimentos" color="var(--nexus-cyan)" items={data?.mine || []} empty="Você não está atendendo ninguém" />
        <Col title="Em atendimento (equipe)" color="var(--nexus-purple)" items={data?.team || []} empty="Ninguém da equipe atendendo" />
      </div>
    </div>
  )
}

const S = {
  page: { padding: '24px 28px', height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 },
  title: { fontSize: 24, fontWeight: 800, margin: 0, color: 'var(--text-primary)' },
  subtitle: { fontSize: 13, color: 'var(--text-secondary)', margin: '5px 0 0' },
  board: { display: 'flex', gap: 14, flex: 1, minHeight: 0 },
  col: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0, background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: 12 },
  colHead: { display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 13, marginBottom: 12 },
  count: { marginLeft: 'auto', fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-elevated)', borderRadius: 10, padding: '1px 9px' },
  list: { display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto', flex: 1 },
  empty: { fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '24px 8px' },
  card: { display: 'flex', alignItems: 'center', gap: 10, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '10px 12px', cursor: 'pointer' },
  avatar: { width: 38, height: 38, borderRadius: 10, background: 'var(--gradient-purple)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 },
  name: { fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  preview: { fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  op: { fontSize: 11, color: 'var(--text-muted)', marginTop: 2 },
  time: { fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 },
  attendBtn: { background: 'var(--nexus-amber)', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
}
