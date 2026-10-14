/**
 * SmartMoon Engine — Instance API Routes
 * 
 * CRUD for WhatsApp instances.
 * All endpoints require X-API-Key header (internal auth).
 */

import { Router, Request, Response } from 'express';
import { manager } from '../baileys/manager';

export const instanceRouter = Router();

/**
 * POST /instances
 * Create a new WhatsApp instance and start the QR code flow.
 */
instanceRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { id, webhookUrl, statusWebhookUrl } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Instance ID is required' });
    }

    const info = await manager.create(id, {
      url: webhookUrl,
      statusUrl: statusWebhookUrl,
    });

    res.status(201).json({
      message: 'Instance created',
      instance: info,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * GET /instances
 * List all instances with current status.
 */
instanceRouter.get('/', (_req: Request, res: Response) => {
  const instances = manager.list();
  res.json({
    total: instances.length,
    instances,
    stats: manager.getStats(),
  });
});

/**
 * GET /instances/:id
 * Get detailed info about a specific instance.
 */
instanceRouter.get('/:id', (req: Request, res: Response) => {
  const info = manager.get(req.params.id as string);
  if (!info) {
    return res.status(404).json({ error: 'Instance not found' });
  }
  res.json(info);
});

/**
 * GET /instances/:id/qr
 * Get the current QR code for pairing.
 * Returns base64 data URI if QR is available.
 */
instanceRouter.get('/:id/qr', (req: Request, res: Response) => {
  const info = manager.get(req.params.id as string);
  if (!info) {
    return res.status(404).json({ error: 'Instance not found' });
  }

  if (info.status === 'CONNECTED') {
    return res.json({
      status: 'CONNECTED',
      message: 'Already connected — no QR needed',
      phoneNumber: info.phoneNumber,
      pushName: info.pushName,
    });
  }

  if (!info.qrCode) {
    return res.json({
      status: info.status,
      message: info.status === 'INITIALIZING'
        ? 'Instance is starting — QR will be available in a few seconds'
        : 'QR code expired or not yet available — retry in 3 seconds',
      retryAfterMs: 3000,
    });
  }

  res.json({
    status: 'QR_READY',
    qrCode: info.qrCode,         // data:image/png;base64,...
    qrRaw: info.qrRaw,           // Raw string for custom rendering
    qrGeneratedAt: info.qrGeneratedAt,  // Timestamp — client can calculate freshness
  });
});

/**
 * POST /instances/:id/restart
 * Restart an instance (reconnect).
 */
instanceRouter.post('/:id/restart', async (req: Request, res: Response) => {
  try {
    const info = await manager.restart(req.params.id as string);
    if (!info) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    res.json({ message: 'Instance restarting', instance: info });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * POST /instances/:id/logout
 * Disconnect from WhatsApp and clear session.
 */
instanceRouter.post('/:id/logout', async (req: Request, res: Response) => {
  try {
    const success = await manager.logout(req.params.id as string);
    if (!success) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    res.json({ message: 'Instance logged out' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * DELETE /instances/:id
 * Stop and permanently remove an instance.
 */
instanceRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const success = await manager.delete(req.params.id as string);
    if (!success) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    res.json({ message: 'Instance deleted' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
