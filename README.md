# Bers

Your closet, your crew. A home-screen web app for iPhone. Everything is stored on the phone. Claude is only called when you tap something that needs it.

## Files

| File | What it does |
|---|---|
| `index.html`, `styles.css` | The page and the look (glass cards, dark and light themes) |
| `js/app.js` | All six tabs, the sheets, settings, profile, backup |
| `js/db.js` | Storage on the phone (IndexedDB) and backup export/restore |
| `js/ai.js` | Claude calls and crew prompts, plus the spend meter. Haiku 5.5 describes photos and runs Guts' verdicts. Sonnet 5.5 does picks, chat and photo judgements |
| `js/weather.js` | Live weather from Open-Meteo (free, no key) and Rossi's ride warnings |
| `js/image.js` | Shrinks photos on the phone before they're stored or sent |
| `sw.js`, `manifest.webmanifest`, `icons/` | Makes it installable and lets it open offline. The icon is the Brand |

## Put it on your iPhone

It has to be on the web over HTTPS. Two free options:

**Netlify Drop (easiest, no code tools):**
1. Go to app.netlify.com/drop and sign up (free).
2. Drag the whole `C:\Jarvis\bers\app` folder onto the page.
3. You get a link like `https://something.netlify.app`. Rename it in Site settings if you want.
4. To update later, drag the folder again from the site's Deploys page.

**GitHub Pages:** create a repository, upload this folder's contents, and turn on Pages under Settings → Pages. On a free account the code is public. That's fine, because there are no secrets in it.

Then, on the iPhone:
1. Open the link in **Safari**.
2. Tap Share → **Add to Home Screen**. The Brand icon appears on your Home Screen.
3. Open Bers from the icon, not from Safari. Its data lives with the home-screen app.

## First run

1. **Key icon → Claude API key.** Make a key at console.anthropic.com, paste it, then tap Save and Test key. Also set a monthly spend limit in the Anthropic Console.
2. **Armory → + Add pieces.** Pick several photos at once. Chopper describes each one, and you check it and tick Everyday, Ride or both.
3. **Profile icon.** Add your sizes, and do the colour reading with a daylight selfie and optionally a full-body photo.
4. **Gear Up.** Fill in the plan and who'll see you, then tap Gear me up.
5. **Key icon → Export backup** once your closet is in. Choose Save to Files → iCloud Drive.

## Costs

Bers tracks what it spends in Settings and stops at your cap ($5 by default). Picks are saved per day, so reopening the app doesn't cost anything.

## Testing without a key

Add `?mock` to the URL, for example `http://localhost:8770/?mock`, and every Claude call returns a canned answer.
Run locally with: `py -3 -m http.server 8770 --directory C:\Jarvis\bers\app`

## Credits

- Cut-outs: [@imgly/background-removal](https://github.com/imgly/background-removal-js) 1.7.0 (AGPL-3.0). It runs on the phone, and its model downloads once from IMG.LY's CDN.
- Heading font: New Rocker (SIL Open Font License, `fonts/OFL.txt`).

## Not in this version

- Background removal on photos. They're stored as taken, shrunk to 768 px.
- JARVIS reading the backup ("what am I wearing today?") is the next piece of work.
