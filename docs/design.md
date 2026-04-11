# Design Document: LensWork Alumni Photography Marketplace

## 1. Overview

LensWork is an offline-capable alumni photography marketplace designed to connect alumni users with verified photographers for event and portrait work while enforcing strong privacy, moderation, and compliance controls. The system supports three roles: Alumni User, Photographer, and Administrator.

The platform uses a React-based frontend and an Express backend exposing REST-style APIs over HTTPS on a single machine or local network. MongoDB provides durable offline persistence. No external network dependency is required for core workflows, payments, moderation, compliance, or identity review.

The design emphasizes:
- Privacy-by-default handling of personal data
- Offline-first operation
- Strong auditability and policy consent tracking
- Controlled document access and export
- Moderated communication and portfolio publication
- Structured settlement and ledger workflows without online payment integration

---

## 2. Goals

### 2.1 Primary Goals
- Allow alumni users to discover and engage qualified photographers
- Support local account creation, authentication, and role-based access
- Protect sensitive profile data with field-level visibility controls
- Support real-name and qualification verification for photographers
- Enable job creation, agreement confirmation, timesheets, piece-rate billing, and settlement
- Record offline payments and escrow entries in a local ledger
- Provide content moderation and reporting workflows
- Enforce compliance requirements such as consent versioning, audit logging, encryption at rest, and replay protection

### 2.2 Non-Goals
- Online payment gateway integration
- External KYC services
- Cloud dependency for storage, identity, moderation, or compliance
- Real-time third-party messaging integrations
- Federated identity providers

---

## 3. Users and Roles

### 3.1 Alumni User
A community member who:
- Registers with username and password
- Manages a profile and field-level privacy settings
- Requests or accepts access to masked/private profile information
- Creates or participates in jobs
- Reviews agreements
- Approves timesheets and settlement details
- Uploads invoices, receipts, and evidence
- Submits reports

### 3.2 Photographer
A user who:
- Maintains a profile and portfolio
- Uploads preview media with optional watermarking
- Adds copyright notices to deliverables
- Submits real-name and qualification documents
- Accepts jobs only after verification
- Submits timesheets or piece-rate items
- Participates in settlement workflows

### 3.3 Administrator
A privileged role that:
- Reviews portfolios and job messages
- Reviews verification submissions
- Manages report triage and status transitions
- Performs moderation and blacklist actions
- Reviews audit logs where permitted
- Enforces permissions and compliance workflows

---

## 4. System Context

The system consists of:
- A React web client
- An Express REST API server
- A MongoDB database
- A local file storage layer for uploads/exports
- Scheduled background jobs for expiration and lock workflows

All operations are designed to function offline on:
- A single machine deployment, or
- A local network with HTTPS enabled

---

## 5. High-Level Architecture

## 5.1 Component View

```text
+---------------------------+
| React Web Client          |
| - Account UI              |
| - Profile UI              |
| - Portfolio UI            |
| - Job & Settlement UI     |
| - Moderation/Reports UI   |
| - Privacy & Consent UI    |
+------------+--------------+
             |
             | HTTPS + REST
             v
+---------------------------+
| Express API Server        |
| - Auth & Session Layer    |
| - RBAC / Access Control   |
| - Profile Service         |
| - Job Service             |
| - Settlement Service      |
| - Verification Service    |
| - Moderation Service      |
| - Consent Service         |
| - Export Service          |
| - Audit Log Service       |
| - Replay Protection       |
| - Rate Limiting           |
+------+--------------------+
       |
       +-------------------+
       |                   |
       v                   v
+--------------+   +------------------+
| MongoDB      |   | Local File Store |
| - Users      |   | - Uploads        |
| - Jobs       |   | - Receipts       |
| - Consents   |   | - Evidence       |
| - Audit Logs |   | - Exports        |
| - Reports    |   | - Documents      |
+--------------+   +------------------+
````

## 5.2 Architectural Style

The system follows a layered architecture:

* Presentation layer: React UI
* API layer: Express routes/controllers
* Domain/service layer: business workflows
* Persistence layer: MongoDB repositories and file storage

This separation supports maintainability, future compliance extension hooks, and testability.

---

## 6. Key Design Principles

### 6.1 Offline-First

All critical features operate without internet access, including:

* Authentication
* Verification review
* Ledger and settlement tracking
* Consent and policy history
* Reporting and moderation
* Document storage and export

### 6.2 Privacy by Default

Sensitive fields are hidden unless the user explicitly makes them visible or grants access. Non-admin views always mask sensitive identifiers.

### 6.3 Explicit Consent

Personal data collection and purpose use require disclosure and versioned user consent records.

### 6.4 Least Privilege

Only authorized users can access job resources, documents, exports, moderation queues, or verification content.

### 6.5 Immutable Security Evidence

Audit events are append-only and retained for long-term traceability.

---

## 7. Functional Design

## 7.1 Authentication and Session Management

Users create local accounts with username and password. On successful login:

* The server issues a signed session token
* Idle timeout is 15 minutes
* Absolute session expiration is 24 hours
* Every request must include a nonce and timestamp
* Replayed requests within 10 minutes are rejected

### Responsibilities

* Credential validation
* Password hashing and verification
* Token issuance and expiration checks
* Session invalidation
* Device consent gating for fingerprint use
* Login attempt auditing

### Security Notes

* Passwords are stored only as secure hashes
* Signed tokens are validated server-side on each request
* Authentication events are logged

---

## 7.2 Profile and Privacy Controls

Each user profile contains standard attributes plus sensitive data such as:

* Phone
* Email
* Employer

Each sensitive field supports visibility levels:

* Public
* Alumni-Only
* Private

When a field is Private:

* The UI displays a masked value
* Other users may request access
* The profile owner may approve or deny
* If unanswered, the request expires after 7 days

### Responsibilities

* Store field values and visibility level
* Render masked/unmasked views
* Evaluate viewer permissions
* Manage access request lifecycle
* Audit permission changes

---

## 7.3 Photographer Verification Workflow

Photographers must complete identity and qualification review before accepting jobs.

### Submission Inputs

* Government ID documents
* Qualification files
* Supporting materials

### Workflow States

* Submitted
* Needs-Changes
* Verified
* Rejected

### Admin Review Rules

* Reviewer must provide a reason for needs-changes or rejection
* Sensitive identifiers remain masked for non-admin users
* Files must pass format and checksum validation before review

### Responsibilities

* Secure upload and storage
* Validation of document type and checksum
* Status management
* Reviewer notes
* Audit trail for review actions

---

## 7.4 Portfolio and Deliverables

Photographers manage a portfolio that may include:

* Portfolio previews
* Watermark-enabled preview display
* Copyright notice metadata

Portfolio items and job messages are subject to moderation workflow:

* Pending
* Approved
* Rejected

### Responsibilities

* Upload and store media files
* Apply optional preview watermark behavior
* Attach copyright notices to deliverables
* Run sensitive-word checks
* Support admin moderation queue

---

## 7.5 Job Lifecycle

A job connects an alumni user and a photographer and captures the service workflow.

### Job Stages

* Draft
* Agreement Pending
* Active
* Work Submitted
* Confirmation Pending
* Settlement Pending
* Settled
* Closed
* Cancelled

### Job Data

* Participants
* Scope/description
* Service agreement version
* Billing method
* Timesheet and piece-rate entries
* Attachments
* Settlement statement
* Ledger records

### Service Agreement Confirmation

Both sides review the agreement in-app and e-confirm by typing their password. Confirmation records include:

* User ID
* Agreement version
* Timestamp
* Confirmation status

---

## 7.6 Work Logging

The platform supports two billing models:

### Timesheet Entry

* Logged in 15-minute increments
* Editable until lock condition is reached

### Piece-Rate Entry

* Structured line items
* Quantity, rate, subtotal, notes

### Bilateral Confirmation

A two-step confirmation process validates submitted work:

1. One participant confirms submitted entries
2. The second participant confirms them

Entries lock after 48 hours based on workflow rules.

### Responsibilities

* Validate increments and calculations
* Track confirmation by both parties
* Enforce lock rules
* Prevent unauthorized edits after lock

---

## 7.7 Settlement and Ledger

The settlement page produces a final statement including:

* Base amount
* Timesheet or piece-rate totals
* Adjustments
* Variance reason if difference exceeds threshold
* Receipt details
* Optional escrow entries

### Variance Rule

A variance reason is required when the final amount differs by more than:

* 2%, or
* $25.00,
  whichever is greater

### Offline Payment Model

No online payment collection occurs. Instead:

* Payments are recorded as offline payment
* Receipt data is stored locally
* Optional escrow deposit/release is represented as ledger entries

### Export

Settlement statements can be exported to a local file for bookkeeping.

---

## 7.8 Reporting and Moderation

Users can report content or conduct through a report center.

### Report Data

* Category
* Description
* File evidence
* Progress state

### Progress States

* Submitted
* Under Review
* Action Taken
* Rejected
* Closed

### Moderation Inputs

* Portfolio content
* Job messages
* Uploaded evidence
* Sensitive-word checks

### Responsibilities

* Accept and validate reports
* Store evidence
* Support state transitions
* Restrict visibility based on permissions
* Track actions in audit log

---

## 7.9 Consent and Privacy Policy Management

The system must disclose purpose of use at first collection of each data category and record consent by policy version.

### Requirements

* Store policy versions
* Store user consent records per version
* Show readable privacy policy history in-app
* Require re-consent within 30 days if a new policy version introduces a new purpose

### Responsibilities

* Version policy documents
* Track user acknowledgment
* Detect new-purpose upgrades
* Block affected workflows until re-consent is completed

---

## 8. Data Design

## 8.1 Core Entities

### User

Represents any account in the system.

Key fields:

* id
* username
* passwordHash
* role
* profile
* accountStatus
* blacklistStatus
* deviceFingerprintConsent
* createdAt
* updatedAt

### Profile

Contains personal and visibility-controlled attributes.

Key fields:

* displayName
* phone
* phoneVisibility
* email
* emailVisibility
* employer
* employerVisibility
* alumniAttributes
* maskedPreviewMetadata

### AccessRequest

Tracks requests to view private profile fields.

Key fields:

* requesterId
* ownerId
* fieldName
* status
* createdAt
* expiresAt
* decidedAt

### VerificationSubmission

Stores photographer identity and qualification submission workflow.

Key fields:

* photographerId
* documentRefs
* qualificationRefs
* status
* reviewerId
* reviewReason
* submittedAt
* reviewedAt

### PortfolioItem

Represents portfolio content.

Key fields:

* photographerId
* fileRef
* watermarkEnabled
* copyrightNotice
* moderationStatus
* rejectionReason

### Job

Represents a service engagement.

Key fields:

* alumniUserId
* photographerId
* status
* agreementVersion
* billingMode
* confirmationState
* createdAt
* updatedAt

### WorkEntry

Represents timesheet or piece-rate records.

Key fields:

* jobId
* entryType
* quantity
* rate
* durationMinutes
* notes
* createdBy
* confirmedByPartyA
* confirmedByPartyB
* lockedAt

### Settlement

Represents final financial summary.

Key fields:

* jobId
* subtotal
* adjustments
* finalAmount
* varianceReason
* exportedAt
* status

### LedgerEntry

Represents offline payment or escrow activity.

Key fields:

* settlementId
* transactionType
* amount
* receiptRef
* note
* createdAt

### Report

Represents a user-submitted report.

Key fields:

* reporterId
* targetType
* targetId
* category
* description
* evidenceRefs
* status
* reviewerId

### ConsentRecord

Tracks accepted privacy policy versions.

Key fields:

* userId
* policyVersion
* dataCategory
* purposeList
* consentedAt
* reconsentDueAt

### AuditLog

Append-only security and compliance record.

Key fields:

* actorId
* actionType
* resourceType
* resourceId
* timestamp
* metadata
* ipOrLocalOrigin
* result

---

## 9. File Storage Design

Uploaded files include:

* Verification documents
* Qualification files
* Invoices
* Receipts
* Report evidence
* Exported statements
* Portfolio images

### Constraints

* Allowed types: PDF, JPG, PNG
* Maximum size: 10 MB per file

### Storage Approach

* Files are stored in a local filesystem directory structure
* MongoDB stores file metadata, ownership, and permission mappings
* Sensitive documents are encrypted at rest where required
* Exports are generated into a controlled local export directory

### Access Rules

* Only authorized job participants and permitted admins can access or export files
* Blacklisted or banned users cannot export
* All exports require explicit permission checks and audit events

---

## 10. Security Design

## 10.1 Encryption at Rest

Sensitive fields such as:

* Government ID numbers
* Tax forms
* Qualification documents

are encrypted using AES-256 before storage.

## 10.2 Transport Security

All client-server communication occurs via HTTPS, even on local deployment.

## 10.3 Replay Protection

Every API request includes:

* Nonce
* Timestamp

The server rejects requests:

* Outside the accepted clock window
* Reusing the same nonce within 10 minutes

## 10.4 Access Control

Authorization combines:

* Role-based access control
* Resource ownership checks
* Job participation rules
* Admin override rules where explicitly allowed

## 10.5 Device Fingerprinting

If the user has consented:

* A hashed device fingerprint may be stored
* It can be used for blacklist enforcement and abuse controls

## 10.6 Audit Logging

Security-relevant events include:

* Login attempts
* Permission changes
* Verification reviews
* Exports
* Deletions

Logs are append-only and retained for 7 years.

---

## 11. Rate Limiting and Abuse Prevention

### Required Controls

* 60 requests/minute per account
* 10 reports/day per account

### Design

* Middleware enforces account-level thresholds
* Optional device-level controls apply when consented fingerprint exists
* Blacklisted accounts or devices are blocked before protected actions

### Reserved Compliance Hooks

The backend includes extension points for future compliance/risk modules without changing core workflows or requiring internet access.

Examples:

* Additional content scoring hooks
* Advanced fraud review hooks
* Rule-based compliance checks

---

## 12. Background Processing

Several workflows require scheduled processing.

### Scheduled Jobs

* Expire access requests after 7 days
* Lock work entries after 48 hours
* Clean expired nonce records
* Enforce re-consent deadlines
* Rotate/export archived audit bundles if needed

### Design Choice

Use local scheduled tasks inside the backend process or a companion worker process. Since the system is offline-first, all jobs must operate locally.

---

## 13. API Design Overview

The backend exposes REST-style APIs for:

* Auth
* Profiles
* Access requests
* Verification
* Portfolios
* Jobs
* Work entries
* Settlements
* Ledger
* Reports
* Policies and consents
* Exports
* Admin moderation
* Audit retrieval where permitted

### API Design Characteristics

* JSON request/response bodies
* Role-aware authorization checks
* Nonce/timestamp validation per request
* Consistent error shape
* Pagination for list endpoints
* File upload support for PDF/JPG/PNG

---

## 14. Error Handling

The system uses standardized error responses with:

* Code
* Message
* Optional validation details

### Categories

* Authentication errors
* Authorization errors
* Validation errors
* Replay protection errors
* Moderation state errors
* Workflow state transition errors
* File type/size errors
* Export restriction errors

### Design Principles

* Do not leak sensitive data in error messages
* Return actionable validation messages for user-fixable issues
* Log security-relevant failures

---

## 15. Auditability and Compliance

The application is built to support traceability of:

* Consent capture
* Sensitive data collection purpose
* Verification review actions
* Export operations
* Deletions and access changes
* Authentication and blacklist decisions

### Compliance Posture

The platform supports:

* Data minimization
* Purpose disclosure
* Re-consent on new purpose introduction
* Masking of identifiers for non-admin users
* Long-term audit retention
* Offline durability of compliance artifacts

---

## 16. Scalability and Deployment Considerations

Although offline and locally deployed, the system should still support modular growth.

### Scaling Considerations

* Separation of API and UI deployments when on local network
* MongoDB indexing for jobs, access requests, reports, and audit logs
* File directory partitioning for large upload volume
* Background worker separation for scheduled tasks
* Permission-check abstraction for future policy growth

### Deployment Modes

* Single-machine deployment
* Small local network deployment with dedicated backend host

---

## 17. Tradeoffs and Design Decisions

### MongoDB for Offline Persistence

Chosen because:

* Flexible schema for evolving workflows
* Good fit for document-centric entities
* Supports TTL indexes for nonce expiration
* Suitable for local deployment

Tradeoff:

* Strong relational constraints must be enforced in application logic

### Local File Storage Instead of Blob Service

Chosen because:

* Fully offline requirement
* Simpler deployment
* Direct control over export and retention

Tradeoff:

* Backup and storage governance must be handled locally

### Signed Token Sessions

Chosen because:

* Efficient stateless validation
* Simple local deployment

Tradeoff:

* Requires careful token expiration and invalidation handling

### Append-Only Audit Collection

Chosen because:

* Compliance traceability
* Easier investigation

Tradeoff:

* Storage growth over time must be managed operationally

---

## 18. Risks

### 18.1 Operational Risks

* Local certificate management for HTTPS may be difficult for non-technical deployments
* Local file backup/retention may be inconsistently handled
* Long audit retention may grow storage footprint significantly

### 18.2 Product Risks

* Access-request workflows may be confusing without strong notification UX
* Password re-entry for agreement confirmation may create friction
* Offline ledger processes rely on manual accuracy of receipt entry

### 18.3 Security Risks

* Local machine compromise may expose encrypted and unencrypted operational data
* Weak device fingerprinting may not uniquely identify abusive devices
* Self-signed certificate trust setup may be bypassed or misconfigured

---

## 19. Open Design Assumptions

The design assumes:

* Local certificate trust can be established for HTTPS
* A local scheduler is acceptable for timed tasks
* File storage is managed in the local filesystem
* One primary currency is used for settlement calculations
* Notifications are handled in-app rather than through external email/SMS
* Admin users are trusted operators with broader access to verification workflows

---

## 20. Future Enhancements

Potential future improvements include:

* Embedded notification center and reminder engine
* More advanced moderation rules
* Structured dispute resolution workflow
* Multi-currency settlement support
* Fine-grained export templates
* Pluggable compliance/risk modules
* Secure key rotation and operator tooling
