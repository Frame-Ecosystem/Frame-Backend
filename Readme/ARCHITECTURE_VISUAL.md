# 3-Layer Architecture Visual Guide

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      CLIENT REQUESTS                             │
└────────────────┬────────────────────────────────────────────────┘
                 │
      ┌──────────┼──────────────┐
      │          │              │
      ▼          ▼              ▼
   ┌──────┐  ┌───────┐     ┌──────────┐
   │/v1/  │  │/v1/   │     │/v1/auth/ │
   │auth/ │  │admin/ │     │...       │
   │...   │  │users/ │     │          │
   └──────┘  │...    │     └──────────┘
             └───────┘
      │         │           │
      │         │           │
   LAYER 1   LAYER 2      LAYER 3
   (Auth)    (Admin)    (Current User)


┌──────────────────────────────────────────────────────────────────┐
│                     EXPRESS APP (server.ts)                       │
│                                                                   │
│  Routes Initialization:                                          │
│  ┌─ IndexRoute          (GET /)                                  │
│  ├─ AuthRoute          (POST /v1/auth/*)                         │
│  ├─ AdminRoute         (*/v1/admin/users/*)                      │
│  └─ CurrentUserRoute   (*/v1/me/*)                               │
└──────────────────────────────────────────────────────────────────┘
      │          │           │
      ▼          ▼           ▼
   ┌────────────────────────────────────┐
   │      MIDDLEWARE LAYER              │
   │                                    │
   │ • Authentication (authMiddleware)  │
   │ • Authorization (adminMiddleware)  │
   │ • CSRF Protection                  │
   │ • Rate Limiting                    │
   │ • Validation (validationMiddleware)│
   │ • File Upload                      │
   └────────────────────────────────────┘
      │          │           │
      ▼          ▼           ▼
   ┌────────────────────────────────────┐
   │      CONTROLLER LAYER              │
   │                                    │
   │ ┌──────────────────────────┐       │
   │ │ AuthController           │       │
   │ │ • signUp()               │       │
   │ │ • logIn()                │       │
   │ │ • logOut()               │       │
   │ │ • changePassword()       │       │
   │ └──────────────────────────┘       │
   │                                    │
   │ ┌──────────────────────────┐       │
   │ │ AdminController          │       │
   │ │ • getUsers()             │       │
   │ │ • getUserById()          │       │
   │ │ • createUser()           │       │
   │ │ • updateUser()           │       │
   │ │ • deleteUser()           │       │
   │ └──────────────────────────┘       │
   │                                    │
   │ ┌──────────────────────────┐       │
   │ │ UserController           │       │
   │ │ • getMe()                │       │
   │ │ • updateMe()             │       │
   │ │ • updateLocation()       │       │
   │ │ • uploadProfileImage()   │       │
   │ │ • deleteMe()             │       │
   │ └──────────────────────────┘       │
   └────────────────────────────────────┘
      │          │           │
      ▼          ▼           ▼
   ┌────────────────────────────────────┐
   │      SERVICE LAYER                 │
   │                                    │
   │ ┌──────────────────────────┐       │
   │ │ AuthService              │       │
   │ │ • Business logic for auth│       │
   │ │ • Token management       │       │
   │ │ • Session tracking       │       │
   │ └──────────────────────────┘       │
   │                                    │
   │ ┌──────────────────────────┐       │
   │ │ AdminService             │       │
   │ │ • User management logic  │       │
   │ │ • Admin operations       │       │
   │ └──────────────────────────┘       │
   │                                    │
   │ ┌──────────────────────────┐       │
   │ │ UserService              │       │
   │ │ • User self-service logic│       │
   │ │ • Profile operations     │       │
   │ └──────────────────────────┘       │
   └────────────────────────────────────┘
      │          │           │
      ▼          ▼           ▼
   ┌────────────────────────────────────┐
   │      DATA ACCESS LAYER             │
   │                                    │
   │  MongoDB via Mongoose Models       │
   │                                    │
   │  • userModel                       │
   │  • Indexes                         │
   │  • Validations                     │
   └────────────────────────────────────┘
      │          │           │
      └──────────┼───────────┘
                 │
      ┌──────────▼──────────┐
      │                     │
      ▼                     ▼
   ┌──────────┐      ┌──────────┐
   │ MongoDB  │      │ Response │
   │ Database │      │ to Client│
   └──────────┘      └──────────┘
```

---

## Layer Interaction Flow

### Layer 1: Authentication Flow
```
Client Request
     │
     ▼
POST /v1/auth/signup  (no auth required)
     │
     ├─ signupRateLimiter
     ├─ validationMiddleware (CreateUserDto)
     │
     ▼
AuthController.signUp()
     │
     ├─ Validate input
     ├─ Check duplicate email
     │
     ▼
AuthService.signup()
     │
     ├─ Hash password (bcrypt)
     ├─ Create user in DB
     │
     ▼
Response: { data: user, message: 'signup' }
```

### Layer 2: Admin Operation Flow
```
Client Request with JWT
     │
     ▼
PUT /v1/admin/users/:id  (admin only)
     │
     ├─ authMiddleware (verify JWT)
     ├─ adminMiddleware (check admin role)
     ├─ csrfMiddleware (verify CSRF token)
     ├─ validationMiddleware (UpdateUserDto)
     │
     ▼
AdminController.updateUser()
     │
     ├─ Extract user ID from params
     ├─ Validate request data
     │
     ▼
AdminService.updateUser()
     │
     ├─ Check if user exists
     ├─ Update user in DB
     │
     ▼
Response: { data: updatedUser, message: 'updated' }
```

### Layer 3: Current User Operation Flow
```
Client Request with JWT
     │
     ▼
GET /v1/me  (auth required)
     │
     ├─ authMiddleware (verify JWT)
     │   ├─ Decode JWT
     │   ├─ Load user from DB
     │   ├─ Attach user to req.user
     │
     ▼
UserController.getMe()
     │
     ├─ Get user from req.user (already loaded)
     ├─ Strip sensitive fields
     │
     ▼
Response: { data: user (no password), message: 'User retrieved successfully' }
```

---

## Request Lifecycle

```
┌─ REQUEST ARRIVES
│
├─ Express Router matches route
│  └─ Routes: auth → admin → currentUser → 404
│
├─ MIDDLEWARE STACK
│  ├─ Rate Limiter (if configured)
│  ├─ Authentication Middleware
│  │  └─ Verify JWT, load user, attach to req
│  ├─ Authorization Middleware
│  │  └─ Check role/permissions
│  ├─ CSRF Middleware
│  │  └─ Verify CSRF token
│  ├─ Validation Middleware
│  │  └─ Validate DTOs
│  └─ File Upload Middleware
│     └─ Handle file uploads
│
├─ CONTROLLER METHOD
│  ├─ Extract parameters from request
│  ├─ Call service method
│  └─ Send response
│
├─ SERVICE METHOD
│  ├─ Business logic
│  ├─ Database operations
│  ├─ Error handling
│  └─ Return result
│
├─ DATABASE INTERACTION
│  ├─ Query MongoDB
│  ├─ Apply business rules
│  └─ Return data
│
├─ CONTROLLER RESPONSE
│  ├─ Format response
│  ├─ Strip sensitive data
│  └─ Send JSON response
│
├─ ERROR HANDLING
│  └─ If any error occurs
│     └─ Error middleware catches it
│        └─ Log error
│        └─ Send error response
│
└─ RESPONSE SENT TO CLIENT
```

---

## Authorization Matrix

```
┌────────────────────────────────────┬─────────────┬──────────────┬──────────────┐
│ Endpoint                           │ Public      │ Auth         │ Admin        │
├────────────────────────────────────┼─────────────┼──────────────┼──────────────┤
│ POST /v1/auth/signup               │ ✅ Yes      │              │              │
│ POST /v1/auth/login                │ ✅ Yes      │              │              │
│ POST /v1/auth/logout               │             │ ✅ Yes       │              │
│ POST /v1/auth/logout-all           │             │ ✅ Yes       │              │
│ POST /v1/auth/refresh-token        │ ✅ Yes      │              │              │
│ POST /v1/auth/change-password      │             │ ✅ Yes       │              │
│ GET /v1/auth/session-track         │             │              │ ✅ Yes       │
├────────────────────────────────────┼─────────────┼──────────────┼──────────────┤
│ GET /v1/admin/users                │             │              │ ✅ Yes       │
│ GET /v1/admin/users/:id            │             │              │ ✅ Yes       │
│ POST /v1/admin/users               │             │              │ ✅ Yes       │
│ PUT /v1/admin/users/:id            │             │              │ ✅ Yes       │
│ DELETE /v1/admin/users/:id         │             │              │ ✅ Yes       │
├────────────────────────────────────┼─────────────┼──────────────┼──────────────┤
│ GET /v1/me                         │             │ ✅ Yes       │ ✅ Yes       │
│ PUT /v1/me                         │             │ ✅ Yes       │ ✅ Yes       │
│ PUT /v1/me/location                │             │ ✅ Yes       │ ✅ Yes       │
│ PUT /v1/me/image                   │             │ ✅ Yes       │ ✅ Yes       │
│ DELETE /v1/me                      │             │ ✅ Yes       │ ✅ Yes       │
└────────────────────────────────────┴─────────────┴──────────────┴──────────────┘
```

---

## Middleware Application Per Layer

### Auth Layer: `/v1/auth`
```
┌─ signupRateLimiter
├─ validationMiddleware
├─ csrfMiddleware (on protected endpoints)
├─ authMiddleware (on protected endpoints)
└─ ...
```

### Admin Layer: `/v1/admin/users`
```
┌─ authMiddleware
├─ adminMiddleware
├─ csrfMiddleware
├─ validationMiddleware
└─ ...
```

### Current User Layer: `/v1/me`
```
┌─ authMiddleware
├─ csrfMiddleware (on write operations)
├─ validationMiddleware
├─ upload.single() (on file upload)
└─ ...
```

---

## File Organization

```
src/
│
├─ controllers/
│  ├─ auth.controller.ts          ← AUTH LAYER
│  ├─ admin.controller.ts         ← ADMIN LAYER
│  ├─ user.controller.ts          ← CURRENT USER LAYER
│  └─ index.controller.ts         ← UTILITY
│
├─ services/
│  ├─ auth.service.ts             ← AUTH LAYER
│  ├─ admin.service.ts            ← ADMIN LAYER
│  ├─ user.service.ts             ← CURRENT USER LAYER
│  └─ ...other services
│
├─ routes/
│  ├─ auth.route.ts               ← AUTH LAYER
│  ├─ admin.route.ts              ← ADMIN LAYER (NEW)
│  ├─ currentUser.route.ts        ← CURRENT USER LAYER (NEW)
│  ├─ users.route.ts              ← DEPRECATED
│  └─ index.route.ts              ← UTILITY
│
├─ dtos/
│  └─ users.dto.ts
│
├─ interfaces/
│  ├─ auth.interface.ts
│  ├─ users.interface.ts
│  └─ routes.interface.ts
│
├─ middlewares/
│  ├─ auth.middleware.ts
│  ├─ admin.middleware.ts
│  ├─ csrf.middleware.ts
│  ├─ error.middleware.ts
│  ├─ validation.middleware.ts
│  ├─ rate-limit.middleware.ts
│  └─ ...
│
├─ models/
│  └─ users.model.ts
│
├─ exceptions/
│  └─ HttpException.ts
│
├─ utils/
│  ├─ logger.ts
│  ├─ validateEnv.ts
│  └─ util.ts
│
├─ app.ts
└─ server.ts
```

---

## Request Examples

### Example 1: User Signup (Layer 1 - Auth)
```bash
curl -X POST http://localhost:3000/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securePassword123",
    "username": "username",
    "phoneNumber": "+1234567890"
  }'

Response:
{
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "username": "username",
    "phoneNumber": "+1234567890",
    "role": "user"
    // password is NOT included
  },
  "message": "signup"
}
```

### Example 2: Admin Get All Users (Layer 2 - Admin)
```bash
curl -X GET http://localhost:3000/v1/admin/users \
  -H "Authorization: Bearer <access_token>" \
  -H "X-CSRF-Token: <csrf_token>"

Response:
{
  "data": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "email": "user@example.com",
      "username": "username",
      "role": "user"
      // password is NOT included
    },
    ...
  ],
  "message": "findAll"
}
```

### Example 3: Get Current User Profile (Layer 3 - Current User)
```bash
curl -X GET http://localhost:3000/v1/me \
  -H "Authorization: Bearer <access_token>"

Response:
{
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "username": "username",
    "phoneNumber": "+1234567890",
    "role": "user",
    "location": {
      "latitude": 40.7128,
      "longitude": -74.0060,
      "address": "New York, NY"
    }
    // password is NOT included
  },
  "message": "User retrieved successfully"
}
```

---

## Security Flow

```
┌─ REQUEST ARRIVES
│
├─ SSL/TLS Encryption
│  └─ All traffic encrypted
│
├─ Authentication Check
│  ├─ Extract JWT from Authorization header or cookies
│  ├─ Verify JWT signature with SECRET_KEY
│  ├─ Check token expiration
│  ├─ Load user from database
│  ├─ Attach user to request
│  └─ Pass to next middleware
│
├─ Authorization Check (if needed)
│  ├─ Check user role
│  ├─ Compare user ID in request with authenticated user
│  ├─ Enforce admin-only endpoints
│  └─ Pass or reject request
│
├─ CSRF Protection
│  ├─ For POST/PUT/DELETE requests
│  ├─ Verify CSRF token in request header
│  ├─ Compare with token in cookie
│  └─ Reject if mismatch
│
├─ Input Validation
│  ├─ Validate request body against DTO
│  ├─ Check data types
│  ├─ Verify required fields
│  ├─ Reject if invalid
│  └─ Sanitize input
│
├─ Rate Limiting
│  ├─ Track requests per IP
│  ├─ Limit signup attempts
│  ├─ Limit login attempts
│  ├─ Limit password change attempts
│  └─ Reject if exceeded
│
├─ Business Logic
│  ├─ Process request
│  ├─ Perform database operations
│  └─ Apply business rules
│
├─ Response Preparation
│  ├─ Strip sensitive fields (passwords)
│  ├─ Format response
│  └─ Prepare headers
│
├─ Error Handling
│  ├─ Log errors securely
│  ├─ Don't expose sensitive info
│  └─ Return appropriate status code
│
└─ RESPONSE SENT (with HTTPS)
```

---

## Summary

- **3 Layers**: Auth, Admin, Current User
- **Separate files** for each layer
- **Clear responsibility** for each component
- **Security first** approach
- **Scalable** and **maintainable** structure
