import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import {
  ref, get, update, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";
import { showMessage } from "./app.js";

const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const resetForm = document.getElementById("resetForm");
const message = document.getElementById("message");
let suppressAuthRedirect = false;

function showTab(name) {
  document.querySelectorAll(".tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.tab === name);
  });
  loginForm.classList.toggle("hidden", name !== "login");
  registerForm.classList.toggle("hidden", name !== "register");
  resetForm.classList.toggle("hidden", name !== "reset");
  message.className = "message hidden";
}

document.querySelectorAll("[data-tab]").forEach(el => {
  el.addEventListener("click", () => showTab(el.dataset.tab));
});

async function redirectForUser(user) {
  const snap = await get(ref(db, `users/${user.uid}`));
  if (!snap.exists()) {
    throw new Error("missing-profile");
  }
  window.location.replace(snap.val().role === "assessor" ? "assessor.html" : "dashboard.html");
}

onAuthStateChanged(auth, async user => {
  if (!user || suppressAuthRedirect) return;

  try {
    await redirectForUser(user);
  } catch (error) {
    if (error.message === "missing-profile") return;
    console.error("Signed-in redirect failed:", error);
  }
});

loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  showMessage(message, "Signing you in...", "info");

  const email = document.getElementById("loginEmail").value.trim().toLowerCase();
  const password = document.getElementById("loginPassword").value;
  let credential;

  try {
    suppressAuthRedirect = true;
    credential = await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    suppressAuthRedirect = false;
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
    await redirectForUser(credential.user);
  } catch (error) {
    suppressAuthRedirect = false;
    console.error("Signed in, but profile lookup failed:", error);
    const text = error.message === "missing-profile"
      ? "You signed in, but your learner profile is missing from the database."
      : `You signed in, but your profile could not be loaded${error.code ? ` (${error.code})` : ""}. Check the Realtime Database rules and connection.`;
    showMessage(message, text, "error");
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
    suppressAuthRedirect = true;

    const credential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = credential.user.uid;

    try {
      await update(ref(db), {
        [`users/${uid}`]: {
          name,
          email,
          role: "learner",
          createdAt: serverTimestamp()
        },
        [`learnerIndex/${uid}`]: {
          name,
          email,
          createdAt: serverTimestamp()
        }
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

    await signOut(auth);
    suppressAuthRedirect = false;

    document.getElementById("loginEmail").value = email;
    document.getElementById("loginPassword").value = "";
    registerForm.reset();
    showTab("login");
    showMessage(message, "Account created. Sign in with your email and password.", "success");
  } catch (error) {
    suppressAuthRedirect = false;
    console.error(error);

    const text = error.code === "auth/email-already-in-use"
      ? "This email is already registered. Sign in instead."
      : error.code === "auth/invalid-email"
      ? "Please enter a valid email address."
      : error.code === "auth/weak-password"
      ? "Password is too weak."
      : error.code === "auth/operation-not-allowed"
      ? "Email/password registration is disabled. Enable it in Firebase Authentication settings."
      : error.code === "auth/configuration-not-found"
      ? "Firebase Authentication is not configured for this project. Finish Authentication setup and enable Email/Password for the project configured in js/firebase.js."
      : `Registration failed${error.code ? ` (${error.code})` : ". Please try again."}`;

    if (error.code === "auth/email-already-in-use") {
      document.getElementById("loginEmail").value = email;
      showTab("login");
    }

    showMessage(message, text, "error");
  }
});

resetForm.addEventListener("submit", async event => {
  event.preventDefault();
  const email = document.getElementById("resetEmail").value.trim().toLowerCase();

  try {
    showMessage(message, "Sending reset link...", "info");
    await sendPasswordResetEmail(auth, email);
    showMessage(message, "If that email is registered, a password reset link is on its way.", "success");
  } catch (error) {
    console.error(error);
    const text = error.code === "auth/invalid-email"
      ? "Please enter a valid email address."
      : error.code === "auth/too-many-requests"
      ? "Too many reset attempts. Please wait and try again."
      : "Could not send a reset email. Check the address and try again.";
    showMessage(message, text, "error");
  }
});
