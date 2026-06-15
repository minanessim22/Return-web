-- CreateTable
CREATE TABLE "found_reports" (
    "id" UUID NOT NULL,
    "profile_id" UUID NOT NULL,
    "scan_event_id" UUID,
    "finder_latitude" DOUBLE PRECISION,
    "finder_longitude" DOUBLE PRECISION,
    "finder_location_text" TEXT,
    "notified_owner" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "found_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "found_reports_profile_id_idx" ON "found_reports"("profile_id");

-- AddForeignKey
ALTER TABLE "found_reports" ADD CONSTRAINT "found_reports_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "identification_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
