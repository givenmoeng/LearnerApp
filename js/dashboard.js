import { auth, db } from "./firebase.js";
import {
  ref, onValue
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";
import { escapeHTML, formatDate } from "./app.js";

export function initDashboard() {
  document.addEventListener("userReady", ({ detail }) => {
    const { user, profile } = detail;
    const content = document.getElementById("pageContent");

    content.innerHTML = `
      <div class="page-header">
        <div>
          <h2>Welcome, ${escapeHTML(profile.name)}</h2>
          <p class="muted">Here is an overview of your learning activity.</p>
        </div>
        <button class="btn secondary no-print" id="printProgress">Print Progress</button>
      </div>

      <div class="grid stats">
        <div class="card"><div class="stat-label">Total Tasks</div><div class="stat-value" id="totalTasks">0</div></div>
        <div class="card"><div class="stat-label">Completed</div><div class="stat-value" id="completedTasks">0</div></div>
        <div class="card"><div class="stat-label">Outstanding</div><div class="stat-value" id="outstandingTasks">0</div></div>
        <div class="card"><div class="stat-label">Overdue</div><div class="stat-value" id="overdueTasks">0</div></div>
      </div>

      <div class="grid" style="margin-top:18px;">
        <section class="card">
          <div class="page-header">
            <div>
              <h3>Overall Progress</h3>
              <p class="muted">Calculated from your actual task data.</p>
            </div>
            <strong id="progressPercent">0%</strong>
          </div>
          <div class="progress-track"><div class="progress-fill" id="progressFill" style="width:0%"></div></div>
        </section>

        <section class="card">
          <h3>Recent Tasks</h3>
          <div id="recentTasks" class="task-list"></div>
        </section>
      </div>
    `;

    document.getElementById("printProgress").addEventListener("click", () => window.print());

    onValue(ref(db, "tasks"), snapshot => {
      const all = snapshot.val() || {};
      const tasks = Object.entries(all)
        .map(([id, task]) => ({ id, ...task }))
        .filter(task => task.userId === user.uid);

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const completed = tasks.filter(t => t.status === "Completed").length;
      const outstanding = tasks.length - completed;
      const overdue = tasks.filter(t => {
        if (t.status === "Completed" || !t.dueDate) return false;
        const d = new Date(`${t.dueDate}T23:59:59`);
        return d < today;
      }).length;

      const progress = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;

      document.getElementById("totalTasks").textContent = tasks.length;
      document.getElementById("completedTasks").textContent = completed;
      document.getElementById("outstandingTasks").textContent = outstanding;
      document.getElementById("overdueTasks").textContent = overdue;
      document.getElementById("progressPercent").textContent = `${progress}%`;
      document.getElementById("progressFill").style.width = `${progress}%`;

      const recent = tasks
        .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
        .slice(0, 5);

      document.getElementById("recentTasks").innerHTML = recent.length
        ? recent.map(task => `
          <div class="item">
            <div class="item-head">
              <h3>${escapeHTML(task.title)}</h3>
              <span class="badge ${task.status === "Completed" ? "success" : ""}">${escapeHTML(task.status)}</span>
            </div>
            <div class="meta">
              <span>${escapeHTML(task.category)}</span>
              <span>Priority: ${escapeHTML(task.priority)}</span>
              <span>Due: ${formatDate(task.dueDate)}</span>
            </div>
          </div>
        `).join("")
        : `<div class="empty">No tasks yet. Create your first learning task.</div>`;
    });
  });
}
