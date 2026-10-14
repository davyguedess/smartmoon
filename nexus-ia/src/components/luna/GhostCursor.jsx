/**
 * GhostCursor v6 — Ref-based, zero closure issues.
 * 100% automático, avança sozinho, só para via active=false.
 */
import React, { useEffect, useRef, useState } from 'react'

const CURSOR_SIZE = 36
const STEP_DURATION = 3500

export default function GhostCursor({ steps = [], onStepComplete, onTourEnd, active }) {
  const [pos, setPos]           = useState({ x: -200, y: -200 })
  const [targetRect, setTarget] = useState(null)
  const [label, setLabel]       = useState('')
  const [stepIdx, setStepIdx]   = useState(0)
  const [visible, setVisible]   = useState(false)

  // Refs para evitar closures obsoletas
  const stepsRef      = useRef(steps)
  const activeRef     = useRef(false)
  const onTourEndRef  = useRef(onTourEnd)
  const onStepRef     = useRef(onStepComplete)
  const timerIds      = useRef([])

  // Sempre atualizar refs quando props mudam
  stepsRef.current     = steps
  onTourEndRef.current = onTourEnd
  onStepRef.current    = onStepComplete

  function clearTimers() {
    timerIds.current.forEach(clearTimeout)
    timerIds.current = []
  }

  function hide() {
    clearTimers()
    setVisible(false)
    setTarget(null)
    setLabel('')
    setPos({ x: -200, y: -200 })
    setStepIdx(0)
  }

  function schedule(fn, ms) {
    const id = setTimeout(() => {
      if (activeRef.current) fn()
    }, ms)
    timerIds.current.push(id)
  }

  function runTour() {
    if (!activeRef.current) return
    const allSteps = stepsRef.current
    if (!allSteps || allSteps.length === 0) return

    let idx = 0

    function goToStep() {
      if (!activeRef.current) return
      if (idx >= allSteps.length) {
        // Tour acabou
        hide()
        activeRef.current = false
        onTourEndRef.current?.()
        return
      }

      const step = allSteps[idx]
      setStepIdx(idx)

      // Encontrar elemento
      const el = document.querySelector(step.selector)
      if (!el) {
        // Pular step, tentar próximo
        idx++
        schedule(goToStep, 200)
        return
      }

      // Scroll até o elemento
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })

      // Aguardar scroll e posicionar cursor
      schedule(() => {
        if (!activeRef.current) return
        const rect = el.getBoundingClientRect()
        setPos({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
        setTarget({
          x: rect.left - 6, y: rect.top - 6,
          w: rect.width + 12, h: rect.height + 12,
          r: Math.min(12, rect.height / 4)
        })
        setLabel(step.label || '')
        setVisible(true)
        onStepRef.current?.(idx)

        // Auto-avançar após STEP_DURATION
        idx++
        schedule(goToStep, STEP_DURATION)
      }, 500)
    }

    // Iniciar com pequeno delay
    schedule(goToStep, 300)
  }

  // Efeito principal
  useEffect(() => {
    console.log('[GhostCursor] useEffect fired — active:', active, 'steps:', steps.length)
    if (active && steps.length > 0) {
      console.log('[GhostCursor] STARTING tour with', steps.length, 'steps:', steps.map(s => s.selector))
      hide()
      activeRef.current = true
      runTour()
    } else {
      activeRef.current = false
      hide()
    }
    return () => {
      activeRef.current = false
      clearTimers()
    }
  }, [active, steps])

  if (!visible) return null

  return (
    <>
      {/* OVERLAY */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 99990,
        pointerEvents: 'none',
        background: 'rgba(0,0,0,0.5)',
        transition: 'opacity 0.4s',
        maskImage: targetRect
          ? `radial-gradient(ellipse ${targetRect.w * 0.7}px ${targetRect.h * 0.7}px at ${targetRect.x + targetRect.w / 2}px ${targetRect.y + targetRect.h / 2}px, transparent 60%, black 100%)`
          : 'none',
        WebkitMaskImage: targetRect
          ? `radial-gradient(ellipse ${targetRect.w * 0.7}px ${targetRect.h * 0.7}px at ${targetRect.x + targetRect.w / 2}px ${targetRect.y + targetRect.h / 2}px, transparent 60%, black 100%)`
          : 'none',
      }} />

      {/* HIGHLIGHT */}
      {targetRect && (
        <div style={{
          position: 'fixed',
          left: targetRect.x, top: targetRect.y,
          width: targetRect.w, height: targetRect.h,
          borderRadius: targetRect.r,
          border: '2px solid #ef4444',
          boxShadow: '0 0 20px rgba(239,68,68,0.4)',
          zIndex: 99991, pointerEvents: 'none',
          transition: 'all 0.5s ease',
          animation: 'ghost-pulse 1.5s ease-in-out infinite',
        }} />
      )}

      {/* CURSOR */}
      <div style={{
        position: 'fixed',
        left: pos.x - CURSOR_SIZE / 2 + 4,
        top: pos.y + 10,
        width: CURSOR_SIZE, height: CURSOR_SIZE,
        zIndex: 99998, pointerEvents: 'none',
        transition: 'left 0.6s ease, top 0.6s ease',
        filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.6))',
      }}>
        <svg viewBox="0 0 24 24" width={CURSOR_SIZE} height={CURSOR_SIZE} fill="none">
          <path d="M5.5 3.5L20 12L13 13.5L10 20L5.5 3.5Z"
            fill="#ef4444" stroke="white" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      </div>

      {/* LABEL */}
      {label && (
        <div style={{
          position: 'fixed',
          left: Math.min(pos.x + CURSOR_SIZE / 2 + 12, window.innerWidth - 230),
          top: Math.min(pos.y + CURSOR_SIZE + 16, window.innerHeight - 60),
          zIndex: 99999, pointerEvents: 'none',
          background: 'linear-gradient(135deg, #ef4444, #dc2626)',
          color: 'white', fontSize: 12, fontWeight: 700, fontFamily: 'Inter, sans-serif',
          padding: '8px 16px', borderRadius: 12,
          whiteSpace: 'nowrap',
          boxShadow: '0 4px 24px rgba(239,68,68,0.5)',
          animation: 'ghost-label-in 0.4s ease-out',
          transition: 'left 0.6s ease, top 0.6s ease',
        }}>
          <span style={{ marginRight: 6 }}>👆</span>
          {label}
          {stepsRef.current.length > 1 && (
            <span style={{ marginLeft: 10, opacity: 0.7, fontSize: 10 }}>
              {stepIdx + 1}/{stepsRef.current.length}
            </span>
          )}
          <div style={{
            position: 'absolute', top: -6, left: 16,
            width: 12, height: 12, background: '#ef4444',
            transform: 'rotate(45deg)', borderRadius: 2,
          }} />
        </div>
      )}

      <style>{`
        @keyframes ghost-label-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes ghost-pulse {
          0%, 100% { box-shadow: 0 0 20px rgba(239,68,68,0.3); }
          50%      { box-shadow: 0 0 40px rgba(239,68,68,0.6); border-color: #f87171; }
        }
      `}</style>
    </>
  )
}
