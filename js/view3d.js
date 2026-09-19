/* 3D board view. Game state stays in game.js */
const V3 = { ok: false, want: false, yaw: 0.35, pitch: 0.95, dist: 620 };
function setViewMode(on) {
  V3.want = !!on;
  try { localStorage.setItem("kl_3d", on ? "1" : "0"); } catch (e) {}
  const stage = document.getElementById("boardStage");
  const two = document.getElementById("board");
  const three = document.getElementById("board3");
  const btn = document.getElementById("viewMode");
  if (stage) stage.classList.toggle("mode-3d", !!on);
  if (stage) stage.classList.toggle("mode-2d", !on);
  if (on) {
    if (typeof THREE !== "undefined") init3();
    if (three) {
      three.style.display = "block";
      three.style.visibility = "visible";
      three.style.pointerEvents = "auto";
    }
    if (two) { two.style.display = "none"; two.style.pointerEvents = "none"; }
    if (btn) btn.textContent = "2D";
  } else {
    V3.ok = false;
    if (three) {
      three.style.display = "none";
      three.style.visibility = "hidden";
      three.style.pointerEvents = "none";
      three.style.width = "0";
      three.style.height = "0";
    }
    if (two) {
      two.style.display = "block";
      two.style.visibility = "visible";
      two.style.pointerEvents = "auto";
      two.style.width = "100%";
      two.style.height = "100%";
    }
    if (btn) btn.textContent = "3D";
    if (typeof resetView === "function") resetView();
  }
  if (G && G.hexes) draw();
}
function toggleViewMode() { setViewMode(!V3.want); }
function init3() {
  if (!V3.want) return;
  if (typeof THREE === "undefined") return;
  if (V3.r) { V3.ok = true; return; }
  const two = document.getElementById("board");
  const canvas = document.getElementById("board3") || two;
  try {
  V3.r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  } catch (err) { console.warn("webgl", err); return; }
  canvas.style.display = "block";
  if (two && two !== canvas) two.style.display = "none";
  V3.r.setPixelRatio(Math.min(devicePixelRatio, 2));
  const w = (two && two.clientWidth) || canvas.clientWidth || 720;
  const h = (two && two.clientHeight) || canvas.clientHeight || 720;
  V3.r.setSize(w, h, false);
  V3.r.setClearColor(0x1a140f, 1);
  V3.s = new THREE.Scene();
  V3.c = new THREE.PerspectiveCamera(42, 1, 8, 4000);
  V3.ray = new THREE.Raycaster();
  const hemi = new THREE.HemisphereLight(0xfff1d6, 0x2a2018, 1.05);
  const sun = new THREE.DirectionalLight(0xffe6b0, 1.15);
  sun.position.set(180, 320, 120);
  V3.s.add(hemi, sun, new THREE.AmbientLight(0x403328, 0.35));
  V3.board = new THREE.Group();
  V3.bits = new THREE.Group();
  V3.s.add(V3.board, V3.bits);
  V3.ok = true;
  bind3Cam(canvas);
}
function bind3Cam(canvas) {
  let drag = null;
  canvas.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    drag = { x: e.clientX, y: e.clientY, yaw: V3.yaw, pitch: V3.pitch, moved: false };
  });
  window.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.hypot(dx, dy) > 6) drag.moved = true;
    if (!drag.moved) return;
    V3.yaw = drag.yaw + dx * 0.008;
    V3.pitch = Math.max(0.35, Math.min(1.25, drag.pitch + dy * 0.006));
    draw3();
  });
  window.addEventListener("pointerup", () => { V3.skipClick = !!(drag && drag.moved); drag = null; });
}
function hexShape() {
  const sh = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 180 * (60 * i - 30);
    // -sin so rotateX(-90) maps to the same Z as 2D Y
    const x = SIZE * Math.cos(a), y = -SIZE * Math.sin(a);
    if (i === 0) sh.moveTo(x, y); else sh.lineTo(x, y);
  }
  sh.closePath();
  return sh;
}
function texOf(type) {
  const im = IMGS[type];
  if (!im || !im.complete || !im.naturalWidth) return null;
  const tex = new THREE.Texture(im);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
function rebuild3() {
  if (!V3.ok || !G) return;
  while (V3.board.children.length) V3.board.remove(V3.board.children[0]);
  const shape = hexShape();
  G.hexes.forEach((h) => {
    const deep = h.type === "zee" ? 5 : 11;
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: deep,
      bevelEnabled: false,
      steps: 1,
    });
    geo.rotateX(-Math.PI / 2);
    const tex = texOf(h.type);
    const col = new THREE.Color(RES_COLOR[h.type] || "#444");
    const mat = new THREE.MeshStandardMaterial({
      map: tex || null,
      color: tex ? 0xffffff : col,
      roughness: 0.82,
      metalness: h.type === "goud" ? 0.35 : 0.05,
    });
    const mesh = new THREE.Mesh(geo, mat);
    const p = hexToPixel(h.q, h.r, SIZE);
    mesh.position.set(p.x, 0, p.y);
    mesh.userData = { kind: "hex", q: h.q, r: h.r };
    V3.board.add(mesh);
    if (h.number) {
      const g = new THREE.CircleGeometry(11, 24);
      g.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0xefe3c4 }));
      m.position.set(p.x, deep + 1.4, p.y);
      m.userData = { kind: "hex", q: h.q, r: h.r };
      V3.board.add(m);
      const cv = document.createElement("canvas");
      cv.width = 64; cv.height = 64;
      const cx = cv.getContext("2d");
      cx.fillStyle = (h.number === 6 || h.number === 8) ? "#8b1e1e" : "#1a1410";
      cx.font = "700 36px Georgia";
      cx.textAlign = "center"; cx.textBaseline = "middle";
      cx.fillText(String(h.number), 32, 34);
      const t = new THREE.CanvasTexture(cv);
      t.needsUpdate = true;
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true }));
      sp.scale.set(16, 16, 1);
      sp.position.set(p.x, deep + 8, p.y);
      V3.board.add(sp);
    }
  });
  V3.sig = G.hexes.length + ":" + (G.mapId || "") + ":" + G.hexes.map((h) => h.type + h.number).join("");
}
function drawBits3() {
  while (V3.bits.children.length) V3.bits.remove(V3.bits.children[0]);
  if (!GRAPH) return;
  G.players.forEach((pl) => {
    pl.roads.forEach((rd) => {
      const a = GRAPH.verts.get(rd.a), b = GRAPH.verts.get(rd.b);
      if (!a || !b) return;
      const dx = b.x - a.x, dz = b.y - a.y, len = Math.hypot(dx, dz);
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(4, 3.2, Math.max(6, len * 0.92)),
        new THREE.MeshStandardMaterial({ color: pl.color })
      );
      bar.position.set((a.x + b.x) / 2, 12.2, (a.y + b.y) / 2);
      bar.rotation.y = Math.atan2(dx, dz);
      V3.bits.add(bar);
    });
    (pl.ships || []).forEach((rd) => {
      const a = GRAPH.verts.get(rd.a), b = GRAPH.verts.get(rd.b);
      if (!a || !b) return;
      const dx = b.x - a.x, dz = b.y - a.y, len = Math.hypot(dx, dz);
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(3.2, 2.4, Math.max(6, len * 0.92)),
        new THREE.MeshStandardMaterial({ color: pl.color, metalness: 0.2 })
      );
      bar.position.set((a.x + b.x) / 2, 11.4, (a.y + b.y) / 2);
      bar.rotation.y = Math.atan2(dx, dz);
      V3.bits.add(bar);
    });
    pl.spots.forEach((s) => {
      const v = GRAPH.verts.get(s.v);
      if (!v) return;
      const geo = s.city ? new THREE.BoxGeometry(14, 16, 14) : new THREE.ConeGeometry(8, 16, 4);
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: pl.color }));
      m.position.set(v.x, s.city ? 20 : 20, v.y);
      m.userData = { kind: "vert", id: v.id };
      V3.bits.add(m);
    });
  });
  (G.harbors || []).forEach((h) => {
    const v = GRAPH.verts.get(h.v);
    if (!v) return;
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(7, 7, 3, 16),
      new THREE.MeshStandardMaterial({ color: 0xf3e2b0 })
    );
    m.position.set(v.x, 14, v.y);
    m.userData = { kind: "vert", id: v.id };
    V3.bits.add(m);
  });
  if (G && current && current().human && (G.phase === "setup" || G.phase === "setup-road" || (G.phase === "main" && G.rolled))) {
    const p = current();
    const seen = new Set();
    GRAPH.verts.forEach((v) => {
      const key = Math.round(v.x) + "," + Math.round(v.y);
      if (seen.has(key)) return;
      if (!(G.phase === "setup" || canBuildHouse(p, v.id) || canBuildCity(p, v.id))) return;
      if (G.phase === "setup" && !vertexFree(v.id)) return;
      if (G.phase === "setup-road") return;
      seen.add(key);
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(4.2, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0xffe08a, emissive: 0x664400 })
      );
      m.position.set(v.x, 16, v.y);
      m.userData = { kind: "vert", id: v.id };
      V3.bits.add(m);
    });
  }
  if (G.robber) {
    const p = hexToPixel(G.robber.q, G.robber.r, SIZE);
    const m = new THREE.Mesh(
      new THREE.CapsuleGeometry(5, 14, 4, 8),
      new THREE.MeshStandardMaterial({ color: 0x222226 })
    );
    m.position.set(p.x, 22, p.y);
    m.userData = { kind: "hex", q: G.robber.q, r: G.robber.r };
    V3.bits.add(m);
  }
}
function cam3() {
  const w = V3.r.domElement.clientWidth || 720;
  const h = V3.r.domElement.clientHeight || 720;
  V3.r.setSize(w, h, false);
  V3.c.aspect = w / Math.max(1, h);
  V3.c.updateProjectionMatrix();
  const dist = V3.dist / (VIEW && VIEW.s ? VIEW.s : 1);
  V3.c.position.set(
    Math.sin(V3.yaw) * Math.cos(V3.pitch) * dist,
    Math.sin(V3.pitch) * dist,
    Math.cos(V3.yaw) * Math.cos(V3.pitch) * dist
  );
  V3.c.lookAt(0, 0, 0);
}
function draw3() {
  if (!V3.ok || !G || !G.hexes) return false;
  const sig = G ? G.hexes.length + ":" + (G.mapId || "") + ":" + G.hexes.map((h) => h.type + h.number).join("") : "";
  if (sig !== V3.sig) rebuild3();
  drawBits3();
  const now = Date.now();
  V3.board.children.forEach((m) => {
    if (!m.userData || m.userData.kind !== "hex" || !m.material || !m.material.emissive) return;
    const on = G.fx && now < G.fx.until && G.fx.hexes.includes(m.userData.q + "," + m.userData.r);
    const w = on ? 0.35 + 0.35 * (0.5 + 0.5 * Math.sin(now / 110)) : 0;
    m.material.emissive.setRGB(w, w * 0.7, 0.05);
    m.material.emissiveIntensity = on ? 1.2 : 0;
  });
  cam3();
  V3.r.render(V3.s, V3.c);
  return true;
}
function hit3(ev) {
  if (!V3.ok) return null;
  const rect = V3.r.domElement.getBoundingClientRect();
  const src = ev.touches ? ev.touches[0] : ev;
  const ndc = new THREE.Vector2(
    ((src.clientX - rect.left) / rect.width) * 2 - 1,
    -((src.clientY - rect.top) / rect.height) * 2 + 1
  );
  V3.ray.setFromCamera(ndc, V3.c);
  const hits = V3.ray.intersectObjects([...V3.board.children, ...V3.bits.children], false);
  let v = null, e = null, h = null;
  hits.forEach((it) => {
    const d = it.object.userData || {};
    if (d.kind === "vert" && !v) v = GRAPH.verts.get(d.id);
    if (d.kind === "hex" && !h) h = G.hexes.find((x) => x.q === d.q && x.r === d.r);
  });
  if (!v && hits[0]) {
    const p = hits[0].point;
    let best = 28, pick = null;
    GRAPH.verts.forEach((vt) => {
      const d = Math.hypot(vt.x - p.x, vt.y - p.z);
      if (d < best) { best = d; pick = vt; }
    });
    v = pick;
    let bestE = 14, pe = null;
    GRAPH.edges.forEach((ed) => {
      const a = GRAPH.verts.get(ed.a), b = GRAPH.verts.get(ed.b);
      const mx = (a.x + b.x) / 2, mz = (a.y + b.y) / 2;
      const d = Math.hypot(mx - p.x, mz - p.z);
      if (d < bestE) { bestE = d; pe = ed; }
    });
    e = pe;
  }
  return { v, e, h };
}
