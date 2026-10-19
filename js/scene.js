// "Eclipse": an original background scene in the spirit of Berserk (not copied art).
// A lone swordsman on a cliff edge under a black eclipse, crows, dusk haze. No gore.
// Colours come from CSS variables so it follows the light and dark themes.
export const ECLIPSE = `<svg viewBox="0 0 390 844" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
<defs>
  <linearGradient id="bg-sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" style="stop-color:var(--bg)"/>
    <stop offset=".45" style="stop-color:var(--bg)"/>
    <stop offset=".74" style="stop-color:var(--sky-low)"/>
    <stop offset="1" style="stop-color:var(--bg)"/>
  </linearGradient>
  <radialGradient id="bg-corona" cx="265" cy="236" r="150" gradientUnits="userSpaceOnUse">
    <stop offset=".5" stop-color="#e10600" stop-opacity="0"/>
    <stop offset=".54" stop-color="#ff3b2f" stop-opacity=".85"/>
    <stop offset=".6" stop-color="#e10600" stop-opacity=".45"/>
    <stop offset=".78" stop-color="#a00000" stop-opacity=".14"/>
    <stop offset="1" stop-color="#a00000" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="bg-back" cx="196" cy="590" r="190" gradientUnits="userSpaceOnUse">
    <stop offset="0" stop-color="#cc0000" stop-opacity=".22"/>
    <stop offset="1" stop-color="#cc0000" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="bg-mist" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" style="stop-color:var(--bg)" stop-opacity="0"/>
    <stop offset="1" style="stop-color:var(--bg)" stop-opacity=".95"/>
  </linearGradient>
  <linearGradient id="bg-top" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" style="stop-color:var(--bg)" stop-opacity=".9"/>
    <stop offset="1" style="stop-color:var(--bg)" stop-opacity="0"/>
  </linearGradient>
</defs>
<rect width="390" height="844" fill="url(#bg-sky)"/>
<circle cx="265" cy="236" r="150" fill="url(#bg-corona)"/>
<circle cx="265" cy="236" r="76" style="fill:var(--ink)"/>
<rect width="390" height="844" fill="url(#bg-back)"/>
<g style="fill:var(--ink)">
  <path opacity=".55" d="M0 690 L38 668 L70 676 L112 650 L150 662 L178 646 L230 664 L262 650 L300 668 L344 652 L390 670 L390 844 L0 844 Z"/>
  <path d="M0 844 L0 652 L34 640 L62 650 L96 630 L132 638 L170 616 L186 612 L212 613 L226 628 L240 660 L262 704 L312 732 L390 752 L390 844 Z"/>
  <!-- the swordsman, seen from behind: cape in the wind, the great sword on his shoulder -->
  <path d="M188 612 L190 570 L196 570 L197 612 Z M200 612 L201 570 L207 570 L211 612 Z"/>
  <path d="M184 572 Q183 538 188 526 Q197 518 206 526 Q212 538 211 572 Z"/>
  <path d="M187 528 Q172 552 150 596 Q160 590 168 594 Q160 606 140 612 Q170 612 186 598 Q190 584 192 566 Z"/>
  <circle cx="197" cy="510" r="9"/>
  <path d="M188 506 L184 497 L191 502 L192 493 L196 501 L199 491 L201 501 L206 494 L205 503 L211 499 L206 508 Z"/>
  <path d="M203 546 L213 553 L302 424 L291 417 Z"/>
  <path d="M196 547 L221 565 L224 561 L199 543 Z"/>
  <path d="M195 553 L203 546 L198 541 L190 549 Z"/>
</g>
<g fill="none" style="stroke:var(--ink)" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M84 300 q7 -6 14 0 q7 -6 14 0"/>
  <path d="M120 262 q5 -4 10 0 q5 -4 10 0"/>
  <path d="M318 352 q6 -5 12 0 q6 -5 12 0"/>
  <path d="M60 372 q4 -3 8 0 q4 -3 8 0"/>
  <path d="M352 168 q4 -3 8 0 q4 -3 8 0"/>
</g>
<rect y="640" width="390" height="204" fill="url(#bg-mist)"/>
<rect width="390" height="170" fill="url(#bg-top)"/>
</svg>`;
