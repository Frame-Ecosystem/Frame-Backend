# Likes Module — Frontend Integration Prompt

## Overview

The Likes Module allows users to like other users (Lounges and Agents) using a toggle pattern — tap once to like, tap again to unlike. Likes are **generalized** — any supported user type can like any supported target, as long as the combination is allowed by the backend matrix. The backend maintains a denormalized `likeCount` on every target user document.

**Base URL:** `/v1/likes`
**Auth:** All endpoints require a valid JWT via `Authorization: Bearer <token>` header.
**Write endpoints** also require a valid CSRF token via `X-CSRF-Token` header or `csrf-token` form field.
**Rate limit:** Toggle endpoint is limited to **30 requests per 15 minutes** per user.

---

## Like Matrix

The backend enforces a strict like matrix. Only these combinations are allowed:

| Liker (you) | Can Like | Cannot Like |
|---|---|---|
| **Client** | Lounge, Agent | Other Clients, Admins |
| **Lounge** | Agent | Clients, other Lounges, Admins |
| **Agent** | *(none)* | Everyone |

**Self-likes are always rejected.** You cannot like yourself regardless of your type.

If a frontend user attempts to like a target outside this matrix, the backend returns a `400` with code `INVALID_LIKE_PAIR`.

---

## Endpoints

### 1. Toggle Like / Unlike

```
POST /v1/likes/:targetId
```

Toggle a like on a target user. If you haven't liked them, a like is created. If you already liked them, the like is removed (unlike). This is a **toggle** — there is no separate like/unlike endpoint.

**Auth:** Client, Lounge, or Agent
**CSRF:** Required
**Rate limit:** 30 requests / 15 min

#### Path Parameters

| Parameter | Type | Description |
|---|---|---|
| `targetId` | string (ObjectId) | ID of the user to like/unlike (must be a Lounge or Agent) |

#### Response (200) — Liked

```json
{
  "success": true,
  "data": { "liked": true },
  "message": "Liked"
}
```

#### Response (200) — Unliked

```json
{
  "success": true,
  "data": { "liked": false },
  "message": "Unliked"
}
```

#### Error Responses

| Status | Code | When |
|---|---|---|
| 400 | `SELF_LIKE` | Trying to like yourself |
| 400 | `INVALID_LIKE_PAIR` | Liker type cannot like target type (e.g., Agent → Lounge) |
| 400 | `INVALID_LIKEABLE_TARGET` | Target is not a Lounge or Agent (e.g., liking a Client or Admin) |
| 400 | `USER_NOT_FOUND` | Target user not found or is blocked |
| 401 | — | No token or invalid token |
| 403 | — | CSRF token missing/invalid, or user role not allowed |
| 429 | — | Rate limit exceeded (30 / 15 min) |

---

### 2. Get My Likes

```
GET /v1/likes/me?page=1&limit=20
```

Fetch paginated list of all users (Lounges and Agents) you have liked. Returns the target user's profile populated on each like. Sorted newest-first.

**Auth:** Client, Lounge, or Agent

#### Query Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `page` | integer | 1 | Page number (min 1) |
| `limit` | integer | 20 | Items per page (max 50) |

#### Response (200)

```json
{
  "success": true,
  "data": [
    {
      "_id": "665f1a2b3c4d5e6f7a8b9c0e",
      "likerId": "665f1a2b3c4d5e6f7a8b9c0f",
      "targetId": {
        "_id": "665f1a2b3c4d5e6f7a8b9c0d",
        "firstName": "Sara",
        "lastName": "Alami",
        "loungeTitle": "Beauty Studio",
        "profileImage": { "url": "https://cdn.framebeauty.com/avatars/sara.jpg" },
        "averageRating": 4.5,
        "ratingCount": 28,
        "likeCount": 142,
        "type": "lounge"
      },
      "likerType": "client",
      "targetType": "lounge",
      "createdAt": "2025-07-12T10:30:00.000Z"
    }
  ],
  "total": 15,
  "page": 1,
  "limit": 20
}
```

---

### 3. Check If I Liked a Target

```
GET /v1/likes/check/:targetId
```

Check whether the authenticated user has liked a specific target. Returns a boolean.

**Auth:** Client, Lounge, or Agent

#### Path Parameters

| Parameter | Type | Description |
|---|---|---|
| `targetId` | string (ObjectId) | ID of the target user |

#### Response (200)

```json
{
  "success": true,
  "data": { "liked": true }
}
```

---

### 4. Get Likers of a Target

```
GET /v1/likes/target/:targetId?page=1&limit=20
```

Fetch paginated list of all users who liked a specific target. Returns the liker's profile populated on each like. Sorted newest-first.

**Auth:** Any authenticated user

#### Path Parameters

| Parameter | Type | Description |
|---|---|---|
| `targetId` | string (ObjectId) | ID of the target user |

#### Query Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `page` | integer | 1 | Page number (min 1) |
| `limit` | integer | 20 | Items per page (max 50) |

#### Response (200)

```json
{
  "success": true,
  "data": [
    {
      "_id": "665f1a2b3c4d5e6f7a8b9c0e",
      "likerId": {
        "_id": "665f1a2b3c4d5e6f7a8b9c0f",
        "firstName": "Sara",
        "lastName": "Alami",
        "profileImage": { "url": "https://cdn.framebeauty.com/avatars/sara.jpg" },
        "type": "client"
      },
      "targetId": "665f1a2b3c4d5e6f7a8b9c0d",
      "likerType": "client",
      "targetType": "lounge",
      "createdAt": "2025-07-12T10:30:00.000Z"
    }
  ],
  "total": 142,
  "page": 1,
  "limit": 20
}
```

---

## Denormalized Like Count

Every Lounge and Agent user document contains a denormalized `likeCount` field that is automatically recalculated by the backend whenever a like is toggled:

```json
{
  "_id": "665f1a2b3c4d5e6f7a8b9c0d",
  "type": "lounge",
  "loungeTitle": "Beauty Studio",
  "likeCount": 142
}
```

| Field | Type | Description |
|---|---|---|
| `likeCount` | integer | Total number of likes received. 0 if none. |

**This field is already included** in user profiles when fetched via other endpoints (search, likes, profiles). You do not need to call the like endpoints separately to display a like count on a Lounge or Agent card — just read `likeCount` from the user object.

---

## Frontend Usage Guide

### Displaying Like Count on a Lounge/Agent Card

When rendering a Lounge or Agent in a list, read the `likeCount` field directly from the user object:

```typescript
// From any user object (lounge or agent)
const likes = user.likeCount; // e.g., 142

// Render: ❤ 142
```

No API call needed — this is already denormalized on the user document.

### Showing Heart State on a Profile Page

Check if the current user has already liked this target:

```typescript
// GET /v1/likes/check/:targetId
const response = await fetch(`/v1/likes/check/${targetId}`, {
  headers: { Authorization: `Bearer ${token}` },
});
const { data: { liked } } = await response.json();

// Render filled heart if liked, outline heart if not
```

### Toggling a Like (Heart Button)

```typescript
// POST /v1/likes/:targetId
const response = await fetch(`/v1/likes/${targetId}`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`,
    'X-CSRF-Token': csrfToken,
  },
});

const result = await response.json();
if (result.success) {
  const isNowLiked = result.data.liked;
  // Update heart icon: filled if isNowLiked, outline if not
  // Update likeCount display: increment or decrement by 1
}
```

### Showing the Likers List on a Profile Page

```typescript
// GET /v1/likes/target/:targetId?page=1&limit=20
const response = await fetch(`/v1/likes/target/${targetId}?page=1&limit=20`, {
  headers: { Authorization: `Bearer ${token}` },
});
const { data: likers, total } = await response.json();
```

### Showing "My Likes" List

```typescript
// GET /v1/likes/me?page=1&limit=20
const response = await fetch('/v1/likes/me?page=1&limit=20', {
  headers: { Authorization: `Bearer ${token}` },
});
const { data: likedUsers, total } = await response.json();
```

---

## Error Handling Guide

All errors follow the standard Frame Backend error format:

```json
{
  "success": false,
  "message": "Human-readable error message",
  "code": "MACHINE_READABLE_CODE"
}
```

### Common Error Codes

| HTTP Status | Code | Meaning | Frontend Action |
|---|---|---|---|
| 400 | `SELF_LIKE` | User trying to like themselves | Hide/disable like button on own profile |
| 400 | `INVALID_LIKE_PAIR` | Forbidden combination (e.g., Agent → Lounge) | Don't show like button if matrix disallows |
| 400 | `INVALID_LIKEABLE_TARGET` | Target is a Client or Admin | Don't show like button on non-likeable profiles |
| 400 | `USER_NOT_FOUND` | Target doesn't exist or is blocked | Show "User not available" message |
| 400 | `INVALID_TARGET_ID` | Malformed ObjectId | Validate ID format before sending |
| 401 | — | Missing or expired JWT | Redirect to login |
| 403 | — | CSRF token invalid or missing | Retry with fresh CSRF token |
| 429 | — | Rate limit exceeded (30/15 min) | Show "Try again later" toast |

---

## Like Matrix Logic for Frontend

To determine whether to show the like button on a profile page, implement this client-side check:

```typescript
function canLike(likerType: string, targetType: string): boolean {
  const allowedPairs = new Set([
    'client→lounge',
    'client→agent',
    'lounge→agent',
  ]);
  return allowedPairs.has(`${likerType}→${targetType}`);
}

// Usage
const currentUserType = currentUser.type; // 'client' | 'lounge' | 'agent'
const profileUserType = profileUser.type; // 'client' | 'lounge' | 'agent'

if (currentUser._id === profileUser._id) {
  // Own profile — never show like button
} else if (!canLike(currentUserType, profileUserType)) {
  // Not a valid pair — don't show like button
} else {
  // Show like button (heart icon)
  // Fetch check status to show filled/outline state
}
```

**Note:** Always implement this check client-side for UX, but the backend independently validates and rejects invalid pairs. The client-side check prevents wasted API calls and provides a cleaner user experience.

---

## Notifications

When a like is created, the backend sends a push notification to the target user:

| Liker → Target | Notification Title | Notification Body |
|---|---|---|
| Client → Lounge | "New Like" | "{name} liked your lounge" |
| Client → Agent | "New Like" | "{name} liked you" |
| Lounge → Agent | "New Like" | "{name} liked you" |

No notification is sent on unlike.

Frontend should subscribe to real-time notification events to show toast/banner notifications when a new like is received.

---

## Swagger / OpenAPI

Full API specification is available at:
- **Standalone:** `swagger/likes.yaml`
- **Combined:** `swagger.yaml` (search for `LIKES` section)

---

## Summary of Changes (from Client-Only to Multi-Type)

| Aspect | Before | After |
|---|---|---|
| Liker types | Client only | Client, Lounge, Agent |
| Target types | Lounge only | Lounge, Agent |
| Unique constraint | `{clientId, loungeId}` | `{likerId, targetId}` |
| Route path (toggle) | `POST /v1/likes/:loungeId` | `POST /v1/likes/:targetId` |
| Route path (check) | `GET /v1/likes/check/:loungeId` | `GET /v1/likes/check/:targetId` |
| Route path (likers) | `GET /v1/likes/lounge/:loungeId` | `GET /v1/likes/target/:targetId` |
| Route path (my likes) | `GET /v1/likes/me` | `GET /v1/likes/me` (unchanged) |
| Write auth middleware | `clientMiddleware` | `adminOrLoungeOrClientOrAgentMiddleware` |
| Aggregation | `refreshLoungeCount` | `refreshTargetCount` (generic) |
| Notifications | `notifyLoungeLiked` only | Context-aware (lounge or agent) |
| Interface fields | `clientId`, `loungeId` | `likerId`, `targetId`, `likerType`, `targetType` |
