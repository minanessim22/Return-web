#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status
set -eo pipefail

# Ensure DATABASE_URL is provided
if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL environment variable is not set." >&2
  exit 1
fi

# Ensure backup file argument is provided
BACKUP_FILE="$1"
if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <path_to_backup_file.sql.gz>" >&2
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Error: Backup file '$BACKUP_FILE' does not exist." >&2
  exit 1
fi

echo "WARNING: This operation will overwrite data in the target database."
echo "Target Database: $(echo "$DATABASE_URL" | sed -E 's/:\/\/([^:]+):([^@]+)@/:\/\/\1:****@/')" # Redact password
read -p "Are you absolutely sure you want to proceed? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Restore cancelled by user."
    exit 0
fi

echo "Starting database restore..."

# Drop and recreate schema to ensure a clean slate
# (Optional: skip if you want to restore on top, but highly recommended for disaster recovery)
echo "Recreating public schema..."
psql "$DATABASE_URL" -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"

echo "Streaming backup into target database..."
if gunzip -c "$BACKUP_FILE" | psql "$DATABASE_URL" --quiet; then
  echo "Restore completed successfully!"
  
  echo "Running post-restore verification query..."
  # Simple query to verify User table count
  USER_COUNT=$(psql "$DATABASE_URL" -t -A -c "SELECT COUNT(*) FROM users;")
  echo "Verification: 'users' table has $USER_COUNT records."
else
  echo "Error: Restore failed." >&2
  exit 1
fi
