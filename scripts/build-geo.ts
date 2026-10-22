// Construit la base géographique nationale (régions, provinces/préfectures, localités, quartiers)
// à partir d'OpenStreetMap (licence ODbL, attribution « © les contributeurs d'OpenStreetMap »).
//
// Exécuté en CI (workflow « Base géographique »), jamais dans le navigateur : la base change rarement.
// Trois requêtes Overpass seulement (régions, provinces avec géométrie, localités) ; chaque localité
// est rattachée à sa province par test point-dans-polygone.
//
// Sorties :
//   public/data/geo/regions.json     12 régions et leurs provinces
//   public/data/geo/localities.json  villes, centres, villages et quartiers (recherche instantanée)
//   data-sources/geo/report.json     statistiques et anomalies à relire (écrit même en cas d'échec)
//
// Identifiants stables : région = code ISO 3166-2 (MA-01…MA-12) ; province = code ISO publié dans OSM
// (ex. MA-RAB), sinon "osm-r<id>" ; localité = "<slug>-<province>" (ex. "rabat-ma-rab").
//
// Usage : node --experimental-strip-types scripts/build-geo.ts [--fixture <dir>]
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { REGIONS } from '../src/shared/geo/regions.ts';
import { slugify } from '../src/shared/geo/slug.ts';
import type { GeoLocality, GeoProvince, GeoRegion, LocalityKind } from '../src/shared/geo/types.ts';

// overpass-api.de refuse les connexions depuis les machines GitHub (« fetch failed ») : miroirs d'abord.
const ENDPOINTS = ['https://overpass.kumi.systems/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://overpass-api.de/api/interpreter'];
const CONTOURS = 'data-sources/geo/contours'; // contours simplifiés déjà obtenus : la collecte reprend où elle s'est arrêtée
const UA = `DabaGarde-geo/1.0 (+https://github.com/${process.env.GITHUB_REPOSITORY ?? 'local'})`;
const PAUSE_MS = 5000;
const CONTOUR_BUDGET_MS = 45 * 60 * 1000; // au-delà, les contours manquants seront demandés au prochain passage
const T0 = Date.now();

type Pt = { lat: number; lon: number };
type OsmMember = { type: string; ref: number; role: string; geometry?: Pt[] };
type OsmEl = { type: 'node' | 'way' | 'relation'; id: number; lat?: number; lon?: number; center?: Pt; tags?: Record<string, string>; members?: OsmMember[] };

const args = process.argv.slice(2);
const fixtureDir = args.includes('--fixture') ? args[args.indexOf('--fixture') + 1] : null;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const report: Record<string, unknown> = { startedAt: new Date().toISOString(), steps: [] as string[], anomalies: [] as string[] };
const steps = report.steps as string[];
const anomalies = report.anomalies as string[];
function saveReport() {
  mkdirSync('data-sources/geo', { recursive: true });
  writeFileSync('data-sources/geo/report.json', JSON.stringify(report, null, 2));
}
const log = (m: string) => { console.log(m); steps.push(`${new Date().toISOString()} ${m}`); saveReport(); };

async function overpass(key: string, query: string): Promise<OsmEl[]> {
  if (fixtureDir) {
    const f = join(fixtureDir, `${key}.json`);
    return existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')).elements as OsmEl[]) : [];
  }
  const errors: string[] = [];
  for (let attempt = 0; attempt < 1; attempt++) {
    for (const url of ENDPOINTS) {
      try {
        const t0 = Date.now();
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' },
          body: 'data=' + encodeURIComponent(query),
          signal: AbortSignal.timeout(400_000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { elements: OsmEl[]; remark?: string };
        if (json.remark && /error|timed out/i.test(json.remark)) throw new Error(json.remark.slice(0, 200));
        log(`${key} : ${json.elements.length} éléments via ${new URL(url).host} en ${Math.round((Date.now() - t0) / 1000)} s`);
        await sleep(PAUSE_MS);
        return json.elements;
      } catch (e) {
        errors.push(`${new URL(url).host}: ${String((e as Error).message ?? e)}`);
        log(`${key} : échec ${errors.at(-1)}`);
        await sleep(PAUSE_MS * 2);
      }
    }
  }
  throw new Error(`Overpass indisponible pour ${key} : ${errors.join(' | ')}`);
}

const nameFr = (t: Record<string, string> = {}) => t['name:fr'] || t['name'] || t['name:en'] || '';
const round = (x: number) => Math.round(x * 1e5) / 1e5;

// ---------- Géométrie : assemblage des anneaux et point dans polygone
function assembleRings(members: OsmMember[]): Pt[][] {
  const segs = members.filter((m) => m.type === 'way' && m.role !== 'inner' && m.geometry && m.geometry.length > 1).map((m) => [...m.geometry!]);
  const rings: Pt[][] = [];
  const same = (a: Pt, b: Pt) => Math.abs(a.lat - b.lat) < 1e-7 && Math.abs(a.lon - b.lon) < 1e-7;
  while (segs.length) {
    let ring = segs.shift()!;
    let grown = true;
    while (!same(ring[0], ring[ring.length - 1]) && grown) {
      grown = false;
      for (let i = 0; i < segs.length; i++) {
        const s = segs[i];
        const end = ring[ring.length - 1];
        if (same(end, s[0])) ring = ring.concat(s.slice(1));
        else if (same(end, s[s.length - 1])) ring = ring.concat([...s].reverse().slice(1));
        else if (same(ring[0], s[s.length - 1])) ring = s.concat(ring.slice(1));
        else if (same(ring[0], s[0])) ring = [...s].reverse().concat(ring.slice(1));
        else continue;
        segs.splice(i, 1);
        grown = true;
        break;
      }
    }
    if (ring.length >= 4) rings.push(ring);
  }
  return rings;
}

/** Simplification légère (points espacés d'au moins ~100 m, 4 décimales) : fichiers de contours compacts. */
function simplify(ring: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of ring) {
    const q = { lat: Math.round(p.lat * 1e4) / 1e4, lon: Math.round(p.lon * 1e4) / 1e4 };
    const last = out[out.length - 1];
    if (!last || Math.abs(last.lat - q.lat) + Math.abs(last.lon - q.lon) > 0.001) out.push(q);
  }
  if (out.length && (out[0].lat !== out[out.length - 1].lat || out[0].lon !== out[out.length - 1].lon)) out.push(out[0]);
  return out;
}

function inRing(p: Pt, ring: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i], b = ring[j];
    if ((a.lat > p.lat) !== (b.lat > p.lat) && p.lon < ((b.lon - a.lon) * (p.lat - a.lat)) / (b.lat - a.lat) + a.lon) inside = !inside;
  }
  return inside;
}

const PLACE_KIND: Record<string, LocalityKind> = { city: 'city', town: 'town', village: 'village', suburb: 'district', quarter: 'district' };

async function main() {
  // 1. Régions (codes ISO officiels) et leurs provinces membres (« subarea »)
  const regionEls = await overpass('regions', `[out:json][timeout:300];rel["boundary"="administrative"]["ISO3166-2"~"^MA-(0[1-9]|1[0-2])$"];out body;`);
  const regionOsm = new Map(regionEls.map((r) => [r.tags!['ISO3166-2'], r]));

  // 2. Provinces et préfectures : membres « subarea » des régions, puis contour de chacune (petites requêtes)
  const provRegion = new Map<number, string>();
  for (const [code, r] of regionOsm) for (const m of r.members ?? []) if (m.type === 'relation' && m.role === 'subarea') provRegion.set(m.ref, code);
  const ids = [...provRegion.keys()];
  if (!ids.length) throw new Error('Aucune province trouvée parmi les membres des régions');
  const provTags = await overpass('provinces', `[out:json][timeout:300];rel(id:${ids.join(',')});out tags center;`);
  const provEls: (OsmEl & { rings: Pt[][] })[] = [];
  for (const t of provTags) {
    if (t.tags?.admin_level && t.tags.admin_level !== '5') continue; // cercles, communes : ignorés
    const cache = join(CONTOURS, `${t.id}.json`);
    if (!fixtureDir && existsSync(cache)) {
      provEls.push({ ...t, rings: JSON.parse(readFileSync(cache, 'utf8')) as Pt[][] });
      continue;
    }
    if (Date.now() - T0 > CONTOUR_BUDGET_MS) {
      anomalies.push(`Contour reporté au prochain passage : ${nameFr(t.tags)} (relation ${t.id}).`);
      provEls.push({ ...t, rings: [] });
      continue;
    }
    try {
      const g = await overpass(`contour-${t.id}`, `[out:json][timeout:300];rel(${t.id});out geom;`);
      const rings = assembleRings(g[0]?.members ?? []).map(simplify);
      if (!fixtureDir && rings.length) { mkdirSync(CONTOURS, { recursive: true }); writeFileSync(cache, JSON.stringify(rings)); }
      provEls.push({ ...t, rings });
    } catch (e) {
      anomalies.push(`Contour indisponible pour ${nameFr(t.tags)} (relation ${t.id}) : ${String((e as Error).message).slice(0, 120)}`);
      provEls.push({ ...t, rings: [] });
    }
  }

  const regions: GeoRegion[] = REGIONS.map((ref) => ({ id: ref.code, name: ref.name, nameAr: ref.nameAr, osmId: regionOsm.get(ref.code)?.id ?? null, provinces: [] }));
  const byCode = new Map(regions.map((r) => [r.id, r]));
  for (const r of regions) if (!r.osmId) anomalies.push(`Région ${r.id} (${r.name}) absente d'OSM.`);

  const provShapes: { prov: GeoProvince; regionId: string; rings: Pt[][]; bbox: [number, number, number, number] }[] = [];
  for (const p of provEls) {
    const iso = p.tags?.['ISO3166-2'];
    const code = iso && /^MA-[A-Z]{3}$/.test(iso) ? iso : `osm-r${p.id}`;
    if (code.startsWith('osm-')) anomalies.push(`Province sans code ISO : ${nameFr(p.tags)} (relation ${p.id}).`);
    const rings = p.rings;
    const bbox: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const r of rings) for (const x of r) {
      if (x.lat < bbox[0]) bbox[0] = x.lat; if (x.lon < bbox[1]) bbox[1] = x.lon;
      if (x.lat > bbox[2]) bbox[2] = x.lat; if (x.lon > bbox[3]) bbox[3] = x.lon;
    }
    const regionId = provRegion.get(p.id) ?? null;
    if (!regionId && p.center) {
      // À défaut d'appartenance déclarée : région dont le contour contient le centre (si la relation régionale a une géométrie, sinon anomalie)
      anomalies.push(`Province ${code} (${nameFr(p.tags)}) non rattachée à une région dans OSM.`);
    }
    const prov: GeoProvince = { id: code, name: nameFr(p.tags), nameAr: p.tags?.['name:ar'] ?? null, osmId: p.id, lat: p.center ? round(p.center.lat) : null, lon: p.center ? round(p.center.lon) : null };
    if (regionId && byCode.has(regionId)) byCode.get(regionId)!.provinces.push(prov);
    if (!rings.length) anomalies.push(`Province ${code} sans contour exploitable.`);
    provShapes.push({ prov, regionId: regionId ?? '', rings, bbox });
  }
  for (const r of regions) r.provinces.sort((a, b) => a.name.localeCompare(b.name, 'fr'));

  // 3. Localités, rattachées à leur province par point dans polygone
  // Localités par tuiles (requêtes plus légères pour les serveurs Overpass)
  const placeEls: OsmEl[] = [];
  const TILES: [number, number, number, number][] = [];
  for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) TILES.push([round(20.5 + 2.6 * i), round(-17.3 + 4.1 * j), round(20.5 + 2.6 * (i + 1)), round(-17.3 + 4.1 * (j + 1))]);
  const PLACES = 'data-sources/geo/places'; // tuiles déjà obtenues (format compact), reprises au passage suivant
  let missingTiles = 0;
  for (const [a, b, c, d] of TILES) {
    const key = `places-${a.toFixed(1)}_${b.toFixed(1)}`;
    const cache = join(PLACES, `${key}.json`);
    if (!fixtureDir && existsSync(cache)) {
      const rows = JSON.parse(readFileSync(cache, 'utf8')) as [number, number, number, Record<string, string>][];
      for (const [id, lat, lon, tags] of rows) placeEls.push({ type: 'node', id, lat, lon, tags });
      continue;
    }
    try {
      const els = await overpass(key, `[out:json][timeout:300];node["place"~"^(city|town|village|suburb|quarter)$"]["name"](${a},${b},${c},${d});out;`);
      placeEls.push(...els);
      if (!fixtureDir) {
        mkdirSync(PLACES, { recursive: true });
        const keep = ['place', 'name', 'name:fr', 'name:ar', 'name:en', 'population'];
        writeFileSync(cache, JSON.stringify(els.map((e) => [e.id, e.lat, e.lon, Object.fromEntries(Object.entries(e.tags ?? {}).filter(([k]) => keep.includes(k)))])));
      }
    } catch (e) {
      missingTiles++;
      anomalies.push(`Tuile ${key} reportée au prochain passage : ${String((e as Error).message).slice(0, 120)}`);
    }
  }
  report.missingTiles = missingTiles;
  const localities: GeoLocality[] = [];
  const usedIds = new Set<string>();
  const seen = new Set<string>();
  let unplaced = 0;
  let approxCount = 0;
  for (const n of placeEls) {
    const kind = PLACE_KIND[n.tags!.place];
    const name = nameFr(n.tags);
    if (!kind || !name || n.lat == null || n.lon == null) continue;
    const pt = { lat: n.lat, lon: n.lon };
    const shape = provShapes.find((s) => pt.lat >= s.bbox[0] && pt.lat <= s.bbox[2] && pt.lon >= s.bbox[1] && pt.lon <= s.bbox[3] && s.rings.some((r) => inRing(pt, r)));
    let shape2 = shape;
    let approx = false;
    if (!shape2) {
      // Contour indisponible : province dont le centre est le plus proche, si elle n'a pas de contour (rattachement approximatif)
      let best: (typeof provShapes)[number] | null = null; let bd = Infinity;
      for (const s2 of provShapes) {
        if (s2.prov.lat === null || s2.prov.lon === null) continue;
        const dd = (s2.prov.lat - pt.lat) ** 2 + (s2.prov.lon - pt.lon) ** 2;
        if (dd < bd) { bd = dd; best = s2; }
      }
      if (!best || best.rings.length) { unplaced++; continue; } // hors du Maroc, ou dans une province dont le contour ne le contient pas
      shape2 = best; approx = true; approxCount++;
    }
    const shapeF = shape2;
    const base = `${slugify(name)}-${shapeF.prov.id.toLowerCase()}`;
    if (seen.has(base + kind)) continue;
    seen.add(base + kind);
    let id = base; let k = 2;
    while (usedIds.has(id)) id = `${base}-${k++}`;
    usedIds.add(id);
    localities.push({
      id, name, nameAr: n.tags!['name:ar'] ?? null, kind,
      provinceId: shapeF.prov.id, regionId: shapeF.regionId,
      ...(approx ? { provinceApprox: true } : {}),
      lat: round(n.lat), lon: round(n.lon),
      population: n.tags!.population && /^\d+$/.test(n.tags!.population) ? Number(n.tags!.population) : null,
      osmId: n.id,
    });
  }

  // Les quartiers sont rattachés à la ville la plus proche de la même province.
  const towns = localities.filter((l) => l.kind === 'city' || l.kind === 'town');
  for (const d of localities.filter((l) => l.kind === 'district')) {
    let best: GeoLocality | null = null; let bestD = Infinity;
    for (const t of towns) {
      if (t.provinceId !== d.provinceId) continue;
      const dd = (t.lat - d.lat) ** 2 + (t.lon - d.lon) ** 2;
      if (dd < bestD) { bestD = dd; best = t; }
    }
    d.parentId = best ? best.id : null;
  }

  localities.sort((a, b) => (b.population ?? 0) - (a.population ?? 0) || a.name.localeCompare(b.name, 'fr'));
  const byKind = localities.reduce<Record<string, number>>((m, l) => ((m[l.kind] = (m[l.kind] ?? 0) + 1), m), {});
  Object.assign(report, {
    finishedAt: new Date().toISOString(), ok: true,
    regions: regions.length, regionsWithProvinces: regions.filter((r) => r.provinces.length).length,
    provinces: provShapes.length, localities: localities.length, byKind, unplacedPlaces: unplaced, approxProvince: approxCount,
    contoursMissing: provShapes.filter((x) => !x.rings.length).length,
  });

  mkdirSync('public/data/geo', { recursive: true });
  const meta = { generatedAt: new Date().toISOString(), source: 'OpenStreetMap', licence: 'ODbL 1.0', attribution: '© les contributeurs d’OpenStreetMap' };
  writeFileSync('public/data/geo/regions.json', JSON.stringify({ ...meta, regions }));
  writeFileSync('public/data/geo/localities.json', JSON.stringify({ ...meta, localities }));
  saveReport();
  log(`Terminé : ${regions.length} régions, ${provShapes.length} provinces, ${localities.length} localités`);
}

main().catch((e) => {
  report.ok = false;
  report.error = String((e as Error)?.stack ?? e);
  saveReport();
  console.error(e);
  process.exit(1);
});
