const SUPPORTED = new Set([..."!\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~\u00b1\u00c0\u00c1\u00c2\u00c3\u00c4\u00c5\u00c6\u00c7\u00c8\u00c9\u00ca\u00cb\u00cc\u00cd\u00ce\u00cf\u00d0\u00d1\u00d2\u00d3\u00d4\u00d5\u00d6\u00d7\u00d8\u00d9\u00da\u00db\u00dc\u00dd\u00de\u00e0\u00e1\u00e2\u00e3\u00e4\u00e5\u00e6\u00e7\u00e8\u00e9\u00ea\u00eb\u00ec\u00ed\u00ee\u00ef\u00f0\u00f1\u00f2\u00f3\u00f4\u00f5\u00f6\u00f7\u00f8\u00f9\u00fa\u00fb\u00fc\u00fd\u00fe\u00ff\u0100\u0101\u0102\u0103\u0104\u0105\u0106\u0107\u0108\u0109\u010a\u010b\u010c\u010d\u010e\u010f\u0110\u0111\u0112\u0113\u0114\u0115\u0116\u0117\u0118\u0119\u011a\u011b\u011c\u011d\u011e\u011f\u0141\u0142\u0143\u0144\u015a\u015b\u016e\u016f\u0178\u0179\u017a\u017b\u017c\u2022", " "]);
const $ = id => document.getElementById(id);
const cv = $("cv"), ctx = cv.getContext("2d");
const txt = $("txt");
const state = { mode: "columns", surf: "speech", len: 10, block: 5, gap: true, reveal: Infinity };
let cells = [];
let animTimer = null;

const DEFAULT_TEXT = "hello traveler\nthis world has more sides than you can see";
try { txt.value = localStorage.getItem("zu-writer-text") ?? DEFAULT_TEXT; } catch { txt.value = DEFAULT_TEXT; }

/* ---------- layout ---------- */
function toLines(text, n, gap) {
  const lines = [];
  for (const para of text.split("\n")) {
    const words = para.split(/\s+/).map(w => [...w].filter(c => SUPPORTED.has(c))).filter(w => w.length);
    let cur = [];
    for (let chars of words) {
      while (chars.length > n) {
        if (cur.length) { lines.push(cur); cur = []; }
        lines.push(chars.slice(0, n)); chars = chars.slice(n);
      }
      if (!chars.length) continue;
      const sep = cur.length && gap ? 1 : 0;
      if (cur.length + sep + chars.length > n) { lines.push(cur); cur = chars; }
      else cur = cur.length ? [...cur, ...(gap ? [" "] : []), ...chars] : chars;
    }
    lines.push(cur);
  }
  while (lines.length > 1 && !lines[lines.length - 1].length) lines.pop();
  return lines;
}

function buildCells(lines, mode) {
  const L = Math.max(lines.length, 1);
  const maxLen = Math.max(1, ...lines.map(l => l.length));
  const out = [];
  lines.forEach((line, i) => line.forEach((ch, j) => {
    if (mode === "rows") out.push({ ch, x: j, y: i, rot: 0 });
    else out.push({ ch, x: L - 1 - i, y: j, rot: mode === "pillar" ? 1 : 0 });
  }));
  const cols = mode === "rows" ? maxLen : L;
  const rows = mode === "rows" ? L : maxLen;
  return { out, cols, rows };
}

/* ---------- surfaces ---------- */
function rng(seed) { return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296); }
const SURF = {
  speech: {
    ink: "#FFFFFF",
    draw(W, H, b) {
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#FFF";
      ctx.fillRect(b, b, W - 2 * b, b); ctx.fillRect(b, H - 2 * b, W - 2 * b, b);
      ctx.fillRect(b, b, b, H - 2 * b); ctx.fillRect(W - 2 * b, b, b, H - 2 * b);
      ctx.fillStyle = "#000";
      [[b, b], [W - 2 * b, b], [b, H - 2 * b], [W - 2 * b, H - 2 * b]].forEach(([x, y]) => ctx.fillRect(x, y, b, b));
    }
  },
  pillar: {
    ink: "#2C1A3D", light: "#9C7CBA",
    draw(W, H, b) {
      const r = rng(7);
      ctx.fillStyle = "#6E4B8C"; ctx.fillRect(0, 0, W, H);
      for (let y = 0; y < H; y += b) for (let x = 0; x < W; x += b) {
        const v = r();
        if (v < 0.12) { ctx.fillStyle = "#5E3E7B"; ctx.fillRect(x, y, b, b); }
        else if (v > 0.93) { ctx.fillStyle = "#80609F"; ctx.fillRect(x, y, b, b); }
      }
      ctx.fillStyle = "#4E3268";
      ctx.fillRect(0, 0, W, 2 * b); ctx.fillRect(0, H - 2 * b, W, 2 * b);
      ctx.fillStyle = "#8E6DAE"; ctx.fillRect(0, 2 * b, W, b / 2 | 0 || 1);
    }
  },
  wall: {
    ink: "#4A3521",
    draw(W, H, b) {
      const r = rng(3);
      ctx.fillStyle = "#C9A77A"; ctx.fillRect(0, 0, W, H);
      const bh = 4 * b, bw = 9 * b;
      for (let row = 0, y = 0; y < H; row++, y += bh) {
        const off = row % 2 ? -bw / 2 : 0;
        for (let x = off; x < W; x += bw) {
          const v = r();
          ctx.fillStyle = v < 0.3 ? "#C09D6F" : v > 0.8 ? "#D2B288" : "#C9A77A";
          ctx.fillRect(x, y, bw, bh);
          ctx.fillStyle = "#A88659";
          ctx.fillRect(x, y, bw, Math.max(1, b / 2 | 0)); ctx.fillRect(x, y, Math.max(1, b / 2 | 0), bh);
        }
      }
    }
  },
  paper: {
    ink: "#3B2A1A",
    draw(W, H, b) {
      const r = rng(11);
      ctx.fillStyle = "#EAD9A8"; ctx.fillRect(0, 0, W, H);
      for (let y = 0; y < H; y += b) for (let x = 0; x < W; x += b) {
        if (r() < 0.05) { ctx.fillStyle = "#DCC690"; ctx.fillRect(x, y, b, b); }
      }
      // ragged edges
      for (let x = 0; x < W; x += b) {
        if (r() < 0.35) ctx.clearRect(x, 0, b, b);
        if (r() < 0.35) ctx.clearRect(x, H - b, b, b);
      }
      for (let y = 0; y < H; y += b) {
        if (r() < 0.35) ctx.clearRect(0, y, b, b);
        if (r() < 0.35) ctx.clearRect(W - b, y, b, b);
      }
      ctx.fillStyle = "#D4BD85";
      ctx.fillRect(Math.round(W * 0.5), b, Math.max(1, b / 3 | 0), H - 2 * b);
    }
  }
};

/* ---------- render ---------- */
let layout = null;
function compute() {
  const lines = toLines(txt.value, state.len, state.gap);
  layout = buildCells(lines, state.mode);
  cells = layout.out;
}

function glyph(ch, x, y, S, rot, color) {
  ctx.save();
  ctx.translate(x + S / 2, y + S / 2);
  if (rot) ctx.rotate(Math.PI / 2);
  ctx.fillStyle = color;
  const m = ctx.measureText(ch);
  const w = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
  const gx = Math.round(-S / 2 + (S - w) / 2 + m.actualBoundingBoxLeft);
  ctx.fillText(ch, gx, S / 2);
  ctx.restore();
}

function draw() {
  const b = state.block, S = 5 * b, P = 6 * b, pad = 4 * b;
  const W = pad * 2 + layout.cols * P - b;
  const H = pad * 2 + layout.rows * P - b;
  cv.width = W; cv.height = H;
  ctx.clearRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = false;
  const surf = SURF[state.surf];
  surf.draw(W, H, b);
  ctx.font = `${S}px FEZ`;
  ctx.textBaseline = "alphabetic";
  const shown = cells.slice(0, state.reveal);
  for (const c of shown) {
    if (c.ch === " ") continue;
    const x = pad + c.x * P, y = pad + c.y * P;
    c.rect = [x, y, S];
    if (surf.light) glyph(c.ch, x + Math.max(1, b / 2 | 0), y + Math.max(1, b / 2 | 0), S, c.rot, surf.light);
    glyph(c.ch, x, y, S, c.rot, surf.ink);
  }
  cv.setAttribute("aria-label", `Zu alphabet rendering of: ${txt.value.slice(0, 200)}`);
}

const HINTS = {
  columns: "Read from the top right corner, down the column, then move one column to the left.",
  pillar: "Turn the message 90° counter-clockwise (or tilt your head left) and it reads as normal lines.",
  rows: "Left to right, top to bottom. Handy for proofreading before switching styles."
};

function refresh() {
  stopAnim();
  compute();
  draw();
  $("hint").textContent = HINTS[state.mode];
  document.querySelector('label[for="len"]').textContent = state.mode === "columns" ? "Glyphs per column" : state.mode === "pillar" ? "Glyphs per turned line" : "Glyphs per row";
}

/* ---------- reveal animation ---------- */
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
function stopAnim() { if (animTimer) { clearInterval(animTimer); animTimer = null; } state.reveal = Infinity; $("play").textContent = "Write it out"; }
$("play").addEventListener("click", () => {
  if (animTimer) { stopAnim(); draw(); return; }
  if (reduceMotion.matches) { draw(); $("status").textContent = "Animation is off because reduced motion is on."; return; }
  state.reveal = 0; draw();
  $("play").textContent = "Stop";
  animTimer = setInterval(() => {
    state.reveal++;
    while (state.reveal < cells.length && cells[state.reveal - 1]?.ch === " ") state.reveal++;
    draw();
    if (state.reveal >= cells.length) stopAnim();
  }, 55);
});

/* ---------- inputs ---------- */
txt.addEventListener("input", () => { try { localStorage.setItem("zu-writer-text", txt.value); } catch {} refresh(); });
document.querySelectorAll('input[name=mode]').forEach(r => r.addEventListener("change", e => { state.mode = e.target.value; refresh(); }));
document.querySelectorAll('input[name=surf]').forEach(r => r.addEventListener("change", e => { state.surf = e.target.value; refresh(); }));
$("len").addEventListener("input", e => { state.len = +e.target.value; $("lenOut").textContent = state.len; refresh(); });
$("size").addEventListener("input", e => { state.block = +e.target.value; $("sizeOut").textContent = state.block; refresh(); });
$("gap").addEventListener("change", e => { state.gap = e.target.checked; refresh(); });
$("zuInput").addEventListener("change", e => txt.classList.toggle("zu", e.target.checked));

/* glyph keyboard */
const KEYS = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", ".", ",", "!", "?", "'", "-", "⏎"];
for (const k of KEYS) {
  const btn = document.createElement("button");
  btn.type = "button"; btn.className = "key";
  const isEnter = k === "⏎";
  btn.innerHTML = isEnter ? `<b style="font-family:var(--ui)">↵</b><small>new</small>` : `<b>${k}</b><small>${k}</small>`;
  btn.setAttribute("aria-label", isEnter ? "New column" : `Insert ${k}`);
  btn.addEventListener("click", () => {
    const ins = isEnter ? "\n" : k.toLowerCase();
    const s = txt.selectionStart, e = txt.selectionEnd;
    txt.setRangeText(ins, s, e, "end");
    txt.focus();
    txt.dispatchEvent(new Event("input"));
  });
  $("keys").appendChild(btn);
}

/* hover to see the Latin letter */
const tip = $("tip");
cv.addEventListener("mousemove", e => {
  const r = cv.getBoundingClientRect();
  const sx = cv.width / r.width, sy = cv.height / r.height;
  const px = (e.clientX - r.left) * sx, py = (e.clientY - r.top) * sy;
  const hit = cells.find(c => c.rect && c.ch !== " " && px >= c.rect[0] && px < c.rect[0] + c.rect[2] && py >= c.rect[1] && py < c.rect[1] + c.rect[2]);
  if (hit) { tip.style.display = "block"; tip.textContent = hit.ch.toUpperCase(); tip.style.left = e.clientX + "px"; tip.style.top = e.clientY + "px"; }
  else tip.style.display = "none";
});
cv.addEventListener("mouseleave", () => tip.style.display = "none");

/* ---------- save ---------- */
$("save").hidden = false;
$("save").addEventListener("click", () => {
  stopAnim(); draw();
  cv.toBlob(blob => {
    if (!blob) { $("status").textContent = "Couldn't create the image. Try a smaller glyph size."; return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `zu-${state.mode}-${state.surf}.png`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    $("status").textContent = "PNG downloaded.";
  }, "image/png");
});

/* ---------- boot ---------- */
(async () => {
  try { await document.fonts.load("50px FEZ"); } catch {}
  refresh();
})();
