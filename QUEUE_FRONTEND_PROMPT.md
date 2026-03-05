# Queue Management Feature — Frontend Integration Prompt

You are integrating a **Queue Management** feature into a barber/lounge appointment app frontend. This feature allows lounge owners and admins to manage daily agent queues — tracking which clients are waiting, being served, completed, or absent.

## Backend API Reference

Base URL: `{{API_BASE}}/v1/queues`
Authentication: Bearer token required on all endpoints. CSRF token required on mutating requests (POST/PUT/DELETE).

### Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/agent/:agentId?date=YYYY-MM-DD` | admin/lounge/client | Get a single agent's queue (defaults to today) |
| `GET` | `/lounge/:loungeId?date=YYYY-MM-DD` | admin/lounge/client | Get all agent queues for a lounge |
| `GET` | `/lounge?date=YYYY-MM-DD` | admin/lounge/client | Get all queues for the authenticated lounge |
| `POST` | `/agent/:agentId/persons` | admin/lounge + CSRF | Add a person to an agent's queue |
| `PUT` | `/agent/:agentId/persons/:bookingId` | admin/lounge + CSRF | Update a person's status in the queue |
| `DELETE` | `/agent/:agentId/persons/:bookingId` | admin/lounge + CSRF | Remove a person from the queue |
| `POST` | `/populate` | admin + CSRF | Trigger daily queue population manually |

### Data Models

#### Queue Response
```json 
{
  "data": {
    "_id": "...",
    "agentId": { "_id": "...", "agentName": "John", "profileImage": { "url": "..." } },
    "date": "2026-02-24T00:00:00.000Z",
    "persons": [
      {
        "bookingId": {
          "_id": "...",
          "totalDuration": 60,
          "totalPrice": 45,
          "loungeServiceIds": [...],
          "status": "inQueue",
          "bookingDate": "2026-02-24T10:00:00.000Z",
          "notes": "..."
        },
        "clientId": {
          "_id": "...",
          "firstName": "Jane",
          "lastName": "Doe",
          "email": "jane@example.com",
          "profileImage": { "url": "..." }
        },
        "position": 1,
        "status": "waiting",
        "joinedAt": "2026-02-24T08:30:00.000Z"
      }
    ],
    "createdAt": "...",
    "updatedAt": "..."
  },
  "message": "Queue retrieved successfully"
}
```

#### QueuePerson Status Values & Transitions
```
waiting    → inService   (agent starts serving this person)
waiting    → absent      (person didn't show up)
inService  → completed   (service finished)
absent     → waiting     (person arrived late, put back in queue)
```

Invalid transitions (e.g., `waiting → completed`, `completed → waiting`, `inService → absent`) will return a 400 error.

#### Request Bodies

**Add person to queue** (`POST /agent/:agentId/persons`):
```json
{
  "bookingId": "507f1f77bcf86cd799439012",
  "position": 1  // optional — omit to append at end
}
```

**Update person status** (`PUT /agent/:agentId/persons/:bookingId`):
```json
{
  "status": "inService"  // one of: waiting, inService, completed, absent
}
```

### Lounge Queues Response (multiple agents)
```json
{
  "data": [
    { "_id": "...", "agentId": { "agentName": "Agent 1", ... }, "persons": [...] },
    { "_id": "...", "agentId": { "agentName": "Agent 2", ... }, "persons": [...] }
  ],
  "count": 2,
  "message": "Lounge queues retrieved successfully"
}
```

## Feature Requirements

### Pages / Views to Build

1. **Queue Dashboard** (lounge owner view)
   - Shows all agent queues side by side (or in tabs) for today
   - Each agent column/tab displays their queue as an ordered list of persons
   - Date picker to view historical queues
   - Summary stats: total waiting, in service, completed, absent per agent

2. **Agent Queue Detail** (single agent view)
   - Ordered list of persons with their position, name, avatar, services, estimated wait time
   - Estimated wait time = sum of `totalDuration` from all preceding persons with `status === 'waiting'`
   - Action buttons per person based on current status:
     - `waiting` → "Start Service" button (→ inService) and "Mark Absent" button (→ absent)
     - `inService` → "Complete" button (→ completed)
     - `absent` → "Returned" button (→ waiting)
     - `completed` → no actions, show ✓ badge
   - Visual indicators: color-coded status badges (e.g., yellow=waiting, blue=inService, green=completed, red=absent)

3. **Add to Queue** (modal or inline)
   - Search/select from confirmed bookings for today
   - Option to set position or append at end
   - Validation: only bookings with `inQueue` status and assigned to this agent can be added

### UI/UX Guidelines

- **Real-time feel**: Poll the queue endpoint every 15-30 seconds or implement WebSocket for live updates
- **Drag & drop**: Consider allowing position reordering (would need backend support — for now use remove + re-add)
- **Responsive**: Queue dashboard should work on tablets (lounges often use tablets)
- **Status colors**: `waiting` = amber/yellow, `inService` = blue, `completed` = green, `absent` = red/gray
- **Person card**: Show client avatar, full name, booked services summary, duration, and time joined
- **Position numbers**: Show clearly as badges or numbered list
- **Empty states**: "No persons in queue" with a CTA to add from today's bookings

### TypeScript Interfaces (for frontend)

```typescript
enum QueuePersonStatus {
  WAITING = 'waiting',
  IN_SERVICE = 'inService',
  COMPLETED = 'completed',
  ABSENT = 'absent',
}

interface QueuePerson {
  bookingId: {
    _id: string;
    totalDuration: number;
    totalPrice: number;
    loungeServiceIds: any[];
    status: string;
    bookingDate: string;
    notes?: string;
  };
  clientId: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
    profileImage?: { url?: string };
  };
  position: number;
  status: QueuePersonStatus;
  joinedAt: string;
}

interface Queue {
  _id: string;
  agentId: {
    _id: string;
    agentName: string;
    profileImage?: { url?: string };
  };
  date: string;
  persons: QueuePerson[];
  createdAt: string;
  updatedAt: string;
}
```

### API Service Layer (example)

```typescript
const QUEUE_BASE = '/v1/queues';

export const queueApi = {
  getAgentQueue: (agentId: string, date?: string) =>
    api.get(`${QUEUE_BASE}/agent/${agentId}`, { params: { date } }),

  getLoungeQueues: (loungeId?: string, date?: string) =>
    loungeId
      ? api.get(`${QUEUE_BASE}/lounge/${loungeId}`, { params: { date } })
      : api.get(`${QUEUE_BASE}/lounge`, { params: { date } }),

  addPersonToQueue: (agentId: string, bookingId: string, position?: number) =>
    api.post(`${QUEUE_BASE}/agent/${agentId}/persons`, { bookingId, position }),

  updatePersonStatus: (agentId: string, bookingId: string, status: QueuePersonStatus) =>
    api.put(`${QUEUE_BASE}/agent/${agentId}/persons/${bookingId}`, { status }),

  removePersonFromQueue: (agentId: string, bookingId: string) =>
    api.delete(`${QUEUE_BASE}/agent/${agentId}/persons/${bookingId}`),

  populateDailyQueues: () =>
    api.post(`${QUEUE_BASE}/populate`),
};
```

### Error Handling

| Error Code | Meaning | UI Action |
|------------|---------|-----------|
| `MISSING_AGENT_ID` | Agent ID not provided | Should not happen — check routing |
| `QUEUE_NOT_FOUND` | No queue exists for this agent/date | Show empty state, offer to create |
| `BOOKING_NOT_FOUND` | Booking doesn't exist | Show error toast |
| `INVALID_BOOKING_STATUS` | Booking isn't in `inQueue` status | Show toast: "This booking cannot be added to the queue" |
| `AGENT_NOT_ASSIGNED` | Agent isn't assigned to this booking | Show toast: "This agent is not assigned to this booking" |
| `ALREADY_IN_QUEUE` | Booking already in this queue | Show toast: "Already in queue" |
| `INVALID_STATUS_TRANSITION` | Invalid status change | Disable invalid action buttons proactively |
| `PERSON_NOT_IN_QUEUE` | Person not found in queue | Refresh the queue data |
