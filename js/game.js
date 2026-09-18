/* Kustlanden — original hex settlement game. Not affiliated with Catan. */
const RES = ["hout", "steen", "graan", "wol", "erts"];
const RES_COLOR = {
  hout: "#2f6b3a",
  steen: "#8a5a3b",
  graan: "#d4b43a",
  wol: "#7aa86a",
  erts: "#6b7380",
  woestijn: "#c2a36b",
};
const PLAYERS = [
  { id: 0, name: "Jij", color: "#c45c4a", human: true },
  { id: 1, name: "Noor", color: "#4a7ec4", human: false },
  { id: 2, name: "Bram", color: "#d4a017", human: false },
  { id: 3, name: "Isa", color: "#5aa06a", human: false },
];

const HEX_LAYOUT = [
  [0, -2], [1, -2], [2, -2],
  [-1, -1], [0, -1], [1, -1], [2, -1],
  [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0],
  [-2, 1], [-1, 1], [0, 1], [1, 1],
  [-2, 2], [-1, 2], [0, 2],
];

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

function newBoard() {
  const types = shuffle(["hout","hout","hout","hout","steen","steen","steen","graan","graan","graan","graan","wol","wol","wol","wol","erts","erts","erts","woestijn"]);
  const nums = shuffle([2,3,3,4,4,5,5,6,6,8,8,9,9,10,10,11,11,12]);
  let ni = 0;
  const hexes = HEX_LAYOUT.map(([q, r], i) => {
    const type = types[i];
    const number = type === "woestijn" ? 0 : nums[ni++];
    return { q, r, type, number };
  });
  return hexes;
}

function emptyBag() {
  return { hout: 0, steen: 0, graan: 0, wol: 0, erts: 0 };
}

function stateNew() {
  const hexes = newBoard();
  const robber = hexes.find((h) => h.type === "woestijn");
  return {
    hexes,
    robber: { q: robber.q, r: robber.r },
    players: PLAYERS.map((p) => ({
      ...p,
      res: emptyBag(),
      roads: [],
      spots: [],
      vp: 0,
      knights: 0,
    })),
    turn: 0,
    phase: "setup",
    setupStep: 0,
    lastDice: null,
    log: ["Nieuwe partij. Plaats je eerste nederzetting."],
    winner: null,
  };
}

const SIZE = 42;
let G = stateNew();
let GRAPH = null;
let selected = null;

function log(msg) {
  G.log.unshift(msg);
  G.log = G.log.slice(0, 40);
  renderLog();
}

function current() { return G.players[G.turn % 4]; }

function vertexFree(id) {
  const used = new Set();
  G.players.forEach((p) => p.spots.forEach((s) => used.add(s.v)));
  if (used.has(id)) return false;
  const adj = adjacentVertices(id);
  return !adj.some((a) => used.has(a));
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
  return p.roads.some((r) => r.a === id || r.b === id);
}

function canBuildRoad(p, e) {
  if (p.roads.some((r) => r.id === e.id)) return false;
  if (G.players.some((o) => o.roads.some((r) => r.id === e.id))) return false;
  if (G.phase === "setup") {
    const last = p.spots[p.spots.length - 1];
    return last && (e.a === last.v || e.b === last.v) && !p.roads.some((r) => {
      const lastRoadOfThisSpot = true;
      return false;
    }) && p.roads.filter((r) => r.a === last.v || r.b === last.v).length === 0;
  }
  return playerTouchesVertex(p, e.a) || playerTouchesVertex(p, e.b);
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
    if (h.type === "woestijn") return;
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
  if (G.phase !== "main" || G.rolled) return;
  const a = 1 + Math.floor(Math.random() * 6);
  const b = 1 + Math.floor(Math.random() * 6);
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
  G.turn = (G.turn + 1) % 4;
  G.phase = "main";
  log("Beurt: " + current().name);
  renderAll();
  if (!current().human) setTimeout(aiTurn, 600);
}

function setupPlaceSettlement(vId) {
  const p = current();
  if (!vertexFree(vId)) return;
  p.spots.push({ v: vId, city: false });
  if (G.setupStep >= 4) {
    const v = GRAPH.verts.get(vId);
    v.hexes.forEach((hh) => {
      const h = G.hexes.find((x) => x.q === hh.q && x.r === hh.r);
      if (h && h.type !== "woestijn") give(p, h.type, 1);
    });
  }
  G.phase = "setup-road";
  log(p.name + " plaatst een nederzetting.");
  renderAll();
}

function setupPlaceRoad(e) {
  const p = current();
  if (!canBuildRoad(p, e)) return;
  p.roads.push({ id: e.id, a: e.a, b: e.b });
  G.setupStep += 1;
  const order = [0, 1, 2, 3, 3, 2, 1, 0];
  if (G.setupStep >= 8) {
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
  if (G.phase !== "main" && !current().human) setTimeout(aiSetup, 400);
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
  if (!pay(p, { hout: 1, steen: 1 })) return;
  p.roads.push({ id: e.id, a: e.a, b: e.b });
  score();
  log(p.name + " bouwt een pad.");
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
    p.vp = p.spots.reduce((n, s) => n + (s.city ? 2 : 1), 0);
  });
  const best = G.players.slice().sort((a, b) => b.vp - a.vp)[0];
  if (best.vp >= 10) {
    G.winner = best;
    G.phase = "over";
    log(best.name + " wint met " + best.vp + " punten.");
  }
}

function aiSetup() {
  const p = current();
  if (G.phase === "setup") {
    const opts = [...GRAPH.verts.values()].filter((v) => vertexFree(v.id));
    opts.sort((a, b) => pipValue(b) - pipValue(a));
    setupPlaceSettlement(opts[0].id);
    return;
  }
  if (G.phase === "setup-road") {
    const last = p.spots[p.spots.length - 1];
    const e = [...GRAPH.edges.values()].find((x) => canBuildRoad(p, x) && (x.a === last.v || x.b === last.v));
    if (e) setupPlaceRoad(e);
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

function aiTurnRest() {
  const p = current();
  if (G.phase !== "main") return;
  const tryPay = (cost) => RES.every((k) => (p.res[k] || 0) >= (cost[k] || 0));
  if (tryPay({ graan: 2, erts: 3 })) {
    const s = p.spots.find((x) => !x.city);
    if (s) buildCity(s.v);
  }
  if (tryPay({ hout: 1, steen: 1, graan: 1, wol: 1 })) {
    const v = [...GRAPH.verts.values()].find((x) => vertexFree(x.id) && p.roads.some((r) => r.a === x.id || r.b === x.id));
    if (v) buildSettlement(v.id);
  }
  if (tryPay({ hout: 1, steen: 1 })) {
    const e = [...GRAPH.edges.values()].find((x) => canBuildRoad(p, x));
    if (e) buildRoad(e);
  }
  if ((p.res.hout || 0) >= 4) bankTrade("hout", "steen");
  setTimeout(endTurn, 500);
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
  GRAPH.verts.forEach((v) => {
    const owner = G.players.find((p) => p.spots.some((s) => s.v === v.id));
    if (!owner) return;
    const city = owner.spots.find((s) => s.v === v.id).city;
    ctx.beginPath();
    ctx.arc(v.x, v.y + 4, city ? 12 : 9, 0, Math.PI * 2);
    ctx.fillStyle = owner.color;
    ctx.fill();
    const piece = city ? IMGS.stad : IMGS.huis;
    const s = city ? 28 : 22;
    if (piece && piece.complete) ctx.drawImage(piece, v.x - s / 2, v.y - s + 4, s, s);
  });
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
  ctx.save();
  ctx.clip();
  const tile = IMGS[h.type];
  if (tile && tile.complete) {
    ctx.drawImage(tile, c.x - SIZE, c.y - SIZE, SIZE * 2, SIZE * 2);
  } else {
    ctx.fillStyle = RES_COLOR[h.type];
    ctx.fill();
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
    ctx.fillStyle = "#f3e6c8";
    ctx.beginPath();
    ctx.arc(c.x, c.y - 2, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = (h.number === 6 || h.number === 8) ? "#8b1e1e" : "#1a1410";
    ctx.font = "bold 14px Georgia";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(h.number), c.x, c.y - 1);
  }
}

function hit(ev) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (ev.clientX - rect.left) * scaleX - canvas.width / 2;
  const y = (ev.clientY - rect.top) * scaleY - (canvas.height / 2 + 8);
  let bestV = null, bestVd = 18 * 18;
  GRAPH.verts.forEach((v) => {
    const d = (v.x - x) ** 2 + (v.y - y) ** 2;
    if (d < bestVd) { bestVd = d; bestV = v; }
  });
  let bestE = null, bestEd = 12;
  GRAPH.edges.forEach((e) => {
    const a = GRAPH.verts.get(e.a), b = GRAPH.verts.get(e.b);
    const d = distToSeg(x, y, a.x, a.y, b.x, b.y);
    if (d < bestEd) { bestEd = d; bestE = e; }
  });
  let bestH = null, bestHd = SIZE * SIZE;
  G.hexes.forEach((h) => {
    const c = hexToPixel(h.q, h.r, SIZE);
    const d = (c.x - x) ** 2 + (c.y - y) ** 2;
    if (d < bestHd) { bestHd = d; bestH = h; }
  });
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

function onClick(ev) {
  if (G.winner) return;
  const p = current();
  if (!p.human && G.phase !== "robber") return;
  const hitp = hit(ev);
  if (G.phase === "setup" && hitp.v) return setupPlaceSettlement(hitp.v.id);
  if (G.phase === "setup-road" && hitp.e) return setupPlaceRoad(hitp.e);
  if (G.phase === "robber" && hitp.h) return moveRobber(hitp.h);
  if (G.phase === "main" && p.human && G.rolled) {
    if (hitp.v) {
      const mine = p.spots.find((s) => s.v === hitp.v.id);
      if (mine && !mine.city) return buildCity(hitp.v.id);
      return buildSettlement(hitp.v.id);
    }
    if (hitp.e) return buildRoad(hitp.e);
  }
}

function renderLog() {
  document.getElementById("log").innerHTML = G.log.slice(0, 6).map((l) => `<div>${l}</div>`).join("");
}

function renderAll() {
  draw();
  const p = G.players[0];
  document.getElementById("res").innerHTML = RES.map((k) =>
    `<span class="res">${k} <b>${p.res[k]}</b></span>`
  ).join("");
  document.getElementById("status").textContent =
    (G.winner ? G.winner.name + " wint!" : current().name + " · " + G.phase) +
    (G.lastDice ? " · worp " + G.lastDice : "") +
    " · VP " + G.players.map((x) => x.name[0] + x.vp).join(" ");
  document.getElementById("roll").disabled = !(current().human && G.phase === "main" && !G.rolled);
  document.getElementById("end").disabled = !(current().human && G.phase === "main" && G.rolled);
  renderLog();
}

function showHelp() {
  document.getElementById("modal").classList.add("show");
}
function hideHelp() {
  document.getElementById("modal").classList.remove("show");
}

function restart() {
  G = stateNew();
  layoutGraph();
  renderAll();
  if (!current().human) setTimeout(aiSetup, 300);
}

function tradePrompt() {
  const from = document.getElementById("fromRes").value;
  const to = document.getElementById("toRes").value;
  if (from !== to) bankTrade(from, to);
}

window.addEventListener("load", () => {
  canvas = document.getElementById("board");
  canvas.addEventListener("click", onClick);
  layoutGraph();
  loadImages(() => renderAll());
  renderAll();
});
