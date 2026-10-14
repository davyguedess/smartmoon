import { Handle, Position } from '@xyflow/react'

/** Returns a styled icon badge per subtype */
export function NxIcon({ subtype }) {
  const cfg = {
    // ── Triggers ──────────────────────────────────────────
    smartmoon_trigger: { bg: 'linear-gradient(135deg,#f0a500,#ff6b00)', emoji: '🌙' },
    whatsapp_trigger:  { bg: 'linear-gradient(135deg,#25d366,#128c7e)', emoji: '💬' },
    zapi_trigger:      { bg: 'linear-gradient(135deg,#a855f7,#7c3aed)', emoji: '⚡' },
    telegram_trigger:  { bg: 'linear-gradient(135deg,#229ed9,#1a7fbf)', emoji: '✈️' },
    instagram_trigger: { bg: 'linear-gradient(135deg,#f58529,#e1306c,#833ab4)', emoji: '📸' },
    gmail_inbox:       { bg: 'linear-gradient(135deg,#ea4335,#c5221f)', emoji: '📧' },
    webhook_trigger:   { bg: 'linear-gradient(135deg,#f59e0b,#d97706)', emoji: '🔗' },
    schedule:          { bg: 'linear-gradient(135deg,#6366f1,#4f46e5)', emoji: '⏰' },
    manual:            { bg: 'linear-gradient(135deg,#06b6d4,#0891b2)', emoji: '▶️' },
    // ── AI ────────────────────────────────────────────────
    trained_agent:     { bg: 'linear-gradient(135deg,#3b82f6,#2563eb)', emoji: '🤖' },
    router:            { bg: 'linear-gradient(135deg,#8b5cf6,#7c3aed)', emoji: '🧭' },
    classifier:        { bg: 'linear-gradient(135deg,#06b6d4,#0284c7)', emoji: '🏷️' },
    ollama:            { bg: 'linear-gradient(135deg,#10b981,#059669)', emoji: '🦙' },
    rag:               { bg: 'linear-gradient(135deg,#3b82f6,#6366f1)', emoji: '📚' },
    openai:            { bg: 'linear-gradient(135deg,#10b981,#059669)', emoji: '✨' },
    gemini:            { bg: 'linear-gradient(135deg,#4285f4,#34a853)', emoji: '♊' },
    claude:            { bg: 'linear-gradient(135deg,#f97316,#ea580c)', emoji: '🧠' },
    groq:              { bg: 'linear-gradient(135deg,#06b6d4,#0891b2)', emoji: '⚡' },
    whisper:           { bg: 'linear-gradient(135deg,#8b5cf6,#7c3aed)', emoji: '🎙️' },
    luna:              { bg: 'linear-gradient(135deg,#d946ef,#701a75)', emoji: '🌙' },
    luna_voice:        { bg: 'linear-gradient(135deg,#d946ef,#701a75)', emoji: '🌙' },
    // ── Actions ───────────────────────────────────────────
    smartmoon_send:    { bg: 'linear-gradient(135deg,#f0a500,#ff6b00)', emoji: '🌙' },
    send_whatsapp:     { bg: 'linear-gradient(135deg,#25d366,#128c7e)', emoji: '💬' },
    zapi_send:         { bg: 'linear-gradient(135deg,#a855f7,#7c3aed)', emoji: '💬' },
    send_telegram:     { bg: 'linear-gradient(135deg,#229ed9,#1a7fbf)', emoji: '✈️' },
    send_email:        { bg: 'linear-gradient(135deg,#ea4335,#c5221f)', emoji: '📨' },
    elevenlabs:        { bg: 'linear-gradient(135deg,#a855f7,#7c3aed)', emoji: '🔊' },
    create_pix:        { bg: 'linear-gradient(135deg,#32bcad,#1a9c8e)', emoji: '💳' },
    asaas_charge:      { bg: 'linear-gradient(135deg,#00b09b,#009688)', emoji: '💰' },
    hubspot:           { bg: 'linear-gradient(135deg,#ff7a59,#f4501c)', emoji: '🎯' },
    rdstation:         { bg: 'linear-gradient(135deg,#0088cc,#0066aa)', emoji: '📊' },
    notion:            { bg: 'linear-gradient(135deg,#374151,#1f2937)', emoji: '📄' },
    meta_ads:          { bg: 'linear-gradient(135deg,#1877f2,#0d5fbd)', emoji: '📢' },
    meta:              { bg: 'linear-gradient(135deg,#1877f2,#0d5fbd)', emoji: '📢' },
    http:              { bg: 'linear-gradient(135deg,#64748b,#475569)', emoji: '🌐' },
    http_request:      { bg: 'linear-gradient(135deg,#64748b,#475569)', emoji: '🌐' },
    google_contacts:   { bg: 'linear-gradient(135deg,#4285f4,#34a853)', emoji: '👥' },
    create_event:      { bg: 'linear-gradient(135deg,#4285f4,#0f9d58)', emoji: '📅' },
    update_sheet:      { bg: 'linear-gradient(135deg,#0f9d58,#0d7a46)', emoji: '📊' },
    multi_channel:     { bg: 'linear-gradient(135deg,#f59e0b,#d97706)', emoji: '📡' },
    subflow:           { bg: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', emoji: '🔄' },
    // ── Logic / Wait ──────────────────────────────────────
    condition:         { bg: 'linear-gradient(135deg,#ec4899,#be185d)', emoji: '⚖️' },
    check_whatsapp:    { bg: 'linear-gradient(135deg,#25d366,#128c7e)', emoji: '✅' },
    set_variable:      { bg: 'linear-gradient(135deg,#a855f7,#7c3aed)', emoji: '📝' },
    loop:              { bg: 'linear-gradient(135deg,#06b6d4,#0891b2)', emoji: '🔁' },
    stop:              { bg: 'linear-gradient(135deg,#ef4444,#dc2626)', emoji: '⛔' },
    retry:             { bg: 'linear-gradient(135deg,#ec4899,#be185d)', emoji: '🔃' },
    wait_payment:      { bg: 'linear-gradient(135deg,#f59e0b,#d97706)', emoji: '⏳' },
    wait_webhook:      { bg: 'linear-gradient(135deg,#f59e0b,#b45309)', emoji: '⏸️' },
    delay:             { bg: 'linear-gradient(135deg,#6366f1,#4f46e5)', emoji: '⏱️' },
    payment:           { bg: 'linear-gradient(135deg,#f59e0b,#d97706)', emoji: '💳' },
  }

  const c = cfg[subtype] || { bg: 'linear-gradient(135deg,#374151,#1f2937)', emoji: '🔧' }

  return (
    <div style={{
      width: 32, height: 32, borderRadius: 9,
      background: c.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 15, flexShrink: 0,
      boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
    }}>
      {c.emoji}
    </div>
  )
}

export default function TriggerNode({ data, selected }) {
  return (
    <div className={`nx-node nx-trigger ${selected ? 'selected' : ''}`}>
      {data.onDelete && (
        <button className="nx-node-delete" onClick={data.onDelete} title="Remover nó">×</button>
      )}
      <div className="nx-node-header">
        <NxIcon subtype={data.subtype} nodeType="trigger" />
        <div className="nx-node-title-wrap">
          <div className="nx-node-tag">Trigger</div>
          <div className="nx-node-title">{data.label}</div>
        </div>
      </div>
      <div className="nx-node-body">
        <div className="nx-node-detail">{data.detail}</div>
        <div className="nx-node-chip">● Ativo</div>
      </div>
      <Handle type="source" position={Position.Right} id="out" style={{ background: 'var(--nexus-green)' }} />
    </div>
  )
}
