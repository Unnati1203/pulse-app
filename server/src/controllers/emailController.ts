import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { es } from '../config/elasticsearch';
import { emailQueue } from '../queue/emailQueue';
import { indexEmail } from '../services/elasticsearchService';
import { log } from '../utils/logger';
import { fail, ok } from '../utils/response';

const scheduleSchema = z.object({
  subject: z.string().trim().min(1).max(300),
  body: z.string().min(1).max(100000),
  sender: z.string().email(),
  recipients: z.array(z.string().email()).min(1).max(10000),
  startTime: z.string().datetime(),
  delayMs: z.number().int().min(0).max(86400000),
  hourlyLimit: z.number().int().min(1).max(10000).optional(),
});

export const scheduleEmails = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = scheduleSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 400, parsed.error.issues[0]?.message || 'Invalid request.', 'VALIDATION_ERROR');
    }
    const u = req.user as any;
    const input = parsed.data;
    const start = new Date(input.startTime);
    if (start.getTime() < Date.now() - 60000) {
      return fail(res, 400, 'Start time must be in the future.', 'INVALID_START_TIME');
    }

    const unique = [...new Set(input.recipients.map((x) => x.trim().toLowerCase()))];
    const created = await prisma.email.createManyAndReturn({
      data: unique.map((recipient, i) => ({
        userId: u.id,
        sender: input.sender,
        recipient,
        subject: input.subject,
        body: input.body,
        scheduledAt: new Date(start.getTime() + i * input.delayMs),
      })),
    });

    for (const email of created) {
      const delay = Math.max(0, email.scheduledAt.getTime() - Date.now());
      await emailQueue.add(
        'send-email',
        { emailId: email.id, hourlyLimit: input.hourlyLimit, delayMs: input.delayMs },
        {
          jobId: `email-${email.id}`,
          delay,
          removeOnComplete: 1000,
          removeOnFail: 5000,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        }
      );
      const saved = await prisma.email.update({
        where: { id: email.id },
        data: { bullJobId: `email-${email.id}` },
      });
      void indexEmail(saved);
    }
    ok(res, { scheduled: created.length, emails: created }, 201);
  } catch (e) {
    next(e);
  }
};

export const getEmails = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const status =
      typeof req.query.status === 'string' && ['SCHEDULED', 'PROCESSING', 'SENT', 'FAILED'].includes(req.query.status)
        ? req.query.status
        : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q.slice(0, 200) : '';
    const date =
      typeof req.query.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
        ? new Date(`${req.query.date}T00:00:00`)
        : null;
    const dateField = req.query.view === 'SENT' ? 'sentAt' : 'scheduledAt';
    const where: any = {
      userId: (req.user as any).id,
      ...(status ? { status } : {}),
      ...(date ? { [dateField]: { gte: date, lt: new Date(date.getTime() + 86400000) } } : {}),
      ...(q
        ? {
            OR: [
              { recipient: { contains: q, mode: 'insensitive' } },
              { subject: { contains: q, mode: 'insensitive' } },
              { sender: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      prisma.email.findMany({ where, orderBy: { scheduledAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      prisma.email.count({ where }),
    ]);

    ok(res, { items, total, page, limit, pages: Math.ceil(total / limit) });
  } catch (e) {
    next(e);
  }
};

export const searchEmails = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = z.string().trim().min(1).max(200).parse(req.query.q);
    const userId = (req.user as any).id;
    try {
      const result = await es.search({
        index: 'pulse-emails',
        query: {
          bool: {
            must: [{ multi_match: { query: q, fields: ['recipient', 'sender', 'subject', 'body'], type: 'best_fields', fuzziness: 'AUTO' } }],
            filter: [{ term: { userId } }],
          },
        },
        size: 50,
      });
      return ok(res, { items: result.hits.hits.map((h: any) => h._source), source: 'elasticsearch' });
    } catch (e) {
      log.warn({ err: e }, 'Elasticsearch search unavailable; using PostgreSQL fallback');
      const items = await prisma.email.findMany({
        where: {
          userId,
          OR: ['recipient', 'sender', 'subject', 'body'].map((k) => ({ [k]: { contains: q, mode: 'insensitive' } })),
        },
        take: 50,
        orderBy: { createdAt: 'desc' },
      });
      ok(res, { items, source: 'postgres-fallback' });
    }
  } catch (e) {
    next(e);
  }
};

export const getEmailById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await prisma.email.findFirst({
      where: { id: String(req.params.id), userId: (req.user as any).id },
    });
    return item ? ok(res, item) : fail(res, 404, 'Email not found.', 'NOT_FOUND');
  } catch (e) {
    next(e);
  }
};
