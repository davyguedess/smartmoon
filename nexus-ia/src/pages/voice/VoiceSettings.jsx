import React, { useState, useEffect, useRef } from 'react'
import { 
  Volume2, Play, Pause, Check, Info, Settings, 
  Languages, User, RefreshCcw, Save, Search, Wifi, WifiOff, Zap
} from 'lucide-react'
import { api } from '../../api'

// Helper to get friendly names for Kokoro voices
const getVoiceMetadata = (id) => {
  const parts = id.split('_')
  const langCode = parts[0] || '??'
  const rawName = parts.slice(1).join(' ') || id

  const langMap = {
    'af': { name: 'English (US)', flag: '🇺🇸' },
    'bf': { name: 'English (UK)', flag: '🇬🇧' },
    'am': { name: 'English (US - Alt)', flag: '🇺🇸' },
    'bm': { name: 'English (UK - Alt)', flag: '🇬🇧' },
    'ef': { name: 'Spanish', flag: '🇪🇸' },
    'ff': { name: 'French', flag: '🇫🇷' },
    'hf': { name: 'Hindi', flag: '🇮🇳' },
    'if': { name: 'Italian', flag: '🇮🇹' },
    'jf': { name: 'Japanese', flag: '🇯🇵' },
    'pf': { name: 'Portuguese', flag: '🇧🇷' },
    'zf': { name: 'Chinese', flag: '🇨🇳' }
  }

  const langInfo = langMap[langCode] || { name: `Language (${langCode})`, flag: '🌐' }
  
  return {
    displayName: rawName.charAt(0).toUpperCase() + rawName.slice(1),
    language: langInfo.name,
    flag: langInfo.flag,
    gender: id.includes('adam') || id.includes('michael') ? 'Male' : 'Female'
  }
}

export default function VoiceSettings() {
  const [voices, setVoices] = useState([])
  const [config, setConfig] = useState(null)
  const [providerStatus, setProviderStatus] = useState(null) // {kokoro, piper, openai, active}
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [selectedVoice, setSelectedVoice] = useState('af_heart')
  const [playingId, setPlayingId] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [selectedLang, setSelectedLang] = useState('all')
  const [saveStatus, setSaveStatus] = useState(null)

  // OpenAI fallback voices shown when Kokoro is offline
  const OPENAI_FALLBACK_VOICES = ['nova', 'alloy', 'echo', 'fable', 'onyx', 'shimmer']

  const audioRef = useRef(new Audio())

  useEffect(() => {
    fetchData()
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [voicesList, currentConfig, status] = await Promise.all([
        api.ttsGetVoices(),
        api.ttsGetConfig(),
        fetch('/tts/status').then(r => r.json()).catch(() => null),
      ])

      setProviderStatus(status)

      const voiceArray = Array.isArray(voicesList)
        ? voicesList
        : (voicesList.voices || Object.keys(voicesList))

      // If Kokoro is offline but we got no voices, show OpenAI fallback voices
      if (voiceArray.length === 0 && status?.openai === 'configured') {
        setVoices(OPENAI_FALLBACK_VOICES)
      } else {
        setVoices(voiceArray)
      }

      setConfig(currentConfig)
      setSelectedVoice(currentConfig.default_voice || 'af_heart')
      setError(null) // Clear previous errors
    } catch (err) {
      console.error('Error fetching voice data:', err)
      setError('Serviço de voz temporariamente indisponível.')
      // Use OpenAI voices as fallback display
      setVoices(OPENAI_FALLBACK_VOICES)
    } finally {
      setLoading(false)
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
      const meta = getVoiceMetadata(voiceId)
      const testTexts = {
        'Portuguese': 'Olá! Eu sou sua nova assistente virtual no Smart Moon. Como posso ajudar você hoje?',
        'Spanish': '¡Hola! Soy tu nueva asistente virtual en Smart Moon. ¿Cómo posso ajudarte hoy?',
        'French': 'Bonjour! Je suis votre nouvel assistant virtuel chez Smart Moon. Comment puis-je vous aider aujourd\'hui?',
        'English (US)': 'Hello! I am your new virtual assistant at Smart Moon. How can I help you today?',
        'English (UK)': 'Hello! I am your new virtual assistant at Smart Moon. How can I help you today?'
      }
      const text = testTexts[meta.language] || `Hello! I am ${meta.displayName}. This is a voice test for Smart Moon.`
      
      const result = await api.ttsTest(text, voiceId)
      const audioUrl = `/tts/audio?path=${encodeURIComponent(result.file_path)}`
      
      if (audioRef.current) {
        audioRef.current.src = audioUrl
        audioRef.current.play()
        audioRef.current.onended = () => setPlayingId(null)
      }
    } catch (err) {
      console.error('Preview failed:', err)
      setPlayingId(null)
    }
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      setSaveStatus(null)
      await api.ttsUpdateConfig(selectedVoice)
      setSaveStatus({ type: 'success', message: 'Configuração de voz atualizada com sucesso!' })
      setConfig(prev => ({ ...prev, default_voice: selectedVoice }))
      setTimeout(() => setSaveStatus(null), 3000)
    } catch (err) {
      console.error('Save failed:', err)
      setSaveStatus({ type: 'error', message: 'Falha ao salvar configuração: ' + err.message })
    } finally {
      setIsSaving(false)
    }
  }

  const languages = ['all', ...new Set(voices.map(v => getVoiceMetadata(v).language))].sort()

  const filteredVoices = voices.filter(v => {
    const meta = getVoiceMetadata(v)
    const matchesSearch = v.toLowerCase().includes(search.toLowerCase()) || 
                         meta.language.toLowerCase().includes(search.toLowerCase())
    const matchesLang = selectedLang === 'all' || meta.language === selectedLang
    
    return matchesSearch && matchesLang
  })

  if (loading) {
    return (
      <div style={{ padding: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 20 }}>
        <RefreshCcw className="animate-spin" size={32} color="var(--nexus-violet)" />
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>Sincronizando vozes...</div>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 32px', height: '100%', overflowY: 'auto' }}>
      {/* Header Area */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Voz da IA</h1>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Configure a personalidade sonora do Smart Moon</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          style={{
            background: 'var(--nexus-violet)', color: 'white', border: 'none',
            padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
            opacity: isSaving ? 0.7 : 1, boxShadow: '0 4px 12px rgba(139, 92, 246, 0.3)'
          }}
        >
          {isSaving ? <RefreshCcw size={14} className="animate-spin" /> : <Save size={14} />}
          {isSaving ? 'Salvando...' : 'Salvar Configurações'}
        </button>
      </div>

      {/* Provider Status Banner */}
      {providerStatus && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
          borderRadius: 12, marginBottom: 20,
          background: providerStatus.active === 'none'
            ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.08)',
          border: `1px solid ${providerStatus.active === 'none' ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
        }}>
          {providerStatus.active === 'none'
            ? <WifiOff size={16} color="#ef4444" />
            : <Wifi size={16} color="#10b981" />}
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: providerStatus.active === 'none' ? '#ef4444' : '#10b981' }}>
              {providerStatus.active === 'none' ? '🔴 Nenhum provider online' :
               providerStatus.active === 'kokoro' ? '🟢 Kokoro TTS — Online' :
               providerStatus.active === 'openai' ? '🟡 OpenAI TTS (fallback ativo)' : '🟢 Online'}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 12 }}>
              {[  
                providerStatus.kokoro === 'online' ? 'Kokoro ✓' : null,
                providerStatus.openai === 'configured' ? 'OpenAI ✓' : null,
                providerStatus.piper === 'online' ? 'Piper ✓' : null,
              ].filter(Boolean).join(' · ')}
            </span>
          </div>
          <button onClick={fetchData} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <RefreshCcw size={13} />
          </button>
        </div>
      )}

      {error ? (
        <div style={{ 
          background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--nexus-red)', 
          padding: 16, borderRadius: 12, color: 'var(--nexus-red)', fontSize: 14, 
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24
        }}>
          <Info size={18} />
          {error}
        </div>
      ) : null}

      {saveStatus && (
        <div style={{ 
          background: saveStatus.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', 
          border: `1px solid ${saveStatus.type === 'success' ? 'var(--nexus-green)' : 'var(--nexus-red)'}`, 
          padding: 16, borderRadius: 12, 
          color: saveStatus.type === 'success' ? 'var(--nexus-green)' : 'var(--nexus-red)', 
          fontSize: 14, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24,
          animation: 'fadeIn 0.3s ease-out'
        }}>
          {saveStatus.type === 'success' ? <Check size={18} /> : <Info size={18} />}
          {saveStatus.message}
        </div>
      )}

      {/* Stats/Status Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, marginBottom: 32 }}>
        <div style={{ background: 'var(--bg-card)', padding: 20, borderRadius: 16, border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Volume2 size={18} color="var(--nexus-violet)" />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Configuração Atual</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{config?.default_voice || selectedVoice}</div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Provedor: <span style={{ color: 'var(--nexus-cyan)', fontWeight: 600 }}>{config?.primary_provider?.toUpperCase() || 'KOKORO'}</span></div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: 20, borderRadius: 16, border: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(34, 197, 94, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Languages size={18} color="var(--nexus-green)" />
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Idiomas Disponíveis</div>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{languages.length - 1} Idiomas</div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Vozes totais: <span style={{ color: 'var(--nexus-green)', fontWeight: 600 }}>{voices.length}</span></div>
        </div>
      </div>

      {/* Language Filter Pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
        {languages.map(lang => (
          <button
            key={lang}
            onClick={() => setSelectedLang(lang)}
            style={{
              padding: '6px 14px',
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              border: lang === selectedLang ? '1px solid var(--nexus-violet)' : '1px solid var(--border-subtle)',
              background: lang === selectedLang ? 'rgba(139, 92, 246, 0.1)' : 'var(--bg-card)',
              color: lang === selectedLang ? 'var(--nexus-violet)' : 'var(--text-muted)',
              transition: 'all 0.2s'
            }}
          >
            {lang === 'all' ? 'Todos os Idiomas' : lang}
          </button>
        ))}
      </div>

      {/* Voice Selection Area */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 24, border: '1px solid var(--border-subtle)', padding: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800 }}>Vozes Disponíveis</h2>
          <div style={{ position: 'relative' }}>
            <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input 
              type="text" 
              placeholder="Buscar voz..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                background: 'var(--bg-base)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 10,
                padding: '8px 12px 8px 36px',
                fontSize: 13,
                color: 'var(--text-primary)',
                width: 260
              }}
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
          {filteredVoices.map(voiceId => {
            const meta = getVoiceMetadata(voiceId)
            const isSelected = selectedVoice === voiceId
            const isPlaying = playingId === voiceId

            return (
              <div 
                key={voiceId}
                onClick={() => setSelectedVoice(voiceId)}
                style={{
                  background: isSelected ? 'rgba(139, 92, 246, 0.05)' : 'var(--bg-base)',
                  border: isSelected ? '2px solid var(--nexus-violet)' : '1px solid var(--border-subtle)',
                  borderRadius: 20,
                  padding: 20,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {isSelected && (
                  <div style={{ position: 'absolute', top: 12, right: 12, background: 'var(--nexus-violet)', color: 'white', width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Check size={12} strokeWidth={4} />
                  </div>
                )}

                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 16,
                    background: isSelected ? 'var(--nexus-violet)' : 'var(--bg-card)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 24, boxShadow: isSelected ? '0 8px 20px rgba(139, 92, 246, 0.3)' : 'none'
                  }}>
                    {meta.gender === 'Male' ? '👨' : '👩'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)' }}>{meta.displayName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>{meta.flag}</span>
                      <span>{meta.language}</span>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation()
                      playPreview(voiceId)
                    }}
                    style={{
                      flex: 1,
                      background: isPlaying ? 'var(--nexus-cyan)' : 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 10,
                      padding: '8px 0',
                      fontSize: 12,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      color: isPlaying ? 'white' : 'var(--text-primary)',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                  >
                    {isPlaying ? <Pause size={14} fill="white" /> : <Play size={14} fill={isSelected ? "var(--nexus-violet)" : "var(--text-muted)"} />}
                    {isPlaying ? 'Parar' : 'Ouvir Demo'}
                  </button>
                  
                  <div style={{
                    padding: '8px 12px', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 10,
                    fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {meta.gender.toUpperCase()}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {filteredVoices.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <Search size={40} style={{ marginBottom: 16, opacity: 0.2 }} />
            <div>Nenhuma voz encontrada para "{search}"</div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
