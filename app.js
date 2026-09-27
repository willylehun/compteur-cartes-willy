const STORAGE_KEYS = {
  stats: "willy-card-stats-v1",
  activeGame: "willy-card-active-game-v2",
  legacyActiveGame: "willy-card-active-game-v1",
  recentGames: "willy-card-recent-games-v1"
};

const APP_VERSION = window.__COUNTER_BUILD__ || "22";

const VALID_TARGETS = [0, 500, 1000];
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 4;
const MAX_PLAYER_NAME_LENGTH = 24;
const MAX_STORED_PLAYERS = 200;
const MAX_STORED_ROUNDS = 10000;

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
let roundSubmissionLocked = false;

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

function safeStorageGet(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn("La sauvegarde locale est indisponible.", error);
    return false;
  }
}

function safeStorageRemove(key) {
  try { localStorage.removeItem(key); } catch {}
}

function normalizeTarget(value) {
  const target = Number(value);
  return VALID_TARGETS.includes(target) ? target : 500;
}

function toSafeInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : fallback;
}

function toNonNegativeInteger(value, fallback = 0) {
  const number = toSafeInteger(value, fallback);
  return number >= 0 ? number : fallback;
}

function normalizeStats(value) {
  const cleanStats = Object.create(null);
  if (!value || typeof value !== "object" || Array.isArray(value)) return cleanStats;

  Object.entries(value).slice(0, MAX_STORED_PLAYERS).forEach(([rawName, rawStats]) => {
    const name = normalizeName(rawName);
    if (!name || !rawStats || typeof rawStats !== "object" || Array.isArray(rawStats)) return;
    const games = toNonNegativeInteger(rawStats.games);
    const wins = Math.min(games, toNonNegativeInteger(rawStats.wins));
    cleanStats[name] = { games, wins };
  });
  return cleanStats;
}

function normalizeRecentGames(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).map(game => {
    if (!game || typeof game !== "object" || Array.isArray(game)) return null;
    const winner = normalizeDisplayText(game.winner, (MAX_PLAYER_NAME_LENGTH * MAX_PLAYERS) + 12);
    const players = Array.isArray(game.players)
      ? game.players.slice(0, MAX_PLAYERS).map(player => ({
        name: normalizeName(player?.name),
        total: toSafeInteger(player?.total)
      })).filter(player => player.name)
      : [];
    if (!winner || players.length < MIN_PLAYERS) return null;
    return {
      winner,
      winnerScore: toSafeInteger(game.winnerScore),
      players,
      target: normalizeTarget(game.target),
      rounds: toNonNegativeInteger(game.rounds),
      finishedAt: toNonNegativeInteger(game.finishedAt, Date.now())
    };
  }).filter(Boolean);
}

function normalizeStoredGame(saved) {
  if (!saved || typeof saved !== "object" || Array.isArray(saved) || !Array.isArray(saved.players)) return null;
  if (saved.players.length < MIN_PLAYERS || saved.players.length > MAX_PLAYERS) return null;
  if (!Array.isArray(saved.rounds) || saved.rounds.length > MAX_STORED_ROUNDS) return null;

  const players = saved.players.map(player => ({ name: normalizeName(player?.name), total: 0 }));
  if (players.some(player => !player.name)) return null;
  const loweredNames = players.map(player => player.name.toLocaleLowerCase("fr"));
  if (new Set(loweredNames).size !== players.length) return null;

  const playerCount = players.length;
  const rounds = saved.rounds.map((round, roundIndex) => {
    const rawScores = Array.isArray(round?.scores) ? round.scores : [];
    const dealerIndex = toSafeInteger(round?.dealerIndex, -1);
    return {
      roundNumber: roundIndex + 1,
      scores: Array.from({ length: playerCount }, (_, playerIndex) => toSafeInteger(rawScores[playerIndex])),
      dealerIndex: dealerIndex >= 0 && dealerIndex < playerCount ? dealerIndex : null,
      at: toNonNegativeInteger(round?.at, Date.now())
    };
  });
  const totalsAreSafe = players.every((_, playerIndex) => {
    const total = rounds.reduce((sum, round) => sum + round.scores[playerIndex], 0);
    return Number.isSafeInteger(total);
  });
  if (!totalsAreSafe) return null;

  const dealerOrder = (Array.isArray(saved.dealerOrder) ? saved.dealerOrder : [])
    .map(index => toSafeInteger(index, -1))
    .filter((index, position, values) => (
      index >= 0
      && index < playerCount
      && values.indexOf(index) === position
    ))
    .slice(0, playerCount);
  const rawWinnerIndex = toSafeInteger(saved.winnerIndex, -1);

  return {
    playerCount,
    target: normalizeTarget(saved.target),
    players,
    rounds,
    dealerOrder,
    dealerSetupStartRound: Math.min(rounds.length, toNonNegativeInteger(saved.dealerSetupStartRound)),
    gameFinished: saved.gameFinished === true,
    winnerIndex: rawWinnerIndex >= 0 && rawWinnerIndex < playerCount ? rawWinnerIndex : null,
    savedAt: toNonNegativeInteger(saved.savedAt, Date.now())
  };
}

function getStats() {
  return normalizeStats(safeParse(safeStorageGet(STORAGE_KEYS.stats), {}));
}

function saveStats(stats) {
  safeStorageSet(STORAGE_KEYS.stats, JSON.stringify(normalizeStats(stats)));
  refreshKnownPlayers();
}

function getRecentGames() {
  return normalizeRecentGames(safeParse(safeStorageGet(STORAGE_KEYS.recentGames), []));
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
  safeStorageSet(STORAGE_KEYS.recentGames, JSON.stringify(games.slice(0, 20)));
}

function getSavedGame() {
  const current = normalizeStoredGame(safeParse(safeStorageGet(STORAGE_KEYS.activeGame), null));
  if (current) return current;

  const legacy = safeParse(safeStorageGet(STORAGE_KEYS.legacyActiveGame), null);
  if (!legacy?.players?.length || !Array.isArray(legacy.history)) return null;

  const rounds = legacy.history.map(entry => {
    const scores = Array(legacy.players.length).fill(0);
    const playerIndex = toSafeInteger(entry?.playerIndex, -1);
    if (playerIndex >= 0 && playerIndex < scores.length) scores[playerIndex] = toSafeInteger(entry?.points);
    return { scores, at: entry.at || Date.now() };
  });

  return normalizeStoredGame({
    playerCount: legacy.playerCount || legacy.players.length,
    target: Number(legacy.target || 0),
    players: legacy.players,
    rounds,
    dealerOrder: [],
    dealerSetupStartRound: rounds.length,
    gameFinished: Boolean(legacy.gameFinished),
    winnerIndex: null,
    savedAt: legacy.savedAt || Date.now()
  });
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
  safeStorageSet(STORAGE_KEYS.activeGame, JSON.stringify(payload));
  safeStorageRemove(STORAGE_KEYS.legacyActiveGame);
  refreshResumeCard();
}

function clearActiveGame() {
  safeStorageRemove(STORAGE_KEYS.activeGame);
  safeStorageRemove(STORAGE_KEYS.legacyActiveGame);
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

  if (state.dealerOrder.length < getRequiredDealerChoices()) {
    const expectedOffset = state.rounds.length - state.dealerSetupStartRound;
    if (expectedOffset !== state.dealerOrder.length) {
      state.dealerSetupStartRound = Math.max(0, state.rounds.length - state.dealerOrder.length);
    }
  }

  if (state.dealerOrder.length >= getRequiredDealerChoices()) {
    const missingIndex = state.players.findIndex((_, index) => !state.dealerOrder.includes(index));
    if (missingIndex >= 0) state.dealerOrder.push(missingIndex);
  }
}

function getRequiredDealerChoices() {
  return ({ 2: 1, 3: 2, 4: 3 })[state.playerCount] || 1;
}

function getLastRound() {
  return state.rounds.length ? state.rounds[state.rounds.length - 1] : null;
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
  return offset >= 0 && offset < getRequiredDealerChoices() && !Number.isInteger(state.dealerOrder[offset]);
}

function renderDealerBanner() {
  if (state.gameFinished) {
    const lastRound = getLastRound();
    const lastDealerIndex = Number(lastRound?.dealerIndex);
    if (Number.isInteger(lastDealerIndex) && state.players[lastDealerIndex]) {
      const lastDealerName = state.players[lastDealerIndex].name;
      els.dealerBanner.innerHTML = `♠ Dernier donneur · manche ${state.rounds.length} : <strong>${escapeHtml(lastDealerName)}</strong>`;
      els.roundDealerBadge.innerHTML = `♠ Dernière distribution : <strong>${escapeHtml(lastDealerName)}</strong>`;
    } else {
      els.dealerBanner.textContent = "♠ Partie terminée.";
      els.roundDealerBadge.textContent = "♠ Aucune manche jouée";
    }
    return;
  }

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
  if (!dealerChoiceIsNeeded()) {
    if (isDealerOverlayOpen()) closeDealerOverlay();
    return;
  }

  const roundNumber = state.rounds.length + 1;
  const questionsRequired = getRequiredDealerChoices();
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
  els.dealerOptions.querySelectorAll("[data-dealer-index]").forEach(button => {
    bindReliableTap(button, () => selectDealer(Number(button.dataset.dealerIndex)));
  });
  openDealerOverlay();
}

function isDealerOverlayOpen() {
  return !els.dealerDialog.classList.contains("hidden");
}

function openDealerOverlay() {
  els.dealerDialog.classList.remove("hidden");
  els.dealerDialog.hidden = false;
  els.dealerDialog.setAttribute("aria-hidden", "false");
  window.requestAnimationFrame(() => {
    els.dealerDialog.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function closeDealerOverlay() {
  els.dealerDialog.classList.add("hidden");
  els.dealerDialog.hidden = true;
  els.dealerDialog.setAttribute("aria-hidden", "true");
  els.dealerOptions.replaceChildren();
}

function selectDealer(index) {
  if (!dealerChoiceIsNeeded() || state.dealerOrder.includes(index) || !state.players[index]) return;

  state.dealerOrder.push(index);
  if (state.dealerOrder.length >= getRequiredDealerChoices()) {
    const missingIndex = state.players.findIndex((_, playerIndex) => !state.dealerOrder.includes(playerIndex));
    if (missingIndex >= 0) state.dealerOrder.push(missingIndex);
  }

  closeDealerOverlay();
  saveActiveGame();
  renderDealerBanner();
  showToast(`${state.players[index].name} distribue la manche ${state.rounds.length + 1}.`);
}

function renderGame({ deferDealerPrompt = false } = {}) {
  const roundNumber = state.rounds.length + 1;
  if (state.gameFinished) {
    const completedRounds = state.rounds.length;
    els.roundBadge.textContent = `${completedRounds} manche${completedRounds > 1 ? "s" : ""}`;
    els.roundTitle.textContent = "Partie terminée";
  } else {
    els.roundBadge.textContent = `Manche ${roundNumber}`;
    els.roundTitle.textContent = `Manche ${roundNumber}`;
  }
  els.targetBadge.textContent = state.target > 0 ? `Objectif ${state.target}` : "Sans limite";
  document.getElementById("finishGameBtn").classList.remove("hidden");
  els.scoreBoard.dataset.count = String(state.playerCount);
  els.scoreBoard.innerHTML = "";

  state.players.forEach((player, index) => {
    const suit = SUITS[index];
    const lastRound = getLastRound();
    const last = lastRound ? Number(lastRound.scores[index] || 0) : null;
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
      ${state.target > 0 ? `<progress class="progress-wrap" max="100" value="${Math.round(progress)}" aria-label="Progression vers l'objectif"></progress>` : ""}
    `;
    els.scoreBoard.appendChild(card);
  });

  renderDealerBanner();
  renderLeaderBanner();
  renderRoundInputs();
  setGameReadOnly(state.gameFinished);
  if (deferDealerPrompt) {
    window.setTimeout(() => {
      if (!state.gameFinished) requestDealerIfNeeded();
    }, 180);
  } else {
    requestDealerIfNeeded();
  }
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
  if (roundSubmissionLocked) return;

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

  roundSubmissionLocked = true;
  document.activeElement?.blur();
  document.getElementById("validateRoundBtn").disabled = true;
  let roundWasRecorded = false;

  try {
    const inputs = [...els.roundInputs.querySelectorAll(".round-score-input")];
    const scores = inputs.map(input => Number(input.value.trim() === "" ? 0 : input.value));

    if (inputs.length !== state.players.length) {
      showToast("Les champs de score sont incomplets. Recharge l'application.");
      return;
    }

    if (scores.some(score => !Number.isSafeInteger(score))) {
      showToast("Utilise uniquement des nombres entiers.");
      return;
    }

    if (scores.some((score, index) => !Number.isSafeInteger(state.players[index].total + score))) {
      showToast("Ce score dépasse la valeur maximale autorisée.");
      return;
    }

    inputs.forEach(input => {
      input.value = "0";
      input.defaultValue = "0";
    });

    scores.forEach((score, index) => { state.players[index].total += score; });
    state.rounds.push({
      roundNumber: state.rounds.length + 1,
      scores,
      dealerIndex,
      at: Date.now()
    });
    roundWasRecorded = true;

    if (checkTargetWinner()) return;

    saveActiveGame();
    renderGame({ deferDealerPrompt: true });
    showToast(`Manche ${state.rounds.length} enregistrée.`);
  } catch (error) {
    console.error("La validation de la manche a échoué.", error);
    if (roundWasRecorded) {
      saveActiveGame();
      showToast("La manche est enregistrée. Recharge l'application pour actualiser l'écran.");
    } else {
      showToast("Impossible de valider cette manche. Réessaie.");
    }
  } finally {
    roundSubmissionLocked = false;
    if (!state.gameFinished) document.getElementById("validateRoundBtn").disabled = false;
  }
}

function checkTargetWinner() {
  const target = normalizeTarget(state.target);
  state.target = target;
  if (target === 0) return false;

  const qualified = state.players
    .map((player, index) => ({ ...player, index }))
    .filter(player => player.total >= target)
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

  if (isDealerOverlayOpen()) closeDealerOverlay();

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

  const fragment = document.createDocumentFragment();
  for (let index = 0; index < 72; index++) {
    const piece = document.createElement("span");
    piece.className = [
      "confetti-piece",
      `confetti-color-${index % 5}`,
      `confetti-track-${index % 12}`,
      `confetti-size-${index % 4}`,
      `confetti-speed-${index % 4}`,
      `confetti-delay-${index % 6}`
    ].join(" ");
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

  closeDealerOverlay();
  state.playerCount = names.length;
  state.target = normalizeTarget(document.querySelector("#targetSelector [data-target].active")?.dataset.target);
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

  closeDealerOverlay();
  state.playerCount = saved.players.length;
  state.target = normalizeTarget(saved.target);
  state.players = saved.players.map(player => ({ name: player.name, total: 0 }));
  state.rounds = normalizeRounds(saved.rounds);
  recalculateTotalsFromRounds();
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

function normalizeRounds(rounds) {
  const safeRounds = Array.isArray(rounds) && rounds.length <= MAX_STORED_ROUNDS ? rounds : [];
  return safeRounds.map((round, roundIndex) => {
    const dealerIndex = round?.dealerIndex;
    return {
      roundNumber: roundIndex + 1,
      scores: Array.from({ length: state.playerCount }, (_, playerIndex) => {
        const score = Number(round?.scores?.[playerIndex] ?? 0);
        return Number.isSafeInteger(score) ? score : 0;
      }),
      dealerIndex: dealerIndex !== null
        && dealerIndex !== undefined
        && Number.isSafeInteger(Number(dealerIndex))
        && Number(dealerIndex) >= 0
        && Number(dealerIndex) < state.playerCount
        ? Number(dealerIndex)
        : null,
      at: toNonNegativeInteger(round?.at, Date.now())
    };
  });
}

function recalculateTotalsFromRounds() {
  state.players.forEach((player, playerIndex) => {
    player.total = state.rounds.reduce((total, round) => total + Number(round.scores[playerIndex] || 0), 0);
  });
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
  closeDealerOverlay();
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
  if (screen === "setup") closeDealerOverlay();
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
  safeStorageRemove(STORAGE_KEYS.stats);
  safeStorageRemove(STORAGE_KEYS.recentGames);
  refreshKnownPlayers();
  renderStats();
  showToast("Statistiques réinitialisées.");
}

function normalizeName(value) {
  return normalizeDisplayText(value, MAX_PLAYER_NAME_LENGTH);
}

function normalizeDisplayText(value, maxLength) {
  const text = String(value ?? "");
  const normalized = typeof text.normalize === "function" ? text.normalize("NFKC") : text;
  return normalized
    .replace(/[\u0000-\u001F\u007F-\u009F\u202A-\u202E\u2066-\u2069]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, Math.max(0, toSafeInteger(maxLength)));
}

function formatNumber(value) {
  const number = Number(value);
  return (Number.isFinite(number) ? number : 0).toLocaleString("fr-FR");
}

function signed(value) {
  const number = Number.isFinite(Number(value)) ? Number(value) : 0;
  return `${number > 0 ? "+" : ""}${formatNumber(number)}`;
}

function formatDate(timestamp) {
  const date = new Date(toNonNegativeInteger(timestamp, Date.now()));
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit" }).format(date);
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
  button.addEventListener("click", event => {
    event.preventDefault();
    if (button.disabled) return;
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
bindReliableTap(document.getElementById("validateRoundBtn"), validateRound);
document.getElementById("undoBtn").addEventListener("click", undoLastRound);
document.getElementById("historyBtn").addEventListener("click", () => { renderHistory(); els.historyDialog.showModal(); });

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
    const publishedVersion = String(published.version ?? "");
    if (!/^\d{1,6}$/.test(publishedVersion) || publishedVersion === APP_VERSION) return;
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.filter(key => key.startsWith("willy-card-counter-")).map(key => caches.delete(key)));
    }
    const registration = await navigator.serviceWorker?.getRegistration();
    await registration?.update();
    const updateUrl = new URL(`./?app=v${publishedVersion}&updated=1`, window.location.href);
    if (updateUrl.origin === window.location.origin) window.location.replace(updateUrl.href);
  } catch {}
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") checkPublishedVersion();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`./sw.js?v=${APP_VERSION}`, { updateViaCache: "none" })
      .then(registration => registration.update())
      .catch(() => {});
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    try {
      if (sessionStorage.getItem("willy-card-controller-reload") === APP_VERSION) return;
      sessionStorage.setItem("willy-card-controller-reload", APP_VERSION);
    } catch {}
    window.location.replace(`./?app=v${APP_VERSION}&updated=1`);
  });
}
