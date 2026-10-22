// Base géographique nationale (générée en CI à partir d'OpenStreetMap), chargée à la demande.
import { CONFIG } from '../config.ts';
import { cachedJson } from './pharmacySearch.ts';
import type { GeoLocality, GeoRegion } from '../shared/geo/types.ts';

export interface GeoBase { regions: GeoRegion[]; localities: GeoLocality[]; generatedAt: string | null }

let pending: Promise<GeoBase> | null = null;

export function loadGeo(): Promise<GeoBase> {
  if (!pending) {
    pending = Promise.all([
      cachedJson<{ regions: GeoRegion[]; generatedAt: string }>(`${CONFIG.dataUrl}/geo/regions.json`),
      cachedJson<{ localities: GeoLocality[]; generatedAt: string }>(`${CONFIG.dataUrl}/geo/localities.json`),
    ]).then(([r, l]) => ({ regions: r?.regions ?? [], localities: l?.localities ?? [], generatedAt: l?.generatedAt ?? null }))
      .catch((e) => { pending = null; throw e; });
  }
  return pending;
}
