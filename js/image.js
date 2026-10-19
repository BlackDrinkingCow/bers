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
function autoMask(d, W, H) {
  const { median: bg, std } = borderStats(d, W, H);
  if (std > 40) return null;
  const N = W * H, T = Math.max(26, std * 2.6), T2 = T * 2;
  const dist = (i, r, g, b) => Math.hypot(d[i * 4] - r, d[i * 4 + 1] - g, d[i * 4 + 2] - b);
  const isBg = new Uint8Array(N), q = new Int32Array(N);
  let head = 0, tail = 0;
  const seed = (p) => { if (!isBg[p] && dist(p, ...bg) < T2) { isBg[p] = 1; q[tail++] = p; } };
  for (let x = 0; x < W; x++) { seed(x); seed((H - 1) * W + x); }
  for (let y = 0; y < H; y++) { seed(y * W); seed(y * W + W - 1); }
  while (head < tail) {
    const p = q[head++], x = p % W, r = d[p * 4], g = d[p * 4 + 1], b = d[p * 4 + 2];
    for (const n of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W]) {
      if (n < 0 || n >= N || isBg[n]) continue;
      const toBg = dist(n, ...bg);
      // background if close to the background colour, or a gentle step from background next door (lighting falloff, creases)
      if (toBg < T || (toBg < T2 && dist(n, r, g, b) < 9)) { isBg[n] = 1; q[tail++] = n; }
    }
  }
  let fg = 0; for (let i = 0; i < N; i++) fg += !isBg[i];
  if (fg < N * 0.04 || fg > N * 0.93) return null;
  // soft edge: blur the hard mask twice (3×3), which also trims the halo of background colour
  let a = new Float32Array(N); for (let i = 0; i < N; i++) a[i] = isBg[i] ? 0 : 1;
  for (let pass = 0; pass < 2; pass++) a = blur3(a, W, H);
  for (let i = 0; i < N; i++) a[i] = Math.min(1, Math.max(0, (a[i] - 0.25) / 0.6));
  return { alpha: a, bg };
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
  return { photo: compose(cv, alpha, W, H, cut).toDataURL("image/jpeg", 0.86), cut };
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
