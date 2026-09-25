import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { log } from '../utils/logger';
import { fail } from '../utils/response';

export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  log.error({ err }, 'Request failed');
  if (err instanceof z.ZodError) {
    return fail(res, 400, err.issues[0]?.message || 'Invalid request.', 'VALIDATION_ERROR');
  }
  if (err instanceof SyntaxError) {
    return fail(res, 400, 'Malformed JSON request.', 'BAD_JSON');
  }
  return fail(res, 500, 'Something went wrong.', 'INTERNAL_ERROR');
};
