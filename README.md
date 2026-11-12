# TVG M/L vs Current Odds % Change

Tampermonkey userscript for [tvg.com](https://www.tvg.com) race cards. It compares each runner's morning-line (M/L) odds with the current odds and shows the % change as a colored badge under the odds.

Odds shortening (money coming in) is good and shows green; odds drifting is bad and shows orange/red.

| Change from M/L | Color |
|---|---|
| −60% or more | dark green |
| −35% to −59% | green |
| −15% to −34% | light green |
| −1% to −14% | pale green |
| ~0% | grey |
| +1% to +49% | orange |
| +50% or more | red |

## Install
1. Install [Tampermonkey](https://www.tampermonkey.net/).
2. In `chrome://extensions` → Tampermonkey → Details, turn on **Allow User Scripts** (or enable Developer mode).
3. Create a new script in Tampermonkey, paste in `tvg-odds-change.user.js`, and save.
4. Reload a TVG race card.

Badges update live as odds change. Hover a badge to see the M/L and current odds.
