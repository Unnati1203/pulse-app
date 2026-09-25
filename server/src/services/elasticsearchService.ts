import { es } from '../config/elasticsearch';
import { log } from '../utils/logger';

export const indexEmail = async (email: any) => {
  try {
    await es.index({
      index: 'pulse-emails',
      id: email.id,
      document: {
        id: email.id,
        userId: email.userId,
        recipient: email.recipient,
        sender: email.sender,
        subject: email.subject,
        body: email.body,
        status: email.status,
        scheduledAt: email.scheduledAt,
        sentAt: email.sentAt,
      },
    });
  } catch (e) {
    log.warn({ err: e }, 'Elasticsearch indexing unavailable');
  }
};

export const updateEmailInIndex = async (email: any) => indexEmail(email);
