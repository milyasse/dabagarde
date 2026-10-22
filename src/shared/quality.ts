// Contrôles de qualité appliqués aux gardes affichées (aucune donnée n'est corrigée en silence).
import type { Pharmacy } from './types.ts';
import { haversineKm, isInMorocco } from './distance.ts';
import { normalizeName } from './text.ts';

export type GeoPrecision = 'exact' | 'address' | 'approximate' | 'unknown';

export const GEO_PRECISION_LABEL: Record<GeoPrecision, string> = {
  exact: 'Position publiée par la source',
  address: 'Position calculée à partir de l’adresse',
  approximate: 'Position approximative (centre du quartier)',
  unknown: 'Position inconnue',
};

export function geoPrecision(p: Pick<Pharmacy, 'latitude' | 'longitude' | 'coordinatesSource'>): GeoPrecision {
  if (p.latitude === null || p.longitude === null) return 'unknown';
  if (p.coordinatesSource === 'district') return 'approximate';
  if (p.coordinatesSource === 'geocoded') return 'address';
  return 'exact';
}

export type QualityFlag = 'name_incomplete' | 'phone_missing' | 'phone_invalid' | 'coords_missing' | 'coords_outside' | 'coords_approx' | 'expired' | 'conflicting' | 'possible_duplicate';

export const QUALITY_LABEL: Record<QualityFlag, string> = {
  name_incomplete: 'Nom incomplet publié par la source',
  phone_missing: 'Téléphone non publié',
  phone_invalid: 'Numéro de téléphone au format inattendu',
  coords_missing: 'Position non publiée',
  coords_outside: 'Position incohérente (hors du Maroc) : ignorée',
  coords_approx: 'Position approximative',
  expired: 'Période de garde passée',
  conflicting: 'Sources en désaccord',
  possible_duplicate: 'Doublon possible avec une autre fiche',
};

const PHONE = /^\+212[5-7]\d{8}$/;

export function qualityFlags(p: Pharmacy, duplicates?: ReadonlySet<string>): QualityFlag[] {
  const f: QualityFlag[] = [];
  if (/^pharmacie\s*$/i.test(p.name.trim())) f.push('name_incomplete');
  if (!p.phone) f.push('phone_missing');
  else if (!PHONE.test(p.phone)) f.push('phone_invalid');
  if (p.latitude === null || p.longitude === null) f.push('coords_missing');
  else if (!isInMorocco(p.latitude, p.longitude)) f.push('coords_outside');
  else if (p.coordinatesSource === 'district') f.push('coords_approx');
  if (p.verificationStatus === 'expired') f.push('expired');
  if (p.verificationStatus === 'conflicting') f.push('conflicting');
  if (duplicates?.has(p.id)) f.push('possible_duplicate');
  return f;
}

/** Fiches probablement identiques : même numéro, ou même nom à moins de 300 m. */
export function findDuplicates(list: readonly Pharmacy[]): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      const samePhone = !!a.phone && a.phone === b.phone;
      const sameName = normalizeName(a.name) === normalizeName(b.name);
      const close = a.latitude !== null && b.latitude !== null && a.longitude !== null && b.longitude !== null
        && haversineKm({ lat: a.latitude, lng: a.longitude }, { lat: b.latitude, lng: b.longitude }) < 0.3;
      if (samePhone || (sameName && (close || a.latitude === null || b.latitude === null))) { out.add(a.id); out.add(b.id); }
    }
  }
  return out;
}

/** Libellés de rubrique repris par erreur à la place d'une valeur (ex. « Coordonnées »). */
const LABEL_ONLY = /^(coordonn[ée]es|adresse|t[ée]l[ée]phone|t[ée]l\.?|contact)\s*:?\s*$/i;

/**
 * Nettoyage d'affichage, sans rien inventer : coordonnées hors du Maroc ignorées,
 * adresse ou quartier réduits à un libellé de rubrique remplacés par « non communiqué ».
 */
export function usableCoords<T extends Pharmacy>(p: T): T {
  let out = p;
  if (p.latitude !== null && p.longitude !== null && !isInMorocco(p.latitude, p.longitude)) {
    out = { ...out, latitude: null, longitude: null, coordinatesSource: null };
  }
  if (out.address && LABEL_ONLY.test(out.address.trim())) out = { ...out, address: null };
  if (out.district && LABEL_ONLY.test(out.district.trim())) out = { ...out, district: null };
  return out;
}
