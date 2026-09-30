import { db } from "./firebase.js";
import {
  ref, onValue, update, push, set, remove, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";
import {
  escapeHTML,
  formatDate,
  showMessage,
  recordsFrom,
  isTaskOverdue,
  todayISODate,
  statusBadge,
  patchBooking
} from "./app.js";

export function initAssessor() {
  document.addEventListener("userReady", ({ detail }) => {
    const content = document.getElementById("pageContent");
    const assessor = detail.user;
    const assessorName = detail.profile.name || "Assessor";

    content.innerHTML = `
      <div class="page-header">
        <div>
          <h2>Assessor Dashboard</h2>
          <p class="muted">Open a learner, assign work, and follow up on support sessions.</p>
        </div>
        <button class="btn primary" id="assignTaskBtn">+ Assign task</button>
      </div>

      <div id="assessorMessage" class="message hidden"></div>

      <div class="grid stats">
        <div class="card"><div class="stat-label">Pending Bookings</div><div class="stat-value" id="pendingCount">0</div></div>
        <div class="card"><div class="stat-label">Total Bookings</div><div class="stat-value" id="bookingCount">0</div></div>
        <div class="card"><div class="stat-label">Resources</div><div class="stat-value" id="resourceCount">0</div></div>
        <div class="card"><div class="stat-label">Learners</div><div class="stat-value" id="learnerCount">0</div></div>
      </div>

      <div class="grid dashboard-panels" style="margin-top:18px;">
        <section class="card">
          <h3>Learners</h3>
          <p class="muted">Select a learner to see progress, overdue work, bookings and quiz scores.</p>
          <div id="learnerRoster" class="task-list"></div>
        </section>
        <section class="card">
          <div class="page-header">
            <h3 id="learnerDetailTitle">Learner detail</h3>
          </div>
          <div id="learnerDetail" class="empty">Choose a learner from the list.</div>
        </section>
      </div>

      <section class="card" style="margin-top:18px;">
        <div class="page-header">
          <div>
            <h3>Support Bookings</h3>
            <p class="muted">Read the request, update status, and leave session notes or a meeting link.</p>
          </div>
        </div>
        <div id="bookingAdminList" class="booking-list"></div>
      </section>

      <section class="card" style="margin-top:18px;">
        <div class="page-header">
          <div>
            <h3>Manage Learning Resources</h3>
            <p class="muted">Add, edit or delete resources that learners can open.</p>
          </div>
          <button class="btn primary" id="newResourceBtn">+ Add Resource</button>
        </div>
        <div id="resourceAdminList" class="resource-list"></div>
      </section>

      <div id="resourceModal" class="modal-backdrop hidden">
        <div class="modal">
          <div class="modal-head">
            <h3 id="resourceModalTitle">Add Learning Resource</h3>
            <button class="close" id="closeResource">&times;</button>
          </div>
          <form id="resourceForm" class="form-grid">
            <input type="hidden" id="resourceId">
            <input type="hidden" id="resourceCreatedBy">
            <label class="full-span">Title
              <input id="resourceTitle" maxlength="150" required>
            </label>
            <label>Type
              <select id="resourceType" required>
                <option>Document</option><option>Link</option><option>Guide</option><option>Video</option>
              </select>
            </label>
            <label>Category
              <input id="resourceCategory" maxlength="80" required placeholder="e.g. JavaScript">
            </label>
            <label class="full-span">Description
              <textarea id="resourceDescription" maxlength="1000" required></textarea>
            </label>
            <label class="full-span">Resource URL
              <input id="resourceUrl" type="url" placeholder="https://example.com/resource">
            </label>
            <div class="actions full-span">
              <button class="btn secondary" type="button" id="cancelResource">Cancel</button>
              <button class="btn primary" type="submit">Save Resource</button>
            </div>
          </form>
        </div>
      </div>

      <div id="assignModal" class="modal-backdrop hidden">
        <div class="modal">
          <div class="modal-head">
            <h3>Assign a task</h3>
            <button class="close" id="closeAssign">&times;</button>
          </div>
          <form id="assignForm" class="form-grid">
            <label class="full-span">Learner
              <select id="assignLearner" required></select>
            </label>
            <label class="full-span">Task title
              <input id="assignTitle" maxlength="150" required>
            </label>
            <label class="full-span">Description
              <textarea id="assignDescription" maxlength="1000" required></textarea>
            </label>
            <label>Category
              <input id="assignCategory" maxlength="80" required placeholder="e.g. JavaScript">
            </label>
            <label>Priority
              <select id="assignPriority" required>
                <option>Low</option><option selected>Medium</option><option>High</option>
              </select>
            </label>
            <label>Due date
              <input id="assignDueDate" type="date" required>
            </label>
            <label>Status
              <select id="assignStatus" required>
                <option>Pending</option><option>In Progress</option><option>Completed</option>
              </select>
            </label>
            <div class="actions full-span">
              <button class="btn secondary" type="button" id="cancelAssign">Cancel</button>
              <button class="btn primary" type="submit">Assign task</button>
            </div>
          </form>
        </div>
      </div>
    `;

    let learners = [];
    let resources = [];
    let bookings = [];
    let selectedId = null;
    let stopTasks = () => {};
    let stopBookings = () => {};
    let stopScores = () => {};

    const resourceModal = document.getElementById("resourceModal");
    const assignModal = document.getElementById("assignModal");
    const message = () => document.getElementById("assessorMessage");

    const closeResource = () => {
      resourceModal.classList.add("hidden");
      document.getElementById("resourceForm").reset();
      document.getElementById("resourceId").value = "";
      document.getElementById("resourceCreatedBy").value = "";
    };

    const openResource = (item = null) => {
      document.getElementById("resourceModalTitle").textContent = item ? "Edit Learning Resource" : "Add Learning Resource";
      document.getElementById("resourceId").value = item?.id || "";
      document.getElementById("resourceCreatedBy").value = item?.createdBy || assessor.uid;
      document.getElementById("resourceTitle").value = item?.title || "";
      document.getElementById("resourceType").value = item?.type || "Document";
      document.getElementById("resourceCategory").value = item?.category || "";
      document.getElementById("resourceDescription").value = item?.description || "";
      document.getElementById("resourceUrl").value = item?.url || "";
      resourceModal.classList.remove("hidden");
    };

    const fillLearnerSelect = (preferredId = selectedId) => {
      const select = document.getElementById("assignLearner");
      select.innerHTML = learners.length
        ? learners.map(learner => `<option value="${learner.id}" ${learner.id === preferredId ? "selected" : ""}>${escapeHTML(learner.name)} (${escapeHTML(learner.email)})</option>`).join("")
        : `<option value="">No learners yet</option>`;
    };

    const paintRoster = () => {
      document.getElementById("learnerCount").textContent = learners.length;
      document.getElementById("learnerRoster").innerHTML = learners.length
        ? learners.map(learner => `
            <button type="button" class="item item-button ${learner.id === selectedId ? "active" : ""}" data-learner="${learner.id}">
              <div class="item-head">
                <h3>${escapeHTML(learner.name)}</h3>
              </div>
              <p class="muted">${escapeHTML(learner.email)}</p>
            </button>
          `).join("")
        : `<div class="empty">No learners have registered yet.</div>`;
    };

    const paintLearner = (tasks, learnerBookings, scores, name) => {
      const today = todayISODate();
      const completed = tasks.filter(t => t.status === "Completed").length;
      const overdue = tasks.filter(t => isTaskOverdue(t, today));
      const progress = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
      const latest = [...scores].sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))[0];

      document.getElementById("learnerDetailTitle").textContent = name;
      document.getElementById("learnerDetail").innerHTML = `
        <div class="meta" style="margin-bottom:14px;">
          <span>${tasks.length} tasks</span>
          <span>${progress}% complete</span>
          <span>${overdue.length} overdue</span>
        </div>
        <div class="progress-track"><div class="progress-fill" style="width:${progress}%"></div></div>
        <h4>Overdue work</h4>
        ${overdue.length ? overdue.map(task => `<div class="item"><strong>${escapeHTML(task.title)}</strong> · due ${formatDate(task.dueDate)}</div>`).join("") : `<p class="muted">No overdue tasks.</p>`}
        <h4>All tasks</h4>
        ${tasks.length ? tasks.map(task => `
          <div class="item">
            <div class="item-head">
              <h3>${escapeHTML(task.title)}</h3>
              <span class="badge ${statusBadge(task.status)}">${escapeHTML(task.status)}</span>
            </div>
            <p class="muted">${escapeHTML(task.description || "")}</p>
            <div class="meta"><span>Due ${formatDate(task.dueDate)}</span><span>${escapeHTML(task.priority)}</span></div>
          </div>
        `).join("") : `<p class="muted">No tasks yet. Assign one to get them started.</p>`}
        <h4>Bookings</h4>
        ${learnerBookings.length ? learnerBookings.map(item => `
          <div class="item">
            <div class="item-head">
              <h3>${escapeHTML(item.topic)}</h3>
              <span class="badge ${statusBadge(item.status)}">${escapeHTML(item.status)}</span>
            </div>
            <p class="muted">${escapeHTML(item.description || "")}</p>
            <div class="meta"><span>${formatDate(item.date)}</span><span>${escapeHTML(item.time || "")}</span></div>
          </div>
        `).join("") : `<p class="muted">No bookings.</p>`}
        <h4>Quiz scores</h4>
        ${scores.length ? `<p>Latest: <strong>${escapeHTML(String(latest.score))}</strong> · ${scores.length} attempt${scores.length === 1 ? "" : "s"}</p>
          ${scores.map(item => `<div class="item"><strong>${escapeHTML(String(item.score))}</strong> · ${formatDate(item.createdAt)}</div>`).join("")}` : `<p class="muted">No quiz scores yet.</p>`}
      `;
    };

    const watchLearner = (learnerId) => {
      selectedId = learnerId;
      const learner = learners.find(item => item.id === learnerId);
      paintRoster();
      stopTasks();
      stopBookings();
      stopScores();
      if (!learnerId) return;

      let tasks = [];
      let learnerBookings = [];
      let scores = [];
      const redraw = () => paintLearner(tasks, learnerBookings, scores, learner?.name || "Learner");

      stopTasks = onValue(ref(db, `tasks/${learnerId}`), snapshot => {
        tasks = recordsFrom(snapshot);
        redraw();
      });
      stopBookings = onValue(ref(db, `bookings/${learnerId}`), snapshot => {
        learnerBookings = recordsFrom(snapshot).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
        redraw();
      });
      stopScores = onValue(ref(db, `gameScores/${learnerId}`), snapshot => {
        scores = recordsFrom(snapshot).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
        redraw();
      });
    };

    document.getElementById("newResourceBtn").addEventListener("click", () => openResource());
    document.getElementById("closeResource").addEventListener("click", closeResource);
    document.getElementById("cancelResource").addEventListener("click", closeResource);

    document.getElementById("assignTaskBtn").addEventListener("click", () => {
      fillLearnerSelect();
      assignModal.classList.remove("hidden");
    });
    document.getElementById("closeAssign").addEventListener("click", () => assignModal.classList.add("hidden"));
    document.getElementById("cancelAssign").addEventListener("click", () => assignModal.classList.add("hidden"));

    document.getElementById("learnerRoster").addEventListener("click", event => {
      const button = event.target.closest("[data-learner]");
      if (button) watchLearner(button.dataset.learner);
    });

    document.getElementById("resourceForm").addEventListener("submit", async event => {
      event.preventDefault();
      const id = document.getElementById("resourceId").value;
      const payload = {
        title: document.getElementById("resourceTitle").value.trim(),
        type: document.getElementById("resourceType").value,
        description: document.getElementById("resourceDescription").value.trim(),
        category: document.getElementById("resourceCategory").value.trim(),
        url: document.getElementById("resourceUrl").value.trim(),
        createdBy: document.getElementById("resourceCreatedBy").value || assessor.uid,
        updatedAt: serverTimestamp()
      };

      try {
        if (id) {
          await update(ref(db, `resources/${id}`), payload);
          showMessage(message(), "Resource updated.", "success");
        } else {
          payload.createdAt = serverTimestamp();
          await set(push(ref(db, "resources")), payload);
          showMessage(message(), "Resource added successfully.", "success");
        }
        closeResource();
      } catch (error) {
        console.error(error);
        showMessage(message(), "Could not save resource.", "error");
      }
    });

    document.getElementById("assignForm").addEventListener("submit", async event => {
      event.preventDefault();
      const learnerId = document.getElementById("assignLearner").value;
      if (!learnerId) {
        showMessage(message(), "Select a learner first.", "error");
        return;
      }

      try {
        await set(push(ref(db, `tasks/${learnerId}`)), {
          userId: learnerId,
          title: document.getElementById("assignTitle").value.trim(),
          description: document.getElementById("assignDescription").value.trim(),
          category: document.getElementById("assignCategory").value.trim(),
          priority: document.getElementById("assignPriority").value,
          dueDate: document.getElementById("assignDueDate").value,
          status: document.getElementById("assignStatus").value,
          assignedBy: assessor.uid,
          assignedByName: assessorName,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        event.target.reset();
        assignModal.classList.add("hidden");
        showMessage(message(), "Task assigned.", "success");
        if (selectedId === learnerId) watchLearner(learnerId);
        else watchLearner(learnerId);
      } catch (error) {
        console.error(error);
        showMessage(message(), "Could not assign the task.", "error");
      }
    });

    onValue(ref(db, "assessorInbox/bookings"), snapshot => {
      bookings = recordsFrom(snapshot).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
      document.getElementById("bookingCount").textContent = bookings.length;
      document.getElementById("pendingCount").textContent = bookings.filter(item => item.status === "Pending").length;

      document.getElementById("bookingAdminList").innerHTML = bookings.length
        ? bookings.map(item => `
          <article class="item" data-booking-card="${item.id}">
            <div class="item-head">
              <div>
                <h3>${escapeHTML(item.topic)}</h3>
                <div class="meta">
                  <span>${escapeHTML(item.learnerName || item.learnerId)}</span>
                  <span>${formatDate(item.date)} ${escapeHTML(item.time || "")}</span>
                </div>
              </div>
              <span class="badge ${statusBadge(item.status)}">${escapeHTML(item.status)}</span>
            </div>
            <p>${escapeHTML(item.description || "No description provided.")}</p>
            <form class="form-grid booking-followup" data-booking-id="${item.id}" data-learner-id="${item.learnerId}">
              <label>Status
                <select name="status">
                  ${["Pending", "Approved", "Completed", "Cancelled"].map(status =>
                    `<option ${item.status === status ? "selected" : ""}>${status}</option>`
                  ).join("")}
                </select>
              </label>
              <label>Meeting link
                <input name="meetingLink" type="url" value="${escapeHTML(item.meetingLink || "")}" placeholder="https://meet.example.com/session">
              </label>
              <label class="full-span">Session notes
                <textarea name="notes" class="compact-note" maxlength="2000" placeholder="What was covered, homework, or follow-up.">${escapeHTML(item.notes || "")}</textarea>
              </label>
              <div class="actions full-span">
                <button class="btn primary small" type="submit">Save follow-up</button>
                <button class="btn secondary small" type="button" data-open-learner="${item.learnerId}">Open learner</button>
              </div>
            </form>
          </article>
        `).join("")
        : `<div class="empty">No support bookings found.</div>`;
    });

    document.getElementById("bookingAdminList").addEventListener("submit", async event => {
      const form = event.target.closest(".booking-followup");
      if (!form) return;
      event.preventDefault();

      try {
        await patchBooking(form.dataset.learnerId, form.dataset.bookingId, {
          status: form.status.value,
          meetingLink: form.meetingLink.value.trim(),
          notes: form.notes.value.trim()
        });
        showMessage(message(), "Booking follow-up saved.", "success");
      } catch (error) {
        console.error(error);
        showMessage(message(), "Could not update this booking.", "error");
      }
    });

    document.getElementById("bookingAdminList").addEventListener("click", event => {
      const button = event.target.closest("[data-open-learner]");
      if (button) watchLearner(button.dataset.openLearner);
    });

    onValue(ref(db, "resources"), snapshot => {
      resources = recordsFrom(snapshot);
      document.getElementById("resourceCount").textContent = resources.length;
      document.getElementById("resourceAdminList").innerHTML = resources.length
        ? resources.map(item => `
          <div class="item">
            <div class="item-head">
              <div>
                <h3>${escapeHTML(item.title)}</h3>
                <div class="meta"><span>${escapeHTML(item.type)}</span><span>${escapeHTML(item.category)}</span></div>
              </div>
              <div class="actions">
                <button class="btn secondary small edit-resource" data-id="${item.id}">Edit</button>
                <button class="btn danger small delete-resource" data-id="${item.id}">Delete</button>
              </div>
            </div>
            <p class="muted">${escapeHTML(item.description || "")}</p>
          </div>
        `).join("")
        : `<div class="empty">No resources yet.</div>`;
    });

    document.getElementById("resourceAdminList").addEventListener("click", async event => {
      const edit = event.target.closest(".edit-resource");
      if (edit) {
        openResource(resources.find(item => item.id === edit.dataset.id));
        return;
      }

      const button = event.target.closest(".delete-resource");
      if (!button) return;
      if (!confirm("Delete this learning resource?")) return;

      try {
        await remove(ref(db, `resources/${button.dataset.id}`));
        showMessage(message(), "Resource deleted.", "success");
      } catch (error) {
        console.error(error);
        showMessage(message(), "Could not delete resource.", "error");
      }
    });

    onValue(ref(db, "learnerIndex"), snapshot => {
      learners = recordsFrom(snapshot).sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
      paintRoster();
      fillLearnerSelect();
      if (selectedId && !learners.some(item => item.id === selectedId)) {
        selectedId = null;
        document.getElementById("learnerDetail").innerHTML = `<div class="empty">Choose a learner from the list.</div>`;
      }
    });
  });
}
