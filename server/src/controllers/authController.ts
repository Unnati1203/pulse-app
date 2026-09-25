import { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { prisma } from '../config/prisma';
import { log } from '../utils/logger';
import { fail, ok } from '../utils/response';

const frontend = process.env.FRONTEND_URL || 'http://localhost:5173';

export const setupPassport = () => {
  passport.serializeUser((u: any, done) => done(null, u));
  passport.deserializeUser(async (user: any, done) => {
    try {
      done(null, typeof user === 'object' ? user : await prisma.user.findUnique({ where: { id: user } }));
    } catch (e) {
      done(null, { id: user });
    }
  });

  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/api/auth/google/callback',
        },
        async (_a, _r, profile, done) => {
          const email = profile.emails?.[0]?.value;
          try {
            if (!email) return done(new Error('Google account did not provide an email'));
            const user = await prisma.user.upsert({
              where: { googleId: profile.id },
              update: { name: profile.displayName, email, avatar: profile.photos?.[0]?.value },
              create: { googleId: profile.id, name: profile.displayName, email, avatar: profile.photos?.[0]?.value },
            });
            done(null, user);
          } catch (e) {
            log.warn({ err: e }, 'Database unavailable; using Google profile for session');
            done(null, {
              id: `google-${profile.id}`,
              googleId: profile.id,
              name: profile.displayName,
              email,
              avatar: profile.photos?.[0]?.value,
            });
          }
        }
      )
    );
  }
};

export const googleAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return fail(res, 503, 'Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.', 'OAUTH_NOT_CONFIGURED');
  }
  passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'select_account' })(req, res, next);
};

export const googleCallback = (req: Request, res: Response, next: NextFunction) => {
  res.setTimeout(10000, () => {
    if (!res.headersSent) res.redirect(`${frontend}/?error=oauth_backend`);
  });
  passport.authenticate('google', { failureRedirect: `${frontend}/login?error=oauth` })(req, res, () =>
    req.session.save((err) => (err ? next(err) : res.redirect(frontend)))
  );
};

export const getMe = (req: Request, res: Response) => {
  return req.isAuthenticated() ? ok(res, { user: req.user }) : ok(res, { user: null });
};

export const logout = (req: Request, res: Response) => {
  req.logout((err) =>
    err ? fail(res, 500, 'Could not log out.', 'LOGOUT_FAILED') : req.session.destroy(() => ok(res, { loggedOut: true }))
  );
};
