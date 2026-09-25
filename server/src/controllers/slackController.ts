import { Request, Response, NextFunction } from 'express';
import axios from 'axios';
import crypto from 'crypto';
import { prisma } from '../config/prisma';
import { fail, ok } from '../utils/response';

const frontend = process.env.FRONTEND_URL || 'http://localhost:5173';

export const getSlackStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const c = await prisma.slackConnection.findUnique({
      where: { userId: (req.user as any).id },
      select: { teamId: true, teamName: true, channelId: true },
    });
    ok(res, { connected: !!c, connection: c });
  } catch (e) {
    next(e);
  }
};

export const connectSlack = (req: Request, res: Response) => {
  if (!process.env.SLACK_CLIENT_ID || !process.env.SLACK_CLIENT_SECRET) {
    return fail(res, 503, 'Slack OAuth is not configured. Set SLACK_CLIENT_ID and SLACK_CLIENT_SECRET.', 'SLACK_NOT_CONFIGURED');
  }
  const state = crypto.randomBytes(24).toString('hex');
  (req.session as any).slackState = state;
  (req.session as any).slackUserId = (req.user as any).id;

  const params = new URLSearchParams({
    client_id: process.env.SLACK_CLIENT_ID,
    scope: 'chat:write, incoming-webhook',
    redirect_uri: process.env.SLACK_CALLBACK_URL || 'http://localhost:4000/api/slack/callback',
    state,
  });

  res.redirect(`https://slack.com/oauth/v2/authorize?${params.toString()}`);
};

export const slackCallback = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const state = req.query.state;
    const code = req.query.code;
    if (!state || state !== (req.session as any).slackState || typeof code !== 'string') {
      return res.redirect(`${frontend}/integrations?error=slack_state`);
    }
    delete (req.session as any).slackState;

    const token = await axios.post(
      'https://slack.com/api/oauth.v2.access',
      new URLSearchParams({
        client_id: process.env.SLACK_CLIENT_ID || '',
        client_secret: process.env.SLACK_CLIENT_SECRET || '',
        code,
        redirect_uri: process.env.SLACK_CALLBACK_URL || '',
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    if (!token.data.ok) throw new Error(token.data.error);

    await prisma.slackConnection.upsert({
      where: { userId: (req.session as any).slackUserId },
      update: {
        teamId: token.data.team.id,
        teamName: token.data.team.name,
        channelId: token.data.incoming_webhook?.channel_id || null,
        accessToken: token.data.access_token,
      },
      create: {
        userId: (req.session as any).slackUserId,
        teamId: token.data.team.id,
        teamName: token.data.team.name,
        channelId: token.data.incoming_webhook?.channel_id || null,
        accessToken: token.data.access_token,
      },
    });

    res.redirect(`${frontend}/integrations?slack=connected`);
  } catch (e) {
    next(e);
  }
};

export const disconnectSlack = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.slackConnection.deleteMany({ where: { userId: (req.user as any).id } });
    ok(res, { disconnected: true });
  } catch (e) {
    next(e);
  }
};
