import { Worker, Job } from 'bullmq';
import nodemailer from 'nodemailer';
import { redis } from '../config/redis';
import { prisma } from '../config/prisma';
import { transport } from '../config/transport';
import { log } from '../utils/logger';
import { updateEmailInIndex } from '../services/elasticsearchService';
import { notifyRateLimit } from '../services/slackService';
import { emailQueue } from './emailQueue';

export const concurrency = Math.max(1, Number(process.env.WORKER_CONCURRENCY || 5));

export const emailWorker = new Worker(
  'emailQueue',
  async (job: Job<{ emailId: string; hourlyLimit?: number; delayMs?: number }>) => {
    const email = await prisma.email.findUnique({ where: { id: job.data.emailId } });
    if (!email || email.status === 'SENT' || email.status === 'FAILED' || email.status === 'PROCESSING') return;

    const claimed = await prisma.email.updateMany({
      where: { id: email.id, status: 'SCHEDULED' },
      data: { status: 'PROCESSING', error: null },
    });
    if (claimed.count !== 1) return;

    const hourDate = new Date();
    const hour = hourDate.toISOString().slice(0, 13);
    const windowEnd = new Date(`${hour}:00:00.000Z`);
    windowEnd.setUTCHours(windowEnd.getUTCHours() + 1);

    const rateKey = `email-rate:${email.sender}:${hour}`;
    const script = `local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],7200) end; if n<=tonumber(ARGV[1]) then return n else redis.call('DECR',KEYS[1]); return 0 end`;
    const allowed = (await redis.eval(
      script,
      1,
      rateKey,
      String(Math.min(Number(process.env.MAX_EMAILS_PER_HOUR || 100), Number(job.data.hourlyLimit || process.env.MAX_EMAILS_PER_HOUR || 100)))
    )) as number;

    if (!allowed) {
      const moved = await prisma.email.update({
        where: { id: email.id },
        data: { status: 'SCHEDULED', scheduledAt: windowEnd },
      });
      await emailQueue.add(
        'send-email',
        { emailId: email.id, hourlyLimit: job.data.hourlyLimit, delayMs: job.data.delayMs },
        {
          jobId: `email-${email.id}-${windowEnd.getTime()}`,
          delay: Math.max(0, windowEnd.getTime() - Date.now()),
          removeOnComplete: 1000,
          removeOnFail: 5000,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        }
      );
      await updateEmailInIndex(moved);
      await notifyRateLimit(email.userId, email.sender, hour, 1);
      return;
    }

    const lastKey = `email-last-send:${email.sender}`;
    const minDelay = Math.max(Number(process.env.MIN_EMAIL_DELAY_MS || 2000), Number(job.data.delayMs || 0));
    const wait = Number(
      await redis.eval(
        `local now=tonumber(ARGV[1]); local gap=tonumber(ARGV[2]); local last=tonumber(redis.call('GET',KEYS[1]) or '0'); local at=math.max(now,last+gap); redis.call('SET',KEYS[1],at); return at-now`,
        1,
        lastKey,
        Date.now(),
        minDelay
      )
    );

    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));

    if (!transport) throw new Error('Ethereal SMTP is not configured. Set ETHEREAL_USER and ETHEREAL_PASSWORD.');

    try {
      const result = await transport.sendMail({
        from: email.sender,
        to: email.recipient,
        subject: email.subject,
        text: email.body,
      });

      const sent = await prisma.email.update({
        where: { id: email.id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          etherealMessageId: result.messageId,
          previewUrl: nodemailer.getTestMessageUrl(result) || null,
        },
      });
      await updateEmailInIndex(sent);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Email send failed';
      await prisma.email.update({
        where: { id: email.id },
        data: { error: message },
      });
      throw e;
    }
  },
  { connection: redis, concurrency, limiter: undefined }
);

emailWorker.on('failed', (job, error) => {
  log.error({ jobId: job?.id, err: error }, 'Email job attempt failed');
  if (job?.data?.emailId) {
    const exhausted = job.attemptsMade >= Number(job.opts.attempts || 1);
    void prisma.email
      .updateMany({
        where: { id: job.data.emailId, status: 'PROCESSING' },
        data: { status: exhausted ? 'FAILED' : 'SCHEDULED', error: error.message },
      })
      .then(async () => {
        const current = await prisma.email.findUnique({ where: { id: job.data.emailId } });
        if (current) await updateEmailInIndex(current);
      })
      .catch(() => {});
  }
});
