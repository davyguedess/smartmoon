// Slides 9-15 injected dynamically
const deck = document.getElementById('deck');
const extraSlides = `

<!-- S9: LICITAÇÕES -->
<div class="slide" data-slide="8">
  <div class="tag" style="background:rgba(245,158,11,0.06);color:var(--amber);border:1px solid rgba(245,158,11,0.12);">
    <svg viewBox="0 0 24 24" style="width:12px;height:12px;stroke:var(--amber);fill:none;stroke-width:2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/></svg>
    Inteligência em Compras Públicas
  </div>
  <h1 class="title sm">Licitações <span class="c-amber">Inteligentes</span></h1>
  <p class="subtitle" style="font-size:13px;">Integração com PNCP. Download automático de editais, extração de texto PDF e análise IA categorizada.</p>
  <div class="grid-2">
    <div style="display:flex;flex-direction:column;gap:10px;">
      <div class="fcard"><div style="display:flex;align-items:center;gap:8px;"><div class="ico ico-sm" style="background:rgba(16,185,129,0.08);color:var(--green);"><svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg></div><div><h3 style="font-size:11px;font-weight:800;margin:0;">Download Automático</h3><p style="font-size:9px;color:var(--muted);margin:0;">Baixa editais PDF direto do PNCP e extrai texto completo para análise.</p></div></div></div>
      <div class="fcard"><div style="display:flex;align-items:center;gap:8px;"><div class="ico ico-sm" style="background:rgba(139,92,246,0.08);color:var(--purple);"><svg viewBox="0 0 24 24"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2zM22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg></div><div><h3 style="font-size:11px;font-weight:800;margin:0;">Análise por Categoria</h3><p style="font-size:9px;color:var(--muted);margin:0;">IA categoriza exigências: Jurídica, Fiscal, Técnica, Econômica e Proposta.</p></div></div></div>
      <div class="fcard"><div style="display:flex;align-items:center;gap:8px;"><div class="ico ico-sm" style="background:rgba(245,158,11,0.08);color:var(--amber);"><svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg></div><div><h3 style="font-size:11px;font-weight:800;margin:0;">Recomendação IA</h3><p style="font-size:9px;color:var(--muted);margin:0;">Classificação automática: Participar, Avaliar ou Descartar com índice de viabilidade.</p></div></div></div>
    </div>
    <div class="mock" style="height:auto;">
      <div class="mock-bar"><div class="mock-dot" style="background:#ef4444;"></div><div class="mock-dot" style="background:#f59e0b;"></div><div class="mock-dot" style="background:#10b981;"></div><span style="font-size:8px;color:var(--muted);margin-left:6px;">Radar Licitações</span></div>
      <div style="padding:10px;">
        <div style="display:flex;gap:6px;margin-bottom:8px;">
          <div style="flex:1;padding:5px 8px;background:var(--surface);border-radius:5px;font-size:8px;color:var(--muted);border:1px solid var(--border);">Buscar licitações...</div>
          <div style="padding:5px 8px;background:var(--surface);border-radius:5px;font-size:7px;color:var(--text2);border:1px solid var(--border);font-weight:600;">UF: Todas</div>
          <div style="padding:5px 8px;background:var(--surface);border-radius:5px;font-size:7px;color:var(--text2);border:1px solid var(--border);font-weight:600;">Modalidade</div>
        </div>
        <div style="padding:8px;background:var(--card2);border-radius:6px;border:1px solid var(--border);margin-bottom:6px;">
          <div style="font-size:9px;font-weight:700;">Aquisição de Equipamentos de TI</div>
          <div style="font-size:7px;color:var(--muted);margin:3px 0;">Prefeitura Municipal de São Paulo · Pregão Eletrônico</div>
          <div style="display:flex;gap:4px;align-items:center;"><span style="font-size:8px;font-weight:800;color:var(--green);">R$ 2.450.000</span><span style="font-size:7px;padding:2px 6px;border-radius:4px;background:rgba(16,185,129,0.1);color:var(--green);font-weight:700;">Participar</span></div>
        </div>
        <div style="padding:8px;background:var(--card2);border-radius:6px;border:1px solid var(--border);margin-bottom:6px;">
          <div style="font-size:9px;font-weight:700;">Serviços de Consultoria em Gestão</div>
          <div style="font-size:7px;color:var(--muted);margin:3px 0;">Governo do Estado do RS · Concorrência</div>
          <div style="display:flex;gap:4px;align-items:center;"><span style="font-size:8px;font-weight:800;color:var(--amber);">R$ 890.000</span><span style="font-size:7px;padding:2px 6px;border-radius:4px;background:rgba(245,158,11,0.1);color:var(--amber);font-weight:700;">Avaliar</span></div>
        </div>
        <div style="padding:8px;background:var(--card2);border-radius:6px;border:1px solid var(--border);">
          <div style="font-size:9px;font-weight:700;">Fornecimento de Material de Escritório</div>
          <div style="font-size:7px;color:var(--muted);margin:3px 0;">Universidade Federal do PR · Dispensa</div>
          <div style="display:flex;gap:4px;align-items:center;"><span style="font-size:8px;font-weight:800;color:var(--text2);">R$ 45.000</span><span style="font-size:7px;padding:2px 6px;border-radius:4px;background:rgba(239,68,68,0.1);color:var(--red);font-weight:700;">Descartar</span></div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- S10: CAMPANHAS -->
<div class="slide" data-slide="9">
  <div class="tag" style="background:rgba(236,72,153,0.06);color:var(--pink);border:1px solid rgba(236,72,153,0.12);">
    <svg viewBox="0 0 24 24" style="width:12px;height:12px;stroke:var(--pink);fill:none;stroke-width:2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
    Marketing Automatizado
  </div>
  <h1 class="title sm">Campanhas <span class="c-pink">Instagram</span></h1>
  <p class="subtitle" style="font-size:13px;">Pipeline completo: do briefing à publicação. Criativo, legenda e análise gerados por IA com aprovação por etapa.</p>
  <div class="pipeline">
    <div class="pipe" style="border-color:rgba(139,92,246,0.2);"><div class="ico ico-sm" style="background:rgba(139,92,246,0.08);color:var(--purple);margin:0 auto;"><svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/></svg></div><div class="pipe-label c-purple" style="margin-top:6px;">Briefing</div></div>
    <div class="pipe-arrow"><svg viewBox="0 0 24 24" style="stroke:var(--muted);fill:none;width:14px;height:14px;stroke-width:2;"><path d="M5 12h14M12 5l7 7-7 7"/></svg></div>
    <div class="pipe" style="border-color:rgba(236,72,153,0.2);"><div class="ico ico-sm" style="background:rgba(236,72,153,0.08);color:var(--pink);margin:0 auto;"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg></div><div class="pipe-label c-pink" style="margin-top:6px;">Criativo IA</div></div>
    <div class="pipe-arrow"><svg viewBox="0 0 24 24" style="stroke:var(--muted);fill:none;width:14px;height:14px;stroke-width:2;"><path d="M5 12h14M12 5l7 7-7 7"/></svg></div>
    <div class="pipe" style="border-color:rgba(6,182,212,0.2);"><div class="ico ico-sm" style="background:rgba(6,182,212,0.08);color:var(--cyan);margin:0 auto;"><svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></div><div class="pipe-label c-cyan" style="margin-top:6px;">Legenda IA</div></div>
    <div class="pipe-arrow"><svg viewBox="0 0 24 24" style="stroke:var(--muted);fill:none;width:14px;height:14px;stroke-width:2;"><path d="M5 12h14M12 5l7 7-7 7"/></svg></div>
    <div class="pipe" style="border-color:rgba(16,185,129,0.2);"><div class="ico ico-sm" style="background:rgba(16,185,129,0.08);color:var(--green);margin:0 auto;"><svg viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg></div><div class="pipe-label c-green" style="margin-top:6px;">Aprovação</div></div>
    <div class="pipe-arrow"><svg viewBox="0 0 24 24" style="stroke:var(--muted);fill:none;width:14px;height:14px;stroke-width:2;"><path d="M5 12h14M12 5l7 7-7 7"/></svg></div>
    <div class="pipe" style="border-color:rgba(245,158,11,0.2);"><div class="ico ico-sm" style="background:rgba(245,158,11,0.08);color:var(--amber);margin:0 auto;"><svg viewBox="0 0 24 24"><path d="M18 20V10M12 20V4M6 20v-6"/></svg></div><div class="pipe-label c-amber" style="margin-top:6px;">Tráfego</div></div>
    <div class="pipe-arrow"><svg viewBox="0 0 24 24" style="stroke:var(--muted);fill:none;width:14px;height:14px;stroke-width:2;"><path d="M5 12h14M12 5l7 7-7 7"/></svg></div>
    <div class="pipe" style="border-color:rgba(59,130,246,0.2);"><div class="ico ico-sm" style="background:rgba(59,130,246,0.08);color:var(--blue);margin:0 auto;"><svg viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg></div><div class="pipe-label c-blue" style="margin-top:6px;">Publicar</div></div>
  </div>
</div>

<!-- S11: MULTICANAL -->
<div class="slide" data-slide="10">
  <div class="tag" style="background:rgba(16,185,129,0.06);color:var(--green);border:1px solid rgba(16,185,129,0.12);">
    <svg viewBox="0 0 24 24" style="width:12px;height:12px;stroke:var(--green);fill:none;stroke-width:2"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
    Comunicação
  </div>
  <h1 class="title sm">Atendimento <span class="c-green">24/7</span> em todos os canais</h1>
  <p class="subtitle" style="font-size:13px;">Seus agentes atendem automaticamente em todos os canais. Monitor em tempo real com escalonamento para humanos.</p>
  <div class="grid-3" style="max-width:780px;">
    <div class="fcard" style="border-color:rgba(16,185,129,0.2);text-align:center;">
      <div class="ico ico-md" style="background:rgba(16,185,129,0.08);color:var(--green);margin:0 auto;"><svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg></div>
      <h3>WhatsApp Business</h3><p>Bots com templates, catálogo e mídia via Evolution API.</p>
    </div>
    <div class="fcard" style="border-color:rgba(59,130,246,0.2);text-align:center;">
      <div class="ico ico-md" style="background:rgba(59,130,246,0.08);color:var(--blue);margin:0 auto;"><svg viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg></div>
      <h3>Telegram Bots</h3><p>Múltiplos bots com webhook e fluxos independentes.</p>
    </div>
    <div class="fcard" style="border-color:rgba(236,72,153,0.2);text-align:center;">
      <div class="ico ico-md" style="background:rgba(236,72,153,0.08);color:var(--pink);margin:0 auto;"><svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/></svg></div>
      <h3>Instagram DM</h3><p>Respostas automáticas via integração Meta Business.</p>
    </div>
    <div class="fcard" style="border-color:rgba(6,182,212,0.2);text-align:center;">
      <div class="ico ico-md" style="background:rgba(6,182,212,0.08);color:var(--cyan);margin:0 auto;"><svg viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M22 6l-10 7L2 6"/></svg></div>
      <h3>Email</h3><p>Gmail integrado com leitura, resposta e classificação IA.</p>
    </div>
    <div class="fcard" style="border-color:rgba(139,92,246,0.2);text-align:center;">
      <div class="ico ico-md" style="background:rgba(139,92,246,0.08);color:var(--purple);margin:0 auto;"><svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg></div>
      <h3>Chat Web</h3><p>Widget embeddable no seu site com identidade visual.</p>
    </div>
    <div class="fcard" style="border-color:rgba(245,158,11,0.2);text-align:center;">
      <div class="ico ico-md" style="background:rgba(245,158,11,0.08);color:var(--amber);margin:0 auto;"><svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></div>
      <h3>Monitor</h3><p>Supervisão em tempo real de todas as conversas ativas.</p>
    </div>
  </div>
</div>

<!-- S12: VOICE -->
<div class="slide" data-slide="11">
  <div class="tag" style="background:rgba(239,68,68,0.06);color:var(--red);border:1px solid rgba(239,68,68,0.12);">
    <svg viewBox="0 0 24 24" style="width:12px;height:12px;stroke:var(--red);fill:none;stroke-width:2"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8"/></svg>
    Identidade Sonora
  </div>
  <h1 class="title sm">Voice V2 — <span class="c-red">voz natural</span></h1>
  <p class="subtitle" style="font-size:13px;">Biblioteca de vozes, clonagem personalizada, configuração por canal e suporte a 5+ idiomas.</p>
  <div class="grid-2" style="max-width:800px;">
    <div style="display:flex;flex-direction:column;gap:10px;">
      <div class="fcard"><div style="display:flex;align-items:center;gap:8px;"><div class="ico ico-sm" style="background:rgba(139,92,246,0.08);color:var(--purple);"><svg viewBox="0 0 24 24"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></div><div><h3 style="font-size:11px;font-weight:800;margin:0;">Biblioteca de Vozes</h3><p style="font-size:9px;color:var(--muted);margin:0;">50+ vozes nativas em Português, Inglês, Espanhol, Francês e Alemão.</p></div></div></div>
      <div class="fcard"><div style="display:flex;align-items:center;gap:8px;"><div class="ico ico-sm" style="background:rgba(239,68,68,0.08);color:var(--red);"><svg viewBox="0 0 24 24"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/></svg></div><div><h3 style="font-size:11px;font-weight:800;margin:0;">Clonagem de Voz</h3><p style="font-size:9px;color:var(--muted);margin:0;">Clone qualquer voz com uma amostra de áudio. Seu agente fala com a sua voz.</p></div></div></div>
      <div class="fcard"><div style="display:flex;align-items:center;gap:8px;"><div class="ico ico-sm" style="background:rgba(6,182,212,0.08);color:var(--cyan);"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33"/></svg></div><div><h3 style="font-size:11px;font-weight:800;margin:0;">Configuração por Canal</h3><p style="font-size:9px;color:var(--muted);margin:0;">Voz diferente para Chat, Telegram, WhatsApp. Ajuste velocidade e estabilidade.</p></div></div></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:6px;">
      <div style="display:flex;gap:4px;">
        <div style="padding:4px 10px;border-radius:5px;background:rgba(139,92,246,0.1);font-size:8px;font-weight:700;color:var(--purple);">Biblioteca</div>
        <div style="padding:4px 10px;border-radius:5px;font-size:8px;font-weight:600;color:var(--text2);">Por Canal</div>
        <div style="padding:4px 10px;border-radius:5px;font-size:8px;font-weight:600;color:var(--text2);">Clonagem</div>
        <div style="padding:4px 10px;border-radius:5px;font-size:8px;font-weight:600;color:var(--text2);">Ajustes</div>
      </div>
      <div style="background:var(--card);border:1px solid var(--border);border-radius:8px;padding:8px;display:flex;flex-direction:column;gap:4px;">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:var(--surface);border-radius:5px;"><div><span style="font-size:9px;font-weight:700;">Sofia</span><span style="font-size:7px;color:var(--muted);margin-left:6px;">Português · Feminino</span></div><span style="font-size:7px;padding:2px 6px;border-radius:4px;background:rgba(16,185,129,0.1);color:var(--green);font-weight:700;">Nativa</span></div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:var(--surface);border-radius:5px;"><div><span style="font-size:9px;font-weight:700;">Marcus</span><span style="font-size:7px;color:var(--muted);margin-left:6px;">Português · Masculino</span></div><span style="font-size:7px;padding:2px 6px;border-radius:4px;background:rgba(16,185,129,0.1);color:var(--green);font-weight:700;">Nativa</span></div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:var(--surface);border-radius:5px;"><div><span style="font-size:9px;font-weight:700;">Emily</span><span style="font-size:7px;color:var(--muted);margin-left:6px;">English · Female</span></div><span style="font-size:7px;padding:2px 6px;border-radius:4px;background:rgba(16,185,129,0.1);color:var(--green);font-weight:700;">Nativa</span></div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:var(--surface);border-radius:5px;"><div><span style="font-size:9px;font-weight:700;">Carlos</span><span style="font-size:7px;color:var(--muted);margin-left:6px;">Español · Masculino</span></div><span style="font-size:7px;padding:2px 6px;border-radius:4px;background:rgba(16,185,129,0.1);color:var(--green);font-weight:700;">Nativa</span></div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;background:rgba(139,92,246,0.04);border:1px solid rgba(139,92,246,0.1);border-radius:5px;"><div><span style="font-size:9px;font-weight:700;">Minha Voz</span><span style="font-size:7px;color:var(--muted);margin-left:6px;">Clonada · Custom</span></div><span style="font-size:7px;padding:2px 6px;border-radius:4px;background:rgba(139,92,246,0.1);color:var(--purple);font-weight:700;">Clonada</span></div>
      </div>
    </div>
  </div>
</div>

<!-- S13: PROVEDORES IA -->
<div class="slide" data-slide="12">
  <div class="tag" style="background:rgba(139,92,246,0.06);color:var(--purple);border:1px solid rgba(139,92,246,0.12);">
    <svg viewBox="0 0 24 24" style="width:12px;height:12px;stroke:var(--purple);fill:none;stroke-width:2"><path d="M12 2a4 4 0 014 4c0 1.95-1.4 3.57-3.25 3.92A3 3 0 0115 13v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2a3 3 0 012.25-3.08A4 4 0 018 6a4 4 0 014-4z"/><path d="M10 17v2a2 2 0 002 2h0a2 2 0 002-2v-2"/></svg>
    Multi-IA
  </div>
  <h1 class="title sm">O melhor <span class="gradient-text">modelo</span> para cada tarefa</h1>
  <p class="subtitle" style="font-size:13px;">Troque de provedor instantaneamente. IA local gratuita ou cloud para máxima performance. Sem vendor lock-in.</p>
  <div class="provs">
    <div class="prov"><div class="prov-badge" style="background:rgba(16,185,129,0.12);color:var(--green);">Gratuito</div><div class="ico ico-md" style="background:rgba(245,158,11,0.08);color:var(--amber);margin:0 auto 8px;"><svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg></div><div class="prov-name">Ollama</div><div class="prov-model">Local · Llama3, Gemma3</div></div>
    <div class="prov"><div class="ico ico-md" style="background:rgba(16,185,129,0.08);color:var(--green);margin:0 auto 8px;"><svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg></div><div class="prov-name">OpenAI</div><div class="prov-model">GPT-4o · GPT-4o mini</div></div>
    <div class="prov"><div class="ico ico-md" style="background:rgba(59,130,246,0.08);color:var(--blue);margin:0 auto 8px;"><svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div><div class="prov-name">Google Gemini</div><div class="prov-model">1.5 Pro · 1.5 Flash</div></div>
    <div class="prov"><div class="ico ico-md" style="background:rgba(245,158,11,0.08);color:var(--amber);margin:0 auto 8px;"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></svg></div><div class="prov-name">Anthropic Claude</div><div class="prov-model">3.5 Sonnet · 3 Opus</div></div>
    <div class="prov"><div class="prov-badge" style="background:rgba(6,182,212,0.12);color:var(--cyan);">Ultra Fast</div><div class="ico ico-md" style="background:rgba(6,182,212,0.08);color:var(--cyan);margin:0 auto 8px;"><svg viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg></div><div class="prov-name">Groq</div><div class="prov-model">Llama3 70B · Mixtral</div></div>
  </div>
</div>

<!-- S14: INTEGRAÇÕES COMPLETAS -->
<div class="slide" data-slide="13">
  <div class="tag" style="background:rgba(6,182,212,0.06);color:var(--cyan);border:1px solid rgba(6,182,212,0.12);">
    <svg viewBox="0 0 24 24" style="width:12px;height:12px;stroke:var(--cyan);fill:none;stroke-width:2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/></svg>
    Ecossistema
  </div>
  <h1 class="title sm">Integrações e <span class="c-cyan">Infraestrutura</span></h1>
  <p class="subtitle" style="font-size:13px;">15+ serviços conectáveis, chaves criptografadas e admin completo com métricas de infraestrutura.</p>
  <div class="grid-2" style="max-width:860px;">
    <div style="display:flex;flex-direction:column;gap:4px;">
      <div style="font-size:9px;font-weight:800;color:var(--text2);margin-bottom:4px;text-transform:uppercase;letter-spacing:1px;">Mensageria</div>
      <div class="int-item"><div class="ico ico-sm" style="background:rgba(16,185,129,0.08);color:var(--green);"><svg viewBox="0 0 24 24"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg></div><div><div class="int-name">WhatsApp Business</div><div class="int-desc">Evolution API · Templates · Catálogo</div></div><div class="int-status" style="background:rgba(16,185,129,0.1);color:var(--green);">Conectado</div></div>
      <div class="int-item"><div class="ico ico-sm" style="background:rgba(59,130,246,0.08);color:var(--blue);"><svg viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg></div><div><div class="int-name">Telegram Bot API</div><div class="int-desc">Multi-bot · Webhooks · Mídia</div></div><div class="int-status" style="background:rgba(16,185,129,0.1);color:var(--green);">Conectado</div></div>
      <div class="int-item"><div class="ico ico-sm" style="background:rgba(236,72,153,0.08);color:var(--pink);"><svg viewBox="0 0 24 24"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="5"/></svg></div><div><div class="int-name">Instagram Business</div><div class="int-desc">DM · Stories · Feed · Reels</div></div><div class="int-status" style="background:rgba(16,185,129,0.1);color:var(--green);">Conectado</div></div>
      <div style="font-size:9px;font-weight:800;color:var(--text2);margin:8px 0 4px;text-transform:uppercase;letter-spacing:1px;">Provedores IA</div>
      <div class="int-item"><div class="ico ico-sm" style="background:rgba(16,185,129,0.08);color:var(--green);"><svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5z"/></svg></div><div><div class="int-name">OpenAI</div><div class="int-desc">GPT-4o · GPT-4o mini · Embeddings</div></div><div class="int-status" style="background:rgba(16,185,129,0.1);color:var(--green);">Ativo</div></div>
      <div class="int-item"><div class="ico ico-sm" style="background:rgba(59,130,246,0.08);color:var(--blue);"><svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div><div><div class="int-name">Google Gemini</div><div class="int-desc">Gemini 1.5 Pro · 1.5 Flash</div></div><div class="int-status" style="background:rgba(16,185,129,0.1);color:var(--green);">Ativo</div></div>
      <div class="int-item"><div class="ico ico-sm" style="background:rgba(245,158,11,0.08);color:var(--amber);"><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/></svg></div><div><div class="int-name">Anthropic Claude</div><div class="int-desc">Claude 3.5 Sonnet · 3 Opus</div></div><div class="int-status" style="background:rgba(16,185,129,0.1);color:var(--green);">Ativo</div></div>
      <div class="int-item"><div class="ico ico-sm" style="background:rgba(6,182,212,0.08);color:var(--cyan);"><svg viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg></div><div><div class="int-name">Groq</div><div class="int-desc">Llama3 70B · Ultra Fast</div></div><div class="int-status" style="background:rgba(16,185,129,0.1);color:var(--green);">Ativo</div></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:4px;">
      <div style="font-size:9px;font-weight:800;color:var(--text2);margin-bottom:4px;text-transform:uppercase;letter-spacing:1px;">Google Workspace</div>
      <div class="int-item"><div class="ico ico-sm" style="background:rgba(239,68,68,0.08);color:var(--red);"><svg viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><path d="M22 6l-10 7L2 6"/></svg></div><div><div class="int-name">Gmail</div><div class="int-desc">Leitura · Envio · Classificação</div></div><div class="int-status" style="background:rgba(16,185,129,0.1);color:var(--green);">Conectado</div></div>
      <div class="int-item"><div class="ico ico-sm" style="background:rgba(59,130,246,0.08);color:var(--blue);"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg></div><div><div class="int-name">Google Calendar</div><div class="int-desc">Eventos · Agendamentos · Lembretes</div></div><div class="int-status" style="background:rgba(16,185,129,0.1);color:var(--green);">Conectado</div></div>
      <div style="font-size:9px;font-weight:800;color:var(--text2);margin:8px 0 4px;text-transform:uppercase;letter-spacing:1px;">Voz & Pagamentos</div>
      <div class="int-item"><div class="ico ico-sm" style="background:rgba(139,92,246,0.08);color:var(--purple);"><svg viewBox="0 0 24 24"><path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/><path d="M19 10v2a7 7 0 01-14 0v-2"/></svg></div><div><div class="int-name">ElevenLabs</div><div class="int-desc">TTS Premium · Clonagem</div></div><div class="int-status" style="background:rgba(16,185,129,0.1);color:var(--green);">Ativo</div></div>
      <div class="int-item"><div class="ico ico-sm" style="background:rgba(239,68,68,0.08);color:var(--red);"><svg viewBox="0 0 24 24"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></div><div><div class="int-name">Kokoro TTS</div><div class="int-desc">Vozes locais · Zero custo</div></div><div class="int-status" style="background:rgba(16,185,129,0.1);color:var(--green);">Ativo</div></div>
      <div class="int-item"><div class="ico ico-sm" style="background:rgba(6,182,212,0.08);color:var(--cyan);"><svg viewBox="0 0 24 24"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/></svg></div><div><div class="int-name">Mercado Pago</div><div class="int-desc">Cobranças · Checkout · Pix</div></div><div class="int-status" style="background:rgba(16,185,129,0.1);color:var(--green);">Conectado</div></div>
      <div style="font-size:9px;font-weight:800;color:var(--text2);margin:8px 0 4px;text-transform:uppercase;letter-spacing:1px;">Infraestrutura</div>
      <div class="int-item"><div class="ico ico-sm" style="background:rgba(139,92,246,0.08);color:var(--purple);"><svg viewBox="0 0 24 24"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg></div><div><div class="int-name">PostgreSQL / Redis</div><div class="int-desc">Database · Cache · Filas</div></div><div class="int-status" style="background:rgba(16,185,129,0.1);color:var(--green);">Online</div></div>
      <div class="int-item"><div class="ico ico-sm" style="background:rgba(245,158,11,0.08);color:var(--amber);"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6v6H9z"/></svg></div><div><div class="int-name">MCP Servers</div><div class="int-desc">Extensões de ferramentas · APIs</div></div><div class="int-status" style="background:rgba(245,158,11,0.1);color:var(--amber);">Config</div></div>
    </div>
  </div>
</div>

<!-- S15: CTA -->
<div class="slide" data-slide="14">
  <h1 class="title" style="font-size:48px;">Comece a <span class="gradient-text">automatizar</span><br>com IA hoje</h1>
  <p class="subtitle" style="font-size:16px;color:var(--text);opacity:0.55;margin-bottom:36px;">18 módulos. 5+ provedores de IA. Comunicação multicanal. Tudo em um único painel.</p>
  <button class="cta">
    <svg viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
    Agendar Demonstração
  </button>
  <div style="margin-top:48px;display:flex;align-items:center;gap:10px;opacity:0.3;">
    <div style="width:28px;height:28px;border-radius:7px;background:linear-gradient(135deg,var(--purple),var(--cyan));display:flex;align-items:center;justify-content:center;">
      <svg viewBox="0 0 24 24" style="width:14px;height:14px;stroke:white;fill:none;stroke-width:2;"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
    </div>
    <span style="font-size:13px;font-weight:800;">NEXUS<span style="color:var(--purple);">.IA</span></span>
  </div>
</div>
`;

// Insert before closing deck div
deck.insertAdjacentHTML('beforeend', extraSlides);
