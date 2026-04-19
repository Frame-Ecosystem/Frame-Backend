import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { User } from '@systems/UserManager/interfaces/user.interface';
import { Document } from 'mongoose';
import userModel from '@systems/UserManager/models/user.model';
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } from '@config';
import { logger } from '@utils/logger';

/**
 * Build Google OAuth profile data from a passport profile object.
 */
function buildGoogleOAuthData(profile: any) {
  return {
    id: profile.id,
    email: profile.emails?.[0]?.value,
    name: profile.displayName,
    picture: profile.photos?.[0]?.value,
    verified: profile.emails?.[0]?.verified || false,
  };
}

/**
 * Sanitize legacy refreshTokens that may not match the current schema.
 * Removes only malformed entries instead of destroying all sessions.
 */
function sanitizeRefreshTokens(user: any): void {
  if (!Array.isArray(user.refreshTokens)) return;
  const original = user.refreshTokens.length;
  user.refreshTokens = user.refreshTokens.filter((s: any) => typeof s?.tokenHash === 'string' && s?.expiresAt instanceof Date);
  if (user.refreshTokens.length < original) {
    logger.warn(`sanitizeRefreshTokens: removed ${original - user.refreshTokens.length} malformed tokens for user ${user._id}`);
  }
}

// Validate Google OAuth config at startup
if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  logger.warn('⚠️ Google OAuth is not configured (GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET missing). OAuth routes will fail.');
}

// Configure Passport Google OAuth Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: GOOGLE_REDIRECT_URI,
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        const state = (req.query.state as string) || 'login';

        // Check if user already exists with this Google ID
        const user = await userModel.findOne({ 'oauth.google.id': profile.id });

        if (user) {
          if (state.startsWith('signup:')) {
            return done(null, false, { message: 'account_exists' });
          }
          if (user.isBlocked) {
            return done(null, false, { message: 'account_blocked' });
          }
          user.oauth.google = buildGoogleOAuthData(profile);
          sanitizeRefreshTokens(user);
          await user.save();
          return done(null, user);
        }

        // Check if user exists with same email
        const existingUser = await userModel.findOne({ email: profile.emails?.[0]?.value });

        if (existingUser) {
          if (state.startsWith('signup:')) {
            return done(null, false, { message: 'account_exists' });
          }
          if (existingUser.isBlocked) {
            return done(null, false, { message: 'account_blocked' });
          }
          existingUser.oauth = existingUser.oauth || {};
          existingUser.oauth.google = buildGoogleOAuthData(profile);
          sanitizeRefreshTokens(existingUser);
          await existingUser.save();
          return done(null, existingUser);
        }

        // No existing user — must be a signup flow
        if (state === 'login') {
          return done(null, false, { message: 'account_not_found' });
        }

        const userType = state.startsWith('signup:') ? state.split(':')[1] || 'user' : 'user';

        const newUser = await userModel.create({
          email: profile.emails?.[0]?.value,
          type: userType,
          oauth: { google: buildGoogleOAuthData(profile) },
          emailVerification: [{ isVerified: true }],
          sessionTrack: { isOnline: false, devices: [] },
        });

        return done(null, newUser);
      } catch (error) {
        logger.error('Google OAuth error:', error);
        return done(error, null);
      }
    },
  ),
);

// Serialize user for session
passport.serializeUser((user: User & Document, done) => {
  done(null, user._id);
});

// Deserialize user from session
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await userModel.findById(id).select('-password -refreshTokens');
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;
