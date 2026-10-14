import React, { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { 
  Sparkles, X, ChevronRight, MessageSquare, GraduationCap, 
  Play, HelpCircle, AudioLines, CheckCircle2, Layout, 
  GitBranch, Cpu, MessageCircle, BarChart3, Settings, 
  ShieldCheck, ShoppingBag, Send 
} from 'lucide-react'
import { api } from '../../api'

// Safe fetch that never triggers auth redirects — Luna failures are silent
const LUNA_API = import.meta.env.VITE_API_URL || ''
async function lunaFetch(path) {
  try {
    const res = await fetch(`${LUNA_API}${path}`, {
      credentials: 'include',
      headers: {
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
      }
    })
    if (!res.ok) return null
    const ct = res.headers.get('Content-Type') || ''
    if (!ct.includes('application/json')) return null
    return await res.json()
  } catch { return null }
}

/**
 * LunaCopilot — O assistente flutuante premium do NEXUS.IA
 * Implementa o modo "Tutorial vs Profissional" e guia o usuário em todos os módulos.
 */
export default function LunaCopilot() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState(() => localStorage.getItem('luna_mode'))
  const [onboardingStep, setOnboardingStep] = useState(() => localStorage.getItem('luna_mode') ? 2 : 0)
  const [tutorialMode, setTutorialMode] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [tutorialData, setTutorialData] = useState(null)
  const [faqData, setFaqData] = useState([])
  const [activeFaq, setActiveFaq] = useState(null)

  // ── TOUR INLINE — setInterval puro, sem componente externo ──
  const tourIntervalRef = useRef(null)
  const tourAllStepsRef = useRef([])
  const tourStepIdxRef = useRef(0)
  const [tourRunning, setTourRunning] = useState(false)
  const [tourLabel, setTourLabel] = useState('')
  const [tourProgress, setTourProgress] = useState({ current: 0, total: 0 })
  const [cursorPos, setCursorPos] = useState(null)  // { x, y, rect, label, idx, total }

  // Audio & Tutorial State
  const audioRef = useRef(new Audio())
  const [isPlaying, setIsPlaying] = useState(false)
  
  // Chat State
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatHistory, setChatHistory] = useState([])

  const location = useLocation()
  const navigate = useNavigate()
  const panelRef = useRef(null)
  const chatEndRef = useRef(null)

  // ── Parar tour ao mudar de rota ──
  useEffect(() => {
    stopTour()
    setActiveFaq(null)
  }, [location.pathname])

  // Tutorial Highlight Effect
  useEffect(() => {
    if (tutorialMode && tutorialData?.steps?.[currentStep]) {
      const step = tutorialData.steps[currentStep]
      
      // Clear previous highlights
      document.querySelectorAll('.luna-highlight').forEach(el => el.classList.remove('luna-highlight'))
      document.querySelectorAll('.luna-overlay-spotlight').forEach(el => el.remove())

      if (step.selector) {
        setTimeout(() => {
          const target = document.querySelector(step.selector)
          if (target) {
            target.scrollIntoView({ behavior: 'smooth', block: 'center' })
            target.classList.add('luna-highlight')
            
            // Add spotlight overlay
            const overlay = document.createElement('div')
            overlay.className = 'luna-overlay-spotlight'
            document.body.appendChild(overlay)
            
            const rect = target.getBoundingClientRect()
            overlay.style.top = `${rect.top + window.scrollY}px`
            overlay.style.left = `${rect.left + window.scrollX}px`
            overlay.style.width = `${rect.width}px`
            overlay.style.height = `${rect.height}px`
          }
        }, 300)
      }

      // Play Audio if available
      if (tutorialData.audio_url || step.audio_url) {
        const url = step.audio_url || tutorialData.audio_url
        playAudio(url)
      }
    } else {
      // Cleanup when tutorial ends
      document.querySelectorAll('.luna-highlight').forEach(el => el.classList.remove('luna-highlight'))
      document.querySelectorAll('.luna-overlay-spotlight').forEach(el => el.remove())
      audioRef.current.pause()
      setIsPlaying(false)
    }
  }, [tutorialMode, currentStep, tutorialData])

  const playAudio = (url) => {
    if (!url) return
    const fullUrl = url.startsWith('http') ? url : `${LUNA_API}/audio/0/${url}` 
    audioRef.current.src = fullUrl
    audioRef.current.play().catch(e => console.error("Audio play failed:", e))
    setIsPlaying(true)
  }

  const toggleAudio = () => {
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.play()
      setIsPlaying(true)
    }
  }

  // Cores Premium
  const lunaColor = '#8b5cf6'
  const cyanColor = '#06b6d4'

  // Mapear rota para módulo
  const getModuleKey = (path) => {
    if (path === '/' || path === '/dashboard') return 'dashboard'
    if (path.startsWith('/chat')) return 'chat'
    if (path.startsWith('/flows')) return 'flow_builder'
    if (path.startsWith('/executions')) return 'executions'
    if (path.startsWith('/agents')) return 'agents'
    if (path.startsWith('/integrations')) return 'integrations'
    if (path.startsWith('/payments')) return 'payments'
    if (path.startsWith('/billing')) return 'billing'
    if (path.startsWith('/bids')) return 'bids'
    if (path.startsWith('/studio') || path.startsWith('/brand-kit')) return 'studio'
    if (path.startsWith('/campaigns')) return 'campaigns'
    if (path.startsWith('/store/ia')) return 'store_ia'
    if (path.startsWith('/store/skills')) return 'store_skills'
    if (path.startsWith('/store/agents')) return 'store_agents'
    if (path.startsWith('/settings/voice')) return 'voice'
    if (path.startsWith('/telegram')) return 'telegram'
    if (path.startsWith('/credits')) return 'credits'
    return null
  }

  const moduleKey = getModuleKey(location.pathname)

  // Auto-open on first visit if no mode selected
  useEffect(() => {
    if (!mode) {
      setTimeout(() => setOpen(true), 2000)
    }
  }, [mode])

  // Carregar FAQ do banco de dados (dinâmico, gerenciável pelo admin)
  const faqLoaded = useRef(false)
  const chatLoaded = useRef(false)
  useEffect(() => {
    if (open && !faqLoaded.current) {
      faqLoaded.current = true
      lunaFetch('/luna/faq').then(data => { if (data) setFaqData(data) })
    }
    // Carregar histórico de chat do banco (persistente)
    if (open && !chatLoaded.current) {
      chatLoaded.current = true
      lunaFetch('/luna/chat/history?limit=30').then(data => {
        if (data?.messages?.length > 0) {
          const hist = []
          data.messages.forEach(m => {
            hist.push({ role: 'user', text: m.user_message })
            if (m.luna_response) hist.push({ role: 'luna', text: m.luna_response })
          })
          setChatHistory(hist)
        }
      })
    }
  }, [open])

  // Recarregar FAQ quando muda de módulo
  useEffect(() => {
    if (open && moduleKey) {
      lunaFetch(`/luna/faq?category=${moduleKey}`).then(data => {
        if (data && data.length > 0) setFaqData(data)
      })
    }
  }, [moduleKey, open])

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatHistory])

  const selectMode = (m) => {
    setMode(m)
    localStorage.setItem('luna_mode', m)
    if (m === 'tutorial') {
      setOnboardingStep(1) // Ir para apresentação da Luna
    } else {
      setOpen(false)
    }
  }

  const resetLuna = () => {
    localStorage.removeItem('luna_mode')
    setMode(null)
    setOnboardingStep(0)
    setTutorialMode(false)
    setChatHistory([])
  }

  // Helper: pegar o container real de scroll
  const getScrollContainer = () => document.getElementById('main-scroll-container') || document.body

  // Cleanup: desbloquear scroll se componente desmontar durante tour
  useEffect(() => () => {
    const sc = document.getElementById('main-scroll-container')
    if (sc) { sc.style.overflowY = 'auto'; sc.style.touchAction = '' }
  }, [])

  // ── TOUR: Parar ──
  const stopTour = () => {
    if (tourIntervalRef.current) { clearTimeout(tourIntervalRef.current); tourIntervalRef.current = null }
    tourAllStepsRef.current = []
    tourStepIdxRef.current = 0
    setTourRunning(false)
    setTourLabel('')
    setCursorPos(null)
    setTutorialMode(false)
    setActiveFaq(null)
    if (audioRef.current) { audioRef.current.pause(); audioRef.current.onended = null; setIsPlaying(false) }
    // Desbloquear scroll
    const sc = getScrollContainer()
    sc.style.overflowY = 'auto'
    sc.style.touchAction = ''
  }

  // ── TOUR: Exibir step e ESPERAR áudio terminar ──
  const pointCursor = () => {
    if (tourIntervalRef.current) { clearTimeout(tourIntervalRef.current); tourIntervalRef.current = null }
    if (audioRef.current) audioRef.current.onended = null

    const steps = tourAllStepsRef.current
    const idx = tourStepIdxRef.current

    if (idx >= steps.length) {
      stopTour()
      setOpen(true)
      return
    }

    const step = steps[idx]
    tourStepIdxRef.current = idx + 1

    const el = document.querySelector(step.selector)
    if (!el) {
      setCursorPos(null)
      tourIntervalRef.current = setTimeout(pointCursor, 500)
      return
    }

    // Desbloquear scroll e scrollar manualmente para o elemento
    const sc = getScrollContainer()
    sc.style.overflowY = 'auto'
    sc.style.touchAction = ''

    // Forçar reflow antes de scrollar
    requestAnimationFrame(() => {
      // Calcular posição do elemento dentro do container e centralizar
      const scRect = sc.getBoundingClientRect()
      const elRect = el.getBoundingClientRect()
      const elTopInContainer = elRect.top - scRect.top + sc.scrollTop
      const target = elTopInContainer - (sc.clientHeight / 2) + (el.clientHeight / 2)
      sc.scrollTo({ top: Math.max(0, target), behavior: 'smooth' })

      // Esperar scroll parar
      let lastY = -999, stable = 0
      const waitScroll = () => {
        const r = el.getBoundingClientRect()
        if (Math.abs(r.top - lastY) < 1) stable++
        else stable = 0
        lastY = r.top
        if (stable >= 3) {
          // Travar scroll
          sc.style.overflowY = 'hidden'
          sc.style.touchAction = 'none'
          setCursorPos({
            x: r.left + r.width / 2,
            y: r.top + r.height / 2,
            rect: { x: r.left - 4, y: r.top - 4, w: r.width + 8, h: r.height + 8 },
            label: step.label, idx, total: steps.length,
          })
          setTourLabel(step.label)
          setTourProgress({ current: idx + 1, total: steps.length })
        } else {
          requestAnimationFrame(waitScroll)
        }
      }
      requestAnimationFrame(waitScroll)
    })

    // Áudio
    if (step.audioUrl && step.isFirstStep) {
      audioRef.current.pause()
      audioRef.current.src = step.audioUrl
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {
        tourIntervalRef.current = setTimeout(pointCursor, 6000)
      })
      audioRef.current.onended = () => {
        setIsPlaying(false)
        tourIntervalRef.current = setTimeout(pointCursor, 2000)
      }
    } else {
      tourIntervalRef.current = setTimeout(pointCursor, 6000)
    }
  }

  // ── TOUR: Iniciar ──
  const startTutorial = (key = null) => {
    const targetKey = key || moduleKey || 'dashboard'
    lunaFetch(`/luna/faq?category=${targetKey}`).then(data => {
      if (!data || !Array.isArray(data)) return
      const tourFaqs = data.filter(d => d.tour_config?.steps?.length > 0)
      if (tourFaqs.length === 0) return

      const allSteps = []
      tourFaqs.forEach(faq => {
        const audioUrl = (faq.audio_ready && faq.audio_path)
          ? `${LUNA_API}/luna/audio/${faq.audio_path}?t=${Date.now()}` : null
        faq.tour_config.steps.forEach((s, i) => {
          allSteps.push({
            selector: s.selector,
            label: s.label || faq.question,
            audioUrl,
            isFirstStep: i === 0,
          })
        })
      })

      stopTour()
      tourAllStepsRef.current = allSteps
      tourStepIdxRef.current = 0
      setTourRunning(true)
      setOnboardingStep(2)
      setOpen(false)
      setFaqData(data)

      // Começar após painel fechar
      setTimeout(pointCursor, 700)
    })
  }

  const endTutorial = () => { stopTour(); setOpen(true) }

  const nextStep = () => {
    if (tutorialData && currentStep < tutorialData.steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      endTutorial()
    }
  }

  const handleChat = async (e) => {
    if (e) e.preventDefault()
    if (!chatInput.trim() || chatLoading) return

    const userMsg = chatInput.trim()
    setChatInput('')
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }])
    setChatLoading(true)

    try {
      const data = await api.post('/luna/chat', { message: userMsg, module: moduleKey })
      setChatHistory(prev => [...prev, { role: 'luna', text: data.response }])
    } catch {
      setChatHistory(prev => [...prev, { role: 'luna', text: 'Desculpe, tive um erro de conexão. Tente novamente em instantes.' }])
    } finally {
      setChatLoading(false)
    }
  }

  return (
    <>
      {/* ── CURSOR INLINE ── */}
      {cursorPos && tourRunning && (
        <>
          {/* Overlay escuro — bloqueia scroll/touch */}
          <div style={{
            position: 'fixed', inset: 0, zIndex: 99990,
            background: 'rgba(0,0,0,0.5)', transition: 'opacity 0.4s',
            touchAction: 'none', overscrollBehavior: 'none',
          }} onTouchMove={e => e.preventDefault()} />
          {/* Highlight do elemento */}
          <div style={{
            position: 'fixed',
            left: cursorPos.rect.x, top: cursorPos.rect.y,
            width: cursorPos.rect.w, height: cursorPos.rect.h,
            border: '2px solid #ef4444', borderRadius: 8,
            boxShadow: '0 0 30px rgba(239,68,68,0.4), 0 0 0 9999px rgba(0,0,0,0.55)',
            zIndex: 99991, pointerEvents: 'none',
            transition: 'all 0.6s ease',
            animation: 'ghost-pulse 1.5s ease-in-out infinite',
          }} />
          {/* Cursor vermelho */}
          <div style={{
            position: 'fixed',
            left: cursorPos.x - 14, top: cursorPos.y + 12,
            zIndex: 99998, pointerEvents: 'none',
            transition: 'left 0.6s ease, top 0.6s ease',
            filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.6))',
          }}>
            <svg viewBox="0 0 24 24" width={36} height={36} fill="none">
              <path d="M5.5 3.5L20 12L13 13.5L10 20L5.5 3.5Z"
                fill="#ef4444" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          </div>
          {/* Label */}
          <div style={{
            position: 'fixed',
            left: Math.min(cursorPos.x + 24, window.innerWidth - 250),
            top: Math.min(cursorPos.y + 48, window.innerHeight - 60),
            zIndex: 99999, pointerEvents: 'none',
            background: 'linear-gradient(135deg, #ef4444, #dc2626)',
            color: 'white', fontSize: 12, fontWeight: 700, fontFamily: 'Inter, sans-serif',
            padding: '8px 16px', borderRadius: 12, whiteSpace: 'nowrap',
            boxShadow: '0 4px 24px rgba(239,68,68,0.5)',
            transition: 'left 0.6s ease, top 0.6s ease',
          }}>
            👆 {cursorPos.label}
            <span style={{ marginLeft: 10, opacity: 0.7, fontSize: 10 }}>
              {cursorPos.idx + 1}/{cursorPos.total}
            </span>
          </div>
        </>
      )}

      {/* ── BARRA PARAR TOUR ── */}
      {tourRunning && (
        <div className="tour-control-bar">
          <div className="tour-info">
            <span className="tour-dot" />
            <span className="tour-label">🌙 {tourLabel}</span>
            <span className="tour-count">{tourProgress.current}/{tourProgress.total}</span>
          </div>
          <button className="tour-stop-btn" onClick={() => { stopTour(); setOpen(true) }}>
            ✕ Parar Tour
          </button>
        </div>
      )}

      {/* ── LUNA BUBBLE ── */}
      <div 
        className={`luna-bubble ${open ? 'open' : ''} ${tutorialMode ? 'tutorial-active' : ''}`}
        onClick={() => tutorialMode ? endTutorial() : setOpen(!open)}
      >
        {!tutorialMode && <div className="luna-ping"></div>}
        {tutorialMode ? <X size={24} color="white" /> : <Sparkles size={24} color="white" />}
      </div>

      {/* ── TUTORIAL OVERLAY ── */}
      {tutorialMode && tutorialData?.steps?.[currentStep] && (
        <div className="tutorial-tooltip">
          <div className="tooltip-header">
             <GraduationCap size={16} />
             <span>Luna: {tutorialData.title}</span>
          </div>
          <div className="tooltip-body">
            {tutorialData.steps[currentStep].text}
            {(tutorialData.audio_url || tutorialData.steps[currentStep].audio_url) && (
              <div className="audio-control-mini" onClick={toggleAudio}>
                {isPlaying ? <AudioLines size={14} className="playing-anim" /> : <Play size={14} />}
                <span>{isPlaying ? 'Ouvindo Luna...' : 'Ouvir novamente'}</span>
              </div>
            )}
          </div>
          <div className="tooltip-footer">
            <span className="step-indicator">Passo {currentStep + 1} de {tutorialData.steps.length}</span>
            <button onClick={nextStep} className="next-btn">
              {currentStep < tutorialData.steps.length - 1 ? 'Próximo' : 'Concluir'}
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── LUNA PANEL (Onboarding & Help) ── */}
      {open && (
        <div className="luna-panel" ref={panelRef}>
          <div className="panel-header">
            <div className="avatar-circle">🌙</div>
            <div className="header-info">
              <div className="luna-name">Assistente Luna</div>
              <div className="luna-status">Online • Sua copiloto IA</div>
            </div>
            <button onClick={() => setOpen(false)} className="close-panel"><X size={18} /></button>
          </div>

          <div className="panel-content">
            
            {/* ETAPA 0: Seleção de Modo */}
            {!mode && (
              <div className="onboarding-flow">
                <div className="welcome-text">Bem-vindo à SmartMoon! 🚀</div>
                <p>Como você prefere explorar nossa plataforma hoje?</p>
                <div className="mode-options">
                  <button className="mode-card tutorial" onClick={() => selectMode('tutorial')}>
                    <div className="mode-icon"><Play size={20} /></div>
                    <div className="mode-info">
                      <strong>Modo Tutorial</strong>
                      <span>Eu te guio em cada etapa e mostro os recursos.</span>
                    </div>
                  </button>
                  <button className="mode-card pro" onClick={() => selectMode('pro')}>
                    <div className="mode-icon"><ShieldCheck size={20} /></div>
                    <div className="mode-info">
                      <strong>Modo Profissional</strong>
                      <span>Já conheço o sistema, quero ir direto ao trabalho.</span>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* ETAPA 1: Apresentação Luna */}
            {mode === 'tutorial' && onboardingStep === 1 && (
              <div className="luna-intro">
                <div className="intro-anim">✨</div>
                <div className="intro-title">OLÁ, EU SOU LUNA!</div>
                <div className="intro-subtitle">Agente de Tutorial da SmartMoon</div>
                <p className="intro-text">
                  Estou aqui para garantir que você aproveite 100% da nossa tecnologia. 
                  Vou te acompanhar em cada módulo, explicando como transformar seu negócio com IA.
                </p>
                <button className="start-btn" onClick={() => setOnboardingStep(2)}>
                  Vamos começar? <ChevronRight size={18} />
                </button>
              </div>
            )}

            {/* ETAPA 2: Seleção de Módulo ou Ajuda */}
            {(mode === 'pro' || onboardingStep === 2) && (
              <div className="main-help">
                
                {/* ── Chat with Luna ── */}
                <div className="luna-chat-section">
                  <div className="section-title">Conversar com Luna</div>
                  <div className="chat-log">
                    {chatHistory.length === 0 && (
                      <div className="empty-chat">
                        Olá! 🌙 Pergunte qualquer coisa sobre a plataforma.<br/>Conheço todos os módulos em detalhes!
                      </div>
                    )}
                    {chatHistory.map((h, i) => (
                      <div key={i} className={`msg-bubble ${h.role}`}>
                        {h.text}
                      </div>
                    ))}
                    {chatLoading && <div className="msg-bubble luna loading">...</div>}
                    <div ref={chatEndRef} />
                  </div>
                  <form className="chat-input-area" onSubmit={handleChat}>
                    <input 
                      type="text" 
                      placeholder="Pergunte algo para a Luna..." 
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                    />
                    <button type="submit" disabled={chatLoading}><Send size={16} /></button>
                  </form>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div className="section-title">Aprender Módulos</div>
                  <button onClick={resetLuna} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 10, cursor: 'pointer', marginTop: 10 }}>Trocar Modo</button>
                </div>
                <div className="module-grid">
                  {[
                    { key: 'dashboard', label: 'Dashboard', icon: Layout, path: '/' },
                    { key: 'flow_builder', label: 'Fluxos', icon: GitBranch, path: '/flows' },
                    { key: 'chat', label: 'Chat IA', icon: MessageCircle, path: '/chat' },
                    { key: 'agents', label: 'Agentes', icon: Cpu, path: '/agents' },
                    { key: 'integrations', label: 'Canais', icon: Settings, path: '/integrations' },
                    { key: 'payments', label: 'Financeiro', icon: BarChart3, path: '/payments' },
                    { key: 'bids', label: 'Licitações', icon: ShoppingBag, path: '/bids' },
                  ].map(m => (
                    <button key={m.key} className={`module-btn ${moduleKey === m.key ? 'active' : ''}`}
                      onClick={() => {
                        if (location.pathname !== m.path) navigate(m.path)
                        startTutorial(m.key)
                      }}>
                      <m.icon size={16} />
                      <span>{m.label}</span>
                    </button>
                  ))}
                </div>

                <div className="section-title">Dúvidas Frequentes</div>
                <div className="faq-list">
                  {faqData.map((item, idx) => (
                    <div key={idx} className={`faq-item ${activeFaq === idx ? 'active' : ''}`} onClick={() => {
                      const wasOpen = activeFaq === idx
                      setActiveFaq(wasOpen ? null : idx)
                      
                      // Parar áudio anterior
                      if (audioRef.current) { audioRef.current.pause(); setIsPlaying(false) }
                      
                      if (!wasOpen) {
                        // Iniciar tour inline se tem tour
                        if (item.tour_config?.steps?.length > 0) {
                          const audioUrl = (item.audio_ready && item.audio_path)
                            ? `${LUNA_API}/luna/audio/${item.audio_path}?t=${Date.now()}` : null
                          const allSteps = item.tour_config.steps.map((s, i) => ({
                            selector: s.selector,
                            label: s.label || item.question,
                            audioUrl,
                            isFirstStep: i === 0,
                          }))
                          stopTour()
                          tourAllStepsRef.current = allSteps
                          tourStepIdxRef.current = 0
                          setTourRunning(true)
                          setOpen(false)
                          setTimeout(pointCursor, 400)
                        }
                        
                        // Auto-play áudio se disponível
                        if (item.audio_ready && item.audio_path) {
                          const audioUrl = `${LUNA_API}/luna/audio/${item.audio_path}?t=${Date.now()}`
                          audioRef.current.src = audioUrl
                          audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {})
                          audioRef.current.onended = () => setIsPlaying(false)
                        }
                      } else {
                        // Fechou — parar tour
                        stopTour()
                      }
                    }}>
                      <div className="faq-question">
                        <HelpCircle size={14} color={lunaColor} />
                        <span>{item.question}</span>
                        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
                          {item.audio_ready && (
                            <span className="faq-badge" style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', borderColor: 'rgba(34,197,94,0.2)' }}>
                              🔊
                            </span>
                          )}
                          {item.tour_config?.steps?.length > 0 && (
                            <span className="faq-badge" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', borderColor: 'rgba(239,68,68,0.2)' }}>
                              🎯 Tour
                            </span>
                          )}
                        </div>
                      </div>
                      {activeFaq === idx && (
                        <div>
                          <div className="faq-answer">{item.answer}</div>
                          {/* Mini Audio Player */}
                          {item.audio_ready && isPlaying && activeFaq === idx && (
                            <div className="luna-audio-player">
                              <div className="audio-wave">
                                <span /><span /><span /><span /><span />
                              </div>
                              <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 600 }}>Luna está falando...</span>
                              <button className="audio-stop-btn" onClick={(e) => {
                                e.stopPropagation()
                                audioRef.current.pause()
                                setIsPlaying(false)
                              }}>⏹</button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="panel-footer">
            <AudioLines size={14} color={lunaColor} />
            <span>Alguma dúvida? <a href="https://wa.me/5511999999999" target="_blank">Falar com Suporte</a></span>
          </div>
        </div>
      )}

      {/* ── STYLING ── */}
      <style jsx>{`
        .luna-bubble {
          position: fixed; bottom: 30px; right: 30px; width: 60px; height: 60px;
          border-radius: 50%; background: linear-gradient(135deg, ${lunaColor}, ${cyanColor});
          box-shadow: 0 10px 30px rgba(139, 92, 246, 0.5); cursor: pointer; z-index: 10000;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        @media (max-width: 768px) {
          .luna-bubble { bottom: 80px; right: 20px; width: 54px; height: 54px; }
          .luna-panel { bottom: 145px !important; right: 10px !important; width: calc(100% - 20px) !important; max-height: 70vh !important; }
        }
        .luna-bubble:hover { transform: scale(1.1) translateY(-5px); }
        .luna-bubble.tutorial-active { background: #ef4444; box-shadow: 0 10px 30px rgba(239, 68, 68, 0.4); }
        .luna-ping {
          position: absolute; width: 100%; height: 100%; border-radius: 50%;
          background: ${lunaColor}; opacity: 0.4; z-index: -1;
          animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        @keyframes ping { 75%, 100% { transform: scale(1.8); opacity: 0; } }
        @keyframes ghost-pulse {
          0%, 100% { box-shadow: 0 0 30px rgba(239,68,68,0.3), 0 0 0 9999px rgba(0,0,0,0.55); }
          50%      { box-shadow: 0 0 50px rgba(239,68,68,0.6), 0 0 0 9999px rgba(0,0,0,0.55); border-color: #f87171; }
        }

        .luna-panel {
          position: fixed; bottom: 100px; right: 30px; width: 380px; max-height: 620px;
          background: rgba(13, 10, 31, 0.98); backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 24px;
          display: flex; flex-direction: column; z-index: 9999;
          box-shadow: 0 20px 60px rgba(0,0,0,0.6); overflow: hidden;
          animation: scaleUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        @keyframes scaleUp { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }

        .panel-header {
          padding: 24px; background: linear-gradient(135deg, rgba(139,92,246,0.15), rgba(6,182,212,0.05));
          display: flex; align-items: center; gap: 14px; border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .avatar-circle {
          width: 48px; height: 48px; border-radius: 50%;
          background: linear-gradient(135deg, ${lunaColor}, ${cyanColor});
          display: flex; align-items: center; justify-content: center; font-size: 24px;
          box-shadow: 0 4px 15px rgba(139, 92, 246, 0.4);
        }
        .luna-name { font-size: 16px; font-weight: 900; color: white; letter-spacing: -0.5px; }
        .luna-status { font-size: 11px; color: ${cyanColor}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
        .close-panel { background: none; border: none; color: #64748b; cursor: pointer; transition: color 0.2s; }
        .close-panel:hover { color: white; }

        .panel-content { padding: 24px; overflow-y: auto; flex: 1; scrollbar-width: thin; }
        
        .welcome-text { font-size: 20px; font-weight: 900; color: white; margin-bottom: 8px; }
        .onboarding-flow p { font-size: 14px; color: #94a3b8; margin-bottom: 24px; line-height: 1.5; }
        .mode-options { display: flex; flex-direction: column; gap: 12px; }
        .mode-card {
          display: flex; align-items: center; gap: 16px; padding: 18px;
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 16px; cursor: pointer; transition: all 0.2s; text-align: left; width: 100%;
        }
        .mode-card:hover { background: rgba(255,255,255,0.06); border-color: ${lunaColor}60; transform: translateY(-2px); }
        .mode-icon { width: 44px; height: 44px; border-radius: 12px; background: rgba(139,92,246,0.1); display: flex; align-items: center; justify-content: center; color: ${lunaColor}; }
        .mode-info strong { display: block; font-size: 14px; color: white; margin-bottom: 2px; }
        .mode-info span { font-size: 12px; color: #64748b; line-height: 1.3; }

        .luna-intro { text-align: center; padding: 10px 0; }
        .intro-anim { font-size: 40px; margin-bottom: 16px; animation: bounce 2s infinite; }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        .intro-title { font-size: 22px; font-weight: 900; color: white; margin-bottom: 4px; }
        .intro-subtitle { font-size: 12px; font-weight: 700; color: ${lunaColor}; text-transform: uppercase; margin-bottom: 20px; }
        .intro-text { font-size: 14px; color: #94a3b8; line-height: 1.6; margin-bottom: 28px; }
        .start-btn {
          width: 100%; padding: 14px; border-radius: 14px; background: ${lunaColor}; border: none;
          color: white; font-weight: 800; font-size: 15px; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer;
        }

        .section-title { font-size: 11px; font-weight: 800; color: #475569; text-transform: uppercase; margin: 20px 0 12px; letter-spacing: 1px; }
        .module-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
        .module-btn {
          padding: 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px; color: #94a3b8; display: flex; align-items: center; gap: 10px; cursor: pointer; transition: all 0.2s;
        }
        .module-btn:hover { background: rgba(139,92,246,0.1); color: white; border-color: ${lunaColor}40; }
        .module-btn.active { background: rgba(139,92,246,0.2); color: white; border-color: ${lunaColor}; }
        .module-btn span { font-size: 12px; font-weight: 600; }

        /* Luna Chat Section */
        .luna-chat-section { background: rgba(255,255,255,0.03); border-radius: 16px; padding: 16px; border: 1px solid rgba(255,255,255,0.06); margin-top: 10px; }
        .chat-log { height: 180px; overflow-y: auto; margin-bottom: 12px; display: flex; flex-direction: column; gap: 8px; padding-right: 4px; }
        .empty-chat { font-size: 12px; color: #64748b; text-align: center; margin-top: 40px; }
        .msg-bubble { padding: 8px 12px; border-radius: 12px; font-size: 12px; max-width: 85%; line-height: 1.4; animation: fadeIn 0.2s ease; }
        .msg-bubble.user { background: ${lunaColor}; color: white; align-self: flex-end; border-bottom-right-radius: 2px; }
        .msg-bubble.luna { background: rgba(255,255,255,0.1); color: #cbd5e1; align-self: flex-start; border-bottom-left-radius: 2px; }
        .msg-bubble.loading { opacity: 0.5; font-style: italic; }
        .chat-input-area { display: flex; gap: 8px; }
        .chat-input-area input { flex: 1; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 8px 12px; color: white; font-size: 12px; outline: none; }
        .chat-input-area input:focus { border-color: ${lunaColor}80; }
        .chat-input-area button { background: ${lunaColor}; border: none; width: 34px; height: 34px; border-radius: 10px; color: white; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: transform 0.2s; }
        .chat-input-area button:hover { transform: scale(1.05); }

        .faq-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 20px; }
        .faq-item { padding: 12px; background: rgba(255,255,255,0.02); border-radius: 12px; cursor: pointer; transition: background 0.2s; border: 1px solid transparent; }
        .faq-item:hover { background: rgba(255,255,255,0.05); }
        .faq-item.active { background: rgba(139,92,246,0.05); border-color: ${lunaColor}20; }
        .faq-question { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; color: #cbd5e1; }
        .faq-answer { font-size: 11px; color: #94a3b8; line-height: 1.5; margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,255,255,0.05); animation: fadeIn 0.2s ease; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-5px); } to { opacity: 1; transform: translateY(0); } }

        .faq-badge { font-size: 9px; padding: 2px 8px; border-radius: 10px; font-weight: 700; border: 1px solid; white-space: nowrap; }

        .luna-audio-player {
          display: flex; align-items: center; gap: 10px; margin-top: 10px; padding: 8px 12px;
          background: rgba(34,197,94,0.06); border: 1px solid rgba(34,197,94,0.15);
          border-radius: 10px; animation: fadeIn 0.3s ease;
        }
        .audio-wave { display: flex; align-items: flex-end; gap: 2px; height: 16px; }
        .audio-wave span {
          display: block; width: 3px; background: #22c55e; border-radius: 2px;
          animation: audioWave 0.8s ease-in-out infinite;
        }
        .audio-wave span:nth-child(1) { height: 6px; animation-delay: 0s; }
        .audio-wave span:nth-child(2) { height: 12px; animation-delay: 0.1s; }
        .audio-wave span:nth-child(3) { height: 16px; animation-delay: 0.2s; }
        .audio-wave span:nth-child(4) { height: 10px; animation-delay: 0.3s; }
        .audio-wave span:nth-child(5) { height: 8px; animation-delay: 0.4s; }
        @keyframes audioWave {
          0%, 100% { transform: scaleY(0.4); }
          50% { transform: scaleY(1); }
        }
        .audio-stop-btn {
          margin-left: auto; background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3);
          color: #ef4444; border-radius: 6px; width: 24px; height: 24px; cursor: pointer;
          display: flex; align-items: center; justify-content: center; font-size: 10px;
          transition: all 0.2s;
        }
        .audio-stop-btn:hover { background: rgba(239,68,68,0.3); }

        .tutorial-tooltip {
          position: fixed; bottom: 110px; right: 30px; width: 340px; background: rgba(15, 12, 41, 0.98);
          backdrop-filter: blur(20px); border: 1px solid ${lunaColor}; border-radius: 18px;
          padding: 20px; box-shadow: 0 20px 40px rgba(0,0,0,0.5); z-index: 10001;
          animation: slideIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }
        @keyframes slideIn { from { transform: translateX(30px) scale(0.9); opacity: 0; } to { transform: translateX(0) scale(1); opacity: 1; } }
        .tooltip-header { display: flex; align-items: center; gap: 8px; color: ${lunaColor}; font-size: 11px; font-weight: 800; text-transform: uppercase; margin-bottom: 12px; }
        .tooltip-body { color: white; font-size: 14px; line-height: 1.5; margin-bottom: 16px; font-weight: 500; }
        .tooltip-footer { display: flex; align-items: center; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 14px; }
        .step-indicator { font-size: 11px; color: #64748b; font-weight: 700; }
        .next-btn { background: ${lunaColor}; border: none; border-radius: 10px; padding: 8px 16px; color: white; font-weight: 800; font-size: 13px; display: flex; align-items: center; gap: 6px; cursor: pointer; }

        .audio-control-mini { display: flex; align-items: center; gap: 8px; margin-top: 12px; color: ${cyanColor}; font-size: 11px; font-weight: 700; cursor: pointer; opacity: 0.8; transition: opacity 0.2s; }
        .audio-control-mini:hover { opacity: 1; }
        .playing-anim { animation: pulse 1s infinite; }
        @keyframes pulse { 0% { transform: scale(1); } 50% { transform: scale(1.1); } 100% { transform: scale(1); } }

        /* Highlight & Spotlight */
        .luna-highlight { 
          position: relative; z-index: 10002 !important; 
          box-shadow: 0 0 0 4px ${lunaColor}, 0 0 40px ${lunaColor}60 !important;
          border-radius: 8px;
          transition: all 0.3s ease;
        }
        .luna-overlay-spotlight {
          position: absolute; pointer-events: none;
          box-shadow: 0 0 0 9999px rgba(0,0,0,0.7);
          z-index: 10000;
          border-radius: 8px;
          transition: all 0.3s ease;
        }

        /* ── Tour Control Bar ── */
        .tour-control-bar {
          position: fixed;
          bottom: 0; left: 0; right: 0;
          z-index: 100000;
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 24px;
          background: linear-gradient(135deg, rgba(15,23,42,0.97), rgba(30,41,59,0.97));
          border-top: 1px solid rgba(139,92,246,0.3);
          backdrop-filter: blur(12px);
          box-shadow: 0 -4px 30px rgba(0,0,0,0.4);
          animation: tour-bar-in 0.4s ease-out;
        }
        @keyframes tour-bar-in {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0); opacity: 1; }
        }
        .tour-info {
          display: flex; align-items: center; gap: 10px;
          color: #e2e8f0; font-size: 13px; font-weight: 600;
          font-family: Inter, sans-serif;
        }
        .tour-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: #22c55e;
          animation: tour-dot-pulse 1.2s ease-in-out infinite;
        }
        @keyframes tour-dot-pulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(34,197,94,0.4); }
          50%       { opacity: 0.7; box-shadow: 0 0 0 6px rgba(34,197,94,0); }
        }
        .tour-label { color: #c4b5fd; max-width: 400px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .tour-count {
          background: rgba(139,92,246,0.2); color: #a78bfa;
          padding: 2px 10px; border-radius: 10px; font-size: 11px; font-weight: 700;
        }
        .tour-stop-btn {
          background: rgba(239,68,68,0.15); color: #f87171;
          border: 1px solid rgba(239,68,68,0.3); border-radius: 8px;
          padding: 8px 20px; font-size: 13px; font-weight: 700;
          cursor: pointer; transition: all 0.2s;
          font-family: Inter, sans-serif;
        }
        .tour-stop-btn:hover {
          background: rgba(239,68,68,0.3); color: #fca5a5;
          transform: scale(1.05);
        }
      `}</style>
    </>
  )
}
