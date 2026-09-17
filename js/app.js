"use strict";
/* Zu Writer — renders text in the FEZ Zu alphabet.
   Timing defaults come from the game's Hexahedron dialogue:
   its talking starts 0.25 s after a box appears and lasts 0.1 s per character,
   a speech box fades in over 0.2 s and fades out over 0.1 s. */

const SUPPORTED = new Set([..."!\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~\u00b1\u00c0\u00c1\u00c2\u00c3\u00c4\u00c5\u00c6\u00c7\u00c8\u00c9\u00ca\u00cb\u00cc\u00cd\u00ce\u00cf\u00d0\u00d1\u00d2\u00d3\u00d4\u00d5\u00d6\u00d7\u00d8\u00d9\u00da\u00db\u00dc\u00dd\u00de\u00e0\u00e1\u00e2\u00e3\u00e4\u00e5\u00e6\u00e7\u00e8\u00e9\u00ea\u00eb\u00ec\u00ed\u00ee\u00ef\u00f0\u00f1\u00f2\u00f3\u00f4\u00f5\u00f6\u00f7\u00f8\u00f9\u00fa\u00fb\u00fc\u00fd\u00fe\u00ff\u0100\u0101\u0102\u0103\u0104\u0105\u0106\u0107\u0108\u0109\u010a\u010b\u010c\u010d\u010e\u010f\u0110\u0111\u0112\u0113\u0114\u0115\u0116\u0117\u0118\u0119\u011a\u011b\u011c\u011d\u011e\u011f\u0141\u0142\u0143\u0144\u015a\u015b\u016e\u016f\u0178\u0179\u017a\u017b\u017c\u2022", " "]);
const HEX_SPEED = 0.10, LEAD = 0.25, FADE_IN = 0.2, FADE_OUT = 0.1;
const BG = { sky: "#8FCFE3", green: "#00FF00", black: "#000000" };

const $ = id => document.getElementById(id);
const cv = $("cv"), ctx = cv.getContext("2d");

const state = {
  mode: "columns", surf: "speech", len: 10, block: 5, gap: true,
  speed: HEX_SPEED, hold: 1.5, bg: "sky", scale: 2,
  boxes: [], current: 0, busy: false
};

const DEFAULT_BOXES = ["hello traveler", "this world has more sides than you can see"];
function loadBoxes() {
  try {
    const saved = JSON.parse(localStorage.getItem("zu-writer-boxes") || "null");
    if (Array.isArray(saved) && saved.length && saved.every(s => typeof s === "string")) return saved;
    const old = localStorage.getItem("zu-writer-text");
    if (old) return [old];
  } catch {}
  return DEFAULT_BOXES.slice();
}
function persist() { try { localStorage.setItem("zu-writer-boxes", JSON.stringify(state.boxes)); } catch {} }
state.boxes = loadBoxes();

/* ---------- layout ---------- */
// Each glyph remembers k, its character index in the box text, so it can be timed.
function toLines(text, n, gap) {
  const lines = [];
  let offset = 0;
  for (const para of text.split("\n")) {
    const words = [];
    const re = /\S+/g;
    let m;
    while ((m = re.exec(para))) {
      const w = [];
      for (let i = 0; i < m[0].length; i++) {
        const c = m[0][i];
        if (SUPPORTED.has(c)) w.push({ ch: c, k: offset + m.index + i });
      }
      if (w.length) words.push(w);
    }
    let cur = [];
    for (let chars of words) {
      while (chars.length > n) {
        if (cur.length) { lines.push(cur); cur = []; }
        lines.push(chars.slice(0, n)); chars = chars.slice(n);
      }
      if (!chars.length) continue;
      const sep = cur.length && gap ? 1 : 0;
      if (cur.length + sep + chars.length > n) { lines.push(cur); cur = chars; }
      else cur = cur.length ? [...cur, ...(gap ? [{ ch: " ", k: -1 }] : []), ...chars] : chars;
    }
    lines.push(cur);
    offset += para.length + 1;
  }
  while (lines.length > 1 && !lines[lines.length - 1].length) lines.pop();
  return lines;
}

function layoutText(text) {
  const lines = toLines(text, state.len, state.gap);
  const L = Math.max(lines.length, 1);
  const maxLen = Math.max(1, ...lines.map(l => l.length));
  const cells = [];
  lines.forEach((line, i) => line.forEach((g, j) => {
    if (g.ch === " ") return;
    if (state.mode === "rows") cells.push({ ch: g.ch, k: g.k, x: j, y: i, rot: 0 });
    else cells.push({ ch: g.ch, k: g.k, x: L - 1 - i, y: j, rot: state.mode === "pillar" ? 1 : 0 });
  }));
  return {
    cells,
    cols: state.mode === "rows" ? maxLen : L,
    rows: state.mode === "rows" ? L : maxLen
  };
}

function boxSize(lay, b) {
  const P = 6 * b, pad = 4 * b;
  return { W: pad * 2 + lay.cols * P - b, H: pad * 2 + lay.rows * P - b };
}

/* ---------- surfaces ---------- */
function rng(seed) { return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296); }
const half = b => Math.max(1, b / 2 | 0);
const SURF = {
  speech: {
    ink: "#FFFFFF",
    draw(c, W, H, b) {
      c.fillStyle = "#000"; c.fillRect(0, 0, W, H);
      c.fillStyle = "#FFF";
      c.fillRect(b, b, W - 2 * b, b); c.fillRect(b, H - 2 * b, W - 2 * b, b);
      c.fillRect(b, b, b, H - 2 * b); c.fillRect(W - 2 * b, b, b, H - 2 * b);
      c.fillStyle = "#000";
      [[b, b], [W - 2 * b, b], [b, H - 2 * b], [W - 2 * b, H - 2 * b]].forEach(([x, y]) => c.fillRect(x, y, b, b));
    }
  },
  pillar: {
    ink: "#2C1A3D", light: "#9C7CBA",
    draw(c, W, H, b) {
      const r = rng(7);
      c.fillStyle = "#6E4B8C"; c.fillRect(0, 0, W, H);
      for (let y = 0; y < H; y += b) for (let x = 0; x < W; x += b) {
        const v = r();
        if (v < 0.12) { c.fillStyle = "#5E3E7B"; c.fillRect(x, y, b, b); }
        else if (v > 0.93) { c.fillStyle = "#80609F"; c.fillRect(x, y, b, b); }
      }
      c.fillStyle = "#4E3268";
      c.fillRect(0, 0, W, 2 * b); c.fillRect(0, H - 2 * b, W, 2 * b);
      c.fillStyle = "#8E6DAE"; c.fillRect(0, 2 * b, W, half(b));
    }
  },
  wall: {
    ink: "#4A3521",
    draw(c, W, H, b) {
      const r = rng(3);
      c.fillStyle = "#C9A77A"; c.fillRect(0, 0, W, H);
      const bh = 4 * b, bw = 9 * b;
      for (let row = 0, y = 0; y < H; row++, y += bh) {
        const off = row % 2 ? -bw / 2 : 0;
        for (let x = off; x < W; x += bw) {
          const v = r();
          c.fillStyle = v < 0.3 ? "#C09D6F" : v > 0.8 ? "#D2B288" : "#C9A77A";
          c.fillRect(x, y, bw, bh);
          c.fillStyle = "#A88659";
          c.fillRect(x, y, bw, half(b)); c.fillRect(x, y, half(b), bh);
        }
      }
    }
  },
  paper: {
    ink: "#3B2A1A",
    draw(c, W, H, b) {
      const r = rng(11);
      c.fillStyle = "#EAD9A8"; c.fillRect(0, 0, W, H);
      for (let y = 0; y < H; y += b) for (let x = 0; x < W; x += b) {
        if (r() < 0.05) { c.fillStyle = "#DCC690"; c.fillRect(x, y, b, b); }
      }
      c.fillStyle = "#D4BD85";
      c.fillRect(Math.round(W * 0.5), b, Math.max(1, b / 3 | 0), H - 2 * b);
      for (let x = 0; x < W; x += b) {
        if (r() < 0.35) c.clearRect(x, 0, b, b);
        if (r() < 0.35) c.clearRect(x, H - b, b, b);
      }
      for (let y = 0; y < H; y += b) {
        if (r() < 0.35) c.clearRect(0, y, b, b);
        if (r() < 0.35) c.clearRect(W - b, y, b, b);
      }
    }
  }
};

/* ---------- drawing ---------- */
function glyph(c, ch, x, y, S, rot, color) {
  c.save();
  c.translate(x + S / 2, y + S / 2);
  if (rot) c.rotate(Math.PI / 2);
  c.fillStyle = color;
  const m = c.measureText(ch);
  const w = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
  c.fillText(ch, Math.round(-S / 2 + (S - w) / 2 + m.actualBoundingBoxLeft), S / 2);
  c.restore();
}

// Draws one box at (0,0). visibleK: highest character index shown.
function drawBox(c, lay, b, visibleK = Infinity, hitRects = false) {
  const S = 5 * b, P = 6 * b, pad = 4 * b;
  const { W, H } = boxSize(lay, b);
  const surf = SURF[state.surf];
  c.clearRect(0, 0, W, H);
  surf.draw(c, W, H, b);
  c.font = `${S}px FEZ`;
  c.textBaseline = "alphabetic";
  for (const cell of lay.cells) {
    if (cell.k > visibleK) continue;
    const x = pad + cell.x * P, y = pad + cell.y * P;
    if (hitRects) cell.rect = [x, y, S];
    if (surf.light) glyph(c, cell.ch, x + half(b), y + half(b), S, cell.rot, surf.light);
    glyph(c, cell.ch, x, y, S, cell.rot, surf.ink);
  }
  return { W, H };
}

/* ---------- static view ---------- */
let staticLayout = null;
const HINTS = {
  columns: "Read from the top right corner, down the column, then move one column to the left.",
  pillar: "Turn the message 90° counter-clockwise (or tilt your head left) and it reads as normal lines.",
  rows: "Left to right, top to bottom. Handy for proofreading before switching styles."
};

function refresh() {
  if (player) stopPlayback();
  const text = state.boxes[state.current] ?? "";
  staticLayout = layoutText(text);
  const { W, H } = boxSize(staticLayout, state.block);
  cv.width = W; cv.height = H;
  drawBox(ctx, staticLayout, state.block, Infinity, true);
  cv.setAttribute("aria-label", `Zu alphabet rendering of box ${state.current + 1}: ${text.slice(0, 200)}`);
  const count = state.boxes.length;
  $("hint").textContent = (count > 1 ? `Box ${state.current + 1} of ${count}. ` : "") + HINTS[state.mode];
  $("lenLabel").textContent = state.mode === "columns" ? "Glyphs per column" : state.mode === "pillar" ? "Glyphs per turned line" : "Glyphs per row";
}

/* ---------- timeline ---------- */
function buildMovie(b) {
  const items = state.boxes.map((text, index) => ({ text, index }))
    .filter(({ text }) => [...text].some(c => c !== " " && c !== "\n" && SUPPORTED.has(c)));
  const segs = [];
  let t = 0, maxW = 0, maxH = 0;
  for (const { text, index } of items) {
    const lay = layoutText(text);
    const size = boxSize(lay, b);
    maxW = Math.max(maxW, size.W); maxH = Math.max(maxH, size.H);
    const start = t;
    const writeEnd = start + LEAD + state.speed * text.length;
    const fadeOut = writeEnd + state.hold;
    const end = fadeOut + FADE_OUT;
    segs.push({ text, lay, size, start, writeEnd, fadeOut, end, index });
    t = end;
  }
  const margin = 6 * b;
  const FW = maxW + margin * 2, FH = maxH + margin * 2;
  const off = document.createElement("canvas");
  const octx = off.getContext("2d");

  function segAt(time) {
    for (const s of segs) if (time < s.end) return s;
    return null;
  }
  function draw(c, time, fw = FW, fh = FH) {
    c.globalAlpha = 1;
    c.fillStyle = BG[state.bg];
    c.fillRect(0, 0, fw, fh);
    const s = segAt(time);
    if (!s || time < s.start) return s;
    const local = time - s.start;
    let alpha = Math.min(1, local / FADE_IN);
    if (time >= s.fadeOut) alpha = Math.max(0, 1 - (time - s.fadeOut) / FADE_OUT);
    const visibleK = local < LEAD ? -1 : Math.floor((local - LEAD) / state.speed + 1e-6);
    if (off.width !== s.size.W || off.height !== s.size.H) { off.width = s.size.W; off.height = s.size.H; }
    drawBox(octx, s.lay, b, visibleK);
    c.globalAlpha = alpha;
    c.imageSmoothingEnabled = false;
    c.drawImage(off, Math.round((fw - s.size.W) / 2), Math.round((fh - s.size.H) / 2));
    c.globalAlpha = 1;
    return s;
  }
  // Moments when the picture changes (used to build compact GIFs).
  function events() {
    const ev = new Set([0]);
    for (const s of segs) {
      for (let f = 0; f <= 4; f++) ev.add(+(s.start + f * 0.05).toFixed(4));
      for (const cell of s.lay.cells) ev.add(+(s.start + LEAD + cell.k * state.speed).toFixed(4));
      ev.add(+s.fadeOut.toFixed(4));
      ev.add(+(s.fadeOut + 0.05).toFixed(4));
      ev.add(+s.end.toFixed(4));
    }
    return [...ev].filter(t => t <= duration).sort((a, b) => a - b);
  }
  const duration = t;
  return { segs, FW, FH, duration, draw, events };
}

/* ---------- playback ---------- */
let player = null;
function markPlaying(index) {
  document.querySelectorAll(".box-card").forEach((el, i) => el.classList.toggle("playing", i === index));
}
function stopPlayback() {
  if (!player) return;
  cancelAnimationFrame(player.raf);
  player = null;
  markPlaying(-1);
  $("play").textContent = "Play all boxes";
  refresh();
}
$("play").addEventListener("click", () => {
  if (player) { stopPlayback(); return; }
  const movie = buildMovie(state.block);
  if (!movie.segs.length) { $("status").textContent = "Write something in a text box first."; return; }
  cv.width = movie.FW; cv.height = movie.FH;
  $("play").textContent = "Stop";
  $("status").textContent = "";
  const t0 = performance.now();
  player = { raf: 0 };
  const tick = now => {
    if (!player) return;
    const time = (now - t0) / 1000;
    if (time >= movie.duration) { stopPlayback(); return; }
    const s = movie.draw(ctx, time);
    markPlaying(s ? s.index : -1);
    player.raf = requestAnimationFrame(tick);
  };
  player.raf = requestAnimationFrame(tick);
});

/* ---------- GIF encoder ---------- */
function lzw(pixels, minCode) {
  const clear = 1 << minCode, eoi = clear + 1;
  let codeSize = minCode + 1, next = eoi + 1;
  const out = [];
  let cur = 0, bits = 0;
  const emit = code => {
    cur |= code << bits; bits += codeSize;
    while (bits >= 8) { out.push(cur & 255); cur >>>= 8; bits -= 8; }
  };
  let dict = new Map();
  emit(clear);
  let prefix = pixels[0];
  for (let i = 1; i < pixels.length; i++) {
    const k = pixels[i];
    const key = prefix * 256 + k;
    const v = dict.get(key);
    if (v !== undefined) { prefix = v; continue; }
    emit(prefix);
    if (next < 4096) {
      dict.set(key, next++);
      if (next > (1 << codeSize) && codeSize < 12) codeSize++;
    } else {
      emit(clear);
      dict = new Map(); codeSize = minCode + 1; next = eoi + 1;
    }
    prefix = k;
  }
  emit(prefix);
  emit(eoi);
  if (bits > 0) out.push(cur & 255);
  return out;
}

const tick = () => new Promise(r => setTimeout(r, 0));

async function makeGif(progress) {
  const b = state.block * state.scale;
  const movie = buildMovie(b);
  const { FW, FH } = movie;
  const canvas = document.createElement("canvas");
  canvas.width = FW; canvas.height = FH;
  const c = canvas.getContext("2d", { willReadFrequently: true });
  const ev = movie.events();
  const times = ev.slice();
  const endPause = 0.6;

  // Frame list with delays in hundredths of a second (rounding error carried forward).
  const frames = [];
  let carry = 0;
  for (let i = 0; i < times.length; i++) {
    const nextT = i + 1 < times.length ? times[i + 1] : times[i] + endPause;
    const exact = (nextT - times[i]) * 100 + carry;
    const cs = Math.round(exact);
    carry = exact - cs;
    if (cs < 2 && i + 1 < times.length) { carry = exact; continue; }
    frames.push({ t: times[i] + 1e-4, cs: Math.max(2, cs) });
  }

  // Pass 1: palette (reduce colour precision until it fits in 256 colours).
  let shift = 0, palette = null;
  for (shift = 0; shift <= 5; shift++) {
    const map = new Map();
    let ok = true;
    for (let f = 0; f < frames.length && ok; f++) {
      movie.draw(c, frames[f].t);
      const d = c.getImageData(0, 0, FW, FH).data;
      for (let p = 0; p < d.length; p += 4) {
        const key = ((d[p] >> shift) << 16) | ((d[p + 1] >> shift) << 8) | (d[p + 2] >> shift);
        if (!map.has(key)) { map.set(key, map.size); if (map.size > 256) { ok = false; break; } }
      }
      if (f % 8 === 0) { progress(0.25 * f / frames.length); await tick(); }
    }
    if (ok) { palette = map; break; }
  }
  if (!palette) throw new Error("Too many colours for a GIF.");

  let tableBits = 1;
  while ((1 << tableBits) < palette.size) tableBits++;
  const tableSize = 1 << tableBits;
  const minCode = Math.max(2, tableBits);

  const parts = [];
  const bytes = arr => parts.push(new Uint8Array(arr));
  const u16 = n => [n & 255, (n >> 8) & 255];
  bytes([..."GIF89a"].map(ch => ch.charCodeAt(0)));
  bytes([...u16(FW), ...u16(FH), 0x80 | 0x70 | (tableBits - 1), 0, 0]);
  const table = new Uint8Array(tableSize * 3);
  const round = shift ? (1 << (shift - 1)) : 0;
  for (const [key, idx] of palette) {
    table[idx * 3] = Math.min(255, ((key >> 16) & 255) << shift | round);
    table[idx * 3 + 1] = Math.min(255, ((key >> 8) & 255) << shift | round);
    table[idx * 3 + 2] = Math.min(255, (key & 255) << shift | round);
  }
  parts.push(table);
  bytes([0x21, 0xFF, 0x0B, ..."NETSCAPE2.0"].map(v => typeof v === "string" ? v.charCodeAt(0) : v));
  bytes([0x03, 0x01, 0x00, 0x00, 0x00]);

  // Pass 2: encode frames. After the first frame only the changed rectangle is stored.
  let indices = new Uint8Array(FW * FH), prev = new Uint8Array(FW * FH);
  for (let f = 0; f < frames.length; f++) {
    movie.draw(c, frames[f].t);
    const d = c.getImageData(0, 0, FW, FH).data;
    for (let p = 0, q = 0; p < d.length; p += 4, q++) {
      indices[q] = palette.get(((d[p] >> shift) << 16) | ((d[p + 1] >> shift) << 8) | (d[p + 2] >> shift));
    }
    let x0 = 0, y0 = 0, x1 = FW - 1, y1 = FH - 1;
    if (f > 0) {
      x0 = FW; y0 = FH; x1 = -1; y1 = -1;
      for (let y = 0; y < FH; y++) {
        const row = y * FW;
        for (let x = 0; x < FW; x++) {
          if (indices[row + x] !== prev[row + x]) {
            if (x < x0) x0 = x; if (x > x1) x1 = x;
            if (y < y0) y0 = y; if (y > y1) y1 = y;
          }
        }
      }
      if (x1 < 0) { x0 = y0 = x1 = y1 = 0; }
    }
    const rw = x1 - x0 + 1, rh = y1 - y0 + 1;
    const sub = new Uint8Array(rw * rh);
    for (let y = 0; y < rh; y++) sub.set(indices.subarray((y0 + y) * FW + x0, (y0 + y) * FW + x0 + rw), y * rw);
    [prev, indices] = [indices, prev];
    bytes([0x21, 0xF9, 0x04, 0x04, ...u16(frames[f].cs), 0x00, 0x00]);
    bytes([0x2C, ...u16(x0), ...u16(y0), ...u16(rw), ...u16(rh), 0x00, minCode]);
    const data = lzw(sub, minCode);
    const block = new Uint8Array(data.length + Math.ceil(data.length / 255) + 1);
    let o = 0;
    for (let i = 0; i < data.length; i += 255) {
      const n = Math.min(255, data.length - i);
      block[o++] = n;
      for (let j = 0; j < n; j++) block[o++] = data[i + j];
    }
    block[o++] = 0;
    parts.push(block.subarray(0, o));
    if (f % 4 === 0) { progress(0.25 + 0.75 * f / frames.length); await tick(); }
  }
  bytes([0x3B]);
  return new Blob(parts, { type: "image/gif" });
}

/* ---------- video encoder ---------- */
async function makeVideo(progress) {
  const fps = 30;
  let b = state.block * state.scale;
  let movie = buildMovie(b);
  // Video codecs blur small pixel art, so make sure the picture is at least ~480px tall.
  while (movie.FH < 480 && b < 64) { b += state.block; movie = buildMovie(b); }
  const W = movie.FW + (movie.FW % 2), H = movie.FH + (movie.FH % 2);
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const c = canvas.getContext("2d");
  const totalFrames = Math.ceil((movie.duration + 0.3) * fps);

  if (typeof VideoEncoder !== "undefined" && typeof Mp4Muxer !== "undefined") {
    const candidates = [
      { mux: "avc", codec: "avc1.640034" }, { mux: "avc", codec: "avc1.4d0034" },
      { mux: "avc", codec: "avc1.42003e" }, { mux: "avc", codec: "avc1.42001f" },
      { mux: "vp9", codec: "vp09.00.40.08" }
    ];
    const bitrate = Math.min(20e6, Math.max(2e6, W * H * fps * 0.15));
    let chosen = null;
    for (const cand of candidates) {
      try {
        const cfg = { codec: cand.codec, width: W, height: H, bitrate, framerate: fps };
        const res = await VideoEncoder.isConfigSupported(cfg);
        if (res.supported) { chosen = { ...cand, cfg }; break; }
      } catch {}
    }
    if (chosen) {
      const muxer = new Mp4Muxer.Muxer({
        target: new Mp4Muxer.ArrayBufferTarget(),
        video: { codec: chosen.mux, width: W, height: H, frameRate: fps },
        fastStart: "in-memory"
      });
      let failure = null;
      const encoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: e => { failure = e; }
      });
      encoder.configure(chosen.cfg);
      for (let i = 0; i < totalFrames; i++) {
        if (failure) throw failure;
        movie.draw(c, i / fps, W, H);
        const frame = new VideoFrame(canvas, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
        encoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
        frame.close();
        while (encoder.encodeQueueSize > 8) await new Promise(r => setTimeout(r, 5));
        if (i % 10 === 0) { progress(i / totalFrames); await tick(); }
      }
      await encoder.flush();
      if (failure) throw failure;
      muxer.finalize();
      return { blob: new Blob([muxer.target.buffer], { type: "video/mp4" }), ext: "mp4" };
    }
  }

  // Fallback: record in real time.
  if (typeof MediaRecorder === "undefined" || !canvas.captureStream) throw new Error("This browser can't make videos. Try the GIF instead.");
  const mime = ["video/mp4;codecs=avc1", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find(m => MediaRecorder.isTypeSupported(m));
  if (!mime) throw new Error("This browser can't make videos. Try the GIF instead.");
  const stream = canvas.captureStream(fps);
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8e6 });
  const chunks = [];
  rec.ondataavailable = e => e.data.size && chunks.push(e.data);
  const done = new Promise(r => rec.onstop = r);
  movie.draw(c, 0, W, H);
  rec.start();
  const t0 = performance.now();
  await new Promise(resolve => {
    const step = now => {
      const time = (now - t0) / 1000;
      movie.draw(c, Math.min(time, movie.duration), W, H);
      progress(time / (movie.duration + 0.3));
      if (time >= movie.duration + 0.3) resolve(); else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
  rec.stop();
  await done;
  return { blob: new Blob(chunks, { type: mime.split(";")[0] }), ext: mime.includes("mp4") ? "mp4" : "webm" };
}

/* ---------- export buttons ---------- */
function setBusy(on) {
  state.busy = on;
  ["gif", "video", "save", "play"].forEach(id => $(id).disabled = on);
}
async function runExport(kind) {
  if (state.busy) return;
  if (player) stopPlayback();
  if (!state.boxes.some(t => [...t].some(ch => ch !== " " && ch !== "\n" && SUPPORTED.has(ch)))) {
    $("status").textContent = "Write something in a text box first."; return;
  }
  setBusy(true);
  const label = kind === "gif" ? "GIF" : "video";
  const progress = p => $("status").textContent = `Making ${label}: ${Math.round(Math.min(1, p) * 100)}%`;
  try {
    progress(0);
    const name = `zu-${state.surf}-${state.mode}`;
    if (kind === "gif") {
      const blob = await makeGif(progress);
      await saveFile(`${name}.gif`, blob, "GIF");
    } else {
      const { blob, ext } = await makeVideo(progress);
      await saveFile(`${name}.${ext}`, blob, ext.toUpperCase());
    }
  } catch (err) {
    $("status").textContent = err?.message ? `Couldn't make the ${label}: ${err.message}` : `Couldn't make the ${label}.`;
  } finally {
    setBusy(false);
  }
}
$("gif").addEventListener("click", () => runExport("gif"));
$("video").addEventListener("click", () => runExport("video"));
$("save").addEventListener("click", () => {
  if (player) stopPlayback();
  const b = state.block * state.scale;
  const lay = layoutText(state.boxes[state.current] ?? "");
  const size = boxSize(lay, b);
  const canvas = document.createElement("canvas");
  canvas.width = size.W; canvas.height = size.H;
  drawBox(canvas.getContext("2d"), lay, b);
  canvas.toBlob(blob => blob && saveFile(`zu-box-${state.current + 1}.png`, blob, "PNG"), "image/png");
});

/* ---------- text boxes ---------- */
let focusedIndex = 0;
function renderBoxes() {
  const wrap = $("boxes");
  wrap.innerHTML = "";
  state.boxes.forEach((text, i) => {
    const card = document.createElement("div");
    card.className = "box-card" + (i === state.current ? " selected" : "");
    const head = document.createElement("div");
    head.className = "box-head";
    const name = document.createElement("button");
    name.type = "button"; name.className = "box-name";
    name.textContent = `Box ${i + 1}`;
    name.setAttribute("aria-pressed", i === state.current);
    name.addEventListener("click", () => select(i));
    const meta = document.createElement("span");
    meta.className = "box-meta";
    const updateMeta = () => meta.textContent = `${(LEAD + state.boxes[i].length * state.speed).toFixed(1)} s to write`;
    updateMeta();
    const tool = (label, aria, disabled, fn) => {
      const t = document.createElement("button");
      t.type = "button"; t.className = "tool"; t.textContent = label;
      t.setAttribute("aria-label", aria); t.disabled = disabled;
      t.addEventListener("click", fn);
      return t;
    };
    head.append(name, meta,
      tool("↑", `Move box ${i + 1} up`, i === 0, () => move(i, -1)),
      tool("↓", `Move box ${i + 1} down`, i === state.boxes.length - 1, () => move(i, 1)),
      tool("Remove", `Remove box ${i + 1}`, state.boxes.length === 1, () => removeBox(i)));
    const ta = document.createElement("textarea");
    ta.spellcheck = false;
    ta.value = text;
    ta.setAttribute("aria-label", `Text for box ${i + 1}`);
    ta.addEventListener("focus", () => { focusedIndex = i; if (state.current !== i) select(i, false); });
    ta.addEventListener("input", () => { state.boxes[i] = ta.value; updateMeta(); persist(); refresh(); });
    card.append(head, ta);
    wrap.appendChild(card);
  });
}
function select(i, rerender = true) {
  state.current = i;
  document.querySelectorAll(".box-card").forEach((el, j) => {
    el.classList.toggle("selected", j === i);
    el.querySelector(".box-name").setAttribute("aria-pressed", j === i);
  });
  if (rerender) focusedIndex = i;
  refresh();
}
function move(i, dir) {
  const j = i + dir;
  [state.boxes[i], state.boxes[j]] = [state.boxes[j], state.boxes[i]];
  if (state.current === i) state.current = j; else if (state.current === j) state.current = i;
  persist(); renderBoxes(); refresh();
}
function removeBox(i) {
  state.boxes.splice(i, 1);
  state.current = Math.min(state.current, state.boxes.length - 1);
  focusedIndex = state.current;
  persist(); renderBoxes(); refresh();
}
$("addBox").addEventListener("click", () => {
  state.boxes.push("");
  state.current = state.boxes.length - 1;
  focusedIndex = state.current;
  persist(); renderBoxes(); refresh();
  document.querySelectorAll(".box-card textarea")[state.current]?.focus();
});

/* ---------- controls ---------- */
const onRadio = (name, fn) => document.querySelectorAll(`input[name=${name}]`).forEach(r => r.addEventListener("change", e => fn(e.target.value)));
onRadio("mode", v => { state.mode = v; refresh(); });
onRadio("surf", v => { state.surf = v; refresh(); });
onRadio("bg", v => { state.bg = v; });
onRadio("scale", v => { state.scale = +v; });
$("len").addEventListener("input", e => { state.len = +e.target.value; $("lenOut").textContent = state.len; refresh(); });
$("size").addEventListener("input", e => { state.block = +e.target.value; $("sizeOut").textContent = state.block; refresh(); });
$("gap").addEventListener("change", e => { state.gap = e.target.checked; refresh(); });
function setSpeed(v) {
  state.speed = v;
  $("speed").value = v;
  $("speedOut").textContent = `${v.toFixed(2)} s`;
  $("speedReset").hidden = Math.abs(v - HEX_SPEED) < 1e-9;
  renderBoxes();
}
$("speed").addEventListener("input", e => { if (player) stopPlayback(); setSpeed(+e.target.value); });
$("speedReset").addEventListener("click", () => setSpeed(HEX_SPEED));
$("hold").addEventListener("input", e => { state.hold = +e.target.value; $("holdOut").textContent = `${state.hold.toFixed(1)} s`; });
$("zuInput").addEventListener("change", e => document.querySelector(".editor").classList.toggle("zu", e.target.checked));

/* glyph keyboard */
const KEYS = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", ".", ",", "!", "?", "'", "-", "⏎"];
for (const k of KEYS) {
  const btn = document.createElement("button");
  btn.type = "button"; btn.className = "key";
  const isEnter = k === "⏎";
  btn.innerHTML = isEnter ? `<b style="font-family:var(--ui)">↵</b><small>new</small>` : `<b>${k}</b><small>${k}</small>`;
  btn.setAttribute("aria-label", isEnter ? "New column" : `Insert ${k}`);
  btn.addEventListener("mousedown", e => e.preventDefault());
  btn.addEventListener("click", () => {
    const ta = document.querySelectorAll(".box-card textarea")[focusedIndex];
    if (!ta) return;
    ta.setRangeText(isEnter ? "\n" : k.toLowerCase(), ta.selectionStart, ta.selectionEnd, "end");
    ta.focus();
    ta.dispatchEvent(new Event("input"));
  });
  $("keys").appendChild(btn);
}

/* hover to see the Latin letter */
const tip = $("tip");
cv.addEventListener("mousemove", e => {
  if (player || !staticLayout) { tip.style.display = "none"; return; }
  const r = cv.getBoundingClientRect();
  const px = (e.clientX - r.left) * cv.width / r.width, py = (e.clientY - r.top) * cv.height / r.height;
  const hit = staticLayout.cells.find(c => c.rect && px >= c.rect[0] && px < c.rect[0] + c.rect[2] && py >= c.rect[1] && py < c.rect[1] + c.rect[2]);
  if (hit) { tip.style.display = "block"; tip.textContent = hit.ch.toUpperCase(); tip.style.left = e.clientX + "px"; tip.style.top = e.clientY + "px"; }
  else tip.style.display = "none";
});
cv.addEventListener("mouseleave", () => tip.style.display = "none");

/* ---------- boot ---------- */
(async () => {
  try { await document.fonts.load("50px FEZ"); } catch {}
  renderBoxes();
  setSpeed(HEX_SPEED);
  refresh();
})();
