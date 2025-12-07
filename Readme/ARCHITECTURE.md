# 3-Layer Architecture Documentation

## Overview

This project has been reorganized into **3 distinct layers** for better separation of concerns:

1. **Auth Layer** - User authentication, registration, and session management
2. **Admin Layer** - Administrative user management functions
3. **Current User Layer** - Self-service endpoints for authenticated users

---

## Architecture Structure

```
src/
├── controllers/
│   ├── auth.controller.ts          # Auth endpoints (signup, login, logout, etc.)
│   ├── admin.controller.ts         # Admin user management
│   └── user.controller.ts          # Current user self-service
├── services/
│   ├── auth.service.ts             # Auth business logic
│   ├── admin.service.ts            # Admin operations logic
│   └── user.service.ts             # Current user operations logic
├── routes/
│   ├── auth.route.ts               # Auth routes: /v1/auth/*
│   ├── admin.route.ts              # Admin routes: /v1/admin/users/*
│   ├── currentUser.route.ts        # User self-service routes: /v1/me/*
│   └── users.route.ts              # [DEPRECATED] Old mixed routes
└── middlewares/
    ├── auth.middleware.ts          # JWT verification
    ├── admin.middleware.ts         # Admin role validation
    └── ...other middlewares
```

---

## Layer 1: Auth Layer

**Purpose**: Handle user authentication and session management

### Files
- **Controller**: `src/controllers/auth.controller.ts`
- **Service**: `src/services/auth.service.ts`
- **Routes**: `src/routes/auth.route.ts`

### Routes

```
POST   /v1/auth/signup              # Register new user
POST   /v1/auth/login               # Login (get JWT token)
POST   /v1/auth/logout              # Logout (current device)
POST   /v1/auth/logout-all          # Logout from all devices
POST   /v1/auth/refresh-token       # Refresh access token
POST   /v1/auth/change-password     # Change password
GET    /v1/auth/session-track       # [Admin only] Get all online users
```

### Key Features
- Signup with validation
- JWT-based authentication
- Refresh token rotation
- Password change with confirmation
- Session tracking (multiple devices)
- Rate limiting on all endpoints
- CSRF protection on POST/PUT/DELETE
- HttpOnly cookies for secure token storage

### Methods in AuthController

```typescript
public signUp()              // User registration
public logIn()               // User login
public logOut()              // Logout from current device
public logOutAllDevices()    // Logout from all devices
public refreshToken()        // Refresh access token
public changePassword()      // Change password
public getSessionTrack()     // Get online users (admin)
```

---

## Layer 2: Admin Layer

**Purpose**: Administrative user management functions

### Files
- **Controller**: `src/controllers/admin.controller.ts`
- **Service**: `src/services/admin.service.ts`
- **Routes**: `src/routes/admin.route.ts`

### Routes

```
GET    /v1/admin/users              # List all users (paginated)
GET    /v1/admin/users/:id          # Get user by ID
POST   /v1/admin/users              # Create new user
PUT    /v1/admin/users/:id          # Update user
DELETE /v1/admin/users/:id          # Delete user
```

### Key Features
- List, read, create, update, delete operations
- Admin-only access (via `adminMiddleware`)
- CSRF protection
- Input validation
- Sensitive field stripping (passwords not returned)
- Error handling with specific exceptions

### Methods in AdminController

```typescript
public getUsers()            // List all users
public getUserById()         // Get user by ID
public createUser()          // Create new user
public updateUser()          // Update user
public deleteUser()          // Delete user
```

### Authorization
All admin routes require:
- `authMiddleware` - User must be authenticated
- `adminMiddleware` - User must have admin role

---

## Layer 3: Current User Layer

**Purpose**: Self-service endpoints for authenticated users to manage their own profiles

### Files
- **Controller**: `src/controllers/user.controller.ts`
- **Service**: `src/services/user.service.ts`
- **Routes**: `src/routes/currentUser.route.ts`

### Routes

```
GET    /v1/me                       # Get current user profile
PUT    /v1/me                       # Update own profile
PUT    /v1/me/location              # Update location
PUT    /v1/me/image                 # Upload profile image
DELETE /v1/me                       # Delete own account (requires password)
```

### Key Features
- Users can only access their own data (ID from JWT)
- Password requirement for account deletion (security)
- Profile image upload
- Location update
- Account deletion with confirmation
- CSRF protection on write operations

### Methods in UserController

```typescript
public getMe()               // Get current user profile
public updateMe()            // Update profile
public updateLocation()      // Update location
public uploadProfileImage()  // Upload image
public deleteMe()            // Delete account (requires password)
```

### Authorization
All user routes require:
- `authMiddleware` - User must be authenticated
- No role check - any authenticated user can access their own endpoints

---

## Data Flow Example

### Signup Flow
```
Client POST /v1/auth/signup
  ↓
authRoute → validationMiddleware → signupRateLimiter
  ↓
AuthController.signUp()
  ↓
AuthService.signup()
  ↓
Database: Create user with hashed password
  ↓
Response: { data: user (no password), message: 'signup' }
```

### Get Current User Profile
```
Client GET /v1/me
  ↓
currentUserRoute → authMiddleware (validates JWT)
  ↓
UserController.getMe()
  ↓
Returns: req.user from middleware
  ↓
Response: { data: user, message: 'User retrieved successfully' }
```

### Admin Update User
```
Client PUT /v1/admin/users/:id
  ↓
adminRoute → authMiddleware → adminMiddleware → csrfMiddleware → validationMiddleware
  ↓
AdminController.updateUser()
  ↓
AdminService.updateUser()
  ↓
Database: Update user
  ↓
Response: { data: updatedUser (no password), message: 'updated' }
```

---

## Middleware Stack by Layer

### Auth Layer
- `signupRateLimiter` - Rate limit signup attempts
- `loginRateLimiter` - Rate limit login attempts
- `refreshTokenRateLimiter` - Rate limit token refresh
- `strictRateLimiter` - Strict rate limit for password change
- `validationMiddleware` - Validate DTOs
- `csrfMiddleware` - CSRF protection (on protected endpoints)
- `authMiddleware` - JWT verification (on protected endpoints)

### Admin Layer
- `authMiddleware` - JWT verification
- `adminMiddleware` - Admin role check
- `csrfMiddleware` - CSRF protection
- `validationMiddleware` - Validate DTOs

### Current User Layer
- `authMiddleware` - JWT verification
- `csrfMiddleware` - CSRF protection (on write operations)
- `validationMiddleware` - Validate DTOs

---

## DTOs (Data Transfer Objects)

Located in `src/dtos/users.dto.ts`:

```typescript
CreateUserDto              // Signup/admin user creation
LoginUserDto               // Login credentials
UpdateUserDto              // Update user info (optional fields)
ChangePasswordDto          // Password change
DeleteAccountDto           // Account deletion with password confirmation
LocationDto                // User location
```

---

## Services

### AuthService (`src/services/auth.service.ts`)
- `signup(userData)` - Register new user
- `login(userData, deviceInfo)` - Authenticate user
- `logout(user, jti)` - Logout from current device
- `logoutAllDevices(userId)` - Logout from all devices
- `refreshAccessToken(token, deviceInfo)` - Refresh token
- `changePassword(userId, passwordData)` - Change password
- `createToken(user)` - Generate JWT token
- `getOnlineUsers()` - Get all online users

### AdminService (`src/services/admin.service.ts`)
- `findAllUsers()` - List all users
- `findUserById(userId)` - Get user by ID
- `createUser(userData)` - Create new user
- `updateUser(userId, userData)` - Update user
- `deleteUser(userId)` - Delete user

### UserService (`src/services/user.service.ts`)
- `updateUser(userId, userData)` - Update own profile
- `updateUserLocation(userId, locationData)` - Update location
- `uploadProfileImage(userId, file)` - Upload image
- `deleteMe(userId, password)` - Delete own account

---

## Security Features

### Authentication
- JWT tokens with configurable expiry
- Refresh token rotation
- Multiple device session tracking

### Authorization
- Role-based access control (RBAC)
- User ID enforcement (can't modify others' data)
- Admin role validation

### Protection Mechanisms
- Password hashing (bcrypt)
- CSRF tokens (double-submit cookie)
- Rate limiting (signup, login, password change)
- HttpOnly cookies (refresh token storage)
- Input validation (class-validator)
- XSS prevention (sensitive field stripping)

### Error Handling
- Custom exceptions (HttpException, BadRequestException, etc.)
- Centralized error middleware
- No sensitive info in error messages
- Proper HTTP status codes

---

## Testing Structure

### Files
- `src/tests/auth.test.ts` - Auth layer tests
- `src/tests/users.test.ts` - Admin/User layer tests
- `src/tests/index.test.ts` - General tests

### Running Tests
```bash
npm run test
```

---

## Swagger Documentation

API documentation is auto-generated from `swagger.yaml` and includes:

- Auth endpoints grouped under `/v1/auth`
- Admin endpoints grouped under `/v1/admin/users`
- Current user endpoints grouped under `/v1/me`

**Access Swagger UI**: `http://localhost:3000/api-docs`

---

## Server Initialization

In `src/server.ts`, routes are registered in order:

```typescript
const app = new App([
  new IndexRoute(),           // GET /
  new AuthRoute(),            // /v1/auth/*
  new AdminRoute(),           // /v1/admin/users/*
  new CurrentUserRoute(),     // /v1/me/*
]);
```

---

## Migration from Old Structure

### Before (Old Structure)
- Mixed routes in `users.route.ts`
- No clear separation between admin and user operations
- Confusing endpoint structure

### After (New 3-Layer Structure)
- **Auth**: `/v1/auth/*` - All authentication endpoints
- **Admin**: `/v1/admin/users/*` - Admin operations only
- **Current User**: `/v1/me/*` - User self-service only

---

## Best Practices

1. **Always validate input** using DTOs and middleware
2. **Use specific exceptions** for better error handling
3. **Strip sensitive fields** before returning user data
4. **Check user permissions** at middleware level
5. **Use CSRF protection** on state-changing operations
6. **Rate limit** sensitive operations
7. **Log important actions** for audit trails
8. **Document new endpoints** in Swagger

---

## Future Enhancements

- [ ] Add pagination to user list endpoint
- [ ] Add search/filter for user listing
- [ ] Add audit logging for admin operations
- [ ] Add batch operations for admin
- [ ] Add profile picture CDN integration
- [ ] Add 2FA for accounts
- [ ] Add email verification for new emails
- [ ] Add activity logging per user

---

## Quick Reference

| Layer | Base Path | Requires Auth | Requires Admin | Purpose |
|-------|-----------|---------------|----------------|---------|
| Auth | `/v1/auth` | Partial | No | User registration & login |
| Admin | `/v1/admin/users` | Yes | Yes | User management |
| Current User | `/v1/me` | Yes | No | Self-service profile |

---

## Support

For questions or issues with the architecture, refer to:
- Individual controller files for endpoint implementations
- Service files for business logic
- Route files for middleware configuration
- `swagger.yaml` for API documentation
