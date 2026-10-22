// Chaque texte d'interface passé à tr() doit avoir sa traduction arabe.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { AR } from '../src/i18n/ar.ts';
import { DUTY_TYPE_LABEL } from '../src/shared/duty.ts';
import { STATUS_LABEL, CONFIDENCE_LABEL } from '../src/shared/status.ts';
import { GEO_PRECISION_LABEL, QUALITY_LABEL } from '../src/shared/quality.ts';
import { KIND_LABEL } from '../src/shared/geo/search.ts';
import { TYPE_LABEL, TYPE_FILTERS, SERVICE_LABEL, INFO_SOURCE_LABEL } from '../src/shared/health/labels.ts';

const files = (d: string): string[] => readdirSync(d).flatMap((f) => {
  const p = join(d, f);
  return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) ? [p] : [];
});

const LIT = /'((?:[^'\\]|\\.)*)'/g;

/** Textes littéraux passés à tr(…) (y compris dans un ternaire), et constantes de libellés des composants. */
export function extractKeys(): Set<string> {
  const keys = new Set<string>();
  for (const f of files('src')) {
    if (f.endsWith('ar.ts')) continue;
    const s = readFileSync(f, 'utf8');
    let i = 0;
    while ((i = s.indexOf('tr(', i)) !== -1) {
      if (/[\w.]/.test(s[i - 1] ?? '')) { i += 3; continue; }
      let depth = 0, j = i + 2;
      for (; j < s.length; j++) {
        if (s[j] === '(') depth++;
        else if (s[j] === ')' && --depth === 0) break;
      }
      const call = s.slice(i + 3, j);
      const first = call.split(/,\s*\{/)[0];
      for (const m of first.matchAll(LIT)) if (/[A-Za-zÀ-ÿ]/.test(m[1])) keys.add(m[1]);
      i = j;
    }
    // libellés déclarés dans des constantes puis traduits à l'affichage
    for (const m of s.matchAll(/\b(?:label|l|q|a|k|title|note|detail): '((?:[^'\\]|\\.)*)'/g)) if (/[a-zé]{2}/.test(m[1])) keys.add(m[1]);
    if (/Record<\w+, string> = \{/.test(s)) {
      for (const block of s.matchAll(/(?:LABEL|SORT_LABEL)[^=]*= \{([^}]*)\}/g)) for (const m of block[1].matchAll(LIT)) keys.add(m[1]);
    }
    for (const m of s.matchAll(/notes\.push\(\s*'((?:[^'\\]|\\.)*)'/g)) keys.add(m[1]);
    for (const m of s.matchAll(/(?:help\.push|new GeoError\([^,]+,|new (?:Data|Routing)?Error\(|REPORT_REASONS = \[[^\]]*?)\s*'((?:[^'\\]|\\.)*)'/g)) keys.add(m[1]);
  }
  for (const map of [DUTY_TYPE_LABEL, STATUS_LABEL, CONFIDENCE_LABEL, GEO_PRECISION_LABEL, QUALITY_LABEL, KIND_LABEL, TYPE_LABEL, SERVICE_LABEL, INFO_SOURCE_LABEL]) {
    for (const v of Object.values(map)) keys.add(v);
  }
  for (const t of TYPE_FILTERS) keys.add(t.label);
  // identifiants et classes CSS captés par les expressions ci-dessus : pas des textes
  for (const k of [...keys]) if (/^[a-z_]+$/.test(k) || /\b(bg|text)-/.test(k)) keys.delete(k);
  return keys;
}

test('i18n : toutes les clés ont une traduction arabe', () => {
  const missing = [...extractKeys()].filter((k) => !(k in AR));
  assert.deepEqual(missing, []);
});

test('i18n : les variables {x} sont conservées dans la traduction', () => {
  for (const [fr, ar] of Object.entries(AR)) {
    const v = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
    assert.equal(v(ar), v(fr), fr);
  }
});
