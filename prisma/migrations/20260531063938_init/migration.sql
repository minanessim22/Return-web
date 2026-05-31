-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN', 'OPERATOR');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "CaseType" AS ENUM ('MISSING', 'FOUND');

-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('DRAFT', 'ACTIVE', 'UNDER_REVIEW', 'MATCHED', 'RESOLVED', 'CLOSED');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('GPS', 'QR', 'NFC');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DISCONNECTED');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ScanType" AS ENUM ('QR', 'NFC');

-- CreateEnum
CREATE TYPE "AiJobType" AS ENUM ('RECOGNIZE', 'MATCH');

-- CreateEnum
CREATE TYPE "AiJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'SYSTEM');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "password_hash" TEXT NOT NULL,
    "avatar_url" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "date_of_birth" TEXT,
    "email_verified_at" TIMESTAMP(3),
    "failed_login_count" INTEGER NOT NULL DEFAULT 0,
    "last_login_at" TIMESTAMP(3),
    "locked_until" TIMESTAMP(3),
    "username" TEXT NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "dark_mode" BOOLEAN NOT NULL DEFAULT false,
    "notifications_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "csrf_token" TEXT,
    "remember_me" BOOLEAN NOT NULL DEFAULT true,
    "user_agent" TEXT,
    "ip_hash" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_requests" (
    "id" UUID NOT NULL,
    "purpose" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "user_id" UUID,
    "code_hash" TEXT NOT NULL,
    "attempts_left" INTEGER NOT NULL DEFAULT 5,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cases" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID,
    "reference_code" TEXT NOT NULL,
    "type" "CaseType" NOT NULL,
    "status" "CaseStatus" NOT NULL DEFAULT 'ACTIVE',
    "category" TEXT,
    "full_name" TEXT,
    "estimated_name" TEXT,
    "age" INTEGER,
    "gender" TEXT,
    "description" TEXT,
    "clothes_color" TEXT,
    "condition_notes" TEXT,
    "contact_phone" TEXT,
    "event_time" TIMESTAMP(3),
    "location_text" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "last_seen_at" TIMESTAMP(3),
    "found_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_images" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "image_url" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_status_history" (
    "id" UUID NOT NULL,
    "case_id" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT,
    "changed_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_matches" (
    "id" UUID NOT NULL,
    "missing_case_id" UUID NOT NULL,
    "found_case_id" UUID NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'ai_face_match',
    "score" DOUBLE PRECISION NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'PENDING',
    "confirmed_by_user_id" UUID,
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identification_profiles" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID,
    "display_name" TEXT NOT NULL,
    "age" INTEGER,
    "category" TEXT,
    "clothes_color" TEXT,
    "blood_type" TEXT,
    "medical_notes" TEXT,
    "last_location_text" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "photo_url" TEXT,
    "qr_public_token" TEXT,
    "nfc_tag_uid" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "identification_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identification_emergency_contacts" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "contact_name" TEXT NOT NULL,
    "relation" TEXT,
    "phone" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "identification_emergency_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" UUID NOT NULL,
    "owner_user_id" UUID,
    "type" "DeviceType" NOT NULL,
    "serial_number" TEXT NOT NULL,
    "label" TEXT,
    "status" "DeviceStatus" NOT NULL DEFAULT 'ACTIVE',
    "battery_level" INTEGER,
    "update_interval_minutes" INTEGER,
    "tracking_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_links" (
    "id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unlinked_at" TIMESTAMP(3),

    CONSTRAINT "device_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gps_locations" (
    "id" UUID NOT NULL,
    "device_id" UUID NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "battery_level" INTEGER,
    "recorded_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gps_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "location_history" (
    "id" UUID NOT NULL,
    "device_id" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "battery" INTEGER,
    "altitude" DOUBLE PRECISION,
    "speed" DOUBLE PRECISION,
    "accuracy" DOUBLE PRECISION,
    "bearing" DOUBLE PRECISION,
    "alert_type" TEXT NOT NULL DEFAULT 'location',
    "source" TEXT NOT NULL DEFAULT 'http',
    "recorded_at" TIMESTAMP(3) NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "location_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scan_events" (
    "id" UUID NOT NULL,
    "profile_id" UUID,
    "device_id" UUID,
    "scan_type" "ScanType" NOT NULL,
    "scan_token" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "scanned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "scan_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_jobs" (
    "id" UUID NOT NULL,
    "requested_by_user_id" UUID,
    "related_case_id" UUID,
    "image_url" TEXT,
    "job_type" "AiJobType" NOT NULL DEFAULT 'RECOGNIZE',
    "status" "AiJobStatus" NOT NULL DEFAULT 'QUEUED',
    "result_summary" JSONB,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_job_candidates" (
    "id" UUID NOT NULL,
    "ai_job_id" UUID NOT NULL,
    "candidate_case_id" UUID,
    "score" DOUBLE PRECISION,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_job_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "related_case_id" UUID,
    "created_by_user_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "conversation_participants" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "conversation_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "sender_user_id" UUID,
    "message_type" "MessageType" NOT NULL DEFAULT 'TEXT',
    "body" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "type" TEXT,
    "related_case_id" UUID,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registered_trackers" (
    "device_id" TEXT NOT NULL,
    "label" TEXT,
    "owner_email" TEXT,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registered_trackers_pkey" PRIMARY KEY ("device_id")
);

-- CreateTable
CREATE TABLE "key_value_store" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "key_value_store_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_user_id_key" ON "user_preferences"("user_id");

-- CreateIndex
CREATE INDEX "sessions_token_hash_idx" ON "sessions"("token_hash");

-- CreateIndex
CREATE INDEX "verification_requests_email_purpose_idx" ON "verification_requests"("email", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "cases_reference_code_key" ON "cases"("reference_code");

-- CreateIndex
CREATE INDEX "cases_owner_user_id_idx" ON "cases"("owner_user_id");

-- CreateIndex
CREATE INDEX "cases_type_status_idx" ON "cases"("type", "status");

-- CreateIndex
CREATE INDEX "case_matches_missing_case_id_idx" ON "case_matches"("missing_case_id");

-- CreateIndex
CREATE INDEX "case_matches_found_case_id_idx" ON "case_matches"("found_case_id");

-- CreateIndex
CREATE UNIQUE INDEX "identification_profiles_qr_public_token_key" ON "identification_profiles"("qr_public_token");

-- CreateIndex
CREATE UNIQUE INDEX "identification_profiles_nfc_tag_uid_key" ON "identification_profiles"("nfc_tag_uid");

-- CreateIndex
CREATE UNIQUE INDEX "devices_serial_number_key" ON "devices"("serial_number");

-- CreateIndex
CREATE INDEX "gps_locations_device_id_recorded_at_idx" ON "gps_locations"("device_id", "recorded_at");

-- CreateIndex
CREATE INDEX "location_history_device_id_recorded_at_idx" ON "location_history"("device_id", "recorded_at");

-- CreateIndex
CREATE INDEX "location_history_recorded_at_idx" ON "location_history"("recorded_at");

-- CreateIndex
CREATE UNIQUE INDEX "conversation_participants_conversation_id_user_id_key" ON "conversation_participants"("conversation_id", "user_id");

-- CreateIndex
CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_created_at_idx" ON "notifications"("user_id", "is_read", "created_at");

-- CreateIndex
CREATE INDEX "registered_trackers_owner_email_idx" ON "registered_trackers"("owner_email");

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_images" ADD CONSTRAINT "case_images_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_status_history" ADD CONSTRAINT "case_status_history_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_status_history" ADD CONSTRAINT "case_status_history_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_matches" ADD CONSTRAINT "case_matches_confirmed_by_user_id_fkey" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_matches" ADD CONSTRAINT "case_matches_found_case_id_fkey" FOREIGN KEY ("found_case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_matches" ADD CONSTRAINT "case_matches_missing_case_id_fkey" FOREIGN KEY ("missing_case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identification_profiles" ADD CONSTRAINT "identification_profiles_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identification_emergency_contacts" ADD CONSTRAINT "identification_emergency_contacts_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "identification_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_links" ADD CONSTRAINT "device_links_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_links" ADD CONSTRAINT "device_links_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "identification_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gps_locations" ADD CONSTRAINT "gps_locations_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_events" ADD CONSTRAINT "scan_events_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scan_events" ADD CONSTRAINT "scan_events_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "identification_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_related_case_id_fkey" FOREIGN KEY ("related_case_id") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_requested_by_user_id_fkey" FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_job_candidates" ADD CONSTRAINT "ai_job_candidates_ai_job_id_fkey" FOREIGN KEY ("ai_job_id") REFERENCES "ai_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_job_candidates" ADD CONSTRAINT "ai_job_candidates_candidate_case_id_fkey" FOREIGN KEY ("candidate_case_id") REFERENCES "cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_related_case_id_fkey" FOREIGN KEY ("related_case_id") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "conversation_participants" ADD CONSTRAINT "conversation_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_related_case_id_fkey" FOREIGN KEY ("related_case_id") REFERENCES "cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
