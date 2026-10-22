// Recherche instantanée de localités (ville, centre, village, quartier), insensible aux accents.
import type { GeoLocality, LocalityKind } from './types.ts';

const KIND_ORDER: Record<LocalityKind, number> = { city: 0, town: 1, village: 3, district: 2 };
const ARABIC = /[؀-ۿ]/;

export function normalizeQuery(s: string): string {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’'`-]/g, ' ')
    .replace(/[^a-z0-9؀-ۿ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const keyCache = new WeakMap<GeoLocality, string>();
function keyOf(l: GeoLocality): string {
  let k = keyCache.get(l);
  if (k === undefined) { k = normalizeQuery(l.name); keyCache.set(l, k); }
  return k;
}

/** 0 = nom identique, 1 = début du nom, 2 = début d'un mot, 3 = contenu ; null = pas de correspondance. */
export function matchScore(name: string, q: string): number | null {
  if (!q) return null;
  if (name === q) return 0;
  if (name.startsWith(q)) return 1;
  if (name.split(' ').some((w) => w.startsWith(q))) return 2;
  if (q.length >= 3 && name.includes(q)) return 3;
  return null;
}

export function searchLocalities(list: readonly GeoLocality[], query: string, limit = 8): GeoLocality[] {
  const q = normalizeQuery(query);
  if (q.length < 2 && !ARABIC.test(q)) return [];
  const scored: { l: GeoLocality; s: number }[] = [];
  for (const l of list) {
    let s = matchScore(keyOf(l), q);
    if (s === null && l.nameAr && ARABIC.test(q)) s = l.nameAr.includes(query.trim()) ? 2 : null;
    if (s !== null) scored.push({ l, s });
  }
  scored.sort((a, b) =>
    a.s - b.s ||
    KIND_ORDER[a.l.kind] - KIND_ORDER[b.l.kind] ||
    (b.l.population ?? 0) - (a.l.population ?? 0) ||
    a.l.name.localeCompare(b.l.name, 'fr'));
  return scored.slice(0, limit).map((x) => x.l);
}

export const KIND_LABEL: Record<LocalityKind, string> = { city: 'Ville', town: 'Ville', village: 'Commune / village', district: 'Quartier' };
