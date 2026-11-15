// ==UserScript==
// @name         TVG M/L vs Current Odds % Change + Trackside Win %
// @namespace    karim.tvg.odds
// @version      2.11
// @description  On TVG race cards: % change from M/L to current odds, Trackside Win % and fair odds per horse, Best Non-Maiden / Best Maiden / UK Top Pick / Hidden Gem tags (US + UK), exacta Win % on the Probables table, and money velocity (pools + probables)
// @match        https://www.tvg.com/*
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      trackside.yourteamstats.com
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const TS_BASE = 'https://trackside.yourteamstats.com/published/';
  const TS_CHECK_MS = 30 * 60 * 1000;   // how often to check Trackside's small index for a re-publish
  const TS_CACHE_KEY = 'tsCache.v2';    // saved in Tampermonkey storage, shared by all TVG tabs
  const TOP_EXACTAS = 8;                // how many exactas to list / highlight

  GM_addStyle(`
    /* ---------- M/L vs current odds badge ---------- */
    .kb-odds-chg { display:block; margin-top:3px; padding:1px 4px; border-radius:4px;
      font-size:11px; font-weight:700; line-height:1.4; white-space:nowrap; }
    /* Odds shortening (negative %) = good, odds drifting (positive %) = bad */
    .kb-chg-huge  { background:#0b8a2f; color:#fff; }    /* -60% or more */
    .kb-chg-big   { background:#3fbf5f; color:#fff; }    /* -35% to -59% */
    .kb-chg-med   { background:#a6e3b5; color:#0a3d18; } /* -15% to -34% */
    .kb-chg-small { background:#e6f6ea; color:#1d5c2e; } /* -1% to -14% */
    .kb-chg-flat  { background:#e4e4e4; color:#444; }    /* 0% */
    .kb-chg-drift { background:#fde2c4; color:#8a4b00; } /* +1% to +49% */
    .kb-chg-crash { background:#d93636; color:#fff; }    /* +50% or more */

    /* ---------- Trackside Win % and tags next to the horse name ---------- */
    /* !important because TVG's own CSS strips padding/radius from spans */
    .kb-ts { display:flex !important; flex-wrap:wrap; gap:4px; width:100%; margin:2px 0 1px 0 !important; }
    .kb-pill { display:inline-block !important; padding:1px 7px !important; border-radius:10px !important;
      font-size:11px !important; font-weight:700 !important; line-height:1.5 !important; white-space:nowrap; }
    .kb-exlist .kb-pill { min-width:44px; text-align:center; }
    .kb-fair    { background:#fff; color:#333; box-shadow: inset 0 0 0 1px #999; } /* fair odds */
    .kb-fair.kb-fair-value { background:#0a5c26 !important; color:#fff !important; box-shadow:none; } /* overlay */
    .kb-tag-nm  { background:#1f4fd1; color:#fff; }   /* Best Non-Maiden */
    .kb-tag-m   { background:#7b2fd1; color:#fff; }   /* Best Maiden */
    .kb-tag-gem { background:#d1a11f; color:#2b2000; }/* Hidden Gem */

    /* Win % colors (higher = better) */
    .kb-w5 { background:#0b8a2f; color:#fff; }
    .kb-w4 { background:#3fbf5f; color:#fff; }
    .kb-w3 { background:#a6e3b5; color:#0a3d18; }
    .kb-w2 { background:#f3e7a1; color:#5a4a00; }
    .kb-w1 { background:#e4e4e4; color:#555; }

    /* ---------- Probables table overlay ---------- */
    .kb-ex { display:block !important; margin-top:1px !important; padding:0 3px !important; border-radius:3px !important;
      font-size:10px !important; font-weight:700 !important; line-height:1.4 !important; white-space:nowrap; }
    .kb-ex-top { outline:2px solid #0b8a2f !important; outline-offset:-2px; border-radius:3px; }

    /* ---------- Top exactas list (when TVG has no Probables table) ---------- */
    .kb-exlist { margin:8px 0 4px; font-size:12px; }
    .kb-exlist h4 { margin:0 0 6px; font-size:13px; font-weight:700; }
    .kb-exlist table { width:100%; border-collapse:collapse; }
    .kb-exlist td { padding:3px 4px; border-bottom:1px solid #e5e5e5; vertical-align:middle; }
    .kb-exlist td.kb-combo { font-weight:700; white-space:nowrap; }
    .kb-exlist .kb-note { margin-top:4px; font-size:10px; color:#777; }
    /* ---------- Money velocity ---------- */
    /* same greens as the Win % and odds-change badges */
    .kb-v4 { background:#0b8a2f; color:#fff; }     /* very hot: ×3+ its share of new money (dark green) */
    .kb-v3 { background:#3fbf5f; color:#fff; }     /* hot: ×2+ (green) */
    .kb-v2 { background:#a6e3b5; color:#0a3d18; }  /* warm: ×1.4+ (light green) */
    .kb-v1 { background:#eeeeee; color:#666; }     /* normal */
    .kb-v0 { background:#dbe4ff; color:#364fc7; }  /* cold: well below its share */
    .kb-vel { display:flex !important; flex-wrap:wrap; gap:4px; width:100%; margin:2px 0 1px 0 !important; }
    .kb-pa, .kb-pv { display:block !important; margin-top:1px !important; padding:0 3px !important; border-radius:3px !important;
      font-size:10px !important; font-weight:700 !important; line-height:1.4 !important; white-space:nowrap; }
    .kb-pool-hot { box-shadow: inset 3px 0 0 #0b8a2f; }
    /* ---------- Estimated $2 payouts in the Pools table ---------- */
    .kb-pp { display:block !important; font-size:10px !important; font-weight:700 !important; color:#1c5fa8 !important;
      line-height:1.3 !important; white-space:nowrap; }
    .kb-pp-note { font-size:10px; color:#777; margin:-4px 0 4px; }
    .kb-pp.kb-pp-better { display:inline-block !important; background:#2b8a3e; color:#fff !important;
      border-radius:8px !important; padding:0 6px !important; margin-top:1px; }
    .kb-pv-hot { box-shadow: inset 0 0 0 2px #0b8a2f; }
  `);

  /* =====================================================================
     Shared helpers
     ===================================================================== */

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

  // "St. Armand's Key (IRE)" -> "STARMANDSKEY"
  const normName = s => (s || '').toUpperCase().replace(/\(.*?\)/g, '').replace(/[^A-Z0-9]/g, '');
  const normNum = s => (s || '').toUpperCase().replace(/[^0-9A-Z]/g, '');
  const pctNum = s => { const v = parseFloat((s || '').replace('%', '')); return isNaN(v) ? null : v; };

  function setText(el, text) { if (el.textContent !== text) el.textContent = text; }
  function setClass(el, cls) { if (el.className !== cls) el.className = cls; }

  /* =====================================================================
     Feature 1: M/L vs current odds % change
     ===================================================================== */

  function oddsClass(pct) {
    if (pct <= -60) return 'kb-chg-huge';
    if (pct <= -35) return 'kb-chg-big';
    if (pct <= -15) return 'kb-chg-med';
    if (pct < -0.5) return 'kb-chg-small';
    if (pct < 0.5)  return 'kb-chg-flat';
    if (pct < 50)   return 'kb-chg-drift';
    return 'kb-chg-crash';
  }

  function updateOddsChange() {
    document.querySelectorAll('.race-morning-odds').forEach(mlEl => {
      const cell = mlEl.closest('td') || mlEl.parentElement;
      if (!cell) return;
      const curEl = cell.querySelector('.race-current-odds');
      let badge = cell.querySelector('.kb-odds-chg');
      const ml = parseOdds(mlEl.textContent);
      const cur = curEl ? parseOdds(curEl.textContent) : null;

      if (ml == null || cur == null || ml === 0) { if (badge) badge.remove(); return; }

      const pct = ((cur - ml) / ml) * 100;
      if (!badge) { badge = document.createElement('span'); cell.appendChild(badge); }
      setText(badge, (pct > 0 ? '+' : '') + pct.toFixed(0) + '%');
      setClass(badge, 'kb-odds-chg kb-own ' + oddsClass(pct));
      badge.title = `M/L ${mlEl.textContent.trim()} → Current ${curEl.textContent.trim()}`;
    });
  }

  /* =====================================================================
     Feature 2: Trackside data (download + parse)
     ===================================================================== */

  // One feed per Trackside country. Each keeps its own data, cache and check timer.
  const FEEDS = {
    us: { country: 'us', data: null, loading: false, lastCheck: 0 },
    uk: { country: 'uk', data: null, loading: false, lastCheck: 0 },
  };
  const allRaces = () => Object.values(FEEDS).flatMap(f => f.data ? f.data.races : []);
  const tagsFor = race => {
    const f = FEEDS[race.feed];
    return (f && f.data && f.data.tags.get(race.tagPrefix + race.keyFor)) || [];
  };

  function gmGet(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET', url, timeout: 30000,
        onload: r => (r.status >= 200 && r.status < 300) ? resolve(r.responseText) : reject(new Error('HTTP ' + r.status + ' ' + url)),
        onerror: () => reject(new Error('Network error ' + url)),
        ontimeout: () => reject(new Error('Timeout ' + url)),
      });
    });
  }

  const todayLocal = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD

  // The small index (~30 KB) is shared by both feeds; fetch it at most once per check round.
  let indexPromise = null, indexAt = 0;
  function getIndex() {
    if (!indexPromise || Date.now() - indexAt > 60 * 1000) {
      indexAt = Date.now();
      indexPromise = gmGet(TS_BASE + 'index.json').then(JSON.parse);
      indexPromise.catch(() => { indexPromise = null; });
    }
    return indexPromise;
  }

  // Today's entry { date, publishedAt } for a country, or its most recent earlier day.
  async function pickDay(country) {
    const today = todayLocal();
    const ix = await getIndex();
    const days = (ix.days || []).filter(d => d.country === country && d.date <= today)
      .sort((a, b) => a.date.localeCompare(b.date));
    const day = days.find(d => d.date === today) || days[days.length - 1];
    return day ? { date: day.date, publishedAt: day.publishedAt || '' } : null;
  }

  // ---- Saved cache (Tampermonkey storage): only the parsed races + tags (~tens of KB per feed) ----
  const cacheKey = country => `${TS_CACHE_KEY}.${country}`; // e.g. tsCache.v2.us / tsCache.v2.uk
  function readCache(country) {
    try {
      const c = GM_getValue(cacheKey(country), null);
      if (!c || !c.races) return null;
      return { date: c.date, publishedAt: c.publishedAt, checkedAt: c.checkedAt || 0,
               races: c.races, tags: new Map(c.tags || []) };
    } catch (e) { return null; }
  }
  function writeCache(country, ts, checkedAt) {
    try {
      GM_setValue(cacheKey(country), { date: ts.date, publishedAt: ts.publishedAt, checkedAt,
                                       races: ts.races, tags: [...ts.tags] });
    } catch (e) { console.warn('[KB TVG] cache write failed', e); }
  }

  // Reads a Trackside table into objects keyed by its header names.
  function tableRecords(table) {
    const rows = [...table.rows];
    const hIdx = rows.findIndex(r => [...r.cells].some(c => c.textContent.trim() === 'Track'));
    if (hIdx < 0) return [];
    const heads = [...rows[hIdx].cells].map(c => c.textContent.trim());
    return rows.slice(hIdx + 1).map(r => {
      const o = {};
      [...r.cells].forEach((c, i) => { o[heads[i]] = c.textContent.trim(); });
      return o;
    }).filter(o => o.Track && o.Name);
  }

  // US "4 GRAY DAY" or UK "(3) Koala Rose" -> { num, name }
  function splitNumName(s) {
    const t = (s || '').trim();
    const m = t.match(/^\((\d+[A-Z]?)\)\s*(.+)$/i) || t.match(/^(\d+[A-Z]?)\s+(.+)$/i);
    return m ? { num: m[1], name: m[2] } : { num: '', name: t };
  }

  // Reads "header table, then runners table" pairs. headRe must capture (track, raceId).
  function parseRaceTables(doc, headRe, feed) {
    const races = [];
    if (!doc) return races;
    const tables = [...doc.querySelectorAll('table')];
    for (let i = 0; i < tables.length - 1; i++) {
      const firstRow = tables[i].rows[0];
      const head = (firstRow ? firstRow.textContent : '').replace(/\s+/g, ' ').trim();
      const m = head.match(headRe);
      if (!m) continue;
      const rows = [...tables[i + 1].rows];
      if (!rows.length) continue;
      const heads = [...rows[0].cells].map(c => c.textContent.trim());
      const nameIdx = heads.indexOf('Name');
      const winIdx = heads.indexOf('WIN %');
      if (nameIdx < 0 || winIdx < 0) continue;
      const runners = rows.slice(1).map(r => {
        const nn = splitNumName(r.cells[nameIdx] && r.cells[nameIdx].textContent);
        return { num: nn.num, name: nn.name, key: normName(nn.name), win: pctNum(r.cells[winIdx] && r.cells[winIdx].textContent) };
      }).filter(r => r.key && r.win != null);
      const track = m[1].trim(), raceId = m[2].trim();
      // tagPrefix + horse key = the lookup key in this feed's tag map
      races.push({ feed, track, race: raceId, tagPrefix: `${track.toUpperCase()}|${raceId}|`, runners });
      i++; // skip the runners table
    }
    return races;
  }

  function parseTrackside(json, country) {
    const page = key => {
      const p = (json.pages || []).find(x => x.key === key);
      return p ? new DOMParser().parseFromString(p.html, 'text/html') : null;
    };
    const tags = new Map(); // "TRACK|RACE|NAMEKEY" -> [ {cls, text, title} ]
    const addTag = (track, race, name, tag) => {
      const k = `${track.toUpperCase()}|${race}|${normName(splitNumName(name).name)}`;
      if (!tags.has(k)) tags.set(k, []);
      if (!tags.get(k).some(t => t.text === tag.text)) tags.get(k).push(tag);
    };
    const gems = doc => {
      if (doc) doc.querySelectorAll('table').forEach(t => tableRecords(t).forEach(rec =>
        addTag(rec.Track, rec.Race, rec.Name, { cls: 'kb-tag-gem', text: 'Hidden Gem', title: 'Trackside Hidden Gem' })));
    };

    if (country === 'uk') {
      // ---- UK: Win %s come from the Win Model page ----
      // Race header row: "Thursday November 12th 2026 - Market Rasen 15:36"; race id = "Market Rasen 15:36"
      const wm = page('winModel');
      const races = parseRaceTables(wm, /^.*?\d{4}\s+-\s+(.+?)\s+(\d{1,2}:\d{2})$/, 'uk')
        .map(r => {
          const raceId = `${r.track} ${r.race}`;
          return { ...r, race: raceId, tagPrefix: `${r.track.toUpperCase()}|${raceId}|` };
        });
      // Top horses: the ranked "Best UK picks by WIN %" table (first table on the Win Model page)
      const top = wm && wm.querySelector('table');
      if (top) tableRecords(top).forEach(rec => addTag(rec.Track, rec.Race, rec.Name, {
        cls: 'kb-tag-nm', text: `UK Top Pick${rec.Rank ? ' #' + rec.Rank : ''}`,
        title: `Win Model rank ${rec.Rank || '-'} · WIN ${rec['WIN %'] || '-'}% · lead ${rec.Lead || '-'}`,
      }));
      gems(page('hiddenGems'));
      return { date: json.date, races, tags };
    }

    // ---- US: race cards "TRACK 2026-11-12 Race: N at ..." ----
    const races = parseRaceTables(page('card'), /^(.*?)\s+\d{4}-\d{2}-\d{2}\s+Race:\s*(\d+)/, 'us');
    // Best Non-Maidens / Best Maidens: first table = ranked list ("Not ranked" is the second)
    const ranked = (key, cls, label) => {
      const doc = page(key);
      const t = doc && doc.querySelector('table');
      if (!t) return;
      tableRecords(t).forEach(rec => addTag(rec.Track, rec.Race, rec.Name, {
        cls, text: `${label}${rec.Rank ? ' #' + rec.Rank : ''}`,
        title: `${label} rank ${rec.Rank || '-'} · Blend ${rec['Blend %'] || '-'} · ${rec.Note || ''}`.trim(),
      }));
    };
    ranked('bestNonMaidens', 'kb-tag-nm', 'Best Non-Maiden');
    ranked('bestMaidens', 'kb-tag-m', 'Best Maiden');
    gems(page('hiddenGems'));
    return { date: json.date, races, tags };
  }

  // Per feed:
  // 1. Use the saved cache straight away (no network) so badges appear instantly.
  // 2. At most every 30 minutes (shared across tabs), fetch only the small index.json.
  // 3. Download the big day file only if the day or its publishedAt changed.
  async function loadFeed(f) {
    if (f.loading) return;
    // Checked (or failed) within the last 30 min? Do nothing. This runs on every page update.
    const fresh = () => Date.now() - f.lastCheck < TS_CHECK_MS;
    if (fresh()) return;

    // Load (or re-read) the saved cache; another tab may have refreshed it.
    const saved = readCache(f.country);
    if (saved) {
      if (!f.data || f.data.date !== saved.date || f.data.publishedAt !== saved.publishedAt) { f.data = saved; schedule(); }
      f.lastCheck = Math.max(f.lastCheck, saved.checkedAt);
      if (fresh()) return;
    }

    f.loading = true;
    try {
      const day = await pickDay(f.country);
      const now = Date.now();
      if (!day) {
        console.info(`[KB TVG] Trackside ${f.country}: no published day yet`);
      } else if (saved && saved.date === day.date && saved.publishedAt === day.publishedAt) {
        writeCache(f.country, f.data || saved, now); // just refresh the "checked" time
        console.info(`[KB TVG] Trackside ${f.country} ${day.date} unchanged (published ${day.publishedAt}) – using cache`);
      } else {
        const json = JSON.parse(await gmGet(`${TS_BASE}${f.country}-${day.date}.json`));
        f.data = parseTrackside(json, f.country);
        f.data.publishedAt = json.publishedAt || day.publishedAt;
        writeCache(f.country, f.data, now);
        console.info(`[KB TVG] Trackside ${f.country} ${f.data.date} downloaded: ${f.data.races.length} races, ${f.data.tags.size} tagged horses`);
      }
      f.lastCheck = now;
      schedule();
    } catch (e) {
      console.warn(`[KB TVG] Trackside ${f.country} check failed – keeping cached data`, e);
      f.lastCheck = Date.now(); // don't hammer the site; retry after the check interval
    } finally {
      f.loading = false;
    }
  }
  const loadTrackside = () => Object.values(FEEDS).forEach(loadFeed);

  /* =====================================================================
     Feature 3: Win % + tags on the TVG runners
     ===================================================================== */

  function winClass(p) {
    if (p >= 40) return 'kb-w5';
    if (p >= 25) return 'kb-w4';
    if (p >= 15) return 'kb-w3';
    if (p >= 8)  return 'kb-w2';
    return 'kb-w1';
  }

  function exClass(p) {
    if (p >= 15) return 'kb-w5';
    if (p >= 8)  return 'kb-w4';
    if (p >= 4)  return 'kb-w3';
    if (p >= 2)  return 'kb-w2';
    return 'kb-w1';
  }

  // Fair odds-to-1 from a win %: 25% -> "3-1", 40% -> "1.5-1", 6.9% -> "13-1".
  function fairOdds(winPct) {
    if (!(winPct > 0) || winPct >= 100) return null;
    const o = (100 - winPct) / winPct;
    return { odds: o, text: (o < 10 ? o.toFixed(1).replace(/\.0$/, '') : Math.round(o)) + '-1' };
  }

  // Reads the runners currently shown on the TVG race card.
  function tvgRunners() {
    return [...document.querySelectorAll('tr.program-page-runner')].map(row => {
      const numEl = row.querySelector('.horse-number-label');
      const nameEl = row.querySelector('.horse-info-row .horse-info-cell strong.h5') ||
                     row.querySelector('.horse-info-cell strong');
      if (!numEl || !nameEl) return null;
      return {
        row, nameEl,
        num: numEl.textContent.trim(),
        name: nameEl.textContent.trim(),
        key: normName(nameEl.textContent),
        scratched: /SCRATCHED/i.test(row.textContent),
      };
    }).filter(Boolean);
  }

  // Finds the Trackside race whose horse names best match the TVG card.
  function matchRace(runners) {
    if (!runners.length) return null;
    const keys = new Set(runners.map(r => r.key));
    let best = null, bestHits = 0;
    for (const race of allRaces()) {
      let hits = 0;
      for (const r of race.runners) if (keys.has(r.key)) hits++;
      if (hits > bestHits) { best = race; bestHits = hits; }
    }
    const needed = Math.min(2, runners.length);
    return bestHits >= needed ? best : null;
  }

  function updateRunners(runners, race) {
    const byKey = new Map(race ? race.runners.map(r => [r.key, r]) : []);
    const byNum = new Map(race ? race.runners.map(r => [normNum(r.num), r]) : []);

    runners.forEach(r => {
      const cell = r.nameEl.parentElement;
      let box = cell.querySelector('.kb-ts');
      const ts = race ? (byKey.get(r.key) || byNum.get(normNum(r.num))) : null;

      if (!ts) { if (box) box.remove(); r.ts = null; return; }
      r.ts = ts;

      if (!box) { box = document.createElement('span'); box.className = 'kb-ts kb-own'; r.nameEl.after(box); }

      const pills = [{ cls: 'kb-pill ' + winClass(ts.win), text: `Win ${ts.win.toFixed(1)}%`, title: 'Trackside WIN %' }];
      const fair = fairOdds(ts.win);
      if (fair) {
        // Overlay = the current odds pay MORE than the fair odds -> deep green.
        const curEl = r.row.querySelector('.race-current-odds');
        const cur = curEl ? parseOdds(curEl.textContent) : null;
        const value = cur != null && !r.scratched && cur > fair.odds;
        pills.push({ cls: 'kb-pill kb-fair' + (value ? ' kb-fair-value' : ''), text: `Fair ${fair.text}`,
          title: `Fair odds for a ${ts.win.toFixed(1)}% chance: (100 − ${ts.win.toFixed(1)}) ÷ ${ts.win.toFixed(1)} = ${fair.text}. ` +
                 (value ? `Current odds ${curEl.textContent.trim()} pay more than fair: overlay (value).`
                        : `Current odds above this would be an overlay (value).`) });
      }
      const tags = tagsFor({ ...race, keyFor: ts.key });
      tags.forEach(t => pills.push({ cls: 'kb-pill ' + t.cls, text: t.text, title: t.title }));

      const sig = pills.map(p => p.cls + p.text).join('|');
      if (box.dataset.sig === sig) return; // nothing changed
      box.dataset.sig = sig;
      box.textContent = '';
      pills.forEach(p => {
        const s = document.createElement('span');
        s.className = p.cls; s.textContent = p.text; s.title = p.title;
        box.appendChild(s);
      });
    });
  }

  /* =====================================================================
     Feature 4: Exacta Win % (Harville model from the Trackside WIN %)
     ===================================================================== */

  // Win probabilities (0-1) for non-scratched horses, re-normalised to sum to 1.
  function winProbs(runners) {
    const live = runners.filter(r => r.ts && !r.scratched);
    const total = live.reduce((s, r) => s + r.ts.win, 0);
    const p = new Map();
    if (total > 0) live.forEach(r => p.set(normNum(r.num), r.ts.win / total));
    return p;
  }

  // P(a wins, b second) = pa * pb / (1 - pa)
  const exactaP = (P, a, b) => {
    const pa = P.get(a), pb = P.get(b);
    if (pa == null || pb == null || a === b || pa >= 1) return null;
    return pa * pb / (1 - pa);
  };

  function allExactas(P, runners) {
    const nums = [...P.keys()];
    const nameOf = new Map(runners.map(r => [normNum(r.num), r.name]));
    const list = [];
    nums.forEach(a => nums.forEach(b => {
      const p = exactaP(P, a, b);
      if (p != null) list.push({ a, b, p: p * 100, names: `${nameOf.get(a) || ''} / ${nameOf.get(b) || ''}` });
    }));
    return list.sort((x, y) => y.p - x.p);
  }

  function probablesContainer() {
    const h = [...document.querySelectorAll('.pcontainer h2')].find(e => e.textContent.trim() === 'Probables');
    return h ? h.parentElement : null;
  }

  function updateProbables(runners, race) {
    const pc = probablesContainer();
    if (!pc) return;
    const table = pc.querySelector('.probables-table');
    let list = pc.querySelector('.kb-exlist');

    const P = race ? winProbs(runners) : new Map();
    if (P.size < 2) {
      if (list) list.remove();
      pc.querySelectorAll('.kb-ex').forEach(e => e.remove());
      pc.querySelectorAll('.kb-ex-top').forEach(e => e.classList.remove('kb-ex-top'));
      return;
    }
    const ranked = allExactas(P, runners);

    if (table) {
      if (list) list.remove();
      annotateProbablesTable(pc, table, P, ranked);
    } else {
      renderExactaList(pc, list, ranked);
    }
  }

  // TVG grid: column headers = horse finishing 1st, left sticky column = horse finishing 2nd.
  function annotateProbablesTable(pc, table, P, ranked) {
    const sel = pc.querySelector('select.cb-bettype');
    const betType = sel && sel.selectedOptions[0] ? sel.selectedOptions[0].textContent.trim().toLowerCase() : 'exacta';
    const quinella = betType.includes('quinella');

    const rows = [...table.querySelectorAll('.probables-row')];
    if (rows.length < 2) return;
    const firstNums = [...rows[0].children].map(c => normNum(c.textContent));
    const secondNums = [...pc.querySelectorAll('.sticky-col .sticky-cell:not(.diagonal-cell)')].map(c => normNum(c.textContent));

    // Rank of each combo so the top N can be outlined.
    const rankOf = new Map();
    if (quinella) {
      const seen = new Set(), q = [];
      ranked.forEach(e => {
        const k = [e.a, e.b].sort().join('-');
        if (seen.has(k)) return; seen.add(k);
        q.push({ k, p: (exactaP(P, e.a, e.b) + exactaP(P, e.b, e.a)) * 100 });
      });
      q.sort((x, y) => y.p - x.p).slice(0, TOP_EXACTAS).forEach((e, i) => rankOf.set(e.k, i + 1));
    } else {
      ranked.slice(0, TOP_EXACTAS).forEach((e, i) => rankOf.set(`${e.a}-${e.b}`, i + 1));
    }

    rows.slice(1).forEach((row, ri) => {
      const second = secondNums[ri];
      [...row.children].forEach((cell, ci) => {
        const first = firstNums[ci];
        let p = exactaP(P, first, second);
        if (p != null && quinella) p += exactaP(P, second, first);
        let tag = cell.querySelector('.kb-ex');
        if (p == null) { if (tag) tag.remove(); cell.classList.remove('kb-ex-top'); return; }
        p *= 100;
        const rank = rankOf.get(quinella ? [first, second].sort().join('-') : `${first}-${second}`);
        if (!tag) { tag = document.createElement('span'); cell.appendChild(tag); }
        setClass(tag, 'kb-ex kb-own ' + exClass(p));
        const text = (rank ? `#${rank} ` : '') + p.toFixed(1) + '%';
        setText(tag, text);
        tag.title = `${quinella ? 'Quinella' : 'Exacta'} ${first}-${second}: ${p.toFixed(1)}% (Trackside Win %)`;
        cell.classList.toggle('kb-ex-top', !!rank);
      });
    });
  }

  function renderExactaList(pc, list, ranked) {
    const body = pc.querySelector('.panel-body') || pc;
    if (!list) {
      list = document.createElement('div');
      list.className = 'kb-exlist kb-own';
      body.appendChild(list);
    }
    const top = ranked.slice(0, TOP_EXACTAS);
    const sig = top.map(e => `${e.a}-${e.b}:${e.p.toFixed(1)}`).join('|');
    if (list.dataset.sig === sig) return;
    list.dataset.sig = sig;

    list.textContent = '';
    const h = document.createElement('h4');
    h.textContent = 'Top exactas by Trackside Win %';
    list.appendChild(h);
    const t = document.createElement('table');
    top.forEach((e, i) => {
      const tr = t.insertRow();
      tr.insertCell().textContent = `#${i + 1}`;
      const combo = tr.insertCell(); combo.className = 'kb-combo'; combo.textContent = `${e.a} - ${e.b}`;
      tr.insertCell().textContent = e.names;
      const pc2 = tr.insertCell();
      const pill = document.createElement('span');
      pill.className = 'kb-pill ' + exClass(e.p);
      pill.textContent = e.p.toFixed(1) + '%';
      pc2.appendChild(pill);
    });
    list.appendChild(t);
    const note = document.createElement('div');
    note.className = 'kb-note';
    note.textContent = 'Chance the first horse wins and the second runs 2nd, from Trackside WIN % (scratches removed).';
    list.appendChild(note);
  }

  /* =====================================================================
     Feature 5: Money velocity (Win/Place/Show pools + Probables)
     ---------------------------------------------------------------------
     Every VEL_SAMPLE_MS the pool amounts and probable payouts are recorded
     (history saved in Tampermonkey storage, so it survives reloads).
     Pools:     heat = (horse's share of the NEW money) / (its share of the pool
                before). heat 2.0 = taking twice its share of the money coming in.
     Probables: a payout falls when money comes in on that combo. Money on a
                combo ≈ (pool total × (1 − takeout)) / payout, so the payouts plus
                the Pool Total give an estimated $ per combo, and the same
                "share of new money" heat is used as for the pools. Thin combos
                (big payouts that swing on a $1 bet) don't trigger it.
     ===================================================================== */

  const VEL_WINDOW_MS = 5 * 60 * 1000;   // compare against ~5 minutes ago
  const VEL_MIN_SPAN_MS = 60 * 1000;     // need at least 1 minute of history
  const VEL_SAMPLE_MS = 15 * 1000;       // take a sample every 15 s
  const VEL_KEEP_MS = 30 * 60 * 1000;    // keep 30 min of samples per race
  const VEL_STORE_TTL = 6 * 60 * 60 * 1000;
  const VEL_STORE = 'vel.v1';
  const VEL_MIN_DOLLARS = 100;           // ignore a pool that took in less than this
  const VEL_MIN_HORSE = 20;              // a horse/combo needs this much new money to be warm/hot
  const VEL_TAKEOUT = 0.2;               // approx. exotic takeout, for estimating $ per combo

  // "$1,228.83" / "$4.9K" -> number
  const money = s => {
    const m = (s || '').replace(/[$,\s]/g, '').match(/^(\d+(?:\.\d+)?)([KM])?$/i);
    if (!m) return null;
    return parseFloat(m[1]) * (m[2] ? (m[2].toUpperCase() === 'K' ? 1e3 : 1e6) : 1);
  };
  // Text of an element without anything this script added to it.
  const ownText = el => [...el.childNodes]
    .filter(n => !(n.nodeType === 1 && n.classList.contains('kb-own')))
    .map(n => n.textContent).join('').trim();

  function containerByTitle(title) {
    const h = [...document.querySelectorAll('.pcontainer h2')].find(e => e.textContent.trim() === title);
    return h ? h.parentElement : null;
  }

  const POOLS = ['win', 'place', 'show'];
  function readPools() {
    const pc = containerByTitle('Pools');
    if (!pc) return null;
    const out = { win: {}, place: {}, show: {} };
    let any = false;
    pc.querySelectorAll('runner-amounts').forEach(row => {
      const num = normNum(ownText(row.querySelector('.chicklet .label') || row));
      const cells = [...row.querySelectorAll('.amounts')];
      cells.slice(0, 3).forEach((c, i) => {
        const v = money(ownText(c));
        if (num && v != null) { out[POOLS[i]][num] = v; any = true; }
      });
    });
    return any ? out : null;
  }

  // Probables payouts keyed "exacta:4-2" (column = 1st, row = 2nd).
  function readProbables() {
    const pc = probablesContainer();
    const table = pc && pc.querySelector('.probables-table');
    if (!table) return null;
    const sel = pc.querySelector('select.cb-bettype');
    const bt = sel && sel.selectedOptions[0] ? sel.selectedOptions[0].textContent.trim().toLowerCase() : 'exacta';
    const rows = [...table.querySelectorAll('.probables-row')];
    if (rows.length < 2) return null;
    const firstNums = [...rows[0].children].map(c => normNum(ownText(c)));
    const secondNums = [...pc.querySelectorAll('.sticky-col .sticky-cell:not(.diagonal-cell)')].map(c => normNum(ownText(c)));
    const out = {};
    rows.slice(1).forEach((row, ri) => [...row.children].forEach((cell, ci) => {
      const v = money(ownText(cell));
      if (v != null && v > 0) out[`${bt}:${firstNums[ci]}-${secondNums[ri]}`] = v;
    }));
    if (!Object.keys(out).length) return null;
    const total = money(ownText(pc.querySelector('.pool-amount strong') || pc.querySelector('.pool-amount') || pc));
    if (total) out._total = total; // probables pool total, used to estimate $ per combo
    return out;
  }

  // ---- History store ----
  let VEL = null;
  const velTouched = new Set();
  let velSavedAt = 0;
  function velStore() {
    if (!VEL) {
      try { VEL = GM_getValue(VEL_STORE, {}) || {}; } catch (e) { VEL = {}; }
      const now = Date.now();
      for (const k of Object.keys(VEL)) if (now - (VEL[k].at || 0) > VEL_STORE_TTL) delete VEL[k];
    }
    return VEL;
  }
  function velSave(force) {
    if (!velTouched.size || (!force && Date.now() - velSavedAt < 30 * 1000)) return;
    try {
      // Merge with what other tabs saved, so tabs don't wipe each other's races.
      const disk = GM_getValue(VEL_STORE, {}) || {};
      const now = Date.now();
      for (const k of Object.keys(disk)) if (now - (disk[k].at || 0) > VEL_STORE_TTL) delete disk[k];
      velTouched.forEach(k => { if (VEL[k]) disk[k] = VEL[k]; });
      GM_setValue(VEL_STORE, disk);
      velTouched.clear();
      velSavedAt = now;
    } catch (e) { console.warn('[KB TVG] velocity save failed', e); }
  }
  window.addEventListener('beforeunload', () => velSave(true));

  // Same track page + same runners = same race.
  const raceKey = runners => location.pathname + '|' + runners.map(r => r.num + r.key).join(',');

  let velLastSample = 0;
  function velSample(key) {
    const now = Date.now();
    if (now - velLastSample < VEL_SAMPLE_MS) return;
    const pools = readPools(), probs = readProbables();
    if (!pools && !probs) return;
    velLastSample = now;
    const st = velStore();
    const h = st[key] || (st[key] = { at: now, snaps: [] });
    const last = h.snaps[h.snaps.length - 1];
    // A pool total that went DOWN means TVG reset or switched data: start over.
    const total = p => p ? Object.values(p.win).reduce((a, b) => a + b, 0) : 0;
    if (last && pools && last.pools && total(pools) + 1 < total(last.pools)) h.snaps = [];
    const same = last && JSON.stringify([last.pools, last.probs]) === JSON.stringify([pools, probs]);
    if (!same) h.snaps.push({ t: now, pools, probs });
    h.at = now;
    h.snaps = h.snaps.filter(x => now - x.t <= VEL_KEEP_MS).slice(-120);
    velTouched.add(key);
    velSave(false);
  }

  // Baseline = earliest sample inside the window that is at least VEL_MIN_SPAN_MS old,
  // or (if values sat unchanged) the latest sample before the window.
  function velBase(key, field) {
    const h = velStore()[key];
    if (!h) return null;
    const now = Date.now();
    const old = h.snaps.filter(x => x[field] && now - x.t >= VEL_MIN_SPAN_MS);
    if (!old.length) return null;
    return old.find(x => now - x.t <= VEL_WINDOW_MS) || old[old.length - 1];
  }

  function poolHeat(base, cur) {
    const nums = Object.keys(cur).filter(n => base[n] != null && cur[n] > 0); // skip scratched ($0)
    if (nums.length < 2) return null;
    const tot0 = nums.reduce((a, n) => a + base[n], 0);
    const tot1 = nums.reduce((a, n) => a + cur[n], 0);
    const dT = tot1 - tot0;
    if (dT < Math.max(VEL_MIN_DOLLARS, tot0 * 0.01)) return null; // not enough new money to judge
    const res = {};
    nums.forEach(n => {
      const d = Math.max(0, cur[n] - base[n]);
      const share0 = tot0 > 0 ? base[n] / tot0 : 1 / nums.length;
      const inShare = d / dT;
      res[n] = { d, inShare, share0, heat: inShare / Math.max(share0, 0.02) };
    });
    return { dT, res };
  }

  // minShare: the least share of the new money that counts (8% for a horse; much
  // smaller for Probables, where the money is spread over dozens of combos).
  function heatClass(h, minShare = 0.08) {
    const real = h.d >= VEL_MIN_HORSE && h.inShare >= minShare;
    if (real && h.heat >= 3) return 'kb-v4';   // very hot
    if (real && h.heat >= 2) return 'kb-v3';   // hot
    if (real && h.heat >= 1.4) return 'kb-v2'; // warm
    if (h.heat <= 0.5) return 'kb-v0';                      // cold
    return 'kb-v1';                                         // normal
  }
  const isWarm = cls => cls === 'kb-v2' || cls === 'kb-v3' || cls === 'kb-v4';
  const isHot = cls => cls === 'kb-v3' || cls === 'kb-v4';
  const fmtMoney = v => v >= 1000 ? '$' + (v / 1000).toFixed(v >= 10000 ? 0 : 1) + 'K' : '$' + Math.round(v);
  const fmtSpan = ms => Math.max(1, Math.round(ms / 60000)) + 'm';

  function renderPoolVelocity(key) {
    const pc = containerByTitle('Pools');
    const base = velBase(key, 'pools');
    const cur = readPools();
    const heats = {};
    if (base && cur) POOLS.forEach(p => { heats[p] = poolHeat(base.pools[p] || {}, cur[p] || {}); });
    const span = base ? fmtSpan(Date.now() - base.t) : '';

    if (pc) pc.querySelectorAll('runner-amounts').forEach(row => {
      const num = normNum(ownText(row.querySelector('.chicklet .label') || row));
      const cells = [...row.querySelectorAll('.amounts')].slice(0, 3);
      let hot = false;
      cells.forEach((c, i) => {
        const hh = heats[POOLS[i]] && heats[POOLS[i]].res[num];
        let tag = c.querySelector('.kb-pa');
        const cls = hh ? heatClass(hh) : '';
        // Show: hot/warm; normal if it took some money; cold only for real contenders (10%+ of the pool).
        const show = hh && (isWarm(cls) || (cls === 'kb-v1' && hh.d > 0) ||
                            (cls === 'kb-v0' && hh.share0 >= 0.10));
        if (!show) { if (tag) tag.remove(); return; }
        if (!tag) { tag = document.createElement('span'); c.appendChild(tag); }
        if (isHot(cls)) hot = true;
        setClass(tag, 'kb-pa kb-own ' + cls);
        setText(tag, `+${fmtMoney(hh.d)}` + (isWarm(cls) ? ` ×${hh.heat.toFixed(1)}` : ''));
        tag.title = `${POOLS[i]} pool, last ${span}: +${fmtMoney(hh.d)} = ${(hh.inShare * 100).toFixed(0)}% of new money ` +
                    `(×${hh.heat.toFixed(1)} its earlier share)`;
      });
      row.classList.toggle('kb-pool-hot', hot);
    });
    return { heats, span };
  }

  // Badge on the race card (Win pool, plus Place/Show if they're hot too).
  function renderRunnerVelocity(runners, pv) {
    runners.forEach(r => {
      const cell = r.nameEl.parentElement;
      let box = cell.querySelector('.kb-vel');
      const num = normNum(r.num);
      const parts = [];
      POOLS.forEach(p => {
        const hh = pv.heats[p] && pv.heats[p].res[num];
        if (!hh) return;
        const cls = heatClass(hh);
        if (isWarm(cls)) parts.push({ p, hh, cls });
      });
      if (!parts.length) { if (box) box.remove(); return; }
      if (!box) { box = document.createElement('span'); box.className = 'kb-vel kb-own'; cell.appendChild(box); }
      const sig = parts.map(x => x.p + x.cls + x.hh.heat.toFixed(1)).join('|');
      if (box.dataset.sig === sig) return;
      box.dataset.sig = sig;
      box.textContent = '';
      parts.forEach(({ p, hh, cls }) => {
        const s = document.createElement('span');
        s.className = 'kb-pill ' + cls;
        s.textContent = `⚡ ${p[0].toUpperCase() + p.slice(1)} ×${hh.heat.toFixed(1)} +${fmtMoney(hh.d)}`;
        s.title = `Money velocity, last ${pv.span}: ${(hh.inShare * 100).toFixed(0)}% of new ${p} money ` +
                  `vs ${((hh.inShare / hh.heat) * 100).toFixed(0)}% share before`;
        box.appendChild(s);
      });
    });
  }

  function renderProbablesVelocity(key) {
    const pc = probablesContainer();
    const table = pc && pc.querySelector('.probables-table');
    if (!table) return;
    const base = velBase(key, 'probs');
    const cur = readProbables();
    // Estimated $ on each combo = net pool / payout. Then the same heat test as the pools.
    let heat = null;
    if (base && cur && base.probs._total && cur._total) {
      const net0 = base.probs._total * (1 - VEL_TAKEOUT), net1 = cur._total * (1 - VEL_TAKEOUT);
      const m0 = {}, m1 = {};
      Object.keys(cur).forEach(k => {
        if (k === '_total' || !(base.probs[k] > 0) || !(cur[k] > 0)) return;
        m0[k] = net0 / base.probs[k];
        m1[k] = net1 / cur[k];
      });
      heat = poolHeat(m0, m1);
      if (heat) heat.minShare = Math.max(0.02, 2 / Object.keys(m0).length);
    }
    const span = base ? fmtSpan(Date.now() - base.t) : '';
    const sel = pc.querySelector('select.cb-bettype');
    const bt = sel && sel.selectedOptions[0] ? sel.selectedOptions[0].textContent.trim().toLowerCase() : 'exacta';
    const rows = [...table.querySelectorAll('.probables-row')];
    if (rows.length < 2) return;
    const firstNums = [...rows[0].children].map(c => normNum(ownText(c)));
    const secondNums = [...pc.querySelectorAll('.sticky-col .sticky-cell:not(.diagonal-cell)')].map(c => normNum(ownText(c)));
    rows.slice(1).forEach((row, ri) => [...row.children].forEach((cell, ci) => {
      const k = `${bt}:${firstNums[ci]}-${secondNums[ri]}`;
      const hh = heat && heat.res[k];
      const cls = hh ? heatClass(hh, heat.minShare) : '';
      let tag = cell.querySelector('.kb-pv');
      if (!isWarm(cls)) { if (tag) tag.remove(); cell.classList.remove('kb-pv-hot'); return; }
      if (!tag) { tag = document.createElement('span'); cell.appendChild(tag); }
      const drop = (1 - cur[k] / base.probs[k]) * 100;
      setClass(tag, 'kb-pv kb-own ' + cls);
      setText(tag, `⚡${drop > 0 ? '▼' + drop.toFixed(0) + '%' : ''} +${fmtMoney(hh.d)}`);
      tag.title = `${bt} ${firstNums[ci]}-${secondNums[ri]}: payout ${fmtMoney(base.probs[k])} → ${fmtMoney(cur[k])} in ${span}. ` +
                  `≈ +${fmtMoney(hh.d)} on this combo = ${(hh.inShare * 100).toFixed(0)}% of new money (×${hh.heat.toFixed(1)} its share)`;
      cell.classList.toggle('kb-pv-hot', isHot(cls));
    }));
  }

  function updateVelocity(runners) {
    const key = raceKey(runners);
    velSample(key);
    const pv = renderPoolVelocity(key);
    renderRunnerVelocity(runners, pv);
    renderProbablesVelocity(key);
  }

  /* =====================================================================
     Feature 6: Estimated $2 payouts in the Pools table
     ---------------------------------------------------------------------
     Pari-mutuel: net pool = pool × (1 − takeout).
       Win:   $2 × net / money on the horse.
       Place: (net − money on the 2 placing horses) / 2 is the profit shared by each.
       Show:  same with 3 horses / 3.
     Place/Show depend on who else finishes in the money, so the cell shows the
     approximate LOW end (the other spots filled by the most-backed horses) and the
     hover shows the full range. Real payouts can differ a little: takeout varies
     by state/track and pools keep changing until the gates open. Rounded down to the cent (TVG/Churchill pay to the
     penny, e.g. $5.12), $2.10 minimum.
     ===================================================================== */

  const WPS_TAKEOUT = 0.17; // typical US win/place/show takeout (varies by state/track)

  function payout2(profitPerDollar) {
    const p = Math.floor(Math.max(0, profitPerDollar) * 100 + 1e-9) / 100; // round down to the cent per $1
    return Math.max(2.10, 2 + 2 * p);
  }

  // 1.58 -> "1.6-1", 0.49 -> "0.49-1", 15.2 -> "15-1"
  const fmtOddsTo1 = o => (o < 1 ? o.toFixed(2) : o < 10 ? o.toFixed(1).replace(/\.0$/, '') : Math.round(o)) + '-1';

  function poolTotals(pc, pools) {
    const row = [...pc.querySelectorAll('.header.totals')].find(h => /^All$/i.test((h.children[0] || {}).textContent ? h.children[0].textContent.trim() : ''));
    const cells = row ? [...row.querySelectorAll('.total-amounts')].slice(2, 5).map(c => money(ownText(c))) : [];
    const out = {};
    POOLS.forEach((p, i) => {
      const sum = Object.values(pools[p]).reduce((a, b) => a + b, 0);
      out[p] = cells[i] != null && cells[i] >= sum ? cells[i] : sum;
    });
    return out;
  }

  // Returns { [pool]: { [num]: { min, max } } } of estimated $2 payouts.
  function estimatePayouts(pools, totals) {
    const res = { win: {}, place: {}, show: {} };
    const slots = { win: 1, place: 2, show: 3 };
    POOLS.forEach(p => {
      const amts = pools[p];
      const live = Object.keys(amts).filter(n => amts[n] > 0);
      const net = totals[p] * (1 - WPS_TAKEOUT);
      const k = slots[p];
      if (live.length < k) return;
      live.forEach(n => {
        const h = amts[n];
        const others = live.filter(x => x !== n).map(x => amts[x]).sort((a, b) => b - a);
        const most = others.slice(0, k - 1).reduce((a, b) => a + b, 0);    // other spots = most-backed horses
        const least = others.slice(-(k - 1) || others.length).reduce((a, b) => a + b, 0);
        const profit = o => ((net - h - o) / k) / h;
        res[p][n] = k === 1
          ? { min: payout2((net - h) / h), max: payout2((net - h) / h) }
          : { min: payout2(profit(most)), max: payout2(profit(k > 1 ? least : 0)) };
      });
    });
    return res;
  }

  function renderPoolPayouts() {
    const pc = containerByTitle('Pools');
    const pools = readPools();
    if (!pc || !pools) return;
    const totals = poolTotals(pc, pools);
    const est = estimatePayouts(pools, totals);

    // One-line legend under the "Pools" title.
    if (!pc.querySelector('.kb-pp-note')) {
      const note = document.createElement('div');
      note.className = 'kb-pp-note kb-own';
      note.textContent = `Blue = est. odds-to-1 from the pools (Place/Show = approx. low end; ${Math.round(WPS_TAKEOUT * 100)}% takeout assumed)`;
      const h2 = pc.querySelector('h2');
      if (h2) h2.after(note);
    }

    pc.querySelectorAll('runner-amounts').forEach(row => {
      const num = normNum(ownText(row.querySelector('.chicklet .label') || row));
      [...row.querySelectorAll('.amounts')].slice(0, 3).forEach((c, i) => {
        const p = POOLS[i];
        const e = est[p][num];
        let tag = c.querySelector('.kb-pp');
        if (!e) { if (tag) tag.remove(); return; }
        if (!tag) { tag = document.createElement('span'); c.insertBefore(tag, c.querySelector('.kb-own')); }
        const odds = (e.min - 2) / 2;               // $2 payout -> odds-to-1
        // Place/Show paying better odds than Win (even at its low end) -> green pill.
        const w = est.win[num];
        const better = p !== 'win' && w && odds > (w.min - 2) / 2;
        setClass(tag, 'kb-pp kb-own' + (better ? ' kb-pp-better' : ''));
        setText(tag, fmtOddsTo1(odds));
        tag.title = p === 'win'
          ? `Est. Win odds ${fmtOddsTo1(odds)} ($2 pays $${e.min.toFixed(2)}): $${Math.round(totals.win)} pool, ` +
            `$${Math.round(pools.win[num])} on #${num}, ~${Math.round(WPS_TAKEOUT * 100)}% takeout`
          : `Est. ${p[0].toUpperCase() + p.slice(1)} odds ${fmtOddsTo1((e.min - 2) / 2)} to ${fmtOddsTo1((e.max - 2) / 2)} ` +
            `($2 pays $${e.min.toFixed(2)}–$${e.max.toFixed(2)}), depending on which ` +
            `other horse${p === 'show' ? 's finish' : ' finishes'} in the money (lowest = the most-backed horses)` +
            (better ? `. Better than the Win odds (${fmtOddsTo1((w.min - 2) / 2)})!` : '');
      });
    });
  }

  /* =====================================================================
     Main loop
     ===================================================================== */

  function update() {
    updateOddsChange();
    const runners = tvgRunners();
    if (!runners.length) return;
    loadTrackside();
    const race = matchRace(runners);
    updateRunners(runners, race);
    updateProbables(runners, race);
    updateVelocity(runners);
    renderPoolPayouts();
  }

  // TVG is a single-page app and odds refresh live, so re-run on changes (throttled).
  let pending = false;
  function schedule() {
    if (pending) return;
    pending = true;
    setTimeout(() => { pending = false; update(); }, 300);
  }

  const ours = n => n.nodeType === 1 && (n.classList.contains('kb-own') || n.closest('.kb-own'));
  new MutationObserver(muts => {
    const external = muts.some(m => {
      const target = m.target.nodeType === 1 ? m.target : m.target.parentElement;
      if (target && target.closest('.kb-own')) return false;
      if (m.type === 'childList') {
        const nodes = [...m.addedNodes, ...m.removedNodes];
        if (nodes.length && nodes.every(ours)) return false;
      }
      return true;
    });
    if (external) schedule();
  }).observe(document.body, { childList: true, subtree: true, characterData: true });

  setInterval(schedule, VEL_SAMPLE_MS); // keep sampling pools even when the page is quiet
  update();
})();
