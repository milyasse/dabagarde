// Convertit les cliniques et hôpitaux extraits de l'extraction OpenStreetMap du Maroc (osmium export,
// GeoJSON séquentiel) au format lu par scripts/collect-health.ts (proche d'une réponse Overpass).
// Usage : node scripts/osm-health.ts <sante.geojsonseq> <horodatage de la base OSM>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const [input, osmBase] = process.argv.slice(2);
if (!input) { console.error('Usage : node scripts/osm-health.ts <fichier.geojsonseq> [horodatage]'); process.exit(2); }
const elements: { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags: Record<string, string> }[] = [];
for (const raw of readFileSync(input, 'utf8').split('\n')) {
  const line = raw.replace(/^\x1e/, '').trim();
  if (!line) continue;
  const f = JSON.parse(line) as { geometry: { type: string; coordinates: unknown }; properties: Record<string, unknown> };
  const { '@type': type, '@id': id, ...rest } = f.properties;
  const tags = Object.fromEntries(Object.entries(rest).filter(([, v]) => typeof v === 'string')) as Record<string, string>;
  const g = f.geometry;
  if (g.type === 'Point') {
    const [lon, lat] = g.coordinates as [number, number];
    elements.push({ type: String(type), id: Number(id), lat, lon, tags });
  } else {
    // centre approximatif : moyenne des sommets de l'anneau extérieur
    const rings = g.type === 'Polygon' ? [(g.coordinates as number[][][])[0]] : g.type === 'MultiPolygon' ? (g.coordinates as number[][][][]).map((p) => p[0]) : [];
    const pts = rings.flat();
    if (!pts.length) continue;
    const lon = pts.reduce((s, p) => s + p[0], 0) / pts.length, lat = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    elements.push({ type: String(type), id: Number(id), center: { lat: Math.round(lat * 1e6) / 1e6, lon: Math.round(lon * 1e6) / 1e6 }, tags });
  }
}
mkdirSync('public/data/sante', { recursive: true });
writeFileSync('public/data/sante/osm-brut.json', JSON.stringify({ osm3s: { timestamp_osm_base: osmBase || null }, fetchedAt: new Date().toISOString(), elements }) + '\n');
console.log(`OpenStreetMap santé : ${elements.length} objets (Maroc entier)`);
