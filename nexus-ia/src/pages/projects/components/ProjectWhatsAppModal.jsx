import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom'
import { api } from '../../../api'
import {
  MessageSquare, X, Loader2, RefreshCw, CheckCircle2,
  Wifi, WifiOff, ChevronRight, Users, Link2, AlertCircle
} from 'lucide-react'

export default function ProjectWhatsAppModal({ project, onClose, onSaved }) {
  const [instances, setInstances] = useState([])
  const [selectedInstance, setSelectedInstance] = useState(null)
  const [groups, setGroups] = useState([])
  const [selectedGroup, setSelectedGroup] = useState(null)
  const [loadingInstances, setLoadingInstances] = useState(true)
  const [loadingGroups, setLoadingGroups] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [saved, setSaved] = useState(false)

  // Load instances on mount
  useEffect(() => {
    loadInstances()
    // Restore current link
    if (project.whatsapp_instance_id) {
      setSelectedInstance(project.whatsapp_instance_id)
      loadGroups(project.whatsapp_instance_id, true)
    }
  }, [])

  const loadInstances = async () => {
    setLoadingInstances(true)
    try {
      const data = await api.get('/connections/smartmoon/instances')
      setInstances(Array.isArray(data) ? data : [])
    } catch { setError('Erro ao carregar instâncias') }
    finally { setLoadingInstances(false) }
  }

  const loadGroups = async (instanceId, silent = false) => {
    if (!instanceId) return
    if (!silent) setGroups([])
    setLoadingGroups(true)
    setError(null)
    try {
      const data = await api.get(`/projects/${project.id}/whatsapp/groups?instance_id=${instanceId}`)
      const g = data.groups || []
      setGroups(g)
      // Auto-select current group if set
      if (project.whatsapp_group_id) {
        setSelectedGroup(g.find(x => x.jid === project.whatsapp_group_id) || null)
      }
      if (g.length === 0 && !silent) {
        setError('Nenhum grupo encontrado. Envie uma mensagem do grupo para a instância primeiro, ou aguarde o engine carregar.')
      }
    } catch { setError('Erro ao buscar grupos da instância') }
    finally { setLoadingGroups(false) }
  }

  const handleSelectInstance = (inst) => {
    setSelectedInstance(inst.id)
    setSelectedGroup(null)
    setGroups([])
    loadGroups(inst.id)
  }

  const handleSave = async () => {
    if (!selectedInstance) return
    setSaving(true); setError(null)
    try {
      await api.patch(`/projects/${project.id}/whatsapp/link`, {
        whatsapp_instance_id: selectedInstance,
        whatsapp_group_id: selectedGroup?.jid || null,
      })
      setSaved(true)
      setTimeout(() => { onSaved?.(); onClose() }, 1200)
    } catch (e) { setError(e.message || 'Erro ao salvar') }
    finally { setSaving(false) }
  }

  const s = (extra = {}) => ({
    style: { ...extra }
  })

  const connected = (inst) => inst.status === 'connected'

  return ReactDOM.createPortal(
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(2,6,23,0.9)', backdropFilter: 'blur(20px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 560, background: 'linear-gradient(160deg,#0d1424,#111827)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 24, boxShadow: '0 40px 100px rgba(0,0,0,0.8)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '22px 26px', borderBottom: '1px solid rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(16,185,129,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MessageSquare style={{ width: 18, height: 18, color: '#34d399' }} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9' }}>Vincular Grupo WhatsApp</div>
              <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{project.name}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid rgba(148,163,184,0.1)', background: 'rgba(148,163,184,0.05)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.15)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(148,163,184,0.05)'}>
            <X style={{ width: 16, height: 16, color: '#94a3b8' }} />
          </button>
        </div>

        <div style={{ padding: '24px 26px', display: 'flex', flexDirection: 'column', gap: 22 }}>

          {/* Step 1 — Choose instance */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, color: '#818cf8' }}>1</div>
              <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#64748b' }}>Escolha a instância WhatsApp</span>
            </div>

            {loadingInstances ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px', color: '#475569', fontSize: 13 }}>
                <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> Carregando instâncias...
              </div>
            ) : instances.length === 0 ? (
              <div style={{ padding: '14px', borderRadius: 12, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)', fontSize: 13, color: '#fbbf24' }}>
                Nenhuma instância SmartMoon encontrada. Conecte um número em Integrações primeiro.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {instances.map(inst => {
                  const isSelected = selectedInstance === inst.id
                  const isConn = connected(inst)
                  return (
                    <button key={inst.id} onClick={() => isConn && handleSelectInstance(inst)}
                      disabled={!isConn}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                        borderRadius: 13, border: `1.5px solid ${isSelected ? 'rgba(99,102,241,0.5)' : 'rgba(99,102,241,0.1)'}`,
                        background: isSelected ? 'rgba(99,102,241,0.1)' : 'rgba(15,23,42,0.6)',
                        cursor: isConn ? 'pointer' : 'not-allowed', opacity: isConn ? 1 : 0.45,
                        textAlign: 'left', width: '100%', transition: 'all 0.2s', fontFamily: 'inherit',
                      }}
                      onMouseEnter={e => { if (isConn && !isSelected) e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)' }}
                      onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = 'rgba(99,102,241,0.1)' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: isConn ? 'rgba(16,185,129,0.1)' : 'rgba(148,163,184,0.08)', border: `1px solid ${isConn ? 'rgba(16,185,129,0.25)' : 'rgba(148,163,184,0.12)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {isConn ? <Wifi style={{ width: 16, height: 16, color: '#34d399' }} /> : <WifiOff style={{ width: 16, height: 16, color: '#475569' }} />}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0' }}>{inst.label}</div>
                        <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{inst.display_phone || inst.instance_id}</div>
                      </div>
                      <div style={{ padding: '3px 8px', borderRadius: 8, fontSize: 10, fontWeight: 800, textTransform: 'uppercase', background: isConn ? 'rgba(16,185,129,0.1)' : 'rgba(148,163,184,0.08)', color: isConn ? '#34d399' : '#475569' }}>
                        {isConn ? 'Conectado' : inst.status}
                      </div>
                      {isSelected && <CheckCircle2 style={{ width: 16, height: 16, color: '#818cf8', flexShrink: 0 }} />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Step 2 — Choose group */}
          {selectedInstance && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, color: '#34d399' }}>2</div>
                  <span style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.09em', color: '#64748b' }}>Selecione o grupo</span>
                </div>
                <button onClick={() => loadGroups(selectedInstance)} disabled={loadingGroups}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}>
                  <RefreshCw style={{ width: 11, height: 11, animation: loadingGroups ? 'spin 1s linear infinite' : 'none' }} />
                  Atualizar
                </button>
              </div>

              {loadingGroups ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '20px', justifyContent: 'center', color: '#475569', fontSize: 13 }}>
                  <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                  Buscando grupos da instância...
                </div>
              ) : groups.length === 0 ? (
                <div style={{ padding: '16px', borderRadius: 13, background: 'rgba(15,23,42,0.5)', border: '1px dashed rgba(99,102,241,0.15)', textAlign: 'center' }}>
                  <AlertCircle style={{ width: 24, height: 24, color: '#334155', margin: '0 auto 8px' }} />
                  <div style={{ fontSize: 13, color: '#475569', fontWeight: 600, marginBottom: 6 }}>Nenhum grupo encontrado</div>
                  <div style={{ fontSize: 12, color: '#334155', lineHeight: 1.6 }}>
                    Para descobrir o grupo:<br />
                    1. Abra o grupo <strong style={{ color: '#64748b' }}>"MENAGER"</strong> no WhatsApp<br />
                    2. Envie qualquer mensagem para o número conectado<br />
                    3. Clique em <strong style={{ color: '#64748b' }}>Atualizar</strong>
                  </div>
                  <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 10, background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.1)', fontSize: 11, color: '#64748b', fontFamily: 'monospace' }}>
                    Ou cole o JID manualmente abaixo
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, maxHeight: 220, overflowY: 'auto', paddingRight: 2, scrollbarWidth: 'thin', scrollbarColor: 'rgba(99,102,241,0.2) transparent' }}>
                  {groups.map((g) => {
                    const isSel = selectedGroup?.jid === g.jid
                    return (
                      <button key={g.jid} onClick={() => setSelectedGroup(isSel ? null : g)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
                          borderRadius: 12, border: `1.5px solid ${isSel ? 'rgba(16,185,129,0.5)' : 'rgba(99,102,241,0.08)'}`,
                          background: isSel ? 'rgba(16,185,129,0.08)' : 'rgba(15,23,42,0.5)',
                          cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: 'inherit', transition: 'all 0.2s',
                        }}>
                        <div style={{ width: 34, height: 34, borderRadius: 10, background: isSel ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Users style={{ width: 15, height: 15, color: isSel ? '#34d399' : '#475569' }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: isSel ? '#e2e8f0' : '#94a3b8' }}>{g.name}</div>
                          <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#334155', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.jid}</div>
                        </div>
                        {g.size > 0 && <span style={{ fontSize: 11, color: '#475569', flexShrink: 0 }}>{g.size} membros</span>}
                        {isSel && <CheckCircle2 style={{ width: 15, height: 15, color: '#34d399', flexShrink: 0 }} />}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* Manual JID input */}
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, color: '#334155', marginBottom: 6, fontWeight: 600 }}>Ou cole o JID manualmente:</div>
                <input
                  placeholder="120363XXXXXX@g.us"
                  value={selectedGroup?.jid || ''}
                  onChange={e => setSelectedGroup(e.target.value ? { jid: e.target.value, name: e.target.value } : null)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', background: 'rgba(15,23,42,0.8)', border: '1.5px solid rgba(99,102,241,0.14)', borderRadius: 10, color: '#e2e8f0', fontSize: 12, fontFamily: 'monospace', outline: 'none' }}
                  onFocus={e => e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)'}
                  onBlur={e => e.currentTarget.style.borderColor = 'rgba(99,102,241,0.14)'}
                />
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', fontSize: 12, color: '#fbbf24', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <AlertCircle style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1 }} />
              {error}
            </div>
          )}

          {/* Current link status */}
          {project.whatsapp_group_id && (
            <div style={{ padding: '10px 14px', borderRadius: 10, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.15)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 8, color: '#34d399' }}>
              <Link2 style={{ width: 13, height: 13 }} />
              Grupo atual: <span style={{ fontFamily: 'monospace', color: '#64748b' }}>{project.whatsapp_group_id}</span>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
            <button onClick={onClose} style={{ padding: '10px 18px', borderRadius: 11, border: '1px solid rgba(148,163,184,0.1)', background: 'transparent', color: '#64748b', cursor: 'pointer', fontWeight: 600, fontSize: 13, fontFamily: 'inherit' }}>
              Cancelar
            </button>
            <button onClick={handleSave} disabled={!selectedInstance || saving}
              style={{ padding: '10px 22px', borderRadius: 11, border: 'none', background: saved ? 'linear-gradient(135deg,#10b981,#059669)' : 'linear-gradient(135deg,#10b981,#06b6d4)', color: '#fff', cursor: !selectedInstance || saving ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: 13, fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 7, opacity: !selectedInstance ? 0.5 : 1, boxShadow: '0 4px 16px rgba(16,185,129,0.35)' }}>
              {saving ? <Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
                : saved ? <CheckCircle2 style={{ width: 14, height: 14 }} />
                : <Link2 style={{ width: 14, height: 14 }} />}
              {saved ? 'Vinculado!' : saving ? 'Salvando...' : 'Vincular Grupo'}
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>,
    document.body
  )
}
