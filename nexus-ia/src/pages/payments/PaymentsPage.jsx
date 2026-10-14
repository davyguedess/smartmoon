import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  DollarSign, TrendingUp, TrendingDown, Clock, Plus, ArrowUpRight, 
  ArrowDownLeft, CreditCard, Zap, Filter, Search, Copy, Check,
  QrCode, Send, X, ChevronRight, AlertCircle, RefreshCw, Wallet,
  ArrowDown, ArrowUp, Eye, EyeOff, Shield, Activity, BarChart3,
  Download, ChevronDown, ExternalLink, Smartphone, Building2
} from 'lucide-react';
import { api } from '../../api';
import './PaymentsPage.css';

// Helper para montar query string
const qs = (params) => {
  const p = Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== '');
  return p.length ? '?' + p.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&') : '';
};

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const fmtDateShort = (d) => d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '—';

const STATUS_MAP = {
  draft:           { label: 'Rascunho',   color: '#6b7280', icon: '📝' },
  pending:         { label: 'Pendente',   color: '#f59e0b', icon: '⏳' },
  sent:            { label: 'Enviada',    color: '#3b82f6', icon: '📤' },
  waiting_payment: { label: 'Aguardando', color: '#8b5cf6', icon: '⏱️' },
  paid:            { label: 'Paga',       color: '#10b981', icon: '✅' },
  expired:         { label: 'Expirada',   color: '#6b7280', icon: '⌛' },
  cancelled:       { label: 'Cancelada',  color: '#ef4444', icon: '❌' },
  failed:          { label: 'Falha',      color: '#ef4444', icon: '⚠️' },
};

// ── Mini Activity Chart ────────────────────────────────────────────────────────
function MiniChart({ data = [], color = '#10b981', height = 48 }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const w = 100;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = height - (v / max) * (height - 4);
    return `${x},${y}`;
  }).join(' ');
  const areaPoints = `0,${height} ${points} ${w},${height}`;
  
  return (
    <svg viewBox={`0 0 ${w} ${height}`} style={{ width: '100%', height, overflow: 'visible' }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#grad-${color.replace('#','')})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// ── Status Badge ───────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const s = STATUS_MAP[status] || { label: status, color: '#6b7280', icon: '○' };
  return (
    <span className="pm-status-badge" style={{ '--badge-color': s.color }}>
      <span className="pm-status-dot" />
      {s.label}
    </span>
  );
}

// ── Quick Action Button ────────────────────────────────────────────────────────
function QuickAction({ icon: Icon, label, color, gradient, onClick, variant = 'default' }) {
  return (
    <button className={`pm-quick-action ${variant}`} style={{ '--action-color': color, '--action-gradient': gradient }} onClick={onClick}>
      <div className="pm-qa-icon">
        <Icon size={20} />
      </div>
      <span className="pm-qa-label">{label}</span>
    </button>
  );
}

// ── Modal: Nova Cobrança ───────────────────────────────────────────────────────
function NewChargeModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    amount: '', description: '', client_name: '', client_phone: '',
    client_email: '', client_id: null,
  });
  const [loading, setLoading] = useState(false);
  const [charge, setCharge] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/payments/charges', {
        ...form,
        amount: parseFloat(form.amount),
      });
      setCharge(res);
      onCreated?.();
    } catch (err) {
      setError(err.message || 'Erro ao criar cobrança');
    } finally {
      setLoading(false);
    }
  };

  const copyPix = () => {
    navigator.clipboard.writeText(charge.pix_copy_paste_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="pm-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pm-modal-box">
        <div className="pm-modal-header">
          <div className="pm-modal-title-row">
            <div className="pm-modal-icon-wrap" style={{ background: 'linear-gradient(135deg, #7c3aed, #38bdf8)' }}>
              {charge ? <Check size={20} /> : <QrCode size={20} />}
            </div>
            <div>
              <h2>{charge ? 'Cobrança Gerada!' : 'Nova Cobrança PIX'}</h2>
              <p>{charge ? 'QR Code pronto para pagamento' : 'Crie uma cobrança instantânea via PIX'}</p>
            </div>
          </div>
          <button className="pm-modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        {!charge ? (
          <form onSubmit={handleCreate} className="pm-form">
            <div className="pm-form-amount-input">
              <span className="pm-form-currency">R$</span>
              <input
                type="number" step="0.01" min="1" required
                placeholder="0,00"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="pm-form-big-input"
              />
            </div>

            <div className="pm-form-group">
              <label>Descrição *</label>
              <input
                type="text" required placeholder="Ex: Mensalidade Plano Pro"
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>

            <div className="pm-form-divider">
              <span>Dados do Pagador</span>
            </div>

            <div className="pm-form-row">
              <div className="pm-form-group">
                <label>Nome *</label>
                <input
                  type="text" required placeholder="Nome completo"
                  value={form.client_name}
                  onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))}
                />
              </div>
              <div className="pm-form-group">
                <label>WhatsApp</label>
                <input
                  type="text" placeholder="5511999999999"
                  value={form.client_phone}
                  onChange={e => setForm(f => ({ ...f, client_phone: e.target.value }))}
                />
              </div>
            </div>

            <div className="pm-form-group">
              <label>E-mail</label>
              <input
                type="email" placeholder="cliente@email.com"
                value={form.client_email}
                onChange={e => setForm(f => ({ ...f, client_email: e.target.value }))}
              />
            </div>

            {error && <div className="pm-form-error"><AlertCircle size={14} /> {error}</div>}

            <div className="pm-form-actions">
              <button type="button" className="pm-btn-ghost" onClick={onClose}>Cancelar</button>
              <button type="submit" className="pm-btn-gradient" disabled={loading}>
                {loading ? <><RefreshCw size={14} className="spin" /> Gerando...</> : <><QrCode size={14} /> Gerar Cobrança PIX</>}
              </button>
            </div>
          </form>
        ) : (
          <div className="pm-charge-result">
            <div className="pm-charge-amount-hero">
              <span className="pm-charge-amount-value">{fmt(charge.amount)}</span>
            </div>

            {charge.pix_qr_code && (
              <div className="pm-qr-container">
                <div className="pm-qr-frame">
                  <img src={`data:image/png;base64,${charge.pix_qr_code}`} alt="QR Code PIX" />
                </div>
                <span className="pm-qr-caption">📱 Escaneie com o app do banco</span>
              </div>
            )}

            {charge.pix_copy_paste_code && (
              <div className="pm-pix-code-block">
                <span className="pm-pix-label">PIX Copia e Cola</span>
                <div className="pm-pix-row">
                  <code>{charge.pix_copy_paste_code.slice(0, 40)}...</code>
                  <button className="pm-btn-copy" onClick={copyPix}>
                    {copied ? <><Check size={14} /> Copiado!</> : <><Copy size={14} /> Copiar</>}
                  </button>
                </div>
              </div>
            )}

            <div className="pm-charge-meta">
              <span>ID: #{charge.id}</span>
              <StatusBadge status={charge.status} />
            </div>

            <div className="pm-form-actions">
              <button className="pm-btn-ghost" onClick={onClose}>Fechar</button>
              <button className="pm-btn-whatsapp">
                <Send size={14} /> Enviar via WhatsApp
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Deposit Modal ──────────────────────────────────────────────────────────────
function DepositModal({ onClose, onCreated }) {
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const quickAmounts = [50, 100, 250, 500, 1000];

  const handleDeposit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/payments/wallet/deposit', { amount: parseFloat(amount) });
      setResult(res);
      onCreated?.();
    } catch (err) {
      setError(err.message || 'Erro ao gerar depósito');
    } finally {
      setLoading(false);
    }
  };

  const copyPix = () => {
    if (result?.pix_copy_paste_code) {
      navigator.clipboard.writeText(result.pix_copy_paste_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="pm-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pm-modal-box">
        <div className="pm-modal-header">
          <div className="pm-modal-title-row">
            <div className="pm-modal-icon-wrap" style={{ background: 'linear-gradient(135deg, #10b981, #34d399)' }}>
              <ArrowDown size={20} />
            </div>
            <div>
              <h2>{result ? 'Depósito Gerado!' : 'Depositar via PIX'}</h2>
              <p>{result ? 'Pague o PIX para creditar seu saldo' : 'Adicione fundos à sua carteira'}</p>
            </div>
          </div>
          <button className="pm-modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        {!result ? (
          <form onSubmit={handleDeposit} className="pm-form">
            <div className="pm-form-amount-input deposit">
              <span className="pm-form-currency">R$</span>
              <input
                type="number" step="0.01" min="1" required
                placeholder="0,00" value={amount}
                onChange={e => setAmount(e.target.value)}
                className="pm-form-big-input"
              />
            </div>

            <div className="pm-quick-amounts">
              {quickAmounts.map(v => (
                <button key={v} type="button" className={`pm-quick-amount ${amount === String(v) ? 'active' : ''}`} onClick={() => setAmount(String(v))}>
                  R$ {v}
                </button>
              ))}
            </div>

            {error && <div className="pm-form-error"><AlertCircle size={14} /> {error}</div>}

            <div className="pm-form-actions">
              <button type="button" className="pm-btn-ghost" onClick={onClose}>Cancelar</button>
              <button type="submit" className="pm-btn-deposit" disabled={loading || !amount}>
                {loading ? <><RefreshCw size={14} className="spin" /> Gerando...</> : <><QrCode size={14} /> Gerar PIX de Depósito</>}
              </button>
            </div>
          </form>
        ) : (
          <div className="pm-charge-result">
            <div className="pm-charge-amount-hero deposit">
              <span className="pm-charge-amount-value">{fmt(result.amount || parseFloat(amount))}</span>
            </div>

            {result.pix_qr_code && (
              <div className="pm-qr-container">
                <div className="pm-qr-frame deposit">
                  <img src={`data:image/png;base64,${result.pix_qr_code}`} alt="QR Code" />
                </div>
                <span className="pm-qr-caption">📱 Escaneie para depositar</span>
              </div>
            )}

            {result.pix_copy_paste_code && (
              <div className="pm-pix-code-block">
                <span className="pm-pix-label">PIX Copia e Cola</span>
                <div className="pm-pix-row">
                  <code>{result.pix_copy_paste_code.slice(0, 40)}...</code>
                  <button className="pm-btn-copy" onClick={copyPix}>
                    {copied ? <><Check size={14} /> Copiado!</> : <><Copy size={14} /> Copiar</>}
                  </button>
                </div>
              </div>
            )}

            <div className="pm-form-actions">
              <button className="pm-btn-ghost" onClick={onClose}>Fechar</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Withdraw Modal ─────────────────────────────────────────────────────────────
function WithdrawModal({ onClose, wallet, onCreated }) {
  const [form, setForm] = useState({ amount: '', pix_key: '', pix_key_type: 'cpf' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleRequest = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await api.post('/payments/wallet/withdrawals', { ...form, amount: parseFloat(form.amount) });
      setSuccess(true);
      onCreated?.();
    } catch (err) {
      setError(err.message || 'Erro ao solicitar saque');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pm-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pm-modal-box">
        <div className="pm-modal-header">
          <div className="pm-modal-title-row">
            <div className="pm-modal-icon-wrap" style={{ background: 'linear-gradient(135deg, #8b5cf6, #a78bfa)' }}>
              <ArrowUp size={20} />
            </div>
            <div>
              <h2>{success ? 'Saque Solicitado!' : 'Solicitar Saque'}</h2>
              <p>{success ? 'Aguarde a aprovação do saque' : `Saldo disponível: ${fmt(wallet?.balance)}`}</p>
            </div>
          </div>
          <button className="pm-modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        {!success ? (
          <form onSubmit={handleRequest} className="pm-form">
            <div className="pm-form-amount-input withdraw">
              <span className="pm-form-currency">R$</span>
              <input
                type="number" step="0.01" min="10"
                max={wallet?.balance || 0} required
                placeholder="0,00" value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="pm-form-big-input"
              />
            </div>

            <div className="pm-withdraw-balance-hint">
              <Wallet size={13} /> Saldo disponível: <strong>{fmt(wallet?.balance)}</strong>
              <button type="button" className="pm-btn-max" onClick={() => setForm(f => ({ ...f, amount: String(wallet?.balance || 0) }))}>MAX</button>
            </div>

            <div className="pm-form-row">
              <div className="pm-form-group">
                <label>Tipo de Chave PIX</label>
                <select value={form.pix_key_type} onChange={e => setForm(f => ({ ...f, pix_key_type: e.target.value }))}>
                  <option value="cpf">CPF</option>
                  <option value="cnpj">CNPJ</option>
                  <option value="email">E-mail</option>
                  <option value="phone">Telefone</option>
                  <option value="random">Aleatória</option>
                </select>
              </div>
              <div className="pm-form-group">
                <label>Chave PIX</label>
                <input type="text" required placeholder="Sua chave PIX"
                  value={form.pix_key} onChange={e => setForm(f => ({ ...f, pix_key: e.target.value }))} />
              </div>
            </div>

            {error && <div className="pm-form-error"><AlertCircle size={14} /> {error}</div>}

            <div className="pm-form-actions">
              <button type="button" className="pm-btn-ghost" onClick={onClose}>Cancelar</button>
              <button type="submit" className="pm-btn-withdraw" disabled={loading || !form.amount}>
                {loading ? <><RefreshCw size={14} className="spin" /> Processando...</> : <><ArrowUp size={14} /> Solicitar Saque</>}
              </button>
            </div>
          </form>
        ) : (
          <div className="pm-success-result">
            <div className="pm-success-icon">✅</div>
            <h3>Saque de {fmt(parseFloat(form.amount))} solicitado!</h3>
            <p>O saque será processado em até 24h úteis após aprovação.</p>
            <button className="pm-btn-gradient" onClick={onClose}>Entendido</button>
          </div>
        )}
      </div>
    </div>
  );
}


// ── Página Principal ────────────────────────────────────────────────────────────
export default function PaymentsPage() {
  const [wallet, setWallet] = useState(null);
  const [charges, setCharges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showChargeModal, setShowChargeModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [activeTab, setActiveTab] = useState('charges');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, pages: 1 });
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dashMetrics, setDashMetrics] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setRefreshing(true);
    try {
      const [dashboardRes, chargesRes] = await Promise.all([
        api.get('/payments/dashboard'),
        api.get(`/payments/charges${qs({ page, limit: 20, status: statusFilter || undefined })}`),
      ]);
      // Dashboard consolidado retorna wallet + metrics + recent_charges
      setWallet(dashboardRes.wallet);
      setDashMetrics(dashboardRes.metrics);
      setCharges(chargesRes.items || []);
      setMeta({ total: chargesRes.total, pages: chargesRes.pages });
    } catch (err) {
      console.error('Erro ao carregar pagamentos', err);
      // Fallback: try wallet separately if dashboard fails
      try {
        const walletRes = await api.get('/payments/wallet');
        setWallet(walletRes);
      } catch (_) { /* silent */ }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  // Métricas reais do banco (consolidadas) — fallback para cálculo local se offline
  const paid = dashMetrics?.total_revenue ?? charges.filter(c => c.status === 'paid').reduce((s, c) => s + Number(c.amount), 0);
  const pending = dashMetrics?.total_pending ?? charges.filter(c => ['pending', 'sent', 'waiting_payment'].includes(c.status)).reduce((s, c) => s + Number(c.amount), 0);

  // Generate mini chart data from charges
  const chartData = useMemo(() => {
    if (charges.length === 0) return [0, 0, 0, 0, 0, 0, 0];
    const last7 = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const dayStr = d.toISOString().slice(0, 10);
      return charges.filter(c => c.status === 'paid' && c.created_at?.startsWith(dayStr)).reduce((s, c) => s + Number(c.amount), 0);
    });
    return last7;
  }, [charges]);

  const paidCount = dashMetrics?.paid_charges ?? charges.filter(c => c.status === 'paid').length;
  const pendingCount = dashMetrics?.pending_charges ?? charges.filter(c => ['pending', 'sent', 'waiting_payment'].includes(c.status)).length;
  const failedCount = dashMetrics?.failed_charges ?? charges.filter(c => ['failed', 'cancelled', 'expired'].includes(c.status)).length;

  return (
    <div className="pm-page">
      {/* ── Hero Wallet Card ───────────────────────────────────────────── */}
      <div data-tour="wallet-card" className="pm-hero">
        <div className="pm-hero-bg" />
        <div className="pm-hero-content">
          <div className="pm-hero-left">
            <div className="pm-hero-top-row">
              <div>
                <div className="pm-hero-label">
                  <Wallet size={14} />
                  <span>Carteira Digital</span>
                  <span className="pm-hero-live-dot" />
                </div>
                <div className="pm-hero-balance-row">
                  <h1 className="pm-hero-balance">
                    {balanceVisible ? fmt(wallet?.balance) : 'R$ ••••••'}
                  </h1>
                  <button className="pm-eye-btn" onClick={() => setBalanceVisible(!balanceVisible)}>
                    {balanceVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p className="pm-hero-sub">
                  Total recebido: <strong>{balanceVisible ? fmt(wallet?.total_received) : '••••'}</strong>
                  {' · '}
                  Total sacado: <strong>{balanceVisible ? fmt(wallet?.total_withdrawn) : '••••'}</strong>
                </p>
              </div>
              <button className="pm-refresh-btn" onClick={loadData} disabled={refreshing}>
                <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
              </button>
            </div>

            {/* Quick Chart */}
            <div className="pm-hero-chart">
              <MiniChart data={chartData} color="#10b981" height={52} />
              <div className="pm-hero-chart-label">
                <Activity size={11} /> Últimos 7 dias
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div data-tour="payment-settings" className="pm-hero-actions">
            <QuickAction
              icon={ArrowDown} label="Depositar" variant="deposit"
              color="#10b981" gradient="linear-gradient(135deg, #10b981, #34d399)"
              onClick={() => setShowDepositModal(true)}
            />
            <QuickAction
              icon={ArrowUp} label="Sacar" variant="withdraw"
              color="#8b5cf6" gradient="linear-gradient(135deg, #8b5cf6, #a78bfa)"
              onClick={() => setShowWithdrawModal(true)}
            />
            <QuickAction
              icon={QrCode} label="Nova Cobrança" variant="charge"
              color="#3b82f6" gradient="linear-gradient(135deg, #3b82f6, #60a5fa)"
              onClick={() => setShowChargeModal(true)}
            />
          </div>
        </div>
      </div>

      {/* ── Info Cards ─────────────────────────────────────────────────── */}
      <div data-tour="finance-stats" className="pm-info-cards">
        <div className="pm-info-card">
          <div className="pm-info-icon" style={{ '--ic': '#10b981' }}>
            <TrendingUp size={18} />
          </div>
          <div className="pm-info-body">
            <span className="pm-info-label">Recebido</span>
            <span className="pm-info-value">{fmt(paid)}</span>
            <span className="pm-info-sub">{paidCount} cobrança{paidCount !== 1 ? 's' : ''} paga{paidCount !== 1 ? 's' : ''}</span>
          </div>
          <div className="pm-info-badge success">
            <ArrowUpRight size={12} /> {paidCount}
          </div>
        </div>

        <div className="pm-info-card">
          <div className="pm-info-icon" style={{ '--ic': '#f59e0b' }}>
            <Clock size={18} />
          </div>
          <div className="pm-info-body">
            <span className="pm-info-label">Pendente</span>
            <span className="pm-info-value">{fmt(pending)}</span>
            <span className="pm-info-sub">{pendingCount} aguardando pagamento</span>
          </div>
          <div className="pm-info-badge warning">
            <Clock size={12} /> {pendingCount}
          </div>
        </div>

        <div className="pm-info-card">
          <div className="pm-info-icon" style={{ '--ic': '#ef4444' }}>
            <AlertCircle size={18} />
          </div>
          <div className="pm-info-body">
            <span className="pm-info-label">Falhas / Expiradas</span>
            <span className="pm-info-value">{failedCount}</span>
            <span className="pm-info-sub">cobranças não concluídas</span>
          </div>
          <div className="pm-info-badge danger">
            <X size={12} /> {failedCount}
          </div>
        </div>

        <div className="pm-info-card">
          <div className="pm-info-icon" style={{ '--ic': '#8b5cf6' }}>
            <BarChart3 size={18} />
          </div>
          <div className="pm-info-body">
            <span className="pm-info-label">Total de Cobranças</span>
            <span className="pm-info-value">{charges.length}</span>
            <span className="pm-info-sub">{meta.total} no total da conta</span>
          </div>
          <div className="pm-info-badge neutral">
            <CreditCard size={12} /> {meta.total}
          </div>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <div className="pm-section">
        <div className="pm-tabs-bar">
          <div className="pm-tabs">
            {[
              { id: 'charges', label: 'Cobranças', icon: CreditCard, count: charges.length },
              { id: 'extract', label: 'Extrato', icon: ArrowUpRight },
              { id: 'withdrawals', label: 'Saques', icon: ArrowDownLeft },
            ].map(tab => (
              <button
                key={tab.id}
                className={`pm-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <tab.icon size={15} />
                <span>{tab.label}</span>
                {tab.count !== undefined && <span className="pm-tab-count">{tab.count}</span>}
              </button>
            ))}
          </div>

          {activeTab === 'charges' && (
            <div className="pm-toolbar">
              <div className="pm-search-box">
                <Search size={14} />
                <input placeholder="Buscar por cliente..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <select className="pm-filter-select" value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }}>
                <option value="">Todos os status</option>
                {Object.entries(STATUS_MAP).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Tab Content */}
        {activeTab === 'charges' && (
          <div data-tour="transactions-list" className="pm-table-wrap">
            {loading ? (
              <div className="pm-loading"><RefreshCw size={20} className="spin" /> Carregando cobranças...</div>
            ) : charges.length === 0 ? (
              <div className="pm-empty">
                <div className="pm-empty-icon">💳</div>
                <h3>Nenhuma cobrança encontrada</h3>
                <p>Crie sua primeira cobrança PIX e comece a receber pagamentos instantaneamente.</p>
                <button className="pm-btn-gradient" onClick={() => setShowChargeModal(true)}>
                  <Plus size={14} /> Criar Primeira Cobrança
                </button>
              </div>
            ) : (
              <>
                <div className="pm-charges-grid">
                  {charges.filter(c => !search || c.client_name?.toLowerCase().includes(search.toLowerCase())).map(charge => {
                    const s = STATUS_MAP[charge.status] || { label: charge.status, color: '#6b7280', icon: '○' };
                    return (
                      <div key={charge.id} className="pm-charge-card" style={{ '--card-accent': s.color }}>
                        <div className="pm-charge-card-top">
                          <div className="pm-charge-client-row">
                            <div className="pm-charge-avatar">
                              {(charge.client_name || '?')[0].toUpperCase()}
                            </div>
                            <div>
                              <span className="pm-charge-client">{charge.client_name || '—'}</span>
                              <span className="pm-charge-desc-text">{charge.description}</span>
                            </div>
                          </div>
                          <StatusBadge status={charge.status} />
                        </div>
                        <div className="pm-charge-card-bottom">
                          <div className="pm-charge-amount-col">
                            <span className="pm-charge-amount">{fmt(charge.amount)}</span>
                            <span className="pm-charge-date">{fmtDate(charge.created_at)}</span>
                          </div>
                          <div className="pm-charge-actions-mini">
                            {charge.client_phone && (
                              <button className="pm-btn-mini" title="Enviar via WhatsApp"><Send size={13} /></button>
                            )}
                            <button className="pm-btn-mini" title="Ver detalhes"><ExternalLink size={13} /></button>
                          </div>
                        </div>
                        <div className="pm-charge-accent-bar" />
                      </div>
                    );
                  })}
                </div>

                {meta.pages > 1 && (
                  <div className="pm-pagination">
                    <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Anterior</button>
                    <span>Página {page} de {meta.pages}</span>
                    <button disabled={page >= meta.pages} onClick={() => setPage(p => p + 1)}>Próxima →</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'extract' && <ExtractTab />}
        {activeTab === 'withdrawals' && <WithdrawalsTab wallet={wallet} onRefresh={loadData} />}
      </div>

      {/* Modals */}
      {showChargeModal && (
        <NewChargeModal onClose={() => setShowChargeModal(false)} onCreated={() => { setShowChargeModal(false); loadData(); }} />
      )}
      {showDepositModal && (
        <DepositModal onClose={() => setShowDepositModal(false)} onCreated={() => { setShowDepositModal(false); loadData(); }} />
      )}
      {showWithdrawModal && (
        <WithdrawModal onClose={() => setShowWithdrawModal(false)} wallet={wallet} onCreated={() => { setShowWithdrawModal(false); loadData(); }} />
      )}
    </div>
  );
}


// ── Tab: Extrato ────────────────────────────────────────────────────────────────
function ExtractTab() {
  const [txs, setTxs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/payments/wallet/transactions${qs({ limit: 50 })}`)
      .then(r => setTxs(r?.items || r || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const TX_ICONS = { credit: ArrowDown, debit: ArrowUp, hold: Clock, release: Zap, refund: RefreshCw, fee: DollarSign, adjustment: Activity };
  const TX_COLOR = { credit: '#10b981', debit: '#ef4444', hold: '#f59e0b', release: '#3b82f6', refund: '#8b5cf6', fee: '#6b7280', adjustment: '#6b7280' };
  const TX_LABEL = { credit: 'Recebido', debit: 'Enviado', hold: 'Bloqueado', release: 'Liberado', refund: 'Estorno', fee: 'Taxa', adjustment: 'Ajuste' };

  if (loading) return <div className="pm-loading"><RefreshCw size={20} className="spin" /> Carregando extrato...</div>;
  if (!txs.length) return (
    <div className="pm-empty">
      <div className="pm-empty-icon">📊</div>
      <h3>Extrato Vazio</h3>
      <p>Nenhuma movimentação financeira registrada até o momento.</p>
    </div>
  );

  return (
    <div className="pm-extract-list">
      {txs.map(tx => {
        const TxIcon = TX_ICONS[tx.type] || Activity;
        const color = TX_COLOR[tx.type] || '#6b7280';
        const label = TX_LABEL[tx.type] || tx.type;
        const isDebit = ['debit', 'hold', 'fee'].includes(tx.type);
        const txAmount = Number(tx.amount) || 0;
        const balanceAfter = Number(tx.balance_after) || 0;
        const balanceBefore = isDebit ? balanceAfter + txAmount : balanceAfter - txAmount;
        return (
          <div key={tx.id} className="pm-extract-item">
            <div className="pm-extract-icon-wrap" style={{ '--tx-color': color }}>
              <TxIcon size={16} />
            </div>
            <div className="pm-extract-body">
              <div className="pm-extract-top">
                <span className="pm-extract-desc">{tx.description}</span>
                <span className="pm-extract-type-badge" style={{ color }}>{label}</span>
              </div>
              <span className="pm-extract-date">{fmtDate(tx.created_at)}</span>
            </div>
            <div className="pm-extract-amount-col">
              <span className={`pm-extract-amount ${isDebit ? 'debit' : 'credit'}`}>
                {isDebit ? '−' : '+'}{fmt(tx.amount)}
              </span>
            </div>
            <div className="pm-extract-balance-col">
              <span className="pm-extract-balance-label">Saldo Anterior</span>
              <span className="pm-extract-balance-value">{fmt(balanceBefore)}</span>
            </div>
            <div className="pm-extract-balance-col current">
              <span className="pm-extract-balance-label">Saldo (R$)</span>
              <span className="pm-extract-balance-value highlight">{fmt(balanceAfter)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}


// ── Tab: Saques ────────────────────────────────────────────────────────────────
function WithdrawalsTab({ wallet, onRefresh }) {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get('/payments/wallet/withdrawals')
      .then(r => setWithdrawals(r || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const W_STATUS = {
    pending:    { label: 'Pendente',     color: '#f59e0b', icon: '⏳' },
    approved:   { label: 'Aprovado',     color: '#3b82f6', icon: '✓'  },
    completed:  { label: 'Concluído',    color: '#10b981', icon: '✅' },
    rejected:   { label: 'Rejeitado',    color: '#ef4444', icon: '✗'  },
    processing: { label: 'Processando',  color: '#8b5cf6', icon: '⚙' },
  };

  if (loading) return <div className="pm-loading"><RefreshCw size={20} className="spin" /> Carregando saques...</div>;

  return (
    <div className="pm-withdrawals-tab">
      {withdrawals.length === 0 ? (
        <div className="pm-empty">
          <div className="pm-empty-icon">💸</div>
          <h3>Nenhum saque solicitado</h3>
          <p>Quando você solicitar um saque, ele aparecerá aqui com o status atualizado.</p>
        </div>
      ) : (
        <div className="pm-withdrawals-list">
          {withdrawals.map(w => {
            const s = W_STATUS[w.status] || { label: w.status, color: '#6b7280' };
            return (
              <div key={w.id} className="pm-withdrawal-card">
                <div className="pm-withdrawal-left">
                  <div className="pm-withdrawal-icon" style={{ '--w-color': s.color }}>
                    <ArrowUp size={16} />
                  </div>
                  <div>
                    <span className="pm-withdrawal-amount">{fmt(w.amount)}</span>
                    <span className="pm-withdrawal-key">🔑 {w.pix_key}</span>
                    <span className="pm-withdrawal-date">{fmtDate(w.created_at)}</span>
                  </div>
                </div>
                <span className="pm-status-badge" style={{ '--badge-color': s.color }}>
                  <span className="pm-status-dot" />
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
