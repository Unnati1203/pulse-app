import { redis } from '../config/redis';
import { prisma } from '../config/prisma';
import { emailQueue } from './emailQueue';
import { log } from '../utils/logger';

export const restoreScheduledJobs = async () => {
  try {
    if (redis.status !== 'ready') {
      redis.once('ready', () => void restoreScheduledJobs());
      return;
    }
    const scheduled = await prisma.email.findMany({
      where: { status: 'SCHEDULED' },
      select: { id: true, bullJobId: true, scheduledAt: true },
      take: 10000,
    });
    let restored = 0;
    for (const email of scheduled) {
      const jobId = email.bullJobId || `email-${email.id}`;
      if (await emailQueue.getJob(jobId)) continue;
      await emailQueue.add(
        'send-email',
        { emailId: email.id },
        {
          jobId,
          delay: Math.max(0, email.scheduledAt.getTime() - Date.now()),
          removeOnComplete: 1000,
          removeOnFail: 5000,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        }
      );
      if (email.bullJobId !== jobId) {
        await prisma.email.update({ where: { id: email.id }, data: { bullJobId: jobId } });
      }
      restored += 1;
    }
    if (restored) log.info({ restored }, 'Restored scheduled emails into BullMQ');
  } catch (e) {
    log.warn({ err: e }, 'Scheduled job restoration skipped; infrastructure is unavailable');
  }
};
