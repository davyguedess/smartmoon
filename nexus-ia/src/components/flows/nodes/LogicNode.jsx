import { Handle, Position } from '@xyflow/react'
import { NxIcon } from './TriggerNode'

export default function LogicNode({ data, selected }) {
  return (
    <div className={`nx-node nx-logic ${selected ? 'selected' : ''}`}>
      {data.onDelete && (
        <button className="nx-node-delete" onClick={data.onDelete} title="Remover nó">×</button>
      )}
      <Handle type="target" position={Position.Left} id="in" />
      <div className="nx-node-header">
        <div className="nx-node-icon">
          <NxIcon subtype={data.subtype} nodeType="logic" />
        </div>
        <div className="nx-node-title-wrap">
          <div className="nx-node-tag">Lógica</div>
          <div className="nx-node-title">{data.label}</div>
        </div>
      </div>
      <div className="nx-node-body">
        <div className="nx-node-detail">{data.detail}</div>
      </div>
      <Handle type="source" position={Position.Right} id="out-true" style={{ top: '35%', background: 'var(--nexus-green)' }} />
      <Handle type="source" position={Position.Right} id="out-false" style={{ top: '65%', background: '#ef4444' }} />
    </div>
  )
}
