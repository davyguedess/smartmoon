/** Página pública de aceite de convite — o convidado cria a senha e entra na equipe. */
import { useState, useEffect } from 'react'
import { api } from '../../api'

export default function AcceptInvite() {
  const [token, setToken] = useState('')
  const [info, setInfo] = useState(null)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token') || ''
    setToken(t)
    if (!t) { setError('Convite inválido.'); return }
    api.crm.inviteDetails(t)
      .then(d => setInfo(d))
      .catch(e => setError(e.message || 'Convite inválido ou expirado.'))
  }, [])

  const accept = async () => {
    if (name.trim().length < 2) return setError('Informe seu nome.')
    if (password.length < 6) return setError('A senha deve ter ao menos 6 caracteres.')
    setBusy(true); setError('')
    try {
      await api.crm.acceptInvite({ token, name: name.trim(), password })
      setDone(true)
    } catch (e) { setError(e.message) }
    setBusy(false)
  }

  return (
    <div style={S.wrap}>
      <div style={S.card}>
        <div style={S.logo}>🌙 Smart Moon</div>
        {done ? (
          <>
            <h2 style={S.h2}>Tudo certo! 🎉</h2>
            <p style={S.p}>Sua conta foi criada. Agora é só entrar para começar a atender.</p>
            <a href="/login" style={S.btn}>Ir para o login</a>
          </>
        ) : error && !info ? (
          <>
            <h2 style={S.h2}>Convite indisponível</h2>
            <p style={S.p}>{error}</p>
          </>
        ) : info ? (
          <>
            <h2 style={S.h2}>Você foi convidado(a)!</h2>
            <p style={S.p}>
              Para a equipe de <b style={{ color: 'var(--text-primary)' }}>{info.company}</b> como{' '}
              <b style={{ color: 'var(--text-purple)' }}>{info.role === 'admin' ? 'Admin' : 'Atendente'}</b>.
              <br /><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{info.email}</span>
            </p>
            <label style={S.label}>Seu nome</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Como você quer assinar" style={S.input} />
            <label style={S.label}>Crie uma senha</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="mínimo 6 caracteres" style={S.input} />
            {error && <div style={S.err}>{error}</div>}
            <button onClick={accept} disabled={busy} style={S.btn}>{busy ? 'Criando...' : 'Aceitar e criar conta'}</button>
          </>
        ) : (
          <p style={S.p}>Carregando convite...</p>
        )}
      </div>
    </div>
  )
}

const S = {
  wrap: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', padding: 20 },
  card: { width: 'min(420px, 100%)', background: 'var(--bg-panel)', border: '1px solid var(--border-default)', borderRadius: 18, padding: 32, boxShadow: 'var(--shadow-xl)' },
  logo: { fontWeight: 800, fontSize: 18, color: 'var(--text-primary)', marginBottom: 18 },
  h2: { fontSize: 22, fontWeight: 800, margin: '0 0 8px', color: 'var(--text-primary)' },
  p: { fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 18px' },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', margin: '12px 0 5px' },
  input: { width: '100%', background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: 10, padding: '11px 13px', fontSize: 14, boxSizing: 'border-box' },
  err: { color: 'var(--nexus-red)', fontSize: 13, marginTop: 12 },
  btn: { display: 'block', width: '100%', textAlign: 'center', textDecoration: 'none', marginTop: 18, background: 'var(--gradient-purple)', color: '#fff', border: 'none', borderRadius: 10, padding: '12px', fontWeight: 700, fontSize: 14, cursor: 'pointer', boxSizing: 'border-box' },
}
