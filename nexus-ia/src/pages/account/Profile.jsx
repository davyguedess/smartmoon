/**
 * Profile.jsx — Smart Moon
 * Perfil do usuário + Chaves de API por módulo do plano
 * Providers filtrados pelo plano: se o módulo não está no plano, exibe badge de upgrade.
 */
import { useState, useEffect } from 'react'
import {
  User, Key, Shield, Save, Trash2, Eye, EyeOff,
  CheckCircle, Loader, Lock, ExternalLink, RefreshCw
} from 'lucide-react'
import { api } from '../../api'

// ── Catálogo completo de providers ────────────────────────────────────────────
// module: null → sempre disponível | module: 'X' → requer módulo X no plano
const ALL_PROVIDERS = [
  // ── IA / LLM ──────────────────────────────────────────────────────────────
  {
    category: '🤖 Inteligência Artificial',
    providers: [
      { id: 'openai',    label: 'OpenAI (GPT-4o)',       icon: '🧠', color: '#10a37f', placeholder: 'sk-...', module: null, docsUrl: 'https://platform.openai.com/api-keys' },
      { id: 'gemini',    label: 'Google Gemini',          icon: '🔷', color: '#4285f4', placeholder: 'AIza...', module: null, docsUrl: 'https://aistudio.google.com/app/apikey' },
      { id: 'claude',    label: 'Anthropic Claude',       icon: '🟣', color: '#7c3aed', placeholder: 'sk-ant-...', module: null, docsUrl: 'https://console.anthropic.com/' },
      { id: 'groq',      label: 'Groq (LLM rápido)',      icon: '⚡', color: '#f59e0b', placeholder: 'gsk_...', module: null, docsUrl: 'https://console.groq.com/keys' },
      { id: 'deepseek',  label: 'DeepSeek',               icon: '🔵', color: '#4d6bfe', placeholder: 'sk-...', module: null, docsUrl: 'https://platform.deepseek.com/api_keys' },
      { id: 'mistral',   label: 'Mistral AI',             icon: '🌊', color: '#ff7000', placeholder: 'API Key...', module: null, docsUrl: 'https://console.mistral.ai/api-keys/' },
      { id: 'together',  label: 'Together AI',            icon: '🔗', color: '#6c63ff', placeholder: 'API Key...', module: null, docsUrl: 'https://api.together.xyz/settings/api-keys' },
      { id: 'xai',       label: 'xAI (Grok)',             icon: '🌟', color: '#a78bfa', placeholder: 'xai-...', module: null, docsUrl: 'https://console.x.ai/' },
    ]
  },
  // ── Voz ───────────────────────────────────────────────────────────────────
  {
    category: '🎙️ Voz & Áudio',
    providers: [
      { id: 'elevenlabs', label: 'ElevenLabs (TTS)',    icon: '🎙️', color: '#e11d48', placeholder: 'API Key...', module: 'voz', docsUrl: 'https://elevenlabs.io/app/api-key' },
    ]
  },
  // ── Mensageria ────────────────────────────────────────────────────────────
  {
    category: '💬 Mensageria & Canais',
    providers: [
      { id: 'telegram',          label: 'Telegram Bot',              icon: '✈️', color: '#0088cc', placeholder: 'Bot Token...', module: 'telegram', docsUrl: 'https://t.me/BotFather' },
      { id: 'whatsapp_evo',      label: 'WhatsApp Evolution API',    icon: '💬', color: '#25d366', placeholder: 'API Key...', module: 'integracoes', docsUrl: 'https://doc.evolution-api.com/' },
      { id: 'whatsapp_zapi',     label: 'WhatsApp Z-API',            icon: '📲', color: '#128c7e', placeholder: 'Client Token...', module: 'integracoes', docsUrl: 'https://developer.z-api.io/' },
      { id: 'whatsapp_meta',     label: 'WhatsApp Meta Cloud (WABA)',icon: '🌐', color: '#1877f2', placeholder: 'Access Token...', module: 'integracoes', docsUrl: 'https://developers.facebook.com/docs/whatsapp/' },
    ]
  },
  // ── Google ────────────────────────────────────────────────────────────────
  {
    category: '☁️ Google Cloud & Workspace',
    providers: [
      { id: 'google_oauth',    label: 'Google OAuth2 (Calendar/Contacts)', icon: '🔑', color: '#ea4335', placeholder: 'Client Secret JSON...', module: 'integracoes', docsUrl: 'https://console.cloud.google.com/apis/credentials' },
      { id: 'google_sheets',   label: 'Google Sheets API',    icon: '📊', color: '#34a853', placeholder: 'Service Account JSON...', module: 'integracoes', docsUrl: 'https://console.cloud.google.com/' },
      { id: 'gmail',           label: 'Gmail (SMTP/API)',      icon: '📧', color: '#ea4335', placeholder: 'App Password ou OAuth...', module: 'integracoes', docsUrl: 'https://myaccount.google.com/apppasswords' },
    ]
  },
  // ── Pagamentos ────────────────────────────────────────────────────────────
  {
    category: '💳 Pagamentos',
    providers: [
      { id: 'mercadopago', label: 'Mercado Pago',     icon: '💳', color: '#009ee3', placeholder: 'Access Token...', module: 'integracoes', docsUrl: 'https://www.mercadopago.com.br/developers/pt/docs' },
      { id: 'stripe',      label: 'Stripe',            icon: '💰', color: '#635bff', placeholder: 'sk_live_...', module: 'integracoes', docsUrl: 'https://dashboard.stripe.com/apikeys' },
    ]
  },
  // ── CRM & Produtividade ────────────────────────────────────────────────────
  {
    category: '🗂️ CRM & Produtividade',
    providers: [
      { id: 'hubspot',  label: 'HubSpot CRM',    icon: '🧡', color: '#ff7a59', placeholder: 'API Key...', module: 'integracoes', docsUrl: 'https://developers.hubspot.com/' },
      { id: 'notion',   label: 'Notion',          icon: '📓', color: '#ffffff', placeholder: 'Integration Token...', module: 'integracoes', docsUrl: 'https://www.notion.so/my-integrations' },
      { id: 'github',   label: 'GitHub',          icon: '🐙', color: '#6e40c9', placeholder: 'ghp_...', module: 'integracoes', docsUrl: 'https://github.com/settings/tokens' },
    ]
  },
]

// ── ApiKeyRow ─────────────────────────────────────────────────────────────────
function ApiKeyRow({ provider, storedKeys, onSave, onDelete, locked }) {
  const [showInput, setShowInput] = useState(false)
  const [keyValue, setKeyValue] = useState('')
  const [visible, setVisible]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [deleting, setDeleting] = useState(false)

  const stored = storedKeys.find(k => k.provider === provider.id)
  const hasKey = stored?.has_key

  const save = async () => {
    if (!keyValue.trim()) return
    setSaving(true)
    try {
      await onSave(provider.id, keyValue.trim(), provider.label)
      setKeyValue(''); setShowInput(false)
    } finally { setSaving(false) }
  }

  const del = async () => {
    setDeleting(true)
    try { await onDelete(provider.id) }
    finally { setDeleting(false) }
  }

  return (
    <div style={{
      padding: '14px 16px',
      background: locked ? 'var(--bg-surface)' : 'var(--bg-card)',
      border: `1px solid ${hasKey ? provider.color + '40' : locked ? 'var(--border-subtle)' : 'var(--border-subtle)'}`,
      borderRadius: 12, marginBottom: 8, transition: 'all 0.2s',
      opacity: locked ? 0.65 : 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 20, width: 28, textAlign: 'center', flexShrink: 0 }}>{provider.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{provider.label}</div>
          <div style={{ fontSize: 11, color: locked ? 'var(--text-muted)' : hasKey ? provider.color : 'var(--text-muted)', marginTop: 2 }}>
            {locked
              ? '🔒 Disponível em planos superiores'
              : hasKey
              ? '✅ Chave configurada — usando sua conta'
              : '○ Sem chave — modo demonstração ativo'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          {!locked && (
            <>
              <a
                href={provider.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                title="Documentação"
                style={{
                  width: 30, height: 30, borderRadius: 6, display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
                  color: 'var(--text-muted)', textDecoration: 'none', cursor: 'pointer',
                }}
              >
                <ExternalLink size={11} />
              </a>
              {hasKey && (
                <button onClick={del} disabled={deleting} style={{
                  padding: '5px 10px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)',
                  background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: 11, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  {deleting ? <Loader size={10} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={10} />}
                  Remover
                </button>
              )}
              <button onClick={() => setShowInput(!showInput)} style={{
                padding: '5px 12px', borderRadius: 6, border: `1px solid ${provider.color}60`,
                background: `${provider.color}15`, color: provider.color, fontSize: 11,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <Key size={10} />
                {hasKey ? 'Atualizar' : 'Configurar'}
              </button>
            </>
          )}
          {locked && (
            <span style={{
              padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700,
              background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)',
              color: '#818cf8', display: 'flex', alignItems: 'center', gap: 4,
            }}>
              <Lock size={10} /> Upgrade
            </span>
          )}
        </div>
      </div>

      {showInput && !locked && (
        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              type={visible ? 'text' : 'password'}
              value={keyValue}
              onChange={e => setKeyValue(e.target.value)}
              placeholder={provider.placeholder}
              onKeyDown={e => e.key === 'Enter' && save()}
              style={{
                width: '100%', padding: '8px 36px 8px 12px', borderRadius: 8,
                border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)',
                color: 'var(--text-primary)', fontSize: 12, boxSizing: 'border-box',
                fontFamily: 'monospace',
              }}
            />
            <button onClick={() => setVisible(!visible)} style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0,
            }}>
              {visible ? <EyeOff size={12} /> : <Eye size={12} />}
            </button>
          </div>
          <button onClick={save} disabled={saving || !keyValue.trim()} style={{
            padding: '8px 14px', borderRadius: 8, border: 'none',
            background: provider.color, color: '#fff', fontSize: 12,
            cursor: saving || !keyValue.trim() ? 'not-allowed' : 'pointer',
            opacity: !keyValue.trim() ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 4,
          }}>
            {saving ? <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={12} />}
            Salvar
          </button>
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function Profile() {
  const [profile,    setProfile]    = useState(null)
  const [storedKeys, setStoredKeys] = useState([])
  const [userModules, setUserModules] = useState([])
  const [tab,        setTab]        = useState('profile')
  const [form,       setForm]       = useState({})
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [error,      setError]      = useState(null)
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [p, k, me] = await Promise.all([
          api.getProfile(),
          api.getApiKeys(),
          api.me().catch(() => ({ modules: [] })),
        ])
        setProfile(p)
        setForm({ name: p.name, ...p.profile })
        setStoredKeys(k)
        setUserModules(me?.modules || [])
      } catch { setError('Falha ao carregar perfil') }
      finally { setLoading(false) }
    }
    load()
  }, [])

  const saveProfile = async () => {
    setSaving(true); setSaved(false)
    try {
      await api.updateProfile(form)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch { setError('Erro ao salvar') }
    finally { setSaving(false) }
  }

  const handleSaveKey = async (provider, key, label) => {
    await api.saveApiKey(provider, key, label)
    const keys = await api.getApiKeys()
    setStoredKeys(keys)
  }

  const handleDeleteKey = async (provider) => {
    await api.deleteApiKey(provider)
    setStoredKeys(prev => prev.filter(k => k.provider !== provider))
  }

  const isModuleAllowed = (mod) => {
    if (!mod) return true            // module null = sempre disponível
    return userModules.includes(mod)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <Loader size={20} style={{ animation: 'spin 1s linear infinite', color: 'var(--nexus-violet)' }} />
    </div>
  )

  const totalProviders = ALL_PROVIDERS.flatMap(g => g.providers).length
  const configuredCount = storedKeys.filter(k => k.has_key).length

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', padding: '24px 20px', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>Perfil & Configurações</h1>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
          Gerencie suas informações pessoais e chaves de API
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border-subtle)' }}>
        {[
          { id: 'profile', label: 'Perfil', icon: User },
          { id: 'keys',    label: `Chaves de API (${configuredCount}/${totalProviders})`, icon: Key },
          { id: 'security',label: 'Segurança', icon: Shield },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)} style={{
            padding: '8px 16px', background: 'none',
            border: 'none', borderBottom: tab === id ? '2px solid var(--nexus-violet)' : '2px solid transparent',
            color: tab === id ? 'var(--nexus-violet)' : 'var(--text-muted)',
            fontWeight: tab === id ? 700 : 500, fontSize: 13, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s',
            marginBottom: -1,
          }}>
            <Icon size={13} />{label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#ef4444', fontSize: 12, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* ── Profile Tab ── */}
      {tab === 'profile' && profile && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Avatar area */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 20, padding: '16px 20px',
            background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border-subtle)',
            marginBottom: 8,
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: 'linear-gradient(135deg, var(--nexus-violet), var(--nexus-cyan))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, fontWeight: 900, color: '#fff', flexShrink: 0,
            }}>
              {(form.name || profile.email || '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{form.name || 'Usuário'}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{profile.email}</div>
              <div style={{ fontSize: 11, color: 'var(--nexus-violet)', fontWeight: 700, marginTop: 4 }}>
                {profile.role} · Empresa #{profile.company_id}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { key: 'name',  label: 'Nome Completo', placeholder: 'Seu nome completo' },
              { key: 'phone', label: 'Telefone',       placeholder: '+55 11 99999-9999' },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>{label}</label>
                <input
                  value={form[key] || ''}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>
            ))}
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Email</label>
            <input value={profile.email} disabled style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', color: 'var(--text-muted)', fontSize: 13, boxSizing: 'border-box', cursor: 'not-allowed' }} />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Bio</label>
            <textarea
              value={form.bio || ''}
              onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
              placeholder="Uma breve descrição sobre você..."
              rows={3}
              style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 8 }}>
            <button onClick={saveProfile} disabled={saving} style={{
              padding: '9px 20px', borderRadius: 8, border: 'none',
              background: saved ? 'var(--nexus-green)' : 'var(--nexus-violet)',
              color: '#fff', fontWeight: 700, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {saving ? <Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> : saved ? <CheckCircle size={13} /> : <Save size={13} />}
              {saved ? 'Salvo!' : 'Salvar Perfil'}
            </button>
          </div>
        </div>
      )}

      {/* ── API Keys Tab ── */}
      {tab === 'keys' && (
        <div>
          {/* Summary bar */}
          <div style={{
            display: 'flex', gap: 16, padding: '12px 18px', marginBottom: 20,
            background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-subtle)',
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: configuredCount > 0 ? 'var(--nexus-green)' : 'var(--text-muted)' }}>
                {configuredCount}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>APIs Configuradas</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--nexus-violet)' }}>{totalProviders}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Disponíveis</div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--nexus-cyan)' }}>{userModules.length}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Módulos do Plano</div>
            </div>
          </div>

          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
            As chaves são <strong>criptografadas no banco de dados</strong>. APIs com 🔒 exigem upgrade de plano para serem ativadas.
            Prioridade: banco → variável de ambiente (.env) → modo simulado.
          </p>

          {/* Grouped by category */}
          {ALL_PROVIDERS.map(group => (
            <div key={group.category} style={{ marginBottom: 24 }}>
              <div style={{
                fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)',
                marginBottom: 10, letterSpacing: 0.3,
              }}>
                {group.category}
              </div>
              {group.providers.map(p => (
                <ApiKeyRow
                  key={p.id}
                  provider={p}
                  storedKeys={storedKeys}
                  onSave={handleSaveKey}
                  onDelete={handleDeleteKey}
                  locked={!isModuleAllowed(p.module)}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── Security Tab ── */}
      {tab === 'security' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{
            padding: '16px 20px', background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)', borderRadius: 12,
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>🔐 Alterar Senha</div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 14px', lineHeight: 1.5 }}>
              Use uma senha forte com letras, números e caracteres especiais.
            </p>
            {[
              { id: 'currentPwd',  label: 'Senha atual', placeholder: '••••••••' },
              { id: 'newPwd',      label: 'Nova senha',  placeholder: '••••••••' },
              { id: 'confirmPwd',  label: 'Confirmar nova senha', placeholder: '••••••••' },
            ].map(({ id, label, placeholder }) => (
              <div key={id} style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 5 }}>{label}</label>
                <input
                  type="password"
                  placeholder={placeholder}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' }}
                />
              </div>
            ))}
            <button style={{
              padding: '9px 18px', borderRadius: 8, border: 'none',
              background: 'var(--nexus-violet)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Shield size={13} /> Alterar Senha
            </button>
          </div>

          <div style={{
            padding: '16px 20px', background: 'rgba(239,68,68,0.05)',
            border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12,
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#ef4444', marginBottom: 4 }}>⚠️ Encerrar Sessões</div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 14px', lineHeight: 1.5 }}>
              Encerra todas as sessões ativas em outros dispositivos.
            </p>
            <button style={{
              padding: '8px 16px', borderRadius: 8,
              border: '1px solid rgba(239,68,68,0.3)',
              background: 'rgba(239,68,68,0.1)', color: '#ef4444',
              fontWeight: 700, fontSize: 12, cursor: 'pointer',
            }}>
              Encerrar Outras Sessões
            </button>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
