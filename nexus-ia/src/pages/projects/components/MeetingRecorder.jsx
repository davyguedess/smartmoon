import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { Mic, MicOff, Square, Pin, Pause, Play, Volume2, Loader2, Check, Send, FileText, X } from 'lucide-react';
import { api } from '../../../api';

const formatTime = (seconds) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const STATES = {
  IDLE: 'idle',
  RECORDING: 'recording',
  PAUSED: 'paused',
  PROCESSING: 'processing',
  DONE: 'done',
  ERROR: 'error',
};

export default function MeetingRecorder({ projectId, projectName, onClose, onMeetingProcessed }) {
  const [state, setState] = useState(STATES.IDLE);
  const [elapsed, setElapsed] = useState(0);
  const [topics, setTopics] = useState([]);
  const [topicLabel, setTopicLabel] = useState('');
  const [meetingId, setMeetingId] = useState(null);
  const [ata, setAta] = useState(null);
  const [error, setError] = useState(null);
  const [analyzerData, setAnalyzerData] = useState(new Uint8Array(64));

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);
  const analyzerRef = useRef(null);
  const animFrameRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  // Waveform visualization
  const updateWaveform = useCallback(() => {
    if (analyzerRef.current && state === STATES.RECORDING) {
      const dataArray = new Uint8Array(analyzerRef.current.frequencyBinCount);
      analyzerRef.current.getByteTimeDomainData(dataArray);
      setAnalyzerData(new Uint8Array(dataArray));
      animFrameRef.current = requestAnimationFrame(updateWaveform);
    }
  }, [state]);

  // TTS greeting (uses browser speech synthesis as fallback)
  const speak = (text) => {
    if ('speechSynthesis' in window) {
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'pt-BR';
      utter.rate = 0.95;
      window.speechSynthesis.speak(utter);
    }
  };

  // ── Start Recording ──
  const handleStart = async () => {
    try {
      // Create meeting record in backend
      const res = await api.post(`/projects/${projectId}/meetings/start`, {
        title: `Reunião - ${new Date().toLocaleString('pt-BR')}`,
      });
      setMeetingId(res.id);

      // Request mic
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 44100 },
      });
      streamRef.current = stream;

      // Audio analyzer for waveform
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyzer = audioCtx.createAnalyser();
      analyzer.fftSize = 128;
      source.connect(analyzer);
      analyzerRef.current = analyzer;

      // MediaRecorder
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.start(1000); // 1 second chunks
      mediaRecorderRef.current = recorder;

      // Timer
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(p => p + 1), 1000);

      setState(STATES.RECORDING);

      // AI greeting
      setTimeout(() => {
        speak('Estou ativo. Módulo de reunião pronto. Por favor, se apresentem com nome e sobre o que vocês são responsáveis.');
      }, 500);
    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('Não foi possível acessar o microfone. Verifique as permissões.');
      setState(STATES.ERROR);
    }
  };

  // ── Pause/Resume ──
  const handlePause = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause();
      clearInterval(timerRef.current);
      setState(STATES.PAUSED);
      speak('Gravação pausada.');
    }
  };

  const handleResume = () => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume();
      timerRef.current = setInterval(() => setElapsed(p => p + 1), 1000);
      setState(STATES.RECORDING);
      speak('Gravação retomada.');
    }
  };

  // ── Mark Topic ──
  const handleMarkTopic = () => {
    const label = topicLabel.trim() || `Tópico ${topics.length + 1}`;
    setTopics(prev => [...prev, { timestamp: formatTime(elapsed), label }]);
    setTopicLabel('');
  };

  // ── Stop & Process ──
  const handleStop = async () => {
    speak('Reunião encerrada. Obrigado a todos. Estou processando a ata, em instantes enviarei o resumo.');

    clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

    // Stop recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }

    // Stop mic
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }

    setState(STATES.PROCESSING);

    try {
      // Upload audio
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      const formData = new FormData();
      formData.append('file', audioBlob, 'reuniao.webm');

      const apiUrl = import.meta.env.VITE_API_URL || '';
      const uploadRes = await fetch(`${apiUrl}/projects/${projectId}/meetings/${meetingId}/upload`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      
      if (!uploadRes.ok) {
        throw new Error('Falha no upload do áudio');
      }

      // Update topic markers
      if (topics.length > 0) {
        // Topics are saved with the meeting; we'll enhance this later with a PATCH
      }

      // Trigger processing
      await api.post(`/projects/${projectId}/meetings/${meetingId}/process`);

      // Poll for result
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes max
      const poll = setInterval(async () => {
        attempts++;
        try {
          const status = await api.get(`/projects/${projectId}/meetings/${meetingId}/status`);
          if (status.status === 'processed') {
            clearInterval(poll);
            setAta(status.ata_json);
            setState(STATES.DONE);
            if (onMeetingProcessed) onMeetingProcessed(status);
          } else if (status.status === 'error') {
            clearInterval(poll);
            setError(status.error_message || 'Erro no processamento');
            setState(STATES.ERROR);
          } else if (attempts >= maxAttempts) {
            clearInterval(poll);
            setError('Timeout no processamento. Verifique em /executions.');
            setState(STATES.ERROR);
          }
        } catch {
          // ignore polling errors
        }
      }, 5000);
    } catch (err) {
      setError('Falha ao enviar áudio: ' + err.message);
      setState(STATES.ERROR);
    }
  };

  // Waveform animation effect
  useEffect(() => {
    if (state === STATES.RECORDING) {
      updateWaveform();
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [state, updateWaveform]);

  // ── RENDER ──
  return ReactDOM.createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'linear-gradient(145deg, #1a1a2e, #16213e)',
        borderRadius: 20, padding: 32, width: '90%', maxWidth: 600,
        border: '1px solid rgba(139,92,246,0.3)',
        boxShadow: '0 25px 60px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h2 style={{ color: '#fff', margin: 0, fontSize: 20 }}>
              🎙️ {state === STATES.IDLE ? 'Iniciar Reunião' : state === STATES.DONE ? 'ATA Gerada' : 'Reunião em Andamento'}
            </h2>
            <p style={{ color: '#94a3b8', margin: '4px 0 0', fontSize: 13 }}>{projectName}</p>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 8,
            padding: 8, cursor: 'pointer', color: '#94a3b8',
          }}>
            <X size={18} />
          </button>
        </div>

        {/* ── IDLE STATE ── */}
        {state === STATES.IDLE && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{
              width: 100, height: 100, borderRadius: '50%', margin: '0 auto 24px',
              background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 40px rgba(139,92,246,0.4)',
              cursor: 'pointer', transition: 'transform 0.2s',
            }}
              onClick={handleStart}
              onMouseOver={e => e.currentTarget.style.transform = 'scale(1.1)'}
              onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
            >
              <Mic size={40} color="#fff" />
            </div>
            <p style={{ color: '#e2e8f0', fontSize: 16, margin: 0 }}>Clique para iniciar a gravação</p>
            <p style={{ color: '#64748b', fontSize: 12, marginTop: 8 }}>
              A IA irá cumprimentar a equipe e iniciar a gravação automaticamente
            </p>
          </div>
        )}

        {/* ── RECORDING STATE ── */}
        {(state === STATES.RECORDING || state === STATES.PAUSED) && (
          <div>
            {/* Timer */}
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <span style={{
                fontFamily: 'monospace', fontSize: 42, color: '#fff', fontWeight: 700,
              }}>
                {formatTime(elapsed)}
              </span>
              {state === STATES.RECORDING && (
                <span style={{
                  display: 'inline-block', marginLeft: 12,
                  width: 12, height: 12, borderRadius: '50%',
                  background: '#ef4444', animation: 'pulse 1s infinite',
                }}>
                </span>
              )}
            </div>

            {/* Waveform */}
            <div style={{
              height: 60, background: 'rgba(0,0,0,0.3)', borderRadius: 12,
              marginBottom: 16, display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 1, padding: '0 8px', overflow: 'hidden',
            }}>
              {Array.from(analyzerData).slice(0, 48).map((val, i) => (
                <div key={i} style={{
                  width: 3, borderRadius: 2,
                  height: Math.max(4, ((val - 128) * 2) + 20),
                  background: state === STATES.PAUSED
                    ? '#64748b'
                    : `hsl(${260 + (i * 2)}, 80%, ${50 + (val - 128) / 5}%)`,
                  transition: 'height 0.1s',
                }} />
              ))}
            </div>

            {/* Topic marker */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                type="text"
                placeholder="Nome do tópico (opcional)"
                value={topicLabel}
                onChange={e => setTopicLabel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleMarkTopic()}
                style={{
                  flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 8, padding: '8px 12px', color: '#fff', fontSize: 13,
                }}
              />
              <button onClick={handleMarkTopic} style={{
                background: 'rgba(139,92,246,0.3)', border: '1px solid rgba(139,92,246,0.5)',
                borderRadius: 8, padding: '8px 14px', color: '#c4b5fd', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6, fontSize: 13,
              }}>
                <Pin size={14} /> Marcar
              </button>
            </div>

            {/* Topics list */}
            {topics.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ color: '#94a3b8', fontSize: 12, margin: '0 0 6px' }}>Tópicos marcados:</p>
                {topics.map((t, i) => (
                  <div key={i} style={{
                    color: '#cbd5e1', fontSize: 12, padding: '3px 0',
                    display: 'flex', gap: 8,
                  }}>
                    <span style={{ color: '#8b5cf6', fontFamily: 'monospace' }}>{t.timestamp}</span>
                    <span>— {t.label}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Controls */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 20 }}>
              {state === STATES.RECORDING ? (
                <button onClick={handlePause} style={{
                  background: 'rgba(251,191,36,0.2)', border: '1px solid rgba(251,191,36,0.4)',
                  borderRadius: 12, padding: '12px 24px', color: '#fbbf24', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8, fontSize: 14,
                }}>
                  <Pause size={18} /> Pausar
                </button>
              ) : (
                <button onClick={handleResume} style={{
                  background: 'rgba(34,197,94,0.2)', border: '1px solid rgba(34,197,94,0.4)',
                  borderRadius: 12, padding: '12px 24px', color: '#22c55e', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8, fontSize: 14,
                }}>
                  <Play size={18} /> Retomar
                </button>
              )}
              <button onClick={handleStop} style={{
                background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)',
                borderRadius: 12, padding: '12px 24px', color: '#ef4444', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 8, fontSize: 14,
              }}>
                <Square size={18} /> Encerrar
              </button>
            </div>
          </div>
        )}

        {/* ── PROCESSING STATE ── */}
        {state === STATES.PROCESSING && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Loader2 size={48} color="#8b5cf6" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 20px', display: 'block' }} />
            <p style={{ color: '#e2e8f0', fontSize: 16, margin: '0 0 24px' }}>Processando reunião...</p>
            <div style={{ textAlign: 'left', maxWidth: 300, margin: '0 auto' }}>
              {['Áudio capturado', 'Upload concluído', 'Identificando participantes...', 'Extraindo tópicos...', 'Gerando plano de ação...'].map((step, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '6px 0', color: i < 2 ? '#22c55e' : '#94a3b8', fontSize: 13,
                }}>
                  {i < 2 ? <Check size={14} /> : <Loader2 size={14} style={{ animation: 'spin 2s linear infinite' }} />}
                  {step}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── DONE STATE ── */}
        {state === STATES.DONE && ata && (
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            <div style={{ background: 'rgba(34,197,94,0.1)', borderRadius: 12, padding: 16, marginBottom: 16, border: '1px solid rgba(34,197,94,0.2)' }}>
              <h3 style={{ color: '#22c55e', margin: '0 0 8px', fontSize: 15 }}>📝 ATA Gerada com Sucesso</h3>
              <p style={{ color: '#e2e8f0', fontSize: 13, margin: 0 }}>{ata.executive_summary}</p>
            </div>

            {ata.participants?.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <p style={{ color: '#94a3b8', fontSize: 12, margin: '0 0 4px' }}>Participantes detectados:</p>
                <p style={{ color: '#e2e8f0', fontSize: 13, margin: 0 }}>{ata.participants.join(', ')}</p>
              </div>
            )}

            {ata.decisions?.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <p style={{ color: '#94a3b8', fontSize: 12, margin: '0 0 4px' }}>Decisões:</p>
                {ata.decisions.map((d, i) => (
                  <div key={i} style={{ color: '#e2e8f0', fontSize: 13, padding: '2px 0' }}>
                    ✅ {d.description} {d.decided_by && <span style={{ color: '#8b5cf6' }}>— {d.decided_by}</span>}
                  </div>
                ))}
              </div>
            )}

            {ata.action_items?.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <p style={{ color: '#94a3b8', fontSize: 12, margin: '0 0 4px' }}>Tarefas criadas automaticamente:</p>
                {ata.action_items.map((t, i) => (
                  <div key={i} style={{ color: '#e2e8f0', fontSize: 13, padding: '2px 0' }}>
                    📌 {t.title} → <span style={{ color: '#fbbf24' }}>@{t.responsible || '?'}</span>
                    {t.due_date && <span style={{ color: '#94a3b8' }}> até {t.due_date}</span>}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button style={{
                flex: 1, background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.4)',
                borderRadius: 10, padding: '10px', color: '#c4b5fd', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13,
              }}>
                <Send size={14} /> Enviar no Grupo
              </button>
              <button style={{
                flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 10, padding: '10px', color: '#94a3b8', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 13,
              }}>
                <FileText size={14} /> Exportar PDF
              </button>
            </div>
          </div>
        )}

        {/* ── ERROR STATE ── */}
        {state === STATES.ERROR && (
          <div style={{ textAlign: 'center', padding: '30px 0' }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', margin: '0 auto 16px',
              background: 'rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <MicOff size={28} color="#ef4444" />
            </div>
            <p style={{ color: '#ef4444', fontSize: 14 }}>{error}</p>
            <button onClick={() => { setState(STATES.IDLE); setError(null); }} style={{
              marginTop: 16, background: 'rgba(139,92,246,0.2)', border: '1px solid rgba(139,92,246,0.4)',
              borderRadius: 10, padding: '10px 24px', color: '#c4b5fd', cursor: 'pointer', fontSize: 13,
            }}>
              Tentar novamente
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>,
    document.body
  );
}
