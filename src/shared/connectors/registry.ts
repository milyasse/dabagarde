// Registre des sources. Ajouter/désactiver une source = modifier ce fichier
// (et, pour une source active, fournir son parseur + son entrée dans scripts/collect.ts).

import type { CityId, ConnectorInfo } from '../types.ts';

/** Villes couvertes par au moins une source (slug de page chez chaque source ; les villes absentes d'une source sont simplement ignorées par elle). */
export interface City { id: CityId; name: string; center: { lat: number; lng: number }; annuaire?: string; guide?: string[] }

export const CITIES: City[] = [
  { id: 'rabat', name: 'Rabat', center: { lat: 34.0209, lng: -6.8416 }, annuaire: 'rabat', guide: ['rabat'] },
  { id: 'sale', name: 'Salé', center: { lat: 34.0531, lng: -6.7985 }, annuaire: 'sale', guide: ['sale'] },
  { id: 'temara', name: 'Témara', center: { lat: 33.9287, lng: -6.9063 }, annuaire: 'temara', guide: ['temara', 'temara-tamesna'] },
  { id: 'ain-aouda', name: 'Aïn Aouda', center: { lat: 33.8071, lng: -6.7912 }, guide: ['ain-aouda'] },
  { id: 'kenitra', name: 'Kénitra', center: { lat: 34.2646, lng: -6.5702 }, annuaire: 'kenitra', guide: ['kenitra', 'mehdia-kenitra', 'kenitra-mehdia'] },
  { id: 'casablanca', name: 'Casablanca', center: { lat: 33.5945, lng: -7.62 }, annuaire: 'casablanca', guide: ['casablanca'] },
  { id: 'mohammedia', name: 'Mohammedia', center: { lat: 33.6958, lng: -7.3893 }, annuaire: 'mohammedia' },
  { id: 'berrechid', name: 'Berrechid', center: { lat: 33.2677, lng: -7.5812 }, annuaire: 'berrechid' },
  { id: 'settat', name: 'Settat', center: { lat: 33.0024, lng: -7.6199 }, annuaire: 'settat' },
  { id: 'el-jadida', name: 'El Jadida', center: { lat: 33.2433, lng: -8.4988 }, annuaire: 'el-jadida' },
  { id: 'khouribga', name: 'Khouribga', center: { lat: 32.8857, lng: -6.9088 }, annuaire: 'khouribga' },
  { id: 'marrakech', name: 'Marrakech', center: { lat: 31.6258, lng: -7.9892 }, annuaire: 'marrakech' },
  { id: 'ben-guerir', name: 'Ben Guerir', center: { lat: 32.239, lng: -7.9581 }, annuaire: 'ben-guerir' },
  { id: 'safi', name: 'Safi', center: { lat: 32.2994, lng: -9.2395 }, annuaire: 'safi' },
  { id: 'agadir', name: 'Agadir', center: { lat: 30.4205, lng: -9.5839 }, annuaire: 'agadir' },
  { id: 'inezgane', name: 'Inezgane', center: { lat: 30.3563, lng: -9.5459 }, annuaire: 'inezgane' },
  { id: 'ait-melloul', name: 'Aït Melloul', center: { lat: 30.3388, lng: -9.5045 }, annuaire: 'ait-melloul' },
  { id: 'dcheira', name: 'Dcheira El Jihadia', center: { lat: 30.3744, lng: -9.5322 }, annuaire: 'dcheira' },
  { id: 'tikiouine', name: 'Tikiouine', center: { lat: 30.4019, lng: -9.5262 }, annuaire: 'tikiouine' },
  { id: 'fes', name: 'Fès', center: { lat: 34.0347, lng: -5.0162 }, annuaire: 'fes' },
  { id: 'sefrou', name: 'Sefrou', center: { lat: 33.8249, lng: -4.8333 }, annuaire: 'sefrou' },
  { id: 'meknes', name: 'Meknès', center: { lat: 33.8984, lng: -5.5322 }, annuaire: 'meknes' },
  { id: 'tanger', name: 'Tanger', center: { lat: 35.7695, lng: -5.8045 }, annuaire: 'tanger' },
  { id: 'tetouan', name: 'Tétouan', center: { lat: 35.5697, lng: -5.3758 }, annuaire: 'tetouan' },
  { id: 'oujda', name: 'Oujda', center: { lat: 34.6779, lng: -1.9293 }, annuaire: 'oujda' },
  { id: 'nador', name: 'Nador', center: { lat: 35.1739, lng: -2.9292 }, annuaire: 'nador' },
  { id: 'selouane', name: 'Selouane', center: { lat: 35.0728, lng: -2.9417 }, annuaire: 'selouane' },
];

export const CITY_NAME: Record<CityId, string> = Object.fromEntries(CITIES.map((c) => [c.id, c.name]));

const ANNUAIRE_CITIES = CITIES.filter((c) => c.annuaire).map((c) => c.id);
const GUIDE_CITIES = CITIES.filter((c) => c.guide).map((c) => c.id);

export const CONNECTORS: ConnectorInfo[] = [
  {
    id: 'annuaire-gratuit',
    name: 'annuaire-gratuit.ma',
    homepage: 'https://www.annuaire-gratuit.ma/',
    enabled: true,
    cities: ANNUAIRE_CITIES,
    reason:
      'Liste du jour par ville + historique de garde daté (début/fin) sur chaque fiche. Pages autorisées par robots.txt. Collecte espacée (≥ 1,5 s entre requêtes), toutes les ~2 h.',
  },
  {
    id: 'guidepharmacies',
    name: 'guidepharmacies.ma',
    homepage: 'https://www.guidepharmacies.ma/pharmacies-de-garde.html',
    enabled: true,
    cities: GUIDE_CITIES,
    reason:
      'Planning hebdomadaire publié à l’avance (semaine en cours et suivante) : jours à venir disponibles. Position publiée = centre du quartier, complétée par la position exacte d’une autre source ou par l’adresse de la fiche.',
  },
  {
    id: 'manual',
    name: 'Saisie manuelle (tableau de garde officiel)',
    homepage: '',
    enabled: true,
    cities: CITIES.map((c) => c.id),
    reason:
      'Fichiers manual/AAAA-MM-JJ.json : permet de saisir un tableau de garde officiel (Ordre / conseil régional) avec son URL ou sa référence.',
  },
  {
    id: 'lematin',
    name: 'lematin.ma',
    homepage: 'https://lematin.ma/pharmacie-garde/rabat',
    enabled: false,
    cities: ['rabat'],
    reason:
      'Désactivé : couvre Rabat uniquement (pas Salé ni Témara) et la liste est chargée par un point d’accès interdit par le robots.txt du site (/ajax/, /api/).',
  },
  {
    id: 'wadifapublic',
    name: 'wadifapublic.ma',
    homepage: 'https://www.wadifapublic.ma/fr/pharmacie-de-garde-maroc/rabat',
    enabled: false,
    cities: ['rabat', 'sale', 'temara'],
    reason:
      'Désactivé : listes sans date de validité explicite et dispositif anti-robot (« honeypot ») présent sur les pages ; nous ne contournons pas les protections.',
  },
  {
    id: 'med-ma',
    name: 'med.ma',
    homepage: 'https://www.med.ma/pharmacie/garde-24-24/rabat',
    enabled: false,
    cities: ['rabat', 'sale', 'temara'],
    reason: 'Non utilisé pour les gardes : annuaire sans date de validité ni horodatage de mise à jour.',
  },
];
