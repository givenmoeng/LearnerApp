import { db } from "./firebase.js";
import {
  ref, onValue, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";
import {
  escapeHTML,
  formatDate,
  showMessage,
  recordsFrom,
  todayISODate,
  statusBadge,
  newKey,
  writeBooking,
  patchBooking
} from "./app.js";

export function initBooking() {
  document.addEventListener("userReady", ({ detail }) => {
    const user = detail.user;
    const minDate = todayISODate();

    document.getElementById("pageContent").innerHTML = `
      <div class="page-header">
        <div>
          <h2>Support Session Booking</h2>
          <p class="muted">Request assistance from an assessor. Pending requests can be cancelled.</p>
        </div>
      </div>

      <div id="bookingMessage" class="message hidden"></div>

      <div class="grid dashboard-panels">
        <section class="card">
          <h3>Request a session</h3>
          <form id="bookingForm" class="form-grid">
            <label class="full-span">Topic
              <input id="bookingTopic" maxlength="150" required placeholder="e.g. JavaScript functions">
            </label>
            <label>Date
              <input id="bookingDate" type="date" required min="${minDate}">
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

      const date = document.getElementById("bookingDate").value;
      if (date < minDate) {
        showMessage(document.getElementById("bookingMessage"), "Please choose today or a future date.", "error");
        return;
      }

      const bookingId = newKey(`bookings/${user.uid}`);
      const data = {
        learnerId: user.uid,
        learnerName: detail.profile.name,
        topic: document.getElementById("bookingTopic").value.trim(),
        date,
        time: document.getElementById("bookingTime").value,
        description: document.getElementById("bookingDescription").value.trim(),
        status: "Pending",
        createdAt: serverTimestamp()
      };

      try {
        await writeBooking(user.uid, bookingId, data);
        event.target.reset();
        document.getElementById("bookingDate").min = minDate;
        showMessage(document.getElementById("bookingMessage"), "Support request submitted successfully.", "success");
      } catch (error) {
        console.error(error);
        showMessage(document.getElementById("bookingMessage"), "Could not submit your request.", "error");
      }
    });

    onValue(ref(db, `bookings/${user.uid}`), snapshot => {
      const bookings = recordsFrom(snapshot)
        .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));

      document.getElementById("bookingList").innerHTML = bookings.length
        ? bookings.map(item => `
          <div class="item">
            <div class="item-head">
              <h3>${escapeHTML(item.topic)}</h3>
              <span class="badge ${statusBadge(item.status)}">${escapeHTML(item.status)}</span>
            </div>
            <div class="meta">
              <span>${formatDate(item.date)}</span>
              <span>${escapeHTML(item.time)}</span>
            </div>
            <p class="muted">${escapeHTML(item.description || "")}</p>
            ${item.status === "Approved" ? `<p class="notice">This session has been approved.${item.meetingLink ? ` <a href="${escapeHTML(item.meetingLink)}" target="_blank" rel="noopener noreferrer">Open meeting link</a>` : ""}</p>` : ""}
            ${item.notes ? `<p class="muted"><strong>Assessor notes:</strong> ${escapeHTML(item.notes)}</p>` : ""}
            ${item.status === "Pending" ? `<div class="actions"><button class="btn small danger" data-cancel="${item.id}">Cancel request</button></div>` : ""}
          </div>
        `).join("")
        : `<div class="empty">No support requests submitted yet.</div>`;
    });

    document.getElementById("bookingList").addEventListener("click", async event => {
      const button = event.target.closest("[data-cancel]");
      if (!button) return;
      if (!confirm("Cancel this support request?")) return;

      try {
        await patchBooking(user.uid, button.dataset.cancel, { status: "Cancelled" });
        showMessage(document.getElementById("bookingMessage"), "Request cancelled.", "success");
      } catch (error) {
        console.error(error);
        showMessage(document.getElementById("bookingMessage"), "Could not cancel this request.", "error");
      }
    });
  });
}
