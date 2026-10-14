/**
 * BuyCreditsModal — Modal de compra de Créditos SM
 * Exibe packs disponíveis, permite pagamento via PIX ou Wallet, polling de status.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Coins, Zap, Star, Rocket, Crown, Gift, Sparkles, X,
  Wallet, QrCode, Copy, CheckCircle2, Clock, RefreshCw,
  Lock, ExternalLink, ArrowLeft, ShoppingCart, AlertCircle,
} from 'lucide-react';
import { api } from '../../api';

// ── Helpers ────────────────────────────────────────────────────────────────────
const ICON_MAP = { coins: Coins, zap: Zap, star: Star, rocket: Rocket, crown: Crown, gift: Gift, sparkles: Sparkles };

function fmtBRL(v) {
  if (!v || v === 0) return 'GRÁTIS';
  return `R$ ${Number(v).toFixed(2).replace('.', ',')}`;
}

function Countdown({ expiresAt }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!expiresAt) return;
    const update = () => { setSecs(Math.max(0, Math.floor((new Date(expiresAt) - Date.now()) / 1000))); };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  const m = Math.floor(secs / 60), s = secs % 60;
  return (
    <span style={{ color: secs < 120 ? '#ef4444' : '#f59e0b', fontWeight: 700, fontSize: 12 }}>
      <Clock size={11} style={{ marginRight: 3, verticalAlign: 'middle' }} />
      {m}:{String(s).padStart(2, '0')}
    </span>
  );
}

// ── PIX Checkout Subview ──────────────────────────────────────────────────────
function PixCheckout({ charge, onBack, onPaid }) {
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
        const res = await api.get(`/billing/credit-packs/status/${charge.charge_id}`);
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
      <div style={{ textAlign: 'center', padding: '48px 24px' }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
          <CheckCircle2 size={36} style={{ color: '#10b981' }} />
        </div>
        <h3 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 800, color: '#fff' }}>Pagamento confirmado!</h3>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 14 }}>
          <strong style={{ color: '#10b981' }}>{charge.credits_amount}</strong> créditos SM foram adicionados.
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 24px' }}>
      <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, marginBottom: 16, padding: 0 }}>
        <ArrowLeft size={14} /> Voltar aos pacotes
      </button>

      <div style={{ textAlign: 'center', marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{charge.pack_name}</div>
        <div style={{ fontSize: 32, fontWeight: 900, color: '#10b981' }}>
          R$ {Number(charge.amount || 0).toFixed(2).replace('.', ',')}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
          {charge.credits_amount} créditos SM · Expira em: <Countdown expiresAt={charge.expires_at} />
        </div>
      </div>

      {charge.pix_qr_code && (
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <img
            src={`data:image/png;base64,${charge.pix_qr_code}`}
            alt="QR Code PIX"
            style={{ width: 170, height: 170, borderRadius: 12, border: '2px solid rgba(255,255,255,0.1)' }}
          />
        </div>
      )}

      {charge.pix_copy_paste && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700 }}>Código PIX Copia e Cola</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{
              flex: 1, padding: '9px 11px', borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)',
              fontSize: 10, color: 'var(--text-muted)', wordBreak: 'break-all', fontFamily: 'monospace', maxHeight: 70, overflow: 'auto',
            }}>
              {charge.pix_copy_paste}
            </div>
            <button onClick={copyCode} style={{
              padding: '9px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: copied ? '#10b981' : 'var(--nexus-violet)', color: 'white',
              fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, transition: 'background 0.2s',
            }}>
              {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
          </div>
        </div>
      )}

      {charge.payment_link && (
        <a href={charge.payment_link} target="_blank" rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--nexus-violet)', textDecoration: 'none', marginBottom: 16 }}>
          <ExternalLink size={12} /> Abrir página de pagamento
        </a>
      )}

      <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
        <RefreshCw size={12} style={{ animation: 'spin 2s linear infinite', color: '#4285F4' }} />
        <span style={{ color: 'var(--text-muted)' }}>Aguardando confirmação do pagamento…</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--text-muted)', marginTop: 14 }}>
        <Lock size={10} /> Pagamento seguro via Mercado Pago
      </div>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────
export default function BuyCreditsModal({ onClose, onCredited }) {
  const [packs, setPacks] = useState([]);
  const [smBalance, setSmBalance] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(null);
  const [checkout, setCheckout] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [packsRes, balRes, walRes] = await Promise.all([
        api.get('/billing/credit-packs'),
        api.get('/billing/credit-packs/my-balance').catch(() => ({ balance: 0 })),
        api.get('/billing/credit-packs/wallet-balance').catch(() => ({ balance: 0 })),
      ]);
      setPacks(packsRes.packs || []);
      setSmBalance(balRes.balance || 0);
      setWalletBalance(walRes.balance || 0);
    } catch { }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleBuy = async (pack, method = 'pix') => {
    setBuying(`${pack.id}-${method}`);
    try {
      const res = await api.post(`/billing/credit-packs/${pack.id}/purchase`, { payment_method: method });
      if (res.free || res.payment_method === 'wallet') {
        showToast(`✅ ${res.credits_added} créditos SM adicionados!`);
        loadData();
        if (onCredited) onCredited(res);
      } else {
        setCheckout({ ...res, pack_name: pack.name, credits_amount: pack.credits_amount });
      }
    } catch (e) {
      const msg = e?.response?.data?.detail || e?.message || 'Erro ao processar compra';
      showToast(msg, 'error');
    } finally {
      setBuying(null);
    }
  };

  const handlePaid = (res) => {
    setTimeout(() => {
      setCheckout(null);
      loadData();
      if (onCredited) onCredited(res);
    }, 2000);
  };

  return (
    <div
      onClick={e => e.target === e.currentTarget && !checkout && onClose()}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#0f0f1a', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 20,
          width: '100%', maxWidth: 640, maxHeight: '90vh', overflow: 'auto',
          boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
        }}
      >
        {/* Toast */}
        {toast && (
          <div style={{
            position: 'absolute', top: 12, right: 12, zIndex: 10,
            padding: '10px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 8,
            background: toast.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
            border: `1px solid ${toast.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
            color: toast.type === 'success' ? '#10b981' : '#ef4444',
          }}>
            {toast.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            {toast.msg}
          </div>
        )}

        {/* Header */}
        <div style={{ padding: '20px 24px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #f59e0b, #fbbf24)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Coins size={20} style={{ color: '#000' }} />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 17, color: '#fff' }}>Créditos SM</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Saldo atual: <strong style={{ color: '#f59e0b' }}>{smBalance.toLocaleString('pt-BR')} SM</strong>
                {walletBalance > 0 && (
                  <span style={{ marginLeft: 12 }}>
                    Wallet: <strong style={{ color: '#10b981' }}>R$ {walletBalance.toFixed(2).replace('.', ',')}</strong>
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        {checkout ? (
          <PixCheckout charge={checkout} onBack={() => setCheckout(null)} onPaid={handlePaid} />
        ) : loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 60, color: 'var(--text-muted)', fontSize: 14 }}>
            <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Carregando pacotes…
          </div>
        ) : packs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
            <Coins size={36} style={{ opacity: 0.2, marginBottom: 12 }} />
            <div style={{ fontSize: 14 }}>Nenhum pacote disponível no momento.</div>
          </div>
        ) : (
          <div style={{ padding: '20px 24px', display: 'grid', gap: 14 }}>
            {packs.map(pack => {
              const Icon = ICON_MAP[pack.icon] || Coins;
              const isFree = !pack.price_brl || pack.price_brl === 0;
              const canWallet = walletBalance >= pack.price_brl && !isFree;
              const buyingPack = buying?.startsWith(`${pack.id}-`);

              return (
                <div
                  key={pack.id}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: `1.5px solid ${pack.is_highlighted ? pack.color + '50' : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: 14, padding: '16px 20px',
                    display: 'flex', alignItems: 'center', gap: 16,
                    transition: 'border-color 0.2s, background 0.2s',
                    position: 'relative',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = pack.color + '60'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = pack.is_highlighted ? pack.color + '50' : 'rgba(255,255,255,0.06)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
                >
                  {/* Badge */}
                  {pack.badge_text && (
                    <div style={{ position: 'absolute', top: -1, right: 16, fontSize: 8, fontWeight: 900, padding: '2px 10px', borderRadius: '0 0 8px 8px', background: pack.color, color: '#fff', letterSpacing: '0.08em' }}>
                      {pack.badge_text}
                    </div>
                  )}

                  {/* Icon */}
                  <div style={{ width: 46, height: 46, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${pack.color}18`, border: `1px solid ${pack.color}30`, flexShrink: 0 }}>
                    <Icon size={22} style={{ color: pack.color }} />
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 15, color: '#e5e7eb', marginBottom: 2 }}>{pack.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{pack.description}</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
                      <span style={{ fontSize: 22, fontWeight: 900, color: pack.color }}>{pack.credits_amount.toLocaleString('pt-BR')}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>créditos SM</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>·</span>
                      <span style={{ fontSize: 14, fontWeight: 800, color: isFree ? '#10b981' : '#e5e7eb', marginLeft: 4 }}>
                        {fmtBRL(pack.price_brl)}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                    {isFree ? (
                      <button
                        onClick={() => handleBuy(pack, 'pix')}
                        disabled={buyingPack}
                        style={{
                          padding: '8px 18px', borderRadius: 9, border: '1px solid rgba(16,185,129,0.4)',
                          background: 'rgba(16,185,129,0.1)', color: '#10b981',
                          fontWeight: 700, fontSize: 12, cursor: buyingPack ? 'not-allowed' : 'pointer',
                          display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.2s',
                          opacity: buyingPack ? 0.6 : 1,
                        }}
                      >
                        {buyingPack ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Gift size={12} />}
                        Resgatar
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleBuy(pack, 'pix')}
                          disabled={buyingPack}
                          style={{
                            padding: '8px 16px', borderRadius: 9, border: 'none',
                            background: `linear-gradient(135deg, ${pack.color}, ${pack.color}cc)`, color: '#fff',
                            fontWeight: 700, fontSize: 11, cursor: buyingPack ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.2s',
                            opacity: buyingPack ? 0.6 : 1,
                          }}
                        >
                          {buying === `${pack.id}-pix` ? <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <QrCode size={11} />}
                          Pagar PIX
                        </button>
                        {canWallet && (
                          <button
                            onClick={() => handleBuy(pack, 'wallet')}
                            disabled={buyingPack}
                            style={{
                              padding: '7px 14px', borderRadius: 9,
                              border: '1px solid rgba(16,185,129,0.3)', background: 'rgba(16,185,129,0.08)',
                              color: '#10b981', fontWeight: 700, fontSize: 10, cursor: buyingPack ? 'not-allowed' : 'pointer',
                              display: 'flex', alignItems: 'center', gap: 5, transition: 'all 0.2s',
                              opacity: buyingPack ? 0.6 : 1,
                            }}
                          >
                            {buying === `${pack.id}-wallet` ? <RefreshCw size={10} style={{ animation: 'spin 1s linear infinite' }} /> : <Wallet size={10} />}
                            Usar Wallet
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
