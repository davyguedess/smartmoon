import { useState, useEffect, useRef, useCallback } from 'react'
import { flushSync } from 'react-dom'
import { api } from '../../api'
import {
  Send, Trash2, Settings2, ChevronDown, Copy, Check,
  Bot, User, Loader, Volume2, VolumeX, Plus, MessageSquare,
  Sparkles, ChevronRight, X, Zap,
} from 'lucide-react'

const BASE_URL = import.meta.env.VITE_API_URL || ''

// ── Provider definitions ─────────────────────────────────────────────────────

const CLOUD_PROVIDERS = [
  { id: 'openai', label: 'OpenAI GPT-4o', icon: '🟢', color: '#10a37f', endpoint: 'openai', model: 'gpt-4o' },
  { id: 'openai-mini', label: 'OpenAI GPT-4o-mini', icon: '🟢', color: '#10a37f', endpoint: 'openai', model: 'gpt-4o-mini' },
  { id: 'gemini', label: 'Google Gemini 1.5 Pro', icon: '🔷', color: '#4285f4', endpoint: 'gemini', model: 'gemini-1.5-pro' },
  { id: 'gemini-flash', label: 'Google Gemini 1.5 Flash', icon: '🔷', color: '#4285f4', endpoint: 'gemini', model: 'gemini-1.5-flash' },
  { id: 'claude', label: 'Claude 3.5 Sonnet', icon: '🟠', color: '#d97706', endpoint: 'claude', model: 'claude-3-5-sonnet-20241022' },
  { id: 'groq', label: 'Groq Llama3 70B ⚡', icon: '⚡', color: '#7c3aed', endpoint: 'groq', model: 'llama-3.3-70b-versatile' },
]

// ── Helpers ──────────────────────────────────────────────────────────────────

/** UUID compatible with HTTP (non-secure) contexts — crypto.randomUUID() fails on plain HTTP */
function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback: RFC 4122 v4 UUID using Math.random
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

function formatTime(date) {
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

async function copyToClipboard(text, setCopied) {
  await navigator.clipboard.writeText(text)
  setCopied(true)
  setTimeout(() => setCopied(false), 1500)
}

async function warmOllama(model) {
  // Warm-up is now a no-op — server handles model loading
  return Promise.resolve()
}

/**
 * streamUnified — single streaming function for ALL providers.
 *
 * Replaces: streamOllama (direct localhost:11434) + streamCloudProvider (/chat/{provider}/stream)
 * Now calls: POST /chat/stream with provider + model fields.
 *
 * Benefits:
 *   - Cost tracking is automatic (backend handles it)
 *   - Works for Ollama, OpenAI, Gemini, Claude, Groq
 *   - Quota enforcement in the backend
 *   - Memory persistence included
 */
async function streamUnified(provider, model, messages, systemPrompt, sessionId, agentId, onChunk, onDone, onError, withAudio) {
  const TIMEOUT_MS = 90_000
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const body = {
      provider,
      model,
      system_prompt: systemPrompt,
      session_id: sessionId || undefined,
      agent_id: agentId || undefined,
      with_audio: withAudio || false,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    }
    const res = await fetch(`${BASE_URL}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
      if (res.status === 429) {
        onError(`🚫 Cota excedida: ${err.detail || 'Limite do plano atingido'}. Faça upgrade em Configurações > Plano.`)
        return
      }
      throw new Error(err.detail || `HTTP ${res.status}`)
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let full = '', buf = '', receivedAny = false

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const raw = line.slice(6).trim()
        if (raw === '[DONE]') { clearTimeout(timeoutId); onDone(full); return }
        try {
          const payload = JSON.parse(raw)
          if (payload.error) throw new Error(payload.error)
          const token = payload.token || ''
          if (token) { receivedAny = true; full += token; onChunk(token) }
          if (payload.audio_url) { clearTimeout(timeoutId); onDone(full, payload.audio_url); return }
        } catch (parseErr) { if (raw !== '') console.warn('SSE parse error', parseErr) }
      }
    }
    clearTimeout(timeoutId)
    if (!receivedAny) {
      onError(`O modelo "${model}" não respondeu. Verifique se o Ollama está rodando ou tente um modelo na nuvem.`)
      return
    }
    onDone(full)
  } catch (e) {
    clearTimeout(timeoutId)
    if (e.name === 'AbortError') {
      onError(`⏱ Timeout: o modelo "${model}" não respondeu em ${TIMEOUT_MS / 1000}s.`)
    } else if (e.message?.includes('Failed to fetch')) {
      onError('🔌 Servidor Smart Moon não acessível. Verifique se o backend está no ar.')
    } else {
      onError(e.message)
    }
  }
}

// ── TTS helpers ───────────────────────────────────────────────────────────────

async function generateAudioUrl(text) {
  const res = await fetch(`${BASE_URL}/tts/test`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, format: 'wav' }),
  })
  if (!res.ok) throw new Error('TTS failed')
  const { file_path } = await res.json()
  return `${BASE_URL}/tts/audio?path=${encodeURIComponent(file_path)}`
}

// ── Audio Bubble (WhatsApp style) ─────────────────────────────────────────────

const WAVE_BARS = [4, 7, 12, 9, 14, 11, 6, 8, 13, 10, 5, 9, 12, 7, 10, 8, 6, 11]

function AudioBubble({ text, modelColor, voiceEnabled, initialAudioUrl }) {
  const [audioUrl, setAudioUrl] = useState(initialAudioUrl || null)
  const [loadingAudio, setLoadingAudio] = useState(false)
  const [audioError, setAudioError] = useState(null)
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef(null)

  const load = async () => {
    if (audioUrl) { audioRef.current?.play(); setPlaying(true); return }
    setLoadingAudio(true); setAudioError(null)
    try {
      const url = await generateAudioUrl(text)
      setAudioUrl(url)
    } catch {
      setAudioError('Não foi possível gerar o áudio.')
    } finally {
      setLoadingAudio(false)
    }
  }

  // Auto-load audio if voice mode is on
  useEffect(() => {
    if (voiceEnabled && !audioUrl && !loadingAudio && !audioError) {
      load()
    }
  }, [voiceEnabled, audioUrl, loadingAudio, audioError])

  // Auto-play when audio URL is ready
  useEffect(() => {
    if (audioUrl && audioRef.current) {
      audioRef.current.play().catch(e => console.warn("Auto-play blocked:", e))
      setPlaying(true)
    }
  }, [audioUrl])

  const toggle = () => {
    if (!audioRef.current) return
    if (playing) { audioRef.current.pause(); setPlaying(false) }
    else { audioRef.current.play(); setPlaying(true) }
  }

  return (
    <div style={{ marginTop: 8 }}>
      {!audioUrl && !loadingAudio && (
        <button onClick={load} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 12px', borderRadius: 20,
          background: `${modelColor}18`, border: `1px solid ${modelColor}40`,
          color: modelColor, cursor: 'pointer', fontSize: 11, fontWeight: 700,
        }}>
          <Volume2 size={11} /> Ouvir como áudio
        </button>
      )}
      {loadingAudio && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: modelColor }}>
          <Loader size={11} style={{ animation: 'spin 1s linear infinite' }} /> Gerando áudio...
        </div>
      )}
      {audioError && <div style={{ fontSize: 11, color: '#ef4444' }}>{audioError}</div>}
      {audioUrl && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 12px', borderRadius: 20,
          background: `${modelColor}14`, border: `1px solid ${modelColor}30`,
          width: 'fit-content', minWidth: 200, maxWidth: 260,
        }}>
          <button onClick={toggle} style={{
            width: 30, height: 30, borderRadius: '50%', border: 'none', flexShrink: 0,
            background: modelColor, color: 'white', cursor: 'pointer', fontSize: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {playing ? '⏸' : '▶'}
          </button>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2, height: 22, overflow: 'hidden' }}>
            {WAVE_BARS.map((h, i) => (
              <div key={i} style={{
                width: 3, borderRadius: 2, flexShrink: 0, transition: 'background 0.3s',
                background: playing ? modelColor : `${modelColor}55`,
                height: `${(h / 14) * 100}%`,
              }} />
            ))}
          </div>
          <span style={{ fontSize: 10, color: modelColor, fontWeight: 600, whiteSpace: 'nowrap' }}>🎤 Voz IA</span>
          <audio ref={audioRef} src={audioUrl} onEnded={() => setPlaying(false)} style={{ display: 'none' }} />
        </div>
      )}
    </div>
  )
}

// ── Message Bubble ────────────────────────────────────────────────────────────

function MessageBubble({ msg, modelColor, voiceEnabled }) {
  const [copied, setCopied] = useState(false)
  const [showAudio, setShowAudio] = useState(false)
  const isUser = msg.role === 'user'

  // Auto-trigger audio bubble when voice mode is on and message is done
  useEffect(() => {
    if (!isUser && !msg.streaming && msg.content && voiceEnabled) {
      setShowAudio(true)
    }
  }, [msg.streaming, voiceEnabled, isUser, msg.content])

  return (
    <div style={{
      display: 'flex', gap: 10,
      flexDirection: isUser ? 'row-reverse' : 'row',
      alignItems: 'flex-start', marginBottom: 16,
    }}>
      {/* Avatar */}
      <div style={{
        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
        background: isUser
          ? 'linear-gradient(135deg, var(--nexus-violet), var(--nexus-cyan))'
          : `${modelColor}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: isUser ? 'none' : `1px solid ${modelColor}40`,
        marginTop: 2,
      }}>
        {isUser ? <User size={14} color="white" /> : <Bot size={14} color={modelColor} />}
      </div>

      {/* Bubble content */}
      <div style={{ maxWidth: '72%', minWidth: 60 }}>
        {/* Text bubble */}
        <div style={{
          padding: '10px 14px',
          background: isUser ? 'rgba(99,102,241,0.15)' : 'var(--bg-card)',
          border: isUser ? '1px solid rgba(99,102,241,0.3)' : '1px solid var(--border-subtle)',
          borderRadius: isUser ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
          color: 'var(--text-primary)',
          fontSize: 13, lineHeight: 1.6,
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {msg.content}
          {msg.streaming && (
            <span style={{
              display: 'inline-block', width: 8, height: 16, marginLeft: 3,
              background: modelColor, borderRadius: 2,
              animation: 'blink 0.8s step-end infinite',
              verticalAlign: 'middle',
            }} />
          )}
        </div>

        {/* Audio bubble — WhatsApp style, below AI text */}
        {!isUser && !msg.streaming && msg.content && (
          showAudio
            ? <AudioBubble text={msg.content} modelColor={modelColor} voiceEnabled={voiceEnabled} initialAudioUrl={msg.audioUrl} />
            : (
              <button 
                onClick={() => setShowAudio(true)} 
                className="audio-trigger-btn"
                style={{
                  display: 'flex', alignItems: 'center', gap: 5, marginTop: 6,
                  padding: '4px 10px', borderRadius: 16,
                  background: `${modelColor}10`, border: `1px solid ${modelColor}25`,
                  color: modelColor, cursor: 'pointer', fontSize: 10, fontWeight: 700,
                  transition: 'all 0.2s',
                }}
              >
                <Volume2 size={10} /> 
                {voiceEnabled ? 'Preparando voz...' : 'Ouvir como áudio'}
              </button>
            )
        )}

        {/* Meta row: time + copy */}
        <div style={{
          display: 'flex', alignItems: 'center',
          gap: 8, marginTop: 4,
          justifyContent: isUser ? 'flex-end' : 'flex-start',
        }}>
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            {formatTime(new Date(msg.ts))}
            {msg.ms != null && (
              <span style={{ marginLeft: 5 }}>
                · {msg.ms >= 1000 ? `${(msg.ms / 1000).toFixed(1)}s` : `${msg.ms}ms`}
              </span>
            )}
          </span>
          {!isUser && !msg.streaming && msg.content && (
            <button onClick={() => copyToClipboard(msg.content, setCopied)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 2 }}>
              {copied ? <Check size={11} color="var(--nexus-green)" /> : <Copy size={11} />}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Model Selector ────────────────────────────────────────────────────────────

function ModelSelector({ selected, onSelect, ollamaModels }) {
  const [open, setOpen] = useState(false)
  const allModels = [
    ...ollamaModels.map(m => ({ id: `ollama:${m.name}`, label: m.name, icon: '🤖', color: '#8b5cf6', type: 'ollama', model: m.name })),
    ...CLOUD_PROVIDERS.map(p => ({ ...p, type: 'cloud' })),
  ]
  const current = allModels.find(m => m.id === selected) || allModels[0]

  return (
    <div data-tour="model-selector" style={{ position: 'relative' }}>
        <button onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '7px 12px', borderRadius: 9,
        background: 'var(--bg-card)', border: '1px solid var(--border-default)',
        color: 'var(--text-primary)', cursor: 'pointer', fontSize: 12, fontWeight: 600,
        minWidth: 200,
      }}>
        <span style={{ fontSize: 15 }}>{current?.icon || '🤖'}</span>
        <span className="chat-model-name" style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {current?.label || 'Selecionar modelo'}
        </span>
        <ChevronDown size={12} color="var(--text-muted)" />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 200,
          background: 'var(--bg-panel)', border: '1px solid var(--border-default)',
          borderRadius: 12, overflow: 'hidden', minWidth: 260, boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
        }}>
          {ollamaModels.length > 0 && (
            <>
              <div style={{ padding: '8px 12px 4px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.8, textTransform: 'uppercase' }}>
                🤖 Ollama (Local)
              </div>
              {ollamaModels.map(m => {
                const id = `ollama:${m.name}`
                return (
                  <button key={id} onClick={() => { onSelect(id); setOpen(false) }} style={{
                    display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                    padding: '8px 14px', background: selected === id ? 'rgba(139,92,246,0.12)' : 'transparent',
                    border: 'none', cursor: 'pointer', color: 'var(--text-primary)', textAlign: 'left',
                  }}>
                    <span style={{ fontSize: 16 }}>🤖</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{m.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        {m.size ? `${(m.size / 1e9).toFixed(1)} GB` : 'Local'}
                      </div>
                    </div>
                    {selected === id && <Check size={12} color="var(--nexus-purple)" style={{ marginLeft: 'auto' }} />}
                  </button>
                )
              })}
              <div style={{ margin: '4px 12px', borderBottom: '1px solid var(--border-subtle)' }} />
            </>
          )}
          <div style={{ padding: '8px 12px 4px', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.8, textTransform: 'uppercase' }}>
            ☁️ Cloud (requer API key)
          </div>
          {CLOUD_PROVIDERS.map(p => (
            <button key={p.id} onClick={() => { onSelect(p.id); setOpen(false) }} style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%',
              padding: '8px 14px', background: selected === p.id ? `${p.color}18` : 'transparent',
              border: 'none', cursor: 'pointer', color: 'var(--text-primary)', textAlign: 'left',
            }}>
              <span style={{ fontSize: 15 }}>{p.icon}</span>
              <span style={{ fontSize: 12, fontWeight: 600 }}>{p.label}</span>
              {selected === p.id && <Check size={12} color={p.color} style={{ marginLeft: 'auto' }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Chat Page ────────────────────────────────────────────────────────────

const DEFAULT_SYSTEM = 'Você é um assistente especializado da Smart Moon. Responda sempre em Português de forma clara, objetiva e profissional.'
const LS_MODEL = 'nexus_chat_model'
const lsKey = (model) => `nexus_chat_msgs_${model}`
const sessionKey = (model) => `chat_${model.replace(/[^a-zA-Z0-9]/g, '_')}`

async function persistMessage(sessionId, role, content, model, provider) {
  try {
    await fetch(`${BASE_URL}/agent/memory`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, role, content, model, provider }),
    })
  } catch (e) { console.warn('Memory persist failed:', e) }
}

export default function Chat() {
  const [ollamaModels, setOllamaModels] = useState([])
  const [selectedModel, setSelectedModel] = useState(() => localStorage.getItem(LS_MODEL) || '')
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [systemPrompt, setSystemPrompt] = useState(() => localStorage.getItem('nexus_chat_system') || DEFAULT_SYSTEM)
  const [showSystem, setShowSystem] = useState(false)
  const [warmingUp, setWarmingUp] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(() => localStorage.getItem('nexus_chat_voice') === 'true')
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)

  // ── Sidebar: sessions + agents ─────────────────────────────────────────────
  const [agents, setAgents] = useState([])
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [sessions, setSessions] = useState([]) // [{id, label, model, msgCount, lastTs}]
  const [sideTab, setSideTab] = useState('sessions') // 'sessions' | 'agents'

  // Load agents on mount
  useEffect(() => {
    api.agentListProfiles?.().then(data => {
      if (Array.isArray(data)) setAgents(data)
    }).catch(() => {})
  }, [])

  // Build sessions list from all saved localStorage keys
  const refreshSessions = useCallback(() => {
    const all = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k?.startsWith('nexus_chat_msgs_')) continue
      try {
        const msgs = JSON.parse(localStorage.getItem(k) || '[]')
        if (msgs.length === 0) continue
        const modelId = k.replace('nexus_chat_msgs_', '')
        const label = modelId.startsWith('ollama:') ? modelId.replace('ollama:', '') :
          (CLOUD_PROVIDERS.find(p => p.id === modelId)?.label || modelId)
        const last = msgs[msgs.length - 1]
        all.push({ id: modelId, label, msgCount: msgs.length, lastTs: last?.ts || 0 })
      } catch {}
    }
    all.sort((a, b) => b.lastTs - a.lastTs)
    setSessions(all)
  }, [])

  useEffect(() => { refreshSessions() }, [messages, refreshSessions])

  useEffect(() => {
    api.ollamaModels().then(models => {
      setOllamaModels(models)
      const saved = localStorage.getItem(LS_MODEL)
      const exists = saved && (saved.startsWith('ollama:')
        ? models.some(m => `ollama:${m.name}` === saved)
        : CLOUD_PROVIDERS.some(p => p.id === saved))
      if (exists) {
        setSelectedModel(saved); loadHistory(saved)
        if (saved.startsWith('ollama:')) { setWarmingUp(true); warmOllama(saved.replace('ollama:', '')).finally(() => setWarmingUp(false)) }
      } else {
        const preferred = models.find(m => m.name.startsWith('llama3.2'))
        const chosen = preferred || (models.length > 0 ? models[0] : null)
        if (chosen) {
          const id = `ollama:${chosen.name}`
          setSelectedModel(id); loadHistory(id)
          setWarmingUp(true); warmOllama(chosen.name).finally(() => setWarmingUp(false))
        } else { setSelectedModel(CLOUD_PROVIDERS[0].id) }
      }
    })
  }, [])

  async function loadHistory(modelId) {
    const sid = sessionKey(modelId)
    try {
      const data = await api.getAgentMemory(sid, 100)
      if (data && data.length > 0) {
        setMessages(data.map(m => ({ role: m.role, content: m.content, ts: m.created_at ? new Date(m.created_at).getTime() : Date.now() })))
        return
      }
    } catch (e) { console.warn('Failed to load from backend:', e) }
    const msgs = JSON.parse(localStorage.getItem(lsKey(modelId)) || '[]')
    setMessages(msgs)
  }

  useEffect(() => {
    if (!selectedModel || loading) return
    const toSave = messages.filter(m => !m.streaming && m.content)
    localStorage.setItem(lsKey(selectedModel), JSON.stringify(toSave))
  }, [messages, selectedModel, loading])

  useEffect(() => { if (selectedModel) localStorage.setItem(LS_MODEL, selectedModel) }, [selectedModel])
  useEffect(() => { localStorage.setItem('nexus_chat_system', systemPrompt) }, [systemPrompt])
  useEffect(() => { localStorage.setItem('nexus_chat_voice', voiceEnabled) }, [voiceEnabled])

  const handleModelSelect = (id) => {
    setSelectedModel(id); loadHistory(id)
    if (id.startsWith('ollama:')) {
      setWarmingUp(true); warmOllama(id.replace('ollama:', '')).finally(() => setWarmingUp(false))
    }
  }

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // ── Auto-fill pending agent messages (from BidDetail or other pages) ──
  useEffect(() => {
    const pending = localStorage.getItem('nexus_agent_pending_message')
    if (pending && !loading && selectedModel) {
      localStorage.removeItem('nexus_agent_pending_message')
      setInput(pending)
      // Auto-focus the input
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [selectedModel, loading])

  const getCurrentConfig = () => {
    if (selectedModel.startsWith('ollama:')) return { type: 'ollama', model: selectedModel.replace('ollama:', ''), color: '#8b5cf6' }
    const cloud = CLOUD_PROVIDERS.find(p => p.id === selectedModel)
    return cloud ? { type: 'cloud', ...cloud } : { type: 'ollama', model: 'llama3.2', color: '#8b5cf6' }
  }

  const sendMessage = async () => {
    const text = input.trim()
    console.log('[SM] sendMessage called, text:', text, 'loading:', loading)
    if (!text || loading) return
    const userMsg = { role: 'user', content: text, ts: Date.now() }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages); setInput(''); setLoading(true)
    const config = getCurrentConfig()
    const start = Date.now()
    const sid = sessionKey(selectedModel)
    const provider = config.type === 'ollama' ? 'ollama' : config.endpoint
    const assistantId = `ai-${generateId()}`
    console.log('[SM] Streaming to', provider, config.model, 'session:', sid)
    setMessages(prev => [...prev, { id: assistantId, role: 'assistant', content: '', streaming: true, ts: Date.now(), color: config.color }])

    // ── Single unified stream for ALL providers ──────────────────────
    await streamUnified(
      provider, config.model, newMessages, systemPrompt,
      sid, selectedAgent?.id || null,
      // onChunk
      (chunk) => {
        flushSync(() => {
          setMessages(prev => prev.map(m =>
            m.id === assistantId ? { ...m, content: m.content + chunk } : m
          ))
        })
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      },
      // onDone
      (full, audioUrl) => {
        const ms = Date.now() - start
        console.log('[SM] Stream done, tokens:', full.length, 'ms:', ms)
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, content: full, streaming: false, ms, audioUrl }
            : m
        ))
        setLoading(false); inputRef.current?.focus()
      },
      // onError
      (err) => {
        console.error('[SM] Stream error:', err)
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, content: `❌ ${err}`, streaming: false }
            : m
        ))
        setLoading(false)
      },
      voiceEnabled,
    )
  }


  const handleKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }
  const config = getCurrentConfig()

  return (
    <div className="chat-page" style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <style>{`
        @media (max-width: 768px) {
          .chat-sidebar { display: none !important; }
          .chat-header { padding: 8px 12px !important; gap: 8px !important; flex-wrap: wrap !important; }
          .chat-header-left { gap: 8px !important; flex-wrap: wrap !important; }
          .chat-header-actions { display: flex !important; gap: 4px !important; flex-wrap: wrap !important; }
          .chat-header-actions button { padding: 5px 8px !important; font-size: 10px !important; }
          .chat-header-actions button span { display: none; }
          .chat-messages { padding: 12px !important; }
          .chat-input-wrap { padding: 8px 12px 72px !important; }
          .chat-input-hint { display: none !important; }
          .chat-model-selector { min-width: 140px !important; font-size: 11px !important; }
          .chat-model-dropdown { left: auto !important; right: 0 !important; min-width: 220px !important; }
          .chat-empty-suggestions button { font-size: 10px !important; padding: 5px 10px !important; }
        }
      `}</style>
      {/* Main chat column */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>

        {/* Header */}
        <div className="chat-header" style={{
          padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
          background: 'var(--bg-surface)',
        }}>
          <div className="chat-header-left" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800 }}>Chat com IA</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{messages.length} mensagem{messages.length !== 1 ? 's' : ''}</div>
            </div>
            <ModelSelector selected={selectedModel} onSelect={handleModelSelect} ollamaModels={ollamaModels} />
          </div>



          {/* Voice toggle */}
          <button
            title={voiceEnabled ? 'Desativar voz automática' : 'Ativar voz automática'}
            onClick={() => setVoiceEnabled(v => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px',
              borderRadius: 8, border: `1px solid ${voiceEnabled ? 'rgba(16,185,129,0.4)' : 'var(--border-default)'}`,
              background: voiceEnabled ? 'rgba(16,185,129,0.12)' : 'var(--bg-card)',
              color: voiceEnabled ? '#10b981' : 'var(--text-muted)',
              cursor: 'pointer', fontSize: 11, fontWeight: 600,
            }}
          >
            {voiceEnabled ? <Volume2 size={12} /> : <VolumeX size={12} />}
            {voiceEnabled ? 'Voz ativa' : 'Voz desligada'}
          </button>

          {/* Clear chat */}
          {messages.length > 0 && (
            <button onClick={async () => {
              setMessages([])
              const sid = sessionKey(selectedModel)
              try { await api.clearAgentMemory(sid) } catch {}
            }} style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px',
              borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)',
              background: 'rgba(239,68,68,0.08)', color: 'var(--nexus-red)',
              cursor: 'pointer', fontSize: 11, fontWeight: 600,
            }}>
              <Trash2 size={12} /> Limpar
            </button>
          )}
        </div>

        {/* Warming up banner */}
        {warmingUp && (
          <div style={{
            padding: '7px 20px', background: 'rgba(245,158,11,0.08)',
            borderBottom: '1px solid rgba(245,158,11,0.2)',
            display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
          }}>
            <Loader size={11} color="#f59e0b" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: '#f59e0b', fontWeight: 600 }}>
              Carregando modelo na memória RAM — primeira resposta pode demorar...
            </span>
          </div>
        )}



        {/* Messages */}
        <div className="chat-messages" style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', WebkitOverflowScrolling: 'touch' }}>
          {messages.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, opacity: 0.6 }}>
              <div style={{ fontSize: 48 }}>{getCurrentConfig()?.icon || '🤖'}</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-secondary)' }}>
                {selectedModel.startsWith('ollama:') ? selectedModel.replace('ollama:', '') : (CLOUD_PROVIDERS.find(p => p.id === selectedModel)?.label || 'Selecione um modelo')}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 320 }}>
                {selectedModel.startsWith('ollama:')
                  ? 'Modelo local rodando no seu Mac — sem custo, sem internet'
                  : 'Modelo cloud — configure a API key em Integrações para usar'}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', maxWidth: 420, marginTop: 4 }}>
                {['O que é Smart Moon?', 'Como criar um fluxo de cobrança?', 'Quais modelos de IA você pode usar?', 'Como integrar com o WhatsApp?'].map(s => (
                  <button key={s} onClick={() => setInput(s)} style={{
                    padding: '6px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                    background: 'var(--bg-card)', border: '1px solid var(--border-default)',
                    color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.15s',
                  }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = config.color}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <MessageBubble key={msg.id || i} msg={msg} modelColor={msg.color || config.color} voiceEnabled={voiceEnabled} />
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <div data-tour="chat-input" className="chat-input-wrap" style={{ padding: '12px 20px', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-surface)', flexShrink: 0 }}>
          <div style={{
            display: 'flex', gap: 10, alignItems: 'flex-end',
            background: 'var(--bg-card)', border: `1px solid ${loading ? config.color + '60' : 'var(--border-default)'}`,
            borderRadius: 14, padding: '8px 12px', transition: 'border-color 0.2s',
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Falar com ${selectedModel.startsWith('ollama:') ? selectedModel.replace('ollama:', '') : (CLOUD_PROVIDERS.find(p => p.id === selectedModel)?.label || 'IA')}... (Enter para enviar, Shift+Enter para nova linha)`}
              rows={1}
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit',
                resize: 'none', lineHeight: 1.5, maxHeight: 120, overflowY: 'auto',
              }}
              onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px' }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              style={{
                width: 34, height: 34, borderRadius: 9, border: 'none',
                background: !input.trim() || loading ? 'var(--bg-elevated)' : config.color,
                color: !input.trim() || loading ? 'var(--text-muted)' : 'white',
                cursor: !input.trim() || loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'all 0.15s',
              }}
            >
              {loading ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />}
            </button>
          </div>
          <div className="chat-input-hint" style={{ display: 'flex', justifyContent: 'space-between', marginTop: 5, padding: '0 2px' }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Enter para enviar · Shift+Enter nova linha</span>
            <span style={{ fontSize: 10, color: config.color, fontWeight: 600 }}>
              {selectedModel.startsWith('ollama:') ? '🔒 Processamento local' : '☁️ Cloud'}
            </span>
          </div>
        </div>

        <style>{`
          @keyframes blink { 0%, 100% { opacity: 1 } 50% { opacity: 0 } }
          @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }
        `}</style>
      </div>

      {/* ── New Sidebar: Sessions + Agents ── */}
      <div data-tour="chat-history" className="chat-sidebar" style={{
        width: 240, flexShrink: 0,
        borderLeft: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>

        {/* Tab bar */}
        <div style={{
          display: 'flex', borderBottom: '1px solid var(--border-subtle)',
          padding: '0 8px', gap: 2, flexShrink: 0,
        }}>
          {[['sessions', MessageSquare, 'Sessões'], ['agents', Sparkles, 'Agentes']].map(([tab, Icon, label]) => (
            <button key={tab} onClick={() => setSideTab(tab)} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
              padding: '10px 4px', fontSize: 11, fontWeight: 700,
              background: 'none', border: 'none', cursor: 'pointer',
              color: sideTab === tab ? 'var(--nexus-violet)' : 'var(--text-muted)',
              borderBottom: sideTab === tab ? '2px solid var(--nexus-violet)' : '2px solid transparent',
              transition: 'all 0.15s', marginBottom: -1,
            }}>
              <Icon size={12} />{label}
            </button>
          ))}
        </div>

        {/* ── SESSIONS TAB ── */}
        {sideTab === 'sessions' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* New chat button */}
            <button
              onClick={() => {
                const first = ollamaModels[0]
                const id = first ? `ollama:${first.name}` : CLOUD_PROVIDERS[0].id
                handleModelSelect(id)
                setMessages([])
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '8px 10px',
                borderRadius: 10, border: '1px dashed var(--border-default)',
                background: 'transparent', color: 'var(--nexus-violet)',
                cursor: 'pointer', fontSize: 11, fontWeight: 700, width: '100%',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(99,102,241,0.08)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <Plus size={13} /> Novo chat
            </button>

            {/* Session label */}
            <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase', padding: '4px 2px 0' }}>
              Recentes
            </div>

            {sessions.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 8px', opacity: 0.6 }}>
                Nenhuma conversa ainda
              </div>
            )}

            {sessions.map(s => {
              const isActive = s.id === selectedModel
              const icon = s.id.startsWith('ollama:') ? '🤖' : (CLOUD_PROVIDERS.find(p => p.id === s.id)?.icon || '☁️')
              const color = isActive ? (CLOUD_PROVIDERS.find(p => p.id === s.id)?.color || '#8b5cf6') : 'transparent'
              return (
                <div
                  key={s.id}
                  onClick={() => handleModelSelect(s.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 10px', borderRadius: 10, cursor: 'pointer',
                    background: isActive ? 'rgba(99,102,241,0.1)' : 'var(--bg-card)',
                    border: `1px solid ${isActive ? 'rgba(99,102,241,0.3)' : 'var(--border-subtle)'}`,
                    transition: 'all 0.15s', position: 'relative',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.borderColor = 'var(--border-default)' }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.borderColor = 'var(--border-subtle)' }}
                >
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 11, fontWeight: 600,
                      color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{s.label}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                      {s.msgCount} mensagem{s.msgCount !== 1 ? 's' : ''}
                    </div>
                  </div>
                  {/* Clear session button */}
                  <button
                    onClick={async e => {
                      e.stopPropagation()
                      localStorage.removeItem(`nexus_chat_msgs_${s.id}`)
                      try { await api.clearAgentMemory(sessionKey(s.id)) } catch {}
                      if (isActive) setMessages([])
                      refreshSessions()
                    }}
                    style={{
                      width: 20, height: 20, borderRadius: 6, border: 'none',
                      background: 'rgba(239,68,68,0.1)', color: '#ef4444',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, opacity: 0, transition: 'opacity 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '0'}
                  >
                    <X size={10} />
                  </button>
                  {isActive && <div style={{
                    position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
                    width: 3, height: 20, background: 'var(--nexus-violet)', borderRadius: '0 3px 3px 0',
                  }} />}
                </div>
              )
            })}
          </div>
        )}

        {/* ── AGENTS TAB ── */}
        {sideTab === 'agents' && (
          <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>

            {/* Selected agent banner */}
            {selectedAgent && (
              <div style={{
                padding: '8px 10px', borderRadius: 10,
                background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)',
                marginBottom: 2,
              }}>
                <div style={{ fontSize: 9, color: 'var(--nexus-violet)', fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Agente ativo</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg, var(--nexus-violet), var(--nexus-cyan))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 14,
                  }}>🤖</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {selectedAgent.name}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{selectedAgent.model || 'Padrão'}</div>
                  </div>
                  <button onClick={() => setSelectedAgent(null)} style={{
                    background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2,
                  }}><X size={12} /></button>
                </div>
              </div>
            )}

            <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: 1, textTransform: 'uppercase', padding: '4px 2px 0' }}>
              Seus Agentes
            </div>

            {agents.length === 0 && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '16px 8px', opacity: 0.6 }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>🤖</div>
                Nenhum agente encontrado.
                <br />Crie um em Agentes IA.
              </div>
            )}

            {agents.map(a => {
              const isSelected = selectedAgent?.id === a.id
              return (
                <div
                  key={a.id}
                  onClick={() => {
                    setSelectedAgent(isSelected ? null : a)
                    if (!isSelected && a.system_prompt) setSystemPrompt(a.system_prompt)
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 10px', borderRadius: 10, cursor: 'pointer',
                    background: isSelected ? 'rgba(99,102,241,0.1)' : 'var(--bg-card)',
                    border: `1px solid ${isSelected ? 'rgba(99,102,241,0.3)' : 'var(--border-subtle)'}`,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = 'var(--border-default)' }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = 'var(--border-subtle)' }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: isSelected
                      ? 'linear-gradient(135deg, var(--nexus-violet), var(--nexus-cyan))'
                      : 'var(--bg-elevated)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13,
                  }}>🤖</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 11, fontWeight: 600,
                      color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{a.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Zap size={8} />{a.model || 'padrão'}
                    </div>
                  </div>
                  {isSelected && <ChevronRight size={12} color="var(--nexus-violet)" />}
                </div>
              )
            })}

            {/* Link to agents page */}
            <a
              href="/agents"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '8px 10px', borderRadius: 10, marginTop: 4,
                border: '1px dashed var(--border-default)',
                color: 'var(--text-muted)', fontSize: 11, fontWeight: 600,
                textDecoration: 'none', transition: 'all 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--nexus-violet)'; e.currentTarget.style.borderColor = 'var(--nexus-violet)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-default)' }}
            >
              <Plus size={12} /> Gerenciar agentes
            </a>
          </div>
        )}
      </div>
    </div>
  )
}
