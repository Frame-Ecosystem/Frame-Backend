# ServiceCatalogSystem

Manages the shared beauty/wellness service catalog, lounge service offerings, ratings, and service suggestions. Acts as the bridge between what lounges offer and how clients discover them.

## Responsibilities

- Maintain the **global service catalog** (service types and categories)
- Manage **lounge-specific service offerings** (price, duration, gender, agents)
- Public discovery endpoints for services, categories, and lounges
- **Rating system** for lounge services (1–5 stars, aggregated)
- **Service suggestions** — users propose new services; admin reviews and implements
- Catalog management by admins (bulk operations, approval)

## Structure

```
ServiceCatalogSystem/
├── controllers/    publicServiceCategories · publicServices · serviceCategories · services
│                   serviceSuggestions · lounge · loungeServices · rating · catalogManagement
├── services/       serviceCategories · services · serviceSuggestions · catalogSuggestions
│                   lounge · loungeServices · rating
├── models/         service · serviceCategory · serviceSuggestion · loungeService · rating
├── routes/         publicServiceCategories · publicServices · serviceCategories · services
│                   serviceSuggestions · lounge · loungeServices · rating
├── dtos/           serviceCategories · services · serviceSuggestions · loungeServices · rating
└── interfaces/     service · serviceCategory · serviceSuggestion · loungeService · rating
```

## Key Entities

| Entity | Description |
|---|---|
| `ServiceCategory` | Top-level grouping — e.g., Hair, Nails, Skincare |
| `Service` | Catalog entry — name (unique, normalized), categoryId |
| `LoungeService` | A lounge's offering — serviceId, loungeId, agentIds[], price, duration, gender, status |
| `Rating` | Review — userId, loungeId, loungeServiceId, stars (1-5), comment |
| `ServiceSuggestion` | User-submitted suggestion with status and optional auto-implementation |

## LoungeService Gender Types

`MEN` | `WOMEN` | `UNISEX` | `KIDS`

## LoungeService Statuses

`ACTIVE` | `INACTIVE`

## API Routes

| Method | Path | Description |
|---|---|---|
| GET | `/v1/public/services` | Browse all services (no auth) |
| GET | `/v1/public/categories` | Browse categories (no auth) |
| CRUD | `/v1/services` | Service catalog management |
| CRUD | `/v1/categories` | Category management |
| CRUD | `/v1/lounge-services` | Lounge's own service offerings |
| POST | `/v1/lounge-services/:id/agents` | Assign agents to a service |
| CRUD | `/v1/ratings` | Rate a lounge service |
| POST | `/v1/suggestions` | Submit a service suggestion |
| GET | `/v1/admin/catalog` | Admin catalog management |

## Dependencies

- **Inbound**: `BookingSystem` (validates services on booking), `AdminSystem` (catalog management)
- **Outbound**: `UserManager` (agent assignment, lounge identity), `NotificationSystem` (rating events)
