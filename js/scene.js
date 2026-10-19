// Tab backgrounds: one mood per crew member, built from their real colours and signature motifs, with no character drawings.
// Each is a 390×844 SVG cropped to fill the screen. Top and bottom fade into --bg so the header and tab bar stay clean.
// Everything is static (no animation inside the SVG), so scrolling stays smooth.

// Seeded random, so the scatter (petals, embers, coins) is identical on every load.
function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) / 2147483647); }
const r1 = (n) => Math.round(n * 10) / 10;

const frame = (id, defs, body) => `<svg viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
<defs>${defs}
  <linearGradient id="${id}-top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--bg)" stop-opacity=".92"/><stop offset="1" style="stop-color:var(--bg)" stop-opacity="0"/></linearGradient>
  <linearGradient id="${id}-bot" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--bg)" stop-opacity="0"/><stop offset="1" style="stop-color:var(--bg)" stop-opacity=".95"/></linearGradient>
</defs>
<rect width="390" height="844" style="fill:var(--bg)"/>${body}
<rect width="390" height="170" fill="url(#${id}-top)"/><rect y="690" width="390" height="154" fill="url(#${id}-bot)"/></svg>`;

const glow = (id, cx, cy, r, color, o) => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${color}" stop-opacity="${o}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`;

/* Chopper · Gear Up: Drum Island snow under cherry blossoms. Pink, snow white, his blue. */
function chopperBlossom() {
  const R = rng(46), petal = "M0 -7 C5 -7 7 -1 0 7 C-7 -1 -5 -7 0 -7 Z M0 -7 L0 -3";
  let petals = "", snow = "";
  for (let i = 0; i < 34; i++) {
    const x = r1(R() * 390), y = r1(140 + R() * 560), s = r1(0.6 + R() * 1.1), a = Math.round(R() * 360), o = r1(0.35 + R() * 0.5);
    petals += `<path d="${petal}" transform="translate(${x} ${y}) rotate(${a}) scale(${s})" fill="${R() > 0.35 ? "#f29bb7" : "#ffc9da"}" opacity="${o}"/>`;
  }
  for (let i = 0; i < 46; i++) snow += `<circle cx="${r1(R() * 390)}" cy="${r1(120 + R() * 600)}" r="${r1(0.8 + R() * 1.6)}" fill="#ffffff" opacity="${r1(0.15 + R() * 0.35)}"/>`;
  return frame("ch", glow("ch-g1", 300, 210, 260, "#f29bb7", 0.34) + glow("ch-g2", 60, 560, 240, "#7fb3e6", 0.22), `
<rect width="390" height="844" fill="url(#ch-g1)"/><rect width="390" height="844" fill="url(#ch-g2)"/>
<path d="M0 700 L60 610 L96 640 L150 560 L196 628 L240 590 L300 650 L350 600 L390 640 L390 844 L0 844 Z" fill="#cfe0f2" opacity=".10"/>
<path d="M150 560 L168 584 L158 582 L150 592 L140 580 L132 586 Z M350 600 L362 616 L352 614 L344 622 L338 612 Z" fill="#ffffff" opacity=".18"/>
${snow}${petals}`);
}

/* Chopper · Armory: his pink and blue, the X from his hat as a big faint mark, soft folds of fabric light. */
function chopperArmory() {
  let folds = "";
  for (let i = 0; i < 9; i++) { const x = 20 + i * 46; folds += `<path d="M${x} 120 C${x + 16} 320 ${x - 14} 520 ${x + 8} 760" fill="none" stroke="${i % 2 ? "#7fb3e6" : "#f29bb7"}" stroke-width="22" stroke-linecap="round" opacity=".05"/>`; }
  return frame("ca", glow("ca-g1", 330, 300, 280, "#f29bb7", 0.26) + glow("ca-g2", 40, 640, 260, "#7fb3e6", 0.2), `
<rect width="390" height="844" fill="url(#ca-g1)"/><rect width="390" height="844" fill="url(#ca-g2)"/>${folds}
<path d="M210 330 L350 470 M350 330 L210 470" stroke="#ffffff" stroke-width="34" stroke-linecap="round" opacity=".07"/>
<circle cx="280" cy="400" r="110" fill="none" stroke="#f29bb7" stroke-width="2" opacity=".18"/>`);
}

/* Guts · Forge: black iron, a red eclipse ring, embers rising from below. */
function gutsForge() {
  const R = rng(1997);
  let embers = "";
  for (let i = 0; i < 40; i++) {
    const y = 380 + R() * 380, o = r1(0.15 + (y - 380) / 380 * 0.6);
    embers += `<circle cx="${r1(R() * 390)}" cy="${r1(y)}" r="${r1(0.8 + R() * 2.2)}" fill="${R() > 0.4 ? "#ff5a1f" : "#e10600"}" opacity="${o}"/>`;
  }
  return frame("gu", `<radialGradient id="gu-ring" cx="262" cy="250" r="150" gradientUnits="userSpaceOnUse">
    <stop offset=".5" stop-color="#e10600" stop-opacity="0"/><stop offset=".54" stop-color="#ff3b2f" stop-opacity=".8"/>
    <stop offset=".6" stop-color="#e10600" stop-opacity=".4"/><stop offset=".8" stop-color="#a00000" stop-opacity=".12"/><stop offset="1" stop-color="#a00000" stop-opacity="0"/></radialGradient>
    ${glow("gu-heat", 195, 820, 330, "#e10600", 0.3)}
    <linearGradient id="gu-steel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8a8a92" stop-opacity=".08"/><stop offset="1" stop-color="#8a8a92" stop-opacity="0"/></linearGradient>`, `
<rect width="390" height="844" fill="url(#gu-steel)"/>
<circle cx="262" cy="250" r="150" fill="url(#gu-ring)"/><circle cx="262" cy="250" r="76" style="fill:var(--ink)"/>
<rect width="390" height="844" fill="url(#gu-heat)"/>
<path d="M-20 520 L410 430 M-20 560 L410 470" stroke="#8a8a92" stroke-width="1" opacity=".12"/>${embers}`);
}

/* Rogue · Chronicle: her green and gold, the white streak, aurora over a Southern night. */
function rogueChronicle() {
  const R = rng(1981);
  let stars = "";
  for (let i = 0; i < 40; i++) stars += `<circle cx="${r1(R() * 390)}" cy="${r1(130 + R() * 420)}" r="${r1(0.6 + R() * 1.1)}" fill="#fff6d0" opacity="${r1(0.15 + R() * 0.4)}"/>`;
  return frame("ro", glow("ro-g1", 90, 280, 300, "#1f7a45", 0.42) + glow("ro-g2", 330, 640, 240, "#e6c34a", 0.18) +
    `<linearGradient id="ro-aur" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#3fae5a" stop-opacity="0"/><stop offset=".5" stop-color="#3fae5a" stop-opacity=".35"/><stop offset="1" stop-color="#e6c34a" stop-opacity="0"/></linearGradient>`, `
<rect width="390" height="844" fill="url(#ro-g1)"/><rect width="390" height="844" fill="url(#ro-g2)"/>${stars}
<path d="M-30 330 C80 250 180 380 280 290 S420 260 430 280" fill="none" stroke="url(#ro-aur)" stroke-width="46" stroke-linecap="round" opacity=".7"/>
<path d="M-30 400 C100 330 200 450 300 370 S420 350 430 360" fill="none" stroke="url(#ro-aur)" stroke-width="24" stroke-linecap="round" opacity=".5"/>
<path d="M300 120 C250 300 180 460 60 720" fill="none" stroke="#ffffff" stroke-width="30" stroke-linecap="round" opacity=".07"/>
<path d="M330 120 C285 300 215 470 100 730" fill="none" stroke="#ffffff" stroke-width="10" stroke-linecap="round" opacity=".06"/>`);
}

/* Blackbeard · Hoard: the darkness that swallows everything, and the gold he hoards. */
function blackbeardHoard() {
  const R = rng(1500);
  let rings = "", coins = "";
  for (let i = 0; i < 7; i++) rings += `<ellipse cx="200" cy="420" rx="${60 + i * 34}" ry="${26 + i * 15}" fill="none" stroke="${i % 2 ? "#5a3a78" : "#2a1838"}" stroke-width="${6 - i * 0.6}" opacity="${r1(0.5 - i * 0.05)}" transform="rotate(${-14 + i * 5} 200 420)"/>`;
  for (let i = 0; i < 30; i++) {
    const x = r1(R() * 390), y = r1(560 + R() * 200), rx = r1(3 + R() * 5);
    coins += `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${r1(rx * 0.45)}" fill="#d4a73a" opacity="${r1(0.25 + R() * 0.45)}"/>`;
  }
  return frame("bb", glow("bb-g1", 200, 420, 300, "#3b1f55", 0.55) + glow("bb-g2", 200, 700, 260, "#d4a73a", 0.18), `
<rect width="390" height="844" fill="url(#bb-g1)"/>${rings}
<ellipse cx="200" cy="420" rx="54" ry="24" transform="rotate(-14 200 420)" style="fill:var(--ink)"/>
<rect width="390" height="844" fill="url(#bb-g2)"/>${coins}
<circle cx="120" cy="610" r="2" fill="#fff3c4" opacity=".7"/><circle cx="276" cy="650" r="1.6" fill="#fff3c4" opacity=".6"/>`);
}

/* Rossi · Ride: fluorescent yellow, speed lines, red and white kerbs, a faint 46. */
function rossiRide() {
  let lines = "", kerb = "";
  [[-40, 260, 0.28, 6], [-60, 330, 0.18, 3], [-20, 390, 0.22, 4], [-80, 470, 0.12, 2], [0, 520, 0.16, 3]].forEach(([x, y, o, w]) =>
    (lines += `<path d="M${x} ${y + 120} L${x + 460} ${y - 60}" stroke="#ffd400" stroke-width="${w}" stroke-linecap="round" opacity="${o}"/>`));
  for (let i = 0; i < 12; i++) kerb += `<path d="M${-30 + i * 40} 744 L${-6 + i * 40} 744 L${14 + i * 40} 704 L${-10 + i * 40} 704 Z" fill="${i % 2 ? "#ffffff" : "#e10600"}" opacity=".28" transform="rotate(-8 195 724)"/>`;
  return frame("rs", glow("rs-g1", 300, 260, 280, "#ffd400", 0.2) + glow("rs-g2", 60, 620, 220, "#00924a", 0.12), `
<rect width="390" height="844" fill="url(#rs-g1)"/><rect width="390" height="844" fill="url(#rs-g2)"/>
<text x="360" y="560" text-anchor="end" font-family="system-ui,sans-serif" font-size="230" font-weight="900" font-style="italic" fill="#ffd400" opacity=".07">46</text>
${lines}${kerb}`);
}

export const SCENES = { gear: chopperBlossom(), armory: chopperArmory(), forge: gutsForge(), chronicle: rogueChronicle(), hoard: blackbeardHoard(), ride: rossiRide() };

/* Doflamingo · the dare: pink strings (his Birdcage) laid over Gear Up while the dare is on. */
export const DARE = (() => {
  let s = "";
  for (let i = 0; i < 14; i++) {
    const x = -40 + i * 34;
    s += `<path d="M${x} 0 L${x + 160} 844" stroke="#e8408f" stroke-width="1.1" opacity=".32"/><path d="M${x + 160} 0 L${x} 844" stroke="#e8408f" stroke-width="1.1" opacity=".22"/>`;
  }
  return `<svg viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
<defs>${glow("dd-g", 195, 120, 340, "#e8408f", 0.3)}</defs><rect width="390" height="844" fill="url(#dd-g)"/>${s}</svg>`;
})();
