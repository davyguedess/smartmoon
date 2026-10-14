import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, User, Bot, Clock, Calendar, Hash, 
  MessageSquare, Brain, Lightbulb, CheckCircle, AlertCircle,
  ChevronDown, Send, MoreVertical, RefreshCcw
} from 'lucide-react';
import { api } from '../../api';

const TelegramConversationDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [feedbackList, setFeedbackList] = useState([]);
  const [newFeedback, setNewFeedback] = useState('');
  const [activeTab, setActiveTab] = useState('chat'); // chat, summary, facts
  const chatEndRef = useRef(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [conv, msgs, feeds] = await Promise.all([
        api.telegramGetConversation(id),
        api.telegramGetMessages(id),
        api.telegramGetFeedback(id)
      ]);
      setConversation(conv);
      setMessages(msgs);
      setFeedbackList(feeds);
    } catch (err) {
      console.error('Failed to fetch conversation details', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleAnalyze = async () => {
    try {
      setAnalyzing(true);
      await api.telegramAnalyzeConversation(id);
      await fetchData(); // Refresh data
      setActiveTab('summary');
    } catch (err) {
      console.error('Analysis failed', err);
      alert('Falha ao processar inteligência. Verifique se o Ollama está rodando.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleHandoff = async () => {
    try {
      setUpdatingStatus(true);
      await api.telegramHandoff(id);
      await fetchData();
    } catch (err) {
      console.error('Handoff failed', err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleResume = async () => {
    try {
      setUpdatingStatus(true);
      await api.telegramResume(id);
      await fetchData();
    } catch (err) {
      console.error('Resume failed', err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleAddFeedback = async () => {
    if (!newFeedback.trim()) return;
    try {
      await api.telegramAddFeedback(id, { content: newFeedback });
      setNewFeedback('');
      const feeds = await api.telegramGetFeedback(id);
      setFeedbackList(feeds);
    } catch (err) {
      console.error('Failed to add feedback', err);
    }
  };

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
      <RefreshCcw className="animate-spin" size={24} style={{ marginRight: '12px' }} />
      Carregando detalhes da conversa...
    </div>
  );

  if (!conversation) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--nexus-red)' }}>
      Conversa não encontrada.
    </div>
  );

  const isHandoff = conversation.status === 'human_takeover';

  return (
    <div style={{
      display: 'flex',
      height: '100%',
      background: 'var(--bg-base)',
      overflow: 'hidden'
    }}>
      {/* Sidebar - User Info */}
      <div style={{
        width: '320px',
        borderRight: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px',
        overflowY: 'auto'
      }}>
        <button 
          onClick={() => navigate('/telegram/monitoring')}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'none', border: 'none', color: 'var(--text-muted)',
            fontSize: '13px', fontWeight: 600, cursor: 'pointer', marginBottom: '24px',
            padding: 0
          }}
        >
          <ArrowLeft size={16} />
          Voltar para lista
        </button>

        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '80px', height: '80px', borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--nexus-violet), var(--nexus-cyan))',
            margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '32px', fontWeight: 800, color: 'white',
            boxShadow: '0 8px 16px rgba(0,0,0,0.2)'
          }}>
            {conversation.display_name?.charAt(0)}
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 4px' }}>{conversation.display_name}</h2>
          <span style={{ color: 'var(--nexus-cyan)', fontSize: '12px', fontWeight: 600 }}>@{conversation.username}</span>
        </div>

        {/* Handoff Status Card */}
        <div style={{
          padding: '16px',
          borderRadius: '16px',
          background: isHandoff ? 'var(--nexus-red)15' : 'var(--nexus-violet)10',
          border: `1px solid ${isHandoff ? 'var(--nexus-red)30' : 'var(--nexus-violet)30'}`,
          marginBottom: '24px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            {isHandoff ? <User size={18} color="var(--nexus-red)" /> : <Bot size={18} color="var(--nexus-violet)" />}
            <span style={{ fontSize: '14px', fontWeight: 800, color: isHandoff ? 'var(--nexus-red)' : 'var(--nexus-violet)' }}>
              {isHandoff ? 'Intervenção Humana' : 'Automação Ativa'}
            </span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 16px', lineHeight: '1.4' }}>
            {isHandoff 
              ? 'O bot parou de responder. Você deve assumir este chat no Telegram.' 
              : 'O bot está processando mensagens e respondendo automaticamente.'}
          </p>
          <button 
            onClick={isHandoff ? handleResume : handleHandoff}
            disabled={updatingStatus}
            style={{
              width: '100%', padding: '10px', borderRadius: '10px',
              background: isHandoff ? 'var(--nexus-violet)' : 'var(--nexus-red)',
              color: 'white', border: 'none', fontSize: '12px', fontWeight: 700, cursor: 'pointer'
            }}
          >
            {updatingStatus ? 'Processando...' : (isHandoff ? 'Devolver para Bot' : 'Assumir Conversa')}
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Info do Sistema
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
            <Hash size={14} color="var(--text-muted)" />
            <span style={{ color: 'var(--text-muted)' }}>Chat ID:</span>
            <span style={{ fontWeight: 600 }}>{conversation.external_chat_id}</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
            <Clock size={14} color="var(--text-muted)" />
            <span style={{ color: 'var(--text-muted)' }}>Desde:</span>
            <span style={{ fontWeight: 600 }}>{new Date(conversation.created_at).toLocaleDateString()}</span>
          </div>

          <button 
            onClick={handleAnalyze}
            disabled={analyzing}
            style={{
              marginTop: '16px',
              padding: '12px',
              borderRadius: '12px',
              background: analyzing ? 'var(--bg-card)' : 'linear-gradient(135deg, var(--nexus-violet), var(--nexus-blue))',
              color: 'white',
              border: 'none',
              fontSize: '13px',
              fontWeight: 700,
              cursor: analyzing ? 'default' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              transition: 'transform 0.2s'
            }}
            onMouseEnter={e => !analyzing && (e.currentTarget.style.transform = 'translateY(-2px)')}
            onMouseLeave={e => !analyzing && (e.currentTarget.style.transform = 'translateY(0)')}
          >
            {analyzing ? <RefreshCcw size={16} className="animate-spin" /> : <Brain size={16} />}
            {analyzing ? 'Analisando...' : 'Gerar Insights IA'}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Tabs Header */}
        <div style={{ 
          height: '56px', borderBottom: '1px solid var(--border-subtle)', 
          background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', padding: '0 24px', gap: '24px'
        }}>
          {[
            { id: 'chat', label: 'Histórico', icon: MessageSquare },
            { id: 'summary', label: 'Resumo IA', icon: Brain },
            { id: 'facts', label: 'Memória & Feedback', icon: Lightbulb }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', height: '100%',
                background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px',
                fontWeight: activeTab === tab.id ? 700 : 500,
                color: activeTab === tab.id ? 'var(--nexus-violet)' : 'var(--text-muted)',
                borderBottom: activeTab === tab.id ? '2px solid var(--nexus-violet)' : '2px solid transparent',
                transition: 'all 0.2s'
              }}
            >
              <tab.icon size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          {activeTab === 'chat' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '800px', margin: '0 auto' }}>
              {messages.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  Nenhuma mensagem registrada nesta conversa.
                </div>
              ) : (
                messages.map((msg, idx) => (
                  <div key={idx} style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: msg.direction === 'inbound' ? 'flex-start' : 'flex-end',
                    maxWidth: '85%',
                    alignSelf: msg.direction === 'inbound' ? 'flex-start' : 'flex-end'
                  }}>
                    <div style={{ 
                      fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px',
                      display: 'flex', alignItems: 'center', gap: '4px'
                    }}>
                      {msg.direction === 'inbound' ? <User size={10} /> : <Bot size={10} color="var(--nexus-cyan)" />}
                      {msg.direction === 'inbound' ? conversation.display_name : 'Smart Moon'}
                      <span style={{ opacity: 0.5 }}>• {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                    <div style={{
                      padding: '12px 16px',
                      borderRadius: '16px',
                      fontSize: '14px',
                      lineHeight: '1.5',
                      background: msg.direction === 'inbound' ? 'var(--bg-card)' : 'linear-gradient(135deg, var(--nexus-violet), var(--nexus-blue))',
                      color: msg.direction === 'inbound' ? 'var(--text-primary)' : 'white',
                      border: msg.direction === 'inbound' ? '1px solid var(--border-subtle)' : 'none',
                      borderTopLeftRadius: msg.direction === 'inbound' ? '4px' : '16px',
                      borderTopRightRadius: msg.direction === 'inbound' ? '16px' : '4px',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                    }}>
                      {msg.content_text || msg.payload}
                    </div>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>
          )}

          {activeTab === 'summary' && (
            <div style={{ maxWidth: '700px', margin: '0 auto' }}>
              <div style={{ background: 'var(--bg-surface)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <Brain size={20} color="var(--nexus-violet)" />
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>Resumo Executivo</h3>
                </div>
                <p style={{ color: 'var(--text-primary)', lineHeight: '1.6', fontSize: '14px', whiteSpace: 'pre-wrap' }}>
                  {conversation.summary || "Nenhum resumo gerado ainda. Clique em 'Gerar Insights IA' na lateral."}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'facts' && (
            <div style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* AI Memory / Facts */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <Lightbulb size={20} color="var(--nexus-cyan)" />
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>Fatos Extraídos (Memória)</h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {(!conversation.facts || conversation.facts.length === 0) ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: '12px' }}>
                      Nenhum fato extraído.
                    </div>
                  ) : (
                    conversation.facts.map((fact, i) => (
                      <div key={i} style={{ 
                        background: 'var(--bg-card)', padding: '12px 16px', borderRadius: '12px',
                        border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '12px'
                      }}>
                        <div style={{ 
                          width: '8px', height: '8px', borderRadius: '50%', background: 'var(--nexus-cyan)'
                        }} />
                        <span style={{ fontSize: '14px', fontWeight: 600 }}>{fact}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Human Feedback / Notes */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <MessageSquare size={20} color="var(--nexus-violet)" />
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800 }}>Anotações do Operador</h3>
                </div>
                
                <div style={{ marginBottom: '20px', display: 'flex', gap: '12px' }}>
                  <input 
                    value={newFeedback}
                    onChange={e => setNewFeedback(e.target.value)}
                    placeholder="Adicionar observação sobre esta conversa..."
                    style={{
                      flex: 1, padding: '12px 16px', borderRadius: '10px', background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)', color: 'white', fontSize: '13px'
                    }}
                    onKeyDown={e => e.key === 'Enter' && handleAddFeedback()}
                  />
                  <button 
                    onClick={handleAddFeedback}
                    style={{
                      padding: '0 20px', borderRadius: '10px', background: 'var(--nexus-violet)',
                      color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer'
                    }}
                  >
                    Salvar
                  </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {feedbackList.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)', background: 'var(--bg-card)', borderRadius: '12px' }}>
                      Nenhuma anotação manual.
                    </div>
                  ) : (
                    [...feedbackList].reverse().map((fb, i) => (
                      <div key={i} style={{ 
                        background: 'var(--bg-surface)', padding: '16px', borderRadius: '12px',
                        borderLeft: '4px solid var(--nexus-violet)', position: 'relative'
                      }}>
                        <div style={{ fontSize: '13px', color: 'var(--text-primary)', marginBottom: '8px', lineHeight: '1.5' }}>
                          {fb.content}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {new Date(fb.created_at).toLocaleString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer info/controls */}
        <div style={{ 
          height: '64px', borderTop: '1px solid var(--border-subtle)', 
          background: 'var(--bg-surface)', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Mudar Status:</span>
            <select style={{
              padding: '6px 12px', borderRadius: '8px', background: 'var(--bg-base)',
              border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', fontSize: '12px'
            }}>
              <option>Open</option>
              <option>Idle</option>
              <option>Resolved</option>
              <option>Escalated</option>
            </select>
          </div>
          <div style={{ 
            fontSize: '11px', color: 'var(--text-muted)', background: 'var(--bg-card)', 
            padding: '4px 10px', borderRadius: '4px', border: '1px solid var(--border-subtle)'
          }}>
            Identificação de Tópico IA: <strong>Configuração de Voz</strong>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TelegramConversationDetail;
