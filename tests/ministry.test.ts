import { test } from 'node:test';
import assert from 'node:assert/strict';
import { autoMatch, communeKey, locateArea, nameTokens, provinceKey } from '../src/shared/health/ministry.ts';
import type { Establishment } from '../src/shared/health/types.ts';

const osm = (name: string, lat: number, lng: number, type: Establishment['type'] = 'hospital'): Establishment => ({
  id: name, name, nameAr: null, type, typeSource: 'osm', officialCategory: null, address: null, city: null, district: null,
  latitude: lat, longitude: lng, phone: null, website: null, services: [], emergency: null, emergencySource: null, hours: null,
  duty: [], sources: [], osmIds: [`way/${name.length}`], notes: [],
});

test('ministère : clés de commune et de délégation', () => {
  assert.equal(communeKey('Agdal Riyad (Arrond.)'), 'agdal riyad');
  assert.equal(communeKey('Ksar El Kebir (Mun.)'), 'ksar el kebir');
  assert.equal(provinceKey("Préfecture d'arrondissements de Casablanca-Anfa"), 'casablanca anfa');
  assert.equal(provinceKey('Province d’Al Hoceïma'), 'al hoceima');
});

test('ministère : mots significatifs du nom (My → Moulay, VI → 6, Med → Mohamed)', () => {
  assert.deepEqual(nameTokens('My Youssef').hard, ['moulay', 'youssef']);
  assert.deepEqual(nameTokens('Hopital Mohamed 6').hard, ['mohamed', '6']);
  assert.deepEqual(nameTokens('Mohammed VI').hard, ['mohamed', '6']);
  assert.deepEqual(nameTokens('Sidi Med Ben Abdellah').hard, ['sidi', 'mohamed', 'ben', 'abdellah']);
});

test('ministère : la commune est située par la base géographique, sinon par la délégation', () => {
  const places = [{ name: 'Tiflet', lat: 33.89, lon: -6.31, kind: 'town' }];
  const provinces = [{ name: 'Province de Khémisset', lat: 33.82, lon: -6.07 }];
  assert.deepEqual(locateArea({ commune: 'Tiflet (Mun.)', delegation: 'Khémisset' }, places, provinces), { lat: 33.89, lng: -6.31, precision: 'commune' });
  assert.deepEqual(locateArea({ commune: 'Inconnue', delegation: 'Khémisset' }, places, provinces), { lat: 33.82, lng: -6.07, precision: 'delegation' });
  assert.equal(locateArea({ commune: 'Inconnue', delegation: 'Nulle part' }, places, provinces), null);
});

test('ministère : rattachement prudent à OpenStreetMap', () => {
  const area = { lat: 35.25, lng: -3.93, precision: 'commune' as const };
  // nom identique, à proximité : rattaché
  assert.equal(autoMatch('Mohamed V', area, [osm('Hôpital Mohamed V', 35.24, -3.93), osm('Hôpital Mohammed VI', 35.25, -3.92)])?.name, 'Hôpital Mohamed V');
  // trop loin : non rattaché
  assert.equal(autoMatch('Mohamed V', area, [osm('Hôpital Mohamed V', 34.0, -6.8)]), null);
  // deux candidats aussi bons : ambigu, non rattaché
  assert.equal(autoMatch('Mohamed V', area, [osm('Hôpital Mohamed V', 35.24, -3.93), osm('Mohamed V annexe', 35.26, -3.93)]), null);
  // clinique privée, Croissant-Rouge, centre de santé : jamais
  assert.equal(autoMatch('Assilah', area, [osm('Hôpital Le Croissant Rouge d’Asilah', 35.25, -3.93)]), null);
  assert.equal(autoMatch('Imzouren', area, [osm('Health Center Imzouren', 35.25, -3.93)]), null);
  assert.equal(autoMatch('Hassan II', area, [osm('Clinique Hassan II', 35.25, -3.93, 'private_clinic')]), null);
  // un centre d'oncologie n'est pas le CHU de la ville
  assert.equal(autoMatch('Laayoune', area, [osm('CHU Laâyoune', 35.25, -3.93)], 'CRO'), null);
  // orthographe à une lettre près pour un mot long
  assert.equal(autoMatch('Berrchid', area, [osm('Hôpital de Berrechid', 35.25, -3.93)])?.name, 'Hôpital de Berrechid');
});
