# ⛪ STANDS eRequisitions & Financial Management System
### *PCEA St. Andrew's Church — Enterprise Requisition, Budgeting & Audit Control Platform*

![Build Status](https://img.shields.io/badge/Build-Passing-brightgreen?style=for-the-badge&logo=github-actions)
![React](https://img.shields.io/badge/React-18.3.1-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.5.3-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.19.2-000000?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-Auth%20%26%20Firestore-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4.1-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)

---

## 📌 Executive Summary

**STANDS eRequisitions** is an enterprise-grade financial workflow and requisition automation platform custom-engineered for **PCEA St. Andrew's Church**. It streamlines the entire requisition lifecycle—from departmental funding requests and multi-tier pastoral/board approvals to fund disbursal, procurement verification, and real-time audit logs.

Featuring a **dual-database architecture** (MongoDB with automated fallback to JSON collections) and seamless integration with **Firebase Authentication**, **Nodemailer SMTP**, and **Slack Webhooks**, the platform delivers uncompromised reliability and financial compliance.

---

## 📊 Live Repository & Contribution Insights

<p align="center">
  <img height="180em" src="https://github-readme-stats.vercel.app/api?username=gichaumburu&show_icons=true&theme=tokyonight&include_all_commits=true&count_private=true" alt="GitHub Stats" />
  <img height="180em" src="https://github-readme-stats.vercel.app/api/top-langs/?username=Alex-Gichau&layout=compact&theme=tokyonight&hide=html,css" alt="Top Languages" />
</p>

<p align="center">
  <img src="https://github-readme-streak-stats.herokuapp.com/?user=Alex-Gichau&theme=tokyonight" alt="GitHub Streak" />
</p>

---

## 🌟 Key Functional Pillars & Current Features

### 📜 1. Multi-Level Approval Engine & Financial Governance
- **L1 & L2 Approval Hierarchy**: Departmental group leaders and finance elders review and approve requisitions sequentially (`SUBMITTED` ➔ `APPROVED_L1` ➔ `APPROVED_L2` ➔ `DISBURSED`).
- **Escalation & SLA Automation**: Automatic escalation trackers for overdue requests exceeding response thresholds.
- **Audit & Compliance Checks**: Flagging mechanisms for high-value items, procurement review, and financial verification.
- **Voucher Generation**: Instant printable and exportable payment vouchers with digital verification signatures and audit seals.

### 💳 2. Disbursement Payout Release Details & Channel Logos
- **Visual Disbursement Channels**: Interactive payment method selection featuring high-fidelity branded SVG logos:
  - **M-PESA**: Authentic Safaricom green-and-red mobile money branding with stylized M and bold PESA badge.
  - **Bank EFT**: Electronic bank transfer emblem with neoclassical bank facade, directional fund transfer waves, and high-contrast royal blue badge.
  - **Cheque**: Detailed bank cheque leaf showing "A/C PAYEE ONLY" top security strip, payee lines, KES amount box, calligraphy signature curve, and magnetic ink MICR routing symbols.
  - **Cash**: Emerald Kenyan shilling banknote design with central KES denomination medallion and golden coin stack accent.
- **Collapsible Requisition History**: Audit event timeline always defaults to collapsed upon opening the payout voucher. Clicking anywhere on the Requisition History card/div immediately expands and opens the full audit history, with header toggle and smooth accordion transitions.
- **Full Dark & Light Theme Integration**: High-contrast dark mode support across the entire disbursement modal, channel buttons, reference code inputs, verification comment areas, and attachment dropzones.
- **Transaction Reference & Proof Uploads**: Integrated drag-and-drop proof of disbursement uploader supporting PDFs, bank slips, cheque counterfoils, and images (up to 15MB).

### 💰 3. Financial Oversight & Multi-Stage Installments
- **Requisition Installment Disbursements**: Framework allowing approved high-value requisitions to be disbursed in customized partial financial installments with automated balance tracking.
- **Church Group Allocation**: Real-time balance tracking across various church groups (Youth, Brigade, Women's Guild, Choir, Men's Fellowship, etc.).
- **Supplementary Budgets & Ledger Books**: Dynamic tracking of extra-budgetary allocation requests and financial ledger entries.
- **Fiscal Year Management**: Support for multi-year financial roll-overs and historical auditing.

### 📁 4. Requisitions & Receipts File Manager (`UploadsGalleryPanel`)
- **Parish Ministries Directory**: Organized folder hubs categorized by church group and expense type.
- **Smart Folder Navigation**: Dedicated "Back to Folders" action buttons in the breadcrumb toolbar, empty states, and opened folder banners.
- **In-App Camera Scanner**: Direct document scanner allowing treasury and finance teams to snap and upload receipt photos on the fly.
- **Document Rendering & Thumbnail Previewer**: PDF first-page previews using embedded HTML5 Canvas / PDF.js without intrusive overlay badge clutter.
- **RFC 2397 Data URI Compliance**: Standardized attachment processing pipeline maintaining durable, self-contained base64 Data URIs across container restarts.

### 🎨 5. Theme & Color Consistency System (Dark & Light / White)
- **True Dual-Theme Design**: Sleek dark theme (`#121214` background with `#18181b` cards) paired with a clean, high-contrast light theme (`bg-white` and `bg-slate-50`).
- **Google Sign-In Button**: Preserved crisp white background (`#ffffff`), dark black text (`#000000`), authentic 4-color Google logo, and subtle border across both light and dark themes.
- **Theme-Adaptive System Offline Screen**: Maintenance mode screen dynamically styled with smooth transitions for dark and light modes.
- **Notification Hub & Search UI**: Refined contrast across recent searches, budget category suggestions, and dropdown menus.

### ✉️ 6. Communication Hub & Automated Dispatch
- **SMTP Bulk Newsletter Dispatcher**: Interactive rich-text newsletter generator with audience segmentation.
- **Targeted Notification Emails**: Automated HTML email alerts sent upon status updates, approvals, or rejections via `ict.team@pceastandrews.org`.
- **Slack Operations Integration**: Direct webhook triggers routing approval alerts and system notifications directly to church staff channels.

### 🔒 7. Resilient Multi-Engine Data Layer
- **Mongoose / MongoDB Core**: Primary database storage with recursive snake_case/camelCase payload normalization.
- **Local JSON Storage Resilience**: Zero-downtime offline storage fallback ensuring app continuity if external DB nodes re-route.
- **Firebase Auth Verification**: Token verification and profile synchronization for user identity.

---

## 🏗️ System Architecture

```
                                 ┌──────────────────────────────────────────┐
                                 │           Client Interface (SPA)         │
                                 │    React 18 + TypeScript + Tailwind      │
                                 └────────────────────┬─────────────────────┘
                                                      │
                                                      │ HTTPS / REST API
                                                      ▼
                                 ┌──────────────────────────────────────────┐
                                 │          Express Web Server 3000         │
                                 │       Vite Middleware / API Router       │
                                 └──────┬──────────────┬──────────────┬─────┘
                                        │              │              │
                    ┌───────────────────┘              │              └────────────────────┐
                    ▼                                  ▼                                   ▼
        ┌───────────────────────┐          ┌───────────────────────┐           ┌───────────────────────┐
        │  Database Services    │          │  Auth & Notifications │           │   Third-Party APIs    │
        │ - MongoDB (Mongoose)  │          │ - Firebase Auth       │           │ - Slack Webhooks      │
        │ - Local JSON Fallback │          │ - Nodemailer SMTP     │           │ - Google Workspace    │
        └───────────────────────┘          └───────────────────────┘           └───────────────────────┘
```

---

## 🛠️ Tech Stack & Tooling Matrix

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend Framework** | React 18 & TypeScript | Type-safe, component-driven user interface |
| **Build Tooling** | Vite 5 & ESBuild | Rapid development bundling & production optimization |
| **Styling & UI** | Tailwind CSS & Lucide Icons | Responsive typography, dark/light themes, icon library |
| **Data Visualization** | Recharts & D3 | Financial analytics, budget charts, breakdown graphs |
| **Backend Runtime** | Node.js & Express 4 | Server-side REST API, middleware authentication |
| **Databases** | MongoDB (Mongoose) + Firestore | Persistent document storage with local JSON fallback |
| **Authentication** | Firebase Admin SDK & Google OAuth | Secure token validation and session persistence |
| **Messaging & Mailing** | Nodemailer & Slack Webhooks | Automated email dispatches and real-time operational alerts |

---

## 📂 Project Structure

```
├── server.ts                    # Primary Express Backend Entry Point & API Handlers
├── src/
│   ├── App.tsx                  # Main Layout, Theme Toggle & Routing Container
│   ├── components/              # Modular UI Components (Requisitions, Finance, Gallery)
│   │   ├── FinanceLedgerPanel.tsx  # Treasury, Disbursal Vouchers & Payout Releases
│   │   ├── UploadsGalleryPanel.tsx # File Manager, Folder Directory & Document Previewer
│   │   ├── RequisitionsPanel.tsx   # Requisition Review, Forms & Action Bar
│   │   ├── NotificationHub.tsx     # Centralized Notifications & System Alerts
│   │   └── SystemHealth.tsx        # Container Diagnostics & Memory Health Panel
│   ├── contexts/                # Requisition & Auth React Context State Providers
│   ├── models/                  # Mongoose Database Schemas (User, Requisition, Ledger)
│   ├── lib/utils.ts             # Attachment URL Normalization & Helper Utilities
│   └── types.ts                 # Shared TypeScript Interfaces & Types
├── public/                      # Static Assets, Logos & Favicons
├── .env.example                 # Environment Variable Declarations
├── package.json                 # Dependency Manifest & Execution Scripts
└── metadata.json                # AI Studio Application Metadata & Permissions
```

---

## 📡 API Endpoint Overview

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| `GET` | `/api/health` | Container and server health probe | No |
| `GET` | `/api/db-all` | Fetch entire application collection bundle | Yes |
| `GET / POST` | `/api/db/:collection` | Query or update specific collection models | Yes |
| `POST` | `/api/send-email` | Dispatch individual requisition update notification | Yes |
| `POST` | `/api/send-bulk-email` | Dispatch system newsletter or group bulletin | Yes |
| `POST` | `/api/send-summary-email` | Trigger daily/weekly financial summary alerts | Yes |
| `POST` | `/api/slack` | Route operational notifications to Slack channel | Yes |
| `POST` | `/api/attachments/upload` | Upload supporting receipts or invoice documents | Yes |

---

## 📋 Changes Log (Changelog)

### v2.4.0 (Latest Release)
- **Disbursement Channel Logos & Icons**: Integrated high-fidelity, authentic vector logos for all payout channels (**M-PESA**, **Bank EFT**, **Cheque**, and **Cash**) inside the Disbursement Payout Release Details dialog.
- **Collapsible Requisition History with Click-to-Open**: Configured the Requisition History audit timeline in the disbursement dialog to always default to collapsed upon opening, and made the entire Requisition History card/div clickable so clicking anywhere on the div immediately opens and reveals the timeline.
- **Theme & Color Consistency Audit (`App.tsx` & Treasury Panels)**: Fully audited all color classes to strictly respect dark mode (`#121214` / `slate-900` / `slate-800`) and light mode (`bg-white` / `slate-50`). Fixed invalid classes (e.g. `bg-slate-850`, `bg-slate-550`, `text-slate-650`), polished text contrast on date range selectors, search suggestions, compliance ledger warnings, password dialogs, and maintenance views.
- **Google Sign-In Button Persistence**: Locked the Google login button to a clean white background (`#ffffff`), dark black text (`#000000`), and official multi-color Google logo across both light and dark themes.
- **Ministry File Manager Folder Navigation**: Added interactive "Back to Folders" navigation in breadcrumbs, folder view banners, and empty folder placeholders in `UploadsGalleryPanel.tsx`.
- **Streamlined Ministry Directory Cards**: Refactored ministry folder cards into clean, distraction-free cards with folder icons, file counter badges, and direct access controls.

### v2.3.0
- **Requisition Installment Disbursements**: Enabled high-value expense tracking in multi-stage tranches (`RequisitionInstallment`) with partial disbursement vouchers (`printInstallmentVoucher`) and remaining balance computations.
- **System Health Diagnostics & Automated Slack Alerts**: Implemented `SystemHealth.tsx` monitoring active memory and database status, paired with scheduled Slack webhook report dispatches.
- **Notification Hub Enhancements**: Refined category tagging, unread badges, and desktop notification permission toggling.

### v2.2.0
- **RFC 2397 Data URI Pipeline**: Added `normalizeAttachmentUrl` in `src/lib/utils.ts` to preserve base64 Data URIs and external domain references without local truncation.
- **Canvas-Powered PDF Previews**: Implemented `PdfThumbnailPreview.tsx` for fast first-page rendering without intrusive badges.
- **Direct Document Scanner**: Added in-app camera scanner integration for quick mobile invoice captures in the file explorer.

### v2.1.0
- **Receipt Approver Audit Trail**: Added Level 1, Level 2, and Finance Officer sign-offs with exact verification timestamps on printable expenditure receipts.
- **4-Stage Stepper Tracker**: Embedded interactive progress diagrams (`Submitted` ➔ `L1 Verified` ➔ `L2 Cleared` ➔ `Disbursed`) across vouchers and modal previews.
- **Cloud Run Health Probes**: Resolved dynamic `process.env.PORT` binding, exposed `/api/health`, and configured CommonJS bundling compatibility with esbuild.

### v2.0.0
- **Dual-Database Persistence Engine**: Built MongoDB Mongoose document store with seamless automatic fallback to local JSON collections for uninterrupted availability.
- **Firebase Authentication & RBAC**: Integrated role-based clearance (`CHURCH_GROUP`, `APPROVER_L1`, `APPROVER_L2`, `FINANCE`, `SUPER_ADMIN`).
- **Nodemailer SMTP & Slack Alert Integration**: Automated financial dispatch alerts and notification webhooks.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- npm, yarn, or bun
- MongoDB Instance or Cloud Atlas cluster (optional; automatically falls back to local JSON persistence)

### Installation
```bash
# Clone the repository
git clone https://github.com/Alex-Gichau/eRequisitions-system.git
cd eRequisitions-system

# Install dependencies
npm install

# Start the full-stack development server
npm run dev
```

### Production Build
```bash
# Build the client and bundle the server
npm run build

# Start the production server
npm start
```

---

## 🛡️ License & Acknowledgments

Developed for **PCEA St. Andrew's Church — STANDS Finance**.  
*All rights reserved.* © 2026
