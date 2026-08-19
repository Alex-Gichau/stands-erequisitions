# St. Andrew's PCEA eRequisitions Portal — Master Operational Plan & Technical Specifications

This document defines the system architecture, file processing standards, financial governance rules, and implementation roadmap for the St. Andrew's PCEA eRequisitions Portal.

---

## 1. System Architecture & Core Runtime

- **Full-Stack Execution Model**:
  - **Backend Server**: Express.js server (`server.ts`) bundled via `esbuild` to a single CommonJS bundle (`dist/server.cjs`) and executed with `node dist/server.cjs`.
  - **Frontend Client**: Vite + React 18 with Tailwind CSS utility classes and `motion` for fluid view transitions.
  - **Network / Port Config**: Bound strictly to `0.0.0.0:3000` to interface seamlessly with container ingress proxies.

- **Persistence Layer**:
  - **Data Engine**: Dual-mode JSON file storage (`server/data/`) with MongoDB / Cloud SQL ORM integration capability.
  - **Core Collections**: `requisitions`, `church_groups`, `users`, `projects`, `ledger_books`, `activity_history`, `custom_calendar_events`.

---

## 2. Attachment & File Processing Pipeline

1. **Client-Side Upload Validation**:
   - `FileReader.readAsDataURL()` produces strictly RFC 2397 compliant Data URIs (`data:[<mediatype>][;base64],<data>`).
   - Supported Formats: PDF documents, Images (PNG, JPG, WEBP), Excel spreadsheets (`.xlsx`, `.xls`, `.csv`), and Word documents (`.docx`).

2. **Attachment URL Normalization**:
   - The utility `normalizeAttachmentUrl` in `src/lib/utils.ts` preserves RFC 2397 base64 Data URIs (`data:...`) and raw external HTTP/HTTPS URLs (e.g. `https://accounts.pceastandrews.org/...`) directly without domain stripping or forced local file conversion.
   - Ensures attachments remain 100% self-contained, durable across container restarts, and fully functional for upload, in-app preview, and direct download.

3. **Backend Uploads & Asset Router**:
   - Serves uploaded files from `UPLOADS_DIR` (default `./uploads`) using `mime-types` for Content-Type resolution (`application/pdf`, `image/png`, etc.).
   - Sets `Content-Disposition: inline` for seamless in-browser document previews.

4. **Document Rendering & Thumbnail Previewer**:
   - `PdfThumbnailPreview.tsx` renders PDF first-page previews using embedded HTML5 Canvas or PDF.js CDN loaders without intrusive red overlay badge clutter.

---

## 3. Role-Based Financial Governance & Workflow Lifecycle

- **User Roles & Privileges**:
  - `CHURCH_GROUP`: Submits new expense requisitions and uploads proof of expenditure.
  - `APPROVER_L1`: Conducts Level 1 verification of receipt accuracy, item quantities, and tax calculations. Signs off as `APPROVED_L1`.
  - `APPROVER_L2`: Performs Level 2 Treasury budget line checks and clears funds as `APPROVED_L2`.
  - `FINANCE`: Issues cheques or cash, records transaction reference codes, and sets status to `DISBURSED`.
  - `SUPER_ADMIN`: Manages user account activations, supplementary budget allocations, system health, and audit logs.

- **Status Life Cycle**:
  `SUBMITTED` ➔ `APPROVED_L1` ➔ `APPROVED_L2` ➔ `DISBURSED` (or `REJECTED` / `REVISED`).

---

## 4. Disaster Recovery & Automated Backup Systems

1. **Automated Snapshot Dispatch**:
   - `autosendBackupService.ts` dispatches JSON data snapshots to configured backup channels.

2. **Slack Webhook Integration**:
   - Sends real-time alerts for financial disbursements, high-value audit flags, and system exceptions.

3. **Health Diagnostics Panel**:
   - `SystemHealth.tsx` monitors memory usage, active connection count, and ledger record counts.

---

## 5. Master Implementation Roadmap

- **Phase 1 (Completed)**:
  - RFC 2397 Data URI compliance across client-side attachment uploaders.
  - Dynamic attachment URL normalization (`normalizeAttachmentUrl`) handling domain URL references (`accounts.pceastandrews.org`).
  - Streamlined PDF thumbnail rendering without intrusive red badges (`PdfThumbnailPreview.tsx`).

- **Phase 2 (Completed)**:
  - Integrated Master Operational Plan into system Help Documentation (`src/components/HelpPanel.tsx`) and project repository context (`/AGENTS.md`).

- **Phase 3 (Upcoming)**:
  - Client-side image compression prior to base64 encoding to optimize memory footprint.
  - Offline requisition draft queueing for low-connectivity environments.
  - Requisition Installment Disbursements: Implement a schema and status system allowing approved high-value requisitions to be disbursed in customized financial installments (e.g., partial disbursement tracking, ledger balances, and multi-stage status indicators).

- **Phase 4 (Deployment)**:
  - Production Cloud Run deployment with continuous container health monitoring.

---

*Document Version*: 2.0  
*Maintained By*: St. Andrew's PCEA ICT & Engineering Team (`ict.team@pceastandrews.org`)
