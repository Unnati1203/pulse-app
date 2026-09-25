import { Request, Response } from 'express';
import { emailQueue } from '../queue/emailQueue';
import { redis } from '../config/redis';
import { concurrency } from '../queue/emailWorker';
import { log } from '../utils/logger';
import { ok } from '../utils/response';

export const getQueueStats = async (_req: Request, res: Response) => {
  try {
    const counts = await Promise.race([
      emailQueue.getJobCounts('waiting', 'delayed', 'active', 'completed', 'failed'),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Queue metrics timed out')), 3000)),
    ]);
    ok(res, { counts, worker: redis.status === 'ready' ? 'ONLINE' : 'DEGRADED', concurrency, redis: redis.status });
  } catch (e) {
    log.warn({ err: e }, 'Queue metrics unavailable; serving offline fallback values.');
    ok(res, {
      counts: { waiting: 0, delayed: 0, active: 0, completed: 0, failed: 0 },
      worker: 'DEGRADED',
      concurrency,
      redis: redis.status,
      fallback: true,
      message: 'Redis is not running; queue is offline.',
    });
  }
};
