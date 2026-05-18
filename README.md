# ProjectPulse — Enterprise Portfolio Management

A full-featured, production-ready project portfolio management tool with Gantt charts, Kanban boards, resource management, budget tracking, risk registers, and real-time analytics.

## Features

| Feature | Details |
|---|---|
| **Portfolio Dashboard** | KPI cards, health scorecard, upcoming milestones, activity feed |
| **Gantt Chart** | Interactive SVG-based, zoom levels (day/week/month), dependency arrows, critical path, today line |
| **Kanban Board** | Drag-and-drop (DnD Kit), 5 columns, priority indicators, assignee avatars |
| **Resource Management** | Utilization heatmap, allocation matrix, overallocation alerts |
| **Budget Tracking** | Planned vs actual by category, spend rate, EVM-style charts |
| **Risk Register** | Probability/impact matrix, severity scoring, mitigation plans |
| **Analytics & Reports** | Portfolio performance, task velocity, hours logged, department utilization |
| **Multi-Portfolio** | Group projects across multiple portfolios |
| **Authentication** | JWT-based auth, role-based access (admin, manager, member) |
| **Demo Data** | 8 realistic projects, 10 team members, full task/risk/budget data |

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
│       ├── components/   # Gantt, Kanban, forms, UI library
│       ├── pages/        # Dashboard, Projects, Portfolio, Resources, Reports
│       ├── api/          # API client (axios)
│       └── store/        # Zustand state management
├── server/               # Express backend
│   └── src/
│       ├── routes/       # Auth, projects, tasks, risks, budget, resources
│       ├── database.ts   # SQLite schema + seed data
│       └── middleware/   # JWT authentication
├── docker-compose.yml
└── Dockerfile
```

## Comparison with Industry Leaders

| Feature | ProjectPulse | MS Project | Jira | Asana |
|---|---|---|---|---|
| Gantt Chart | ✅ Custom SVG | ✅ | ❌ Native | ⚠️ Basic |
| Critical Path | ✅ | ✅ | ❌ | ❌ |
| Kanban Board | ✅ | ❌ | ✅ | ✅ |
| Portfolio View | ✅ | ✅ | ⚠️ Paid | ⚠️ Paid |
| Resource Allocation Matrix | ✅ | ✅ | ❌ | ❌ |
| Budget Tracking | ✅ | ✅ | ❌ | ❌ |
| Risk Register | ✅ | ⚠️ | ❌ | ❌ |
| Self-Hosted | ✅ | ❌ | ✅ | ❌ |
| Free | ✅ | ❌ | ⚠️ Limited | ⚠️ Limited |

## Roadmap (Future Enhancements)

- [ ] Real-time collaboration (WebSockets)
- [ ] Export to PDF/Excel/CSV
- [ ] Email notifications
- [ ] Baseline tracking (schedule variance)
- [ ] Earned Value Management (EVM) metrics
- [ ] Resource capacity forecasting
- [ ] Custom fields
- [ ] Integrations (Jira, GitHub, Slack)
- [ ] Mobile app (React Native)
- [ ] AI-powered risk prediction
