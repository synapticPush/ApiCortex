CREATE TABLE "apis" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"base_url" varchar(1024) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contracts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"endpoint_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"schema_hash" varchar(128) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"path" varchar(1024) NOT NULL,
	"method" varchar(16) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_endpoint_api_path_method" UNIQUE("api_id","path","method")
);
--> statement-breakpoint
CREATE TABLE "feature_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"key" varchar(128) NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_feature_flag_org_key" UNIQUE("org_id","key")
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"type" varchar(64) NOT NULL,
	"payload" jsonb NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memberships" (
	"user_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"role" varchar(32) DEFAULT 'owner' NOT NULL,
	CONSTRAINT "pk_memberships" PRIMARY KEY("user_id","org_id")
);
--> statement-breakpoint
CREATE TABLE "openapi_specs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"version" varchar(64) NOT NULL,
	"raw_spec" jsonb NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_openapi_api_version" UNIQUE("api_id","version")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"plan" varchar(32) DEFAULT 'free' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"name" varchar(255) NOT NULL,
	"provider" varchar(32) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_users_email" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "apis" ADD CONSTRAINT "apis_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_endpoint_id_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."endpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contracts" ADD CONSTRAINT "contracts_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "endpoints" ADD CONSTRAINT "endpoints_api_id_apis_id_fk" FOREIGN KEY ("api_id") REFERENCES "public"."apis"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "endpoints" ADD CONSTRAINT "endpoints_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feature_flags" ADD CONSTRAINT "feature_flags_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "openapi_specs" ADD CONSTRAINT "openapi_specs_api_id_apis_id_fk" FOREIGN KEY ("api_id") REFERENCES "public"."apis"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "openapi_specs" ADD CONSTRAINT "openapi_specs_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ix_apis_org_id" ON "apis" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "ix_contracts_endpoint_id" ON "contracts" USING btree ("endpoint_id");--> statement-breakpoint
CREATE INDEX "ix_contracts_org_id" ON "contracts" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "ix_endpoints_api_id" ON "endpoints" USING btree ("api_id");--> statement-breakpoint
CREATE INDEX "ix_endpoints_org_id" ON "endpoints" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "ix_feature_flags_org_id" ON "feature_flags" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "ix_jobs_org_id" ON "jobs" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "ix_openapi_specs_api_id" ON "openapi_specs" USING btree ("api_id");--> statement-breakpoint
CREATE INDEX "ix_openapi_specs_org_id" ON "openapi_specs" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "ix_users_email" ON "users" USING btree ("email");