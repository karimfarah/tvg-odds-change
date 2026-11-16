# TVG Horse Racing M/L vs Current Odds % Change + Trackside Win %

Tampermonkey userscript for [tvg.com](https://www.tvg.com) horse racing cards.

Current version: **2.18** · License: MIT

## What it shows

### 1. M/L vs current odds % change
A colored badge under each runner's odds. Odds shortening (money coming in) is good and shows green; odds drifting is bad and shows orange/red.

| Change from M/L | Color |
|---|---|
| −60% or more | dark green |
| −35% to −59% | green |
| −15% to −34% | light green |
| −1% to −14% | pale green |
| ~0% | grey |
| +1% to +49% | orange |
| +50% or more | red |

### 2. Trackside Win % and tags
Pulls today's **US and UK** cards from [Trackside Handicapper](https://trackside.yourteamstats.com/day.html) and matches horses by name (so track names don't need to match). UK Win % comes from Trackside's Win Model page.

- **Fair odds** pill next to it: (100 − Win %) ÷ Win %, odds-to-1 (25% → 3-1). When the current odds are higher than fair (an overlay, i.e. value), the pill turns **deep green**.
- **Win %** pill under each horse's name: 40%+ dark green, 25–40% green, 15–25% light green, 8–15% yellow, under 8% grey.
- US: **Best Non-Maiden #rank** (blue), **Best Maiden #rank** (purple). Only Trackside's ranked lists are used, not the "Not ranked" (low-confidence) ones.
- UK: **UK Top Pick #rank** (blue), from the Win Model's "Best UK picks by WIN %" ranking.
- Both: **Hidden Gem** (gold).

### 3. Exacta Win %
Exacta chance for each combination, from the Trackside Win % (Harville model, scratched horses removed and the rest re-normalized).

- **When TVG shows a Probables table:** each cell gets its % and the top 8 combos are outlined and ranked. Columns = 1st, rows = 2nd. Switching to Quinella shows either-order chances.
- **When there's no Probables table yet:** a "Top exactas by Trackside Win %" list appears in the Probables box.

### 4. Money velocity
Tracks the money flowing into the Win/Place/Show pools and the Probables (sampled every 15 s, compared with about 5 minutes earlier).
- **Heat** = a horse's share of the *new* money ÷ its share of the pool before. ×2.0 = it's attracting twice its share.
- Race card: `⚡ Win ×1.9 +$172` badges for warm (light green, ×1.4+), hot (green, ×2+) and very hot (dark green, ×3+) horses.
- Pools box: `+$X` under each amount, with `×heat` when warm or hot. A hot horse gets a dark green bar.
- Probables: a payout **dropping** means money is coming in. Estimated $ per combo = pool total ÷ payout. Cells drawing more than their share show `⚡▼drop% +$X`.
- Needs at least $100 of new pool money and $20 on a horse/combo before anything is flagged.

### 5. Estimated odds (Pools table)
Under each Win/Place/Show amount: the estimated odds-to-1 from that horse's money and the pool total (~17% takeout assumed); hover for the $2 payout. Win is exact for the current pool; Place/Show depend on which other horses finish in the money, so they show the approximate low end (hover for the range). A **green pill** marks a safer bet that pays nearly as much as a riskier one on the same horse: Place, or Show, whose $2 payout is at least 70% of the Win (or Place) payout.

### 6. Trackside button
A green **📊 Trackside** button floats at the bottom, just right of TVG's white content area. Drag it anywhere (the position is remembered); click it to open [Trackside Handicapper](https://trackside.yourteamstats.com) in a new tab.

## Caching
Trackside data is saved per country in Tampermonkey storage (shared by all TVG tabs), so badges appear instantly on reload. The script checks Trackside's small index at most every 30 minutes and only re-downloads the day file when it has been re-published or a new day starts.

## Install
1. Install [Tampermonkey](https://www.tampermonkey.net/).
2. In `chrome://extensions` → Tampermonkey → Details, turn on **Allow User Scripts** (or enable Developer mode).
3. Create a new script in Tampermonkey, paste in `tvg-odds-change.user.js`, and save.
4. Reload a TVG race card. When Tampermonkey asks to allow connecting to `trackside.yourteamstats.com`, choose **Always allow domain**.
