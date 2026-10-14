import { useState, useEffect, useRef } from 'react'
import { Cpu, HardDrive, Activity, Brain } from 'lucide-react'

const POLL_MS = 3000

// ── Arc gauge (SVG) ─────────────────────────────────────────────────────────

function ArcGauge({ value, max = 100, color, size = 64, label, sub }) {
  const r = (size - 10) / 2
  const circ = 2 * Math.PI * r
  const arc = circ * 0.75          // 270° arc
  const pct = Math.min(value / max, 1)
  const filled = arc * pct
  const rotation = -225             // start at bottom-left

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: `rotate(${rotation}deg)` }}>
          {/* Track */}
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke="rgba(255,255,255,0.06)"
            strokeWidth={6} strokeDasharray={`${arc} ${circ - arc}`}
            strokeLinecap="round"
          />
          {/* Fill — animated */}
          <circle
            cx={size / 2} cy={size / 2} r={r}
            fill="none" stroke={color}
            strokeWidth={6}
            strokeDasharray={`${filled} ${circ - filled}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.8s ease', filter: `drop-shadow(0 0 4px ${color}80)` }}
          />
        </svg>
        {/* Center value */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 800,
          color: value > 85 ? '#ef4444' : value > 65 ? '#f59e0b' : color,
        }}>
          {Math.round(value)}%
        </div>
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: 0.5 }}>{label}</div>
      {sub && <div style={{ fontSize: 9, color: 'var(--text-muted)', marginTop: -2 }}>{sub}</div>}
    </div>
  )
}

// ── Bar metric ────────────────────────────────────────────────────────────────

function BarMetric({ label, value, max, color, unit = 'GB', icon: Icon }) {
  const pct = Math.min(value / max, 1) * 100
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {Icon && <Icon size={10} color="var(--text-muted)" />}
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: 0.5 }}>{label}</span>
        </div>
        <span style={{ fontSize: 10, color, fontWeight: 800 }}>
          {value.toFixed(1)} / {max.toFixed(0)} {unit}
        </span>
      </div>
      <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 4,
          width: `${pct}%`,
          background: pct > 85 ? '#ef4444' : pct > 65 ? '#f59e0b' : color,
          boxShadow: `0 0 6px ${color}80`,
          transition: 'width 0.8s ease',
        }} />
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SystemMonitor({ compact = false }) {
  const [data, setData] = useState(null)
  const [history, setHistory] = useState({ cpu: [], ram: [] }) // sparkline
  const [error, setError] = useState(false)
  const timerRef = useRef(null)

  const fetch_ = async () => {
    try {
      const res = await fetch('/system/metrics')
      if (!res.ok) throw new Error()
      const d = await res.json()
      setData(d)
      setError(false)
      setHistory(h => ({
        cpu: [...h.cpu.slice(-19), d.cpu.percent],
        ram: [...h.ram.slice(-19), d.ram.percent],
      }))
    } catch {
      setError(true)
    }
  }

  useEffect(() => {
    fetch_()
    timerRef.current = setInterval(fetch_, POLL_MS)
    return () => clearInterval(timerRef.current)
  }, [])

  // Sparkline SVG (20 data points)
  const Sparkline = ({ points, color, h = 24 }) => {
    if (points.length < 2) return null
    const w = 80
    const step = w / (points.length - 1)
    const d = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${i * step},${h - (v / 100) * h}`).join(' ')
    return (
      <svg width={w} height={h} style={{ display: 'block' }}>
        <polyline points={points.map((v, i) => `${i * step},${h - (v / 100) * h}`).join(' ')}
          fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 2px ${color})` }}
        />
      </svg>
    )
  }

  if (!data) {
    return (
      <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, opacity: 0.5 }}>
        <Activity size={12} style={{ animation: 'spin 2s linear infinite' }} color="var(--text-muted)" />
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          {error ? 'Monitor offline' : 'Conectando ao monitor...'}
        </span>
      </div>
    )
  }

  if (compact) {
    // Compact bar for chat page sidebar
    return (
      <div style={{
        padding: '10px 14px',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <Activity size={11} color="var(--nexus-green)" />
          <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-secondary)', letterSpacing: 0.8, textTransform: 'uppercase' }}>
            Sistema
          </span>
          <div style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--text-muted)' }}>
            ao vivo · {POLL_MS / 1000}s
          </div>
        </div>

        <BarMetric label="CPU" value={data.cpu.percent} max={100} color="#3b82f6" unit="%" icon={Cpu} />
        <BarMetric label="RAM" value={data.ram.used_gb} max={data.ram.total_gb} color="#8b5cf6" icon={HardDrive} />
        <BarMetric label="Disco" value={data.disk.used_gb} max={data.disk.total_gb} color="#10b981" icon={HardDrive} />

        {/* Ollama loaded models */}
        {data.ollama.count > 0 && (
          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 7, marginTop: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
              <Brain size={10} color="#f59e0b" />
              <span style={{ fontSize: 9, fontWeight: 700, color: '#f59e0b', letterSpacing: 0.5 }}>
                MODELOS NA RAM ({data.ollama.count})
              </span>
            </div>
            {data.ollama.loaded_models.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                <span style={{ fontSize: 9, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                  {m.name.split(':')[0]}
                </span>
                <span style={{ fontSize: 9, color: '#f59e0b', fontWeight: 700 }}>
                  {m.size_vram ? `${(m.size_vram / 1e9).toFixed(1)}GB` : 'CPU'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Sparklines */}
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <div>
            <div style={{ fontSize: 8, color: 'var(--text-muted)', marginBottom: 2 }}>CPU</div>
            <Sparkline points={history.cpu} color="#3b82f6" />
          </div>
          <div>
            <div style={{ fontSize: 8, color: 'var(--text-muted)', marginBottom: 2 }}>RAM</div>
            <Sparkline points={history.ram} color="#8b5cf6" />
          </div>
        </div>
      </div>
    )
  }

  // Full panel (for Dashboard)
  return (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
      <ArcGauge value={data.cpu.percent} color="#3b82f6" label="CPU" sub={`${data.cpu.threads} threads`} />
      <ArcGauge value={data.ram.percent} color="#8b5cf6" label="RAM"
        sub={`${data.ram.used_gb}/${data.ram.total_gb}GB`} />
      <ArcGauge value={data.disk.percent} color="#10b981" label="Disco"
        sub={`${data.disk.used_gb}/${data.disk.total_gb}GB`} />
    </div>
  )
}
