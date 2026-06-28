# Portia — Architecture

This document explains how Portia is put together so a new contributor can find
their way around quickly. It is the in-repo source of truth for structure and
conventions; keep it current when you change a subsystem.

## Overview

Portia is a self-hosted, single-deployable **project portfolio management** tool.
It ships as one Node process that serves both a JSON API and the built React SPA,
backed by an embedded SQLite database — **zero external services required**.

```
Browser ──HTTP/WebSocket──▶ Express server ──▶ SQLite (better-sqlite3, WAL)
              (React SPA served from server/public in production)
```

## Monorepo layout

npm **workspaces**; all commands run from the repo root (see `package.json`).

```
project-portfolio-tool/
├── server/                 # Express + TypeScript API
│   └── src/
│       ├── index.ts        # App bootstrap: middleware, routes, daily sweep, scheduler
│       ├── database.ts      # Schema (initializeDatabase), migrations, demo seed
│       ├── config/          # Central tunables (auth/crypto constants)
│       ├── middleware/      # auth (JWT + personal access tokens)
│       ├── routes/          # One router per resource (projects, tasks, risks, …)
│       └── lib/             # Pure logic + services (the heart of the app — see below)
├── client/                 # React 18 + Vite + TypeScript SPA
│   └── src/
│       ├── pages/          # Route-level screens (code-split)
│       ├── components/     # Feature widgets + ui/ primitives
│       ├── api/            # axios API client
│       ├── store/          # Zustand global state
│       └── realtime.ts     # socket.io-client wiring
├── scripts/assemble.mjs    # Copies client/dist → server/public for production serving
├── Dockerfile, docker-compose.yml
└── .github/workflows/ci.yml
```

## Server design

### Pure logic vs. services (the most important convention)

`server/src/lib/` separates **pure, unit-tested logic** from **DB/IO-bound services**:

- **Pure modules** (e.g. `projectHealth.ts`, `healthTrend.ts`, `dailyChecks.ts`,
  `earnedSchedule.ts`, `scheduler.ts`, `automations.ts`, `csvImport.ts`,
  `recurrence.ts`) take plain inputs and return plain outputs. They have a sibling
  `*.test.ts` and are where the interesting decisions live. **Add logic here first
  and test it.**
- **Services** (e.g. `healthService.ts`, `dailyChecksService.ts`,
  `automationRunner.ts`, `notify.ts`, `webhookDispatcher.ts`) wrap the pure logic
  with database reads/writes and side effects (notifications, sockets, email).

This split is why the server has strong test coverage without needing a live DB
for most tests.

### Key subsystems

| Subsystem | Where | Notes |
|---|---|---|
| **Auth** | `middleware/auth.ts`, `routes/auth.ts`, `config/constants.ts` | JWT for users + personal access tokens (`ppt_…`) for integrations. The signing **and** verifying secret, token lifetime, and bcrypt cost all live in `config/constants.ts` so they can never drift. |
| **Automation engine** | `lib/automations.ts` (pure) + `lib/automationRunner.ts` (exec) | `TriggerType` + `ruleMatches` + `describeEvent` decide *whether* a rule fires; `executeAction` performs the effect. Routes/services call `runAutomations(event, actorId)`; system-originated events use `SYSTEM_ACTOR_ID`. |
| **Daily sweep** | `lib/dailyChecksService.ts` → `runDailyChecks()` | One entry point that records health snapshots and fires overdue / budget-overrun / health-transition alerts. Pure detectors live in `lib/dailyChecks.ts` and `lib/healthTrend.ts`. |
| **Scheduler** | `lib/scheduler.ts` | A re-arming `setTimeout` fires `runDailyChecks()` at every UTC midnight (`msUntilNextUtcMidnight`). The timer is `unref`'d so it never keeps the process alive on its own. |
| **Health scoring** | `lib/projectHealth.ts` (pure) + `lib/healthService.ts` | RAG thresholds live **only** in `healthTrend.ts` `ragForScore` (≥80 green, ≥55 amber, else red). |
| **Critical path** | `lib/criticalPath.ts` (pure) | `computeCriticalPath()` runs the forward/backward CPM pass (ES/EF/LS/LF, total & free float) over activities + typed links; `durationInDays()` is the date→duration convention. `GET /tasks/project/:id/critical-path` derives durations from task dates, anchors offsets to calendar dates, and refreshes the derived `is_critical` flag so Gantt/reports/calendar agree. |
| **Issue import** | `lib/csvImport.ts`, `lib/githubImport.ts`, `lib/jiraImport.ts` | All task importers funnel through `importTasks()` / `importPayload()` in `routes/tasks.ts`. Default mode dedupes by `wbs_code`; sync mode updates status/priority/assignee in place. |
| **Realtime** | `lib/realtime.ts` | socket.io with a JWT handshake; users auto-join a personal room, project rooms on demand. |
| **Notifications** | `lib/notify.ts` → `createNotification()` | The **only** sanctioned way to notify (writes the DB row, emits the socket event, sends email). Never `INSERT INTO notifications` directly outside seed/tests. |
| **Reports/PDF** | `lib/statusPdf.ts`, `lib/portfolioPdf.ts` | pdfkit, standard-14 fonts only. |

### Data layer

- **better-sqlite3** (synchronous, WAL mode). DB file defaults to `data/portia.db`
  (override with `DB_PATH`).
- `initializeDatabase()` holds the **canonical schema** (`CREATE TABLE IF NOT
  EXISTS …`), then calls `runMigrations()` (idempotent `ALTER`/`CREATE`s for
  upgrading older DBs), then `seedDatabase()` (**only** when the `users` table is
  empty). Delete the data dir/file to reseed.
- A table belongs in the canonical block; `runMigrations()` only adds what the
  canonical block didn't have when an older DB was created. Don't define the same
  table in both.

## Client design

- **React 18 + Vite + TypeScript + Tailwind.** Routing via `react-router-dom`,
  global state via **Zustand** (`store/`), charts via **Recharts**, drag-and-drop
  via **DnD Kit**. Pages are **code-split** by route.
- `components/ui/` holds presentational primitives (`Card`, `Badge`, `Avatar`,
  `Modal`, `Progress`). `Card`/`Avatar` are default exports; `Card` has no `title`
  prop — use `CardHeader`. `Modal` takes `{ isOpen, onClose, title, size, footer }`.
- `api/index.ts` is the axios client; `realtime.ts` wires socket.io-client.
- Domain types live in `client/src/types.ts`. The client adds **derived/enriched**
  fields (counts, computed metrics) that the server attaches to responses — keep
  the two type files in sync when an API response shape changes.

## Build & run

| Command (from root) | Does |
|---|---|
| `npm run setup` | Install all workspace dependencies |
| `npm run dev` | Server (`:3001`) + client (`:5173`) with HMR |
| `npm run build` | `tsc` + `vite build` for both workspaces |
| `npm start` | Assemble client into `server/public` and serve in production mode |
| `npm test` | Vitest, server **and** client |
| `npm run lint` | ESLint over `server/src` + `client/src` |
| `npm run check` | lint + build + test (the full gate) |

Production serving requires `NODE_ENV=production` (that's what makes Express serve
the SPA from `server/public`); `npm start`/`npm run serve` set it for you. Docker:
`docker-compose up` builds and runs the single container.

## Gotchas worth knowing

- **Build output is gitignored** (`dist/`, `server/public/`, `client/dist/`, the
  data dir). It regenerates on build.
- **File uploads are base64-over-JSON**, not multipart (no multer). `express.json`
  is capped at 20 MB; decoded attachments at 10 MB.
- **`GET /api/health`** is a liveness probe registered before the routers — never
  mount a router there. Insight data is under `/api/insights`.
- **Lazy-prepare** any `better-sqlite3` statement that touches a table inside a
  service, because module-top prepares can run before `initializeDatabase()`.

## Tests & CI

- Server logic is covered by colocated `*.test.ts`; client components by colocated
  `*.test.tsx` (vitest + Testing Library + jsdom — config in `client/vitest.config.ts`).
- CI (`.github/workflows/ci.yml`) runs **lint → build → test** on every push to
  `main` and every PR. A change is "done" when `npm run check` is green.
