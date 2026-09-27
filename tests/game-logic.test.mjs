import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const source = await readFile(path.join(ROOT, "app.js"), "utf8");

function evaluateSlice(startMarker, endMarker, additions = {}) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(start, -1, `Marqueur absent : ${startMarker}`);
  assert.notEqual(end, -1, `Marqueur absent : ${endMarker}`);
  const sandbox = { ...additions };
  vm.createContext(sandbox);
  vm.runInContext(source.slice(start, end), sandbox);
  return sandbox;
}

test("la rotation du donneur reste correcte pour 2, 3 et 4 joueurs", () => {
  const sandbox = evaluateSlice("function normalizeDealerState", "function renderDealerBanner", { state: null });

  for (const playerCount of [2, 3, 4]) {
    sandbox.state = {
      playerCount,
      players: Array.from({ length: playerCount }, (_, index) => ({ name: `J${index + 1}` })),
      rounds: [],
      dealerOrder: [],
      dealerSetupStartRound: 0,
      gameFinished: false
    };
    const requiredChoices = sandbox.getRequiredDealerChoices();
    assert.equal(requiredChoices, playerCount - 1);

    for (let roundIndex = 0; roundIndex < requiredChoices; roundIndex += 1) {
      assert.equal(sandbox.dealerChoiceIsNeeded(), true, `Question attendue à ${playerCount} joueurs, manche ${roundIndex + 1}`);
      sandbox.state.dealerOrder.push(roundIndex);
      if (sandbox.state.dealerOrder.length >= requiredChoices) {
        const missingIndex = sandbox.state.players.findIndex((_, index) => !sandbox.state.dealerOrder.includes(index));
        if (missingIndex >= 0) sandbox.state.dealerOrder.push(missingIndex);
      }
      assert.equal(sandbox.getCurrentDealerIndex(), roundIndex);
      sandbox.state.rounds.push({ dealerIndex: roundIndex, scores: Array(playerCount).fill(0) });
    }

    assert.equal(sandbox.dealerChoiceIsNeeded(), false);
    assert.equal(sandbox.getCurrentDealerIndex(), requiredChoices % playerCount);
  }
});

test("la partie ne s'arrête qu'au seuil configuré", () => {
  let result = null;
  const sandbox = evaluateSlice("function checkTargetWinner", "function undoLastRound", {
    state: null,
    normalizeTarget: value => [0, 500, 1000].includes(Number(value)) ? Number(value) : 500,
    finishWithWinner: (...args) => { result = args; }
  });

  sandbox.state = {
    target: 500,
    players: [{ name: "Alice", total: 152 }, { name: "Bob", total: 120 }]
  };
  assert.equal(sandbox.checkTargetWinner(), false);
  assert.equal(result, null);

  sandbox.state.players[0].total = 500;
  assert.equal(sandbox.checkTargetWinner(), true);
  assert.equal(result[0], 0);
  assert.equal(result[1], true);
});

test("la fin manuelle classe le meilleur total", () => {
  let result = null;
  const sandbox = evaluateSlice("function finishManualGame", "function renderWinnerPodium", {
    state: {
      gameFinished: false,
      players: [
        { name: "Alice", total: 12 },
        { name: "Bob", total: 40 },
        { name: "Chloé", total: 18 }
      ]
    },
    finishWithWinner: (...args) => { result = args; }
  });
  sandbox.finishManualGame();
  assert.equal(result[0], 1);
  assert.equal(result[1], false);
  assert.deepEqual(Array.from(result[2]), [1]);
});

test("les données locales malformées sont bornées et neutralisées", () => {
  const sandbox = evaluateSlice("function normalizeTarget", "function getStats", {
    VALID_TARGETS: [0, 500, 1000],
    MAX_PLAYER_NAME_LENGTH: 24,
    MAX_PLAYERS: 4,
    MAX_STORED_PLAYERS: 200,
    MAX_STORED_ROUNDS: 10000,
    MIN_PLAYERS: 2
  });
  sandbox.normalizeName = value => String(value ?? "").trim().slice(0, 24);

  const stored = sandbox.normalizeStoredGame({
    players: [{ name: "Alice" }, { name: "Bob" }],
    rounds: [{ scores: [Number.MAX_SAFE_INTEGER + 1, 12], dealerIndex: 99 }],
    dealerOrder: [0, 0, 99],
    target: 152
  });
  assert.equal(stored.target, 500);
  assert.deepEqual(Array.from(stored.rounds[0].scores), [0, 12]);
  assert.equal(stored.rounds[0].dealerIndex, null);
  assert.deepEqual(Array.from(stored.dealerOrder), [0]);

  assert.equal(sandbox.normalizeStoredGame({
    players: [{ name: "A" }, { name: "B" }, { name: "C" }, { name: "D" }, { name: "E" }],
    rounds: []
  }), null);

  const stats = sandbox.normalizeStats(JSON.parse('{"constructor":{"games":3,"wins":2},"prototype":{"games":1,"wins":5}}'));
  assert.equal(Object.getPrototypeOf(stats), null);
  assert.deepEqual({ ...stats.constructor }, { games: 3, wins: 2 });
  assert.deepEqual({ ...stats.prototype }, { games: 1, wins: 1 });
});

test("les noms affichés dans du HTML sont échappés", () => {
  const sandbox = evaluateSlice("function normalizeName", "let toastTimer", {
    MAX_PLAYER_NAME_LENGTH: 24,
    toSafeInteger: value => Number.isSafeInteger(Number(value)) ? Number(value) : 0,
    toNonNegativeInteger: value => Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : Date.now()
  });
  const attack = '<img src=x onerror="alert(1)">';
  const escaped = sandbox.escapeHtml(attack);
  assert.equal(escaped.includes("<img"), false);
  assert.equal(escaped.includes('onerror="'), false);
  assert.match(escaped, /&lt;img/);
});

test("les rendus HTML passent par la politique Trusted Types lorsqu'elle existe", () => {
  const sandbox = evaluateSlice("const APP_VERSION", "const VALID_TARGETS", {
    window: {
      __COUNTER_BUILD__: "23",
      trustedTypes: {
        createPolicy(name, rules) {
          assert.equal(name, "counter-renderer");
          return { createHTML: markup => ({ trusted: rules.createHTML(markup) }) };
        }
      }
    }
  });
  const element = { innerHTML: null };
  sandbox.setHTML(element, "<strong>contenu contrôlé</strong>");
  assert.deepEqual(element.innerHTML, { trusted: "<strong>contenu contrôlé</strong>" });
});

test("les chaînes locales excessives sont refusées avant le parsing JSON", () => {
  const sandbox = evaluateSlice("function safeParse", "function safeStorageGet");
  assert.equal(sandbox.safeParse('{"ok":true}', {}).ok, true);
  assert.equal(sandbox.safeParse("x".repeat(2_000_001), null), null);
});

test("la compatibilité mobile ne dépend pas de Array.prototype.at", () => {
  assert.equal(source.includes(".at("), false);
});
