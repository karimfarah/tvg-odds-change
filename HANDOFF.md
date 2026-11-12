# Handoff: TVG Odds + Trackside Userscript

Status as of 2026-11-12 · script version **2.1** · single file: `tvg-odds-change.user.js`

## What it does
A Tampermonkey userscript that runs on `https://www.tvg.com/*` race cards and adds:

1. **M/L → current odds % change** badge under each runner's odds. Shortening = green, drifting = orange/red.
2. **Trackside Win %** pill under each horse's name, plus **Best Non-Maiden #N**, **Best Maiden #N** and **Hidden Gem** tags, from Trackside Handicapper.
3. **Exacta Win %** worked out from the Trackside Win % (Harville model):
   - TVG Probables table present → every cell gets a colored %, and the top 8 combos are outlined and ranked. With the Quinella dropdown, shows either-order %.
   - No Probables table → a "Top exactas by Trackside Win %" list is added inside the Probables box.

## Code layout (in file order)
| Section | Key functions | Notes |
|---|---|---|
| Header | `@grant GM_addStyle, GM_xmlhttpRequest, GM_getValue, GM_setValue`, `@connect trackside.yourteamstats.com` | Cross-site fetch needs `GM_xmlhttpRequest` (TVG pages can't fetch Trackside because of CORS). |
| Config | `TS_BASE`, `TS_CHECK_MS` (30 min), `TS_CACHE_KEY` (`tsCache.v1`), `TOP_EXACTAS` (8) | |
| CSS | `GM_addStyle` block | Uses `!important` on pills because TVG's CSS strips span padding and radius. |
| Helpers | `parseOdds`, `normName`, `normNum`, `pctNum`, `setText`, `setClass` | `normName` uppercases, drops `(IRE)`-style suffixes and non-alphanumerics. |
| Feature 1 | `oddsClass`, `updateOddsChange` | |
| Feature 2 | `gmGet`, `pickDay`, `readCache`/`writeCache`, `tableRecords`, `splitNumName`, `parseTrackside`, `loadTrackside` | Download, parse and cache Trackside data. |
| Feature 3 | `winClass`, `exClass`, `tvgRunners`, `matchRace`, `updateRunners` | |
| Feature 4 | `winProbs`, `exactaP`, `allExactas`, `probablesContainer`, `updateProbables`, `annotateProbablesTable`, `renderExactaList` | |
| Main loop | `update`, `schedule` (300 ms throttle), `MutationObserver` | Ignores mutations from our own elements (class `kb-own`) to avoid loops. |

All injected elements carry the class `kb-own`, and every class starts with `kb-`.

## External data: Trackside Handicapper
- UI: `https://trackside.yourteamstats.com/day.html`
- **Index** (~30 KB): `/published/index.json` → `{ days: [{ country: "us"|"uk", date, publishedAt, tracks, races, horses }] }`
- **Day file** (~760 KB): `/published/us-YYYY-MM-DD.json` → `{ date, publishedAt, pages: [{ key, title, fileName, html }] }`
  - Page keys: `card`, `bestNonMaidens`, `bestMaidens`, `hiddenGems`, `bestExotics`. Each `html` is a pre-rendered HTML page.
  - `card`: for each race there's a header table whose text starts `TRACK YYYY-MM-DD Race: N at HH:MM GMT`, followed by a runners table. Its header row has `Name` (e.g. `4 GRAY DAY`) and `WIN %` (e.g. `42.2%`).
  - `bestNonMaidens` / `bestMaidens`: the **first** table is the ranked list. The second table is "Not ranked" (low confidence) and is deliberately ignored. Columns: `Rank | Track | Race | Post (PT) | Name | ODDS | Runners | WIN % | Blend % | Fair Odds | Win % Lead | Best Count | Note`.
  - `hiddenGems`: columns `Track | Race | Name | ODDS | …`. It is often empty.
  - `bestExotics`: daily double, pick 3–6 and exacta boxes. **Not used yet**.

### Caching (`loadTrackside`)
1. If checked within the last 30 min (`tsLastCheck`), do nothing. This is the cheap path that runs on every page update.
2. Otherwise read the saved cache (`GM_getValue('tsCache.v1')`, shared by all TVG tabs) and use it immediately.
3. Fetch `index.json`. If today's (or else the latest earlier) US day has the same `date` and `publishedAt` as the cache, keep the cache and refresh `checkedAt`. If not, download the day file, parse it and save it.
4. On a network error, keep the cached data and retry after 30 minutes.

The cache holds only the parsed `races` and `tags` (tens of KB). The `tags` Map is stored as an entries array.

## TVG page structure the script depends on
TVG is an AngularJS single-page app, so these selectors are the most likely thing to break.

| Thing | Selector |
|---|---|
| Runner row | `tr.program-page-runner` |
| Program number | `.horse-number-label` |
| Horse name | `.horse-info-row .horse-info-cell strong.h5` |
| Current odds / M/L | `.race-current-odds` / `.race-morning-odds` (same `td`) |
| Scratched | row text contains `SCRATCHED` |
| Probables box | `.pcontainer` whose `h2` is `Probables`; contents in `.panel-body` |
| Probables bet type | `select.cb-bettype` (Exacta / Quinella) |
| Probables grid | `.probables-table .probables-row`. Row 0 = column headers = **1st place**. The left `.sticky-col .sticky-cell:not(.diagonal-cell)` = row labels = **2nd place**. |

The 1st/2nd orientation was checked against live odds: 50 of 62 pairs had the lower payout when the favorite was in the column position.

## Matching TVG races to Trackside
`matchRace` picks the Trackside race with the most horse-name matches against the TVG card (at least 2). Track names are **not** compared: TVG says "Mahoning Valley" while Trackside says "MAHONING VALLEY RACE COURSE". Within a race, runners match by normalized name, falling back to program number. Tags are looked up by `TRACK|RACE|NAMEKEY` using Trackside's own track name.

## Color scales
- Odds change: ≤−60 dark green, ≤−35 green, ≤−15 light green, <−0.5 pale green, ~0 grey, <+50 orange, ≥+50 red.
- Win %: ≥40 dark green, ≥25 green, ≥15 light green, ≥8 yellow, else grey.
- Exacta %: ≥15 dark green, ≥8 green, ≥4 light green, ≥2 yellow, else grey.

## Known limitations / ideas
- Only US Trackside data (`us-*.json`) is used. A UK feed exists (`uk:` dates in the index) but isn't wired in.
- After midnight, the new day's data can take up to 30 minutes to appear (check interval).
- `bestExotics` (exacta boxes with Trackside's own hit % and estimated return) isn't shown. That would be a natural next feature.
- Harville is a simple model. It tends to overrate favorites in 2nd place.
- Races not on Trackside (e.g. foreign tracks like SE - Orebro) only get the odds-change badge.

## Testing approach used
- **Page logic:** paste the script body into the TVG page console with shims (`GM_addStyle` → `<style>`, `GM_xmlhttpRequest` → returns canned JSON). The page itself can't fetch Trackside (CORS), so feed it a trimmed copy of the real day JSON.
- **Caching logic:** a Node simulation that stubs `GM_*`, `Date.now` and the network. It confirmed: first load downloads index + day; reloads within 30 min download nothing; after 30 min only the index; a re-publish triggers the day download; with the site down, the cache is kept.
- **Syntax:** `node --check tvg-odds-change.user.js`.

## Deploying changes
- Install or update: in Tampermonkey, replace all the code (Ctrl+A, paste, save), then reload a TVG race card. On first run, allow the connection to `trackside.yourteamstats.com` with **Always allow domain**.
- Chrome needs **Allow User Scripts** on for Tampermonkey (`chrome://extensions` → Tampermonkey → Details), or Developer mode.
- Watch for stray text pasted above `// ==UserScript==`. It makes Tampermonkey silently skip the script. This happened once.
- Repo: `karimfarah/tvg-odds-change` (private), branch `main`. Claude sessions so far couldn't push with git, so commits were made through the GitHub web editor in the browser. Verify by comparing the raw file's SHA-256 with the local copy.
- Console messages from the script start with `[KB TVG]`.

## History
- 1.0: M/L vs current % change badge.
- 1.1: colors flipped so shortening = green and drifting = red.
- 2.0: Trackside Win %, tags, exacta Win % (table overlay + list).
- 2.1: saved cache with publish-time check, replacing a full re-download on every page load.
