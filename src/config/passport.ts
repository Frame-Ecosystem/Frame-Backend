import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { User } from '@systems/UserManager/interfaces/user.interface';
import { Document } from 'mongoose';
import userModel from '@systems/UserManager/models/user.model';
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } from '@config';
import { sanitizeGoogleSignupType } from '@utils/google-signup-type';
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
 *
 * @returns true when malformed entries were removed (i.e. the field must be persisted).
 */
function sanitizeRefreshTokens(user: any): boolean {
  if (!Array.isArray(user.refreshTokens)) return false;
  const original = user.refreshTokens.length;
  user.refreshTokens = user.refreshTokens.filter((s: any) => typeof s?.tokenHash === 'string' && s?.expiresAt instanceof Date);
  const pruned = user.refreshTokens.length !== original;
  if (pruned) {
    logger.warn(`sanitizeRefreshTokens: removed ${original - user.refreshTokens.length} malformed tokens for user ${user._id}`);
  }
  return pruned;
}

/**
 * Persist Google profile data on an existing account.
 *
 * Uses a scoped `$set` update instead of `document.save()` on purpose: `save()`
 * validates the whole document, so any legacy/invalid field on the record (e.g.
 * `passwordStrength: null` from an older schema) would block the OAuth login
 * even though nothing about it is being written. Mongoose timestamps still keep
 * `updatedAt` fresh.
 */
async function linkGoogleAccount(user: any, profile: any): Promise<void> {
  const oauthData = buildGoogleOAuthData(profile);
  user.oauth.google = oauthData;

  const updates: Record<string, unknown> = { 'oauth.google': oauthData };
  if (sanitizeRefreshTokens(user)) updates.refreshTokens = user.refreshTokens;

  const result = await userModel.updateOne({ _id: user._id }, { $set: updates });
  // `save()` used to throw when the document was gone; keep that failure mode so
  // the flow does not continue with a user record that no longer exists.
  if (result.matchedCount === 0) {
    throw new Error(`Google OAuth linking failed: user ${user._id} no longer exists`);
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
          await linkGoogleAccount(user, profile);
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
          await linkGoogleAccount(existingUser, profile);
          return done(null, existingUser);
        }

        // No existing user — must be a signup flow
        if (state === 'login') {
          return done(null, false, { message: 'account_not_found' });
        }

        // The OAuth `state` is client-controlled, so re-validate the requested role
        // here as well: this is the last gate before the account is created.
        const userType = state.startsWith('signup:') ? sanitizeGoogleSignupType(state.split(':')[1]) : 'client';

        const newUser = await userModel.create({
          email: profile.emails?.[0]?.value,
          type: userType,
          oauth: { google: buildGoogleOAuthData(profile) },
          emailVerification: [{ isVerified: true }],
          sessionTrack: { isOnline: false, devices: [] },
        });

        return done(null, newUser);
      } catch (error) {
        const err = error as { name?: string; message?: string; oauthError?: { code?: string; message?: string } };
        logger.error(
          `Google OAuth error: ${err?.name || 'Error'}: ${err?.message || 'unknown error'}` +
            (err?.oauthError ? ` (oauthError=${err.oauthError.code || 'unknown'}: ${err.oauthError.message || ''})` : ''),
          { stack: (error as Error)?.stack },
        );
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
