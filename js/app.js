// Bers: screens and events. Data lives on the phone (db.js); Claude is only called when you tap something that needs it.
import * as db from "./db.js";
import * as ai from "./ai.js";
import * as wx from "./weather.js";
import { fileToDataUrl, squareAvatar, pickPhotos } from "./image.js";
import { ECLIPSE } from "./scene.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const ymd = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const lc = (s) => (s ? s[0].toLowerCase() + s.slice(1) : s);
const daysAgo = (date) => Math.floor((Date.now() - new Date(date).getTime()) / 864e5);

/* ---------- the crew */
const CREW = {
  chopper: { name: "Chopper", role: "Head stylist · keeper of the Armory", ring: "#e10600", vibe: "Sweet, excitable, gets flustered when you thank him. Practical picks that keep you comfortable all day." },
  guts: { name: "Guts", role: "The Forge · judges your builds", ring: "#8a8a92", vibe: "Few words, no flattery. Scores what you build out of 10 and names the weak link." },
  rogue: { name: "Rogue", role: "The Chronicle · never forgets a fit", ring: "#3fae5a", vibe: "Southern charm with a bite. Remembers every outfit you wear and who saw it, and calls you out when you repeat." },
  blackbeard: { name: "Blackbeard", role: "The Hoard · finds what you're missing", ring: "#3a3a40", vibe: "Greedy and loud. Hunts down the pieces your closet is missing, inside your budget." },
  rossi: { name: "Rossi", role: "The Ride · bike kit only", ring: "#ffd400", vibe: "Inspired by Valentino Rossi. Easygoing and playful, never about safety. Picks your riding kit and what goes in the bag." },
  doflamingo: { name: "Doflamingo", role: "The Dare · when safe is too safe", ring: "#e8408f", vibe: "Theatrical and arrogant. Offers a bold alternative to the safe pick. Fufufu." },
};
const EMBLEM = {
  chopper: '<path d="M13 31 Q12 12 24 11 Q36 12 35 31 Z" fill="#f29bb7"/><rect x="13" y="26" width="22" height="5" fill="#c2577f"/><ellipse cx="24" cy="32" rx="17" ry="4.5" fill="#f29bb7"/><path d="M20 15 L28 23 M28 15 L20 23" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/>',
  guts: '<path d="M24 7 V41 M24 41 L15 31 M24 41 L33 31 M15 15 Q24 25 33 15" fill="none" stroke="#e10600" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>',
  rogue: '<path d="M10 42 Q6 12 24 9 Q42 12 38 42 Q34 32 32 20 Q24 25 16 20 Q14 32 10 42 Z" fill="#6b3a24"/><path d="M21 11 Q15 22 14 38 M27 11 Q33 22 34 38" fill="none" stroke="#f5f5f5" stroke-width="4" stroke-linecap="round"/>',
  blackbeard: '<circle cx="24" cy="20" r="11" fill="#e9e6df"/><rect x="18" y="27" width="12" height="6" rx="2" fill="#e9e6df"/><circle cx="20" cy="19" r="2.8" fill="#111"/><circle cx="28" cy="19" r="2.8" fill="#111"/><path d="M14 30 Q24 48 34 30 Q30 38 24 38 Q18 38 14 30 Z" fill="#1a1a1c" stroke="#555" stroke-width=".8"/>',
  rossi: '<text x="24" y="31" text-anchor="middle" font-size="21" font-weight="900" font-style="italic" fill="#ffd400" stroke="#1a1a1c" stroke-width=".8" font-family="system-ui,sans-serif">46</text>',
  doflamingo: '<path d="M6 21 L42 21 L40 28 Q32 33 26.5 26 L21.5 26 Q16 33 8 28 Z" fill="#1a1a1c" stroke="#e8408f" stroke-width="1.6" stroke-linejoin="round"/><path d="M10 23 L19 23 M29 23 L38 23" stroke="#e8408f" stroke-width="1.4" opacity=".7"/>',
};

const OCCASIONS = {
  work: { label: "Work", preset: "Sales role: store visits and store-manager meetings. Sharp but comfortable for walking all day in the heat." },
  casual: { label: "Casual" },
  social: { label: "Night out" },
  oldmoney: { label: "Old money", preset: "Quiet luxury like The Gentlemen: tonal, natural fabrics, no logos." },
  formal: { label: "Formal" },
  wedding: { label: "Wedding", preset: "Smart, never outshine the groom, no all-white or all-black." },
  ramadan: { label: "Ramadan", preset: "Modest: long sleeves, loose fit, calm colours, iftar-ready." },
  mosque: { label: "Mosque", preset: "Modest: covered shoulders and knees, long trousers, easy-off shoes." },
};
const RIDES = {
  commute: { label: "Commute", note: "Ride to work; work clothes go in the bag." },
  cruise: { label: "Cruise", note: "Relaxed city ride, still full gear." },
  night: { label: "Night", note: "After dark: visibility matters, cooler air." },
  highway: { label: "Highway", note: "Long, fast ride: full coverage, tall boots if owned." },
};
const DAY_SLOTS = ai.DAY_SLOTS, RIDE_SLOTS = ai.RIDE_SLOTS;
// Personal details are typed into the Profile sheet on the phone and never live in the code (the code may be public).
const DEFAULT_ABOUT = "";

/* ---------- state */
const S = { tab: "gear", pieces: [], P: {}, log: [], looks: [], occ: null, ride: "commute", filter: "all", busy: {},
  pick: null, dared: false, rpick: null, forge: [null, null, null, null], verdict: null, chat: [], weather: null, crewPics: {} };

async function loadData() {
  S.pieces = await db.all("pieces");
  S.P = Object.fromEntries(S.pieces.map((p) => [p.id, p]));
  S.log = (await db.all("log")).sort((a, b) => (a.date < b.date ? 1 : -1));
  S.looks = await db.all("looks");
  S.crewPics = await db.kv.get("crewPics", {});
}
async function profile() {
  const p = await db.kv.get("profile", {});
  return { about: p.about || "Not filled in yet.", palette: p.palette ? `${p.palette.name}; suits ${p.palette.good.join(" ")}; avoid near face ${p.palette.avoid.join(" ")}` : "",
    body: (p.body || []).join(" "), sizes: p.sizes || "", raw: p };
}
const historyText = () => S.log.filter((l) => l.kind !== "buy" && l.kind !== "plan").slice(0, 14)
  .map((l) => `${l.date} | ${l.occ || l.kind} | ${l.seenBy || "-"} | ${(l.pieces || []).map((id) => S.P[id]?.name || "?").join(", ")} | ${l.rating || "-"}`).join("\n");

/* ---------- small UI helpers */
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
function toast(msg) {
  $$(".toast").forEach((t) => t.remove());
  const t = document.createElement("div"); t.className = "toast glass"; t.textContent = msg; document.body.append(t);
  setTimeout(() => { t.classList.add("out"); setTimeout(() => t.remove(), 260); }, 2400);
}
let onSheetClose = null;
function sheet(html, { onClose } = {}) {
  onSheetClose = onClose || null;
  $("#layer").innerHTML = `<div class="veil" id="veil"><div class="sheet glass" role="dialog" aria-modal="true"><div class="grab" aria-hidden="true"></div>${html}<button class="btn" id="close">Close</button></div></div>`;
  $("#veil").onclick = (e) => { if (e.target.id === "veil" || e.target.id === "close") dismissSheet(); };
  const sh = $("#layer .sheet");
  dragToDismiss(sh);
  return sh;
}
/* Closing animates out (sheet slides down, veil fades), then the layer is cleared. */
function closeSheet() {
  onSheetClose = null;
  const v = $("#veil");
  if (!v || v.classList.contains("closing")) return;
  v.classList.add("closing");
  setTimeout(() => v.remove(), reduced() ? 160 : 260);
}
function dismissSheet() { const cb = onSheetClose; closeSheet(); cb?.(); }
function dragToDismiss(sh) {
  const grab = sh.querySelector(".grab");
  let y0 = null, dy = 0, t0 = 0;
  grab.onpointerdown = (e) => { y0 = e.clientY; dy = 0; t0 = performance.now(); sh.style.willChange = "transform"; sh.style.transition = "none"; try { grab.setPointerCapture(e.pointerId); } catch {} };
  grab.onpointermove = (e) => { if (y0 === null) return; dy = Math.max(0, e.clientY - y0); sh.style.transform = `translateY(${dy}px)`; };
  grab.onpointerup = grab.onpointercancel = () => {
    if (y0 === null) return;
    const speed = dy / Math.max(1, performance.now() - t0); y0 = null;
    sh.style.transition = ""; sh.style.willChange = "";
    if (dy > 110 || (dy > 30 && speed > 0.6)) dismissSheet(); else sh.style.transform = "";
  };
}
/* Patch the live DOM to match new markup, so elements stay put: classes transition, photos don't reload, nothing replays. */
function morph(a, b) {
  if (a.nodeType !== b.nodeType || a.nodeName !== b.nodeName) { a.replaceWith(b); return; }
  if (a.nodeType !== 1) { if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue; return; }
  for (const { name } of [...a.attributes]) if (!b.hasAttribute(name)) a.removeAttribute(name);
  for (const { name, value } of [...b.attributes]) if (a.getAttribute(name) !== value) a.setAttribute(name, value);
  if ((a.tagName === "INPUT" || a.tagName === "TEXTAREA") && document.activeElement !== a && a.value !== b.value) a.value = b.value;
  const ac = [...a.childNodes], bc = [...b.childNodes];
  bc.forEach((n, i) => (i < ac.length ? morph(ac[i], n) : a.appendChild(n)));
  for (let i = bc.length; i < ac.length; i++) ac[i].remove();
}
/* Count a number up or down to its new value (Forge score). */
const shown = {};  // last value displayed per counter id, so re-renders don't restart the count
function countTo(el, to) {
  const from = shown[el.id] ?? 0;
  if (from === to) return;
  shown[el.id] = to;
  if (reduced()) { el.textContent = `${to}/10`; return; }
  const t0 = performance.now(), d = 400;
  const step = (t) => { const k = Math.min(1, (t - t0) / d), e = 1 - Math.pow(1 - k, 3); el.textContent = `${Math.round(from + (to - from) * e)}/10`; if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}
function fail(e) { console.error(e); toast(e.message || "Something went wrong."); if (e.code === "nokey") openSettings(); }

const avatar = (k, big) => { const pic = S.crewPics[k];
  return `<button class="ava${big ? " big" : ""}" data-crew="${k}" style="--ring:${CREW[k].ring}" aria-label="${CREW[k].name}">${pic
    ? `<img src="${pic}" alt="">` : `<svg viewBox="0 0 48 48" aria-hidden="true">${EMBLEM[k]}</svg>`}</button>`; };
const agent = (k, line, flat) => `<div class="${flat ? "agent flat" : "glass agent"}">${avatar(k)}
  <div><span class="who">${CREW[k].name}</span> <span class="role">${CREW[k].role}</span><p>${esc(line)}</p></div></div>`;
const swatch = (color) => `<svg class="ph" viewBox="0 0 100 100" aria-hidden="true"><rect x="18" y="18" width="64" height="64" rx="16" fill="${esc(color || "#888")}" stroke="var(--steel)"/></svg>`;
const photo = (p, cls = "ph") => (p.photo ? `<img class="${cls}" src="${p.photo}" alt="">` : swatch(p.color));
const mini = (p) => (p ? (p.photo ? `<img src="${p.photo}" alt="${esc(p.name)}">` : `<svg viewBox="0 0 40 40"><rect x="6" y="6" width="28" height="28" rx="7" fill="${esc(p.color)}"/></svg>`) : "");
function pieceBtn(p, mode) {
  const label = mode === "ride" ? p.rslot : p.day ? p.slot + (p.ride ? " · ride" : "") : "ride · " + p.rslot;
  return `<button class="piece${p.wash ? " washing" : ""}" data-id="${p.id}">${photo(p)}<span class="t">${esc(label)}</span><span class="n">${esc(p.name)}</span>${p.wash ? '<span class="wash">In the wash</span>' : ""}</button>`;
}
const busyBtn = (id, label, cls = "btn main") => `<button class="${cls}" id="${id}" ${S.busy[id] ? "disabled" : ""}>${S.busy[id] ? '<span class="spin"></span> Working…' : label}</button>`;
async function busy(id, fn) {
  if (S.busy[id]) return;
  S.busy[id] = true; render();
  try { await fn(); } catch (e) { fail(e); } finally { S.busy[id] = false; render(); }
}
const valid = (ids, pred = () => true) => [...new Set(ids || [])].filter((id) => S.P[id] && !S.P[id].wash && pred(S.P[id]));
async function savePiece(p) { await db.put("pieces", p); S.P[p.id] = p; S.pieces = Object.values(S.P); }

/* ---------- tabs */
const TABS = [
  ["gear", "Gear Up", '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>'],
  ["armory", "Armory", '<path d="M4 7h16M6 7v13h12V7M9 3h6l1 4H8z"/>'],
  ["forge", "Forge", '<path d="M4 15h11l3-4H8zM9 15v5M14 15v5M6 20h11M14 4l2 3"/>'],
  ["chronicle", "Chronicle", '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/>'],
  ["hoard", "Hoard", '<path d="M4 10h16l-1.5 10h-13zM8 10V7a4 4 0 0 1 8 0v3"/>'],
  ["ride", "Ride", '<circle cx="5.5" cy="16" r="3.5"/><circle cx="18.5" cy="16" r="3.5"/><path d="M5.5 16l4-6h5l4 6M9.5 10l2.5 6h2M14 7h3l1.5 3"/>'],
];
const TAB_IDS = TABS.map((t) => t[0]);
// The tab bar is built once; only the current marker and the sliding thumb change.
$("#tabs").innerHTML = '<span class="thumb" aria-hidden="true"></span>' +
  TABS.map(([id, label, ic]) => `<button data-tab="${id}"><svg viewBox="0 0 24 24">${ic}</svg><span>${label}</span></button>`).join("");
function renderTabs() {
  $$("#tabs [data-tab]").forEach((b) => (b.dataset.tab === S.tab ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current")));
  $("#tabs").style.setProperty("--i", TAB_IDS.indexOf(S.tab));
}
function goTab(tab) {
  if (tab === S.tab) return scrollTo({ top: 0, behavior: reduced() ? "auto" : "smooth" });
  document.documentElement.dataset.dir = TAB_IDS.indexOf(tab) > TAB_IDS.indexOf(S.tab) ? "fwd" : "back";
  S.tab = tab; renderTabs();
  let done = false;
  const swap = () => { if (done) return; done = true; scrollTo(0, 0); render({ enter: true }); };
  if (!document.startViewTransition) return swap();
  const vt = document.startViewTransition(swap);
  // Safety net: if the browser isn't drawing frames (backgrounded), switch without the transition.
  setTimeout(() => { if (!done) { swap(); vt.skipTransition?.(); } }, 250);
}
$("#tabs").onclick = (e) => { const b = e.target.closest("[data-tab]"); if (b) goTab(b.dataset.tab); };

/* ======================= GEAR UP ======================= */
const weatherPill = () => S.weather ? `<button class="pill" id="weather">${esc(S.weather.place)} <b>${S.weather.temp}° · ${S.weather.humidity}%</b> · live</button>`
  : S.weatherFailed ? `<button class="pill" id="weather">Weather <b>tap to load</b></button>` : `<span class="pill skel">Loading weather</span>`;
const skelFit = (n = 4) => `<div class="glass fit" aria-busy="true">${'<div class="piece skel"></div>'.repeat(n)}</div>`;
function emptyCloset(mode) {
  const need = mode === "ride" ? "a helmet, a jacket and gloves tagged Ride" : "at least a top, a bottom and shoes";
  return `<div class="glass pad stack"><b>Your Armory needs ${need}.</b><span class="dim">Add photos and Chopper describes each piece. Then the crew can start picking.</span>
    <button class="btn main" id="${mode === "ride" ? "add-ride" : "add"}">Add pieces</button></div>`;
}
function gear() {
  const occ = OCCASIONS[S.occ], pk = S.pick, d = S.dared && pk?.dare;
  const ids = pk ? (d ? pk.darePieces : pk.cur) : [];
  const enough = ["top", "bottom", "shoes"].every((s) => S.pieces.some((p) => p.day && p.slot === s && !p.wash));
  const when = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  return `<section class="screen">
    <div><div class="eyebrow">${when}</div><h1>Gear up</h1></div>
    ${pk ? (d ? agent("doflamingo", "Fufufu… good. Now walk like you meant it.") : agent("chopper", pk.say)) : agent("chopper", enough ? "Tell me the plan, then tap the button. I'll pick from your Armory!" : "Hi! Let's fill your Armory first.")}
    <div class="ctx">${weatherPill()}<span class="pill">Indoors <b>AC ~21°</b></span>${pk?.scent && S.P[pk.scent] ? `<span class="pill">Scent <b>${esc(S.P[pk.scent].name)}</b></span>` : ""}
      ${occ.preset ? `<span class="pill">Preset <b>${esc(occ.label)}</b></span>` : ""}</div>
    <div class="chips">${Object.entries(OCCASIONS).map(([k, o]) => `<button class="chip ${k === S.occ ? "on" : ""}" data-occ="${k}">${o.label}</button>`).join("")}</div>
    ${!enough ? emptyCloset("day") : `
    <div class="glass pad stack">
      <label class="lb">Today's plan<input class="field" id="plan" placeholder="Store visits, then dinner at 8" value="${esc(S.plan || "")}"></label>
      <label class="lb">Who'll see you<input class="field" id="seen" placeholder="Lulu Mushrif manager, Spinneys Al Reem" value="${esc(S.seen || "")}"></label>
      ${busyBtn("go", pk ? "Pick again with this plan" : "Gear me up")}
    </div>`}
    ${(S.busy.go || S.busy.another) && !pk ? skelFit() : ""}
    ${pk ? `
    ${S.busy.go || S.busy.another ? skelFit() : `<div class="glass fit">${ids.filter((id) => S.P[id]).map((id) => pieceBtn(S.P[id])).join("")}</div>`}
    ${pk.repeat ? agent("rogue", pk.repeat) : ""}
    ${pk.layer && S.P[pk.layer] ? `<div class="glass tip">${mini(S.P[pk.layer])}<span><b>AC layer.</b> <span class="dim">${esc(pk.layerTip || "Carry it for the cold malls.")}</span></span></div>` : ""}
    <div class="glass pad"><h2>${d ? "Why the dare works" : "Why this works"}</h2><ul class="why">${(d ? pk.dare.why : pk.why).map((w) => `<li>${esc(w)}</li>`).join("")}</ul></div>
    <div class="actions"><button class="btn main" id="wear">Wear this</button>${busyBtn("another", "Another option", "btn")}
      <button class="btn" id="save-look">Save look</button><button class="btn" id="ask">Ask Chopper</button></div>
    <p class="dim center m0 small">Tap any piece to swap it.</p>
    ${d ? `<button class="btn" id="undare">Back to Chopper's pick</button>` : pk.dare && pk.darePieces.length ? `<div class="glass pad stack" style="border-color:color-mix(in srgb,var(--pink) 45%,var(--edge))">
      ${agent("doflamingo", pk.dare.say, true)}<div class="minis">${pk.darePieces.map((id) => mini(S.P[id])).join("")}</div>
      <button class="btn pink" id="dare">Take the dare</button></div>` : ""}` : ""}
  </section>`;
}
async function runPick(another) {
  const prof = await profile(), key = `pick:${ymd()}:${S.occ}`;
  const avoid = another && S.pick ? [S.pick.cur.map((id) => S.P[id]?.name).join(" + ")] : [];
  const occ = OCCASIONS[S.occ];
  const r = await ai.pickOutfit({ pieces: S.pieces, mode: "day", occasion: occ.label, preset: occ.preset, plan: S.plan, seenBy: S.seen,
    weather: wx.summary(S.weather), history: historyText(), profile: prof, avoid });
  const isDay = (p) => p.day, cur = valid(r.pieces, isDay);
  if (!cur.length) throw new Error("Chopper couldn't build an outfit. Add more pieces?");
  S.pick = { ...r, cur, darePieces: valid(r.dare?.pieces, isDay), layer: valid([r.layer], isDay)[0] || "", scent: valid([r.scent])[0] || "" };
  S.dared = false;
  await db.kv.set(key, S.pick);
  await db.kv.set("dayctx:" + ymd(), { plan: S.plan, seen: S.seen });
}

async function logWear(kind, ids, extra = {}) {
  const id = `${ymd()}-${kind}`, old = await db.get("log", id);
  for (const pid of old?.pieces || []) if (S.P[pid]) await savePiece({ ...S.P[pid], wears: Math.max(0, (S.P[pid].wears || 1) - 1) });
  for (const pid of ids) if (S.P[pid]) await savePiece({ ...S.P[pid], wears: (S.P[pid].wears || 0) + 1, lastWorn: ymd() });
  const entry = { id, date: ymd(), kind, pieces: ids, rating: old?.rating || "", ...extra };
  await db.put("log", entry);
  await loadData();
}

/* ======================= RIDE ======================= */
function ride() {
  const rk = S.rpick, warns = wx.rideWarnings(S.weather);
  const enough = ["helmet", "jacket", "gloves"].every((s) => S.pieces.some((p) => p.ride && p.rslot === s && !p.wash));
  return `<section class="screen">
    <div><div class="eyebrow">Bike kit · only for the bike</div><h1>Ride</h1></div>
    ${agent("rossi", rk ? rk.say : enough ? "Ciao! Where are we riding today?" : "Ciao! First, show me your gear. Helmet, jacket, gloves, eh?")}
    <div class="ctx">${weatherPill()}</div>
    <div class="chips">${Object.entries(RIDES).map(([k, r]) => `<button class="chip ${k === S.ride ? "on" : ""}" data-ride="${k}">${r.label}</button>`).join("")}</div>
    ${warns.length ? `<div class="glass pad warn stack"><b>Ride warning</b>${warns.map((w) => `<div>${esc(w)}</div>`).join("")}</div>` : ""}
    ${!enough ? emptyCloset("ride") : busyBtn("ride-go-pick", rk ? "Pick again" : "Pick my kit")}
    ${S.busy["ride-go-pick"] ? skelFit(5) : ""}
    ${rk && !S.busy["ride-go-pick"] ? `<div class="glass fit">${rk.cur.filter((id) => S.P[id]).map((id) => pieceBtn(S.P[id], "ride")).join("")}
      ${rk.bag.some((id) => S.P[id]) ? `<div class="piece" style="align-content:center"><span class="t">In the bag</span><div class="minis">${rk.bag.map((id) => mini(S.P[id])).join("")}</div>
        <span class="dim small">${rk.bag.filter((id) => S.P[id]).map((id) => esc(S.P[id].name)).join(", ")}</span></div>` : ""}</div>
    <div class="glass pad"><h2>Why this kit</h2><ul class="why">${rk.why.map((w) => `<li>${esc(w)}</li>`).join("")}</ul></div>
    <div class="actions"><button class="btn main" id="ride-go">Ride in this</button><button class="btn" id="ride-check">Pre-ride check</button></div>` : ""}
    <div class="actions"><button class="btn" id="add-ride">+ Add ride gear</button><button class="btn" id="ride-locker">Ride gear · ${S.pieces.filter((p) => p.ride).length}</button></div>
    <p class="dim m0 small">Ride gear lives in the Armory, tagged Ride. Rossi only counts armoured kit as protection. Tap a piece to swap it or send it to the wash.</p>
  </section>`;
}
async function runRide() {
  const prof = await profile();
  const r = await ai.pickOutfit({ pieces: S.pieces, mode: "ride", occasion: `${RIDES[S.ride].label}: ${RIDES[S.ride].note}`,
    weather: wx.summary(S.weather) + (wx.rideWarnings(S.weather).length ? ". Warnings: " + wx.rideWarnings(S.weather).join(" ") : ""), history: historyText(), profile: prof });
  const cur = valid(r.pieces, (p) => p.ride);
  if (!cur.length) throw new Error("Rossi couldn't build a kit. Tag more gear as Ride?");
  S.rpick = { ...r, cur, bag: valid(r.bag, (p) => p.day) };
  await db.kv.set(`ride:${ymd()}:${S.ride}`, S.rpick);
}

/* ======================= ARMORY ======================= */
const isUnworn = (p) => p.day && (p.lastWorn ? daysAgo(p.lastWorn) > 90 : daysAgo(p.addedAt || ymd()) > 30);
function armory() {
  const f = S.filter, slots = ["all", ...DAY_SLOTS, "ride", "wash"];
  const list = S.pieces.filter((p) => f === "all" || (p.day && p.slot === f) || (f === "ride" && p.ride) || (f === "wash" && p.wash))
    .sort((a, b) => (a.addedAt < b.addedAt ? 1 : -1));
  const unworn = S.pieces.filter(isUnworn), since = S.sinceBackup || 0;
  return `<section class="screen">
    <div><div class="eyebrow">${S.pieces.length} pieces</div><h1>Armory</h1></div>
    ${agent("chopper", S.pieces.length ? "Everything you own lives here. Tap a piece to edit it, or hit + to show me something new!" : "It's empty in here! Hit + and pick a few photos from your camera roll.")}
    ${since >= 10 ? `<button class="glass tip warn" id="backup-nudge"><span style="font-size:28px;text-align:center">⤓</span><span><b>${since} new pieces since your last backup.</b> <span class="dim">Tap to save a backup to iCloud Drive.</span></span></button>` : ""}
    ${unworn.length ? `<button class="glass tip" id="unworn">${mini(unworn[0])}<span><b>${unworn.length} piece${unworn.length > 1 ? "s" : ""} not worn in a long time.</b> <span class="dim">Wear, sell or donate?</span></span></button>` : ""}
    <div class="chips">${slots.map((s) => `<button class="chip ${s === f ? "on" : ""}" data-filter="${s}">${s === "all" ? "Everything" : s === "wash" ? `In the wash · ${S.pieces.filter((p) => p.wash).length}` : s[0].toUpperCase() + s.slice(1)}</button>`).join("")}</div>
    <div class="grid"><button class="add" id="add"><span>+</span>Add pieces</button>${list.map((p) => pieceBtn(p)).join("")}</div>
  </section>`;
}

const slotSelect = (id, val, opts, none) => `<select class="field" id="${id}">${none ? `<option value="none" ${!val || val === "none" ? "selected" : ""}>${none}</option>` : ""}
  ${opts.map((o) => `<option ${o === val ? "selected" : ""}>${o}</option>`).join("")}</select>`;
function pieceForm(p) {
  return `<label class="lb">Name<input class="field" id="f-name" value="${esc(p.name)}"></label>
    <div class="two"><label class="lb">Everyday type${slotSelect("f-slot", p.slot, DAY_SLOTS, "Not everyday")}</label>
      <label class="lb">Ride type${slotSelect("f-rslot", p.rslot, RIDE_SLOTS, "Not for riding")}</label></div>
    <div class="eyebrow">Use it for</div>
    <div class="ctx"><button class="chip ${p.day ? "on" : ""}" data-use="day">Everyday outfits</button><button class="chip ${p.ride ? "on" : ""}" data-use="ride">Ride · Rossi's kit</button>
      <button class="chip ${p.armour ? "on" : ""}" data-use="armour">Armoured</button></div>
    <div class="two"><label class="lb">Paid (AED)<input class="field" id="f-price" inputmode="decimal" value="${esc(p.price ?? "")}" placeholder="120"></label>
      <label class="lb">Colour<input class="field" id="f-color" type="color" value="${esc(/^#[0-9a-f]{6}$/i.test(p.color) ? p.color : "#888888")}" style="height:50px;padding:6px"></label></div>
    <label class="lb">Tags<input class="field" id="f-tags" value="${esc((p.tags || []).join(", "))}" placeholder="work, smart"></label>
    <label class="lb">Fabric · fit · formality 1–5<input class="field" id="f-fab" value="${esc([p.fabric, p.fit, p.formality].filter((x) => x !== undefined && x !== "").join(" · "))}"></label>`;
}
function readForm(p) {
  const v = (id) => $("#" + id).value.trim();
  const [fabric, fit, formality] = v("f-fab").split("·").map((s) => s.trim());
  const on = (k) => $(`#layer [data-use="${k}"]`).classList.contains("on");
  const slot = v("f-slot"), rslot = v("f-rslot");
  return { ...p, name: v("f-name") || "Unnamed piece", slot: slot === "none" ? null : slot, rslot: rslot === "none" ? null : rslot,
    day: on("day") && slot !== "none", ride: on("ride") && rslot !== "none", armour: on("armour"),
    price: v("f-price") ? +v("f-price") : null, color: v("f-color"), tags: v("f-tags").split(",").map((s) => s.trim()).filter(Boolean),
    fabric: fabric || "", fit: fit || "", formality: +formality || p.formality || 3 };
}
function bindUseChips() {
  $$("#layer [data-use]").forEach((c) => (c.onclick = () => {
    c.classList.toggle("on");
    if (c.dataset.use === "ride" && c.classList.contains("on") && !$('#layer [data-use="armour"]').classList.contains("on") && ["jacket", "pants", "boots", "gloves"].includes($("#f-rslot").value))
      toast("Rossi: fine for short rides, but it's not protection");
  }));
}

/* Add pieces: pick photos, Chopper describes each, you review and save, one by one. */
async function addPieces({ ride = false, hint = "", price = null } = {}) {
  const files = await pickPhotos({ multiple: !hint });
  if (!files.length) return;
  let added = 0;
  for (let i = 0; i < files.length; i++) {
    sheet(`<div class="loading"><span class="spin"></span>Chopper is looking at photo ${i + 1} of ${files.length}…</div>`);
    let ph, d = {};
    try { ph = await fileToDataUrl(files[i]); } catch (e) { toast(e.message); continue; }
    try { d = await ai.describePiece(ph, hint); }
    catch (e) { toast(e.code === "nokey" ? "No API key yet: fill it in yourself, or add your key in Settings." : e.message); }
    const p = { id: db.uid(), photo: ph, addedAt: ymd(), wears: 0, wash: false, price,
      name: d.name || hint || "", slot: DAY_SLOTS.includes(d.slot) ? d.slot : null, rslot: RIDE_SLOTS.includes(d.rslot) ? d.rslot : null,
      color: d.color || "#888888", fabric: d.fabric || "", fit: d.fit || "", formality: d.formality || 3, season: d.season || "", tags: d.tags || [], note: d.note || "",
      armour: !!d.armour };
    p.day = !!p.slot && !(ride && !d.slot);
    p.ride = !!p.rslot && (ride || !!d.ride);
    const saved = await new Promise((resolve) => {
      sheet(`<div class="eyebrow">Piece ${i + 1} of ${files.length}</div><img class="big-photo" src="${ph}" alt="">
        ${p.note ? agent("chopper", p.note, true) : ""}${pieceForm(p)}
        <div class="actions"><button class="btn main" id="f-save">Save to Armory</button><button class="btn" id="f-skip">Skip</button></div>`, { onClose: () => resolve(null) });
      bindUseChips();
      $("#f-save").onclick = () => resolve(readForm(p));
      $("#f-skip").onclick = () => resolve(false);
    });
    if (saved === null) break;
    if (saved) { await savePiece(saved); added++; }
  }
  closeSheet();
  if (added) {
    S.sinceBackup = (S.sinceBackup || 0) + added; await db.kv.set("sinceBackup", S.sinceBackup);
    await loadData(); render(); toast(`${added} piece${added > 1 ? "s" : ""} added`);
  }
  return added;
}

function openPiece(p) {
  const cpw = p.price ? Math.round(p.price / Math.max(1, p.wears || 0)) : null;
  sheet(`${p.photo ? `<img class="big-photo" src="${p.photo}" alt="">` : ""}<h2 class="m0">${esc(p.name)}</h2>
    <div class="ctx"><span class="pill">Worn <b>${p.wears || 0}×</b></span>${p.lastWorn ? `<span class="pill">Last <b>${p.lastWorn}</b></span>` : ""}
      ${p.price ? `<span class="pill">Paid <b>AED ${p.price}</b></span><span class="pill">Cost per wear <b>AED ${cpw}</b></span>` : ""}</div>
    ${p.note ? agent("chopper", p.note, true) : ""}
    <button class="btn ${p.wash ? "" : "main"}" id="p-wash">${p.wash ? "Back in the closet" : "Put in the wash"}</button>
    ${pieceForm(p)}
    <div class="actions"><button class="btn main" id="p-save">Save changes</button><button class="btn" id="p-del">Delete</button></div>`);
  bindUseChips();
  $("#p-wash").onclick = async () => { await savePiece({ ...p, wash: !p.wash }); S.pick = S.pick; closeSheet(); render(); toast(p.wash ? "Back in the Armory" : "In the wash"); };
  $("#p-save").onclick = async () => { await savePiece(readForm(p)); closeSheet(); render(); toast("Saved"); };
  $("#p-del").onclick = async () => {
    if (!confirm(`Delete ${p.name}? This can't be undone, unless you have a backup.`)) return;
    await db.del("pieces", p.id); await loadData(); closeSheet(); render(); toast("Deleted");
  };
}

/* ======================= FORGE ======================= */
const FORGE_SLOTS = ["top", "bottom", "shoes", "extra"];
function forge() {
  const v = S.verdict;
  return `<section class="screen">
    <div><div class="eyebrow">Build your own</div><h1>Forge</h1></div>
    ${agent("guts", v ? v.say : "Build it. I'll tell you if it holds.")}
    <div class="slots">${FORGE_SLOTS.map((s, n) => { const p = S.P[S.forge[n]];
      return `<button class="slot glass" data-fslot="${n}">${p ? (p.photo ? `<img src="${p.photo}" alt="">` : `<span class="empty">${mini(p)}</span>`) : `<span class="empty">+</span>`}
        <span><span class="eyebrow">${s}</span><br><b>${p ? esc(p.name) : "Choose"}</b></span><span class="arrow">change ›</span></button>`; }).join("")}</div>
    ${v ? `<div class="glass pad"><div class="score"><span class="num" id="guts-score" data-count="${v.score}">${shown["guts-score"] ?? 0}/10</span><span class="dim">Guts' verdict</span></div><ul class="why">${v.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul></div>` : ""}
    ${busyBtn("judge", "Ask Guts")}
    <div class="actions"><button class="btn" id="forge-save">Save to looks</button><button class="btn" id="forge-plan">Plan for a day</button></div>
    ${busyBtn("fitcheck", "Fit check · mirror selfie", "btn")}
    <p class="dim m0 small">Fit check sends that one photo to Claude when you tap it. It isn't stored.</p>
  </section>`;
}
function choosePiece(title, list, cb, mode) {
  sheet(`<div class="eyebrow">${esc(title)}</div><div class="grid">${list.map((p) => pieceBtn(p, mode)).join("") || '<span class="dim">Nothing to choose from yet.</span>'}</div>`);
  $("#layer .grid").onclick = (e) => { const b = e.target.closest(".piece"); if (b) { closeSheet(); cb(S.P[b.dataset.id]); } };
}

/* ======================= CHRONICLE ======================= */
function rogueLine() {
  const recent = S.log.filter((l) => l.kind === "day" && daysAgo(l.date) <= 14);
  const count = {};
  recent.forEach((l) => l.pieces.forEach((id) => (count[id] = (count[id] || 0) + 1)));
  const top = Object.entries(count).sort((a, b) => b[1] - a[1])[0];
  const unworn = S.pieces.filter(isUnworn);
  if (!S.log.length) return "Nothin' logged yet, sugah. Tap Wear this on Gear Up and I'll start rememberin'.";
  let s = top && top[1] >= 3 && S.P[top[0]] ? `That ${lc(S.P[top[0]].name)}'s been out ${top[1]} times in two weeks. Give it a rest, sugah.` : "Your rotation's lookin' healthy, sugah.";
  if (unworn.length) s += ` And ${unworn.length === 1 ? `that ${lc(unworn[0].name)} ain't` : `${unworn.length} pieces ain't`} left the closet in ages.`;
  return s;
}
function chronicle() {
  const days = [];
  for (let i = -6; i <= 7; i++) { const d = new Date(); d.setDate(d.getDate() + i); days.push(ymd(d)); }
  const byDate = {}; S.log.forEach((l) => { if (l.kind !== "buy") (byDate[l.date] = byDate[l.date] || []).push(l); });
  const RATES = ["Loved it", "Fine", "Not again", "Got compliments"];
  return `<section class="screen">
    <div><div class="eyebrow">Two weeks around today</div><h1>Chronicle</h1></div>
    ${agent("rogue", rogueLine())}
    <button class="btn main" id="trip">Plan a trip · packing list</button>
    <div class="week">${days.filter((d) => byDate[d] || d >= ymd()).map((d) => {
      const dt = new Date(d + "T12:00"), isToday = d === ymd(), entries = byDate[d] || [];
      return `<div class="glass day ${isToday ? "today" : ""}"><div class="d">${dt.getDate()}<small>${dt.toLocaleDateString("en-GB", { weekday: "short" })}</small></div>
        <div class="what">${entries.length ? entries.map((l) => `<div style="margin-bottom:6px">
          <span class="tag ${isToday ? "red" : ""}">${l.kind === "plan" ? "Planned" : l.kind === "ride" ? "Ride" : "Worn"}</span> <b>${esc(OCCASIONS[l.occ]?.label || RIDES[l.occ]?.label || l.occ || "")}</b>
          <div class="minis">${l.pieces.map((id) => mini(S.P[id])).join("")}</div>
          ${l.seenBy ? `<div class="dim small">Seen by: ${esc(l.seenBy)}</div>` : ""}
          ${l.kind !== "plan" ? `<div class="ctx" style="margin-top:6px">${RATES.map((r) => `<button class="chip sm ${l.rating === r ? "on" : ""}" data-rate="${l.id}|${r}">${r}</button>`).join("")}</div>` : ""}
        </div>`).join("") : `<span class="dim">${d < ymd() ? "Nothing logged" : isToday ? "Nothing yet today" : "Open"}</span>`}</div></div>`; }).join("")}</div>
    ${S.looks.length ? `<h2 class="m0">Saved looks</h2><div class="stack">${S.looks.map((l) => `<div class="glass pad"><div class="row"><b>${esc(l.name)}</b><button class="tag" data-dellook="${l.id}">Remove</button></div>
      <div class="minis">${l.pieces.map((id) => mini(S.P[id])).join("")}</div></div>`).join("")}</div>` : ""}
    <p class="dim m0 small">Ratings teach the crew your taste. "Seen by" stops repeats in front of the same people.</p>
  </section>`;
}

/* ======================= HOARD ======================= */
function hoard() {
  const g = S.gaps, m = ymd().slice(0, 7);
  const spent = S.log.filter((l) => l.kind === "buy" && l.date.startsWith(m)).reduce((a, l) => a + (l.price || 0), 0), budget = S.budgetMonth || 600;
  return `<section class="screen">
    <div><div class="eyebrow">Gaps in your closet · under AED ${S.budgetItem || 200} each</div><h1>Hoard</h1></div>
    <div class="glass pad stack"><div class="row"><b>${new Date().toLocaleDateString("en-GB", { month: "long" })} budget</b><span><b>AED ${spent}</b> <span class="dim">of ${budget}</span></span></div>
      <div class="bar"><i style="--v:${Math.min(1, spent / budget).toFixed(3)}"></i></div>
      <span class="dim small">Logged when you tap Bought it. Change the budget in Settings.</span></div>
    ${agent("blackbeard", g ? g.say : "Zehahaha! Let me dig through your closet for holes.")}
    ${busyBtn("gaps", g ? "Look again" : "Find what's missing")}
    ${S.busy.gaps ? '<div class="glass pad skel" style="min-height:120px"></div>'.repeat(3) : ""}
    ${g && !S.busy.gaps ? g.gaps.map((x, n) => `<div class="glass pad gap"><div class="sw" style="background:${esc(x.color)};border-radius:14px"></div><div>
      <b>${esc(x.name)}</b> <span class="price">${esc(x.price)}</span><div class="dim">${esc(x.why)}</div>
      <div class="ctx" style="margin-top:8px">${x.shops.map((s) => `<span class="tag">${esc(s)}</span>`).join("")}${x.size ? `<span class="tag">Your size: ${esc(x.size)}</span>` : ""}</div>
      <div class="ctx" style="margin-top:10px"><a class="btn sm" target="_blank" rel="noopener" href="https://www.google.com/search?tbm=shop&q=${encodeURIComponent(x.name + " UAE")}">Search prices</a>
        <button class="btn sm" data-buy="${n}">Bought it → Armory</button></div></div></div>`).join("") : ""}
    <p class="dim m0 small">Prices are Blackbeard's estimates. Check the shop before you buy.</p>
  </section>`;
}

/* ======================= render + events ======================= */
/* enter: a new tab, so build it fresh and play the entrance. Otherwise patch the screen in place. */
let enterTimer = 0;
function render({ enter = false } = {}) {
  renderTabs();
  const view = $("#view"), html = { gear, armory, forge, chronicle, hoard, ride }[S.tab]();
  if (enter || !view.firstElementChild) {
    view.innerHTML = html;
    view.classList.add("enter"); clearTimeout(enterTimer);
    enterTimer = setTimeout(() => view.classList.remove("enter"), 700);
  } else {
    const tpl = document.createElement("template"); tpl.innerHTML = html;
    if (view.childNodes.length === tpl.content.childNodes.length) [...tpl.content.childNodes].forEach((n, i) => morph(view.childNodes[i], n));
    else view.replaceChildren(tpl.content);
  }
  $$("[data-count]", view).forEach((el) => countTo(el, +el.dataset.count));
}

$("#view").addEventListener("input", (e) => { if (e.target.id === "plan") S.plan = e.target.value; if (e.target.id === "seen") S.seen = e.target.value; });
$("#view").addEventListener("click", async (e) => {
  const t = e.target.closest("button, a"); if (!t || t.tagName === "A") return;
  const ds = t.dataset;
  if (ds.crew) return crewSheet(ds.crew);
  if (ds.occ) { S.occ = ds.occ; S.pick = await db.kv.get(`pick:${ymd()}:${S.occ}`, null); S.dared = false; return render(); }
  if (ds.ride) { S.ride = ds.ride; S.rpick = await db.kv.get(`ride:${ymd()}:${S.ride}`, null); return render(); }
  if (ds.filter) { S.filter = ds.filter; return render(); }
  if (ds.fslot) {
    const n = +ds.fslot, slot = FORGE_SLOTS[n];
    return choosePiece(`Choose ${slot}`, S.pieces.filter((p) => p.day && !p.wash && (p.slot === slot || (slot === "top" && p.slot === "layer") || (slot === "extra" && p.slot === "scent"))),
      (p) => { S.forge[n] = p.id; S.verdict = null; render(); });
  }
  if (ds.rate) {
    const [id, r] = ds.rate.split("|"), l = await db.get("log", id);
    l.rating = l.rating === r ? "" : r; await db.put("log", l); await loadData(); render(); return toast("Rogue: noted, sugah");
  }
  if (ds.dellook) { await db.del("looks", ds.dellook); await loadData(); return render(); }
  if (ds.buy) return boughtIt(S.gaps.gaps[+ds.buy]);
  if (t.classList.contains("piece") && ds.id) {
    const p = S.P[ds.id];
    if (S.tab === "gear") {
      const list = S.pieces.filter((x) => x.day && !x.wash && x.slot === p.slot && x.id !== p.id);
      return choosePiece(`Instead of ${p.name}`, list, (n) => { const arr = S.dared ? S.pick.darePieces : S.pick.cur; arr[arr.indexOf(p.id)] = n.id; render(); toast("Swapped"); });
    }
    if (S.tab === "ride") {
      const list = S.pieces.filter((x) => x.ride && !x.wash && x.rslot === p.rslot && x.id !== p.id);
      choosePiece(`Instead of ${p.name}`, list, (n) => { S.rpick.cur[S.rpick.cur.indexOf(p.id)] = n.id; render(); toast("Swapped"); }, "ride");
      $("#layer .sheet").insertAdjacentHTML("afterbegin", `<button class="btn" id="r-wash">Put the ${esc(lc(p.name))} in the wash</button>`);
      $("#r-wash").onclick = async () => { await savePiece({ ...p, wash: true }); S.rpick.cur = S.rpick.cur.filter((x) => x !== p.id); closeSheet(); render(); toast("In the wash. Pick again for a swap"); };
      return;
    }
    return openPiece(p);
  }
  const acts = {
    weather: () => weatherSheet(),
    go: () => busy("go", () => runPick(false)),
    another: () => busy("another", () => runPick(true)),
    dare: () => { S.dared = true; render(); scrollTo({ top: 0, behavior: "smooth" }); toast("Fufufu. Bold choice."); },
    undare: () => { S.dared = false; render(); },
    wear: async () => {
      const ids = S.dared ? S.pick.darePieces : S.pick.cur;
      await logWear("day", ids, { occ: S.occ, seenBy: S.seen || "", plan: S.plan || "" }); render(); toast("Logged in the Chronicle");
    },
    "save-look": () => saveLook(S.dared ? S.pick.darePieces : S.pick.cur),
    ask: () => chatSheet(),
    add: () => addPieces(),
    "add-ride": () => addPieces({ ride: true }),
    "ride-locker": () => { S.filter = "ride"; goTab("armory"); },
    "ride-go-pick": () => busy("ride-go-pick", runRide),
    "ride-go": () => afterRide(),
    "ride-check": () => sheet(`<div class="eyebrow">Rossi's pre-ride check</div><h2>Before you go</h2>
      <ol class="steps"><li>Visor clean. Tinted by day, clear after dark.</li><li>Every zip and wrist strap closed.</li>
      <li>Armour in place: shoulders, elbows, back, knees.</li><li>Boots laced, no loose laces near the chain.</li><li>Water, if it's over 30°.</li><li>Tyres and chain: a quick look.</li></ol>`),
    unworn: () => { const list = S.pieces.filter(isUnworn); choosePiece("Not worn in a long time · tap to edit", list, openPiece); },
    "backup-nudge": () => doBackup(),
    judge: () => busy("judge", async () => {
      const ps = S.forge.map((id) => S.P[id]).filter(Boolean);
      if (ps.length < 2) throw new Error("Pick at least two pieces first.");
      S.verdict = await ai.judge(ps);
    }),
    fitcheck: () => fitCheck(),
    "forge-save": () => saveLook(S.forge.filter(Boolean)),
    "forge-plan": () => planDay(S.forge.filter(Boolean)),
    trip: () => tripSheet(),
    gaps: () => busy("gaps", async () => {
      const prof = await profile();
      S.gaps = await ai.findGaps({ pieces: S.pieces, profile: prof, budget: S.budgetItem || 200 });
      await db.kv.set("gaps", S.gaps);
    }),
  };
  if (acts[t.id]) acts[t.id]();
});

/* ---------- sheets */
async function weatherSheet() {
  try { S.weather = await wx.today(); } catch { return toast("Couldn't load the weather. Check your internet."); }
  const w = S.weather;
  sheet(`<div class="eyebrow">Live weather · ${esc(w.place)}</div><h2>${w.temp}°, ${esc(w.desc)}</h2>
    <div class="ctx">${w.hours.filter((h) => h.hour >= 7 && h.hour <= 22 && h.hour % 3 === 1).map((h) => `<span class="pill">${h.hour}:00 <b>${h.temp}°</b></span>`).join("")}
      <span class="pill">Humidity <b>${w.humidity}%</b></span><span class="pill">Wind <b>${w.wind} km/h</b></span></div>
    <p class="dim m0">From Open-Meteo, free and keyless. Change your city in Settings.</p>`);
  render();
}

async function afterRide() {
  const ids = [...S.rpick.cur, ...S.rpick.bag];
  await logWear("ride", ids, { occ: S.ride });
  const washable = ids.filter((id) => S.P[id]?.rslot !== "helmet");
  sheet(`<div class="eyebrow">Rossi · after the ride</div><h2>Anything for the wash?</h2>
    <p class="m0">Bike gear gets dirty fast. Tap what needs washing.</p>
    <div class="ctx" id="wl">${washable.map((id) => `<button class="chip" data-w="${id}">${esc(S.P[id].name)}</button>`).join("")}</div>
    <button class="btn main" id="wash-go">Done</button>`);
  $("#wl").onclick = (e) => { const c = e.target.closest("[data-w]"); if (c) c.classList.toggle("on"); };
  $("#wash-go").onclick = async () => {
    const sel = $$("#wl .on").map((c) => c.dataset.w);
    for (const id of sel) await savePiece({ ...S.P[id], wash: true });
    closeSheet(); render(); toast(sel.length ? `Buon viaggio! ${sel.length} in the wash` : "Buon viaggio!");
  };
}

function saveLook(ids) {
  if (!ids.length) return toast("Nothing to save yet.");
  sheet(`<div class="eyebrow">Save look</div><div class="minis">${ids.map((id) => mini(S.P[id])).join("")}</div>
    <label class="lb">Name<input class="field" id="look-name" placeholder="Monday store visits"></label><button class="btn main" id="look-go">Save</button>`);
  $("#look-go").onclick = async () => { await db.put("looks", { id: db.uid(), name: $("#look-name").value.trim() || "Saved look", pieces: ids }); await loadData(); closeSheet(); toast("Saved to your looks"); };
}

function planDay(ids) {
  if (!ids.length) return toast("Build something first.");
  const tmr = new Date(); tmr.setDate(tmr.getDate() + 1);
  sheet(`<div class="eyebrow">Plan for a day</div><div class="minis">${ids.map((id) => mini(S.P[id])).join("")}</div>
    <label class="lb">Day<input class="field" type="date" id="plan-date" value="${ymd(tmr)}"></label>
    <label class="lb">Occasion${slotSelect("plan-occ", "work", Object.keys(OCCASIONS))}</label><button class="btn main" id="plan-go">Plan it</button>`);
  $("#plan-go").onclick = async () => {
    const date = $("#plan-date").value;
    await db.put("log", { id: `${date}-plan`, date, kind: "plan", occ: $("#plan-occ").value, pieces: ids });
    await loadData(); closeSheet(); render(); toast("In the Chronicle");
  };
}

function chatSheet() {
  // The sheet opens once; new messages are drawn inside it (no slide-in replay per message).
  const box = sheet(`<div class="eyebrow">Chat</div><h2 class="m0">Ask Chopper</h2><div class="stack" id="msgs"></div>
    <div class="two" style="grid-template-columns:1fr auto"><input class="field" id="q" placeholder="Make it more formal, I have a meeting at 3"><button class="btn main" id="q-go">Ask</button></div>`);
  const draw = () => {
    $("#msgs").innerHTML = S.chat.map((m) => m.text === "…" ? '<div class="bubble ai skel" style="width:60%">…</div>'
      : `<div class="bubble ${m.who === "Him" ? "me" : "ai"}">${esc(m.text)}</div>`).join("");
    box.scrollTop = box.scrollHeight;
  };
  const send = async () => {
    const q = $("#q").value.trim(); if (!q) return;
    $("#q").value = "";
    S.chat.push({ who: "Him", text: q }); S.chat.push({ who: "Chopper", text: "…" }); draw();
    try {
      const ans = await ai.askChopper({ question: q, outfit: (S.dared ? S.pick.darePieces : S.pick.cur).map((id) => S.P[id]), pieces: S.pieces, profile: await profile(), history: S.chat.slice(-8, -2) });
      S.chat[S.chat.length - 1].text = ans;
    } catch (e) { S.chat.pop(); S.chat.pop(); fail(e); }
    if ($("#msgs")) draw();
  };
  $("#q-go").onclick = send; $("#q").onkeydown = (e) => { if (e.key === "Enter") send(); };
  draw();
}

async function fitCheck() {
  const [f] = await pickPhotos({ capture: "user" });
  if (!f) return;
  await busy("fitcheck", async () => {
    const r = await ai.fitCheck(await fileToDataUrl(f, 1024));
    sheet(`<div class="eyebrow">Guts · fit check</div>${agent("guts", r.say, true)}<div class="score"><span class="num">${r.score}/10</span></div>
      <ul class="why">${r.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>`);
  });
}

function tripSheet() {
  sheet(`<div class="eyebrow">Chopper · packing</div><h2 class="m0">Plan a trip</h2>
    <div class="two"><label class="lb">Where<input class="field" id="t-place" placeholder="Beirut"></label><label class="lb">Days<input class="field" id="t-days" inputmode="numeric" value="5"></label></div>
    <label class="lb">Plans<input class="field" id="t-plans" placeholder="Family, two dinners, a wedding"></label>
    <button class="btn main" id="t-go">Pack for me</button><div id="t-out"></div>`);
  $("#t-go").onclick = async () => {
    const place = $("#t-place").value.trim(), days = Math.max(1, +$("#t-days").value || 3);
    if (!place) return toast("Where are you going?");
    $("#t-out").innerHTML = '<div class="loading"><span class="spin"></span>Checking the weather there and packing…</div>';
    try {
      let forecast = "";
      try { forecast = await wx.forecastFor(await wx.geocode(place), days); } catch {}
      const r = await ai.packTrip({ pieces: S.pieces, place, days, plans: $("#t-plans").value.trim(), weather: forecast, profile: await profile() });
      const ids = valid(r.pieces, (p) => p.day);
      $("#t-out").innerHTML = `<div class="stack">${agent("chopper", r.say, true)}<div class="grid">${ids.map((id) => pieceBtn(S.P[id])).join("")}</div>
        <ul class="why">${r.notes.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>${forecast ? `<p class="dim small m0">Forecast: ${esc(forecast)}</p>` : ""}</div>`;
    } catch (e) { $("#t-out").innerHTML = ""; fail(e); }
  };
}

function boughtIt(g) {
  sheet(`<div class="eyebrow">Blackbeard · into the Armory</div><h2 class="m0">${esc(g.name)}</h2>
    <label class="lb">What did you pay (AED)?<input class="field" id="b-price" inputmode="decimal" placeholder="180"></label>
    <ol class="steps"><li>Snap a photo of it, or use the shop's photo.</li><li>Chopper describes it like any new piece.</li><li>It counts toward this month's budget.</li></ol>
    <button class="btn main" id="b-go">Add photo</button>`);
  $("#b-go").onclick = async () => {
    const price = +$("#b-price").value || 0;
    const n = await addPieces({ hint: g.name, price });
    if (n) {
      await db.put("log", { id: db.uid(), date: ymd(), kind: "buy", name: g.name, price, pieces: [] });
      S.gaps.gaps = S.gaps.gaps.filter((x) => x !== g); await db.kv.set("gaps", S.gaps);
      await loadData(); render(); toast("Zehahaha! It's in the Armory");
    }
  };
}

function crewSheet(k) {
  const c = CREW[k];
  sheet(`${avatar(k, true)}<div class="center"><h2 class="m0">${c.name}</h2><div class="dim">${c.role}</div></div><p class="m0">${c.vibe}</p>
    <div class="actions"><button class="btn main" id="pic-set">Use my own picture</button><button class="btn" id="pic-reset">Reset to emblem</button></div>
    <p class="dim m0 small">Pick any image from your camera roll. It's cropped to a circle and stays on your phone.</p>`);
  const set = async (v) => { if (v) S.crewPics[k] = v; else delete S.crewPics[k]; await db.kv.set("crewPics", S.crewPics); closeSheet(); render(); };
  $("#pic-set").onclick = async () => { const [f] = await pickPhotos(); if (f) set(await squareAvatar(f)); };
  $("#pic-reset").onclick = () => set(null);
}

/* ---------- background picture: "eclipse" (default), "photo" (your own, kept on the phone) or "none" */
async function applyBackground() {
  const mode = await db.kv.get("bgMode", "eclipse"), pic = mode === "photo" ? await db.kv.get("bgPic", null) : null;
  const el = $("#bg");
  el.className = pic ? "photo" : "";
  el.innerHTML = mode === "eclipse" ? ECLIPSE : pic ? `<img src="${pic}" alt="">` : "";
  document.documentElement.style.setProperty("--bg-o", await db.kv.get("bgStrength", 0.9));
}

/* ---------- backup */
async function doBackup() {
  const blob = await db.exportBackup(), name = `bers-backup-${ymd()}.json`;
  const file = new File([blob], name, { type: "application/json" });
  const download = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000); };
  try {
    // On iPhone the share sheet has "Save to Files", which is the easy way into iCloud Drive.
    if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: "Bers backup" });
    else download();
  } catch (e) {
    if (e.name === "AbortError") return;
    if (e.name === "NotAllowedError") download(); else throw e;
  }
  await db.kv.set("lastBackup", new Date().toISOString()); S.sinceBackup = 0; await db.kv.set("sinceBackup", 0);
  toast("Backup saved. Keep it in iCloud Drive"); render();
}
async function doRestore() {
  const inp = document.createElement("input"); inp.type = "file"; inp.accept = "application/json,.json";
  inp.onchange = async () => {
    const f = inp.files[0]; if (!f) return;
    if (!confirm("Restore replaces everything in Bers on this phone with the backup. Continue?")) return;
    try { const n = await db.importBackup(f); await boot(); toast(`Restored ${n} pieces`); } catch (e) { fail(e); }
  };
  inp.click();
}

/* ---------- settings */
async function openSettings() {
  const key = await db.kv.get("apiKey", ""), u = await ai.usage(), cap = await db.kv.get("capUSD", 5), place = await db.kv.get("place", wx.ABU_DHABI);
  const last = await db.kv.get("lastBackup", null);
  const bgMode = await db.kv.get("bgMode", "eclipse"), bgStrength = await db.kv.get("bgStrength", 0.9);
  sheet(`<div class="eyebrow">Settings</div><h2 class="m0">Claude API key</h2>
    <input class="field" id="s-key" type="password" placeholder="${key ? "Saved · paste a new one to replace it" : "sk-ant-…"}" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="Claude API key">
    <div class="actions"><button class="btn main" id="s-key-save">Save on this phone</button><button class="btn" id="s-key-test">Test key</button></div>
    <ul class="why"><li>Stored only on this phone, inside Bers. Never in the code, never in backups.</li><li>Sent only to Anthropic, with each request.</li>
      <li>Get a key at console.anthropic.com. Set a monthly spend limit there too. Lose the phone? Delete the key there.</li></ul>
    ${key ? '<button class="btn" id="s-key-del">Remove key from this phone</button>' : ""}
    <h2 class="m0">Spend meter</h2>
    <div class="row"><span>${new Date().toLocaleDateString("en-GB", { month: "long" })} so far · ${u.calls} calls</span><span><b>$${u.usd.toFixed(2)}</b> <span class="dim">of $${cap}</span></span></div>
    <div class="bar"><i style="--v:${Math.min(1, u.usd / cap).toFixed(3)}"></i></div>
    <label class="lb">Monthly cap in Bers (USD)<input class="field" id="s-cap" inputmode="decimal" value="${cap}"></label>
    <p class="dim m0 small">Haiku describes photos and runs Guts' verdicts; Sonnet handles picks, chat and photo judgements. Picks are saved per day, so reopening the app costs nothing.</p>
    <h2 class="m0">Clothing budget</h2>
    <div class="two"><label class="lb">Per month (AED)<input class="field" id="s-bm" inputmode="numeric" value="${S.budgetMonth || 600}"></label>
      <label class="lb">Per item (AED)<input class="field" id="s-bi" inputmode="numeric" value="${S.budgetItem || 200}"></label></div>
    <h2 class="m0">Background</h2>
    <div class="ctx" id="s-bg">${[["eclipse", "Eclipse"], ["photo", "My picture"], ["none", "Off"]].map(([k, l]) => `<button class="chip ${bgMode === k ? "on" : ""}" data-bg="${k}">${l}</button>`).join("")}</div>
    <label class="lb">Strength<input type="range" id="s-bg-o" min="0.2" max="1" step="0.05" value="${bgStrength}"></label>
    <p class="dim m0 small">My picture: choose any image from your camera roll. It stays on this phone and is darkened so text stays readable.</p>
    <h2 class="m0">Weather city</h2>
    <div class="two" style="grid-template-columns:1fr auto"><input class="field" id="s-city" value="${esc(place.name)}"><button class="btn" id="s-city-go">Set</button></div>
    <button class="btn" id="s-geo">Use my location</button>
    <h2 class="m0">Backup</h2>
    <div class="ctx"><span class="pill">Last backup <b>${last ? last.slice(0, 10) : "never"}</b></span><span class="pill"><b>${S.pieces.length}</b> pieces · <b>${S.log.length}</b> log entries</span></div>
    <div class="actions"><button class="btn main" id="s-export">Export backup</button><button class="btn" id="s-restore">Restore</button></div>
    <p class="dim m0 small">One file with everything: photos, tags, wash state, history, looks, profile. Save it to Files → iCloud Drive. Your API key is never included.</p>
    <h2 class="m0">Crew</h2>
    <div class="ctx">${Object.keys(CREW).map((k) => `<span style="display:grid;justify-items:center;gap:4px;font-size:12px">${avatar(k)}${CREW[k].name}</span>`).join("")}</div>
    <h2 class="m0">JARVIS</h2>
    <p class="m0 dim">Copy your latest backup to the PC and JARVIS can answer "what am I wearing today?" (coming next).</p>`);
  const saveNum = async (id, k, field) => { const v = +$(id).value; if (v > 0) { await db.kv.set(k, v); if (field) S[field] = v; } };
  $("#s-key-save").onclick = async () => {
    const v = $("#s-key").value.trim();
    if (!/^sk-ant-/.test(v)) return toast("That doesn't look like a Claude key (it starts with sk-ant-).");
    await db.kv.set("apiKey", v); $("#s-key").value = ""; toast("Key saved on this phone");
  };
  $("#s-key-test").onclick = async () => { try { await ai.testKey(); toast("Key works"); } catch (e) { fail(e); } };
  $("#s-key-del") && ($("#s-key-del").onclick = async () => { await db.kv.set("apiKey", ""); closeSheet(); toast("Key removed"); });
  $("#s-cap").onchange = () => saveNum("#s-cap", "capUSD");
  $("#s-bm").onchange = () => saveNum("#s-bm", "budgetMonth", "budgetMonth");
  $("#s-bi").onchange = () => saveNum("#s-bi", "budgetItem", "budgetItem");
  $("#s-city-go").onclick = async () => {
    try { const p = await wx.geocode($("#s-city").value.trim()); await db.kv.set("place", p); await db.kv.set("weather", null); S.weather = await wx.today(p); toast(`Weather: ${p.name}`); render(); }
    catch (e) { toast(e.message); }
  };
  $("#s-geo").onclick = () => navigator.geolocation.getCurrentPosition(async (pos) => {
    const p = { name: "Your location", lat: pos.coords.latitude, lon: pos.coords.longitude };
    await db.kv.set("place", p); await db.kv.set("weather", null); S.weather = await wx.today(p).catch(() => null); toast("Using your location"); render();
  }, () => toast("Location not allowed. Type your city instead."));
  $("#s-bg").onclick = async (e) => {
    const c = e.target.closest("[data-bg]"); if (!c) return;
    let mode = c.dataset.bg;
    if (mode === "photo") {
      const [f] = await pickPhotos();
      if (!f) return;
      await db.kv.set("bgPic", await fileToDataUrl(f, 1400, 0.8));
    }
    await db.kv.set("bgMode", mode);
    $$("#s-bg [data-bg]").forEach((b) => b.classList.toggle("on", b.dataset.bg === mode));
    applyBackground();
  };
  $("#s-bg-o").oninput = (e) => document.documentElement.style.setProperty("--bg-o", e.target.value);
  $("#s-bg-o").onchange = (e) => db.kv.set("bgStrength", +e.target.value);
  $("#s-export").onclick = () => doBackup().catch(fail);
  $("#s-restore").onclick = doRestore;
  $("#layer .sheet").addEventListener("click", (e) => { const b = e.target.closest("[data-crew]"); if (b) crewSheet(b.dataset.crew); });
}

/* ---------- profile */
async function openProfile() {
  const p = (await profile()).raw;
  sheet(`<div class="eyebrow">Your profile</div>
    ${p.palette ? `<h2 class="m0">${esc(p.palette.name)}</h2><p class="m0">Colours that make you stand out:</p>
      <div class="swatches">${p.palette.good.map((c) => `<div class="sw" style="background:${esc(c)}"></div>`).join("")}</div>
      <p class="m0">Keep away from your face:</p><div class="swatches">${p.palette.avoid.map((c) => `<div class="sw no" style="background:${esc(c)}"></div>`).join("")}</div>
      <ul class="why">${(p.body || []).map((b) => `<li>${esc(b)}</li>`).join("")}</ul>`
      : `<h2 class="m0">Colours and body</h2><p class="dim m0">One daylight selfie and one full-body photo. Chopper reads them once, keeps the written result, and the photos aren't stored.</p>`}
    <label class="lb">Height (cm)<input class="field" id="pr-h" inputmode="numeric" value="${esc(p.height || "")}"></label>
    <div class="actions"><button class="btn" id="pr-a">1 · Daylight selfie</button><button class="btn" id="pr-b">2 · Full body (optional)</button></div>
    <button class="btn main" id="pr-read">${p.palette ? "Redo my colours" : "Read my colours"}</button>
    <label class="lb">Your sizes, one shop per line<textarea class="field" id="pr-sizes" rows="4" placeholder="Zara: L tops, 32 bottoms\nNike: UK 9">${esc(p.sizes || "")}</textarea></label>
    <label class="lb">About you (the crew reads this)<textarea class="field" id="pr-about" rows="6" placeholder="Where you live, your work, your style, what you never wear, your budget per item">${esc(p.about || DEFAULT_ABOUT)}</textarea></label>
    <button class="btn main" id="pr-save">Save profile</button>`);
  const save = async (extra = {}) => db.kv.set("profile", { ...p, height: $("#pr-h").value.trim(), sizes: $("#pr-sizes").value.trim(), about: $("#pr-about").value.trim(), ...extra });
  $("#pr-save").onclick = async () => { await save(); closeSheet(); toast("Profile saved"); };
  // Each photo gets its own tap: iPhone only opens the photo picker straight from a tap.
  let a = null, b = null;
  $("#pr-a").onclick = async () => { const [f] = await pickPhotos({ capture: "user" }); if (f) { a = f; $("#pr-a").textContent = "1 · Selfie ✓"; } };
  $("#pr-b").onclick = async () => { const [f] = await pickPhotos(); if (f) { b = f; $("#pr-b").textContent = "2 · Full body ✓"; } };
  $("#pr-read").onclick = async () => {
    if (!a) return toast("Take the daylight selfie first.");
    await save();
    sheet('<div class="loading"><span class="spin"></span>Chopper is reading your colours…</div>');
    try {
      const r = await ai.readProfile({ selfie: await fileToDataUrl(a, 1024), body: b ? await fileToDataUrl(b, 1024) : null, height: $("#pr-h")?.value || p.height });
      await db.kv.set("profile", { ...p, palette: { name: r.palette, good: r.good, avoid: r.avoid }, body: r.body });
      openProfile();
    } catch (e) { closeSheet(); fail(e); }
  };
}

/* ---------- header */
$("#btn-set").onclick = () => openSettings();
$("#btn-me").onclick = () => openProfile();
$("#btn-theme").onclick = () => {
  const r = document.documentElement, dark = r.dataset.theme ? r.dataset.theme === "dark" : !matchMedia("(prefers-color-scheme: light)").matches;
  r.dataset.theme = dark ? "light" : "dark"; db.kv.set("theme", r.dataset.theme);
};

/* ---------- boot */
async function boot() {
  const theme = await db.kv.get("theme", null); if (theme) document.documentElement.dataset.theme = theme;
  applyBackground();
  await loadData();
  const dow = new Date().getDay();
  S.occ = S.occ || (dow >= 1 && dow <= 5 ? "work" : "casual");
  const planned = S.log.find((l) => l.kind === "plan" && l.date === ymd());
  if (planned) S.occ = planned.occ;
  S.pick = await db.kv.get(`pick:${ymd()}:${S.occ}`, null);
  S.rpick = await db.kv.get(`ride:${ymd()}:${S.ride}`, null);
  const ctx = await db.kv.get("dayctx:" + ymd(), {}); S.plan = ctx.plan || ""; S.seen = ctx.seen || "";
  S.gaps = await db.kv.get("gaps", null);
  S.budgetMonth = await db.kv.get("budgetMonth", 600); S.budgetItem = await db.kv.get("budgetItem", 200);
  S.sinceBackup = await db.kv.get("sinceBackup", 0);
  render({ enter: true });
  wx.today().then((w) => { S.weather = w; render(); }).catch(() => { S.weatherFailed = true; render(); });
}
boot().catch(fail);
if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
  // updateViaCache "none": the phone always checks for a new sw.js instead of trusting its 10-minute copy.
  navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then((r) => r.update()).catch(() => {});
  // When a new version takes over while the app is open, reload once so you see it.
  // (Not on the very first visit, when there was no old version to replace.)
  let reloaded = false; const hadOld = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (hadOld && !reloaded) { reloaded = true; location.reload(); } });
}
// Coming back to the app after a while: check for an update.
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") navigator.serviceWorker?.getRegistration().then((r) => r?.update()).catch(() => {}); });
