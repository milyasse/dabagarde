// Construit la base géographique nationale (régions, provinces/préfectures, communes, localités)
// à partir d'OpenStreetMap (licence ODbL, attribution « © les contributeurs d'OpenStreetMap »).
//
// Exécuté en CI (workflow « geo »), jamais dans le navigateur : la base change rarement.
// Sorties :
//   public/data/geo/regions.json     12 régions, avec leurs provinces
//   public/data/geo/localities.json  localités (villes, centres, villages, quartiers) pour la recherche
//   data-sources/geo/report.json     statistiques et anomalies à relire
//
// Identifiants stables :
//   - région   : code ISO 3166-2 officiel (MA-01 … MA-12)
//   - province : code ISO 3166-2 publié dans OSM (ex. MA-RAB), sinon "osm-r<id>"
//   - localité : "<slug>-<code province en minuscules>" (ex. "rabat-ma-rab"), stable tant que le nom
//                et la province ne changent pas ; l'identifiant OSM est conservé à part.
//
// Usage : node --experimental-strip-types scripts/build-geo.ts [--fixture <dir>]
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { REGIONS } from '../src/shared/geo/regions.ts';
import { slugify } from '../src/shared/geo/slug.ts';
import type { GeoLocality, GeoProvince, GeoRegion, LocalityKind } from '../src/shared/geo/types.ts';

const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
const UA = `PharmaciesGardeMaroc-geo/1.0 (+https://github.com/${process.env.GITHUB_REPOSITORY ?? 'local'})`;
const PAUSE_MS = 4000; // espacement entre requêtes, par respect de la politique d'usage d'Overpass

type OsmEl = { type: 'node' | 'way' | 'relation'; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };

const args = process.argv.slice(2);
const fixtureDir = args.includes('--fixture') ? args[args.indexOf('--fixture') + 1] : null;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function overpass(key: string, query: string): Promise<OsmEl[]> {
  if (fixtureDir) {
    const f = join(fixtureDir, `${key}.json`);
    return existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')).elements as OsmEl[]) : [];
  }
  let last: unknown = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const url of ENDPOINTS) {
      try {
        const res = await fetch(url, { method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'data=' + encodeURIComponent(query) });
        if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
        const json = (await res.json()) as { elements: OsmEl[] };
        await sleep(PAUSE_MS);
        return json.elements;
      } catch (e) { last = e; await sleep(PAUSE_MS * 3); }
    }
  }
  throw new Error(`Overpass indisponible pour ${key} : ${String(last)}`);
}

const pt = (e: OsmEl) => (e.lat != null ? { lat: e.lat, lon: e.lon! } : e.center ?? null);
const nameFr = (t: Record<string, string> = {}) => t['name:fr'] || t['name'] || t['name:en'] || t['name:ar'] || '';
const round = (x: number) => Math.round(x * 1e5) / 1e5;

const PLACE_KIND: Record<string, LocalityKind> = { city: 'city', town: 'town', village: 'village', suburb: 'district', quarter: 'district', neighbourhood: 'district' };

async function main() {
  const report: Record<string, unknown> = { generatedAt: new Date().toISOString(), anomalies: [] as string[] };
  const anomalies = report.anomalies as string[];

  // 1. Régions : relations OSM portant un code ISO officiel connu.
  const regionEls = await overpass('regions', '[out:json][timeout:120];rel["boundary"="administrative"]["ISO3166-2"~"^MA-(0[1-9]|1[0-2])$"];out tags center;');
  const regionOsm = new Map(regionEls.map((r) => [r.tags!['ISO3166-2'], r]));

  const regions: GeoRegion[] = [];
  const localities: GeoLocality[] = [];
  const usedIds = new Set<string>();

  for (const ref of REGIONS) {
    const rel = regionOsm.get(ref.code);
    const region: GeoRegion = { id: ref.code, name: ref.name, nameAr: ref.nameAr, osmId: rel?.id ?? null, provinces: [] };
    regions.push(region);
    if (!rel) { anomalies.push(`Région ${ref.code} (${ref.name}) absente d'OSM : provinces non rattachées automatiquement.`); continue; }

    // 2. Provinces et préfectures de la région (niveau administratif suivant).
    const area = 3600000000 + rel.id;
    const provEls = await overpass(`prov-${ref.code}`, `[out:json][timeout:180];area(${area})->.r;rel(area.r)["boundary"="administrative"]["admin_level"~"^(5|6)$"];out tags center;`);
    // Ne garder que les entités portant un code ISO de province si la région en compte (évite les cercles).
    const iso = (e: OsmEl) => /^MA-[A-Z]{3}$/.test(e.tags?.['ISO3166-2'] ?? '');
    const kept = provEls.some(iso) ? provEls.filter(iso) : provEls.filter((e) => e.tags?.admin_level === '5');
    for (const p of kept) {
      const code = p.tags?.['ISO3166-2'] && /^MA-[A-Z]{3}$/.test(p.tags['ISO3166-2']) ? p.tags['ISO3166-2'] : `osm-r${p.id}`;
      if (region.provinces.some((x) => x.id === code)) continue;
      const c = pt(p);
      const prov: GeoProvince = { id: code, name: nameFr(p.tags), nameAr: p.tags?.['name:ar'] ?? null, osmId: p.id, lat: c ? round(c.lat) : null, lon: c ? round(c.lon) : null };
      region.provinces.push(prov);
      if (code.startsWith('osm-')) anomalies.push(`Province sans code ISO : ${prov.name} (relation ${p.id}).`);

      // 3. Localités de la province (villes, centres, villages, quartiers).
      const pArea = 3600000000 + p.id;
      const placeEls = await overpass(`places-${code}`, `[out:json][timeout:180];area(${pArea})->.p;node(area.p)["place"~"^(city|town|village|suburb|quarter|neighbourhood)$"]["name"];out;`);
      const seen = new Set<string>();
      for (const n of placeEls) {
        const kind = PLACE_KIND[n.tags!.place];
        const name = nameFr(n.tags);
        if (!kind || !name || n.lat == null) continue;
        const base = `${slugify(name)}-${code.toLowerCase()}`;
        if (seen.has(base + kind)) continue; // doublon de nom dans la même province
        seen.add(base + kind);
        let id = base; let k = 2;
        while (usedIds.has(id)) id = `${base}-${k++}`;
        usedIds.add(id);
        localities.push({
          id, name, nameAr: n.tags!['name:ar'] ?? null, kind,
          provinceId: code, regionId: ref.code,
          lat: round(n.lat), lon: round(n.lon!),
          population: n.tags!.population && /^\d+$/.test(n.tags!.population) ? Number(n.tags!.population) : null,
          osmId: n.id,
        });
      }
    }
    region.provinces.sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }

  // Les quartiers (district) sont rattachés à la ville la plus proche de la même province.
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
  const counts = localities.reduce<Record<string, number>>((m, l) => ((m[l.kind] = (m[l.kind] ?? 0) + 1), m), {});
  Object.assign(report, { regions: regions.length, provinces: regions.reduce((s, r) => s + r.provinces.length, 0), localities: localities.length, byKind: counts });

  mkdirSync('public/data/geo', { recursive: true });
  mkdirSync('data-sources/geo', { recursive: true });
  const meta = { generatedAt: report.generatedAt, source: 'OpenStreetMap', licence: 'ODbL 1.0', attribution: '© les contributeurs d’OpenStreetMap' };
  writeFileSync('public/data/geo/regions.json', JSON.stringify({ ...meta, regions }));
  writeFileSync('public/data/geo/localities.json', JSON.stringify({ ...meta, localities }));
  writeFileSync('data-sources/geo/report.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
