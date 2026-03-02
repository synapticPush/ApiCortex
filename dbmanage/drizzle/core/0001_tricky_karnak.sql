ALTER TABLE "feature_flags" DROP CONSTRAINT "uq_feature_flag_org_key";--> statement-breakpoint
ALTER TABLE "feature_flags" DROP CONSTRAINT "feature_flags_org_id_organizations_id_fk";
--> statement-breakpoint
DROP INDEX "ix_feature_flags_org_id";--> statement-breakpoint
ALTER TABLE "feature_flags" ADD COLUMN "plan" varchar(32) NOT NULL;--> statement-breakpoint
ALTER TABLE "feature_flags" ADD COLUMN "feature_key" varchar(128) NOT NULL;--> statement-breakpoint
ALTER TABLE "feature_flags" ADD COLUMN "limit" integer;--> statement-breakpoint
CREATE INDEX "ix_feature_flags_plan" ON "feature_flags" USING btree ("plan");--> statement-breakpoint
ALTER TABLE "feature_flags" DROP COLUMN "org_id";--> statement-breakpoint
ALTER TABLE "feature_flags" DROP COLUMN "key";--> statement-breakpoint
ALTER TABLE "feature_flags" ADD CONSTRAINT "uq_feature_flag_plan_feature" UNIQUE("plan","feature_key");