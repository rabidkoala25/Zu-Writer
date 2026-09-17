// Zu Writer 3D models: turns text boxes into voxel models (1 voxel = half a glyph block)
// and exports them as STL, GLB or OBJ.
import * as THREE from "three";
import { OrbitControls } from "./vendor/three/examples/jsm/controls/OrbitControls.js";
import { STLExporter } from "./vendor/three/examples/jsm/exporters/STLExporter.js";
import { GLTFExporter } from "./vendor/three/examples/jsm/exporters/GLTFExporter.js";
import { OBJExporter } from "./vendor/three/examples/jsm/exporters/OBJExporter.js";

const $ = id => document.getElementById(id);
const ZU = window.ZU;

const opts = { shape: "sign", relief: "raised", depth: 1, base: 2, mm: 2, border: true };

const COLORS = {
  speech: { base: "#111111", ink: "#F2F2F2", cap: "#2A2A2A" },
  pillar: { base: "#6E4B8C", ink: "#2C1A3D", cap: "#4E3268" },
  wall:   { base: "#C9A77A", ink: "#4A3521", cap: "#A88659" },
  paper:  { base: "#EAD9A8", ink: "#3B2A1A", cap: "#D4BD85" }
};
const MAT = { base: 1, ink: 2, cap: 3 };

/* ---------- 2D ink masks ---------- */
// Renders a box's glyphs at 2px per block, so each pixel is one voxel column.
function inkMask(text) {
  const b = 2;
  const lay = ZU.layoutText(text);
  const { W, H } = ZU.boxSize(lay, b);
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d", { willReadFrequently: true });
  x.font = `${5 * b}px FEZ`;
  x.textBaseline = "alphabetic";
  const S = 5 * b, P = 6 * b, pad = 4 * b;
  for (const cell of lay.cells) ZU.glyph(x, cell.ch, pad + cell.x * P, pad + cell.y * P, S, cell.rot, "#000");
  const d = x.getImageData(0, 0, W, H).data;
  const mask = new Uint8Array(W * H);
  for (let i = 0; i < mask.length; i++) mask[i] = d[i * 4 + 3] > 127 ? 1 : 0;
  return { W, H, mask, glyphs: lay.cells.length };
}

function hasInk(text) {
  return [...text].some(ch => ch !== " " && ch !== "\n" && ZU.SUPPORTED.has(ch));
}

/* ---------- voxel grid ---------- */
class Grid {
  constructor(X, Y, Z) { this.dims = [X, Y, Z]; this.v = new Uint8Array(X * Y * Z); }
  idx(x, y, z) { return x + this.dims[0] * (y + this.dims[1] * z); }
  get(x, y, z) {
    const [X, Y, Z] = this.dims;
    return x < 0 || y < 0 || z < 0 || x >= X || y >= Y || z >= Z ? 0 : this.v[this.idx(x, y, z)];
  }
  set(x, y, z, m) {
    const [X, Y, Z] = this.dims;
    if (x >= 0 && y >= 0 && z >= 0 && x < X && y < Y && z < Z) this.v[this.idx(x, y, z)] = m;
  }
  fill(x0, y0, z0, x1, y1, z1, m) {
    for (let z = z0; z < z1; z++) for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) this.set(x, y, z, m);
  }
}

// Y is up. Signs face +Z; image rows run downward, so y = H - 1 - row.
function buildSign(text, glyphsOnly) {
  const m = inkMask(text);
  const relief = opts.depth * 2;
  const base = glyphsOnly ? 0 : opts.base * 2;
  const g = new Grid(m.W, m.H, base + relief);
  const isInk = (px, py) => m.mask[py * m.W + px] === 1;
  const isBorder = (px, py) => {
    if (glyphsOnly || !opts.border) return false;
    const inRing = (px >= 2 && px < m.W - 2 && py >= 2 && py < m.H - 2) &&
      !(px >= 4 && px < m.W - 4 && py >= 4 && py < m.H - 4);
    // Corners stay filled in 3D: the 2D frame's notched corners would only touch diagonally,
    // which slicers treat as a broken surface.
    return inRing;
  };
  for (let py = 0; py < m.H; py++) for (let px = 0; px < m.W; px++) {
    const y = m.H - 1 - py;
    const mark = isInk(px, py) || isBorder(px, py);
    if (glyphsOnly) { if (isInk(px, py)) g.fill(px, y, 0, px + 1, y + 1, relief, MAT.ink); continue; }
    if (opts.relief === "raised") {
      g.fill(px, y, 0, px + 1, y + 1, base, MAT.base);
      if (mark) g.fill(px, y, base, px + 1, y + 1, base + relief, MAT.ink);
    } else {
      if (mark) {
        g.fill(px, y, 0, px + 1, y + 1, base - 1, MAT.base);
        g.set(px, y, base - 1, MAT.ink); // coloured floor of the carving
      } else {
        g.fill(px, y, 0, px + 1, y + 1, base + relief, MAT.base);
      }
    }
  }
  return { grid: g, faces: 1, glyphs: m.glyphs };
}

// A square column with one text box per side: front, right, back, left.
function buildPillar(texts) {
  const masks = texts.slice(0, 4).map(inkMask);
  const relief = opts.depth * 2;
  const margin = 4, cap = 4;
  const faceW = Math.max(...masks.map(m => m.W));
  const faceH = Math.max(...masks.map(m => m.H));
  const s = faceW + margin * 2 + relief * 2;
  const h = faceH + cap * 2;
  const g = new Grid(s, h, s);
  const r = relief;
  if (opts.relief === "raised") g.fill(r, cap, r, s - r, h - cap, s - r, MAT.base);
  else g.fill(0, cap, 0, s, h - cap, s, MAT.base);
  g.fill(0, 0, 0, s, cap, s, MAT.cap);
  g.fill(0, h - cap, 0, s, h, s, MAT.cap);

  // Maps (column along the face, depth into the face) to x/z for each side.
  // Side 0 faces +Z, then going round: +X, -Z, -X (each reads left to right from outside).
  const place = [
    (a, d) => [a, s - 1 - d],
    (a, d) => [s - 1 - d, s - 1 - a],
    (a, d) => [s - 1 - a, d],
    (a, d) => [d, a]
  ];
  masks.forEach((m, side) => {
    const ox = Math.floor((s - m.W) / 2);
    const oy = cap + Math.floor((faceH - m.H) / 2);
    for (let py = 0; py < m.H; py++) for (let px = 0; px < m.W; px++) {
      if (!m.mask[py * m.W + px]) continue;
      const y = h - 1 - (oy + py);
      const a = ox + px;
      if (opts.relief === "raised") {
        for (let d = 0; d < r; d++) { const [x, z] = place[side](a, d); g.set(x, y, z, MAT.ink); }
      } else {
        for (let d = 0; d < r; d++) { const [x, z] = place[side](a, d); g.set(x, y, z, 0); }
        const [x, z] = place[side](a, r); g.set(x, y, z, MAT.ink);
      }
    }
  });
  return { grid: g, faces: masks.length, glyphs: masks.reduce((n, m) => n + m.glyphs, 0) };
}

/* ---------- greedy meshing ---------- */
function mesh(grid, greedy = true) {
  const dims = grid.dims;
  const out = new Map(); // material -> {pos:[], nor:[]}
  const push = (mat, pts, normal) => {
    if (!out.has(mat)) out.set(mat, { pos: [], nor: [] });
    const o = out.get(mat);
    for (const i of [0, 1, 2, 0, 2, 3]) { o.pos.push(...pts[i]); o.nor.push(...normal); }
  };
  for (let d = 0; d < 3; d++) {
    const u = (d + 1) % 3, v = (d + 2) % 3;
    const x = [0, 0, 0], q = [0, 0, 0];
    q[d] = 1;
    const mask = new Int16Array(dims[u] * dims[v]);
    for (x[d] = -1; x[d] < dims[d];) {
      let n = 0;
      for (x[v] = 0; x[v] < dims[v]; x[v]++) for (x[u] = 0; x[u] < dims[u]; x[u]++) {
        const a = grid.get(x[0], x[1], x[2]);
        const b = grid.get(x[0] + q[0], x[1] + q[1], x[2] + q[2]);
        mask[n++] = (a && !b) ? a : (!a && b) ? -b : 0;
      }
      x[d]++;
      n = 0;
      for (let j = 0; j < dims[v]; j++) {
        for (let i = 0; i < dims[u];) {
          const c = mask[n];
          if (!c) { i++; n++; continue; }
          let w = 1;
          while (greedy && i + w < dims[u] && mask[n + w] === c) w++;
          let hgt = 1, done = false;
          for (; greedy && j + hgt < dims[v]; hgt++) {
            for (let k = 0; k < w; k++) if (mask[n + k + hgt * dims[u]] !== c) { done = true; break; }
            if (done) break;
          }
          x[u] = i; x[v] = j;
          const du = [0, 0, 0], dv = [0, 0, 0];
          du[u] = w; dv[v] = hgt;
          const p0 = [x[0], x[1], x[2]];
          const p1 = [x[0] + du[0], x[1] + du[1], x[2] + du[2]];
          const p2 = [x[0] + du[0] + dv[0], x[1] + du[1] + dv[1], x[2] + du[2] + dv[2]];
          const p3 = [x[0] + dv[0], x[1] + dv[1], x[2] + dv[2]];
          const normal = [0, 0, 0];
          if (c > 0) { normal[d] = 1; push(c, [p0, p1, p2, p3], normal); }
          else { normal[d] = -1; push(-c, [p0, p3, p2, p1], normal); }
          for (let l = 0; l < hgt; l++) for (let k = 0; k < w; k++) mask[n + k + l * dims[u]] = 0;
          i += w; n += w;
        }
      }
    }
  }
  return out;
}

/* ---------- three.js objects ---------- */
// greedy=true merges faces (small, for preview and GLB); false keeps one face per voxel side,
// which avoids T-junctions so slicers see a clean closed surface.
function makeGroup(grid, greedy) {
  const parts = mesh(grid, greedy);
  const voxel = opts.mm / 2;
  const [X, Y, Z] = grid.dims;
  const group = new THREE.Group();
  group.name = "zu-writer-model";
  const palette = COLORS[ZU.state.surf];
  let tris = 0;
  for (const [matId, data] of parts) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(data.pos.length);
    for (let i = 0; i < pos.length; i += 3) {
      pos[i] = (data.pos[i] - X / 2) * voxel;
      pos[i + 1] = (data.pos[i + 1] - Y / 2) * voxel;
      pos[i + 2] = (data.pos[i + 2] - Z / 2) * voxel;
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(data.nor), 3));
    const name = matId === MAT.ink ? "ink" : matId === MAT.cap ? "cap" : "base";
    const mat = new THREE.MeshStandardMaterial({ color: palette[name], roughness: 0.9, metalness: 0, name });
    const meshObj = new THREE.Mesh(geo, mat);
    meshObj.name = name;
    group.add(meshObj);
    tris += pos.length / 9;
  }
  return { group, tris };
}

/* ---------- scene ---------- */
const view = $("modelView");
const canvas = $("mv");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: false });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 10000);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
scene.add(new THREE.HemisphereLight(0xffffff, 0x445066, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(0.6, 1, 0.8);
scene.add(sun);
const fill = new THREE.DirectionalLight(0xffffff, 0.6);
fill.position.set(-1, -0.3, -0.6);
scene.add(fill);

let current = null; // { group, sizeMM, tris }
let lastKey = "";

function resize() {
  const w = view.clientWidth, h = view.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(view);

function themeBackground() {
  const css = getComputedStyle(document.documentElement).getPropertyValue("--stage").trim();
  scene.background = new THREE.Color(css || "#9FD3E0");
}

function boxesForModel() {
  const { state } = ZU;
  if (opts.shape === "pillar") return state.boxes.filter(hasInk).slice(0, 4);
  const t = state.boxes[state.current] ?? "";
  return hasInk(t) ? [t] : [];
}

function build(fitCamera) {
  const { state } = ZU;
  const texts = boxesForModel();
  const key = JSON.stringify([opts, texts, state.mode, state.len, state.gap, state.surf]);
  if (key === lastKey && current) return;
  lastKey = key;
  if (current) {
    scene.remove(current.group);
    current.group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    current = null;
  }
  $("modelEmpty").hidden = texts.length > 0;
  ["stl", "glb", "obj"].forEach(id => $("dl-" + id).disabled = !texts.length);
  if (!texts.length) { $("modelInfo").textContent = ""; return; }

  const built = opts.shape === "pillar" ? buildPillar(texts) : buildSign(texts[0], opts.shape === "glyphs");
  const voxel = opts.mm / 2;
  let [X, Y, Z] = built.grid.dims;
  const { group, tris } = makeGroup(built.grid, true);
  scene.add(group);
  current = { group, grid: built.grid, tris };

  const fmt = n => (Math.round(n * 10) / 10).toString();
  {
    // Measure the filled voxels, not the padded grid.
    const g = built.grid; let mn = [X, Y, Z], mx = [-1, -1, -1];
    for (let z = 0; z < Z; z++) for (let y = 0; y < Y; y++) for (let x = 0; x < X; x++) {
      if (!g.v[g.idx(x, y, z)]) continue;
      if (x < mn[0]) mn[0] = x; if (y < mn[1]) mn[1] = y; if (z < mn[2]) mn[2] = z;
      if (x > mx[0]) mx[0] = x; if (y > mx[1]) mx[1] = y; if (z > mx[2]) mx[2] = z;
    }
    [X, Y, Z] = [mx[0] - mn[0] + 1, mx[1] - mn[1] + 1, mx[2] - mn[2] + 1];
  }
  const sizeText = opts.shape === "pillar"
    ? `${fmt(X * voxel)} × ${fmt(Z * voxel)} mm wide, ${fmt(Y * voxel)} mm tall`
    : `${fmt(X * voxel)} × ${fmt(Y * voxel)} mm, ${fmt(Z * voxel)} mm thick`;
  const extra = opts.shape === "pillar"
    ? ` ${built.faces} of 4 sides written.${ZU.state.boxes.filter(hasInk).length > 4 ? " Only the first 4 boxes fit on a pillar." : ""}`
    : "";
  $("modelInfo").textContent = `${sizeText}, ${tris.toLocaleString()} triangles.${extra}`;

  if (fitCamera) {
    const radius = Math.hypot(X, Y, Z) * voxel / 2;
    const dist = radius / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2)) * 1.05;
    const dir = opts.shape === "pillar" ? new THREE.Vector3(0.55, 0.35, 1) : new THREE.Vector3(0.35, 0.25, 1);
    camera.position.copy(dir.normalize().multiplyScalar(dist));
    camera.near = dist / 100; camera.far = dist * 10;
    camera.updateProjectionMatrix();
    controls.target.set(0, 0, 0);
    controls.update();
  }
}

let pending = null;
function schedule(fit = false) {
  clearTimeout(pending);
  pending = setTimeout(() => build(fit), 150);
}
window.addEventListener("zu:change", () => schedule(false));

function loop() {
  controls.update();
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

/* ---------- controls ---------- */
function syncControls() {
  const glyphsOnly = opts.shape === "glyphs";
  $("reliefGroup").hidden = glyphsOnly;
  $("baseRow").hidden = glyphsOnly || opts.shape === "pillar";
  $("borderRow").hidden = opts.shape !== "sign";
  $("depthLabel").textContent = glyphsOnly ? "Glyph thickness" : opts.relief === "raised" ? "Raised height" : "Carving depth";
  $("modelNote").textContent = opts.shape === "pillar"
    ? "Each text box goes on its own side, starting at the front and going round to the right."
    : "Uses the selected text box.";
}
document.querySelectorAll("input[name=shape]").forEach(r => r.addEventListener("change", e => { opts.shape = e.target.value; syncControls(); schedule(true); }));
document.querySelectorAll("input[name=relief]").forEach(r => r.addEventListener("change", e => { opts.relief = e.target.value; syncControls(); schedule(false); }));
$("depth").addEventListener("input", e => { opts.depth = +e.target.value; $("depthOut").textContent = opts.depth; schedule(false); });
$("baseT").addEventListener("input", e => { opts.base = +e.target.value; $("baseOut").textContent = opts.base; schedule(false); });
$("mm").addEventListener("input", e => { opts.mm = +e.target.value; $("mmOut").textContent = `${opts.mm} mm`; lastKey = ""; schedule(true); });
$("border").addEventListener("change", e => { opts.border = e.target.checked; schedule(false); });
$("fitView").addEventListener("click", () => { lastKey = ""; build(true); });

/* ---------- export ---------- */
function exportGroup(forPrinting) {
  const g = forPrinting ? makeGroup(current.grid, false).group : current.group.clone(true);
  // Slicers expect Z up. Signs already lie face-up along Z; pillars get stood up.
  if (forPrinting && opts.shape === "pillar") g.rotation.x = Math.PI / 2;
  g.updateMatrixWorld(true);
  return g;
}
function fileName(ext) {
  return `zu-${opts.shape}-${opts.shape === "glyphs" ? "" : opts.relief + "-"}${ZU.state.surf}.${ext}`;
}
async function download(kind) {
  if (!current) return;
  const status = $("modelStatus");
  status.textContent = `Making ${kind.toUpperCase()}…`;
  try {
    const dispose = g => g.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    if (kind === "stl") {
      const g = exportGroup(true);
      const data = new STLExporter().parse(g, { binary: true });
      dispose(g);
      await window.saveFile(fileName("stl"), new Blob([data], { type: "model/stl" }), "STL");
    } else if (kind === "obj") {
      const g = exportGroup(true);
      const text = new OBJExporter().parse(g);
      dispose(g);
      await window.saveFile(fileName("obj"), new Blob([text], { type: "text/plain" }), "OBJ");
    } else {
      const glb = await new GLTFExporter().parseAsync(exportGroup(false), { binary: true });
      await window.saveFile(fileName("glb"), new Blob([glb], { type: "model/gltf-binary" }), "GLB");
    }
    if (/Making/.test(status.textContent)) status.textContent = `${kind.toUpperCase()} ready.`;
  } catch (err) {
    status.textContent = `Couldn't make the ${kind.toUpperCase()}: ${err?.message || err}`;
  }
}
["stl", "glb", "obj"].forEach(k => $("dl-" + k).addEventListener("click", () => download(k)));

// saveFile writes to #status; mirror it next to the model buttons too.
new MutationObserver(() => {
  const t = $("status").textContent;
  if (/(STL|GLB|OBJ) (downloaded|saved)|cancelled|isn't available|already open/.test(t)) $("modelStatus").textContent = t;
}).observe($("status"), { childList: true, characterData: true, subtree: true });

matchMedia("(prefers-color-scheme: dark)").addEventListener("change", themeBackground);

(async () => {
  try { await document.fonts.load("50px FEZ"); } catch {}
  themeBackground();
  resize();
  syncControls();
  build(true);
  loop();
})();
