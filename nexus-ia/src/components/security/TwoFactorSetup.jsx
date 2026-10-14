/**
 * NEXUS.IA — Two-Factor Authentication Setup Component (TASK 7.4)
 *
 * Componente para configurar/gerenciar 2FA na conta do usuário.
 * Exibe QR Code, backup codes e permite ativar/desativar.
 *
 * Usado em: Settings → Segurança
 */
import { useState, useEffect, useCallback } from 'react'
import { api } from '../../api'

// ── Icons ───────────────────────────────────────────────────────────────────
const Icons = {
  shield: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  check: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>,
  copy: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>,
  lock: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  unlock: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>,
}

// ── Styles ───────────────────────────────────────────────────────────────────
const S = {
  card: {
    background: 'rgba(30,41,59,0.6)', backdropFilter: 'blur(12px)',
    border: '1px solid rgba(99,102,241,0.08)', borderRadius: 16, padding: 24,
  },
  btn: (c) => ({
    background: `${c}15`, color: c, border: `1px solid ${c}30`,
    padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700,
    cursor: 'pointer', transition: 'all 0.2s',
  }),
  input: {
    width: '100%', boxSizing: 'border-box',
    background: 'rgba(15,23,42,0.7)', border: '1px solid rgba(51,65,85,0.4)',
    borderRadius: 10, padding: '12px 14px', color: '#e2e8f0', fontSize: 14,
    outline: 'none', fontFamily: 'monospace', textAlign: 'center',
    letterSpacing: '8px', fontWeight: 700, fontSize: 24,
  },
}

export default function TwoFactorSetup() {
  const [status, setStatus] = useState(null) // {enabled, available, verified_at}
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState('idle')   // idle | setup | verify | done
  const [setupData, setSetupData] = useState(null) // {qr_code, backup_codes, otpauth_uri}
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [toast, setToast] = useState(null)
  const [copied, setCopied] = useState(false)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  // ── Load status ───────────────────────────────────────────────────────────
  const loadStatus = useCallback(async () => {
    try {
      const data = await api.get('/auth/2fa/status')
      setStatus(data)
    } catch (e) {
      showToast('Erro ao verificar status 2FA', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadStatus() }, [loadStatus])

  // ── Setup ─────────────────────────────────────────────────────────────────
  const handleSetup = async () => {
    setSubmitting(true)
    try {
      const data = await api.post('/auth/2fa/setup')
      setSetupData(data)
      setStep('setup')
    } catch (e) {
      showToast(e.message || 'Erro ao iniciar setup', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Verify ────────────────────────────────────────────────────────────────
  const handleVerify = async () => {
    if (code.length < 6) { showToast('Digite o código de 6 dígitos', 'warn'); return }
    setSubmitting(true)
    try {
      await api.post('/auth/2fa/verify', { code })
      setStep('done')
      showToast('2FA ativado com sucesso! 🎉')
      loadStatus()
    } catch (e) {
      showToast(e.message || 'Código inválido', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Disable ───────────────────────────────────────────────────────────────
  const handleDisable = async () => {
    const input = prompt('Digite o código 2FA atual para desativar:')
    if (!input) return
    try {
      await api.post('/auth/2fa/disable', { code: input })
      showToast('2FA desativado')
      setStep('idle')
      setSetupData(null)
      loadStatus()
    } catch (e) {
      showToast(e.message || 'Código inválido', 'error')
    }
  }

  // ── Copy helper ───────────────────────────────────────────────────────────
  const copyBackupCodes = () => {
    if (!setupData?.backup_codes) return
    navigator.clipboard.writeText(setupData.backup_codes.join('\n'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    showToast('Backup codes copiados!')
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return <div style={{ color: '#64748b', padding: 24 }}>Carregando...</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 540 }}>
      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999,
          background: toast.type === 'error' ? '#ef444420' : toast.type === 'warn' ? '#f59e0b20' : '#10b98120',
          color: toast.type === 'error' ? '#fca5a5' : toast.type === 'warn' ? '#fbbf24' : '#6ee7b7',
          border: `1px solid ${toast.type === 'error' ? '#ef444440' : toast.type === 'warn' ? '#f59e0b40' : '#10b98140'}`,
          padding: '12px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600,
          backdropFilter: 'blur(12px)',
        }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={S.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14,
            background: status?.enabled ? 'rgba(16,185,129,0.12)' : 'rgba(99,102,241,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: status?.enabled ? '#10b981' : '#6366f1',
          }}>
            {status?.enabled ? Icons.lock : Icons.unlock}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#e2e8f0' }}>
              Autenticação em Duas Etapas (2FA)
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              {status?.enabled
                ? `✅ Ativo desde ${new Date(status.verified_at).toLocaleDateString('pt-BR')}`
                : '⚠️ Desativado — sua conta está menos protegida'
              }
            </div>
          </div>
        </div>

        <div style={{
          padding: '12px 16px', borderRadius: 10, fontSize: 12, lineHeight: 1.6,
          background: status?.enabled ? 'rgba(16,185,129,0.05)' : 'rgba(245,158,11,0.05)',
          border: `1px solid ${status?.enabled ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)'}`,
          color: '#94a3b8',
        }}>
          {status?.enabled
            ? 'O 2FA adiciona uma camada extra de segurança. Ao realizar operações críticas como saques, você precisará digitar o código do seu app autenticador.'
            : 'Recomendamos ativar o 2FA para proteger sua conta contra acessos não autorizados e tentativas de saque indevidas.'
          }
        </div>

        <div style={{ marginTop: 16 }}>
          {status?.enabled ? (
            <button onClick={handleDisable} style={S.btn('#ef4444')}>
              {Icons.unlock} Desativar 2FA
            </button>
          ) : step === 'idle' ? (
            <button onClick={handleSetup} disabled={submitting} style={S.btn('#10b981')}>
              {submitting ? 'Gerando...' : '🔐 Ativar 2FA'}
            </button>
          ) : null}
        </div>
      </div>

      {/* Step: QR Code + Backup Codes */}
      {step === 'setup' && setupData && (
        <>
          {/* QR Code */}
          <div style={{ ...S.card, textAlign: 'center' }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#a78bfa', marginBottom: 8 }}>
              📱 Etapa 1: Escaneie o QR Code
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
              Abra o Google Authenticator (ou outro app TOTP) e escaneie o código abaixo.
            </div>
            <img
              src={setupData.qr_code}
              alt="QR Code 2FA"
              style={{
                width: 200, height: 200, borderRadius: 16, padding: 12,
                background: '#fff', display: 'inline-block',
                boxShadow: '0 4px 16px rgba(99,102,241,0.2)',
              }}
            />
            <div style={{
              marginTop: 12, fontSize: 10, color: '#475569',
              fontFamily: 'monospace', wordBreak: 'break-all',
            }}>
              {setupData.otpauth_uri}
            </div>
          </div>

          {/* Backup Codes */}
          <div style={{
            ...S.card,
            background: 'rgba(245,158,11,0.04)',
            border: '1px solid rgba(245,158,11,0.15)',
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#f59e0b', marginBottom: 8 }}>
              🔑 Etapa 2: Salve seus Backup Codes
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6, marginBottom: 12 }}>
              Se perder acesso ao app autenticador, use um destes códigos para entrar.
              <strong style={{ color: '#fbbf24' }}> Salve-os agora — não serão exibidos novamente!</strong>
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
              background: 'rgba(15,23,42,0.7)', borderRadius: 10, padding: 14,
              border: '1px solid rgba(51,65,85,0.3)',
            }}>
              {setupData.backup_codes.map((code, i) => (
                <div key={i} style={{
                  fontFamily: 'monospace', fontSize: 14, fontWeight: 700,
                  color: '#fbbf24', textAlign: 'center', padding: '6px 0',
                }}>
                  {code}
                </div>
              ))}
            </div>
            <button onClick={copyBackupCodes} style={{
              ...S.btn('#f59e0b'), marginTop: 12, display: 'flex',
              alignItems: 'center', gap: 6,
            }}>
              {copied ? Icons.check : Icons.copy} {copied ? 'Copiado!' : 'Copiar Códigos'}
            </button>
          </div>

          {/* Verify Code */}
          <div style={S.card}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#10b981', marginBottom: 8 }}>
              ✅ Etapa 3: Digite o código do app
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
              Abra o app autenticador e digite o código de 6 dígitos que aparece.
            </div>
            <input
              type="text"
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              style={S.input}
              autoComplete="one-time-code"
              inputMode="numeric"
            />
            <button
              onClick={handleVerify}
              disabled={submitting || code.length < 6}
              style={{
                ...S.btn('#10b981'),
                marginTop: 16, width: '100%',
                opacity: code.length < 6 ? 0.5 : 1,
              }}
            >
              {submitting ? 'Verificando...' : 'Ativar 2FA'}
            </button>
          </div>
        </>
      )}

      {/* Step: Done */}
      {step === 'done' && (
        <div style={{
          ...S.card, textAlign: 'center',
          background: 'rgba(16,185,129,0.05)',
          border: '1px solid rgba(16,185,129,0.2)',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 20, margin: '0 auto 16px',
            background: 'rgba(16,185,129,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#10b981', fontSize: 28,
          }}>
            🎉
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#10b981', marginBottom: 8 }}>
            2FA Ativado com Sucesso!
          </div>
          <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
            Sua conta agora está protegida com autenticação em duas etapas.
            Operações críticas como saques exigirão o código do app autenticador.
          </div>
        </div>
      )}
    </div>
  )
}
