import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { redis } from '../config/redis';
import { emailQueue } from '../queue/emailQueue';
import { concurrency } from '../queue/emailWorker';
import { log } from '../utils/logger';
import { ok } from '../utils/response';

export const getDashboardStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = (req.user as any).id;
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const [scheduled, sentToday, _totals, queueCounts] = await Promise.all([
      prisma.email.count({ where: { userId: uid, status: { in: ['SCHEDULED', 'PROCESSING'] } } }),
      prisma.email.count({ where: { userId: uid, status: 'SENT', sentAt: { gte: today } } }),
      prisma.email.groupBy({ by: ['status'], where: { userId: uid }, _count: { _all: true } }),
      emailQueue.getJobCounts('waiting', 'delayed', 'active', 'completed', 'failed'),
    ]);

    const senderRow = await prisma.email.findFirst({
      where: { userId: uid },
      orderBy: { createdAt: 'desc' },
      select: { sender: true },
    });
    const currentSender = senderRow?.sender || (req.user as any).email;
    const usage = Number(await redis.get(`email-rate:${currentSender}:${now.toISOString().slice(0, 13)}`) || 0);

    const activity = [];
    for (let d = 6; d >= 0; d--) {
      const day = new Date(today);
      day.setDate(today.getDate() - d);
      const nextDay = new Date(day);
      nextDay.setDate(day.getDate() + 1);

      const [s, f, sch] = await Promise.all([
        prisma.email.count({ where: { userId: uid, status: 'SENT', sentAt: { gte: day, lt: nextDay } } }),
        prisma.email.count({ where: { userId: uid, status: 'FAILED', updatedAt: { gte: day, lt: nextDay } } }),
        prisma.email.count({ where: { userId: uid, createdAt: { gte: day, lt: nextDay } } }),
      ]);
      activity.push({ date: day.toISOString().slice(0, 10), sent: s, failed: f, scheduled: sch });
    }

    ok(res, {
      scheduled,
      sentToday,
      queueDepth: queueCounts.waiting + queueCounts.delayed,
      usage,
      sender: currentSender,
      limit: Number(process.env.MAX_EMAILS_PER_HOUR || 100),
      queue: queueCounts,
      activity,
      hasActivity: activity.some((x) => x.sent + x.failed + x.scheduled > 0),
      worker: 'ONLINE',
      concurrency,
    });
  } catch (e) {
    log.warn({ err: e }, 'Dashboard metrics unavailable; serving offline fallback values.');
    const limit = Number(process.env.MAX_EMAILS_PER_HOUR || 100);
    ok(res, {
      scheduled: 0,
      sentToday: 0,
      queueDepth: 0,
      usage: 0,
      sender: (req.user as any)?.email || 'unknown',
      limit,
      queue: { waiting: 0, delayed: 0, active: 0, completed: 0, failed: 0 },
      activity: Array.from({ length: 7 }, (_, index) => {
        const date = new Date();
        date.setDate(date.getDate() - (6 - index));
        return { date: date.toISOString().slice(0, 10), sent: 0, failed: 0, scheduled: 0 };
      }),
      hasActivity: false,
      worker: 'DEGRADED',
      concurrency,
      fallback: true,
      message: 'Database or Redis is not running; showing offline metrics.',
    });
  }
};
