/**
 * SmartMoon Engine — Baileys Instance
 * 
 * Manages a single WhatsApp connection via Baileys.
 * Handles: QR generation, session persistence, message events,
 * connection state management, and media downloads.
 * 
 * Key design decisions:
 * - syncFullHistory: false → avoids RAM spike on connect
 * - Session saved to disk → survives container restarts
 * - Media saved to shared volume → Python reads file path, never Base64 over REST
 * - Connection status changes trigger webhook → Python DB always in sync
 */

import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  WASocket,
  BaileysEventMap,
  proto,
  downloadMediaMessage,
  getContentType,
  MessageUpsertType,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import * as fs from 'fs';
import * as path from 'path';
import pino from 'pino';
import * as QRCode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';
import * as mime from 'mime-types';
import { config } from '../config';

// ── Types ─────────────────────────────────────────────

export type InstanceStatus =
  | 'INITIALIZING'
  | 'QR_READY'
  | 'CONNECTING'
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'LOGGED_OUT'
  | 'ERROR';

export interface InstanceInfo {
  id: string;
  status: InstanceStatus;
  phoneNumber?: string;
  pushName?: string;
  qrCode?: string;        // Base64 data URI
  qrRaw?: string;         // Raw QR string
  qrGeneratedAt?: number; // Timestamp ms when QR was generated
  createdAt: Date;
  connectedAt?: Date;
  lastError?: string;
}

export interface WebhookConfig {
  url: string;             // Full URL: http://nexus_api:8000/webhook/smartmoon/{id}/receive
  statusUrl?: string;      // Status changes: http://nexus_api:8000/webhook/smartmoon/{id}/status
}

type StatusListener = (info: InstanceInfo) => void;

// ── Baileys Instance ──────────────────────────────────

export class BaileysInstance {
  public id: string;
  public status: InstanceStatus = 'INITIALIZING';
  public phoneNumber?: string;
  public pushName?: string;
  public qrCode?: string;
  public qrRaw?: string;
  public qrGeneratedAt?: number;
  public createdAt: Date;
  public connectedAt?: Date;
  public lastError?: string;

  private socket: WASocket | null = null;
  private webhook: WebhookConfig;
  private sessionDir: string;
  private mediaDir: string;
  private logger: pino.Logger;
  private statusListeners: StatusListener[] = [];
  private retryCount = 0;
  private maxRetries = 5;

  constructor(id: string, webhook: WebhookConfig) {
    this.id = id;
    this.webhook = webhook;
    this.createdAt = new Date();
    this.sessionDir = path.join(config.sessionsDir, id);
    this.mediaDir = path.join(config.mediaDir, id);
    this.logger = pino({ level: config.logLevel }).child({ instance: id });

    // Ensure directories exist
    fs.mkdirSync(this.sessionDir, { recursive: true });
    fs.mkdirSync(this.mediaDir, { recursive: true });
  }

  /**
   * Start the Baileys connection.
   * This will either restore an existing session or generate a QR code.
   */
  async start(): Promise<void> {
    this.logger.info('Starting Baileys instance...');
    this.setStatus('INITIALIZING');

    try {
      const { state, saveCreds } = await useMultiFileAuthState(this.sessionDir);

      // Fetch the current WA Web protocol version at runtime
      // This prevents 405 errors caused by stale hardcoded versions
      const { version } = await fetchLatestBaileysVersion();
      this.logger.info(`Using WhatsApp Web version: ${version.join('.')}`);

      const socket = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }) as any,
        browser: Browsers.macOS('Desktop'),
        syncFullHistory: config.baileys.syncFullHistory,
        generateHighQualityLinkPreview: false,
        markOnlineOnConnect: config.antiBan.onlinePresence,
      });

      this.socket = socket;

      // ── Event: Connection Update ──────────────────
      socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          this.qrRaw = qr;
          this.qrCode = await QRCode.toDataURL(qr);
          this.qrGeneratedAt = Date.now();
          this.setStatus('QR_READY');
          this.logger.info('QR code generated (fresh)');
        }

        if (connection === 'open') {
          this.retryCount = 0;
          this.connectedAt = new Date();
          this.phoneNumber = socket.user?.id?.split(':')[0] || undefined;
          this.pushName = socket.user?.name || undefined;
          this.qrCode = undefined;
          this.qrRaw = undefined;
          this.setStatus('CONNECTED');
          this.logger.info(`Connected as ${this.phoneNumber} (${this.pushName})`);

          // Notify Python backend
          await this.sendStatusWebhook('CONNECTED');
        }

        if (connection === 'close') {
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

          // Always clear stale QR on disconnect — a fresh one will be generated on reconnect
          this.qrCode = undefined;
          this.qrRaw = undefined;
          this.qrGeneratedAt = undefined;

          this.logger.warn(`Connection closed. Status: ${statusCode}. Reconnect: ${shouldReconnect}`);

          if (statusCode === DisconnectReason.loggedOut) {
            // User revoked access from their phone
            this.setStatus('LOGGED_OUT');
            await this.sendStatusWebhook('LOGGED_OUT');
            // Clean session files — user must scan QR again
            this.clearSession();
          } else if (shouldReconnect && this.retryCount < this.maxRetries) {
            this.retryCount++;
            this.setStatus('CONNECTING');
            this.logger.info(`Reconnecting... attempt ${this.retryCount}/${this.maxRetries}`);
            setTimeout(() => this.start(), Math.min(this.retryCount * 2000, 30000));
          } else {
            this.setStatus('DISCONNECTED');
            await this.sendStatusWebhook('DISCONNECTED');
          }
        }
      });

      // ── Event: Credentials Updated ────────────────
      socket.ev.on('creds.update', saveCreds);

      // ── Event: Messages Received ──────────────────
      socket.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
          if (msg.key.fromMe) continue; // Skip outbound echoes
          if (!msg.message) continue;   // Skip protocol messages

          await this.handleInboundMessage(msg);
        }
      });

    } catch (error) {
      this.lastError = (error as Error).message;
      this.setStatus('ERROR');
      this.logger.error({ error }, 'Failed to start Baileys instance');
    }
  }

  /**
   * Process an inbound message and forward to Python backend via webhook.
   * Media is saved to shared volume — only the file path is sent via REST.
   */
  private async handleInboundMessage(msg: proto.IWebMessageInfo): Promise<void> {
    const remoteJid = msg.key?.remoteJid || '';
    const phone = remoteJid.replace('@s.whatsapp.net', '').replace('@g.us', '');
    const isGroup = remoteJid.endsWith('@g.us');
    const messageId = msg.key?.id || uuidv4();
    const pushName = msg.pushName || '';
    const timestamp = msg.messageTimestamp
      ? typeof msg.messageTimestamp === 'number'
        ? msg.messageTimestamp * 1000
        : Number(msg.messageTimestamp) * 1000
      : Date.now();

    // Determine message type and content
    const contentType = getContentType(msg.message!);
    let msgType = 'text';
    let contentText = '';
    let mediaPath: string | undefined;
    let mediaMime: string | undefined;
    const contentJson: Record<string, any> = {};

    try {
      switch (contentType) {
        case 'conversation':
          msgType = 'text';
          contentText = msg.message!.conversation || '';
          break;

        case 'extendedTextMessage':
          msgType = 'text';
          contentText = msg.message!.extendedTextMessage?.text || '';
          break;

        case 'imageMessage': {
          msgType = 'image';
          const imgMsg = msg.message!.imageMessage!;
          contentText = imgMsg.caption || '';
          mediaMime = imgMsg.mimetype || 'image/jpeg';
          mediaPath = await this.downloadMedia(msg, messageId, mediaMime);
          contentJson.width = imgMsg.width;
          contentJson.height = imgMsg.height;
          break;
        }

        case 'audioMessage': {
          msgType = 'audio';
          const audMsg = msg.message!.audioMessage!;
          mediaMime = audMsg.mimetype || 'audio/ogg';
          mediaPath = await this.downloadMedia(msg, messageId, mediaMime);
          contentJson.seconds = audMsg.seconds;
          contentJson.ptt = audMsg.ptt; // Push-to-talk (voice note)
          break;
        }

        case 'videoMessage': {
          msgType = 'video';
          const vidMsg = msg.message!.videoMessage!;
          contentText = vidMsg.caption || '';
          mediaMime = vidMsg.mimetype || 'video/mp4';
          mediaPath = await this.downloadMedia(msg, messageId, mediaMime);
          contentJson.seconds = vidMsg.seconds;
          break;
        }

        case 'documentMessage': {
          msgType = 'document';
          const docMsg = msg.message!.documentMessage!;
          contentText = docMsg.fileName || '';
          mediaMime = docMsg.mimetype || 'application/octet-stream';
          mediaPath = await this.downloadMedia(msg, messageId, mediaMime);
          contentJson.fileName = docMsg.fileName;
          contentJson.pageCount = docMsg.pageCount;
          break;
        }

        case 'stickerMessage': {
          msgType = 'sticker';
          mediaMime = 'image/webp';
          mediaPath = await this.downloadMedia(msg, messageId, mediaMime);
          break;
        }

        case 'locationMessage': {
          msgType = 'location';
          const loc = msg.message!.locationMessage!;
          contentText = `📍 ${loc.name || 'Location'}: ${loc.degreesLatitude}, ${loc.degreesLongitude}`;
          contentJson.latitude = loc.degreesLatitude;
          contentJson.longitude = loc.degreesLongitude;
          contentJson.name = loc.name;
          contentJson.address = loc.address;
          break;
        }

        case 'contactMessage': {
          msgType = 'contacts';
          const contact = msg.message!.contactMessage!;
          contentText = `👤 ${contact.displayName || 'Contact'}`;
          contentJson.displayName = contact.displayName;
          contentJson.vcard = contact.vcard;
          break;
        }

        case 'reactionMessage': {
          msgType = 'reaction';
          const reaction = msg.message!.reactionMessage!;
          contentText = reaction.text || '';
          contentJson.key = reaction.key;
          break;
        }

        default:
          msgType = contentType || 'unknown';
          contentJson.raw = JSON.stringify(msg.message);
          break;
      }
    } catch (err) {
      this.logger.error({ error: err, messageId }, 'Error parsing message content');
    }

    // ── Send to Python backend via webhook ──
    const webhookPayload = {
      event: 'messages.upsert',
      instance: this.id,
      data: {
        phone,
        messageId,
        pushName,
        isGroup,
        type: msgType,
        text: contentText,
        mediaPath,         // File path on shared volume — NOT base64!
        mediaMime,
        contentJson,
        timestamp,
      },
    };

    try {
      const resp = await fetch(this.webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': config.apiKey,
        },
        body: JSON.stringify(webhookPayload),
      });

      if (!resp.ok) {
        this.logger.error(`Webhook POST failed: ${resp.status} ${resp.statusText}`);
      } else {
        this.logger.info(`📥 Inbound from ${phone} (${pushName}): [${msgType}] ${contentText.slice(0, 60)}`);
      }
    } catch (err) {
      this.logger.error({ error: err }, 'Failed to send webhook to Python backend');
    }

    // ── Mark as read with human delay ──
    if (config.antiBan.readReceiptDelayMs > 0) {
      setTimeout(async () => {
        try {
          if (msg.key) {
            await this.socket?.readMessages([msg.key as any]);
          }
        } catch {}
      }, config.antiBan.readReceiptDelayMs);
    }
  }

  /**
   * Download media to shared volume.
   * Returns the file path (NOT the content) — Python reads from the same volume.
   */
  private async downloadMedia(
    msg: proto.IWebMessageInfo,
    messageId: string,
    mimeType: string,
  ): Promise<string | undefined> {
    try {
      const buffer = await downloadMediaMessage(
        msg as any,
        'buffer',
        {},
        {
          logger: this.logger as any,
          reuploadRequest: this.socket!.updateMediaMessage,
        },
      );

      const ext = mime.extension(mimeType) || 'bin';
      const filename = `${messageId}.${ext}`;
      const filepath = path.join(this.mediaDir, filename);

      fs.writeFileSync(filepath, buffer as Buffer);
      this.logger.debug(`Media saved: ${filepath} (${(buffer as Buffer).length} bytes)`);

      return filepath;
    } catch (err) {
      this.logger.error({ error: err }, 'Failed to download media');
      return undefined;
    }
  }

  // ── Outbound: Send Messages ─────────────────────────

  async sendText(phone: string, text: string): Promise<{ messageId?: string; error?: string }> {
    if (!this.socket || this.status !== 'CONNECTED') {
      return { error: 'Instance not connected' };
    }

    const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;

    try {
      // Simulate typing
      if (config.antiBan.onlinePresence) {
        await this.socket.presenceSubscribe(jid);
        await this.socket.sendPresenceUpdate('composing', jid);

        const delay = randomBetween(
          config.antiBan.typingDelayMinMs,
          config.antiBan.typingDelayMaxMs,
        );
        await sleep(delay);

        await this.socket.sendPresenceUpdate('paused', jid);
      }

      const result = await this.socket.sendMessage(jid, { text });
      return { messageId: result?.key?.id || undefined };
    } catch (err) {
      this.logger.error({ error: err, phone }, 'Failed to send text');
      return { error: (err as Error).message };
    }
  }

  async sendImage(
    phone: string,
    imagePath: string,
    caption?: string,
  ): Promise<{ messageId?: string; error?: string }> {
    if (!this.socket || this.status !== 'CONNECTED') {
      return { error: 'Instance not connected' };
    }

    const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;

    try {
      const buffer = fs.readFileSync(imagePath);
      const result = await this.socket.sendMessage(jid, {
        image: buffer,
        caption: caption || undefined,
      });
      return { messageId: result?.key?.id || undefined };
    } catch (err) {
      this.logger.error({ error: err, phone }, 'Failed to send image');
      return { error: (err as Error).message };
    }
  }

  async sendAudio(
    phone: string,
    audioPath: string,
    ptt: boolean = true,
  ): Promise<{ messageId?: string; error?: string }> {
    if (!this.socket || this.status !== 'CONNECTED') {
      return { error: 'Instance not connected' };
    }

    const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;

    try {
      const buffer = fs.readFileSync(audioPath);
      const result = await this.socket.sendMessage(jid, {
        audio: buffer,
        ptt,
        mimetype: 'audio/ogg; codecs=opus',
      });
      return { messageId: result?.key?.id || undefined };
    } catch (err) {
      this.logger.error({ error: err, phone }, 'Failed to send audio');
      return { error: (err as Error).message };
    }
  }

  async sendDocument(
    phone: string,
    documentPath: string,
    filename?: string,
    mimetype?: string,
  ): Promise<{ messageId?: string; error?: string }> {
    if (!this.socket || this.status !== 'CONNECTED') {
      return { error: 'Instance not connected' };
    }

    const jid = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;

    try {
      const buffer = fs.readFileSync(documentPath);
      const detectedMime = mimetype || mime.lookup(documentPath) || 'application/octet-stream';
      const result = await this.socket.sendMessage(jid, {
        document: buffer,
        mimetype: detectedMime,
        fileName: filename || path.basename(documentPath),
      });
      return { messageId: result?.key?.id || undefined };
    } catch (err) {
      this.logger.error({ error: err, phone }, 'Failed to send document');
      return { error: (err as Error).message };
    }
  }

  // ── Connection Management ───────────────────────────

  async logout(): Promise<void> {
    if (this.socket) {
      await this.socket.logout();
      this.clearSession();
      this.setStatus('LOGGED_OUT');
      await this.sendStatusWebhook('LOGGED_OUT');
    }
  }

  async stop(): Promise<void> {
    if (this.socket) {
      this.socket.end(undefined);
      this.socket = null;
      this.setStatus('DISCONNECTED');
    }
  }

  getInfo(): InstanceInfo {
    // Auto-expire QR after 45 seconds (Baileys QR lasts ~20s)
    const QR_TTL_MS = 45_000;
    let qrCode = this.qrCode;
    let qrRaw = this.qrRaw;
    let qrGeneratedAt = this.qrGeneratedAt;

    if (qrCode && qrGeneratedAt && Date.now() - qrGeneratedAt > QR_TTL_MS) {
      // QR expired — clear it so API tells the client to wait for a fresh one
      this.qrCode = undefined;
      this.qrRaw = undefined;
      this.qrGeneratedAt = undefined;
      qrCode = undefined;
      qrRaw = undefined;
      qrGeneratedAt = undefined;
      this.logger.info('QR code expired (stale), cleared');
    }

    return {
      id: this.id,
      status: this.status,
      phoneNumber: this.phoneNumber,
      pushName: this.pushName,
      qrCode,
      qrRaw,
      qrGeneratedAt,
      createdAt: this.createdAt,
      connectedAt: this.connectedAt,
      lastError: this.lastError,
    };
  }

  // ── Status Management ───────────────────────────────

  onStatusChange(listener: StatusListener): void {
    this.statusListeners.push(listener);
  }

  private setStatus(status: InstanceStatus): void {
    this.status = status;
    const info = this.getInfo();
    for (const listener of this.statusListeners) {
      try { listener(info); } catch {}
    }
  }

  private async sendStatusWebhook(status: string): Promise<void> {
    const url = this.webhook.statusUrl || this.webhook.url.replace('/receive', '/status');
    if (!url) return;
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': config.apiKey,
        },
        body: JSON.stringify({
          event: 'connection.update',
          instance: this.id,
          data: {
            status,
            phoneNumber: this.phoneNumber,
            pushName: this.pushName,
            timestamp: Date.now(),
          },
        }),
      });
      if (!resp.ok) {
        this.logger.error(`Status webhook failed: ${resp.status} ${url}`);
      } else {
        this.logger.info(`Status webhook sent: ${status} → ${url}`);
      }
    } catch (err) {
      this.logger.error({ error: err, url }, 'Failed to send status webhook');
    }
  }

  private clearSession(): void {
    try {
      fs.rmSync(this.sessionDir, { recursive: true, force: true });
      fs.mkdirSync(this.sessionDir, { recursive: true });
      this.logger.info('Session cleared');
    } catch {}
  }
}

// ── Helpers ─────────────────────────────────────────

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
