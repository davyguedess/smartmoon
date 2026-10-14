/**
 * CRM Equipe — convidar e gerir Admins e Atendentes.
 * Todos atendem pelo mesmo WhatsApp; cada um assina com o próprio nome.
 */
import { useState, useEffect, useCallback } from 'react'
import { api } from '../../api'

export default function CRMTeam() {
  const [members, setMembers] = useState([])
  const [invites, setInvites] = useState([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('atendente')
  const [sending, setSending] = useState(false)
  const [copied, setCopied] = useState(null)

  const load = useCallback(async () => {
    try {
      const d = await api.crm.listTeam()
      setMembers(d.members || [])
      setInvites(d.pending_invites || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const invite = async () => {
    if (!email.includes('@')) return alert('Informe um e-mail válido.')
    setSending(true)
    try {
      const r = await api.crm.invite(email.trim().toLowerCase(), role)
      setEmail('')
      await load()
      if (r.link) { navigator.clipboard?.writeText(r.link).catch(() => {}); alert(`${r.message}\n\nLink copiado:\n${r.link}`) }
    } catch (e) { alert(e.message) }
    setSending(false)
  }

  const copyLink = (inv) => {
    navigator.clipboard?.writeText(inv.link).catch(() => {})
    setCopied(inv.id); setTimeout(() => setCopied(null), 1500)
  }

  const revoke = async (id) => {
    if (!confirm('Revogar este convite?')) return
    try { await api.crm.revokeInvite(id); load() } catch (e) { alert(e.message) }
  }

  const changeRole = async (m, newRole) => {
    try { await api.crm.updateMember(m.operator_id, { role: newRole }); load() } catch (e) { alert(e.message) }
  }

  const toggleActive = async (m) => {
    try { await api.crm.updateMember(m.operator_id, { is_active: !m.is_active }); load() } catch (e) { alert(e.message) }
  }

  const roleBadge = (r) => (
    <span style={{ ...S.badge, background: r === 'admin' ? 'rgba(139,92,246,0.18)' : 'rgba(14,165,233,0.18)', color: r === 'admin' ? 'var(--text-purple)' : 'var(--nexus-cyan)' }}>
      {r === 'admin' ? 'Admin' : 'Atendente'}
    </span>
  )

  if (loading) return <div style={{ padding: 40, color: 'var(--text-secondary)' }}>Carregando equipe...</div>

  return (
    <div style={S.page}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={S.title}>👥 Equipe de Atendimento</h1>
        <p style={S.subtitle}>Convide sua equipe. Todos atendem pelo mesmo WhatsApp, cada um assinando com o próprio nome.</p>
      </div>

      {/* Convidar */}
      <div style={S.inviteCard}>
        <div style={{ fontWeight: 700, marginBottom: 10, color: 'var(--text-primary)' }}>Convidar pessoa</div>
        <div style={S.inviteRow}>
          <input placeholder="email@pessoa.com" value={email} onChange={e => setEmail(e.target.value)} style={S.input} />
          <select value={role} onChange={e => setRole(e.target.value)} style={S.select}>
            <option value="atendente">Atendente (só atende)</option>
            <option value="admin">Admin (configura tudo)</option>
          </select>
          <button onClick={invite} disabled={sending} style={S.btn}>Convidar</button>
        </div>
        <div style={S.hint}>Vamos gerar um link para você enviar. Se o e-mail estiver configurado, também enviamos por e-mail.</div>
      </div>

      {/* Convites pendentes */}
      {invites.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={S.sectionLabel}>Convites pendentes</div>
          {invites.map(inv => (
            <div key={inv.id} style={S.memberRow}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={S.memberName}>{inv.email}</div>
                <div style={S.memberSub}>Convidado · aguardando aceite</div>
              </div>
              {roleBadge(inv.role)}
              <button onClick={() => copyLink(inv)} style={S.ghostBtn}>{copied === inv.id ? '✓ Copiado' : 'Copiar link'}</button>
              <button onClick={() => revoke(inv.id)} style={S.dangerBtn}>Revogar</button>
            </div>
          ))}
        </div>
      )}

      {/* Membros */}
      <div style={S.sectionLabel}>Membros ({members.length})</div>
      {members.map(m => (
        <div key={m.operator_id} style={S.memberRow}>
          <div style={S.avatar}>{(m.display_name || '?')[0].toUpperCase()}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={S.memberName}>{m.display_name} {!m.is_active && <span style={{ color: 'var(--nexus-red)', fontSize: 11 }}>(inativo)</span>}</div>
            <div style={S.memberSub}>{m.email || 'sem e-mail vinculado'}</div>
          </div>
          <select value={m.role} onChange={e => changeRole(m, e.target.value)} style={{ ...S.select, maxWidth: 130 }}>
            <option value="atendente">Atendente</option>
            <option value="admin">Admin</option>
          </select>
          <button onClick={() => toggleActive(m)} style={S.ghostBtn}>{m.is_active ? 'Desativar' : 'Ativar'}</button>
        </div>
      ))}
    </div>
  )
}

const S = {
  page: { padding: '24px 28px', maxWidth: 860 },
  title: { fontSize: 24, fontWeight: 800, margin: 0, color: 'var(--text-primary)' },
  subtitle: { fontSize: 13, color: 'var(--text-secondary)', margin: '5px 0 0' },
  inviteCard: { background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)', borderRadius: 14, padding: 18, marginBottom: 24 },
  inviteRow: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  input: { flex: 1, minWidth: 200, background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: 10, padding: '10px 12px', fontSize: 13 },
  select: { background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: 10, padding: '10px 12px', fontSize: 13 },
  btn: { background: 'var(--gradient-purple)', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontWeight: 600, fontSize: 13, cursor: 'pointer' },
  hint: { fontSize: 11, color: 'var(--text-muted)', marginTop: 8 },
  sectionLabel: { fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-secondary)', margin: '0 0 10px' },
  memberRow: { display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '12px 14px', marginBottom: 8 },
  avatar: { width: 38, height: 38, borderRadius: 10, background: 'var(--gradient-purple)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 },
  memberName: { fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' },
  memberSub: { fontSize: 12, color: 'var(--text-secondary)' },
  badge: { fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 },
  ghostBtn: { background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border-default)', borderRadius: 8, padding: '7px 12px', fontSize: 12, cursor: 'pointer' },
  dangerBtn: { background: 'rgba(239,68,68,0.15)', color: 'var(--nexus-red)', border: 'none', borderRadius: 8, padding: '7px 12px', fontSize: 12, cursor: 'pointer' },
}
