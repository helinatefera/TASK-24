# API Specification

Version: 1.0
Base URL: /api

Overview
--------
This document describes the HTTP API for the EaglePoint SPA and backend. It documents the main endpoints mounted under `/api/*`, authentication, common request/response shapes, and the most important domain models used by the client and server. It follows the repository routes structure (see `server/src/routes`).

Auth / Session
----------------
Base path: `/api/auth`

- POST `/api/auth/register`
  - Description: Create a new user account.
  - Body: { name, email, password, role? }
  - Response: 201 Created -> { id, name, email, role }

- POST `/api/auth/login`
  - Description: Authenticate and create a session.
  - Body: { email, password }
  - Response: 200 OK -> { user: User, token?: string } (server uses cookies when configured)

- GET `/api/auth/me`
  - Description: Return current authenticated user profile.
  - Auth: required
  - Response: 200 OK -> `User`

- POST `/api/auth/logout`
  - Description: Invalidate session / clear cookie.
  - Auth: required
  - Response: 200 OK

Health
------
- GET `/api/health`
  - Description: Basic health check.
  - Response: 200 OK -> { status: 'ok', timestamp }

Profiles
--------
Base path: `/api/profiles`

- GET `/api/profiles/:id`
  - Description: Fetch a public or own profile.
  - Response: 200 OK -> `Profile`

- PATCH `/api/profiles/:id`
  - Description: Update profile fields (name, contact, privacy flags).
  - Auth: required, only allowed for owner or admin
  - Body: partial Profile fields
  - Response: 200 OK -> updated `Profile`

Privacy / Consent / Access Requests
----------------------------------
Base paths: `/api/privacy`, `/api/consent`, `/api/access-requests`

- These endpoints implement profile privacy settings, consent management, and access request flows for users requesting access to private profile fields or exports. Typical operations: GET/POST for consent records, POST to request access, admin endpoints under `/api/admin` to approve/deny.

Portfolios & Verification
-------------------------
Base paths: `/api/portfolios`, `/api/verification`

- POST `/api/portfolios` — upload portfolio metadata or create portfolio entries.
- GET `/api/portfolios/:id` — fetch portfolio and linked assets.
- POST `/api/verification` — submit verification artifacts for a user.

Jobs / Agreements / Messages
---------------------------
Base path: `/api/jobs`

- POST `/api/jobs`
  - Description: Create a job listing.
  - Auth: `ALUMNI` or `ADMIN` (see server `authorize` middleware)
  - Body: job creation DTO (title, description, rate, dates, clientId, etc.)
  - Response: 201 Created -> `Job`

- GET `/api/jobs`
  - Description: Query jobs (supports query params)
  - Auth: allowed for `ALUMNI`, `PHOTOGRAPHER`, `ADMIN`
  - Response: 200 OK -> [Job]

- GET `/api/jobs/:id`
  - Description: Get job detail
  - Auth: allowed for relevant roles
  - Response: 200 OK -> `Job`

- PUT `/api/jobs/:id`
  - Description: Update job metadata
  - Auth: owner `ALUMNI` or `ADMIN`
  - Response: 200 OK -> updated `Job`

- PATCH `/api/jobs/:id/assign`
  - Description: Assign a photographer or change assignment
  - Auth: `ALUMNI` or `ADMIN`

- POST `/api/jobs/:id/agreement/confirm`
  - Description: Confirm bilateral agreement (password re-entry flow on client)
  - Auth: `ALUMNI`, `PHOTOGRAPHER`, `ADMIN`
  - Response: 200 OK -> confirmation result

Deliverables & Files
--------------------
Deliverable upload endpoints are mounted under `/api/jobs/:jobId/deliverables` via multipart upload.

- POST `/api/jobs/:jobId/deliverables`
  - Description: Upload a deliverable file for a job.
  - Auth: `PHOTOGRAPHER` or `ADMIN`
  - Request: `multipart/form-data` with field `file` (server enforces allowed MIME types and 10MB limit)
  - Response: 201 Created -> { id, filename, jobId, url }

- GET `/api/jobs/:jobId/deliverables`
  - Description: List deliverables for a job.

- Files served under `/api/files` (file metadata and download endpoints)

Work Entries / Timesheets
-------------------------
Base path patterns: `/api/jobs/*` and `/api/work-entries`

- Endpoints support creating, querying, and confirming work entries. Timesheet bilateral locking and 48-hour rules are enforced by backend logic; client provides UI to confirm.

Settlements & Payments / Escrow
-------------------------------
Base paths: `/api/jobs/:jobId/settlement`, `/api/settlements`, `/api/settlements/*` and `/api/settlements` for payments

- POST `/api/jobs/:jobId/settlement`
  - Description: Generate a settlement for a job (calculates amounts, fees, splits)
  - Auth: `ALUMNI`, `PHOTOGRAPHER`, `ADMIN`
  - Response: 201 Created -> `Settlement`

- Payment-related endpoints are mounted under `/api/settlements` and `/api/payments` to record payment events and receipts.

Reports & Content Review
------------------------
Base path: `/api/reports`, `/api/admin` for content review and admin tools

- `/api/reports` supports creating content reports and listing reports.
- Admin endpoints under `/api/admin` include content review, sensitive-words administration, and audit logs access. These require `ADMIN` role and server-side RBAC.

Audit
-----
Base path: `/api/admin/audit` (mounted via admin routes)

- Exposes append-only audit logs and actions taken by admins. Access restricted to admin roles.

Error Handling
--------------
- Standard JSON error shape used across the API:

  {
    "status": "error",
    "message": "Human-friendly error message",
    "code": "ERR_CODE" (optional),
    "details": { ... } (optional)
  }

- Common HTTP status codes: 200 OK, 201 Created, 400 Bad Request (validation), 401 Unauthorized, 403 Forbidden (RBAC), 404 Not Found, 500 Internal Server Error.

Authentication & Authorization
------------------------------
- The server uses session or token-based authentication. Client previously stored tokens in `localStorage`; the fix-check uses cookies (`withCredentials: true`) in production builds. All sensitive endpoints use the `authorize` middleware which accepts allowed `Role` values. Do not rely only on client-side role checks.

Models (Representative)
-----------------------
- User
  - id: string
  - name: string
  - email: string
  - role: 'ALUMNI' | 'PHOTOGRAPHER' | 'ADMIN'

- Profile
  - id: string
  - userId: string
  - displayName: string
  - privacy: { phone: boolean, email: boolean, ... }

- Job
  - id: string
  - title: string
  - description: string
  - clientId: string (alumni)
  - assignedPhotographerId?: string
  - status: 'open' | 'assigned' | 'completed' | 'archived'
  - rate, currency, dates, metadata

- Deliverable
  - id: string
  - jobId: string
  - filename: string
  - mimeType: string
  - size: number
  - url: string

- WorkEntry
  - id: string
  - jobId: string
  - userId: string
  - startTime, endTime, duration
  - status: 'draft' | 'submitted' | 'locked'

- Settlement
  - id: string
  - jobId: string
  - totalAmount
  - items: [ { description, amount } ]
  - status: 'pending' | 'paid' | 'rejected'

Examples
--------
Create job (example)

POST /api/jobs

Request body:

{
  "title": "Wedding shoot - Central Park",
  "description": "Two photographers, 4 hours",
  "rate": 1200,
  "currency": "USD",
  "clientId": "user_123"
}

Response (201):

{
  "id": "job_456",
  "title": "Wedding shoot - Central Park",
  "status": "open",
  "clientId": "user_123"
}

Upload deliverable (example)

POST /api/jobs/{jobId}/deliverables
Content-Type: multipart/form-data
Field: `file` (binary)

Response (201):

{
  "id": "deliv_789",
  "jobId": "job_456",
  "filename": "gallery.zip",
  "url": "/api/files/deliv_789"
}

Notes and Implementation Details
--------------------------------
- Server-side validation: routes use `validateRequest` middleware to enforce request shapes.
- Content filtering middleware is applied to free-text fields where configured (e.g., job description) to enforce content rules.
- File uploads are restricted by MIME type and size at the multer layer (`10MB`) and further validated by the file service for magic-bytes.
- RBAC: `authorize(...)` middleware enforces role-level access on protected endpoints. Admin endpoints live under `/api/admin`.

Where to look in code
---------------------
- Route mounting: `server/src/routes/index.ts`
- Auth controllers: `server/src/controllers/auth.controller.ts`
- Job API: `server/src/routes/jobs.routes.ts` and `server/src/controllers/job.controller.ts`
- Deliverables: `server/src/routes/deliverables.routes.ts` and `server/src/controllers/deliverable.controller.ts`
- Settlements / payments: `server/src/routes/settlements.routes.ts`, `server/src/routes/payments.routes.ts`
- Files: `server/src/routes/files.routes.ts`
- Admin & audit: `server/src/routes/admin.routes.ts`, `server/src/routes/audit.routes.ts`

This spec is intentionally concise — use the route files listed above and the controller files for precise parameter names and validation schemas. If you want, I can expand this into a full OpenAPI/Swagger document (YAML/JSON) generated from the validation schemas used in `validateRequest`.
# Eaglepoint API Specification (Implementation-Aligned)

## Runtime Reality
(Important)

- This document is aligned to the current Node/Express (TypeScript) backend
	implementation under `repo/server/src`.
- Routes, request validation, and response behavior are derived from
	route registration + controllers + DTOs in the server code.
- If this document and code diverge, code is the source of truth.

## Source of Truth Used

- Route registration: `repo/server/src/routes/index.ts`
- Endpoint behavior / controllers: `repo/server/src/controllers/*`
- Request/response contracts / types: `repo/server/src/types/*` and DTOs
- Middleware / security semantics: `repo/server/src/middleware/*`
- File route definitions: `repo/server/src/routes/*.routes.ts`

Key route files referenced while authoring this spec:

- `repo/server/src/routes/auth.routes.ts`
- `repo/server/src/routes/jobs.routes.ts`
- `repo/server/src/routes/profiles.routes.ts`
- `repo/server/src/routes/deliverables.routes.ts`
- `repo/server/src/routes/payments.routes.ts`
- `repo/server/src/routes/settlements.routes.ts`
- `repo/server/src/routes/portfolios.routes.ts`
- `repo/server/src/routes/reports.routes.ts`
- `repo/server/src/routes/accessRequests.routes.ts`
- `repo/server/src/routes/workEntries.routes.ts`

## Base URL and Conventions

- Base path: `/api`
- Content type: JSON by default, except `multipart/form-data` for uploads and
	binary attachment downloads.
- Authentication transport: HttpOnly cookies (`access_token`, `refresh_token`) plus
	readable CSRF cookie (`csrf_token`) where applicable.
- All non-safe methods (`POST`, `PATCH`, `PUT`, `DELETE`) require header
	`X-CSRF-Token` matching cookie `csrf_token`, unless endpoint documents
	that it's exempt (login, setup where applicable).
- Pagination (where supported): query `page` (default 1), `page_size` (default 20, max 200).

Pagination response envelope sample:

```json
{
	"data": [],
	"page": 1,
	"page_size": 20,
	"total_count": 0,
	"total_pages": 0
}
```

## Global API State Gate

- During initial bootstrap (when no admin/first-setup completed) certain routes
	are blocked by setup middleware.
- Error status: `503 Service Unavailable` with code `ERR_SETUP_REQUIRED`.

## Error Envelope

All structured errors use the envelope:

```json
{
	"error": {
		"code": "ERR_...",
		"message": "human-readable message",
		"request_id": "uuid"
	}
}
```

## Error Codes

- `ERR_NOT_FOUND`
- `ERR_FORBIDDEN`
- `ERR_UNAUTHORIZED`
- `ERR_CONFLICT`
- `ERR_RATE_LIMITED`
- `ERR_VALIDATION`
- `ERR_INTERNAL`
- `ERR_SETUP_REQUIRED`
- `ERR_INVALID_CREDENTIALS`
- `ERR_ATTACHMENT_TOO_LARGE`

## Authentication and Security Model

### Cookies set on login / refresh

- `access_token` — HttpOnly, SameSite=Strict, Path=`/`, short lived (minutes).
- `refresh_token` — HttpOnly, SameSite=Strict, Path=`/api/auth`, longer lived (days).
- `csrf_token` — readable by JS (HttpOnly=false) for `X-CSRF-Token` header reads.

### Role Guards

Typical roles used by route guards in server code:

- `admin`
- `client`
- `photographer`
- `compliance`

### Rate Limits

- Login attempts: per IP
- Sensitive actions (file uploads, messaging): per user + per IP

## Canonical DTOs

### Key Request DTOs

```ts
type LoginRequest = {
	username: string; // min 3
	password: string; // min 8
}

type CreateJobRequest = {
	title: string;
	description?: string;
	client_id: string; // uuid
	budget_cents?: number;
}

type UploadDeliverableRequest = FormData // multipart with file + metadata
```

### Key Response DTOs

```ts
type AuthResponse = {
	user: UserResponse;
	roles: string[];
}

type UserResponse = {
	id: string;
	display_name: string;
	email?: string;
	created_at: string;
}

type JobResponse = {
	id: string;
	title: string;
	status: string;
	client_id: string;
	created_at: string;
}
```

## Endpoint Catalog

---

### Setup

#### `GET /api/setup/status`

- Auth: none
- CSRF: not required
- Response `200`:

```json
{ "setup_complete": true }
```

#### `POST /api/setup/admin`

- Auth: none
- CSRF: exempt
- Body: bootstrap admin credentials
- Response `201` on success, `409` if already complete

---

## Auth

### `POST /api/auth/login`

- Auth: none (setup must be complete)
- CSRF: exempt
- Body: `LoginRequest`
- Response `200`: `AuthResponse` + auth cookies set

### `POST /api/auth/refresh`

- Auth: none (requires `refresh_token` cookie)
- CSRF: required
- Response `200`: `{ "status": "ok" }` and rotated tokens

### `GET /api/auth/me`

- Auth: required
- Response `200`: `AuthResponse`

### `POST /api/auth/logout`

- Auth: required
- CSRF: required
- Response `200`: `{ "status": "ok" }`

---

## Profiles

### `GET /api/profiles/:id`

- Auth: required (owner or admin)
- Response `200`: `UserResponse`

### `PATCH /api/profiles/:id`

- Auth: required (owner or admin)
- Body: partial profile fields
- Response `200`: updated `UserResponse`

---

## Jobs

### `POST /api/jobs`

- Auth: client
- Body: `CreateJobRequest`
- Response `201`: `JobResponse`

### `GET /api/jobs`

- Auth: required
- Query: `page`, `page_size`, filters
- Response `200`: paginated `JobResponse[]`

### `GET /api/jobs/:id`

- Auth: required (participant enforced)
- Response `200`: `JobResponse`

---

## Deliverables

### `POST /api/deliverables`

- Auth: photographer/seller
- Content type: `multipart/form-data`
- Fields: `job_id`, `file` (required), `metadata` (optional)
- Response `201`: `Deliverable` object

### `GET /api/deliverables/:id`

- Auth: required (job participant enforced)
- Response `200`: `Deliverable`

---

## Payments & Settlements

### `POST /api/payments`

- Auth: required
- Body: payment details (idempotency required via `Idempotency-Key`)
- Response `201`: `Payment` object

### `GET /api/settlements/:id`

- Auth: administrator or finance role
- Response `200`: `Settlement` object

---

## Reports, Portfolios, Access Requests, Work Entries

- See route files under `repo/server/src/routes/` for full list and behavior.

## Selected Domain Shapes Returned by API

### Job

```json
{
	"id": "uuid",
	"title": "string",
	"status": "open|in_progress|completed|cancelled",
	"client_id": "uuid",
	"budget_cents": 0,
	"created_at": "timestamp"
}
```

### Deliverable

```json
{
	"id": "uuid",
	"job_id": "uuid",
	"uploader_id": "uuid",
	"file_url": "string",
	"mime": "string",
	"created_at": "timestamp"
}
```

### Payment

```json
{
	"id": "uuid",
	"amount_cents": 0,
	"currency": "USD",
	"status": "pending|paid|failed",
	"created_at": "timestamp"
}
```

## Notes for Client Implementers

- Send credentials with every request (`withCredentials=true`) to include auth cookies.
- For non-GET requests include `X-CSRF-Token` read from `csrf_token` cookie.
- Handle `401` by attempting `POST /api/auth/refresh` then retrying original request once.
- Handle pre-bootstrap `503 ERR_SETUP_REQUIRED` by routing user to setup flow.

---

This spec is intentionally implementation-aligned and succinct. For canonical
request/response shapes and the definitive behavior, consult the server code
under `repo/server/src` (controllers, routes, and DTO/types).

