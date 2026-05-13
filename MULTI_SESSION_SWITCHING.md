# Multi-Account Session Switching

> Deterministic session switching for web clients storing multiple accounts locally. Enables users to switch between pre-authenticated accounts without re-login.

---

## Overview

When frontend stores multiple account sessions locally (Account X, Y, Z), users may switch accounts. The backend ensures:

1. **Explicit Switching**: Frontend can request to switch to sessionId X
2. **Deterministic Identity**: After switch, `/v1/me` returns the exact switched account (no fallback)
3. **Fresh Artifacts**: New access token + refresh token issued for target session
4. **Secure Token Handling**: Refresh token rotates on switch; old chain invalidated
5. **CSRF Protection**: Switch endpoint requires valid CSRF token
6. **Rate Limiting**: Prevents brute-force session enumeration
7. **Audit Logging**: All switch attempts logged with source/target session IDs

---

## Architecture

### Session Identification

Each session is identified by two IDs:

| ID | Purpose | Lifetime | Exposure |
|---|---|---|---|
| `sessionId` (UUID) | Server-managed stable identifier | Same as refresh token (7d) | ✅ Exposed in list/switch responses |
| `jti` (JWT ID) | Token claim for rotation tracking | Same as refresh token (7d) | ❌ Never exposed to frontend |

**Why two IDs?**
- `sessionId` is predictable, frontend-friendly, stable across token rotations
- `jti` changes with each token refresh, enables reuse detection and rotation

### Session Lifecycle

```
┌─────────────────────────────────────────────────────────┐
│ Login/Signup                                            │
│ - Create new sessionId (UUID)                           │
│ - Create new jti (from JWT encode)                      │
│ - Store session: {sessionId, jti, hash, deviceInfo}    │
│ - Issue refresh token (payload: {_id, jti})           │
│ - Set HttpOnly cookie                                  │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ Normal Use (POST /v1/me, etc.)                         │
│ - Access token from Authorization header               │
│ - Auth middleware validates token                      │
│ - Request proceeds with req.user                       │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ Optional: List Active Sessions                          │
│ GET /v1/auth/sessions                                  │
│ Response: [{sessionId, userId, displayName, ...}]     │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ Switch Session (Deterministic)                         │
│ POST /v1/auth/switch-session {sessionId}              │
│ - Verify sessionId owned by user                       │
│ - Verify session active & not expired                  │
│ - Revoke old session jti (prevent reuse chain)        │
│ - Issue new token + refresh token for target session  │
│ - Update HttpOnly cookie                              │
│ - Audit log: {actor, source jti, target jti}         │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│ Verify Switch (Optional)                               │
│ POST /v1/auth/switch-session/verify                   │
│ Response: {sessionId, userId, isCurrentSession: true} │
└─────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### List Sessions

**Endpoint:** `GET /v1/auth/sessions`

**Auth:** Requires valid access token (Authorization header)

**Rate Limit:** 100 req/15 min

**Response 200:**
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
    },
    {
      "sessionId": "660e8400-e29b-41d4-a716-446655440001",
      "userId": "user-123",
      "displayName": "John Doe",
      "emailOrPhoneMasked": "j***@example.com",
      "deviceName": "Android Phone",
      "createdAt": "2025-01-16T09:15:00Z",
      "lastUsedAt": "2025-01-16T11:20:00Z",
      "isCurrent": false
    }
  ],
  "message": "Sessions retrieved successfully"
}
```

**Error Cases:**
- 401: Invalid/expired access token
- 429: Rate limit exceeded

---

### Switch Session

**Endpoint:** `POST /v1/auth/switch-session`

**Auth:** Requires valid access token + valid CSRF token

**Rate Limit:** 10 req/15 min (strictRateLimiter)

**Validation:** SwitchSessionDto (body)

**Request:**
```json
{
  "sessionId": "660e8400-e29b-41d4-a716-446655440001"
}
```

**Response 200:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 900,
  "data": {
    "_id": "user-123",
    "email": "test@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "type": "user",
    ...
  },
  "message": "Session switched successfully"
}
```

**Response 200 (Mobile client):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 900,
  "data": {...},
  "message": "Session switched successfully"
}
```

**Error Cases:**
- 400: Invalid/missing sessionId
- 401: Invalid/expired access token, invalid CSRF token
- 403: CSRF mismatch, account blocked
- 404: Session not found
- 409: Session expired
- 429: Rate limit exceeded

**Side Effects:**
- ✅ New refresh token issued & set in HttpOnly cookie
- ✅ New CSRF token set in cookie (if web client)
- ✅ Old session's jti revoked (prevents reuse chain)
- ✅ Audit log created with switch details
- ✅ `sessionTrack.lastSeen` updated

---

### Verify Current Session

**Endpoint:** `POST /v1/auth/switch-session/verify`

**Auth:** Requires valid access token

**Rate Limit:** 100 req/15 min

**Purpose:** Verify current active sessionId after a switch (optional, for frontend assertion)

**Response 200:**
```json
{
  "data": {
    "sessionId": "660e8400-e29b-41d4-a716-446655440001",
    "userId": "user-123",
    "isCurrentSession": true
  },
  "message": "Session verified successfully"
}
```

**Error Cases:**
- 401: Invalid/expired access token
- 404: Current session not found

---

## Behavioral Contract

**Frontend Guarantee:**
> "If POST /v1/auth/switch-session returns 200, the next GET /v1/me MUST return the switched user, with no silent fallback."

**Backend Guarantee:**
1. ✅ Switch endpoint validates session ownership
2. ✅ Switch endpoint verifies session active & not expired
3. ✅ Switch endpoint rejects with explicit error codes (no guessing)
4. ✅ On 200 response, issued tokens are bound to target account
5. ✅ Old session (jti) is revoked immediately
6. ✅ No cookie-based fallback to previous account

**Security Implications:**
- 🔒 CSRF token required (prevents malicious sites triggering switch)
- 🔒 Rate limiting prevents brute-force session enumeration
- 🔒 Audit log tracks all attempts (success + failure)
- 🔒 Failed switch never alters current session

---

## Security Features

### CSRF Protection

Switch endpoint requires valid CSRF token (same as logout, logout-all):

```bash
# Get CSRF token
curl -X GET http://localhost:3000/v1/auth/csrf-token \
  -H "Cookie: csrf-token=xxx" \
  -H "X-Requested-With: XMLHttpRequest"

# Switch session with CSRF token in header
curl -X POST http://localhost:3000/v1/auth/switch-session \
  -H "Authorization: Bearer <access-token>" \
  -H "X-CSRF-Token: <csrf-token>" \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "session-id"}' \
  -H "Cookie: csrf-token=xxx"
```

### Rate Limiting

- `GET /v1/auth/sessions`: 100 req/15 min (generalRateLimiter)
- `POST /v1/auth/switch-session`: 10 req/15 min (strictRateLimiter) — stricter to prevent enumeration
- `POST /v1/auth/switch-session/verify`: 100 req/15 min (generalRateLimiter)

### Audit Logging

Every switch attempt is logged:

```javascript
{
  event: 'SESSION_SWITCH_SUCCESS' | 'SESSION_SWITCH_FAILED',
  userId: '...',
  sourceSessionId: '...', // Old jti
  targetSessionId: '...', // Target sessionId
  reason: 'Session not found' | 'Session expired' | 'Account blocked' | null,
  deviceName: '...',
  ip: '...',
  userAgent: '...',
  timestamp: ISO8601,
}
```

### Token Rotation on Switch

Old jti immediately revoked:
- Prevents reuse chain attacks
- Ensures token can't be replayed in old context
- Client must use new refresh token from switch response

---

## Frontend Integration Example

```javascript
// 1. Get list of stored accounts
const sessionsResponse = await fetch('/v1/auth/sessions', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${currentAccessToken}`,
  },
});
const sessions = await sessionsResponse.json();
// [{sessionId: "xxx", displayName: "Account 1", deviceName: "iPhone"}, ...]

// 2. User selects Account 2 from UI
const targetSessionId = sessions[1].sessionId;

// 3. Get CSRF token
const csrfResponse = await fetch('/v1/auth/csrf-token');
const csrfToken = csrfResponse.headers.get('Set-Cookie').match(/csrf-token=([^;]+)/)[1];

// 4. Switch to Account 2
const switchResponse = await fetch('/v1/auth/switch-session', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${currentAccessToken}`,
    'X-CSRF-Token': csrfToken,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ sessionId: targetSessionId }),
});

if (switchResponse.ok) {
  const { token: newAccessToken } = await switchResponse.json();
  // Update local auth state with new access token
  localStorage.setItem('accessToken', newAccessToken);
  // Refresh cookie automatically set by response headers

  // 5. Verify switch succeeded
  const verifyResponse = await fetch('/v1/auth/switch-session/verify', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${newAccessToken}`,
    },
  });
  console.log('Current session:', await verifyResponse.json());

  // 6. Load user profile (must be new account)
  const meResponse = await fetch('/v1/me', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${newAccessToken}`,
    },
  });
  const profile = await meResponse.json();
  console.log('Now logged in as:', profile.data.email);
} else {
  console.error('Switch failed:', switchResponse.status, await switchResponse.json());
}
```

---

## Data Model

### RefreshTokenSession

```typescript
interface RefreshTokenSession {
  sessionId: string;     // UUID, stable identifier for switch
  jti: string;           // JWT ID, changes on rotation
  tokenHash: string;     // bcrypt hash of refresh token
  userAgent?: string;    // User agent string
  ip?: string;           // Client IP
  deviceName?: string;   // Parsed device name (iPhone, Android, etc)
  createdAt: Date;       // Session creation timestamp
  expiresAt: Date;       // Session expiration (7 days)
  lastUsedAt?: Date;     // Last activity within session
}
```

### User.refreshTokens

```typescript
interface User {
  _id: ObjectId;
  email: string;
  refreshTokens?: RefreshTokenSession[];  // Max 5 sessions
  sessionTrack: {
    isOnline: boolean;
    lastSeen?: Date;
    devices: { name: string; ipAddress?: string }[];  // Derived from refreshTokens
  };
  // ... other fields
}
```

---

## Migration & Backward Compatibility

**What Changed:**
- `RefreshTokenSession` now includes `sessionId` field
- Access token payload unchanged (still just `{_id, iat, exp}`)
- Refresh token payload unchanged (still `{_id, jti, iat, exp}`)

**Migration Path:**
1. Add `sessionId` field to schema (optional initially)
2. Deploy code update (generates sessionId on new sessions)
3. Old sessions gradually expire naturally
4. No data migration needed

**Backward Compatibility:**
- Existing clients (without switch logic) unaffected
- `/v1/auth/refresh-token` works unchanged
- New endpoints don't break old clients

---

## Testing Checklist

### Unit Tests
- ✅ listSessions: Returns active sessions with correct masking
- ✅ listSessions: Filters expired sessions
- ✅ listSessions: Shows isCurrent=true only for current jti
- ✅ switchSession: Switches to owned active session
- ✅ switchSession: Rejects non-owned session (403)
- ✅ switchSession: Rejects expired session (409)
- ✅ switchSession: Rejects blocked account (403)
- ✅ switchSession: Rejects invalid sessionId (404)
- ✅ verifyCurrentSession: Returns correct sessionId

### Integration Tests
- ✅ Login Account X (session X-1)
- ✅ Login Account Y (session Y-1)
- ✅ GET /v1/auth/sessions → lists both
- ✅ POST /v1/auth/switch-session {sessionId: Y-1}
- ✅ GET /v1/me → returns Account Y
- ✅ POST /v1/auth/switch-session {sessionId: X-1}
- ✅ GET /v1/me → returns Account X
- ✅ Refresh token cookie updated on each switch
- ✅ Old jti rejected after switch
- ✅ Switch without CSRF token rejected (403)
- ✅ Switch to revoked session rejected (404/409)
- ✅ Rate limit strict limit honored (10/15min)

---

## Troubleshooting

### "Session not found" after GET /v1/auth/sessions

**Cause:** Session expired between list and switch

**Solution:**
1. Refresh the sessions list
2. Check session expiresAt timestamp
3. Ensure switch happens quickly after listing

### "CSRF token missing" on switch

**Cause:** CSRF token not sent in X-CSRF-Token header or session cookie cleared

**Solution:**
1. Call GET /v1/auth/csrf-token before switch
2. Extract csrf-token from Set-Cookie header
3. Include in X-CSRF-Token request header

### Switch returns 200 but /v1/me still shows old account

**Cause:** Old access token cached, refresh token not updated

**Solution:**
1. Call POST /v1/auth/switch-session/verify to confirm switch
2. Use new access token from switch response
3. Clear any cached tokens
4. Discard old Authorization headers

### "Account blocked" on every switch

**Cause:** User account suspended

**Solution:** Contact support to reactivate account

---

## OpenAPI Schema

See `swagger/auth.yaml` for complete OpenAPI 3.0 definitions:
- `/v1/auth/sessions`
- `/v1/auth/switch-session`
- `/v1/auth/switch-session/verify`
