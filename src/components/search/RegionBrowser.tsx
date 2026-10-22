// Navigation région → province/préfecture → ville ou commune.
import { localName, tr } from '../../i18n/index.tsx';
import { useEffect, useMemo, useState } from 'react';
import { Dialog } from '../Dialog.tsx';
import { loadGeo, type GeoBase } from '../../services/geoData.ts';
import type { GeoLocality, GeoProvince, GeoRegion } from '../../shared/geo/types.ts';
import { coverageAt } from '../../shared/coverage.ts';
import { ChevronIcon, SpinnerIcon } from '../icons.tsx';

export function RegionBrowser(props: { open: boolean; onClose: () => void; onPick: (l: GeoLocality) => void }) {
  const [geo, setGeo] = useState<GeoBase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [region, setRegion] = useState<GeoRegion | null>(null);
  const [province, setProvince] = useState<GeoProvince | null>(null);

  useEffect(() => {
    if (!props.open || geo) return;
    loadGeo().then(setGeo).catch(() => setError(tr('La liste des villes n’a pas pu être chargée. Vérifiez votre connexion.')));
  }, [props.open, geo]);
  useEffect(() => { if (!props.open) { setRegion(null); setProvince(null); } }, [props.open]);

  const places = useMemo(() => {
    if (!geo || !province) return [];
    return geo.localities
      .filter((l) => l.provinceId === province.id && l.kind !== 'district')
      .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'village' ? 1 : b.kind === 'village' ? -1 : 0) || (b.population ?? 0) - (a.population ?? 0) || a.name.localeCompare(b.name, 'fr'));
  }, [geo, province]);

  const title = province ? localName(province) : region ? localName(region) : tr('Toutes les régions');
  const item = (key: string, label: string, sub: string | null, onClick: () => void, badge?: boolean) => (
    <li key={key}>
      <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start hover:bg-brand-50">
        <span className="min-w-0 flex-1">
          <span className="block font-bold">{label}</span>
          {sub && <span className="block text-xs text-muted">{sub}</span>}
        </span>
        {badge && <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-bold text-brand-800">{tr('Gardes disponibles')}</span>}
        <ChevronIcon size={18} className="text-muted rtl:rotate-180" />
      </button>
    </li>
  );

  return (
    <Dialog open={props.open} onClose={props.onClose} title={title}>
      {(region || province) && (
        <button type="button" onClick={() => (province ? setProvince(null) : setRegion(null))} className="mb-2 text-sm font-bold text-brand-700 underline">
          <span className="inline-block rtl:rotate-180">←</span> {province && region ? localName(region) : tr('Toutes les régions')}
        </button>
      )}
      {error && <p role="alert" className="text-sm font-semibold text-danger-600">{error}</p>}
      {!geo && !error && <p className="flex items-center gap-2 text-sm text-muted"><SpinnerIcon size={16} /> {tr('Chargement…')}</p>}
      {geo && geo.regions.length === 0 && <p className="text-sm text-muted">{tr('La base géographique n’est pas encore publiée.')}</p>}
      {geo && !region && (
        <ul className="divide-y divide-line">
          {geo.regions.map((r) => item(r.id, localName(r), tr('{n} provinces et préfectures', { n: r.provinces.length }), () => setRegion(r)))}
        </ul>
      )}
      {geo && region && !province && (
        <ul className="divide-y divide-line">
          {region.provinces.map((p) => item(p.id, localName(p), null, () => setProvince(p), p.lat !== null && p.lon !== null && coverageAt({ lat: p.lat, lng: p.lon }).status === 'covered'))}
          {region.provinces.length === 0 && <li className="py-3 text-sm text-muted">{tr('Provinces non disponibles pour cette région dans la base actuelle.')}</li>}
        </ul>
      )}
      {geo && province && (
        <ul className="divide-y divide-line">
          {places.map((l) => item(l.id, localName(l), tr(l.kind === 'village' ? 'Commune / village' : 'Ville'), () => { props.onPick(l); props.onClose(); }, coverageAt({ lat: l.lat, lng: l.lon }).status === 'covered'))}
          {places.length === 0 && <li className="py-3 text-sm text-muted">{tr('Aucune localité recensée.')}</li>}
        </ul>
      )}
    </Dialog>
  );
}
