#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"

echo "Dropping schema public..."
psql "$DATABASE_URL" <<'SQL'
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO PUBLIC;
SQL

echo "Pushing Prisma schema..."
pnpm prisma db push --schema server/prisma/schema.prisma --accept-data-loss

echo "Done."
