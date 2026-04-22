ALTER TABLE "endpoints" ALTER COLUMN "provider_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "providers_name_idx" ON "providers" ("name");