// =====================
// 0) SOCKET.IO CLIENTE (estado compartido)
// =====================
const socket = io(); // viene de <script src="/socket.io/socket.io.js">

// Palabras compartidas por grupo y línea
let sharedState = {}; // { [groupId]: { [lineIndex]: "word" } }

// Estado inicial que viene del servidor (espera hasta que el DOM esté listo)
let pendingInitState = null;

// Timer (solo mostramos lo que manda el servidor)
let timerStarted = false;
let remainingSeconds = 600;

// =====================
// 1) PLANTILLAS BASE (solo guardan el patrón de rima)
// =====================
const BASE_TEMPLATES = [
  { prefix: "", rhymeGroup: "A" },
  { prefix: "", rhymeGroup: "B" },
  { prefix: "", rhymeGroup: "A" },
  { prefix: "", rhymeGroup: "B" },
  { prefix: "", rhymeGroup: "C" },
  { prefix: "", rhymeGroup: "D" },
  { prefix: "", rhymeGroup: "C" },
  { prefix: "", rhymeGroup: "D" },
  { prefix: "", rhymeGroup: "E" },
  { prefix: "", rhymeGroup: "F" }, // patrón EFEF
  { prefix: "", rhymeGroup: "E" },
  { prefix: "", rhymeGroup: "F" },
  { prefix: "", rhymeGroup: "G" },
  { prefix: "", rhymeGroup: "G" },
];

// =====================
// 1b) POEMAS COMPLETOS POR TEMA (UN SONETO BASE POR TEMA)
// =====================
const TOPIC_TEMPLATES = {
  love: [
    "Under the streetlights, I remember your",
    "My morning starts with whispers of your",
    "I trace the outline of your distant",
    "The city softens when I think about",
    "Old songs awaken every buried",
    "My empty hands still reach across the",
    "Each careless joke we shared becomes a",
    "The crowded room falls silent at your",
    "I walk past places that still taste like",
    "I save my bravest thoughts to give to",
    "The years grow gentle when I speak of",
    "Even my fears lean forward toward your",
    "So if this fragile poem protects our",
    "Let every broken line fall back to",
  ],

  war: [
    "Smoke curls like questions over ruined",
    "The marching rhythm drills into the",
    "Children learn maps by tracing lines of",
    "We paint our borders red with borrowed",
    "The radio repeats the names of",
    "My heavy boots remember other",
    "Each flag that rises hides a quiet",
    "The victory speech rehearses ancient",
    "Night vision screens turn faces into",
    "I barter mercy for a safer",
    "Old generals dream of glory in their",
    "The silence after gunfire feels like",
    "So write this record down before the",
    "And let the ink outlive the bitter",
  ],

  time: [
    "Clocks bloom like flowers on the kitchen",
    "Morning forgets the stories of the",
    "I find old versions of myself in",
    "Dust gathers slowly on the open",
    "The calendar is full of tiny",
    "My coffee cools while I am counting",
    "Each second slips between my waiting",
    "The echo of your laughter haunts the",
    "We plan our futures on the fragile",
    "I trade tomorrow for a clearer",
    "The past leans forward like a curious",
    "The present trembles, balancing on",
    "So let this line hold still a fleeting",
    "Before it breaks and falls into the",
  ],

  power: [
    "Gold threads are woven through the royal",
    "A single signature can shift a",
    "We learn to smile politely at the",
    "The tallest towers cast the longest",
    "Whispers grow louder in the velvet",
    "My careful mask becomes a second",
    "Each closed-door meeting births a hidden",
    "The loyal nod can hide a quiet",
    "We raise our glasses to the shining",
    "I trade my silence for a sharper",
    "The throne remembers every fallen",
    "Crowds change their heroes with a sudden",
    "So if this verse can puncture gilded",
    "Let language turn to light inside the",
  ],

  death: [
    "White lilies faint against the waiting",
    "The doctor folds his notes and leaves the",
    "We count the breaths that tremble in the",
    "Old photographs grow softer at the",
    "Your favorite sweater hangs inside the",
    "My tongue forgets the tense to speak of",
    "Each empty chair preserves a certain",
    "The house relearns the language of the",
    "We talk too loudly not to hear the",
    "I offer jokes instead of naming",
    "The quiet after tears becomes a",
    "Our borrowed days line up like fragile",
    "So let this page make peace with finite",
    "And teach my frightened hands to welcome",
  ],

  betrayal: [
    "You kept your smile steady while the",
    "The secret slipped out slowly through the",
    "We toasted futures knowing all the",
    "Your careful stories hid a missing",
    "The messages grew shorter as the",
    "My trusting voice grew quiet at your",
    "Each promise shattered into jagged",
    "We learned new meanings for the word",
    "The mirror flinches when I say your",
    "I practice answers for the curious",
    "The truth walks barefoot over broken",
    "Forgiveness waits but will not close the",
    "So if this stanza stitches up the",
    "May I step forward without saying",
  ],
};

const rankLabels = ["FIRST PLACE", "SECOND PLACE", "THIRD PLACE", "FOURTH PLACE"];
let firstWinner = null; // primer grupo que completa perfecto (rank 1 asignado)

// =====================
// 2) GENERAR SONETO
// =====================
function createSonnetLines(container, topic) {
  container.innerHTML = "";

  const topicLines = TOPIC_TEMPLATES[topic] || TOPIC_TEMPLATES["love"];

  const templates = BASE_TEMPLATES.map((t, index) => {
    const copy = { ...t };
    copy.prefix = topicLines[index] || "";
    return copy;
  });

  templates.forEach((tpl, idx) => {
    const lineDiv = document.createElement("div");
    lineDiv.className = "sonnet-line";

    const num = document.createElement("div");
    num.className = "line-number";
    num.textContent = idx + 1;

    const text = document.createElement("div");
    text.className = "line-text";

    const prefixSpan = document.createElement("span");
    prefixSpan.textContent = tpl.prefix + " ";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "blank-input";
    input.setAttribute("data-rhyme-group", tpl.rhymeGroup);
    input.setAttribute("data-line-index", idx);
    input.setAttribute("placeholder", "word");

    text.appendChild(prefixSpan);
    text.appendChild(input);

    lineDiv.appendChild(num);
    lineDiv.appendChild(text);
    container.appendChild(lineDiv);
  });
}

// =====================
// 2b) SOCKET: INPUTS
// =====================
function attachInputListeners(card) {
  const groupId = card.dataset.player;
  const inputs = card.querySelectorAll(".blank-input");

  inputs.forEach((input) => {
    input.addEventListener("input", () => {
      const lineIndex = parseInt(input.dataset.lineIndex, 10);
      const value = input.value;

      if (!sharedState[groupId]) sharedState[groupId] = {};
      sharedState[groupId][lineIndex] = value;

      socket.emit("updateWord", { groupId, lineIndex, value });
    });
  });
}

function prefillFromSharedStateForCard(card) {
  const groupId = card.dataset.player;
  const groupState = sharedState[groupId];
  if (!groupState) return;

  const inputs = card.querySelectorAll(".blank-input");
  inputs.forEach((input) => {
    const idx = parseInt(input.dataset.lineIndex, 10);
    if (groupState[idx] !== undefined) {
      input.value = groupState[idx];
    }
  });
}

// =====================
// 3) CHECK RIMAS + DUPLICADOS
// =====================
function getWordSuffixes(word) {
  if (!word) return null;
  const clean = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!clean) return null;
  const last2 = clean.slice(-2);
  const last3 = clean.length >= 3 ? clean.slice(-3) : null;
  return { last2, last3 };
}

function checkSonnet(card) {
  const inputs = Array.from(card.querySelectorAll(".blank-input"));

  inputs.forEach((input) =>
    input.classList.remove("correct", "wrong", "duplicate")
  );

  let allFilled = true;
  let allCorrect = true;

  const groupSuffixes = {};
  const groupHasError = {};
  const wordMap = {};

  inputs.forEach((input) => {
    const group = input.dataset.rhymeGroup;
    const value = input.value.trim();

    if (!groupSuffixes[group]) {
      groupSuffixes[group] = [];
      groupHasError[group] = false;
    }

    if (!value) {
      allFilled = false;
      groupHasError[group] = true;
      groupSuffixes[group].push(null);
      return;
    }

    const suffixes = getWordSuffixes(value);
    if (!suffixes) {
      groupHasError[group] = true;
      groupSuffixes[group].push(null);
      return;
    }

    groupSuffixes[group].push(suffixes);

    const norm = value.toLowerCase().replace(/[^a-z]/g, "");
    if (norm) {
      if (!wordMap[norm]) wordMap[norm] = [];
      wordMap[norm].push(input);
    }
  });

  const groupIsCorrect = {};
  Object.keys(groupSuffixes).forEach((group) => {
    const arr = groupSuffixes[group];

    if (groupHasError[group] || arr.some((s) => !s)) {
      groupIsCorrect[group] = false;
      allCorrect = false;
      return;
    }

    let ok = false;

    const allHaveLast3 = arr.every((s) => s.last3);
    if (allHaveLast3) {
      const first3 = arr[0].last3;
      ok = arr.every((s) => s.last3 === first3);
    }

    if (!ok) {
      const first2 = arr[0].last2;
      ok = arr.every((s) => s.last2 === first2);
    }

    groupIsCorrect[group] = ok;
    if (!ok) allCorrect = false;
  });

  const duplicateWords = new Set();
  Object.keys(wordMap).forEach((norm) => {
    if (wordMap[norm].length > 1) {
      duplicateWords.add(norm);
    }
  });
  if (duplicateWords.size > 0) {
    allCorrect = false;
  }

  inputs.forEach((input) => {
    const group = input.dataset.rhymeGroup;
    const valueNorm = input.value.trim().toLowerCase().replace(/[^a-z]/g, "");

    if (groupIsCorrect[group]) {
      input.classList.add("correct");
    } else {
      input.classList.add("wrong");
    }

    if (valueNorm && duplicateWords.has(valueNorm)) {
      input.classList.add("duplicate");
    }
  });

  const status = card.querySelector(".status");
  const groupId = card.dataset.player;

  if (!allFilled) {
    status.textContent = "Some blanks are empty. Fill them all.";
    status.className = "status bad";
  } else if (allCorrect) {
    status.textContent =
      "Perfect rhyme scheme! Now check the syllables like a real Shakespearean poet.";
    status.className = "status good";

    if (!card.dataset.rank) {
      socket.emit("requestRank", { groupId });
    }
  } else {
    if (duplicateWords.size > 0) {
      status.textContent =
        "Rhyme groups are not matching, or some words are repeated. Use different endings.";
    } else {
      status.textContent =
        "Rhyme groups are not matching yet. Adjust the endings (ABAB CDCD EFEF GG).";
    }
    status.className = "status bad";
  }
}

// =====================
// 4) TIMER (Muestra lo que manda el servidor)
// =====================
function updateTimerDisplay() {
  const el = document.getElementById("global-timer");
  if (!el) return;
  const m = Math.floor(remainingSeconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (remainingSeconds % 60).toString().padStart(2, "0");
  el.textContent = `${m}:${s}`;
}

function handleTimeUp() {
  const timerEl = document.getElementById("global-timer");
  if (timerEl) {
    timerEl.classList.add("time-up");
  }

  const cards = document.querySelectorAll(".player-card");
  let bestScore = -1;
  let bestCards = [];

  cards.forEach((card) => {
    const sonnetContainer = card.querySelector("[data-lines]");
    if (!sonnetContainer.children.length) return;

    checkSonnet(card);

    const correctInputs = card.querySelectorAll(".blank-input.correct").length;

    if (correctInputs > bestScore) {
      bestScore = correctInputs;
      bestCards = [card];
    } else if (correctInputs === bestScore) {
      bestCards.push(card);
    }
  });

  if (!timerEl) return;

  const rank1Cards = Array.from(cards).filter(
    (c) => parseInt(c.dataset.rank || "0", 10) === 1
  );

  if (rank1Cards.length > 0) {
    const names = rank1Cards.map((c) => {
      const n =
        c.querySelector(".player-name").textContent.trim() ||
        `Group ${c.dataset.player}`;
      return n;
    });

    if (rank1Cards.length === 1) {
      timerEl.textContent = `Time's up! Winner: ${names[0]}.`;
    } else {
      timerEl.textContent = `Time's up! Tie for first place: ${names.join(
        " & "
      )}.`;
    }
  } else if (bestScore > 0 && bestCards.length) {
    const names = bestCards.map((c) => {
      const n =
        c.querySelector(".player-name").textContent.trim() ||
        `Group ${c.dataset.player}`;
      return n;
    });

    if (bestCards.length === 1) {
      timerEl.textContent = `Time's up! Best attempt: ${names[0]} with ${bestScore} correct rhymes.`;
    } else {
      timerEl.textContent = `Time's up! Multiple groups tied with ${bestScore} correct rhymes.`;
    }
  } else {
    timerEl.textContent = "Time's up! No rhymes completed 😅";
  }
}

// =====================
// 5) PDF LINDO
// =====================
function openPrettyPdf(card, topic) {
  const name =
    card.querySelector(".player-name").textContent.trim() || "Group";

  const lines = [];
  const lineNodes = card.querySelectorAll(".sonnet-line");

  lineNodes.forEach((lineDiv) => {
    const textDiv = lineDiv.querySelector(".line-text");
    const prefixText = textDiv.childNodes[0].textContent.trim();
    const input = textDiv.querySelector("input");
    const lastWord = (input && input.value.trim()) || "______";
    lines.push(prefixText + " " + lastWord);
  });

  const THEMES = {
    love: { accent: "#ef4444", accentSoft: "#fee2e2", bg: "#fef2f2", icon: "❤️" },
    war: { accent: "#b91c1c", accentSoft: "#fee2e2", bg: "#fef2f2", icon: "⚔️" },
    time: { accent: "#0ea5e9", accentSoft: "#e0f2fe", bg: "#f0f9ff", icon: "⏳" },
    power: { accent: "#f59e0b", accentSoft: "#fef3c7", bg: "#fffbeb", icon: "👑" },
    death: { accent: "#4b5563", accentSoft: "#e5e7eb", bg: "#f9fafb", icon: "💀" },
    betrayal: { accent: "#7c2d12", accentSoft: "#fed7aa", bg: "#fff7ed", icon: "🗡️" },
    default: { accent: "#111827", accentSoft: "#e5e7eb", bg: "#f3f4f6", icon: "✒️" },
  };

  const topicKey = topic || "default";
  const theme = THEMES[topicKey] || THEMES.default;

  const iconRow = new Array(18).fill(theme.icon).join(" ");
  const niceTopic = topicKey.charAt(0).toUpperCase() + topicKey.slice(1);

  const win = window.open("", "_blank");
  if (!win) return;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Sonnet – ${name}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{
      font-family: system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      background:${theme.bg};
      padding:40px 0;
    }
    .page{
      width:800px;
      margin:0 auto;
      background:#ffffff;
      border-radius:24px;
      border:2px solid ${theme.accentSoft};
      padding:40px 60px 36px;
      box-shadow:0 20px 50px rgba(0,0,0,0.12);
      position:relative;
      overflow:hidden;
    }
    .page::before{
      content:"${theme.icon}";
      position:absolute;
      font-size:180px;
      opacity:0.06;
      right:-10px;
      bottom:-40px;
    }
    h1{
      text-align:center;
      font-size:1.9rem;
      letter-spacing:.18em;
      text-transform:uppercase;
      margin-bottom:6px;
      color:${theme.accent};
    }
    .meta{
      text-align:center;
      font-size:0.9rem;
      color:#4b5563;
      margin-bottom:16px;
    }
    .meta span{
      font-weight:600;
      color:#111827;
    }
    .decor{
      text-align:center;
      font-size:1.1rem;
      margin-bottom:18px;
      color:${theme.accent};
      word-wrap:break-word;
    }
    .lines{
      margin-top:6px;
    }
    .line{
      font-size:1rem;
      margin-bottom:6px;
      line-height:1.45;
      color:#111827;
    }
    .line-num{
      display:inline-block;
      width:22px;
      color:#9ca3af;
    }
    .footer{
      margin-top:24px;
      font-size:0.85rem;
      text-align:right;
      color:#6b7280;
    }
    @media print{
      body{background:white;padding:0;}
      .page{
        box-shadow:none;
        border-radius:0;
        width:100%;
        margin:0;
        padding:40px;
      }
      .decor{margin-bottom:10px;}
    }
  </style>
</head>
<body>
  <div class="page">
    <h1>SHAKESPEAREAN SONNET</h1>
    <div class="meta">
      Written by <span>${name}</span> · Topic: <span>${niceTopic}</span>
    </div>
    <div class="decor">${iconRow}</div>
    <div class="lines">
      ${lines
        .map(
          (l, i) =>
            `<p class="line"><span class="line-num">${i + 1}.</span> ${l}</p>`
        )
        .join("")}
    </div>
    <div class="footer">
      Rhyme pattern ABAB CDCD EFEF GG
    </div>
  </div>
</body>
</html>`;

  win.document.open();
  win.document.write(html);
  win.document.close();

  win.onload = () => {
    win.focus();
    win.print();
  };
}

// =====================
// 6) APLICAR ESTADO INICIAL QUE VIENE DEL SERVER
// =====================
function applyInitStateIfReady() {
  if (!pendingInitState) return;

  const cards = document.querySelectorAll(".player-card");
  if (!cards.length) return;

  const state = pendingInitState;

  // Palabras
  sharedState = {};
  Object.keys(state.groups || {}).forEach((gid) => {
    sharedState[gid] = state.groups[gid].words || {};
  });

  // Timer
  remainingSeconds = state.timer?.remainingSeconds ?? 600;
  timerStarted = !!state.timer?.started;
  updateTimerDisplay();

  // Topics ya usados: deshabilitar en selects
  const usedTopics = state.usedTopics || [];
  usedTopics.forEach((topic) => {
    document.querySelectorAll(".topic-select").forEach((sel) => {
      const opt = sel.querySelector(`option[value="${topic}"]`);
      if (opt) opt.disabled = true;
    });
  });

  // Reconstruir cada card
  cards.forEach((card) => {
    const groupId = card.dataset.player;
    const groupData = state.groups[groupId];
    if (!groupData) return;

    const nameDiv = card.querySelector(".player-name");
    const topicSelect = card.querySelector(".topic-select");
    const startBtn = card.querySelector(".btn-start");
    const sonnetContainer = card.querySelector("[data-lines]");
    const status = card.querySelector(".status");

    // Nombre
    if (groupData.name) {
      nameDiv.textContent = groupData.name;
    }

    // Si el grupo ya había empezado
    if (groupData.started && groupData.topic) {
      card.dataset.lockedTopic = groupData.topic;
      topicSelect.value = groupData.topic;
      topicSelect.disabled = true;
      startBtn.disabled = true;

      createSonnetLines(sonnetContainer, groupData.topic);
      attachInputListeners(card);
      prefillFromSharedStateForCard(card);

      status.textContent =
        "Fill the last words. Aim for ~10 syllables and ABAB CDCD EFEF GG.";
      status.className = "status";
    }

    // Rank ya asignado
    if (groupData.rank) {
      applyRankToCard(card, groupData.rank);
    }
  });

  pendingInitState = null;
}

// =====================
// 7) APLICAR RANK A UNA CARD
// =====================
function applyRankToCard(card, rank) {
  card.dataset.rank = String(rank);
  card.classList.add(`rank-${rank}`);

  const badge = card.querySelector(".badge-rank");
  if (badge) {
    badge.textContent = rankLabels[rank - 1];
    badge.style.display = "inline-flex";
  }

  if (rank === 1 && !firstWinner) {
    firstWinner = card.dataset.player;
    card.classList.add("winner");
  }
}

// =====================
// 8) HANDLER DE ESTADO INICIAL DEL SERVIDOR
// =====================
socket.on("initState", (serverState) => {
  pendingInitState = serverState || null;
  if (
    document.readyState === "interactive" ||
    document.readyState === "complete"
  ) {
    applyInitStateIfReady();
  }
});

// =====================
// 9) DOMContentLoaded: eventos + listeners de socket
// =====================
document.addEventListener("DOMContentLoaded", () => {
  const cards = document.querySelectorAll(".player-card");
  const resetBtn = document.getElementById("btn-reset-game");

  // Timer inicial (por si tarda en llegar initState)
  updateTimerDisplay();

  // 🔄 NEW GAME (reset global pedido al servidor)
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      const sure = confirm(
        "Start a NEW GAME? This will erase all groups’ work and reset the timer."
      );
      if (!sure) return;
      socket.emit("resetGameRequest"); // 👈 CORREGIDO
    });
  }

  cards.forEach((card) => {
    const groupId = card.dataset.player;
    const topicSelect = card.querySelector(".topic-select");
    const startBtn = card.querySelector(".btn-start");
    const checkBtn = card.querySelector(".btn-check");
    const pdfBtn = card.querySelector(".btn-pdf");
    const sonnetContainer = card.querySelector("[data-lines]");
    const status = card.querySelector(".status");
    const nameDiv = card.querySelector(".player-name");

    // Cambiar nombre de grupo -> avisar al server
    nameDiv.addEventListener("blur", () => {
      const name = nameDiv.textContent.trim() || `Group ${groupId}`;
      socket.emit("renameGroup", { groupId, name });
    });

    // START: ahora solo pedimos al server que arranque ese grupo
    startBtn.addEventListener("click", () => {
      const topic = topicSelect.value;
      const lockedTopic = card.dataset.lockedTopic;

      if (!lockedTopic && !topic) {
        status.textContent = "Please select a topic first.";
        status.className = "status bad";
        return;
      }

      const finalTopic = lockedTopic || topic;
      socket.emit("requestStartGroup", { groupId, topic: finalTopic });
    });

    checkBtn.addEventListener("click", () => {
      if (!sonnetContainer.children.length) {
        status.textContent = "Press START first to generate the sonnet.";
        status.className = "status bad";
        return;
      }
      checkSonnet(card);
    });

    pdfBtn.addEventListener("click", () => {
      if (!sonnetContainer.children.length) {
        status.textContent = "Generate the sonnet first, then download.";
        status.className = "status bad";
        return;
      }
      const topic = card.dataset.lockedTopic || topicSelect.value || "default";
      openPrettyPdf(card, topic);
    });
  });

  // ====== SOCKET HANDLERS EN VIVO ======

  // Cuando algún cliente (o vos) empieza un grupo
  socket.on("groupStarted", ({ groupId, topic }) => {
    const card = document.querySelector(`.player-card[data-player="${groupId}"]`);
    if (!card) return;

    const topicSelect = card.querySelector(".topic-select");
    const startBtn = card.querySelector(".btn-start");
    const sonnetContainer = card.querySelector("[data-lines]");
    const status = card.querySelector(".status");

    card.dataset.lockedTopic = topic;
    topicSelect.value = topic;
    topicSelect.disabled = true;
    startBtn.disabled = true;

    // Deshabilitar ese topic en las otras cards
    document.querySelectorAll(".topic-select").forEach((sel) => {
      if (sel !== topicSelect) {
        const opt = sel.querySelector(`option[value="${topic}"]`);
        if (opt) opt.disabled = true;
      }
    });

    // Si todavía no tenía líneas, las creamos y conectamos sockets
    if (!sonnetContainer.children.length) {
      createSonnetLines(sonnetContainer, topic);
      attachInputListeners(card);
      prefillFromSharedStateForCard(card);
    }

    status.textContent =
      "Fill the last words. Aim for ~10 syllables and ABAB CDCD EFEF GG.";
    status.className = "status";
  });

  // Palabra actualizada por otro cliente
  socket.on("wordUpdated", ({ groupId, lineIndex, value }) => {
    if (!sharedState[groupId]) sharedState[groupId] = {};
    sharedState[groupId][lineIndex] = value;

    const card = document.querySelector(`.player-card[data-player="${groupId}"]`);
    if (!card) return;

    const input = card.querySelector(
      `.blank-input[data-line-index="${lineIndex}"]`
    );
    if (!input) return;

    input.value = value;
  });

  // Rank asignado globalmente
  socket.on("rankAssigned", ({ groupId, rank }) => {
    const card = document.querySelector(`.player-card[data-player="${groupId}"]`);
    if (!card) return;
    applyRankToCard(card, rank);
  });

  // Rename global
  socket.on("groupRenamed", ({ groupId, name }) => {
    const card = document.querySelector(`.player-card[data-player="${groupId}"]`);
    if (!card) return;
    const nameDiv = card.querySelector(".player-name");
    nameDiv.textContent = name;
  });

  // Timer
  socket.on("timerStarted", ({ remainingSeconds: secs }) => {
    timerStarted = true;
    remainingSeconds = secs;
    updateTimerDisplay();
  });

  socket.on("timerUpdate", ({ remainingSeconds: secs }) => {
    remainingSeconds = secs;
    updateTimerDisplay();
  });

  socket.on("timerFinished", () => {
    remainingSeconds = 0;
    updateTimerDisplay();
    handleTimeUp();
  });

  // 🔄 RESET GLOBAL (NEW GAME) — viene del servidor para TODOS
  socket.on("gameReset", (serverState) => {
    // Reset globals
    sharedState = {};
    pendingInitState = serverState || null;
    timerStarted = false;
    remainingSeconds = 600;
    firstWinner = null;

    // Reset UI de todas las cards
    const cards = document.querySelectorAll(".player-card");
    cards.forEach((card) => {
      const gid = card.dataset.player;
      const nameDiv = card.querySelector(".player-name");
      const topicSelect = card.querySelector(".topic-select");
      const startBtn = card.querySelector(".btn-start");
      const sonnetContainer = card.querySelector("[data-lines]");
      const status = card.querySelector(".status");
      const badge = card.querySelector(".badge-rank");

      // Nombre por defecto
      nameDiv.textContent = `Group ${gid}`;

      // Limpiar dataset de topic/rank
      delete card.dataset.lockedTopic;
      delete card.dataset.rank;

      // Quitar clases de rank y winner
      card.classList.remove("rank-1", "rank-2", "rank-3", "rank-4", "winner");

      // Badge
      if (badge) {
        badge.style.display = "none";
        badge.textContent = "";
      }

      // Select topic
      if (topicSelect) {
        topicSelect.disabled = false;
        topicSelect.value = "";
      }

      // Botón START
      if (startBtn) {
        startBtn.disabled = false;
      }

      // Vaciar soneto
      if (sonnetContainer) {
        sonnetContainer.innerHTML = "";
      }

      // Status por defecto
      if (status) {
        status.textContent = "Press START to generate your sonnet board.";
        status.className = "status";
      }
    });

    // Rehabilitar todos los topics
    document.querySelectorAll(".topic-select").forEach((sel) => {
      sel.querySelectorAll("option").forEach((opt) => {
        if (opt.value) opt.disabled = false; // deja el "Select topic" disabled
      });
    });

    // Reset visual del timer
    const timerEl = document.getElementById("global-timer");
    if (timerEl) {
      timerEl.classList.remove("time-up");
    }
    updateTimerDisplay();

    // Si el server manda un nuevo estado inicial (ej. vacío), lo aplicamos
    applyInitStateIfReady();
  });

  // Si el initState ya llegó antes de que el DOM estuviera listo
  applyInitStateIfReady();
});
