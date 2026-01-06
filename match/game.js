import { QUESTIONS } from "./questions.js";

const $ = (sel) => /** @type {HTMLElement} */ (document.querySelector(sel));

const dropZone = $("#dropZone");
const silhouette = $("#silhouette");
const cards = $("#cards");
const feedback = $("#feedback");
const btnNext = $("#btnNext");
const placed = $("#placed");

let idx = 0;
let current = QUESTIONS[idx];

/** Utility */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function setFeedback(text, ok) {
  feedback.textContent = text;
  feedback.style.color = ok ? "var(--good)" : (ok === false ? "var(--bad)" : "var(--text)");
  feedback.classList.remove("pop");
  void feedback.offsetWidth;
  feedback.classList.add("pop");
}

function rectContainsPoint(rect, x, y) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

/** Render */
function renderQuestion(q) {
  current = q;
  placed.innerHTML = "";
  silhouette.innerHTML = q.silhouetteSvg;

  setFeedback("", null);

  cards.innerHTML = "";
  const list = shuffle(q.cards);

  for (const c of list) {
    const el = document.createElement("div");
    el.className = "card";
    el.setAttribute("data-card-id", c.id);
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", `カード ${c.id}`);
    el.innerHTML = c.svg;
    cards.appendChild(el);
    enableDrag(el);
  }
}

/** Manual drag (Pointer Events) */
function enableDrag(cardEl) {
  let dragging = false;
  let pointerId = null;
  let ghost = null;

  const makeGhost = (x, y) => {
    ghost = document.createElement("div");
    ghost.className = "drag-ghost";
    ghost.innerHTML = cardEl.innerHTML;
    document.body.appendChild(ghost);
    ghost.style.left = `${x}px`;
    ghost.style.top = `${y}px`;
  };

  const moveGhost = (x, y) => {
    if (!ghost) return;
    ghost.style.left = `${x}px`;
    ghost.style.top = `${y}px`;
  };

  const removeGhost = () => {
    if (!ghost) return;
    ghost.remove();
    ghost = null;
  };

  cardEl.addEventListener("pointerdown", (e) => {
    cardEl.setPointerCapture(e.pointerId);

    dragging = true;
    pointerId = e.pointerId;

    makeGhost(e.clientX, e.clientY);

    cardEl.classList.add("dragging");
    cardEl.style.opacity = "0.35";
  });

  cardEl.addEventListener("pointermove", (e) => {
    if (!dragging || e.pointerId !== pointerId) return;
    moveGhost(e.clientX, e.clientY);
  });

  const endDrag = (e) => {
    if (!dragging || e.pointerId !== pointerId) return;
    dragging = false;

    cardEl.classList.remove("dragging");
    cardEl.style.opacity = "1";
    removeGhost();

    const dz = dropZone.getBoundingClientRect();
    const inside = rectContainsPoint(dz, e.clientX, e.clientY);
    if (!inside) return;

    const id = cardEl.getAttribute("data-card-id");
    applyDropResult(id, cardEl);
  };

  cardEl.addEventListener("pointerup", endDrag);
  cardEl.addEventListener("pointercancel", endDrag);
}

/** Shared drop logic (manual + AI) */
function applyDropResult(cardId, cardEl) {
  const ok = cardId === current.correctCardId;

  if (ok) {
    setFeedback("せいかい！", true);

    // ✅ 正解後は「カード枠」ではなく「絵（SVG）だけ」を大サイズで置く
    placed.innerHTML = cardEl.innerHTML;

    // 選択肢からは消す（レイアウトが気になるなら remove をやめて opacity にしてもOK）
    cardEl.remove();

    dropZone.classList.remove("shake");
    return true;
  } else {
    setFeedback("ちがうよ", false);

    dropZone.classList.remove("shake");
    void dropZone.offsetWidth;
    dropZone.classList.add("shake");
    return false;
  }
}


/** AI ghost controls (for video-friendly “dragging”) */
let aiGhost = null;

function aiGhostEnsure(cardId) {
  const cardEl = document.querySelector(`.card[data-card-id="${cardId}"]`);
  if (!cardEl) return null;

  if (!aiGhost) {
    aiGhost = document.createElement("div");
    aiGhost.className = "drag-ghost";
    aiGhost.setAttribute("data-ai-ghost", "1");
    document.body.appendChild(aiGhost);
  }
  aiGhost.innerHTML = cardEl.innerHTML;
  aiGhost.style.display = "grid";
  return aiGhost;
}

function aiGhostMove(x, y) {
  if (!aiGhost) return;
  aiGhost.style.left = `${x}px`;
  aiGhost.style.top = `${y}px`;
}

function aiGhostHide() {
  if (!aiGhost) return;
  aiGhost.style.display = "none";
}

/** Next */
btnNext.addEventListener("click", () => {
  idx = (idx + 1) % QUESTIONS.length;
  renderQuestion(QUESTIONS[idx]);
});

/** Initial */
renderQuestion(current);

/** Expose test APIs */
window.__GAME__ = {
  getQuestionId: () => current.id,

  // Find current visible card ids (for tests)
  listCardIds: () => Array.from(document.querySelectorAll(".card")).map(el => el.getAttribute("data-card-id")),

  // AI: show/move/hide ghost
  aiGhostShow: (cardId, x, y) => {
    const g = aiGhostEnsure(cardId);
    if (!g) return false;
    aiGhostMove(x, y);
    return true;
  },
  aiGhostMove: (x, y) => {
    aiGhostMove(x, y);
    return true;
  },
  aiGhostHide: () => {
    aiGhostHide();
    return true;
  },

  // AI: do the actual drop (re-uses same logic as manual)
  dropCardById: (cardId) => {
    const cardEl = document.querySelector(`.card[data-card-id="${cardId}"]`);
    if (!cardEl) return false;
    return applyDropResult(cardId, cardEl);
  }
};
