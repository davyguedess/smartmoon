import { useState } from 'react'
import { Users, Plus, Search, Phone, Mail, Filter, MoreVertical, Tag } from 'lucide-react'

const SAMPLE_CLIENTS = [
  { id: 1, name: 'João Silva', phone: '+55 11 98888-8888', email: 'joao@email.com', status: 'active', tags: ['VIP', 'Recorrente'], lastPurchase: '2026-03-20', totalSpent: 4500 },
  { id: 2, name: 'Maria Santos', phone: '+55 21 97777-7777', email: 'maria@email.com', status: 'active', tags: ['Novo'], lastPurchase: '2026-03-22', totalSpent: 1500 },
  { id: 3, name: 'Pedro Oliveira', phone: '+55 31 96666-6666', email: 'pedro@email.com', status: 'inactive', tags: ['Lead'], lastPurchase: '2026-02-15', totalSpent: 800 },
  { id: 4, name: 'Ana Costa', phone: '+55 11 95555-5555', email: 'ana@email.com', status: 'active', tags: ['VIP', 'Meta'], lastPurchase: '2026-03-23', totalSpent: 12000 },
  { id: 5, name: 'Carlos Mendes', phone: '+55 85 94444-4444', email: 'carlos@email.com', status: 'active', tags: ['Recorrente'], lastPurchase: '2026-03-18', totalSpent: 3200 },
]

const TAG_COLORS = {
  VIP: '#f59e0b', Recorrente: '#8b5cf6', Novo: '#10b981',
  Lead: '#3b82f6', Meta: '#0082fb', inactive: '#6b7280',
}

export default function Clients() {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [showAdd, setShowAdd] = useState(false)
  const [newClient, setNewClient] = useState({ name: '', phone: '', email: '' })

  const filtered = SAMPLE_CLIENTS.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.phone.includes(search) || c.email.includes(search)
    const matchFilter = filter === 'all' || c.status === filter
    return matchSearch && matchFilter
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
      }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Base de Clientes</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 11, margin: '2px 0 0' }}>
            {SAMPLE_CLIENTS.length} clientes cadastrados
          </p>
        </div>

        {/* Search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--bg-card)', border: '1px solid var(--border-default)',
          borderRadius: 8, padding: '6px 12px', width: 220,
        }}>
          <Search size={13} color="var(--text-muted)" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar cliente..."
            style={{ border: 'none', background: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 12, width: '100%', fontFamily: 'inherit' }}
          />
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 4 }}>
          {['all', 'active', 'inactive'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '5px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              border: '1px solid var(--border-default)',
              background: filter === f ? 'rgba(99,102,241,0.15)' : 'var(--bg-card)',
              color: filter === f ? 'var(--nexus-violet)' : 'var(--text-muted)',
            }}>
              {{ all: 'Todos', active: 'Ativos', inactive: 'Inativos' }[f]}
            </button>
          ))}
        </div>

        <button onClick={() => setShowAdd(true)} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px',
          borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
          background: 'linear-gradient(135deg, var(--nexus-blue), var(--nexus-purple))',
          color: 'white',
        }}>
          <Plus size={14} /> Novo Cliente
        </button>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 4px', marginTop: 12 }}>
          <thead>
            <tr>
              {['Cliente', 'Contato', 'Tags', 'Última compra', 'Total gasto', 'Status', ''].map(h => (
                <th key={h} style={{
                  padding: '8px 12px', textAlign: 'left', fontSize: 10,
                  fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} style={{ cursor: 'pointer' }}
                onMouseEnter={e => Array.from(e.currentTarget.querySelectorAll('td')).forEach(td => td.style.background = 'var(--bg-card-hover)')}
                onMouseLeave={e => Array.from(e.currentTarget.querySelectorAll('td')).forEach(td => td.style.background = 'var(--bg-card)')}
              >
                <td style={{ padding: '10px 12px', background: 'var(--bg-card)', borderRadius: '10px 0 0 10px', borderLeft: '3px solid var(--border-subtle)', transition: 'background 0.1s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--nexus-violet), var(--nexus-cyan))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 700, color: 'white', flexShrink: 0,
                    }}>
                      {c.name.charAt(0)}
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{c.name}</span>
                  </div>
                </td>
                <td style={{ padding: '10px 12px', background: 'var(--bg-card)', transition: 'background 0.1s' }}>
                  <div style={{ fontSize: 11, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)' }}>
                      <Phone size={10} /> {c.phone}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-muted)' }}>
                      <Mail size={10} /> {c.email}
                    </span>
                  </div>
                </td>
                <td style={{ padding: '10px 12px', background: 'var(--bg-card)', transition: 'background 0.1s' }}>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {c.tags.map(t => (
                      <span key={t} style={{
                        padding: '2px 7px', borderRadius: 10, fontSize: 10, fontWeight: 700,
                        background: (TAG_COLORS[t] || '#6b7280') + '20',
                        color: TAG_COLORS[t] || '#6b7280',
                      }}>{t}</span>
                    ))}
                  </div>
                </td>
                <td style={{ padding: '10px 12px', background: 'var(--bg-card)', fontSize: 12, color: 'var(--text-secondary)', transition: 'background 0.1s' }}>
                  {new Date(c.lastPurchase).toLocaleDateString('pt-BR')}
                </td>
                <td style={{ padding: '10px 12px', background: 'var(--bg-card)', transition: 'background 0.1s' }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--nexus-green)' }}>
                    R$ {c.totalSpent.toLocaleString('pt-BR')}
                  </span>
                </td>
                <td style={{ padding: '10px 12px', background: 'var(--bg-card)', transition: 'background 0.1s' }}>
                  <span style={{
                    padding: '3px 9px', borderRadius: 20, fontSize: 10, fontWeight: 700,
                    background: c.status === 'active' ? 'rgba(16,185,129,0.12)' : 'rgba(107,114,128,0.12)',
                    color: c.status === 'active' ? 'var(--nexus-green)' : 'var(--text-muted)',
                  }}>
                    {c.status === 'active' ? 'Ativo' : 'Inativo'}
                  </span>
                </td>
                <td style={{ padding: '10px 12px', background: 'var(--bg-card)', borderRadius: '0 10px 10px 0', transition: 'background 0.1s' }}>
                  <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
                    <MoreVertical size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add client modal */}
      {showAdd && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }} onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div style={{
            background: 'var(--bg-panel)', border: '1px solid var(--border-default)',
            borderRadius: 16, padding: 24, width: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>➕ Novo Cliente</h2>
            {['name', 'phone', 'email'].map(f => (
              <div key={f} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 5, textTransform: 'capitalize' }}>{f}</label>
                <input
                  value={newClient[f]} onChange={e => setNewClient(c => ({ ...c, [f]: e.target.value }))}
                  style={{
                    width: '100%', padding: '9px 12px', borderRadius: 8,
                    background: 'var(--bg-base)', border: '1px solid var(--border-default)',
                    color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setShowAdd(false)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-default)', background: 'var(--bg-card)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13 }}>Cancelar</button>
              <button onClick={() => { console.log('New client:', newClient); setShowAdd(false) }} style={{
                padding: '8px 20px', borderRadius: 8, border: 'none',
                background: 'linear-gradient(135deg, var(--nexus-blue), var(--nexus-purple))',
                color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700,
              }}>Adicionar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
