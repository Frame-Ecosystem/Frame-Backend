<p align="center">
  <img src="../../../assets/frame-logo-animated.svg" alt="Frame Beauty" width="320" />
</p>

# AuthSystem

> Handles all authentication and authorization flows: signup via magic link, email/password login, Google OAuth 2.0, JWT token management (access + refresh with rotation), password recovery, and multi-device session management.

---

## Table of Contents

- [Overview](#overview)
- [Authentication Flows](#authentication-flows)
- [Database Schema](#database-schema)
- [API Endpoints](#api-endpoints)
- [Multi-Account Session Switching](#multi-account-session-switching)
- [DTOs & Validation](#dtos--validation)
- [Services](#services)
- [Security Features](#security-features)
- [Interfaces](#interfaces)
- [Directory Structure](#directory-structure)

---

## Overview

The AuthSystem is the gateway to the Frame Beauty platform. It supports multiple authentication strategies and manages secure sessions across devices.

**Key Capabilities:**
- Magic link email signup with 6-digit verification codes
- Email/password login with brute-force protection
- Google OAuth 2.0 (login & signup)
- JWT access tokens (15 min) + refresh tokens (7 days) with automatic rotation
- Multi-device session tracking (max 5 sessions per user)
- Forgot/reset password flow
- Per-route rate limiting (signup, login, forgot password)

---

## Authentication Flows

### Signup Flow (Magic Link)

```mermaid
sequenceDiagram
    participant C as Client
    participant API as AuthController
    participant S as AuthService
    participant TS as AuthTokenService
    participant DB as MongoDB
    participant E as Email Service

    C->>API: POST /v1/auth/signup {email, password, type}
    API->>S: signup(userData, deviceInfo)
    S->>DB: Check user doesn't exist
    S->>DB: Hash password, create User (unverified)
    S->>TS: Generate magic link token (JWT)
    S->>DB: Store VerificationToken {email, token, expiresAt}
    S->>E: Send magic link email
    S-->>C: 201 "Check your email"

    C->>API: GET /v1/auth/verify?token=xxx
    API->>S: verifyMagicLink(token, deviceInfo)
    S->>TS: Decode & validate token
    S->>DB: Find VerificationToken, mark user verified
    S->>TS: createToken(user) → access JWT
    S->>TS: generateRefreshToken(user) → refresh JWT
    S-->>C: 200 {user, tokenData, refreshToken} + Set-Cookie
```

### Login Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant API as AuthController
    participant S as AuthService
    participant TS as AuthTokenService
    participant DB as MongoDB

    C->>API: POST /v1/auth/login {email, password}
    API->>S: login(userData, deviceInfo)
    S->>DB: Find user by email
    S->>S: Check not blocked, not locked out
    S->>S: Compare bcrypt password
    alt Wrong password
        S->>DB: Increment failedLoginAttempts
        S-->>C: 401 Unauthorized
    else Correct
        S->>DB: Reset failedLoginAttempts
        S->>TS: createToken(user) → access JWT
        S->>TS: generateRefreshToken(user) → refresh JWT
        S-->>C: 200 {user, tokenData, refreshToken} + Set-Cookie
    end
```

### Token Refresh Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant API as AuthController
    participant TS as AuthTokenService
    participant DB as MongoDB

    C->>API: POST /v1/auth/refresh-token (cookie or body)
    API->>TS: refreshAccessToken(refreshToken, deviceInfo)
    TS->>TS: Verify JWT signature
    TS->>DB: Find user, match jti + tokenHash
    TS->>DB: Remove old refresh token
    TS->>TS: Create new access token
    TS->>TS: Create new refresh token (rotation)
    TS->>DB: Store new refresh token session
    TS-->>C: 200 {tokenData, newRefreshToken} + Set-Cookie
```

### Google OAuth Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant API as Express
    participant G as Google
    participant S as AuthService

    C->>API: GET /v1/auth/google/login (or /signup?type=client)
    API->>G: Redirect to Google consent
    G-->>API: GET /v1/auth/google/callback?code=xxx
    API->>S: googleAuthCallback(profile, state)
    alt Existing user
        S->>S: Generate tokens
    else New user (signup state)
        S->>S: Create user from Google profile
        S->>S: Generate tokens
    end
    S-->>C: Redirect to CLIENT_URL with tokens
```

### Password Reset Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant API as AuthController
    participant TS as AuthTokenService
    participant DB as MongoDB
    participant E as Email Service

    C->>API: POST /v1/auth/forgot-password {email}
    API->>TS: forgotPassword(email)
    TS->>DB: Find user
    TS->>TS: Generate reset token (JWT)
    TS->>E: Send reset link email
    TS-->>C: 200 "Check your email"

    C->>API: POST /v1/auth/reset-password {token, newPassword}
    API->>TS: resetPassword(token, newPassword)
    TS->>TS: Verify token
    TS->>DB: Hash new password, update user
    TS->>DB: Clear all refreshTokens (invalidate sessions)
    TS-->>C: 200 "Password reset successful"
```

---

## Database Schema

### VerificationToken

```mermaid
erDiagram
    VerificationToken {
        ObjectId _id PK
        String email
        String phoneNumber "optional"
        String password "optional, hashed"
        String type "user | client | lounge | admin"
        String tokenType "signup | login | forgot_password"
        String token UK "unique"
        Date expiresAt "TTL auto-delete index"
        Date createdAt
        Date updatedAt
    }
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | String | Yes | User's email address |
| `phoneNumber` | String | No | Optional phone number |
| `password` | String | No | Hashed password (stored during signup before user creation) |
| `type` | String | Yes | User type: `user`, `client`, `lounge`, `admin` |
| `tokenType` | String | Yes | Purpose: `signup`, `login`, `forgot_password` |
| `token` | String | Yes | Unique verification token |
| `expiresAt` | Date | Yes | Auto-delete TTL index — MongoDB removes expired docs automatically |

> **Note:** The AuthSystem also relies heavily on the `User` model from [UserManager](../UserManager/README.md), specifically the `refreshTokens`, `sessionTrack`, `failedLoginAttempts`, `lockUntil`, `passwordChangedAt`, and `oauth` fields.

### User Fields Used by Auth

```mermaid
erDiagram
    User {
        ObjectId _id PK
        String email UK
        String password "bcrypt hashed"
        String type "user | client | lounge | admin"
        Boolean isBlocked "default false"
        Object emailVerification "{isVerified, verifiedAt}"
        Array refreshTokens "[{jti, tokenHash, userAgent, ip, deviceName, createdAt, lastUsedAt}]"
        Object sessionTrack "{isOnline, lastSeen, devices[]}"
        Number failedLoginAttempts "default 0"
        Date lockUntil "null when not locked"
        Date passwordChangedAt
        Object oauth "{google: {id, email, displayName, photo}}"
        Array fcmTokens "[{token, deviceId, platform, createdAt}]"
    }
```

---

## API Endpoints

### Base: `/v1/auth`

| Method | Endpoint | Auth | Rate Limit | Description |
|--------|----------|------|------------|-------------|
| `POST` | `/signup` | No | 3/hr | Register with email — sends magic link |
| `GET` | `/verify` | No | General | Verify magic link token |
| `POST` | `/login` | No | 5/15min | Login with email + password |
| `POST` | `/logout` | Yes | — | Logout current device |
| `POST` | `/logout-all` | Yes | — | Logout all devices |
| `POST` | `/refresh-token` | No* | — | Refresh access token (*uses refresh token) |
| `POST` | `/forgot-password` | No | Forgot PW limit | Send password reset email |
| `POST` | `/reset-password` | No | — | Reset password with token |
| `GET` | `/google/login` | No | — | Initiate Google OAuth (login) |
| `GET` | `/google/signup` | No | — | Initiate Google OAuth (signup with type) |
| `GET` | `/google/callback` | No | — | Google OAuth callback |

### Request/Response Examples

**POST /v1/auth/signup**
```json
// Request
{
  "email": "user@example.com",
  "password": "securePass123",
  "type": "client",
  "firstName": "Ahmed",
  "lastName": "Ben Ali"
}

// Response 201
{
  "message": "Verification email sent. Please check your inbox."
}
```

**POST /v1/auth/login**
```json
// Request
{
  "email": "user@example.com",
  "password": "securePass123"
}

// Response 200
{
  "tokenData": {
    "token": "eyJhbG...",
    "expiresIn": 900
  },
  "refreshToken": "eyJhbG...",
  "user": { "_id": "...", "email": "...", "type": "client", ... }
}
```

---

## Multi-Account Session Switching

**Use Case:** Web clients storing multiple account sessions locally can deterministically switch between accounts without re-login.

**Behavioral Guarantee:** When a switch succeeds (200 response), the next GET /v1/me MUST return the switched user with no silent fallback.

### Overview

Multi-account session switching adds three endpoints to safely rotate between pre-authenticated accounts:

1. **GET /v1/auth/sessions** — List active sessions (max 5 per user)
2. **POST /v1/auth/switch-session** — Switch to a specific session (requires CSRF token)
3. **POST /v1/auth/switch-session/verify** — Verify current session after switch

### Session Identification

Each session has two IDs:

| ID | Purpose | Exposed |
|---|---|---|
| `sessionId` (UUID) | Stable frontend identifier | ✅ Yes (in switch responses) |
| `jti` (JWT ID) | Token rotation tracking | ❌ No (internal only) |

### Endpoints

#### List Sessions (GET /v1/auth/sessions)

Returns all active sessions with masked PII.

**Example:**
```bash
curl -X GET http://localhost:3000/v1/auth/sessions \
  -H "Authorization: Bearer <access-token>"
```

**Response:**
```json
{
  "data": [
    {
      "sessionId": "550e8400-e29b-41d4-a716-446655440000",
      "userId": "user-123",
      "displayName": "John Doe",
      "emailOrPhoneMasked": "j***@example.com",
      "deviceName": "iPhone 12",
      "createdAt": "2025-01-15T10:00:00Z",
      "lastUsedAt": "2025-01-15T14:30:00Z",
      "isCurrent": true
    }
  ]
}
```

#### Switch Session (POST /v1/auth/switch-session)

Switch to a different active session. **Requires CSRF token.**

**Example:**
```bash
curl -X POST http://localhost:3000/v1/auth/switch-session \
  -H "Authorization: Bearer <access-token>" \
  -H "X-CSRF-Token: <csrf-token>" \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "660e8400-e29b-41d4-a716-446655440001"}' \
  -H "Cookie: csrf-token=xxx"
```

**Response (200):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 900,
  "data": {
    "_id": "user-456",
    "email": "account2@example.com",
    "firstName": "Jane",
    "lastName": "Smith"
  }
}
```

**Error Codes:**
- `400` — Invalid/missing sessionId
- `401` — Invalid token or CSRF mismatch
- `403` — Account blocked or not session owner
- `404` — Session not found
- `409` — Session expired
- `429` — Rate limit (10 req/15 min)

#### Verify Current Session (POST /v1/auth/switch-session/verify)

Optional endpoint to verify the current active session ID.

**Example:**
```bash
curl -X POST http://localhost:3000/v1/auth/switch-session/verify \
  -H "Authorization: Bearer <access-token>"
```

**Response (200):**
```json
{
  "data": {
    "sessionId": "660e8400-e29b-41d4-a716-446655440001",
    "userId": "user-456",
    "isCurrentSession": true
  }
}
```

### Security Features

**CSRF Protection:**
- Switch endpoint requires X-CSRF-Token header (same as logout/logout-all)

**Rate Limiting:**
- GET /sessions: 100 req/15 min
- POST /switch-session: **10 req/15 min** (stricter, prevents enumeration)
- POST /verify: 100 req/15 min

**Token Rotation:**
- Old session jti immediately revoked on switch (prevents reuse chain)
- New access + refresh tokens issued for target account
- Refresh token set in HttpOnly cookie (web)

**Audit Logging:**
- All switch attempts logged (success + failure)
- Includes source jti, target sessionId, device info, IP

### Frontend Integration Example

```javascript
// 1. List accounts
const sessions = await fetch('/v1/auth/sessions', {
  headers: { 'Authorization': `Bearer ${accessToken}` }
}).then(r => r.json());

// 2. Get CSRF token
const csrf = await fetch('/v1/auth/csrf-token')
  .then(r => r.headers.get('Set-Cookie').match(/csrf-token=([^;]+)/)[1]);

// 3. Switch to session
const result = await fetch('/v1/auth/switch-session', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'X-CSRF-Token': csrf,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ sessionId: sessions[1].sessionId })
});

if (result.ok) {
  const { token: newToken } = await result.json();
  // Update local state with new access token
  localStorage.setItem('accessToken', newToken);
  
  // Verify switch
  const verify = await fetch('/v1/auth/switch-session/verify', {
    headers: { 'Authorization': `Bearer ${newToken}` }
  }).then(r => r.json());
  console.log('Now logged in as:', verify.data.userId);
}
```

### Data Model Changes

**RefreshTokenSession**
```typescript
{
  sessionId: string;       // NEW: UUID, stable identifier
  jti: string;             // JWT ID, changes on rotation
  tokenHash: string;       // bcrypt hash
  userAgent?: string;
  ip?: string;
  deviceName?: string;
  createdAt: Date;
  expiresAt: Date;
  lastUsedAt?: Date;       // NEW: Last activity in session
}
```

### Migration

- `sessionId` generated on new logins/signups
- Existing sessions gradually expire naturally
- No manual migration needed
- Backward compatible with old clients

### Testing Checklist

**Unit Tests:**
- ✅ listSessions returns active sessions with masked email
- ✅ switchSession validates session ownership
- ✅ switchSession rejects expired/blocked sessions
- ✅ verifyCurrentSession returns correct sessionId

**Integration Tests:**
- ✅ Create two accounts, get two sessionIds
- ✅ Switch between accounts, verify /v1/me changes
- ✅ Reject switch without CSRF token
- ✅ Rate limiting enforcement
- ✅ Old jti rejected after switch

See [MULTI_SESSION_SWITCHING.md](../../MULTI_SESSION_SWITCHING.md) for detailed architecture and behavioral contract.

---

## DTOs & Validation

| DTO | Fields | Validation Rules |
|-----|--------|-----------------|
| `SendVerificationEmailDto` | `email` | `@IsEmail()` |
| `VerifyEmailCodeDto` | `email`, `code` | `@IsEmail()`, `@IsString() @Length(6, 6)` |
| `LoginUserDto` | `email`, `password` | `@IsEmail()`, `@IsString() @MinLength(8)` |
| `ForgotPasswordDto` | `email` | `@IsEmail()` |
| `ResetPasswordDto` | `token`, `newPassword` | `@IsString()`, `@IsString() @MinLength(8)` |
| `SessionIdDto` | `sessionId` | `@IsString()` |

---

## Services

### AuthService (Orchestrator)

The main service that coordinates between token and session services.

| Method | Description |
|--------|-------------|
| `signup(userData, deviceInfo?)` | Dedup check → hash password → create user → generate magic link → send email |
| `verifyMagicLink(token, deviceInfo)` | Validate token → mark user verified → generate access + refresh tokens |
| `login(userData, deviceInfo?)` | Validate credentials → lockout check → block check → generate tokens |
| `forgotPassword(email)` | Delegates to AuthTokenService |
| `resetPassword(token, newPassword)` | Delegates to AuthTokenService |
| `refreshAccessToken(refreshToken, deviceInfo)` | Token rotation via AuthTokenService |
| `logout(userData, jti?)` | Remove single session via AuthSessionService |
| `logoutAllDevices(userId)` | Clear all sessions via AuthSessionService |
| `generateTokensForOAuthUser(user, deviceInfo)` | For Google OAuth flow |

### AuthTokenService

Handles JWT creation, verification, and refresh token management.

| Method | Description |
|--------|-------------|
| `createToken(user)` | Signs JWT `{_id, type}` with `ACCESS_TOKEN_EXPIRES` (15 min) |
| `generateRefreshToken(user, deviceInfo?)` | Creates unique `jti`, hashes token, stores in `user.refreshTokens`, enforces max 5 sessions |
| `refreshAccessToken(refreshToken, deviceInfo)` | Verifies → rotates → returns new token pair |
| `getUserByToken(token)` | Decodes JWT, finds user |
| `forgotPassword(email)` | Generates reset token, sends email |
| `resetPassword(token, newPassword)` | Validates token → hashes password → invalidates all sessions |

### AuthSessionService

Manages multi-device sessions and online status tracking.

| Method | Description |
|--------|-------------|
| `updateSessionTrack(userId, sessions)` | Updates `sessionTrack` with active devices |
| `parseDeviceName(userAgent?)` | Extracts device name from User-Agent header |
| `getDevicesFromSessions(sessions)` | Extracts device info from refresh token sessions |
| `logout(userData, jti?)` | Removes single session by `jti` |
| `logoutAllDevices(userId)` | Clears all `refreshTokens`, sets offline |
| `generateTokensForOAuthUser(user, deviceInfo)` | Access + refresh for OAuth flow |

---

## Security Features

| Feature | Implementation |
|---------|---------------|
| **Password Hashing** | bcrypt with 10 rounds |
| **Brute Force Protection** | 5 failed attempts → 15 min lockout |
| **Token Rotation** | Refresh tokens are single-use, rotated on each refresh |
| **Session Limit** | Max 5 concurrent sessions per user; oldest removed on overflow |
| **CSRF Protection** | Double-submit cookie pattern |
| **Rate Limiting** | Login: 5/15min, Signup: 3/hr, Forgot password: dedicated limit |
| **Token TTL** | Verification tokens auto-deleted via MongoDB TTL index |
| **Account Blocking** | Blocked users cannot authenticate |
| **Secure Cookies** | httpOnly, secure, sameSite for refresh tokens |

---

## Interfaces

```typescript
// Request with authenticated user
interface RequestWithUser extends Request {
  user: User;
}

// JWT payload
interface DataStoredInToken {
  _id: string;
  type: string;  // user | client | lounge | admin
}

// Access token response
interface TokenData {
  token: string;
  expiresIn: number;
}

// Refresh token JWT payload
interface RefreshTokenPayload {
  _id: string;
  type: string;
  jti: string;    // unique session ID
  iat: number;
  exp: number;
}

// Stored refresh token session
interface RefreshTokenSession {
  jti: string;
  tokenHash: string;
  userAgent?: string;
  ip?: string;
  deviceName?: string;
  createdAt: Date;
  lastUsedAt: Date;
}
```

---

## Directory Structure

```
AuthSystem/
├── controllers/
│   └── auth.controller.ts       # HTTP handlers for all auth endpoints
├── dtos/
│   └── auth.dto.ts              # Request validation DTOs
├── interfaces/
│   └── auth.interface.ts        # RequestWithUser, TokenData, etc.
├── models/
│   └── verificationToken.model.ts  # Mongoose schema for verification tokens
├── routes/
│   └── auth.route.ts            # Express route definitions
├── services/
│   ├── auth.service.ts          # Main auth orchestrator
│   ├── authToken.service.ts     # JWT & refresh token logic
│   └── authSession.service.ts   # Session management
└── tests/
    └── auth.test.ts             # Auth integration tests
```
