import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import {
  ref, get, update, push, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

let currentProfile = null;

export function getCurrentProfile() {
  return currentProfile;
}

export function showMessage(target, text, type = "info") {
  if (!target) return;
  target.textContent = text;
  target.className = `message ${type}`;
}

export function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

export function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

export function recordsFrom(snapshot) {
  const value = snapshot.val() || {};
  return Object.entries(value).map(([id, item]) => ({ id, ...(item || {}) }));
}

export function todayISODate() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export function isTaskOverdue(task, today = todayISODate()) {
  if (!task || task.status === "Completed" || !task.dueDate) return false;
  return task.dueDate < today;
}

export function statusBadge(status) {
  if (status === "Completed" || status === "Approved") return "success";
  if (status === "Cancelled" || status === "High") return "danger";
  return "warning";
}

export function applyRoleNav(role) {
  document.querySelectorAll("[data-nav-role]").forEach(link => {
    link.classList.toggle("hidden", link.dataset.navRole !== role);
  });
}

export function newKey(path) {
  return push(ref(db, path)).key;
}

export async function writeBooking(learnerId, bookingId, payload) {
  const data = { ...payload, learnerId, updatedAt: serverTimestamp() };
  await update(ref(db), {
    [`bookings/${learnerId}/${bookingId}`]: data,
    [`assessorInbox/bookings/${bookingId}`]: data
  });
}

export async function patchBooking(learnerId, bookingId, fields) {
  const patch = { ...fields, updatedAt: serverTimestamp() };
  const updates = {};
  Object.entries(patch).forEach(([key, value]) => {
    updates[`bookings/${learnerId}/${bookingId}/${key}`] = value;
    updates[`assessorInbox/bookings/${bookingId}/${key}`] = value;
  });
  await update(ref(db), updates);
}

export function renderShell(active = "") {
  const app = document.getElementById("app");
  if (!app) return;

  const nav = [
    ["dashboard.html", "Dashboard", "dashboard", "learner"],
    ["tasks.html", "Tasks", "tasks", "learner"],
    ["booking.html", "Support Booking", "booking", "learner"],
    ["resources.html", "Resources & Game", "resources", "learner"],
    ["assessor.html", "Assessor", "assessor", "assessor"]
  ];

  app.innerHTML = `
    <div class="app-layout">
      <aside class="sidebar">
        <div class="sidebar-brand">Learner Support System</div>
        <div class="role" id="sideRole">Loading role...</div>
        <nav class="nav">
          ${nav.map(([href, label, key, role]) =>
            `<a class="hidden ${active === key ? "active" : ""}" data-nav-role="${role}" data-role-link="${key}" href="${href}">${label}</a>`
          ).join("")}
        </nav>
      </aside>
      <section class="main">
        <header class="topbar">
          <h1 id="pageTitle">Learner Support System</h1>
          <div class="user-area">
            <span class="email" id="userEmail"></span>
            <button class="btn secondary small" id="logoutBtn">Sign out</button>
          </div>
        </header>
        <main class="content" id="pageContent"></main>
      </section>
    </div>
  `;

  document.getElementById("logoutBtn").addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "index.html";
  });
}

export function requireAuth(requiredRole = null) {
  onAuthStateChanged(auth, async user => {
    if (!user) {
      window.location.replace("index.html");
      return;
    }

    try {
      const snap = await get(ref(db, `users/${user.uid}`));
      if (!snap.exists()) {
        await signOut(auth);
        window.location.replace("index.html");
        return;
      }

      currentProfile = snap.val();

      if (requiredRole && currentProfile.role !== requiredRole) {
        window.location.replace(
          currentProfile.role === "assessor" ? "assessor.html" : "dashboard.html"
        );
        return;
      }

      const emailEl = document.getElementById("userEmail");
      const roleEl = document.getElementById("sideRole");
      if (emailEl) emailEl.textContent = user.email || "";
      if (roleEl) roleEl.textContent = `Role: ${currentProfile.role}`;
      applyRoleNav(currentProfile.role);

      if (currentProfile.role === "learner") {
        update(ref(db, `learnerIndex/${user.uid}`), {
          name: currentProfile.name,
          email: currentProfile.email || user.email || ""
        }).catch(error => console.error("Could not refresh learner index:", error));
      }

      document.dispatchEvent(new CustomEvent("userReady", {
        detail: { user, profile: currentProfile }
      }));
    } catch (error) {
      console.error(error);
      window.location.replace("index.html");
    }
  });
}
