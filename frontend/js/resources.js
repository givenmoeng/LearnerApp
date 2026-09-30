import { db } from "./firebase.js";
import {
  ref, onValue, push, set, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";
import { escapeHTML, formatDate, recordsFrom } from "./app.js";

let resources = [];
let scores = [];
let score = 0;
let questionIndex = 0;
let pickedIndex = null;
let scoreSaved = false;

const questions = [
  { q: "Which keyword declares a block-scoped variable that can be reassigned?", options: ["const", "let", "class", "return"], answer: 1, why: "let creates a block-scoped variable that you can assign again later." },
  { q: "Which array method creates a new array containing matching elements?", options: ["filter()", "push()", "pop()", "join()"], answer: 0, why: "filter() returns a new array with every item that passes the test." },
  { q: "What does typeof 42 return?", options: ["string", "boolean", "number", "object"], answer: 2, why: "Numbers have the type \"number\" in JavaScript." },
  { q: "Which symbol is used for strict equality?", options: ["=", "==", "===", "=>"], answer: 2, why: "=== compares value and type without coercion." }
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

      <div class="grid dashboard-panels" style="margin-top:18px;">
        <section class="card game">
          <h3>JavaScript Quick Challenge</h3>
          <p id="gameStatus" class="muted">Answer the questions. You will see whether each choice is right before moving on.</p>
          <div id="gameArea"></div>
        </section>

        <section class="card">
          <h3>Your scores</h3>
          <div id="scoreHistory" class="task-list"></div>
        </section>
      </div>
    `;

    onValue(ref(db, "resources"), snapshot => {
      resources = recordsFrom(snapshot);
      renderResources();
    });

    onValue(ref(db, `gameScores/${user.uid}`), snapshot => {
      scores = recordsFrom(snapshot).sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
      renderScores();
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

function renderScores() {
  const list = document.getElementById("scoreHistory");
  if (!list) return;

  if (!scores.length) {
    list.innerHTML = `<div class="empty">No saved scores yet. Finish a challenge to record one.</div>`;
    return;
  }

  const best = scores.reduce((max, item) => Math.max(max, Number(item.score || 0)), 0);
  list.innerHTML = `
    <p class="muted">Best score: <strong>${best}/${questions.length}</strong></p>
    ${scores.map(item => `
      <div class="item">
        <div class="item-head">
          <h3>${escapeHTML(String(item.score))}/${questions.length}</h3>
          <span class="badge">${formatDate(item.createdAt)}</span>
        </div>
        <p class="muted">${escapeHTML(item.game || "Quiz")}</p>
      </div>
    `).join("")}
  `;
}

function renderGame(user) {
  const area = document.getElementById("gameArea");
  if (!area) return;

  if (questionIndex >= questions.length) {
    area.innerHTML = `
      <div class="game-question">Final Score: ${score}/${questions.length}</div>
      <p class="muted">${score === questions.length ? "Every answer was correct." : "Review the explanations and try again."}</p>
      <button class="btn primary" id="restartGame">Play Again</button>
    `;
    if (!scoreSaved) {
      scoreSaved = true;
      saveScore(user);
    }
    document.getElementById("restartGame").addEventListener("click", () => {
      score = 0;
      questionIndex = 0;
      pickedIndex = null;
      scoreSaved = false;
      renderGame(user);
    });
    return;
  }

  const current = questions[questionIndex];
  const revealed = pickedIndex !== null;

  area.innerHTML = `
    <p class="muted">Question ${questionIndex + 1} of ${questions.length}</p>
    <div class="game-question">${escapeHTML(current.q)}</div>
    <div class="choice-grid">
      ${current.options.map((option, index) => {
        let klass = "choice";
        if (revealed && index === current.answer) klass += " correct";
        if (revealed && index === pickedIndex && index !== current.answer) klass += " wrong";
        return `<button class="${klass}" data-answer="${index}" ${revealed ? "disabled" : ""}>${escapeHTML(option)}</button>`;
      }).join("")}
    </div>
    ${revealed ? `<p class="${pickedIndex === current.answer ? "message success" : "message error"}">${pickedIndex === current.answer ? "Correct." : "Not quite."} ${escapeHTML(current.why)}</p>
      <button class="btn primary" id="nextQuestion">${questionIndex + 1 >= questions.length ? "See score" : "Next question"}</button>` : ""}
  `;

  area.querySelectorAll(".choice").forEach(button => {
    button.addEventListener("click", () => {
      pickedIndex = Number(button.dataset.answer);
      if (pickedIndex === current.answer) score++;
      renderGame(user);
    });
  });

  document.getElementById("nextQuestion")?.addEventListener("click", () => {
    questionIndex++;
    pickedIndex = null;
    renderGame(user);
  });
}

async function saveScore(user) {
  try {
    await set(push(ref(db, `gameScores/${user.uid}`)), {
      learnerId: user.uid,
      score,
      game: "JavaScript Quick Challenge",
      createdAt: serverTimestamp()
    });
    const status = document.getElementById("gameStatus");
    if (status) status.textContent = "Your result has been saved to your score history.";
  } catch (error) {
    console.error(error);
    const status = document.getElementById("gameStatus");
    if (status) status.textContent = "Game completed, but the result could not be saved.";
  }
}
