/**
 * Smart Moon — FlowCanvasConnected
 * Extensão do FlowCanvas com Save/Load/Test reais via API.
 *
 * Props:
 *   flowId           — null para novo flow
 *   initialDefinition — {nodes, edges} carregado do backend
 *   flowName         — nome atual do flow
 *   onSaved(flow)    — callback após primeiro save (recebe o flow criado)
 *   onBack()         — volta para a lista de flows
 */
import { useState, useCallback, useRef, useEffect } from 'react'
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState,
  BackgroundVariant, Panel,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import TriggerNode from './nodes/TriggerNode'
import AINode from './nodes/AINode'
import ActionNode from './nodes/ActionNode'
import WaitNode from './nodes/WaitNode'
import LogicNode from './nodes/LogicNode'
import LunaNode from './nodes/LunaNode'
import {
  Save, Play, Trash2, ArrowLeft, RefreshCw, Check, Globe, ChevronRight
} from 'lucide-react'
import { api } from '../../api'

// Map backend node types → ReactFlow component types
const DB_TYPE_TO_RF = {
  // Triggers
  telegram_trigger:    'trigger',
  whatsapp_trigger:    'trigger',
  zapi_trigger:        'trigger',
  smartmoon_trigger:   'trigger',
  instagram_trigger:   'trigger',
  webhook_trigger:     'trigger',
  email_trigger:       'trigger',
  schedule_trigger:    'trigger',
  manual_trigger:      'trigger',
  trigger:             'trigger',
  // AI / LLM
  ollama:              'ai',
  openai:              'ai',
  gemini:              'ai',
  claude:              'ai',
  groq:                'ai',
  whisper:             'ai',
  trained_agent:       'ai',
  router:              'ai',
  classifier:          'ai',
  rag:                 'ai',
  ai:                  'ai',
  // Actions / Outputs
  send_telegram:       'action',
  send_telegram_voice: 'action',
  send_whatsapp:       'action',
  smartmoon_send:      'action',
  zapi_send:           'action',
  send_zapi:           'action',
  send_email:          'action',
  gmail_reader:        'action',
  gmail_sender:        'action',
  calendar_reader:     'action',
  calendar_create:     'action',
  create_event:        'action',
  sheets_read:         'action',
  update_sheet:        'action',
  http_request:        'action',
  http:                'action',
  create_pix:          'action',
  asaas_charge:        'action',
  hubspot:             'action',
  rdstation:           'action',
  notion:              'action',
  meta_ads:            'action',
  elevenlabs:          'action',
  subflow:             'action',
  external_api:        'action',
  duarte_booking:      'action',
  api_externa:         'action',
  action:              'action',
  // Wait / Delay
  wait:                'wait',
  delay:               'wait',
  wait_payment:        'wait',
  wait_webhook:        'wait',
  // Logic / Conditions
  condition:           'logic',
  switch:              'logic',
  multi_channel:       'logic',
  check_whatsapp:      'logic',
  set_variable:        'logic',
  loop:                'logic',
  stop:                'logic',
  retry:               'logic',
  logic:               'logic',
  luna:                'luna',
  luna_voice:          'luna',
}

const nodeTypes = {
  trigger: TriggerNode,
  ai: AINode,
  action: ActionNode,
  wait: WaitNode,
  logic: LogicNode,
  luna: LunaNode,
}

const EMPTY_NODES = []
const EMPTY_EDGES = []

let nodeIdCounter = 200

// ── Toast helper (internal) ───────────────────────────────────────────────────

function Toast({ msg, type }) {
  if (!msg) return null
  return (
    <div style={{
      position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
      padding: '10px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600,
      background: type === 'err' ? '#ef444420' : '#10b98120',
      border: `1px solid ${type === 'err' ? '#ef4444' : '#10b981'}40`,
      color: type === 'err' ? '#ef4444' : '#10b981',
      backdropFilter: 'blur(8px)', zIndex: 9999, pointerEvents: 'none',
    }}>
      {msg}
    </div>
  )
}

// ── Name Modal ────────────────────────────────────────────────────────────────

function NameModal({ current, onConfirm, onCancel }) {
  const [name, setName] = useState(current || '')
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(8,11,20,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    }} onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div style={{
        background: 'var(--bg-card)', borderRadius: 16, padding: 24, width: 380,
        border: '1px solid var(--border-default)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 14 }}>
          💾 Nomear Fluxo
        </div>
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && name.trim() && onConfirm(name.trim())}
          placeholder="Ex: Onboarding WhatsApp → PIX"
          style={{
            width: '100%', padding: '10px 14px', borderRadius: 10,
            background: 'var(--bg-base)', border: '1px solid var(--border-default)',
            color: 'var(--text-primary)', fontSize: 13, outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{
            padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-default)',
            background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12,
          }}>Cancelar</button>
          <button onClick={() => name.trim() && onConfirm(name.trim())} style={{
            padding: '8px 20px', borderRadius: 8, border: 'none',
            background: 'linear-gradient(135deg, var(--nexus-violet), var(--nexus-cyan))',
            color: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 700,
          }}>Salvar</button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function FlowCanvasConnected({ flowId, initialDefinition, flowName, onSaved, onBack }) {
  const reactFlowWrapper = useRef(null)
  const [rfInstance, setRfInstance] = useState(null)

  // Hydrate nodes/edges from backend definition or start empty
  const [nodes, setNodes, onNodesChange] = useNodesState(
    initialDefinition?.nodes?.map(n => ({
      id: n.id,
      type: DB_TYPE_TO_RF[n.type] || 'action',  // map DB type → RF component
      position: n.position,
      data: {
        label: n.data?.label || n.label || n.type,
        detail: n.data?.config?.detail || n.config?.detail || n.data?.detail || '',
        subtype: n.data?.subtype || n.subtype || n.type,  // preserve original DB type as subtype
        icon: n.data?.icon || n.icon,
        model: n.data?.config?.model || n.config?.model || n.data?.model,
        dbType: n.type,  // preserve original type for saving back
      },
    })) ?? EMPTY_NODES
  )
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    initialDefinition?.edges?.map(e => ({
      id: e.id, source: e.source, target: e.target,
      animated: e.animated, label: e.label,
    })) ?? EMPTY_EDGES
  )

  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showNameModal, setShowNameModal] = useState(false)
  const [currentFlowId, setCurrentFlowId] = useState(flowId)
  const [currentName, setCurrentName] = useState(flowName)
  const [toast, setToast] = useState(null)
  const [selectedNode, setSelectedNode] = useState(null)
  const [nodeAgents, setNodeAgents] = useState([])
  const [loadingNodeAgents, setLoadingNodeAgents] = useState(false)

  const showToast = (msg, type = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ── Drag & Drop ────────────────────────────────────────────────────────────

  const onConnect = useCallback(
    (params) => setEdges(eds => addEdge({ ...params, animated: true }, eds)),
    [setEdges]
  )

  const onDragOver = useCallback((event) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback((event) => {
    event.preventDefault()
    const raw = event.dataTransfer.getData('application/nexus-node')
    if (!raw) return
    const nodeData = JSON.parse(raw)
    const position = rfInstance.screenToFlowPosition({ x: event.clientX, y: event.clientY })
    setNodes(nds => nds.concat({
      id: `node-${++nodeIdCounter}`,
      type: nodeData.nodeType,
      position,
      data: {
        label: nodeData.label, detail: nodeData.detail,
        subtype: nodeData.subtype, icon: nodeData.icon, model: nodeData.model,
      },
    }))
  }, [rfInstance, setNodes])

  // ── Delete node ────────────────────────────────────────────────────────────

  const onDeleteNode = useCallback((nodeId) => {
    setNodes(nds => nds.filter(n => n.id !== nodeId))
    setEdges(eds => eds.filter(e => e.source !== nodeId && e.target !== nodeId))
    if (selectedNode?.id === nodeId) setSelectedNode(null)
  }, [setNodes, setEdges, selectedNode])

  const onNodeClick = useCallback(async (_, node) => {
    if (node.data?.subtype === 'trained_agent' || node.type === 'ai') {
      // only open panel for trained_agent subtype
      if (node.data?.subtype !== 'trained_agent') return
    } else {
      return
    }
    setSelectedNode(node)
    setLoadingNodeAgents(true)
    try {
      const agents = await api.agentListProfiles()
      setNodeAgents(agents || [])
    } catch {}
    setLoadingNodeAgents(false)
  }, [])

  const nodesWithDelete = nodes.map(n => ({
    ...n, data: { ...n.data, onDelete: () => onDeleteNode(n.id) },
  }))

  // ── Save ───────────────────────────────────────────────────────────────────

  const buildPayload = (name) => {
    return {
      name: name || currentName || `Fluxo ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
      definition_json: {
        nodes: nodes.map(n => ({
          id: n.id, type: n.type, subtype: n.data.subtype,
          label: n.data.label, position: n.position,
          icon: n.data.icon,
          config: { detail: n.data.detail, model: n.data.model, agent_id: n.data.agent_id },
        })),
        edges: edges.map(e => ({
          id: e.id, source: e.source, target: e.target,
          animated: e.animated, label: e.label,
        })),
      },
    }
  }

  const doSave = async (name) => {
    setSaving(true)
    try {
      const payload = buildPayload(name)
      const result = currentFlowId
        ? await api.updateFlow(currentFlowId, payload)
        : await api.createFlow(payload)

      setCurrentFlowId(result.id)
      setCurrentName(result.name || name)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      showToast(`✅ Fluxo "${result.name}" salvo!`)
      onSaved?.(result)
    } catch (e) {
      showToast(`❌ Erro ao salvar: ${e.message}`, 'err')
    }
    setSaving(false)
  }

  const handleSave = () => {
    if (!currentName && !currentFlowId) {
      setShowNameModal(true)
    } else {
      doSave(currentName)
    }
  }

  // ── Test ───────────────────────────────────────────────────────────────────

  const handleTest = async () => {
    if (!currentFlowId) {
      // save first, then test
      showToast('⚠️ Salve o fluxo antes de testar', 'err')
      return
    }
    setTesting(true)
    try {
      await api.testFlow(currentFlowId, {})
      showToast('✅ Execução de teste iniciada! Veja em Execuções.')
    } catch (e) {
      showToast(`❌ Erro ao testar: ${e.message}`, 'err')
    }
    setTesting(false)
  }

  // ── Publish ────────────────────────────────────────────────────────────────

  const handlePublish = async () => {
    if (!currentFlowId) { showToast('⚠️ Salve o fluxo primeiro', 'err'); return }
    try {
      await api.publishFlow(currentFlowId)
      showToast('🚀 Fluxo publicado!')
    } catch (e) {
      showToast(`❌ ${e.message}`, 'err')
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="canvas-wrap" ref={reactFlowWrapper} style={{ flex: 1 }}>
      <ReactFlow
        nodes={nodesWithDelete}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={setRfInstance}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        deleteKeyCode="Delete"
        multiSelectionKeyCode="Shift"
        defaultEdgeOptions={{ style: { strokeWidth: 2 } }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(255,255,255,0.06)" />
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

        {/* Top left — Back + name */}
        <Panel position="top-left">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={onBack} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 11px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              background: 'var(--bg-card)', border: '1px solid var(--border-default)',
              color: 'var(--text-secondary)',
            }}>
              <ArrowLeft size={12} />
              Fluxos
            </button>
            {currentName && (
              <span style={{
                padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)', maxWidth: 200,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {currentName}
              </span>
            )}
          </div>
        </Panel>

        {/* Top center — node/edge count */}
        <Panel position="top-center">
          <div className="canvas-top-bar canvas-floating">
            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
              {nodes.length} nó{nodes.length !== 1 ? 's' : ''} · {edges.length} conexão{edges.length !== 1 ? 'ões' : ''}
            </span>
          </div>
        </Panel>

        {/* Bottom right — action buttons */}
        <Panel position="bottom-right">
          <div style={{ display: 'flex', gap: 10, marginBottom: 60 }}>
            <button className="fab" onClick={() => { setNodes([]); setEdges([]) }}
              style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}>
              <Trash2 size={14} />
              Limpar
            </button>

            <button data-tour="publish-btn" className="fab" onClick={handlePublish} style={{
              background: 'rgba(6,182,212,0.15)', border: '1px solid rgba(6,182,212,0.25)', color: 'var(--nexus-cyan)',
            }}>
              <Globe size={14} />
              Publicar
            </button>

            <button className="fab run" onClick={handleTest} disabled={testing}>
              {testing
                ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                : <Play size={14} />
              }
              {testing ? 'Testando...' : 'Testar'}
            </button>

            <button className="fab save" onClick={handleSave} disabled={saving}>
              {saved ? <Check size={14} /> : saving
                ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} />
                : <Save size={14} />
              }
              {saved ? 'Salvo!' : saving ? 'Salvando...' : 'Salvar'}
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

      {/* Name modal */}
      {showNameModal && (
        <NameModal
          current={currentName}
          onConfirm={(name) => { setShowNameModal(false); doSave(name) }}
          onCancel={() => setShowNameModal(false)}
        />
      )}

      {/* Toast */}
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {/* Trained Agent Config Panel */}
      {selectedNode && (
        <div style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: 300,
          background: 'var(--bg-card)', borderLeft: '1px solid var(--border-default)',
          display: 'flex', flexDirection: 'column', gap: 0, zIndex: 10,
          boxShadow: '-8px 0 30px rgba(0,0,0,0.3)',
        }}>
          <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16 }}>🤖</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 800 }}>Agente Treinado</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>Configurar nó {selectedNode.id}</div>
            </div>
            <button onClick={() => setSelectedNode(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16 }}>✕</button>
          </div>
          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.7, display: 'block', marginBottom: 6 }}>Agente</label>
              {loadingNodeAgents ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Carregando agentes...</div>
              ) : (
                <select
                  value={selectedNode.data?.agent_id || ''}
                  onChange={e => {
                    const agentId = e.target.value
                    const agentObj = nodeAgents.find(a => String(a.id) === agentId)
                    setNodes(nds => nds.map(n => n.id === selectedNode.id
                      ? { ...n, data: { ...n.data, agent_id: agentId, label: agentObj ? agentObj.name : n.data.label, detail: agentObj ? `${agentObj.model} · ${agentObj.provider}` : n.data.detail } }
                      : n
                    ))
                    setSelectedNode(prev => ({ ...prev, data: { ...prev.data, agent_id: agentId } }))
                  }}
                  style={{
                    width: '100%', padding: '10px 12px', borderRadius: 9,
                    background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
                    color: 'var(--text-primary)', fontSize: 13, cursor: 'pointer',
                  }}
                >
                  <option value=''>Selecionar agente...</option>
                  {nodeAgents.map(a => <option key={a.id} value={String(a.id)}>{a.name} ({a.model})</option>)}
                </select>
              )}
            </div>
            {selectedNode.data?.agent_id && (() => {
              const a = nodeAgents.find(ag => String(ag.id) === String(selectedNode.data.agent_id))
              if (!a) return null
              return (
                <div style={{ padding: '12px', borderRadius: 10, background: 'var(--bg-elevated)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--nexus-green)', textTransform: 'uppercase', letterSpacing: 0.7 }}>✓ Agente selecionado</div>
                  {[['Nome', a.name], ['Modelo', a.model], ['Provider', a.provider]].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ color: 'var(--text-muted)' }}>{k}</span>
                      <span style={{ fontWeight: 600, color: 'var(--nexus-cyan)' }}>{v || '—'}</span>
                    </div>
                  ))}
                </div>
              )
            })()}
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              💡 Salve o fluxo após configurar o agente para persistir a seleção.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
