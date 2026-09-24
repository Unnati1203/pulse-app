# Pulse Email Workspace

Pulse is a full-stack email scheduling workspace. It provides Google sign-in, campaign composition, delayed delivery, delivery history, queue monitoring, search, and optional Slack notifications.

## Project Layout

- `server/`: Express and TypeScript API, Passport authentication, Prisma data access, BullMQ worker, and integration routes.
- `web/`: React and Vite single-page application.
- `server/prisma/`: PostgreSQL schema and migrations.
- `docker-compose.yml`: PostgreSQL, Redis, and Elasticsearch for the complete local stack.

## Prerequisites

- Node.js 20 or newer
- Docker Desktop for PostgreSQL, Redis, and Elasticsearch
- A Google OAuth web application for sign-in
- An Ethereal Email account for test delivery

## Backend Setup

1. Install dependencies from the repository root:

	```powershell
	npm install
	```

2. Copy `.env.example` to `.env` and set the values described below.
3. Start the infrastructure services:

	```powershell
	docker compose up -d
	```

4. Generate Prisma Client and create the database tables:

	```powershell
	npm run db:generate
	npm run db:migrate
	```

5. Start the API and worker:

	```powershell
	npm run dev:server
	```

The API listens on `http://localhost:4000`. Health check: `GET /api/health`. Bull Board: `http://localhost:4000/admin/queues` after signing in.

## Frontend Setup

Run the frontend in a second terminal:

```powershell
npm run dev:web
```

Open `http://localhost:5173`.

To run both processes together:

```powershell
npm run dev
```

## Environment Variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string. |
| `REDIS_URL` | Redis connection used by BullMQ and production sessions. |
| `ELASTICSEARCH_URL` | Elasticsearch endpoint for indexed email search. |
| `FRONTEND_URL` | Allowed frontend origin and OAuth redirect destination. |
| `SESSION_SECRET` | Secret used to sign session cookies. Use a long random value. |
| `USE_REDIS_SESSION` | Set to `true` when Redis-backed sessions are available. Local development defaults to `false`. |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID. Required for login. |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret. Required for login. |
| `GOOGLE_CALLBACK_URL` | Google callback, normally `http://localhost:4000/api/auth/google/callback`. |
| `ETHEREAL_HOST` | Ethereal SMTP host, normally `smtp.ethereal.email`. |
| `ETHEREAL_PORT` | Ethereal SMTP port, normally `587`. |
| `ETHEREAL_USER` | Ethereal SMTP username. |
| `ETHEREAL_PASSWORD` | Ethereal SMTP password. |
| `SLACK_CLIENT_ID` | Optional Slack OAuth client ID. |
| `SLACK_CLIENT_SECRET` | Optional Slack OAuth client secret. |
| `SLACK_CALLBACK_URL` | Optional Slack callback, normally `http://localhost:4000/api/slack/callback`. |
| `WORKER_CONCURRENCY` | Maximum number of BullMQ jobs processed concurrently. |
| `MAX_EMAILS_PER_HOUR` | Per-sender hourly delivery limit. |
| `MIN_EMAIL_DELAY_MS` | Minimum delay between messages from the same sender. |

### Ethereal Email

Create a test inbox at [ethereal.email](https://ethereal.email), then copy its SMTP host, port, username, and password into `.env`. The worker sends through Ethereal and stores the generated message ID and preview URL. Ethereal is intended for testing and does not deliver normal production email.

### Google OAuth

Create a Google OAuth web client and register this exact redirect URI:

```text
http://localhost:4000/api/auth/google/callback
```

Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, then restart the API.

### Slack

Slack configuration is optional. To enable it, create a Slack app with the `chat:write` scope and register:

```text
http://localhost:4000/api/slack/callback
```

## Architecture

### Scheduling

The compose workflow submits one record per recipient to the API. The API validates the request, stores the email, and adds a delayed BullMQ job with a stable job ID. The worker claims scheduled records before sending, which prevents two workers from processing the same record.

### Persistence and Restart Recovery

PostgreSQL is the source of truth for users and email status. Redis stores BullMQ delayed jobs and rate-limit counters. Redis persistence is enabled by Docker Compose. When the API starts, it scans scheduled database records and restores any missing queue jobs, covering a failure between database insertion and queue insertion.

### Rate Limiting and Concurrency

`WORKER_CONCURRENCY` controls the number of jobs processed at once. A Redis Lua script atomically reserves each sender's hourly capacity. A Redis timestamp gate enforces `MIN_EMAIL_DELAY_MS` across all workers. Jobs over the hourly limit are moved to the next UTC hour instead of being discarded. Slack rate-limit notices are deduplicated by sender and hour.

### Search and Degraded Services

Email fields are indexed in Elasticsearch for fuzzy search. If Elasticsearch is unavailable, search falls back to PostgreSQL. Queue metrics also return a bounded degraded response when Redis is unavailable.

## Implemented Features

### Backend

- Google OAuth login and logout with HttpOnly session cookies.
- Express API with CORS, Helmet, Zod validation, and protected routes.
- Campaign scheduler with one persisted email record per recipient.
- BullMQ delayed jobs and a worker with configurable concurrency.
- PostgreSQL persistence through Prisma.
- Restart recovery for missing scheduled jobs.
- Per-sender hourly rate limiting and minimum send spacing.
- Retry handling and terminal email states: scheduled, processing, sent, and failed.
- Elasticsearch search with PostgreSQL fallback.
- Optional Slack OAuth connection and rate-limit notifications.
- Bull Board queue monitoring.
- Ethereal preview URLs for test messages.

### Frontend

- Google sign-in screen and authenticated workspace shell.
- Overview dashboard with delivery totals, activity chart, queue depth, and rate-limit usage.
- Compose modal with recipient import, scheduling, sender selection, delay, and hourly limit controls.
- Scheduled and sent email tables with filtering and pagination.
- Email detail view and search modal.
- Integrations page for Slack status and connection management.
- Queue monitor with worker and Redis status.
- Responsive sidebar navigation and mobile layout.
- Toast notifications for successful actions and API failures.

## Validation

```powershell
npm run typecheck
npm run build
```

OAuth, SMTP, Slack, Elasticsearch, Redis, and PostgreSQL integration checks require their respective services and credentials.

## Submission Hygiene

Do not commit `.env`, `node_modules/`, or generated `dist/` directories. The included `.gitignore` excludes them. Keep dependency licenses and attributions supplied by npm packages intact.
