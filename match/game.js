const $ = (sel) => /** @type {HTMLElement} */ (document.querySelector(sel));

const dropZone = $("#dropZone");
const silhouette = $("#silhouette");
const cards = $("#cards");
const feedback = $("#feedback");
const btnNext = $("#btnNext");
const placed = $("#placed");
const bgSelect = /** @type {HTMLSelectElement} */ ($("#bgSelect"));

// cast
const hero = $("#hero");
const buddy = $("#buddy");
const heroFace = /** @type {HTMLImageElement} */ ($("#heroFace"));
const buddyFace = /** @type {HTMLImageElement} */ ($("#buddyFace"));
const heroText = $("#heroText");
const buddyText = $("#buddyText");

// ===== state =====
let ITEMS = [];
let QUESTIONS = [];
let idx = 0;
let current = null;

// 正解後の「どこでもタッチで次へ」
let awaitingNextTap = false;
let nextTapAllowedAt = 0;

// idle talk
let idleTimer = null;

// grab talk cooldown
let lastGrabTalkAt = 0;

// talk queue
let talkChain = Promise.resolve();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function nowMs() {
  return (globalThis.performance && typeof performance.now === "function")
    ? performance.now()
    : Date.now();
}

function newUid() {
  if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `uid_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function rectContainsPoint(rect, x, y) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

// ===== images (characters) =====
const HERO = {
  normal: "./assets/characters/hero/normal.png",
  happy:  "./assets/characters/hero/happy.png",
  sad:    "./assets/characters/hero/sad.png",
};
const BUDDY = {
  normal: "./assets/characters/buddy/normal.png",
  happy:  "./assets/characters/buddy/happy.png",
  sad:    "./assets/characters/buddy/sad.png",
};

function setFace(who, mood) {
  if (who === "hero") heroFace.src = HERO[mood] || HERO.normal;
  if (who === "buddy") buddyFace.src = BUDDY[mood] || BUDDY.normal;
}

function quietHero(){ heroText.textContent = ""; }
function quietBuddy(){ buddyText.textContent = "…"; }

function sayHero(text, mood = "normal") {
  heroText.textContent = text;
  setFace("hero", mood);
}
function sayBuddy(text, mood = "normal") {
  buddyText.textContent = text;
  setFace("buddy", mood);
}

function heroThenBuddy(heroLine, heroMood, buddyLine, buddyMood, delayMs = 450) {
  talkChain = talkChain.then(async () => {
    sayHero(heroLine, heroMood);
    quietBuddy();
    await sleep(delayMs);
    sayBuddy(buddyLine, buddyMood);
    quietHero();
  });
  return talkChain;
}

function heroOnly(line, mood="normal"){
  talkChain = talkChain.then(async()=>{
    sayHero(line, mood);
    quietBuddy();
  });
}
function buddyOnly(line, mood="normal"){
  talkChain = talkChain.then(async()=>{
    sayBuddy(line, mood);
    quietHero();
  });
}

// ===== UI feedback =====
function setFeedback(text, ok) {
  feedback.textContent = text;
  feedback.style.color = ok ? "var(--good)" : (ok === false ? "var(--bad)" : "var(--muted)");
  feedback.classList.remove("pop");
  void feedback.offsetWidth;
  feedback.classList.add("pop");
}

// ===== motions =====
function poyon(el){
  el.classList.remove("poyon");
  void el.offsetWidth;
  el.classList.add("poyon");
}
function playMotion(el, cls){
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  const duration = cls === "joy" ? 800 : 650;
  setTimeout(()=> el.classList.remove(cls), duration);
}

// ===== idle talk =====
function resetIdleTalk() {
  if (idleTimer) clearTimeout(idleTimer);

  const ms = 9000 + Math.random() * 5000; // 9〜14秒
  idleTimer = setTimeout(() => {
    if (awaitingNextTap) {
      buddyOnly("…タッチで つぎ", "normal");
      return resetIdleTalk();
    }

    const heroLines = ["どれかな〜？","ゆっくり みてね！","かたちに ちゅうもく！","できるよ！"];
    const buddyLines = ["…あわてない","…へり（ふち）を みて","…それ ちがうかも","…ヒント：まるいとこ"];

    if (Math.random() < 0.60) {
      heroThenBuddy(
        heroLines[(Math.random()*heroLines.length)|0], "normal",
        "…うん", "normal",
        420
      );
    } else {
      buddyOnly(buddyLines[(Math.random()*buddyLines.length)|0], "normal");
    }
    resetIdleTalk();
  }, ms);
}

// 画面操作があったらidleリセット（連発防止）
document.addEventListener("pointerdown", () => resetIdleTalk(), { passive: true });
document.addEventListener("keydown", () => resetIdleTalk(), { passive: true });

// ===== data loading =====
async function loadJson(path){
  const res = await fetch(path, { cache: "no-cache" });
  if(!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return await res.json();
}

function buildQuestionsFromItems(items){
  const ids = items.map(x => x.id);
  const byId = new Map(items.map(x => [x.id, x]));

  function pick2Others(correctId){
    const others = ids.filter(x => x !== correctId);
    const s = shuffle(others);
    return s.slice(0, 2);
  }

  return items.map(it => {
    const otherIds = pick2Others(it.id);
    const cardIds = shuffle([it.id, ...otherIds]);

    return {
      id: `q_${it.id}`,
      correctCardId: it.id,
      // silhouette：画像
      silhouetteHtml: `
        <img class="sil-img"
             src="./assets/items/${it.dir}/silhouette.png"
             alt="${it.name}のシルエット" />
      `,
      // placed/candidates：画像
      cards: cardIds.map(cid => {
        const x = byId.get(cid);
        return {
          id: x.id,
          name: x.name,
          html: `
            <img class="item-img"
                 src="./assets/items/${x.dir}/image.png"
                 alt="${x.name}" />
          `
        };
      }),
    };
  });
}

// ===== backgrounds =====
async function setupBackgrounds(){
  const data = await loadJson("./assets/backgrounds/backgrounds.json");
  const list = data.backgrounds || [];

  bgSelect.innerHTML = "";
  for(const bg of list){
    const opt = document.createElement("option");
    opt.value = bg.id;
    opt.textContent = `背景：${bg.name}`;
    bgSelect.appendChild(opt);
  }

  const saved = localStorage.getItem("bgId") || "default";
  bgSelect.value = saved;

  function apply(bgId){
    const bg = list.find(x => x.id === bgId) || list[0];
    if(!bg || !bg.file){
      document.documentElement.style.setProperty("--bgImage", "none");
    }else{
      document.documentElement.style.setProperty("--bgImage", `url("./assets/backgrounds/${bg.file}")`);
    }
    localStorage.setItem("bgId", bgId);
  }

  bgSelect.addEventListener("change", () => apply(bgSelect.value));
  apply(bgSelect.value);
}

// ===== render =====
function renderQuestion(q) {
  current = q;

  awaitingNextTap = false;
  nextTapAllowedAt = 0;

  placed.innerHTML = "";
  silhouette.innerHTML = q.silhouetteHtml;
  setFeedback("", null);

  setFace("hero", "normal");
  setFace("buddy", "normal");

  heroThenBuddy("どれが はいるかな？", "normal", "…かたち みて", "normal", 480);

  cards.innerHTML = "";
  const list = q.cards;

  for (const c of list) {
    const el = document.createElement("div");
    el.className = "card";
    el.setAttribute("data-card-id", c.id);
    el.setAttribute("data-uid", newUid());
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", `カード ${c.name}`);
    el.innerHTML = c.html;
    cards.appendChild(el);

    enableDrag(el);
  }

  resetIdleTalk();
}

function goNextQuestion() {
  if (!QUESTIONS.length) return;
  idx = (idx + 1) % QUESTIONS.length;
  renderQuestion(QUESTIONS[idx]);
}

// ===== drag =====
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
    if (awaitingNextTap) return;

    resetIdleTalk();

    cardEl.setPointerCapture(e.pointerId);
    dragging = true;
    pointerId = e.pointerId;

    makeGhost(e.clientX, e.clientY);
    cardEl.style.opacity = "0.35";

    // 掴んだ瞬間コメント（連発防止）
    const t = nowMs();
    if (t - lastGrabTalkAt > 1200) {
      lastGrabTalkAt = t;

      const heroLines = ["それかな？", "もっていこう！", "そーっとね", "いいよ！"];
      const buddyLines = ["…ゆっくり", "…おちついて", "…それ？", "…たぶん ちがう"];

      heroThenBuddy(
        heroLines[(Math.random()*heroLines.length)|0], "normal",
        buddyLines[(Math.random()*buddyLines.length)|0], "normal",
        380
      );
    }
  });

  cardEl.addEventListener("pointermove", (e) => {
    if (!dragging || e.pointerId !== pointerId) return;
    moveGhost(e.clientX, e.clientY);
  });

  const endDrag = (e) => {
    if (!dragging || e.pointerId !== pointerId) return;
    dragging = false;

    cardEl.style.opacity = "1";
    removeGhost();

    const dz = dropZone.getBoundingClientRect();
    const inside = rectContainsPoint(dz, e.clientX, e.clientY);
    if (!inside) return;

    const id = cardEl.getAttribute("data-card-id");
    applyDropResult(id, cardEl, true);
  };

  cardEl.addEventListener("pointerup", endDrag);
  cardEl.addEventListener("pointercancel", endDrag);
}

// ===== drop logic =====
function applyDropResult(cardId, cardEl, fromUserDrag = false) {
  const ok = cardId === current.correctCardId;

  if (ok) {
    awaitingNextTap = true;
    nextTapAllowedAt = nowMs() + (fromUserDrag ? 350 : 0);

    setFeedback("せいかい！", true);

    heroThenBuddy(
      "やったー！ せいかい！\nどこでも タッチで つぎへ", "happy",
      "…やるじゃん", "happy",
      520
    );

    playMotion(hero, "joy");
    playMotion(buddy, "joy");

    placed.innerHTML = cardEl.innerHTML;
    cardEl.remove();

    dropZone.classList.remove("shake");
    return true;
  } else {
    setFeedback("ちがうよ", false);

    heroThenBuddy(
      "だいじょうぶ！\nもういちど やってみよう", "sad",
      "…ちがうかも", "sad",
      520
    );

    playMotion(hero, "sad");
    playMotion(buddy, "sad");

    dropZone.classList.remove("shake");
    void dropZone.offsetWidth;
    dropZone.classList.add("shake");
    return false;
  }
}

// ===== next button =====
btnNext.addEventListener("click", () => goNextQuestion());

// 正解後：どこでもタッチで次へ（btnNextは除外）
document.addEventListener("pointerdown", (e) => {
  if (!awaitingNextTap) return;

  const target = /** @type {HTMLElement} */ (e.target);
  if (target && target.id === "btnNext") return;
  if (nowMs() < nextTapAllowedAt) return;

  awaitingNextTap = false;
  goNextQuestion();
}, { passive: true });

// ===== character reactions =====
function reactHero() {
  if (awaitingNextTap) {
    heroOnly("つぎ いこー！", "happy");
    awaitingNextTap = false;
    setTimeout(() => goNextQuestion(), 220);
  } else {
    const lines = ["できるよ！","ゆっくり みてね","あわてなくて だいじょうぶ","どれかな〜？"];
    heroOnly(lines[(Math.random() * lines.length) | 0], "normal");
  }
}
function reactBuddy() {
  if (awaitingNextTap) {
    buddyOnly("…つぎ", "happy");
    awaitingNextTap = false;
    setTimeout(() => goNextQuestion(), 220);
  } else {
    const lines = ["…かたち ちがうよ","…まるいところ ある？","…よく みて","…ヒント：かげの へり"];
    buddyOnly(lines[(Math.random() * lines.length) | 0], "normal");
  }
}

hero.addEventListener("pointerdown", (e) => { e.stopPropagation(); resetIdleTalk(); poyon(hero); reactHero(); });
buddy.addEventListener("pointerdown", (e) => { e.stopPropagation(); resetIdleTalk(); poyon(buddy); reactBuddy(); });

hero.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); poyon(hero); reactHero(); resetIdleTalk(); }
});
buddy.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); poyon(buddy); reactBuddy(); resetIdleTalk(); }
});

// ===== AI test API (Playwright compatible) =====
let aiGhost = null;

function aiGhostEnsureByCardId(cardId) {
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

window.__GAME__ = {
  getQuestionId: () => current?.id ?? "none",
  listCards: () => Array.from(document.querySelectorAll(".card")).map(el => ({
    id: el.getAttribute("data-card-id"),
    uid: el.getAttribute("data-uid"),
  })),

  aiGhostShow: (cardId, x, y) => {
    const g = aiGhostEnsureByCardId(cardId);
    if (!g) return false;
    aiGhostMove(x, y);
    return true;
  },
  aiGhostMove: (x, y) => { aiGhostMove(x, y); return true; },
  aiGhostHide: () => { aiGhostHide(); return true; },

  dropCardById: (cardId) => {
    const cardEl = document.querySelector(`.card[data-card-id="${cardId}"]`);
    if (!cardEl) {
      setFeedback("（うまくつかめなかった）", false);
      buddyOnly("…つかめてない", "sad");
      playMotion(buddy, "sad");
      return "missing";
    }
    return applyDropResult(cardId, cardEl, false) ? "ok" : "ng";
  },

  dropCardByUid: (uid) => {
    const cardEl = document.querySelector(`.card[data-uid="${uid}"]`);
    if (!cardEl) {
      setFeedback("（うまくつかめなかった）", false);
      buddyOnly("…つかめてない", "sad");
      playMotion(buddy, "sad");
      return "missing";
    }
    const cardId = cardEl.getAttribute("data-card-id");
    return applyDropResult(cardId, cardEl, false) ? "ok" : "ng";
  },
};

// ===== init =====
async function init(){
  // 背景
  await setupBackgrounds();

  // items
  const itemsData = await loadJson("./assets/items/items.json");
  ITEMS = itemsData.items || [];

  // 3つ以上ないと3択が作れないのでガード
  if (ITEMS.length < 3) {
    setFeedback("itemsが3つ以上必要です", false);
    heroOnly("えが すくないみたい…", "sad");
    buddyOnly("…3こ いれて", "sad");
    return;
  }

  QUESTIONS = buildQuestionsFromItems(ITEMS);
  idx = 0;
  renderQuestion(QUESTIONS[idx]);
}

init().catch(err => {
  console.error(err);
  setFeedback("読み込みエラー（コンソール確認）", false);
});
