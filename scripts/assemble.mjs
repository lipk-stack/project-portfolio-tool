// Cross-platform build assembler: copies the compiled client bundle
// (client/dist) into the location the production server serves from
// (server/public). Pure Node fs — no shell `cp`/`xcopy` — so it behaves
// identically on Windows, macOS and Linux. Run automatically before `npm start`.

import { existsSync, mkdirSync, readdirSync, statSync, copyFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'client', 'dist')
const dest = join(root, 'server', 'public')

if (!existsSync(src)) {
  console.error('✖ client/dist not found. Build the client first: `npm run build`.')
  process.exit(1)
}

function copyDir(from, to) {
  mkdirSync(to, { recursive: true })
  for (const entry of readdirSync(from)) {
    const s = join(from, entry)
    const d = join(to, entry)
    if (statSync(s).isDirectory()) copyDir(s, d)
    else copyFileSync(s, d)
  }
}

rmSync(dest, { recursive: true, force: true })
copyDir(src, dest)
console.log('✔ Assembled client build → server/public')
