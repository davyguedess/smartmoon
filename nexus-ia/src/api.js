/**
 * Smart Moon — API Client (Protocol 1: Cookie HttpOnly Session)
 *
 * Tokens are NEVER stored in localStorage.
 * Cookies are sent automatically by the browser (credentials: 'include').
 * Auto-refresh: on 401, tries /auth/refresh once. If that fails, redirects to login.
 * Impersonation: admin can temporarily act as a user via sessionStorage temp token.
 */

const BASE_URL = import.meta.env.VITE_API_URL || ''

// ── Impersonation helpers ──────────────────────────
export const impersonation = {
  start(token, userName, userEmail) {
    sessionStorage.setItem('nexus_impersonate_token', token)
    sessionStorage.setItem('nexus_impersonate_name', userName)
    sessionStorage.setItem('nexus_impersonate_email', userEmail)
  },
  stop() {
    sessionStorage.removeItem('nexus_impersonate_token')
    sessionStorage.removeItem('nexus_impersonate_name')
    sessionStorage.removeItem('nexus_impersonate_email')
  },
  isActive() {
    return !!sessionStorage.getItem('nexus_impersonate_token')
  },
  getName() { return sessionStorage.getItem('nexus_impersonate_name') || '' },
  getEmail() { return sessionStorage.getItem('nexus_impersonate_email') || '' },
}

// ── Internal request helper ────────────────────────
let _isRefreshing = false
let _refreshQueue = []   // callbacks waiting for the refresh to finish

function _processQueue(error) {
  _refreshQueue.forEach(cb => error ? cb.reject(error) : cb.resolve())
  _refreshQueue = []
}

async function _tryRefresh() {
  // ⚠️ NEVER refresh during impersonation — it would use admin's HttpOnly cookie
  // and replace the impersonation context with the admin's company_id
  if (sessionStorage.getItem('nexus_impersonate_token')) {
    // Expire impersonation gracefully instead of leaking admin data
    sessionStorage.removeItem('nexus_impersonate_token')
    sessionStorage.removeItem('nexus_impersonate_name')
    sessionStorage.removeItem('nexus_impersonate_email')
    throw new Error('Sessão de impersonação expirada — retornando para admin')
  }
  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Sessão expirada — faça login novamente')
  return res
}

async function request(path, options = {}) {
  // Impersonation: if a temp user token is active, use it as Bearer
  const impToken = sessionStorage.getItem('nexus_impersonate_token')
  const extraHeaders = impToken
    ? { Authorization: `Bearer ${impToken}` }
    : {}

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: 'include',   // HttpOnly cookies sent automatically
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      ...extraHeaders,
      ...(options.headers || {}),
    },
  })

  // Guard: se o servidor retornou HTML (index.html do SPA) em vez de JSON,
  // isso significa que a sessão expirou e o Nginx/servidor redirecionou.
  // Tratamos como 401 para ativar o fluxo de refresh/logout.
  const contentType = res.headers.get('Content-Type') || ''
  if (contentType.includes('text/html') && res.ok) {
    console.warn(`[API] Recebeu HTML em vez de JSON para ${path}. Possível redirecionamento de Nginx ou sessão expirada.`)
    
    // Recebemos HTML quando esperávamos JSON — sessão expirada ou rota inválida
    if (path !== '/auth/refresh' && path !== '/auth/login') {
      if (!_isRefreshing) {
        _isRefreshing = true
        try {
          console.log('[API] Tentando auto-refresh de sessão...')
          await _tryRefresh()
          _processQueue(null)
          _isRefreshing = false
          return request(path, options)
        } catch (e) {
          console.error('[API] Auto-refresh falhou:', e.message)
          _processQueue(e)
          _isRefreshing = false
          const isAdminPath = window.location.pathname.startsWith('/admin')
          const loginTarget = isAdminPath ? '/admin/login' : '/login'
          if (window.location.pathname !== loginTarget && window.location.pathname !== '/landing') {
            console.log(`[API] Redirecionando para ${loginTarget}`)
            window.location.href = loginTarget
          }
          throw new Error('Sessão expirada — faça login novamente')
        }
      }
    }
    throw new Error('Sessão expirada — faça login novamente')
  }

  // Auto-refresh on 401
  if (res.status === 401 && path !== '/auth/refresh' && path !== '/auth/login') {
    if (_isRefreshing) {
      // Queue this request until refresh resolves
      return new Promise((resolve, reject) => {
        _refreshQueue.push({ resolve, reject })
      }).then(() => request(path, options))
    }

    _isRefreshing = true
    try {
      await _tryRefresh()
      _processQueue(null)
      _isRefreshing = false
      return request(path, options)   // retry original request
    } catch (e) {
      _processQueue(e)
      _isRefreshing = false
      // /auth/me é só sondagem de sessão — quem chama decide (landing/login/admin).
      // Não forçar redirect aqui, senão o visitante anônimo nunca vê a landing.
      if (path !== '/auth/me') {
        const isAdminPath = window.location.pathname.startsWith('/admin')
        const loginTarget = isAdminPath ? '/admin/login' : '/login'
        if (window.location.pathname !== loginTarget && window.location.pathname !== '/landing') {
          window.location.href = loginTarget
        }
      }
      throw e
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }))
    const detail = Array.isArray(err.detail)
      ? err.detail.map(d => d.msg || JSON.stringify(d)).join('; ')
      : (err.detail || err.error || `HTTP ${res.status}`)
    throw new Error(detail)
  }

  if (res.status === 204) return null
  return res.json()
}

// ── Auth ──────────────────────────────────────────
export const api = {
  // ── Generic REST helpers (used by Bids module and others) ──
  async get(path) { return request(path) },
  async post(path, body) { return request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) },
  async put(path, body) { return request(path, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) },
  async patch(path, body) { return request(path, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) },
  async delete(path) { return request(path, { method: 'DELETE' }) },
  // ── Raw request (for admin pages that build dynamic URLs) ──
  async request(path, options = {}) { return request(path, options) },
  // ── Binary download (CSV/arquivos) — request() faz res.json(), aqui precisamos do blob ──
  async getBlob(path) {
    const impToken = sessionStorage.getItem('nexus_impersonate_token')
    const res = await fetch(`${BASE_URL}${path}`, {
      credentials: 'include',
      headers: impToken ? { Authorization: `Bearer ${impToken}` } : {},
    })
    if (!res.ok) throw new Error(`Falha no download (HTTP ${res.status})`)
    return res.blob()
  },

  // ── Admin SmartMoon ───────────────────────────────
  async adminSmartmoonOverview() { return request('/admin/smartmoon/overview') },
  async adminSmartmoonLogs(params = {}) {
    const q = new URLSearchParams(params).toString()
    return request(`/admin/smartmoon/logs${q ? '?' + q : ''}`)
  },
  async adminSmartmoonSecurity() { return request('/admin/smartmoon/security') },

  async login(email, password) {
    const form = new URLSearchParams({ username: email, password })
    const res = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      credentials: 'include',   // cookies set by server
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || 'Credenciais inválidas')
    }
    return res.json()   // returns { message, user_id, role } — NO tokens
  },

  async logout() {
    try {
      await fetch(`${BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      })
    } finally {
      window.location.href = '/login'
    }
  },

  async me() { return request('/auth/me') },

  // ── Health ─────────────────────────────────────
  async health() {
    try {
      return await this.get('/health')
    } catch (err) {
      console.error('[API] Health check failed:', err)
      return { status: 'offline' }
    }
  },

  /* Ollama service is decommissioned */
  async ollamaModels() { return [] },
  async ollamaRunning() { return false },
  async ollamaStatus() { return { online: false } },
  async ollamaChat() { throw new Error('Ollama service disabled') },
  async ollamaCreateModel() { throw new Error('Ollama service disabled') },

  // ── Flows ──────────────────────────────────────
  async listFlows() { return request('/flows') },
  async getFlow(id) { return request(`/flows/${id}`) },
  async createFlow(body) { return request('/flows', { method: 'POST', body: JSON.stringify(body) }) },
  async updateFlow(id, body) { return request(`/flows/${id}`, { method: 'PUT', body: JSON.stringify(body) }) },
  async deleteFlow(id) { return request(`/flows/${id}`, { method: 'DELETE' }) },
  async publishFlow(id) { return request(`/flows/${id}/publish`, { method: 'POST' }) },
  async testFlow(id, payload = {}) { return request(`/flows/${id}/test`, { method: 'POST', body: JSON.stringify(payload) }) },

  // ── Executions ─────────────────────────────────
  async listExecutions(limit = 50) { return request(`/executions?limit=${limit}`) },
  async getExecution(id) { return request(`/executions/${id}`) },
  async getExecutionLogs(id) { return request(`/executions/${id}/logs`) },
  async cancelExecution(id) { return request(`/executions/${id}/cancel`, { method: 'POST' }) },

  // ── Settings — Profile ─────────────────────────
  async getProfile() { return request('/settings/profile') },
  async updateProfile(data) {
    return request('/settings/profile', { method: 'PUT', body: JSON.stringify(data) })
  },

  // ── Settings — API Keys ────────────────────────
  async getApiKeys() { return request('/settings/api-keys') },
  async saveApiKey(provider, key, label) {
    return request('/settings/api-keys', {
      method: 'POST',
      body: JSON.stringify({ provider, key, label }),
    })
  },
  async deleteApiKey(provider) {
    return request(`/settings/api-keys/${provider}`, { method: 'DELETE' })
  },

  // ── Agent Memory ───────────────────────────────
  async getAgentSessions() { return request('/agent/memory') },
  async getAgentMemory(sessionId, limit = 50) { return request(`/agent/memory/${sessionId}?limit=${limit}`) },
  async clearAgentMemory(sessionId) { return request(`/agent/memory/${sessionId}`, { method: 'DELETE' }) },
  async exportMemoryAsTraining(sessionId) { return request(`/agent/memory/${sessionId}/export`) },

  // ── System Metrics ─────────────────────────────
  async getSystemMetrics() {
    try { return await request('/system/metrics') }
    catch { return null }
  },

  // ── Generic request (for admin panel etc.) ─────
  request,

  // ── Admin Panel ───────────────────────────────
  async adminServerMetrics() { return request('/admin/server') },
  async adminFiles(path = '') { return request(`/admin/files?path=${encodeURIComponent(path)}`) },
  async adminFileContent(path) { return request(`/admin/files/content?path=${encodeURIComponent(path)}`) },
  async adminDatabaseTables() { return request('/admin/database') },
  async adminDatabaseData(table, limit = 50) { return request(`/admin/database/${table}?limit=${limit}`) },
  async adminDatabaseStats() { return request('/admin/database/stats/overview') },

  // ── Billing / Quota ────────────────────────────────────────────────────
  async getBillingPlan() { return request('/billing/plan') },
  async getBillingQuota() { return request('/billing/quota') },
  async listBillingPlans() { return request('/billing/plans') },

  // Convenience alias used by usePlan hook
  billing: {
    getQuota: () => request('/billing/quota'),
    getPlan: () => request('/billing/plan'),
    listPlans: () => request('/billing/plans'),
  },

  // ── Store — Skills ─────────────────────────────────────────────────────
  store: {
    // Skills
    listSkills: ({ category = '', search = '' } = {}) => {
      const p = new URLSearchParams()
      if (category) p.set('category', category)
      if (search) p.set('search', search)
      return request(`/store/skills?${p}`)
    },
    mySkills: () => request('/store/my-skills'),
    installSkill: (skillId) => request(`/store/skills/${skillId}/install`, { method: 'POST' }),
    uninstallSkill: (skillId) => request(`/store/skills/${skillId}`, { method: 'DELETE' }),

    // Agents
    listAgents: ({ category = '', search = '' } = {}) => {
      const p = new URLSearchParams()
      if (category) p.set('category', category)
      if (search) p.set('search', search)
      return request(`/store/agents?${p}`)
    },
    myAgents: () => request('/store/my-agents'),
    installAgent: (agentId) => request(`/store/agents/${agentId}/install`, { method: 'POST' }),
    uninstallAgent: (agentId) => request(`/store/agents/${agentId}`, { method: 'DELETE' }),

    // Credits
    getCredits: ({ page = 1 } = {}) => request(`/store/credits?page=${page}`),
  },

  // ── TTS / Voice Settings ──────────────────────────────────────────
  async ttsGetVoices() { return request('/tts/voices') },
  async ttsGetConfig() { return request('/tts/config') },
  async ttsUpdateConfig(voice) {
    return request('/tts/config', {
      method: 'PUT',
      body: JSON.stringify({ default_voice: voice })
    })
  },
  async ttsTest(text, voice = null) {
    return request('/tts/test', {
      method: 'POST',
      body: JSON.stringify({ text, voice })
    })
  },

  // ── Voice v2 ──────────────────────────────────────────
  async voiceV2ListProfiles() { return request('/voice/v2/profiles') },
  async voiceV2CreateProfile(data) {
    return request('/voice/v2/profiles', { method: 'POST', body: JSON.stringify(data) })
  },
  async voiceV2DeleteProfile(id) {
    return request(`/voice/v2/profiles/${id}`, { method: 'DELETE' })
  },
  async voiceV2UploadSample(profileId, formData) {
    const res = await fetch(`${BASE_URL}/voice/v2/samples/upload/${profileId}`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Erro no upload' }))
      throw new Error(err.detail || err.error || `HTTP ${res.status}`)
    }
    return res.json()
  },

  // ── Telegram Monitoring ───────────────────────────
  async telegramListConversations() { return request('/telegram/conversations') },
  async telegramGetStats() { return request('/telegram/stats') },
  async telegramGetConversation(id) { return request(`/telegram/conversations/${id}`) },
  async telegramGetMessages(id) { return request(`/telegram/conversations/${id}/messages`) },
  async telegramAnalyzeConversation(id) {
    return request(`/telegram/conversations/${id}/analyze`, { method: 'POST' })
  },
  async telegramHandoff(id) {
    return request(`/telegram/conversations/${id}/handoff`, { method: 'POST' })
  },
  async telegramResume(id) {
    return request(`/telegram/conversations/${id}/resume`, { method: 'POST' })
  },
  async telegramGetFeedback(id) {
    return request(`/telegram/conversations/${id}/feedback`)
  },
  async telegramAddFeedback(id, { content, rating }) {
    return request(`/telegram/conversations/${id}/feedback?content=${encodeURIComponent(content)}${rating ? `&rating=${rating}` : ''}`, { method: 'POST' })
  },

  // ── Agent Profiles ────────────────────────────────
  async agentListProfiles() { return request('/agent/profiles') },
  async agentCreateProfile(data) {
    return request('/agent/profiles', { method: 'POST', body: JSON.stringify(data) })
  },
  async agentUpdateProfile(id, data) {
    return request(`/agent/profiles/${id}`, { method: 'PUT', body: JSON.stringify(data) })
  },
  async agentDeleteProfile(id) {
    return request(`/agent/profiles/${id}`, { method: 'DELETE' })
  },
  async agentTrainChat(id, messages) {
    return request(`/agent/profiles/${id}/train-chat`, {
      method: 'POST', body: JSON.stringify({ messages })
    })
  },

  // ── Sales Agent Config ─────────────────────────────
  async agentGetSalesConfig(id) {
    return request(`/agent/profiles/${id}/sales-config`)
  },
  async agentSaveSalesConfig(id, data) {
    return request(`/agent/profiles/${id}/sales-config`, {
      method: 'PUT', body: JSON.stringify(data)
    })
  },
  async agentBuildPrompt(id) {
    return request(`/agent/profiles/${id}/build-prompt`, { method: 'POST' })
  },
  async agentNicheIntelligence(id) {
    return request(`/agent/profiles/${id}/niche-intelligence`, { method: 'POST' })
  },

  // ── Agent Memory ──────────────────────────────────
  async agentGetMemory(sessionId) { return request(`/agent/memory/${sessionId}`) },
  async agentAddMemory(data) {
    return request('/agent/memory', { method: 'POST', body: JSON.stringify(data) })
  },
  async agentClearMemory(sessionId) {
    return request(`/agent/memory/${sessionId}`, { method: 'DELETE' })
  },
  async agentExportMemory(sessionId) {
    return request(`/agent/memory/${sessionId}/export`)
  },

  // ── Agent Skills ──────────────────────────────────
  async agentSkillsCatalog() { return request('/agent/skills/catalog') },
  async agentGetSkills(agentId) { return request(`/agent/profiles/${agentId}/skills`) },
  async agentInstallSkill(agentId, data) {
    return request(`/agent/profiles/${agentId}/skills`, { method: 'POST', body: JSON.stringify(data) })
  },
  async agentToggleSkill(agentId, skillId, isActive) {
    return request(`/agent/profiles/${agentId}/skills/${skillId}`, {
      method: 'PATCH', body: JSON.stringify({ is_active: isActive })
    })
  },
  async agentRemoveSkill(agentId, skillId) {
    return request(`/agent/profiles/${agentId}/skills/${skillId}`, { method: 'DELETE' })
  },

  // ── Agent Telegram Bots ───────────────────────────
  async agentListTelegramBots(agentId) {
    return request(`/agent/profiles/${agentId}/telegram`)
  },
  async agentLinkTelegramBot(agentId, data) {
    return request(`/agent/profiles/${agentId}/telegram`, { method: 'POST', body: JSON.stringify(data) })
  },
  async agentTestTelegramToken(agentId, botToken) {
    return request(`/agent/profiles/${agentId}/telegram/test`, {
      method: 'POST', body: JSON.stringify({ bot_token: botToken })
    })
  },
  async agentUnlinkTelegramBot(agentId, integrationId) {
    return request(`/agent/profiles/${agentId}/telegram/${integrationId}`, { method: 'DELETE' })
  },

  // ── Custom Skills ─────────────────────────────────
  async agentListCustomSkills() { return request('/agent/skills/custom') },
  async agentCreateCustomSkill(data) {
    return request('/agent/skills/custom', { method: 'POST', body: JSON.stringify(data) })
  },
  async agentUpdateCustomSkill(id, data) {
    return request(`/agent/skills/custom/${id}`, { method: 'PUT', body: JSON.stringify(data) })
  },
  async agentDeleteCustomSkill(id) {
    return request(`/agent/skills/custom/${id}`, { method: 'DELETE' })
  },

  // ── Instagram Campaign Publisher ──────────────────
  async campaignList(params = {}) {
    const q = new URLSearchParams(params).toString()
    return request(`/campaign-posts${q ? '?' + q : ''}`)
  },
  async campaignCreate(data) {
    return request('/campaign-posts', { method: 'POST', body: JSON.stringify(data) })
  },
  async campaignGet(id) { return request(`/campaign-posts/${id}`) },
  async campaignUpdate(id, data) {
    return request(`/campaign-posts/${id}`, { method: 'PATCH', body: JSON.stringify(data) })
  },
  async campaignDelete(id) {
    return request(`/campaign-posts/${id}`, { method: 'DELETE' })
  },
  async campaignListAssets(id, type) {
    const q = type ? `?asset_type=${type}` : ''
    return request(`/campaign-posts/${id}/assets${q}`)
  },
  async campaignGenerateImage(id, promptOverride) {
    const q = promptOverride ? `?prompt_override=${encodeURIComponent(promptOverride)}` : ''
    return request(`/campaign-posts/${id}/assets/generate-image${q}`, { method: 'POST' })
  },
  async campaignGenerateCaption(id, data) {
    return request(`/campaign-posts/${id}/assets/generate-caption`, { method: 'POST', body: JSON.stringify(data) })
  },
  async campaignGenerateHashtags(id, data) {
    return request(`/campaign-posts/${id}/assets/generate-hashtags`, { method: 'POST', body: JSON.stringify(data) })
  },
  async campaignListApprovals(id) { return request(`/campaign-posts/${id}/approvals`) },
  async campaignApproveStep(id, step, note = '') {
    return request(`/campaign-posts/${id}/approvals/${step}/approve`, { method: 'POST', body: JSON.stringify({ decision_note: note }) })
  },
  async campaignRejectStep(id, step, note = '') {
    return request(`/campaign-posts/${id}/approvals/${step}/reject`, { method: 'POST', body: JSON.stringify({ decision_note: note }) })
  },
  async campaignGetStatus(id) { return request(`/campaign-posts/${id}/status`) },
  async campaignNextStep(id, targetStatus) {
    const q = targetStatus ? `?target_status=${targetStatus}` : ''
    return request(`/campaign-posts/${id}/next-step${q}`, { method: 'POST' })
  },
  async campaignGenerateAnalysis(id) {
    return request(`/campaign-posts/${id}/audience-analysis/generate`, { method: 'POST' })
  },
  async campaignGetAnalysis(id) { return request(`/campaign-posts/${id}/audience-analysis`) },
  async campaignGeneratePdf(id) {
    return request(`/campaign-posts/${id}/audience-analysis/generate-pdf`, { method: 'POST' })
  },
  async campaignPublish(id) {
    return request(`/campaign-posts/${id}/publish`, { method: 'POST' })
  },
  async campaignPublishLogs(id) { return request(`/campaign-posts/${id}/publish-logs`) },
  async campaignRequestRevision(id, reason) {
    const q = reason ? `?reason=${encodeURIComponent(reason)}` : ''
    return request(`/campaign-posts/${id}/request-revision${q}`, { method: 'POST' })
  },

  // ── Marketing Pro — Brand Kit ──────────────────────
  async marketingModules() { return request('/marketing/modules') },
  async brandKitGet() { return request('/marketing/brand-kit') },
  async brandKitSave(data) {
    return request('/marketing/brand-kit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
  },
  async brandKitGeneratePrompt() {
    return request('/marketing/brand-kit/generate-prompt', { method: 'POST' })
  },
  async brandKitUploadLogo(file) {
    const form = new FormData()
    form.append('file', file)
    return request('/marketing/brand-kit/logo', { method: 'POST', body: form })
  },

  // ── Marketing Pro — Admin ──────────────────────────
  async adminMarketingDashboard() { return request('/admin/marketing/dashboard') },
  async adminMarketingClients(params = {}) {
    const q = new URLSearchParams(params).toString()
    return request(`/admin/marketing/clients${q ? '?' + q : ''}`)
  },
  async adminMarketingModulesPatch(companyId, data) {
    return request(`/admin/marketing/clients/${companyId}/modules`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
  },
  async adminMarketingBrandKits(params = {}) {
    const q = new URLSearchParams(params).toString()
    return request(`/admin/marketing/brand-kits${q ? '?' + q : ''}`)
  },
  async adminMarketingStudioUsage(month = '') {
    return request(`/admin/marketing/studio-usage${month ? '?month=' + month : ''}`)
  },

  // ── Telegram Multi-Bot Management ─────────────────
  async telegramBotsList() { return request('/telegram/bots') },
  async telegramBotsAdd(data) {
    return request('/telegram/bots', { method: 'POST', body: JSON.stringify(data) })
  },
  async telegramBotsConnectFlow(botId, flowId) {
    return request(`/telegram/bots/${botId}/connect-flow`, {
      method: 'PATCH', body: JSON.stringify({ flow_id: flowId ?? null })
    })
  },
  async telegramBotsRemove(botId) {
    return request(`/telegram/bots/${botId}`, { method: 'DELETE' })
  },
  async telegramFlowsList() { return request('/flows') },

  // ── WhatsApp Multi-Number Management ──────────────
  async whatsappNumbersList() { return request('/whatsapp/numbers') },
  async whatsappNumbersAdd(data) {
    return request('/whatsapp/numbers', { method: 'POST', body: JSON.stringify(data) })
  },
  async whatsappNumbersConnectFlow(integrationId, flowId) {
    return request(`/whatsapp/numbers/${integrationId}/connect-flow?flow_id=${flowId ?? ''}`, { method: 'PATCH' })
  },
  async whatsappNumbersRemove(integrationId) {
    return request(`/whatsapp/numbers/${integrationId}`, { method: 'DELETE' })
  },
  async whatsappFlowsList() { return request('/flows') },
  async whatsappStats() { return request('/whatsapp/stats') },
  async whatsappConversations(status) {
    const q = status ? `?status=${status}` : ''
    return request(`/whatsapp/conversations${q}`)
  },
  async whatsappMessages(convId) { return request(`/whatsapp/conversations/${convId}/messages`) },
  async whatsappSendManual(convId, text) {
    return request(`/whatsapp/conversations/${convId}/send`, { method: 'POST', body: JSON.stringify({ text }) })
  },
  async whatsappHandoff(convId) {
    return request(`/whatsapp/conversations/${convId}/handoff`, { method: 'POST' })
  },
  async whatsappResume(convId) {
    return request(`/whatsapp/conversations/${convId}/resume`, { method: 'POST' })
  },

  // ── Connections Panel ────────────────────────────────
  async connectionsStatus() { return request('/connections/status') },
  async connectionsHealth() { return request('/connections/health') },

  // ── Z-API Management ───────────────────────────────
  async zapiList() { return request('/connections/zapi/numbers') },
  async zapiFlowsList() { return request('/flows') },
  async zapiAdd(data) {
    return request('/connections/zapi/numbers', { method: 'POST', body: JSON.stringify(data) })
  },
  async zapiStatus(integrationId) { return request(`/connections/zapi/${integrationId}/status`) },
  async zapiQrCode(integrationId) { return request(`/connections/zapi/${integrationId}/qr-code`) },
  async zapiRemove(integrationId) { return request(`/connections/zapi/${integrationId}`, { method: 'DELETE' }) },
  async zapiConnectFlow(integrationId, flowId) {
    return request(`/connections/zapi/${integrationId}/connect-flow?flow_id=${flowId ?? ''}`, { method: 'PATCH' })
  },
  async zapiCheckPhone(integrationId, phone) {
    return request(`/connections/zapi/${integrationId}/check-phone/${phone}`)
  },

  // ── SmartMoon Engine Management ──────────────────────
  async smartmoonList() { return request('/connections/smartmoon/instances') },
  async smartmoonCreate(data) {
    return request('/connections/smartmoon/instances', { method: 'POST', body: JSON.stringify(data) })
  },
  async smartmoonStatus(integrationId) { return request(`/connections/smartmoon/${integrationId}/status`) },
  async smartmoonQrCode(integrationId) { return request(`/connections/smartmoon/${integrationId}/qr`) },
  async smartmoonRestart(integrationId) {
    return request(`/connections/smartmoon/${integrationId}/restart`, { method: 'POST' })
  },
  async smartmoonRemove(integrationId) {
    return request(`/connections/smartmoon/${integrationId}`, { method: 'DELETE' })
  },
  async smartmoonConnectFlow(integrationId, flowId) {
    const fid = flowId != null ? flowId : ''
    return request(`/connections/smartmoon/${integrationId}/connect-flow?flow_id=${fid}`, { method: 'PATCH' })
  },

  // ── Agent Status ─────────────────────────────────────
  async agentStatusList() { return request('/agents/status') },
  async agentStatusUpdate(agentId, status) {
    return request(`/agents/${agentId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
  },
  async agentConnect(agentId, integrationId) {
    return request(`/agents/${agentId}/connect`, { method: 'PATCH', body: JSON.stringify({ integration_id: integrationId }) })
  },
  async agentDisconnect(agentId) {
    return request(`/agents/${agentId}/disconnect`, { method: 'PATCH' })
  },
  async agentMetrics(agentId) { return request(`/agents/${agentId}/metrics`) },

  // ── CRM WhatsApp ──────────────────────────────────────
  crm: {
    // Contacts
    listContacts: (params = {}) => {
      const q = new URLSearchParams(params).toString()
      return request(`/crm/contacts?${q}`)
    },
    createContact: (data) => request('/crm/contacts', { method: 'POST', body: JSON.stringify(data) }),
    updateContact: (id, data) => request(`/crm/contacts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    archiveContact: (id) => request(`/crm/contacts/${id}`, { method: 'DELETE' }),
    contactHistory: (id) => request(`/crm/contacts/${id}/history`),
    importCSV: async (file, tags = '') => {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`${BASE_URL}/crm/contacts/import-csv?default_tags=${encodeURIComponent(tags)}`, {
        method: 'POST',
        credentials: 'include',
        body: form,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro no upload' }))
        throw new Error(err.detail || err.error || `HTTP ${res.status}`)
      }
      return res.json()
    },

    // Tags
    listTags: () => request('/crm/tags'),
    createTag: (data) => request('/crm/tags', { method: 'POST', body: JSON.stringify(data) }),
    updateTag: (id, data) => request(`/crm/tags/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteTag: (id) => request(`/crm/tags/${id}`, { method: 'DELETE' }),

    // Operators
    listOperators: () => request('/crm/operators'),
    createOperator: (data) => request('/crm/operators', { method: 'POST', body: JSON.stringify(data) }),
    updateOperator: (id, data) => request(`/crm/operators/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

    // Quick Replies
    listQuickReplies: (category) => {
      const q = category ? `?category=${category}` : ''
      return request(`/crm/quick-replies${q}`)
    },
    createQuickReply: (data) => request('/crm/quick-replies', { method: 'POST', body: JSON.stringify(data) }),
    updateQuickReply: (id, data) => request(`/crm/quick-replies/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteQuickReply: (id) => request(`/crm/quick-replies/${id}`, { method: 'DELETE' }),

    // Messages
    sendMessage: (data) => request('/crm/messages/send', { method: 'POST', body: JSON.stringify(data) }),
    messageHistory: (contactId, page = 1) => request(`/crm/messages/history/${contactId}?page=${page}`),

    // Broadcasts
    listBroadcasts: (params = {}) => {
      const q = new URLSearchParams(params).toString()
      return request(`/crm/broadcasts?${q}`)
    },
    createBroadcast: (data) => request('/crm/broadcasts', { method: 'POST', body: JSON.stringify(data) }),
    updateBroadcast: (id, data) => request(`/crm/broadcasts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    startBroadcast: (id) => request(`/crm/broadcasts/${id}/start`, { method: 'POST' }),
    pauseBroadcast: (id) => request(`/crm/broadcasts/${id}/pause`, { method: 'POST' }),
    broadcastLogs: (id, params = {}) => {
      const q = new URLSearchParams(params).toString()
      return request(`/crm/broadcasts/${id}/logs?${q}`)
    },

    // Metrics
    metricsOverview: (days = 30) => request(`/crm/metrics/overview?days=${days}`),
    metricsOperator: (operatorId, days = 30) => request(`/crm/metrics/operator/${operatorId}?days=${days}`),
    metricsFunnel: (days = 30) => request(`/crm/metrics/funnel?days=${days}`),

    // ── Funil de vendas (pipeline) ──
    pipelineStages: () => request('/crm/pipeline/stages'),
    createStage: (data) => request('/crm/pipeline/stages', { method: 'POST', body: JSON.stringify(data) }),
    updateStage: (id, data) => request(`/crm/pipeline/stages/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteStage: (id) => request(`/crm/pipeline/stages/${id}`, { method: 'DELETE' }),
    pipelineBoard: () => request('/crm/pipeline/board'),
    moveContact: (id, stageId, dealValue) => request(`/crm/pipeline/contacts/${id}/stage`, { method: 'PUT', body: JSON.stringify({ stage_id: stageId, deal_value: dealValue }) }),
    assignContact: (id, operatorId) => request(`/crm/pipeline/contacts/${id}/assign`, { method: 'PUT', body: JSON.stringify({ operator_id: operatorId }) }),
    // Repasse de conversa (IA ↔ humano)
    handoffToHuman: (id) => request(`/crm/pipeline/contacts/${id}/handoff`, { method: 'POST' }),
    resumeAI: (id) => request(`/crm/pipeline/contacts/${id}/resume`, { method: 'POST' }),
    conversationMode: (id) => request(`/crm/pipeline/contacts/${id}/mode`),

    // ── Mídia no chat ──
    sendMedia: async (contactId, operatorId, file, caption = '') => {
      const impToken = sessionStorage.getItem('nexus_impersonate_token')
      const form = new FormData()
      form.append('contact_id', contactId)
      form.append('operator_id', operatorId)
      form.append('caption', caption)
      form.append('file', file)
      const res = await fetch(`${BASE_URL}/crm/messages/send-media`, {
        method: 'POST', credentials: 'include',
        headers: impToken ? { Authorization: `Bearer ${impToken}` } : {},
        body: form,
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro no envio' }))
        throw new Error(err.detail || err.error || `HTTP ${res.status}`)
      }
      return res.json()
    },

    // ── Recepção ──
    reception: () => request('/crm/reception'),
    pickup: (conversationId) => request(`/crm/reception/${conversationId}/pickup`, { method: 'POST' }),

    // ── Equipe (Fase 2) ──
    myOperator: () => request('/crm/operators/me'),
    listTeam: () => request('/crm/team'),
    invite: (email, role) => request('/crm/team/invite', { method: 'POST', body: JSON.stringify({ email, role }) }),
    revokeInvite: (id) => request(`/crm/team/invite/${id}`, { method: 'DELETE' }),
    updateMember: (operatorId, data) => request(`/crm/team/members/${operatorId}`, { method: 'PUT', body: JSON.stringify(data) }),
    inviteDetails: (token) => request(`/crm/team/invite/${token}`),
    acceptInvite: (data) => request('/crm/team/accept', { method: 'POST', body: JSON.stringify(data) }),
  },
}

// ── Admin API (superadmin-only cross-tenant endpoints) ─────────────────────
export const adminApi = {
  // ── Overview ──────────────────────────────────────────────────────────────
  /** Executive KPIs: total users, agents, executions, revenue */
  overview() { return request('/admin/overview') },

  // ── Users ─────────────────────────────────────────────────────────────────
  /** List all users across tenants. Supports ?page=&q= */
  listUsers({ page = 1, search = '' } = {}) {
    return request(`/admin/users?page=${page}&q=${encodeURIComponent(search)}`)
  },
  /** Get a single user with full usage + audit history */
  getUser(userId) { return request(`/admin/users/${userId}`) },
  /** Update the plan of a user/company */
  updateUserPlan(userId, plan) {
    return request(`/admin/users/${userId}/plan`, {
      method: 'PATCH',
      body: JSON.stringify({ plan }),
    })
  },

  // ── Agents ────────────────────────────────────────────────────────────────
  listAgents({ page = 1, search = '' } = {}) {
    return request(`/admin/agents?page=${page}&q=${encodeURIComponent(search)}`)
  },

  // ── Skills Store ──────────────────────────────────────────────────────────
  listSkills({ page = 1, search = '', category = '' } = {}) {
    return request(`/admin/skills?page=${page}&q=${encodeURIComponent(search)}&category=${encodeURIComponent(category)}`)
  },
  getSkill(id) { return request(`/admin/skills/${id}`) },
  createSkill(data) { return request('/admin/skills', { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } }) },
  updateSkill(id, data) { return request(`/admin/skills/${id}`, { method: 'PATCH', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } }) },
  deleteSkill(id) { return request(`/admin/skills/${id}`, { method: 'DELETE' }) },

  // ── Agent Store ───────────────────────────────────────────────────────────
  listAgentStore({ page = 1, search = '', category = '', source = '' } = {}) {
    return request(`/admin/agent-store?page=${page}&q=${encodeURIComponent(search)}&category=${encodeURIComponent(category)}&source=${source}`)
  },
  getAgentStore(id, source = 'platform') { return request(`/admin/agent-store/${id}?source=${source}`) },
  createAgentStore(data) { return request('/admin/agent-store', { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } }) },
  updateAgentStore(id, data) { return request(`/admin/agent-store/${id}`, { method: 'PATCH', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } }) },
  deleteAgentStore(id) { return request(`/admin/agent-store/${id}`, { method: 'DELETE' }) },

  // ── Credits ───────────────────────────────────────────────────────────────
  listCredits({ page = 1, search = '' } = {}) {
    return request(`/admin/credits?page=${page}&q=${encodeURIComponent(search)}`)
  },
  getCreditHistory(companyId) { return request(`/admin/credits/${companyId}/history`) },
  grantCredits(data) { return request('/admin/credits/grant', { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } }) },

  // ── Companies list (for selects) ──────────────────────────────────────────
  listCompanies() { return request('/admin/companies-list') },

  // ── Voice ─────────────────────────────────────────────────────────────────
  listVoiceProfiles({ page = 1 } = {}) {
    return request(`/admin/voice?page=${page}`)
  },

  // ── Campaigns ─────────────────────────────────────────────────────────────
  listCampaigns({ page = 1, search = '' } = {}) {
    return request(`/admin/campaigns?page=${page}&q=${encodeURIComponent(search)}`)
  },

  // ── Flows ─────────────────────────────────────────────────────────────────
  listFlows({ page = 1, search = '' } = {}) {
    return request(`/admin/flows?page=${page}&q=${encodeURIComponent(search)}`)
  },
  /** Full flow detail: nodes, executions, agents, integrations */
  getFlow(flowId) {
    return request(`/admin/flows/${flowId}`)
  },
  /** Permanently deletes a flow (admin override) */
  deleteFlow(flowId) {
    return request(`/admin/flows/${flowId}`, { method: 'DELETE' })
  },


  // ── Integrations ──────────────────────────────────────────────────────────
  listIntegrations({ page = 1, search = '' } = {}) {
    return request(`/admin/integrations?page=${page}&q=${encodeURIComponent(search)}`)
  },

  // ── Sales & Revenue ───────────────────────────────────────────────────────
  getSales({ page = 1, year, month } = {}) {
    const params = new URLSearchParams({ page })
    if (year) params.set('year', year)
    if (month) params.set('month', month)
    return request(`/admin/sales?${params}`)
  },

  // ── Plans CRUD ─────────────────────────────────────────────────────────────
  getPlans() { return request('/admin/plans') },
  createPlan(data) {
    return request('/admin/plans', { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } })
  },
  updatePlan(planId, data) {
    return request(`/admin/plans/${planId}`, { method: 'PATCH', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } })
  },
  togglePlan(planId) {
    return request(`/admin/plans/${planId}/toggle`, { method: 'PATCH' })
  },
  deletePlan(planId) {
    return request(`/admin/plans/${planId}`, { method: 'DELETE' })
  },
  getModules() { return request('/admin/plans/modules') },

  // ── Logs & Audit ──────────────────────────────────────────────────────────
  /** section: 'system' | 'executions' */
  getLogs({ page = 1, section = 'executions' } = {}) {
    return request(`/admin/logs?section=${section}&page=${page}`)
  },
  getAuditTrail({ page = 1, action = '' } = {}) {
    return request(`/admin/audit?page=${page}&action=${encodeURIComponent(action)}`)
  },

  // ── Health ────────────────────────────────────────────────────────────────
  getHealth() { return request('/admin/health') },

  // ── User Management ───────────────────────────────────────────────────────
  updateUser(userId, data) {
    return request(`/admin/users/${userId}`, { method: 'PATCH', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } })
  },
  changeUserPassword(userId, password) {
    return request(`/admin/users/${userId}/password`, { method: 'PATCH', body: JSON.stringify({ password }), headers: { 'Content-Type': 'application/json' } })
  },
  /** Impersonar um usuário — retorna um token temporário de 2h */
  impersonateUser(userId) {
    return request(`/admin/users/${userId}/impersonate`, { method: 'POST' })
  },
  deleteUser(userId) {
    return request(`/admin/users/${userId}`, { method: 'DELETE' })
  },
  toggleUser(userId) {
    return request(`/admin/users/${userId}/toggle`, { method: 'PATCH' })
  },

  // ── Platform Settings ─────────────────────────────────────────────────────
  getSettings() { return request('/admin/settings') },
  updateSmtp(data) {
    return request('/admin/settings/smtp', { method: 'PUT', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } })
  },
  updateTerms(data) {
    return request('/admin/settings/terms', { method: 'PUT', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } })
  },
  testSmtp() {
    return request('/admin/settings/smtp/test', { method: 'POST' })
  },

  // ── Plan Change ───────────────────────────────────────────────────────────
  changeUserPlan(userId, planId) {
    return request(`/admin/users/${userId}/plan`, { method: 'PATCH', body: JSON.stringify({ plan_id: planId }), headers: { 'Content-Type': 'application/json' } })
  },

  // ── Platform API Keys ─────────────────────────────────────────────────────
  getPlatformKeys(category) {
    const q = category ? `?category=${category}` : ''
    return request(`/admin/platform-keys${q}`)
  },
  savePlatformKey(data) {
    return request('/admin/platform-keys', { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } })
  },
  deletePlatformKey(provider) {
    return request(`/admin/platform-keys/${provider}`, { method: 'DELETE' })
  },
  testPlatformKey(provider) {
    return request(`/admin/platform-keys/${provider}/test`, { method: 'POST' })
  },
  saveModelCost(data) {
    return request('/admin/platform-keys/model-costs', { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } })
  },
  deleteModelCost(costId) {
    return request(`/admin/platform-keys/model-costs/${costId}`, { method: 'DELETE' })
  },
  getPlatformKeysStatus() {
    return request('/admin/platform-keys/status')
  },

  // ── SM Credit Packs (Admin) ───────────────────────────────────────────────
  listSmCreditPacks() {
    return request('/admin/sm-credit-packs')
  },
  saveSmCreditPack(data) {
    return request('/admin/sm-credit-packs', { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } })
  },
  deleteSmCreditPack(id) {
    return request(`/admin/sm-credit-packs/${id}`, { method: 'DELETE' })
  },
  listSmCreditPurchases({ page = 1, status = 'all', search = '' } = {}) {
    return request(`/admin/sm-credit-purchases?page=${page}&status_filter=${status}&q=${encodeURIComponent(search)}`)
  },

  // ── External APIs (APIs exclusivas por conta) ─────────────────────────────
  listExternalApis() {
    return request('/admin/external-apis')
  },
  createExternalApi(data) {
    return request('/admin/external-apis', { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } })
  },
  updateExternalApi(id, data) {
    return request(`/admin/external-apis/${id}`, { method: 'PUT', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } })
  },
  deleteExternalApi(id) {
    return request(`/admin/external-apis/${id}`, { method: 'DELETE' })
  },
  testExternalApi(id, action = null) {
    const q = action ? `?action=${action}` : ''
    return request(`/admin/external-apis/${id}/test${q}`, { method: 'POST' })
  },
  listExternalApiBindings(apiId) {
    return request(`/admin/external-apis/${apiId}/bindings`)
  },
  createExternalApiBinding(apiId, data) {
    return request(`/admin/external-apis/${apiId}/bindings`, { method: 'POST', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } })
  },
  updateExternalApiBinding(apiId, bindingId, data) {
    return request(`/admin/external-apis/${apiId}/bindings/${bindingId}`, { method: 'PUT', body: JSON.stringify(data), headers: { 'Content-Type': 'application/json' } })
  },
  deleteExternalApiBinding(apiId, bindingId) {
    return request(`/admin/external-apis/${apiId}/bindings/${bindingId}`, { method: 'DELETE' })
  },
}

// ── Public API (no auth) ───────────────────────────────────────
export async function getPublicPlans() {
  const res = await fetch(`${BASE_URL}/admin/plans/public`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) return { plans: [] }
  return res.json()
}

export async function getPublicBrand() {
  try {
    const res = await fetch(`${BASE_URL}/admin/settings/brand/public`, {
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return { platform_name: 'Smart Moon', primary_color: '#7c3aed', logo_url: '' }
    return res.json()
  } catch {
    return { platform_name: 'Smart Moon', primary_color: '#7c3aed', logo_url: '' }
  }
}

// Convenience: expose adminApi methods on the base api object too
api.admin = adminApi

// ── Polling hook helper ────────────────────────────
export function createPoller(fn, intervalMs = 3000) {
  let timer = null
  return {
    start() { fn(); timer = setInterval(fn, intervalMs) },
    stop() { clearInterval(timer) },
  }
}
