
# 🔐 Authentication System Documentation

---

## 📚 Table of Contents
1. [Introduction](#introduction)
2. [System Architecture](#system-architecture)
3. [Authentication Flow Diagram](#authentication-flow-diagram)
4. [Endpoints & Usage](#endpoints--usage)
5. [DTOs & Validation](#dtos--validation)
6. [Security Features](#security-features)
7. [CSRF Protection](#csrf-protection)
8. [Error Handling](#error-handling)
9. [Swagger & Local Testing](#swagger--local-testing)
10. [Best Practices](#best-practices)
11. [Troubleshooting](#troubleshooting)
12. [References](#references)

+-------------------+
+-------------------+
+-------------------+
+-------------------+
+-------------------+
+-------------------+


# 🚀 Authentication Function Guide

---

## 📖 Table of Contents
1. [What is Authentication?](#what-is-authentication)
2. [System Overview](#system-overview)
3. [Authentication Flow](#authentication-flow)
4. [Auth API Endpoints](#auth-api-endpoints)
5. [Key Concepts & Tools](#key-concepts--tools)
6. [Security Features](#security-features)
7. [CSRF Protection Explained](#csrf-protection-explained)
8. [Error Handling](#error-handling)
9. [Testing with Swagger](#testing-with-swagger)
10. [Best Practices](#best-practices)
11. [Troubleshooting](#troubleshooting)
12. [Glossary](#glossary)
13. [References](#references)

---



## 2. System Overview

**Architecture Diagram:**
```
┌─────────────┐      ┌───────────────┐      ┌─────────────┐
│   Client    │───►│ Express Server │───►│ MongoDB (DB) │
└─────────────┘      └───────────────┘      └─────────────┘
```

**Main Technologies:**
- TypeScript: Typed JavaScript for safer code
- Express: Web server framework
- Mongoose: MongoDB database connector
- JWT: Secure tokens for authentication
- bcrypt: Password hashing
- class-validator: Validates user input
- winston: Logging system
- Swagger: API documentation & testing

---

## 3. Authentication Flow

1. **Signup:** User creates an account (username, email, password)
2. **Login:** User logs in, receives access & refresh tokens
3. **Access Token:** Used for protected requests (expires quickly)
4. **Refresh Token:** Used to get new access tokens (longer expiry)
5. **Logout:** Invalidates refresh token
6. **Change Password:** User updates password securely

**Flowchart:**
```
Signup/Login → JWT Issued → Access Token Used → Refresh Token Used → Logout
```

---

## 4. Auth API Endpoints

| Method | Endpoint                | Description                |
|--------|------------------------|----------------------------|
| POST   | `/auth/signup`         | Register new user          |
| POST   | `/auth/login`          | Login and receive tokens   |
| POST   | `/auth/refresh`        | Refresh access token       |
| POST   | `/auth/logout`         | Logout and invalidate token|
| POST   | `/auth/change-password`| Change password            |


**Example Request:**
```http
POST /auth/signup
Content-Type: application/json
{
	"username": "johndoe",
	"email": "john@example.com",
	"password": "yourPassword123",
	"phoneNumber": "+1234567890"
}
```

---

## 5. Key Concepts & Tools

### DTO (Data Transfer Object)
A DTO is a simple object used to transfer data between client and server. It helps validate and structure incoming requests.

### JWT (JSON Web Token)
A secure token containing user info, used for authentication. Access tokens expire quickly; refresh tokens last longer.

### bcrypt
Library for hashing passwords. Hashing means storing passwords in a scrambled, secure way.

### class-validator
Checks if user input is valid (e.g., email format, password length).

### winston
Logs important events (errors, logins, etc.) for monitoring and debugging.

### Swagger
Interactive API documentation. Lets you test endpoints easily from your browser.

---

## 6. Security Features

- **Password Hashing:** Passwords are never stored in plain text. bcrypt scrambles them securely.
- **JWT:** Access tokens (short-lived) and refresh tokens (long-lived) keep sessions secure.
- **CSRF Protection:** Prevents malicious requests from other sites (see below).
- **Rate Limiting:** Blocks too many requests from one user/IP to prevent attacks.
- **Validation:** All inputs are checked for correctness and safety.
- **IP Logging:** User IPs are hashed for privacy (GDPR compliance).
- **Indexes:** Unique indexes on important fields (e.g., refreshTokens.jti) for speed and security.

---

## 7. CSRF Protection Explained

**What is CSRF?**
Cross-Site Request Forgery (CSRF) is an attack where a user is tricked into submitting unwanted actions on a web app where they're authenticated.

**How We Protect:**
- Double-submit cookie pattern: CSRF token is sent both as a cookie and a header.
- Middleware checks both values match before allowing sensitive actions.
- In development, you can use the special token `dev-bypass` for easy testing in Swagger UI.

**Example:**
```http
POST /auth/change-password
X-CSRF-Token: <your-csrf-token>
Cookie: csrfToken=<your-csrf-token>
```

---

## 8. Error Handling

- Custom error classes (e.g., `HttpException`) for clear error messages
- Handles duplicate usernames/emails gracefully
- Consistent error responses for validation, authentication, and server errors

**Example Error Response:**
```json
{
	"status": 400,
	"message": "Validation failed: email must be a valid email address"
}
```

---

## 9. Testing with Swagger

- **Swagger UI:** Interactive API docs and testing tool
- **CSRF in Swagger:** Use `dev-bypass` as CSRF token for state-changing requests in development
- **Instructions:** See `swagger.yaml` for more details

**How to Test:**
1. Open Swagger UI
2. For POST requests, set `X-CSRF-Token` to `dev-bypass`
3. Try out endpoints and see responses instantly

---

## 10. Best Practices

- Always hash passwords before storing
- Never expose sensitive fields in DTOs
- Use HTTPS in production
- Rotate JWT secrets regularly
- Validate all user input
- Log security events (auth failures, suspicious activity)
- Use environment variables for secrets

---

## 11. Troubleshooting

| Issue                        | Solution                                      |
|------------------------------|-----------------------------------------------|
| 403 Forbidden (CSRF)         | Use `dev-bypass` token in Swagger UI          |
| Duplicate Key Error          | Ensure unique username/email                  |
| Token Expiry                 | Refresh tokens as needed                      |
| Validation Errors            | Check DTOs for required fields                |
| Database Connection Issues   | Verify MongoDB URI and credentials            |

---

## 12. Glossary

- **Authentication:** Verifying user identity
- **Authorization:** Granting access to resources
- **JWT:** Secure token for authentication
- **CSRF:** Security measure against cross-site attacks
- **DTO:** Object for data transfer and validation
- **Swagger:** API documentation and testing tool

---

## 13. References

- [Swagger Documentation](../swagger.yaml)
- [CSRF Middleware](../src/middlewares/csrf.middleware.ts)
- [Auth Controller](../src/controllers/auth.controller.ts)
- [User DTOs](../src/dtos/users.dto.ts)

---

> *For further questions, consult the codebase or reach out to the project maintainer.*
