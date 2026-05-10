import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import prisma from './prisma.js';

// Debug: confirm env vars are loaded when this module runs
console.log('[passport] GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? '✓ loaded' : '✗ MISSING — dotenv not loaded before this file');
console.log('[passport] GOOGLE_CALLBACK_URL:', process.env.GOOGLE_CALLBACK_URL || '✗ MISSING');

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails[0].value;
        const name = profile.displayName;
        const googleId = profile.id;

        console.log('[passport] Google OAuth success for:', email);

        let user = await prisma.user.findFirst({
          where: {
            OR: [{ email }, { googleId }],
          },
        });

        if (user) {
          if (!user.googleId) {
            user = await prisma.user.update({
              where: { id: user.id },
              data: { googleId },
            });
          }
          return done(null, user);
        }

        user = await prisma.user.create({
          data: {
            name,
            email,
            googleId,
            role: 'customer',
          },
        });

        return done(null, user);
      } catch (error) {
        console.error('[passport] Google strategy error:', error);
        return done(error, null);
      }
    }
  )
);

export default passport;