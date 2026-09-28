-- Non-destructive schema reconciliation for outcome learning.
-- This migration intentionally preserves the legacy channels.video_ideas and
-- channels.saved_ideas columns so existing customer data remains recoverable.

CREATE TABLE IF NOT EXISTS "credit_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "public"."users"("id") ON DELETE cascade,
	"amount" integer NOT NULL,
	"action" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "credits" integer DEFAULT 20 NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tier" text DEFAULT 'free' NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ls_customer_id" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ls_subscription_id" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ls_order_id" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "razorpay_customer_id" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "razorpay_subscription_id" text;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "razorpay_order_id" text;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "idea_vault" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL REFERENCES "public"."channels"("id") ON DELETE cascade,
	"title" text NOT NULL,
	"hook" text,
	"format" text,
	"target_audience" text,
	"status" text DEFAULT 'backlog' NOT NULL,
	"estimated_view_potential" text,
	"source" text NOT NULL,
	"reference_id" text,
	"why_it_works" text,
	"script" text,
	"description" text,
	"tags" jsonb,
	"opportunity_score_at_recommendation" real,
	"confidence_at_recommendation" real,
	"recommendation_signals" jsonb,
	"recommended_at" timestamp,
	"scoring_version" text,
	"youtube_video_id" text,
	"published_at" timestamp,
	"outcome_multipliers" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "idea_vault" ADD COLUMN IF NOT EXISTS "opportunity_score_at_recommendation" real;
--> statement-breakpoint
ALTER TABLE "idea_vault" ADD COLUMN IF NOT EXISTS "confidence_at_recommendation" real;
--> statement-breakpoint
ALTER TABLE "idea_vault" ADD COLUMN IF NOT EXISTS "recommendation_signals" jsonb;
--> statement-breakpoint
ALTER TABLE "idea_vault" ADD COLUMN IF NOT EXISTS "recommended_at" timestamp;
--> statement-breakpoint
ALTER TABLE "idea_vault" ADD COLUMN IF NOT EXISTS "scoring_version" text;
--> statement-breakpoint
ALTER TABLE "idea_vault" ADD COLUMN IF NOT EXISTS "youtube_video_id" text;
--> statement-breakpoint
ALTER TABLE "idea_vault" ADD COLUMN IF NOT EXISTS "published_at" timestamp;
--> statement-breakpoint
ALTER TABLE "idea_vault" ADD COLUMN IF NOT EXISTS "outcome_multipliers" jsonb;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "baseline_performance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL REFERENCES "public"."channels"("id") ON DELETE cascade,
	"vault_idea_id" uuid REFERENCES "public"."idea_vault"("id") ON DELETE cascade,
	"target_video_id" text,
	"computed_at" timestamp DEFAULT now() NOT NULL,
	"day1_median_views" integer,
	"day7_median_views" integer,
	"day30_median_views" integer,
	"sample_size" integer NOT NULL,
	"baseline_video_ids" jsonb,
	"confidence" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "video_performance_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vault_idea_id" uuid NOT NULL REFERENCES "public"."idea_vault"("id") ON DELETE cascade,
	"youtube_video_id" text NOT NULL,
	"snapshot_type" text NOT NULL,
	"recorded_at" timestamp DEFAULT now() NOT NULL,
	"actual_views" integer NOT NULL,
	"baseline_views_at_time" integer,
	"performance_multiplier" real
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "baseline_channel_idx" ON "baseline_performance" USING btree ("channel_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unique_baseline_vault_target" ON "baseline_performance" USING btree ("vault_idea_id", "target_video_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vault_channel_idx" ON "idea_vault" USING btree ("channel_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vault_status_idx" ON "idea_vault" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vault_source_idx" ON "idea_vault" USING btree ("source");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vault_yt_id_idx" ON "idea_vault" USING btree ("youtube_video_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "snapshot_vault_idx" ON "video_performance_snapshots" USING btree ("vault_idea_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "snapshot_yt_id_idx" ON "video_performance_snapshots" USING btree ("youtube_video_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unique_video_snapshot_idx" ON "video_performance_snapshots" USING btree ("youtube_video_id", "snapshot_type");
