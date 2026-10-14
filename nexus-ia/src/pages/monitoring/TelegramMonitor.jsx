import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, User, Bot, Calendar, ChevronRight, 
  Search, Filter, Activity, MessageCircle, AlertCircle, Clock
} from 'lucide-react';
import { api } from '../../api';

const TelegramMonitor = () => {
  const [conversations, setConversations] = useState([]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [convs, statData] = await Promise.all([
          api.telegramListConversations(),
          api.telegramGetStats()
        ]);
        
        setConversations(convs);
        
        setStats([
          { label: 'Conversas Totais', value: statData.total_conversations, icon: MessageCircle, color: 'var(--nexus-violet)' },
          { label: 'Bots Ativos', value: statData.active_bots, icon: Bot, color: 'var(--nexus-cyan)' },
          { label: 'Mensagens Totais', value: statData.total_messages, icon: Activity, color: 'var(--nexus-green)' },
          { label: 'Aguardando Feedback', value: statData.waiting_feedback, icon: Clock, color: 'var(--nexus-amber)' },
        ]);
      } catch (err) {
        console.error('Failed to fetch telegram monitoring data', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredConversations = conversations.filter(c => {
    const matchesSearch = c.display_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.username?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{
      padding: '24px',
      height: '100%',
      overflowY: 'auto',
      background: 'var(--bg-base)',
      display: 'flex',
      flexDirection: 'column',
      gap: '24px'
    }}>
      {/* Header & Stats */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0, letterSpacing: '-0.5px' }}>
            Monitoramento <span style={{ color: 'var(--nexus-cyan)' }}>Telegram</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
            Acompanhe em tempo real as interações dos seus bots.
          </p>
        </div>
        
        <div style={{ display: 'flex', gap: '12px' }}>
          {stats.map((stat, i) => (
            <div key={i} style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              padding: '12px 16px',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              minWidth: '140px'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: `${stat.color}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <stat.icon size={16} color={stat.color} />
              </div>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{stat.label}</div>
                <div style={{ fontSize: '16px', fontWeight: 800 }}>{stat.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters Area */}
      <div style={{
        display: 'flex',
        gap: '16px',
        alignItems: 'center',
        background: 'var(--bg-surface)',
        padding: '16px',
        borderRadius: '16px',
        border: '1px solid var(--border-subtle)'
      }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text"
            placeholder="Buscar por nome ou username..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px 10px 36px',
              background: 'var(--bg-base)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              color: 'var(--text-primary)',
              fontSize: '13px',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--nexus-violet)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--border-subtle)'}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Filter size={14} color="var(--text-muted)" />
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '10px 12px',
              background: 'var(--bg-base)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              color: 'var(--text-primary)',
              fontSize: '13px',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="all">Todos os Status</option>
            <option value="open">Abertas</option>
            <option value="idle">Inativas</option>
            <option value="closed">Fechadas</option>
            <option value="handoff">Handoff</option>
          </select>
        </div>
      </div>

      {/* Conversations List */}
      <div style={{
        background: 'var(--bg-surface)',
        borderRadius: '16px',
        border: '1px solid var(--border-subtle)',
        overflow: 'hidden',
        flex: 1
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-subtle)' }}>
              <th style={{ textAlign: 'left', padding: '16px', color: 'var(--text-muted)', fontWeight: 600 }}>Usuário</th>
              <th style={{ textAlign: 'left', padding: '16px', color: 'var(--text-muted)', fontWeight: 600 }}>Bot / Integração</th>
              <th style={{ textAlign: 'left', padding: '16px', color: 'var(--text-muted)', fontWeight: 600 }}>Última Mensagem</th>
              <th style={{ textAlign: 'left', padding: '16px', color: 'var(--text-muted)', fontWeight: 600 }}>Status</th>
              <th style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)', fontWeight: 600 }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                  Carregando conversas...
                </td>
              </tr>
            ) : filteredConversations.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                  Nenhuma conversa encontrada.
                </td>
              </tr>
            ) : (
              filteredConversations.map((conv) => (
                <tr key={conv.id} style={{ borderBottom: '1px solid var(--border-subtle)', transition: 'background 0.2s' }} 
                    onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-card)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--nexus-violet), var(--nexus-cyan))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontWeight: 700,
                        fontSize: '14px'
                      }}>
                        {conv.display_name.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontWeight: 700 }}>{conv.display_name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>@{conv.username}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Bot size={14} color="var(--nexus-cyan)" />
                      <span style={{ fontWeight: 600 }}>{conv.bot_name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '16px', maxWidth: '300px' }}>
                    <div style={{ 
                      whiteSpace: 'nowrap', 
                      overflow: 'hidden', 
                      textOverflow: 'ellipsis',
                      color: 'var(--text-primary)'
                    }}>
                      {conv.last_message}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={10} />
                      {new Date(conv.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </td>
                  <td style={{ padding: '16px' }}>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '20px',
                      fontSize: '10px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      background: conv.status === 'open' ? 'var(--nexus-green)15' : 
                                  conv.status === 'idle' ? 'var(--nexus-amber)15' : 'var(--text-muted)15',
                      color: conv.status === 'open' ? 'var(--nexus-green)' : 
                             conv.status === 'idle' ? 'var(--nexus-amber)' : 'var(--text-muted)',
                      border: `1px solid ${conv.status === 'open' ? 'var(--nexus-green)30' : 
                                           conv.status === 'idle' ? 'var(--nexus-amber)30' : 'var(--text-muted)30'}`
                    }}>
                      {conv.status}
                    </span>
                  </td>
                  <td style={{ padding: '16px', textAlign: 'center' }}>
                    <button style={{
                      padding: '8px 16px',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: '8px',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      margin: '0 auto',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--nexus-cyan)';
                      e.currentTarget.style.color = 'var(--nexus-cyan)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-subtle)';
                      e.currentTarget.style.color = 'var(--text-primary)';
                    }}
                    >
                      Detalhes
                      <ChevronRight size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TelegramMonitor;
