### 1. Encryption Key Management

– Question: The prompt specifies AES-256 encryption at rest, but does not define how encryption keys are generated, stored, or rotated.
– Assumption: A local key management approach is required since the system is fully offline.
– Solution: Implement a master encryption key stored securely on the host machine (e.g., OS keychain or encrypted config file). Use this master key to derive per-field encryption keys via a KDF (e.g., PBKDF2).

---

### 2. Password Storage Mechanism

– Question: The prompt does not specify how user passwords should be stored securely.
– Assumption: Industry-standard hashing is expected.
– Solution: Store passwords using bcrypt with a strong salt (e.g., 12+ rounds).

---

### 3. Token Implementation Details

– Question: "Signed tokens" are mentioned, but the type (JWT, opaque tokens) is not specified.
– Assumption: JWT is intended due to stateless offline architecture.
– Solution: Use JWT with HMAC-SHA256, including user ID, role, expiration, and nonce.

---

### 4. Nonce Storage and Replay Protection

– Question: The system requires nonce + timestamp validation but does not define how nonces are stored or expired.
– Assumption: Nonces must be temporarily persisted server-side.
– Solution: Store nonces in an in-memory or MongoDB TTL collection with a 10-minute expiration window.

---

### 5. Masking Rules for Sensitive Fields

– Question: Masking format is only partially defined (example given for phone), but not standardized across all fields.
– Assumption: Each field type requires a consistent masking rule.
– Solution: Define field-specific masking:

* Phone: (XXX) ***-1234
* Email: j***@domain.com
* Employer: partially hidden string

---

### 6. Access Request Authorization Flow

– Question: The mechanism for approving/denying access requests within 7 days is not fully defined (notifications, expiration behavior).
– Assumption: Requests expire automatically after 7 days if no action is taken.
– Solution: Implement request records with status (pending/approved/denied/expired) and a background job to auto-expire after 7 days.

---

### 7. Watermark Implementation

– Question: The prompt mentions "optional visible watermarks" but does not define how they are applied.
– Assumption: Watermarks are applied dynamically on preview rendering.
– Solution: Use client-side or server-side image processing (e.g., Canvas or Sharp) to overlay watermark text/image.

---

### 8. Service Agreement Storage

– Question: The format and storage of service agreements are not specified.
– Assumption: Agreements are stored as versioned templates.
– Solution: Store agreements in MongoDB with versioning and render dynamically at job confirmation.

---

### 9. E-Confirmation Security

– Question: Typing a password is required, but no mention of re-authentication or hashing during verification.
– Assumption: Password must be verified securely against stored hash.
– Solution: Require password re-entry and validate using bcrypt before confirming agreement.

---

### 10. Timesheet Lock Mechanism

– Question: The system locks entries after 48 hours, but does not define how edits before that are handled.
– Assumption: Entries are editable until lock, then immutable.
– Solution: Add timestamps and enforce edit permissions until 48 hours pass.

---

### 11. Currency and Amount Handling

– Question: The system defines variance thresholds (2% or $25) but does not define currency or rounding rules.
– Assumption: Single currency (e.g., USD) is used.
– Solution: Store all amounts in cents (integer) to avoid floating-point issues.

---

### 12. Offline Payment Ledger Structure

– Question: The structure of "offline payment" and escrow tracking is not defined.
– Assumption: A ledger-style transaction system is required.
– Solution: Implement a ledger collection with transaction types (payment, refund, escrow deposit, release).

---

### 13. File Storage Strategy

– Question: File storage (PDF/JPG/PNG up to 10MB) is not defined (filesystem vs database).
– Assumption: Files should be stored locally for offline operation.
– Solution: Store files in local filesystem with metadata in MongoDB.

---

### 14. Export Format Specification

– Question: Export format for settlement statements is not defined.
– Assumption: Common formats like PDF or CSV are expected.
– Solution: Provide PDF export with optional CSV fallback.

---

### 15. Sensitive Word Filtering

– Question: The source and management of the sensitive-word list is not defined.
– Assumption: A static configurable list is sufficient initially.
– Solution: Store word list in DB/config and allow admin updates.

---

### 16. Manual Review Workflow Details

– Question: The review process (who reviews, SLA, notifications) is not fully defined.
– Assumption: Admins handle all reviews asynchronously.
– Solution: Implement review queue with status tracking and optional admin dashboard.

---

### 17. Audit Log Storage

– Question: Audit logs must be append-only and retained for 7 years, but storage method is not defined.
– Assumption: MongoDB collection with write-once semantics.
– Solution: Use append-only collection with restricted update/delete permissions.

---

### 18. Device Fingerprinting Method

– Question: "Hashed device fingerprints" are mentioned but not defined technically.
– Assumption: Browser/device attributes are hashed locally.
– Solution: Generate fingerprint from user-agent + local identifiers, hash with SHA-256, store with consent.

---

### 19. Rate Limiting Implementation

– Question: Rate limits are defined but enforcement mechanism is not specified.
– Assumption: Middleware-based rate limiting is expected.
– Solution: Use Express middleware with in-memory or MongoDB-backed counters.

---

### 20. Consent Versioning Mechanism

– Question: Policy versioning and re-consent triggers are not fully defined.
– Assumption: Each policy version has a unique identifier.
– Solution: Store consent records with version ID and enforce re-consent when version changes.

---

### 21. Privacy Policy History Access

– Question: The format and retrieval of policy history are not defined.
– Assumption: Users can view past versions in-app.
– Solution: Store policies with versioning and timestamps in DB.

---

### 22. Blacklist Enforcement Scope

– Question: Blacklisting is mentioned but not defined (account-only vs device-level vs both).
– Assumption: Both account and device-level enforcement are required.
– Solution: Implement blacklist checks on login and API access using account ID and device fingerprint.

---

### 23. HTTPS in Offline Environment

– Question: HTTPS is required but no certificate handling is specified for offline/local usage.
– Assumption: Self-signed certificates are acceptable.
– Solution: Generate and trust a local self-signed SSL certificate.

---

### 24. MongoDB Deployment Mode

– Question: MongoDB setup (embedded, local server, container) is not specified.
– Assumption: Local standalone MongoDB instance.
– Solution: Run MongoDB locally with persistence enabled.

---

### 25. Background Job Processing

– Question: Several features require timed actions (expiry, lock, cleanup), but no job system is defined.
– Assumption: Lightweight scheduler is sufficient.
– Solution: Use node-cron or similar for scheduled tasks.

---

### 26. Admin Role Scope

– Question: Admin permissions are mentioned but not fully enumerated.
– Assumption: Admins have full moderation and verification capabilities.
– Solution: Define explicit RBAC roles and permissions in the system.

---

### 27. Portfolio File Size and Storage Limits

– Question: Only per-file size (10MB) is defined, not total storage limits per user.
– Assumption: No strict quota initially.
– Solution: Implement optional configurable storage quota.

---

### 28. Compliance Hook Interfaces

– Question: "Reserved internal hooks" are mentioned but not defined.
– Assumption: Future integration points for compliance modules.
– Solution: Design extensible middleware/hooks for risk/compliance checks.

---
