# Application System Prompts

This file contains high-level prompts for major system refactors and feature implementations.

## 1. Google Sheets Secondary Storage
**Status**: COMPLETED
**Prompt**:
Refactor the persistence layer to use Google Sheets as a secondary database for financial records. 
- **Fiscal Isolation**: Dynamically create or select a new Google Sheet for each fiscal year.
- **Quota Management**: Implement a fallback mechanism that switches updates to the Google Sheet via the `ict.team@pceastandrews.org` service account when Firebase Firestore quotas are exceeded.
- **Data Integrity**: Ensure one-way synchronization from Firestore to Sheets for all approved and final-state requisitions.

## 2. Real-time Auto-refresh
**Status**: COMPLETED
**Prompt**:
Implement a real-time auto-refresh mechanism using Firestore snapshots or a localized event bus.
- **Triggers**: Force a UI data refresh whenever a requisition is:
  - Added or Edited by any user.
  - Approved/Rejected by any level of authority.
- **Notification**: Show a subtle "Data Updated" toast when background refreshes occur to maintain user awareness of state changes.

## 3. Database Migration: Firebase to Supabase
**Status**: COMPLETED
**Prompt**:
Migrate the application's data layer from Firebase (Firestore/Auth) to Supabase (PostgreSQL/Auth).
- **Relational Schema**: Define a schema in `src/db/schema.ts` mapping Firestore collections (Requisitions, Projects, Users, AuditLogs) to SQL tables.
- **ORM Integration**: Use Drizzle ORM for all database interactions.
- **Access Control**: Replace Firestore Rules with Supabase RLS (Row Level Security) policies.
- **Auth Provider**: Switch authentication providers and update the `currentUser` context to handle Supabase JWTs.

## 4. Notification System Refactor (ICT Team Email)
**Status**: COMPLETED
**Prompt**:
Refactor the Notification System to send update emails using the `ict.team@pceastandrews.org` account.
- **Sender Identity**: Set display name as "STANDS eRequisitions".
- **Dynamic Content**: Configure templates for "Requisition Created", "Level 1/2 Approved", and "Finance Disbursed".
- **Subject Lines**: Use structured subjects like `[Approved] Requisition #1234 - Multi-Level Finalized`.

## 5. Google Drive Attachment Storage
**Status**: Pending implementation
**Prompt**:
Implement a background service to store requisition attachments on Google Drive under the `ict.team@pceastandrews.org` account.
- **Service Account Integration**: Use server-side Google Drive API with service account credentials to handle uploads, bypassing the need for end-user OAuth logins or 2FA.
- **Link Management**: For every upload, generate a public or shared view link and update the requisition record in the database with these permanent URLs.
- **Storage Strategy**: Organize folders hierarchically by Fiscal Year and Requisition ID (e.g., `FY26/REQ-001/ProofOfPayment.pdf`).
- **Smooth UX**: Ensure the client-side upload remains responsive by handling the Drive transfer asynchronously and updating UI once the link is confirmed.
- **In-App Viewer**: Implement an integrated document preview modal to allow users to view stored attachments directly within the application interface without opening new tabs.

## 6. Slack Notification Integration
**Status**: Pending implementation
**Prompt**:
Integrate Slack Webhooks or a Slack App to provide real-time operational alerts.
- **System Health Alerts**: Notify the `#system-logs` channel of Supabase connection errors, Google Drive upload failures, or Firestore quota warnings.
- **High-Value Triggers**: Push alerts to `#finance-approvals` for any requisition exceeding a specific threshold (e.g., $10,000) or tagged with "High Priority".
- **Security & Audit**: Log administrative state changes to Slack, including user promotion to Approval Levels (L1/L2) or changes to Project budget allocations.
- **Workflow Summaries**: 
  - **Morning Briefing**: Deliver "Daily Pending Approvals" to relevant department heads every morning at 8:00 AM.
  - **EOD Activity Snapshot**: At the end of each day (e.g., 9:00 PM), post a summary of **Daily Active Users (DAU)**, total requisitions processed, and successfully disbursed amounts.
  - **User Analytics Leaderboard**: Post a weekly performance rank featuring users with the highest activity. Include total logins and the cumulative number of unique requisitions (inception-to-date) each user has interacted with (created, approved, or audited).
- **Google Drive Monitoring**: 
  - **Upload Tracking**: Post a notification when new attachments are successfully synced to Drive.
  - **Engagement Logs**: Track and report unusual view counts or external access patterns on stored documents to ensure data privacy.
- **Advanced Monitoring Coverage**: 
  - **Stale Requisitions**: Notify `#workflow-alerts` when a requisition remains in "Pending" status for more than 48 hours without action.
  - **Behavioral Anomalies**: Alert on unusual patterns such as multiple high-value requisitions from a single user within a short window.
  - **Sync Failures**: Immediate alerts if primary data (Firestore/Supabase) and secondary storage (Google Sheets) become inconsistent.
  - **Latency Triggers**: Monitor and report on degraded performance (slow query response times) from the database or attachment storage.
- **Interactive Actions**: (Optional) Explore using Slack's Block Kit to allow L1/L2 approvers to view and approve/reject simple requisitions directly from the Slack interface.

## 7. Advanced Visual Monitoring & BI
**Status**: Pending implementation
**Prompt**:
Implement a multi-tier visual monitoring system to track business intelligence and technical health.
- **Looker Studio BI Dashboard**: Configure a Google Looker Studio report connected to the `ict.team@pceastandrews.org` Google Sheets. Visualize:
  - **Fiscal Heatmaps**: Spending distribution across project categories.
  - **Bottleneck Analysis**: Average time taken for L1/L2 approvals vs. Finance disbursement.
- **In-App Health Command Center**: Build a `/admin/health` route featuring **Recharts** visualizations for:
  - **Synchronization Pulse**: Real-time graph showing successful vs. failed Drive/Sheets syncs.
  - **Concurrent Session Tracking**: Heatmap of peak system usage hours to optimize maintenance windows.
- **Visual Error Tracking (Sentry)**: Integrate Sentry's SDK to monitor client-side and server-side exceptions. Configure a visual "Quality Score" dashboard to track system stability over time.
- **Public Status Page**: Create a simple, read-only status page (e.g., `status.erequisitions.com`) indicating the operational state of Supabase, Drive, and the Notification service.

## 8. Direct Requisition Sharing and Deep Linking
**Status**: Pending implementation
**Prompt**:
Allow users to copy and share a direct link to the requisition they would like to view.
- **Deep Linking**: Generate a shareable link for specific requisitions.
- **Access Control and Redirection**: If the user does not have access to that group of requisitions, display a prompt after they login indicating they lack access.
- **Navigation Recovery**: Provide an option on the access-denied prompt to go back to the dashboard.

## 9. Summary Email Toggle via Profile Dropdown
**Status**: Pending implementation
**Prompt**:
Implement a feature on the profile dropdown menu where users can toggle a summary email for requisitions to be sent to their email directly indicating a full summary of pending requisitions, the last two disbursed, and drafts. 
- **Frequency Options**: Let the toggle provide options for a daily or weekly reminder email.
- **Beautiful HTML UI**: Once activated, the summary emails should have a beautiful HTML UI body presenting these statistics clearly.

## 10. Multi-Format Attachment Viewer and Error Handling
**Status**: Pending implementation
**Prompt**:
Address the "Unsupported Online View" error to provide seamless in-app previews for standard requisition attachments.
- **Multi-Format Support**: Implement a robust document viewer capable of rendering common formats directly in the browser frame. This MUST include images (PNG, JPEG, etc.), PDFs, and standard office documents (e.g., DOCX). Use appropriate viewer libraries or handle Google Drive's native iframe/preview link correctly without forcing a download block.
- **Restricted Formats**: Explicitly exclude and block the preview of videos and other non-supported file formats from the online viewer experience.
- **Graceful Fallback**: If a file truly cannot be previewed in-app, provide a polished exception UI with clear, actionable download buttons, replacing the default raw browser or external preview errors.

## 11. Vendor Details on Requisition Modal
**Status**: Pending implementation
**Prompt**:
Include vendor information on the requisition details modal, such as the vendor name, contact and number of requisitions they have appeared in. 
