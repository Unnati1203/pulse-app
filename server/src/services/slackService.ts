import axios from 'axios';
import { redis } from '../config/redis';
import { prisma } from '../config/prisma';
import { log } from '../utils/logger';

export const notifyRateLimit = async (userId: string, sender: string, hour: string, _count: number) => {
  const key = `pulse:slack-notified:${userId}:${sender}:${hour}`;
  if (!(await redis.set(key, '1', 'EX', 172800, 'NX'))) return;

  try {
    const connections = await prisma.slackConnection.findMany({ where: { userId } });
    const queuedCount = await prisma.email.count({
      where: {
        userId,
        sender,
        status: 'SCHEDULED',
        scheduledAt: { lt: new Date(new Date(`${hour}:00:00.000Z`).getTime() + 3600000) },
      },
    });

    for (const c of connections) {
      const result = await axios.post(
        'https://slack.com/api/chat.postMessage',
        {
          channel: c.channelId || c.teamId,
          text: `Pulse rate limit reached\nSender: ${sender}\nLimit: ${process.env.MAX_EMAILS_PER_HOUR || 100} emails/hour\nWindow: ${hour}\nQueued for next window: ${queuedCount}`,
        },
        {
          headers: {
            Authorization: `Bearer ${c.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );
      if (!result.data.ok) log.warn({ error: result.data.error }, 'Slack notification failed');
    }
  } catch (e) {
    log.warn({ err: e }, 'Slack notification skipped');
  }
};
