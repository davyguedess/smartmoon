import { Handle, Position } from '@xyflow/react'
import { NxIcon } from './TriggerNode'

export default function LunaNode({ data, selected }) {
  // Cores premium para a Luna: Indigo/Violet
  const lunaColor = '#8b5cf6'; 

  return (
    <div className={`nx-node nx-luna ${selected ? 'selected' : ''}`} style={{
      borderColor: selected ? lunaColor : 'rgba(139, 92, 246, 0.3)',
      boxShadow: selected ? `0 0 15px rgba(139, 92, 246, 0.4)` : 'none'
    }}>
      {data.onDelete && (
        <button className="nx-node-delete" onClick={data.onDelete} title="Remover nó">×</button>
      )}
      
      <Handle type="target" position={Position.Left} id="in" style={{ background: lunaColor }} />
      
      <div className="nx-node-header">
        <div className="nx-node-icon" style={{ background: 'rgba(139, 92, 246, 0.1)', border: `1px solid ${lunaColor}` }}>
          {/* Ícone de Onda Sonora / Voz */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={lunaColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <line x1="12" y1="19" x2="12" y2="23"/>
            <line x1="8" y1="23" x2="16" y2="23"/>
          </svg>
        </div>
        <div className="nx-node-title-wrap">
          <div className="nx-node-tag" style={{ background: lunaColor, color: '#fff' }}>LUNA VOICE</div>
          <div className="nx-node-title" style={{ color: '#e2e8f0' }}>{data.label || 'Assistente Luna'}</div>
        </div>
      </div>

      <div className="nx-node-body">
        <div className="nx-node-detail" style={{ color: '#94a3b8', fontSize: '11px', marginBottom: '8px' }}>
          {data.mode === 'tutorial' ? '🎓 Modo Tutorial Ativado' : '💬 Conversação por Voz'}
        </div>
        
        <div className="nx-node-voice-waves">
            {/* Visualização fake de ondas sonoras para efeito visual premium */}
            <div className="wave-bar"></div>
            <div className="wave-bar"></div>
            <div className="wave-bar"></div>
            <div className="wave-bar"></div>
            <div className="wave-bar"></div>
        </div>

        {data.voice && (
          <div className="nx-node-chip" style={{ background: 'rgba(139, 92, 246, 0.1)', color: lunaColor, border: `1px solid rgba(139, 92, 246, 0.2)` }}>
             Voz: {data.voice}
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Right} id="out" style={{ background: lunaColor }} />
      
      <style jsx>{`
        .nx-node-voice-waves {
          display: flex;
          align-items: center;
          gap: 3px;
          height: 12px;
          margin-bottom: 8px;
        }
        .wave-bar {
          width: 3px;
          background: ${lunaColor};
          border-radius: 2px;
          animation: wave 1.2s infinite ease-in-out;
        }
        .wave-bar:nth-child(1) { height: 4px; animation-delay: 0s; }
        .wave-bar:nth-child(2) { height: 10px; animation-delay: 0.1s; }
        .wave-bar:nth-child(3) { height: 7px; animation-delay: 0.2s; }
        .wave-bar:nth-child(4) { height: 12px; animation-delay: 0.3s; }
        .wave-bar:nth-child(5) { height: 5px; animation-delay: 0.4s; }

        @keyframes wave {
          0%, 100% { transform: scaleY(1); opacity: 0.5; }
          50% { transform: scaleY(1.5); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
