#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status
set -eo pipefail

# Ensure DATABASE_URL is provided
if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL environment variable is not set." >&2
  exit 1
fi

# Define backup directory and file name
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql.gz"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "Starting PostgreSQL backup..."
echo "Target file: $BACKUP_FILE"

# Run pg_dump, pipe through gzip, and write to file
# We use the DATABASE_URL connection string directly
if pg_dump "$DATABASE_URL" --no-owner --no-privileges | gzip > "$BACKUP_FILE"; then
  echo "Backup successfully completed!"
  echo "Size: $(du -sh "$BACKUP_FILE" | cut -f1)"
else
  echo "Error: Backup failed." >&2
  exit 1
fi
