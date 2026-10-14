/**
 * SmartMoon Engine — Message API Routes
 * 
 * Send messages via queue (anti-ban) or direct (bypass queue).
 * All media paths reference the shared Docker volume.
 */

import { Router, Request, Response } from 'express';
import { manager } from '../baileys/manager';
import {
  enqueueSendText,
  enqueueSendImage,
  enqueueSendAudio,
  enqueueSendDocument,
} from '../queue/message-queue';

export const messageRouter = Router();

/**
 * POST /messages/send-text
 * Send a text message via the anti-ban queue.
 * 
 * Body: { instanceId, phone, text }
 */
messageRouter.post('/send-text', async (req: Request, res: Response) => {
  try {
    const { instanceId, phone, text, direct } = req.body;

    if (!instanceId || !phone || !text) {
      return res.status(400).json({
        error: 'Missing required fields: instanceId, phone, text',
      });
    }

    // Check instance exists and is connected
    const instance = manager.getInstance(instanceId);
    if (!instance) {
      return res.status(404).json({ error: `Instance ${instanceId} not found` });
    }
    if (instance.status !== 'CONNECTED') {
      return res.status(503).json({
        error: `Instance ${instanceId} not connected`,
        status: instance.status,
      });
    }

    // Direct send (bypass queue) — useful for urgent system messages
    if (direct) {
      const result = await instance.sendText(phone, text);
      return res.json({ queued: false, ...result });
    }

    // Queue with anti-ban delay
    const jobId = await enqueueSendText(instanceId, phone, text);
    res.json({ queued: true, jobId });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * POST /messages/send-image
 * Send an image. The imagePath must be accessible on the shared volume.
 * 
 * Body: { instanceId, phone, imagePath, caption? }
 */
messageRouter.post('/send-image', async (req: Request, res: Response) => {
  try {
    const { instanceId, phone, imagePath, caption } = req.body;

    if (!instanceId || !phone || !imagePath) {
      return res.status(400).json({
        error: 'Missing required fields: instanceId, phone, imagePath',
      });
    }

    const jobId = await enqueueSendImage(instanceId, phone, imagePath, caption);
    res.json({ queued: true, jobId });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * POST /messages/send-audio
 * Send an audio/voice note.
 * 
 * Body: { instanceId, phone, audioPath, ptt? }
 */
messageRouter.post('/send-audio', async (req: Request, res: Response) => {
  try {
    const { instanceId, phone, audioPath, ptt = true } = req.body;

    if (!instanceId || !phone || !audioPath) {
      return res.status(400).json({
        error: 'Missing required fields: instanceId, phone, audioPath',
      });
    }

    const jobId = await enqueueSendAudio(instanceId, phone, audioPath, ptt);
    res.json({ queued: true, jobId });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * POST /messages/send-document
 * Send a document file.
 * 
 * Body: { instanceId, phone, documentPath, filename?, mimetype? }
 */
messageRouter.post('/send-document', async (req: Request, res: Response) => {
  try {
    const { instanceId, phone, documentPath, filename, mimetype } = req.body;

    if (!instanceId || !phone || !documentPath) {
      return res.status(400).json({
        error: 'Missing required fields: instanceId, phone, documentPath',
      });
    }

    const jobId = await enqueueSendDocument(instanceId, phone, documentPath, filename, mimetype);
    res.json({ queued: true, jobId });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
