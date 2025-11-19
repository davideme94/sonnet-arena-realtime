// server.js
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Servir la carpeta public
app.use(express.static(path.join(__dirname, "public")));

const NUM_GROUPS = 4;
const INITIAL_TIME = 600; // 10 minutos

// ====== ESTADO GLOBAL ======
let globalState;
let timerInterval = null;

function buildInitialState() {
  const state = {
    timer: {
      started: false,
      remainingSeconds: INITIAL_TIME,
    },
    usedTopics: [],
    nextRank: 1,
    groups: {},
  };

  for (let i = 1; i <= NUM_GROUPS; i++) {
    state.groups[String(i)] = {
      name: `Group ${i}`,
      topic: null,
      started: false,
      rank: null,
      words: {}, // { lineIndex: "word" }
    };
  }

  return state;
}

function resetGlobalState() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  globalState = buildInitialState();
}

resetGlobalState(); // iniciamos por primera vez

// ====== TIMER EN EL SERVIDOR ======
function startTimerIfNeeded() {
  if (globalState.timer.started) return;

  globalState.timer.started = true;
  io.emit("timerStarted", {
    remainingSeconds: globalState.timer.remainingSeconds,
  });

  timerInterval = setInterval(() => {
    globalState.timer.remainingSeconds -= 1;
    if (globalState.timer.remainingSeconds < 0) {
      globalState.timer.remainingSeconds = 0;
    }

    io.emit("timerUpdate", {
      remainingSeconds: globalState.timer.remainingSeconds,
    });

    if (globalState.timer.remainingSeconds <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      io.emit("timerFinished");
    }
  }, 1000);
}

// ====== SOCKET.IO ======
io.on("connection", (socket) => {
  console.log("Nuevo cliente conectado:", socket.id);

  // Mandar estado actual al que entra
  socket.emit("initState", globalState);

  socket.on("disconnect", () => {
    console.log("Cliente desconectado:", socket.id);
  });

  // Palabras de los inputs
  socket.on("updateWord", ({ groupId, lineIndex, value }) => {
    const group = globalState.groups[groupId];
    if (!group) return;
    if (typeof lineIndex !== "number") return;

    group.words[lineIndex] = value || "";
    socket.broadcast.emit("wordUpdated", { groupId, lineIndex, value });
  });

  // Un grupo aprieta START
  socket.on("requestStartGroup", ({ groupId, topic }) => {
    const group = globalState.groups[groupId];
    if (!group || !topic) return;

    if (!group.started) {
      group.started = true;
      group.topic = topic;

      if (!globalState.usedTopics.includes(topic)) {
        globalState.usedTopics.push(topic);
      }

      // Avisar a TODOS
      io.emit("groupStarted", { groupId, topic });
    }

    // Arrancar timer global si todavía no
    startTimerIfNeeded();
  });

  // Cambio de nombre de grupo
  socket.on("renameGroup", ({ groupId, name }) => {
    const group = globalState.groups[groupId];
    if (!group) return;
    const cleanName = (name || "").trim() || `Group ${groupId}`;
    group.name = cleanName;
    io.emit("groupRenamed", { groupId, name: cleanName });
  });

  // Pedido de rank (cuando un soneto es perfecto)
  socket.on("requestRank", ({ groupId }) => {
    const group = globalState.groups[groupId];
    if (!group) return;
    if (group.rank) return; // ya tiene puesto

    const rank = globalState.nextRank;
    if (rank > NUM_GROUPS) return;

    group.rank = rank;
    globalState.nextRank += 1;

    io.emit("rankAssigned", { groupId, rank });
  });

  // ====== NUEVO JUEGO (RESET GLOBAL) ======
  socket.on("resetGameRequest", () => {
    console.log("Reset de juego solicitado");
    resetGlobalState();
    io.emit("gameReset", globalState);
  });
});

// Puerto
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});
