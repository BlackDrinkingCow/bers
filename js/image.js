// Photos are shrunk on the phone before they're stored or sent, so storage stays small and Claude reads fewer tokens.

export function fileToDataUrl(file, max = 768, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s);
      const g = cv.getContext("2d");
      g.fillStyle = "#fff"; g.fillRect(0, 0, cv.width, cv.height);
      g.drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      resolve(cv.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Couldn't read that photo.")); };
    img.src = url;
  });
}

export async function squareAvatar(file) {
  const src = await fileToDataUrl(file, 600);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(img.width, img.height), cv = document.createElement("canvas");
      cv.width = cv.height = 192;
      cv.getContext("2d").drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 192, 192);
      resolve(cv.toDataURL("image/jpeg", 0.85));
    };
    img.src = src;
  });
}

/* ======================= Studio retouch =======================
   Runs entirely on the phone, no upload: cut the piece out of its background, correct the colour,
   sharpen, then frame it centred on a light studio backdrop with a soft shadow, like a shop's product shot.
   Works best on a plain background (bed sheet, floor, wall). A transparent cut-out (iPhone Photos:
   press and hold the subject → Copy) skips the cut-out step and gives the cleanest edges. */

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image(), url = typeof src === "string" ? src : URL.createObjectURL(src);
    img.onload = () => { if (typeof src !== "string") URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => reject(new Error("Couldn't read that photo."));
    img.src = url;
  });
}
const canvas = (w, h) => Object.assign(document.createElement("canvas"), { width: w, height: h });

/* Median colour and spread of a band around the photo's edges: our guess at the background. */
function borderStats(d, W, H) {
  const b = Math.max(2, Math.round(Math.min(W, H) * 0.03)), px = [];
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2)
    if (x < b || y < b || x >= W - b || y >= H - b) { const i = (y * W + x) * 4; px.push([d[i], d[i + 1], d[i + 2]]); }
  const median = [0, 1, 2].map((c) => px.map((p) => p[c]).sort((a, z) => a - z)[px.length >> 1]);
  const std = [0, 1, 2].reduce((s, c) => { const m = px.reduce((a, p) => a + p[c], 0) / px.length; return s + Math.sqrt(px.reduce((a, p) => a + (p[c] - m) ** 2, 0) / px.length); }, 0) / 3;
  return { median, std };
}

/* Flood-fill the background in from the edges. Returns null if the background is too busy to separate. */
/* Two passes: by colour only (cleanest, the normal case), and edge-aware (keeps a light piece on a light
   background, but can leave crease shards). The edge-aware result is used only when the colour pass lost most of the piece. */
function autoMask(d, W, H) {
  const a = maskPass(d, W, H, false);
  if (a && a.fg > W * H * 0.06) return a;
  const b = maskPass(d, W, H, true);
  const best = b && (!a || b.fg > a.fg * 2) ? b : a;
  // Safety net: a cut-out that keeps only a sliver (say, just the print of a white tee on a white sheet) is worse than none.
  return best && best.fg > W * H * 0.05 ? best : null;
}
function maskPass(d, W, H, edgeAware) {
  const { median: bg, std } = borderStats(d, W, H);
  if (std > 40) return null;
  const N = W * H, T = Math.max(26, std * 2.6), T2 = T * 2;
  const dist = (i, r, g, b) => Math.hypot(d[i * 4] - r, d[i * 4 + 1] - g, d[i * 4 + 2] - b);
  // Edges: a white tee on a white sheet is close in colour, but its outline (a faint shadow line) is still an edge.
  // The fill is not allowed to cross strong edges, so a light piece on a light background survives.
  const grad = new Float32Array(N);
  let G = Infinity;
  if (edgeAware) {
    const lum = new Float32Array(N);
    for (let i = 0; i < N; i++) lum[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
    const sm = blur3(blur3(lum, W, H), W, H);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      grad[i] = Math.abs(sm[i + 1] - sm[i - 1]) + Math.abs(sm[i + W] - sm[i - W]);
    }
    const bandG = []; for (let x = 2; x < W - 2; x += 3) { bandG.push(grad[2 * W + x], grad[(H - 3) * W + x]); }
    bandG.sort((a, z) => a - z);
    // just above the strongest edge seen around the photo's border (creases, folds), so only the piece's own outline blocks
    G = Math.max(4, bandG[Math.floor(bandG.length * 0.995)] * 1.3);
  }
  const isBg = new Uint8Array(N), q = new Int32Array(N);
  let head = 0, tail = 0;
  const seed = (p) => { if (!isBg[p] && dist(p, ...bg) < T2) { isBg[p] = 1; q[tail++] = p; } };
  for (let x = 0; x < W; x++) { seed(x); seed((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { seed(y * W); seed(y * W + W - 1); }
  while (head < tail) {
    const p = q[head++], x = p % W, r = d[p * 4], g = d[p * 4 + 1], b = d[p * 4 + 2];
    for (const n of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W]) {
      if (n < 0 || n >= N || isBg[n] || grad[n] > G) continue;
      const toBg = dist(n, ...bg);
      // background if close to the background colour, or a gentle step from background next door (lighting falloff, creases)
      if (toBg < T || (toBg < T2 && dist(n, r, g, b) < 9)) { isBg[n] = 1; q[tail++] = n; }
    }
  }
  // Cleanup 1: creases and edge lines left standing in the background (thin, background-coloured) get absorbed.
  for (let pass = 0; pass < 3; pass++) {
    const add = [];
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      if (isBg[i] || dist(i, ...bg) > T) continue;
      if (isBg[i - 1] + isBg[i + 1] + isBg[i - W] + isBg[i + W] >= 2) add.push(i);
    }
    add.forEach((i) => (isBg[i] = 1));
  }
  // Cleanup 2: drop specks (foreground islands under 0.3% of the photo).
  const seen = new Uint8Array(N), minArea = N * 0.003;
  for (let s = 0; s < N; s++) {
    if (isBg[s] || seen[s]) continue;
    const comp = [s]; seen[s] = 1;
    for (let k = 0; k < comp.length; k++) {
      const p = comp[k], x = p % W;
      for (const n of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W])
        if (n >= 0 && n < N && !isBg[n] && !seen[n]) { seen[n] = 1; comp.push(n); }
    }
    if (comp.length < minArea) comp.forEach((p) => (isBg[p] = 1));
  }
  let fg = 0; for (let i = 0; i < N; i++) fg += !isBg[i];
  if (fg < N * 0.008 || fg > N * 0.93) return null;  // small floor so thin pieces (chains, watches) still cut out
  // soft edge: blur the hard mask twice (3×3), which also trims the halo of background colour
  let a = new Float32Array(N); for (let i = 0; i < N; i++) a[i] = isBg[i] ? 0 : 1;
  for (let pass = 0; pass < 2; pass++) a = blur3(a, W, H);
  for (let i = 0; i < N; i++) a[i] = Math.min(1, Math.max(0, (a[i] - 0.25) / 0.6));
  return { alpha: a, bg, fg };
}
function blur3(a, W, H) {
  const o = new Float32Array(a.length);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let s = 0, n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < W && yy < H) { s += a[yy * W + xx]; n++; }
    }
    o[y * W + x] = s / n;
  }
  return o;
}

/* White balance from the background, auto levels on the piece itself, a gentle contrast curve and a little vibrance. */
function correct(d, alpha, bg) {
  const N = alpha.length, mean = (bg[0] + bg[1] + bg[2]) / 3;
  // No white-balance shift: the iPhone camera already balances white well, and in testing, correcting against the
  // background (a sheet, a wall) tinted white shirts yellow. Tone is fixed below without changing the colour.
  const gain = [1, 1, 1]; void mean;
  const hist = new Uint32Array(256); let count = 0;
  for (let i = 0; i < N; i++) {
    for (let c = 0; c < 3; c++) d[i * 4 + c] = Math.min(255, d[i * 4 + c] * gain[c]);
    if (alpha[i] > 0.5) { hist[Math.round(0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2])]++; count++; }
  }
  const pct = (p) => { let s = 0; for (let v = 0; v < 256; v++) { s += hist[v]; if (s >= count * p) return v; } return 255; };
  const lo = Math.min(40, pct(0.005)), hi = Math.max(150, pct(0.995));
  // stretch so the brightest part lands at ~242, never past it: whites keep their texture instead of blowing out
  const k = Math.min(1.4, Math.max(1, 237 / Math.max(1, hi - lo)));
  for (let i = 0; i < N; i++) {
    const j = i * 4;
    let r = (d[j] - lo) * k + 5, g = (d[j + 1] - lo) * k + 5, b = (d[j + 2] - lo) * k + 5;
    const curve = (v) => { const t = Math.min(1, Math.max(0, v / 255)); return 255 * (t + 0.14 * (t * t * (3 - 2 * t) - t)); };
    r = curve(r); g = curve(g); b = curve(b);
    // vibrance: lift muted colours a little, but leave near-neutrals (whites, greys, blacks) exactly neutral
    const m = (r + g + b) / 3, sat = (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
    const boost = 1 + 0.12 * Math.min(1, Math.max(0, (sat - 0.08) / 0.2)) * (1 - sat);
    d[j] = Math.min(255, Math.max(0, m + (r - m) * boost));
    d[j + 1] = Math.min(255, Math.max(0, m + (g - m) * boost));
    d[j + 2] = Math.min(255, Math.max(0, m + (b - m) * boost));
  }
}

/* Unsharp mask: brings back fabric texture after resizing. */
function sharpen(d, W, H, amount = 0.45) {
  const src = new Uint8ClampedArray(d);
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = (y * W + x) * 4;
    for (let c = 0; c < 3; c++) {
      const blur = (src[i - 4 + c] + src[i + 4 + c] + src[i - W * 4 + c] + src[i + W * 4 + c] + src[i + c] * 4) / 8;
      d[i + c] = src[i + c] + amount * (src[i + c] - blur);
    }
  }
}

/* Centre the piece on a light studio sweep with a soft drop shadow and a contact shadow. */
function compose(cv, alpha, W, H, cut) {
  const S = 1000, out = canvas(S, S), g = out.getContext("2d");
  if (!cut) {  // no clean cut-out: keep the scene, just square it up
    const s = Math.min(W, H);
    g.drawImage(cv, (W - s) / 2, (H - s) / 2, s, s, 0, 0, S, S);
    return out;
  }
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (alpha[y * W + x] > 0.15) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1, k = Math.min((S * 0.8) / bw, (S * 0.8) / bh);
  const dw = bw * k, dh = bh * k, dx = (S - dw) / 2, dy = (S - dh) / 2 - S * 0.02;
  const sweep = g.createRadialGradient(S / 2, S * 0.4, S * 0.05, S / 2, S * 0.45, S * 0.8);
  sweep.addColorStop(0, "#fbfbf9"); sweep.addColorStop(1, "#e2e2de");
  g.fillStyle = sweep; g.fillRect(0, 0, S, S);
  // contact shadow under the piece
  g.save(); g.translate(S / 2, dy + dh + S * 0.012); g.scale(1, 0.07);
  const cs = g.createRadialGradient(0, 0, 0, 0, 0, dw * 0.45);
  cs.addColorStop(0, "rgba(0,0,0,.28)"); cs.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = cs; g.beginPath(); g.arc(0, 0, dw * 0.45, 0, Math.PI * 2); g.fill(); g.restore();
  // the piece, with a soft drop shadow
  g.shadowColor = "rgba(0,0,0,.2)"; g.shadowBlur = S * 0.03; g.shadowOffsetY = S * 0.012;
  g.drawImage(cv, x0, y0, bw, bh, dx, dy, dw, dh);
  return out;
}

/* The whole studio pass. src: a File or a data URL. Returns { photo, cut } where cut says whether the background was removed. */
export async function studio(src) {
  const img = await loadImage(src);
  const s = Math.min(1, 900 / Math.max(img.width, img.height)), W = Math.round(img.width * s), H = Math.round(img.height * s);
  const cv = canvas(W, H), g = cv.getContext("2d", { willReadFrequently: true });
  g.drawImage(img, 0, 0, W, H);
  const id = g.getImageData(0, 0, W, H), d = id.data, N = W * H;
  let alpha = new Float32Array(N), cut = false, bg = null;
  let clear = 0; for (let i = 3; i < d.length; i += 4) if (d[i] < 200) clear++;
  if (clear > N * 0.02) {  // already a cut-out (transparent background)
    for (let i = 0; i < N; i++) alpha[i] = d[i * 4 + 3] / 255;
    cut = true; bg = [235, 235, 235];
  } else {
    const m = autoMask(d, W, H);
    if (m) { alpha = m.alpha; bg = m.bg; cut = true; } else { alpha.fill(1); bg = borderStats(d, W, H).median; }
  }
  correct(d, alpha, bg);
  sharpen(d, W, H);
  for (let i = 0; i < N; i++) d[i * 4 + 3] = Math.round(alpha[i] * 255);
  g.putImageData(id, 0, 0);
  return { photo: compose(cv, alpha, W, H, cut).toDataURL("image/jpeg", 0.86), cut, cutout: cut ? trimCutout(cv, alpha, W, H) : null };
}

/* The piece alone on a transparent background, trimmed and capped at 640px: what outfit boards are built from. */
function trimCutout(cv, alpha, W, H) {
  let x0 = W, y0 = H, x1 = 0, y1 = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (alpha[y * W + x] > 0.15) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1, k = Math.min(1, 640 / Math.max(bw, bh));
  const out = canvas(Math.round(bw * k), Math.round(bh * k));
  out.getContext("2d").drawImage(cv, x0, y0, bw, bh, 0, 0, out.width, out.height);
  return out.toDataURL("image/png");
}

/* ======================= Outfit board =======================
   The whole outfit as one picture: cut-outs stacked like a flat lay (hat, top, bottoms, shoes) with accessories
   beside them, on a soft gradient taken from the outfit's own colours. 1080×1350, ready to save or share. */
const hexRgb = (h) => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ""); const n = m ? parseInt(m[1], 16) : 0x888888; return [n >> 16, (n >> 8) & 255, n & 255]; };
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;

export async function outfitBoard(items, { dark = true } = {}) {
  // items: [{ slot, color, cutout?, photo?, name }]; order and size come from the slot
  const W = 1080, H = 1350, cv = canvas(W, H), g = cv.getContext("2d");
  // backdrop: a tint of the top (or the first piece) fading to soft grey, like a studio sweep
  const key = hexRgb((items.find((i) => i.slot === "top") || items[0] || {}).color);
  const base = dark ? [26, 26, 30] : [236, 236, 238], mid = dark ? [44, 44, 50] : [214, 214, 216];
  const sweep = g.createLinearGradient(0, 0, 0, H);
  sweep.addColorStop(0, rgb(mix(base, key, dark ? 0.38 : 0.45)));
  sweep.addColorStop(0.55, rgb(mix(mid, key, dark ? 0.18 : 0.22)));
  sweep.addColorStop(1, rgb(dark ? [16, 16, 18] : [232, 232, 230]));
  g.fillStyle = sweep; g.fillRect(0, 0, W, H);
  const floor = g.createRadialGradient(W / 2, H * 0.92, 10, W / 2, H * 0.92, W * 0.6);
  floor.addColorStop(0, dark ? "rgba(255,255,255,.06)" : "rgba(255,255,255,.5)"); floor.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = floor; g.fillRect(0, 0, W, H);

  const by = (s) => items.filter((i) => i.slot === s);
  const hat = by("hat")[0], layer = by("layer")[0], top = by("top")[0] || layer, bottom = by("bottom")[0], shoes = by("shoes")[0];
  const side = [...by("extra"), ...by("scent")].slice(0, 3);
  // vertical bands (fractions of the height) for the centre column
  const rows = [hat && ["hat", 0.13], top && ["top", hat ? 0.3 : 0.34], bottom && ["bottom", 0.38], shoes && ["shoes", 0.17]].filter(Boolean);
  const total = rows.reduce((s, r) => s + r[1], 0), usable = H * 0.86, gap = H * 0.012;
  let y = (H - usable) / 2;
  const colW = side.length ? W * 0.62 : W * 0.7, cx = side.length ? W * 0.42 : W / 2;
  const imgs = await Promise.all(items.map(async (it) => [it, await loadPiece(it)]));
  const get = (it) => imgs.find((x) => x[0] === it)?.[1];
  for (const [s, f] of rows) {
    const h = (usable * f) / total - gap, it = s === "hat" ? hat : s === "top" ? top : s === "bottom" ? bottom : shoes;
    const im = get(it);
    if (s === "top" && layer && layer !== top) {  // a layer sits half behind the top, offset to the right
      const li = get(layer); if (li) drawPiece(g, li, layer, cx + colW * 0.12, y, colW * 0.9, h, 0.95);
      drawPiece(g, im, it, cx - colW * 0.08, y + h * 0.04, colW * 0.85, h * 0.96);
    } else drawPiece(g, im, it, cx, y, s === "shoes" ? colW * 0.62 : s === "hat" ? colW * 0.42 : colW, h);
    y += h + gap;
  }
  // accessories down the right-hand side
  side.forEach((it, n) => drawPiece(g, get(it), it, W * 0.83, H * (0.2 + n * 0.22), W * 0.24, H * 0.17));
  return cv.toDataURL("image/jpeg", 0.88);
}

async function loadPiece(it) {
  const src = it.cutout || it.photo;
  if (!src) return null;
  try { return { img: await loadImage(src), cut: !!it.cutout }; } catch { return null; }
}
/* Fit a piece into a box centred on cx, with a soft drop shadow. Pieces without a cut-out sit on a rounded card. */
function drawPiece(g, im, it, cx, y, w, h, alpha = 1) {
  g.save(); g.globalAlpha = alpha;
  g.shadowColor = "rgba(0,0,0,.28)"; g.shadowBlur = 26; g.shadowOffsetY = 10;
  if (im && im.cut) {
    const k = Math.min(w / im.img.width, h / im.img.height), dw = im.img.width * k, dh = im.img.height * k;
    g.drawImage(im.img, cx - dw / 2, y + (h - dh) / 2, dw, dh);
  } else {
    const s = Math.min(w, h) * 0.92, x = cx - s / 2, yy = y + (h - s) / 2;
    g.beginPath(); g.roundRect(x, yy, s, s, 28); g.fillStyle = it?.color || "#888"; g.fill(); g.shadowColor = "transparent";
    if (im) { g.save(); g.beginPath(); g.roundRect(x, yy, s, s, 28); g.clip(); const k = Math.max(s / im.img.width, s / im.img.height);
      g.drawImage(im.img, x + (s - im.img.width * k) / 2, yy + (s - im.img.height * k) / 2, im.img.width * k, im.img.height * k); g.restore(); }
  }
  g.restore();
}

/* Make a cut-out for a piece added before boards existed. Returns null if its background is too busy. */
export async function cutoutFor(src) {
  const r = await studio(src);
  return r.cutout;
}

/* A cut-out copied from iPhone Photos (press and hold the subject → Copy). Safari asks for permission to paste. */
export async function pasteImage() {
  const items = await navigator.clipboard.read();
  for (const it of items) {
    const type = it.types.find((t) => t.startsWith("image/"));
    if (type) { const blob = await it.getType(type); return new File([blob], "cutout.png", { type }); }
  }
  throw new Error("Nothing to paste. In Photos, press and hold the piece, tap Copy, then come back.");
}

/* Ask for one or more photos (camera or camera roll). */
export function pickPhotos({ multiple = false, capture } = {}) {
  return new Promise((resolve) => {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = "image/*"; inp.multiple = multiple;
    if (capture) inp.capture = capture;
    inp.style.display = "none";
    inp.onchange = () => { resolve([...inp.files]); inp.remove(); };
    inp.oncancel = () => { resolve([]); inp.remove(); };
    document.body.append(inp);
    inp.click();
  });
}
