CREATE TABLE "tasks" (
	"id" text PRIMARY KEY,
	"assigned_to" text NOT NULL,
	"description" text NOT NULL,
	"task_image_key" text NOT NULL,
	"response_image_key" text,
	"response_notes" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'PENDENTE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigned_to_users_id_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id");