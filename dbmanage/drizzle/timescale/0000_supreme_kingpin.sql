CREATE TABLE "api_metrics_hourly" (
	"org_id" uuid NOT NULL,
	"bucket" timestamp with time zone NOT NULL,
	"latency_ms" double precision DEFAULT 0 NOT NULL,
	"error_rate" double precision DEFAULT 0 NOT NULL,
	"request_count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "pk_api_metrics_hourly" PRIMARY KEY("org_id","bucket")
);
--> statement-breakpoint
CREATE INDEX "ix_api_metrics_hourly_org_id" ON "api_metrics_hourly" USING btree ("org_id");