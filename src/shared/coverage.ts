// Couverture des données de garde : où une source exploitable existe réellement.
// Règle : une ville sans source n'est jamais présentée comme couverte.
import type { CityId } from './types.ts';
import { haversineKm, type LatLng } from './distance.ts';
import { CITIES } from './connectors/registry.ts';
import { slugify } from './geo/slug.ts';

export type CoverageStatus = 'covered' | 'near' | 'none';

export interface Coverage {
  status: CoverageStatus;
  cityId: CityId | null;
  cityName: string | null;
  distanceKm: number | null; // distance au centre de la ville couverte la plus proche
}

/** Au-delà de ces distances du centre d'une ville couverte, on prévient l'utilisateur. */
export const COVERED_RADIUS_KM = 15;
export const NEAR_RADIUS_KM = 40;

export function coverageAt(p: LatLng): Coverage {
  let best: { id: CityId; name: string; d: number } | null = null;
  for (const c of CITIES) {
    const d = haversineKm(p, c.center);
    if (!best || d < best.d) best = { id: c.id, name: c.name, d };
  }
  if (!best) return { status: 'none', cityId: null, cityName: null, distanceKm: null };
  const status: CoverageStatus = best.d <= COVERED_RADIUS_KM ? 'covered' : best.d <= NEAR_RADIUS_KM ? 'near' : 'none';
  return { status, cityId: best.id, cityName: best.name, distanceKm: Math.round(best.d) };
}

/**
 * Villes pour lesquelles garde24.ma publie une page (relevé du 22/10/2026, page d'accueil publique).
 * Utilisé uniquement pour proposer un LIEN vers la page d'origine : aucune donnée n'est reprise,
 * conformément à ses conditions d'utilisation.
 */
export const GARDE24_CITY_SLUGS = new Set([
  'agadir', 'ain-chaib', 'ait-melloul', 'al-arrui', 'al-hoceima', 'azrou', 'ben-guerir', 'ben-slimane', 'beni-mellal',
  'berkane', 'berrechid', 'biougra', 'boujad', 'bouskoura', 'bouznika', 'casablanca', 'chefchaouen', 'dar-bouazza',
  'dcheira', 'deroua', 'el-jadida', 'el-kelaa', 'el-menzeh', 'errachidia', 'essaouira', 'fes', 'guelmim', 'guercif',
  'harhoura', 'inezgane', 'kasbah-tadla', 'kenitra', 'khemisset', 'khenifra', 'khouribga', 'ksar-el-kebir', 'laayoune',
  'larache', 'm-dieq', 'marrakech', 'mechraa-bel-ksiri', 'mehdia', 'meknes', 'mohammedia', 'mrirt', 'nador', 'ouarzazate',
  'ouazzane', 'oued-zem', 'oujda', 'rabat', 'safi', 'sala-al-jadida', 'sale', 'sefrou', 'selouane', 'settat', 'sidi-bennour',
  'sidi-kacem', 'sidi-slimane', 'souk-el-arba-du-gharb', 'tahla', 'tan-tan', 'tanger', 'taourirt', 'taza', 'temara',
  'tetouan', 'tiflet', 'tikiouine', 'tinghir', 'tiznit', 'youssoufia', 'zagora', 'zeghanghane',
]);

// label : modèle où {lieu} est remplacé par le nom du lieu à l'affichage.
export interface ExternalLink { label: string; url: string; note: string }

/** Liens vers des pages publiques d'origine, pour une ville sans source exploitable ici. */
export function externalLinks(placeName: string): ExternalLink[] {
  const out: ExternalLink[] = [];
  const slug = slugify(placeName);
  if (GARDE24_CITY_SLUGS.has(slug)) {
    out.push({ label: 'Voir la page {lieu} sur garde24.ma', url: `https://garde24.ma/fr/pharmacie-de-garde/${slug}`, note: 'Site indépendant, non affilié : vérifiez sa date de mise à jour.' });
  }
  out.push({
    label: 'Rechercher « pharmacie de garde {lieu} » sur le web',
    url: `https://www.google.com/search?q=${encodeURIComponent(`pharmacie de garde ${placeName}`)}`,
    note: 'Résultats non vérifiés par nous.',
  });
  return out;
}
