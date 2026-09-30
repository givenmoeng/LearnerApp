const PROJECT = "demo-learnerapp-default-rtdb";
const DB = `http://127.0.0.1:9000`;
const AUTH = `http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1`;
const KEY = "fake-api-key";

const taskFor = uid => ({
  userId: uid,
  title: "Revise loops",
  description: "Practise for and while loops",
  category: "JavaScript",
  priority: "Medium",
  dueDate: "2026-10-01",
  status: "Pending"
});

const bookingFor = uid => ({
  learnerId: uid,
  learnerName: "Ada",
  topic: "Functions",
  date: "2026-10-12",
  time: "14:00",
  description: "Need help with return values",
  status: "Pending"
});

let failed = 0;

async function check(name, fn) {
  try {
    await fn();
    console.log(`PASS  ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL  ${name}`);
    console.error(error.message || error);
  }
}

async function signUp(email) {
  const response = await fetch(`${AUTH}/accounts:signUp?key=${KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "test-pass", returnSecureToken: true })
  });
  const body = await response.json();
  if (!response.ok) throw new Error(`signUp ${email}: ${JSON.stringify(body)}`);
  return { uid: body.localId, token: body.idToken };
}

function dbUrl(path, token) {
  const auth = token ? `&auth=${encodeURIComponent(token)}` : "";
  return `${DB}/${path}.json?ns=${PROJECT}${auth}`;
}

async function adminWrite(path, value) {
  const response = await fetch(`${DB}/${path}.json?ns=${PROJECT}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer owner"
    },
    body: JSON.stringify(value)
  });
  if (!response.ok) {
    throw new Error(`admin write ${path}: ${response.status} ${await response.text()}`);
  }
}

async function req(method, path, { token, body, expect } = {}) {
  const response = await fetch(dbUrl(path, token), {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  if (response.status !== expect) {
    throw new Error(`${method} ${path} expected ${expect}, got ${response.status}: ${text}`);
  }
}

async function main() {
  const ada = await signUp("ada@test.com");
  const ben = await signUp("ben@test.com");
  const pat = await signUp("pat@test.com");

  await adminWrite(`users/${ada.uid}`, { name: "Ada", email: "ada@test.com", role: "learner" });
  await adminWrite(`users/${ben.uid}`, { name: "Ben", email: "ben@test.com", role: "learner" });
  await adminWrite(`users/${pat.uid}`, { name: "Pat", email: "pat@test.com", role: "assessor" });
  await adminWrite(`learnerIndex/${ada.uid}`, { name: "Ada", email: "ada@test.com" });
  await adminWrite(`tasks/${ada.uid}/t1`, taskFor(ada.uid));
  await adminWrite(`bookings/${ada.uid}/b1`, bookingFor(ada.uid));
  await adminWrite(`assessorInbox/bookings/b1`, bookingFor(ada.uid));
  await adminWrite("resources/r1", {
    title: "MDN Arrays",
    type: "Link",
    description: "Array methods",
    category: "JavaScript",
    createdBy: pat.uid,
    url: "https://developer.mozilla.org"
  });

  await check("learner can list own tasks", () => req("GET", `tasks/${ada.uid}`, { token: ada.token, expect: 200 }));
  await check("learner cannot list another learner's tasks", () => req("GET", `tasks/${ben.uid}`, { token: ada.token, expect: 401 }));
  await check("learner cannot list every task", () => req("GET", "tasks", { token: ada.token, expect: 401 }));
  await check("assessor can list a learner's tasks", () => req("GET", `tasks/${ada.uid}`, { token: pat.token, expect: 200 }));
  await check("assessor can assign a task to a learner", () => req("PUT", `tasks/${ada.uid}/assigned1`, {
    token: pat.token,
    body: { ...taskFor(ada.uid), title: "Assigned work", assignedBy: pat.uid, assignedByName: "Pat" },
    expect: 200
  }));
  await check("learner cannot assign into another learner path", () => req("PUT", `tasks/${ben.uid}/hack`, {
    token: ada.token,
    body: { ...taskFor(ben.uid), userId: ben.uid },
    expect: 401
  }));
  await check("signed-in user can list resources", () => req("GET", "resources", { token: ada.token, expect: 200 }));
  await check("learner cannot write resources", () => req("PUT", "resources/r2", {
    token: ada.token,
    body: { title: "Nope", type: "Link", description: "Should fail", category: "JavaScript", createdBy: ada.uid },
    expect: 401
  }));
  await check("assessor can list the learner roster", () => req("GET", "learnerIndex", { token: pat.token, expect: 200 }));
  await check("learner cannot list the learner roster", () => req("GET", "learnerIndex", { token: ada.token, expect: 401 }));
  await check("assessor can list the booking inbox", () => req("GET", "assessorInbox/bookings", { token: pat.token, expect: 200 }));
  await check("learner cannot list the booking inbox", () => req("GET", "assessorInbox/bookings", { token: ada.token, expect: 401 }));
  await check("learner can create a nested booking", () => req("PUT", `bookings/${ada.uid}/b2`, {
    token: ada.token,
    body: { ...bookingFor(ada.uid), topic: "Scope" },
    expect: 200
  }));
  await check("learner can copy a booking into the assessor inbox", () => req("PUT", "assessorInbox/bookings/b2", {
    token: ada.token,
    body: { ...bookingFor(ada.uid), topic: "Scope" },
    expect: 200
  }));
  await check("learner can cancel own pending booking", () => req("PATCH", `bookings/${ada.uid}/b1`, {
    token: ada.token,
    body: { status: "Cancelled" },
    expect: 200
  }));
  await check("learner cannot approve a booking", () => req("PATCH", `bookings/${ada.uid}/b2`, {
    token: ada.token,
    body: { status: "Approved" },
    expect: 401
  }));
  await check("assessor can save session notes", () => req("PATCH", `bookings/${ada.uid}/b2`, {
    token: pat.token,
    body: { notes: "Cover callbacks next.", meetingLink: "https://meet.example.com/session" },
    expect: 200
  }));
  await check("learner can write own quiz scores", () => req("PUT", `gameScores/${ada.uid}/s1`, {
    token: ada.token,
    body: { learnerId: ada.uid, score: 3, game: "JavaScript Quick Challenge", createdAt: Date.now() },
    expect: 200
  }));
  await check("learner can list own quiz scores", () => req("GET", `gameScores/${ada.uid}`, { token: ada.token, expect: 200 }));
  await check("learner cannot list another learner's scores", () => req("GET", `gameScores/${ada.uid}`, { token: ben.token, expect: 401 }));
  await check("guest cannot read tasks", () => req("GET", `tasks/${ada.uid}`, { expect: 401 }));

  if (failed) {
    console.error(`\n${failed} rules test(s) failed.`);
    process.exit(1);
  }

  console.log("\nAll rules tests passed.");
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
