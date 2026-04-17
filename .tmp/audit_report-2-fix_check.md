# Revalidation of Previous Issues from audit_report-2.md (R2)

Date: 2026-04-17
Method: Static-only review (no runtime execution, no Docker, no tests run)
Source: .tmp/audit_report-2.md

## Summary
- Total issues reviewed: 4
- Fixed: 4
- Not fixed: 0

## Issue-by-Issue Status

### F-001 (High)
- Title: Posted job detail access lacked explicit community-boundary check
- Previous status: Fail
- Current status: Fixed
- Evidence:
  - `repo/server/src/services/job.service.ts:52-63`
- Validation result:
  - Current logic now denies non-participants unless the job is posted and requester is in the same community.

### F-002 (High)
- Title: Re-consent timing semantics lacked a clear 30-day grace window
- Previous status: Fail
- Current status: Fixed
- Evidence:
  - Recheck job flags stale consents and starts grace window: `repo/server/src/jobs/consentRecheck.ts:7-16`, `repo/server/src/jobs/consentRecheck.ts:24-35`
  - Deactivation happens only after deadline: `repo/server/src/jobs/consentRecheck.ts:40-50`
  - Current-policy response supports in-grace behavior: `repo/server/src/services/consent.service.ts:79-98`
  - Consent model includes grace-window fields: `repo/server/src/models/Consent.ts:8-11`, `repo/server/src/models/Consent.ts:23-26`
  - Updated API test expects flagged-but-active consent in grace window: `repo/API_tests/consentRecheck.test.js:56-68`
- Validation result:
  - Static evidence now aligns with a 30-day grace-window re-consent flow.

### F-003 (Medium)
- Title: Report submission did not require evidence attachments
- Previous status: Partial Fail
- Current status: Fixed
- Evidence:
  - Controller now rejects report creation without evidence files: `repo/server/src/controllers/report.controller.ts:65-71`
  - Evidence files are validated and attached before create: `repo/server/src/controllers/report.controller.ts:73-86`
- Validation result:
  - Report creation now enforces evidence attachment requirement at API level.

### F-004 (Low)
- Title: Community isolation tests were weak for highest-risk path
- Previous status: Partial coverage
- Current status: Fixed
- Evidence:
  - New negative regression test for cross-community posted-job detail access (expects 403): `repo/API_tests/security.test.js:346-409`
  - Companion positive test for same-community posted-job visibility (expects 200): `repo/API_tests/security.test.js:411-458`
- Validation result:
  - The previously missing test scenario is now explicitly covered.

## Final Revalidation Verdict
- Status of prior critical issues: resolved.
- Status of prior medium/low gaps: resolved.
- Overall outcome: all previously listed issues from .tmp/audit_report-2.md are fixed based on current static evidence.
