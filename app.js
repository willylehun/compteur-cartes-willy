const STORAGE_KEYS = {
  stats: "willy-card-stats-v1",
  activeGame: "willy-card-active-game-v2",
  legacyActiveGame: "willy-card-active-game-v1",
  recentGames: "willy-card-recent-games-v1"
};

const APP_VERSION = window.__COUNTER_BUILD__ || "13";

const SUITS = [
  { symbol: "♠", red: false },
  { symbol: "♥", red: true },
  { symbol: "♦", red: true },
  { symbol: "♣", red: false }
];

const state = {
  playerCount: 2,
  target: 500,
  players: [],
  rounds: [],
  dealerOrder: [],
  dealerSetupStartRound: 0,
  gameFinished: false,
  winnerIndex: null
};

let gameLaunchedThisSession = false;

const els = {
  setupScreen: document.getElementById("setupScreen"),
  gameScreen: document.getElementById("gameScreen"),
  playerInputs: document.getElementById("playerInputs"),
  knownPlayers: document.getElementById("knownPlayers"),
  scoreBoard: document.getElementById("scoreBoard"),
  roundInputs: document.getElementById("roundInputs"),
  roundBadge: document.getElementById("roundBadge"),
  roundTitle: document.getElementById("roundTitle"),
  roundDealerBadge: document.getElementById("roundDealerBadge"),
  targetBadge: document.getElementById("targetBadge"),
  dealerBanner: document.getElementById("dealerBanner"),
  leaderBanner: document.getElementById("leaderBanner"),
  resumeGameBtn: document.getElementById("resumeGameBtn"),
  resumeGameText: document.getElementById("resumeGameText"),
  statsDialog: document.getElementById("statsDialog"),
  historyDialog: document.getElementById("historyDialog"),
  winnerDialog: document.getElementById("winnerDialog"),
  dealerDialog: document.getElementById("dealerDialog"),
  dealerQuestion: document.getElementById("dealerQuestion"),
  dealerHint: document.getElementById("dealerHint"),
  dealerOptions: document.getElementById("dealerOptions"),
  confirmDialog: document.getElementById("confirmDialog")
};

function safeParse(value, fallback) {
  try { return JSON.parse(value) ?? fallback; } catch { return fallback; }
}

function getStats() {
  return safeParse(localStorage.getItem(STORAGE_KEYS.stats), {});
}

function saveStats(stats) {
  localStorage.setItem(STORAGE_KEYS.stats, JSON.stringify(stats));
  refreshKnownPlayers();
}

function getRecentGames() {
  return safeParse(localStorage.getItem(STORAGE_KEYS.recentGames), []);
}

function saveRecentGame(winner) {
  const games = getRecentGames();
  games.unshift({
    winner: winner.name,
    winnerScore: winner.total,
    players: state.players.map(player => ({ name: player.name, total: player.total })),
    target: state.target,
    rounds: state.rounds.length,
    finishedAt: Date.now()
  });
  localStorage.setItem(STORAGE_KEYS.recentGames, JSON.stringify(games.slice(0, 20)));
}

function getSavedGame() {
  const current = safeParse(localStorage.getItem(STORAGE_KEYS.activeGame), null);
  if (current?.players?.length) return current;

  const legacy = safeParse(localStorage.getItem(STORAGE_KEYS.legacyActiveGame), null);
  if (!legacy?.players?.length) return null;

  const rounds = (legacy.history || []).map(entry => {
    const scores = Array(legacy.players.length).fill(0);
    scores[entry.playerIndex] = Number(entry.points || 0);
    return { scores, at: entry.at || Date.now() };
  });

  return {
    playerCount: legacy.playerCount || legacy.players.length,
    target: Number(legacy.target || 0),
    players: legacy.players,
    rounds,
    dealerOrder: [],
    dealerSetupStartRound: rounds.length,
    gameFinished: Boolean(legacy.gameFinished),
    winnerIndex: null,
    savedAt: legacy.savedAt || Date.now()
  };
}

function saveActiveGame() {
  const payload = {
    playerCount: state.playerCount,
    target: state.target,
    players: state.players,
    rounds: state.rounds,
    dealerOrder: state.dealerOrder,
    dealerSetupStartRound: state.dealerSetupStartRound,
    gameFinished: state.gameFinished,
    winnerIndex: state.winnerIndex,
    savedAt: Date.now()
  };
  localStorage.setItem(STORAGE_KEYS.activeGame, JSON.stringify(payload));
  localStorage.removeItem(STORAGE_KEYS.legacyActiveGame);
  refreshResumeCard();
}

function clearActiveGame() {
  localStorage.removeItem(STORAGE_KEYS.activeGame);
  localStorage.removeItem(STORAGE_KEYS.legacyActiveGame);
  refreshResumeCard();
}

function refreshKnownPlayers() {
  const stats = getStats();
  els.knownPlayers.innerHTML = Object.keys(stats)
    .sort((a, b) => a.localeCompare(b, "fr"))
    .map(name => `<option value="${escapeHtml(name)}"></option>`)
    .join("");
}

function refreshResumeCard() {
  const saved = getSavedGame();
  if (gameLaunchedThisSession || !saved?.players?.length || saved.gameFinished) {
    els.resumeGameBtn.classList.add("hidden");
    return;
  }
  els.resumeGameBtn.classList.remove("hidden");
  const roundCount = (saved.rounds || []).length;
  const names = saved.players.map(player => player.name).join(", ");
  els.resumeGameText.textContent = `${names} · ${roundCount} manche${roundCount > 1 ? "s" : ""}`;
}

function renderPlayerInputs() {
  const previous = [...els.playerInputs.querySelectorAll("input")].map(input => input.value);
  els.playerInputs.innerHTML = "";

  for (let i = 0; i < state.playerCount; i++) {
    const suit = SUITS[i];
    const row = document.createElement("div");
    row.className = "player-name-row";
    row.innerHTML = `
      <div class="player-suit ${suit.red ? "red" : ""}" aria-hidden="true">${suit.symbol}</div>
      <input
        class="player-input"
        type="text"
        list="knownPlayers"
        maxlength="24"
        autocomplete="off"
        placeholder="Nom du joueur ${i + 1}"
        value="${escapeHtml(previous[i] || "")}"
      />
    `;
    els.playerInputs.appendChild(row);
  }
}

function normalizeDealerState(order, setupStartRound) {
  const uniqueOrder = (Array.isArray(order) ? order : [])
    .map(Number)
    .filter((index, position, values) => (
      Number.isInteger(index)
      && index >= 0
      && index < state.playerCount
      && values.indexOf(index) === position
    ));

  state.dealerOrder = uniqueOrder.slice(0, state.playerCount);
  state.dealerSetupStartRound = Number.isInteger(Number(setupStartRound))
    ? Math.max(0, Number(setupStartRound))
    : state.rounds.length;

  if (state.dealerOrder.length === state.playerCount - 1) {
    const missingIndex = state.players.findIndex((_, index) => !state.dealerOrder.includes(index));
    if (missingIndex >= 0) state.dealerOrder.push(missingIndex);
  }
}

function getCurrentDealerIndex() {
  if (!state.players.length || !state.dealerOrder.length) return null;
  const offset = state.rounds.length - state.dealerSetupStartRound;
  if (offset < 0) return null;
  if (state.dealerOrder.length === state.playerCount) {
    return state.dealerOrder[offset % state.playerCount];
  }
  return Number.isInteger(state.dealerOrder[offset]) ? state.dealerOrder[offset] : null;
}

function dealerChoiceIsNeeded() {
  if (state.gameFinished || !state.players.length || state.dealerOrder.length === state.playerCount) return false;
  const offset = state.rounds.length - state.dealerSetupStartRound;
  return offset >= 0 && offset < state.playerCount - 1 && !Number.isInteger(state.dealerOrder[offset]);
}

function renderDealerBanner() {
  const dealerIndex = getCurrentDealerIndex();
  if (dealerIndex === null) {
    els.dealerBanner.innerHTML = "♠ Choisis le donneur avant de saisir les points.";
    els.roundDealerBadge.textContent = "♠ Distribution : à choisir";
    return;
  }
  const dealerName = state.players[dealerIndex].name;
  els.dealerBanner.innerHTML = `♠ Donneur de la manche ${state.rounds.length + 1} : <strong>${escapeHtml(dealerName)}</strong>`;
  els.roundDealerBadge.innerHTML = `♠ Distribution : <strong>${escapeHtml(dealerName)}</strong>`;
}

function requestDealerIfNeeded() {
  if (!dealerChoiceIsNeeded() || els.dealerDialog.open) return;

  const roundNumber = state.rounds.length + 1;
  const questionsRequired = state.playerCount - 1;
  els.dealerQuestion.textContent = `Qui distribue la manche ${roundNumber} ?`;
  els.dealerHint.textContent = state.playerCount === 2
    ? "Choisis le premier donneur. Ensuite, l'application alternera automatiquement entre les deux joueurs."
    : `Choisis le donneur pour les ${questionsRequired} premières manches. L'application apprendra ainsi le sens de rotation et annoncera les suivants.`;
  els.dealerOptions.innerHTML = state.players.map((player, index) => {
    const suit = SUITS[index];
    const alreadyChosen = state.dealerOrder.includes(index);
    return `
      <button class="dealer-option" type="button" data-dealer-index="${index}" ${alreadyChosen ? "disabled" : ""}>
        <span class="suit ${suit.red ? "red" : ""}" aria-hidden="true">${suit.symbol}</span>
        <span>${escapeHtml(player.name)}</span>
      </button>
    `;
  }).join("");
  els.dealerDialog.showModal();
}

function selectDealer(index) {
  if (!dealerChoiceIsNeeded() || state.dealerOrder.includes(index) || !state.players[index]) return;

  state.dealerOrder.push(index);
  if (state.dealerOrder.length === state.playerCount - 1) {
    const missingIndex = state.players.findIndex((_, playerIndex) => !state.dealerOrder.includes(playerIndex));
    if (missingIndex >= 0) state.dealerOrder.push(missingIndex);
  }

  els.dealerDialog.close();
  saveActiveGame();
  renderDealerBanner();
  showToast(`${state.players[index].name} distribue la manche ${state.rounds.length + 1}.`);
}

function renderGame() {
  const roundNumber = state.rounds.length + 1;
  els.roundBadge.textContent = `Manche ${roundNumber}`;
  els.roundTitle.textContent = `Manche ${roundNumber}`;
  els.targetBadge.textContent = state.target > 0 ? `Objectif ${state.target}` : "Sans limite";
  document.getElementById("finishGameBtn").classList.remove("hidden");
  els.scoreBoard.dataset.count = String(state.playerCount);
  els.scoreBoard.innerHTML = "";

  state.players.forEach((player, index) => {
    const suit = SUITS[index];
    const last = state.rounds.length ? Number(state.rounds.at(-1).scores[index] || 0) : null;
    const progress = state.target > 0 ? Math.max(0, Math.min(100, (player.total / state.target) * 100)) : 0;
    const card = document.createElement("article");
    card.className = `player-score-card ${suit.red ? "red-card" : ""}`;
    card.dataset.suit = suit.symbol;
    card.innerHTML = `
      <div class="score-name">
        <span class="suit ${suit.red ? "red" : ""}" aria-hidden="true">${suit.symbol}</span>
        <strong>${escapeHtml(player.name)}</strong>
      </div>
      <div class="score-total">${formatNumber(player.total)}</div>
      <div class="score-meta">${last === null ? "Aucun score" : `Dernière manche : ${signed(last)}`}</div>
      ${state.target > 0 ? `<div class="progress-wrap"><div class="progress-bar" style="width:${progress}%"></div></div>` : ""}
    `;
    els.scoreBoard.appendChild(card);
  });

  renderDealerBanner();
  renderLeaderBanner();
  renderRoundInputs();
  setGameReadOnly(state.gameFinished);
  requestDealerIfNeeded();
}

function renderLeaderBanner() {
  if (!state.players.length) return;
  const max = Math.max(...state.players.map(player => player.total));
  const leaders = state.players.filter(player => player.total === max);
  if (!state.rounds.length) {
    els.leaderBanner.textContent = "La table est prête. Bonne partie !";
    return;
  }
  if (leaders.length > 1) {
    els.leaderBanner.textContent = `Égalité en tête à ${formatNumber(max)} points.`;
    return;
  }
  const leader = leaders[0];
  if (state.target > 0) {
    const remaining = Math.max(0, state.target - leader.total);
    els.leaderBanner.textContent = remaining > 0
      ? `♛ ${leader.name} mène avec ${formatNumber(leader.total)} points · encore ${formatNumber(remaining)} pour gagner.`
      : `♛ ${leader.name} est en tête avec ${formatNumber(leader.total)} points.`;
  } else {
    els.leaderBanner.textContent = `♛ ${leader.name} mène avec ${formatNumber(leader.total)} points.`;
  }
}

function renderRoundInputs() {
  els.roundInputs.innerHTML = "";
  state.players.forEach((player, index) => {
    const suit = SUITS[index];
    const row = document.createElement("div");
    row.className = "round-input-row";
    row.innerHTML = `
      <div class="round-player-name">
        <span class="${suit.red ? "red" : ""}" aria-hidden="true">${suit.symbol}</span>
        <span class="round-player-label">${escapeHtml(player.name)}</span>
        <span class="player-total-badge" data-total-index="${index}">Total actuel : ${formatNumber(player.total)} pts</span>
      </div>
      <input
        class="round-score-input"
        type="number"
        inputmode="decimal"
        step="1"
        autocomplete="off"
        placeholder="0"
        value="0"
        name="round-${state.rounds.length + 1}-player-${index}"
        aria-label="Points de ${escapeHtml(player.name)} pour cette manche"
        data-round-index="${index}"
      />
      <div class="score-field">
        <span class="score-unit">pts</span>
      </div>
    `;
    row.querySelector(".score-field").prepend(row.querySelector(".round-score-input"));
    els.roundInputs.appendChild(row);
  });

  const inputs = [...els.roundInputs.querySelectorAll(".round-score-input")];
  inputs.forEach((input, index) => {
    input.value = "0";
    input.defaultValue = "0";
    input.addEventListener("focus", () => input.select());
    input.addEventListener("input", () => updateRoundTotalPreview(index, input.value));
    input.addEventListener("keydown", event => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      if (inputs[index + 1]) inputs[index + 1].focus();
      else validateRound();
    });
  });
}

function updateRoundTotalPreview(index, value) {
  const player = state.players[index];
  const badge = els.roundInputs.querySelector(`[data-total-index="${index}"]`);
  if (!player || !badge) return;
  const roundScore = value.trim() === "" ? 0 : Number(value);
  const previewTotal = player.total + (Number.isFinite(roundScore) ? roundScore : 0);
  badge.textContent = `Total actuel : ${formatNumber(previewTotal)} pts`;
}

function validateRound() {
  if (state.gameFinished) {
    showToast("Cette partie est déjà terminée.");
    return;
  }

  const dealerIndex = getCurrentDealerIndex();
  if (dealerIndex === null) {
    showToast("Choisis d'abord qui distribue cette manche.");
    requestDealerIfNeeded();
    return;
  }

  const inputs = [...els.roundInputs.querySelectorAll(".round-score-input")];
  const scores = inputs.map(input => Number(input.value.trim() === "" ? 0 : input.value));

  if (scores.some(score => !Number.isFinite(score) || !Number.isInteger(score))) {
    showToast("Utilise uniquement des nombres entiers.");
    return;
  }

  inputs.forEach(input => {
    input.value = "0";
    input.defaultValue = "0";
  });

  scores.forEach((score, index) => { state.players[index].total += score; });
  state.rounds.push({ scores, dealerIndex, at: Date.now() });

  if (state.target > 0 && checkTargetWinner()) return;

  saveActiveGame();
  renderGame();
  showToast(`Manche ${state.rounds.length} enregistrée.`);
}

function checkTargetWinner() {
  const qualified = state.players
    .map((player, index) => ({ ...player, index }))
    .filter(player => player.total >= state.target)
    .sort((a, b) => b.total - a.total);

  if (!qualified.length) {
    return false;
  }

  const highestTotal = qualified[0].total;
  const winnerIndexes = qualified
    .filter(player => player.total === highestTotal)
    .map(player => player.index);
  finishWithWinner(winnerIndexes[0], true, winnerIndexes);
  return true;
}

function undoLastRound() {
  if (state.gameFinished) {
    showToast("La partie est terminée.");
    return;
  }
  const lastRound = state.rounds.pop();
  if (!lastRound) {
    showToast("Aucune manche à annuler.");
    return;
  }
  lastRound.scores.forEach((score, index) => { state.players[index].total -= Number(score || 0); });
  saveActiveGame();
  renderGame();
  showToast("Dernière manche annulée.");
}

function finishWithWinner(winnerIndex, automatic = false, winnerIndexes = [winnerIndex]) {
  if (state.gameFinished) return;
  state.gameFinished = true;
  state.winnerIndex = winnerIndex;

  document.querySelectorAll("dialog[open]").forEach(dialog => {
    try {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    } catch {
      dialog.removeAttribute("open");
    }
  });

  const winners = winnerIndexes.map(index => state.players[index]).filter(Boolean);
  const winnerNames = winners.map(player => player.name);
  const isTie = winners.length > 1;
  const winner = state.players[winnerIndex];

  document.getElementById("winnerTitle").textContent = isTie
    ? `${winnerNames.join(" et ")} terminent à égalité !`
    : `${winner.name} gagne !`;
  document.getElementById("winnerText").textContent = isTie
    ? `Ils terminent avec ${formatNumber(winner.total)} points. Voici le classement final.`
    : automatic
      ? `${winner.name} atteint l'objectif de ${formatNumber(state.target)} avec ${formatNumber(winner.total)} points.`
      : `${winner.name} termine en tête avec ${formatNumber(winner.total)} points.`;
  renderWinnerPodium();
  openWinnerOverlay();
  launchConfetti();

  try {
    const stats = getStats();
    state.players.forEach((player, index) => {
      if (!stats[player.name]) stats[player.name] = { games: 0, wins: 0 };
      stats[player.name].games = Number(stats[player.name].games || 0) + 1;
      if (winnerIndexes.includes(index)) stats[player.name].wins = Number(stats[player.name].wins || 0) + 1;
    });
    saveStats(stats);
    saveRecentGame(isTie ? { name: winnerNames.join(" & "), total: winner.total } : winner);
    saveActiveGame();
  } catch (error) {
    console.error("La sauvegarde de fin de partie a échoué.", error);
  }

  try {
    renderGame();
  } catch (error) {
    console.error("Le rafraîchissement de la partie terminée a échoué.", error);
  }
}

function openWinnerOverlay() {
  els.winnerDialog.classList.remove("hidden");
  els.winnerDialog.hidden = false;
  els.winnerDialog.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  window.requestAnimationFrame(() => document.getElementById("newGameBtn")?.focus());
}

function closeWinnerOverlay() {
  els.winnerDialog.classList.add("hidden");
  els.winnerDialog.hidden = true;
  els.winnerDialog.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function launchConfetti() {
  const layer = document.getElementById("confettiLayer");
  layer.replaceChildren();
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  const colors = ["#d7ad55", "#f2d88f", "#af3140", "#1a6748", "#fff9eb"];
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < 72; index++) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.background = colors[index % colors.length];
    piece.style.setProperty("--delay", `${Math.random() * 0.75}s`);
    piece.style.setProperty("--duration", `${2.5 + Math.random() * 1.7}s`);
    piece.style.setProperty("--drift", `${-90 + Math.random() * 180}px`);
    piece.style.setProperty("--spin", `${360 + Math.random() * 720}deg`);
    piece.style.setProperty("--size", `${6 + Math.random() * 7}px`);
    fragment.appendChild(piece);
  }
  layer.appendChild(fragment);
  window.setTimeout(() => layer.replaceChildren(), 5000);
}

function finishManualGame() {
  if (!state.players.length || state.gameFinished) return;

  const ranked = state.players
    .map((player, index) => ({ ...player, index }))
    .sort((a, b) => b.total - a.total);

  const highestTotal = ranked[0].total;
  const winnerIndexes = ranked
    .filter(player => player.total === highestTotal)
    .map(player => player.index);
  finishWithWinner(winnerIndexes[0], false, winnerIndexes);
}

function renderWinnerPodium() {
  const ranked = state.players
    .map((player, index) => ({ ...player, index }))
    .sort((a, b) => b.total - a.total);
  document.getElementById("winnerPodium").innerHTML = ranked.map((player, place) => `
    <div class="podium-row">
      <span class="podium-place">${place + 1}</span>
      <span>${escapeHtml(player.name)}</span>
      <span class="podium-score">${formatNumber(player.total)} pts</span>
    </div>
  `).join("");
}

function setGameReadOnly(readOnly) {
  document.getElementById("validateRoundBtn").disabled = readOnly;
  document.getElementById("undoBtn").disabled = readOnly;
  document.getElementById("finishGameBtn").disabled = readOnly;
  els.roundInputs.querySelectorAll("input,button").forEach(control => { control.disabled = readOnly; });
  document.querySelectorAll("#validateRoundBtn, #undoBtn, #finishGameBtn").forEach(button => {
    button.style.opacity = readOnly ? ".48" : "1";
  });
}

function startGame() {
  const names = [...els.playerInputs.querySelectorAll("input")].map(input => normalizeName(input.value));
  if (names.some(name => !name)) {
    showToast("Renseigne le nom de chaque joueur.");
    return;
  }
  const lowered = names.map(name => name.toLocaleLowerCase("fr"));
  if (new Set(lowered).size !== names.length) {
    showToast("Chaque joueur doit avoir un nom différent.");
    return;
  }

  state.players = names.map(name => ({ name, total: 0 }));
  state.rounds = [];
  state.dealerOrder = [];
  state.dealerSetupStartRound = 0;
  state.gameFinished = false;
  state.winnerIndex = null;
  gameLaunchedThisSession = true;
  saveActiveGame();
  showScreen("game");
  renderGame();
}

function resumeGame() {
  const saved = getSavedGame();
  if (!saved?.players?.length) return;

  state.playerCount = Number(saved.playerCount || saved.players.length);
  state.target = Number(saved.target || 0);
  state.players = saved.players.map(player => ({ name: player.name, total: Number(player.total || 0) }));
  state.rounds = saved.rounds || [];
  normalizeDealerState(saved.dealerOrder, saved.dealerSetupStartRound);
  state.gameFinished = Boolean(saved.gameFinished);
  state.winnerIndex = Number.isInteger(saved.winnerIndex) ? saved.winnerIndex : null;
  gameLaunchedThisSession = true;

  syncSetupControls();
  refreshResumeCard();
  showScreen("game");
  if (!state.gameFinished && state.target > 0 && checkTargetWinner()) return;
  renderGame();
}

function syncSetupControls() {
  document.querySelectorAll("[data-count]").forEach(button => {
    button.classList.toggle("active", Number(button.dataset.count) === state.playerCount);
  });
  document.querySelectorAll("[data-target]").forEach(button => {
    button.classList.toggle("active", Number(button.dataset.target) === state.target);
  });
}

function newGameFromWinner() {
  closeWinnerOverlay();
  clearActiveGame();
  state.players = [];
  state.rounds = [];
  state.dealerOrder = [];
  state.dealerSetupStartRound = 0;
  state.gameFinished = false;
  state.winnerIndex = null;
  showScreen("setup");
  renderPlayerInputs();
}

function showScreen(screen) {
  els.setupScreen.classList.toggle("active", screen === "setup");
  els.gameScreen.classList.toggle("active", screen === "game");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderStats() {
  const stats = getStats();
  const entries = Object.entries(stats)
    .map(([name, value]) => ({
      name,
      games: Number(value.games || 0),
      wins: Number(value.wins || 0)
    }))
    .sort((a, b) => b.wins - a.wins || b.games - a.games || a.name.localeCompare(b.name, "fr"));

  const totalPlayers = entries.length;
  const totalGames = entries.reduce((max, entry) => Math.max(max, entry.games), 0);
  document.getElementById("statsSummary").innerHTML = `
    <div class="stat-box"><strong>${totalPlayers}</strong><span>joueur${totalPlayers > 1 ? "s" : ""} enregistré${totalPlayers > 1 ? "s" : ""}</span></div>
    <div class="stat-box"><strong>${getRecentGames().length || totalGames}</strong><span>partie${(getRecentGames().length || totalGames) > 1 ? "s" : ""} mémorisée${(getRecentGames().length || totalGames) > 1 ? "s" : ""}</span></div>
  `;

  const content = document.getElementById("statsContent");
  if (!entries.length) {
    content.innerHTML = `<div class="empty-state">Aucune partie terminée pour le moment.</div>`;
  } else {
    content.innerHTML = `
      <div class="table-scroll">
        <table class="stats-table">
          <thead><tr><th>Joueur</th><th>Parties</th><th>Victoires</th><th>Taux</th></tr></thead>
          <tbody>
            ${entries.map((entry, index) => {
              const rate = entry.games ? Math.round((entry.wins / entry.games) * 100) : 0;
              return `<tr>
                <td><span class="rank-medal">${index + 1}</span><strong>${escapeHtml(entry.name)}</strong></td>
                <td>${entry.games}</td><td>${entry.wins}</td><td>${rate}%</td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  const games = getRecentGames().slice(0, 5);
  const recent = document.getElementById("recentGames");
  recent.innerHTML = games.length ? `
    <h3 class="recent-title">Dernières parties</h3>
    <div class="recent-list">
      ${games.map(game => `
        <div class="recent-game">
          <strong>♛ ${escapeHtml(game.winner)}</strong>
          <span>${formatNumber(game.winnerScore)} pts · ${formatDate(game.finishedAt)}</span>
        </div>
      `).join("")}
    </div>
  ` : "";
}

function renderHistory() {
  const content = document.getElementById("historyContent");
  if (!state.rounds.length) {
    content.innerHTML = `<div class="empty-state">Aucune manche enregistrée.</div>`;
    return;
  }

  content.innerHTML = `
    <div class="table-scroll">
      <table class="history-table">
        <thead>
          <tr><th>Manche</th><th>Donneur</th>${state.players.map(player => `<th>${escapeHtml(player.name)}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${state.rounds.map((round, roundIndex) => `
            <tr>
              <td><strong>${roundIndex + 1}</strong></td>
              <td>${Number.isInteger(round.dealerIndex) && state.players[round.dealerIndex] ? escapeHtml(state.players[round.dealerIndex].name) : "—"}</td>
              ${round.scores.map(score => `<td>${signed(Number(score || 0))}</td>`).join("")}
            </tr>
          `).join("")}
          <tr><td><strong>Total</strong></td><td>—</td>${state.players.map(player => `<td><strong>${formatNumber(player.total)}</strong></td>`).join("")}</tr>
        </tbody>
      </table>
    </div>
  `;
}

function resetStats() {
  if (!window.confirm("Supprimer toutes les statistiques et l'historique des parties ?")) return;
  localStorage.removeItem(STORAGE_KEYS.stats);
  localStorage.removeItem(STORAGE_KEYS.recentGames);
  refreshKnownPlayers();
  renderStats();
  showToast("Statistiques réinitialisées.");
}

function normalizeName(value) {
  return value.trim().replace(/\s+/g, " ").slice(0, 24);
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("fr-FR");
}

function signed(value) {
  return `${value > 0 ? "+" : ""}${formatNumber(value)}`;
}

function formatDate(timestamp) {
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" }).format(new Date(timestamp));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

let toastTimer;
function showToast(message) {
  let toast = document.querySelector(".toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.className = "toast";
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2300);
}

function bindReliableTap(button, action) {
  let lastTouchAt = 0;

  const runTouchAction = event => {
    if (button.disabled) return;
    lastTouchAt = Date.now();
    event.preventDefault();
    action();
  };

  if (window.PointerEvent) {
    button.addEventListener("pointerup", event => {
      if (event.pointerType === "touch") runTouchAction(event);
    }, { passive: false });
  } else {
    button.addEventListener("touchend", runTouchAction, { passive: false });
  }

  button.addEventListener("click", () => {
    if (Date.now() - lastTouchAt < 700 || button.disabled) return;
    action();
  });
}

document.getElementById("playerCountSelector").addEventListener("click", event => {
  const button = event.target.closest("[data-count]");
  if (!button) return;
  state.playerCount = Number(button.dataset.count);
  document.querySelectorAll("[data-count]").forEach(item => item.classList.toggle("active", item === button));
  renderPlayerInputs();
});

document.getElementById("targetSelector").addEventListener("click", event => {
  const button = event.target.closest("[data-target]");
  if (!button) return;
  state.target = Number(button.dataset.target);
  document.querySelectorAll("[data-target]").forEach(item => item.classList.toggle("active", item === button));
});

document.getElementById("startGameBtn").addEventListener("click", startGame);
els.resumeGameBtn.addEventListener("click", resumeGame);
document.getElementById("validateRoundBtn").addEventListener("click", validateRound);
document.getElementById("undoBtn").addEventListener("click", undoLastRound);
document.getElementById("historyBtn").addEventListener("click", () => { renderHistory(); els.historyDialog.showModal(); });
els.dealerOptions.addEventListener("click", event => {
  const button = event.target.closest("[data-dealer-index]");
  if (!button) return;
  selectDealer(Number(button.dataset.dealerIndex));
});
els.dealerDialog.addEventListener("cancel", event => event.preventDefault());

bindReliableTap(document.getElementById("finishGameBtn"), () => {
  if (state.gameFinished) return;
  finishManualGame();
});
bindReliableTap(document.getElementById("confirmFinishBtn"), () => {
  els.confirmDialog.close();
  finishManualGame();
});
document.getElementById("cancelFinishBtn").addEventListener("click", () => els.confirmDialog.close());

document.getElementById("backHomeBtn").addEventListener("click", () => showScreen("setup"));
document.getElementById("brandHomeBtn").addEventListener("click", () => showScreen("setup"));

document.getElementById("statsBtn").addEventListener("click", () => {
  renderStats();
  els.statsDialog.showModal();
});
document.querySelectorAll("[data-close]").forEach(button => {
  button.addEventListener("click", () => document.getElementById(button.dataset.close).close());
});
document.getElementById("resetStatsBtn").addEventListener("click", resetStats);
document.getElementById("newGameBtn").addEventListener("click", newGameFromWinner);
document.getElementById("keepPlayingBtn").addEventListener("click", () => {
  closeWinnerOverlay();
  renderHistory();
  els.historyDialog.showModal();
});

refreshKnownPlayers();
renderPlayerInputs();
refreshResumeCard();

async function checkPublishedVersion() {
  try {
    const response = await fetch(`./version.json?t=${Date.now()}`, { cache: "no-store" });
    const published = await response.json();
    if (String(published.version) === APP_VERSION) return;
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter(key => key.startsWith("willy-card-counter-")).map(key => caches.delete(key)));
    }
    window.location.reload();
  } catch {}
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") checkPublishedVersion();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const reloadKey = `willy-sw-reload-${APP_VERSION}`;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (sessionStorage.getItem(reloadKey)) return;
      sessionStorage.setItem(reloadKey, "1");
      window.location.reload();
    });
    navigator.serviceWorker
      .register(`./sw.js?v=${APP_VERSION}`, { updateViaCache: "none" })
      .then(registration => registration.update())
      .catch(() => {});
  });
}
