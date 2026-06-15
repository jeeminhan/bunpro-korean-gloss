// ==UserScript==
// @name         Bunpro Korean Gloss
// @namespace    jeeminhan.bunpro.korean
// @version      0.1.0
// @description  Show a concise Korean equivalent for the grammar point + an inline Korean translation of the whole sentence on Bunpro review/study cards.
// @author       Jeemin Han
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
      .replace(/[〜～~・\s]/g, '')
      .replace(/（[^）]*）/g, '') // drop parenthetical furigana
      .replace(/\(.*?\)/g, '')
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
        font-size: 1.15rem;
        font-weight: 600;
        color: #2563eb;
      }
      .${BOX_CLASS} .bkg-gloss .bkg-label,
      .${BOX_CLASS} .bkg-sentence .bkg-label {
        font-weight: 500;
        color: #9ca3af;
        margin-right: 6px;
        font-size: 0.85em;
      }
      .${BOX_CLASS} .bkg-sentence {
        font-size: 1rem;
        color: #4b5563;
        margin-top: 4px;
      }
      @media (prefers-color-scheme: dark) {
        .${BOX_CLASS} .bkg-gloss { color: #60a5fa; }
        .${BOX_CLASS} .bkg-sentence { color: #cbd5e1; }
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
    '.study-question-japanese',
    '.japanese-example-sentence',
    '[class*="study-question-japanese"]',
    '[class*="JapaneseSentence"]',
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
    clone.querySelectorAll('.study-area-input, input').forEach((n) => n.remove());
    return clone.textContent.replace(/\s+/g, ' ').replace(/_+/g, '').trim();
  }

  // Identify the grammar point under test. Returns the matched gloss entry or null.
  function findGloss(sentenceEl) {
    // Strategy 1: data-gp-id on the highlighted grammar (most reliable).
    const ids = [];
    document
      .querySelectorAll('[data-gp-id]')
      .forEach((n) => ids.push(n.getAttribute('data-gp-id')));
    for (const id of ids) {
      if (byId.has(id)) return { entry: byId.get(id), via: 'id:' + id };
    }

    // Strategy 2: a link to the grammar point page; the last path segment is the
    // URL-encoded Japanese title.
    const link = document.querySelector('a[href*="/grammar_points/"]');
    if (link) {
      try {
        const seg = decodeURIComponent(link.getAttribute('href').split('/').pop().split('?')[0]);
        if (byTitle.has(seg)) return { entry: byTitle.get(seg), via: 'href:' + seg };
        if (byNorm.has(normalize(seg))) return { entry: byNorm.get(normalize(seg)), via: 'href~:' + seg };
      } catch {}
    }

    // Strategy 3: normalized text of the highlighted grammar span.
    const hi = document.querySelector('.gp-popout, [class*="gp-popout"], [class*="grammar-highlight"]');
    if (hi) {
      const t = normalize(hi.textContent);
      if (byNorm.has(t)) return { entry: byNorm.get(t), via: 'text:' + t };
    }

    // Record unknowns to help backfill the dictionary.
    if (ids.length) {
      try {
        const u = JSON.parse(localStorage.getItem(LS_UNKNOWN) || '{}');
        const t = sentenceEl ? extractSentence(sentenceEl).slice(0, 40) : '';
        ids.forEach((id) => { u[id] = t; });
        localStorage.setItem(LS_UNKNOWN, JSON.stringify(u));
      } catch {}
    }
    return null;
  }

  // ----------------------------------------------------------------------------
  // Render
  // ----------------------------------------------------------------------------
  let lastKey = '';

  async function render() {
    const sentenceEl = findSentenceEl();
    if (!sentenceEl) return;

    const sentence = extractSentence(sentenceEl);
    const match = findGloss(sentenceEl);

    // Key the render on grammar + sentence so we re-render on card change and
    // avoid duplicate work on unrelated DOM mutations.
    const key = (match ? match.entry.title : '?') + '|' + sentence;
    if (key === lastKey && document.querySelector('.' + BOX_CLASS)) return;
    lastKey = key;

    // Remove any previous box.
    document.querySelectorAll('.' + BOX_CLASS).forEach((n) => n.remove());

    if (!match && !SHOW_SENTENCE_TRANSLATION) return;

    log('grammar via', match && match.via, '| sentence:', sentence);

    ensureStyle();
    const box = document.createElement('div');
    box.className = BOX_CLASS;

    if (match) {
      const g = document.createElement('div');
      g.className = 'bkg-gloss';
      g.innerHTML = `<span class="bkg-label">한국어</span>${match.entry.ko}`;
      box.appendChild(g);
    }

    if (SHOW_SENTENCE_TRANSLATION && sentence) {
      const s = document.createElement('div');
      s.className = 'bkg-sentence';
      s.innerHTML = `<span class="bkg-label">번역</span><span class="bkg-trans">…</span>`;
      box.appendChild(s);
      translateToKorean(sentence).then((ko) => {
        const span = s.querySelector('.bkg-trans');
        if (span) span.textContent = ko || '(번역 실패)';
      });
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
