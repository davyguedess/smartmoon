/**
 * SmartMoon WhatsApp Engine — Main Server
 * 
 * Express HTTP + WebSocket server that powers the SmartMoon WhatsApp gateway.
 * 
 * Architecture:
 * - Express REST API (port 3100) — Instance CRUD + Message sending
 * - WebSocket (/ws/:instanceId) — Real-time QR codes + status updates
 * - BullMQ Worker — Anti-ban message queue processor
 * - Session Restore — Auto-reconnect saved sessions on boot
 * 
 * This service communicates ONLY with the Python backend (nexus_api)
 * via internal Docker network. It is NOT exposed to the internet.
 */

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import pino from 'pino';
import { config } from './config';
import { instanceRouter } from './api/instances';
import { messageRouter } from './api/messages';
import { manager } from './baileys/manager';
import { startWorker } from './queue/message-queue';

const logger = pino({ level: config.logLevel }).child({ module: 'server' });

// ── Express App ─────────────────────────────────────

const app = express();
app.use(express.json({ limit: '10mb' }));

// ── API Key Middleware ──────────────────────────────
// All requests must include X-API-Key header matching config.apiKey
app.use((req, res, next) => {
  // Skip health check
  if (req.path === '/health') return next();

  const apiKey = req.headers['x-api-key'];
  if (apiKey !== config.apiKey) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
});

// ── Routes ──────────────────────────────────────────

app.use('/instances', instanceRouter);
app.use('/messages', messageRouter);

// Health check (no auth required)
app.get('/health', (_req, res) => {
  const stats = manager.getStats();
  res.json({
    status: 'ok',
    engine: 'smartmoon',
    version: '1.0.0',
    uptime: process.uptime(),
    memory: {
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    },
    instances: stats,
  });
});

// ── HTTP Server ─────────────────────────────────────

const server = createServer(app);

// ── WebSocket Server ────────────────────────────────
// Connect to ws://host:3100/ws/{instanceId} for real-time QR + status

const wss = new WebSocketServer({ server });

wss.on('connection', (ws: WebSocket, req) => {
  // Only accept /ws/{instanceId} paths
  const url = req.url || '';
  if (!url.startsWith('/ws/')) {
    ws.close(4000, 'Use /ws/{instanceId}');
    return;
  }

  // Extract instance ID from URL: /ws/instance-123
  const instanceId = url.replace('/ws/', '');

  if (!instanceId) {
    ws.close(4000, 'Instance ID required in URL');
    return;
  }

  logger.info(`WebSocket connected for instance: ${instanceId}`);
  manager.registerWsClient(instanceId, ws);

  ws.on('close', () => {
    manager.removeWsClient(instanceId, ws);
    logger.debug(`WebSocket disconnected for instance: ${instanceId}`);
  });

  ws.on('error', () => {
    manager.removeWsClient(instanceId, ws);
  });
});

// ── Start Server ────────────────────────────────────

async function main() {
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  logger.info('  SmartMoon WhatsApp Engine v1.0.0');
  logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // 1. Start message queue worker
  startWorker();
  logger.info('✅ Message queue worker started');

  // 2. Restore saved sessions
  await manager.restoreSessions();
  logger.info('✅ Session restoration complete');

  // 3. Start HTTP + WebSocket server
  server.listen(config.port, '0.0.0.0', () => {
    logger.info(`✅ Server listening on port ${config.port}`);
    logger.info(`   REST API: http://0.0.0.0:${config.port}`);
    logger.info(`   WebSocket: ws://0.0.0.0:${config.port}/ws/{instanceId}`);
    logger.info(`   Health: http://0.0.0.0:${config.port}/health`);
  });
}

main().catch((err) => {
  logger.fatal({ error: err }, 'Failed to start SmartMoon Engine');
  process.exit(1);
});

// ── Graceful Shutdown ───────────────────────────────

process.on('SIGINT', async () => {
  logger.info('Shutting down gracefully...');
  server.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Shutting down gracefully...');
  server.close();
  process.exit(0);
});
