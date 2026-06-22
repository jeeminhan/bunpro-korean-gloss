// ==UserScript==
// @name         Bunpro Korean Gloss
// @namespace    jeeminhan.bunpro.korean
// @version      0.6.0
// @description  Show a concise Korean equivalent for the grammar point + an inline Korean translation of the whole sentence on Bunpro review/study cards.
// @author       Jeemin Han
// @downloadURL  https://raw.githubusercontent.com/jeeminhan/bunpro-korean-gloss/main/dist/bunpro-korean-gloss.user.js
// @updateURL    https://raw.githubusercontent.com/jeeminhan/bunpro-korean-gloss/main/dist/bunpro-korean-gloss.user.js
// @match        https://bunpro.jp/*
// @exclude      https://community.bunpro.jp/*
// @grant        GM.xmlHttpRequest
// @grant        GM_xmlhttpRequest
// @connect      translate.googleapis.com
// @connect      api.mymemory.translated.net
// @run-at       document-idle
// ==/UserScript==

/* eslint-disable */
(function () {
  'use strict';

  // ----------------------------------------------------------------------------
  // Config
  // ----------------------------------------------------------------------------
  // Flip to true and reload Bunpro to print what the script detects to the
  // browser console (grammar id / title / sentence / chosen selectors). Paste
  // that output back to finalize selectors if a gloss ever fails to appear.
  const DEBUG = false;

  // Set false to hide the full-sentence Korean translation (keep only the
  // grammar-point gloss).
  const SHOW_SENTENCE_TRANSLATION = true;

  const STYLE_ID = 'bkg-style';
  const BOX_CLASS = 'bkg-box';
  const LS_CACHE = 'bkg.translateCache.v1';
  const LS_UNKNOWN = 'bkg.unknownPoints.v1';

  // Injected dictionary. Built from src/glosses.json by scripts/build.mjs.
  // Shape: [{ id?: number, title: string, level: string, ko: string }]
  const GLOSSES = __GLOSSES__;

  // ----------------------------------------------------------------------------
  // Build lookup indexes (by Bunpro grammar id, exact title, normalized title)
  // ----------------------------------------------------------------------------
  const byId = new Map();
  const byTitle = new Map();
  const byNorm = new Map();

  const normalize = (s) =>
    (s || '')
      .replace(/（[^）]*）/g, '') // drop parenthetical furigana
      .replace(/\(.*?\)/g, '')
      .replace(/[〜～~・\-\s]/g, '') // tildes, middots, hyphens (Bunpro slug separators), spaces
      .trim();

  for (const g of GLOSSES) {
    if (g.id != null) byId.set(String(g.id), g);
    if (g.title) {
      byTitle.set(g.title, g);
      byNorm.set(normalize(g.title), g);
    }
  }

  const log = (...a) => DEBUG && console.log('[BKG]', ...a);

  // ----------------------------------------------------------------------------
  // Styles
  // ----------------------------------------------------------------------------
  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const css = `
      .${BOX_CLASS} {
        margin: 10px auto 0;
        max-width: 90%;
        text-align: center;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        line-height: 1.5;
        animation: bkgfade 180ms ease-out;
      }
      @keyframes bkgfade { from { opacity: 0; transform: translateY(-2px); } to { opacity: 1; } }
      .${BOX_CLASS} .bkg-gloss {
        font-size: 1.9rem;
        font-weight: 700;
        color: #2563eb;
      }
      .${BOX_CLASS} .bkg-gloss .bkg-label,
      .${BOX_CLASS} .bkg-sentence .bkg-label {
        font-weight: 500;
        color: #9ca3af;
        margin-right: 8px;
        font-size: 0.6em;
        vertical-align: middle;
      }
      .${BOX_CLASS} .bkg-sentence {
        font-size: 1.4rem;
        color: #4b5563;
        margin-top: 8px;
      }
      .${BOX_CLASS} .bkg-hl {
        color: #2563eb;
        font-weight: 700;
        background: rgba(37, 99, 235, 0.12);
        border-radius: 4px;
        padding: 0 3px;
      }
      @media (prefers-color-scheme: dark) {
        .${BOX_CLASS} .bkg-gloss { color: #60a5fa; }
        .${BOX_CLASS} .bkg-sentence { color: #cbd5e1; }
        .${BOX_CLASS} .bkg-hl { color: #93c5fd; background: rgba(96, 165, 250, 0.18); }
      }
    `;
    const el = document.createElement('style');
    el.id = STYLE_ID;
    el.textContent = css;
    document.head.appendChild(el);
  }

  // ----------------------------------------------------------------------------
  // Translation (GM.xmlHttpRequest preferred for cross-origin; cached)
  // ----------------------------------------------------------------------------
  function loadCache() {
    try { return JSON.parse(localStorage.getItem(LS_CACHE) || '{}'); }
    catch { return {}; }
  }
  function saveCache(c) {
    try { localStorage.setItem(LS_CACHE, JSON.stringify(c)); } catch {}
  }

  function gmGet(url) {
    return new Promise((resolve, reject) => {
      const fn =
        (typeof GM !== 'undefined' && GM.xmlHttpRequest && GM.xmlHttpRequest.bind(GM)) ||
        (typeof GM_xmlhttpRequest !== 'undefined' && GM_xmlhttpRequest);
      if (fn) {
        fn({
          method: 'GET',
          url,
          onload: (r) => resolve(r.responseText),
          onerror: reject,
          ontimeout: reject,
        });
      } else {
        // Fallback (works if the endpoint sends permissive CORS headers).
        fetch(url).then((r) => r.text()).then(resolve).catch(reject);
      }
    });
  }

  async function translateToKorean(text) {
    if (!text) return '';
    const cache = loadCache();
    if (cache[text]) return cache[text];

    // 1) Google gtx endpoint
    try {
      const url =
        'https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=ko&dt=t&q=' +
        encodeURIComponent(text);
      const raw = await gmGet(url);
      const data = JSON.parse(raw);
      const out = (data[0] || []).map((seg) => seg[0]).join('');
      if (out) {
        cache[text] = out;
        saveCache(cache);
        return out;
      }
    } catch (e) {
      log('gtx failed', e);
    }

    // 2) MyMemory fallback
    try {
      const url =
        'https://api.mymemory.translated.net/get?langpair=ja|ko&q=' +
        encodeURIComponent(text);
      const raw = await gmGet(url);
      const data = JSON.parse(raw);
      const out = data && data.responseData && data.responseData.translatedText;
      if (out) {
        cache[text] = out;
        saveCache(cache);
        return out;
      }
    } catch (e) {
      log('mymemory failed', e);
    }
    return '';
  }

  // ----------------------------------------------------------------------------
  // Read the current card: grammar point + sentence
  // ----------------------------------------------------------------------------

  // Candidate containers for the example/question sentence, most specific first.
  const SENTENCE_SELECTORS = [
    '.bp-quiz-question',
    '[class*="QuestionSentence"]',
    '.study-question-japanese',
    '.japanese-example-sentence',
    '[class*="japanese-sentence"]',
  ];

  function findSentenceEl() {
    for (const sel of SENTENCE_SELECTORS) {
      const el = document.querySelector(sel);
      if (el && el.textContent.trim()) return el;
    }
    return null;
  }

  // Extract readable Japanese text from a sentence node, dropping furigana
  // (rt), answer blanks, and collapsing ruby to its base text.
  function extractSentence(el) {
    const clone = el.cloneNode(true);
    clone.querySelectorAll('rt, rp').forEach((n) => n.remove());
    clone
      .querySelectorAll('.study-area-input, input, [class*="input"]')
      .forEach((n) => n.remove());
    let t = clone.textContent.replace(/\s+/g, ' ').replace(/_+/g, '').trim();
    // Strip furigana rendered as parenthesized kana, e.g. 実感(じっかん) → 実感.
    t = t.replace(/[（(][ぁ-ゖァ-ヺー]+[)）]/g, '');
    return t.trim();
  }

  // Identify the grammar point under test. Returns the matched gloss entry or null.
  function findGloss(sentenceEl) {
    // Strategy 1: grammar-point link — the canonical identifier of the point being
    // tested. The last path segment is the URL-encoded title with ~ rendered as
    // hyphens (e.g. /grammar_points/も-ば-も → も～ば～も).
    const links = [...document.querySelectorAll('a[href*="/grammar_points/"]')];
    for (const a of links) {
      try {
        const seg = decodeURIComponent((a.getAttribute('href') || '').split('/').pop().split('?')[0]);
        if (byTitle.has(seg)) return { entry: byTitle.get(seg), via: 'href:' + seg };
        const n = normalize(seg);
        if (n && byNorm.has(n)) return { entry: byNorm.get(n), via: 'href~:' + seg };
      } catch {}
    }

    // Strategy 2: data-gp-id, but ONLY when unambiguous (a single distinct id on
    // the page). Multiple ids mean the structure breakdown is showing component
    // points, which are not the target.
    const ids = [...document.querySelectorAll('[data-gp-id]')].map((n) => n.getAttribute('data-gp-id'));
    const uniq = [...new Set(ids)];
    if (uniq.length === 1 && byId.has(uniq[0])) {
      return { entry: byId.get(uniq[0]), via: 'id:' + uniq[0] };
    }

    // Strategy 3: the blue-highlighted grammar text itself (detected by color,
    // independent of class names / slug format). Robust when the link is absent
    // or uses a romanized slug.
    const hiText = highlightedJP(sentenceEl);
    if (hiText) {
      if (byTitle.has(hiText)) return { entry: byTitle.get(hiText), via: 'hi:' + hiText };
      const n = normalize(hiText);
      if (n && byNorm.has(n)) return { entry: byNorm.get(n), via: 'hi~:' + hiText };
    }

    // Strategy 4: legacy highlighted span class (older Bunpro markup).
    const hi = document.querySelector('.gp-popout, [class*="gp-popout"], [class*="grammar-highlight"]');
    if (hi) {
      const t = normalize(hi.textContent);
      if (t && byNorm.has(t)) return { entry: byNorm.get(t), via: 'text:' + t };
    }

    // Record unknowns (link segments) to help backfill the dictionary.
    if (links.length) {
      try {
        const u = JSON.parse(localStorage.getItem(LS_UNKNOWN) || '{}');
        const t = sentenceEl ? extractSentence(sentenceEl).slice(0, 40) : '';
        links.forEach((a) => {
          const seg = decodeURIComponent((a.getAttribute('href') || '').split('/').pop().split('?')[0]);
          if (seg) u[seg] = t;
        });
        localStorage.setItem(LS_UNKNOWN, JSON.stringify(u));
      } catch {}
    }
    return null;
  }

  // ----------------------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------------------
  let lastKey = '';

  // Bunpro only shows the translation once the card is answered — gate on it so
  // nothing appears before the user answers. Use the inner translation element
  // (.bp-quiz-trans), NOT the wrapper (.bp-quiz-trans-wrap), which is always
  // visible; the inner one is faded in (opacity) only on reveal.
  const REVEAL_SELECTOR = '.bp-quiz-trans:not(.bp-quiz-trans-wrap)';

  const escapeHtml = (s) =>
    (s || '').replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
    );

  // Korean strings that may represent the grammar inside the translation: the
  // translated Japanese grammar fragment (for simple titles, no placeholders)
  // plus the gloss forms themselves. Longest first.
  async function grammarCandidates(entry) {
    const c = [];
    if (entry && /^[぀-ヿ一-龯]+$/.test(entry.title)) {
      try {
        const f = await translateToKorean(entry.title);
        if (f) c.push(f.replace(/[.。!?！？,，\s]+$/g, '').trim());
      } catch {}
    }
    if (entry) {
      entry.ko.split('/').forEach((f) => {
        const s = f.replace(/[~～()]/g, '').trim();
        if (s) c.push(s);
      });
    }
    return c.filter((s) => s.length >= 2).sort((a, b) => b.length - a.length);
  }

  function highlightInto(span, ko, cands) {
    let html = escapeHtml(ko);
    for (const cand of cands) {
      if (cand && ko.includes(cand)) {
        html = html.replace(escapeHtml(cand), `<span class="bkg-hl">${escapeHtml(cand)}</span>`);
        break;
      }
    }
    span.innerHTML = html;
  }

  // Bunpro colors the tested grammar differently from the rest of the sentence.
  // Return its Japanese surface text (furigana stripped) by computed color, so
  // it works regardless of class names.
  function highlightedJP(el) {
    let base;
    try { base = getComputedStyle(el).color; } catch { return ''; }
    const colored = [...el.querySelectorAll('*')].filter((n) => {
      if (n.tagName === 'RT' || n.tagName === 'RP' || !n.textContent.trim()) return false;
      try { return getComputedStyle(n).color !== base; } catch { return false; }
    });
    if (!colored.length) return '';
    const outer = colored.filter((n) => !colored.some((m) => m !== n && m.contains(n)));
    const txt = outer
      .map((n) => {
        const c = n.cloneNode(true);
        c.querySelectorAll('rt, rp').forEach((x) => x.remove());
        return c.textContent;
      })
      .join('');
    return txt.replace(/[（(][ぁ-ゖァ-ヺー]+[)）]/g, '').replace(/\s+/g, '').trim();
  }

  // The part of `full` that isn't a shared prefix/suffix with `minus` — i.e. the
  // Korean that the grammar fragment contributed.
  function diffMid(full, minus) {
    let p = 0;
    while (p < full.length && p < minus.length && full[p] === minus[p]) p++;
    let s = 0;
    while (
      s < full.length - p &&
      s < minus.length - p &&
      full[full.length - 1 - s] === minus[minus.length - 1 - s]
    ) {
      s++;
    }
    return full.slice(p, full.length - s).trim();
  }

  // Bunpro keeps the translation element in the DOM and fades it in, so we must
  // check it is actually visible (opacity > 0) — not merely present.
  function isRevealed() {
    for (const el of document.querySelectorAll(REVEAL_SELECTOR)) {
      const s = getComputedStyle(el);
      if (
        s.opacity !== '0' &&
        s.visibility !== 'hidden' &&
        el.offsetParent !== null &&
        el.textContent.trim()
      ) {
        return true;
      }
    }
    return false;
  }

  async function render() {
    const sentenceEl = findSentenceEl();
    const revealed = isRevealed();

    // Not answered yet (or no sentence) — clear and wait.
    if (!sentenceEl || !revealed) {
      document.querySelectorAll('.' + BOX_CLASS).forEach((n) => n.remove());
      lastKey = '';
      return;
    }

    const sentence = extractSentence(sentenceEl);
    const match = findGloss(sentenceEl);

    // Key the render on grammar + sentence so we re-render on card change and
    // avoid duplicate work on unrelated DOM mutations.
    const key = (match ? match.entry.title : '?') + '|' + sentence;
    if (key === lastKey && document.querySelector('.' + BOX_CLASS)) return;
    lastKey = key;

    document.querySelectorAll('.' + BOX_CLASS).forEach((n) => n.remove());
    if (!match && !SHOW_SENTENCE_TRANSLATION) return;

    log('grammar via', match && match.via, '| sentence:', sentence);

    ensureStyle();
    const box = document.createElement('div');
    box.className = BOX_CLASS;

    if (match) {
      const g = document.createElement('div');
      g.className = 'bkg-gloss';
      g.innerHTML = `<span class="bkg-label">한국어</span>${escapeHtml(match.entry.ko)}`;
      box.appendChild(g);
    }

    if (SHOW_SENTENCE_TRANSLATION && sentence) {
      const s = document.createElement('div');
      s.className = 'bkg-sentence';
      s.innerHTML = `<span class="bkg-label">번역</span><span class="bkg-trans">…</span>`;
      box.appendChild(s);
      const span = s.querySelector('.bkg-trans');
      (async () => {
        const ko = await translateToKorean(sentence);
        if (!span) return;
        if (!ko) { span.textContent = '(번역 실패)'; return; }
        let cands = [];
        // Preferred: diff the translation against the same sentence with the
        // grammar fragment removed; the difference is the grammar's Korean.
        const jp = match ? highlightedJP(sentenceEl) : '';
        if (jp && sentence.includes(jp)) {
          try {
            const minus = await translateToKorean(sentence.replace(jp, ' '));
            const mid = diffMid(ko, minus);
            if (mid && mid.length >= 1 && mid.length <= 22) cands.push(mid);
          } catch (e) {
            log('diff highlight failed', e);
          }
        }
        // Fallback: gloss forms / fragment translation.
        if (!cands.length && match) cands = await grammarCandidates(match.entry);
        highlightInto(span, ko, cands);
      })();
    }

    // Insert just below the sentence container.
    const anchor = sentenceEl.closest('div') || sentenceEl;
    anchor.parentElement
      ? anchor.parentElement.insertBefore(box, anchor.nextSibling)
      : sentenceEl.appendChild(box);
  }

  // ----------------------------------------------------------------------------
  // Observe (Bunpro is a React SPA — cards swap without a full reload)
  // ----------------------------------------------------------------------------
  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    setTimeout(() => {
      scheduled = false;
      try { render(); } catch (e) { log('render error', e); }
    }, 120);
  }

  const obs = new MutationObserver(schedule);
  obs.observe(document.body, { childList: true, subtree: true });
  schedule();

  log('Bunpro Korean Gloss loaded — dictionary entries:', GLOSSES.length);
})();
