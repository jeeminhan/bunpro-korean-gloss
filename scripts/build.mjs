#!/usr/bin/env node
// Inlines src/glosses.json into the userscript template, producing the
// single-file distributable dist/bunpro-korean-gloss.user.js.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const template = readFileSync(resolve(root, 'src/userscript.template.js'), 'utf8');
const glosses = JSON.parse(readFileSync(resolve(root, 'src/glosses.json'), 'utf8'));

// Compact, stable serialization keyed by id where present.
const json = JSON.stringify(glosses);
const out = template.replace('__GLOSSES__', json);

mkdirSync(resolve(root, 'dist'), { recursive: true });
const dest = resolve(root, 'dist/bunpro-korean-gloss.user.js');
writeFileSync(dest, out, 'utf8');

const withId = glosses.filter((g) => g.id != null).length;
console.log(`Built ${dest}`);
console.log(`  ${glosses.length} gloss entries (${withId} with Bunpro id), ${(out.length / 1024).toFixed(0)} KB`);
