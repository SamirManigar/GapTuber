CREATE TABLE "bot_chats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"channel_id" uuid,
	"title" text DEFAULT 'New Chat' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bot_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" uuid NOT NULL,
	"sender" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"category" text,
	"topic" text,
	"branding_data" jsonb,
	"youtube_channel_id" text,
	"youtube_access_token" text,
	"youtube_refresh_token" text,
	"youtube_token_expires_at" timestamp,
	"video_ideas" jsonb,
	"saved_ideas" jsonb,
	"content_strategy" text,
	"market_snapshot" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competitor_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"monitor_id" uuid NOT NULL,
	"video_id" text NOT NULL,
	"title" text NOT NULL,
	"thumbnail" text,
	"views" text NOT NULL,
	"published_at" timestamp NOT NULL,
	"analysis" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competitor_monitors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"competitor_channel_id" text NOT NULL,
	"competitor_name" text NOT NULL,
	"competitor_handle" text NOT NULL,
	"competitor_image" text,
	"last_scanned_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"keyword" text NOT NULL,
	"competitors" jsonb NOT NULL,
	"raw_data" jsonb,
	"result" jsonb,
	"analytics" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "bot_chats" ADD CONSTRAINT "bot_chats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_chats" ADD CONSTRAINT "bot_chats_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bot_messages" ADD CONSTRAINT "bot_messages_chat_id_bot_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."bot_chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_insights" ADD CONSTRAINT "competitor_insights_monitor_id_competitor_monitors_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."competitor_monitors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "competitor_monitors" ADD CONSTRAINT "competitor_monitors_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scans" ADD CONSTRAINT "scans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bot_chat_user_idx" ON "bot_chats" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bot_chat_channel_idx" ON "bot_chats" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "bot_msg_chat_idx" ON "bot_messages" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "channel_user_idx" ON "channels" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "comp_insight_monitor_idx" ON "competitor_insights" USING btree ("monitor_id");--> statement-breakpoint
CREATE INDEX "comp_monitor_channel_idx" ON "competitor_monitors" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "scan_channel_idx" ON "scans" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "scan_user_idx" ON "scans" USING btree ("user_id");