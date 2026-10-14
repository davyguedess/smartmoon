import { Handle, Position } from '@xyflow/react'
import { NxIcon } from './TriggerNode'

export default function WaitNode({ data, selected }) {
  return (
    <div className={`nx-node nx-wait ${selected ? 'selected' : ''}`}>
      {data.onDelete && (
        <button className="nx-node-delete" onClick={data.onDelete} title="Remover nó">×</button>
      )}
      <Handle type="target" position={Position.Left} id="in" />
      <div className="nx-node-header">
        <div className="nx-node-icon">
          <NxIcon subtype={data.subtype} nodeType="wait" />
        </div>
        <div className="nx-node-title-wrap">
          <div className="nx-node-tag">Espera</div>
          <div className="nx-node-title">{data.label}</div>
        </div>
      </div>
      <div className="nx-node-body">
        <div className="nx-node-detail">{data.detail}</div>
        <div className="nx-node-chip" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          Aguardando
        </div>
      </div>
      <Handle type="source" position={Position.Right} id="out-yes" style={{ top: '35%', background: 'var(--nexus-green)' }} />
      <Handle type="source" position={Position.Right} id="out-no" style={{ top: '65%', background: '#ef4444' }} />
    </div>
  )
}
