#!/usr/bin/env node
// OPTIONAL — expand the dictionary automatically via the Claude API.
//
// Reads data/grammar-source.json, asks Claude for a concise Korean grammatical
// equivalent for every point not already in src/glosses.json, and merges the
// results back in. Hand-authored entries in scripts/author.py / src/glosses.json
// always win; this only fills gaps.
//
// Usage:  ANTHROPIC_API_KEY=sk-... node scripts/generate-glosses.mjs [--level N2] [--limit 50]
//
// Requires Node 18+ (global fetch). No SDK dependency.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const key = process.env.ANTHROPIC_API_KEY;
if (!key) {
  console.error('Set ANTHROPIC_API_KEY to use this script.');
  process.exit(1);
}

const args = process.argv.slice(2);
const levelArg = args.includes('--level') ? args[args.indexOf('--level') + 1] : null;
const limit = args.includes('--limit') ? Number(args[args.indexOf('--limit') + 1]) : Infinity;
const MODEL = 'claude-opus-4-8';

const source = JSON.parse(readFileSync(resolve(root, 'data/grammar-source.json'), 'utf8'));
const existing = JSON.parse(readFileSync(resolve(root, 'src/glosses.json'), 'utf8'));
const have = new Set(existing.map((g) => g.title));

let todo = source.filter((s) => !have.has(s.title));
if (levelArg) todo = todo.filter((s) => s.level === levelArg);
todo = todo.slice(0, limit);

console.log(`${todo.length} points to generate (model ${MODEL})`);

async function gloss(point) {
  const prompt = `You are a Japanese-Korean linguistics expert. Give the single most natural, concise KOREAN GRAMMATICAL EQUIVALENT for this Japanese grammar point — the kind of 1-3 word Korean form a Korean learner would map it to, NOT a sentence translation.

Japanese grammar point: ${point.title}
English meaning: ${point.meaning}
JLPT level: ${point.level}

Reply with ONLY the Korean equivalent (you may give up to two forms separated by " / "). No quotes, no explanation, no romanization.`;
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 64,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  const data = await res.json();
  return (data.content?.[0]?.text || '').trim();
}

const out = [...existing];
for (const p of todo) {
  try {
    const ko = await gloss(p);
    if (ko) {
      const e = { title: p.title, level: p.level, ko };
      if ('id' in p) e.id = p.id;
      out.push(e);
      console.log(`  ${p.title} → ${ko}`);
    }
  } catch (e) {
    console.warn(`  ! ${p.title}: ${e.message}`);
  }
}

out.sort((a, b) => (a.level + a.title).localeCompare(b.level + b.title));
writeFileSync(resolve(root, 'src/glosses.json'), JSON.stringify(out, null, 1), 'utf8');
console.log(`\nWrote ${out.length} glosses to src/glosses.json. Run: node scripts/build.mjs`);
