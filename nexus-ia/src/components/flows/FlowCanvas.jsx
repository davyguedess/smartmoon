import { useState, useCallback, useRef } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
  Panel,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import TriggerNode from './nodes/TriggerNode'
import AINode from './nodes/AINode'
import ActionNode from './nodes/ActionNode'
import WaitNode from './nodes/WaitNode'
import LogicNode from './nodes/LogicNode'
import SaveModal from './SaveModal'
import { Save, Play, Trash2, ZoomIn } from 'lucide-react'

const nodeTypes = {
  trigger: TriggerNode,
  ai: AINode,
  action: ActionNode,
  wait: WaitNode,
  logic: LogicNode,
}

const initialNodes = [
  {
    id: 'trigger-1',
    type: 'trigger',
    position: { x: 80, y: 180 },
    data: {
      label: 'Mensagem Telegram',
      detail: 'Chat: @diretoria',
      subtype: 'telegram',
      icon: '📱',
    },
  },
  {
    id: 'ai-1',
    type: 'ai',
    position: { x: 340, y: 160 },
    data: {
      label: 'Agente Orquestrador',
      detail: 'Entende intenção e planeja',
      subtype: 'router',
      icon: '🧠',
      model: 'llama3:8b',
    },
  },
  {
    id: 'action-1',
    type: 'action',
    position: { x: 600, y: 80 },
    data: {
      label: 'Gerar Cobrança PIX',
      detail: 'Mercado Pago • R$ 1.500,00',
      subtype: 'mercadopago',
      icon: '💳',
    },
  },
  {
    id: 'action-2',
    type: 'action',
    position: { x: 600, y: 260 },
    data: {
      label: 'Enviar WhatsApp',
      detail: 'Para: João • Link PIX',
      subtype: 'whatsapp',
      icon: '💬',
    },
  },
  {
    id: 'wait-1',
    type: 'wait',
    position: { x: 880, y: 160 },
    data: {
      label: 'Aguardar Pagamento',
      detail: 'Timeout: 24 horas',
      subtype: 'payment',
      icon: '⏳',
    },
  },
  {
    id: 'action-3',
    type: 'action',
    position: { x: 1140, y: 80 },
    data: {
      label: 'Ativar Campanha',
      detail: 'Meta Ads • ID: 1203984',
      subtype: 'meta',
      icon: '📢',
    },
  },
  {
    id: 'action-4',
    type: 'action',
    position: { x: 1140, y: 260 },
    data: {
      label: 'Notificar Equipe',
      detail: 'Telegram • #comercial',
      subtype: 'telegram',
      icon: '🎉',
    },
  },
]

const initialEdges = [
  { id: 'e1', source: 'trigger-1', target: 'ai-1', animated: true },
  { id: 'e2', source: 'ai-1', target: 'action-1' },
  { id: 'e3', source: 'ai-1', target: 'action-2' },
  { id: 'e4', source: 'action-1', target: 'wait-1' },
  { id: 'e5', source: 'action-2', target: 'wait-1' },
  { id: 'e6', source: 'wait-1', target: 'action-3', label: 'Pago!', animated: true },
  { id: 'e7', source: 'wait-1', target: 'action-4' },
]

let nodeIdCounter = 100

export default function FlowCanvas({ onNodeDrop }) {
  const reactFlowWrapper = useRef(null)
  const [rfInstance, setRfInstance] = useState(null)
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [flowData, setFlowData] = useState(null)

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [setEdges]
  )

  const onDragOver = useCallback((event) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event) => {
      event.preventDefault()
      const raw = event.dataTransfer.getData('application/nexus-node')
      if (!raw) return
      const nodeData = JSON.parse(raw)

      const position = rfInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      const newNode = {
        id: `node-${++nodeIdCounter}`,
        type: nodeData.nodeType,
        position,
        data: {
          label: nodeData.label,
          detail: nodeData.detail,
          subtype: nodeData.subtype,
          icon: nodeData.icon,
          model: nodeData.model,
        },
      }

      setNodes((nds) => nds.concat(newNode))
    },
    [rfInstance, setNodes]
  )

  const onDeleteNode = useCallback((nodeId) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId))
    setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId))
  }, [setNodes, setEdges])

  // Pass delete handler down to nodes
  const nodesWithDelete = nodes.map((n) => ({
    ...n,
    data: { ...n.data, onDelete: () => onDeleteNode(n.id) },
  }))

  const handleSaveFlow = () => {
    const triggerNode = nodes.find((n) => n.type === 'trigger')
    const flowName = triggerNode ? `Fluxo via ${triggerNode.data.label}` : `Novo Fluxo ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
    const flowJson = {
      id: `flow_${Date.now()}`,
      name: flowName,
      created_at: new Date().toISOString(),
      trigger: nodes.find((n) => n.type === 'trigger')
        ? {
            type: nodes.find((n) => n.type === 'trigger').data.subtype,
            config: {},
          }
        : null,
      nodes: nodes.map((n) => ({
        id: n.id,
        type: n.type,
        subtype: n.data.subtype,
        label: n.data.label,
        position: n.position,
        config: {
          model: n.data.model || undefined,
          detail: n.data.detail,
        },
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        animated: e.animated,
      })),
    }
    setFlowData(flowJson)
    setShowSaveModal(true)
    console.log('🔶 Smart Moon Flow JSON:', JSON.stringify(flowJson, null, 2))
  }

  const handleClearCanvas = () => {
    setNodes([])
    setEdges([])
  }

  return (
    <div className="canvas-wrap" ref={reactFlowWrapper}>
      <ReactFlow
        nodes={nodesWithDelete}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={setRfInstance}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        deleteKeyCode="Delete"
        multiSelectionKeyCode="Shift"
        defaultEdgeOptions={{
          style: { strokeWidth: 2 },
        }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="rgba(255,255,255,0.06)"
        />
        <Controls />
        <MiniMap
          nodeColor={(n) => {
            if (n.type === 'trigger') return '#10b981'
            if (n.type === 'ai') return '#3b82f6'
            if (n.type === 'action') return '#8b5cf6'
            if (n.type === 'wait') return '#f59e0b'
            return '#6366f1'
          }}
          maskColor="rgba(8, 11, 20, 0.8)"
        />

        {/* Top center bar */}
        <Panel position="top-center">
          <div className="canvas-top-bar canvas-floating">
            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
              {nodes.length} nó{nodes.length !== 1 ? 's' : ''} · {edges.length} conexão{edges.length !== 1 ? 'ões' : ''}
            </span>
          </div>
        </Panel>

        {/* Bottom right FABs */}
        <Panel position="bottom-right">
          <div style={{ display: 'flex', gap: 10, marginBottom: 60 }}>
            <button className="fab" onClick={handleClearCanvas}
              style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}>
              <Trash2 size={14} />
              Limpar
            </button>
            <button className="fab run" onClick={() => alert('Execução de teste iniciada!')}>
              <Play size={14} />
              Testar
            </button>
            <button className="fab save" onClick={handleSaveFlow}>
              <Save size={14} />
              Salvar Fluxo
            </button>
          </div>
        </Panel>
      </ReactFlow>

      {/* Empty state */}
      {nodes.length === 0 && (
        <div className="canvas-empty visible">
          <div className="canvas-empty-icon">🧩</div>
          <h3>Canvas vazio</h3>
          <p>Arraste blocos da barra lateral para começar</p>
        </div>
      )}

      {showSaveModal && (
        <SaveModal
          data={flowData}
          onClose={() => setShowSaveModal(false)}
        />
      )}
    </div>
  )
}
