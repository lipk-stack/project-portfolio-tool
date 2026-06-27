# Contributing to Portia

Thanks for working on Portia. This guide covers local setup, the everyday
workflow, and the conventions that keep the codebase maintainable. For how the
system is structured, read [ARCHITECTURE.md](./ARCHITECTURE.md) first.

## Prerequisites

- **Node.js ≥ 20** (the repo pins **22** via `.nvmrc` — `nvm use` picks it up).
- npm (ships with Node).

## Setup

```bash
npm run setup     # installs root + server + client dependencies
```

## Everyday workflow

```bash
npm run dev       # server on :3001, client on :5173 (HMR)
```

Demo accounts (seeded on a fresh database):

| Role | Email | Password |
|---|---|---|
| Admin | admin@demo.com | admin123 |
| Project Manager | john.manager@demo.com | demo123 |
| Developer | alex.dev@demo.com | demo123 |

To reseed, delete the data directory/file (`DB_PATH`, default `data/portia.db`)
and restart.

## Definition of done

A change is ready to merge when this is green:

```bash
npm run check     # = lint  +  build  +  test
```

CI runs exactly this on every push to `main` and every pull request
(`.github/workflows/ci.yml`). Don't merge red.

### Individual gates

| Command | What it checks |
|---|---|
| `npm run lint` | ESLint over `server/src` + `client/src`. **0 errors required.** Warnings are allowed but are a tracked cleanup backlog — don't add new ones. |
| `npm run lint:fix` | Auto-fix what ESLint can |
| `npm run build` | `tsc` type-check + bundle, both workspaces |
| `npm test` | Vitest, server **and** client |
| `npm run format` | Prettier write (config in `.prettierrc.json`) |
| `npm run format:check` | Prettier check without writing |

## Coding conventions

- **TypeScript everywhere.** Prefer precise types; reserve `any` for genuinely
  dynamic third-party payloads and SQLite rows (ESLint warns on it so it stays
  visible).
- **Server: pure logic first.** Put real decision-making in a pure `lib/*.ts`
  module with a sibling `*.test.ts`, then wire it into a service/route. See the
  "pure logic vs. services" section of ARCHITECTURE.md.
- **Centralize tunables.** Security/auth constants live in
  `server/src/config/constants.ts` — don't reintroduce magic literals for the JWT
  secret, token lifetime, bcrypt cost, etc.
- **Notifications** go through `createNotification()` (`lib/notify.ts`) — never
  insert notification rows directly.
- **Schema changes:** add the table/column to the canonical block in
  `database.ts` (`initializeDatabase`); use `runMigrations()` only for
  idempotent upgrades to already-deployed databases.
- **Formatting** is owned by Prettier (`.prettierrc.json`: no semicolons, single
  quotes, 100-col, trailing commas). Editors honor `.editorconfig`.

## Tests

- Co-locate tests next to the code: `foo.ts` → `foo.test.ts`
  (`Foo.tsx` → `Foo.test.tsx`).
- Server: pure functions get direct unit tests; DB/network-bound paths get a
  deterministic check that seeds the precise rows it needs against a temp
  `DB_PATH` and asserts on the resulting tables.
- Client: vitest + Testing Library + jsdom. Wrap router-dependent components in
  `<MemoryRouter>`; mock `../api` / `../store` with `vi.mock(...)`.

## Commits & branches

- Work on a feature branch; open a PR against `main`.
- Write clear, imperative commit messages describing the *why*, not just the *what*.
- Keep PRs focused. If a change grows, split it.

## Apply YAGNI

Build what the current change needs — not speculative abstractions. Prefer a small,
verified improvement that ships green over a large refactor that doesn't.
