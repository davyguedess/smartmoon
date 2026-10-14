/**
 * AdminSettingsPage — Platform configuration (SMTP + Terms + Identidade Visual)
 */
import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Mail, FileText, Save, TestTube, ToggleLeft, ToggleRight,
  CheckCircle, AlertTriangle, Eye, EyeOff, RefreshCw, Shield,
  ImagePlus, Building2, Upload, Trash2, LogOut, User, Clock,
} from 'lucide-react'
import { adminApi, api } from '../../api'

const sectionCard = {
  background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
  borderRadius: 14, overflow: 'hidden', marginBottom: 20,
}
const sectionHeader = (gradient) => ({
  padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12,
  borderBottom: '1px solid var(--border-subtle)',
  background: gradient,
})
const fLabel = { fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 5 }
const fInput = {
  width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 13,
  border: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)',
  color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box',
  transition: 'border-color 0.2s',
}

export default function AdminSettingsPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const fileRef = useRef(null)

  // SMTP
  const [smtp, setSmtp] = useState({
    smtp_enabled: 'false',
    smtp_host: '', smtp_port: '587',
    smtp_username: '', smtp_password: '',
    smtp_from_email: '', smtp_from_name: 'Smart Moon',
  })

  // Terms
  const [terms, setTerms] = useState({
    terms_of_service: '',
    privacy_policy: '',
  })

  // Brand / Identidade Visual
  const [brand, setBrand] = useState({
    platform_name: 'Smart Moon',
    logo_url: '',
    favicon_url: '',
    primary_color: '#ef4444',
  })
  const [logoPreview, setLogoPreview] = useState('')
  const [logoFile, setLogoFile] = useState(null)

  const [activeTab, setActiveTab] = useState('smtp') // 'smtp' | 'terms' | 'brand'

  // Load settings
  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const res = await adminApi.getSettings()
      const s = res.settings || {}
      setSmtp({
        smtp_enabled: s.smtp_enabled || 'false',
        smtp_host: s.smtp_host || '',
        smtp_port: s.smtp_port || '587',
        smtp_username: s.smtp_username || '',
        smtp_password: s.smtp_password || '',
        smtp_from_email: s.smtp_from_email || '',
        smtp_from_name: s.smtp_from_name || 'Smart Moon',
      })
      setTerms({
        terms_of_service: s.terms_of_service || '',
        privacy_policy: s.privacy_policy || '',
      })
      if (s.platform_name || s.logo_url) {
        setBrand({
          platform_name: s.platform_name || 'Smart Moon',
          logo_url: s.logo_url || '',
          favicon_url: s.favicon_url || '',
          primary_color: s.primary_color || '#ef4444',
        })
        if (s.logo_url) setLogoPreview(s.logo_url)
      }
    } catch (e) {
      setError(e?.message || 'Erro ao carregar configurações')
    }
    setLoading(false)
  }

  const handleLogoFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { setError('Logo muito grande (máx 2MB)'); return }
    setLogoFile(file)
    const reader = new FileReader()
    reader.onload = ev => setLogoPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  const handleSaveBrand = async () => {
    setSaving(true); setError(''); setSuccess('')
    try {
      const payload = { ...brand }
      if (logoFile) {
        // Envia como base64 data URL — backend salva como string em platform_settings
        payload.logo_url = logoPreview
      }
      await api.put('/admin/settings/brand', payload)
      setBrand(payload)
      if (logoFile) { setLogoFile(null) }
      setSuccess('Identidade visual salva com sucesso!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      setError(e?.response?.data?.detail || 'Erro ao salvar identidade visual')
    }
    setSaving(false)
  }

  const handleSaveSmtp = async () => {
    setSaving(true); setError(''); setSuccess('')
    try {
      await adminApi.updateSmtp(smtp)
      setSuccess('Configurações SMTP salvas com sucesso!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      setError(e?.message || 'Erro ao salvar SMTP')
    }
    setSaving(false)
  }

  const handleTestSmtp = async () => {
    setTesting(true); setError(''); setSuccess('')
    try {
      const res = await adminApi.testSmtp()
      setSuccess(res.message || 'E-mail de teste enviado!')
      setTimeout(() => setSuccess(''), 5000)
    } catch (e) {
      setError(e?.message || 'Erro ao testar SMTP')
    }
    setTesting(false)
  }

  const handleSaveTerms = async () => {
    setSaving(true); setError(''); setSuccess('')
    try {
      await adminApi.updateTerms(terms)
      setSuccess('Termos salvos com sucesso!')
      setTimeout(() => setSuccess(''), 3000)
    } catch (e) {
      setError(e?.message || 'Erro ao salvar termos')
    }
    setSaving(false)
  }

  const smtpEnabled = smtp.smtp_enabled === 'true'

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Carregando configurações...</div>
  }

  return (
    <div style={{ padding: 24, maxWidth: 800 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Configurações da Plataforma</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>
            SMTP, Termos de Uso e Política de Privacidade
          </p>
        </div>
        <button onClick={loadSettings} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px',
          background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
          borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)',
        }}>
          <RefreshCw size={12} />Recarregar
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10,
          background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', marginBottom: 16,
          color: '#ef4444', fontSize: 12, fontWeight: 600,
        }}>
          <AlertTriangle size={14} />
          {error}
          <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14 }}>×</button>
        </div>
      )}
      {success && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 10,
          background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', marginBottom: 16,
          color: '#22c55e', fontSize: 12, fontWeight: 600,
        }}>
          <CheckCircle size={14} />
          {success}
        </div>
      )}

      {/* Tab selector */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-card)', borderRadius: 10, padding: 4, border: '1px solid var(--border-subtle)' }}>
        {[
          { key: 'smtp', label: 'SMTP / E-mail', icon: Mail },
          { key: 'terms', label: 'Termos & Privacidade', icon: FileText },
          { key: 'brand', label: 'Identidade Visual', icon: ImagePlus },
          { key: 'account', label: 'Conta / Sessão', icon: User },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            padding: '10px 16px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', transition: 'all 0.2s',
            background: activeTab === tab.key ? (tab.key === 'account' ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.1)') : 'transparent',
            color: activeTab === tab.key ? '#ef4444' : 'var(--text-muted)',
          }}>
            <tab.icon size={14} />{tab.label}
          </button>
        ))}
      </div>

      {/* ══ SMTP SECTION ══ */}
      {activeTab === 'smtp' && (
        <div style={sectionCard}>
          <div style={sectionHeader('linear-gradient(135deg, rgba(239,68,68,0.04), rgba(245,158,11,0.04))')}>
            <Mail size={18} color="#ef4444" />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 800 }}>Configuração SMTP</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Confirmação de cadastro por e-mail</div>
            </div>
            {/* Toggle */}
            <button onClick={() => setSmtp(p => ({ ...p, smtp_enabled: p.smtp_enabled === 'true' ? 'false' : 'true' }))} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 8,
              border: `1px solid ${smtpEnabled ? 'rgba(34,197,94,0.3)' : 'var(--border-subtle)'}`,
              background: smtpEnabled ? 'rgba(34,197,94,0.08)' : 'var(--bg-elevated)',
              color: smtpEnabled ? '#22c55e' : 'var(--text-muted)',
              fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
            }}>
              {smtpEnabled ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
              {smtpEnabled ? 'ATIVADO' : 'DESATIVADO'}
            </button>
          </div>

          <div style={{ padding: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <div style={fLabel}>Host SMTP</div>
                <input value={smtp.smtp_host} onChange={e => setSmtp(p => ({ ...p, smtp_host: e.target.value }))}
                  placeholder="smtp.gmail.com" style={fInput}
                  onFocus={e => e.target.style.borderColor = '#ef4444'} onBlur={e => e.target.style.borderColor = 'var(--border-subtle)'}
                />
              </div>
              <div>
                <div style={fLabel}>Porta</div>
                <input value={smtp.smtp_port} onChange={e => setSmtp(p => ({ ...p, smtp_port: e.target.value }))}
                  placeholder="587" style={fInput}
                  onFocus={e => e.target.style.borderColor = '#ef4444'} onBlur={e => e.target.style.borderColor = 'var(--border-subtle)'}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              <div>
                <div style={fLabel}>Usuário / Login</div>
                <input value={smtp.smtp_username} onChange={e => setSmtp(p => ({ ...p, smtp_username: e.target.value }))}
                  placeholder="user@gmail.com" style={fInput}
                  onFocus={e => e.target.style.borderColor = '#ef4444'} onBlur={e => e.target.style.borderColor = 'var(--border-subtle)'}
                />
              </div>
              <div>
                <div style={fLabel}>Senha</div>
                <div style={{ position: 'relative' }}>
                  <input type={showPassword ? 'text' : 'password'}
                    value={smtp.smtp_password} onChange={e => setSmtp(p => ({ ...p, smtp_password: e.target.value }))}
                    placeholder="••••••••" style={{ ...fInput, paddingRight: 36 }}
                    onFocus={e => e.target.style.borderColor = '#ef4444'} onBlur={e => e.target.style.borderColor = 'var(--border-subtle)'}
                  />
                  <button onClick={() => setShowPassword(!showPassword)} style={{
                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4,
                  }}>
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
              <div>
                <div style={fLabel}>E-mail Remetente</div>
                <input value={smtp.smtp_from_email} onChange={e => setSmtp(p => ({ ...p, smtp_from_email: e.target.value }))}
                  placeholder="noreply@smartmoon.app" style={fInput}
                  onFocus={e => e.target.style.borderColor = '#ef4444'} onBlur={e => e.target.style.borderColor = 'var(--border-subtle)'}
                />
              </div>
              <div>
                <div style={fLabel}>Nome Remetente</div>
                <input value={smtp.smtp_from_name} onChange={e => setSmtp(p => ({ ...p, smtp_from_name: e.target.value }))}
                  placeholder="Smart Moon" style={fInput}
                  onFocus={e => e.target.style.borderColor = '#ef4444'} onBlur={e => e.target.style.borderColor = 'var(--border-subtle)'}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleSaveSmtp} disabled={saving} style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '11px', borderRadius: 10, border: 'none',
                background: saving ? '#4a4a6a' : '#ef4444',
                color: 'white', fontSize: 13, fontWeight: 700,
                cursor: saving ? 'not-allowed' : 'pointer',
                boxShadow: saving ? 'none' : '0 4px 16px rgba(239,68,68,0.3)',
              }}>
                <Save size={14} />{saving ? 'Salvando...' : 'Salvar SMTP'}
              </button>
              <button onClick={handleTestSmtp} disabled={testing || !smtpEnabled} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '11px 20px', borderRadius: 10,
                border: '1px solid rgba(239,68,68,0.3)',
                background: 'transparent',
                color: smtpEnabled ? '#ef4444' : 'var(--text-muted)',
                fontSize: 13, fontWeight: 700,
                cursor: (testing || !smtpEnabled) ? 'not-allowed' : 'pointer',
                opacity: smtpEnabled ? 1 : 0.5,
              }}>
                <TestTube size={14} />{testing ? 'Testando...' : 'Testar Conexão'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ TERMS SECTION ══ */}
      {activeTab === 'terms' && (
        <div style={sectionCard}>
          <div style={sectionHeader('linear-gradient(135deg, rgba(139,92,246,0.04), rgba(6,182,212,0.04))')}>
            <Shield size={18} color="#8b5cf6" />
            <div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>Termos de Uso & Política de Privacidade</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Exibidos na página de cadastro</div>
            </div>
          </div>

          <div style={{ padding: 20 }}>
            <div style={{ marginBottom: 20 }}>
              <div style={fLabel}>📜 Termos de Uso</div>
              <textarea
                value={terms.terms_of_service}
                onChange={e => setTerms(p => ({ ...p, terms_of_service: e.target.value }))}
                placeholder="Digite os termos de uso da plataforma..."
                rows={8}
                style={{
                  ...fInput, resize: 'vertical', fontFamily: 'Inter, sans-serif', lineHeight: 1.6,
                  minHeight: 140,
                }}
                onFocus={e => e.target.style.borderColor = '#8b5cf6'}
                onBlur={e => e.target.style.borderColor = 'var(--border-subtle)'}
              />
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                {terms.terms_of_service.length} caracteres
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={fLabel}>🔒 Política de Privacidade</div>
              <textarea
                value={terms.privacy_policy}
                onChange={e => setTerms(p => ({ ...p, privacy_policy: e.target.value }))}
                placeholder="Digite a política de privacidade..."
                rows={8}
                style={{
                  ...fInput, resize: 'vertical', fontFamily: 'Inter, sans-serif', lineHeight: 1.6,
                  minHeight: 140,
                }}
                onFocus={e => e.target.style.borderColor = '#06b6d4'}
                onBlur={e => e.target.style.borderColor = 'var(--border-subtle)'}
              />
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                {terms.privacy_policy.length} caracteres
              </div>
            </div>

            <button onClick={handleSaveTerms} disabled={saving} style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '11px', borderRadius: 10, border: 'none',
              background: saving ? '#4a4a6a' : 'linear-gradient(135deg, #8b5cf6, #06b6d4)',
              color: 'white', fontSize: 13, fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer',
              boxShadow: saving ? 'none' : '0 4px 16px rgba(139,92,246,0.3)',
            }}>
              <Save size={14} />{saving ? 'Salvando...' : 'Salvar Termos'}
            </button>
          </div>
        </div>
      )}

      {/* ══ BRAND / IDENTIDADE VISUAL ══ */}
      {activeTab === 'brand' && (
        <div style={sectionCard}>
          <div style={sectionHeader('linear-gradient(135deg, rgba(239,68,68,0.04), rgba(139,92,246,0.04))')}>
            <ImagePlus size={18} color="#ef4444" />
            <div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>Identidade Visual</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Logo, nome da plataforma e cor principal</div>
            </div>
          </div>

          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Upload de logo */}
            <div>
              <div style={fLabel}>Logo da Plataforma</div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div
                  onClick={() => fileRef.current?.click()}
                  style={{
                    width: 100, height: 100, borderRadius: 12,
                    border: logoPreview ? '2px solid rgba(239,68,68,0.4)' : '2px dashed var(--border-subtle)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'var(--bg-elevated)', flexShrink: 0, overflow: 'hidden', cursor: 'pointer',
                  }}
                >
                  {logoPreview ? (
                    <img src={logoPreview} alt="logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      <Upload size={22} style={{ display: 'block', margin: '0 auto 6px' }} />
                      <div style={{ fontSize: 10 }}>Clique para<br/>upload</div>
                    </div>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <input ref={fileRef} type="file" accept="image/png,image/svg+xml,image/jpeg,image/webp" hidden onChange={handleLogoFile} />
                  <button onClick={() => fileRef.current?.click()} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px',
                    border: '1px solid var(--border-subtle)', borderRadius: 8, cursor: 'pointer',
                    background: 'var(--bg-elevated)', color: 'var(--text-secondary)',
                    fontSize: 12, fontWeight: 600, marginBottom: 8, width: '100%', boxSizing: 'border-box',
                  }}>
                    <Upload size={14} /> Selecionar imagem (PNG / SVG / WebP · máx 2MB)
                  </button>
                  {logoFile && (
                    <div style={{ fontSize: 11, color: '#10b981', marginBottom: 8 }}>
                      ✅ {logoFile.name} — salve para aplicar
                    </div>
                  )}
                  {logoPreview && (
                    <button
                      onClick={() => { setLogoPreview(''); setLogoFile(null); setBrand(b => ({ ...b, logo_url: '' })) }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
                        border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, cursor: 'pointer',
                        background: 'rgba(239,68,68,0.06)', color: '#ef4444', fontSize: 11, fontWeight: 600,
                      }}
                    >
                      <Trash2 size={12} /> Remover logo
                    </button>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                    Recomendado: PNG transparente ou SVG · Mínimo 200×200px
                  </div>
                </div>
              </div>
            </div>

            {/* Nome + Cor */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <div style={fLabel}>Nome da Plataforma</div>
                <input
                  value={brand.platform_name}
                  onChange={e => setBrand(b => ({ ...b, platform_name: e.target.value }))}
                  placeholder="Smart Moon"
                  style={fInput}
                  onFocus={e => e.target.style.borderColor = '#ef4444'}
                  onBlur={e => e.target.style.borderColor = 'var(--border-subtle)'}
                />
              </div>
              <div>
                <div style={fLabel}>Cor Principal</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="color"
                    value={brand.primary_color}
                    onChange={e => setBrand(b => ({ ...b, primary_color: e.target.value }))}
                    style={{ width: 40, height: 38, borderRadius: 8, border: '1px solid var(--border-subtle)', padding: 2, cursor: 'pointer' }}
                  />
                  <input
                    value={brand.primary_color}
                    onChange={e => setBrand(b => ({ ...b, primary_color: e.target.value }))}
                    placeholder="#ef4444"
                    style={{ ...fInput, flex: 1 }}
                    onFocus={e => e.target.style.borderColor = '#ef4444'}
                    onBlur={e => e.target.style.borderColor = 'var(--border-subtle)'}
                  />
                </div>
              </div>
            </div>

            {/* Preview */}
            <div style={{
              padding: '16px 20px', borderRadius: 12,
              border: `1px solid ${brand.primary_color}30`,
              background: `${brand.primary_color}06`,
              display: 'flex', alignItems: 'center', gap: 14,
            }}>
              {logoPreview ? (
                <img src={logoPreview} alt="preview" style={{ width: 44, height: 44, objectFit: 'contain', borderRadius: 8 }} />
              ) : (
                <div style={{
                  width: 44, height: 44, borderRadius: 8,
                  background: `${brand.primary_color}20`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Building2 size={22} style={{ color: brand.primary_color }} />
                </div>
              )}
              <div>
                <div style={{ fontWeight: 800, fontSize: 16, color: brand.primary_color }}>
                  {brand.platform_name || 'Smart Moon'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Preview da identidade visual</div>
              </div>
            </div>

            <button onClick={handleSaveBrand} disabled={saving} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '11px', borderRadius: 10, border: 'none',
              background: saving ? '#4a4a6a' : '#ef4444',
              color: 'white', fontSize: 13, fontWeight: 700,
              cursor: saving ? 'not-allowed' : 'pointer',
              boxShadow: saving ? 'none' : '0 4px 16px rgba(239,68,68,0.3)',
            }}>
              <Save size={14} />{saving ? 'Salvando...' : 'Salvar Identidade Visual'}
            </button>
          </div>
        </div>
      )}

      {/* ══ ACCOUNT / LOGOUT SECTION ══ */}
      {activeTab === 'account' && (
        <div style={sectionCard}>
          <div style={sectionHeader('linear-gradient(135deg, rgba(239,68,68,0.06), rgba(239,68,68,0.02))')}>
            <User size={18} color="#ef4444" />
            <div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>Conta do Administrador</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sessão ativa e opções de saída</div>
            </div>
          </div>

          <div style={{ padding: 20 }}>
            {/* Session Info */}
            <div style={{
              padding: 16, borderRadius: 12,
              background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.1)',
              marginBottom: 20,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
                Informações da Sessão
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Shield size={14} color="#ef4444" />
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Nível de acesso:</span>
                  <span style={{
                    fontSize: 11, fontWeight: 800, color: '#ef4444',
                    background: 'rgba(239,68,68,0.1)', padding: '2px 10px', borderRadius: 20,
                  }}>SUPERADMIN</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Clock size={14} color="var(--text-muted)" />
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Sessão iniciada:</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>

            {/* Danger Zone */}
            <div style={{
              padding: 20, borderRadius: 12,
              background: 'rgba(239,68,68,0.03)',
              border: '1px solid rgba(239,68,68,0.15)',
            }}>
              <div style={{
                fontSize: 11, fontWeight: 800, color: '#ef4444',
                textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6,
              }}>
                ⚠️ Zona de Perigo
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, margin: '0 0 16px' }}>
                Ao encerrar a sessão, você será redirecionado para a tela de login do administrador.
                Todas as abas abertas do painel admin perderão o acesso.
              </p>
              <button
                onClick={async () => {
                  setLoggingOut(true)
                  try {
                    await api.post('/auth/logout')
                  } catch {}
                  localStorage.removeItem('token')
                  localStorage.removeItem('refresh_token')
                  localStorage.removeItem('admin_token')
                  sessionStorage.clear()
                  navigate('/admin/login', { replace: true })
                }}
                disabled={loggingOut}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  padding: '14px', borderRadius: 12, border: 'none',
                  background: loggingOut ? '#4a4a6a' : 'linear-gradient(135deg, #dc2626, #ef4444)',
                  color: 'white', fontSize: 14, fontWeight: 800, letterSpacing: 0.3,
                  cursor: loggingOut ? 'not-allowed' : 'pointer',
                  boxShadow: loggingOut ? 'none' : '0 6px 24px rgba(239,68,68,0.35)',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => { if (!loggingOut) e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)' }}
              >
                <LogOut size={18} />
                {loggingOut ? 'Encerrando sessão...' : 'Encerrar Sessão do Admin'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
