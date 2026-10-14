import { Handle, Position } from '@xyflow/react'
import { NxIcon } from './TriggerNode'

export default function ActionNode({ data, selected }) {
  return (
    <div className={`nx-node nx-action ${selected ? 'selected' : ''}`}>
      {data.onDelete && (
        <button className="nx-node-delete" onClick={data.onDelete} title="Remover nó">×</button>
      )}
      <Handle type="target" position={Position.Left} id="in" />
      <div className="nx-node-header">
        <div className="nx-node-icon">
          <NxIcon subtype={data.subtype} nodeType="action" />
        </div>
        <div className="nx-node-title-wrap">
          <div className="nx-node-tag">Ação</div>
          <div className="nx-node-title">{data.label}</div>
        </div>
      </div>
      <div className="nx-node-body">
        <div className="nx-node-detail">{data.detail}</div>
      </div>
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  )
}
