import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import { RedisStore } from 'connect-redis';
import cors from 'cors';
import helmet from 'helmet';
import passport from 'passport';
import { redis } from './config/redis';
import { prisma } from './config/prisma';
import { emailWorker, concurrency } from './queue/emailWorker';
import { emailQueue } from './queue/emailQueue';
import { restoreScheduledJobs } from './queue/jobRestorer';
import { createBullBoardAdapter } from './queue/bullBoard';
import { setupPassport } from './controllers/authController';
import routes from './routes';
import { auth } from './middleware/authMiddleware';
import { errorHandler } from './middleware/errorHandler';
import { log } from './utils/logger';

const app = express();
const frontend = process.env.FRONTEND_URL || 'http://localhost:5173';

app.set('trust proxy', 1);
app.use(helmet({ crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' } }));
app.use(cors({ origin: frontend, credentials: true }));
app.use(express.json({ limit: '2mb' }));

const sessionOptions: session.SessionOptions = {
  secret: process.env.SESSION_SECRET || 'development-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 86400000,
  },
};

if (process.env.USE_REDIS_SESSION === 'true') {
  sessionOptions.store = new RedisStore({ client: redis as any, prefix: 'pulse:sess:' });
}

app.use(session(sessionOptions));
app.use(passport.initialize());
app.use(passport.session());
setupPassport();

// API Routes
app.use('/api', routes);

// Bull Board Admin UI
app.use('/admin/queues', (req, res, next) => auth(req, res, next));
const bullBoard = createBullBoardAdapter();
app.use('/admin/queues', bullBoard.getRouter());

// Global Error Handler
app.use(errorHandler);

// Restore scheduled jobs from DB into BullMQ queue on startup
void restoreScheduledJobs();

// Listen with fallback port handling
const preferredPort = Number(process.env.PORT || 4000);
const listenWithFallback = (port: number) => {
  const server = app.listen(port, '0.0.0.0', () =>
    log.info({ port, concurrency }, 'Pulse API and email worker started')
  );

  server.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EADDRINUSE') {
      const nextPort = port + 1;
      log.warn({ port, nextPort }, 'Port already in use; retrying on next available port.');
      listenWithFallback(nextPort);
      return;
    }
    throw error;
  });
};

listenWithFallback(preferredPort);

// Graceful Shutdown
process.on('SIGTERM', async () => {
  await emailWorker.close();
  await emailQueue.close();
  await redis.quit();
  await prisma.$disconnect();
  process.exit(0);
});
