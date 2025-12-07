# Quick Reference Guide - 3-Layer Architecture

## API Endpoints Quick Reference

### 🔐 LAYER 1: Authentication (`/v1/auth`)
No auth required for signup/login. Others require JWT.

```
Method   Endpoint                      Auth    CSRF    Rate Limit  Purpose
─────────────────────────────────────────────────────────────────────────────
POST     /v1/auth/signup               ✖️      ✖️      ✅          Register
POST     /v1/auth/login                ✖️      ✖️      ✅          Login
POST     /v1/auth/logout               ✅      ✅      ✖️          Logout
POST     /v1/auth/logout-all           ✅      ✅      ✖️          Logout all devices
POST     /v1/auth/refresh-token        ✖️      ✅      ✅          Refresh JWT
POST     /v1/auth/change-password      ✅      ✅      ✅          Change password
GET      /v1/auth/session-track        ✅ 🔑   ✖️      ✖️          Get online users
```

### 👨‍💼 LAYER 2: Admin Operations (`/v1/admin/users`)
All endpoints require auth + admin role.

```
Method   Endpoint                      Auth    CSRF    Role        Purpose
─────────────────────────────────────────────────────────────────────────────
GET      /v1/admin/users               ✅ 🔑   ✖️      admin       List all users
GET      /v1/admin/users/:id           ✅ 🔑   ✖️      admin       Get user by ID
POST     /v1/admin/users               ✅ 🔑   ✅      admin       Create user
PUT      /v1/admin/users/:id           ✅ 🔑   ✅      admin       Update user
DELETE   /v1/admin/users/:id           ✅ 🔑   ✅      admin       Delete user
```

### 👤 LAYER 3: Current User (`/v1/me`)
All endpoints require auth. Users can only access their own data.

```
Method   Endpoint                      Auth    CSRF    Purpose
─────────────────────────────────────────────────────────────
GET      /v1/me                        ✅      ✖️      Get profile
PUT      /v1/me                        ✅      ✅      Update profile
PUT      /v1/me/location               ✅      ✅      Update location
PUT      /v1/me/image                  ✅      ✅      Upload image
DELETE   /v1/me                        ✅      ✅      Delete account
```

---

## File Locations

### Controllers
```
src/controllers/
├── auth.controller.ts       ← Auth layer
├── admin.controller.ts      ← Admin layer
└── user.controller.ts       ← Current user layer
```

### Services
```
src/services/
├── auth.service.ts          ← Auth layer
├── admin.service.ts         ← Admin layer
└── user.service.ts          ← Current user layer
```

### Routes
```
src/routes/
├── auth.route.ts            ← Auth layer
├── admin.route.ts           ← Admin layer (NEW)
└── currentUser.route.ts     ← Current user layer (NEW)
```

---

## DTOs (Request Body Validation)

```typescript
// Authentication
CreateUserDto          // Fields: email, password, username, phoneNumber, gender, role, location
LoginUserDto           // Fields: emailOrUsername, password
ChangePasswordDto      // Fields: oldPassword, newPassword, confirmPassword

// Updates
UpdateUserDto          // Optional: email, password, username, phoneNumber, gender
LocationDto            // Fields: latitude, longitude, address, placeId

// Special
DeleteAccountDto       // Fields: password (for confirmation)
```

---

## Middleware Stack

### Auth Layer
- `signupRateLimiter` - Limit signup attempts (on signup)
- `loginRateLimiter` - Limit login attempts (on login)
- `refreshTokenRateLimiter` - Limit token refresh (on refresh)
- `strictRateLimiter` - Strict limit on password change
- `validationMiddleware` - Validate request body
- `csrfMiddleware` - CSRF protection (on state changes)
- `authMiddleware` - JWT verification (on protected endpoints)

### Admin Layer
- `authMiddleware` - JWT verification
- `adminMiddleware` - Admin role check
- `csrfMiddleware` - CSRF protection
- `validationMiddleware` - Validate request body

### Current User Layer
- `authMiddleware` - JWT verification
- `csrfMiddleware` - CSRF protection (on state changes)
- `validationMiddleware` - Validate request body
- `upload.single()` - File upload (on image endpoints)

---

## Response Format

### Success Response
```json
{
  "data": { /* actual data */ },
  "message": "success message"
}
```

### Error Response
```json
{
  "message": "error message"
}
```

### Authentication Error
```json
{
  "message": "Authentication token missing"
}
```

### Authorization Error
```json
{
  "message": "User does not have admin role"
}
```

---

## HTTP Status Codes

| Code | Meaning | Common Use |
|------|---------|-----------|
| 200  | OK | GET/PUT/DELETE success |
| 201  | Created | POST success (new resource) |
| 400  | Bad Request | Invalid input/validation error |
| 401  | Unauthorized | Missing/invalid JWT |
| 403  | Forbidden | Insufficient permissions |
| 404  | Not Found | Resource doesn't exist |
| 409  | Conflict | Duplicate email, etc. |
| 429  | Too Many Requests | Rate limit exceeded |
| 500  | Server Error | Database/server error |

---

## Headers Required

### For Protected Endpoints (Authenticated Users)
```
Authorization: Bearer <access_token>
```

### For State-Changing Operations (POST/PUT/DELETE)
```
Authorization: Bearer <access_token>
X-CSRF-Token: <csrf_token>
```

### For File Upload
```
Authorization: Bearer <access_token>
X-CSRF-Token: <csrf_token>
Content-Type: multipart/form-data
```

---

## Common Scenarios

### Scenario 1: User Registration & Login
```
1. POST /v1/auth/signup
   ├─ Required: email, password, username, phoneNumber
   └─ Returns: user data + message
   
2. POST /v1/auth/login
   ├─ Required: emailOrUsername, password
   └─ Returns: user data + access_token (in response) + refresh token (in httpOnly cookie)
   
3. GET /v1/me
   ├─ Headers: Authorization: Bearer <access_token>
   └─ Returns: current user profile
```

### Scenario 2: Admin Creates User
```
1. POST /v1/admin/users
   ├─ Headers: Authorization: Bearer <admin_token>, X-CSRF-Token: <token>
   ├─ Body: email, password, username, phoneNumber, role
   └─ Returns: created user data
```

### Scenario 3: User Updates Own Profile
```
1. PUT /v1/me
   ├─ Headers: Authorization: Bearer <access_token>, X-CSRF-Token: <token>
   ├─ Body: username, phoneNumber, gender (optional fields)
   └─ Returns: updated user data
```

### Scenario 4: User Deletes Own Account
```
1. DELETE /v1/me
   ├─ Headers: Authorization: Bearer <access_token>, X-CSRF-Token: <token>
   ├─ Body: { password: "user_password" } (confirmation)
   └─ Returns: deleted user data
```

### Scenario 5: Admin Updates Another User
```
1. PUT /v1/admin/users/:id
   ├─ Headers: Authorization: Bearer <admin_token>, X-CSRF-Token: <token>
   ├─ Body: fields to update (email, password, username, etc.)
   └─ Returns: updated user data
```

---

## Key Methods in Controllers

### AuthController
- `signUp()` - User registration
- `logIn()` - User login
- `logOut()` - Logout current device
- `logOutAllDevices()` - Logout all devices
- `refreshToken()` - Refresh access token
- `changePassword()` - Change password
- `getSessionTrack()` - Get online users (admin)

### AdminController
- `getUsers()` - List all users
- `getUserById()` - Get single user
- `createUser()` - Create new user
- `updateUser()` - Update user
- `deleteUser()` - Delete user

### UserController
- `getMe()` - Get current user profile
- `updateMe()` - Update current user profile
- `updateLocation()` - Update location
- `uploadProfileImage()` - Upload profile picture
- `deleteMe()` - Delete current user account

---

## Key Methods in Services

### AuthService
- `signup(userData)` - Register user
- `login(userData, deviceInfo)` - Authenticate user
- `logout(user, jti)` - Logout device
- `logoutAllDevices(userId)` - Logout all devices
- `refreshAccessToken(token, deviceInfo)` - Get new access token
- `changePassword(userId, passwordData)` - Change password
- `getOnlineUsers()` - Get all online users
- `createToken(user)` - Generate JWT
- `createCookie(tokenData)` - Create cookie

### AdminService
- `findAllUsers()` - Get all users
- `findUserById(userId)` - Get user by ID
- `createUser(userData)` - Create user
- `updateUser(userId, userData)` - Update user
- `deleteUser(userId)` - Delete user

### UserService
- `updateUser(userId, userData)` - Update profile
- `updateUserLocation(userId, locationData)` - Update location
- `uploadProfileImage(userId, file)` - Upload image
- `deleteMe(userId, password)` - Delete account

---

## Testing Endpoints with curl

### Signup
```bash
curl -X POST http://localhost:3000/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email":"test@example.com",
    "password":"Pass123!",
    "username":"testuser",
    "phoneNumber":"+1234567890"
  }'
```

### Login
```bash
curl -X POST http://localhost:3000/v1/auth/login \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "emailOrUsername":"test@example.com",
    "password":"Pass123!"
  }'
```

### Get Current User
```bash
curl -X GET http://localhost:3000/v1/me \
  -H "Authorization: Bearer <access_token>"
```

### Admin List Users
```bash
curl -X GET http://localhost:3000/v1/admin/users \
  -H "Authorization: Bearer <admin_token>"
```

### Logout
```bash
curl -X POST http://localhost:3000/v1/auth/logout \
  -H "Authorization: Bearer <access_token>" \
  -H "X-CSRF-Token: <csrf_token>" \
  -b cookies.txt
```

---

## Environment Variables

```
# .env file
NODE_ENV=development
PORT=3000
DB_HOST=mongodb://localhost:27017
DB_NAME=your_db_name
SECRET_KEY=your_secret_key_for_jwt
REFRESH_TOKEN_SECRET=your_refresh_token_secret
LOG_FORMAT=dev
ORIGIN=http://localhost:3000
CREDENTIALS=true
```

---

## Docker Commands

```bash
# Build development image
make build-dev

# Build production image
make build

# Run container
make run

# Stop container
make stop

# Clean up images
make clean
```

---

## Key Takeaways

✅ **3 Clear Layers**: Auth, Admin, Current User
✅ **Separate Files**: Each layer has controller, service, routes
✅ **Security First**: Authentication, authorization, CSRF, rate limiting
✅ **Consistent Responses**: Standard JSON format
✅ **Validation**: Input validated at middleware level
✅ **Error Handling**: Centralized error middleware
✅ **Maintainable**: Easy to find and modify code
✅ **Scalable**: Simple to add features per layer

---

## Documentation Files

- `Readme/ARCHITECTURE.md` - Detailed architecture guide
- `Readme/ARCHITECTURE_VISUAL.md` - Visual diagrams and flows
- `Readme/IMPLEMENTATION_SUMMARY.md` - What was implemented
- `swagger.yaml` - API documentation (Swagger UI at `/api-docs`)
