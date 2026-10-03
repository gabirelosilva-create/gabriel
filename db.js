// Simulação de backend em LocalStorage para funcionar sem servidor
class DataStore {
  constructor() {
    this.data = this.loadData();
  }

  loadData() {
    const stored = localStorage.getItem('demandas-data');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error('Erro ao carregar dados:', e);
      }
    }
    return {
      users: [
        { id: '1', name: 'Gabriel', active: true },
        { id: '2', name: 'Maria', active: true }
      ],
      tasks: [],
      deliveries: []
    };
  }

  save() {
    localStorage.setItem('demandas-data', JSON.stringify(this.data));
  }

  getAll() {
    return this.data;
  }

  addUser(name) {
    const id = Date.now().toString();
    this.data.users.push({ id, name, active: true });
    this.save();
  }

  addTask(assignedTo, description, priority, dueAt) {
    const id = Date.now().toString();
    this.data.tasks.push({
      id,
      assignedTo,
      description,
      priority,
      dueAt: dueAt || null,
      status: 'PENDENTE',
      createdAt: new Date().toISOString(),
      adminFeedback: ''
    });
    this.save();
  }

  updateTask(id, assignedTo, description, priority, dueAt) {
    const task = this.data.tasks.find(t => t.id === id);
    if (task) {
      task.assignedTo = assignedTo;
      task.description = description;
      task.priority = priority;
      task.dueAt = dueAt || null;
      this.save();
    }
  }

  updateUser(id, name, active) {
    const user = this.data.users.find(u => u.id === id);
    if (user) {
      user.name = name;
      user.active = active;
      this.save();
    }
  }

  deliverTask(taskId) {
    const task = this.data.tasks.find(t => t.id === taskId);
    if (task) {
      const xpTable = { BAIXA: 60, NORMAL: 100, ALTA: 140, URGENTE: 200 };
      let xp = xpTable[task.priority] || 100;
      const onTime = !task.dueAt || new Date() <= new Date(task.dueAt);
      if (onTime) xp += 50;
      else xp = Math.floor(xp / 2);

      this.data.deliveries.push({
        taskId,
        userId: task.assignedTo,
        description: task.description,
        priority: task.priority,
        taskCreatedAt: task.createdAt,
        deliveredAt: new Date().toISOString(),
        onTime,
        xp
      });
      this.data.tasks = this.data.tasks.filter(t => t.id !== taskId);
      this.save();
    }
  }

  setFeedback(id, feedback) {
    const task = this.data.tasks.find(t => t.id === id);
    if (task) {
      task.adminFeedback = feedback;
      this.save();
    }
  }

  reopenTask(id, feedback) {
    const task = this.data.tasks.find(t => t.id === id);
    if (task) {
      task.status = 'PENDENTE';
      task.adminFeedback = feedback;
      this.save();
    }
  }
}

const dbStore = new DataStore();

// Interceptar chamadas para /api/data
window.apiRequest = async function(options = {}) {
  if (options.method === 'POST') {
    const formData = await options.body;
    const action = formData.get('action');

    if (action === 'user') {
      dbStore.addUser(formData.get('name'));
      return null;
    }

    if (action === 'task') {
      dbStore.addTask(
        formData.get('assignedTo'),
        formData.get('description'),
        formData.get('priority'),
        formData.get('dueAt')
      );
      return null;
    }

    if (action === 'updateTask') {
      dbStore.updateTask(
        formData.get('id'),
        formData.get('assignedTo'),
        formData.get('description'),
        formData.get('priority'),
        formData.get('dueAt')
      );
      return null;
    }

    if (action === 'updateUser') {
      dbStore.updateUser(
        formData.get('id'),
        formData.get('name'),
        formData.get('active') === 'true'
      );
      return null;
    }

    if (action === 'deliver') {
      dbStore.deliverTask(formData.get('id'));
      return null;
    }

    if (action === 'feedback') {
      dbStore.setFeedback(formData.get('id'), formData.get('feedback'));
      return null;
    }

    if (action === 'reopen') {
      dbStore.reopenTask(formData.get('id'), formData.get('feedback'));
      return null;
    }
  }

  return dbStore.getAll();
};
