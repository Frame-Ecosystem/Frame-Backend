# MarketplaceSystem

Full e-commerce layer enabling lounges and users to run stores, list products, manage orders, and receive reviews.

## Responsibilities

- Store creation and management per lounge owner
- Product listing with **variants**, images, pricing, and inventory
- Auto-slug generation for products
- Media upload to **Cloudflare R2** (product images)
- **Shopping cart** — add, update, remove items
- **Order lifecycle** — create, pay, track, cancel
- **Wishlist** — save products for later
- **Product reviews** with star ratings
- **Analytics** — sales, revenue, top products per store
- Admin store suspension / closure

## Structure

```
MarketplaceSystem/
├── controllers/    store · product · cart · order · review · wishlist · analytics
├── services/       store · product · cart · order · review · wishlist · analytics
├── models/         store · product · cart · order · review · wishlist
├── routes/         store · product · cart · order · review · wishlist · analytics
├── dtos/           store.dto.ts · product.dto.ts · cart.dto.ts · order.dto.ts · review.dto.ts
└── interfaces/     marketplace.interface.ts
```

## Key Entities

| Entity | Description |
|---|---|
| `Store` | Seller storefront — ownerId, name, status, images, contact |
| `Product` | Item for sale — slug, category, variants, price, stock, condition, isDigital |
| `Cart` | User's active cart with line items |
| `Order` | Confirmed purchase with status tracking and payment info |
| `Review` | Product review — stars (1-5), comment, verified purchase |
| `Wishlist` | User's saved products |

## Product Statuses

`DRAFT` → `ACTIVE` | `ARCHIVED`

## Store Statuses

`ACTIVE` | `SUSPENDED` | `CLOSED`

## Product Conditions

`NEW` | `USED` | `REFURBISHED`

## API Routes

| Method | Path | Description |
|---|---|---|
| CRUD | `/v1/stores` | Store management |
| CRUD | `/v1/products` | Product management |
| GET/POST/PUT/DELETE | `/v1/cart` | Cart operations |
| POST/GET | `/v1/orders` | Order creation & history |
| POST/GET | `/v1/reviews` | Product reviews |
| POST/DELETE | `/v1/wishlist` | Wishlist management |
| GET | `/v1/analytics/stores/:id` | Store analytics |

## Dependencies

- **Inbound**: `UserManager` (store owner identity)
- **Outbound**: `NotificationSystem` (order events), `shared/cloudflareR2` (product images)
