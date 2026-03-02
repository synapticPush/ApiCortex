CREATE TABLE "api_telemetry" (
	"time" timestamp with time zone NOT NULL,
	"org_id" uuid NOT NULL,
	"api_id" uuid,
	"endpoint" text NOT NULL,
	"method" text NOT NULL,
	"status" integer NOT NULL,
	"latency_ms" integer NOT NULL,
	"request_size" integer,
	"response_size" integer
);
--> statement-breakpoint
DROP TABLE "api_metrics_hourly" CASCADE;--> statement-breakpoint
CREATE INDEX "ix_api_telemetry_time" ON "api_telemetry" USING btree ("time");--> statement-breakpoint
CREATE INDEX "ix_api_telemetry_org_id" ON "api_telemetry" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "ix_api_telemetry_api_id" ON "api_telemetry" USING btree ("api_id");