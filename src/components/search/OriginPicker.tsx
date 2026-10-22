// Bloc « Position de départ » partagé par les espaces Pharmacies et Cliniques & hôpitaux :
// GPS, adresse (Nominatim, à la validation), point choisi sur la carte.
import { tr } from '../../i18n/index.tsx';
import { useState, type FormEvent } from 'react';
import type { Place } from '../../services/geocoding.ts';
import type { Origin } from '../SearchPanel.tsx';
import { GpsIcon, MapIcon, PinIcon, SpinnerIcon } from '../icons.tsx';

export function OriginPicker(props: {
  idPrefix?: string;
  origin: Origin | null;
  locating: boolean;
  onLocate: () => void;
  onAddressSearch: (q: string) => Promise<Place[]>;
  onChoosePlace: (p: Place) => void;
  picking: boolean;
  onTogglePick: () => void;
  originError: string | null;
}) {
  const [query, setQuery] = useState('');
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoErr, setGeoErr] = useState<string | null>(null);
  const inputId = `${props.idPrefix ?? ''}addr`;

  async function submitAddress(e: FormEvent) {
    e.preventDefault();
    setGeoErr(null);
    setPlaces(null);
    setGeoBusy(true);
    try {
      const res = await props.onAddressSearch(query);
      if (res.length === 0) setGeoErr(tr('Adresse introuvable. Essayez un quartier, une avenue ou touchez la carte.'));
      else if (res.length === 1) props.onChoosePlace(res[0]);
      else setPlaces(res);
    } catch (err) {
      setGeoErr(tr((err as Error).message));
    } finally {
      setGeoBusy(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <span className="text-xs font-bold text-muted">{tr('Position de départ')}</span>
      {props.origin && (
        <p className="flex items-start gap-2 rounded-xl bg-brand-50 px-3 py-2 text-sm font-semibold text-brand-700" aria-live="polite">
          <PinIcon size={18} className="mt-0.5 shrink-0" />
          <span className="min-w-0">
            {props.origin.kind === 'gps' ? tr('Ma position GPS') : props.origin.kind === 'map' ? tr('Point choisi sur la carte') : props.origin.label}
            {props.origin.kind === 'gps' && props.origin.accuracyM ? <span className="font-medium"> (± {Math.round(props.origin.accuracyM)} m)</span> : null}
          </span>
        </p>
      )}
      <form onSubmit={submitAddress} className="flex items-center gap-2 rounded-xl border-[1.5px] border-line px-3 py-2 focus-within:border-brand-600">
        <PinIcon size={20} className="shrink-0 text-brand-600" />
        <label htmlFor={inputId} className="sr-only">{tr('Adresse, quartier ou ville')}</label>
        <input
          id={inputId}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tr('Adresse, quartier ou ville')}
          className="min-w-0 flex-1 bg-transparent py-1 text-sm font-semibold outline-none placeholder:font-medium placeholder:text-muted"
          autoComplete="street-address"
          enterKeyHint="search"
        />
        <button type="submit" disabled={geoBusy || query.trim().length < 3} className="rounded-lg bg-brand-50 px-3 py-1.5 text-sm font-bold text-brand-700 disabled:opacity-50">
          {geoBusy ? <SpinnerIcon size={16} /> : tr('Chercher')}
        </button>
      </form>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={props.onLocate} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-2 text-sm font-bold text-brand-700">
          {props.locating ? <SpinnerIcon size={16} /> : <GpsIcon size={16} />} {tr('Ma position')}
        </button>
        <button
          type="button"
          onClick={props.onTogglePick}
          aria-pressed={props.picking}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-bold ${props.picking ? 'bg-brand-700 text-white' : 'bg-brand-50 text-brand-700'}`}
        >
          <MapIcon size={16} /> {tr(props.picking ? 'Touchez la carte…' : 'Choisir sur la carte')}
        </button>
      </div>
      {places && (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line" aria-label={tr('Adresses trouvées')}>
          {places.map((p) => (
            <li key={`${p.lat},${p.lng}`}>
              <button type="button" onClick={() => { props.onChoosePlace(p); setPlaces(null); }} className="w-full px-3 py-2 text-start text-sm hover:bg-bg">
                {p.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {(geoErr || props.originError) && <p role="alert" className="text-sm font-semibold text-danger-600">{geoErr || (props.originError && tr(props.originError))}</p>}
    </div>
  );
}
