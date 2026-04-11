# LensWork Alumni Photography Marketplace

A full-stack, Dockerized web application for alumni communities to engage verified photographers for event and portrait jobs, with strict privacy controls, offline-first operation, and compliance features.

## Architecture

| Component | Technology | Description |
|-----------|-----------|-------------|
| Frontend | React 18 + TypeScript + Vite + Tailwind CSS | SPA served via nginx with HTTPS |
| Backend | Express.js + TypeScript | REST API with full middleware security chain |
| Database | MongoDB 7 | Document store with TTL indexes and append-only audit |
| Reverse Proxy | nginx | HTTPS termination + API proxying |

## Quick Start

```bash
cp .env.example .env   # then edit .env with real secret values
docker compose up
```

All services build and start automatically once environment secrets are configured.

## Service URLs and Ports

| Service | URL | Port |
|---------|-----|------|
| Frontend + API (HTTPS) | https://localhost:3443 | 3443 |
| Frontend (HTTP, redirects to HTTPS) | http://localhost:3080 | 3080 |
| MongoDB | mongodb://localhost:27017 | 27017 |

The backend API is accessed exclusively through the nginx TLS proxy at `https://localhost:3443/api/`. The backend port (3001) is not exposed to the host by default.

> Note: The frontend uses a self-signed TLS certificate. Your browser will show a security warning — accept it to proceed.

## API Health Check

```bash
curl -k https://localhost:3443/api/health
# Response: {"status":"ok","timestamp":"..."}
```

## User Registration

No default accounts exist. Register via the UI at https://localhost:3443/register or via API:

```bash
# Register an alumni user (via TLS proxy — use -k for self-signed cert)
curl -k -X POST https://localhost:3443/api/auth/register \
  -H "Content-Type: application/json" \
  -H "X-Nonce: $(uuidgen)" -H "X-Timestamp: $(date +%s000)" \
  -d '{"username":"alice","email":"alice@test.com","password":"AlicePass123!","role":"alumni"}'

# Register a photographer
curl -k -X POST https://localhost:3443/api/auth/register \
  -H "Content-Type: application/json" \
  -H "X-Nonce: $(uuidgen)" -H "X-Timestamp: $(date +%s000)" \
  -d '{"username":"bob","email":"bob@test.com","password":"BobPass123!","role":"photographer"}'
```

### Admin Provisioning

Admin accounts **cannot** be self-registered. The registration endpoint only accepts `alumni` and `photographer` roles. To create an admin, first register a regular user, then promote via the database:

```bash
docker compose exec mongo mongosh lenswork --eval \
  'db.users.updateOne({username:"alice"},{$set:{role:"admin"}})'
```

## Verification Steps

After running `docker compose up`, verify the system works:

1. **Health check**: `curl -k https://localhost:3443/api/health` returns `{"status":"ok",...}`
2. **Frontend loads**: Open https://localhost:3443 (accept self-signed cert) — you should see the login page
3. **Register**: Create an account at /register with username, email, password, and role
4. **Login**: Sign in at /login — you should be redirected to the dashboard
5. **Profile**: Navigate to "My Profile" in sidebar, edit profile fields and set privacy levels
6. **Jobs**: As alumni, create a job (event or portrait type) with hourly or piece rates
7. **Admin**: Promote a user to admin via `mongosh` (see Admin Provisioning above), then access /admin to see user management, audit logs, content review

## Three User Roles

| Role | Capabilities |
|------|-------------|
| **Alumni** | Create jobs, hire photographers, manage profile privacy, approve work entries, record payments |
| **Photographer** | Maintain portfolio with watermarks, submit verification, accept jobs, log timesheets/piece-rates, upload deliverables |
| **Admin** | Review verifications, moderate content, manage blacklists, view audit logs, publish privacy policies |

## Key API Endpoints

### Authentication
- `POST /api/auth/register` — Register new user
- `POST /api/auth/login` — Login (returns JWT)
- `POST /api/auth/logout` — Logout (revokes session)

### Profiles & Privacy
- `GET /api/profiles/:id` — View profile (privacy-filtered)
- `PUT /api/profiles/me` — Update own profile
- `PUT /api/privacy/settings` — Update field privacy levels
- `POST /api/access-requests` — Request access to private fields

### Jobs & Work
- `POST /api/jobs` — Create job
- `PATCH /api/jobs/:id/assign` — Assign photographer
- `POST /api/jobs/:id/agreement/confirm` — E-confirm service agreement
- `POST /api/jobs/:jobId/work-entries` — Add time/piece-rate entry
- `PATCH /api/work-entries/:id/confirm` — Bilateral confirmation

### Settlements & Payments
- `POST /api/jobs/:jobId/settlement` — Generate settlement
- `POST /api/settlements/:id/adjustment` — Add adjustment (type + reason required)
- `GET /api/settlements/:id/export/pdf` — Export PDF
- `GET /api/settlements/:id/export/csv` — Export CSV
- `POST /api/settlements/:id/payments` — Record offline payment

### Content Safety
- `POST /api/reports` — Submit report with evidence
- `GET /api/admin/content-reviews` — Admin content review queue
- `POST /api/admin/sensitive-words` — Add sensitive word

### Compliance
- `POST /api/consent` — Record consent
- `POST /api/consent/data-category` — First-use data category consent
- `GET /api/consent/policy-history` — Privacy policy versions
- `GET /api/admin/audit` — Audit log (admin only)

## Security Features

- **AES-256-GCM encryption** at rest for government IDs, tax forms, qualification documents
- **bcrypt** (12+ rounds) password hashing
- **JWT** with HMAC-SHA256, 15-minute idle timeout, 24-hour absolute expiry
- **Nonce + timestamp** replay protection (10-minute window, ±2 min clock skew)
- **Rate limiting**: 300 req/min per IP (configurable via `RATE_LIMIT_PER_MIN`), 10 reports/day
- **Append-only audit log** with 7-year retention
- **Role-based access control** with fine-grained resource permissions
- **Content filtering** with sensitive-word scanning
- **Blacklist enforcement** at account and device level
- **HTTPS** with self-signed TLS certificate
- **Mandatory nonce + timestamp** on every request (except health check); missing headers return 400
- **Hashed device fingerprints** — SHA-256 before storage/comparison; never stored in raw form
- **Object-level access control** on jobs, settlements, payments, files, exports — only participants/admins can access
- **Bilateral agreement e-confirmation** — requires password re-entry verified against bcrypt hash
- **Request validation** — Zod schemas wired into auth, job, and consent routes via validateRequest middleware
- **Privacy-aware profile accessor** — non-owner profile views apply field masking based on privacy level + alumni status + community
- **Structured error responses**: `{"code": 400, "msg": "..."}` — no stack traces exposed
- **Server-sourced role enforcement** — `GET /api/auth/me` returns authoritative user profile on session start; UI role gating is presentation-only; all RBAC enforced server-side

### Auth & Session (httpOnly Cookies)

Authentication tokens are stored in **httpOnly, Secure, SameSite=Lax** cookies — never exposed to JavaScript. This eliminates the primary XSS token-theft vector.

- **Login/register**: Server sets `session` cookie with `httpOnly: true, secure: true, sameSite: 'lax'` and 24-hour max-age. Response body contains only the user object (no token).
- **API client**: Axios uses `withCredentials: true`. No `Authorization` header or `localStorage.getItem('token')` in client code.
- **Logout**: Server clears the `session` cookie and revokes the server-side session.
- **Session validation**: `authenticate` middleware reads token from the `session` cookie (falls back to `Authorization` header for API test compatibility).
- **CSP**: Enforced via both helmet middleware (`scriptSrc: 'self'`) and `<meta>` tag in `index.html`. Combined with nginx `X-Frame-Options DENY`, `X-Content-Type-Options nosniff`, and HSTS.
- **UI role gating**: `RoleGuard.tsx` is presentation-only. All authorization is enforced server-side via `authorize()` middleware.

### Server-Side Enforcement (not bypassable from client)

The following behaviors are enforced exclusively on the server and cannot be circumvented by frontend manipulation:

- **RBAC**: `authorize()` middleware checks `req.user.role` from the JWT session, not client-supplied values
- **Object-level access**: Service functions verify job participation, portfolio ownership, settlement participant status before any mutation
- **AES-256-GCM encryption at rest**: Government IDs, tax forms, and qualification documents are encrypted before storage; decryption keys never leave the server
- **Nonce + timestamp replay protection**: Middleware rejects duplicate nonces and requests outside the 10-minute time window
- **Audit logging**: Append-only audit log records all security-relevant actions with 7-year TTL index
- **File validation**: `validateAndStore()` checks MIME type against allowlist, verifies magic bytes, enforces 10MB size limit, and computes SHA-256 checksums — regardless of client-side checks
- **Content filtering**: Sensitive-word scanning runs server-side on message/report/job text; flagged content enters the admin review queue
- **Consent enforcement**: `dataCategoryConsent.service.checkConsent()` blocks profile/verification/report writes when required consent is missing
- **Cookie migration path**: To move from localStorage tokens to httpOnly cookies, set cookies on login response, configure `withCredentials: true` on axios, and remove `localStorage.getItem('token')` from `client.ts`

## Running Tests

### Backend (Docker — zero host dependencies)

```bash
./run_tests.sh
```

This script:
1. Cleans up previous containers
2. Builds and starts all services via Docker Compose
3. Waits for server health check
4. Runs **36 unit tests** inside the server container (money, masking, encryption, content filter)
5. Runs **60 API integration tests** inside the server container (auth, profiles, jobs, admin, security/authorization, settlement mutations, upload validation, community isolation)
6. Prints PASS/FAIL summary
7. Tears down containers

### Frontend (host — requires Node.js)

```bash
cd client && npm install && npm test
```

Runs **19 component/integration tests** via Vitest + Testing Library (route protection, auth state, settlement detail, privacy settings).

### Test Coverage Highlights
- **Object-level authorization**: Cross-user access denied (403), admin access allowed, unauthenticated rejected (401)
- **Nonce enforcement**: Requests without nonce/timestamp rejected on all protected routes
- **Password validation**: Weak passwords, missing uppercase/numbers rejected
- **Error format**: All errors return structured JSON `{code, msg}` with no stack traces
- **RBAC**: Non-admin users blocked from admin endpoints (users, audit, content review, blacklist, sensitive words)

## Project Structure

```
repo/
├── docker-compose.yml      # Orchestrates mongo, server, client
├── PLAN.md                 # Detailed implementation plan
├── README.md               # This file
├── run_tests.sh            # Docker-based test runner
├── unit_tests/             # Unit tests (money, masking, encryption, etc.)
├── API_tests/              # API integration tests (auth, profiles, jobs, admin)
├── server/                 # Backend (Express + TypeScript + MongoDB)
│   ├── Dockerfile
│   └── src/
│       ├── app.ts          # Express middleware chain
│       ├── server.ts       # Bootstrap + MongoDB connect
│       ├── config/         # DB, encryption, env config
│       ├── models/         # 27 Mongoose models
│       ├── middleware/     # Auth, rate limit, nonce, blacklist, content filter
│       ├── routes/         # REST API routes
│       ├── controllers/    # Request handlers
│       ├── services/       # Business logic
│       ├── hooks/          # Compliance hook interfaces
│       ├── jobs/           # Cron: access expiry, work locking, consent recheck
│       └── utils/          # Money, masking, encryption, validation
└── client/                 # Frontend (React + TypeScript + Vite)
    ├── Dockerfile          # Multi-stage: Node build → nginx
    ├── nginx.conf          # HTTPS + reverse proxy
    └── src/
        ├── App.tsx         # Route tree
        ├── api/            # Axios API modules
        ├── context/        # Auth context
        ├── pages/          # 31 pages + admin/
        ├── components/     # Layout, auth, profile, jobs, settlements, etc.
        └── utils/          # Formatters, validators, nonce
```

## Environment Variables

Secrets are injected via a `.env` file (see Quick Start). All other variables are declared in `docker-compose.yml`.

| Variable | Source | Description |
|----------|--------|-------------|
| JWT_SECRET | `.env` (required) | JWT signing secret (64+ chars) |
| MASTER_ENCRYPTION_KEY | `.env` (required) | AES-256 master key (64 hex chars) |
| MONGODB_URI | docker-compose.yml | MongoDB connection |
| BCRYPT_ROUNDS | docker-compose.yml | Password hashing rounds (default 12) |
| RATE_LIMIT_PER_MIN | docker-compose.yml | Max requests per minute per IP (default 300) |
| PORT | docker-compose.yml | Server port (default 3001) |
