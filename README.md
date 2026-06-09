# ProjectPulse — Enterprise Portfolio Management

A full-featured, production-ready project portfolio management tool with Gantt charts, Kanban boards, EVM analytics, baseline tracking, resource management, budget tracking, risk registers, calendar, and real-time collaboration.

## Features

| Feature | Details |
|---|---|
| **Portfolio Dashboard** | KPI cards, portfolio EVM strip (CPI/SPI/EV/PV/AC), health scorecard, upcoming milestones, activity feed |
| **EVM Analytics** | PMBOK-standard Earned Value: BAC/EV/PV/AC, CV/SV, CPI/SPI, EAC/ETC/VAC/TCPI, S-curve chart, schedule slip forecast, executive narrative |
| **Baseline Tracking** | Capture project & task baselines (start/end/budget/hours), variance visualization on Gantt bars (slipped baselines turn red) |
| **Gantt Chart** | Interactive SVG, day/week/month zoom, dependency arrows, critical path highlighting, today line, baseline overlay |
| **Kanban Board** | Drag-and-drop (DnD Kit), 5 columns, priority indicators, assignee avatars |
| **Calendar** | Monthly view of all task deadlines + milestones + project ends, filter by type, critical-path callout, click-to-detail |
| **Global Search (⌘K)** | Instant unified search across projects, tasks, risks, portfolios, and people |
| **Comments** | Threaded comments on tasks with @assignee notifications |
| **Notifications Center** | Bell dropdown with assignment, comment, risk, and milestone alerts; mark read/all-read |
| **Resource Management** | Utilization heatmap, allocation matrix, overallocation alerts |
| **Budget Tracking** | Planned vs actual by category, spend rate, EVM-style charts |
| **Risk Register** | Probability/impact matrix, severity scoring, mitigation plans |
| **Export** | One-click CSV export of projects/tasks/risks/budget/time-entries, full project as JSON |
| **Analytics & Reports** | Portfolio performance, task velocity, hours logged, department utilization |
| **Multi-Portfolio** | Group projects across multiple portfolios |
| **Authentication** | JWT-based auth, role-based access (admin, manager, member) |
| **Demo Data** | 8 realistic projects, 10 team members, full task/risk/budget data, captured baselines, seeded comments & notifications |

## Quick Start

### Option 1: Docker (recommended for production)

```bash
cp .env.example .env
# Edit .env and set a strong JWT_SECRET
docker-compose up -d
# App available at http://localhost:3001
```

### Option 2: Development mode

```bash
# Install dependencies
npm install
npm install --workspace=server
npm install --workspace=client

# Start both server and client
npm run dev
# Server: http://localhost:3001
# Client: http://localhost:5173
```

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
project-portfolio-tool/
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
- `GET /api/export/projects.csv`, `/api/export/projects/:id/tasks.csv`, `/api/export/projects/:id/risks.csv`, `/api/export/projects/:id/budget.csv`, `/api/export/projects/:id.json`, `/api/export/time-entries.csv`

## Comparison with Industry Leaders

| Feature | ProjectPulse | MS Project | Jira | Asana |
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
| Self-Hosted | ✅ | ❌ | ✅ | ❌ |
| Free | ✅ | ❌ | ⚠️ Limited | ⚠️ Limited |

## Roadmap (Future Enhancements)

Completed in iteration 1: EVM, baseline, CSV/JSON export, calendar, global search, comments, notifications.

Planned for upcoming iterations:
- [ ] Real-time collaboration (WebSockets)
- [ ] PDF reports (executive briefing pack)
- [ ] Email & in-app webhook notifications
- [ ] Resource capacity forecasting (look-ahead heatmap)
- [ ] Custom fields & saved views
- [ ] Sprint board / Agile burndown
- [ ] Time-phased budget (cost loading)
- [ ] What-if scenario planning (schedule simulation)
- [ ] Workflow automation & rules engine
- [ ] Integrations (Jira, GitHub, Slack, MS Teams, Outlook)
- [ ] Mobile app (React Native)
- [ ] AI-powered risk prediction & status auto-summary
