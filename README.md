# Helmsman — Enterprise Portfolio Management

A full-featured, production-ready project portfolio management tool with Gantt charts, Kanban boards, EVM analytics, baseline tracking, resource management, budget tracking, risk registers, calendar, and real-time collaboration.

## Features

| Feature | Details |
|---|---|
| **Portfolio Dashboard** | KPI cards, portfolio EVM strip (CPI/SPI/EV/PV/AC), health scorecard, upcoming milestones, activity feed |
| **EVM Analytics** | PMBOK-standard Earned Value: BAC/EV/PV/AC, CV/SV, CPI/SPI, EAC/ETC/VAC/TCPI, S-curve chart, schedule slip forecast, executive narrative |
| **Earned Schedule** | Time-based schedule analytics: ES, SPI(t), time variance, forecast completion date — stays meaningful late in the project where classic SPI converges to 1 |
| **My Work** | Cross-project list of your open tasks grouped by urgency (overdue / today / this week), with one-click status updates |
| **Baseline Tracking** | Capture project & task baselines (start/end/budget/hours), variance visualization on Gantt bars (slipped baselines turn red) |
| **Gantt Chart** | Interactive SVG, day/week/month zoom, dependency arrows, critical path highlighting, today line, baseline overlay |
| **Kanban Board** | Drag-and-drop (DnD Kit), 5 columns, priority indicators, assignee avatars |
| **Calendar** | Monthly view of all task deadlines + milestones + project ends, filter by type, critical-path callout, click-to-detail |
| **Global Search (⌘K)** | Instant unified search across projects, tasks, risks, portfolios, and people |
| **Comments** | Threaded comments on tasks with @assignee notifications |
| **Notifications Center** | Bell dropdown with assignment, comment, risk, and milestone alerts; mark read/all-read |
| **Sprints / Agile** | Sprint planning with backlog grooming, story points, burndown chart, committed-vs-completed velocity |
| **Resource Management** | Utilization heatmap, allocation matrix, overallocation alerts |
| **Capacity Forecast** | 12-week look-ahead heatmap per resource from remaining task estimates; overdue work auto re-planned |
| **Budget Tracking** | Planned vs actual by category, spend rate, EVM-style charts |
| **Cash Flow** | Time-phased budget: monthly planned vs actual spend with cumulative curves |
| **Risk Register** | Probability/impact matrix, severity scoring, mitigation plans |
| **Automations** | No-code rules engine: when task/risk events occur (with conditions), notify people, set priority, or add comments |
| **Saved Views** | Save named filter combinations on the Projects page, with one-click recall |
| **CSV Bulk Import** | Bulk-import **tasks and risks** from Excel / MS Project / Jira / Asana exports; smart header mapping, per-row validation, dry-run preview, and downloadable CSV templates — only error-free rows are committed |
| **File Attachments** | Attach files (up to 10 MB) to any task with authenticated upload/download; stored alongside the database (Docker volume / gitignored data dir) |
| **Recurring Tasks** | Daily/weekly/monthly recurrence; completing a task auto-spawns the next occurrence with dates shifted forward (duration preserved, optional end date) |
| **PDF Reports** | One-page executive status report per project (EVM KPIs, milestones, top risks) |
| **Export** | One-click CSV export of projects/tasks/risks/budget/time-entries, full project as JSON |
| **Analytics & Reports** | Portfolio performance, task velocity, hours logged, department utilization |
| **Multi-Portfolio** | Group projects across multiple portfolios |
| **Authentication** | JWT-based auth, role-based access (admin, manager, member) |
| **Demo Data** | 8 realistic projects, 10 team members, full task/risk/budget data, captured baselines, seeded comments & notifications |

## Quick Start

Helmsman runs the same way on **Windows, macOS and Linux**. Two requirements:

- **[Node.js 20 or newer](https://nodejs.org)** (LTS recommended) — for the one-command and npm paths, or
- **[Docker Desktop](https://www.docker.com/products/docker-desktop/)** — for the container path.

The data store is an embedded SQLite file, so there is **no database to install or configure**.

### Option 1: One command (easiest — Win / Mac / Linux)

Clone the repo, then from the project folder:

| OS | Command |
|---|---|
| **macOS / Linux** | `./start.sh` |
| **Windows** | double-click `start.bat` (or run `start.bat` in a terminal) |

The launcher creates a `.env` from the template, installs dependencies, builds the app, and starts it at **http://localhost:3001**. First run takes a couple of minutes; subsequent runs are fast.

### Option 2: npm scripts (cross-platform)

```bash
npm run setup     # install root + server + client dependencies
npm run serve     # build everything and start at http://localhost:3001
```

These scripts are OS-agnostic (no shell-specific commands), so the exact same lines work in PowerShell, cmd, bash, or zsh.

### Option 3: Docker (recommended for a server / always-on deployment)

```bash
cp .env.example .env          # (Windows: copy .env.example .env)
# Edit .env and set a strong JWT_SECRET
docker compose up -d
# App available at http://localhost:3001
```

### Option 4: Development mode (hot reload)

```bash
npm run setup
npm run dev
# Server (API):  http://localhost:3001
# Client (Vite): http://localhost:5173
```

> **Note on the native module:** Helmsman uses `better-sqlite3`, which ships precompiled binaries for Windows, macOS and Linux on Node 20/22 — so `npm run setup` works without any compiler toolchain on a standard install.

## Demo Accounts

| Role | Email | Password |
|---|---|---|
| Admin | admin@demo.com | admin123 |
| Project Manager | john.manager@demo.com | demo123 |
| Developer | alex.dev@demo.com | demo123 |

## Tech Stack

**Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Recharts, DnD Kit, Zustand, React Router  
**Backend:** Node.js 22, Express, TypeScript, better-sqlite3  
**Deployment:** Docker, docker-compose (single container, zero external dependencies)

## Architecture

```
helmsman/
├── start.sh / start.bat  # one-command launchers (macOS·Linux / Windows)
├── scripts/assemble.mjs  # cross-platform build assembler (client → server/public)
├── client/               # React + Vite frontend
│   └── src/
│       ├── components/   # Gantt, Kanban, EVMDashboard, GlobalSearch, NotificationsDropdown, CommentsPanel, forms, UI library
│       ├── pages/        # Dashboard, Projects, Portfolio, ProjectDetail, Resources, Reports, Calendar, Settings
│       ├── api/          # API client (axios)
│       └── store/        # Zustand state management
├── server/               # Express backend
│   └── src/
│       ├── routes/       # auth, dashboard, portfolios, projects, tasks, risks, budget,
│       │                 # resources, reports, evm, exports, search, comments,
│       │                 # notifications, calendar
│       ├── database.ts   # SQLite schema, migrations, seed data
│       └── middleware/   # JWT authentication
├── docker-compose.yml
└── Dockerfile
```

## API Surface

The backend exposes a comprehensive REST API. Highlights:

- `GET /api/evm/project/:id` — Full EVM metrics + S-curve for one project
- `GET /api/evm/portfolio/summary` — Rolled-up portfolio EVM
- `POST /api/evm/project/:id/baseline` — Capture current plan as baseline
- `GET /api/search?q=...` — Unified global search (projects, tasks, risks, portfolios, people)
- `GET /api/calendar?from=&to=` — All scheduled events for date range
- `GET /api/notifications` — Per-user notification feed
- `GET /api/comments/:entityType/:entityId` — Threaded comments
- `GET /api/sprints/project/:id` — Sprints with point rollups (`POST` to create; `PUT/DELETE /api/sprints/:id`)
- `GET /api/sprints/:id/burndown` — Daily ideal vs actual remaining points
- `GET /api/sprints/project/:id/velocity` — Committed vs completed points per sprint
- `GET /api/resources/capacity-forecast?weeks=12` — Per-resource weekly load forecast
- `GET /api/budget/project/:id/cashflow` — Monthly planned vs actual spend
- `GET /api/export/projects.csv`, `/api/export/projects/:id/tasks.csv`, `/api/export/projects/:id/risks.csv`, `/api/export/projects/:id/budget.csv`, `/api/export/projects/:id.json`, `/api/export/time-entries.csv`
- `GET /api/custom-fields/project/:id` — Per-project custom field definitions (`POST` to create; values ride along on task create/update via `custom_values`)
- `POST /api/scenario/project/:id/simulate` — What-if schedule simulation (shifts/extensions ripple through dependencies; nothing persisted)
- `GET /api/reports/portfolio/:id/briefing.pdf` — Multi-project executive briefing (`:id` or `all`)
- `GET /api/tokens` — Personal access tokens (`POST` to create, `DELETE /:id` to revoke); use `Authorization: Bearer ppt_...` for external integrations
- `GET /api/webhooks` — Outbound webhooks, admin only (`POST` to create, `POST /:id/test` to ping; payloads HMAC-SHA256 signed via `X-PPT-Signature`; `format: "slack"` posts Slack-ready `{text}` messages straight to incoming-webhook URLs)
- `GET /api/tasks/my-work` — Current user's open tasks across projects with urgency counts
- `PATCH /api/tasks/:id/status` — Status-only task update (safe for quick actions; fires automations, sockets, webhooks)
- `GET /api/activity?project_id=&user_id=&action=` — Filterable, paginated audit trail
- `PUT /api/auth/me/preferences` — Per-user preferences (email notification opt-out)

## Real-Time & Email

- **WebSockets (socket.io):** notifications are pushed instantly to the bell dropdown, and task changes made by teammates refresh open project pages live. The socket handshake reuses the JWT.
- **Email notifications:** set the `SMTP_*` variables in `.env` to deliver every in-app notification by email too (silently disabled when unconfigured; users can opt out in Settings).

## Testing

```bash
npm test   # Vitest unit tests (agile math, automations, scenarios, webhooks)
```

## Comparison with Industry Leaders

| Feature | Helmsman | MS Project | Jira | Asana |
|---|---|---|---|---|
| Gantt Chart | ✅ Custom SVG | ✅ | ❌ Native | ⚠️ Basic |
| Critical Path | ✅ | ✅ | ❌ | ❌ |
| Baseline Tracking | ✅ | ✅ | ❌ | ❌ |
| EVM (CPI/SPI/EAC/TCPI) | ✅ | ✅ | ❌ | ❌ |
| S-Curve Analytics | ✅ | ✅ | ❌ | ❌ |
| Kanban Board | ✅ | ❌ | ✅ | ✅ |
| Calendar View | ✅ | ✅ | ✅ | ✅ |
| Portfolio View | ✅ | ✅ | ⚠️ Paid | ⚠️ Paid |
| Resource Allocation Matrix | ✅ | ✅ | ❌ | ❌ |
| Budget Tracking | ✅ | ✅ | ❌ | ❌ |
| Risk Register | ✅ | ⚠️ | ❌ | ❌ |
| Comments / Notifications | ✅ | ⚠️ | ✅ | ✅ |
| Global Search (⌘K) | ✅ | ⚠️ | ✅ | ✅ |
| CSV / JSON Export | ✅ | ✅ | ✅ | ✅ |
| PDF Status Reports | ✅ | ✅ | ⚠️ Paid | ⚠️ Paid |
| Workflow Automations | ✅ | ❌ | ✅ | ✅ |
| Saved Views | ✅ | ⚠️ | ✅ | ✅ |
| Custom Fields | ✅ | ✅ | ✅ | ⚠️ Paid |
| What-If Scenario Planning | ✅ | ⚠️ Paid tier | ❌ | ❌ |
| API Access Tokens | ✅ | ⚠️ | ✅ | ✅ |
| Real-Time Collaboration | ✅ WebSockets | ⚠️ | ✅ | ✅ |
| Email Notifications | ✅ | ✅ | ✅ | ✅ |
| Outbound Webhooks (HMAC) | ✅ | ❌ | ✅ | ⚠️ Paid |
| Slack Notifications | ✅ Native format | ❌ | ✅ | ✅ |
| Earned Schedule / SPI(t) | ✅ | ❌ | ❌ | ❌ |
| My Work View | ✅ | ✅ | ✅ | ✅ |
| Audit Log | ✅ | ⚠️ | ✅ Paid | ⚠️ Paid |
| Dependency Editor + Cycle Guard | ✅ | ✅ | ⚠️ Plugin | ⚠️ Paid |
| Self-Hosted | ✅ | ❌ | ✅ | ❌ |
| Free | ✅ | ❌ | ⚠️ Limited | ⚠️ Limited |

## Roadmap (Future Enhancements)

Completed in iteration 1: EVM, baseline, CSV/JSON export, calendar, global search, comments, notifications.
Completed in iteration 2: sprints/agile (burndown, velocity), capacity forecast, time-phased cash flow.
Completed in iteration 3: PDF executive reports, workflow automation rules engine, saved views, route-based code splitting.
Completed in iteration 4: custom fields, what-if scenario planning, portfolio briefing PDF, personal API tokens.
Completed in iteration 5: real-time collaboration (WebSockets), email notifications (SMTP), outbound webhooks with HMAC signing, audit log UI, task dependency editor with cycle detection.
Completed in iteration 6: earned schedule metrics (SPI(t), forecast completion), My Work page, Slack-format webhooks, project created/updated webhook events, status-only task PATCH, live sprint board updates.
Completed in iteration 7: CSV task import (smart header mapping + dry-run validation preview), recurring tasks (daily/weekly/monthly auto-spawn on completion), portfolio-level Earned Schedule rollup (BAC-weighted SPI(t) + projects-behind count on the dashboard).
Completed in iteration 8: file attachments on tasks (≤10 MB, authenticated upload/download, stored in the data dir), CSV risk import (shared validation/preview engine), downloadable CSV templates for the task & risk importers.

Planned for upcoming iterations:
- [ ] Inbound integrations (Jira/GitHub import, MS Teams, Outlook)
- [ ] SSO / SAML, multi-tenant
- [ ] Mobile app (React Native)
- [ ] AI-powered risk prediction & status auto-summary
