# Bunpro Korean Gloss

A userscript for [Bunpro](https://bunpro.jp) that, once you reveal a review/study card, shows:

- **한국어** — a concise **Korean equivalent of the grammar point** (e.g. をもとに → `~을 바탕으로 / ~을 토대로`). Not a translation — the actual matching Korean grammar form.
- **번역** — an inline **Korean translation of the whole sentence**, with the part corresponding to the grammar point **highlighted**. Fetched on demand and cached.

Korean maps onto Japanese grammar far more tightly than English does, so the equivalent is usually all you need. The box only appears *after* you answer/reveal, so it doesn't spoil the card.

## What's covered

- **Grammar points:** N5 through N1 — 877 of ~913 points. The only ones skipped are pure conjugation/category labels (e.g. "い-Adjectives") that have no Korean equivalent. Each gloss is keyed by Bunpro's internal grammar-point ID where available, so it survives conjugation.
- **Sentence translation:** any sentence, via a free no-API-key endpoint (Google `translate_a`, with MyMemory as fallback), cached in `localStorage`.
- **Grammar highlight:** the sentence is translated with and without the grammar fragment; the Korean that "disappears" is the grammar's contribution, and that's what gets highlighted (robust to the translator paraphrasing). The grammar fragment is detected by Bunpro's blue highlight color, so it's independent of class names.

Vocabulary glosses are out of scope for now (grammar only).

## Install

The single file you install is **`dist/bunpro-korean-gloss.user.js`**.

### Safari (macOS)

Safari can't use Tampermonkey for free. Use the free, open-source **Userscripts** app:

1. Install **Userscripts** from the Mac App Store: <https://apps.apple.com/app/userscripts/id1463298887>
2. Safari → Settings → Extensions → enable **Userscripts**. Click its toolbar icon → **Open app / set a scripts folder** (pick any folder).
3. Copy `dist/bunpro-korean-gloss.user.js` into that folder (or use the app's "+" → New JS and paste the contents).
4. In Userscripts' settings, allow it to **read translate.googleapis.com / api.mymemory.translated.net** if prompted (this is the `@connect` for the sentence translation).
5. Reload Bunpro and start a review.

> The script feature-detects `GM.xmlHttpRequest`, which the Userscripts app provides, so the cross-origin translation request works in Safari.

### Chrome / Firefox / Edge

1. Install **Tampermonkey** (or Violentmonkey).
2. Open `dist/bunpro-korean-gloss.user.js`, or drag it onto the Tampermonkey dashboard → **Install**.
3. Reload Bunpro.

### Cleanest install (any browser): install from a local URL

Manual paste into the userscript editor can silently truncate large files. The
reliable way is to let the userscript manager install it from a URL:

```bash
cd dist && python3 -m http.server 8731 --bind 127.0.0.1
```

Then open `http://127.0.0.1:8731/bunpro-korean-gloss.user.js` in the browser —
Tampermonkey/Userscripts shows its install page → **Install**. The script is
self-contained, so you can stop the server afterward. Bump `@version` and reopen
the URL to update.

## If a gloss doesn't appear

Bunpro is a React app and its card markup can change. The script tries several
strategies to find the current grammar point (grammar-point link → blue
highlighted text → `data-gp-id`) and a few selectors for the sentence
(`.bp-quiz-question`). The box is gated on the inner `.bp-quiz-trans` element
becoming visible (reveal). If something doesn't show:

1. Open `dist/bunpro-korean-gloss.user.js`, set `const DEBUG = true;`, reload Bunpro.
2. Open the browser console on a review card. It logs the detected grammar id /
   title / sentence and which selector matched.
3. Send me that output and I'll finalize the selectors.

To hide the sentence translation and keep only the grammar gloss, set
`SHOW_SENTENCE_TRANSLATION = false`.

## Development

```
data/grammar-source.json   # N5–N1 grammar points (id, title, level, meaning), built from public datasets
scripts/author.py          # hand-authored Korean equivalents, joined to the source → src/glosses.json
src/glosses.json           # the dictionary [{id?, title, level, ko}]
src/userscript.template.js # the userscript engine (has a __GLOSSES__ placeholder)
scripts/build.mjs          # inlines glosses.json into the template → dist/bunpro-korean-gloss.user.js
scripts/generate-glosses.mjs # optional: regenerate/expand glosses via the Claude API
```

Rebuild after editing glosses or the template:

```bash
python3 scripts/author.py     # regenerate src/glosses.json
node scripts/build.mjs         # rebuild dist/bunpro-korean-gloss.user.js
```

### Adding more glosses

Add entries to the `KO` map in `scripts/author.py` (key = exact grammar-point
title as in `data/grammar-source.json`), then rebuild.

## Data sources

- Grammar list / IDs: [max-mapper/journal](https://github.com/max-mapper/journal) (N3–N5, with Bunpro IDs) and [anhtranguyen-github/wanikani-bunpro](https://github.com/anhtranguyen-github/wanikani-bunpro) (all levels). Verify licensing before redistributing the data.
- Korean equivalents: hand-authored.
