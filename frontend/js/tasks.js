import { db } from "./firebase.js";
import {
  ref, push, set, update, remove, onValue, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";
import {
  escapeHTML,
  formatDate,
  showMessage,
  recordsFrom,
  isTaskOverdue,
  statusBadge
} from "./app.js";

let tasks = [];
let editingId = null;

export function initTasks() {
  document.addEventListener("userReady", ({ detail }) => {
    const user = detail.user;
    const content = document.getElementById("pageContent");
    const taskPath = `tasks/${user.uid}`;

    content.innerHTML = `
      <div class="page-header">
        <div>
          <h2>Learning Tasks</h2>
          <p class="muted">Create, update, complete, search and manage your tasks.</p>
        </div>
        <button class="btn primary" id="newTaskBtn">+ New Task</button>
      </div>

      <div id="taskMessage" class="message hidden"></div>

      <section class="card">
        <div class="toolbar">
          <input id="taskSearch" type="search" placeholder="Search title or description...">
          <select id="statusFilter">
            <option value="">All statuses</option>
            <option>Pending</option>
            <option>In Progress</option>
            <option>Completed</option>
          </select>
          <select id="priorityFilter">
            <option value="">All priorities</option>
            <option>Low</option>
            <option>Medium</option>
            <option>High</option>
          </select>
        </div>
        <div id="taskList" class="task-list"></div>
      </section>

      <div id="taskModal" class="modal-backdrop hidden">
        <div class="modal">
          <div class="modal-head">
            <h3 id="modalTitle">New Task</h3>
            <button class="close" id="closeModal">&times;</button>
          </div>
          <form id="taskForm" class="form-grid">
            <label class="full-span">Task title
              <input id="taskTitle" maxlength="150" required>
            </label>
            <label class="full-span">Description
              <textarea id="taskDescription" maxlength="1000" required></textarea>
            </label>
            <label>Category
              <input id="taskCategory" maxlength="80" required placeholder="e.g. JavaScript">
            </label>
            <label>Priority
              <select id="taskPriority" required>
                <option>Low</option><option selected>Medium</option><option>High</option>
              </select>
            </label>
            <label>Due date
              <input id="taskDueDate" type="date" required>
            </label>
            <label>Status
              <select id="taskStatus" required>
                <option>Pending</option><option>In Progress</option><option>Completed</option>
              </select>
            </label>
            <div class="actions full-span">
              <button class="btn secondary" type="button" id="cancelTask">Cancel</button>
              <button class="btn primary" type="submit">Save Task</button>
            </div>
          </form>
        </div>
      </div>
    `;

    const modal = document.getElementById("taskModal");
    const openModal = (task = null) => {
      editingId = task?.id || null;
      document.getElementById("modalTitle").textContent = editingId ? "Edit Task" : "New Task";
      document.getElementById("taskTitle").value = task?.title || "";
      document.getElementById("taskDescription").value = task?.description || "";
      document.getElementById("taskCategory").value = task?.category || "";
      document.getElementById("taskPriority").value = task?.priority || "Medium";
      document.getElementById("taskDueDate").value = task?.dueDate || "";
      document.getElementById("taskStatus").value = task?.status || "Pending";
      modal.classList.remove("hidden");
    };
    const closeModal = () => {
      modal.classList.add("hidden");
      editingId = null;
    };

    document.getElementById("newTaskBtn").addEventListener("click", () => openModal());
    document.getElementById("closeModal").addEventListener("click", closeModal);
    document.getElementById("cancelTask").addEventListener("click", closeModal);
    document.getElementById("taskSearch").addEventListener("input", renderTasks);
    document.getElementById("statusFilter").addEventListener("change", renderTasks);
    document.getElementById("priorityFilter").addEventListener("change", renderTasks);

    document.getElementById("taskForm").addEventListener("submit", async event => {
      event.preventDefault();
      const data = {
        title: document.getElementById("taskTitle").value.trim(),
        description: document.getElementById("taskDescription").value.trim(),
        category: document.getElementById("taskCategory").value.trim(),
        priority: document.getElementById("taskPriority").value,
        dueDate: document.getElementById("taskDueDate").value,
        status: document.getElementById("taskStatus").value
      };

      try {
        if (editingId) {
          await update(ref(db, `${taskPath}/${editingId}`), {
            ...data,
            updatedAt: serverTimestamp()
          });
          showMessage(document.getElementById("taskMessage"), "Task updated successfully.", "success");
        } else {
          const taskRef = push(ref(db, taskPath));
          await set(taskRef, {
            ...data,
            userId: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          });
          showMessage(document.getElementById("taskMessage"), "Task created successfully.", "success");
        }
        closeModal();
      } catch (error) {
        console.error(error);
        showMessage(document.getElementById("taskMessage"), "Could not save the task. Check your Firebase rules/configuration.", "error");
      }
    });

    onValue(ref(db, taskPath), snapshot => {
      tasks = recordsFrom(snapshot);
      renderTasks();
    });

    document.getElementById("taskList").addEventListener("click", async event => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const id = button.dataset.id;
      const task = tasks.find(t => t.id === id);
      if (!task) return;

      if (button.dataset.action === "edit") {
        openModal(task);
      }

      if (button.dataset.action === "delete") {
        if (!confirm(`Delete "${task.title}"? This action cannot be undone.`)) return;
        try {
          await remove(ref(db, `${taskPath}/${id}`));
          showMessage(document.getElementById("taskMessage"), "Task deleted successfully.", "success");
        } catch (error) {
          console.error(error);
          showMessage(document.getElementById("taskMessage"), "Task deletion failed.", "error");
        }
      }

      if (button.dataset.action === "toggle") {
        try {
          await update(ref(db, `${taskPath}/${id}`), {
            status: task.status === "Completed" ? "Pending" : "Completed",
            updatedAt: serverTimestamp()
          });
        } catch (error) {
          console.error(error);
          showMessage(document.getElementById("taskMessage"), "Could not update task status.", "error");
        }
      }
    });
  });
}

function renderTasks() {
  const list = document.getElementById("taskList");
  if (!list) return;

  const search = (document.getElementById("taskSearch")?.value || "").toLowerCase();
  const status = document.getElementById("statusFilter")?.value || "";
  const priority = document.getElementById("priorityFilter")?.value || "";

  const filtered = tasks.filter(task => {
    const haystack = `${task.title} ${task.description} ${task.category}`.toLowerCase();
    return (!search || haystack.includes(search))
      && (!status || task.status === status)
      && (!priority || task.priority === priority);
  });

  list.innerHTML = filtered.length ? filtered.map(task => {
    const overdue = isTaskOverdue(task);
    return `
    <article class="item">
      <div class="item-head">
        <div>
          <h3>${escapeHTML(task.title)}</h3>
          <p class="muted">${escapeHTML(task.description)}</p>
        </div>
        <span class="badge ${overdue ? "danger" : statusBadge(task.status)}">
          ${overdue ? "Overdue" : escapeHTML(task.status)}
        </span>
      </div>
      <div class="meta">
        <span>Category: ${escapeHTML(task.category)}</span>
        <span>Priority: ${escapeHTML(task.priority)}</span>
        <span>Due: ${formatDate(task.dueDate)}</span>
        ${task.assignedByName ? `<span>Assigned by ${escapeHTML(task.assignedByName)}</span>` : ""}
      </div>
      <div class="actions">
        <button class="btn small success" data-action="toggle" data-id="${task.id}">
          ${task.status === "Completed" ? "Mark Pending" : "Complete"}
        </button>
        <button class="btn small secondary" data-action="edit" data-id="${task.id}">Edit</button>
        <button class="btn small danger" data-action="delete" data-id="${task.id}">Delete</button>
      </div>
    </article>
  `;
  }).join("") : `<div class="empty">No matching tasks found.</div>`;
}
