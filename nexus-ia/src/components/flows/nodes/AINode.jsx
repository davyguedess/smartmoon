import { Handle, Position } from '@xyflow/react'
import { NxIcon } from './TriggerNode'

export default function AINode({ data, selected }) {
  return (
    <div className={`nx-node nx-ai ${selected ? 'selected' : ''}`}>
      {data.onDelete && (
        <button className="nx-node-delete" onClick={data.onDelete} title="Remover nó">×</button>
      )}
      <Handle type="target" position={Position.Left} id="in" />
      <div className="nx-node-header">
        <div className="nx-node-icon">
          <NxIcon subtype={data.subtype} nodeType="ai" />
        </div>
        <div className="nx-node-title-wrap">
          <div className="nx-node-tag">IA</div>
          <div className="nx-node-title">{data.label}</div>
        </div>
      </div>
      <div className="nx-node-body">
        <div className="nx-node-detail">{data.detail}</div>
        {data.model && (
          <div className="nx-node-chip" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 3"/></svg>
            {data.model}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  )
}
