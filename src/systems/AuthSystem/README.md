# AuthSystem

Handles all authentication, authorization, and session management for the Frame Beauty platform. Supports both email/password and Google OAuth flows.

## Responsibilities

- User registration via **magic-link email verification**
- Login with bcrypt password hashing and account lockout after max failed attempts
- **JWT access tokens** + **refresh token rotation** with reuse detection
- Forgot password / reset password flows
- Google OAuth 2.0 integration (via Passport.js)
- Per-device session tracking
- CSRF protection (double-submit cookie for web; exempt for mobile)

## Structure

```
AuthSystem/
├── controllers/    auth.controller.ts
├── services/       auth.service.ts · authToken.service.ts · authSession.service.ts
├── models/         verificationToken.model.ts
├── routes/         auth.route.ts
├── dtos/           auth.dto.ts
├── interfaces/     auth.interface.ts
└── tests/          auth.test.ts
```

## Key Entities

| Entity | Description |
|---|---|
| `VerificationToken` | Magic-link and password-reset tokens with expiry |

## API Routes

| Method | Path | Description |
|---|---|---|
| POST | `/v1/auth/signup` | Register — sends magic-link |
| POST | `/v1/auth/verify-email` | Verify email token, create account |
| POST | `/v1/auth/login` | Login with email + password |
| POST | `/v1/auth/refresh-token` | Rotate refresh token |
| POST | `/v1/auth/forgot-password` | Send password reset email |
| POST | `/v1/auth/reset-password` | Apply new password |
| GET  | `/v1/auth/google` | Initiate Google OAuth |
| GET  | `/v1/auth/google/callback` | Google OAuth callback |
| POST | `/v1/auth/logout` | Invalidate session |

## Dependencies

- **Inbound**: none — this is the entry point for all users
- **Outbound**: `UserManager` (user model), `NotificationSystem` (email)

## Security Notes

- Refresh tokens are one-time-use with reuse detection (revokes all sessions on reuse)
- Account locked after `MAX_FAILED_LOGIN_ATTEMPTS` consecutive failures
- CSRF token required for all mutation endpoints on web clients
