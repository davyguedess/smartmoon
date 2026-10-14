import React, { useState } from 'react'
import ReactDOM from 'react-dom'
import { api } from '../../../api'
import { X, UserPlus, Phone, Trash2, Shield, User, Users, Loader2 } from 'lucide-react'

const COLORS = ['#6366f1','#ec4899','#10b981','#f59e0b','#06b6d4','#a855f7']

function Avatar({ name, index, size = 40 }) {
  const bg = COLORS[index % COLORS.length]
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: `linear-gradient(135deg, ${bg}cc, ${bg})`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 800, fontSize: size * 0.35, color: '#fff',
      flexShrink: 0, boxShadow: `0 0 0 2px #0f172a, 0 4px 12px ${bg}50`,
      letterSpacing: '0.02em',
    }}>
      {name.substring(0, 2).toUpperCase()}
    </div>
  )
}

function InputField({ icon: Icon, placeholder, value, onChange, type = 'text', required }) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ position: 'relative' }}>
      <Icon style={{
        position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
        width: 16, height: 16, color: focused ? '#818cf8' : '#475569', transition: 'color 0.2s',
        pointerEvents: 'none',
      }} />
      <input
        type={type} required={required} value={value} onChange={onChange}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: '12px 14px 12px 42px',
          background: focused ? 'rgba(99,102,241,0.06)' : 'rgba(15,23,42,0.8)',
          border: `1.5px solid ${focused ? 'rgba(99,102,241,0.5)' : 'rgba(99,102,241,0.12)'}`,
          borderRadius: 12, color: '#e2e8f0', fontSize: 14, outline: 'none',
          transition: 'all 0.2s', fontFamily: 'inherit',
          boxShadow: focused ? '0 0 0 3px rgba(99,102,241,0.1)' : 'none',
        }}
      />
    </div>
  )
}

export default function ProjectMembersModal({ projectId, members, onClose, onUpdate }) {
  const [loading, setLoading] = useState(false)
  const [removing, setRemoving] = useState(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [role, setRole] = useState('member')
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [roleFocused, setRoleFocused] = useState(false)

  const handleAdd = async (e) => {
    e.preventDefault()
    setLoading(true); setError(null); setSuccess(false)
    try {
      await api.post(`/projects/${projectId}/members`, { name, phone_number: phone, role })
      setName(''); setPhone(''); setRole('member')
      setSuccess(true)
      setTimeout(() => setSuccess(false), 2500)
      onUpdate()
    } catch (err) { setError(err.message || 'Erro ao adicionar membro') }
    finally { setLoading(false) }
  }

  const handleRemove = async (id) => {
    if (!window.confirm('Remover este membro?')) return
    setRemoving(id)
    try { await api.delete(`/projects/${projectId}/members/${id}`); onUpdate() }
    catch { alert('Erro ao remover membro') }
    finally { setRemoving(null) }
  }

  return ReactDOM.createPortal(
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999,
        background: 'rgba(2,6,23,0.88)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div style={{
        width: '100%', maxWidth: 560,
        background: 'linear-gradient(160deg, #0f172a 0%, #131c35 100%)',
        border: '1px solid rgba(99,102,241,0.22)',
        borderRadius: 24,
        boxShadow: '0 0 0 1px rgba(99,102,241,0.06), 0 40px 100px rgba(0,0,0,0.8), 0 0 80px rgba(99,102,241,0.07)',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        maxHeight: '88vh',
      }}>

        {/* Header */}
        <div style={{
          padding: '24px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid rgba(99,102,241,0.1)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 48, height: 48, borderRadius: 16, flexShrink: 0,
              background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.2))',
              border: '1px solid rgba(99,102,241,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 20px rgba(99,102,241,0.15)',
            }}>
              <Users style={{ width: 22, height: 22, color: '#818cf8' }} />
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.02em' }}>
                Gerenciar Equipe
              </div>
              <div style={{ fontSize: 12, color: '#475569', marginTop: 3, fontWeight: 500 }}>
                {members.length} {members.length === 1 ? 'membro' : 'membros'} no projeto
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 36, height: 36, borderRadius: 10, border: '1px solid rgba(148,163,184,0.12)',
              background: 'rgba(148,163,184,0.06)', cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(148,163,184,0.06)'; e.currentTarget.style.borderColor = 'rgba(148,163,184,0.12)' }}
          >
            <X style={{ width: 18, height: 18, color: '#94a3b8' }} />
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* Current members */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#475569', marginBottom: 14 }}>
              Membros Atuais
            </div>

            {members.length === 0 ? (
              <div style={{
                padding: '32px 20px', borderRadius: 16, textAlign: 'center',
                background: 'rgba(148,163,184,0.03)', border: '1px dashed rgba(148,163,184,0.1)',
              }}>
                <div style={{ width: 52, height: 52, borderRadius: 16, background: 'rgba(148,163,184,0.06)', margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users style={{ width: 24, height: 24, color: '#334155' }} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Nenhum membro ainda</div>
                <div style={{ fontSize: 12, color: '#334155' }}>Adicione membros abaixo para colaborar</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {members.map((member, i) => (
                  <div
                    key={member.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '14px 16px', borderRadius: 16,
                      background: 'rgba(15,23,42,0.6)',
                      border: '1px solid rgba(99,102,241,0.1)',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.25)'; e.currentTarget.style.background = 'rgba(99,102,241,0.05)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.1)'; e.currentTarget.style.background = 'rgba(15,23,42,0.6)' }}
                  >
                    <Avatar name={member.name} index={i} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {member.name}
                        </span>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 800,
                          textTransform: 'uppercase', letterSpacing: '0.06em', flexShrink: 0,
                          ...(member.role === 'admin'
                            ? { background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }
                            : { background: 'rgba(99,102,241,0.12)', color: '#818cf8', border: '1px solid rgba(99,102,241,0.2)' })
                        }}>
                          {member.role === 'admin' ? <Shield style={{ width: 9, height: 9 }} /> : <User style={{ width: 9, height: 9 }} />}
                          {member.role === 'admin' ? 'Admin' : 'Membro'}
                        </span>
                      </div>
                      {member.phone_number && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                          <Phone style={{ width: 11, height: 11, color: '#334155' }} />
                          <span style={{ fontSize: 11, color: '#475569', fontFamily: 'monospace' }}>{member.phone_number}</span>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleRemove(member.id)}
                      disabled={removing === member.id}
                      style={{
                        width: 34, height: 34, borderRadius: 10, cursor: 'pointer', flexShrink: 0,
                        background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.2)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)' }}
                    >
                      {removing === member.id
                        ? <Loader2 style={{ width: 14, height: 14, color: '#f87171', animation: 'spin 1s linear infinite' }} />
                        : <Trash2 style={{ width: 14, height: 14, color: '#f87171' }} />
                      }
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add form */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#475569', marginBottom: 14 }}>
              Adicionar Membro
            </div>

            <form onSubmit={handleAdd}>
              <div style={{
                padding: '20px', borderRadius: 18,
                background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.1)',
                display: 'flex', flexDirection: 'column', gap: 16,
              }}>
                {error && (
                  <div style={{ padding: '12px 16px', borderRadius: 12, fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                    <X style={{ width: 14, height: 14, flexShrink: 0 }} /> {error}
                  </div>
                )}
                {success && (
                  <div style={{ padding: '12px 16px', borderRadius: 12, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#34d399' }}>
                    ✓ Membro adicionado com sucesso!
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                    Nome Completo
                  </label>
                  <InputField icon={User} placeholder="Ex: João Silva" value={name} onChange={e => setName(e.target.value)} required />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                      WhatsApp
                    </label>
                    <InputField icon={Phone} placeholder="5511999999999" value={phone} onChange={e => setPhone(e.target.value)} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                      Função
                    </label>
                    <div style={{ position: 'relative' }}>
                      <Shield style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 16, height: 16, color: roleFocused ? '#818cf8' : '#475569', pointerEvents: 'none', transition: 'color 0.2s' }} />
                      <select
                        value={role} onChange={e => setRole(e.target.value)}
                        onFocus={() => setRoleFocused(true)} onBlur={() => setRoleFocused(false)}
                        style={{
                          width: '100%', boxSizing: 'border-box', padding: '12px 14px 12px 42px',
                          background: roleFocused ? 'rgba(99,102,241,0.06)' : 'rgba(15,23,42,0.8)',
                          border: `1.5px solid ${roleFocused ? 'rgba(99,102,241,0.5)' : 'rgba(99,102,241,0.12)'}`,
                          borderRadius: 12, color: '#e2e8f0', fontSize: 14, outline: 'none',
                          appearance: 'none', cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        <option value="member">Membro</option>
                        <option value="admin">Administrador</option>
                      </select>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  style={{
                    width: '100%', padding: '14px', borderRadius: 14, border: 'none', cursor: loading ? 'wait' : 'pointer',
                    background: loading ? 'rgba(99,102,241,0.4)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    color: '#fff', fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    boxShadow: loading ? 'none' : '0 4px 20px rgba(99,102,241,0.4)',
                    transition: 'all 0.2s', fontFamily: 'inherit', letterSpacing: '0.01em',
                  }}
                  onMouseEnter={e => { if (!loading) e.currentTarget.style.boxShadow = '0 8px 28px rgba(99,102,241,0.55)' }}
                  onMouseLeave={e => { if (!loading) e.currentTarget.style.boxShadow = '0 4px 20px rgba(99,102,241,0.4)' }}
                >
                  {loading ? <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} /> : <UserPlus style={{ width: 16, height: 16 }} />}
                  {loading ? 'Adicionando...' : 'Adicionar ao Projeto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>,
    document.body
  )
}
