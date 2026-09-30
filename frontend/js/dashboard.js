import { db } from "./firebase.js";
import {
  ref, onValue
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";
import {
  escapeHTML,
  formatDate,
  recordsFrom,
  isTaskOverdue,
  todayISODate,
  statusBadge
} from "./app.js";

export function initDashboard() {
  document.addEventListener("userReady", ({ detail }) => {
    const { user, profile } = detail;
    const content = document.getElementById("pageContent");

    content.innerHTML = `
      <div class="page-header">
        <div>
          <h2>Welcome, ${escapeHTML(profile.name)}</h2>
          <p class="muted">Your next actions, overdue work, bookings and latest quiz score.</p>
        </div>
        <button class="btn secondary no-print" id="printProgress">Print Progress</button>
      </div>

      <div id="approvedNotice" class="notice hidden"></div>

      <div class="grid stats">
        <div class="card"><div class="stat-label">Total Tasks</div><div class="stat-value" id="totalTasks">0</div></div>
        <div class="card"><div class="stat-label">Completed</div><div class="stat-value" id="completedTasks">0</div></div>
        <div class="card"><div class="stat-label">Outstanding</div><div class="stat-value" id="outstandingTasks">0</div></div>
        <div class="card"><div class="stat-label">Overdue</div><div class="stat-value" id="overdueTasks">0</div></div>
      </div>

      <div class="grid dashboard-panels">
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
          <h3>Latest quiz score</h3>
          <div id="quizScore" class="empty">No quiz attempts yet.</div>
        </section>
      </div>

      <div class="grid dashboard-panels" style="margin-top:18px;">
        <section class="card">
          <h3>Overdue tasks</h3>
          <div id="overdueList" class="task-list"></div>
        </section>

        <section class="card">
          <h3>Next support session</h3>
          <div id="nextBooking" class="task-list"></div>
        </section>
      </div>

      <section class="card" style="margin-top:18px;">
        <h3>Recent Tasks</h3>
        <div id="recentTasks" class="task-list"></div>
      </section>
    `;

    document.getElementById("printProgress").addEventListener("click", () => window.print());

    const uid = user.uid;
    let tasks = [];
    let bookings = [];
    let scores = [];

    const paint = () => {
      const today = todayISODate();
      const completed = tasks.filter(t => t.status === "Completed").length;
      const overdueTasks = tasks.filter(t => isTaskOverdue(t, today));
      const outstanding = tasks.length - completed;
      const progress = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;

      document.getElementById("totalTasks").textContent = tasks.length;
      document.getElementById("completedTasks").textContent = completed;
      document.getElementById("outstandingTasks").textContent = outstanding;
      document.getElementById("overdueTasks").textContent = overdueTasks.length;
      document.getElementById("progressPercent").textContent = `${progress}%`;
      document.getElementById("progressFill").style.width = `${progress}%`;

      document.getElementById("overdueList").innerHTML = overdueTasks.length
        ? overdueTasks.map(taskCard).join("")
        : `<div class="empty">Nothing overdue. <a href="tasks.html">Add a task</a></div>`;

      const recent = [...tasks]
        .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
        .slice(0, 5);

      document.getElementById("recentTasks").innerHTML = recent.length
        ? recent.map(taskCard).join("")
        : `<div class="empty">No tasks yet. <a href="tasks.html">Create your first learning task</a>.</div>`;

      const upcoming = bookings
        .filter(item => item.status === "Pending" || item.status === "Approved")
        .filter(item => `${item.date || ""}T${item.time || "00:00"}` >= `${today}T00:00`)
        .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));

      document.getElementById("nextBooking").innerHTML = upcoming.length
        ? bookingCard(upcoming[0])
        : `<div class="empty">No upcoming session. <a href="booking.html">Request support</a>.</div>`;

      const approved = upcoming.filter(item => item.status === "Approved");
      const notice = document.getElementById("approvedNotice");
      if (approved.length) {
        notice.classList.remove("hidden");
        notice.innerHTML = approved.map(item =>
          `<strong>Booking approved:</strong> ${escapeHTML(item.topic)} on ${formatDate(item.date)} at ${escapeHTML(item.time || "")}${item.meetingLink ? ` · <a href="${escapeHTML(item.meetingLink)}" target="_blank" rel="noopener noreferrer">Join session</a>` : ""}`
        ).join("<br>");
      } else {
        notice.classList.add("hidden");
        notice.textContent = "";
      }

      const latest = [...scores].sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))[0];
      const best = scores.reduce((max, item) => Math.max(max, Number(item.score || 0)), 0);
      document.getElementById("quizScore").innerHTML = latest
        ? `<div class="stat-value">${escapeHTML(String(latest.score))}</div>
           <p class="muted">${escapeHTML(latest.game || "Quiz")} · last attempt ${formatDate(latest.createdAt)}${scores.length > 1 ? ` · best ${best}` : ""}</p>
           <a class="btn secondary small" href="resources.html">Practise again</a>`
        : `<div class="empty">No quiz attempts yet. <a href="resources.html">Take the JavaScript challenge</a>.</div>`;
    };

    onValue(ref(db, `tasks/${uid}`), snapshot => {
      tasks = recordsFrom(snapshot);
      paint();
    });

    onValue(ref(db, `bookings/${uid}`), snapshot => {
      bookings = recordsFrom(snapshot);
      paint();
    });

    onValue(ref(db, `gameScores/${uid}`), snapshot => {
      scores = recordsFrom(snapshot);
      paint();
    });
  });
}

function taskCard(task) {
  const overdue = isTaskOverdue(task);
  return `
    <a class="item item-link" href="tasks.html">
      <div class="item-head">
        <h3>${escapeHTML(task.title)}</h3>
        <span class="badge ${overdue ? "danger" : statusBadge(task.status)}">${overdue ? "Overdue" : escapeHTML(task.status)}</span>
      </div>
      <div class="meta">
        <span>${escapeHTML(task.category || "")}</span>
        <span>Priority: ${escapeHTML(task.priority || "")}</span>
        <span>Due: ${formatDate(task.dueDate)}</span>
      </div>
    </a>
  `;
}

function bookingCard(item) {
  return `
    <a class="item item-link" href="booking.html">
      <div class="item-head">
        <h3>${escapeHTML(item.topic)}</h3>
        <span class="badge ${statusBadge(item.status)}">${escapeHTML(item.status)}</span>
      </div>
      <div class="meta">
        <span>${formatDate(item.date)}</span>
        <span>${escapeHTML(item.time || "")}</span>
      </div>
      ${item.notes ? `<p class="muted">${escapeHTML(item.notes)}</p>` : ""}
    </a>
  `;
}
