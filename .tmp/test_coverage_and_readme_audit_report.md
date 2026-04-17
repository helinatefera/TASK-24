# Unified Test Coverage + README Audit (Strict Mode)

## Scope and Constraints
- Audit mode: static-only (no test execution, no Docker runtime, no API calls during audit).
- Target repository: `repo/`.
- Inputs analyzed: backend route declarations, API/unit/frontend/e2e test source files, `README.md`, `.env.example`, `run_tests.sh`.

## Audit A: Unified Test Coverage (Static Evidence)

### A1) Backend Endpoint Inventory (resolved METHOD + PATH)
- Route mount source: `repo/server/src/routes/index.ts`.
- Route declaration source: `repo/server/src/routes/*.routes.ts` (`router.get/post/put/patch/delete`).
- Total resolved endpoints: **78**.

### A2) Endpoint-to-Test Mapping Method
- Primary request extraction: `request('METHOD', 'PATH')` across `repo/API_tests/*.test.js`.
- Additional static extraction for manual multipart/HTTP flows:
  - `multipartUpload('/api/...')` in portfolio tests.
  - `new URL('/api/...', BASE)` + nearby HTTP method in helper flows.
- Path matching used route regex semantics (route params like `:id` matched against concrete path segments).

### A3) Coverage Result (API endpoint level)
- Covered endpoints: **78 / 78**.
- Static endpoint coverage: **100.0%**.
- Uncovered endpoints: **none found**.

### Test Coverage Result Coverage Score (0-100)
- Score: **100/100**

### A4) Test Realism Classification
- `True no-mock HTTP` evidence exists:
  - Request helper uses Node `http.request` against `API_BASE` and sends nonce/timestamp headers.
  - Evidence: `repo/API_tests/helpers.js` (`request()` implementation).
- `HTTP + setup shortcuts` also present (therefore suite is not purely black-box):
  - Direct DB role promotion in helper admin seeding (`mongoose` update to `users.role`).
  - Direct DB inserts in security tests for fixture setup/assertion paths.
  - Direct in-process job invocation `lockWorkEntries` from compiled server job module.
  - Evidence: `repo/API_tests/helpers.js`, `repo/API_tests/security.test.js`, `repo/API_tests/e2e.lifecycle.test.js`, `repo/API_tests/workEntry.test.js`.
- `Non-HTTP test layers` present:
  - Backend unit tests: `repo/unit_tests/*.test.js`.
  - Frontend tests: `repo/client/src/test/*.test.tsx` (mocking used heavily via `vi.mock`).
  - Browser e2e specs: `repo/e2e/*.spec.js`.

### A5) Coverage Verdict (Strict Static)
- **PASS (endpoint coverage dimension)**: all statically declared backend endpoints are exercised by API test calls (including manual multipart/helper HTTP flows).
- **NOTE**: this is not a pure black-box suite due to setup shortcuts and in-process calls, but endpoint-level HTTP coverage is complete.

---

## Audit B: README Audit (Hard Gates)

### B1) Startup command for full system
- README quick start includes:
  - `cp .env.example .env`
  - `docker compose up`
- Evidence: `repo/README.md` (Quick Start block).
- Strict interpretation risk:
  - If gate requires literal `docker-compose up` (hyphen), current text uses `docker compose up` (space).
  - Functional equivalence is usually true on modern Docker, but strict literal matching would fail this gate.

### B2) App access and verification steps
- URLs and ports documented (`https://localhost:3443`, redirect from `http://localhost:3080`).
- TLS self-signed warning documented.
- Post-start verification checklist provided (health, frontend load, register, login, profile, jobs, admin).
- Evidence: `repo/README.md` Service URLs, Note, and Verification Steps sections.

### B3) Environment variables and examples
- Required secret variables explicitly documented in README.
- `.env.example` exists and includes required keys and generation guidance.
- Evidence: `repo/README.md` Environment Variables section; `repo/.env.example`.

### B4) Credentials / default account policy
- README explicitly states no default accounts and no self-register admin path.
- README includes sample curl registration payloads with example usernames/passwords (non-default demo values).
- Evidence: `repo/README.md` User Registration + Admin Provisioning sections.
- Strict interpretation risk:
  - If hard gate forbids any demo/example credentials in docs, this would fail.
  - If gate only forbids reusable default runtime accounts, this passes.

### B5) README-Test Runner Consistency
- README backend test command: `./run_tests.sh`.
- Script actually runs unit + API + client Vitest + browser e2e in containers.
- Evidence: `repo/run_tests.sh`.
- Minor documentation drift risk:
  - README test counts (e.g., “36 unit”, “60 API”, “19 frontend”) are descriptive and may drift over time unless regenerated.

### B6) README Verdict (Strict)
- **PARTIAL PASS** under strict literal hard-gate interpretation due to:
  1. possible literal-command mismatch (`docker compose up` vs required `docker-compose up` if exact text is mandated),
  2. presence of example credentials in curl payloads if policy forbids demo creds entirely.
- **PASS** under practical/functional interpretation (modern Docker command accepted; no default real accounts provided).

---

## Final Unified Verdict
- Test coverage audit: **PASS**.
- README hard-gate audit: **PARTIAL PASS** (strict-literal interpretation), otherwise PASS.
- Overall unified strict verdict: **PARTIAL PASS**.

## Minimal changes to reach unambiguous strict PASS
1. In `repo/README.md`, add literal command variant or replace with exact required form:
   - `docker-compose up` (and optionally keep `docker compose up` as alternative).
2. Replace example registration credentials with placeholders that cannot be interpreted as demo login credentials, or clearly label them as non-reusable payload examples.
3. Optionally add a short "No default/demo accounts are shipped" callout directly adjacent to registration examples.

## Evidence Summary (files reviewed)
- Backend routing: `repo/server/src/routes/index.ts`, `repo/server/src/routes/*.routes.ts`
- API test coverage and helper behavior: `repo/API_tests/*.test.js`, `repo/API_tests/helpers.js`
- Frontend test inventory: `repo/client/src/test/*.test.tsx`
- README and env docs: `repo/README.md`, `repo/.env.example`
- Test runner semantics: `repo/run_tests.sh`
