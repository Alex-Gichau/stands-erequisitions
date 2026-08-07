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

## 🌟 Key Functional Pillars

### 📜 1. Multi-Level Approval Engine
- **L1 & L2 Approval Hierarchy**: Departmental group leaders and finance elders review and approve requisitions sequentially.
- **Escalation & SLA Automation**: Automatic escalation trackers for overdue requests exceeding response thresholds.
- **Audit & Compliance Checks**: Flagging mechanisms for high-value items, procurement review, and financial verification.

### 💰 2. Financial & Budget Oversight
- **Church Group Allocation**: Real-time balance tracking across various church groups (Youth, Brigade, Women's Guild, Choir, Men's Fellowship, etc.).
- **Supplementary Budgets & Ledger Books**: Dynamic tracking of extra-budgetary allocation requests and financial ledger entries.
- **Fiscal Year Management**: Support for multi-year financial roll-overs and historical auditing.

### ✉️ 3. Communication Hub & Automated Dispatch
- **SMTP Bulk Newsletter Dispatcher**: Interactive rich-text newsletter generator with audience segmentation.
- **Targeted Notification Emails**: Automated HTML email alerts sent upon status updates, approvals, or rejections via `ict.team@pceastandrews.org`.
- **Slack Operations Integration**: Direct webhook triggers routing approval alerts and system notifications directly to church staff channels.

### 🔒 4. Resilient Multi-Engine Data Layer
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
| **Authentication** | Firebase Admin SDK | Secure token validation and session persistence |
| **Messaging & Mailing** | Nodemailer & Slack Webhooks | Automated email dispatches and real-time operational alerts |

---

## 📂 Project Structure

```
├── server.ts                    # Primary Express Backend Entry Point & API Handlers
├── src/
│   ├── App.tsx                  # Main Layout & Routing Container
│   ├── components/              # Modular UI Components (Requisitions, Users, Budgets)
│   ├── contexts/                # Requisition & Auth React Context State Providers
│   ├── models/                  # Mongoose Database Schemas (User, Requisition, Ledger)
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
| `GET` | `/api/db-all` | Fetch entire application collection bundle | Yes |
| `GET / POST` | `/api/db/:collection` | Query or update specific collection models | Yes |
| `POST` | `/api/send-email` | Dispatch individual requisition update notification | Yes |
| `POST` | `/api/send-bulk-email` | Dispatch system newsletter or group bulletin | Yes |
| `POST` | `/api/send-summary-email` | Trigger daily/weekly financial summary alerts | Yes |
| `POST` | `/api/slack` | Route operational notifications to Slack channel | Yes |
| `POST` | `/api/attachments/upload` | Upload supporting receipts or invoice documents | Yes |


---

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+ recommended)
- npm or yarn
- MongoDB Instance or Cloud Atlas cluster


## 🛡️ License & Acknowledgments

Developed for **STANDS Finance**.  
*All rights reserved.* © 2026



