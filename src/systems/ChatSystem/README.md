# ChatSystem — Technical Reference

> **Version:** Post-refactor (April 2026)
> **Scope:** 1-to-1 direct messaging between any two authenticated users.
> Group chat is out of scope.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [File Structure](#2-file-structure)
3. [Data Models](#3-data-models)
   - 3.1 [Conversation](#31-conversation)
   - 3.2 [Message](#32-message)
   - 3.3 [Database Indexes](#33-database-indexes)
4. [REST API Reference](#4-rest-api-reference)
   - 4.1 [Conversations](#41-conversations)
   - 4.2 [Messages](#42-messages)
5. [Socket.IO Reference](#5-socketio-reference)
   - 5.1 [Client → Server Events](#51-client--server-events)
   - 5.2 [Server → Client Events](#52-server--client-events)
   - 5.3 [Room Naming Convention](#53-room-naming-convention)
6. [Pagination](#6-pagination)
7. [Feature Details](#7-feature-details)
8. [Validation & DTOs](#8-validation--dtos)
9. [Security](#9-security)
10. [Performance Design Decisions](#10-performance-design-decisions)
11. [Integration Guide](#11-integration-guide)

---

## 1. Architecture Overview

```
Client (HTTP + Socket.IO)
        │
        ▼
  chat.route.ts          ← Express router, all routes under /v1/chat
        │
        ▼
  chat.controller.ts     ← Thin HTTP adapter; no business logic
        │
        ▼
  chat.service.ts        ← All business logic, DB access, socket emissions
        │
   ┌────┴────┐
   ▼         ▼
Conversation  Message    ← Two separate MongoDB collections
  Model       Model
        │
        ▼
  socket.service.ts      ← Singleton SocketService emits real-time events
        │
        ▼
  chat.socket.ts         ← ChatSocketHandler: chat:join / chat:leave / chat:typing
```

**Key design choices:**

| Decision | Reason |
|---|---|
| Two collections (Conversation + Message) | Messages can grow unboundedly; keeping them separate enables cheap cursor pagination and avoids 16 MB document limit |
| Stable `slug` (`[idA, idB].sort().join('_')`) | Enables atomic upsert for find-or-create with zero race-condition risk |
| Sorted participant pair | A single `{ participants: 1 }` compound index covers membership queries from either side |
| `lean()` everywhere on reads | Skips Mongoose document hydration — 30–50% faster on large result sets |
| `Promise.all` for parallel operations | Reduces latency on operations that touch both collections simultaneously |
| Cursor pagination for messages | Avoids `countDocuments` on the hot read path; returns `hasMore` flag |
| Socket.IO room adapter for presence | O(m) per user instead of O(n) `fetchSockets()` across all connections |
| Server-side typing throttle (2 s) | Prevents room flooding when client emits on every keystroke |

---

## 2. File Structure

```
src/systems/ChatSystem/
├── interfaces/
│   └── chat.interface.ts       ← TypeScript types (Message, Conversation, etc.)
├── models/
│   └── chat.model.ts           ← Mongoose schemas + indexes + model exports
├── dtos/
│   └── chat.dto.ts             ← class-validator DTOs for every endpoint
├── services/
│   └── chat.service.ts         ← All business logic
├── controllers/
│   └── chat.controller.ts      ← HTTP adapter (req/res only)
├── routes/
│   └── chat.route.ts           ← Express router wiring
├── socket/
│   └── chat.socket.ts          ← ChatSocketHandler (join/leave/typing)
└── tests/
    └── chat.mutualFollow.test.ts ← Mutual follow guard unit tests
```

---

## 3. Data Models

### 3.1 Conversation

Stored in the `conversations` collection.

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | Auto-generated |
| `participants` | ObjectId[2] | Exactly 2 users; validated at schema level |
| `slug` | String (unique) | `[idA, idB].sort().join('_')` — enables atomic upsert |
| `lastMessage` | EmbeddedDoc | Denormalised preview for inbox rendering (80-char text cap) |
| `lastMessage.messageId` | ObjectId → Message | |
| `lastMessage.senderId` | ObjectId → User | |
| `lastMessage.text` | String? | Truncated to 80 chars |
| `lastMessage.contentType` | `text\|image\|file\|audio` | |
| `lastMessage.createdAt` | Date | |
| `unreadCounts` | `{ userId, count }[]` | Per-participant badge counter; incremented by `$inc` with `arrayFilters` |
| `isArchived` | Boolean | Default false |
| `deletedFor` | ObjectId[] | Per-user soft delete; user is re-added on next `findOrCreate` |
| `createdAt` | Date | Auto (timestamps) |
| `updatedAt` | Date | Auto (timestamps) |

### 3.2 Message

Stored in the `messages` collection.

| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | Auto-generated |
| `conversationId` | ObjectId → Conversation | |
| `senderId` | ObjectId → User | |
| `contentType` | `text\|image\|file\|audio` | |
| `text` | String? | Max 4 000 chars; trimmed on save |
| `attachment` | EmbeddedDoc? | Present for image/file/audio messages |
| `attachment.url` | String | Cloudflare R2 public URL |
| `attachment.publicId` | String | R2 object key for deletion |
| `attachment.mimeType` | String? | e.g. `image/jpeg`, `audio/mpeg` |
| `attachment.fileName` | String? | Original filename from the client |
| `attachment.sizeBytes` | Number? | Raw file size |
| `replyTo` | ObjectId → Message | The message being quoted/replied to |
| `reactions` | `{ userId, emoji, createdAt }[]` | Bounded; one entry per user (toggle/replace semantics) |
| `readBy` | `{ userId, readAt }[]` | Per-user read receipt with timestamp |
| `deletedFor` | ObjectId[] | User IDs who have hidden this message |
| `isDeleted` | Boolean | True = recalled for all participants; text/attachment cleared |
| `editedAt` | Date? | Set when sender edits the text; signals UI to show "Edited" |
| `createdAt` | Date | Auto (timestamps) |
| `updatedAt` | Date | Auto (timestamps) |

### 3.3 Database Indexes

**Messages collection:**

| Index | Access pattern |
|---|---|
| `{ conversationId: 1, createdAt: -1 }` | Primary read — fetch messages newest-first |
| `{ senderId: 1, conversationId: 1 }` | Edit/delete ownership validation |
| `{ conversationId: 1, deletedFor: 1 }` | Filtered reads that exclude soft-deleted messages |
| `{ text: 'text' }` (sparse) | Full-text search via `$text` operator |

**Conversations collection:**

| Index | Access pattern |
|---|---|
| `{ participants: 1, updatedAt: -1 }` | Inbox load — user's conversations sorted newest-first |
| `{ participants: 1, deletedFor: 1 }` | Membership check + soft-delete filter |
| `slug` (unique) | Atomic upsert for find-or-create |

---

## 4. REST API Reference

**Base path:** `/v1/chat`
**Auth:** All endpoints require a valid JWT via `Authorization: Bearer <token>` header.
**Role guard:** None — any authenticated user type (`client`, `lounge`, `admin`, `agent`) may use the chat.
**Mutual follow guard:** Both participants must follow each other before a conversation can be created or messages sent. Admin users bypass this restriction. See [Section 9.2](#92-mutual-follow-guard) for details.

---

### 4.1 Conversations

#### `POST /v1/chat/conversations`
Find or create a 1-to-1 conversation.

**Request body:**
```json
{ "recipientId": "<mongoId>" }
```

**Response `201`** (new conversation created):
```json
{
  "success": true,
  "data": { /* Conversation document */ },
  "message": "Conversation created"
}
```

**Response `200`** (existing conversation returned):
```json
{
  "success": true,
  "data": { /* Conversation document */ },
  "message": "Conversation retrieved"
}
```

**Errors:** `400` self-DM, `404` recipient not found, `403` recipient type not allowed or mutual follow required.

---

#### `GET /v1/chat/conversations`
List all conversations for the authenticated user, newest first.

**Query params:**

| Param | Type | Default | Max |
|---|---|---|---|
| `page` | number | 1 | — |
| `limit` | number | 20 | 50 |

**Response `200`:**
```json
{
  "success": true,
  "data": [ /* Conversation[] with participants populated */ ],
  "total": 42,
  "page": 1,
  "limit": 20,
  "totalPages": 3
}
```

---

#### `GET /v1/chat/conversations/:id`
Get a single conversation.

**Response `200`:** `{ success, data: Conversation }` | **`404`** if not a participant.

---

#### `DELETE /v1/chat/conversations/:id`
Soft-delete a conversation **for the requesting user only**.
The other participant's view is unaffected.

**Response `200`:** `{ success: true, message: "Conversation removed from your inbox" }`

---

### 4.2 Messages

#### `GET /v1/chat/conversations/:id/messages`
Get paginated messages. Supports two modes — see [Section 6](#6-pagination).

**Query params:**

| Param | Type | Default | Notes |
|---|---|---|---|
| `page` | number | 1 | Offset mode (ignored when `before` is set) |
| `limit` | number | 50 | Max 100 |
| `before` | MongoId | — | Cursor mode: fetch messages older than this ID |

**Response `200` — cursor mode:**
```json
{
  "success": true,
  "data": [ /* Message[] */ ],
  "hasMore": true,
  "limit": 50
}
```

**Response `200` — offset mode:**
```json
{
  "success": true,
  "data": [ /* Message[] */ ],
  "total": 320,
  "page": 1,
  "totalPages": 7,
  "limit": 50
}
```

Messages are always returned in **chronological order** (oldest first).

---

#### `GET /v1/chat/conversations/:id/messages/search`
Full-text search across messages in the conversation.

**Query params:**

| Param | Type | Required | Notes |
|---|---|---|---|
| `q` | string | ✓ | Search term (max 200 chars) |
| `limit` | number | — | Default 20, max 50 |

**Response `200`:**
```json
{
  "success": true,
  "data": [ /* Message[] sorted by relevance, then recency */ ],
  "message": "Search completed"
}
```

---

#### `POST /v1/chat/conversations/:id/messages`
Send a message.

**Rate limit:** `generalRateLimiter` (100 requests per 15 min per IP).
**Content-Type:** `multipart/form-data` for image/file/audio; `application/json` for text.

**Body fields:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `contentType` | `text\|image\|file\|audio` | ✓ | |
| `text` | string | ✓ for text | Max 4 000 chars |
| `replyTo` | MongoId | — | `_id` of the message being quoted |
| `file` | multipart file | ✓ for image/file/audio | Uploaded to Cloudflare R2 |

**Response `201`:**
```json
{
  "success": true,
  "data": { /* Message with sender and replyTo populated */ },
  "message": "Message sent"
}
```

**Side-effects:**
- Emits `chat:message` to the conversation room.
- Emits `chat:conversation:updated` to each participant's `notifications:{userId}` room.
- Sends a push notification to offline recipients (non-blocking).

**Mutual follow check:** Before sending, the server verifies both participants still follow each other. If the relationship has changed since the conversation was created, the send is blocked with `403`.

---

#### `PATCH /v1/chat/conversations/:id/messages/read`
Mark messages as read.

**Body:**
```json
{ "messageIds": ["<id1>", "<id2>"] }
```
Omit `messageIds` to mark **all** unread messages in the conversation as read.

**Response `200`:**
```json
{
  "success": true,
  "data": { "readMessageIds": ["<id1>", "<id2>"] },
  "message": "Messages marked as read"
}
```

**Side-effects:** Emits `chat:read` to the conversation room.

---

#### `PATCH /v1/chat/conversations/:id/messages/:msgId`
Edit a text message.

**Rules:**
- Sender only.
- `contentType === 'text'` only.
- 15-minute edit window (after that returns `403`).

**Body:**
```json
{ "text": "Corrected message text" }
```

**Response `200`:** `{ success, data: updatedMessage }`

**Side-effects:** Emits `chat:message:edited` to the conversation room.

---

#### `POST /v1/chat/conversations/:id/messages/:msgId/reactions`
Toggle an emoji reaction.

**Behaviour:**
- No prior reaction → **add**.
- Same emoji → **remove** (toggle off).
- Different emoji → **replace**.

**Body:**
```json
{ "emoji": "👍" }
```

**Response `200`:**
```json
{
  "success": true,
  "data": { "reactions": [ { "userId": "...", "emoji": "👍", "createdAt": "..." } ] },
  "message": "Reaction updated"
}
```

**Side-effects:** Emits `chat:reaction` to the conversation room.

---

#### `DELETE /v1/chat/conversations/:id/messages/:msgId`
Delete or recall a message.

**Body:**
```json
{ "recallForEveryone": true }
```

| `recallForEveryone` | Who can call | Effect |
|---|---|---|
| `true` | Sender only | Sets `isDeleted = true`, clears `text` and `attachment`; all participants see "This message was deleted" |
| `false` (default) | Any participant | Adds userId to `deletedFor`; only hides message for the requester |

**Response `200`:** `{ success: true, message: "..." }`

**Side-effects:** Emits `chat:message:deleted` to the conversation room.

---

#### `POST /v1/chat/conversations/:id/typing`
REST proxy for the typing indicator (fallback for non-WebSocket clients).

**Body:**
```json
{ "isTyping": true }
```

**Response `204`** (no body).

> **Prefer** sending `chat:typing` directly over Socket.IO to avoid HTTP latency.

---

## 5. Socket.IO Reference

### 5.1 Client → Server Events

#### `chat:join`
Join a conversation room. Must be called before emitting `chat:typing`.

```js
socket.emit('chat:join', { conversationId: '<id>', token: '<jwt>' }, (ack) => {
  // ack: { ok: true } | { error: string }
});
```

**Server flow:**
1. Verify JWT signature.
2. Query DB to confirm userId is a participant.
3. Call `socket.join('chat:<conversationId>')`.
4. Store `socket.data.userId` for downstream handlers.

**ACK responses:**

| Response | Cause |
|---|---|
| `{ ok: true }` | Successfully joined |
| `{ error: 'conversationId and token are required' }` | Missing payload |
| `{ error: 'Invalid or expired token' }` | JWT verification failed |
| `{ error: 'Access denied' }` | User is not a participant |
| `{ error: 'Internal error' }` | Unexpected server error |

---

#### `chat:leave`
Explicitly leave a conversation room.

```js
socket.emit('chat:leave', { conversationId: '<id>' });
```

Note: rooms are also automatically left on disconnect.

---

#### `chat:typing`
Signal that the user is typing (or stopped typing).

```js
socket.emit('chat:typing', { conversationId: '<id>', isTyping: true });
socket.emit('chat:typing', { conversationId: '<id>', isTyping: false });
```

**Server-side throttle:** `isTyping: true` is forwarded at most once every **2 seconds** per user+conversation pair. `isTyping: false` is always forwarded immediately.

Requirements: socket must have called `chat:join` first (so `socket.data.userId` is set).

---

### 5.2 Server → Client Events

All server events include a `timestamp` (ISO 8601) field added by the emit helper.

#### `chat:message`
New message sent in a conversation.

```json
{
  "data": { /* populated Message document */ },
  "timestamp": "2026-04-21T10:00:00.000Z"
}
```

Emitted to: `chat:{conversationId}` room.

---

#### `chat:message:deleted`
A message was recalled or hidden.

```json
{
  "messageId": "<id>",
  "recalledForAll": true,
  "timestamp": "..."
}
```

Emitted to: `chat:{conversationId}` room.

---

#### `chat:message:edited`
A message's text was edited.

```json
{
  "data": { /* updated Message document */ },
  "timestamp": "..."
}
```

Emitted to: `chat:{conversationId}` room.

---

#### `chat:reaction`
An emoji reaction was toggled.

```json
{
  "messageId": "<id>",
  "userId": "<id>",
  "emoji": "👍",
  "reactions": [ { "userId": "...", "emoji": "👍", "createdAt": "..." } ],
  "timestamp": "..."
}
```

Emitted to: `chat:{conversationId}` room.
The full `reactions` array is included so clients can reconcile their local state without re-fetching.

---

#### `chat:read`
Read receipts updated.

```json
{
  "readBy": "<userId>",
  "messageIds": ["<id1>", "<id2>"],
  "timestamp": "..."
}
```

Emitted to: `chat:{conversationId}` room.

---

#### `chat:typing`
Typing indicator forwarded to the room.

```json
{
  "conversationId": "<id>",
  "userId": "<id>",
  "isTyping": true,
  "timestamp": "..."
}
```

Emitted to: all sockets in `chat:{conversationId}` except the sender's socket.

---

#### `chat:conversation:updated`
Inbox preview refresh (last-message summary + unread count).

```json
{
  "data": {
    "_id": "<conversationId>",
    "lastMessage": { "messageId": "...", "senderId": "...", "text": "...", "contentType": "text", "createdAt": "..." }
  },
  "timestamp": "..."
}
```

Emitted to: `notifications:{userId}` room for **every participant** after each new message.

---

### 5.3 Room Naming Convention

| Room name | Who subscribes | Events received |
|---|---|---|
| `chat:{conversationId}` | Both participants (after `chat:join`) | All `chat:*` events for that conversation |
| `notifications:{userId}` | Each user on connect (general join) | `chat:conversation:updated`, general notification events |

---

## 6. Pagination

### Cursor-based (recommended for infinite scroll)

Pass `?before=<messageId>` to fetch messages older than the given ID.
No `countDocuments` is run — response includes `hasMore: boolean`.

```
GET /v1/chat/conversations/:id/messages?before=<msgId>&limit=50
```

**Client flow:**
1. Initial load: call without `before`. Save the `_id` of the oldest message returned.
2. Load more: pass that ID as `before`. Repeat until `hasMore: false`.

### Offset-based (for numbered pagination or jump-to-page)

Omit `before`. Response includes `total` and `totalPages`.

```
GET /v1/chat/conversations/:id/messages?page=2&limit=50
```

---

## 7. Feature Details

### Replies / Threading

Pass `replyTo: <messageId>` when sending a message. The server:
1. Validates the parent message exists in the **same conversation**.
2. Stores the parent `_id` on the new message.
3. Populates the parent's `text`, `contentType`, `senderId`, and `createdAt` in the response.

Clients render a quoted-message preview above the new message body.

---

### Reactions

- One reaction entry per user per message (enforced by the toggle/replace logic).
- Emojis are limited to 8 characters to cover multi-codepoint sequences (e.g. `👨‍👩‍👧‍👦`).
- The full `reactions` array is returned on every mutation for optimistic reconciliation.

---

### Message Editing

- 15-minute window enforced server-side.
- `editedAt` field is set so clients can display an "Edited" indicator.
- `lastMessage.text` in the parent conversation is updated in the same operation if this message is the latest.

---

### Soft Delete vs Recall

| Action | Body | Effect on other participant |
|---|---|---|
| Hide for me | `{ recallForEveryone: false }` | Unaffected — they still see the message |
| Recall for all | `{ recallForEveryone: true }` | Message replaced with "This message was deleted" |

Only the original sender may recall for everyone.

---

### Soft-delete Conversation Restore

If a user calls `POST /conversations` after having previously deleted the conversation, they are automatically re-added (pulled from `deletedFor`) without creating a duplicate document.

---

### Attachments

Attachments are uploaded to Cloudflare R2 under the path `chat/{conversationId}/`. The R2 key is stored as `attachment.publicId` for future deletion.

Supported content types: `image`, `file`, `audio`.
Upload field name (multipart): `file`.

---

## 8. Validation & DTOs

All request bodies and query strings are validated by `class-validator` + `class-transformer` via `validationMiddleware`.

| DTO | Used by |
|---|---|
| `CreateConversationDto` | POST /conversations |
| `GetConversationsDto` | GET /conversations |
| `GetMessagesDto` | GET /conversations/:id/messages |
| `SendMessageDto` | POST /conversations/:id/messages |
| `MarkMessagesReadDto` | PATCH /conversations/:id/messages/read |
| `DeleteMessageDto` | DELETE /conversations/:id/messages/:msgId |
| `EditMessageDto` | PATCH /conversations/:id/messages/:msgId |
| `ReactToMessageDto` | POST /conversations/:id/messages/:msgId/reactions |
| `SearchMessagesDto` | GET /conversations/:id/messages/search |

---

## 9. Security

| Concern | Mitigation |
|---|---|
| Unauthenticated access | `authMiddleware` applied globally via `router.use()` before all routes |
| Accessing another user's conversation | Every service method verifies `participants` membership before any read/write |
| Socket room spoofing | `chat:join` verifies JWT **and** queries the DB — token alone is insufficient |
| Recalling another user's message | `deleteMessage` enforces `senderId === userId` when `recallForEveryone = true` |
| Editing another user's message | `editMessage` queries with `senderId` filter — not found → 404 |
| Typing without joining | `handleTyping` checks `socket.data.userId` — silently no-ops if absent |
| Message flood | `generalRateLimiter` on POST /messages (100 req / 15 min per IP) |
| Oversized text | `@MaxLength(4000)` on `text`, `@MaxLength(8)` on `emoji` |
| Invalid ObjectId injection | `@IsMongoId()` on all ID fields |
| Mutual follow guard | Both participants must follow each other to create a conversation or send a message; admins bypass |

### 9.2 Mutual Follow Guard

Direct messaging is gated behind a **mutual follow** requirement. Before a conversation can be created or a message sent, the server verifies:

1. **Requester follows recipient** — `Follow` document with `followerId = requesterId` and `followingId = recipientId`
2. **Recipient follows requester** — `Follow` document with `followerId = recipientId` and `followingId = requesterId`

Both checks run in parallel via `Promise.all` for minimal latency.

**Bypass rules:**
- If **either** user is an `admin`, the check is skipped entirely. This ensures support agents can always reach users.
- The check runs on **every** `sendMessage` call, not just conversation creation, so if the follow relationship changes after a conversation is created, messages are still blocked.

**Error response:**
```json
{
  "success": false,
  "message": "You must follow each other to send messages",
  "code": 403
}
```

**Affected endpoints:**
- `POST /v1/chat/conversations` — blocked before conversation creation
- `POST /v1/chat/conversations/:id/messages` — blocked before message persistence

---

## 10. Performance Design Decisions

### Atomic find-or-create

```
findOneAndUpdate({ slug }, { $setOnInsert: { ... } }, { upsert: true, new: true })
```

The unique index on `slug` ensures exactly one conversation document per participant pair even under concurrent requests from both sides simultaneously.

### Parallel DB operations

`sendMessage` and `markMessagesRead` use `Promise.all` to run independent writes concurrently:

```
sendMessage:        [message.create → populate] runs in parallel with [conversation.updateOne]
markMessagesRead:   [messages.updateMany]       runs in parallel with [conversation.updateOne]
editMessage:        [message.findByIdAndUpdate] runs in parallel with [conversation.updateOne for lastMessage]
```

### O(1) online-presence check

```typescript
// Instead of: io.fetchSockets() — O(n) across all connected sockets
// We intersect two room adapter sets — O(m) where m ≈ 1–2
const chatRoom = io.sockets.adapter.rooms.get(`chat:${conversationId}`);
const userRoom = io.sockets.adapter.rooms.get(`notifications:${userId}`);
for (const socketId of userRoom) {
  if (chatRoom.has(socketId)) return true;
}
```

### Cursor pagination avoids countDocuments

Fetching `limit + 1` rows and slicing is significantly cheaper than a separate `countDocuments` query on large message collections:

```typescript
const rows = await messages.find(filter).sort({ createdAt: -1 }).limit(limit + 1).lean();
const hasMore = rows.length > limit;
return { messages: rows.slice(0, limit).reverse(), hasMore };
```

### Lean + projection

Every read path uses `.lean()` and explicit `.select()` / `populate('field', 'a b c')` to minimise document size over the wire.

---

## 11. Integration Guide

### Registering the route

In `app.ts` (or wherever routes are registered):

```typescript
import ChatRoute from '@systems/ChatSystem/routes/chat.route';

// ...
this.routes = [new ChatRoute(), /* ... other routes */];
```

### Socket handler registration

`ChatSocketHandler` is automatically instantiated inside `SocketService.initialize()`:

```typescript
const chatHandler = new ChatSocketHandler(this.io);
this.io.on('connection', socket => {
  chatHandler.register(socket); // registers chat:join, chat:leave, chat:typing
});
```

No additional setup is required.

### Client-side setup checklist

1. Connect to Socket.IO with `{ auth: { token } }` or pass the token in headers.
2. Join non-chat rooms (`notifications:{userId}`) via the generic `join` event.
3. When opening a conversation view, emit `chat:join` with `{ conversationId, token }` and wait for `{ ok: true }`.
4. Listen for `chat:message`, `chat:message:edited`, `chat:message:deleted`, `chat:reaction`, `chat:read`, `chat:typing`.
5. When leaving the conversation view, emit `chat:leave`.
6. Emit `chat:typing` at most once every 2 s while the user is typing (server also throttles, but client-side debounce reduces bandwidth).