import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import {
  ref, set, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";
import { showMessage } from "./app.js";

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const message = document.getElementById("message");

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    const login = tab.dataset.tab === "login";
    loginForm.classList.toggle("hidden", !login);
    registerForm.classList.toggle("hidden", login);
    message.className = "message hidden";
  });
});

onAuthStateChanged(auth, user => {
  if (user) {
    // Existing authenticated users are sent to their dashboard after profile lookup.
    // Avoid redirecting while a user is midway through account creation.
  }
});

loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  showMessage(message, "Signing you in...", "info");

  const email = document.getElementById("loginEmail").value.trim().toLowerCase();
  const password = document.getElementById("loginPassword").value;
  let credential;

  try {
    credential = await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    console.error("Firebase Authentication sign-in failed:", error);

    const text = ["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found", "auth/invalid-email"].includes(error.code)
      ? "Email or password is incorrect. Check your details or register first."
      : error.code === "auth/configuration-not-found"
      ? "Firebase Authentication is not configured for this project. Check the project and Email/Password setup in Firebase Console."
      : error.code === "auth/operation-not-allowed"
      ? "Email/password sign-in is disabled in Firebase Authentication settings."
      : `Sign-in failed${error.code ? ` (${error.code})` : ". Check your connection and try again."}`;

    showMessage(message, text, "error");
    return;
  }

  try {
    const { get } = await import("https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js");
    const snap = await get(ref(db, `users/${credential.user.uid}`));

    if (!snap.exists()) {
      showMessage(message, "You signed in, but your learner profile is missing from the database.", "error");
      return;
    }

    window.location.href = snap.val().role === "assessor" ? "assessor.html" : "dashboard.html";
  } catch (error) {
    console.error("Signed in, but profile lookup failed:", error);
    showMessage(message, `You signed in, but your profile could not be loaded${error.code ? ` (${error.code})` : ""}. Check the Realtime Database rules and connection.`, "error");
  }
});

registerForm.addEventListener("submit", async event => {
  event.preventDefault();

  const name = document.getElementById("registerName").value.trim();
  const email = document.getElementById("registerEmail").value.trim().toLowerCase();
  const password = document.getElementById("registerPassword").value;
  const confirm = document.getElementById("registerConfirm").value;

  if (password !== confirm) {
    showMessage(message, "Passwords do not match.", "error");
    return;
  }

  if (password.length < 6) {
    showMessage(message, "Password must be at least 6 characters.", "error");
    return;
  }

  try {
    showMessage(message, "Creating your account...", "info");

    const credential = await createUserWithEmailAndPassword(auth, email, password);

    try {
      await set(ref(db, `users/${credential.user.uid}`), {
        name,
        email,
        role: "learner",
        createdAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Account created, but learner profile could not be saved:", error);
      showMessage(
        message,
        `Your account was created, but its learner profile could not be saved. Check Realtime Database rules and connection${error.code ? ` (${error.code})` : ""}.`,
        "error"
      );
      return;
    }

    showMessage(message, "Account created. Redirecting...", "success");
    window.location.href = "dashboard.html";
  } catch (error) {
    console.error(error);

    const text = error.code === "auth/email-already-in-use"
      ? "This email address is already registered."
      : error.code === "auth/invalid-email"
      ? "Please enter a valid email address."
      : error.code === "auth/weak-password"
      ? "Password is too weak."
      : error.code === "auth/operation-not-allowed"
      ? "Email/password registration is disabled. Enable it in Firebase Authentication settings."
      : error.code === "auth/configuration-not-found"
      ? "Firebase Authentication is not configured for this project. Finish Authentication setup and enable Email/Password for the project configured in js/firebase.js."
      : `Registration failed${error.code ? ` (${error.code})` : ". Please try again."}`;

    showMessage(message, text, "error");
  }
});
