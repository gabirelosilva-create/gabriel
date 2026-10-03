import { Blob } from "@netlify/blobs";

const DATA_STORE = "demandas-data";

let store = {
  users: [
    { id: "1", name: "Gabriel", active: true },
    { id: "2", name: "Maria", active: true }
  ],
  tasks: [],
  deliveries: []
};

async function loadStore() {
  try {
    const blob = await Blob.get(DATA_STORE);
    const text = await blob.text();
    store = JSON.parse(text);
  } catch (e) {
    console.log("Inicializando armazenamento padrão");
  }
}

async function saveStore() {
  await Blob.set(DATA_STORE, JSON.stringify(store), {
    metadata: { type: "application/json" }
  });
}

export default async (req, context) => {
  await loadStore();

  if (req.method === "GET") {
    return new Response(JSON.stringify(store), {
      headers: { "Content-Type": "application/json" }
    });
  }

  if (req.method === "POST") {
    const formData = await req.formData();
    const action = formData.get("action");

    if (action === "user") {
      const id = Date.now().toString();
      const name = formData.get("name");
      store.users.push({ id, name, active: true });
      await saveStore();
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    if (action === "task") {
      const id = Date.now().toString();
      const task = {
        id,
        assignedTo: formData.get("assignedTo"),
        description: formData.get("description"),
        priority: formData.get("priority"),
        dueAt: formData.get("dueAt") || null,
        status: "PENDENTE",
        createdAt: new Date().toISOString(),
        adminFeedback: ""
      };
      store.tasks.push(task);
      await saveStore();
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    if (action === "updateTask") {
      const id = formData.get("id");
      const task = store.tasks.find(t => t.id === id);
      if (task) {
        task.description = formData.get("description");
        task.priority = formData.get("priority");
        task.dueAt = formData.get("dueAt") || null;
        task.assignedTo = formData.get("assignedTo");
      }
      await saveStore();
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    if (action === "updateUser") {
      const id = formData.get("id");
      const user = store.users.find(u => u.id === id);
      if (user) {
        user.name = formData.get("name");
        user.active = formData.get("active") === "true";
      }
      await saveStore();
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    if (action === "deliver") {
      const taskId = formData.get("id");
      const task = store.tasks.find(t => t.id === taskId);
      if (task) {
        task.status = "CONCLUÍDO";
        const xpTable = { BAIXA: 60, NORMAL: 100, ALTA: 140, URGENTE: 200 };
        let xp = xpTable[task.priority] || 100;
        const onTime = !task.dueAt || new Date() <= new Date(task.dueAt);
        if (onTime) xp += 50;
        else xp = Math.floor(xp / 2);

        const delivery = {
          taskId,
          userId: task.assignedTo,
          description: task.description,
          priority: task.priority,
          taskCreatedAt: task.createdAt,
          deliveredAt: new Date().toISOString(),
          onTime,
          xp
        };
        store.deliveries.push(delivery);
        store.tasks = store.tasks.filter(t => t.id !== taskId);
      }
      await saveStore();
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    if (action === "feedback") {
      const id = formData.get("id");
      const task = store.tasks.find(t => t.id === id);
      if (task) {
        task.adminFeedback = formData.get("feedback");
      }
      await saveStore();
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    if (action === "reopen") {
      const id = formData.get("id");
      const task = store.tasks.find(t => t.id === id);
      if (task) {
        task.status = "PENDENTE";
        task.adminFeedback = formData.get("feedback");
      }
      await saveStore();
      return new Response(JSON.stringify({ success: true }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ error: "Ação não reconhecida" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  return new Response(JSON.stringify({ error: "Método não permitido" }), {
    status: 405,
    headers: { "Content-Type": "application/json" }
  });
};
