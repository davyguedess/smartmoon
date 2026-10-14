/**
 * Smart Moon — Flow Builder Page
 * Wrapper que carrega um flow existente (por :id) ou inicia um novo (id = "new")
 * e renderiza o canvas editor (Sidebar + FlowCanvas).
 */
import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../../api'
import Sidebar from '../../components/layout/Sidebar'
import FlowCanvasConnected from '../../components/flows/FlowCanvasConnected'

export default function FlowBuilderPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const isNew = id === 'new'

  const [flow, setFlow] = useState(null)
  const [loading, setLoading] = useState(!isNew)

  useEffect(() => {
    if (isNew) { setFlow(null); setLoading(false); return }
    ;(async () => {
      setLoading(true)
      try {
        const data = await api.getFlow(id)
        setFlow(data)
      } catch (e) {
        alert(`Erro ao carregar fluxo: ${e.message}`)
        navigate('/flows')
      }
      setLoading(false)
    })()
  }, [id])

  if (loading) {
    return (
      <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
        Carregando fluxo...
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', height: '100%' }}>
      <Sidebar />
      <FlowCanvasConnected
        flowId={isNew ? null : parseInt(id)}
        initialDefinition={flow?.definition_json || null}
        flowName={flow?.name || ''}
        onSaved={(savedFlow) => {
          if (isNew) navigate(`/flows/${savedFlow.id}/builder`, { replace: true })
        }}
        onBack={() => navigate('/flows')}
      />
    </div>
  )
}
