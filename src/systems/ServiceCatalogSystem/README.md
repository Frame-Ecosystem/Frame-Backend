<p align="center">
  <img src="../../../assets/frame-logo-animated.svg" alt="Frame Beauty" width="320" />
</p>

# ServiceCatalogSystem

> Manages the beauty service catalog: global services & categories, lounge-specific service offerings, service suggestions workflow, lounge ratings, and the queue-booking agent toggle.

---

## Table of Contents

- [Overview](#overview)
- [Database Schemas](#database-schemas)
- [Entity Relationships](#entity-relationships)
- [API Endpoints](#api-endpoints)
- [DTOs & Validation](#dtos--validation)
- [Services](#services)
- [Flows](#flows)
- [Directory Structure](#directory-structure)

---

## Overview

The ServiceCatalogSystem is the **product catalog** of Frame Beauty's service marketplace. It manages a two-tier catalog:

1. **Global Catalog** — Platform-wide services and categories maintained by admins
2. **Lounge Catalog** — Per-lounge service offerings with custom pricing, duration, gender targeting, and agent assignments

Additionally, it handles:
- **Service Suggestions** — Lounges can suggest new services; admins approve/reject
- **Ratings** — Clients rate lounges (1–5 stars)
- **Queue-Booking Toggle** — Lounges can enable/disable queue booking per agent

```mermaid
graph TB
    subgraph Global Catalog
        SC[ServiceCategory] --> S[Service]
    end

    subgraph Lounge Catalog
        S --> LS[LoungeService]
        LS --> A[Agent Assignment]
    end

    subgraph Suggestions
        L[Lounge] --> SS[ServiceSuggestion]
        SS -->|Admin approves| S
    end

    subgraph Ratings
        C[Client] --> R[Rating]
        R --> L
    end
```

---

## Database Schemas

### ServiceCategory

```mermaid
erDiagram
    ServiceCategory {
        ObjectId _id PK
        String name UK "unique, required"
        String description "optional"
        Date createdAt
        Date updatedAt
    }
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | String | Yes | Unique category name (e.g., "Hair", "Nails", "Skincare") |
| `description` | String | No | Category description |

### Service

```mermaid
erDiagram
    Service {
        ObjectId _id PK
        String name "unique per category"
        ObjectId categoryId FK "ref: ServiceCategory"
        String description "optional"
        Date createdAt
        Date updatedAt
    }

    Service }o--|| ServiceCategory : "belongs to"
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | String | Yes | Service name (unique within its category) |
| `categoryId` | ObjectId | Yes | Reference to ServiceCategory |
| `description` | String | No | Service description |

### LoungeService

```mermaid
erDiagram
    LoungeService {
        ObjectId _id PK
        ObjectId loungeId FK "ref: User"
        ObjectId serviceId FK "ref: Service"
        Array agentIds FK "ref: Agent[]"
        Number price "required"
        Number duration "minutes, required"
        String gender "men | women | unisex | kids"
        String status "active | inactive"
        String description "optional"
        String image "R2 URL, optional"
        Boolean isActive "default true"
        Date createdAt
        Date updatedAt
    }

    LoungeService }o--|| User : "offered by (lounge)"
    LoungeService }o--|| Service : "instance of"
    LoungeService }o--o{ Agent : "performed by"
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `loungeId` | ObjectId | Yes | The lounge offering this service |
| `serviceId` | ObjectId | Yes | Reference to global Service |
| `agentIds` | ObjectId[] | No | Agents who can perform this service |
| `price` | Number | Yes | Price in local currency |
| `duration` | Number | Yes | Duration in minutes |
| `gender` | String | Yes | Target: `men`, `women`, `unisex`, `kids` |
| `status` | String | — | `active` or `inactive` |
| `description` | String | No | Lounge-specific description |
| `image` | String | No | Service image (R2 URL) |
| `isActive` | Boolean | — | Active toggle |

### ServiceSuggestion

```mermaid
erDiagram
    ServiceSuggestion {
        ObjectId _id PK
        String name "required"
        String description "required"
        Number estimatedPrice "optional"
        Number estimatedDuration "optional"
        String targetGender "optional"
        String status "pending | approved | rejected | implemented"
        ObjectId loungeId FK "ref: User"
        String adminNote "optional"
        Date createdAt
        Date updatedAt
    }

    ServiceSuggestion }o--|| User : "suggested by (lounge)"
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | String | Yes | Suggested service name |
| `description` | String | Yes | Description of the suggested service |
| `estimatedPrice` | Number | No | Suggested price point |
| `estimatedDuration` | Number | No | Suggested duration in minutes |
| `targetGender` | String | No | Intended audience |
| `status` | String | — | `pending` → `approved` / `rejected` → `implemented` |
| `loungeId` | ObjectId | Yes | Lounge that made the suggestion |
| `adminNote` | String | No | Admin feedback on the suggestion |

### Rating

```mermaid
erDiagram
    Rating {
        ObjectId _id PK
        ObjectId clientId FK "ref: User"
        ObjectId loungeId FK "ref: User"
        Number score "1-5"
        String comment "optional"
        Date createdAt
        Date updatedAt
    }

    Rating }o--|| User : "rated by (client)"
    Rating }o--|| User : "rating for (lounge)"
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `clientId` | ObjectId | Yes | Client who gave the rating |
| `loungeId` | ObjectId | Yes | Lounge being rated |
| `score` | Number | Yes | 1–5 stars |
| `comment` | String | No | Text review |
| | | | **Unique constraint:** `{clientId, loungeId}` — one rating per client per lounge |

---

## Entity Relationships

```mermaid
erDiagram
    ServiceCategory ||--o{ Service : contains
    Service ||--o{ LoungeService : "instantiated as"
    User ||--o{ LoungeService : "offers (lounge)"
    Agent }o--o{ LoungeService : "assigned to"
    User ||--o{ ServiceSuggestion : "suggests (lounge)"
    User ||--o{ Rating : "rates (client)"
    User ||--o{ Rating : "rated (lounge)"
```

---

## API Endpoints

### Public Services — `/v1/services` (no auth required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | List all global services |
| `GET` | `/:id` | Get service by ID |

### Public Service Categories — `/v1/service-categories` (no auth required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | List all service categories |
| `GET` | `/:id` | Get category by ID |

### Lounge Services — `/v1/lounge-services` (auth required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | List all lounge services |
| `GET` | `/search` | Search lounge services by name |
| `GET` | `/lounge/:loungeId` | Get services for a specific lounge |
| `GET` | `/:serviceId` | Get lounge service by ID |
| `GET` | `/service-name/:serviceId` | Get service name by ID |
| `POST` | `/` | Create a lounge service |
| `POST` | `/bulk` | Bulk create lounge services |
| `PUT` | `/:serviceId` | Update a lounge service |
| `DELETE` | `/:serviceId` | Delete a lounge service |
| `PATCH` | `/:serviceId/toggle-status` | Toggle active/inactive status |
| `PATCH` | `/lounge/:loungeId/opening-hours` | Update lounge opening hours |
| `PUT` | `/lounge/:loungeId/profile` | Update lounge profile |
| `GET` | `/lounge/:loungeId/agents` | Get agents for a lounge |

### Lounge Routes — `/v1/lounge`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/clients/:clientId` | auth | Get client info (lounge context) |
| `PATCH` | `/agents/:agentId/queue-booking` | auth + lounge | Toggle agent queue-booking acceptance |

### Service Suggestions — `/v1/service-suggestions`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/` | auth | List suggestions (paginated) |
| `GET` | `/stats` | admin | Suggestion statistics |
| `GET` | `/:suggestionId` | auth | Get suggestion by ID |
| `POST` | `/` | lounge | Create a suggestion |
| `PUT` | `/:suggestionId` | lounge | Update own suggestion |
| `PATCH` | `/:suggestionId/status` | admin | Update suggestion status |
| `PATCH` | `/:suggestionId/admin-approve` | admin | Approve and auto-create service |
| `DELETE` | `/:suggestionId` | auth | Delete suggestion |

### Ratings — `/v1/ratings`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/lounge/:loungeId` | auth | Get all ratings for a lounge |
| `GET` | `/me/:loungeId` | client | Get my rating for a lounge |
| `PUT` | `/` | client | Create or update rating (upsert) |
| `DELETE` | `/:loungeId` | client | Delete my rating |

---

## DTOs & Validation

| DTO | Fields | Key Validations |
|-----|--------|----------------|
| `CreateServiceDto` | name, categoryId, description? | `@IsString()` |
| `UpdateServiceDto` | all optional | `@IsOptional()` |
| `CreateServiceCategoryDto` | name, description? | `@IsString()` |
| `UpdateServiceCategoryDto` | all optional | `@IsOptional()` |
| `CreateServiceSuggestionDto` | name, description, estimatedPrice?, estimatedDuration?, targetGender? | `@IsString()`, `@IsNumber()` |
| `UpdateServiceSuggestionStatusDto` | status, adminNote?, categoryId?, name?, price?, duration?, gender? | `@IsEnum(ServiceSuggestionStatus)` |
| `AdminApproveServiceSuggestionDto` | status?, categoryId, name?, price?, duration?, gender?, adminNote? | Required `categoryId` for auto-creation |
| `UpsertRatingDto` | loungeId, score, comment? | `@Min(1) @Max(5)` |
| `CreateLoungeServiceDto` | loungeId, serviceId, agentIds?, price, duration, gender, status?, description?, image?, isActive? | `@IsNumber()` for price/duration |
| `UpdateLoungeServiceDto` | all optional | `@IsOptional()` |

### Enums

```typescript
enum ServiceSuggestionStatus {
  pending = 'pending',
  approved = 'approved',
  rejected = 'rejected',
  implemented = 'implemented'
}

enum ServiceLoungeGender {
  men = 'men',
  women = 'women',
  unisex = 'unisex',
  kids = 'kids'
}

enum LoungeServiceStatus {
  active = 'active',
  inactive = 'inactive'
}
```

---

## Services

### ServicesService

Global service catalog management.

| Method | Description |
|--------|-------------|
| `createService(data)` | Create a new global service |
| `getAllServices()` | List all services |
| `getServiceById(id)` | Get service by ID |
| `updateService(id, data)` | Update service |
| `deleteService(id)` | Delete service |
| `getServicesPaginated(page, limit)` | Paginated list |
| `searchServices(query)` | Text search |
| `getServicesByCategory(categoryId)` | Filter by category |
| `bulkCreateServices(data[])` | Batch import |

### ServiceCategoriesService

| Method | Description |
|--------|-------------|
| `createServiceCategory(data)` | Create category |
| `getAllServiceCategories()` | List all |
| `getServiceCategoryById(id)` | Get by ID |
| `updateServiceCategory(id, data)` | Update |
| `deleteServiceCategory(id)` | Delete |
| `searchServiceCategories(query)` | Text search |

### LoungeServicesService

Per-lounge service management.

| Method | Description |
|--------|-------------|
| `createLoungeService(data)` | Create lounge service offering |
| `getAllLoungeServices()` | List all |
| `getLoungeServicesByLoungeId(loungeId)` | Get services for a lounge |
| `getLoungeServiceById(serviceId)` | Get by ID |
| `getServiceNameById(serviceId)` | Lightweight name lookup |
| `updateLoungeService(serviceId, data)` | Update pricing, duration, agents |
| `deleteLoungeService(serviceId)` | Remove lounge service |
| `toggleLoungeServiceStatus(serviceId)` | Toggle active ↔ inactive |
| `patchLoungeOpeningHours(loungeId, hours)` | Update lounge hours |
| `getAgentsPerLounge(loungeId)` | List agents for a lounge |
| `updateLoungeProfile(loungeId, data)` | Update lounge profile fields |
| `getLoungeServicesPaginated(page, limit)` | Admin paginated view |
| `bulkCreateLoungeServices(data[])` | Batch import |
| `searchLoungeServices(query)` | Text search |

### ServiceSuggestionsService & CatalogSuggestionsService

| Method | Description |
|--------|-------------|
| `createServiceSuggestion(data)` | Lounge submits suggestion |
| `getServiceSuggestionsPaginated(page, limit)` | Paginated list |
| `getServiceSuggestionById(id)` | Get by ID |
| `updateServiceSuggestion(id, data)` | Lounge updates own suggestion |
| `deleteServiceSuggestion(id)` | Delete suggestion |
| `getServiceSuggestionsStats()` | Count by status |
| `updateServiceSuggestionStatus(id, data)` | Admin status transition + notification |
| `adminUpdateServiceSuggestionStatus(id, data)` | Admin approve → auto-creates Service + optionally LoungeService |

### RatingService

| Method | Description |
|--------|-------------|
| `upsertRating(clientId, dto)` | Create or update rating + recalculate lounge average + notify |
| `deleteRating(clientId, loungeId)` | Delete rating + recalculate average |
| `getLoungeRatings(loungeId, page, limit)` | Paginated ratings for a lounge |
| `getMyRating(clientId, loungeId)` | Get current user's rating for a lounge |

---

## Flows

### Service Suggestion → Approval → Auto-Creation

```mermaid
sequenceDiagram
    participant L as Lounge
    participant API as SuggestionController
    participant SS as SuggestionService
    participant AS as CatalogSuggestionsService
    participant NS as NotificationService
    participant DB as MongoDB

    L->>API: POST /v1/service-suggestions {name, description, ...}
    API->>SS: createServiceSuggestion(data)
    SS->>DB: Create ServiceSuggestion (status: pending)
    SS->>NS: notifySuggestionCreated(admins)
    SS-->>L: 201 Suggestion created

    Note over API: Admin reviews...

    API->>AS: adminUpdateServiceSuggestionStatus(id, {status: approved, categoryId, ...})
    AS->>DB: Update suggestion status → approved
    AS->>DB: Service.create({...suggestion fields})
    AS->>NS: notifySuggestionApproved(lounge)
    AS-->>Admin: 200 Suggestion approved + Service created
```

### Rating Upsert Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant RC as RatingController
    participant RS as RatingService
    participant NS as NotificationService
    participant DB as MongoDB

    C->>RC: POST /v1/ratings {loungeId, rating, review?}
    RC->>RS: upsertRating(clientId, data)
    RS->>DB: Rating.findOneAndUpdate({clientId, loungeId}, data, {upsert:true, new:true})
    RS->>DB: Aggregate AVG(rating) for loungeId
    RS->>DB: User.findByIdAndUpdate(loungeId, {rating: avg, ratingsCount})
    RS->>NS: notifyLoungRated(loungeId, clientId, rating)
    RS-->>C: 200/201 { data: rating }
```

### LoungeService Assignment Flow

```mermaid
sequenceDiagram
    participant L as Lounge
    participant LSC as LoungeServiceController
    participant LSS as LoungeServicesService
    participant DB as MongoDB

    L->>LSC: POST /v1/lounge-services {serviceId, agentIds, price, duration}
    LSC->>LSS: createLoungeService(loungeId, data)
    LSS->>DB: Validate Service exists
    LSS->>DB: Validate each agentId belongs to lounge
    LSS->>DB: LoungeService.create({loungeId, serviceId, agentIds, price, duration})
    LSS-->>L: 201 { data: loungeService }

    L->>LSC: PATCH /v1/lounge-services/:id/agents {agentIds}
    LSC->>LSS: updateLoungeServiceAgents(id, loungeId, agentIds)
    LSS->>DB: LoungeService.findOneAndUpdate({_id, loungeId}, {agentIds})
    LSS-->>L: 200 Updated
```

---

## Directory Structure

```
src/systems/ServiceCatalogSystem/
├── interfaces/
│   └── catalog.interface.ts    # ServiceCategoryType, SuggestionStatus enums
├── models/
│   ├── service.model.ts
│   ├── serviceCategory.model.ts
│   ├── loungeService.model.ts
│   ├── serviceSuggestion.model.ts
│   └── rating.model.ts
├── dtos/
│   ├── services.dto.ts
│   ├── serviceCategories.dto.ts
│   ├── loungeServices.dto.ts
│   ├── serviceSuggestions.dto.ts
│   └── rating.dto.ts
├── services/
│   ├── services.service.ts
│   ├── serviceCategories.service.ts
│   ├── loungeServices.service.ts
│   ├── serviceSuggestions.service.ts
│   └── rating.service.ts
├── controllers/
│   ├── services.controller.ts
│   ├── serviceCategories.controller.ts
│   ├── loungeServices.controller.ts
│   ├── serviceSuggestions.controller.ts
│   └── rating.controller.ts
├── routes/
│   ├── services.route.ts
│   ├── serviceCategories.route.ts
│   ├── loungeServices.route.ts
│   ├── serviceSuggestions.route.ts
│   └── rating.route.ts
└── README.md
```
    AS->>DB: Create new Service {name, categoryId}
    AS->>DB: Optionally create LoungeService for the suggesting lounge
    AS->>DB: Update suggestion status → implemented
    AS->>NS: notifySuggestionApproved(loungeId)
    AS-->>API: Done
```

### Rating & Average Recalculation

```mermaid
sequenceDiagram
    participant C as Client
    participant API as RatingController
    participant RS as RatingService
    participant NS as NotificationService
    participant DB as MongoDB

    C->>API: PUT /v1/ratings {loungeId, score: 4, comment: "Great!"}
    API->>RS: upsertRating(clientId, dto)
    RS->>DB: Upsert Rating (unique: clientId + loungeId)
    RS->>DB: Aggregate avg(score) for loungeId
    RS->>DB: Update User(loungeId).ratingsAverage, ratingsCount
    RS->>NS: notifyLoungeRated(loungeId, clientId, score)
    RS-->>C: 200 Rating saved
```

### Queue-Booking Toggle

```mermaid
sequenceDiagram
    participant L as Lounge
    participant API as LoungeController
    participant LS as LoungeServicesService
    participant DB as MongoDB

    L->>API: PATCH /v1/lounge/agents/:agentId/queue-booking
    API->>LS: Toggle agent.acceptQueueBooking
    LS->>DB: Agent.findByIdAndUpdate({acceptQueueBooking: !current})
    LS-->>L: 200 {acceptQueueBooking: true/false}
```

---

## Directory Structure

```
ServiceCatalogSystem/
├── controllers/
│   ├── services.controller.ts           # Global services endpoints
│   ├── serviceCategories.controller.ts  # Category endpoints
│   ├── loungeServices.controller.ts     # Lounge service management
│   ├── lounge.controller.ts             # Lounge-specific operations
│   ├── serviceSuggestions.controller.ts  # Suggestion endpoints
│   └── rating.controller.ts             # Rating endpoints
├── dtos/
│   ├── services.dto.ts
│   ├── serviceCategories.dto.ts
│   ├── loungeServices.dto.ts
│   ├── serviceSuggestions.dto.ts
│   └── rating.dto.ts
├── interfaces/
│   ├── services.interface.ts
│   ├── serviceCategories.interface.ts
│   ├── loungeServices.interface.ts
│   ├── serviceSuggestions.interface.ts
│   └── rating.interface.ts
├── models/
│   ├── service.model.ts
│   ├── serviceCategory.model.ts
│   ├── loungeService.model.ts
│   ├── serviceSuggestion.model.ts
│   └── rating.model.ts
├── routes/
│   ├── services.route.ts
│   ├── serviceCategories.route.ts
│   ├── loungeServices.route.ts
│   ├── lounge.route.ts
│   ├── serviceSuggestions.route.ts
│   └── rating.route.ts
├── services/
│   ├── services.service.ts
│   ├── serviceCategories.service.ts
│   ├── loungeServices.service.ts
│   ├── serviceSuggestions.service.ts
│   ├── catalogSuggestions.service.ts
│   └── rating.service.ts
└── tests/
    └── serviceCatalog.test.ts
```
