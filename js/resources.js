import { auth, db } from "./firebase.js";
import {
  ref, onValue, push, set, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";
import { escapeHTML, showMessage } from "./app.js";

let resources = [];
let score = 0;
let questionIndex = 0;
const questions = [
  { q: "Which keyword declares a block-scoped variable that can be reassigned?", options: ["const", "let", "class", "return"], answer: 1 },
  { q: "Which array method creates a new array containing matching elements?", options: ["filter()", "push()", "pop()", "join()"], answer: 0 },
  { q: "What does typeof 42 return?", options: ["string", "boolean", "number", "object"], answer: 2 },
  { q: "Which symbol is used for strict equality?", options: ["=", "==", "===", "=>"], answer: 2 }
];

export function initResources() {
  document.addEventListener("userReady", ({ detail }) => {
    const user = detail.user;
    const content = document.getElementById("pageContent");

    content.innerHTML = `
      <div class="page-header">
        <div>
          <h2>Learning Resources & Mini-Game</h2>
          <p class="muted">Study available materials and practise your coding knowledge.</p>
        </div>
      </div>

      <section class="card">
        <h3>Learning Resources</h3>
        <div id="resourceList" class="grid resource-grid"></div>
      </section>

      <section class="card game" style="margin-top:18px;">
        <h3>JavaScript Quick Challenge</h3>
        <p id="gameStatus" class="muted">Answer the questions to record your score.</p>
        <div id="gameArea"></div>
      </section>
    `;

    onValue(ref(db, "resources"), snapshot => {
      const all = snapshot.val() || {};
      resources = Object.entries(all).map(([id, item]) => ({ id, ...item }));
      renderResources();
    });

    renderGame(user);
  });
}

function renderResources() {
  const list = document.getElementById("resourceList");
  if (!list) return;

  list.innerHTML = resources.length ? resources.map(item => `
    <article class="item">
      <span class="badge">${escapeHTML(item.type || "Resource")}</span>
      <h3>${escapeHTML(item.title)}</h3>
      <p class="muted">${escapeHTML(item.description || "")}</p>
      <div class="meta"><span>${escapeHTML(item.category || "General")}</span></div>
      ${item.url ? `<a class="btn secondary small" href="${escapeHTML(item.url)}" target="_blank" rel="noopener noreferrer">Open Resource</a>` : ""}
    </article>
  `).join("") : `<div class="empty" style="grid-column:1/-1;">No resources have been published yet.</div>`;
}

function renderGame(user) {
  const area = document.getElementById("gameArea");
  if (!area) return;

  if (questionIndex >= questions.length) {
    area.innerHTML = `
      <div class="game-question">Final Score: ${score}/${questions.length}</div>
      <button class="btn primary" id="restartGame">Play Again</button>
    `;
    saveScore(user);
    document.getElementById("restartGame").addEventListener("click", () => {
      score = 0;
      questionIndex = 0;
      renderGame(user);
    });
    return;
  }

  const current = questions[questionIndex];
  area.innerHTML = `
    <div class="game-question">${escapeHTML(current.q)}</div>
    <div class="choice-grid">
      ${current.options.map((option, index) =>
        `<button class="choice" data-answer="${index}">${escapeHTML(option)}</button>`
      ).join("")}
    </div>
  `;

  area.querySelectorAll(".choice").forEach(button => {
    button.addEventListener("click", () => {
      if (Number(button.dataset.answer) === current.answer) score++;
      questionIndex++;
      renderGame(user);
    });
  });
}

async function saveScore(user) {
  const scoreRef = push(ref(db, "gameScores"));
  try {
    await set(scoreRef, {
      learnerId: user.uid,
      score,
      game: "JavaScript Quick Challenge",
      createdAt: serverTimestamp()
    });
    document.getElementById("gameStatus").textContent = "Your result has been saved.";
  } catch (error) {
    console.error(error);
    document.getElementById("gameStatus").textContent = "Game completed, but the result could not be saved.";
  }
}
