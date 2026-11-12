# TVG M/L vs Current Odds % Change + Trackside Win %

Tampermonkey userscript for [tvg.com](https://www.tvg.com) race cards.

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
Pulls today's US card from [Trackside Handicapper](https://trackside.yourteamstats.com/day.html) and matches horses by name (so track names don't need to match).

- **Win %** pill under each horse's name: 40%+ dark green, 25–40% green, 15–25% light green, 8–15% yellow, under 8% grey.
- **Best Non-Maiden #rank** (blue), **Best Maiden #rank** (purple), **Hidden Gem** (gold). Only Trackside's ranked lists are used, not the "Not ranked" (low-confidence) ones.

### 3. Exacta Win %
Exacta chance for each combination, from the Trackside Win % (Harville model, scratched horses removed and the rest re-normalized).

- **When TVG shows a Probables table:** each cell gets its % and the top 8 combos are outlined and ranked. Columns = 1st, rows = 2nd. Switching to Quinella shows either-order chances.
- **When there's no Probables table yet:** a "Top exactas by Trackside Win %" list appears in the Probables box.

## Caching
Trackside data is saved in Tampermonkey storage (shared by all TVG tabs), so badges appear instantly on reload. The script checks Trackside's small index at most every 30 minutes and only re-downloads the day file when it has been re-published or a new day starts.

## Install
1. Install [Tampermonkey](https://www.tampermonkey.net/).
2. In `chrome://extensions` → Tampermonkey → Details, turn on **Allow User Scripts** (or enable Developer mode).
3. Create a new script in Tampermonkey, paste in `tvg-odds-change.user.js`, and save.
4. Reload a TVG race card. When Tampermonkey asks to allow connecting to `trackside.yourteamstats.com`, choose **Always allow domain**.
