# Handoff: TVG Odds + Trackside Userscript

Status as of 2026-11-15 · script version **2.11** · single file: `tvg-odds-change.user.js`

## What it does
A Tampermonkey userscript that runs on `https://www.tvg.com/*` race cards and adds:

1. **M/L → current odds % change** badge under each runner's odds. Shortening = green, drifting = orange/red.
2. **Trackside Win %** pill under each horse's name, from Trackside Handicapper's **US and UK** feeds. Tags: **Best Non-Maiden #N** / **Best Maiden #N** (US), **UK Top Pick #N** (UK Win Model ranking) and **Hidden Gem** (both).
3. **Exacta Win %** worked out from the Trackside Win % (Harville model):
   - TVG Probables table present → every cell gets a colored %, and the top 8 combos are outlined and ranked. With the Quinella dropdown, shows either-order %.
   - No Probables table → a "Top exactas by Trackside Win %" list is added inside the Probables box.

4. **Money velocity** (see below): ⚡ badges on the race card, `+$X ×heat` tags in the Pools box, and `⚡▼drop% +$X` tags on Probables cells that are drawing money.

## Code layout (in file order)
| Section | Key functions | Notes |
|---|---|---|
| Header | `@grant GM_addStyle, GM_xmlhttpRequest, GM_getValue, GM_setValue`, `@connect trackside.yourteamstats.com` | Cross-site fetch needs `GM_xmlhttpRequest` (TVG pages can't fetch Trackside because of CORS). |
| Config | `TS_BASE`, `TS_CHECK_MS` (30 min), `TS_CACHE_KEY` (`tsCache.v2`, plus `.us` / `.uk`), `TOP_EXACTAS` (8) | |
| CSS | `GM_addStyle` block | Uses `!important` on pills because TVG's CSS strips span padding and radius. |
| Helpers | `parseOdds`, `normName`, `normNum`, `pctNum`, `setText`, `setClass` | `normName` uppercases, drops `(IRE)`-style suffixes and non-alphanumerics. |
| Feature 1 | `oddsClass`, `updateOddsChange` | |
| Feature 2 | `FEEDS`, `allRaces`, `tagsFor`, `gmGet`, `getIndex`, `pickDay`, `readCache`/`writeCache`, `tableRecords`, `splitNumName`, `parseRaceTables`, `parseTrackside(json, country)`, `loadFeed`, `loadTrackside` | Download, parse and cache Trackside data per country (`us`, `uk`). |
| Feature 3 | `winClass`, `exClass`, `tvgRunners`, `matchRace`, `updateRunners` | |
| Feature 4 | `winProbs`, `exactaP`, `allExactas`, `probablesContainer`, `updateProbables`, `annotateProbablesTable`, `renderExactaList` | |
| Feature 5 | `readPools`, `readProbables`, `velSample`, `velBase`, `poolHeat`, `heatClass`, `renderPoolVelocity`, `renderRunnerVelocity`, `renderProbablesVelocity`, `updateVelocity` | Money velocity. History in `GM_setValue('vel.v1')`. |
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

### UK feed (`/published/uk-YYYY-MM-DD.json`)
Different layout from the US file. Page keys: `card`, `fojtc`, `pace`, `bestNonMaidens`, `bestMaidens`, `hiddenGems`, `winModel`.
- **Win %** comes from `winModel`. The `card` page has no WIN % column. Each race is a header table whose first row is `Thursday November 12th 2026 - Market Rasen 15:36`, followed by a runners table with `Name` (`(4) Tilehurst`) and `WIN %` (`30.0`, no % sign).
- Races are identified by **"Track HH:MM"** (e.g. `Market Rasen 15:36`), not a race number. The tag tables use the same text in their `Race` column.
- **UK Top Pick #N** comes from the first `winModel` table, "Best UK picks by WIN %": `Rank | Track | Race | Name | ODDS | Market % | WIN % | Fair Odds | Lead | Runners | Rain`. It has one top pick per race.
- UK `bestNonMaidens` is **not used**. It lists every horse (all 201 on 2026-11-12) with repeated rows and no rank. UK `bestMaidens` was empty. UK `hiddenGems` has repeated rows, which are removed.

### Caching (`loadFeed`, one per country)
1. If checked within the last 30 min (`tsLastCheck`), do nothing. This is the cheap path that runs on every page update.
2. Otherwise read that country's saved cache (`GM_getValue('tsCache.v2.us')` / `'tsCache.v2.uk'`, shared by all TVG tabs) and use it immediately.
3. Fetch `index.json` (shared by both feeds within the same minute). If today's (or else the latest earlier) US day has the same `date` and `publishedAt` as the cache, keep the cache and refresh `checkedAt`. If not, download the day file, parse it and save it.
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
`matchRace` picks the Trackside race (from either country) with the most horse-name matches against the TVG card (at least 2). Track names are **not** compared: TVG says "Mahoning Valley" while Trackside says "MAHONING VALLEY RACE COURSE". Within a race, runners match by normalized name, falling back to program number. Tags are looked up by `race.tagPrefix + horseKey`, i.e. `TRACK|RACE|NAMEKEY`, where RACE is the number (US) or `Track HH:MM` (UK). TVG suffixes like `(Ire)` are removed before matching.

## Money velocity (v2.3)
- **Sampling:** every 15 s (`VEL_SAMPLE_MS`, plus a `setInterval`) it records Win/Place/Show amounts per horse and every Probables payout plus the probables Pool Total. A sample is only stored when something changed. Samples are kept for 30 min per race and saved to `GM_setValue('vel.v1')` (merged across tabs, removed after 6 h). The race key is the track path plus the runner list.
- **Baseline:** the earliest sample within the last 5 min (`VEL_WINDOW_MS`) that is at least 1 min old. If the values sat unchanged, the latest sample before the window is used.
- **Pool heat:** for each horse, `inShare` = its share of the new money (Δhorse / Δpool) and `share0` = its share of the pool at the baseline. `heat = inShare / share0`. Very hot (dark green #0b8a2f, `kb-v4`) = heat ≥ 3; hot (green #3fbf5f, `kb-v3`) = heat ≥ 2; warm (light green #a6e3b5, `kb-v2`) = heat ≥ 1.4. These are the same greens as the Win % and odds-change badges (orange/yellow before v2.10, lime in v2.10); all of these also need ≥ $20 new money and ≥ 8% of it. Cold (blue) = heat ≤ 0.5, shown only for horses with ≥ 10% of the pool. A pool needs ≥ $100 (and ≥ 1%) of new money before anything is judged. Scratched horses ($0) are skipped.
- **Probables:** payouts fall when money comes in. Estimated money on a combo = `poolTotal × (1 − 0.2 takeout) / payout`, then the same heat test. The minimum share is `max(2%, 2 / number of combos)`. This filters out thin combos that swing on a $1 bet. The cell shows the actual payout drop % and the estimated $.
- **Where it shows:** race card `⚡ Win ×1.9 +$172` (warm or hotter only, for each of W/P/S); Pools cells `+$X` (with `×heat` when warm or hot; a hot row gets a dark green left bar); Probables cells `⚡▼N% +$X` (a hot cell gets a dark green border).
- **TVG quirk:** Angular rewrites a pool cell's text when the amount changes, which removes the tag. The MutationObserver redraws it about 300 ms later.
- **Live check (Lone Star R5, 2026-11-12, 2 min):** #6 Win +$172 ×1.9 and Place +$83 ×2.1; estimated probables inflow $493 against the actual pool growth of $743 → $1,239.

## Fair odds (v2.4)
`fairOdds(win)` = (100 − Win %) ÷ Win %, shown as odds-to-1 (one decimal under 10-1, whole numbers above). It's a white pill next to the Win % pill. It uses the Trackside Win % as published (not re-normalized for scratches).
When the current TVG odds (`.race-current-odds`) are **higher** than fair (an overlay, i.e. value), the pill becomes deep green (`.kb-fair-value`). Scratched horses and horses with no odds yet stay white. It's re-checked on every odds update.

## Estimated $2 payouts in the Pools table (v2.6)
`renderPoolPayouts` adds a blue line under each Win/Place/Show amount, plus a legend under the "Pools" title. Since v2.7 it shows **odds-to-1** (`fmtOddsTo1`: two decimals under 1-1, one under 10-1, whole numbers above). The $2 payout is in the hover.
- Net pool = pool total ("All" row, or the sum of the horses) × (1 − `WPS_TAKEOUT` 0.17).
- Win: $2 × net ÷ money on the horse. Place: profit = (net − horse − the other placer) ÷ 2 ÷ horse. Show: same with 3 horses ÷ 3.
- Place/Show show the approximate low end (no `~` prefix since v2.8), with the other spots filled by the most-backed horses. The hover shows the range (most- vs least-backed others).
- If a horse's Place or Show odds (low end) are higher than its Win odds, that estimate becomes a green pill (`.kb-pp-better`).
- Rounded down to the cent (Churchill pays to the penny) with a $2.10 minimum. Scratched ($0) horses are skipped.
- Checked on Churchill Downs R1, 2026-11-15, winner #5: est. Win $5.16 vs actual $5.12; Place ~$2.98 vs $2.90; Show ~$2.54 vs $2.46.

## Color scales
- Odds change: ≤−60 dark green, ≤−35 green, ≤−15 light green, <−0.5 pale green, ~0 grey, <+50 orange, ≥+50 red.
- Win %: ≥40 dark green, ≥25 green, ≥15 light green, ≥8 yellow, else grey.
- Exacta %: ≥15 dark green, ≥8 green, ≥4 light green, ≥2 yellow, else grey.

## Known limitations / ideas
- The UK `fojtc` and `pace` pages and the UK race card's ranking columns aren't shown.
- After midnight, the new day's data can take up to 30 minutes to appear (check interval).
- `bestExotics` (exacta boxes with Trackside's own hit % and estimated return) isn't shown. That would be a natural next feature.
- Harville is a simple model. It tends to overrate favorites in 2nd place.
- Races not on Trackside (e.g. SE - Orebro; UK coverage on 2026-11-12 was Hereford, Market Rasen and Thurles) only get the odds-change badge.

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
- 2.2: UK feed (Win Model Win %, UK Top Pick tag, Hidden Gems); per-country caches; shared index fetch.
- 2.3: money velocity for the W/P/S pools and Probables.
- 2.4: fair odds pill from the Trackside Win %.
- 2.5: deep green fair-odds pill when the current odds are an overlay.
- 2.6: estimated $2 Win/Place/Show payouts in the Pools table.
- 2.7: Pools estimates shown as odds-to-1 instead of $.
- 2.8: removed the `~` prefix on Place/Show estimates.
- 2.9: green pill when Place/Show odds beat the horse's Win odds.
- 2.10: velocity colors changed to lime / green / dark green, with a new very-hot tier (×3+).
- 2.11: velocity colors switched to the script's existing greens (#a6e3b5 / #3fbf5f / #0b8a2f).
