/**
 * TokenStorePage — Loja de Tokens IA para o cliente
 * Grid de packs · Checkout PIX · Polling de status · Confirmação visual
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Zap, Gift, Rocket, Crown, Star, Sparkles, Server, Activity,
  QrCode, Copy, CheckCircle2, Clock, RefreshCw, X, AlertCircle,
  ArrowLeft, Coins, Lock, ExternalLink,
} from 'lucide-react';
import { api } from '../../api';

// ── Helpers ────────────────────────────────────────────────────────────────────
const ICON_MAP = {
  zap: Zap, gift: Gift, rocket: Rocket, crown: Crown,
  star: Star, sparkles: Sparkles, server: Server, activity: Activity,
};
function fmtTokens(n) {
  if (!n) return '0';
  if (n >= 1_000_000_000) return `${(n / 1e9).toFixed(1)}B`;
  if (n >= 1_000_000)     return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1_000)         return `${(n / 1e3).toFixed(0)}K`;
  return String(n);
}
function fmtBRL(v) {
  if (!v || v === 0) return 'GRÁTIS';
  return `R$ ${Number(v).toFixed(2).replace('.', ',')}`;
}

// ── Countdown ─────────────────────────────────────────────────────────────────
function Countdown({ expiresAt }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!expiresAt) return;
    const update = () => {
      const diff = Math.max(0, Math.floor((new Date(expiresAt) - Date.now()) / 1000));
      setSecs(diff);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  const m = Math.floor(secs / 60), s = secs % 60;
  const urgent = secs < 120;
  return (
    <span style={{ color: urgent ? '#ef4444' : '#f59e0b', fontWeight: 700, fontSize: 13 }}>
      <Clock size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
      {m}:{String(s).padStart(2, '0')}
    </span>
  );
}

// ── Modal de Checkout PIX ─────────────────────────────────────────────────────
function CheckoutModal({ charge, onClose, onPaid }) {
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState('pending');
  const pollRef = useRef(null);

  const copyCode = () => {
    navigator.clipboard.writeText(charge.pix_copy_paste || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    if (!charge?.charge_id) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get(`/billing/token-packs/status/${charge.charge_id}`);
        if (res.status === 'paid') {
          clearInterval(pollRef.current);
          setStatus('paid');
          setTimeout(() => onPaid(res), 1500);
        }
      } catch (_) {}
    }, 5000);
    return () => clearInterval(pollRef.current);
  }, [charge?.charge_id, onPaid]);

  if (status === 'paid') {
    return (
      <div className="ia-modal-overlay" style={{ zIndex: 2000 }}>
        <div className="ia-modal" style={{ maxWidth: 380, textAlign: 'center', padding: '40px 32px' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <CheckCircle2 size={36} style={{ color: '#10b981' }} />
          </div>
          <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800 }}>Pagamento confirmado!</h2>
          <p style={{ margin: '0 0 16px', color: 'var(--text-muted)', fontSize: 14 }}>
            <strong style={{ color: '#10b981' }}>{fmtTokens(charge.tokens_included)}</strong> tokens foram creditados na sua conta.
          </p>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Redirecionando…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="ia-modal-overlay" onClick={onClose} style={{ zIndex: 2000 }}>
      <div className="ia-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480, width: '95vw' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>Checkout — {charge.pack_name}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
              Pague via PIX para receber <strong>{fmtTokens(charge.tokens_included)} tokens</strong>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 24 }}>
          {/* Valor */}
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ fontSize: 36, fontWeight: 900, color: '#10b981' }}>
              R$ {Number(charge.amount || 0).toFixed(2).replace('.', ',')}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {fmtTokens(charge.tokens_included)} tokens · Expira em: <Countdown expiresAt={charge.expires_at} />
            </div>
          </div>

          {/* QR Code */}
          {charge.pix_qr_code && (
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <img
                src={`data:image/png;base64,${charge.pix_qr_code}`}
                alt="QR Code PIX"
                style={{ width: 180, height: 180, borderRadius: 12, border: '2px solid var(--border-subtle)' }}
              />
            </div>
          )}

          {/* Copia & cola */}
          {charge.pix_copy_paste && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Código PIX Copia e Cola</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                <div style={{
                  flex: 1, padding: '10px 12px', borderRadius: 8,
                  border: '1px solid var(--border-subtle)', background: 'var(--bg-input)',
                  fontSize: 11, color: 'var(--text-muted)', wordBreak: 'break-all',
                  fontFamily: 'monospace', maxHeight: 80, overflow: 'auto',
                }}>
                  {charge.pix_copy_paste}
                </div>
                <button
                  onClick={copyCode}
                  style={{
                    padding: '10px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    background: copied ? '#10b981' : 'var(--nexus-violet)', color: 'white',
                    fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6,
                    transition: 'background 0.2s',
                  }}
                >
                  {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                  {copied ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
            </div>
          )}

          {/* Link externo */}
          {charge.payment_link && (
            <a href={charge.payment_link} target="_blank" rel="noopener noreferrer"
              style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: 12, color: 'var(--nexus-violet)', textDecoration: 'none' }}>
              <ExternalLink size={12} /> Abrir página de pagamento
            </a>
          )}

          {/* Status polling */}
          <div style={{ marginTop: 20, padding: '10px 14px', borderRadius: 8, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <RefreshCw size={12} style={{ animation: 'spin 2s linear infinite', color: '#4285F4' }} />
            <span style={{ color: 'var(--text-muted)' }}>Aguardando confirmação do pagamento…</span>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '0 24px 20px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
          <Lock size={11} /> Pagamento seguro via Mercado Pago
        </div>
      </div>
    </div>
  );
}

// ── Pack Card ─────────────────────────────────────────────────────────────────
function PackCard({ pack, onBuy, loading }) {
  const Icon = ICON_MAP[pack.icon] || Zap;
  const isFree = !pack.price_brl || pack.price_brl === 0;
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: `1.5px solid ${pack.is_highlighted ? pack.color + '60' : 'var(--border-subtle)'}`,
      borderRadius: 16, overflow: 'hidden', position: 'relative',
      transition: 'transform 0.2s, box-shadow 0.2s',
      boxShadow: pack.is_highlighted ? `0 4px 24px ${pack.color}20` : undefined,
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = `0 8px 32px ${pack.color}30`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
    >
      {pack.badge_text && (
        <div style={{ position: 'absolute', top: 12, right: 12, fontSize: 9, fontWeight: 900, padding: '3px 10px', borderRadius: 20, background: pack.color, color: 'white', letterSpacing: '0.05em' }}>
          {pack.badge_text}
        </div>
      )}

      {/* Header do card */}
      <div style={{ padding: '20px 20px 14px', background: `linear-gradient(135deg, ${pack.color}12, transparent)`, borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${pack.color}20`, border: `1.5px solid ${pack.color}40`, marginBottom: 12 }}>
          <Icon size={22} style={{ color: pack.color }} />
        </div>
        <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>{pack.name}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 }}>{pack.description}</div>
      </div>

      {/* Corpo */}
      <div style={{ padding: '16px 20px 20px' }}>
        {/* Tokens */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 14 }}>
          <span style={{ fontSize: 32, fontWeight: 900, color: pack.color }}>{fmtTokens(pack.tokens_included)}</span>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>tokens</span>
        </div>

        {/* Preço */}
        <div style={{ marginBottom: 16 }}>
          {isFree ? (
            <div style={{ fontSize: 20, fontWeight: 900, color: '#10b981' }}>GRÁTIS</div>
          ) : (
            <div style={{ fontSize: 22, fontWeight: 900 }}>
              R$ {Number(pack.price_brl).toFixed(2).replace('.', ',')}
            </div>
          )}
          {pack.renews_monthly && (
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>recorrente mensal</div>
          )}
        </div>

        {/* CTA */}
        <button
          onClick={() => onBuy(pack)}
          disabled={loading}
          style={{
            width: '100%', padding: '11px', borderRadius: 10, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
            background: isFree ? 'rgba(16,185,129,0.1)' : `linear-gradient(135deg, ${pack.color}, ${pack.color}cc)`,
            color: isFree ? '#10b981' : 'white',
            fontWeight: 700, fontSize: 14,
            border: isFree ? '1.5px solid rgba(16,185,129,0.4)' : 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'opacity 0.2s',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : (isFree ? <Gift size={14} /> : <Zap size={14} />)}
          {isFree ? 'Resgatar grátis' : 'Comprar agora'}
        </button>
      </div>
    </div>
  );
}

// ── Página Principal ───────────────────────────────────────────────────────────
export default function TokenStorePage() {
  const [packs, setPacks]       = useState([]);
  const [balance, setBalance]   = useState({ total: 0, balances: [] });
  const [loading, setLoading]   = useState(true);
  const [buying, setBuying]     = useState(null); // pack_id
  const [checkout, setCheckout] = useState(null); // dados do checkout
  const [toast, setToast]       = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [packsRes, balRes] = await Promise.all([
        api.get('/billing/token-packs'),
        api.get('/billing/token-packs/my-balance').catch(() => ({ total: 0, balances: [] })),
      ]);
      setPacks(packsRes.packs || []);
      setBalance(balRes);
    } catch (e) {
      showToast('Erro ao carregar packs', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleBuy = async (pack) => {
    setBuying(pack.id);
    try {
      const res = await api.post(`/billing/token-packs/${pack.id}/purchase`);
      if (res.free) {
        showToast(`✅ ${fmtTokens(res.tokens_credited)} tokens creditados!`);
        loadData();
      } else {
        setCheckout({ ...res, pack_name: pack.name, tokens_included: pack.tokens_included });
      }
    } catch (e) {
      const msg = e?.response?.data?.detail || 'Erro ao iniciar compra';
      showToast(msg, 'error');
    } finally {
      setBuying(null);
    }
  };

  const handlePaid = () => {
    setTimeout(() => {
      setCheckout(null);
      loadData();
    }, 2000);
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px' }}>
      {/* Toast */}
      {toast && (
        <div className={`admin-toast ${toast.type}`} style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999 }}>
          {toast.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: 'linear-gradient(135deg, #a78bfa, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={22} style={{ color: 'white' }} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>Tokens de IA</h1>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>Adquira tokens para usar os modelos de IA da plataforma</p>
          </div>
        </div>

        {/* Saldo atual */}
        {balance.total > 0 && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderRadius: 10, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
            <Coins size={14} style={{ color: '#10b981' }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#10b981' }}>
              Seu saldo: <strong>{fmtTokens(balance.total)} tokens</strong>
            </span>
          </div>
        )}
      </div>

      {/* Grid de packs */}
      {loading ? (
        <div className="admin-loading"><RefreshCw size={20} className="spinning" /> Carregando packs…</div>
      ) : packs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 64, color: 'var(--text-muted)' }}>
          <Zap size={40} style={{ opacity: 0.2, marginBottom: 12 }} />
          <div style={{ fontSize: 14 }}>Nenhum pack disponível no momento.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 20 }}>
          {packs.map(pack => (
            <PackCard
              key={pack.id}
              pack={pack}
              onBuy={handleBuy}
              loading={buying === pack.id}
            />
          ))}
        </div>
      )}

      {/* Modal de checkout */}
      {checkout && (
        <CheckoutModal
          charge={checkout}
          onClose={() => setCheckout(null)}
          onPaid={handlePaid}
        />
      )}
    </div>
  );
}
