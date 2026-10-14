/**
 * NEXUS.IA — Admin: Studio Templates Manager
 * /admin/templates
 *
 * Gerenciamento de templates do Studio (modelo Canva):
 *  - Listar todos (draft + published)
 *  - Criar novo (formulário completo)
 *  - Editar existente
 *  - Publicar / Despublicar
 *  - Deletar
 *
 * Fluxo de criação:
 *  1. Admin abre o Studio editor e monta o template
 *  2. Clica "Salvar como Template" (botão admin no Studio)
 *  3. Preenche metadados aqui (ou no Studio)
 *  4. Publica → aparece na Biblioteca de todos os usuários
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Palette, Plus, Edit2, Trash2, Eye, EyeOff, Search,
  Filter, RefreshCw, Check, X, Star, AlertCircle,
  ChevronDown, Upload, BarChart2, BookImage, Sparkles,
} from 'lucide-react'
import { useToast } from '../../components/ui/Toast'
import { api } from '../../api'

// ── Config ──────────────────────────────────────────────────────────────────
const CATEGORIES = [
  'Marketing', 'Lançamento', 'Social Proof', 'Story',
  'Branding', 'Tecnologia', 'Estética', 'Varejo', 'Saúde', 'Educação',
]
const FORMATS = ['feed', 'story', 'banner']
const STATUS_COLORS = {
  published: { bg: 'rgba(16,185,129,0.15)', color: '#10b981', label: 'Publicado' },
  draft:     { bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', label: 'Rascunho'  },
}

// ── Formulário de template ──────────────────────────────────────────────────
const EMPTY_FORM = {
  name: '', description: '', category: 'Marketing',
  format: 'feed', tags: '', is_premium: false, price_credits: 0,
  thumbnail_url: '', konva_json: '{"elements":[],"bgColor":"#0f172a","format":"feed"}',
}

// ══════════════════════════════════════════════════════════════════════════════
export default function AdminTemplatesPage() {
  const toast    = useToast()
  const navigate = useNavigate()

  const [templates, setTemplates]  = useState([])
  const [loading,   setLoading]    = useState(true)
  const [total,     setTotal]      = useState(0)
  const [page,      setPage]       = useState(1)

  // Filtros
  const [search,    setSearch]     = useState('')
  const [catFilter, setCatFilter]  = useState('')
  const [fmtFilter, setFmtFilter]  = useState('')
  const [stFilter,  setStFilter]   = useState('')  // published|draft|''

  // Modal
  const [modal,     setModal]      = useState(null)   // null | 'create' | 'edit'
  const [form,      setForm]       = useState(EMPTY_FORM)
  const [saving,    setSaving]     = useState(false)
  const [editId,    setEditId]     = useState(null)

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetch = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page, per_page: 20 })
      if (search)    params.set('q',          search)
      if (catFilter) params.set('category',   catFilter)
      if (fmtFilter) params.set('format',     fmtFilter)
      // status filter via admin endpoint
      const res  = await api.get(`/studio/templates?${params}`)
      const data = res.data
      setTemplates(data.items || [])
      setTotal(data.total || 0)
    } catch { toast.error('Erro ao carregar templates') }
    finally  { setLoading(false) }
  }, [page, search, catFilter, fmtFilter])

  useEffect(() => { fetch() }, [fetch])

  // ── Publicar / Despublicar ────────────────────────────────────────────────
  const togglePublish = async (tpl) => {
    try {
      const res = await api.post(`/studio/templates/${tpl.id}/publish`)
      toast.success(res.data.message)
      fetch()
    } catch { toast.error('Erro ao alterar status') }
  }

  // ── Deletar ───────────────────────────────────────────────────────────────
  const deleteTemplate = async (tpl) => {
    if (!window.confirm(`Deletar "${tpl.name}"? Esta ação é irreversível.`)) return
    try {
      await api.delete(`/studio/templates/${tpl.id}`)
      toast.success('Template deletado')
      fetch()
    } catch { toast.error('Erro ao deletar') }
  }

  // ── Salvar (create / edit) ────────────────────────────────────────────────
  const saveTemplate = async () => {
    if (!form.name.trim()) return toast.error('Nome obrigatório')
    let konva
    try { konva = JSON.parse(form.konva_json) }
    catch { return toast.error('Konva JSON inválido — verifique o formato') }

    setSaving(true)
    try {
      const payload = {
        ...form,
        tags:          form.tags.split(',').map(t => t.trim()).filter(Boolean),
        price_credits: Number(form.price_credits),
        konva_json:    konva,
      }
      if (modal === 'create') {
        await api.post('/studio/templates', payload)
        toast.success('Template criado! Publique para torná-lo visível.')
      } else {
        await api.put(`/studio/templates/${editId}`, payload)
        toast.success('Template atualizado!')
      }
      setModal(null)
      fetch()
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Erro ao salvar')
    } finally { setSaving(false) }
  }

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setEditId(null)
    setModal('create')
  }

  const openEdit = (tpl) => {
    setForm({
      name:          tpl.name,
      description:   tpl.description || '',
      category:      tpl.category,
      format:        tpl.format,
      tags:          (tpl.tags || []).join(', '),
      is_premium:    tpl.is_premium,
      price_credits: tpl.price_credits,
      thumbnail_url: tpl.thumbnail_url || '',
      konva_json:    JSON.stringify(tpl.konva_json, null, 2),
    })
    setEditId(tpl.id)
    setModal('edit')
  }

  // ── Estilo helpers ────────────────────────────────────────────────────────
  const inp = {
    width: '100%', boxSizing: 'border-box', padding: '9px 12px',
    borderRadius: 8, background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)', color: '#f1f5f9',
    fontSize: 13, outline: 'none', fontFamily: 'inherit',
  }

  return (
    <div style={{ padding: '28px 32px', color: '#f1f5f9', fontFamily: "'Inter', sans-serif", minHeight: '100vh' }}>

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
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>Templates do Studio</h1>
            <p style={{ margin: 0, fontSize: 13, color: '#475569' }}>
              {total} template(s) · Gerencie o que os usuários podem usar
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {/* Botão: criar no Studio */}
          <button
            onClick={() => { sessionStorage.setItem('nexus_admin_mode', '1'); navigate('/studio') }}
            style={{
              padding: '9px 16px', borderRadius: 10, border: '1px solid rgba(167,139,250,0.3)',
              background: 'rgba(124,58,237,0.1)', color: '#a78bfa',
              fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7,
            }}
          >
            <Palette size={14} /> Criar no Studio
          </button>
          {/* Botão: novo template manual */}
          <button
            onClick={openCreate}
            style={{
              padding: '9px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #7c3aed, #a78bfa)',
              color: '#fff', fontSize: 13, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 7,
              boxShadow: '0 4px 14px rgba(124,58,237,0.35)',
            }}
          >
            <Plus size={14} /> Novo Template
          </button>
        </div>
      </div>

      {/* Stats rápidas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Total',      value: total,                                         color: '#a78bfa', icon: BookImage },
          { label: 'Publicados', value: templates.filter(t => t.status==='published').length, color: '#10b981', icon: Eye },
          { label: 'Rascunhos',  value: templates.filter(t => t.status==='draft').length,     color: '#f59e0b', icon: EyeOff },
          { label: 'Premium',    value: templates.filter(t => t.is_premium).length,           color: '#e879f9', icon: Star },
        ].map(stat => {
          const Icon = stat.icon
          return (
            <div key={stat.label} style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 12, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${stat.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={16} color={stat.color} />
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: 11, color: '#475569' }}>{stat.label}</div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
          <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#334155' }} />
          <input
            style={{ ...inp, paddingLeft: 32 }}
            placeholder="Buscar templates..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <select value={catFilter} onChange={e => { setCatFilter(e.target.value); setPage(1) }} style={{ ...inp, width: 'auto', cursor: 'pointer' }}>
          <option value="">Todas categorias</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={fmtFilter} onChange={e => { setFmtFilter(e.target.value); setPage(1) }} style={{ ...inp, width: 'auto', cursor: 'pointer' }}>
          <option value="">Todos formatos</option>
          {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <button onClick={fetch} style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#94a3b8', cursor: 'pointer' }}>
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Tabela */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#334155' }}>Carregando...</div>
      ) : templates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <Sparkles size={40} color="#334155" style={{ marginBottom: 16 }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: '#334155', marginBottom: 8 }}>Nenhum template ainda</div>
          <div style={{ fontSize: 13, color: '#1e293b', marginBottom: 20 }}>
            Crie templates no Studio e publique aqui para os usuários
          </div>
          <button onClick={openCreate} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', cursor: 'pointer', background: '#7c3aed', color: '#fff', fontWeight: 700 }}>
            + Criar primeiro template
          </button>
        </div>
      ) : (
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 14, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                {['Preview', 'Nome / Categoria', 'Formato', 'Preço', 'Status', 'Stats', 'Ações'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {templates.map(tpl => {
                const st = STATUS_COLORS[tpl.status] || STATUS_COLORS.draft
                return (
                  <tr key={tpl.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    {/* Preview */}
                    <td style={{ padding: '10px 16px', width: 70 }}>
                      <div style={{ width: 52, height: 52, borderRadius: 8, overflow: 'hidden', background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)' }}>
                        {tpl.thumbnail_url && tpl.thumbnail_url.length < 5000 ? (
                          <img src={tpl.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🎨</div>
                        )}
                      </div>
                    </td>

                    {/* Nome */}
                    <td style={{ padding: '10px 16px', maxWidth: 220 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#f1f5f9', marginBottom: 3 }}>{tpl.name}</div>
                      <div style={{ fontSize: 11, color: '#475569' }}>{tpl.category}</div>
                      <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                        {(tpl.tags || []).slice(0, 3).map(t => (
                          <span key={t} style={{ fontSize: 9, color: '#334155', background: 'rgba(255,255,255,0.04)', padding: '2px 5px', borderRadius: 3 }}>#{t}</span>
                        ))}
                      </div>
                    </td>

                    {/* Formato */}
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ fontSize: 11, color: '#a78bfa', background: 'rgba(124,58,237,0.1)', padding: '3px 8px', borderRadius: 6, fontWeight: 600 }}>
                        {tpl.format}
                      </span>
                    </td>

                    {/* Preço */}
                    <td style={{ padding: '10px 16px' }}>
                      {tpl.is_premium ? (
                        <div>
                          <span style={{ fontSize: 10, background: 'rgba(232,121,249,0.1)', color: '#e879f9', border: '1px solid rgba(232,121,249,0.2)', borderRadius: 4, padding: '2px 6px', fontWeight: 700 }}>PREMIUM</span>
                          <div style={{ fontSize: 11, color: '#e879f9', marginTop: 3 }}>{tpl.price_credits} créditos</div>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: '#10b981', fontWeight: 700 }}>GRÁTIS</span>
                      )}
                    </td>

                    {/* Status */}
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, background: st.bg, color: st.color, padding: '4px 10px', borderRadius: 20 }}>
                        {st.label}
                      </span>
                    </td>

                    {/* Stats */}
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ fontSize: 11, color: '#475569' }}>👁 {tpl.view_count}</div>
                      <div style={{ fontSize: 11, color: '#475569' }}>🎨 {tpl.use_count} usos</div>
                    </td>

                    {/* Ações */}
                    <td style={{ padding: '10px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {/* Publicar/Despublicar */}
                        <button
                          onClick={() => togglePublish(tpl)}
                          title={tpl.status === 'published' ? 'Despublicar' : 'Publicar'}
                          style={{ padding: '6px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', background: tpl.status === 'published' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: tpl.status === 'published' ? '#10b981' : '#f59e0b' }}
                        >
                          {tpl.status === 'published' ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>

                        {/* Editar */}
                        <button
                          onClick={() => openEdit(tpl)}
                          title="Editar"
                          style={{ padding: '6px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', background: 'rgba(167,139,250,0.1)', color: '#a78bfa' }}
                        >
                          <Edit2 size={12} />
                        </button>

                        {/* Deletar */}
                        <button
                          onClick={() => deleteTemplate(tpl)}
                          title="Deletar"
                          style={{ padding: '6px 8px', borderRadius: 6, border: 'none', cursor: 'pointer', background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Create / Edit */}
      {modal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
          padding: '40px 20px', overflowY: 'auto',
        }}>
          <div style={{
            background: '#0d1117', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 18, width: '100%', maxWidth: 700, padding: 32,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>
                {modal === 'create' ? '+ Novo Template' : `✏ Editar: ${form.name}`}
              </div>
              <button onClick={() => setModal(null)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Nome */}
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: 11, color: '#475569', fontWeight: 600, display: 'block', marginBottom: 6 }}>Nome *</label>
                <input style={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Oferta Flash Neon" />
              </div>

              {/* Descrição */}
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: 11, color: '#475569', fontWeight: 600, display: 'block', marginBottom: 6 }}>Descrição</label>
                <input style={inp} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Breve descrição do template..." />
              </div>

              {/* Categoria */}
              <div>
                <label style={{ fontSize: 11, color: '#475569', fontWeight: 600, display: 'block', marginBottom: 6 }}>Categoria</label>
                <select style={{ ...inp, cursor: 'pointer' }} value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              {/* Formato */}
              <div>
                <label style={{ fontSize: 11, color: '#475569', fontWeight: 600, display: 'block', marginBottom: 6 }}>Formato</label>
                <select style={{ ...inp, cursor: 'pointer' }} value={form.format} onChange={e => setForm(f => ({ ...f, format: e.target.value }))}>
                  {FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>

              {/* Tags */}
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: 11, color: '#475569', fontWeight: 600, display: 'block', marginBottom: 6 }}>Tags (separadas por vírgula)</label>
                <input style={inp} value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="promoção, desconto, flash" />
              </div>

              {/* Premium + Preço */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: form.is_premium ? '#e879f9' : '#475569' }}>
                  <input type="checkbox" checked={form.is_premium} onChange={e => setForm(f => ({ ...f, is_premium: e.target.checked }))} style={{ accentColor: '#e879f9' }} />
                  Template Premium
                </label>
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#475569', fontWeight: 600, display: 'block', marginBottom: 6 }}>Preço (créditos)</label>
                <input type="number" min={0} style={inp} value={form.price_credits} onChange={e => setForm(f => ({ ...f, price_credits: e.target.value }))} disabled={!form.is_premium} />
              </div>

              {/* Thumbnail URL */}
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: 11, color: '#475569', fontWeight: 600, display: 'block', marginBottom: 6 }}>URL da Thumbnail</label>
                <input style={inp} value={form.thumbnail_url} onChange={e => setForm(f => ({ ...f, thumbnail_url: e.target.value }))} placeholder="https://... ou data:image/png;base64,..." />
                <div style={{ fontSize: 10, color: '#334155', marginTop: 4 }}>💡 Cole a URL da imagem preview, ou use o Studio para gerar automaticamente</div>
              </div>

              {/* Konva JSON */}
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ fontSize: 11, color: '#475569', fontWeight: 600, display: 'block', marginBottom: 6 }}>
                  Konva JSON (elementos do canvas)
                </label>
                <textarea
                  rows={8}
                  style={{ ...inp, fontFamily: 'monospace', fontSize: 11, lineHeight: 1.5, resize: 'vertical' }}
                  value={form.konva_json}
                  onChange={e => setForm(f => ({ ...f, konva_json: e.target.value }))}
                  placeholder='{"elements":[],"bgColor":"#0f172a","format":"feed"}'
                />
                <div style={{
                  marginTop: 8, padding: '8px 12px', borderRadius: 8,
                  background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.15)',
                  fontSize: 11, color: '#06b6d4',
                }}>
                  💡 <strong>Dica fácil:</strong> Crie o template no{' '}
                  <span
                    onClick={() => { setModal(null); sessionStorage.setItem('nexus_admin_mode', '1'); navigate('/studio') }}
                    style={{ textDecoration: 'underline', cursor: 'pointer' }}
                  >
                    Studio Editor
                  </span>
                  {' '}→ clique "Salvar como Template" → o JSON é preenchido automaticamente.
                </div>
              </div>
            </div>

            {/* Botões */}
            <div style={{ display: 'flex', gap: 12, marginTop: 24, justifyContent: 'flex-end' }}>
              <button onClick={() => setModal(null)} style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.04)', color: '#475569', cursor: 'pointer', fontWeight: 600 }}>
                Cancelar
              </button>
              <button onClick={saveTemplate} disabled={saving} style={{ padding: '10px 20px', borderRadius: 10, border: 'none', cursor: saving ? 'wait' : 'pointer', background: 'linear-gradient(135deg,#7c3aed,#a78bfa)', color: '#fff', fontWeight: 700, opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Salvando...' : (modal === 'create' ? '+ Criar Template' : '✓ Salvar Alterações')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
