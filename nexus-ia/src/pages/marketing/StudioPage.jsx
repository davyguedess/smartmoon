/**
 * NEXUS.IA — Studio Editor v5 | Smart Moon Premium
 * Design: Luxury Tech · Futurista · Premium SaaS
 * Referência: Canva + Smart Moon identity
 */
import { useState, useRef, useCallback, useEffect, useMemo } from 'react'
import { createRoot } from 'react-dom/client'
import {
  Stage, Layer, Rect, Circle, Text as KText,
  RegularPolygon, Star as KStar, Image as KImage, Transformer,
} from 'react-konva'
import * as AllIcons from 'lucide-react'
import {
  Sparkles, Layers, Download, Trash2, Undo2, Redo2,
  ZoomIn, ZoomOut, Search, X, Plus, Minus, ChevronDown,
  ChevronRight, Type, Upload as UploadIcon, Eye, Share2,
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  MoreHorizontal, Shapes, Smile, Grid2x2, MousePointer,
  Settings, Wand2, LayoutTemplate, Palette, Eraser,
  MonitorPlay, SquarePen, ImagePlus, Video,
  BookOpen, Star, Heart, Zap, RotateCcw,
} from 'lucide-react'
import { useToast } from '../../components/ui/Toast'
import { useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/useAuthStore'
import { api } from '../../api'

// ─── Design Tokens ────────────────────────────────────────────────────────────
const C = {
  space:    '#050810',
  navy:     '#080d1a',
  dark:     '#0c1220',
  mid:      '#111827',
  blue:     '#3b82f6',
  violet:   '#7c3aed',
  cyan:     '#06b6d4',
  blueGlow: 'rgba(59,130,246,0.12)',
  violetGlow:'rgba(124,58,237,0.1)',
  text:     '#e2e8f0',
  textDim:  '#64748b',
  textMuted:'#334155',
  border:   'rgba(255,255,255,0.07)',
  borderAct:'rgba(59,130,246,0.35)',
}

// ─── Formatos ──────────────────────────────────────────────────────────────────
const FORMATS = {
  feed:       { w:480, h:480,  label:'Post 1:1',      px:'1080×1080' },
  story:      { w:270, h:480,  label:'Story 9:16',    px:'1080×1920' },
  banner:     { w:480, h:252,  label:'Banner',        px:'1920×1008' },
  landscape:  { w:480, h:270,  label:'Paisagem 16:9', px:'1920×1080' },
}

const FONTS = ['Inter','Poppins','Montserrat','Playfair Display','Oswald','Raleway','Lato','Vogue','Georgia']

const PALETTE = [
  '#ffffff','#f8fafc','#94a3b8','#334155','#0f172a','#050810',
  '#3b82f6','#06b6d4','#7c3aed','#e879f9','#f472b6','#fb7185',
  '#f59e0b','#10b981','#22c55e','#ef4444','#8b5cf6','#0ea5e9',
]

// ─── Templates Data ────────────────────────────────────────────────────────────
const TEMPLATES = [
  { id:1, name:'Harmonização Premium',  cat:'Estética', px:'1080p', badge:'PRO',
    bg:'linear-gradient(135deg,#0d0019 0%,#1a0035 40%,#0a0520 100%)',
    accent:'#d4af37', text:'Harmonização\nFacial Premium', cta:'Agende Agora' },
  { id:2, name:'Oferta Limitada',       cat:'Varejo',   px:'1080p', badge:'FREE',
    bg:'linear-gradient(135deg,#0a0015 0%,#2d1060 60%,#1a0040 100%)',
    accent:'#e879f9', text:'Promoção\nLimitada', cta:'Saiba Mais' },
  { id:3, name:'Expert em Marketing',  cat:'Educação', px:'1080p', badge:'PRO',
    bg:'linear-gradient(135deg,#030812 0%,#0d2045 60%,#051025 100%)',
    accent:'#3b82f6', text:'Expert em\nMarketing Digital', cta:'Acesse Agora' },
  { id:4, name:'Promoção Especial',    cat:'Varejo',   px:'1080p', badge:'FREE',
    bg:'linear-gradient(135deg,#0a0510 0%,#1a0830 60%,#0a0215 100%)',
    accent:'#c084fc', text:'Promoção\nEspecial', cta:'Comprar Agora' },
  { id:5, name:'Story Aesthetic',      cat:'Estética', px:'1920p', badge:'PRO',
    bg:'linear-gradient(135deg,#05080f 0%,#0d1a3a 100%)',
    accent:'#06b6d4', text:'Aesthetic\nVibe', cta:'Ver Mais' },
  { id:6, name:'Anúncio Advocacia',   cat:'Jurídico',  px:'1080p', badge:'PRO',
    bg:'linear-gradient(135deg,#060810 0%,#101833 100%)',
    accent:'#d4af37', text:'Advocacia\nEspecializada', cta:'Consulte Grátis' },
  { id:7, name:'Convite Premium',     cat:'Eventos',   px:'1080p', badge:'FREE',
    bg:'linear-gradient(135deg,#0a030f 0%,#1e0535 100%)',
    accent:'#f472b6', text:'Você está\nConvidado', cta:'Confirmar' },
  { id:8, name:'Clínica Odonto',      cat:'Saúde',    px:'1080p', badge:'PRO',
    bg:'linear-gradient(135deg,#030a10 0%,#082040 100%)',
    accent:'#3b82f6', text:'Sorriso\nPerfeito', cta:'Agende Avaliação' },
]

const CATEGORIES = ['Story','Estética','Moda','Marketing','Anúncio','Saúde','Jurídico','Apresentação','Varejo','Educação']

// ─── Emoji categories ─────────────────────────────────────────────────────────
const EMOJIS = {
  '🔥 Populares': ['🔥','⚡','💥','✨','💫','🌟','⭐','🎯','💎','🏆','💪','🚀','🎪','💡','🎨'],
  '😀 Rostos':    ['😀','😍','🤩','😎','🥳','😈','🤯','🥰','😱','🤑','💀','👻','🤖','😏','🫡'],
  '💼 Negócios':  ['💼','📊','📈','💰','💵','💳','🏆','🎯','📱','💻','🔑','✅','⚠️','🎁','📋'],
  '🌿 Natureza':  ['🌟','🌈','☀️','🌙','❄️','🌊','🍀','🌺','🦋','🌴','🦁','🐯','🦊','🌸','🌻'],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
let _id = 1
const uid = () => `el_${_id++}`

const svgNodeToUrl = (svgEl) => {
  if (!svgEl) return null
  const html = new XMLSerializer().serializeToString(svgEl)
  const blob = new Blob([html], { type: 'image/svg+xml;charset=utf-8' })
  return URL.createObjectURL(blob)
}

const loadImg = (src) =>
  new Promise((res, rej) => {
    const img = new window.Image()
    img.onload = () => res(img)
    img.onerror = rej
    img.crossOrigin = 'anonymous'
    img.src = src
  })

const makeElement = (type, overrides = {}) => {
  const base = { id:uid(), type, x:80, y:80, rotation:0, opacity:1, draggable:true, fill:'#a78bfa', stroke:null, strokeWidth:0 }
  const byType = {
    rect:     { width:140, height:100, cornerRadius:8 },
    circle:   { radius:60, width:120, height:120 },
    star:     { numPoints:5, innerRadius:30, outerRadius:60, width:120, height:120 },
    triangle: { sides:3, radius:60, width:120, height:120 },
    hexagon:  { sides:6, radius:60, width:120, height:120 },
    text:     { text:'Seu texto aqui', fontSize:32, fontFamily:'Inter', fontStyle:'normal', fill:'#f8fafc', width:220, height:50, align:'center' },
    image:    { width:160, height:160, src:null, _img:null },
  }
  return { ...base, ...(byType[type]||{}), ...overrides }
}

// ─── KonvaLoadedImage ─────────────────────────────────────────────────────────
function KonvaLoadedImage({ el, onSelect, onChange }) {
  return el._img ? (
    <KImage
      id={el.id} image={el._img} x={el.x} y={el.y}
      width={el.width} height={el.height} rotation={el.rotation} opacity={el.opacity}
      draggable
      onClick={() => onSelect(el.id)} onTap={() => onSelect(el.id)}
      onDragEnd={e => onChange(el.id, { x:e.target.x(), y:e.target.y() })}
      onTransformEnd={e => {
        const n = e.target
        onChange(el.id, { x:n.x(), y:n.y(), width:Math.max(20,n.width()*n.scaleX()), height:Math.max(20,n.height()*n.scaleY()), rotation:n.rotation() })
        n.scaleX(1); n.scaleY(1)
      }}
    />
  ) : null
}

// ─── Template Card ────────────────────────────────────────────────────────────
function TemplateCard({ t, size = 'sm', onClick }) {
  const [hov, setHov] = useState(false)
  const h = size === 'sm' ? 90 : 130
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position:'relative', height:h, borderRadius:10, overflow:'hidden',
        cursor:'pointer', background:t.bg,
        border: hov ? `1px solid ${t.accent}55` : '1px solid rgba(255,255,255,0.06)',
        transition:'all 0.2s', transform: hov ? 'scale(1.02)' : 'scale(1)',
        boxShadow: hov ? `0 8px 24px rgba(0,0,0,0.5), 0 0 0 1px ${t.accent}33` : 'none',
      }}
    >
      {/* Depth lines */}
      <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg,transparent 30%,rgba(0,0,0,0.4) 100%)' }} />
      {/* Glow accent */}
      <div style={{ position:'absolute', top:'20%', right:'10%', width:40, height:40, borderRadius:'50%', background:t.accent, opacity:0.15, filter:'blur(15px)' }} />
      {/* Text */}
      <div style={{ position:'absolute', left:10, bottom:10, right:10 }}>
        <div style={{ fontSize:10, fontWeight:800, color:t.accent, lineHeight:1.3, textShadow:`0 0 20px ${t.accent}99` }}>
          {t.text}
        </div>
      </div>
      {/* Badge */}
      <div style={{
        position:'absolute', top:7, right:7,
        padding:'2px 6px', borderRadius:20, fontSize:8, fontWeight:800,
        background: t.badge==='PRO' ? 'linear-gradient(135deg,#7c3aed,#c084fc)' : 'rgba(255,255,255,0.1)',
        color: t.badge==='PRO' ? '#fff' : '#94a3b8', border: t.badge!=='PRO' ? '1px solid rgba(255,255,255,0.12)' : 'none',
      }}>{t.badge}</div>
      {/* Name below */}
      {size !== 'sm' && (
        <div style={{ position:'absolute', bottom:-22, left:0, fontSize:10, color:C.textDim, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', width:'100%' }}>{t.name}</div>
      )}
    </div>
  )
}

// ─── Stars Background ─────────────────────────────────────────────────────────
const STARS = Array.from({ length: 60 }, (_, i) => ({
  id:i, x: Math.random()*100, y: Math.random()*100,
  s: Math.random()*1.5+0.3, o: Math.random()*0.4+0.1,
  d: Math.random()*4,
}))

// ══════════════════════════════════════════════════════════════════════════════
// MAIN STUDIO PAGE
// ══════════════════════════════════════════════════════════════════════════════
export default function StudioPage() {
  const toast    = useToast()
  const navigate = useNavigate()
  const stageRef = useRef(null)
  const trRef    = useRef(null)
  const fileInputRef = useRef(null)
  const textareaRef  = useRef(null)
  const { isAdmin } = useAuthStore()
  const adminMode = isAdmin() || sessionStorage.getItem('nexus_admin_mode') === '1'

  // ── Estado Core ──────────────────────────────────────────────────────────────
  const [format,      setFormat]     = useState('feed')
  const [bgColor,     setBgColor]    = useState('#0f172a')
  const [elements,    setElements]   = useState([])
  const [selectedId,  setSelectedId] = useState(null)
  const [history,     setHistory]    = useState([[]])
  const [histIdx,     setHistIdx]    = useState(0)
  const [textEditor,  setTextEditor] = useState(null)
  const [zoom,        setZoom]       = useState(0.85)
  const [showGrid,    setShowGrid]   = useState(false)

  // ── UI Estado ────────────────────────────────────────────────────────────────
  const [sideMode,    setSideMode]   = useState('templates') // templates|elements|uploads|icons|brandkit
  const [activeElemTab, setActiveElemTab] = useState('sugestoes')
  const [collapseMap, setCollapseMap]    = useState({})
  const [emojiCat,    setEmojiCat]   = useState('🔥 Populares')
  const [iconSearch,  setIconSearch]  = useState('')
  const [iconColor,   setIconColor]   = useState('#ffffff')
  const [imgUrlInput, setImgUrlInput] = useState('')
  const [uploadedImgs,setUploadedImgs]= useState([])
  const [isDragOver,  setIsDragOver]  = useState(false)
  const [addingIcon,  setAddingIcon]  = useState(null)
  const [catFilter,   setCatFilter]   = useState(null)
  const [saveStatus,  setSaveStatus]  = useState('saved') // saved|saving|idle
  const [aiModal,     setAiModal]     = useState(false)
  const [aiPrompt,    setAiPrompt]    = useState('')
  const [tplModal,    setTplModal]    = useState(false)
  const [tplForm,     setTplForm]     = useState({ name:'', category:'Marketing', tags:'', is_premium:false, price_credits:0 })
  const [tplSaving,   setTplSaving]   = useState(false)
  const [projectId,   setProjectId]   = useState(null)   // ID do projeto salvo na API
  const [apiTemplates,setApiTemplates]= useState([])     // templates carregados do backend
  const [apiTplLoading,setApiTplLoading]= useState(false)

  const fmt      = FORMATS[format]
  const selected = elements.find(e => e.id === selectedId)

  // ── Autosave indicator on change ─────────────────────────────────────────────
  useEffect(() => {
    if (elements.length === 0) return
    setSaveStatus('saving')
    const t = setTimeout(() => setSaveStatus('saved'), 1200)
    return () => clearTimeout(t)
  }, [elements, bgColor, format])

  // ── Load template da sessão ──────────────────────────────────────────────────
  useEffect(() => {
    const raw = sessionStorage.getItem('nexus_studio_load')
    if (!raw) return
    try {
      const d = JSON.parse(raw)
      sessionStorage.removeItem('nexus_studio_load')
      if (d.elements) setElements(d.elements.map(e => ({...e,_img:null})))
      if (d.bgColor)  setBgColor(d.bgColor)
      if (d.format)   setFormat(d.format)
      toast.success('Template carregado!')
    } catch {}
  }, [])

  // ── Carregar templates da API ─────────────────────────────────────────────────
  useEffect(() => {
    setApiTplLoading(true)
    api.get('/studio/templates?limit=50&page=1')
      .then(data => {
        const list = Array.isArray(data) ? data : (data?.templates || data?.items || [])
        setApiTemplates(list)
      })
      .catch(() => {})
      .finally(() => setApiTplLoading(false))
  }, [])

  // ── Zoom adaptativo ───────────────────────────────────────────────────────────
  useEffect(() => {
    const avW = window.innerWidth - 240 - 240 - 60
    const avH = window.innerHeight - 54 - 44 - 60
    setZoom(Math.min(avW/fmt.w, avH/fmt.h, 1) * 0.88)
  }, [format])

  // ── History ───────────────────────────────────────────────────────────────────
  const pushHistory = useCallback((els) => {
    const h = [...history.slice(0, histIdx+1), els]
    setHistory(h); setHistIdx(h.length-1)
  }, [history, histIdx])

  const undo = () => { if (histIdx>0) { setHistIdx(i=>i-1); setElements(history[histIdx-1]) } }
  const redo = () => { if (histIdx<history.length-1) { setHistIdx(i=>i+1); setElements(history[histIdx+1]) } }

  // ── Transformer ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!trRef.current || !stageRef.current) return
    if (selectedId && !textEditor) {
      const node = stageRef.current.findOne('#'+selectedId)
      trRef.current.nodes(node ? [node] : [])
    } else trRef.current.nodes([])
    trRef.current.getLayer()?.batchDraw()
  }, [selectedId, elements, textEditor])

  // ── CRUD ──────────────────────────────────────────────────────────────────────
  const addElement = useCallback((el) => {
    setElements(prev => { const n=[...prev,el]; pushHistory(n); return n })
    setSelectedId(el.id)
  }, [pushHistory])

  const commitUpdate = useCallback((id, patch) => {
    setElements(prev => { const n=prev.map(e=>e.id===id?{...e,...patch}:e); pushHistory(n); return n })
  }, [pushHistory])

  const deleteEl = useCallback((id) => {
    setElements(prev => { const n=prev.filter(e=>e.id!==id); pushHistory(n); return n })
    setSelectedId(null)
  }, [pushHistory])

  const moveLayer = useCallback((id, dir) => {
    setElements(prev => {
      const i=prev.findIndex(e=>e.id===id); if (i<0) return prev
      const n=[...prev]
      if (dir==='up'&&i<n.length-1)   [n[i],n[i+1]]=[n[i+1],n[i]]
      else if (dir==='down'&&i>0)      [n[i],n[i-1]]=[n[i-1],n[i]]
      else if (dir==='top')    { const [el]=n.splice(i,1); n.push(el) }
      else if (dir==='bottom') { const [el]=n.splice(i,1); n.unshift(el) }
      pushHistory(n); return n
    })
  }, [pushHistory])

  // ── Adicionar formas ──────────────────────────────────────────────────────────
  const addShape = (type) => addElement(makeElement(type, { x:fmt.w/2-60, y:fmt.h/2-60 }))
  const addText  = (opts={}) => addElement(makeElement('text', { x:fmt.w/2-110, y:fmt.h/2-25, ...opts }))

  // ── Lucide Icon → canvas ──────────────────────────────────────────────────────
  const addLucideIcon = useCallback(async (iconName) => {
    const IC = AllIcons[iconName]; if (!IC) return
    setAddingIcon(iconName)
    try {
      const container = document.createElement('div')
      container.style.cssText = 'position:absolute;left:-9999px;top:-9999px;visibility:hidden'
      document.body.appendChild(container)
      const root = createRoot(container)
      await new Promise(resolve => { root.render(<div style={{width:80,height:80}}><IC size={80} color={iconColor} strokeWidth={2}/></div>); setTimeout(resolve,50) })
      const svg = container.querySelector('svg')
      let url
      if (svg) {
        const clone=svg.cloneNode(true); clone.setAttribute('xmlns','http://www.w3.org/2000/svg')
        const svgStr=new XMLSerializer().serializeToString(clone)
        url=URL.createObjectURL(new Blob([svgStr],{type:'image/svg+xml'}))
      } else {
        url='data:image/svg+xml,'+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80"><text y="55" x="10" font-size="48" fill="${iconColor}">${iconName[0]}</text></svg>`)
      }
      root.unmount(); document.body.removeChild(container)
      const img = await loadImg(url)
      addElement(makeElement('image',{x:fmt.w/2-40,y:fmt.h/2-40,width:80,height:80,src:url,_img:img,_name:iconName}))
      toast.success(`${iconName} adicionado!`)
    } catch { toast.error('Erro ao adicionar ícone') }
    finally { setAddingIcon(null) }
  }, [iconColor, fmt, addElement])

  // ── Emoji ──────────────────────────────────────────────────────────────────────
  const addEmoji = (em) => addElement(makeElement('text',{x:fmt.w/2-40,y:fmt.h/2-40,text:em,fontSize:72,fill:'#fff',width:90,height:90,align:'center'}))

  // ── Formas abstratas SVG ──────────────────────────────────────────────────────
  const addAbstractShape = (vb, d, fill) => {
    const svgStr=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="120" height="120"><path d="${d}" fill="${fill}" opacity="0.9"/></svg>`
    const url=URL.createObjectURL(new Blob([svgStr],{type:'image/svg+xml'}))
    loadImg(url).then(img => {
      const size=Math.min(fmt.w,fmt.h)*0.3
      addElement(makeElement('image',{x:fmt.w/2-size/2,y:fmt.h/2-size/2,width:size,height:size,src:url,_img:img}))
    })
  }

  // ── Upload ────────────────────────────────────────────────────────────────────
  const handleImageUpload = useCallback((file) => {
    if (!file?.type.startsWith('image/')) return toast.error('Arquivo inválido')
    if (file.size > 10*1024*1024) return toast.error('Arquivo maior que 10MB')
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const src=ev.target.result
      try {
        const img=await loadImg(src)
        const maxW=fmt.w*0.75, maxH=fmt.h*0.75
        const ratio=Math.min(maxW/img.naturalWidth,maxH/img.naturalHeight,1)
        const w=Math.round(img.naturalWidth*ratio), h=Math.round(img.naturalHeight*ratio)
        addElement(makeElement('image',{x:Math.round((fmt.w-w)/2),y:Math.round((fmt.h-h)/2),width:w,height:h,src,_img:img,_name:file.name}))
        setUploadedImgs(prev=>[{src,name:file.name,_img:img,w,h},...prev.slice(0,19)])
        toast.success(`"${file.name}" adicionado!`)
      } catch { toast.error('Erro ao carregar imagem') }
    }
    reader.readAsDataURL(file)
  }, [fmt, addElement])

  const handleUrlImport = async () => {
    const url=imgUrlInput.trim(); if (!url) return
    try {
      const img=await loadImg(url)
      const maxW=fmt.w*0.75, ratio=Math.min(maxW/img.naturalWidth,1)
      const w=Math.round(img.naturalWidth*ratio), h=Math.round(img.naturalHeight*ratio)
      addElement(makeElement('image',{x:Math.round((fmt.w-w)/2),y:Math.round((fmt.h-h)/2),width:w,height:h,src:url,_img:img}))
      setImgUrlInput(''); toast.success('Imagem por URL adicionada!')
    } catch { toast.error('Não foi possível carregar URL') }
  }

  // ── Export / Save ─────────────────────────────────────────────────────────────
  const exportPNG = () => {
    if (!stageRef.current) return
    setSelectedId(null)
    setTimeout(() => {
      const uri=stageRef.current.toDataURL({pixelRatio:2})
      const a=document.createElement('a')
      a.download=`smart-moon-studio-${format}-${Date.now()}.png`
      a.href=uri; a.click()
      toast.success('PNG exportado em 2x resolução!')
    }, 80)
  }

  const saveToLibrary = () => {
    if (!stageRef.current) return
    setSelectedId(null)
    setSaveStatus('saving')
    setTimeout(async () => {
      const thumbnail = stageRef.current.toDataURL({pixelRatio:0.4})
      const canvasJson = { elements: elements.map(el=>({...el,_img:null})), bgColor, format }
      const projectName = `Post ${new Date().toLocaleDateString('pt-BR')} — ${format}`

      // Salvar localStorage (fallback offline)
      const work = { id: projectId || Date.now(), name: projectName, format, bgColor, thumbnail, createdAt: new Date().toISOString(), elements: canvasJson.elements }
      const existing = JSON.parse(localStorage.getItem('nexus_studio_library')||'[]')
      const idx = existing.findIndex(p => p.id === projectId)
      if (idx >= 0) existing[idx] = work; else existing.unshift(work)
      localStorage.setItem('nexus_studio_library', JSON.stringify(existing.slice(0,50)))
      window.dispatchEvent(new Event('storage'))

      // Salvar na API
      try {
        if (projectId) {
          await api.put(`/studio/projects/${projectId}`, { name: projectName, canvas_json: canvasJson, thumbnail_url: thumbnail })
        } else {
          const res = await api.post('/studio/projects', { name: projectName, canvas_json: canvasJson, thumbnail_url: thumbnail, format })
          if (res?.id) setProjectId(res.id)
        }
        setSaveStatus('saved')
        toast.success('Projeto salvo na nuvem! ☁️')
      } catch {
        setSaveStatus('saved')
        toast.success('Salvo localmente (API offline)')
      }
    }, 60)
  }

  const saveAsTemplate = async () => {
    if (!tplForm.name.trim()) return toast.error('Nome do template obrigatório')
    if (!stageRef.current) return
    setSelectedId(null); setTplSaving(true)
    try {
      const thumbnail=stageRef.current.toDataURL({pixelRatio:0.5})
      await api.post('/studio/templates',{name:tplForm.name,category:tplForm.category,tags:tplForm.tags.split(',').map(t=>t.trim()).filter(Boolean),format,is_premium:tplForm.is_premium,price_credits:Number(tplForm.price_credits),thumbnail_url:thumbnail,konva_json:{elements:elements.map(el=>({...el,_img:null})),bgColor,format}})
      setTplModal(false); toast.success(`Template "${tplForm.name}" publicado!`)
    } catch (err) { toast.error(err?.response?.data?.detail||'Erro ao salvar') }
    finally { setTplSaving(false) }
  }

  // ── Texto inline ──────────────────────────────────────────────────────────────
  const handleTextDblClick = (e, el) => {
    const textNode=e.target, stage=stageRef.current
    textNode.visible(false); stage.batchDraw()
    const absPos=textNode.absolutePosition(), stageEl=stage.container(), box=stageEl.getBoundingClientRect()
    setTextEditor({ id:el.id, x:box.left+absPos.x*zoom, y:box.top+absPos.y*zoom, w:el.width*zoom, h:(el.fontSize||32)*zoom+20, text:el.text })
    setTimeout(()=>textareaRef.current?.focus(),10)
  }

  const commitTextEdit = () => {
    if (!textEditor) return
    const ta=textareaRef.current
    if (ta) {
      commitUpdate(textEditor.id,{text:ta.value})
      const node=stageRef.current?.findOne('#'+textEditor.id)
      if (node){node.visible(true);stageRef.current?.batchDraw()}
    }
    setTextEditor(null)
  }

  // ── Icon list ─────────────────────────────────────────────────────────────────
  const FEATURED_ICONS = ['Heart','Star','Zap','Smile','Crown','Diamond','Rocket','Trophy','Target','Shield','Sparkles','Music','Camera','Play','Mail','Phone','Globe','Navigation','Search','Settings','Users','Lock','Eye','Bell','Shopping Cart','CreditCard','DollarSign','TrendingUp','BarChart','Award','Bookmark','Tag','CalendarDays','Clock','Sun','Moon','Cloud','Snowflake','Leaf','Flame']
  const iconList = useMemo(() => {
    const q = iconSearch.toLowerCase()
    const isComp = (v) => v && typeof v !== 'string' && typeof v !== 'number' && !Array.isArray(v)
    const all = Object.keys(AllIcons).filter(n => n && /^[A-Z]/.test(n) && !n.endsWith('Icon') && n!=='default' && isComp(AllIcons[n]))
    if (!q) {
      const feat = FEATURED_ICONS.filter(n => all.includes(n))
      return [...feat, ...all.filter(n=>!feat.includes(n)).slice(0,260)]
    }
    return all.filter(n=>n.toLowerCase().includes(q)).slice(0,200)
  }, [iconSearch])

  // ── Section collapse ──────────────────────────────────────────────────────────
  const toggleSection = (key) => setCollapseMap(m => ({...m, [key]: !m[key]}))

  // ── Shapes data ───────────────────────────────────────────────────────────────
  const ABSTRACT_SHAPES = [
    ['0 0 100 100','M50 10 Q90 10 90 50 Q90 90 50 90 Q10 90 10 50 Q10 10 50 10Z','#a78bfa'],
    ['0 0 100 100','M50 5 L61 35 L95 35 L68 57 L79 91 L50 70 L21 91 L32 57 L5 35 L39 35Z','#f59e0b'],
    ['0 0 100 100','M50 5 Q80 5 95 25 Q100 50 80 75 Q60 95 30 90 Q5 85 5 60 Q5 25 30 10Z','#06b6d4'],
    ['0 0 100 100','M50 5 C80 10 100 30 95 60 C90 85 65 100 40 95 C15 90 0 65 5 40 C10 15 30 0 50 5Z','#e879f9'],
    ['0 0 100 100','M20 20 Q50 5 80 20 Q95 50 80 80 Q50 95 20 80 Q5 50 20 20Z','#10b981'],
    ['0 0 100 100','M50 10 L90 90 L10 90Z','#fb7185'],
    ['0 0 100 100','M50 10 L90 30 L90 70 L50 90 L10 70 L10 30Z','#34d399'],
    ['0 0 100 100','M10 50 Q10 10 50 10 Q90 10 90 50 Q90 90 50 90 Q10 90 10 50Z M30 50 Q30 30 50 30 Q70 30 70 50 Q70 70 50 70 Q30 70 30 50Z','#f97316'],
  ]

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:C.space, color:C.text, fontFamily:"'Inter',system-ui,sans-serif", overflow:'hidden' }}>

      {/* ═══ TOP BAR ════════════════════════════════════════════════════════════ */}
      <div style={{ height:54, display:'flex', alignItems:'center', padding:'0 16px', background:C.navy, borderBottom:`1px solid ${C.border}`, flexShrink:0, zIndex:100, gap:10 }}>
        {/* Back + Logo */}
        <button onClick={() => navigate('/')} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 10px', borderRadius:8, background:'transparent', border:'none', cursor:'pointer', color:C.textDim, transition:'all 0.15s' }}
          onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,0.05)';e.currentTarget.style.color=C.text}}
          onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color=C.textDim}}>
          <div style={{ width:24, height:24, borderRadius:6, background:'linear-gradient(135deg,#3b82f6,#7c3aed)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:900 }}>✦</div>
          <span style={{ fontSize:13, fontWeight:700, color:'#e2e8f0' }}>Smart Moon</span>
          <span style={{ fontSize:11, color:C.textMuted }}>/</span>
          <span style={{ fontSize:12, color:C.textDim }}>Studio</span>
        </button>

        <div style={{ width:1, height:24, background:C.border }} />

        {/* Project name */}
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 10px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:`1px solid ${C.border}`, cursor:'pointer' }}>
          <span style={{ fontSize:12, fontWeight:600, color:C.text }}>Novo Projeto</span>
          <ChevronDown size={12} color={C.textDim} />
        </div>

        {/* Autosave */}
        <div style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color: saveStatus==='saving' ? '#f59e0b' : '#10b981' }}>
          {saveStatus==='saving' ? (
            <><div style={{ width:6, height:6, borderRadius:'50%', background:'#f59e0b', animation:'pulse 1s infinite' }}/> Salvando...</>
          ) : saveStatus==='saved' ? (
            <><div style={{ width:6, height:6, borderRadius:'50%', background:'#10b981' }}/> Alterações salvas</>
          ) : null}
        </div>

        <div style={{ flex:1 }} />

        {/* Format selector */}
        <div style={{ display:'flex', alignItems:'center', gap:4, padding:'4px 8px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:`1px solid ${C.border}` }}>
          {Object.entries(FORMATS).map(([k,f]) => (
            <button key={k} onClick={() => setFormat(k)} style={{ padding:'3px 8px', borderRadius:6, fontSize:10, fontWeight:700, cursor:'pointer', border:'none', background: format===k ? 'rgba(59,130,246,0.2)' : 'transparent', color: format===k ? C.blue : C.textDim, transition:'all 0.1s' }}>{f.label}</button>
          ))}
        </div>

        <div style={{ width:1, height:24, background:C.border }} />

        {/* Undo/Redo */}
        <button onClick={undo} disabled={histIdx===0} style={{ padding:'6px', borderRadius:7, background:'transparent', border:'none', cursor:'pointer', color:histIdx===0?C.textMuted:C.textDim, transition:'all 0.1s' }} title="Desfazer"><Undo2 size={15}/></button>
        <button onClick={redo} disabled={histIdx===history.length-1} style={{ padding:'6px', borderRadius:7, background:'transparent', border:'none', cursor:'pointer', color:histIdx===history.length-1?C.textMuted:C.textDim, transition:'all 0.1s' }} title="Refazer"><Redo2 size={15}/></button>

        <div style={{ width:1, height:24, background:C.border }} />

        {/* View + Share + Export */}
        <button style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:`1px solid ${C.border}`, cursor:'pointer', color:C.textDim, fontSize:12, fontWeight:600 }}><Eye size={14}/> Visualizar</button>
        <button style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:`1px solid ${C.border}`, cursor:'pointer', color:C.textDim, fontSize:12, fontWeight:600 }}><Share2 size={14}/> Partilhar</button>
        <button onClick={exportPNG} style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', borderRadius:8, background:'rgba(255,255,255,0.06)', border:`1px solid rgba(255,255,255,0.12)`, cursor:'pointer', color:C.text, fontSize:12, fontWeight:700 }}><Download size={14}/> Exportar</button>

        {/* Criar com IA — Primary CTA */}
        <button onClick={() => setAiModal(true)} style={{ display:'flex', alignItems:'center', gap:7, padding:'7px 16px', borderRadius:9, background:'linear-gradient(135deg,#3b82f6,#7c3aed)', border:'none', cursor:'pointer', color:'#fff', fontSize:12, fontWeight:800, boxShadow:'0 4px 20px rgba(59,130,246,0.35)', transition:'all 0.15s' }}
          onMouseEnter={e=>e.currentTarget.style.boxShadow='0 6px 28px rgba(59,130,246,0.5)'}
          onMouseLeave={e=>e.currentTarget.style.boxShadow='0 4px 20px rgba(59,130,246,0.35)'}>
          <Sparkles size={14}/> + Criar com IA
        </button>
      </div>

      {/* ═══ MAIN AREA ══════════════════════════════════════════════════════════ */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

        {/* ═══ LEFT SIDEBAR (240px) ═══════════════════════════════════════════ */}
        <div style={{ width:240, background:C.navy, borderRight:`1px solid ${C.border}`, display:'flex', flexDirection:'column', flexShrink:0, overflowY:'auto', overflowX:'hidden', scrollbarWidth:'thin', scrollbarColor:'rgba(255,255,255,0.06) transparent' }}>

          {/* Sidebar mode tabs */}
          <div style={{ display:'flex', alignItems:'center', gap:1, padding:'8px 10px', borderBottom:`1px solid ${C.border}` }}>
            {[
              { id:'templates', icon:<LayoutTemplate size={14}/>, label:'Templates' },
              { id:'elements',  icon:<Shapes size={14}/>,        label:'Elementos' },
              { id:'uploads',   icon:<UploadIcon size={14}/>,    label:'Upload'    },
              { id:'icons',     icon:<Sparkles size={14}/>,      label:'Ícones'    },
            ].map(m => (
              <button
                key={m.id}
                onClick={() => setSideMode(m.id)}
                style={{ flex:1, padding:'5px 0', borderRadius:7, fontSize:9, fontWeight:700, cursor:'pointer', border:'none', background: sideMode===m.id ? 'rgba(59,130,246,0.18)' : 'transparent', color: sideMode===m.id ? C.blue : C.textDim, transition:'all 0.15s', display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}
              >
                {m.icon}
                <span>{m.label}</span>
              </button>
            ))}
          </div>

          {/* Sidebar content */}
          <div style={{ flex:1, overflowY:'auto', scrollbarWidth:'thin', scrollbarColor:'rgba(255,255,255,0.06) transparent' }}>

            {/* ── TEMPLATES ── */}
            {sideMode === 'templates' && (
              <div style={{ padding:'12px 10px' }}>
                {/* Search */}
                <div style={{ position:'relative', marginBottom:12 }}>
                  <Search size={11} style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:C.textMuted, pointerEvents:'none' }}/>
                  <input style={{ width:'100%', boxSizing:'border-box', padding:'7px 10px 7px 26px', borderRadius:8, background:'rgba(255,255,255,0.05)', border:`1px solid ${C.border}`, color:C.text, fontSize:11, outline:'none', fontFamily:'inherit' }} placeholder="Buscar templates..." />
                </div>


                {/* Template grid — API ou local */}
                <div style={{ fontSize:9, fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:8 }}>
                  Explorar Templates
                  {apiTplLoading && <span style={{ marginLeft:6, opacity:0.5 }}>Carregando...</span>}
                  {apiTemplates.length > 0 && <span style={{ marginLeft:6, color:C.blue }}>• {apiTemplates.length}</span>}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:16 }}>
                  {/* Mostrar templates da API se disponíveis, senão usar locais */}
                  {apiTemplates.length > 0
                    ? (catFilter
                        ? apiTemplates.filter(t => t.category === catFilter)
                        : apiTemplates
                      ).slice(0,8).map(t => {
                        const konva = t.konva_json || {}
                        return (
                          <div key={t.id}>
                            <div
                              onClick={() => {
                                if (konva.elements?.length) {
                                  setElements(konva.elements.map(el => ({...el, _img:null})))
                                  if (konva.bgColor) setBgColor(konva.bgColor)
                                  if (konva.format) setFormat(konva.format)
                                } else {
                                  setBgColor(t.thumbnail_url ? '#0a0520' : '#0f172a')
                                  setElements([
                                    makeElement('text', { x:40, y:fmt.h*0.3, text:t.name, fontSize:28, fontFamily:'Poppins', fontStyle:'bold', fill:'#c084fc', width:fmt.w-80 }),
                                    makeElement('text', { x:40, y:fmt.h*0.5, text:t.category||'', fontSize:14, fill:'rgba(255,255,255,0.6)', width:fmt.w-80 }),
                                  ])
                                }
                                toast.success(`Template "${t.name}" carregado!`)
                              }}
                              style={{ position:'relative', height:90, borderRadius:10, overflow:'hidden', cursor:'pointer', background: t.thumbnail_url ? 'var(--bg-card)' : 'linear-gradient(135deg,#0d0019,#1a0035)', border:'1px solid rgba(255,255,255,0.07)', transition:'all 0.2s' }}
                              onMouseEnter={e => { e.currentTarget.style.transform='scale(1.03)'; e.currentTarget.style.borderColor='rgba(139,92,246,0.4)' }}
                              onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.borderColor='rgba(255,255,255,0.07)' }}
                            >
                              {t.thumbnail_url
                                ? <img src={t.thumbnail_url} alt={t.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                                : <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, color:'#c084fc', padding:8, textAlign:'center' }}>{t.name}</div>
                              }
                              {t.is_premium && <div style={{ position:'absolute', top:6, right:6, padding:'2px 6px', borderRadius:20, fontSize:7, fontWeight:800, background:'linear-gradient(135deg,#7c3aed,#c084fc)', color:'#fff' }}>PRO</div>}
                            </div>
                            <div style={{ marginTop:4, fontSize:9, color:C.textDim }}>
                              <div style={{ fontWeight:600 }}>{t.name}</div>
                              <span style={{ color:C.textMuted }}>{t.category}</span>
                            </div>
                          </div>
                        )
                      })
                    : (catFilter ? TEMPLATES.filter(t=>t.cat===catFilter) : TEMPLATES).slice(0,8).map(t => (
                      <div key={t.id}>
                        <TemplateCard t={t} onClick={() => {
                          toast.success(`Template "${t.name}" carregado!`)
                          setBgColor('#0a0520')
                          setElements([
                            makeElement('text', { x:40, y:fmt.h*0.3, text:t.cta, fontSize:28, fontFamily:'Poppins', fontStyle:'bold', fill:t.accent, width:fmt.w-80 }),
                            makeElement('text', { x:40, y:fmt.h*0.5, text:'Personalize este template', fontSize:14, fill:'rgba(255,255,255,0.6)', width:fmt.w-80 }),
                          ])
                        }} />
                        <div style={{ marginTop:4, fontSize:9, color:C.textDim, lineHeight:1.3 }}>
                          <div style={{ fontWeight:600, color:C.textDim }}>{t.name}</div>
                          <span style={{ color:C.textMuted }}>{t.cat} · {t.px}</span>
                        </div>
                      </div>
                    ))
                  }
                </div>

                {/* Categories */}
                <div style={{ fontSize:9, fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:8 }}>Categorias Populares</div>
                <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:16 }}>
                  <button onClick={() => setCatFilter(null)} style={{ padding:'3px 8px', borderRadius:20, fontSize:9, fontWeight:700, cursor:'pointer', background: !catFilter ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)', border: !catFilter ? '1px solid rgba(59,130,246,0.4)' : `1px solid ${C.border}`, color: !catFilter ? C.blue : C.textDim }}>Todos</button>
                  {CATEGORIES.map(c => (
                    <button key={c} onClick={() => setCatFilter(c===catFilter?null:c)} style={{ padding:'3px 8px', borderRadius:20, fontSize:9, fontWeight:700, cursor:'pointer', background: catFilter===c ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)', border: catFilter===c ? '1px solid rgba(59,130,246,0.4)' : `1px solid ${C.border}`, color: catFilter===c ? C.blue : C.textDim }}>{c}</button>
                  ))}
                </div>

                {/* AI suggestion */}
                <div style={{ padding:'12px', borderRadius:10, background:'linear-gradient(135deg,rgba(59,130,246,0.08),rgba(124,58,237,0.08))', border:'1px solid rgba(59,130,246,0.15)', marginBottom:12 }}>
                  <div style={{ fontSize:10, fontWeight:800, color:C.blue, marginBottom:4 }}>✦ Sugestão IA</div>
                  <div style={{ fontSize:10, color:C.text, marginBottom:8, lineHeight:1.5 }}>Gere templates personalizados para seu nicho com inteligência artificial.</div>
                  <button onClick={() => setAiModal(true)} style={{ width:'100%', padding:'7px', borderRadius:7, background:'linear-gradient(135deg,#3b82f6,#7c3aed)', border:'none', cursor:'pointer', color:'#fff', fontSize:10, fontWeight:800 }}>
                    Gerar com IA
                  </button>
                </div>
              </div>
            )}

            {/* ── ELEMENTOS ── */}
            {sideMode === 'elements' && (
              <div>
                {/* Top type filter */}
                <div style={{ display:'flex', gap:0, padding:'8px 10px', borderBottom:`1px solid ${C.border}` }}>
                  {[
                    { id:'sugestoes', icon:<Zap size={13}/>,       label:'Sug.'  },
                    { id:'texto',     icon:<Type size={13}/>,       label:'Texto' },
                    { id:'fotos',     icon:<ImagePlus size={13}/>,    label:'Fotos' },
                    { id:'videos',    icon:<Video size={13}/>,      label:'Vídeos'},
                  ].map(t => (
                    <button key={t.id} onClick={() => setActiveElemTab(t.id)} style={{ flex:1, padding:'6px 2px', borderRadius:7, fontSize:9, fontWeight:700, cursor:'pointer', border:'none', background: activeElemTab===t.id ? 'rgba(59,130,246,0.15)' : 'transparent', color: activeElemTab===t.id ? C.blue : C.textDim, display:'flex', flexDirection:'column', alignItems:'center', gap:3, transition:'all 0.1s' }}>
                      {t.icon}<span>{t.label}</span>
                    </button>
                  ))}
                </div>

                <div style={{ padding:'10px 10px' }}>
                  {/* Search */}
                  <div style={{ position:'relative', marginBottom:10 }}>
                    <Search size={11} style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:C.textMuted, pointerEvents:'none' }}/>
                    <input style={{ width:'100%', boxSizing:'border-box', padding:'6px 8px 6px 26px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:`1px solid ${C.border}`, color:C.text, fontSize:11, outline:'none', fontFamily:'inherit' }} placeholder="Buscar elementos..." />
                  </div>

                  {/* Section: Formas */}
                  <div>
                    <button onClick={() => toggleSection('formas')} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 0', background:'none', border:'none', cursor:'pointer', color:C.text }}>
                      <span style={{ fontSize:10, fontWeight:700 }}>Formas Primitivas</span>
                      <ChevronDown size={12} color={C.textDim} style={{ transform: collapseMap.formas ? 'rotate(-90deg)' : 'none', transition:'0.2s' }}/>
                    </button>
                    {!collapseMap.formas && (
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:5, marginBottom:12 }}>
                        {[
                          { type:'rect',    svg:'▬', l:'Rect'   },
                          { type:'circle',  svg:'⬤', l:'Círculo'},
                          { type:'triangle',svg:'▲', l:'Triâng.'},
                          { type:'star',    svg:'★', l:'Estrela'},
                          { type:'hexagon', svg:'⬡', l:'Hexa'  },
                        ].map(s => (
                          <button key={s.type} onClick={() => addShape(s.type)} style={{ padding:'8px 2px', borderRadius:9, background:'rgba(255,255,255,0.03)', border:`1px solid ${C.border}`, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:3, color:'#a78bfa', fontSize:16, transition:'all 0.15s' }}
                            onMouseEnter={e=>{e.currentTarget.style.background='rgba(124,58,237,0.15)';e.currentTarget.style.borderColor='rgba(124,58,237,0.3)';e.currentTarget.style.transform='scale(1.05)'}}
                            onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,0.03)';e.currentTarget.style.borderColor=C.border;e.currentTarget.style.transform='scale(1)'}}>
                            <span>{s.svg}</span>
                            <span style={{ fontSize:7, color:C.textMuted, fontWeight:700 }}>{s.l}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Section: Formas Abstratas */}
                  <div>
                    <button onClick={() => toggleSection('abstract')} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 0', background:'none', border:'none', cursor:'pointer', color:C.text }}>
                      <span style={{ fontSize:10, fontWeight:700 }}>Formas Abstratas</span>
                      <ChevronDown size={12} color={C.textDim} style={{ transform: collapseMap.abstract ? 'rotate(-90deg)' : 'none', transition:'0.2s' }}/>
                    </button>
                    {!collapseMap.abstract && (
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:5, marginBottom:12 }}>
                        {ABSTRACT_SHAPES.map(([vb,d,fill],i) => (
                          <div key={i} onClick={() => addAbstractShape(vb,d,fill)}
                            style={{ height:50, borderRadius:9, cursor:'pointer', background:'rgba(255,255,255,0.03)', border:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s' }}
                            onMouseEnter={e=>{e.currentTarget.style.background='rgba(124,58,237,0.15)';e.currentTarget.style.borderColor='rgba(124,58,237,0.3)';e.currentTarget.style.transform='scale(1.06)'}}
                            onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,0.03)';e.currentTarget.style.borderColor=C.border;e.currentTarget.style.transform='scale(1)'}}>
                            <svg viewBox={vb} width={30} height={30}><path d={d} fill={fill} opacity="0.9"/></svg>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Section: Texto */}
                  <div>
                    <button onClick={() => toggleSection('text')} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 0', background:'none', border:'none', cursor:'pointer', color:C.text }}>
                      <span style={{ fontSize:10, fontWeight:700 }}>Texto</span>
                      <ChevronDown size={12} color={C.textDim} style={{ transform: collapseMap.text ? 'rotate(-90deg)' : 'none', transition:'0.2s' }}/>
                    </button>
                    {!collapseMap.text && (
                      <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:12 }}>
                        {[
                          { label:'Título',    size:48, font:'Oswald', style:'bold'   },
                          { label:'Subtítulo', size:24, font:'Inter',  style:'normal' },
                          { label:'Corpo',     size:16, font:'Inter',  style:'normal' },
                          { label:'CTA / Botão', size:18, font:'Poppins', style:'bold', fill:'#3b82f6' },
                        ].map(t => (
                          <button key={t.label} onClick={() => addText({ text:t.label, fontSize:t.size, fontFamily:t.font, fontStyle:t.style, fill:t.fill||'#f8fafc', width:fmt.w-80 })} style={{ padding:'8px 10px', borderRadius:9, background:'rgba(255,255,255,0.03)', border:`1px solid ${C.border}`, cursor:'pointer', textAlign:'left', transition:'all 0.12s' }}
                            onMouseEnter={e=>{e.currentTarget.style.background='rgba(59,130,246,0.1)';e.currentTarget.style.borderColor='rgba(59,130,246,0.3)'}}
                            onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,0.03)';e.currentTarget.style.borderColor=C.border}}>
                            <div style={{ fontFamily:t.font, fontSize:t.size*0.45, fontWeight:t.style==='bold'?800:400, color:t.fill||C.text, lineHeight:1.1 }}>{t.label}</div>
                            <div style={{ fontSize:8, color:C.textMuted, marginTop:2 }}>{t.font} · {t.size}px</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Section: Emoji/Stickers */}
                  <div>
                    <button onClick={() => toggleSection('emoji')} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 0', background:'none', border:'none', cursor:'pointer', color:C.text }}>
                      <span style={{ fontSize:10, fontWeight:700 }}>Emoji 🎭</span>
                      <ChevronDown size={12} color={C.textDim} style={{ transform: collapseMap.emoji ? 'rotate(-90deg)' : 'none', transition:'0.2s' }}/>
                    </button>
                    {!collapseMap.emoji && (
                      <div style={{ marginBottom:12 }}>
                        <div style={{ display:'flex', gap:4, flexWrap:'wrap', marginBottom:8 }}>
                          {Object.keys(EMOJIS).map(cat => (
                            <button key={cat} onClick={() => setEmojiCat(cat)} style={{ padding:'2px 7px', borderRadius:20, fontSize:8, fontWeight:700, cursor:'pointer', background: emojiCat===cat ? 'rgba(251,113,133,0.2)' : 'rgba(255,255,255,0.04)', border: emojiCat===cat ? '1px solid rgba(251,113,133,0.4)' : `1px solid ${C.border}`, color: emojiCat===cat ? '#fb7185' : C.textDim }}>{cat.split(' ')[0]}</button>
                          ))}
                        </div>
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:4 }}>
                          {(EMOJIS[emojiCat]||[]).map(em => (
                            <button key={em} onClick={() => addEmoji(em)} style={{ fontSize:20, padding:'6px 0', borderRadius:8, background:'rgba(255,255,255,0.03)', border:`1px solid ${C.border}`, cursor:'pointer', transition:'all 0.12s', display:'flex', alignItems:'center', justifyContent:'center' }}
                              onMouseEnter={e=>{e.currentTarget.style.background='rgba(251,113,133,0.15)';e.currentTarget.style.transform='scale(1.15)'}}
                              onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,0.03)';e.currentTarget.style.transform='scale(1)'}}>
                              {em}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Section: Botões CTA */}
                  <div>
                    <button onClick={() => toggleSection('btns')} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 0', background:'none', border:'none', cursor:'pointer', color:C.text }}>
                      <span style={{ fontSize:10, fontWeight:700 }}>Botões / CTA</span>
                      <ChevronDown size={12} color={C.textDim} style={{ transform: collapseMap.btns ? 'rotate(-90deg)' : 'none', transition:'0.2s' }}/>
                    </button>
                    {!collapseMap.btns && (
                      <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:12 }}>
                        {[
                          { text:'Saiba Mais',    fill:'#3b82f6', bg:'#0a2040' },
                          { text:'Agende Agora',  fill:'#10b981', bg:'#042010' },
                          { text:'Comprar Agora', fill:'#f59e0b', bg:'#1a0e00' },
                          { text:'Garanta Já',    fill:'#e879f9', bg:'#1a0025' },
                        ].map(b => (
                          <button key={b.text} onClick={() => addElement(makeElement('rect',{ x:fmt.w/2-80, y:fmt.h/2-20, width:160, height:40, fill:b.fill, cornerRadius:20 }))} style={{ padding:'7px', borderRadius:20, border:'none', cursor:'pointer', background:b.fill, color:'#fff', fontSize:11, fontWeight:800, transition:'all 0.12s' }}
                            onMouseEnter={e=>e.currentTarget.style.opacity='0.85'}
                            onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
                            {b.text}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Section: Fundos */}
                  <div>
                    <button onClick={() => toggleSection('bgs')} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 0', background:'none', border:'none', cursor:'pointer', color:C.text }}>
                      <span style={{ fontSize:10, fontWeight:700 }}>Fundos</span>
                      <ChevronDown size={12} color={C.textDim} style={{ transform: collapseMap.bgs ? 'rotate(-90deg)' : 'none', transition:'0.2s' }}/>
                    </button>
                    {!collapseMap.bgs && (
                      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:5, marginBottom:12 }}>
                        {[
                          '#0f172a','#050810','#0c1220',
                          'linear-gradient(135deg,#0f0c29,#302b63)','linear-gradient(135deg,#030a10,#082040)','linear-gradient(135deg,#0a0515,#1a0530)',
                          'linear-gradient(135deg,#0a0010,#2d1060)','linear-gradient(135deg,#050810,#0d2045)','linear-gradient(135deg,#030810,#101833)',
                        ].map((bg,i) => (
                          <div key={i} onClick={() => setBgColor(typeof bg==='string'&&bg.startsWith('linear')?'#0f172a':bg)} style={{ height:36, borderRadius:8, cursor:'pointer', background:bg, border:`1px solid ${C.border}`, transition:'all 0.13s' }} onMouseEnter={e=>{e.currentTarget.style.border='1px solid rgba(59,130,246,0.4)';e.currentTarget.style.transform='scale(1.04)'}} onMouseLeave={e=>{e.currentTarget.style.border=`1px solid ${C.border}`;e.currentTarget.style.transform='scale(1)'}} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── UPLOAD ── */}
            {sideMode === 'uploads' && (
              <div style={{ padding:'12px 10px' }}>
                <div style={{ fontSize:9, fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:10 }}>Upload de Imagem</div>

                {/* Drop zone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e=>{ e.preventDefault(); setIsDragOver(true) }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={e=>{ e.preventDefault(); setIsDragOver(false); if(e.dataTransfer.files[0]) handleImageUpload(e.dataTransfer.files[0]) }}
                  style={{ border: isDragOver ? '2px dashed #3b82f6' : '2px dashed rgba(255,255,255,0.1)', borderRadius:12, padding:'24px 12px', cursor:'pointer', textAlign:'center', transition:'all 0.2s', background: isDragOver ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.02)', marginBottom:12 }}>
                  <div style={{ fontSize:28, marginBottom:6 }}>📁</div>
                  <div style={{ fontSize:11, fontWeight:700, color: isDragOver ? C.blue : C.textDim, marginBottom:3 }}>{isDragOver ? 'Solte aqui!' : 'Clique ou arraste'}</div>
                  <div style={{ fontSize:9, color:C.textMuted }}>PNG · JPG · WebP · SVG · até 10MB</div>
                </div>

                <input ref={fileInputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={e=>{ if(e.target.files[0]) handleImageUpload(e.target.files[0]); e.target.value='' }} />

                {/* URL import */}
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:9, fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:6 }}>Importar URL</div>
                  <input style={{ width:'100%', boxSizing:'border-box', padding:'7px 10px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:`1px solid ${C.border}`, color:C.text, fontSize:11, outline:'none', fontFamily:'inherit', marginBottom:6 }} value={imgUrlInput} onChange={e=>setImgUrlInput(e.target.value)} placeholder="https://..." onKeyDown={e=>e.key==='Enter'&&handleUrlImport()} />
                  <button onClick={handleUrlImport} style={{ width:'100%', padding:'7px', borderRadius:8, background:'linear-gradient(135deg,#06b6d4,#3b82f6)', border:'none', cursor:'pointer', color:'#fff', fontSize:11, fontWeight:700 }}>Importar</button>
                </div>

                {/* Gallery */}
                {uploadedImgs.length > 0 && (
                  <div>
                    <div style={{ fontSize:9, fontWeight:700, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:8 }}>Minhas Imagens</div>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 }}>
                      {uploadedImgs.map((img,i) => (
                        <div key={i} onClick={() => addElement(makeElement('image',{x:fmt.w/2-img.w/2,y:fmt.h/2-img.h/2,width:img.w,height:img.h,src:img.src,_img:img._img}))} style={{ height:56, borderRadius:8, overflow:'hidden', cursor:'pointer', border:`1px solid ${C.border}`, transition:'all 0.15s' }} onMouseEnter={e=>{e.currentTarget.style.border='1px solid rgba(59,130,246,0.5)';e.currentTarget.style.transform='scale(1.04)'}} onMouseLeave={e=>{e.currentTarget.style.border=`1px solid ${C.border}`;e.currentTarget.style.transform='scale(1)'}}>
                          <img src={img.src} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── ÍCONES ── */}
            {sideMode === 'icons' && (
              <div style={{ padding:'12px 10px' }}>
                <div style={{ fontSize:11, fontWeight:800, color:C.blue, marginBottom:10 }}>
                  ✦ Biblioteca ({Object.keys(AllIcons).filter(n=>/^[A-Z]/.test(n)&&!n.endsWith('Icon')).length}+)
                </div>

                {/* Search */}
                <div style={{ position:'relative', marginBottom:8 }}>
                  <Search size={11} style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', color:C.textMuted, pointerEvents:'none' }}/>
                  <input style={{ width:'100%', boxSizing:'border-box', padding:'6px 8px 6px 26px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:`1px solid ${C.border}`, color:C.text, fontSize:11, outline:'none', fontFamily:'inherit' }} value={iconSearch} onChange={e=>setIconSearch(e.target.value)} placeholder="Buscar ícone..."/>
                </div>

                {/* Color */}
                <div style={{ display:'flex', gap:4, marginBottom:10, flexWrap:'wrap' }}>
                  {['#ffffff','#3b82f6','#10b981','#f59e0b','#ef4444','#e879f9','#a78bfa','#0f172a'].map(c => (
                    <div key={c} onClick={() => setIconColor(c)} style={{ width:20, height:20, borderRadius:5, background:c, cursor:'pointer', border: iconColor===c ? '2px solid #fff' : '1px solid rgba(255,255,255,0.12)', transition:'all 0.1s' }} />
                  ))}
                </div>

                {/* Icons grid */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:4 }}>
                  {iconList.map(name => {
                    const IC = AllIcons[name]
                    if (!IC || (typeof IC !== 'function' && typeof IC !== 'object')) return null
                    return (
                      <button key={name} onClick={() => addLucideIcon(name)} disabled={addingIcon===name} title={name} style={{ padding:'7px 2px', borderRadius:8, background: addingIcon===name ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.03)', border:`1px solid ${C.border}`, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:3, transition:'all 0.12s', color:iconColor }}
                        onMouseEnter={e=>{e.currentTarget.style.background='rgba(59,130,246,0.15)';e.currentTarget.style.borderColor='rgba(59,130,246,0.35)';e.currentTarget.style.transform='scale(1.08)'}}
                        onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,0.03)';e.currentTarget.style.borderColor=C.border;e.currentTarget.style.transform='scale(1)'}}>
                        {addingIcon===name ? <div style={{ width:14, height:14, border:'2px solid #3b82f6', borderTopColor:'transparent', borderRadius:'50%', animation:'spin 0.6s linear infinite' }}/> : <IC size={14} color={iconColor}/>}
                        <span style={{ fontSize:6, color:C.textMuted, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:38 }}>{name}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* ═══ CANVAS AREA ════════════════════════════════════════════════════ */}
        <div
          style={{ flex:1, position:'relative', overflow:'hidden', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
            background:`radial-gradient(ellipse at 25% 35%, rgba(59,130,246,0.06) 0%, transparent 55%), radial-gradient(ellipse at 75% 65%, rgba(124,58,237,0.06) 0%, transparent 55%), ${C.space}` }}
          onClick={e => { if (e.target===e.currentTarget) setSelectedId(null) }}>

          {/* Stars */}
          {STARS.map(s => (
            <div key={s.id} style={{ position:'absolute', left:`${s.x}%`, top:`${s.y}%`, width:s.s, height:s.s, borderRadius:'50%', background:'#fff', opacity:s.o, animation:`twinkle ${2+s.d}s ease-in-out infinite`, animationDelay:`${s.d}s`, pointerEvents:'none' }}/>
          ))}

          {/* Format label */}
          <div style={{ position:'absolute', top:14, left:'50%', transform:'translateX(-50%)', zIndex:5 }}>
            <div style={{ padding:'3px 12px', borderRadius:20, background:'rgba(8,13,26,0.85)', border:`1px solid ${C.border}`, backdropFilter:'blur(8px)', fontSize:10, color:C.textDim, fontWeight:600 }}>
              {fmt.label} · {fmt.px}
            </div>
          </div>

          {/* Main canvas card */}
          <div style={{ transform:`scale(${zoom})`, transformOrigin:'center center', transition:'transform 0.15s ease', flexShrink:0, boxShadow:'0 0 0 1px rgba(59,130,246,0.15), 0 0 0 3px rgba(59,130,246,0.04), 0 40px 100px rgba(0,0,0,0.9)', position:'relative' }}
            onClick={e => e.stopPropagation()}>

            <Stage ref={stageRef} width={fmt.w} height={fmt.h}
              onMouseDown={e => { if (e.target===e.target.getStage()) setSelectedId(null) }}
              style={{ display:'block' }}>
              <Layer>
                <Rect x={0} y={0} width={fmt.w} height={fmt.h} fill={bgColor} />
                {showGrid && Array.from({length:Math.floor(fmt.w/40)},(_,i)=><Rect key={`gv${i}`} x={i*40} y={0} width={1} height={fmt.h} fill="rgba(255,255,255,0.04)"/>)}
                {showGrid && Array.from({length:Math.floor(fmt.h/40)},(_,i)=><Rect key={`gh${i}`} x={0} y={i*40} width={fmt.w} height={1} fill="rgba(255,255,255,0.04)"/>)}
                {elements.map(el => {
                  const common = { id:el.id, x:el.x, y:el.y, rotation:el.rotation, opacity:el.opacity, draggable:true, onClick:()=>setSelectedId(el.id), onTap:()=>setSelectedId(el.id), onDragEnd:e=>commitUpdate(el.id,{x:e.target.x(),y:e.target.y()}) }
                  const onTE = e => { const n=e.target; commitUpdate(el.id,{x:n.x(),y:n.y(),width:Math.max(10,n.scaleX()*(el.width||el.radius*2||100)),height:Math.max(10,n.scaleY()*(el.height||el.radius*2||100)),rotation:n.rotation()}); n.scaleX(1);n.scaleY(1) }
                  if (el.type==='rect')    return <Rect     key={el.id} {...common} width={el.width} height={el.height} fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth} cornerRadius={el.cornerRadius} onTransformEnd={onTE}/>
                  if (el.type==='circle')  return <Circle   key={el.id} {...common} radius={el.radius} fill={el.fill} stroke={el.stroke} strokeWidth={el.strokeWidth} onTransformEnd={onTE}/>
                  if (el.type==='star')    return <KStar    key={el.id} {...common} numPoints={el.numPoints} innerRadius={el.innerRadius} outerRadius={el.outerRadius} fill={el.fill} onTransformEnd={onTE}/>
                  if (el.type==='triangle')return <RegularPolygon key={el.id} {...common} sides={3} radius={el.radius} fill={el.fill} onTransformEnd={onTE}/>
                  if (el.type==='hexagon') return <RegularPolygon key={el.id} {...common} sides={6} radius={el.radius} fill={el.fill} onTransformEnd={onTE}/>
                  if (el.type==='image')   return <KonvaLoadedImage key={el.id} el={el} onSelect={setSelectedId} onChange={commitUpdate}/>
                  if (el.type==='text')    return <KText key={el.id} {...common} text={el.text} fontSize={el.fontSize} fontFamily={el.fontFamily} fontStyle={el.fontStyle} fill={el.fill} align={el.align} width={el.width} onDblClick={e=>handleTextDblClick(e,el)} onDblTap={e=>handleTextDblClick(e,el)} onTransformEnd={e=>{const n=e.target;commitUpdate(el.id,{x:n.x(),y:n.y(),fontSize:Math.max(8,el.fontSize*n.scaleX()),width:Math.max(20,n.width()*n.scaleX()),rotation:n.rotation()});n.scaleX(1);n.scaleY(1)}}/>
                  return null
                })}
                <Transformer ref={trRef} anchorStroke="#3b82f6" anchorFill="#0a2040" anchorSize={8} borderStroke="#3b82f6" borderStrokeWidth={1.5} borderDash={[4,2]} boundBoxFunc={(o,n)=>n.width<5||n.height<5?o:n} anchorStyleFunc={a=>{a.cornerRadius(4)}}/>
              </Layer>
            </Stage>

            {/* Empty state overlay */}
            {elements.length === 0 && (
              <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', pointerEvents:'auto', background:'transparent' }}>
                <div style={{ textAlign:'center', marginBottom:28 }}>
                  <div style={{ fontSize:28, marginBottom:8 }}>✦</div>
                  <div style={{ fontSize:16, fontWeight:800, color:'rgba(255,255,255,0.7)', marginBottom:4, lineHeight:1.3 }}>
                    Conteúdo inteligente,<br/>criado em segundos
                  </div>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.3)' }}>Escolha como você prefere começar</div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, width:'80%' }}>
                  {[
                    { icon:'✦', label:'Gerar layout com IA',          action:()=>setAiModal(true),  style:'primary' },
                    { icon:'⊞', label:'Escolher template',            action:()=>setSideMode('templates'), style:'secondary' },
                    { icon:'□', label:'Começar em branco',           action:()=>{},                style:'ghost'   },
                    { icon:'◎', label:'Importar identidade da marca', action:()=>navigate('/brand-kit'), style:'ghost' },
                  ].map(b => (
                    <button key={b.label} onClick={b.action} style={{
                      padding:'12px 10px', borderRadius:10, cursor:'pointer', textAlign:'center', fontSize:11, fontWeight:700, transition:'all 0.2s',
                      background: b.style==='primary' ? 'linear-gradient(135deg,rgba(59,130,246,0.25),rgba(124,58,237,0.25))' : 'rgba(255,255,255,0.06)',
                      border: b.style==='primary' ? '1px solid rgba(59,130,246,0.4)' : b.style==='secondary' ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(255,255,255,0.08)',
                      color: b.style==='primary' ? '#93c5fd' : 'rgba(255,255,255,0.6)',
                    }}
                      onMouseEnter={e=>{e.currentTarget.style.transform='scale(1.03)';e.currentTarget.style.background=b.style==='primary'?'linear-gradient(135deg,rgba(59,130,246,0.35),rgba(124,58,237,0.35))':'rgba(255,255,255,0.1)'}}
                      onMouseLeave={e=>{e.currentTarget.style.transform='scale(1)';e.currentTarget.style.background=b.style==='primary'?'linear-gradient(135deg,rgba(59,130,246,0.25),rgba(124,58,237,0.25))':'rgba(255,255,255,0.06)'}}>
                      <div style={{ fontSize:18, marginBottom:5 }}>{b.icon}</div>
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Template suggestions strip below canvas */}
          {elements.length === 0 && (
            <div style={{ position:'absolute', bottom:0, left:0, right:0, padding:'12px 24px', background:'linear-gradient(0deg,rgba(5,8,16,0.98) 0%,rgba(5,8,16,0) 100%)' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                <span style={{ fontSize:11, color:C.textDim, fontWeight:600 }}>Sugestões para inspirar</span>
                <button onClick={() => setSideMode('templates')} style={{ fontSize:10, color:C.blue, fontWeight:700, background:'none', border:'none', cursor:'pointer' }}>Ver mais →</button>
              </div>
              <div style={{ display:'flex', gap:10 }}>
                {TEMPLATES.slice(0,5).map(t => (
                  <div key={t.id} onClick={() => { setSideMode('templates'); toast.info(`Abrindo "${t.name}"`) }} style={{ flex:1, height:66, borderRadius:8, overflow:'hidden', cursor:'pointer', background:t.bg, border:`1px solid ${C.border}`, position:'relative', transition:'all 0.2s' }} onMouseEnter={e=>{e.currentTarget.style.transform='scale(1.04)';e.currentTarget.style.border=`1px solid ${t.accent}55`}} onMouseLeave={e=>{e.currentTarget.style.transform='scale(1)';e.currentTarget.style.border=`1px solid ${C.border}`}}>
                    <div style={{ position:'absolute', bottom:4, left:6, right:6, fontSize:7, fontWeight:700, color:t.accent }}>{t.name}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Zoom controls */}
          <div style={{ position:'absolute', bottom:16, right:16, display:'flex', gap:4, alignItems:'center', background:'rgba(8,13,26,0.9)', border:`1px solid ${C.border}`, borderRadius:10, padding:'4px 6px', backdropFilter:'blur(8px)' }}>
            <button onClick={undo} style={{ padding:'4px 6px', borderRadius:6, background:'transparent', border:'none', cursor:'pointer', color:C.textDim }} title="Desfazer"><Undo2 size={12}/></button>
            <div style={{ width:1, height:16, background:C.border }}/>
            <button onClick={() => setZoom(z=>Math.max(0.2,+(z-0.1).toFixed(1)))} style={{ padding:'4px', borderRadius:6, background:'transparent', border:'none', cursor:'pointer', color:C.textDim }}><ZoomOut size={12}/></button>
            <button onClick={() => setZoom(0.85)} style={{ padding:'3px 8px', borderRadius:6, background:'rgba(255,255,255,0.04)', border:`1px solid ${C.border}`, cursor:'pointer', color:C.text, fontSize:10, fontWeight:700, minWidth:40, textAlign:'center' }}>{Math.round(zoom*100)}%</button>
            <button onClick={() => setZoom(z=>Math.min(2,+(z+0.1).toFixed(1)))} style={{ padding:'4px', borderRadius:6, background:'transparent', border:'none', cursor:'pointer', color:C.textDim }}><ZoomIn size={12}/></button>
            <div style={{ width:1, height:16, background:C.border }}/>
            <button onClick={() => setShowGrid(g=>!g)} style={{ padding:'4px', borderRadius:6, background: showGrid ? 'rgba(59,130,246,0.2)' : 'transparent', border:'none', cursor:'pointer', color: showGrid ? C.blue : C.textDim }} title="Grade"><Grid2x2 size={12}/></button>
          </div>
        </div>

        {/* ═══ RIGHT PROPERTIES PANEL (240px) ════════════════════════════════ */}
        <div style={{ width:240, background:C.navy, borderLeft:`1px solid ${C.border}`, overflowY:'auto', flexShrink:0, scrollbarWidth:'thin', scrollbarColor:'rgba(255,255,255,0.06) transparent' }}>
          <div style={{ padding:'14px 14px 20px' }}>

            {!selected ? (
              /* ── Canvas props ── */
              <div>
                <div style={{ fontSize:9, fontWeight:800, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:14 }}>Propriedades</div>

                {/* Canvas section */}
                <PSection title="Canvas">
                  <div style={{ marginBottom:10 }}>
                    <div style={{ display:'flex', gap:8, alignItems:'center', padding:'8px 10px', background:'rgba(255,255,255,0.04)', borderRadius:9, border:`1px solid ${C.border}`, marginBottom:8 }}>
                      <div style={{ width:36, height:28, borderRadius:5, background:bgColor, border:`1px solid ${C.border}`, flexShrink:0 }}/>
                      <div>
                        <div style={{ fontSize:11, fontWeight:600, color:C.text }}>{FORMATS[format].label}</div>
                        <div style={{ fontSize:9, color:C.textMuted }}>{FORMATS[format].px}</div>
                      </div>
                    </div>
                    <PRow label="Cor de Fundo">
                      <input type="color" value={bgColor} onChange={e=>setBgColor(e.target.value)} style={{ width:32, height:22, borderRadius:5, border:`1px solid ${C.border}`, cursor:'pointer', padding:1, background:'transparent' }}/>
                    </PRow>
                    <PRow label="Grade">
                      <Toggle value={showGrid} onChange={setShowGrid}/>
                    </PRow>
                  </div>
                </PSection>

                {/* Guia rápida */}
                <PSection title="Guia Rápida">
                  {[
                    { label:'Redimensionar', icon:'↔', action:() => {} },
                    { label:'Histórico', icon:'⏱', badge:histIdx },
                    { label:'Sugestões Inteligentes', icon:'✦', action:()=>setAiModal(true) },
                  ].map(item => (
                    <button key={item.label} onClick={item.action} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 10px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:`1px solid ${C.border}`, cursor:'pointer', color:C.text, marginBottom:5, transition:'all 0.12s' }}
                      onMouseEnter={e=>{e.currentTarget.style.background='rgba(59,130,246,0.08)';e.currentTarget.style.borderColor='rgba(59,130,246,0.25)'}}
                      onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,0.03)';e.currentTarget.style.borderColor=C.border}}>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:12 }}>{item.icon}</span>
                        <span style={{ fontSize:11 }}>{item.label}</span>
                      </div>
                      {item.badge !== undefined ? (
                        <span style={{ padding:'1px 6px', borderRadius:10, background:'rgba(59,130,246,0.2)', color:C.blue, fontSize:9, fontWeight:700 }}>{item.badge}</span>
                      ) : (
                        <ChevronRight size={12} color={C.textMuted}/>
                      )}
                    </button>
                  ))}
                </PSection>

                {/* Layers */}
                {elements.length > 0 && (
                  <PSection title={`Camadas (${elements.length})`}>
                    {[...elements].reverse().map(el => (
                      <div key={el.id} onClick={() => setSelectedId(el.id)} style={{ padding:'6px 8px', borderRadius:7, marginBottom:3, cursor:'pointer', background: selectedId===el.id ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.03)', border: selectedId===el.id ? `1px solid rgba(59,130,246,0.3)` : `1px solid ${C.border}`, display:'flex', alignItems:'center', gap:7, transition:'all 0.12s' }}>
                        <span style={{ fontSize:12 }}>{el.type==='text'?'✏':el.type==='image'?'🖼':'◼'}</span>
                        <span style={{ fontSize:10, color:C.textDim, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{el.type==='text'?el.text?.slice(0,14):el._name||el.type}</span>
                      </div>
                    ))}
                  </PSection>
                )}
              </div>
            ) : selected.type === 'text' ? (
              /* ── Text props ── */
              <div>
                <div style={{ fontSize:9, fontWeight:800, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:12 }}>Texto</div>

                <PSection title="Fonte">
                  <select value={selected.fontFamily} onChange={e=>commitUpdate(selectedId,{fontFamily:e.target.value})} style={{ width:'100%', padding:'7px 8px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:`1px solid ${C.border}`, color:C.text, fontSize:11, outline:'none', cursor:'pointer', fontFamily:'inherit', marginBottom:8 }}>
                    {FONTS.map(f=><option key={f} value={f}>{f}</option>)}
                  </select>

                  <div style={{ display:'flex', gap:6, alignItems:'center', marginBottom:8 }}>
                    <button onClick={()=>commitUpdate(selectedId,{fontSize:Math.max(8,selected.fontSize-2)})} style={iconBtnStyle}><Minus size={11}/></button>
                    <span style={{ flex:1, textAlign:'center', fontSize:14, fontWeight:800, color:C.text }}>{selected.fontSize}</span>
                    <button onClick={()=>commitUpdate(selectedId,{fontSize:Math.min(200,selected.fontSize+2)})} style={iconBtnStyle}><Plus size={11}/></button>
                  </div>

                  <div style={{ display:'flex', gap:4, marginBottom:8 }}>
                    <button onClick={()=>commitUpdate(selectedId,{fontStyle:selected.fontStyle?.includes('bold')?'normal':'bold'})} style={{ ...iconBtnStyle, flex:1, fontWeight:900, background:selected.fontStyle?.includes('bold')?'rgba(59,130,246,0.2)':undefined, color:selected.fontStyle?.includes('bold')?C.blue:undefined }}>B</button>
                    <button onClick={()=>commitUpdate(selectedId,{fontStyle:selected.fontStyle?.includes('italic')?'normal':'italic'})} style={{ ...iconBtnStyle, flex:1, fontStyle:'italic', background:selected.fontStyle?.includes('italic')?'rgba(59,130,246,0.2)':undefined, color:selected.fontStyle?.includes('italic')?C.blue:undefined }}>I</button>
                    {['left','center','right'].map(a=>(
                      <button key={a} onClick={()=>commitUpdate(selectedId,{align:a})} style={{ ...iconBtnStyle, flex:1, background:selected.align===a?'rgba(59,130,246,0.2)':undefined, color:selected.align===a?C.blue:undefined }}>
                        {a==='left'?<AlignLeft size={11}/>:a==='center'?<AlignCenter size={11}/>:<AlignRight size={11}/>}
                      </button>
                    ))}
                  </div>
                </PSection>

                {/* Color */}
                <PSection title="Cor">
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:3, marginBottom:6 }}>
                    {PALETTE.slice(0,12).map(c=>(
                      <div key={c} onClick={()=>commitUpdate(selectedId,{fill:c})} style={{ height:18, borderRadius:4, background:c, cursor:'pointer', border: selected.fill===c ? '2px solid #fff' : '1px solid rgba(255,255,255,0.08)' }}/>
                    ))}
                  </div>
                  <input type="color" value={selected.fill||'#ffffff'} onChange={e=>commitUpdate(selectedId,{fill:e.target.value})} style={{ width:'100%', height:28, borderRadius:7, border:`1px solid ${C.border}`, cursor:'pointer', padding:2, background:'transparent' }}/>
                </PSection>

                {/* Text presets */}
                <PSection title="Hierarquia">
                  {[
                    { label:'Título', size:48, font:'Oswald', style:'bold' },
                    { label:'Subtítulo', size:24, font:'Inter', style:'normal' },
                    { label:'Corpo', size:16, font:'Inter', style:'normal' },
                  ].map(p=>(
                    <button key={p.label} onClick={()=>commitUpdate(selectedId,{fontSize:p.size,fontFamily:p.font,fontStyle:p.style})} style={{ width:'100%', padding:'6px 10px', borderRadius:8, background:'rgba(255,255,255,0.03)', border:`1px solid ${C.border}`, cursor:'pointer', textAlign:'left', color:C.text, marginBottom:4, transition:'all 0.12s' }}
                      onMouseEnter={e=>{e.currentTarget.style.background='rgba(59,130,246,0.08)';e.currentTarget.style.borderColor='rgba(59,130,246,0.25)'}}
                      onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,0.03)';e.currentTarget.style.borderColor=C.border}}>
                      <span style={{ fontFamily:p.font, fontSize:p.size*0.5, fontWeight:p.style==='bold'?800:400 }}>{p.label}</span>
                    </button>
                  ))}
                </PSection>

                {/* Effects / CTA presets */}
                <PSection title="CTA / Efeitos">
                  {['Agende Agora','Comprar Agora','Garantir Já','Saiba Mais'].map((cta,i)=>{
                    const colors=['#3b82f6','#10b981','#e879f9','#f59e0b']
                    return <button key={cta} onClick={()=>commitUpdate(selectedId,{text:cta,fill:colors[i]})} style={{ width:'100%', marginBottom:5, padding:'6px 10px', borderRadius:20, border:'none', cursor:'pointer', background:colors[i]+'20', color:colors[i], fontSize:11, fontWeight:700, borderLeft:`2px solid ${colors[i]}`, textAlign:'left' }}>{cta}</button>
                  })}
                </PSection>

                {/* Opacity */}
                <PSection title={`Opacidade · ${Math.round(selected.opacity*100)}%`}>
                  <input type="range" min={0} max={1} step={0.01} value={selected.opacity} onChange={e=>commitUpdate(selectedId,{opacity:+e.target.value})} style={{ width:'100%', accentColor:C.blue }}/>
                </PSection>

                {/* Delete */}
                <ElemActions selectedId={selectedId} selected={selected} deleteEl={deleteEl} moveLayer={moveLayer}/>
              </div>
            ) : selected.type === 'image' ? (
              /* ── Image props ── */
              <div>
                <div style={{ fontSize:9, fontWeight:800, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:12 }}>Imagem</div>
                <PSection title="Opacidade">
                  <input type="range" min={0} max={1} step={0.01} value={selected.opacity} onChange={e=>commitUpdate(selectedId,{opacity:+e.target.value})} style={{ width:'100%', accentColor:C.blue }}/>
                  <div style={{ textAlign:'center', fontSize:11, color:C.textDim }}>{Math.round(selected.opacity*100)}%</div>
                </PSection>
                <PSection title="Tamanho">
                  <div style={{ display:'flex', gap:6 }}>
                    <div style={{ flex:1 }}>
                      <label style={{ fontSize:9, color:C.textMuted, display:'block', marginBottom:3 }}>Largura</label>
                      <input type="number" value={Math.round(selected.width)} onChange={e=>commitUpdate(selectedId,{width:+e.target.value})} style={{ width:'100%', boxSizing:'border-box', padding:'6px 8px', borderRadius:7, background:'rgba(255,255,255,0.04)', border:`1px solid ${C.border}`, color:C.text, fontSize:11, outline:'none' }}/>
                    </div>
                    <div style={{ flex:1 }}>
                      <label style={{ fontSize:9, color:C.textMuted, display:'block', marginBottom:3 }}>Altura</label>
                      <input type="number" value={Math.round(selected.height)} onChange={e=>commitUpdate(selectedId,{height:+e.target.value})} style={{ width:'100%', boxSizing:'border-box', padding:'6px 8px', borderRadius:7, background:'rgba(255,255,255,0.04)', border:`1px solid ${C.border}`, color:C.text, fontSize:11, outline:'none' }}/>
                    </div>
                  </div>
                </PSection>
                <ElemActions selectedId={selectedId} selected={selected} deleteEl={deleteEl} moveLayer={moveLayer}/>
              </div>
            ) : (
              /* ── Shape props ── */
              <div>
                <div style={{ fontSize:9, fontWeight:800, color:C.textMuted, textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:12 }}>Forma</div>
                <PSection title="Cor de Preenchimento">
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:4, marginBottom:6 }}>
                    {PALETTE.map(c=>(
                      <div key={c} onClick={()=>commitUpdate(selectedId,{fill:c})} style={{ height:20, borderRadius:5, background:c, cursor:'pointer', border: selected.fill===c ? '2px solid #fff' : '1px solid rgba(255,255,255,0.08)', boxShadow:selected.fill===c?`0 0 0 2px rgba(59,130,246,0.6)`:''}}/>
                    ))}
                  </div>
                  <input type="color" value={selected.fill||'#ffffff'} onChange={e=>commitUpdate(selectedId,{fill:e.target.value})} style={{ width:'100%', height:28, borderRadius:7, border:`1px solid ${C.border}`, cursor:'pointer', padding:2, background:'transparent' }}/>
                </PSection>
                <PSection title="Borda">
                  <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                    <input type="color" value={selected.stroke||'#ffffff'} onChange={e=>commitUpdate(selectedId,{stroke:e.target.value})} style={{ width:32, height:24, borderRadius:5, border:`1px solid ${C.border}`, cursor:'pointer', padding:1, background:'transparent', flexShrink:0 }}/>
                    <input type="range" min={0} max={10} step={0.5} value={selected.strokeWidth||0} onChange={e=>commitUpdate(selectedId,{strokeWidth:+e.target.value})} style={{ flex:1, accentColor:C.blue }}/>
                    <span style={{ fontSize:10, color:C.textMuted, minWidth:18 }}>{selected.strokeWidth||0}</span>
                  </div>
                </PSection>
                <PSection title={`Opacidade · ${Math.round(selected.opacity*100)}%`}>
                  <input type="range" min={0} max={1} step={0.01} value={selected.opacity} onChange={e=>commitUpdate(selectedId,{opacity:+e.target.value})} style={{ width:'100%', accentColor:C.blue }}/>
                </PSection>
                {selected.type === 'rect' && (
                  <PSection title="Arredondamento">
                    <input type="range" min={0} max={60} step={1} value={selected.cornerRadius||0} onChange={e=>commitUpdate(selectedId,{cornerRadius:+e.target.value})} style={{ width:'100%', accentColor:C.blue }}/>
                    <div style={{ textAlign:'center', fontSize:10, color:C.textDim }}>{selected.cornerRadius||0}px</div>
                  </PSection>
                )}
                <ElemActions selectedId={selectedId} selected={selected} deleteEl={deleteEl} moveLayer={moveLayer}/>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ═══ BOTTOM TOOLBAR ══════════════════════════════════════════════════════ */}
      <div style={{ height:40, display:'flex', alignItems:'center', padding:'0 14px', background:C.navy, borderTop:`1px solid ${C.border}`, flexShrink:0, gap:6 }}>
        {/* Left tools */}
        <div style={{ display:'flex', gap:2 }}>
          {[
            { icon:<MousePointer size={13}/>, title:'Selecionar',   active:true },
            { icon:<Type size={13}/>,          title:'Texto',        action:addText },
            { icon:<Shapes size={13}/>,        title:'Formas',       action:()=>setSideMode('elements') },
            { icon:<ImagePlus size={13}/>,     title:'Imagem',       action:()=>fileInputRef.current?.click() },
            { icon:<Smile size={13}/>,         title:'Emoji',        action:()=>{ setSideMode('elements'); setCollapseMap(m=>({...m,emoji:false})) } },
            { icon:<Grid2x2 size={13}/>,       title:'Grade',        action:()=>setShowGrid(g=>!g), active:showGrid },
          ].map((t,i) => (
            <button key={i} onClick={t.action} title={t.title} style={{ padding:'5px 7px', borderRadius:7, background: t.active ? 'rgba(59,130,246,0.18)' : 'transparent', border:'none', cursor:'pointer', color: t.active ? C.blue : C.textDim, transition:'all 0.12s' }}
              onMouseEnter={e=>{if(!t.active){e.currentTarget.style.background='rgba(255,255,255,0.06)';e.currentTarget.style.color=C.text}}}
              onMouseLeave={e=>{if(!t.active){e.currentTarget.style.background='transparent';e.currentTarget.style.color=C.textDim}}}>
              {t.icon}
            </button>
          ))}
        </div>

        <div style={{ width:1, height:20, background:C.border, margin:'0 4px' }} />

        {/* Undo/Redo */}
        <button onClick={undo} disabled={histIdx===0} style={{ padding:'5px 7px', borderRadius:7, background:'transparent', border:'none', cursor:'pointer', color:histIdx===0?C.textMuted:C.textDim, transition:'all 0.1s' }}><Undo2 size={13}/></button>
        <button onClick={redo} disabled={histIdx===history.length-1} style={{ padding:'5px 7px', borderRadius:7, background:'transparent', border:'none', cursor:'pointer', color:histIdx===history.length-1?C.textMuted:C.textDim, transition:'all 0.1s' }}><Redo2 size={13}/></button>
        <button onClick={() => { if(window.confirm('Limpar canvas?')){setElements([]);pushHistory([]);setSelectedId(null)} }} style={{ padding:'5px 7px', borderRadius:7, background:'transparent', border:'none', cursor:'pointer', color:C.textMuted, transition:'all 0.1s' }} title="Limpar"><Eraser size={13}/></button>

        <div style={{ flex:1 }} />

        {/* Layers count */}
        {elements.length > 0 && (
          <div style={{ display:'flex', alignItems:'center', gap:4, padding:'3px 8px', borderRadius:7, background:'rgba(255,255,255,0.04)', border:`1px solid ${C.border}` }}>
            <Layers size={11} color={C.textDim}/>
            <span style={{ fontSize:10, color:C.textDim, fontWeight:600 }}>Camadas {elements.length}</span>
          </div>
        )}

        {/* Template save */}
        <button onClick={() => navigate('/studio/library')} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 10px', borderRadius:7, background:'rgba(255,255,255,0.04)', border:`1px solid ${C.border}`, cursor:'pointer', color:C.textDim, fontSize:10, fontWeight:700 }}>
          <BookOpen size={12}/> Biblioteca
        </button>

        <button onClick={saveToLibrary} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 12px', borderRadius:7, background:'rgba(16,185,129,0.12)', border:'1px solid rgba(16,185,129,0.25)', cursor:'pointer', color:'#10b981', fontSize:10, fontWeight:700 }}>
          💾 Salvar
        </button>

        {adminMode && (
          <button onClick={()=>setTplModal(true)} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 12px', borderRadius:7, background:'rgba(245,158,11,0.12)', border:'1px solid rgba(245,158,11,0.25)', cursor:'pointer', color:'#f59e0b', fontSize:10, fontWeight:700 }}>
            ⭐ Template
          </button>
        )}

        <div style={{ width:1, height:20, background:C.border, margin:'0 4px' }} />

        <button onClick={exportPNG} style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:7, background:'linear-gradient(135deg,#3b82f6,#7c3aed)', border:'none', cursor:'pointer', color:'#fff', fontSize:10, fontWeight:800 }}>
          <Download size={12}/> Exportar PNG
        </button>
      </div>

      {/* ── Textarea texto inline ─────────────────────────────────────────────── */}
      {textEditor && (
        <textarea ref={textareaRef} defaultValue={textEditor.text}
          onBlur={commitTextEdit} onKeyDown={e=>{if(e.key==='Escape')commitTextEdit()}}
          style={{ position:'fixed', left:textEditor.x, top:textEditor.y, width:textEditor.w+20, minHeight:textEditor.h, zIndex:1000, padding:'4px 6px', fontSize:textEditor.h*0.7, fontFamily:elements.find(e=>e.id===textEditor.id)?.fontFamily||'Inter', border:'2px solid #3b82f6', borderRadius:4, background:'rgba(8,13,26,0.95)', color:'#f8fafc', resize:'none', outline:'none', boxShadow:'0 0 20px rgba(59,130,246,0.3)' }}/>
      )}

      {/* ═══ AI MODAL ════════════════════════════════════════════════════════════ */}
      {aiModal && (
        <div style={{ position:'fixed', inset:0, zIndex:2000, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', padding:20, backdropFilter:'blur(8px)' }}>
          <div style={{ background:C.dark, border:`1px solid rgba(59,130,246,0.2)`, borderRadius:18, width:'100%', maxWidth:540, padding:28, boxShadow:'0 30px 80px rgba(0,0,0,0.8)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
              <div style={{ width:36, height:36, borderRadius:10, background:'linear-gradient(135deg,#3b82f6,#7c3aed)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>✦</div>
              <div>
                <div style={{ fontSize:16, fontWeight:800, color:C.text }}>Criar com Inteligência Artificial</div>
                <div style={{ fontSize:11, color:C.textDim }}>Descreva o criativo que você precisa</div>
              </div>
              <button onClick={()=>setAiModal(false)} style={{ marginLeft:'auto', background:'none', border:'none', color:C.textDim, cursor:'pointer', fontSize:20 }}>×</button>
            </div>

            <div style={{ marginBottom:14 }}>
              <label style={{ fontSize:11, color:C.textDim, fontWeight:600, display:'block', marginBottom:6 }}>Descreva sua arte</label>
              <textarea
                value={aiPrompt}
                onChange={e=>setAiPrompt(e.target.value)}
                placeholder="Ex: Story promocional de clínica estética premium com fundo escuro, lua crescente, headline elegante e CTA de agendamento"
                style={{ width:'100%', boxSizing:'border-box', padding:'12px 14px', borderRadius:10, background:'rgba(255,255,255,0.04)', border:`1px solid rgba(59,130,246,0.2)`, color:C.text, fontSize:12, outline:'none', fontFamily:'inherit', resize:'vertical', minHeight:100, lineHeight:1.6 }}
              />
            </div>

            {/* Quick prompts */}
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:10, fontWeight:700, color:C.textMuted, marginBottom:8 }}>Prompts rápidos:</div>
              <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                {['Post promoção relâmpago elegante','Story agenda aberta estética','Banner Black Friday premium','Feed lançamento produto tech','Story antes e depois'].map(p=>(
                  <button key={p} onClick={()=>setAiPrompt(p)} style={{ padding:'4px 9px', borderRadius:20, fontSize:9, fontWeight:600, background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.2)', color:C.blue, cursor:'pointer' }}>{p}</button>
                ))}
              </div>
            </div>

            <div style={{ padding:'10px 12px', borderRadius:10, background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.15)', marginBottom:16 }}>
              <div style={{ fontSize:10, color:'#f59e0b', fontWeight:700, marginBottom:3 }}>⚠ Configuração Necessária</div>
              <div style={{ fontSize:10, color:C.textDim, lineHeight:1.5 }}>Para ativar o gerador de imagens IA, configure a chave <code style={{ background:'rgba(255,255,255,0.08)', padding:'1px 5px', borderRadius:4 }}>FAL_KEY</code> no servidor. Entre em contato com o suporte Smart Moon.</div>
            </div>

            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={()=>setAiModal(false)} style={{ padding:'9px 18px', borderRadius:9, border:`1px solid ${C.border}`, background:'transparent', color:C.textDim, cursor:'pointer', fontSize:12, fontWeight:600 }}>Cancelar</button>
              <button onClick={()=>{ toast.info('IA em configuração. Breve disponível!'); setAiModal(false) }} style={{ padding:'9px 20px', borderRadius:9, border:'none', background:'linear-gradient(135deg,#3b82f6,#7c3aed)', color:'#fff', cursor:'pointer', fontSize:12, fontWeight:800, boxShadow:'0 4px 20px rgba(59,130,246,0.4)' }}>
                ✦ Gerar Arte
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ ADMIN TEMPLATE MODAL ═══════════════════════════════════════════════ */}
      {tplModal && (
        <div style={{ position:'fixed', inset:0, zIndex:2000, background:'rgba(0,0,0,0.85)', display:'flex', alignItems:'center', justifyContent:'center', padding:20, backdropFilter:'blur(8px)' }}>
          <div style={{ background:C.dark, border:`1px solid rgba(245,158,11,0.2)`, borderRadius:18, width:'100%', maxWidth:500, padding:28, boxShadow:'0 30px 80px rgba(0,0,0,0.8)' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ fontSize:15, fontWeight:800, color:'#f59e0b' }}>⭐ Salvar como Template Público</div>
              <button onClick={()=>setTplModal(false)} style={{ background:'none', border:'none', color:C.textDim, cursor:'pointer', fontSize:20 }}>×</button>
            </div>
            <div style={{ display:'grid', gap:12 }}>
              {[{label:'Nome *',field:'name',ph:'Ex: Story Neon Dark'},{label:'Categoria',field:'category',type:'select'},{label:'Tags (vírgula)',field:'tags',ph:'promoção, dark, neon'}].map(f=>(
                <div key={f.field}>
                  <label style={{ fontSize:11, color:C.textDim, fontWeight:600, display:'block', marginBottom:5 }}>{f.label}</label>
                  {f.type==='select' ? (
                    <select style={{ width:'100%', padding:'8px 10px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:`1px solid ${C.border}`, color:C.text, fontSize:11, outline:'none', cursor:'pointer', fontFamily:'inherit' }} value={tplForm.category} onChange={e=>setTplForm(x=>({...x,category:e.target.value}))}>
                      {['Marketing','Lançamento','Social Proof','Story','Branding','Tecnologia','Estética','Varejo','Saúde','Educação','Jurídico'].map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                  ) : (
                    <input style={{ width:'100%', boxSizing:'border-box', padding:'8px 10px', borderRadius:8, background:'rgba(255,255,255,0.04)', border:`1px solid ${C.border}`, color:C.text, fontSize:11, outline:'none', fontFamily:'inherit' }} value={tplForm[f.field]} onChange={e=>setTplForm(x=>({...x,[f.field]:e.target.value}))} placeholder={f.ph}/>
                  )}
                </div>
              ))}
              <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontSize:12, color:tplForm.is_premium?'#e879f9':C.textDim, fontWeight:600 }}>
                <input type="checkbox" checked={tplForm.is_premium} onChange={e=>setTplForm(x=>({...x,is_premium:e.target.checked}))} style={{ accentColor:'#e879f9' }}/>
                Template Premium
                {tplForm.is_premium && <input type="number" min={0} style={{ width:80, padding:'4px 8px', borderRadius:6, background:'rgba(255,255,255,0.04)', border:`1px solid ${C.border}`, color:C.text, fontSize:11, outline:'none', marginLeft:8 }} value={tplForm.price_credits} onChange={e=>setTplForm(x=>({...x,price_credits:e.target.value}))} placeholder="Créditos"/>}
              </label>
            </div>
            <div style={{ display:'flex', gap:10, marginTop:20, justifyContent:'flex-end' }}>
              <button onClick={()=>setTplModal(false)} style={{ padding:'8px 16px', borderRadius:8, border:`1px solid ${C.border}`, background:'transparent', color:C.textDim, cursor:'pointer', fontSize:12 }}>Cancelar</button>
              <button onClick={saveAsTemplate} disabled={tplSaving} style={{ padding:'8px 18px', borderRadius:8, border:'none', background:'linear-gradient(135deg,#f59e0b,#fbbf24)', color:'#0f172a', cursor:'pointer', fontSize:12, fontWeight:800, opacity:tplSaving?0.7:1 }}>
                {tplSaving?'Salvando...':'⭐ Criar Template'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CSS */}
      <style>{`
        @keyframes twinkle { 0%,100%{opacity:0.1} 50%{opacity:0.9} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        * { box-sizing:border-box }
        ::-webkit-scrollbar { width:3px }
        ::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.08); border-radius:4px }
        ::-webkit-scrollbar-track { background:transparent }
        select option { background:#0c1220; color:#e2e8f0 }
      `}</style>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────
const iconBtnStyle = {
  padding:'5px 8px', borderRadius:7, background:'rgba(255,255,255,0.04)',
  border:'1px solid rgba(255,255,255,0.08)', cursor:'pointer', color:'#e2e8f0',
  display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.12s',
}

function PSection({ title, children }) {
  const [open, setOpen] = useState(true)
  return (
    <div style={{ marginBottom:14 }}>
      <button onClick={() => setOpen(o=>!o)} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 0 6px', background:'none', border:'none', borderBottom:'1px solid rgba(255,255,255,0.06)', cursor:'pointer', color:'#94a3b8', marginBottom:10 }}>
        <span style={{ fontSize:9, fontWeight:800, textTransform:'uppercase', letterSpacing:'0.7px' }}>{title}</span>
        <ChevronDown size={11} style={{ transform: open?'none':'rotate(-90deg)', transition:'0.2s' }}/>
      </button>
      {open && <div>{children}</div>}
    </div>
  )
}

function PRow({ label, children }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'5px 0' }}>
      <span style={{ fontSize:10, color:'#64748b' }}>{label}</span>
      {children}
    </div>
  )
}

function Toggle({ value, onChange }) {
  return (
    <div onClick={() => onChange(!value)} style={{ width:28, height:15, borderRadius:10, background: value ? 'rgba(59,130,246,0.7)' : 'rgba(255,255,255,0.12)', cursor:'pointer', position:'relative', transition:'all 0.2s', border: '1px solid rgba(255,255,255,0.1)' }}>
      <div style={{ width:11, height:11, borderRadius:'50%', background:'#fff', position:'absolute', top:1, left: value ? 14 : 1, transition:'all 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.3)' }}/>
    </div>
  )
}

function ElemActions({ selectedId, selected, deleteEl, moveLayer }) {
  return (
    <div>
      <PSection title="Camada">
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
          {[{l:'▲ Cima',d:'up'},{l:'▼ Baixo',d:'down'},{l:'▲▲ Topo',d:'top'},{l:'▼▼ Base',d:'bottom'}].map(b=>(
            <button key={b.d} onClick={()=>moveLayer(selectedId,b.d)} style={{ padding:'5px 0', borderRadius:7, fontSize:9, fontWeight:700, cursor:'pointer', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', color:'#64748b', transition:'all 0.15s' }}
              onMouseEnter={e=>{e.currentTarget.style.background='rgba(59,130,246,0.12)';e.currentTarget.style.color='#3b82f6'}}
              onMouseLeave={e=>{e.currentTarget.style.background='rgba(255,255,255,0.04)';e.currentTarget.style.color='#64748b'}}>
              {b.l}
            </button>
          ))}
        </div>
      </PSection>
      <button onClick={()=>deleteEl(selectedId)} style={{ width:'100%', padding:'8px', borderRadius:9, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', cursor:'pointer', color:'#ef4444', fontSize:11, fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', gap:6, transition:'all 0.15s', marginTop:4 }}
        onMouseEnter={e=>e.currentTarget.style.background='rgba(239,68,68,0.2)'}
        onMouseLeave={e=>e.currentTarget.style.background='rgba(239,68,68,0.1)'}>
        <Trash2 size={13}/> Remover Elemento
      </button>
    </div>
  )
}
