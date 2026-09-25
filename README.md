# Pulse Email Workspace - ReachInbox Hiring Assignment

Pulse is a production-grade full-stack email job scheduler service and interactive dashboard built for Outbox Labs / ReachInbox.

It provides Google OAuth authentication, campaign compose & CSV import, persistent BullMQ + Redis job scheduling (no cron), Ethereal fake SMTP delivery, per-sender hourly rate-limiting with Slack alerts, worker concurrency controls, Elasticsearch fuzzy search, live Bull Board queue monitoring, and server restart resilience.

---

## 🎯 Hiring Assignment Requirements Matrix

| Requirement | Implementation Detail | Status |
| --- | --- | --- |
| **BullMQ + Redis Scheduler** | Persistent queue using BullMQ delayed jobs (`no cron`) | ✅ Complete |
| **Fake SMTP Delivery** | Integrated via Nodemailer & Ethereal Email with preview links | ✅ Complete |
| **Server Restart Resilience** | DB-backed state + startup queue sync (`restoreScheduledJobs`) | ✅ Complete |
| **Worker Concurrency** | Configurable parallelism (`WORKER_CONCURRENCY`) | ✅ Complete |
| **Minimum Inter-Email Delay** | Redis atomic timestamp gate (`MIN_EMAIL_DELAY_MS`) | ✅ Complete |
| **Sender Hourly Rate Limiting** | Redis atomic Lua sliding counters with automatic next-window delay | ✅ Complete |
| **Slack Rate-Limit Alert** | Real OAuth flow + live Slack chat message trigger | ✅ Complete |
| **Elasticsearch Search** | Indexed multi-field fuzzy search with Postgres fallback | ✅ Complete |
| **Google OAuth** | Passport Google Strategy with session persistence | ✅ Complete |
| **Frontend Dashboard** | Modular React + Vite + Tailwind dashboard & modals | ✅ Complete |
| **Live Queue Dashboard** | Bull Board UI exposed at `/admin/queues` | ✅ Complete |

---

## 📁 Modular Project Architecture

```text
pulse-app/
├── server/                    # Express + TypeScript Backend
│   ├── src/
│   │   ├── config/            # Infrastructure configuration (DB, Redis, ES, Transport)
│   │   ├── controllers/       # Clean request handler logic
│   │   ├── middleware/        # Authentication & global error handling
│   │   ├── queue/             # BullMQ queue, worker, job restorer & Bull Board
│   │   ├── routes/            # Modular Express endpoints
│   │   ├── services/          # Business logic (Slack, Elasticsearch)
│   │   ├── utils/             # Pino logger & standardized response helpers
│   │   └── index.ts           # Clean entry point & lifecycle management
│   ├── prisma/                # PostgreSQL schema & migrations
│   └── Dockerfile
├── web/                       # React + TypeScript Frontend
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   │   ├── dashboard/     # Metric cards & Recharts graphs
│   │   │   ├── email/         # Compose, List, Detail & Search modals
│   │   │   ├── layout/        # Sidebar & Header shell components
│   │   │   └── ui/            # Buttons, Badges, Spinners
│   │   ├── lib/               # API client & TypeScript interfaces
│   │   ├── pages/             # Auth, Dashboard, Scheduled, Sent, Integrations, Queue pages
│   │   ├── style.css          # Modern dark-mode styling
│   │   └── App.tsx            # Application router shell
├── docker-compose.yml         # Postgres, Redis, Elasticsearch local stack
└── README.md
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: v20 or newer
- **Docker Desktop**: For running PostgreSQL, Redis, and Elasticsearch

### 1. Infrastructure Setup
Start local databases using Docker Compose:
```powershell
docker compose up -d
```

### 2. Environment Configuration
Copy `.env.example` to `.env`:
```powershell
cp .env.example .env
```

Ensure `.env` contains valid credentials for:
- `DATABASE_URL` (PostgreSQL connection string)
- `REDIS_URL` (Redis connection string)
- `GOOGLE_CLIENT_ID` & `GOOGLE_CLIENT_SECRET` (Google Cloud Console OAuth)
- `ETHEREAL_USER` & `ETHEREAL_PASSWORD` (Test inbox credentials from [ethereal.email](https://ethereal.email))

### 3. Database Migration
```powershell
npm run db:generate
npm run db:migrate
```

### 4. Start Development Stack
To run both backend API (Port 4000) and frontend (Port 5173) simultaneously:
```powershell
npm run dev
```

---

## 🧪 Key Backend Mechanisms

### 1. Persistent Scheduling & Restart Survival
Emails are stored in PostgreSQL first (`SCHEDULED` status). BullMQ delayed jobs are created with deterministic job IDs (`email-{id}`). If the server crashes or restarts, `restoreScheduledJobs()` queries un-sent emails from PostgreSQL and re-enqueues missing jobs into BullMQ without duplicating sends.

### 2. Rate Limiting & Concurrency
- **Concurrency**: BullMQ workers process jobs in parallel up to `WORKER_CONCURRENCY`.
- **Inter-Email Delay**: A Redis atomic timestamp gate guarantees `MIN_EMAIL_DELAY_MS` spacing per sender.
- **Hourly Limit**: Redis Lua scripts atomically track per-sender hourly counts. If limit is exceeded, jobs are automatically postponed to the next UTC hour window and a live Slack alert is triggered.

---

## ⚙️ Verification & Build Commands

```powershell
# Run TypeScript typechecks for both server and web
npm run typecheck

# Build production bundles
npm run build
```
