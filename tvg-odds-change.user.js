// ==UserScript==
// @name         TVG M/L vs Current Odds % Change
// @namespace    karim.tvg.odds
// @version      1.1
// @description  Shows the % change between morning-line and current odds on TVG race cards, color-coded (shortening = green, drifting = red)
// @match        https://www.tvg.com/*
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  GM_addStyle(`
    .kb-odds-chg {
      display: block;
      margin-top: 3px;
      padding: 1px 4px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 700;
      line-height: 1.4;
      white-space: nowrap;
    }
    /* Odds shortening (negative %) = good, odds drifting (positive %) = bad */
    .kb-chg-huge   { background:#0b8a2f; color:#fff; }   /* -60% or more */
    .kb-chg-big    { background:#3fbf5f; color:#fff; }   /* -35% to -59% */
    .kb-chg-med    { background:#a6e3b5; color:#0a3d18; }/* -15% to -34% */
    .kb-chg-small  { background:#e6f6ea; color:#1d5c2e; }/* -1% to -14% */
    .kb-chg-flat   { background:#e4e4e4; color:#444; }   /* 0% */
    .kb-chg-drift  { background:#fde2c4; color:#8a4b00; }/* +1% to +49% */
    .kb-chg-crash  { background:#d93636; color:#fff; }   /* +50% or more */
  `);

  // Parses TVG odds like "12", "7/2", "11/4", "EVN"/"EVEN" into odds-to-1.
  function parseOdds(txt) {
    if (!txt) return null;
    const s = txt.trim().toUpperCase();
    if (s === 'EVN' || s === 'EVEN' || s === 'EVS') return 1;
    const m = s.match(/^(\d+(?:\.\d+)?)(?:\s*[\/-]\s*(\d+(?:\.\d+)?))?$/);
    if (!m) return null;
    const num = parseFloat(m[1]);
    const den = m[2] ? parseFloat(m[2]) : 1;
    return den ? num / den : null;
  }

  function classFor(pct) {
    if (pct <= -60) return 'kb-chg-huge';
    if (pct <= -35) return 'kb-chg-big';
    if (pct <= -15) return 'kb-chg-med';
    if (pct < -0.5) return 'kb-chg-small';
    if (pct < 0.5)  return 'kb-chg-flat';
    if (pct < 50)   return 'kb-chg-drift';
    return 'kb-chg-crash';
  }

  function update() {
    document.querySelectorAll('.race-morning-odds').forEach(mlEl => {
      const cell = mlEl.closest('td') || mlEl.parentElement;
      if (!cell) return;
      const curEl = cell.querySelector('.race-current-odds');
      let badge = cell.querySelector('.kb-odds-chg');

      const ml = parseOdds(mlEl.textContent);
      const cur = curEl ? parseOdds(curEl.textContent) : null;

      if (ml == null || cur == null || ml === 0) {
        if (badge) badge.remove();
        return;
      }

      const pct = ((cur - ml) / ml) * 100;
      const text = (pct > 0 ? '+' : '') + pct.toFixed(0) + '%';
      const cls = 'kb-odds-chg ' + classFor(pct);

      if (!badge) {
        badge = document.createElement('span');
        cell.appendChild(badge);
      }
      // Only touch the DOM if something changed (avoids observer loops).
      if (badge.textContent !== text) badge.textContent = text;
      if (badge.className !== cls) badge.className = cls;
      badge.title = `M/L ${mlEl.textContent.trim()} → Current ${curEl.textContent.trim()}`;
    });
  }

  // TVG is a single-page app and odds refresh live, so re-run on changes (throttled).
  let pending = false;
  const schedule = () => {
    if (pending) return;
    pending = true;
    setTimeout(() => { pending = false; update(); }, 300);
  };

  new MutationObserver(muts => {
    // Ignore mutations caused only by our own badges.
    if (muts.every(m => m.target.classList && m.target.classList.contains('kb-odds-chg'))) return;
    schedule();
  }).observe(document.body, { childList: true, subtree: true, characterData: true });

  update();
})();
