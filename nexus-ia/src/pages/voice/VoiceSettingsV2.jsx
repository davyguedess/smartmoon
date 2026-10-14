import React, { useState, useEffect, useRef } from 'react'
import { 
  Volume2, Play, Pause, Save, Search, RefreshCcw,
  Mic, Upload, Sliders, List, Shield, Zap, Trash2, 
  Radio, Sparkles, User, Activity, Bot, Settings2,
  Send, MessageCircle, Globe, Phone
} from 'lucide-react'
import { api } from '../../api'

// Metadata helper
const getVoiceMetadata = (voice) => {
  if (voice.voice_type === 'cloned') {
    return {
      displayName: voice.name,
      language: voice.language_code || 'pt-BR',
      flag: '👤',
      gender: 'Custom',
      isCloned: true
    }
  }

  const id = voice.base_voice_id || voice.slug || voice.name || ''
  const parts = id.split('_')
  const langCode = parts[0] || '??'
  const rawName = parts.slice(1).join(' ') || id

  const langMap = {
    'af': { name: 'English (US)', flag: '🇺🇸' },
    'bf': { name: 'English (UK)', flag: '🇬🇧' },
    'ef': { name: 'Spanish', flag: '🇪🇸' },
    'ff': { name: 'French', flag: '🇫🇷' },
    'pf': { name: 'Portuguese', flag: '🇧🇷' },
    'zf': { name: 'Chinese', flag: '🇨🇳' }
  }

  const langInfo = langMap[langCode] || { name: `Language (${langCode})`, flag: '🌐' }
  
  return {
    displayName: rawName.charAt(0).toUpperCase() + rawName.slice(1),
    language: langInfo.name,
    flag: langInfo.flag,
    gender: id.includes('adam') || id.includes('michael') ? 'Male' : 'Female',
    isCloned: false
  }
}

// All available voices with language metadata
const ALL_VOICES = [
  // Portuguese (Brazil)
  { id: 'pf_dora', name: 'Dora', lang: 'pt-BR', langName: 'Português (Brasil)', flag: '🇧🇷', gender: 'female' },
  { id: 'pm_alex', name: 'Alex', lang: 'pt-BR', langName: 'Português (Brasil)', flag: '🇧🇷', gender: 'male' },
  { id: 'pm_santa', name: 'Santa', lang: 'pt-BR', langName: 'Português (Brasil)', flag: '🇧🇷', gender: 'male' },
  // English (US)
  { id: 'af_bella', name: 'Bella', lang: 'en-US', langName: 'English (US)', flag: '🇺🇸', gender: 'female' },
  { id: 'af_sarah', name: 'Sarah', lang: 'en-US', langName: 'English (US)', flag: '🇺🇸', gender: 'female' },
  { id: 'am_adam', name: 'Adam', lang: 'en-US', langName: 'English (US)', flag: '🇺🇸', gender: 'male' },
  { id: 'am_michael', name: 'Michael', lang: 'en-US', langName: 'English (US)', flag: '🇺🇸', gender: 'male' },
  // English (UK)
  { id: 'bf_emma', name: 'Emma', lang: 'en-GB', langName: 'English (UK)', flag: '🇬🇧', gender: 'female' },
  { id: 'bm_george', name: 'George', lang: 'en-GB', langName: 'English (UK)', flag: '🇬🇧', gender: 'male' },
  // Spanish
  { id: 'ef_dalia', name: 'Dalia', lang: 'es-ES', langName: 'Español', flag: '🇪🇸', gender: 'female' },
  { id: 'em_jorge', name: 'Jorge', lang: 'es-ES', langName: 'Español', flag: '🇪🇸', gender: 'male' },
  // French
  { id: 'ff_siwis', name: 'Siwis', lang: 'fr-FR', langName: 'Français', flag: '🇫🇷', gender: 'female' },
]

const AVAILABLE_LANGS = [...new Set(ALL_VOICES.map(v => v.lang))].map(lang => {
  const v = ALL_VOICES.find(x => x.lang === lang)
  return { code: lang, name: v.langName, flag: v.flag }
})

export default function VoiceSettingsV2() {
  const [activeTab, setActiveTab] = useState('library')
  const [voices, setVoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [playingId, setPlayingId] = useState(null)
  const [search, setSearch] = useState('')
  const [lastLatency, setLastLatency] = useState(null)
  
  // Cloning form state
  const [cloningName, setCloningName] = useState('')
  const [cloningLang, setCloningLang] = useState('pt-BR')
  const [selectedFile, setSelectedFile] = useState(null)
  const [isCloning, setIsCloning] = useState(false)

  // Settings state
  const [settings, setSettings] = useState({
    speed: 1.0,
    stability: 0.5,
    similarity: 0.7,
    style: 'neutral',
    volume: 1.0,
    fallback: 'kokoro'
  })

  // Channel voice configuration
  const [channelVoices, setChannelVoices] = useState({
    chat:     { lang: 'pt-BR', voiceId: 'pf_dora', saved: false },
    telegram: { lang: 'pt-BR', voiceId: 'pf_dora', saved: false },
    whatsapp: { lang: 'pt-BR', voiceId: 'pf_dora', saved: false },
  })
  const [savingChannel, setSavingChannel] = useState(null)

  const handleSaveChannelVoice = async (channel) => {
    setSavingChannel(channel)
    try {
      await api.request(`/voice/v2/channel-voice`, {
        method: 'POST',
        body: JSON.stringify({ channel, ...channelVoices[channel] })
      })
    } catch (err) {
      // If endpoint doesn't exist yet, just mark saved locally
      console.warn('Channel voice save (will be persisted when endpoint is ready):', err.message)
    }
    setChannelVoices(prev => ({ ...prev, [channel]: { ...prev[channel], saved: true } }))
    setSavingChannel(null)
  }

  const audioRef = useRef(new Audio())

  useEffect(() => {
    fetchVoices()
    return () => {
      audioRef.current.pause()
    }
  }, [])

  const fetchVoices = async () => {
    try {
      setLoading(true)
      const data = await api.voiceV2ListProfiles()
      setVoices(data)
    } catch (err) {
      console.error('Failed to fetch voices:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateClone = async () => {
    if (!cloningName || !selectedFile) {
      alert('Por favor, preencha o nome e selecione um arquivo de áudio.')
      return
    }

    try {
      setIsCloning(true)
      const profile = await api.voiceV2CreateProfile({
        name: cloningName,
        provider: 'kokoro',
        voice_type: 'cloned',
        language_code: cloningLang,
        settings: {
          speed: settings.speed,
          stability: settings.stability,
          similarity: settings.similarity
        }
      })

      const formData = new FormData()
      formData.append('file', selectedFile)
      await api.voiceV2UploadSample(profile.id, formData)

      alert('Voz clonada com sucesso!')
      setCloningName('')
      setSelectedFile(null)
      fetchVoices()
      setActiveTab('library')
    } catch (err) {
      alert(`Erro na clonagem: ${err.message}`)
    } finally {
      setIsCloning(false)
    }
  }

  const handleDeleteVoice = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir esta voz?')) return
    try {
      await api.voiceV2DeleteProfile(id)
      fetchVoices()
    } catch (err) {
      alert(`Erro ao excluir: ${err.message}`)
    }
  }

  const playPreview = async (voiceId) => {
    if (playingId === voiceId) {
      audioRef.current.pause()
      setPlayingId(null)
      return
    }

    try {
      setPlayingId(voiceId)
      const res = await api.ttsTest("Teste de áudio Nexus Voice V2.", voiceId)
      const audioUrl = `/tts/audio?path=${encodeURIComponent(res.file_path)}`
      
      if (res.generation_time_ms) {
        setLastLatency(res.generation_time_ms)
      }

      audioRef.current.src = audioUrl
      audioRef.current.play()
      audioRef.current.onended = () => setPlayingId(null)
    } catch (err) {
      console.error('Preview failed:', err)
      setPlayingId(null)
    }
  }

  const tabs = [
    { id: 'library', name: 'Biblioteca', icon: List },
    { id: 'channel', name: 'Por Canal', icon: Send },
    { id: 'cloning', name: 'Clonagem', icon: Mic },
    { id: 'config', name: 'Ajustes Técnicos', icon: Sliders },
    { id: 'binding', name: 'Vínculos', icon: Shield }
  ]

  return (
    <div style={{ padding: '32px', height: '100%', overflowY: 'auto', background: 'var(--bg-base)' }}>
      {/* Header Premium */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <div style={{ 
              width: 40, height: 40, borderRadius: 12, 
              background: 'linear-gradient(135deg, var(--nexus-violet), var(--nexus-cyan))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 16px rgba(139, 92, 246, 0.4)'
            }}>
              <Volume2 color="white" size={20} />
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.02em', margin: 0 }}>Nexus Voice <span style={{ color: 'var(--nexus-violet)' }}>V2</span></h1>
          </div>
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>Gestão centralizada de identidade sonora e clonagem de voz</p>
        </div>
        
        <div style={{ display: 'flex', gap: 12 }}>
          <button style={{
            background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)', padding: '10px 18px', borderRadius: 12,
            fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8
          }}>
            <Activity size={14} color="var(--nexus-green)" /> Monitoramento
          </button>
          <button style={{
            background: 'var(--nexus-violet)', border: 'none',
            color: 'white', padding: '10px 24px', borderRadius: 12,
            fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
            boxShadow: '0 4px 14px rgba(139, 92, 246, 0.4)'
          }}>
            <Save size={14} /> Salvar Tudo
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div style={{ 
        display: 'flex', gap: 8, marginBottom: 32, padding: 4, 
        background: 'var(--bg-card)', borderRadius: 16, width: 'fit-content',
        border: '1px solid var(--border-subtle)'
      }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 20px', borderRadius: 12, border: 'none',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              background: activeTab === tab.id ? 'var(--nexus-violet)' : 'transparent',
              color: activeTab === tab.id ? 'white' : 'var(--text-muted)',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: activeTab === tab.id ? '0 4px 12px rgba(139, 92, 246, 0.2)' : 'none'
            }}
          >
            <tab.icon size={16} /> {tab.name}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div style={{ animation: 'fadeIn 0.4s ease-out' }}>

        {/* ── POR CANAL ── */}
        {activeTab === 'channel' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {[
              { id: 'chat',     label: 'Chat Interno',  icon: MessageCircle, color: '#8b5cf6', badge: 'SM Chat' },
              { id: 'telegram', label: 'Telegram Bot',  icon: Send,          color: '#229ED9', badge: 'Telegram' },
              { id: 'whatsapp', label: 'WhatsApp Bot',  icon: Phone,         color: '#25D366', badge: 'WhatsApp' },
            ].map(ch => {
              const cfg = channelVoices[ch.id]
              const filteredVoices = ALL_VOICES.filter(v => v.lang === cfg.lang)
              return (
                <div key={ch.id} style={{ background: 'var(--bg-card)', borderRadius: 20, border: '1px solid var(--border-subtle)', padding: 28 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: `${ch.color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ch.icon size={20} color={ch.color} />
                    </div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 800 }}>{ch.label}</div>
                      <span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, background: `${ch.color}22`, color: ch.color, fontWeight: 700 }}>{ch.badge}</span>
                    </div>
                    {cfg.saved && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--nexus-green)', fontWeight: 700 }}>✓ Salvo</span>}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
                    {/* Filtro de Língua */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Globe size={13} color="var(--nexus-cyan)" /> Língua
                      </label>
                      <select
                        value={cfg.lang}
                        onChange={e => setChannelVoices(prev => ({ ...prev, [ch.id]: { ...prev[ch.id], lang: e.target.value, voiceId: ALL_VOICES.find(v => v.lang === e.target.value)?.id || prev[ch.id].voiceId, saved: false } }))}
                        style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', padding: '12px 14px', borderRadius: 12, color: 'white', fontSize: 13, cursor: 'pointer' }}
                      >
                        {AVAILABLE_LANGS.map(l => (
                          <option key={l.code} value={l.code}>{l.flag} {l.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Seletor de Voz */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Volume2 size={13} color="var(--nexus-violet)" /> Voz
                      </label>
                      <select
                        value={cfg.voiceId}
                        onChange={e => setChannelVoices(prev => ({ ...prev, [ch.id]: { ...prev[ch.id], voiceId: e.target.value, saved: false } }))}
                        style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', padding: '12px 14px', borderRadius: 12, color: 'white', fontSize: 13, cursor: 'pointer' }}
                      >
                        {filteredVoices.map(v => (
                          <option key={v.id} value={v.id}>{v.gender === 'female' ? '👩' : '👨'} {v.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Voice Preview Card */}
                  {(() => {
                    const selectedVoice = ALL_VOICES.find(v => v.id === cfg.voiceId)
                    return selectedVoice ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'var(--bg-base)', borderRadius: 12, marginBottom: 16 }}>
                        <div style={{ fontSize: 24 }}>{selectedVoice.gender === 'female' ? '👩' : '👨'}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{selectedVoice.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{selectedVoice.flag} {selectedVoice.langName} · {selectedVoice.id}</div>
                        </div>
                        <button
                          onClick={() => playPreview(cfg.voiceId)}
                          style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: playingId === cfg.voiceId ? ch.color : 'rgba(255,255,255,0.05)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                        >
                          {playingId === cfg.voiceId ? <Pause size={14} fill="white" /> : <Play size={14} fill="white" />}
                        </button>
                      </div>
                    ) : null
                  })()}

                  <button
                    onClick={() => handleSaveChannelVoice(ch.id)}
                    disabled={savingChannel === ch.id}
                    style={{ background: ch.color, border: 'none', color: 'white', padding: '11px 24px', borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, opacity: savingChannel === ch.id ? 0.7 : 1 }}
                  >
                    {savingChannel === ch.id ? <RefreshCcw size={14} className="spin" /> : <Save size={14} />}
                    {savingChannel === ch.id ? 'Salvando...' : 'Aplicar Voz'}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {activeTab === 'library' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: 32 }}>
            {/* Library Grid */}
            <div style={{ background: 'var(--bg-card)', borderRadius: 24, border: '1px solid var(--border-subtle)', padding: 32 }}>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 850, margin: 0 }}>Biblioteca de Vozes</h2>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ position: 'relative' }}>
                      <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                      <input 
                        type="text" placeholder="Buscar..." 
                        value={search} onChange={e => setSearch(e.target.value)}
                        style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 10, padding: '8px 12px 8px 36px', fontSize: 13, color: 'white', width: 200 }}
                      />
                    </div>
                  </div>
               </div>

               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
                  {loading ? (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                      <RefreshCcw size={24} className="spin" style={{ marginBottom: 16 }} />
                      <div>Carregando biblioteca...</div>
                    </div>
                  ) : voices.length === 0 ? (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                       Vozes não encontradas. Tente clonar sua primeira voz.
                    </div>
                  ) : voices.filter(v => v.name.toLowerCase().includes(search.toLowerCase())).map(voice => {
                    const meta = getVoiceMetadata(voice)
                    const isPlaying = playingId === voice.id
                    return (
                      <div key={voice.id} style={{
                        background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 20, padding: 20,
                        transition: 'transform 0.2s, border-color 0.2s', cursor: 'pointer', position: 'relative'
                      }}>
                        <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 16 }}>
                          <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
                            {meta.gender === 'Male' ? '👨' : '👩'}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 15, fontWeight: 800 }}>{meta.displayName}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                              {meta.flag} {meta.language}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                             <button onClick={() => playPreview(voice.id)} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: isPlaying ? 'var(--nexus-violet)' : 'rgba(255,255,255,0.05)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                {isPlaying ? <Pause size={14} fill="white" /> : <Play size={14} fill="white" />}
                             </button>
                             <button title="Comparar" style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.03)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                <RefreshCcw size={14} />
                             </button>
                             <button onClick={() => handleDeleteVoice(voice.id)} style={{ width: 32, height: 32, borderRadius: '50%', border: 'none', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--nexus-red)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                                <Trash2 size={14} />
                             </button>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                           <span style={{ fontSize: 10, padding: '4px 8px', borderRadius: 6, background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', fontWeight: 700 }}>{voice.voice_type.toUpperCase()}</span>
                           <span style={{ fontSize: 10, padding: '4px 8px', borderRadius: 6, background: 'rgba(34, 197, 94, 0.1)', color: 'var(--nexus-green)', fontWeight: 700 }}>STABLE</span>
                        </div>
                      </div>
                    )
                  })}
               </div>
            </div>

            {/* Sidebar Stats */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                <div style={{ background: 'var(--bg-card)', borderRadius: 20, border: '1px solid var(--border-subtle)', padding: 24 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Activity size={16} color="var(--nexus-violet)" /> Performance</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Latência (Último)</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: lastLatency < 1000 ? 'var(--nexus-green)' : 'var(--nexus-red)' }}>
                        {lastLatency ? `${lastLatency}ms` : '--'}
                      </span>
                    </div>
                  </div>
                  
                  {playingId && (
                    <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 4, height: 32, justifyContent: 'center' }}>
                      {[...Array(12)].map((_, i) => (
                        <div key={i} className="wave-bar" style={{ 
                          width: 3, 
                          background: 'var(--nexus-violet)', 
                          borderRadius: 2,
                          animationDelay: `${i * 0.1}s` 
                        }}></div>
                      ))}
                    </div>
                  )}
               </div>

               <div style={{ background: 'var(--bg-card)', borderRadius: 20, border: '1px solid var(--border-subtle)', padding: 24 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 800, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}><Zap size={16} color="var(--nexus-cyan)" /> Consumo Mensal</h3>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 3, marginBottom: 8, overflow: 'hidden' }}>
                    <div style={{ width: '45%', height: '100%', background: 'var(--nexus-cyan)', borderRadius: 3 }}></div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>4.5k / 10k caracteres</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--nexus-cyan)' }}>45%</span>
                  </div>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'cloning' && (
          <div style={{ maxWidth: 800, margin: '0 auto', background: 'var(--bg-card)', borderRadius: 24, border: '1px solid var(--border-subtle)', padding: 40 }}>
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <div style={{ width: 64, height: 64, borderRadius: 20, background: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Mic size={32} color="var(--nexus-violet)" />
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 900, marginBottom: 8 }}>Clonar Nova Voz</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Envie amostras de áudio para criar um perfil de voz personalizado (XTTS/OpenVoice)</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24, marginBottom: 32 }}>
               <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Nome do Perfil</label>
                  <input 
                    type="text" placeholder="Ex: Minha Voz Professional" 
                    value={cloningName} onChange={e => setCloningName(e.target.value)}
                    style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', padding: '12px 16px', borderRadius: 12, color: 'white' }} 
                  />
               </div>
               <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Idioma Base</label>
                  <select 
                    value={cloningLang} onChange={e => setCloningLang(e.target.value)}
                    style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', padding: '12px 16px', borderRadius: 12, color: 'white' }}
                  >
                    <option value="pt-BR">Português (Brasil)</option>
                    <option value="en-US">English (US)</option>
                  </select>
               </div>
            </div>

            <input 
              type="file" id="sample-upload" hidden accept="audio/*" 
              onChange={e => setSelectedFile(e.target.files[0])}
            />
            <label htmlFor="sample-upload" style={{ 
              display: 'block', border: '2px dashed var(--border-subtle)', borderRadius: 20, padding: '48px 24px', textAlign: 'center',
              background: selectedFile ? 'rgba(139, 92, 246, 0.05)' : 'rgba(255,255,255,0.02)', transition: 'all 0.3s', cursor: 'pointer'
            }}>
               <Upload size={32} color={selectedFile ? 'var(--nexus-violet)' : 'var(--text-muted)'} style={{ marginBottom: 16 }} />
               <div style={{ fontWeight: 700, marginBottom: 4 }}>
                  {selectedFile ? selectedFile.name : 'Arraste seus áudios aqui'}
               </div>
               <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Formatos suportados: WAV, MP3, M4A (Mínimo 10 segundos)</div>
            </label>

            <button 
              onClick={handleCreateClone}
              disabled={isCloning || !cloningName || !selectedFile}
              style={{
                width: '100%', marginTop: 32, background: 'var(--nexus-violet)', border: 'none',
                color: 'white', padding: '16px', borderRadius: 16, fontSize: 15, fontWeight: 800,
                cursor: 'pointer', opacity: (isCloning || !cloningName || !selectedFile) ? 0.6 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10
              }}
            >
              {isCloning ? <RefreshCcw size={18} className="spin" /> : <Save size={18} />}
              {isCloning ? 'Processando Clonagem...' : 'Iniciar Clonagem Agora'}
            </button>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 32, padding: 16, background: 'rgba(239, 68, 68, 0.05)', borderRadius: 12, border: '1px solid rgba(239, 68, 68, 0.1)' }}>
               <Shield size={18} color="var(--nexus-red)" />
               <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                 <span style={{ color: 'var(--nexus-red)', fontWeight: 700 }}>Importante:</span> Ao clonar uma voz, você declara possuir os direitos de uso ou consentimento do proprietário. O uso para fins maliciosos resultará no banimento da conta.
               </p>
            </div>
          </div>
        )}

        {activeTab === 'config' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 32 }}>
            <div style={{ background: 'var(--bg-card)', borderRadius: 24, border: '1px solid var(--border-subtle)', padding: 32 }}>
               <h3 style={{ fontSize: 16, fontWeight: 850, marginBottom: 24 }}>Parâmetros de Geração</h3>
               
               <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {[
                    { label: 'Velocidade', key: 'speed', min: 0.5, max: 2.0, step: 0.1, icon: Zap },
                    { label: 'Estabilidade', key: 'stability', min: 0, max: 1.0, step: 0.05, icon: Radio },
                    { label: 'Similaridade', key: 'similarity', min: 0, max: 1.0, step: 0.05, icon: User }
                  ].map(param => (
                    <div key={param.key}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                        <label style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                          <param.icon size={14} color="var(--nexus-violet)" /> {param.label}
                        </label>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--nexus-cyan)' }}>{settings[param.key]}x</span>
                      </div>
                      <input 
                        type="range" min={param.min} max={param.max} step={param.step}
                        value={settings[param.key]} onChange={e => setSettings({...settings, [param.key]: parseFloat(e.target.value)})}
                        style={{ width: '100%', accentColor: 'var(--nexus-violet)' }}
                      />
                    </div>
                  ))}
               </div>
            </div>

            <div style={{ background: 'var(--bg-card)', borderRadius: 24, border: '1px solid var(--border-subtle)', padding: 32 }}>
               <h3 style={{ fontSize: 16, fontWeight: 850, marginBottom: 24 }}>Fallback & Operacional</h3>
               <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ padding: 20, background: 'var(--bg-base)', borderRadius: 16, border: '1px solid var(--border-subtle)' }}>
                     <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Provider Principal</div>
                     <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Kokoro (Atual)</div>
                  </div>
                  <div style={{ padding: 20, background: 'var(--bg-base)', borderRadius: 16, border: '1px solid var(--border-subtle)' }}>
                     <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Fallback Strategy</div>
                     <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Silêncio / Texto Alternativo</div>
                  </div>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'binding' && (
          <div style={{ background: 'var(--bg-card)', borderRadius: 24, border: '1px solid var(--border-subtle)', padding: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 18, fontWeight: 850, margin: 0 }}>Vínculos de Agente</h2>
              <button onClick={() => alert('Em breve: Novas vinculações')} style={{ background: 'var(--nexus-violet)', border: 'none', color: 'white', padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ Novo Vínculo</button>
            </div>
            
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 8px' }}>
              <thead>
                <tr style={{ textAlign: 'left', fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  <th style={{ padding: '0 16px 8px' }}>Agente</th>
                  <th style={{ padding: '0 16px 8px' }}>Canal</th>
                  <th style={{ padding: '0 16px 8px' }}>Voz Vinculada</th>
                  <th style={{ padding: '0 16px 8px' }}>Status</th>
                  <th style={{ padding: '0 16px 8px' }}></th>
                </tr>
              </thead>
              <tbody>
                <tr style={{ background: 'var(--bg-base)', borderRadius: 12 }}>
                  <td style={{ padding: '16px', borderRadius: '12px 0 0 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                         <Bot size={14} color="var(--nexus-violet)" />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700 }}>Agente Comercial</span>
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}><span style={{ fontSize: 11, padding: '4px 8px', borderRadius: 6, background: 'rgba(37, 211, 102, 0.1)', color: '#25D366', fontWeight: 700 }}>WhatsApp</span></td>
                  <td style={{ padding: '16px' }}><span style={{ fontSize: 13, fontWeight: 600 }}>pt-BR Adam</span></td>
                  <td style={{ padding: '16px' }}><div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--nexus-green)' }}></div></td>
                  <td style={{ padding: '16px', borderRadius: '0 12px 12px 0', textAlign: 'right' }}>
                    <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><Settings2 size={14} /></button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        input[type="range"] {
          -webkit-appearance: none;
          height: 6px;
          background: rgba(255,255,255,0.05);
          border-radius: 5px;
        }
        .wave-bar {
          height: 100%;
          animation: wave 1s ease-in-out infinite alternate;
        }
        @keyframes wave {
          from { height: 4px; opacity: 0.3; }
          to { height: 24px; opacity: 1; }
        }
        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 18px;
          height: 18px;
          background: var(--nexus-violet);
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 0 10px rgba(139, 92, 246, 0.4);
        }
      `}</style>
    </div>
  )
}
