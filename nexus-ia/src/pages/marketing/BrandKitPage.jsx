import { useState, useEffect, useRef } from 'react'
import {
  Palette, Upload, Sparkles, Check, ChevronRight, ChevronLeft,
  AlertCircle, Lock, RefreshCw, Copy, Building2, Brush, Type
} from 'lucide-react'
import { api } from '../../api'
import { useToast } from '../../components/ui/Toast'

// ── Constantes ────────────────────────────────────────────────────────────────

const VISUAL_STYLES = [
  'Minimalista', 'Moderno', 'Elegante', 'Luxo', 'Orgânico',
  'Tecnológico', 'Urbano', 'Vintage', 'Divertido', 'Sofisticado',
]
const TEXTURES = ['Clean / Branco', 'Gradiente suave', 'Granulado', 'Geométrico', 'Abstrato', 'Fotográfico']
const TONES = ['Profissional', 'Amigável', 'Exclusivo', 'Jovem', 'Sofisticado', 'Acessível', 'Sério', 'Criativo']
const GOOGLE_FONTS = [
  'Inter', 'Roboto', 'Poppins', 'Playfair Display', 'Montserrat',
  'Lato', 'Raleway', 'Nunito', 'Open Sans', 'Josefin Sans',
  'Cinzel', 'Cormorant Garamond', 'DM Sans', 'Be Vietnam Pro', 'Outfit',
]

const STEP_LABELS = [
  { label: 'Identidade',   icon: Building2 },
  { label: 'Visual',       icon: Palette },
  { label: 'Direção',      icon: Brush },
  { label: 'Prompt IA',   icon: Sparkles },
]

// ── Helpers ───────────────────────────────────────────────────────────────────
const colorSwatch = (hex, onChange) => (
  <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
    <div style={{
      width: 32, height: 32, borderRadius: 8, border: '2px solid rgba(255,255,255,0.15)',
      background: hex || '#1e293b', cursor: 'pointer', overflow: 'hidden', position: 'relative',
    }}>
      <input
        type="color" value={hex || '#6366f1'} onChange={e => onChange(e.target.value)}
        style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', width: '100%', height: '100%' }}
      />
    </div>
    <input
      type="text" value={hex || ''} onChange={e => onChange(e.target.value)}
      placeholder="#hex"
      style={{
        width: 80, marginLeft: 8, background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)', borderRadius: 7,
        color: '#f1f5f9', fontSize: 12, padding: '6px 10px', outline: 'none', fontFamily: 'monospace',
      }}
    />
  </div>
)

// ── Componente principal ──────────────────────────────────────────────────────
export default function BrandKitPage() {
  const toast = useToast()
  const [modules, setModules] = useState(null)
  const [modulesError, setModulesError] = useState(false)
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [copied, setCopied] = useState(false)
  const [logoPreview, setLogoPreview] = useState(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const fileRef = useRef()

  const [form, setForm] = useState({
    brand_name: '', product: '', niche: '', target_audience: '',
    target_gender: 'todos', target_age_min: 18, target_age_max: 55,
    city_region: '',
    logo_url: '',
    color_primary: '#6366f1', color_secondary: '#a78bfa', color_accent: '#06b6d4', color_background: '#0f172a',
    font_primary: 'Poppins', font_secondary: 'Inter',
    visual_styles: [], texture_style: '', comm_tone: '', reference_images: [],
    pre_prompt: '',
  })

  const field = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const toggleStyle = (s) => field('visual_styles',
    form.visual_styles.includes(s) ? form.visual_styles.filter(x => x !== s) : [...form.visual_styles, s]
  )

  const loadModules = async () => {
    setLoading(true)
    setModulesError(false)
    try {
      const mods = await api.marketingModules()
      setModules(mods)
      if (mods.has_brand_kit) {
        try {
          const kit = await api.brandKitGet()
          setForm(f => ({ ...f, ...kit }))
          if (kit.logo_url) setLogoPreview(kit.logo_url)
        } catch { /* kit ainda não cadastrado */ }
      }
    } catch (err) {
      // Distingue erro de comunicação de módulo não ativado
      // Se a sessão expirou ou há falha de rede, modules fica null mas
      // mostramos estado de erro com retry ao invés de "não ativado"
      const msg = err?.message || ''
      if (msg.includes('autenticado') || msg.includes('login') || msg.includes('401') || msg.includes('403') || msg.includes('expirada')) {
        setModulesError(true)
      } else {
        // Erro desconhecido — assume módulo verificado como inativo
        setModulesError(true)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadModules() }, [])

  const handleLogoUpload = async (file) => {
    if (!file) return
    setUploadingLogo(true)
    try {
      const preview = URL.createObjectURL(file)
      setLogoPreview(preview)
      const res = await api.brandKitUploadLogo(file)
      field('logo_url', res.logo_url)
      toast.success('Logo enviado com sucesso!')
    } catch (e) { toast.error('Erro no upload: ' + e.message) }
    finally { setUploadingLogo(false) }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await api.brandKitSave(form)
      toast.success('Brand Kit salvo!')
    } catch (e) { toast.error('Erro ao salvar: ' + (e.message || 'tente novamente')) }
    finally { setSaving(false) }
  }

  const handleGeneratePrompt = async () => {
    await handleSave()
    setGenerating(true)
    try {
      const res = await api.brandKitGeneratePrompt()
      field('pre_prompt', res.pre_prompt)
      toast.success('Pré-Prompt gerado pela IA!')
    } catch (e) { toast.error('Erro ao gerar prompt: ' + e.message) }
    finally { setGenerating(false) }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(form.pre_prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#475569' }}>
        <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite', marginRight: 10 }} />
        Carregando Brand Kit...
      </div>
    )
  }

  // ── Erro de comunicação (sessão expirada, rede) ───────────────────────────
  if (modulesError) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '70vh' }}>
        <div style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20, padding: 48, maxWidth: 480, textAlign: 'center',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16, background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', margin: '0 auto 20px',
          }}>
            <AlertCircle size={28} color="#ef4444" />
          </div>
          <h2 style={{ margin: '0 0 10px', fontSize: 20, fontWeight: 800, color: '#f1f5f9' }}>
            Erro ao verificar módulo
          </h2>
          <p style={{ margin: '0 0 24px', fontSize: 14, color: '#475569', lineHeight: 1.6 }}>
            Não foi possível verificar o status do Brand Kit.<br />
            Clique em <b>Tentar novamente</b> ou recarregue a página.
          </p>
          <button
            onClick={loadModules}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '11px 24px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #6366f1, #a78bfa)', color: '#fff',
              fontSize: 14, fontWeight: 700,
            }}
          >
            <RefreshCw size={14} /> Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  // ── Módulo não ativado ────────────────────────────────────────────────────
  if (!modules?.has_brand_kit) {

    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '70vh' }}>
        <div style={{
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20, padding: 48, maxWidth: 480, textAlign: 'center',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16, background: 'rgba(167,139,250,0.1)',
            border: '1px solid rgba(167,139,250,0.2)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', margin: '0 auto 20px',
          }}>
            <Lock size={28} color="#a78bfa" />
          </div>
          <h2 style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 800, color: '#f1f5f9' }}>
            Brand Kit não ativado
          </h2>
          <p style={{ margin: '0 0 24px', fontSize: 14, color: '#475569', lineHeight: 1.6 }}>
            Este módulo ainda não está habilitado para sua conta.
            Entre em contato com o suporte para ativar o Brand Kit na sua plataforma.
          </p>
          <div style={{
            background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)',
            borderRadius: 10, padding: '12px 20px', fontSize: 13, color: '#a78bfa',
          }}>
            <AlertCircle size={13} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            Fale com o administrador da plataforma
          </div>
        </div>
      </div>
    )
  }

  // ── UI principal ──────────────────────────────────────────────────────────
  const lbl = { fontSize: 11, fontWeight: 700, letterSpacing: '0.7px', textTransform: 'uppercase', color: '#475569', display: 'block', marginBottom: 6 }
  const inp = { width: '100%', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: '9px 12px', color: '#f1f5f9', fontSize: 13, outline: 'none', fontFamily: 'inherit' }

  return (
    <div style={{ padding: '28px 32px', color: '#f1f5f9', fontFamily: "'Inter', sans-serif", minHeight: '100vh', maxWidth: 760, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Palette size={18} color="#a78bfa" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.3px' }}>Brand Kit</h1>
            <p style={{ margin: 0, fontSize: 12, color: '#475569' }}>Cadastre a identidade visual da sua marca</p>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 32, background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: 4, border: '1px solid rgba(255,255,255,0.06)' }}>
        {STEP_LABELS.map((s, i) => {
          const Icon = s.icon
          const active = i === step
          const done = i < step
          return (
            <button
              key={i}
              onClick={() => setStep(i)}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                padding: '9px 4px', borderRadius: 9, border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                background: active ? 'rgba(167,139,250,0.15)' : 'transparent',
                color: active ? '#a78bfa' : done ? '#10b981' : '#475569',
                fontWeight: active ? 700 : 500, fontSize: 13,
              }}
            >
              {done ? <Check size={13} /> : <Icon size={13} />}
              <span style={{ display: window.innerWidth > 500 ? 'inline' : 'none' }}>{s.label}</span>
            </button>
          )
        })}
      </div>

      {/* ── ETAPA 0: Identidade ── */}
      {step === 0 && (
        <div style={{ display: 'grid', gap: 18 }}>
          {/* Nome */}
          <div>
            <label style={lbl}>Nome da Marca *</label>
            <input style={inp} value={form.brand_name} onChange={e => field('brand_name', e.target.value)} placeholder="Ex: Studio Luna" />
          </div>

          {/* Produto + Nicho */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={lbl}>Produto / Serviço</label>
              <input style={inp} value={form.product} onChange={e => field('product', e.target.value)} placeholder="Ex: Estética facial" />
            </div>
            <div>
              <label style={lbl}>Nicho de Mercado</label>
              <select style={{ ...inp, cursor: 'pointer' }} value={form.niche} onChange={e => field('niche', e.target.value)}>
                <option value="">Selecione o nicho...</option>
                {['Beleza & Saúde', 'Moda & Lifestyle', 'Gastronomia', 'Fitness & Esportes',
                  'Tecnologia', 'Educação', 'Imóveis', 'Auto', 'Pets',
                  'Serviços Profissionais', 'E-commerce', 'Entretenimento', 'Outro'].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Público-alvo estruturado */}
          <div style={{
            background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.15)',
            borderRadius: 14, padding: '18px',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#a78bfa', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 16 }}>
              🎯 Público-Alvo
            </div>

            {/* Gênero */}
            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>Gênero Principal</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { value: 'todos',     label: '👥 Todos' },
                  { value: 'feminino',  label: '👩 Feminino' },
                  { value: 'masculino', label: '👨 Masculino' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => field('target_gender', opt.value)}
                    style={{
                      flex: 1, padding: '9px 8px', borderRadius: 10, border: 'none', cursor: 'pointer',
                      fontSize: 12, fontWeight: 600, transition: 'all 0.15s',
                      background: form.target_gender === opt.value ? 'rgba(167,139,250,0.2)' : 'rgba(255,255,255,0.04)',
                      color: form.target_gender === opt.value ? '#a78bfa' : '#475569',
                      outline: form.target_gender === opt.value ? '1.5px solid rgba(167,139,250,0.5)' : '1px solid rgba(255,255,255,0.07)',
                    }}
                  >{opt.label}</button>
                ))}
              </div>
            </div>

            {/* Faixa Etária */}
            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>
                Faixa Etária —
                <span style={{ color: '#a78bfa', fontWeight: 700, marginLeft: 4 }}>
                  {form.target_age_min} – {form.target_age_max} anos
                </span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 10, color: '#475569', marginBottom: 4 }}>Idade mínima</div>
                  <select style={{ ...inp, cursor: 'pointer' }} value={form.target_age_min} onChange={e => field('target_age_min', parseInt(e.target.value))}>
                    {[13,16,18,21,25,30,35,40,45,50,55,60,65].map(a => (
                      <option key={a} value={a}>{a} anos</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: '#475569', marginBottom: 4 }}>Idade máxima</div>
                  <select style={{ ...inp, cursor: 'pointer' }} value={form.target_age_max} onChange={e => field('target_age_max', parseInt(e.target.value))}>
                    {[21,25,30,35,40,45,50,55,60,65,70,75,80].map(a => (
                      <option key={a} value={a}>{a} anos</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Descrição livre */}
            <div>
              <label style={lbl}>Interesses / Comportamentos (opcional)</label>
              <input
                style={inp}
                value={form.target_audience}
                onChange={e => field('target_audience', e.target.value)}
                placeholder="Ex: Profissionais liberais, interesse em bem-estar e autocuidado..."
              />
            </div>
          </div>

          {/* Cidade */}
          <div>
            <label style={lbl}>Cidade / Região</label>
            <input style={inp} value={form.city_region} onChange={e => field('city_region', e.target.value)} placeholder="Ex: São Paulo - SP" />
          </div>
        </div>
      )}

      {/* ── ETAPA 1: Visual ── */}
      {step === 1 && (
        <div style={{ display: 'grid', gap: 24 }}>
          {/* Logo */}
          <div>
            <label style={lbl}>Logo da Marca</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  width: 90, height: 90, borderRadius: 14, border: '2px dashed rgba(167,139,250,0.3)',
                  background: 'rgba(167,139,250,0.06)', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s',
                  overflow: 'hidden',
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(167,139,250,0.6)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(167,139,250,0.3)'}
              >
                {logoPreview ? (
                  <img src={logoPreview} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 8, boxSizing: 'border-box' }} />
                ) : (
                  <>
                    <Upload size={18} color="#a78bfa" />
                    <span style={{ fontSize: 10, color: '#475569', marginTop: 4 }}>PNG / SVG</span>
                  </>
                )}
              </div>
              <input ref={fileRef} type="file" accept=".png,.svg,.jpg,.jpeg,.webp" style={{ display: 'none' }} onChange={e => handleLogoUpload(e.target.files[0])} />
              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 6px', fontSize: 13, color: '#94a3b8' }}>
                  Envie o logo com <b>fundo transparente</b> (PNG ou SVG).
                </p>
                <p style={{ margin: 0, fontSize: 12, color: '#475569' }}>
                  A IA usará o logo nas artes geradas automaticamente.
                </p>
              </div>
            </div>
            {uploadingLogo && <p style={{ fontSize: 12, color: '#a78bfa', marginTop: 8 }}>Enviando logo...</p>}
          </div>

          {/* Cores */}
          <div>
            <label style={lbl}>Paleta de Cores</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[
                ['color_primary', 'Cor Primária'],
                ['color_secondary', 'Cor Secundária'],
                ['color_accent', 'Cor de Destaque'],
                ['color_background', 'Cor de Fundo'],
              ].map(([k, label]) => (
                <div key={k}>
                  <label style={{ ...lbl, marginBottom: 8 }}>{label}</label>
                  {colorSwatch(form[k], v => field(k, v))}
                </div>
              ))}
            </div>
          </div>

          {/* Fontes */}
          <div>
            <label style={lbl}>Tipografia</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[
                ['font_primary', 'Fonte Principal'],
                ['font_secondary', 'Fonte Secundária'],
              ].map(([k, label]) => (
                <div key={k}>
                  <label style={{ ...lbl, fontSize: 10 }}>{label}</label>
                  <select style={{ ...inp, cursor: 'pointer' }} value={form[k]} onChange={e => field(k, e.target.value)}>
                    {GOOGLE_FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <p style={{ margin: '10px 0 0', fontSize: 11, color: '#334155' }}>
              <Type size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
              Não encontrou a fonte? <a href="#" style={{ color: '#a78bfa' }} onClick={e => e.preventDefault()}>Solicitar ao suporte</a>
            </p>
          </div>
        </div>
      )}

      {/* ── ETAPA 2: Direção de Arte ── */}
      {step === 2 && (
        <div style={{ display: 'grid', gap: 24 }}>
          <div>
            <label style={lbl}>Estilo Visual (selecione todos que combinam)</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {VISUAL_STYLES.map(s => {
                const active = form.visual_styles.includes(s)
                return (
                  <button key={s} onClick={() => toggleStyle(s)} style={{
                    padding: '7px 14px', borderRadius: 20, border: `1px solid ${active ? 'rgba(167,139,250,0.5)' : 'rgba(255,255,255,0.08)'}`,
                    background: active ? 'rgba(167,139,250,0.15)' : 'transparent',
                    color: active ? '#a78bfa' : '#64748b', fontSize: 13, cursor: 'pointer',
                    fontWeight: active ? 700 : 400, transition: 'all 0.15s',
                  }}>{s}</button>
                )
              })}
            </div>
          </div>

          <div>
            <label style={lbl}>Textura de Fundo</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {TEXTURES.map(t => (
                <button key={t} onClick={() => field('texture_style', t)} style={{
                  padding: '10px 8px', borderRadius: 8, border: `1px solid ${form.texture_style === t ? 'rgba(6,182,212,0.5)' : 'rgba(255,255,255,0.07)'}`,
                  background: form.texture_style === t ? 'rgba(6,182,212,0.1)' : 'transparent',
                  color: form.texture_style === t ? '#06b6d4' : '#64748b', fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
                }}>{t}</button>
              ))}
            </div>
          </div>

          <div>
            <label style={lbl}>Tom de Comunicação</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {TONES.map(t => (
                <button key={t} onClick={() => field('comm_tone', t)} style={{
                  padding: '7px 14px', borderRadius: 20, border: `1px solid ${form.comm_tone === t ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.08)'}`,
                  background: form.comm_tone === t ? 'rgba(16,185,129,0.1)' : 'transparent',
                  color: form.comm_tone === t ? '#10b981' : '#64748b', fontSize: 13, cursor: 'pointer', transition: 'all 0.15s',
                }}>{t}</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── ETAPA 3: Pré-Prompt ── */}
      {step === 3 && (
        <div style={{ display: 'grid', gap: 20 }}>
          <div style={{
            background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)',
            borderRadius: 12, padding: 16,
          }}>
            <p style={{ margin: '0 0 12px', fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
              <Sparkles size={13} style={{ marginRight: 6, verticalAlign: 'middle', color: '#a78bfa' }} />
              A IA gera um <b style={{ color: '#f1f5f9' }}>pré-prompt personalizado</b> baseado nas informações da sua marca.
              Ele será usado automaticamente ao criar artes no Studio.
            </p>
            <button
              onClick={handleGeneratePrompt}
              disabled={generating || !form.brand_name}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 20px', borderRadius: 8, border: 'none', cursor: generating ? 'wait' : 'pointer',
                background: 'linear-gradient(135deg, #6366f1, #a78bfa)', color: '#fff',
                fontSize: 13, fontWeight: 700, opacity: (!form.brand_name) ? 0.5 : 1,
              }}
            >
              {generating
                ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Gerando...</>
                : <><Sparkles size={13} /> Gerar Pré-Prompt com IA</>
              }
            </button>
          </div>

          {form.pre_prompt && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <label style={lbl}>Pré-Prompt Gerado (editável)</label>
                <button onClick={handleCopy} style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
                  background: copied ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${copied ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 7, color: copied ? '#10b981' : '#64748b', fontSize: 12, cursor: 'pointer',
                }}>
                  {copied ? <><Check size={12} /> Copiado!</> : <><Copy size={12} /> Copiar</>}
                </button>
              </div>
              <textarea
                value={form.pre_prompt}
                onChange={e => field('pre_prompt', e.target.value)}
                style={{
                  ...inp, minHeight: 180, resize: 'vertical', lineHeight: 1.7,
                  fontFamily: "'Fira Code', monospace", fontSize: 12,
                }}
              />
              <p style={{ margin: '8px 0 0', fontSize: 11, color: '#334155' }}>
                Use <code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: 4, color: '#a78bfa' }}>{'{CTA}'}</code> e{' '}
                <code style={{ background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: 4, color: '#a78bfa' }}>{'{BRIEFING}'}</code> como variáveis que serão preenchidas ao criar cada arte.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Navegação */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 32, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button
          onClick={() => setStep(s => s - 1)}
          disabled={step === 0}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px',
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 9, color: step === 0 ? '#334155' : '#94a3b8', fontSize: 13, cursor: step === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          <ChevronLeft size={14} /> Anterior
        </button>

        <button
          onClick={async () => {
            await handleSave()
            if (step < 3) setStep(s => s + 1)
          }}
          disabled={saving || !form.brand_name}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '10px 22px',
            background: step === 3 ? 'linear-gradient(135deg, #10b981, #06b6d4)' : 'linear-gradient(135deg, #6366f1, #a78bfa)',
            border: 'none', borderRadius: 9, color: '#fff', fontSize: 13, fontWeight: 700,
            cursor: (saving || !form.brand_name) ? 'not-allowed' : 'pointer',
            opacity: !form.brand_name ? 0.5 : 1,
          }}
        >
          {saving
            ? <><RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Salvando...</>
            : step === 3
            ? <><Check size={13} /> Salvar Brand Kit</>
            : <>Salvar e continuar <ChevronRight size={14} /></>
          }
        </button>
      </div>
    </div>
  )
}
