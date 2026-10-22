// Construit la base géographique nationale (régions, provinces/préfectures, localités, quartiers)
// à partir de l'extraction OpenStreetMap du Maroc publiée chaque jour par Geofabrik (licence ODbL,
// « © les contributeurs d'OpenStreetMap »).
//
// Pourquoi l'extraction plutôt que l'API Overpass : les serveurs Overpass publics renvoient très souvent
// des erreurs 502/504 pour des requêtes de contours ; un passage complet dépassait 2 heures sans aboutir.
// Ici, un seul téléchargement, puis un filtrage local (osmium) en quelques minutes.
//
// Étapes (workflow « Base géographique ») :
//   1. curl https://download.geofabrik.de/africa/morocco-latest.osm.pbf
//   2. osmium tags-filter … r/boundary=administrative n/place=… → geo.osm.pbf
//   3. osmium export geo.osm.pbf -f geojsonseq -a type,id → geo.geojsonseq
//   4. node scripts/build-geo.ts geo.geojsonseq
//
// Sorties :
//   public/data/geo/regions.json     12 régions et leurs provinces
//   public/data/geo/localities.json  villes, centres, villages et quartiers (recherche instantanée)
//   data-sources/geo/report.json     statistiques et anomalies à relire
//
// Identifiants stables : région = code ISO 3166-2 (MA-01…MA-12) ; province = code ISO publié dans OSM
// (ex. MA-RAB), sinon "osm-r<id>" ; localité = "<slug>-<province>" (ex. "rabat-ma-rab").
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { REGIONS } from '../src/shared/geo/regions.ts';
import { slugify } from '../src/shared/geo/slug.ts';
import type { GeoLocality, GeoProvince, GeoRegion, LocalityKind } from '../src/shared/geo/types.ts';

type Ring = [number, number][]; // [lon, lat]
type Poly = Ring[]; // anneau extérieur puis trous
interface Feature {
  geometry: { type: string; coordinates: unknown };
  properties: Record<string, string | number>;
}
interface Shape { polys: Poly[]; bbox: [number, number, number, number]; centroid: [number, number] }

const input = process.argv[2];
if (!input) { console.error('Usage : node scripts/build-geo.ts <fichier.geojsonseq>'); process.exit(2); }

const report: Record<string, unknown> = { generatedAt: new Date().toISOString(), source: 'Geofabrik morocco-latest.osm.pbf', anomalies: [] as string[] };
const anomalies = report.anomalies as string[];
const round = (x: number) => Math.round(x * 1e5) / 1e5;
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const nameFr = (p: Record<string, unknown>) => str(p['name:fr']) || str(p['name']) || str(p['name:en']);

function shapeOf(f: Feature): Shape | null {
  const g = f.geometry;
  const polys = g.type === 'Polygon' ? [g.coordinates as Poly] : g.type === 'MultiPolygon' ? (g.coordinates as Poly[]) : null;
  if (!polys || !polys.length) return null;
  const bbox: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity]; // minLon, minLat, maxLon, maxLat
  let sx = 0, sy = 0, n = 0;
  for (const p of polys) for (const [x, y] of p[0]) {
    if (x < bbox[0]) bbox[0] = x;
    if (y < bbox[1]) bbox[1] = y;
    if (x > bbox[2]) bbox[2] = x;
    if (y > bbox[3]) bbox[3] = y;
    sx += x; sy += y; n++;
  }
  return { polys, bbox, centroid: [sx / n, sy / n] };
}

function inRing(x: number, y: number, r: Ring): boolean {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function contains(s: Shape, x: number, y: number): boolean {
  if (x < s.bbox[0] || x > s.bbox[2] || y < s.bbox[1] || y > s.bbox[3]) return false;
  return s.polys.some((p) => inRing(x, y, p[0]) && !p.slice(1).some((h) => inRing(x, y, h)));
}

// ---------- Lecture
const regionShapes = new Map<string, { osmId: number; shape: Shape }>();
const provinces: { prov: GeoProvince; shape: Shape }[] = [];
const places: Feature[] = [];
let lines = 0;
for (const raw of readFileSync(input, 'utf8').split('\n')) {
  const line = raw.replace(/^\x1e/, '').trim();
  if (!line) continue;
  lines++;
  const f = JSON.parse(line) as Feature;
  const p = f.properties;
  const iso = str(p['ISO3166-2']);
  if (f.geometry.type === 'Point') { if (p['place']) places.push(f); continue; }
  if (p['boundary'] !== 'administrative' || p['@type'] !== 'relation') continue;
  const shape = shapeOf(f);
  if (!shape) continue;
  if (/^MA-(0[1-9]|1[0-2])$/.test(iso)) regionShapes.set(iso, { osmId: Number(p['@id']), shape });
  else if (String(p['admin_level']) === '5' && /^MA-[A-Z]{3}$/.test(iso)) {
    provinces.push({ prov: { id: iso, name: nameFr(p), nameAr: str(p['name:ar']) || null, osmId: Number(p['@id']), lat: round(shape.centroid[1]), lon: round(shape.centroid[0]) }, shape });
  }
}
report.featuresRead = lines;

// ---------- Régions et provinces
const regions: GeoRegion[] = REGIONS.map((r) => ({ id: r.code, name: r.name, nameAr: r.nameAr, osmId: regionShapes.get(r.code)?.osmId ?? null, provinces: [] }));
for (const r of regions) if (!r.osmId) anomalies.push(`Région ${r.id} (${r.name}) absente de l'extraction.`);
const provRegion = new Map<string, string>();
for (const { prov, shape } of provinces) {
  const [cx, cy] = shape.centroid;
  let rid = [...regionShapes].find(([, r]) => contains(r.shape, cx, cy))?.[0];
  if (!rid) {
    // centre hors de toutes les régions (forme très concave) : vote des sommets de la province
    const votes = new Map<string, number>();
    const ring = shape.polys[0][0];
    for (let i = 0; i < ring.length; i += Math.max(1, Math.floor(ring.length / 40))) {
      for (const [code, r] of regionShapes) if (contains(r.shape, ring[i][0], ring[i][1])) votes.set(code, (votes.get(code) ?? 0) + 1);
    }
    rid = [...votes].sort((a, b) => b[1] - a[1])[0]?.[0];
  }
  if (!rid) { anomalies.push(`Province ${prov.id} (${prov.name}) non rattachée à une région.`); continue; }
  provRegion.set(prov.id, rid);
  regions.find((r) => r.id === rid)!.provinces.push(prov);
}
for (const r of regions) r.provinces.sort((a, b) => a.name.localeCompare(b.name, 'fr'));

// ---------- Localités
const KIND: Record<string, LocalityKind> = { city: 'city', town: 'town', village: 'village', suburb: 'district', quarter: 'district' };
const localities: GeoLocality[] = [];
const used = new Set<string>(), seen = new Set<string>();
let outside = 0;
for (const f of places) {
  const p = f.properties;
  const kind = KIND[str(p['place'])];
  const name = nameFr(p);
  if (!kind || !name) continue;
  const [lon, lat] = f.geometry.coordinates as [number, number];
  const hit = provinces.find((x) => contains(x.shape, lon, lat));
  if (!hit || !provRegion.has(hit.prov.id)) { outside++; continue; }
  const base = `${slugify(name)}-${hit.prov.id.toLowerCase()}`;
  if (seen.has(base + kind)) continue;
  seen.add(base + kind);
  let id = base; let k = 2;
  while (used.has(id)) id = `${base}-${k++}`;
  used.add(id);
  const pop = str(p['population']);
  localities.push({
    id, name, nameAr: str(p['name:ar']) || null, kind,
    provinceId: hit.prov.id, regionId: provRegion.get(hit.prov.id)!,
    lat: round(lat), lon: round(lon),
    population: /^\d+$/.test(pop) ? Number(pop) : null,
    osmId: Number(p['@id']),
  });
}
// Quartiers rattachés à la ville la plus proche de la même province
const towns = localities.filter((l) => l.kind === 'city' || l.kind === 'town');
for (const d of localities.filter((l) => l.kind === 'district')) {
  let best: GeoLocality | null = null; let bd = Infinity;
  for (const t of towns) {
    if (t.provinceId !== d.provinceId) continue;
    const dd = (t.lat - d.lat) ** 2 + (t.lon - d.lon) ** 2;
    if (dd < bd) { bd = dd; best = t; }
  }
  d.parentId = best ? best.id : null;
}
localities.sort((a, b) => (b.population ?? 0) - (a.population ?? 0) || a.name.localeCompare(b.name, 'fr'));

// ---------- Écriture et contrôles
const byKind = localities.reduce<Record<string, number>>((m, l) => ((m[l.kind] = (m[l.kind] ?? 0) + 1), m), {});
const perRegion = Object.fromEntries(regions.map((r) => [r.id, { provinces: r.provinces.length, localites: localities.filter((l) => l.regionId === r.id).length }]));
for (const r of regions) if (!r.provinces.length) anomalies.push(`Région ${r.id} (${r.name}) sans province.`);
Object.assign(report, { ok: true, regions: regions.length, provinces: provinces.length, localities: localities.length, byKind, perRegion, placesOutsideProvinces: outside });

mkdirSync('public/data/geo', { recursive: true });
mkdirSync('data-sources/geo', { recursive: true });
const meta = { generatedAt: report.generatedAt, source: 'OpenStreetMap (extraction Geofabrik)', licence: 'ODbL 1.0', attribution: '© les contributeurs d’OpenStreetMap' };
writeFileSync('public/data/geo/regions.json', JSON.stringify({ ...meta, regions }));
writeFileSync('public/data/geo/localities.json', JSON.stringify({ ...meta, localities }));
writeFileSync('data-sources/geo/report.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify({ ...report, anomalies: anomalies.slice(0, 20) }, null, 2));
if (provinces.length < 50 || localities.length < 500) { console.error('Base incomplète : vérifier l’extraction.'); process.exit(1); }
