# CSRF Audit (v0)

## Summary

The app has a CSRF middleware and several systems already use it. This audit captured the inconsistent coverage found during v0 hardening and the main gaps have now been patched.

## Confirmed Protected Areas

- Admin management routes
- Agent management routes (except image upload noted below)
- Service catalog management routes in `services`, `loungeServices`, and suggestion routes
- Marketplace product, store, review, cart, order, wishlist, and category mutation routes
- Queue mutation routes

## Patched Gaps

- `src/systems/AuthSystem/routes/auth.route.ts`
  - `POST /logout`
  - `POST /logout-all`
  - `POST /refresh-token` remains intentionally exempt; refresh token rotation uses the refresh token itself and has rate limiting.

- `src/systems/UserManager/routes/currentUser.route.ts`
  - Profile updates, image uploads, password change, account deletion, theme/language updates, verification endpoints.

- `src/systems/FeedContentSystem/routes/post.route.ts`
  - Create/update/delete posts, like/save, hide/unhide, admin delete.

- `src/systems/FeedContentSystem/routes/reel.route.ts`
  - Create/update/delete reels, like/save, hide/unhide, admin delete.

- `src/systems/FeedContentSystem/routes/comment.route.ts`
  - Create/delete comments, like, hide/unhide, admin delete.

- `src/systems/FeedContentSystem/routes/like.route.ts`
  - Lounge like toggle.

- `src/systems/UserManager/routes/follow.route.ts`
  - Follow/unfollow.

- `src/systems/BookingSystem/routes/booking.route.ts`
  - Booking and queue-booking creation routes.

- `src/systems/ChatSystem/routes/chat.route.ts`
  - Conversation, message, typing, read, reaction, and delete mutations.

- `src/systems/NotificationSystem/routes/notification.route.ts`
  - Mark read, device-token register/unregister, notification deletes.

- `src/systems/ServiceCatalogSystem/routes/rating.route.ts`
  - Upsert/delete rating.

- `src/systems/ServiceCatalogSystem/routes/serviceCategories.route.ts`
  - Category create/update/delete.

- `src/systems/ServiceCatalogSystem/routes/lounge.route.ts`
  - Queue booking toggles.

## Remaining Follow-Up

- Re-run this audit whenever new mutating routes are added.
- Consider central route tests that assert cookie-auth mutating endpoints enforce CSRF for browser requests.

## Implementation Rule

For authenticated browser-cookie routes, add `csrfMiddleware` after auth/role checks and before validation/controller execution. Mobile clients remain exempt through the existing `x-client-type: mobile` bypass.
