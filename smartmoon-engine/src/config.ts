/**
 * SmartMoon Engine — Configuration
 * 
 * All configurable parameters with sensible defaults.
 * Override via environment variables.
 */

export const config = {
  // ── Server ──────────────────────────────────
  port: parseInt(process.env.PORT || '3100', 10),
  apiKey: process.env.API_KEY || 'smartmoon-dev-key',

  // ── Redis (BullMQ + Session cache) ──────────
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379/3',

  // ── Webhook (Python backend) ────────────────
  webhookBaseUrl: process.env.WEBHOOK_BASE_URL || 'http://localhost:8000',

  // ── Sessions ────────────────────────────────
  sessionsDir: process.env.SESSIONS_DIR || '/data/sessions',

  // ── Media (shared volume with Python) ───────
  mediaDir: process.env.MEDIA_DIR || '/data/media',

  // ── Anti-Ban defaults ───────────────────────
  antiBan: {
    maxMessagesPerMinute: parseInt(process.env.MAX_MSG_PER_MIN || '8', 10),
    typingDelayMinMs: parseInt(process.env.TYPING_DELAY_MIN || '2000', 10),
    typingDelayMaxMs: parseInt(process.env.TYPING_DELAY_MAX || '6000', 10),
    onlinePresence: process.env.ONLINE_PRESENCE !== 'false',
    readReceiptDelayMs: parseInt(process.env.READ_RECEIPT_DELAY || '1500', 10),
  },

  // ── Baileys ─────────────────────────────────
  baileys: {
    // Do NOT sync message history — saves RAM and CPU on first connect
    syncFullHistory: false,
    // Browser identification — must match a recent Chrome version WhatsApp accepts
    browser: ['SmartMoon', 'Chrome', '124.0.0'] as [string, string, string],
    // Print QR in terminal (useful for debugging)
    printQRInTerminal: true,
  },

  // ── Logging ─────────────────────────────────
  logLevel: process.env.LOG_LEVEL || 'info',
};
