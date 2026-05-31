# Disaster Recovery & Database Backup Plan

This document outlines the business continuity and disaster recovery plan for the RETURN production database.

---

## 1. Objectives

- **Recovery Point Objective (RPO)**: **< 24 hours** (Maximum acceptable data loss window during a severe incident).
- **Recovery Time Objective (RTO)**: **< 1 hour** (Maximum target duration to restore services after a failure).
- **Retention Policy**: Backups are retained for **30 days** before rotating, with weekly backups archived for 90 days.

---

## 2. Backup Strategy

Production backups are performed at multiple tiers:

1. **Supabase Managed Backups**:
   - Automated daily backups are maintained by Supabase (7-day retention on free tier, 30-day on Pro).
   - Point-in-Time Recovery (PITR) enabled in production for physical log-shipping rollback.
2. **Autonomous Logical Backups (CLI)**:
   - Weekly logical backups are executed via cron to a secured storage bucket (e.g., AWS S3 or Supabase Storage).
   - Local development/staging backups can be executed manually using `scripts/backup-db.sh`.

---

## 3. Manual Backup & Restore Procedures

### Execution Environment

Ensure your CLI environment has `postgresql-client` installed containing the `pg_dump` and `psql` binaries.

### Creating a Database Backup

Run the backup script. It will read `DATABASE_URL` from the active environment variables:

```bash
# Set your production or staging database URL
export DATABASE_URL="postgresql://user:pass@host:5432/dbname"

# Run the backup script
bash ./scripts/backup-db.sh
```

Backups are output as gzipped SQL files in `./backups/backup_YYYYMMDD_HHMMSS.sql.gz`.

### Restoring a Database Backup

> [!CAUTION]
> Restoring a database drops the existing `public` schema. This is a destructive operation that cannot be undone.

To restore a database from a compressed backup:

```bash
# Set the target database URL
export DATABASE_URL="postgresql://user:pass@host:5432/dbname"

# Run the restore script pointing to the target backup file
bash ./scripts/restore-db.sh ./backups/backup_20260531_120000.sql.gz
```

---

## 4. Disaster Recovery Scenarios & Playbook

### Scenario A: Accidental Table Drop or Data Corruption

1. **Acknowledge & Escalate**: Put the application into Maintenance Mode by setting Vercel environment variable `MAINTENANCE_MODE=true` to block writes.
2. **Identify Target Backup**: Find the latest successful backup file before the corruption occurred.
3. **Execute Restore**:
   - If using Supabase dashboard: Navigate to **Database > Backups** and trigger a PITR restore to a specific timestamp.
   - If using CLI backups: Execute `scripts/restore-db.sh` using the target SQL backup.
4. **Validate Integrity**: Run the verification step inside the restore script and spotcheck recent missing/found case items.
5. **Re-activate Application**: Set `MAINTENANCE_MODE=false` in Vercel and redeploy/restart services.

### Scenario B: Complete Regional Outage (Supabase Provider Down)

1. **Provision Failover Target**: Provision a new PostgreSQL instance on an alternative provider (e.g., Neon or AWS RDS).
2. **Deploy Schema**: Run Prisma migrate on the new database:
   ```bash
   DATABASE_URL="postgresql://alternative-db-url" npx prisma db push
   ```
3. **Restore Data**: Stream the latest backup file into the new instance:
   ```bash
   DATABASE_URL="postgresql://alternative-db-url" bash ./scripts/restore-db.sh ./backups/latest_backup.sql.gz
   ```
4. **Update Connection Strings**: Update `DATABASE_URL` and `DIRECT_URL` environment variables in Vercel.
5. **Redeploy/Promote Staging**: Trigger a Vercel build to apply the connection updates.
