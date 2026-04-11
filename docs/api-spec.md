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

