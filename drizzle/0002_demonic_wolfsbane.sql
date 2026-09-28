CREATE TABLE "metric_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"video_id" text NOT NULL,
	"views" integer NOT NULL,
	"likes" integer NOT NULL,
	"comments" integer NOT NULL,
	"captured_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outlier_detections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"search_run_id" uuid,
	"video_id" varchar(255) NOT NULL,
	"keyword" varchar(255) NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"relevance_score" real NOT NULL,
	"pace_percentile" real NOT NULL,
	"channel_lift" real NOT NULL,
	"classification" varchar(50) NOT NULL,
	"engine_version" varchar(50) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracked_videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" varchar(255) NOT NULL,
	"first_detected_at" timestamp with time zone NOT NULL,
	"tracking_started_at" timestamp with time zone NOT NULL,
	"tracking_expires_at" timestamp with time zone NOT NULL,
	"status" varchar(50) NOT NULL,
	"priority" varchar(50) NOT NULL,
	"last_snapshot_at" timestamp with time zone,
	"next_snapshot_at" timestamp with time zone,
	"detection_reason" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tracked_videos_video_id_unique" UNIQUE("video_id")
);
--> statement-breakpoint
CREATE TABLE "video_metric_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tracking_id" uuid NOT NULL,
	"video_id" varchar(255) NOT NULL,
	"target_offset_hours" real NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"views" bigint NOT NULL,
	"likes" bigint,
	"comments" bigint,
	"capture_trigger" varchar(50),
	"collector_version" varchar(50) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "snapshot_tracking_offset_idx" UNIQUE("tracking_id","target_offset_hours")
);
--> statement-breakpoint
ALTER TABLE "outlier_detections" ADD CONSTRAINT "outlier_detections_search_run_id_scans_id_fk" FOREIGN KEY ("search_run_id") REFERENCES "public"."scans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_metric_snapshots" ADD CONSTRAINT "video_metric_snapshots_tracking_id_tracked_videos_id_fk" FOREIGN KEY ("tracking_id") REFERENCES "public"."tracked_videos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "detection_video_idx" ON "outlier_detections" USING btree ("video_id");--> statement-breakpoint
CREATE INDEX "detection_search_idx" ON "outlier_detections" USING btree ("search_run_id");--> statement-breakpoint
CREATE INDEX "snapshot_video_idx" ON "video_metric_snapshots" USING btree ("video_id");--> statement-breakpoint
CREATE INDEX "snapshot_time_idx" ON "video_metric_snapshots" USING btree ("captured_at");