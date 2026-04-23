#!/bin/sh
set -e

echo "=== Starting application ==="

# Apply database schema if DATABASE_URL is set
if [ -n "$DATABASE_URL" ]; then
  echo "Running prisma db push..."
  npx prisma db push --skip-generate 2>&1 || echo "Warning: db push failed, continuing..."
  echo "Database schema applied."
else
  echo "Warning: DATABASE_URL not set, skipping database setup."
fi

echo "Starting Next.js server..."
exec npm run start
