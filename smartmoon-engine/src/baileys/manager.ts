/**
 * SmartMoon Engine — Instance Manager
 * 
 * Orchestrates multiple Baileys instances.
 * Handles: creating/deleting instances, restoring sessions on boot,
 * broadcasting status updates via WebSocket.
 */

import * as fs from 'fs';
import * as path from 'path';
import { BaileysInstance, InstanceInfo, WebhookConfig } from './instance';
import { config } from '../config';
import pino from 'pino';

const logger = pino({ level: config.logLevel }).child({ module: 'manager' });

class InstanceManager {
  private instances = new Map<string, BaileysInstance>();
  private wsClients = new Map<string, Set<any>>(); // WebSocket clients per instance

  /**
   * Create and start a new Baileys instance.
   */
  async create(id: string, webhookConfig?: Partial<WebhookConfig>): Promise<InstanceInfo> {
    if (this.instances.has(id)) {
      const existing = this.instances.get(id)!;
      return existing.getInfo();
    }

    const webhook: WebhookConfig = {
      url: webhookConfig?.url || `${config.webhookBaseUrl}/webhook/smartmoon/${id}/receive`,
      statusUrl: webhookConfig?.statusUrl || `${config.webhookBaseUrl}/webhook/smartmoon/${id}/status`,
    };

    const instance = new BaileysInstance(id, webhook);

    // Forward status changes to WebSocket clients
    instance.onStatusChange((info) => {
      this.broadcastToWs(id, {
        event: 'status',
        data: info,
      });
    });

    this.instances.set(id, instance);
    await instance.start();

    logger.info(`Instance ${id} created and started`);
    return instance.getInfo();
  }

  /**
   * Get instance info by ID.
   */
  get(id: string): InstanceInfo | null {
    return this.instances.get(id)?.getInfo() || null;
  }

  /**
   * List all instances.
   */
  list(): InstanceInfo[] {
    return Array.from(this.instances.values()).map((i) => i.getInfo());
  }

  /**
   * Get the raw instance (for sending messages).
   */
  getInstance(id: string): BaileysInstance | undefined {
    return this.instances.get(id);
  }

  /**
   * Delete an instance (stop + remove session).
   */
  async delete(id: string): Promise<boolean> {
    const instance = this.instances.get(id);
    if (!instance) return false;

    await instance.logout();
    await instance.stop();
    this.instances.delete(id);

    logger.info(`Instance ${id} deleted`);
    return true;
  }

  /**
   * Logout an instance (disconnect WhatsApp, clear session).
   */
  async logout(id: string): Promise<boolean> {
    const instance = this.instances.get(id);
    if (!instance) return false;

    await instance.logout();
    return true;
  }

  /**
   * Restart an instance (reconnect with existing session).
   */
  async restart(id: string): Promise<InstanceInfo | null> {
    const instance = this.instances.get(id);
    if (!instance) return null;

    await instance.stop();
    await instance.start();
    return instance.getInfo();
  }

  /**
   * Restore all instances from saved sessions on boot.
   * Called once when the server starts.
   */
  async restoreSessions(): Promise<void> {
    const sessionsDir = config.sessionsDir;

    if (!fs.existsSync(sessionsDir)) {
      fs.mkdirSync(sessionsDir, { recursive: true });
      return;
    }

    const dirs = fs.readdirSync(sessionsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);

    logger.info(`Found ${dirs.length} saved session(s) to restore`);

    for (const id of dirs) {
      // Check if session has auth files (creds.json exists = valid session)
      const credsPath = path.join(sessionsDir, id, 'creds.json');
      if (fs.existsSync(credsPath)) {
        try {
          await this.create(id);
          logger.info(`✅ Restored session: ${id}`);
        } catch (err) {
          logger.error({ error: err, id }, `❌ Failed to restore session: ${id}`);
        }
      } else {
        logger.warn(`⚠️ Session ${id} has no creds — skipping`);
      }
    }
  }

  // ── WebSocket Management ──────────────────────────

  /**
   * Register a WebSocket client for an instance.
   */
  registerWsClient(instanceId: string, ws: any): void {
    if (!this.wsClients.has(instanceId)) {
      this.wsClients.set(instanceId, new Set());
    }
    this.wsClients.get(instanceId)!.add(ws);

    // Send current status immediately
    const info = this.get(instanceId);
    if (info) {
      try {
        ws.send(JSON.stringify({ event: 'status', data: info }));
      } catch {}
    }
  }

  /**
   * Remove a WebSocket client.
   */
  removeWsClient(instanceId: string, ws: any): void {
    this.wsClients.get(instanceId)?.delete(ws);
  }

  /**
   * Broadcast a message to all WebSocket clients for an instance.
   */
  private broadcastToWs(instanceId: string, message: any): void {
    const clients = this.wsClients.get(instanceId);
    if (!clients) return;

    const payload = JSON.stringify(message);
    for (const ws of clients) {
      try {
        if (ws.readyState === 1) { // OPEN
          ws.send(payload);
        }
      } catch {}
    }
  }

  /**
   * Get total stats.
   */
  getStats(): {
    total: number;
    connected: number;
    disconnected: number;
    qrReady: number;
  } {
    let connected = 0;
    let disconnected = 0;
    let qrReady = 0;

    for (const instance of this.instances.values()) {
      switch (instance.status) {
        case 'CONNECTED': connected++; break;
        case 'DISCONNECTED':
        case 'LOGGED_OUT':
        case 'ERROR': disconnected++; break;
        case 'QR_READY': qrReady++; break;
      }
    }

    return {
      total: this.instances.size,
      connected,
      disconnected,
      qrReady,
    };
  }
}

// Singleton export
export const manager = new InstanceManager();
