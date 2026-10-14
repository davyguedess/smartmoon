/**
 * IAStorePage — NEXUS.IA Token Marketplace v2
 * Design glassmorphism premium com providers expandidos.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Zap, Gift, Rocket, Crown, Server, CheckCircle2,
  RefreshCw, TrendingUp, Activity, History, X, CreditCard,
  Info, ShoppingCart, Sparkles, Star, Brain, Cpu,
} from 'lucide-react';
import { api } from '../../api';

// ── Ícones mapeados por string ────────────────────────────────────────────────
const ICON_MAP = {
  zap: Zap, gift: Gift, rocket: Rocket, crown: Crown,
  server: Server, sparkles: Sparkles, star: Star, activity: Activity,
  brain: Brain, cpu: Cpu,
};

// ── Tier config ───────────────────────────────────────────────────────────────
function tierLabel(tier) {
  return { free: 'Gratuito', starter: 'Starter', pro: 'Pro', enterprise: 'Enterprise' }[tier] || tier;
}

function formatTokens(n) {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(0)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `∞`;
}

// ── Pricing table data (agora com novos providers) ────────────────────────────
const PRICING_ROWS = [
  { provider: 'Ollama Local',             logo: '🦙', tier: 'free',       input: 0,  output: 0,  note: 'Infraestrutura SM' },
  { provider: 'Gemini Flash 2.0',         logo: '🔷', tier: 'free',       input: 0,  output: 0,  note: 'Pack mensal gratuito' },
  { provider: 'Groq Llama 3',             logo: '⚡', tier: 'starter',    input: 2,  output: 4,  note: 'Ultra-rápido' },
  { provider: 'DeepSeek R1',              logo: '🌊', tier: 'starter',    input: 2,  output: 5,  note: 'Raciocínio avançado' },
  { provider: 'Mistral Large',            logo: '🌬️', tier: 'starter',    input: 3,  output: 6,  note: 'Multilingual' },
  { provider: 'Together AI (Llama 3.3)',  logo: '🤝', tier: 'starter',    input: 3,  output: 5,  note: 'Open-source premium' },
  { provider: 'GPT-4o mini',              logo: '🧠', tier: 'pro',        input: 5,  output: 10, note: '' },
  { provider: 'Gemini 1.5 Pro',           logo: '🔷', tier: 'pro',        input: 5,  output: 10, note: '' },
  { provider: 'GPT-4o',                   logo: '🧠', tier: 'pro',        input: 15, output: 30, note: 'Mais capaz da OpenAI' },
  { provider: 'Claude Sonnet 3.7',        logo: '🟣', tier: 'pro',        input: 15, output: 30, note: '' },
  { provider: 'xAI Grok-2',              logo: '𝕏',  tier: 'enterprise',  input: 20, output: 40, note: 'Tempo real X/Twitter' },
  { provider: 'Claude Opus 4',            logo: '🟣', tier: 'enterprise',  input: 50, output: 100,note: 'Mais poderoso' },
];

const TIER_COLORS = {
  free:       '#22c55e',
  starter:    '#f59e0b',
  pro:        '#8b5cf6',
  enterprise: '#06b6d4',
};

// ── BalanceHeader ─────────────────────────────────────────────────────────────
function BalanceHeader({ balance, onRefresh, loading }) {
  return (
    <div className="ia-balance-card">
      <div className="ia-balance-glow" />
      <div className="ia-balance-content">
        <div className="ia-balance-left">
          <div className="ia-balance-icon-wrap">
            <Zap size={22} />
          </div>
          <div>
            <div className="ia-balance-label">Seus SM Tokens</div>
            <div className="ia-balance-value">
              {loading ? '···' : (balance?.total_balance ?? 0).toLocaleString('pt-BR')}
            </div>
          </div>
        </div>
        <div className="ia-balance-stats-wrap">
          <div className="ia-balance-stat">
            <span className="ia-balance-stat-label">Usado este mês</span>
            <span className="ia-balance-stat-num">{(balance?.used_this_month ?? 0).toLocaleString('pt-BR')}</span>
          </div>
          <div className="ia-balance-divider" />
          <div className="ia-balance-stat">
            <span className="ia-balance-stat-label">Packs ativados</span>
            <span className="ia-balance-stat-num">{balance?.packs_activated ?? 0}</span>
          </div>
          <button className="ia-refresh-btn" onClick={onRefresh} disabled={loading} title="Atualizar saldo">
            <RefreshCw size={14} className={loading ? 'spinning' : ''} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PackCard glassmorphism ─────────────────────────────────────────────────────
function PackCard({ pack, onActivate, loading }) {
  const [hovered, setHovered] = useState(false);
  const IconComp = ICON_MAP[pack.icon] || Zap;
  const isFree = pack.is_free;

  return (
    <div
      className={`ia-pack-card-v2 ${pack.is_highlighted ? 'highlighted' : ''}`}
      style={{ '--pack-color': pack.color || '#8b5cf6' }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Glow effect on hover */}
      <div className="ia-pack-glow" style={{ opacity: hovered ? 1 : 0 }} />

      {pack.badge_text && (
        <div className="ia-pack-badge-v2" style={{ background: `linear-gradient(135deg, ${pack.color}, ${pack.color}aa)` }}>
          <Star size={9} /> {pack.badge_text}
        </div>
      )}

      <div className="ia-pack-icon-v2" style={{ background: `${pack.color}18`, border: `1px solid ${pack.color}30` }}>
        <IconComp size={24} style={{ color: pack.color }} />
      </div>

      <div className="ia-pack-tier-v2" style={{ color: pack.color, background: `${pack.color}15`, border: `1px solid ${pack.color}30` }}>
        {tierLabel(pack.tier)}
      </div>

      <div className="ia-pack-name-v2">{pack.name}</div>
      <div className="ia-pack-desc-v2">{pack.description}</div>

      <div className="ia-pack-tokens-v2">
        <span style={{ color: pack.color, filter: `drop-shadow(0 0 8px ${pack.color}60)` }}>
          {formatTokens(pack.tokens_included)}
        </span>
        <span className="ia-pack-tokens-unit">tokens SM</span>
      </div>

      {pack.renews_monthly && (
        <div className="ia-pack-renews-v2">
          <RefreshCw size={11} />
          <span>Renova mensalmente</span>
        </div>
      )}

      <div className="ia-pack-price-v2">
        {isFree ? (
          <span className="ia-pack-price-free-v2">Grátis</span>
        ) : pack.price_brl > 0 ? (
          <>
            <span className="ia-pack-currency">R$</span>
            <span className="ia-pack-amount">{pack.price_brl.toFixed(2).replace('.', ',')}</span>
          </>
        ) : (
          <>
            <span className="ia-pack-amount">{pack.price_credits}</span>
            <span className="ia-pack-currency">créditos</span>
          </>
        )}
      </div>

      <button
        className={`ia-pack-btn-v2 ${isFree ? 'btn-free' : 'btn-buy'} ${loading ? 'loading' : ''}`}
        onClick={() => onActivate(pack)}
        disabled={loading}
        style={!isFree ? { background: `linear-gradient(135deg, ${pack.color}, ${pack.color}bb)`, boxShadow: `0 4px 20px ${pack.color}40` } : {}}
      >
        {loading ? (
          <RefreshCw size={14} className="spinning" />
        ) : isFree ? (
          <><Gift size={14} /> Ativar Grátis</>
        ) : (
          <><ShoppingCart size={14} /> Comprar</>
        )}
      </button>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function ConfirmModal({ pack, result, onClose }) {
  if (!pack) return null;
  return (
    <div className="ia-modal-overlay-v2" onClick={onClose}>
      <div className="ia-modal-v2" onClick={e => e.stopPropagation()}>
        <button className="ia-modal-close-v2" onClick={onClose}><X size={18} /></button>
        {result ? (
          result.type === 'pix' ? (
            <>
              <div className="ia-modal-icon-v2 success"><Zap size={28} /></div>
              <h3>PIX Gerado! ⚡</h3>
              <p>{result.message}</p>
              {result.charge?.pix_qr_code && (
                <div className="ia-pix-qr-v2">
                  <img src={`https://quickchart.io/qr?text=${encodeURIComponent(result.charge.pix_qr_code)}&size=180`} alt="QR Code PIX" />
                  <div className="ia-pix-copy-v2">
                    <input readOnly value={result.charge.pix_qr_code} />
                    <button onClick={() => navigator.clipboard.writeText(result.charge.pix_qr_code)}>Copiar</button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="ia-modal-icon-v2 success"><CheckCircle2 size={28} /></div>
              <h3>Tokens Creditados! 🚀</h3>
              <p>{result.message}</p>
              <div className="ia-modal-balance-v2">
                <Zap size={16} />
                <span>Novo saldo: <strong>{(result.new_balance ?? 0).toLocaleString('pt-BR')}</strong> tokens</span>
              </div>
            </>
          )
        ) : (
          <>
            <div className="ia-modal-icon-v2" style={{ background: `${pack.color}22`, color: pack.color }}>
              <ShoppingCart size={28} />
            </div>
            <h3>Confirmar ativação</h3>
            <p>
              {pack.is_free
                ? `Ativar ${formatTokens(pack.tokens_included)} tokens grátis do pack "${pack.name}"?`
                : `Comprar "${pack.name}" por R$ ${pack.price_brl?.toFixed(2).replace('.', ',')}?`}
            </p>
          </>
        )}
        <button className="ia-modal-done-v2" onClick={onClose}>
          {result ? 'Fechar' : 'Cancelar'}
        </button>
      </div>
    </div>
  );
}

// ── Tabela de Preços premium ──────────────────────────────────────────────────
function PricingTable() {
  const [filter, setFilter] = useState('all');
  const tiers = ['all', 'free', 'starter', 'pro', 'enterprise'];
  const filtered = filter === 'all' ? PRICING_ROWS : PRICING_ROWS.filter(r => r.tier === filter);

  return (
    <div className="ia-pricing-v2">
      <div className="ia-pricing-description">
        <Info size={15} />
        <span>Custo em SM tokens por 1.000 tokens LLM. Conecte sua própria API key para usar sem consumir SM tokens.</span>
      </div>

      {/* Tier filter */}
      <div className="ia-pricing-filters">
        {tiers.map(t => (
          <button
            key={t}
            onClick={() => setFilter(t)}
            className={`ia-pricing-filter-btn ${filter === t ? 'active' : ''}`}
            style={filter === t && t !== 'all' ? { borderColor: TIER_COLORS[t], color: TIER_COLORS[t], background: `${TIER_COLORS[t]}15` } : {}}
          >
            {t === 'all' ? 'Todos' : tierLabel(t)}
          </button>
        ))}
      </div>

      <div className="ia-pricing-grid-v2">
        {/* Header */}
        <div className="ia-pricing-row-v2 header">
          <span>Provider / Modelo</span>
          <span>Tier</span>
          <span>Input /1K</span>
          <span>Output /1K</span>
          <span>Nota</span>
        </div>
        {filtered.map((r, i) => (
          <div key={i} className="ia-pricing-row-v2">
            <span className="ia-provider-name">
              <span className="ia-provider-logo">{r.logo}</span>
              {r.provider}
            </span>
            <span>
              <span
                className="ia-tier-pill"
                style={{ color: TIER_COLORS[r.tier], background: `${TIER_COLORS[r.tier]}18`, border: `1px solid ${TIER_COLORS[r.tier]}40` }}
              >
                {tierLabel(r.tier)}
              </span>
            </span>
            <span className={r.input === 0 ? 'ia-cost-free' : 'ia-cost-paid'}>
              {r.input === 0 ? 'Grátis' : r.input}
            </span>
            <span className={r.output === 0 ? 'ia-cost-free' : 'ia-cost-paid'}>
              {r.output === 0 ? 'Grátis' : r.output}
            </span>
            <span className="ia-provider-note">{r.note}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Página Principal ──────────────────────────────────────────────────────────
export default function IAStorePage() {
  const [packs, setPacks]             = useState([]);
  const [balance, setBalance]         = useState(null);
  const [loading, setLoading]         = useState(true);
  const [activating, setActivating]   = useState(null);
  const [confirmPack, setConfirmPack] = useState(null);
  const [activateResult, setActivateResult] = useState(null);
  const [activeTab, setActiveTab]     = useState('packs');
  const [history, setHistory]         = useState([]);
  const [histLoading, setHistLoading] = useState(false);
  const [filter, setFilter]           = useState('all');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [packsRes, balRes] = await Promise.allSettled([
        api.get('/store/ai-tokens/packs'),
        api.get('/store/ai-tokens/balance'),
      ]);
      setPacks(packsRes.status === 'fulfilled' ? (packsRes.value?.data?.packs || packsRes.value?.packs || []) : []);
      setBalance(balRes.status === 'fulfilled' ? (balRes.value?.data || balRes.value) : null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistLoading(true);
    try {
      const res = await api.get('/store/ai-tokens/history?limit=30');
      setHistory(res?.data?.transactions || res?.transactions || []);
    } catch (e) { console.error(e); }
    finally { setHistLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { if (activeTab === 'history') loadHistory(); }, [activeTab, loadHistory]);

  const handleActivate = async (pack) => {
    setActivating(pack.id);
    setConfirmPack(pack);
    setActivateResult(null);
    try {
      const res = await api.post(`/store/ai-tokens/packs/${pack.id}/activate`);
      setActivateResult(res?.data || res);
      loadData();
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || 'Erro ao ativar';
      setActivateResult({ type: 'error', message: msg });
    } finally {
      setActivating(null);
    }
  };

  const filteredPacks = filter === 'all'
    ? packs
    : filter === 'free'
      ? packs.filter(p => p.is_free)
      : packs.filter(p => !p.is_free);

  return (
    <div className="ia-store-v2">
      <style>{`
        /* ── IA Store v2 — Glassmorphism ── */
        .ia-store-v2 {
          min-height: 100%;
          background: var(--bg-base);
          font-family: 'Inter', sans-serif;
        }

        /* Hero */
        .ia-hero-v2 {
          position: relative;
          padding: 48px 32px 40px;
          overflow: hidden;
          border-bottom: 1px solid var(--border-subtle);
        }
        .ia-hero-bg-v2 {
          position: absolute; inset: 0; pointer-events: none;
          background: radial-gradient(ellipse 80% 80% at 50% -20%, rgba(139,92,246,0.18) 0%, transparent 70%),
                      radial-gradient(ellipse 50% 50% at 80% 50%, rgba(6,182,212,0.1) 0%, transparent 60%);
        }
        .ia-hero-stars-v2 {
          position: absolute; inset: 0; pointer-events: none;
          background-image: radial-gradient(1px 1px at 20% 30%, rgba(255,255,255,0.4) 0%, transparent 100%),
                            radial-gradient(1px 1px at 70% 20%, rgba(255,255,255,0.3) 0%, transparent 100%),
                            radial-gradient(1px 1px at 45% 70%, rgba(255,255,255,0.2) 0%, transparent 100%);
        }
        .ia-hero-content-v2 {
          position: relative; max-width: 720px; margin: 0 auto; text-align: center;
        }
        .ia-hero-badge-v2 {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 5px 14px; border-radius: 30px; margin-bottom: 18px;
          background: rgba(139,92,246,0.15); border: 1px solid rgba(139,92,246,0.35);
          color: #a78bfa; font-size: 12px; font-weight: 700;
          animation: ia-glow-pulse 2.5s ease-in-out infinite;
        }
        @keyframes ia-glow-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(139,92,246,0.2); }
          50% { box-shadow: 0 0 20px 4px rgba(139,92,246,0.3); }
        }
        .ia-hero-title-v2 {
          font-size: 36px; font-weight: 900; margin: 0 0 12px;
          background: linear-gradient(135deg, #e2e8f0 0%, #a78bfa 50%, #06b6d4 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .ia-hero-sub-v2 {
          font-size: 14px; color: var(--text-muted); line-height: 1.7; margin: 0;
          max-width: 480px; margin: 0 auto;
        }

        /* Balance card */
        .ia-balance-card {
          position: relative; margin: 24px 32px;
          background: linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(6,182,212,0.06) 100%);
          border: 1px solid rgba(139,92,246,0.25);
          border-radius: 18px; padding: 20px 28px; overflow: hidden;
          backdrop-filter: blur(20px);
        }
        .ia-balance-glow {
          position: absolute; inset: 0; pointer-events: none;
          background: radial-gradient(ellipse 60% 100% at 30% 50%, rgba(139,92,246,0.07) 0%, transparent 70%);
        }
        .ia-balance-content {
          position: relative; display: flex; align-items: center; justify-content: space-between;
          flex-wrap: wrap; gap: 16px;
        }
        .ia-balance-left { display: flex; align-items: center; gap: 16px; }
        .ia-balance-icon-wrap {
          width: 48px; height: 48px; border-radius: 14px; flex-shrink: 0;
          background: linear-gradient(135deg, rgba(139,92,246,0.3), rgba(6,182,212,0.2));
          border: 1px solid rgba(139,92,246,0.4);
          display: flex; align-items: center; justify-content: center;
          color: #a78bfa;
        }
        .ia-balance-label { font-size: 11px; color: var(--text-muted); font-weight: 600; margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.8px; }
        .ia-balance-value {
          font-size: 28px; font-weight: 900;
          background: linear-gradient(135deg, #e2e8f0, #a78bfa);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .ia-balance-stats-wrap { display: flex; align-items: center; gap: 20px; }
        .ia-balance-divider { width: 1px; height: 32px; background: var(--border-subtle); }
        .ia-balance-stat { display: flex; flex-direction: column; gap: 3px; }
        .ia-balance-stat-label { font-size: 10px; color: var(--text-muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.6px; }
        .ia-balance-stat-num { font-size: 16px; font-weight: 800; color: var(--text-primary); }
        .ia-refresh-btn {
          width: 36px; height: 36px; border-radius: 10px; border: 1px solid var(--border-subtle);
          background: var(--bg-card); cursor: pointer; display: flex; align-items: center; justify-content: center;
          color: var(--text-muted); transition: all 0.2s;
        }
        .ia-refresh-btn:hover { border-color: var(--nexus-violet); color: var(--nexus-violet); }
        .ia-refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .spinning { animation: spin 0.8s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }

        /* Tabs */
        .ia-tabs-v2 { display: flex; gap: 4px; padding: 0 32px; border-bottom: 1px solid var(--border-subtle); }
        .ia-tab-v2 {
          display: flex; align-items: center; gap: 7px;
          padding: 12px 18px; background: none; border: none; border-bottom: 2px solid transparent;
          color: var(--text-muted); font-weight: 600; font-size: 13px; cursor: pointer;
          transition: all 0.2s; margin-bottom: -1px; white-space: nowrap;
        }
        .ia-tab-v2.active { color: var(--nexus-violet); border-bottom-color: var(--nexus-violet); }
        .ia-tab-v2:hover:not(.active) { color: var(--text-secondary); }

        /* Filter buttons */
        .ia-filter-wrap-v2 { display: flex; gap: 8px; padding: 20px 32px 0; flex-wrap: wrap; }
        .ia-filter-btn-v2 {
          padding: 6px 16px; border-radius: 30px; border: 1px solid var(--border-subtle);
          background: var(--bg-card); color: var(--text-muted); font-size: 12px; font-weight: 600;
          cursor: pointer; transition: all 0.2s;
        }
        .ia-filter-btn-v2:hover { border-color: var(--nexus-violet); color: var(--nexus-violet); }
        .ia-filter-btn-v2.active {
          background: rgba(139,92,246,0.12); border-color: rgba(139,92,246,0.4);
          color: #a78bfa;
        }

        /* Packs grid */
        .ia-packs-grid-v2 {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 20px; padding: 20px 32px 32px;
        }

        /* Pack Card glassmorphism */
        .ia-pack-card-v2 {
          position: relative;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px; padding: 24px 22px;
          display: flex; flex-direction: column; gap: 12px;
          cursor: pointer; overflow: hidden;
          transition: all 0.25s cubic-bezier(0.4,0,0.2,1);
          backdrop-filter: blur(12px);
        }
        .ia-pack-card-v2:hover {
          transform: translateY(-4px);
          border-color: rgba(var(--pack-color-rgb, 139, 92, 246), 0.4);
          box-shadow: 0 12px 40px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.06);
        }
        .ia-pack-card-v2.highlighted {
          background: rgba(139,92,246,0.06);
          border-color: rgba(139,92,246,0.3);
          box-shadow: 0 0 30px rgba(139,92,246,0.12);
        }
        .ia-pack-glow {
          position: absolute; inset: 0; pointer-events: none;
          background: radial-gradient(ellipse 80% 60% at 50% 0%, rgba(139,92,246,0.08) 0%, transparent 70%);
          transition: opacity 0.3s;
        }
        .ia-pack-badge-v2 {
          position: absolute; top: 14px; right: 14px;
          display: flex; align-items: center; gap: 4px;
          padding: 3px 10px; border-radius: 20px;
          font-size: 10px; font-weight: 800; color: #fff;
        }
        .ia-pack-icon-v2 {
          width: 52px; height: 52px; border-radius: 16px;
          display: flex; align-items: center; justify-content: center;
          backdrop-filter: blur(8px);
        }
        .ia-pack-tier-v2 {
          display: inline-flex; padding: 3px 10px; border-radius: 20px;
          font-size: 10px; font-weight: 700; align-self: flex-start;
        }
        .ia-pack-name-v2 { font-size: 16px; font-weight: 800; color: var(--text-primary); }
        .ia-pack-desc-v2 { font-size: 12px; color: var(--text-muted); line-height: 1.5; flex: 1; }
        .ia-pack-tokens-v2 {
          display: flex; align-items: baseline; gap: 6px;
          font-size: 32px; font-weight: 900;
        }
        .ia-pack-tokens-unit { font-size: 12px; color: var(--text-muted); font-weight: 600; }
        .ia-pack-renews-v2 {
          display: flex; align-items: center; gap: 6px;
          font-size: 11px; color: var(--text-muted);
        }
        .ia-pack-price-v2 {
          display: flex; align-items: baseline; gap: 4px; margin-top: 4px;
        }
        .ia-pack-price-free-v2 {
          font-size: 20px; font-weight: 800;
          background: linear-gradient(135deg, #22c55e, #06b6d4);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .ia-pack-currency { font-size: 14px; color: var(--text-muted); font-weight: 600; }
        .ia-pack-amount { font-size: 22px; font-weight: 900; color: var(--text-primary); }
        .ia-pack-btn-v2 {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          padding: 12px; border-radius: 12px; border: none;
          font-size: 13px; font-weight: 700; cursor: pointer;
          transition: all 0.2s; margin-top: 4px;
        }
        .ia-pack-btn-v2.btn-free {
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.3);
          color: #4ade80;
        }
        .ia-pack-btn-v2.btn-free:hover { background: rgba(34,197,94,0.2); }
        .ia-pack-btn-v2.btn-buy { color: #fff; }
        .ia-pack-btn-v2:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }
        .ia-pack-btn-v2:not(:disabled):hover { filter: brightness(1.15); transform: translateY(-1px); }

        /* Skeletons */
        .ia-skeleton-grid {
          display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 20px; padding: 20px 32px 32px;
        }
        .ia-skeleton-card {
          height: 320px; border-radius: 20px;
          background: linear-gradient(90deg, var(--bg-card) 25%, var(--bg-surface) 50%, var(--bg-card) 75%);
          background-size: 400% 100%;
          animation: ia-shimmer 1.4s ease infinite;
        }
        @keyframes ia-shimmer {
          0% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        /* Empty state */
        .ia-empty-v2 {
          grid-column: 1/-1; text-align: center;
          padding: 60px 20px; color: var(--text-muted); font-size: 14px;
        }

        /* Modal v2 */
        .ia-modal-overlay-v2 {
          position: fixed; inset: 0; z-index: 9999;
          background: rgba(0,0,0,0.7); backdrop-filter: blur(6px);
          display: flex; align-items: center; justify-content: center; padding: 20px;
        }
        .ia-modal-v2 {
          background: var(--bg-surface); border: 1px solid var(--border-subtle);
          border-radius: 20px; padding: 32px; max-width: 440px; width: 100%;
          position: relative; text-align: center; box-shadow: 0 24px 80px rgba(0,0,0,0.5);
        }
        .ia-modal-v2 h3 { font-size: 18px; font-weight: 800; margin: 12px 0 8px; }
        .ia-modal-v2 p { font-size: 13px; color: var(--text-muted); margin: 0 0 16px; }
        .ia-modal-close-v2 {
          position: absolute; top: 16px; right: 16px;
          background: var(--bg-card); border: 1px solid var(--border-subtle);
          border-radius: 8px; padding: 6px; cursor: pointer; color: var(--text-muted);
          display: flex; align-items: center;
        }
        .ia-modal-icon-v2 {
          width: 60px; height: 60px; border-radius: 18px;
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 12px; font-size: 28px;
        }
        .ia-modal-icon-v2.success { background: rgba(34,197,94,0.15); color: #4ade80; }
        .ia-modal-balance-v2 {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          padding: 10px 16px; border-radius: 10px; font-size: 13px;
          background: rgba(139,92,246,0.1); border: 1px solid rgba(139,92,246,0.2);
          color: var(--text-primary); margin-bottom: 16px;
        }
        .ia-pix-qr-v2 { text-align: center; margin-bottom: 16px; }
        .ia-pix-qr-v2 img { border-radius: 12px; border: 1px solid var(--border-subtle); }
        .ia-pix-copy-v2 { display: flex; gap: 8px; margin-top: 10px; }
        .ia-pix-copy-v2 input {
          flex: 1; padding: 7px 10px; border-radius: 8px; font-size: 11px;
          border: 1px solid var(--border-subtle); background: var(--bg-card);
          color: var(--text-muted); font-family: monospace;
        }
        .ia-pix-copy-v2 button {
          padding: 7px 14px; border-radius: 8px; border: none;
          background: var(--nexus-violet); color: #fff; font-size: 12px; font-weight: 700; cursor: pointer;
        }
        .ia-modal-done-v2 {
          display: flex; align-items: center; justify-content: center;
          width: 100%; padding: 12px; border-radius: 12px; border: none;
          background: linear-gradient(135deg, var(--nexus-violet), #6366f1);
          color: #fff; font-weight: 700; font-size: 14px; cursor: pointer;
          transition: all 0.2s;
        }
        .ia-modal-done-v2:hover { filter: brightness(1.1); }

        /* Pricing v2 */
        .ia-pricing-v2 { padding: 24px 32px; }
        .ia-pricing-description {
          display: flex; align-items: flex-start; gap: 10px;
          padding: 14px 18px; border-radius: 12px;
          background: rgba(6,182,212,0.07); border: 1px solid rgba(6,182,212,0.2);
          color: var(--text-muted); font-size: 13px; line-height: 1.6;
          margin-bottom: 20px;
        }
        .ia-pricing-filters { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
        .ia-pricing-filter-btn {
          padding: 5px 14px; border-radius: 20px; border: 1px solid var(--border-subtle);
          background: var(--bg-card); color: var(--text-muted); font-size: 12px; font-weight: 600;
          cursor: pointer; transition: all 0.2s;
        }
        .ia-pricing-filter-btn.active {
          background: rgba(139,92,246,0.12); border-color: rgba(139,92,246,0.4);
          color: #a78bfa;
        }
        .ia-pricing-grid-v2 { border-radius: 14px; overflow: hidden; border: 1px solid var(--border-subtle); }
        .ia-pricing-row-v2 {
          display: grid; grid-template-columns: 2fr 1fr 0.8fr 0.8fr 1.2fr;
          padding: 12px 18px; border-bottom: 1px solid var(--border-subtle);
          font-size: 13px; align-items: center; transition: background 0.15s;
        }
        .ia-pricing-row-v2:last-child { border-bottom: none; }
        .ia-pricing-row-v2:hover:not(.header) { background: var(--bg-card); }
        .ia-pricing-row-v2.header {
          font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;
          letter-spacing: 0.8px; background: var(--bg-surface);
        }
        .ia-provider-name { display: flex; align-items: center; gap: 10px; font-weight: 600; }
        .ia-provider-logo { font-size: 18px; width: 24px; text-align: center; flex-shrink: 0; }
        .ia-tier-pill { padding: 3px 9px; border-radius: 20px; font-size: 10px; font-weight: 700; }
        .ia-cost-free { color: #4ade80; font-weight: 700; }
        .ia-cost-paid { color: var(--text-primary); font-weight: 600; }
        .ia-provider-note { font-size: 11px; color: var(--text-muted); }

        /* History */
        .ia-history-v2 { padding: 24px 32px; }
        .ia-history-grid { border-radius: 14px; overflow: hidden; border: 1px solid var(--border-subtle); }
        .ia-history-row-v2 {
          display: grid; grid-template-columns: 1fr 1.5fr 1fr 1fr 1fr;
          padding: 11px 18px; border-bottom: 1px solid var(--border-subtle);
          font-size: 12px; align-items: center;
          transition: background 0.15s;
        }
        .ia-history-row-v2:last-child { border-bottom: none; }
        .ia-history-row-v2:hover { background: var(--bg-card); }
        .ia-history-row-v2.header {
          font-size: 10px; font-weight: 700; color: var(--text-muted);
          text-transform: uppercase; letter-spacing: 0.8px; background: var(--bg-surface);
        }
        .ia-tx-badge {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 3px 8px; border-radius: 20px; font-size: 10px; font-weight: 700;
        }
        .ia-tx-badge.credit { background: rgba(34,197,94,0.12); color: #4ade80; }
        .ia-tx-badge.usage { background: rgba(139,92,246,0.12); color: #a78bfa; }
        .ia-history-empty-v2 { text-align: center; padding: 60px 20px; color: var(--text-muted); font-size: 14px; }

        /* ── MOBILE RESPONSIVE ── */
        @media (max-width: 768px) {
          .ia-hero-v2 { padding: 28px 16px 24px; }
          .ia-hero-title-v2 { font-size: 22px !important; }
          .ia-hero-sub-v2 { font-size: 12px; }
          .ia-balance-card { margin: 16px; padding: 14px 16px; border-radius: 14px; }
          .ia-balance-content { flex-direction: column; align-items: flex-start; }
          .ia-balance-value { font-size: 22px !important; }
          .ia-balance-icon-wrap { width: 40px; height: 40px; border-radius: 10px; }
          .ia-balance-stats-wrap { width: 100%; gap: 12px; }
          .ia-tabs-v2 { padding: 0 16px; overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .ia-tab-v2 { padding: 10px 14px; font-size: 12px; white-space: nowrap; }
          .ia-filter-wrap-v2 { padding: 14px 16px 0; gap: 6px; }
          .ia-packs-grid-v2 { grid-template-columns: 1fr !important; padding: 14px 16px 80px; gap: 12px; }
          .ia-skeleton-grid { grid-template-columns: 1fr !important; padding: 14px 16px; }
          .ia-pack-card-v2 { padding: 16px; border-radius: 14px; }
          .ia-pack-tokens-v2 { font-size: 24px; }
          .ia-pricing-v2 { padding: 16px; }
          .ia-pricing-grid-v2 { overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .ia-pricing-row-v2 { min-width: 600px; font-size: 12px; padding: 10px 14px; }
          .ia-history-v2 { padding: 16px; }
          .ia-history-grid { overflow-x: auto; -webkit-overflow-scrolling: touch; }
          .ia-history-row-v2 { min-width: 500px; }
          .ia-modal-v2 { padding: 20px; margin: 16px; border-radius: 16px; }
        }
      `}</style>

      {/* Hero */}
      <div className="ia-hero-v2">
        <div className="ia-hero-bg-v2" />
        <div className="ia-hero-stars-v2" />
        <div className="ia-hero-content-v2">
          <div className="ia-hero-badge-v2">
            <Sparkles size={13} />
            Smart Moon IA Store
          </div>
          <h1 className="ia-hero-title-v2">Tokens de IA para seus Agentes</h1>
          <p className="ia-hero-sub-v2">
            Acesse os melhores modelos de IA sem precisar de chave própria.
            Compre tokens e use em qualquer provider — DeepSeek, Mistral, xAI, Together e muito mais.
          </p>
        </div>
      </div>

      {/* Balance */}
      <BalanceHeader balance={balance} onRefresh={loadData} loading={loading} />

      {/* Tabs */}
      <div className="ia-tabs-v2">
        {[
          { id: 'packs',   icon: ShoppingCart, label: 'Packs Disponíveis' },
          { id: 'pricing', icon: TrendingUp,   label: 'Tabela de Preços' },
          { id: 'history', icon: History,      label: 'Histórico' },
        ].map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            className={`ia-tab-v2 ${activeTab === id ? 'active' : ''}`}
            onClick={() => setActiveTab(id)}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* Packs */}
      {activeTab === 'packs' && (
        <>
          <div className="ia-filter-wrap-v2">
            {[['all', 'Todos'], ['free', '🎁 Gratuitos'], ['paid', '💎 Pagos']].map(([f, label]) => (
              <button
                key={f}
                className={`ia-filter-btn-v2 ${filter === f ? 'active' : ''}`}
                onClick={() => setFilter(f)}
              >{label}</button>
            ))}
          </div>

          {loading ? (
            <div className="ia-skeleton-grid">
              {[1,2,3,4].map(i => <div key={i} className="ia-skeleton-card" />)}
            </div>
          ) : (
            <div className="ia-packs-grid-v2">
              {filteredPacks.map(pack => (
                <PackCard key={pack.id} pack={pack} onActivate={handleActivate} loading={activating === pack.id} />
              ))}
              {filteredPacks.length === 0 && (
                <div className="ia-empty-v2">Nenhum pack encontrado nesta categoria.</div>
              )}
            </div>
          )}
        </>
      )}

      {/* Pricing */}
      {activeTab === 'pricing' && <PricingTable />}

      {/* History */}
      {activeTab === 'history' && (
        <div className="ia-history-v2">
          {histLoading ? (
            <div className="ia-skeleton-grid" style={{ padding: 0 }}>
              {[1,2,3].map(i => <div key={i} className="ia-skeleton-card" style={{ height: 48 }} />)}
            </div>
          ) : history.length === 0 ? (
            <div className="ia-history-empty-v2">
              <Activity size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
              <div>Nenhuma transação ainda. Ative um pack para começar!</div>
            </div>
          ) : (
            <div className="ia-history-grid">
              <div className="ia-history-row-v2 header">
                <span>Tipo</span><span>Provider / Modelo</span>
                <span>Tokens</span><span>Custo SM</span><span>Data</span>
              </div>
              {history.map(tx => (
                <div key={tx.id} className="ia-history-row-v2">
                  <span>
                    <span className={`ia-tx-badge ${tx.tx_type}`}>
                      {tx.tx_type === 'credit' ? <Gift size={10}/> : <Activity size={10}/>}
                      {tx.tx_type === 'credit' ? 'Crédito' : 'Uso'}
                    </span>
                  </span>
                  <span>{tx.provider}{tx.model ? ` / ${tx.model}` : ''}</span>
                  <span>
                    {tx.tx_type === 'usage'
                      ? `↑${tx.tokens_in?.toLocaleString()} ↓${tx.tokens_out?.toLocaleString()}`
                      : `+${tx.nexus_tokens_cost?.toLocaleString()}`}
                  </span>
                  <span style={{ color: tx.tx_type === 'credit' ? '#4ade80' : '#a78bfa', fontWeight: 700 }}>
                    {tx.tx_type === 'credit' ? `+${tx.nexus_tokens_cost?.toLocaleString()}` : `-${tx.nexus_tokens_cost?.toLocaleString()}`}
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>
                    {tx.created_at ? new Date(tx.created_at).toLocaleDateString('pt-BR') : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {confirmPack && (
        <ConfirmModal
          pack={confirmPack}
          result={activateResult}
          onClose={() => { setConfirmPack(null); setActivateResult(null); }}
        />
      )}
    </div>
  );
}
