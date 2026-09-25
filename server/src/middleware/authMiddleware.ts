import { Request, Response, NextFunction } from 'express';
import { fail } from '../utils/response';

export const auth = (req: Request, res: Response, next: NextFunction) => {
  if (req.isAuthenticated()) return next();
  return fail(res, 401, 'Sign in to continue.', 'UNAUTHENTICATED');
};
