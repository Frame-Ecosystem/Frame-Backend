import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { User } from '@interfaces/users.interface';
import userModel from '@models/users.model';
import { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } from '@config';
import { logger } from '@utils/logger';

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
        const state = (req.query.state as string) || 'login'; // Default to login if no state

        // Check if user already exists with this Google ID
        const user = await userModel.findOne({ 'oauth.google.id': profile.id });

        if (user) {
          // Existing user with Google ID
          if (state.startsWith('signup:')) {
            // Trying to signup but user exists - block
            return done(new Error('User already exists. Please use login instead.'), null);
          }
          // For login or other, proceed
          user.oauth.google = {
            id: profile.id,
            email: profile.emails?.[0]?.value,
            name: profile.displayName,
            picture: profile.photos?.[0]?.value,
            verified: profile.emails?.[0]?.verified || false,
          };

          // Sanitize legacy refreshTokens that may not match current schema
          if (Array.isArray((user as any).refreshTokens)) {
            const valid = (user as any).refreshTokens.every((s: any) => typeof s?.tokenHash === 'string' && s?.expiresAt instanceof Date);
            if (!valid) {
              (user as any).refreshTokens = [];
            }
          }
          await user.save();
          return done(null, user);
        }

        // Check if user exists with same email
        const existingUser = await userModel.findOne({ email: profile.emails?.[0]?.value });

        if (existingUser) {
          // Link Google account to existing user
          if (state.startsWith('signup:')) {
            // Trying to signup but user exists - block
            return done(new Error('User already exists. Please use login instead.'), null);
          }
          existingUser.oauth = existingUser.oauth || {};
          existingUser.oauth.google = {
            id: profile.id,
            email: profile.emails?.[0]?.value,
            name: profile.displayName,
            picture: profile.photos?.[0]?.value,
            verified: profile.emails?.[0]?.verified || false,
          };
          // Sanitize legacy refreshTokens
          if (Array.isArray((existingUser as any).refreshTokens)) {
            const valid = (existingUser as any).refreshTokens.every((s: any) => typeof s?.tokenHash === 'string' && s?.expiresAt instanceof Date);
            if (!valid) {
              (existingUser as any).refreshTokens = [];
            }
          }
          await existingUser.save();
          return done(null, existingUser);
        }

        // No existing user
        if (state === 'login') {
          // Trying to login but user doesn't exist - block
          return done(new Error('User does not exist. Please use signup instead.'), null);
        }

        // For signup
        let userType = 'user';
        if (state.startsWith('signup:')) {
          userType = state.split(':')[1] || 'user';
        }

        // Create new user
        const userData = {
          email: profile.emails?.[0]?.value,
          type: userType,
          oauth: {
            google: {
              id: profile.id,
              email: profile.emails?.[0]?.value,
              name: profile.displayName,
              picture: profile.photos?.[0]?.value,
              verified: profile.emails?.[0]?.verified || false,
            },
          },
          emailVerification: [{ isVerified: true }], // Google OAuth emails are verified
          sessionTrack: {
            isOnline: false,
            devices: [],
          },
        };

        const newUser = await userModel.create(userData);
        return done(null, newUser);
      } catch (error) {
        logger.error('Google OAuth error:', error);
        return done(error, null);
      }
    },
  ),
);

// Serialize user for session
passport.serializeUser((user: User, done) => {
  done(null, user._id);
});

// Deserialize user from session
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await userModel.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;
