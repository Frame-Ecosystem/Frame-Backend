# Follows Module — Frontend Integration Prompt

> **Purpose:** Single source of truth for the frontend agent. Covers every Follow API endpoint, the data model, the follow matrix, the mutual-follow check for messaging, error codes, notification payloads, and recommended frontend patterns.

---

## 1. Overview

The Follows Module manages **follow/unfollow relationships** between users. Any non-admin user type (Client, Lounge, Agent) can follow any other non-admin user type. The module also powers the **mutual follow requirement** for the chat system — two users must mutually follow each other before they can exchange messages.

**Base path:** `/v1/follows`

Every user document carries denormalized `followersCount` and `followingCount` fields. Read these directly from user objects in search results or profiles — no extra API call needed.

---

## 2. Authentication & Security

| Requirement | Details |
|---|---|
| **JWT** | `Authorization: Bearer <token>` header on every request |
| **CSRF** | Write endpoints (`POST`, `DELETE`) require `X-CSRF-Token` header or `csrf-token` form field |
| **Rate limit** | `POST /:targetId` (follow) is rate-limited. All other endpoints are not. |
| **Role access** | All endpoints require Client, Lounge, Agent, or Admin role via `adminOrLoungeOrClientOrAgentMiddleware` |

---

## 3. Follow Matrix

Any non-admin user type can follow any other non-admin user type. All 9 combinations are valid:

| Follower → Target | Client | Lounge | Agent |
|---|---|---|---|
| **Client** | ✅ | ✅ | ✅ |
| **Lounge** | ✅ | ✅ | ✅ |
| **Agent** | ✅ | ✅ | ✅ |

**Self-follows are always rejected** — returns `400 SELF_FOLLOW`.

Admins cannot participate in follow relationships (neither as follower nor target). The backend rejects with `400 INVALID_FOLLOW_PAIR`.

---

## 4. Endpoints

### 4.1 Follow a User

```
POST /v1/follows/:targetId
```

**Middleware:** `authMiddleware` → `adminOrLoungeOrClientOrAgentMiddleware` → `csrfMiddleware` → `followRateLimiter`

| Parameter | In | Type | Required | Description |
|---|---|---|---|---|
| `targetId` | path | ObjectId | yes | ID of the user to follow |

**201 Response:**
```json
{
  "success": true,
  "data": { "following": true },
  "message": "User followed successfully"
}
```

**Error responses:**

| Status | `code` | Trigger |
|---|---|---|
| 400 | `SELF_FOLLOW` | `targetId === userId` |
| 400 | `ALREADY_FOLLOWING` | Already following this user |
| 400 | `INVALID_FOLLOW_PAIR` | Pair not in matrix (e.g., following an admin) |
| 400 | `USER_NOT_FOUND` | Target does not exist or is blocked |
| 400 | `INVALID_TARGET_ID` | Malformed ObjectId |
| 401 | — | Missing or invalid JWT |
| 403 | — | CSRF token invalid/missing, or role not allowed |
| 429 | — | Rate limit exceeded |

---

### 4.2 Unfollow a User

```
DELETE /v1/follows/:targetId
```

**Middleware:** `authMiddleware` → `adminOrLoungeOrClientOrAgentMiddleware` → `csrfMiddleware`

| Parameter | In | Type | Required | Description |
|---|---|---|---|---|
| `targetId` | path | ObjectId | yes | ID of the user to unfollow |

**200 Response:**
```json
{
  "success": true,
  "data": { "following": false },
  "message": "User unfollowed successfully"
}
```

**Error responses:**

| Status | `code` | Trigger |
|---|---|---|
| 400 | `SELF_FOLLOW` | Trying to unfollow yourself |
| 400 | `NOT_FOLLOWING` | You are not following this user |
| 401 | — | Missing or invalid JWT |
| 403 | — | CSRF token invalid/missing |

---

### 4.3 Check If I Follow a Target

```
GET /v1/follows/check/:targetId
```

Returns a single boolean. Use this to render a "Follow" / "Following" button state.

**Middleware:** `authMiddleware` → `adminOrLoungeOrClientOrAgentMiddleware`

| Parameter | In | Type | Required | Description |
|---|---|---|---|---|
| `targetId` | path | ObjectId | yes | ID of the target user |

**200 Response:**
```json
{
  "success": true,
  "data": { "following": true }
}
```

---

### 4.4 Check Mutual Follow (Required for Messaging)

```
GET /v1/follows/mutual-check/:targetId
```

Returns detailed mutual follow status between the authenticated user and the target. **The chat system requires mutual follow before a DM conversation can be created or messages sent.** Call this endpoint before enabling the chat UI.

**Admins always return `mutualFollow: true`** (bypass, consistent with the backend `ChatService.ensureMutualFollow` guard).

**Middleware:** `authMiddleware` → `adminOrLoungeOrClientOrAgentMiddleware`

| Parameter | In | Type | Required | Description |
|---|---|---|---|---|
| `targetId` | path | ObjectId | yes | ID of the other user |

**200 Response:**
```json
{
  "success": true,
  "data": {
    "mutualFollow": true,
    "aFollowsB": true,
    "bFollowsA": true
  }
}
```

| Field | Type | Description |
|---|---|---|
| `mutualFollow` | boolean | `true` if both follow each other, or either is an admin |
| `aFollowsB` | boolean | `true` if the **authenticated user** follows the **target** |
| `bFollowsA` | boolean | `true` if the **target** follows the **authenticated user** |

**Use cases for the breakdown:**
- `mutualFollow: false, aFollowsB: false, bFollowsA: true` → Show "Follow back" prompt to the current user
- `mutualFollow: false, aFollowsB: true, bFollowsA: false` → Show "Waiting for {name} to follow you back"
- `mutualFollow: false, aFollowsB: false, bFollowsA: false` → Show "Follow each other to chat"

**Error responses:**

| Status | `code` | Trigger |
|---|---|---|
| 400 | `INVALID_TARGET_ID` | Malformed ObjectId |
| 401 | — | Missing or invalid JWT |

---

### 4.5 Get Users I'm Following

```
GET /v1/follows/following/:userId?page=1&limit=20&type=client
```

Paginated list of users that `:userId` is following. Sorted newest-first. Each entry is a populated user object.

**Middleware:** `authMiddleware` → `adminOrLoungeOrClientOrAgentMiddleware`

| Parameter | In | Type | Default | Description |
|---|---|---|---|---|
| `userId` | path | ObjectId | — | ID of the user whose following list to fetch |
| `page` | query | integer | 1 | Page number, min 1 |
| `limit` | query | integer | 20 | Items per page, max 50 |
| `type` | query | string | — | Optional filter: `'client'`, `'lounge'`, or `'agent'` |

**200 Response:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "_id": "665f1a2b3c4d5e6f7a8b9c0d",
        "firstName": "Sara",
        "lastName": "Alami",
        "loungeTitle": "Beauty Studio",
        "profileImage": { "url": "https://cdn.framebeauty.com/avatars/sara.jpg" },
        "bio": "Professional beauty services",
        "type": "lounge"
      }
    ],
    "total": 45,
    "page": 1,
    "limit": 20
  },
  "message": "Following list retrieved successfully"
}
```

---

### 4.6 Get My Followers

```
GET /v1/follows/followers/:userId?page=1&limit=20
```

Paginated list of users who follow `:userId`. Sorted newest-first.

**Middleware:** `authMiddleware` → `adminOrLoungeOrClientOrAgentMiddleware`

| Parameter | In | Type | Default | Description |
|---|---|---|---|---|
| `userId` | path | ObjectId | — | ID of the user whose followers to fetch |
| `page` | query | integer | 1 | Page number, min 1 |
| `limit` | query | integer | 20 | Items per page, max 50 |
| `type` | query | string | — | Optional filter: `'client'`, `'lounge'`, or `'agent'` |

**200 Response:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "_id": "665f1a2b3c4d5e6f7a8b9c0f",
        "firstName": "Ahmed",
        "lastName": "Benali",
        "profileImage": { "url": "https://cdn.framebeauty.com/avatars/ahmed.jpg" },
        "bio": "Beauty enthusiast",
        "type": "client"
      }
    ],
    "total": 120,
    "page": 1,
    "limit": 20
  },
  "message": "Followers list retrieved successfully"
}
```

---

### 4.7 Get Follow Counts

```
GET /v1/follows/counts/:userId
```

Returns live follower and following counts for a user. Read from denormalized fields on the user object for display; use this endpoint only when you need fresh counts.

**Middleware:** `authMiddleware` → `adminOrLoungeOrClientOrAgentMiddleware`

| Parameter | In | Type | Required | Description |
|---|---|---|---|---|
| `userId` | path | ObjectId | yes | ID of the user |

**200 Response:**
```json
{
  "success": true,
  "data": {
    "followersCount": 120,
    "followingCount": 45
  }
}
```

---

## 5. Data Model

### 5.1 Follow Document (MongoDB)

| Field | Type | Description |
|---|---|---|
| `_id` | ObjectId | Auto-generated |
| `followerId` | ObjectId → User | The user who follows |
| `followingId` | ObjectId → User | The user being followed |
| `followerType` | `'client' \| 'lounge' \| 'agent'` | Denormalized type of follower |
| `followingType` | `'client' \| 'lounge' \| 'agent'` | Denormalized type of followee |
| `createdAt` | Date | Auto-set on creation (no `updatedAt`) |

**Unique constraint:** `{ followerId, followingId }` — one follow per pair.

**Indexes:**
- `{ followerId: 1, followingId: 1 }` unique
- `{ followerId: 1, createdAt: -1 }` — "who am I following" lookups
- `{ followingId: 1, createdAt: -1 }` — "who follows me" lookups
- `{ followerId: 1, followingType: 1, createdAt: -1 }` — filtered
- `{ followingId: 1, followerType: 1, createdAt: -1 }` — filtered

### 5.2 Denormalized Counts on User Documents

| Field | Type | Description |
|---|---|---|
| `followersCount` | number | How many users follow this user (recalculated on every follow/unfollow) |
| `followingCount` | number | How many users this user follows (recalculated on every follow/unfollow) |

Both fields default to `0`. Read directly from user objects in search results, profiles, etc.

---

## 6. Mutual Follow & Chat — How It Works

The chat system enforces a **mutual follow guard** at two points:
1. `POST /v1/chat/conversations` (find-or-create DM) — checks mutual follow before creating
2. `POST /v1/chat/conversations/:id/messages` (send message) — re-checks even if conversation exists

If mutual follow is missing, the backend returns **`403 "You must follow each other to send messages"`**.

### 6.1 Frontend Pre-Check Pattern

Call the mutual-check endpoint **before** rendering the chat UI or send button:

```typescript
async function canMessage(currentUser, targetUserId, authToken) {
  // Admins can always message — skip the API call
  if (currentUser.type === 'admin') return true;

  const res = await fetch(`/v1/follows/mutual-check/${targetUserId}`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  const { data } = await res.json();
  return data.mutualFollow;
}
```

### 6.2 What to Show Based on the Breakdown

The response includes `aFollowsB` and `bFollowsA` so you can show contextual UI:

| `aFollowsB` | `bFollowsA` | `mutualFollow` | UI to show |
|---|---|---|---|
| `true` | `true` | `true` | Show chat input — messaging is allowed |
| `true` | `false` | `false` | "Waiting for {name} to follow you back" |
| `false` | `true` | `false` | "Follow {name} back to start chatting" |
| `false` | `false` | `false` | "Follow each other to chat" with a Follow button |

---

## 7. Frontend Implementation Patterns

### 7.1 Follow/Following Button on Profile Page

```typescript
function FollowButton({ profileUser, currentUser, csrfToken, authToken }) {
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`/v1/follows/check/${profileUser._id}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then(res => res.json())
      .then(({ data }) => setFollowing(data.following))
      .catch(console.error);
  }, [profileUser._id]);

  const toggle = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const method = following ? 'DELETE' : 'POST';
      const res = await fetch(`/v1/follows/${profileUser._id}`, {
        method,
        headers: {
          Authorization: `Bearer ${authToken}`,
          'X-CSRF-Token': csrfToken,
        },
      });
      const result = await res.json();
      if (result.success) {
        setFollowing(result.data.following);
        // Optionally update followersCount on profileUser
      }
    } finally {
      setLoading(false);
    }
  };

  // Don't show on own profile
  if (currentUser._id === profileUser._id) return null;

  return (
    <button onClick={toggle} disabled={loading}>
      {following ? 'Following' : 'Follow'}
    </button>
  );
}
```

### 7.2 Chat Gate Component

```typescript
function ChatGate({ profileUser, currentUser, authToken, children }) {
  const [canChat, setCanChat] = useState(null); // null = loading

  useEffect(() => {
    // Admins can always chat
    if (currentUser.type === 'admin') {
      setCanChat(true);
      return;
    }

    fetch(`/v1/follows/mutual-check/${profileUser._id}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then(res => res.json())
      .then(({ data }) => setCanChat(data.mutualFollow))
      .catch(() => setCanChat(false));
  }, [profileUser._id, currentUser._id]);

  if (canChat === null) return <LoadingSpinner />;

  if (!canChat) {
    return (
      <div className="chat-locked">
        <p>You must follow each other to send messages.</p>
        {/* Optionally show FollowButton here */}
      </div>
    );
  }

  return children; // Render the chat UI
}
```

### 7.3 Followers / Following List Page

```typescript
function FollowListPage({ userId, authToken }) {
  const [tab, setTab] = useState('followers');
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;

  useEffect(() => {
    const endpoint = tab === 'followers'
      ? `/v1/follows/followers/${userId}?page=${page}&limit=${limit}`
      : `/v1/follows/following/${userId}?page=${page}&limit=${limit}`;

    fetch(endpoint, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then(res => res.json())
      .then(({ data }) => { setUsers(data.users); setTotal(data.total); })
      .catch(console.error);
  }, [tab, userId, page]);

  return (
    <div>
      <div className="tabs">
        <button onClick={() => { setTab('followers'); setPage(1); }}>
          Followers ({total})
        </button>
        <button onClick={() => { setTab('following'); setPage(1); }}>
          Following ({total})
        </button>
      </div>

      {users.map(user => (
        <div key={user._id} className="user-card">
          <img src={user.profileImage?.url} alt="" />
          <span>{user.firstName} {user.lastName}</span>
          <span>{user.type}</span>
        </div>
      ))}

      {total > limit && (
        <Pagination current={page} total={total} limit={limit} onChange={setPage} />
      )}
    </div>
  );
}
```

---

## 8. Error Handling

Every error follows the standard Frame Backend shape:

```json
{
  "success": false,
  "message": "Human-readable description",
  "code": "MACHINE_READABLE_CODE"
}
```

| HTTP | `code` | Meaning | Frontend Action |
|---|---|---|---|
| 400 | `SELF_FOLLOW` | Trying to follow/unfollow yourself | Hide button on own profile |
| 400 | `ALREADY_FOLLOWING` | Duplicate follow | Update UI to "Following" state |
| 400 | `NOT_FOLLOWING` | Trying to unfollow when not following | Update UI to "Follow" state |
| 400 | `INVALID_FOLLOW_PAIR` | Following an admin or unsupported combo | Don't show follow button |
| 400 | `USER_NOT_FOUND` | Target doesn't exist or is blocked | Show "User unavailable" |
| 400 | `INVALID_TARGET_ID` | Malformed ObjectId | Validate IDs before calling |
| 401 | — | Missing or expired JWT | Redirect to login |
| 403 | — | CSRF invalid or role denied | Retry with fresh CSRF token |
| 429 | — | Rate limit exceeded on follow | Show "Try again later" toast |

---

## 9. Notifications

When a follow is created, the backend sends a push notification to the followee:

| Event | Title | Body |
|---|---|---|
| New follower | "New Follower" | `"{followerName} started following you"` |

Notification type: `social:newFollower`

The notification includes `actorId` (the follower), `actionUrl` (follower's profile path), and `imageUrl` (follower's profile image). Frontend should subscribe to real-time notification events.

---

## 10. Complete Route Reference

| Method | Path | Auth | CSRF | Rate limit | Description |
|---|---|---|---|---|---|
| `POST` | `/v1/follows/:targetId` | Client, Lounge, Agent | **Yes** | Yes | Follow a user |
| `DELETE` | `/v1/follows/:targetId` | Client, Lounge, Agent | **Yes** | No | Unfollow a user |
| `GET` | `/v1/follows/check/:targetId` | Client, Lounge, Agent | No | No | Boolean: am I following this target? |
| `GET` | `/v1/follows/mutual-check/:targetId` | Client, Lounge, Agent | No | No | Mutual follow status (for chat gate) |
| `GET` | `/v1/follows/following/:userId` | Client, Lounge, Agent | No | No | Paginated list of users I'm following |
| `GET` | `/v1/follows/followers/:userId` | Client, Lounge, Agent | No | No | Paginated list of my followers |
| `GET` | `/v1/follows/counts/:userId` | Client, Lounge, Agent | No | No | Follower + following counts |

---

## 11. Swagger / OpenAPI

- **Standalone spec:** `swagger/follows.yaml`
- **Combined spec:** `swagger.yaml` — search for the `follows` tag
