import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth, connectAuthEmulator } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getDatabase, connectDatabaseEmulator } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAEUsNsqsqqylyokGkBFQOTxc3qPNeephc",
  authDomain: "learnerdb.firebaseapp.com",
  databaseURL: "https://learnerdb-default-rtdb.firebaseio.com",
  projectId: "learnerdb",
  storageBucket: "learnerdb.firebasestorage.app",
  messagingSenderId: "135342650161",
  appId: "1:135342650161:web:1994714e191206ea41f610",
  measurementId: "G-BZ3671KDQ1"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);

const params = new URLSearchParams(location.search);
const useEmulator = params.has("emulator") || localStorage.getItem("useEmulator") === "true";

if (useEmulator) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectDatabaseEmulator(db, "127.0.0.1", 9000);
}
