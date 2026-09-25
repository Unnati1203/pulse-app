export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export type EmailStatus = 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED';

export interface Email {
  id: string;
  userId: string;
  sender: string;
  recipient: string;
  subject: string;
  body: string;
  scheduledAt: string;
  sentAt?: string | null;
  status: EmailStatus;
  error?: string | null;
  etherealMessageId?: string | null;
  previewUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityDay {
  date: string;
  sent: number;
  failed: number;
  scheduled: number;
}

export interface DashboardStats {
  scheduled: number;
  sentToday: number;
  queueDepth: number;
  usage: number;
  sender: string;
  limit: number;
  queue: {
    waiting: number;
    delayed: number;
    active: number;
    completed: number;
    failed: number;
  };
  activity: ActivityDay[];
  hasActivity: boolean;
  worker: string;
  concurrency: number;
  fallback?: boolean;
  message?: string;
}

export interface QueueStats {
  counts: {
    waiting: number;
    delayed: number;
    active: number;
    completed: number;
    failed: number;
  };
  worker: string;
  concurrency: number;
  redis: string;
  fallback?: boolean;
  message?: string;
}

export interface SlackStatus {
  connected: boolean;
  connection?: {
    teamId: string;
    teamName: string;
    channelId?: string | null;
  } | null;
}
