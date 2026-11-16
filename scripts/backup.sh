#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
mkdir -p backups
STAMP="$(date +%Y%m%d-%H%M%S)"

if command -v docker >/dev/null 2>&1; then
  FILE="backups/bellessa-${STAMP}.sql"
  echo "Respaldando PostgreSQL desde docker compose…"
  docker compose exec -T db pg_dump -U bellessa -d bellessa --clean --if-exists > "$FILE"
  echo "Respaldo listo: $FILE"
  exit 0
fi

if [ -f "backend/bellessa.db" ]; then
  cp "backend/bellessa.db" "backups/bellessa-${STAMP}.db"
  echo "Respaldo SQLite listo: backups/bellessa-${STAMP}.db"
  exit 0
fi

echo "No encontré Docker ni backend/bellessa.db. Define cómo respaldar tu base." >&2
exit 1
