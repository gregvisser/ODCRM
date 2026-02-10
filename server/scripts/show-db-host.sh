#!/bin/bash
# show-db-host.sh - Safely display database hostname without exposing credentials
# Usage: bash scripts/show-db-host.sh

set -e

if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL environment variable is not set"
  echo ""
  echo "Set it with:"
  echo "  export DATABASE_URL='postgresql://user:pass@hostname:5432/dbname'"
  echo ""
  exit 1
fi

# Extract hostname (everything between @ and : or /)
DB_HOST=$(echo "$DATABASE_URL" | grep -oP '(?<=@)[^:/]+' || echo "PARSE_FAILED")

if [ "$DB_HOST" = "PARSE_FAILED" ]; then
  echo "❌ ERROR: Could not parse hostname from DATABASE_URL"
  echo "Format should be: postgresql://user:pass@HOSTNAME:5432/dbname"
  exit 1
fi

echo "✅ Database hostname: $DB_HOST"
echo ""
echo "Example connection test (requires psql):"
echo "  psql \"\$DATABASE_URL\" -c 'SELECT version();'"
