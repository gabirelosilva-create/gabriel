CREATE TABLE "deliveries" (
	"id" text PRIMARY KEY,
	"task_id" text,
	"user_id" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"priority" text DEFAULT 'NORMAL' NOT NULL,
	"task_created_at" timestamp with time zone NOT NULL,
	"due_at" timestamp with time zone,
	"delivered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"on_time" boolean,
	"xp" integer DEFAULT 0 NOT NULL,
	"revoked" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");--> statement-breakpoint
INSERT INTO "deliveries" ("id", "task_id", "user_id", "description", "priority", "task_created_at", "due_at", "delivered_at", "on_time", "xp")
SELECT
	'legacy-' || t."id",
	t."id",
	t."assigned_to",
	t."description",
	t."priority",
	t."created_at",
	t."due_at",
	COALESCE(t."completed_at", t."created_at"),
	CASE WHEN t."due_at" IS NULL OR t."completed_at" IS NULL THEN NULL ELSE t."completed_at" <= t."due_at" END,
	(CASE t."priority" WHEN 'BAIXA' THEN 60 WHEN 'ALTA' THEN 140 WHEN 'URGENTE' THEN 200 ELSE 100 END)
	+ (CASE WHEN t."due_at" IS NOT NULL AND t."completed_at" IS NOT NULL AND t."completed_at" <= t."due_at" THEN 50 ELSE 0 END)
	- (CASE WHEN t."due_at" IS NOT NULL AND t."completed_at" IS NOT NULL AND t."completed_at" > t."due_at" THEN (CASE t."priority" WHEN 'BAIXA' THEN 30 WHEN 'ALTA' THEN 70 WHEN 'URGENTE' THEN 100 ELSE 50 END) ELSE 0 END)
FROM "tasks" t
WHERE t."status" = 'CONCLUÍDO'
ON CONFLICT ("id") DO NOTHING;
