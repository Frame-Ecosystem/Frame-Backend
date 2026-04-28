# Production Review TODO (v0)

Status legend: `[ ]` pending, `[~]` in progress, `[x]` done

## P0 - Security & Secrets

- [ ] Rotate all leaked credentials (MongoDB, SMTP, R2, OAuth, JWT).
- [x] Remove tracked `.env.production` from the working tree.
- [ ] Remove `.env.production` from git history and replace with secure secret management.
- [x] Sanitize `.env.production.example` with non-sensitive placeholders.
- [x] Ignore all runtime env files in `.gitignore`.

## P0 - Startup Reliability

- [x] Fail fast in production when MongoDB cannot connect after retries.
- [x] Fix PM2 readiness mismatch (`wait_ready` disabled until ready signal support exists).
- [ ] Add explicit process readiness signal support for PM2 (`process.send('ready')`) if needed.

## P0 - Auth/Admin Hardening

- [x] Remove insecure default admin credentials from env validation.
- [x] Gate automatic admin seeding behind `ENABLE_ADMIN_BOOTSTRAP`.
- [ ] Add one-time bootstrap command for admin creation (replace startup seeding pattern).

## P1 - API Edge Hardening

- [x] Support comma-separated CORS origin lists in env config.
- [x] Add production refresh-token cookie configuration knobs.
- [x] Apply refresh-token rate limiting.
- [x] Audit CSRF coverage for all mutating routes.
- [x] Patch CSRF gaps found in auth, profile, feed, booking, chat, notification, social, and catalog routes.
- [ ] Tighten remaining high-risk endpoint rate limits.

## P1 - Engineering Quality

- [x] Add CI workflow (`lint`, `build`, `test`, security audit).
- [x] Strengthen tests to fail on unexpected `500` responses.
- [ ] Add smoke test for startup readiness paths (`/health`, `/ready`).

## P1 - Docs & Runbooks

- [x] Clean and normalize `README.md`.
- [x] Fix incorrect commands/versions in `ARCHITECTURE.md`.
- [ ] Add production runbook (deploy, rollback, incident response checklist).
