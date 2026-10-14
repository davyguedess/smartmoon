import { Copy, X, Download, CheckCircle } from 'lucide-react'
import { useState } from 'react'

export default function SaveModal({ data, onClose }) {
  const [copied, setCopied] = useState(false)

  const jsonStr = JSON.stringify(data, null, 2)

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonStr)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = () => {
    const blob = new Blob([jsonStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `nexus_flow_${data.id || 'export'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <h2>
            <span style={{ fontSize: 18 }}>💾</span>
            Fluxo Exportado — JSON
          </h2>
          <button className="modal-close" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        <div className="modal-body">
          <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontSize: 11, color: 'var(--text-muted)',
              background: 'var(--bg-card)', padding: '3px 10px',
              borderRadius: 20, border: '1px solid var(--border-subtle)'
            }}>
              {data?.nodes?.length || 0} nós &nbsp;•&nbsp; {data?.edges?.length || 0} conexões
            </span>
            <span style={{ fontSize: 11, color: 'var(--nexus-green)' }}>
              ✓ Pronto para enviar ao backend
            </span>
          </div>
          <pre className="json-code">{jsonStr}</pre>
        </div>

        <div className="modal-footer">
          <button className="btn ghost" onClick={onClose}>Fechar</button>
          <button className="btn ghost" onClick={handleDownload}>
            <Download size={13} />
            Download .json
          </button>
          <button className="btn accent" onClick={handleCopy}>
            {copied ? <CheckCircle size={13} /> : <Copy size={13} />}
            {copied ? 'Copiado!' : 'Copiar JSON'}
          </button>
        </div>
      </div>
    </div>
  )
}
