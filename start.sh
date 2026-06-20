#!/usr/bin/env bash
# Portia — one-command launcher for macOS / Linux.
# Installs dependencies, builds the app, and starts it at http://localhost:3001
set -euo pipefail
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 20+ is required. Install it from https://nodejs.org and re-run this script."
  exit 1
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "Node.js 20+ is required (found $(node -v))."
  exit 1
fi

if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example — edit it to set a strong JWT_SECRET for production."
fi

echo "Installing dependencies…"
npm run setup
echo "Building and starting Portia…"
npm run serve
