// Tests de la couverture nationale : recherche de localités, couverture, statut temporel, qualité.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchLocalities, normalizeQuery } from '../src/shared/geo/search.ts';
import { slugify } from '../src/shared/geo/slug.ts';
import type { GeoLocality } from '../src/shared/geo/types.ts';
import { coverageAt, externalLinks } from '../src/shared/coverage.ts';
import { temporalStatus } from '../src/shared/temporal.ts';
import { findDuplicates, geoPrecision, qualityFlags, usableCoords } from '../src/shared/quality.ts';
import type { Pharmacy } from '../src/shared/types.ts';

const loc = (id: string, name: string, kind: GeoLocality['kind'], population: number | null = null, nameAr: string | null = null): GeoLocality => ({
  id, name, nameAr, kind, provinceId: 'MA-XXX', regionId: 'MA-04', lat: 34, lon: -6.8, population, osmId: 1,
});
const LOCS = [
  loc('fes-ma-fes', 'Fès', 'city', 1112072, 'فاس'),
  loc('fes-jdid', 'Fès Jdid', 'district'),
  loc('sefrou', 'Sefrou', 'town', 80000),
  loc('ain-chock', 'Aïn Chock', 'district'),
  loc('ksar', 'Ksar El Kébir', 'town', 126000),
];

test('slugify : accents, apostrophes, espaces', () => {
  assert.equal(slugify('Fès'), 'fes');
  assert.equal(slugify("Aïn Chock"), 'ain-chock');
  assert.equal(slugify("Ksar El Kébir"), 'ksar-el-kebir');
  assert.equal(slugify('Salé'), 'sale');
});

test('normalizeQuery ignore accents et ponctuation', () => {
  assert.equal(normalizeQuery("  FÈS-Jdid "), 'fes jdid');
});

test('searchLocalities : ville d’abord, puis quartiers ; insensible aux accents', () => {
  const r = searchLocalities(LOCS, 'fes');
  assert.deepEqual(r.map((x) => x.id), ['fes-ma-fes', 'fes-jdid']);
  assert.deepEqual(searchLocalities(LOCS, 'kebir').map((x) => x.id), ['ksar']);
  assert.deepEqual(searchLocalities(LOCS, 'ain').map((x) => x.id), ['ain-chock']);
  assert.deepEqual(searchLocalities(LOCS, 'f'), []); // trop court
  assert.deepEqual(searchLocalities(LOCS, 'فاس').map((x) => x.id), ['fes-ma-fes']);
});

test('coverageAt : couverte, proche, non couverte', () => {
  assert.equal(coverageAt({ lat: 34.02, lng: -6.84 }).status, 'covered'); // Rabat
  assert.equal(coverageAt({ lat: 34.26, lng: -6.58 }).status, 'near'); // Kénitra (~35 km)
  const c = coverageAt({ lat: 31.63, lng: -8.0 }); // Marrakech
  assert.equal(c.status, 'none');
  assert.ok((c.distanceKm ?? 0) > 200);
});

test('externalLinks : lien vers la page d’origine si elle existe, sinon recherche web', () => {
  const m = externalLinks('Marrakech');
  assert.equal(m[0].url, 'https://garde24.ma/fr/pharmacie-de-garde/marrakech');
  const x = externalLinks('Imilchil');
  assert.equal(x.length, 1);
  assert.match(x[0].url, /google\.com\/search/);
});

// 22/10/2026 à 22h30 au Maroc (UTC+1) = 21h30 UTC
const NIGHT = new Date('2026-10-22T21:30:00Z');
const MORNING = new Date('2026-10-22T07:00:00Z'); // 8h00 au Maroc
const base = { verificationStatus: 'confirmed' as const, dutyType: null, dutyDate: '2026-10-22', hoursText: null, dutyStart: null, dutyEnd: null };

test('temporalStatus : jamais « ouverte », période publiée respectée', () => {
  assert.equal(temporalStatus({ ...base, hoursText: '20h-8h' }, NIGHT).kind, 'in_window');
  assert.equal(temporalStatus({ ...base, hoursText: '9h-23h' }, MORNING).kind, 'upcoming');
  assert.equal(temporalStatus({ ...base, hoursText: '9h-20h' }, NIGHT).kind, 'ended');
  assert.equal(temporalStatus({ ...base, dutyType: 'continuous' }, NIGHT).kind, 'announced_today');
  assert.equal(temporalStatus({ ...base, verificationStatus: 'expired' }, NIGHT).kind, 'ended');
  assert.equal(temporalStatus({ ...base, dutyDate: '2026-10-24' }, NIGHT).kind, 'upcoming');
  for (const t of [NIGHT, MORNING]) assert.doesNotMatch(temporalStatus({ ...base, dutyType: 'night' }, t).label, /ouverte/i);
});

const ph = (o: Partial<Pharmacy>): Pharmacy => ({
  id: 'a', name: 'Pharmacie Atlas', address: null, city: 'rabat', district: null, latitude: 34.02, longitude: -6.84,
  coordinatesSource: 'source', phone: '+212537000000', dutyStart: null, dutyEnd: null, dutyType: null, dutyDate: '2026-10-22',
  hoursText: null, dutyLabel: null, sourceName: 's', sourceUrl: '', sourcePublishedAt: null, lastCheckedAt: '2026-10-22T10:00:00Z',
  sources: [], verificationStatus: 'confirmed', confidenceLevel: 'medium', notes: [], distanceStraightLineKm: null,
  distanceRoadKm: null, estimatedTravelMinutes: null, rank: null, ...o,
});

test('qualité : téléphone, coordonnées, précision, doublons', () => {
  assert.deepEqual(qualityFlags(ph({})), []);
  assert.deepEqual(qualityFlags(ph({ phone: null, latitude: null, longitude: null })), ['phone_missing', 'coords_missing']);
  assert.deepEqual(qualityFlags(ph({ phone: '+21212', latitude: 48.85, longitude: 2.35 })), ['phone_invalid', 'coords_outside']);
  assert.equal(geoPrecision(ph({ coordinatesSource: 'district' })), 'approximate');
  assert.equal(geoPrecision(ph({ latitude: null })), 'unknown');
  assert.equal(usableCoords(ph({ latitude: 48.85, longitude: 2.35 })).latitude, null);
  const d = findDuplicates([ph({ id: 'a' }), ph({ id: 'b', name: 'PHARMACIE ATLAS', latitude: 34.0201, phone: '+212537111111' }), ph({ id: 'c', name: 'Autre', latitude: 33.9, phone: '+212537222222' })]);
  assert.deepEqual([...d].sort(), ['a', 'b']);
});

test('nettoyage : libellé de rubrique à la place de l’adresse, nom incomplet signalé', () => {
  const p = usableCoords(ph({ name: 'Pharmacie', address: 'Coordonnées', district: 'Hay Riad' }));
  assert.equal(p.address, null);
  assert.equal(p.district, 'Hay Riad');
  assert.ok(qualityFlags(p).includes('name_incomplete'));
});
