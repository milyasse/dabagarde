// Rapprochement de la liste officielle des hôpitaux (ministère de la Santé) avec OpenStreetMap,
// pour tout le Maroc. Règles prudentes, sans rien inventer :
//  - la commune (ou, à défaut, la délégation) de l'hôpital est située grâce à la base géographique ;
//  - un objet OSM n'est rattaché que s'il porte tous les mots significatifs du nom officiel,
//    se trouve près de cette commune et qu'aucun autre objet ne convient aussi bien ;
//  - sinon l'hôpital reste « sans position » : il n'apparaît que pour une recherche autour de sa commune.
import { haversineKm } from '../distance.ts';
import { stripAccents } from '../text.ts';
import type { Establishment } from './types.ts';

export interface GeoPlace { name: string; lat: number; lon: number; kind: string }
export interface GeoProvinceRef { name: string; lat: number | null; lon: number | null }
export interface Area { lat: number; lng: number; precision: 'commune' | 'delegation' }

const norm = (s: string) => stripAccents(s.toLowerCase()).replace(/[’'`\-.]/g, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** « Agdal Riyad (Arrond.) » → « agdal riyad » */
export const communeKey = (c: string) => norm(c.replace(/\((arrond|mun|cr|c\.?r)\.?\)/gi, ''));

/** « Préfecture d'arrondissements de Casablanca-Anfa » → « casablanca anfa » */
export const provinceKey = (p: string) => norm(p).replace(/^(prefecture|province)( d arrondissements)?( de| d| des)?\s+/, '').replace(/^(l |la |le )/, '');

const KIND_RANK: Record<string, number> = { city: 0, town: 1, district: 2, village: 3 };

/** Noms de lieux équivalents malgré l'orthographe (« Taroudannt » / « Taroudant », « Es-semara » / « Es-Semara »). */
function placeEq(a: string, b: string): boolean {
  const ca = a.replace(/ /g, ''), cb = b.replace(/ /g, '');
  if (ca === cb || sameWord(ca, cb)) return true;
  const ta = a.split(' '), tb = b.split(' ');
  return ta.length === tb.length && ta.every((w, i) => sameWord(w, tb[i]));
}

/** Centre approximatif de la commune de l'hôpital (jamais affiché comme position de l'établissement). */
export function locateArea(h: { commune: string; delegation: string }, places: readonly GeoPlace[], provinces: readonly GeoProvinceRef[]): Area | null {
  const dk = provinceKey(h.delegation);
  const dTokens = new Set(dk.split(' '));
  let prov = provinces.find((p) => p.lat !== null && placeEq(provinceKey(p.name), dk));
  if (!prov) {
    // meilleure correspondance par mots (« Tanger Assilah » ↔ « Tanger-Assilah »)
    let best = 0;
    for (const p of provinces) {
      if (p.lat === null) continue;
      const t = provinceKey(p.name).split(' ');
      const sc = t.filter((x) => dTokens.has(x)).length / Math.max(t.length, dTokens.size);
      if (sc > best && sc >= 0.5) { best = sc; prov = p; }
    }
  }
  const dist = (p: GeoPlace) => (prov ? haversineKm({ lat: p.lat, lng: p.lon }, { lat: prov.lat!, lng: prov.lon! }) : 0);
  // villes : jusqu'à 300 km du centre de la province (provinces sahariennes étendues) ; villages et quartiers : 80 km
  const plausible = (p: GeoPlace) => !prov || dist(p) <= (p.kind === 'city' || p.kind === 'town' ? 300 : 80);
  const pick = (key: string) => places.filter((p) => placeEq(norm(p.name), key) && plausible(p))
    .sort((a, b) => (KIND_RANK[a.kind] ?? 9) - (KIND_RANK[b.kind] ?? 9) || dist(a) - dist(b))[0];
  const hit = pick(communeKey(h.commune));
  if (hit) return { lat: hit.lat, lng: hit.lon, precision: 'commune' };
  // commune introuvable : la ville qui porte le nom de la délégation, puis le centre de la province
  const town = pick(dk);
  if (town && (town.kind === 'city' || town.kind === 'town')) return { lat: town.lat, lng: town.lon, precision: 'delegation' };
  if (prov) return { lat: prov.lat!, lng: prov.lon!, precision: 'delegation' };
  return null;
}

const ROMAN: Record<string, string> = { ii: '2', iii: '3', iv: '4', v: '5', vi: '6' };
const STOP = new Set([
  'hopital', 'hospital', 'hopitaux', 'hop', 'h', 'centre', 'center', 'ctre', 'c', 'ch', 'chu', 'chr', 'chp', 'hcu',
  'hospitalier', 'hospitaliere', 'hospitalo', 'provincial', 'provinciale', 'prefectoral', 'prefectorale', 'regional', 'regionale',
  'interregional', 'universitaire', 'proximite', 'local', 'general', 'public', 'publique', 'ancien', 'nouveau', 'nouvel',
  'de', 'du', 'des', 'd', 'la', 'le', 'les', 'l', 'el', 'al', 'et', 'a', 'en', 'au', 'specialites', 'specialite', 'mere', 'enfant',
]);
// « spécialités », « mère-enfant » restent utiles pour départager : on les garde dans un second jeu de mots
const SOFT = new Set(['specialites', 'specialite', 'mere', 'enfant']);

export function nameTokens(name: string): { hard: string[]; soft: string[] } {
  const words = norm(name).replace(/\bmy\b/g, 'moulay').replace(/\bmed\b/g, 'mohamed').replace(/\bmohammed\b/g, 'mohamed')
    .replace(/\bhop\s*prefectoral\b/g, ' ').split(' ').filter(Boolean)
    .map((w) => ROMAN[w] ?? w).map((w) => (w.length > 4 ? w.replace(/s$/, '') : w));
  return {
    hard: [...new Set(words.filter((w) => !STOP.has(w) && !STOP.has(w + 's')))],
    soft: [...new Set(words.filter((w) => SOFT.has(w) || SOFT.has(w + 's')))],
  };
}

// hors liste du ministère : privés, mutuelles, Croissant-Rouge, hôpitaux militaires
const PRIVATE = /clini|polyclini|cabinet|cnss|privee?\b|private|مصحة|croissant\s*rouge|red\s*crescent|الهلال الأحمر|militaire|military|عسكري/i;
// centres de santé, dispensaires : pas des hôpitaux de la liste officielle
const NOT_HOSPITAL = /health\s*cent|centre\s+de\s+sant|dispensaire|المركز الصحي|مستوصف/i;

/** Mots égaux, ou à une lettre près pour les mots longs (« Berrchid » / « Berrechid »). */
function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 6 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, diff = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++diff > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return diff + (a.length - i) + (b.length - j) <= 1;
}

/** Cohérence entre la catégorie officielle et le nom OSM (un centre d'oncologie n'est pas le CHU de la ville). */
function categoryFits(category: string | undefined, osmName: string): boolean {
  const n = stripAccents(osmName.toLowerCase());
  if (category === 'CRO') return /oncolog|انكولوجيا|الأنكولوجيا|السرطان/.test(n);
  if (category && /^(CPU|HPsy)/.test(category)) return /psychiatr|mentale|الأمراض العقلية|النفسي/.test(n);
  if (/\bchu\b|universitaire/.test(n)) return category === 'HIR' || category === 'CPU';
  return true;
}

/**
 * Objet OSM correspondant à un hôpital officiel, ou null si aucun (ou plusieurs) ne convient sans ambiguïté.
 * `radiusKm` : 15 km autour de la commune, 35 km si seule la délégation est connue.
 */
export function autoMatch(officialName: string, area: Area, osm: readonly Establishment[], category?: string): Establishment | null {
  const want = nameTokens(officialName);
  if (!want.hard.length) return null;
  const radius = area.precision === 'commune' ? 15 : 35;
  const scored: { e: Establishment; soft: number; km: number }[] = [];
  for (const e of osm) {
    if (e.latitude === null || e.longitude === null) continue;
    if (e.type === 'private_clinic' || e.type === 'private_hospital' || e.type === 'military_hospital' || PRIVATE.test(e.name) || NOT_HOSPITAL.test(e.name)) continue;
    if (!categoryFits(category, e.name)) continue;
    const km = haversineKm({ lat: area.lat, lng: area.lng }, { lat: e.latitude, lng: e.longitude });
    if (km > radius) continue;
    const have = nameTokens(e.name);
    if (!want.hard.every((w) => have.hard.some((x) => sameWord(w, x)))) continue;
    scored.push({ e, soft: want.soft.filter((w) => have.soft.includes(w)).length - Math.abs(have.soft.length - want.soft.length) * 0.5, km });
  }
  if (!scored.length) return null;
  scored.sort((a, b) => b.soft - a.soft);
  const top = scored.filter((s) => s.soft === scored[0].soft);
  return top.length === 1 ? top[0].e : null;
}
