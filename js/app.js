import { auth, db } from "./firebase.js";
import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import {
  ref, get
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

export function renderShell(active = "") {
  const app = document.getElementById("app");
  if (!app) return;

  const nav = [
    ["dashboard.html", "Dashboard", "dashboard"],
    ["tasks.html", "Tasks", "tasks"],
    ["booking.html", "Support Booking", "booking"],
    ["resources.html", "Resources & Game", "resources"],
    ["assessor.html", "Assessor", "assessor"]
  ];

  app.innerHTML = `
    <div class="app-layout">
      <aside class="sidebar">
        <div class="sidebar-brand">Learner Support System</div>
        <div class="role" id="sideRole">Loading role...</div>
        <nav class="nav">
          ${nav.map(([href, label, key]) =>
            `<a class="${active === key ? "active" : ""}" data-role-link="${key}" href="${href}">${label}</a>`
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

      document.dispatchEvent(new CustomEvent("userReady", {
        detail: { user, profile: currentProfile }
      }));
    } catch (error) {
      console.error(error);
      window.location.replace("index.html");
    }
  });
}
