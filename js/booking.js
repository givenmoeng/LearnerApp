import { auth, db } from "./firebase.js";
import {
  ref, push, set, onValue, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";
import { escapeHTML, formatDate, showMessage } from "./app.js";

export function initBooking() {
  document.addEventListener("userReady", ({ detail }) => {
    const user = detail.user;
    document.getElementById("pageContent").innerHTML = `
      <div class="page-header">
        <div>
          <h2>Support Session Booking</h2>
          <p class="muted">Request assistance from an assessor.</p>
        </div>
      </div>

      <div id="bookingMessage" class="message hidden"></div>

      <div class="grid" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr);">
        <section class="card">
          <h3>Request a session</h3>
          <form id="bookingForm" class="form-grid">
            <label class="full-span">Topic
              <input id="bookingTopic" maxlength="150" required placeholder="e.g. JavaScript functions">
            </label>
            <label>Date
              <input id="bookingDate" type="date" required>
            </label>
            <label>Time
              <input id="bookingTime" type="time" required>
            </label>
            <label class="full-span">What do you need help with?
              <textarea id="bookingDescription" maxlength="1000" required></textarea>
            </label>
            <div class="actions full-span">
              <button class="btn primary" type="submit">Submit Request</button>
            </div>
          </form>
        </section>

        <section class="card">
          <h3>My Requests</h3>
          <div id="bookingList" class="booking-list"></div>
        </section>
      </div>
    `;

    document.getElementById("bookingForm").addEventListener("submit", async event => {
      event.preventDefault();

      const data = {
        learnerId: user.uid,
        learnerName: detail.profile.name,
        topic: document.getElementById("bookingTopic").value.trim(),
        date: document.getElementById("bookingDate").value,
        time: document.getElementById("bookingTime").value,
        description: document.getElementById("bookingDescription").value.trim(),
        status: "Pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      try {
        const bookingRef = push(ref(db, "bookings"));
        await set(bookingRef, data);
        event.target.reset();
        showMessage(document.getElementById("bookingMessage"), "Support request submitted successfully.", "success");
      } catch (error) {
        console.error(error);
        showMessage(document.getElementById("bookingMessage"), "Could not submit your request.", "error");
      }
    });

    onValue(ref(db, "bookings"), snapshot => {
      const all = snapshot.val() || {};
      const bookings = Object.entries(all)
        .map(([id, item]) => ({ id, ...item }))
        .filter(item => item.learnerId === user.uid)
        .sort((a,b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));

      document.getElementById("bookingList").innerHTML = bookings.length
        ? bookings.map(item => `
          <div class="item">
            <div class="item-head">
              <h3>${escapeHTML(item.topic)}</h3>
              <span class="badge ${item.status === "Approved" ? "success" : item.status === "Cancelled" ? "danger" : "warning"}">${escapeHTML(item.status)}</span>
            </div>
            <div class="meta">
              <span>${formatDate(item.date)}</span>
              <span>${escapeHTML(item.time)}</span>
            </div>
            <p class="muted">${escapeHTML(item.description || "")}</p>
          </div>
        `).join("")
        : `<div class="empty">No support requests submitted yet.</div>`;
    });
  });
}
