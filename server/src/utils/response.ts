import { Response } from 'express';

export const fail = (res: Response, status: number, message: string, code: string) =>
  res.status(status).json({ success: false, message, code });

export const ok = (res: Response, data: unknown, status = 200) =>
  res.status(status).json({ success: true, data });
