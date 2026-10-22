// Collecteur des cliniques et hôpitaux — exécuté par GitHub Actions avec la collecte des pharmacies.
// Node ≥ 22 : `node --experimental-strip-types scripts/collect-health.ts [--dry-run] [--osm-fixture <fichier.json>]`
//
// Sources : OpenStreetMap — tout le Maroc, extrait chaque semaine de l'extraction Geofabrik par le workflow
// « Base géographique » (public/data/sante/osm-brut.json ; plus d'appel à l'API Overpass, saturée) —, liste officielle des hôpitaux du
// ministère de la Santé (data.gov.ma, extraite dans data-sources/sante/), saisies vérifiées (manual/sante.json).
// Écrit public/data/sante/etablissements.json (+ la réponse OSM brute, pour reconstruire sans re-télécharger).

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { buildEstablishments, type CorrespondenceFile, type ManualHealthFile, type MinistryFile, type OverpassResponse } from '../src/shared/health/build.ts';
import type { HealthDataset } from '../src/shared/health/types.ts';

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const fixIdx = args.indexOf('--osm-fixture');
const OSM_FIXTURE = fixIdx >= 0 ? path.resolve(args[fixIdx + 1]) : null;
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const outIdx = args.indexOf('--out');
const OUT = outIdx >= 0 ? path.resolve(args[outIdx + 1]) : path.join(ROOT, 'public', 'data', 'sante');
const RAW = path.join(OUT, 'osm-brut.json');
const DATASET = path.join(OUT, 'etablissements.json');


const log = (...a: unknown[]) => console.log('[sante]', ...a);
const readJson = async <T>(f: string): Promise<T | null> => (existsSync(f) ? (JSON.parse(await readFile(f, 'utf8')) as T) : null);

async function main() {
  await mkdir(OUT, { recursive: true });
  const prevRaw = await readJson<OverpassResponse & { fetchedAt?: string }>(RAW);
  const prev = await readJson<HealthDataset>(DATASET);
  let raw = prevRaw;
  let lastError: string | null = null;

  if (OSM_FIXTURE) {
    raw = { ...(JSON.parse(await readFile(OSM_FIXTURE, 'utf8')) as OverpassResponse), fetchedAt: new Date().toISOString() };
  } else if (!raw) {
    lastError = 'Extraction OpenStreetMap absente : lancer le workflow « Base géographique ».';
    log(lastError);
  } else {
    log(`OpenStreetMap : ${raw.elements.length} objets (extraction du ${raw.fetchedAt ?? '?'}).`);
  }

  const ministry = await readJson<MinistryFile>(path.join(ROOT, 'data-sources', 'sante', 'ministere-hopitaux-2022.json'));
  const correspondences = await readJson<CorrespondenceFile>(path.join(ROOT, 'data-sources', 'sante', 'correspondances-osm.json'));
  const manual = await readJson<ManualHealthFile>(path.join(ROOT, 'manual', 'sante.json'));
  const localities = await readJson<{ localities: { name: string; lat: number; lon: number; kind: string }[] }>(path.join(ROOT, 'public', 'data', 'geo', 'localities.json'));
  const regions = await readJson<{ regions: { provinces: { name: string; lat: number | null; lon: number | null }[] }[] }>(path.join(ROOT, 'public', 'data', 'geo', 'regions.json'));
  const geo = localities && regions ? { places: localities.localities, provinces: regions.regions.flatMap((r) => r.provinces) } : null;
  if (!geo) log('base géographique absente : hôpitaux du ministère non situés');
  const establishments = buildEstablishments({ overpass: raw, ministry, correspondences, manual, geo, log });

  const dataset: HealthDataset = {
    generatedAt: new Date().toISOString(),
    osmBase: raw?.osm3s?.timestamp_osm_base ?? null,
    ministryDataDate: ministry?.donneesMisesAJourLe ?? null,
    lastError,
    establishments,
  };
  const located = establishments.filter((e) => e.latitude !== null).length;
  log(`${establishments.length} établissements (${located} positionnés, ${establishments.filter((e) => e.emergency === 'yes').length} avec urgences déclarées).`);

  // N'écrire que si le contenu a changé (évite un commit toutes les 2 h pour rien)
  const same = prev && JSON.stringify(prev.establishments) === JSON.stringify(establishments) && prev.lastError === lastError && prev.osmBase === dataset.osmBase;
  if (DRY) log('simulation : rien n’est écrit.');
  else if (same) log('aucun changement.');
  else await writeFile(DATASET, JSON.stringify(dataset, null, 1) + '\n');
  if (!raw) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
