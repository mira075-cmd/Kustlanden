/* Kustlanden — original hex settlement game. Not affiliated with Catan. */
const RES = ["hout", "steen", "graan", "wol", "erts"];
const RES_COLOR = {
  hout: "#2f6b3a",
  steen: "#8a5a3b",
  graan: "#d4b43a",
  wol: "#7aa86a",
  erts: "#6b7380",
  woestijn: "#c2a36b",
  zee: "#1d4f6e",
};
const SEAT_PRESET = [
  { name: "Rood", color: "#c45c4a" },
  { name: "Blauw", color: "#4a7ec4" },
  { name: "Goud", color: "#d4a017" },
  { name: "Groen", color: "#5aa06a" },
];
const CORE19 = [
  [0, -2], [1, -2], [2, -2],
  [-1, -1], [0, -1], [1, -1], [2, -1],
  [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0],
  [-2, 1], [-1, 1], [0, 1], [1, 1],
  [-2, 2], [-1, 2], [0, 2],
];
function around(cells) {
  const have = new Set(cells.map(([q,r]) => q + "," + r));
  const extra = [];
  cells.forEach(([q,r]) => {
    [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]].forEach(([dq,dr]) => {
      const k = (q+dq) + "," + (r+dr);
      if (!have.has(k)) { have.add(k); extra.push([q+dq, r+dr]); }
    });
  });
  return extra;
}
const MAPS = {
  kernland: { title: "Kernland", blurb: "Klassiek binnenland, 19 tegels.", land: CORE19, zee: [] },
  ringzee: { title: "Ringzee", blurb: "Eiland met zee eromheen.", land: CORE19, zee: around(CORE19) },
  tweestroom: {
    title: "Twee kusten",
    blurb: "Twee landmassa's met water ertussen.",
    land: [[-3,-1],[-2,-1],[-3,0],[-2,0],[-2,1],[-1,0],[2,-1],[3,-1],[2,0],[3,0],[2,1],[3,1],[0,-2],[1,2]],
    zee: [[0,-1],[1,-1],[0,0],[1,0],[0,1],[1,1],[-1,-1],[-1,1],[2,-2],[-2,-2]]
  },
  keten: {
    title: "Lange kust",
    blurb: "Smal eiland, veel kust.",
    land: [[-3,0],[-2,0],[-1,0],[0,0],[1,0],[2,0],[3,0],[-2,-1],[0,-1],[2,-1],[-1,1],[1,1]],
    zee: around([[-3,0],[-2,0],[-1,0],[0,0],[1,0],[2,0],[3,0],[-2,-1],[0,-1],[2,-1],[-1,1],[1,1]])
  },
};
let CFG = { map: "kernland", seats: [
  { name: "Rood", human: true },
  { name: "Blauw", human: false },
  { name: "Goud", human: false },
  { name: "Groen", human: false },
]};

function hexKey(q, r) { return q + "," + r; }
function hexToPixel(q, r, size) {
  const x = size * Math.sqrt(3) * (q + r / 2);
  const y = size * (3 / 2) * r;
  return { x, y };
}
function cubeRound(q, r) {
  let x = q, z = r, y = -x - z;
  let rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
  const xDiff = Math.abs(rx - x), yDiff = Math.abs(ry - y), zDiff = Math.abs(rz - z);
  if (xDiff > yDiff && xDiff > zDiff) rx = -ry - rz;
  else if (yDiff > zDiff) ry = -rx - rz;
  else rz = -rx - ry;
  return { q: rx, r: rz };
}
function neighbors(q, r) {
  return [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]].map(([dq, dr]) => [q + dq, r + dr]);
}
function vertexId(q, r, i) { return hexKey(q, r) + ":" + i; }

function buildGraph(hexes, size) {
  const verts = new Map();
  const edges = new Map();
  function addVert(q, r, i, p) {
    const id = vertexId(q, r, i);
    if (!verts.has(id)) verts.set(id, { id, x: p.x, y: p.y, hexes: [], corners: [] });
    const v = verts.get(id);
    if (!v.hexes.some((h) => h.q === q && h.r === r)) v.hexes.push({ q, r });
    return v;
  }
  hexes.forEach((h) => {
    const c = hexToPixel(h.q, h.r, size);
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 180) * (60 * i - 30);
      pts.push({ x: c.x + size * Math.cos(a), y: c.y + size * Math.sin(a) });
    }
    const ids = [];
    pts.forEach((p, i) => {
      let found = null;
      for (const v of verts.values()) {
        if ((v.x - p.x) ** 2 + (v.y - p.y) ** 2 < 8) { found = v; break; }
      }
      if (found) {
        if (!found.hexes.some((hh) => hh.q === h.q && hh.r === h.r)) found.hexes.push({ q: h.q, r: h.r });
        ids.push(found.id);
      } else {
        const id = "v" + verts.size;
        verts.set(id, { id, x: p.x, y: p.y, hexes: [{ q: h.q, r: h.r }] });
        ids.push(id);
      }
    });
    h.vertIds = ids;
    ids.forEach((a, i) => {
      const b = ids[(i + 1) % 6];
      const ekey = [a, b].sort().join("|");
      if (!edges.has(ekey)) edges.set(ekey, { id: ekey, a, b });
    });
  });
  return { verts, edges };
}

function shuffle(a) {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

function newBoard(mapId) {
  const map = MAPS[mapId] || MAPS.kernland;
  const landN = map.land.length;
  const bag = [];
  const cycle = ["hout","steen","graan","wol","erts"];
  for (let i = 0; i < landN; i++) bag.push(i === Math.floor(landN/2) ? "woestijn" : cycle[i % cycle.length]);
  const types = shuffle(bag);
  const nums = shuffle([2,3,3,4,4,5,5,6,6,8,8,9,9,10,10,11,11,12,3,4,5,9,10,11]);
  let ni = 0;
  const hexes = map.land.map(([q,r], i) => {
    const type = types[i];
    const number = type === "woestijn" ? 0 : nums[ni++];
    return { q, r, type, number };
  });
  map.zee.forEach(([q,r]) => hexes.push({ q, r, type: "zee", number: 0 }));
  return hexes;
}

function emptyBag() {
  return { hout: 0, steen: 0, graan: 0, wol: 0, erts: 0 };
}

function stateNew(cfg) {
  cfg = cfg || CFG;
  const hexes = newBoard(cfg.map);
  const robber = hexes.find((h) => h.type === "woestijn") || hexes.find((h) => h.type !== "zee") || hexes[0];
  const n = cfg.seats.length;
  const players = cfg.seats.map((s, i) => ({
    id: i,
    name: s.name || SEAT_PRESET[i].name,
    color: SEAT_PRESET[i].color,
    human: !!s.human,
    res: emptyBag(),
    roads: [],
    ships: [],
    spots: [],
    vp: 0,
    knights: 0,
    army: 0,
    dev: [],
    newDev: [],
  }));
  return {
    hexes,
    robber: { q: robber.q, r: robber.r },
    players,
    turn: 0,
    phase: "setup",
    setupStep: 0,
    lastDice: null,
    log: ["Nieuwe partij op " + (MAPS[cfg.map]||MAPS.kernland).title + ". Eerste huis zetten."],
    winner: null,
    mapId: cfg.map,
    deck: newDeck(),
    armyOwner: null,
    roadOwner: null,
    freeBuilds: 0,
    pendingDev: null,
  };
}
function newDeck() {
  const d = [];
  for (let i = 0; i < 14; i++) d.push("ridder");
  for (let i = 0; i < 5; i++) d.push("punt");
  d.push("stratenbouw", "stratenbouw", "uitvinding", "uitvinding", "monopolie", "monopolie");
  return shuffle(d);
}

const SIZE = 42;
let G = stateNew();
let GRAPH = null;
let selected = null;
let HOVER = { v: null, e: null, h: null };
let MODE = "auto";

function log(msg) {
  G.log.unshift(msg);
  G.log = G.log.slice(0, 40);
  renderLog();
}

function current() { return G.players[G.turn % G.players.length]; }

function isLandHex(ref) {
  const h = G.hexes.find((x) => x.q === ref.q && x.r === ref.r);
  return !!(h && h.type !== "zee");
}
function vertexOnLand(id) {
  const v = GRAPH.verts.get(id);
  return !!(v && v.hexes.some(isLandHex));
}
function edgeOnLand(e) {
  const a = GRAPH.verts.get(e.a), b = GRAPH.verts.get(e.b);
  if (!a || !b) return false;
  const shared = a.hexes.filter((h) => b.hexes.some((x) => x.q === h.q && x.r === h.r));
  return shared.some(isLandHex);
}
function vertexFree(id) {
  if (!vertexOnLand(id)) return false;
  const used = new Set();
  G.players.forEach((p) => p.spots.forEach((s) => used.add(s.v)));
  if (used.has(id)) return false;
  const adj = adjacentVertices(id);
  return !adj.some((x) => used.has(x));
}

function adjacentVertices(id) {
  const out = [];
  GRAPH.edges.forEach((e) => {
    if (e.a === id) out.push(e.b);
    if (e.b === id) out.push(e.a);
  });
  return out;
}

function playerTouchesVertex(p, id) {
  if (p.spots.some((s) => s.v === id)) return true;
  if (p.roads.some((r) => r.a === id || r.b === id)) return true;
  return (p.ships || []).some((r) => r.a === id || r.b === id);
}

function roadTaken(e) {
  return G.players.some((o) =>
    o.roads.some((r) => r.id === e.id) || (o.ships || []).some((r) => r.id === e.id)
  );
}
function edgeTouchesSea(e) {
  const a = GRAPH.verts.get(e.a), b = GRAPH.verts.get(e.b);
  if (!a || !b) return false;
  const shared = a.hexes.filter((h) => b.hexes.some((x) => x.q === h.q && x.r === h.r));
  return shared.some((ref) => {
    const h = G.hexes.find((x) => x.q === ref.q && x.r === ref.r);
    return h && h.type === "zee";
  });
}
function canBuildRoad(p, e) {
  if (roadTaken(e) || !edgeOnLand(e)) return false;
  if (G.phase === "setup-road") {
    const last = p.spots[p.spots.length - 1];
    return !!(last && (e.a === last.v || e.b === last.v));
  }
  return playerTouchesVertex(p, e.a) || playerTouchesVertex(p, e.b);
}
function canBuildHouse(p, id) {
  if (!vertexFree(id)) return false;
  if (G.phase === "setup") return true;
  return playerTouchesVertex(p, id);
}
function canBuildShip(p, e) {
  if (roadTaken(e) || !edgeTouchesSea(e)) return false;
  if (G.phase !== "main") return false;
  return playerTouchesVertex(p, e.a) || playerTouchesVertex(p, e.b);
}
function canBuildCity(p, id) {
  return !!p.spots.find((s) => s.v === id && !s.city);
}

function pay(p, cost) {
  for (const k of Object.keys(cost)) if ((p.res[k] || 0) < cost[k]) return false;
  for (const k of Object.keys(cost)) p.res[k] -= cost[k];
  return true;
}

function give(p, type, n) { p.res[type] = (p.res[type] || 0) + n; }

function produce(roll) {
  G.hexes.forEach((h) => {
    if (h.number !== roll) return;
    if (G.robber.q === h.q && G.robber.r === h.r) return;
    if (h.type === "woestijn" || h.type === "zee") return;
    G.players.forEach((p) => {
      p.spots.forEach((s) => {
        const v = GRAPH.verts.get(s.v);
        if (!v) return;
        if (v.hexes.some((hh) => hh.q === h.q && hh.r === h.r)) {
          give(p, h.type, s.city ? 2 : 1);
        }
      });
    });
  });
}

function countRes(p) {
  return RES.reduce((n, k) => n + (p.res[k] || 0), 0);
}

function rollDice() {
  if (G.phase !== "main" || G.rolled || G.rolling) return;
  const finalA = 1 + Math.floor(Math.random() * 6);
  const finalB = 1 + Math.floor(Math.random() * 6);
  const fx = document.getElementById("diceFx");
  const dA = document.getElementById("dieA");
  const dB = document.getElementById("dieB");
  const sum = document.getElementById("diceSum");
  if (!fx) { applyRoll(finalA, finalB); return; }
  G.rolling = true;
  fx.classList.add("show");
  let n = 0;
  const tick = setInterval(() => {
    dA.textContent = 1 + Math.floor(Math.random() * 6);
    dB.textContent = 1 + Math.floor(Math.random() * 6);
    if (++n >= 14) {
      clearInterval(tick);
      dA.textContent = finalA;
      dB.textContent = finalB;
      sum.textContent = finalA + finalB === 7 ? "7 — zwerver" : String(finalA + finalB);
      setTimeout(() => {
        fx.classList.remove("show");
        sum.textContent = "";
        G.rolling = false;
        applyRoll(finalA, finalB);
      }, 550);
    }
  }, 55);
}
function applyRoll(a, b) {
  G.lastDice = a + b;
  G.rolled = true;
  log("Dobbelsteen: " + G.lastDice);
  if (G.lastDice === 7) {
    G.players.forEach((p) => {
      const n = countRes(p);
      if (n > 7) {
        let drop = Math.floor(n / 2);
        const keys = RES.slice();
        while (drop > 0) {
          const k = keys[Math.floor(Math.random() * keys.length)];
          if (p.res[k] > 0) { p.res[k]--; drop--; }
        }
        log(p.name + " gooit de helft van de voorraad weg.");
      }
    });
    G.phase = "robber";
    log("7: verplaats de zwerver.");
    if (!current().human) aiRobber();
  } else {
    produce(G.lastDice);
  }
  renderAll();
  if (current().human === false && G.phase === "main") setTimeout(aiTurnRest, 500);
}

function endTurn() {
  if (G.winner) return;
  if (G.phase === "main" && current().human && !G.rolled) return;
  G.rolled = false;
  G.freeBuilds = 0; current().playedDev = false;
  G.pendingDev = null;
  current().newDev = [];
  G.turn = (G.turn + 1) % G.players.length;
  G.phase = "main";
  log("Beurt: " + current().name);
  renderAll();
  if (!current().human) setTimeout(aiTurn, 600);
}

function setupPlaceSettlement(vId) {
  const p = current();
  if (!vertexFree(vId)) return false;
  p.spots.push({ v: vId, city: false });
  if (G.setupStep >= 4) {
    const v = GRAPH.verts.get(vId);
    if (v) v.hexes.forEach((hh) => {
      const h = G.hexes.find((x) => x.q === hh.q && x.r === hh.r);
      if (h && h.type !== "woestijn") give(p, h.type, 1);
    });
  }
  G.phase = "setup-road";
  log(p.name + " zet een huis.");
  renderAll();
  scheduleSetup();
  return true;
}

function setupPlaceRoad(e) {
  const p = current();
  if (!canBuildRoad(p, e)) return;
  p.roads.push({ id: e.id, a: e.a, b: e.b });
  G.setupStep += 1;
  const n = G.players.length;
  const order = [...Array(n).keys(), ...[...Array(n).keys()].reverse()];
  if (G.setupStep >= order.length) {
    G.phase = "main";
    G.turn = 0;
    G.rolled = false;
    log("Opstelling klaar. Jij dobbelt.");
  } else {
    G.turn = order[G.setupStep];
    G.phase = "setup";
    log("Beurt opstelling: " + current().name);
  }
  renderAll();
  scheduleSetup();
}

function buildSettlement(vId) {
  const p = current();
  if (G.phase !== "main" || !G.rolled) return;
  if (!vertexFree(vId)) return;
  if (!p.roads.some((r) => r.a === vId || r.b === vId)) return;
  if (!pay(p, { hout: 1, steen: 1, graan: 1, wol: 1 })) return;
  p.spots.push({ v: vId, city: false });
  score();
  log(p.name + " bouwt een nederzetting.");
  renderAll();
}

function buildCity(vId) {
  const p = current();
  const s = p.spots.find((x) => x.v === vId && !x.city);
  if (!s) return;
  if (!pay(p, { graan: 2, erts: 3 })) return;
  s.city = true;
  score();
  log(p.name + " sticht een stad.");
  renderAll();
}

function buildRoad(e) {
  const p = current();
  if (G.phase !== "main" || !G.rolled) return;
  if (!canBuildRoad(p, e)) return;
  if (G.freeBuilds > 0) G.freeBuilds--;
  else if (!pay(p, { hout: 1, steen: 1 })) return;
  p.roads.push({ id: e.id, a: e.a, b: e.b });
  score();
  log(p.name + " bouwt een pad.");
  renderAll();
}
function buildShip(e) {
  const p = current();
  if (G.phase !== "main" || !G.rolled) return;
  if (!canBuildShip(p, e)) return;
  if (G.freeBuilds > 0) G.freeBuilds--;
  else if (!pay(p, { hout: 1, wol: 1 })) return;
  p.ships = p.ships || [];
  p.ships.push({ id: e.id, a: e.a, b: e.b });
  score();
  log(p.name + " legt een boot (hout+wol).");
  renderAll();
}

function bankTrade(from, to) {
  const p = current();
  if ((p.res[from] || 0) < 4) return;
  p.res[from] -= 4;
  p.res[to] += 1;
  log(p.name + " wisselt 4 " + from + " voor 1 " + to + ".");
  renderAll();
}

function moveRobber(h) {
  if (G.phase !== "robber") return;
  G.robber = { q: h.q, r: h.r };
  G.phase = "main";
  log("Zwerver naar " + h.type + ".");
  renderAll();
  if (!current().human) setTimeout(aiTurnRest, 400);
}

function score() {
  G.players.forEach((p) => {
    const hidden = (p.dev || []).filter((c) => c === "punt").length;
    p.vp = p.spots.reduce((n, s) => n + (s.city ? 2 : 1), 0) + hidden;
    if (G.armyOwner === p.id) p.vp += 2;
  });
  const best = G.players.slice().sort((a, b) => b.vp - a.vp)[0];
  if (best && best.vp >= 10) {
    G.winner = best;
    G.phase = "over";
    log(best.name + " wint met " + best.vp + " punten.");
  }
}

function scheduleSetup() {
  if (G.phase === "main" || G.winner) return;
  if (current().human) return;
  clearTimeout(window._aiT);
  window._aiT = setTimeout(aiSetup, 550);
}
function aiSetup() {
  const p = current();
  if (p.human || G.phase === "main") return;
  if (G.phase === "setup") {
    const opts = [...GRAPH.verts.values()].filter((v) => vertexFree(v.id));
    opts.sort((a, b) => pipValue(b) - pipValue(a));
    if (!opts.length) { log("Geen vrije plek voor " + p.name); return; }
    setupPlaceSettlement(opts[0].id);
    return;
  }
  if (G.phase === "setup-road") {
    const last = p.spots[p.spots.length - 1];
    if (!last) { log(p.name + " heeft nog geen huis."); return; }
    let e = [...GRAPH.edges.values()].find((x) => canBuildRoad(p, x));
    if (e) setupPlaceRoad(e);
    else log(p.name + " vindt geen pad.");
  }
}

function pipValue(v) {
  const pip = { 2:1,3:2,4:3,5:4,6:5,8:5,9:4,10:3,11:2,12:1 };
  return v.hexes.reduce((n, hh) => {
    const h = G.hexes.find((x) => x.q === hh.q && x.r === hh.r);
    return n + (h ? (pip[h.number] || 0) : 0);
  }, 0);
}

function aiRobber() {
  const h = G.hexes.find((x) => x.type !== "woestijn" && !(x.q === G.robber.q && x.r === G.robber.r));
  if (h) moveRobber(h);
}

function aiTurn() {
  if (G.winner || current().human) return;
  if (G.phase === "setup" || G.phase === "setup-road") return aiSetup();
  if (!G.rolled) rollDice();
  else aiTurnRest();
}

function vertexOwner(id) {
  return G.players.find((pl) => pl.spots.some((s) => s.v === id)) || null;
}
function roadValue(p, e) {
  let v = 0;
  [e.a, e.b].forEach((id) => {
    const owner = vertexOwner(id);
    if (owner && owner.id !== p.id) v -= 12;
    else if (vertexFree(id) && !playerTouchesVertex(p, id)) {
      const vert = GRAPH.verts.get(id);
      v += 6 + (vert ? pipValue(vert) : 0);
    } else if (owner && owner.id === p.id) v += 1;
  });
  return v;
}
function bestRoad(p) {
  const opts = [...GRAPH.edges.values()].filter((e) => canBuildRoad(p, e));
  if (!opts.length) return null;
  opts.sort((a, b) => roadValue(p, b) - roadValue(p, a));
  return roadValue(p, opts[0]) > 0 ? opts[0] : null;
}
function aiTurnRest() {
  const p = current();
  if (G.phase !== "main") return;
  const tryPay = (cost) => RES.every((k) => (p.res[k] || 0) >= (cost[k] || 0));
  if (tryPay({ graan: 2, erts: 3 })) {
    const s = p.spots.find((x) => !x.city);
    if (s) buildCity(s.v);
  }
  if (tryPay({ hout: 1, steen: 1, graan: 1, wol: 1 })) {
    const opts = [...GRAPH.verts.values()].filter((x) => canBuildHouse(p, x.id));
    opts.sort((a, b) => pipValue(b) - pipValue(a));
    if (opts[0]) buildSettlement(opts[0].id);
  }
  if (tryPay({ hout: 1, steen: 1 })) {
    const e = bestRoad(p);
    if (e) buildRoad(e);
  }
  if (tryPay({ hout: 1, wol: 1 })) {
    const ships = [...GRAPH.edges.values()].filter((e) => canBuildShip(p, e));
    ships.sort((a, b) => roadValue(p, b) - roadValue(p, a));
    if (ships[0] && roadValue(p, ships[0]) > 0) buildShip(ships[0]);
  }
  if ((p.res.hout || 0) >= 4) bankTrade("hout", "steen");
  setTimeout(endTurn, 700);
}

let canvas, ctx;
const IMGS = {};
function loadImages(done) {
  const files = {
    hout: "img/hout.jpg", steen: "img/steen.jpg", graan: "img/graan.jpg",
    wol: "img/wol.jpg", erts: "img/erts.jpg", woestijn: "img/woestijn.jpg",
    tafel: "img/tafel.jpg", huis: "img/huis.jpg", stad: "img/stad.jpg", zwerver: "img/zwerver.jpg",
  };
  let left = Object.keys(files).length;
  Object.entries(files).forEach(([k, src]) => {
    const im = new Image();
    im.onload = () => { if (--left === 0) done(); };
    im.onerror = () => { if (--left === 0) done(); };
    im.src = src;
    IMGS[k] = im;
  });
}
function layoutGraph() {
  GRAPH = buildGraph(G.hexes, SIZE);
}

function draw() {
  canvas = document.getElementById("board");
  ctx = canvas.getContext("2d");
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  if (IMGS.tafel && IMGS.tafel.complete) ctx.drawImage(IMGS.tafel, 0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, H / 2 + 8);
  G.hexes.forEach((h) => drawHex(h));
  drawGuides();
  GRAPH.edges.forEach((e) => {
    const owner = G.players.find((p) => p.roads.some((r) => r.id === e.id));
    if (!owner) return;
    const a = GRAPH.verts.get(e.a), b = GRAPH.verts.get(e.b);
    ctx.strokeStyle = owner.color;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  });
  G.players.forEach((pl) => {
    (pl.ships || []).forEach((s) => {
      const a = GRAPH.verts.get(s.a), b = GRAPH.verts.get(s.b);
      if (!a || !b) return;
      ctx.strokeStyle = pl.color;
      ctx.lineWidth = 5;
      ctx.setLineDash([7, 5]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.setLineDash([]);
    });
  });
  GRAPH.verts.forEach((v) => {
    const owner = G.players.find((p) => p.spots.some((s) => s.v === v.id));
    if (!owner) return;
    const city = owner.spots.find((s) => s.v === v.id).city;
    drawPiece(v.x, v.y, owner.color, city);
  });
  drawHover();
  ctx.restore();
}

function humanPlay() {
  const p = current();
  return p.human || G.phase === "robber";
}
function wantHouse() {
  return G.phase === "setup" || (G.phase === "main" && G.rolled && (MODE === "house" || MODE === "auto" || MODE === "city"));
}
function wantRoad() {
  return G.phase === "setup-road" || (G.phase === "main" && G.rolled && (MODE === "road" || MODE === "auto"));
}
function wantShip() {
  return G.phase === "main" && G.rolled && (MODE === "ship" || MODE === "auto");
}
function drawGuides() {
  if (!GRAPH || G.winner) return;
  const p = current();
  if (!p.human && G.phase !== "robber") return;
  if (G.phase === "robber") {
    G.hexes.forEach((h) => {
      if (h.q === G.robber.q && h.r === G.robber.r) return;
      const c = hexToPixel(h.q, h.r, SIZE);
      ctx.beginPath();
      ctx.arc(c.x, c.y + 16, 7, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,220,120,.35)";
      ctx.fill();
    });
    return;
  }
  if (wantShip()) {
    GRAPH.edges.forEach((e) => {
      if (!canBuildShip(p, e)) return;
      const a = GRAPH.verts.get(e.a), b = GRAPH.verts.get(e.b);
      ctx.strokeStyle = "rgba(120,190,230,.7)";
      ctx.lineWidth = 4;
      ctx.setLineDash([3, 5]);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.setLineDash([]);
    });
  }
  if (wantRoad()) {
    GRAPH.edges.forEach((e) => {
      if (!canBuildRoad(p, e)) return;
      const a = GRAPH.verts.get(e.a), b = GRAPH.verts.get(e.b);
      ctx.strokeStyle = "rgba(243,230,200,.55)";
      ctx.lineWidth = 4;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.setLineDash([]);
    });
  }
  if (wantHouse()) {
    GRAPH.verts.forEach((v) => {
      const cityOk = G.phase === "main" && canBuildCity(p, v.id) && (MODE === "city" || MODE === "auto");
      const houseOk = canBuildHouse(p, v.id) && MODE !== "city" && MODE !== "road";
      if (!houseOk && !cityOk) return;
      ctx.beginPath();
      ctx.arc(v.x, v.y, cityOk ? 8 : 6, 0, Math.PI * 2);
      ctx.fillStyle = cityOk ? "rgba(255,210,80,.85)" : p.color;
      ctx.globalAlpha = 0.85;
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "#f3e6c8";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });
  }
}
function drawHover() {
  const p = current();
  if (HOVER.e && wantRoad() && canBuildRoad(p, HOVER.e)) {
    const a = GRAPH.verts.get(HOVER.e.a), b = GRAPH.verts.get(HOVER.e.b);
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 8;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  if (HOVER.v && wantHouse()) {
    const okH = canBuildHouse(p, HOVER.v.id);
    const okC = G.phase === "main" && canBuildCity(p, HOVER.v.id);
    if (okH || okC) {
      ctx.beginPath();
      ctx.arc(HOVER.v.x, HOVER.v.y, 11, 0, Math.PI * 2);
      ctx.strokeStyle = "#fff4d2";
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }
}

function drawPiece(x, y, color, city) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.strokeStyle = "#140e0a";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  if (city) {
    ctx.moveTo(-11, 8); ctx.lineTo(-11, -2); ctx.lineTo(-4, -2); ctx.lineTo(-4, -10);
    ctx.lineTo(4, -10); ctx.lineTo(4, -2); ctx.lineTo(11, -2); ctx.lineTo(11, 8);
  } else {
    ctx.moveTo(0, -11); ctx.lineTo(9, -2); ctx.lineTo(9, 8); ctx.lineTo(-9, 8); ctx.lineTo(-9, -2);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}
function drawHex(h) {
  const c = hexToPixel(h.q, h.r, SIZE);
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    const x = c.x + SIZE * Math.cos(a);
    const y = c.y + SIZE * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = RES_COLOR[h.type] || "#1d4f6e";
  ctx.fill();
  ctx.save();
  ctx.clip();
  const tile = IMGS[h.type];
  if (tile && tile.complete && h.type !== "zee") {
    ctx.drawImage(tile, c.x - SIZE * 1.05, c.y - SIZE * 1.05, SIZE * 2.1, SIZE * 2.1);
  }
  if (h.type === "zee") {
    ctx.fillStyle = "rgba(255,255,255,.08)";
    for (let k = -2; k < 3; k++) {
      ctx.beginPath();
      ctx.arc(c.x + k * 10, c.y + (k % 2) * 8, 5, 0, Math.PI);
      ctx.strokeStyle = "rgba(210,230,240,.25)";
      ctx.stroke();
    }
  }
  ctx.restore();
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    const x = c.x + SIZE * Math.cos(a);
    const y = c.y + SIZE * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.strokeStyle = "#3a2a18";
  ctx.lineWidth = 2.5;
  ctx.stroke();
  if (G.robber.q === h.q && G.robber.r === h.r) {
    if (IMGS.zwerver && IMGS.zwerver.complete) ctx.drawImage(IMGS.zwerver, c.x - 12, c.y + 2, 24, 36);
    else {
      ctx.fillStyle = "#111";
      ctx.beginPath();
      ctx.arc(c.x, c.y + 14, 8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (h.number) {
    ctx.beginPath();
    ctx.arc(c.x, c.y - 1, 13, 0, Math.PI * 2);
    ctx.fillStyle = "#efe3c4";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#6b542e";
    ctx.stroke();
    ctx.fillStyle = (h.number === 6 || h.number === 8) ? "#8b1e1e" : "#1a1410";
    ctx.font = "700 15px Georgia";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(h.number), c.x, c.y - 1);
  }
}

function canvasPoint(ev) {
  const rect = canvas.getBoundingClientRect();
  const src = ev.touches ? ev.touches[0] : ev;
  const x = (src.clientX - rect.left) * (canvas.width / rect.width) - canvas.width / 2;
  const y = (src.clientY - rect.top) * (canvas.height / rect.height) - (canvas.height / 2 + 8);
  return { x, y };
}
function hit(ev) {
  const { x, y } = canvasPoint(ev);
  let bestV = null, bestVd = 26 * 26;
  GRAPH.verts.forEach((v) => {
    const d = (v.x - x) ** 2 + (v.y - y) ** 2;
    if (d < bestVd) { bestVd = d; bestV = v; }
  });
  let bestE = null, bestEd = 16;
  GRAPH.edges.forEach((e) => {
    const a = GRAPH.verts.get(e.a), b = GRAPH.verts.get(e.b);
    const d = distToSeg(x, y, a.x, a.y, b.x, b.y);
    if (d < bestEd) { bestEd = d; bestE = e; }
  });
  let bestH = null, bestHd = SIZE * SIZE * 0.72;
  G.hexes.forEach((h) => {
    const c = hexToPixel(h.q, h.r, SIZE);
    const d = (c.x - x) ** 2 + (c.y - y) ** 2;
    if (d < bestHd) { bestHd = d; bestH = h; }
  });
  if (MODE === "road") bestV = null;
  if (MODE === "house" || MODE === "city") bestE = null;
  if (bestV && bestE) {
    if (Math.sqrt(bestVd) <= bestEd + 2) bestE = null;
    else bestV = null;
  }
  return { v: bestV, e: bestE, h: bestH };
}

function distToSeg(px, py, x1, y1, x2, y2) {
  const A = px - x1, B = py - y1, C = x2 - x1, D = y2 - y1;
  const dot = A * C + B * D;
  const len = C * C + D * D;
  let t = len ? dot / len : 0;
  t = Math.max(0, Math.min(1, t));
  const dx = px - (x1 + t * C), dy = py - (y1 + t * D);
  return Math.sqrt(dx * dx + dy * dy);
}

function onMove(ev) {
  if (!GRAPH) return;
  HOVER = hit(ev);
  draw();
}
function onClick(ev) {
  if (G.winner) return;
  const p = current();
  if (!p.human && G.phase !== "robber") return;
  const hitp = hit(ev);
  if (G.phase === "setup" && hitp.v && canBuildHouse(p, hitp.v.id)) return setupPlaceSettlement(hitp.v.id);
  if (G.phase === "setup-road" && hitp.e && canBuildRoad(p, hitp.e)) return setupPlaceRoad(hitp.e);
  if (G.phase === "robber" && hitp.h) return moveRobber(hitp.h);
  if (G.phase === "main" && p.human && G.rolled) {
    if (hitp.v) {
      if ((MODE === "city" || MODE === "auto") && canBuildCity(p, hitp.v.id)) return buildCity(hitp.v.id);
      if ((MODE === "house" || MODE === "auto") && canBuildHouse(p, hitp.v.id)) return buildSettlement(hitp.v.id);
    }
    if (hitp.e && (MODE === "ship" || MODE === "auto") && canBuildShip(p, hitp.e)) return buildShip(hitp.e);
    if (hitp.e && (MODE === "road" || MODE === "auto") && canBuildRoad(p, hitp.e)) return buildRoad(hitp.e);
  }
}
function setMode(m) {
  MODE = m;
  ["auto","road","house","city","ship"].forEach((k) => {
    const el = document.getElementById("mode" + k[0].toUpperCase() + k.slice(1));
    if (el) el.classList.toggle("primary", MODE === k);
  });
}


const DEV_LABEL = {
  ridder: "Ridder",
  punt: "Overwinningspunt",
  stratenbouw: "Stratenbouw",
  uitvinding: "Uitvinding",
  monopolie: "Monopolie",
};
function buyDev() {
  const p = current();
  if (!p.human || G.phase !== "main" || !G.rolled) return;
  if (!G.deck.length) { log("Geen kaarten meer."); return; }
  if (!pay(p, { wol: 1, graan: 1, erts: 1 })) { log("Kaart kost wol+graan+erts."); renderAll(); return; }
  const card = G.deck.pop();
  p.dev.push(card);
  p.newDev.push(card);
  log(p.name + " koopt een ontwikkelkaart.");
  score();
  renderAll();
}
function playDev(i) {
  const p = current();
  if (!p.human || G.phase !== "main") return;
  const card = p.dev[i];
  if (!card || card === "punt") return;
  if (p.newDev.includes(card) && p.newDev.filter((c)=>c===card).length >= p.dev.filter((c)=>c===card).length) {
    log("Die kaart is deze beurt gekocht.");
    return;
  }
  if (p.playedDev) { log("Al een kaart gespeeld."); return; }
  p.dev.splice(i, 1);
  p.playedDev = true;
  if (card === "ridder") {
    p.army += 1;
    const lead = G.players.slice().sort((a,b)=>b.army-a.army)[0];
    if (lead.army >= 3 && (G.armyOwner == null || G.players[G.armyOwner].army < lead.army)) {
      G.armyOwner = lead.id;
      log(lead.name + " heeft de grootste ridderwacht.");
    }
    G.phase = "robber";
    log("Ridder: verplaats de zwerver.");
  } else if (card === "stratenbouw") {
    G.freeBuilds = 2;
    log("Stratenbouw: zet 2 paden of boten gratis.");
  } else if (card === "uitvinding") {
    const a = prompt("Uitvinding: eerste grondstof (hout/steen/graan/wol/erts)", "hout");
    const b = prompt("Tweede grondstof", "graan");
    if (RES.includes(a)) give(p, a, 1);
    if (RES.includes(b)) give(p, b, 1);
    log("Uitvinding: 2 grondstoffen.");
  } else if (card === "monopolie") {
    const k = prompt("Monopolie: welke grondstof?", "graan");
    if (RES.includes(k)) {
      let n = 0;
      G.players.forEach((o) => {
        if (o.id === p.id) return;
        n += o.res[k] || 0;
        o.res[k] = 0;
      });
      give(p, k, n);
      log("Monopolie: +" + n + " " + k);
    }
  }
  score();
  renderAll();
}

function renderLog() {
  document.getElementById("log").innerHTML = G.log.slice(0, 6).map((l) => `<div>${l}</div>`).join("");
}

function hintText() {
  const p = current();
  if (G.winner) return G.winner.name + " wint met " + G.winner.vp + " punten.";
  if (G.phase === "setup") return p.name + ": tik een lichtend hoekpunt voor een huis.";
  if (G.phase === "setup-road") return p.name + ": tik een stippellijn voor een pad vanaf je huis.";
  if (G.phase === "robber") return p.name + ": tik een tegel voor de zwerver.";
  if (G.phase === "main" && !G.rolled) return p.name + ": dobbel eerst.";
  return p.name + ": kies Pad / Huis / Stad of tik een lichtend punt.";
}
const RES_DOT = { hout:"#2f6b3a", steen:"#8a5a3b", graan:"#d4b43a", wol:"#7aa86a", erts:"#6b7380" };
function renderAll() {
  draw();
  const me = current();
  const p = current();
  document.getElementById("res").innerHTML = RES.map((k) =>
    `<span class="res"><span class="ic" style="background:${RES_DOT[k]}"></span>${k}<b>${me.res[k]}</b></span>`
  ).join("");
  document.getElementById("status").textContent = G.winner
    ? G.winner.name + " wint"
    : p.name + (G.lastDice ? " · " + G.lastDice : "");
  document.getElementById("hint").textContent = hintText();
  const dot = document.getElementById("turnDot");
  if (dot) dot.style.background = p.color;
  const setup = G.phase === "setup" || G.phase === "setup-road";
  const s1 = document.getElementById("s1");
  const s2 = document.getElementById("s2");
  if (s1) {
    s1.classList.toggle("on", !setup && G.phase === "main" && !G.rolled);
    s2.classList.toggle("on", setup || G.phase === "robber" || (G.phase === "main" && !!G.rolled));
    s1.textContent = setup ? "Start" : "1 Dobbel";
    s2.textContent = G.phase === "setup" ? "Huis" : G.phase === "setup-road" ? "Pad" : G.phase === "robber" ? "Zwerver" : "2 Bouw";
  }
  document.getElementById("players").innerHTML = G.players.map((x) =>
    `<div class="seat${x.id === p.id ? " on" : ""}"><div class="name"><span class="sw" style="background:${x.color}"></span>${x.name}</div><div class="meta">${x.vp} VP · ${x.human ? "jij" : "AI"}</div></div>`
  ).join("");
  const hand = document.getElementById("hand");
  if (hand) {
    const p = current();
    if (!p.human) hand.innerHTML = "";
    else hand.innerHTML = (p.dev||[]).map((c,i) =>
      `<button class="pill" onclick="playDev(${i})">${DEV_LABEL[c]||c}${p.newDev&&p.newDev.includes(c)?" · nieuw":""}</button>`
    ).join("") || '<span class="costs">Geen ontwikkelkaarten</span>';
  }
    document.getElementById("roll").disabled = !(p.human && G.phase === "main" && !G.rolled);
  document.getElementById("end").disabled = !(p.human && G.phase === "main" && G.rolled);
  renderLog();
}

function showHelp() {
  document.getElementById("modal").classList.add("show");
}
function hideHelp() {
  document.getElementById("modal").classList.remove("show");
}

function restart() {
  document.getElementById("lobby").classList.add("show");
  syncLobby();
}
function applyGame() {
  G = stateNew(CFG);
  layoutGraph();
  renderAll();
  scheduleSetup();
}
function syncLobby() {
  const n = parseInt(document.getElementById("cfgCount").value, 10);
  const box = document.getElementById("cfgSeats");
  if (!CFG.seats) CFG.seats = [];
  while (CFG.seats.length < n) CFG.seats.push({ name: SEAT_PRESET[CFG.seats.length].name, human: false });
  CFG.seats = CFG.seats.slice(0, n);
  box.innerHTML = CFG.seats.map((s,i) => `<div class="seatrow">
    <span class="sw" style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${SEAT_PRESET[i].color}"></span>
    <input class="pill" value="${s.name}" onchange="CFG.seats[${i}].name=this.value" />
    <select class="pill" onchange="CFG.seats[${i}].human=this.value==='mens'">
      <option value="mens"${s.human?" selected":""}>Mens</option>
      <option value="ai"${s.human?"":" selected"}>AI</option>
    </select>
  </div>`).join("");
  document.getElementById("cfgMaps").innerHTML = Object.entries(MAPS).map(([id,m]) =>
    `<button class="mapcard${CFG.map===id?" on":""}" onclick="CFG.map='${id}';syncLobby()"><b>${m.title}</b><small>${m.blurb}</small></button>`
  ).join("");
}
function startFromLobby() {
  document.getElementById("lobby").classList.remove("show");
  applyGame();
}

function tradePrompt() {
  const from = document.getElementById("fromRes").value;
  const to = document.getElementById("toRes").value;
  if (from !== to) bankTrade(from, to);
}

window.addEventListener("load", () => {
  canvas = document.getElementById("board");
  canvas.addEventListener("click", onClick);
  canvas.addEventListener("mousemove", onMove);
  canvas.addEventListener("touchstart", (e) => { onMove(e); }, { passive: true });
  layoutGraph();
  loadImages(() => renderAll());
  setMode("auto");
  renderAll();
  syncLobby();
});
