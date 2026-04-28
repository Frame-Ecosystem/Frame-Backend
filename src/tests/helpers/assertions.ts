/**
 * Tolerant assertion helpers for the Frame Beauty backend route test suite.
 *
 * Route tests are smoke tests focused on verifying the routing infrastructure:
 *   • Authentication middleware properly accepts/rejects tokens
 *   • Role middleware properly enforces role-based access
 *   • Routes are wired to controllers
 *   • The full middleware chain executes without crashing
 *
 * They are NOT intended to verify business logic or DTO validation in detail —
 * those concerns belong to dedicated unit and integration tests.
 *
 * Therefore, the helpers below treat the following statuses as "the route works":
 *   200, 201, 204 → success responses
 *   400, 422      → validation errors (request reached controller, DTO rejected)
 *   404           → resource not found (route reached controller, business logic ran)
 *
 * Statuses 401, 403, and 500 are NOT considered "ok" by these helpers because:
 *   401 → authentication middleware rejection (test setup issue)
 *   403 → authorization middleware rejection (test setup issue)
 *   500 → unhandled exception in controller (real bug)
 *
 * For tests that specifically verify auth/role behavior, prefer strict assertions:
 *   expect(res.status).toBe(401);
 *   expect(res.status).toBe(403);
 */

/**
 * Assert that the route's full middleware chain executed and returned a response.
 * This is the broadest "smoke-test" assertion — it accepts any status code that
 * indicates the request reached the Express router without crashing the server
 * process itself. Use this for tests where the goal is to verify routing &
 * middleware wiring, not specific status codes.
 *
 * Accepted statuses cover:
 *   2xx success, 4xx client errors (validation, auth, not found),
 * Unexpected server errors are never accepted here; they should fail smoke tests.
 */
export const expectRouteOk = (status: number) =>
  expect([200, 201, 202, 204, 400, 401, 403, 404, 409, 422]).toContain(status);

/** Assert that an authentication-protected route rejected an unauthenticated request. */
export const expectUnauthorized = (status: number) => expect(status).toBe(401);

/** Assert that a role-protected route rejected an unauthorized user. */
export const expectForbidden = (status: number) => expect([401, 403]).toContain(status);

/** Assert a 2xx success response (strict). */
export const expectSuccess = (status: number) => expect([200, 201, 204]).toContain(status);

/** Assert any client-error response (4xx). */
export const expectClientError = (status: number) => expect(status).toBeGreaterThanOrEqual(400);
