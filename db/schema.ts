import { boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const tasks = pgTable("tasks", {
  id: text("id").primaryKey(),
  assignedTo: text("assigned_to").notNull().references(() => users.id),
  description: text("description").notNull(),
  taskImageKey: text("task_image_key").notNull(),
  responseImageKey: text("response_image_key"),
  responseNotes: text("response_notes").notNull().default(""),
  status: text("status").notNull().default("PENDENTE"),
  priority: text("priority").notNull().default("NORMAL"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  adminFeedback: text("admin_feedback").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Histórico permanente de entregas: não depende da demanda continuar existindo.
export const deliveries = pgTable("deliveries", {
  id: text("id").primaryKey(),
  taskId: text("task_id"),
  userId: text("user_id").notNull().references(() => users.id),
  description: text("description").notNull().default(""),
  priority: text("priority").notNull().default("NORMAL"),
  taskCreatedAt: timestamp("task_created_at", { withTimezone: true }).notNull(),
  dueAt: timestamp("due_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }).defaultNow().notNull(),
  onTime: boolean("on_time"),
  xp: integer("xp").notNull().default(0),
  revoked: boolean("revoked").notNull().default(false),
});
