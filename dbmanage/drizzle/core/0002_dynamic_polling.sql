ALTER TABLE "endpoints" ADD COLUMN IF NOT EXISTS "monitoring_enabled" boolean NOT NULL DEFAULT true;--> statement-breakpoint
ALTER TABLE "endpoints" ADD COLUMN IF NOT EXISTS "poll_interval_seconds" integer;--> statement-breakpoint
ALTER TABLE "endpoints" ADD COLUMN IF NOT EXISTS "timeout_ms" integer;--> statement-breakpoint
ALTER TABLE "endpoints" ADD COLUMN IF NOT EXISTS "poll_headers_json" jsonb;--> statement-breakpoint
ALTER TABLE "endpoints" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone NOT NULL DEFAULT now();--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ix_endpoints_monitoring_enabled" ON "endpoints" USING btree ("monitoring_enabled");