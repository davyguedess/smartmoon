/**
 * NEXUS.IA — Studio Library Page
 * Biblioteca de templates prontos + trabalhos salvos do usuário
 *
 * Seções:
 *  1. Templates prontos (inspiração + ponto de partida)
 *  2. Minha Biblioteca (trabalhos salvos no Studio — localStorage)
 *  3. Como importar PSD/AI/Figma
 */
import { useState, useEffect } from 'react'
import {
  BookImage, Sparkles, Download, Edit3, Trash2, Plus,
  Upload, FileImage, ChevronRight, Clock, Grid,
  Instagram, Megaphone, Square, Smartphone, Star,
  BookOpen, Palette, Check, AlertCircle, ExternalLink,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '../../components/ui/Toast'

// ── Templates prontos (pre-built) ─────────────────────────────────────────────
// format: feed | story | banner — elements = array que combina com StudioPage
const BUILT_IN_TEMPLATES = [
  {
    id: 'tpl_promocao',
    name: 'Oferta Especial',
    category: 'Marketing',
    format: 'feed',
    tags: ['promoção', 'venda', 'desconto'],
    preview: '/templates/template_promocao.png',
    bgColor: '#0c0e1e',
    // Estado Konva pré-definido que será carregado no editor
    elements: [
      { id: 'p1', type: 'rect',     x: -10,  y: -10,  width: 500, height: 500, fill: '#1a0533', opacity: 1, cornerRadius: 0, rotation: 0, draggable: true, strokeWidth: 0 },
      { id: 'p2', type: 'star',     x: 320,  y: -20,  numPoints: 6, innerRadius: 50, outerRadius: 140, fill: '#7c3aed', opacity: 0.8, rotation: 15, draggable: true, strokeWidth: 0 },
      { id: 'p3', type: 'hexagon',  x: 360,  y: 30,   sides: 6, radius: 80, fill: '#06b6d4', opacity: 0.3, rotation: 30, draggable: true, strokeWidth: 0 },
      { id: 'p4', type: 'text',     x: 28,   y: 140,  text: 'OFERTA\nESPECIAL', fontSize: 52, fontStyle: 'bold', fontFamily: 'Poppins', fill: '#ffffff', width: 300, align: 'left', rotation: 0, draggable: true, opacity: 1, strokeWidth: 0 },
      { id: 'p5', type: 'text',     x: 28,   y: 310,  text: 'Aproveite nossos descontos\nexclusivos por tempo limitado!', fontSize: 16, fontFamily: 'Inter', fill: '#94a3b8', width: 280, align: 'left', rotation: 0, draggable: true, opacity: 1, strokeWidth: 0 },
      { id: 'p6', type: 'rect',     x: 28,   y: 390,  width: 160, height: 44, fill: '#7c3aed', cornerRadius: 22, rotation: 0, draggable: true, opacity: 1, strokeWidth: 0 },
      { id: 'p7', type: 'text',     x: 28,   y: 403,  text: 'APROVEITE →', fontSize: 14, fontStyle: 'bold', fontFamily: 'Inter', fill: '#ffffff', width: 160, align: 'center', rotation: 0, draggable: true, opacity: 1, strokeWidth: 0 },
    ],
  },
  {
    id: 'tpl_lancamento',
    name: 'Novo Produto',
    category: 'Lançamento',
    format: 'feed',
    tags: ['lançamento', 'produto', 'novidade'],
    preview: '/templates/template_lancamento.png',
    bgColor: '#1e1b4b',
    elements: [
      { id: 'l1', type: 'circle',   x: 330, y: 220,  radius: 120, fill: '#e879f9', opacity: 0.5, rotation: 0, draggable: true, strokeWidth: 0 },
      { id: 'l2', type: 'circle',   x: 370, y: 260,  radius: 90,  fill: '#7c3aed', opacity: 0.6, rotation: 0, draggable: true, strokeWidth: 0 },
      { id: 'l3', type: 'text',     x: 30,  y: 130,  text: 'NOVO\nPRODUTO', fontSize: 54, fontStyle: 'bold', fontFamily: 'Poppins', fill: '#ffffff', width: 320, align: 'left', rotation: 0, draggable: true, opacity: 1, strokeWidth: 0 },
      { id: 'l4', type: 'rect',     x: 30,  y: 305,  width: 120, height: 4, fill: '#06b6d4', cornerRadius: 2, rotation: 0, draggable: true, opacity: 1, strokeWidth: 0 },
      { id: 'l5', type: 'text',     x: 30,  y: 325,  text: 'Prepare-se para uma nova\nexperiência. Lançamento em breve!', fontSize: 15, fontFamily: 'Inter', fill: '#cbd5e1', width: 280, align: 'left', rotation: 0, draggable: true, opacity: 1, strokeWidth: 0 },
    ],
  },
  {
    id: 'tpl_depoimento',
    name: 'Depoimento',
    category: 'Social Proof',
    format: 'feed',
    tags: ['depoimento', 'avaliação', 'cliente'],
    preview: '/templates/template_depoimento.png',
    bgColor: '#0d1117',
    elements: [
      { id: 'd1', type: 'text',     x: 30,  y: 40,   text: '❝', fontSize: 80, fontFamily: 'Georgia', fill: '#7c3aed', width: 100, align: 'left', rotation: 0, draggable: true, opacity: 1, strokeWidth: 0 },
      { id: 'd2', type: 'text',     x: 30,  y: 140,  text: 'Mudou minha vida\ncompletamente', fontSize: 28, fontStyle: 'bold italic', fontFamily: 'Georgia', fill: '#ffffff', width: 420, align: 'center', rotation: 0, draggable: true, opacity: 1, strokeWidth: 0 },
      { id: 'd3', type: 'text',     x: 30,  y: 280,  text: '⭐⭐⭐⭐⭐', fontSize: 28, fontFamily: 'Inter', fill: '#fbbf24', width: 420, align: 'center', rotation: 0, draggable: true, opacity: 1, strokeWidth: 0 },
      { id: 'd4', type: 'circle',   x: 175, y: 350,  radius: 30,  fill: '#1e293b', opacity: 1, rotation: 0, draggable: true, strokeWidth: 2, stroke: '#7c3aed' },
      { id: 'd5', type: 'text',     x: 215, y: 338,  text: '— [Nome do Cliente]\nCliente Satisfeito', fontSize: 13, fontFamily: 'Inter', fill: '#94a3b8', width: 200, align: 'left', rotation: 0, draggable: true, opacity: 1, strokeWidth: 0 },
      { id: 'd6', type: 'rect',     x: 30,  y: 430,  width: 420, height: 3, fill: '#7c3aed', cornerRadius: 2, rotation: 0, draggable: true, opacity: 0.5, strokeWidth: 0 },
    ],
  },
  {
    id: 'tpl_story_abstrato',
    name: 'Story Abstrato',
    category: 'Story',
    format: 'story',
    tags: ['story', 'abstrato', 'animado'],
    preview: '/templates/template_story.png',
    bgColor: '#0a0520',
    elements: [
      { id: 's1', type: 'circle',   x: 80,  y: 30,  radius: 80,  fill: '#7c3aed', opacity: 0.6, rotation: 0, draggable: true, strokeWidth: 0 },
      { id: 's2', type: 'circle',   x: 140, y: 160, radius: 60,  fill: '#06b6d4', opacity: 0.5, rotation: 0, draggable: true, strokeWidth: 0 },
      { id: 's3', type: 'circle',   x: 10,  y: 200, radius: 50,  fill: '#e879f9', opacity: 0.4, rotation: 0, draggable: true, strokeWidth: 0 },
      { id: 's4', type: 'star',     x: 40,  y: 300, numPoints: 4, innerRadius: 15, outerRadius: 35, fill: '#fbbf24', opacity: 0.7, rotation: 45, draggable: true, strokeWidth: 0 },
      { id: 's5', type: 'text',     x: 15,  y: 370, text: 'ARRASTA\nPARA VER ↑', fontSize: 32, fontStyle: 'bold', fontFamily: 'Poppins', fill: '#ffffff', width: 240, align: 'center', rotation: 0, draggable: true, opacity: 1, strokeWidth: 0 },
    ],
  },
  {
    id: 'tpl_minimalista',
    name: 'Minimalista',
    category: 'Branding',
    format: 'feed',
    tags: ['minimalista', 'clean', 'branding'],
    preview: null,
    bgColor: '#f8fafc',
    elements: [
      { id: 'm1', type: 'rect',     x: 0,   y: 0,   width: 480, height: 4, fill: '#7c3aed', cornerRadius: 0, rotation: 0, draggable: true, opacity: 1, strokeWidth: 0 },
      { id: 'm2', type: 'text',     x: 40,  y: 120, text: 'NOME DA\nMARCA', fontSize: 52, fontStyle: 'bold', fontFamily: 'Poppins', fill: '#0f172a', width: 400, align: 'left', rotation: 0, draggable: true, opacity: 1, strokeWidth: 0 },
      { id: 'm3', type: 'text',     x: 40,  y: 280, text: 'Sua proposta de valor aqui.\nSimples e direto ao ponto.', fontSize: 18, fontFamily: 'Inter', fill: '#475569', width: 360, align: 'left', rotation: 0, draggable: true, opacity: 1, strokeWidth: 0 },
      { id: 'm4', type: 'rect',     x: 40,  y: 380, width: 80, height: 3, fill: '#7c3aed', cornerRadius: 2, rotation: 0, draggable: true, opacity: 1, strokeWidth: 0 },
      { id: 'm5', type: 'circle',   x: 320, y: 180, radius: 100, fill: '#e0e7ff', opacity: 0.8, rotation: 0, draggable: true, strokeWidth: 0 },
      { id: 'm6', type: 'text',     x: 0,   y: 476, text: 'smartmoon.online', fontSize: 12, fontFamily: 'Inter', fill: '#94a3b8', width: 480, align: 'center', rotation: 0, draggable: true, opacity: 1, strokeWidth: 0 },
    ],
  },
  {
    id: 'tpl_neon',
    name: 'Neon Game',
    category: 'Tecnologia',
    format: 'feed',
    tags: ['neon', 'tech', 'gaming'],
    preview: null,
    bgColor: '#000814',
    elements: [
      { id: 'n1', type: 'rect',     x: 20,  y: 20,  width: 440, height: 440, fill: '#001233', cornerRadius: 16, rotation: 0, draggable: true, opacity: 1, strokeWidth: 1, stroke: '#06b6d4' },
      { id: 'n2', type: 'star',     x: 200, y: 80,  numPoints: 6, innerRadius: 30, outerRadius: 80, fill: '#06b6d4', opacity: 0.3, rotation: 0, draggable: true, strokeWidth: 0 },
      { id: 'n3', type: 'hexagon',  x: 60,  y: 60,  sides: 6, radius: 40, fill: 'transparent', opacity: 1, rotation: 0, draggable: true, strokeWidth: 1, stroke: '#7c3aed' },
      { id: 'n4', type: 'text',     x: 30,  y: 200, text: 'TECH\nFUTURE', fontSize: 56, fontStyle: 'bold', fontFamily: 'Oswald', fill: '#06b6d4', width: 420, align: 'center', rotation: 0, draggable: true, opacity: 1, strokeWidth: 0 },
      { id: 'n5', type: 'text',     x: 30,  y: 350, text: 'Inovação que transforma', fontSize: 16, fontFamily: 'Inter', fill: '#7c3aed', width: 420, align: 'center', rotation: 0, draggable: true, opacity: 1, strokeWidth: 0 },
    ],
  },
]

const FORMAT_LABELS = { feed: 'Feed 1:1', story: 'Story 9:16', banner: 'Banner' }
const FORMAT_ICONS  = { feed: Square, story: Smartphone, banner: Grid }

// ── LocalStorage helpers ──────────────────────────────────────────────────────
const LS_KEY = 'nexus_studio_library'
const getSaved = () => JSON.parse(localStorage.getItem(LS_KEY) || '[]')
const removeSaved = (id) => {
  const works = getSaved().filter(w => w.id !== id)
  localStorage.setItem(LS_KEY, JSON.stringify(works))
}

// ══════════════════════════════════════════════════════════════════════════════
export default function StudioLibraryPage() {
  const navigate   = useNavigate()
  const toast      = useToast()
  const [activeTab, setActiveTab]  = useState('templates')  // templates | library | import
  const [catFilter, setCatFilter]  = useState('Todos')
  const [savedWorks, setSavedWorks] = useState([])

  useEffect(() => {
    setSavedWorks(getSaved())
    // Listen for storage changes (if Studio saves while this page is open)
    const handler = () => setSavedWorks(getSaved())
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }, [])

  // Abrir template no editor
  const openTemplate = (tpl) => {
    // Salva template selecionado no sessionStorage para o Studio carregar
    sessionStorage.setItem('nexus_studio_load', JSON.stringify({
      elements: tpl.elements,
      bgColor:  tpl.bgColor,
      format:   tpl.format,
    }))
    navigate('/studio')
    toast.success(`Abrindo "${tpl.name}" no editor...`)
  }

  // Abrir trabalho salvo no editor
  const openWork = (work) => {
    sessionStorage.setItem('nexus_studio_load', JSON.stringify({
      elements: work.elements,
      bgColor:  work.bgColor,
      format:   work.format,
    }))
    navigate('/studio')
  }

  // Deletar trabalho salvo
  const deleteWork = (id) => {
    removeSaved(id)
    setSavedWorks(getSaved())
    toast.success('Post removido da biblioteca')
  }

  // Categorias únicas de templates
  const categories = ['Todos', ...new Set(BUILT_IN_TEMPLATES.map(t => t.category))]
  const filtered   = catFilter === 'Todos' ? BUILT_IN_TEMPLATES : BUILT_IN_TEMPLATES.filter(t => t.category === catFilter)

  const s = {
    tab: (active) => ({
      padding: '8px 18px', borderRadius: 10, border: 'none', cursor: 'pointer',
      fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
      background: active ? '#7c3aed' : 'rgba(255,255,255,0.04)',
      color: active ? '#fff' : '#475569',
    }),
    chip: (active) => ({
      padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
      fontSize: 11, fontWeight: 600, transition: 'all 0.15s',
      background: active ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.04)',
      color: active ? '#a78bfa' : '#475569',
      outline: active ? '1px solid rgba(124,58,237,0.4)' : '1px solid rgba(255,255,255,0.07)',
    }),
  }

  // ── Template card ──────────────────────────────────────────────────────────
  const TemplateCard = ({ tpl }) => {
    const FmtIcon = FORMAT_ICONS[tpl.format]
    const isStory = tpl.format === 'story'
    return (
      <div style={{
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14, overflow: 'hidden', transition: 'all 0.2s', cursor: 'pointer',
      }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#7c3aed'; e.currentTarget.style.background = 'rgba(124,58,237,0.06)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
      >
        {/* Preview */}
        <div style={{ position: 'relative', background: tpl.bgColor, overflow: 'hidden', height: isStory ? 200 : 170 }}>
          {tpl.preview ? (
            <img
              src={tpl.preview}
              alt={tpl.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={e => e.target.style.display = 'none'}
            />
          ) : (
            // CSS preview quando não tem imagem
            <div style={{
              width: '100%', height: '100%',
              background: tpl.bgColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🎨</div>
                <div style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>{tpl.name}</div>
              </div>
            </div>
          )}
          {/* Badge de formato */}
          <div style={{
            position: 'absolute', top: 8, right: 8,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
            borderRadius: 20, padding: '3px 8px',
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 9, fontWeight: 700, color: '#94a3b8',
          }}>
            <FmtIcon size={9} /> {FORMAT_LABELS[tpl.format]}
          </div>
          {/* Badge de categoria */}
          <div style={{
            position: 'absolute', top: 8, left: 8,
            background: 'rgba(124,58,237,0.7)', backdropFilter: 'blur(8px)',
            borderRadius: 20, padding: '3px 8px',
            fontSize: 9, fontWeight: 700, color: '#fff',
          }}>{tpl.category}</div>
        </div>

        {/* Info */}
        <div style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>{tpl.name}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
            {tpl.tags.map(tag => (
              <span key={tag} style={{ fontSize: 9, color: '#475569', background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: 4 }}>#{tag}</span>
            ))}
          </div>
          <button
            onClick={() => openTemplate(tpl)}
            style={{
              width: '100%', padding: '9px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
              color: '#fff', fontSize: 12, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <Edit3 size={12} /> Usar este template
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '28px 32px', color: '#f1f5f9', fontFamily: "'Inter', sans-serif", minHeight: '100vh', maxWidth: 1100, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(6,182,212,0.2))',
            border: '1px solid rgba(124,58,237,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <BookImage size={20} color="#a78bfa" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.3px' }}>Biblioteca</h1>
            <p style={{ margin: 0, fontSize: 13, color: '#475569' }}>
              Templates prontos + seus trabalhos salvos no Studio
            </p>
          </div>
        </div>
        <button
          onClick={() => navigate('/studio')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px',
            borderRadius: 10, border: 'none', cursor: 'pointer',
            background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
            color: '#fff', fontSize: 13, fontWeight: 700,
            boxShadow: '0 4px 14px rgba(124,58,237,0.35)',
          }}
        >
          <Plus size={15} /> Criar Arte
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
        <button onClick={() => setActiveTab('templates')} style={s.tab(activeTab === 'templates')}>
          🎨 Templates ({BUILT_IN_TEMPLATES.length})
        </button>
        <button onClick={() => setActiveTab('library')} style={s.tab(activeTab === 'library')}>
          📂 Minha Biblioteca ({savedWorks.length})
        </button>
        <button onClick={() => setActiveTab('import')} style={s.tab(activeTab === 'import')}>
          ⬆ Importar PSD / Arte
        </button>
      </div>

      {/* ── TEMPLATES ── */}
      {activeTab === 'templates' && (
        <div>
          {/* Filtros de categoria */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
            {categories.map(cat => (
              <button key={cat} onClick={() => setCatFilter(cat)} style={s.chip(catFilter === cat)}>{cat}</button>
            ))}
          </div>

          {/* Grid de templates */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
            {filtered.map(tpl => <TemplateCard key={tpl.id} tpl={tpl} />)}

            {/* Card "Em breve" */}
            <div style={{
              background: 'rgba(255,255,255,0.02)', border: '2px dashed rgba(255,255,255,0.08)',
              borderRadius: 14, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12,
              minHeight: 300,
            }}>
              <Sparkles size={28} color="#334155" />
              <div style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>Mais templates</div>
              <div style={{ fontSize: 11, color: '#1e293b', textAlign: 'center' }}>
                Envie um PSD ou descreva e eu implemento
              </div>
              <button
                onClick={() => setActiveTab('import')}
                style={{
                  padding: '7px 14px', borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.04)', color: '#475569',
                  fontSize: 11, fontWeight: 600, cursor: 'pointer',
                }}
              >
                + Solicitar template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MINHA BIBLIOTECA ── */}
      {activeTab === 'library' && (
        <div>
          {savedWorks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
              <div style={{
                width: 72, height: 72, borderRadius: 20,
                background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
              }}>
                <BookImage size={30} color="#7c3aed" />
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', marginBottom: 8 }}>
                Sua biblioteca está vazia
              </div>
              <div style={{ fontSize: 14, color: '#475569', marginBottom: 24 }}>
                Crie artes no Studio e clique em "Salvar Post" para aparecerem aqui
              </div>
              <button
                onClick={() => navigate('/studio')}
                style={{
                  padding: '11px 24px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
                  color: '#fff', fontSize: 14, fontWeight: 700,
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                }}
              >
                <Plus size={15} /> Criar no Studio
              </button>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 13, color: '#475569', marginBottom: 16 }}>
                {savedWorks.length} trabalho(s) salvos — armazenados localmente no seu navegador
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 }}>
                {savedWorks.map(work => (
                  <div key={work.id} style={{
                    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 12, overflow: 'hidden',
                  }}>
                    {/* Thumbnail (se existir) */}
                    <div style={{ height: 140, background: '#0f172a', overflow: 'hidden' }}>
                      {work.thumbnail ? (
                        <img src={work.thumbnail} alt={work.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <FileImage size={32} color="#334155" />
                        </div>
                      )}
                    </div>
                    <div style={{ padding: '10px 12px' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#f1f5f9', marginBottom: 2 }}>{work.name}</div>
                      <div style={{ fontSize: 10, color: '#334155', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Clock size={9} /> {new Date(work.createdAt).toLocaleDateString('pt-BR')} · {FORMAT_LABELS[work.format] || work.format}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          onClick={() => openWork(work)}
                          style={{ flex: 1, padding: '6px', borderRadius: 6, border: 'none', cursor: 'pointer', background: '#7c3aed', color: '#fff', fontSize: 10, fontWeight: 700 }}
                        >
                          <Edit3 size={10} style={{ marginRight: 3 }} /> Editar
                        </button>
                        <button
                          onClick={() => deleteWork(work.id)}
                          style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.2)', cursor: 'pointer', background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── IMPORTAR PSD ── */}
      {activeTab === 'import' && (
        <div style={{ maxWidth: 680 }}>
          <div style={{
            background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)',
            borderRadius: 16, padding: '24px', marginBottom: 24,
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#a78bfa', marginBottom: 12 }}>
              Como importar seus modelos PSD / Figma / AI
            </div>
            <div style={{ display: 'grid', gap: 14 }}>
              {[
                {
                  step: '1',
                  title: 'Exporte do Photoshop / Figma',
                  desc: 'Salve cada template como PNG, SVG ou JPG. Para múltiplas camadas, exporte cada uma separadamente.',
                  icon: FileImage,
                  color: '#06b6d4',
                },
                {
                  step: '2',
                  title: 'Envie os arquivos',
                  desc: 'Mande os arquivos diretamente no chat. Aceito: PSD, AI, PDF, PNG, SVG, JPG, Figma (link ou arquivo).',
                  icon: Upload,
                  color: '#a78bfa',
                },
                {
                  step: '3',
                  title: 'Eu implemento como template editável',
                  desc: 'Converto o design em elementos Konva editáveis (texto, formas, cores) e adicionamos à biblioteca.',
                  icon: Sparkles,
                  color: '#f59e0b',
                },
                {
                  step: '4',
                  title: 'Template disponível para todos os usuários',
                  desc: 'Após aprovação, o template fica disponível na biblioteca de todos os clientes da plataforma.',
                  icon: Check,
                  color: '#10b981',
                },
              ].map(item => {
                const Icon = item.icon
                return (
                  <div key={item.step} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: `${item.color}18`, border: `1px solid ${item.color}30`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Icon size={16} color={item.color} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', marginBottom: 3 }}>
                        {item.step}. {item.title}
                      </div>
                      <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.6 }}>{item.desc}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Formatos aceitos */}
          <div style={{
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 14, padding: '20px',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', marginBottom: 12 }}>
              📁 Formatos aceitos
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {[
                { ext: 'PSD', desc: 'Photoshop', color: '#31a8ff' },
                { ext: 'AI',  desc: 'Illustrator', color: '#ff9a00' },
                { ext: 'SVG', desc: 'Vetorial', color: '#10b981' },
                { ext: 'PNG', desc: 'Imagem', color: '#a78bfa' },
                { ext: 'JPG', desc: 'Foto', color: '#f59e0b' },
                { ext: 'PDF', desc: 'Documento', color: '#ef4444' },
                { ext: 'Figma', desc: 'Link/arquivo', color: '#e879f9' },
              ].map(f => (
                <div key={f.ext} style={{
                  padding: '6px 12px', borderRadius: 8,
                  background: `${f.color}15`, border: `1px solid ${f.color}30`,
                  fontSize: 11, fontWeight: 700, color: f.color,
                }}>
                  {f.ext} <span style={{ opacity: 0.6, fontWeight: 400 }}>— {f.desc}</span>
                </div>
              ))}
            </div>

            <div style={{
              marginTop: 16, padding: '12px 16px', borderRadius: 10,
              background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)',
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <AlertCircle size={14} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.6 }}>
                <strong style={{ color: '#f59e0b' }}>Dica:</strong> Para melhores resultados com PSD,
                exporte cada camada separadamente como PNG transparente.
                Assim o template fica totalmente editável no Studio.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
