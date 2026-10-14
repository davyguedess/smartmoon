/**
 * SmartMoon Engine — Message Queue (Anti-Ban)
 * 
 * Uses BullMQ to queue outbound messages with humanized delays.
 * This prevents WhatsApp from detecting robotic behavior and banning numbers.
 * 
 * Key features:
 * - Configurable delay between messages (2-8s default)
 * - Exponential backoff on failure
 * - Per-instance rate limiting (max N msgs/min)
 * - Typing simulation before each message
 */

import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { manager } from '../baileys/manager';
import { config } from '../config';
import pino from 'pino';

const logger = pino({ level: config.logLevel }).child({ module: 'queue' });

// ── Redis Connection ────────────────────────────────

const connection = new IORedis(config.redisUrl, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// ── Per-Instance Queue & Worker Maps ────────────────
// FIX: antes havia 1 fila global com 8 msgs/min para TODOS.
// Agora cada instância tem sua própria fila e rate limit isolado.
// 20 instâncias = 20 × 8 = 160 msgs/min total.

const instanceQueues  = new Map<string, Queue>();
const instanceWorkers = new Map<string, Worker>();

function _safeQueueName(instanceId: string): string {
  // BullMQ usa ':' como separador interno — o instanceId não pode conter ':'
  // Trocamos '-' por '_' para manter legibilidade sem conflito
  return instanceId.replace(/[^a-zA-Z0-9_]/g, '_');
}

function getInstanceQueue(instanceId: string): Queue {
  if (!instanceQueues.has(instanceId)) {
    const qName = `wa-outbound_${_safeQueueName(instanceId)}`;
    const q = new Queue(qName, {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 500 },
        removeOnFail:     { count: 200 },
      },
    });
    instanceQueues.set(instanceId, q);
    _startInstanceWorker(instanceId);
  }
  return instanceQueues.get(instanceId)!;
}

function _startInstanceWorker(instanceId: string): void {
  const qName = `wa-outbound_${_safeQueueName(instanceId)}`;
  const w = new Worker(
    qName,
    async (job: Job<MessageJob>) => _processJob(job),
    {
      connection,
      concurrency: 1,  // anti-ban: 1 msg por vez por instância
      limiter: {
        max:      config.antiBan.maxMessagesPerMinute,  // 8/min por instância
        duration: 60000,
      },
    },
  );
  w.on('failed', (job, err) =>
    logger.error({ jobId: job?.id, instanceId, error: err.message }, 'Message send failed'),
  );
  w.on('completed', (job) =>
    logger.debug(`Job ${job.id} completed [${instanceId}]`),
  );
  instanceWorkers.set(instanceId, w);
  logger.info(`Worker started for instance: ${instanceId} (rate: ${config.antiBan.maxMessagesPerMinute}/min)`);
}

export async function destroyInstanceQueue(instanceId: string): Promise<void> {
  await instanceWorkers.get(instanceId)?.close();
  await instanceQueues.get(instanceId)?.close();
  instanceWorkers.delete(instanceId);
  instanceQueues.delete(instanceId);
  logger.info(`Queue + worker destroyed for instance: ${instanceId}`);
}

// ── Job Types ───────────────────────────────────────

interface SendTextJob {
  type: 'text';
  instanceId: string;
  phone: string;
  text: string;
}

interface SendImageJob {
  type: 'image';
  instanceId: string;
  phone: string;
  imagePath: string;
  caption?: string;
}

interface SendAudioJob {
  type: 'audio';
  instanceId: string;
  phone: string;
  audioPath: string;
  ptt?: boolean;
}

interface SendDocumentJob {
  type: 'document';
  instanceId: string;
  phone: string;
  documentPath: string;
  filename?: string;
  mimetype?: string;
}

type MessageJob = SendTextJob | SendImageJob | SendAudioJob | SendDocumentJob;

// ── Enqueue Functions ───────────────────────────────

/**
 * Add a text message to the queue with humanized delay.
 */
export async function enqueueSendText(
  instanceId: string,
  phone: string,
  text: string,
): Promise<string> {
  const delay = randomBetween(
    config.antiBan.typingDelayMinMs,
    config.antiBan.typingDelayMaxMs,
  );
  const job = await getInstanceQueue(instanceId).add(
    'send-message',
    { type: 'text', instanceId, phone, text } as SendTextJob,
    { delay },
  );
  logger.debug(`Enqueued text to ${phone} via ${instanceId} (delay: ${delay}ms)`);
  return job.id || '';
}

/**
 * Add an image message to the queue.
 */
export async function enqueueSendImage(
  instanceId: string,
  phone: string,
  imagePath: string,
  caption?: string,
): Promise<string> {
  const job = await getInstanceQueue(instanceId).add(
    'send-message',
    { type: 'image', instanceId, phone, imagePath, caption } as SendImageJob,
    { delay: randomBetween(1000, 3000) },
  );
  return job.id || '';
}

/**
 * Add an audio message to the queue.
 */
export async function enqueueSendAudio(
  instanceId: string,
  phone: string,
  audioPath: string,
  ptt: boolean = true,
): Promise<string> {
  const job = await getInstanceQueue(instanceId).add(
    'send-message',
    { type: 'audio', instanceId, phone, audioPath, ptt } as SendAudioJob,
    { delay: randomBetween(1000, 2000) },
  );
  return job.id || '';
}

/**
 * Add a document message to the queue.
 */
export async function enqueueSendDocument(
  instanceId: string,
  phone: string,
  documentPath: string,
  filename?: string,
  mimetype?: string,
): Promise<string> {
  const job = await getInstanceQueue(instanceId).add(
    'send-message',
    { type: 'document', instanceId, phone, documentPath, filename, mimetype } as SendDocumentJob,
    { delay: randomBetween(500, 1500) },
  );
  return job.id || '';
}

// ── Job Processor (shared across all instance workers) ────

async function _processJob(job: Job<MessageJob>): Promise<any> {
  const data = job.data;
  const instance = manager.getInstance(data.instanceId);

  if (!instance) throw new Error(`Instance ${data.instanceId} not found`);
  if (instance.status !== 'CONNECTED') {
    throw new Error(`Instance ${data.instanceId} not connected (status: ${instance.status})`);
  }

  let result;
  switch (data.type) {
    case 'text':     result = await instance.sendText(data.phone, data.text); break;
    case 'image':    result = await instance.sendImage(data.phone, data.imagePath, data.caption); break;
    case 'audio':    result = await instance.sendAudio(data.phone, data.audioPath, data.ptt); break;
    case 'document': result = await instance.sendDocument(data.phone, data.documentPath, data.filename, data.mimetype); break;
    default: throw new Error(`Unknown message type: ${(data as any).type}`);
  }

  if (result.error) throw new Error(result.error);
  logger.info(`✅ Sent ${data.type} to ${data.phone} via ${data.instanceId} (msgId: ${result.messageId})`);
  return result;
}

// ── Worker (processes the queue) ────────────────────

let worker: Worker | null = null;

export function startWorker(): void {
  worker = new Worker(
    'wa-outbound',
    async (job: Job<MessageJob>) => {
      const data = job.data;
      const instance = manager.getInstance(data.instanceId);

      if (!instance) {
        throw new Error(`Instance ${data.instanceId} not found`);
      }

      if (instance.status !== 'CONNECTED') {
        throw new Error(`Instance ${data.instanceId} not connected (status: ${instance.status})`);
      }

      let result;

      switch (data.type) {
        case 'text':
          result = await instance.sendText(data.phone, data.text);
          break;

        case 'image':
          result = await instance.sendImage(data.phone, data.imagePath, data.caption);
          break;

        case 'audio':
          result = await instance.sendAudio(data.phone, data.audioPath, data.ptt);
          break;

        case 'document':
          result = await instance.sendDocument(
            data.phone,
            data.documentPath,
            data.filename,
            data.mimetype,
          );
          break;

        default:
          throw new Error(`Unknown message type: ${(data as any).type}`);
      }

      if (result.error) {
        throw new Error(result.error);
      }

      logger.info(`✅ Sent ${data.type} to ${data.phone} via ${data.instanceId} (msgId: ${result.messageId})`);
      return result;
    },
    {
      connection,
      concurrency: 1, // Process one message at a time per worker (anti-ban)
      limiter: {
        max: config.antiBan.maxMessagesPerMinute,
        duration: 60000, // Per minute
      },
    },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, error: err.message }, 'Message send failed');
  });

  worker.on('completed', (job) => {
    logger.debug(`Job ${job.id} completed`);
  });

  logger.info(`Message queue worker started (rate: ${config.antiBan.maxMessagesPerMinute}/min)`);
}

export function stopWorker(): void {
  worker?.close();
}

// ── Helpers ─────────────────────────────────────────

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
