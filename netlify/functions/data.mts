import type { Config } from "@netlify/functions";
import { getStore } from "@netlify/blobs";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { deliveries, tasks, users } from "../../db/schema.js";

const uploads = () => getStore({ name: "demand-images", consistency: "strong" });
const json = (value: unknown, status = 200) => Response.json(value, { status });
const PRIORITIES = ["BAIXA", "NORMAL", "ALTA", "URGENTE"];
const parsePriority = (value: FormDataEntryValue | null) => {
  const priority = String(value || "NORMAL").toUpperCase();
  return PRIORITIES.includes(priority) ? priority : "NORMAL";
};
const BASE_XP: Record<string, number> = { BAIXA: 60, NORMAL: 100, ALTA: 140, URGENTE: 200 };
// XP por entrega: base pela prioridade, +50 se no prazo, metade se atrasada.
const deliveryXp = (priority: string, onTime: boolean | null) => {
  const base = BASE_XP[priority] ?? 100;
  if (onTime === true) return base + 50;
  if (onTime === false) return Math.round(base / 2);
  return base;
};
const parseDate = (value: FormDataEntryValue | null) => {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
};

export default async (request: Request) => {
  try {
    if (request.method === "GET") {
      let allUsers = await db.select().from(users).orderBy(users.name);
      if (allUsers.length === 0) {
        await db.insert(users).values([
          { id: crypto.randomUUID(), name: "João Lucas" },
          { id: crypto.randomUUID(), name: "Pedro Henrique" },
        ]);
        allUsers = await db.select().from(users).orderBy(users.name);
      }

      const allTasks = await db.select().from(tasks).orderBy(desc(tasks.createdAt));
      const allDeliveries = await db.select().from(deliveries)
        .where(eq(deliveries.revoked, false)).orderBy(desc(deliveries.deliveredAt));
      return json({
        users: allUsers,
        deliveries: allDeliveries.map((d) => ({
          ...d,
          taskCreatedAt: d.taskCreatedAt.toISOString(),
          dueAt: d.dueAt ? d.dueAt.toISOString() : null,
          deliveredAt: d.deliveredAt.toISOString(),
        })),
        tasks: allTasks.map((task) => ({
          ...task,
          createdAt: task.createdAt.toISOString(),
          dueAt: task.dueAt ? task.dueAt.toISOString() : null,
          completedAt: task.completedAt ? task.completedAt.toISOString() : null,
          taskImage: `/api/images/${task.taskImageKey}`,
          responseImage: task.responseImageKey ? `/api/images/${task.responseImageKey}` : null,
        })),
      });
    }

    if (request.method === "POST") {
      const form = await request.formData();
      const action = String(form.get("action") || "");

      if (action === "user") {
        const name = String(form.get("name") || "").trim();
        if (!name) return json({ error: "Informe o nome." }, 400);
        const [created] = await db.insert(users).values({ id: crypto.randomUUID(), name }).returning();
        return json(created, 201);
      }

      if (action === "task") {
        const assignedTo = String(form.get("assignedTo") || "");
        const description = String(form.get("description") || "").trim();
        const image = form.get("image");
        if (!assignedTo || !description || !(image instanceof File) || !image.size) {
          return json({ error: "Preencha a descrição e selecione uma foto." }, 400);
        }
        const imageKey = crypto.randomUUID();
        await uploads().set(imageKey, image);
        const [created] = await db.insert(tasks).values({
          id: crypto.randomUUID(), assignedTo, description, taskImageKey: imageKey,
          priority: parsePriority(form.get("priority")), dueAt: parseDate(form.get("dueAt")),
        }).returning();
        return json(created, 201);
      }

      if (action === "response") {
        const id = String(form.get("id") || "");
        const notes = String(form.get("notes") || "").trim();
        const image = form.get("image");
        if (!id || !(image instanceof File) || !image.size) {
          return json({ error: "Selecione uma foto da devolutiva." }, 400);
        }
        const [existing] = await db.select().from(tasks).where(eq(tasks.id, id));
        if (!existing) return json({ error: "Demanda não encontrada." }, 404);
        const imageKey = crypto.randomUUID();
        await uploads().set(imageKey, image);
        const completedAt = new Date();
        const [updated] = await db.update(tasks).set({
          responseImageKey: imageKey, responseNotes: notes, status: "CONCLUÍDO", completedAt,
        }).where(eq(tasks.id, id)).returning();
        if (existing.status !== "CONCLUÍDO") {
          const onTime = existing.dueAt ? completedAt <= existing.dueAt : null;
          await db.insert(deliveries).values({
            id: crypto.randomUUID(), taskId: id, userId: existing.assignedTo, description: existing.description,
            priority: existing.priority, taskCreatedAt: existing.createdAt, dueAt: existing.dueAt,
            deliveredAt: completedAt, onTime, xp: deliveryXp(existing.priority, onTime),
          });
        }
        if (existing.responseImageKey) await uploads().delete(existing.responseImageKey);
        return json(updated);
      }

      if (action === "updateTask") {
        const id = String(form.get("id") || "");
        const assignedTo = String(form.get("assignedTo") || "");
        const description = String(form.get("description") || "").trim();
        if (!id || !assignedTo || !description) return json({ error: "Preencha a descrição e o responsável." }, 400);
        const [updated] = await db.update(tasks).set({
          assignedTo, description, priority: parsePriority(form.get("priority")), dueAt: parseDate(form.get("dueAt")),
        }).where(eq(tasks.id, id)).returning();
        if (!updated) return json({ error: "Demanda não encontrada." }, 404);
        return json(updated);
      }

      if (action === "reopen") {
        const id = String(form.get("id") || "");
        const feedback = String(form.get("feedback") || "").trim();
        if (!id) return json({ error: "Demanda não informada." }, 400);
        const [updated] = await db.update(tasks).set({
          status: "PENDENTE", completedAt: null, adminFeedback: feedback,
        }).where(eq(tasks.id, id)).returning();
        if (!updated) return json({ error: "Demanda não encontrada." }, 404);
        // Entrega reprovada deixa de contar no rendimento e no XP.
        await db.update(deliveries).set({ revoked: true })
          .where(and(eq(deliveries.taskId, id), eq(deliveries.revoked, false)));
        return json(updated);
      }

      if (action === "feedback") {
        const id = String(form.get("id") || "");
        if (!id) return json({ error: "Demanda não informada." }, 400);
        const [updated] = await db.update(tasks).set({
          adminFeedback: String(form.get("feedback") || "").trim(),
        }).where(eq(tasks.id, id)).returning();
        if (!updated) return json({ error: "Demanda não encontrada." }, 404);
        return json(updated);
      }

      if (action === "updateUser") {
        const id = String(form.get("id") || "");
        const name = String(form.get("name") || "").trim();
        if (!id || !name) return json({ error: "Informe o nome." }, 400);
        const [updated] = await db.update(users).set({
          name, active: String(form.get("active") ?? "true") !== "false",
        }).where(eq(users.id, id)).returning();
        if (!updated) return json({ error: "Menor não encontrado." }, 404);
        return json(updated);
      }

      return json({ error: "Ação inválida." }, 400);
    }

    if (request.method === "DELETE") {
      const id = request.headers.get("X-Task-Id");
      if (!id) return json({ error: "Demanda não informada." }, 400);
      const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
      if (!task) return json({ error: "Demanda não encontrada." }, 404);
      await db.delete(tasks).where(eq(tasks.id, id));
      await uploads().delete(task.taskImageKey);
      if (task.responseImageKey) await uploads().delete(task.responseImageKey);
      return new Response(null, { status: 204 });
    }

    return json({ error: "Método não permitido." }, 405);
  } catch (error) {
    console.error("Demand data operation failed", error);
    return json({ error: "Não foi possível concluir a operação. Tente novamente." }, 500);
  }
};

export const config: Config = { path: "/api/data" };
