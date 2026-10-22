// Champ de recherche de ville, commune ou quartier, avec suggestions instantanées (combobox accessible).
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { loadGeo, type GeoBase } from '../../services/geoData.ts';
import { searchLocalities, KIND_LABEL } from '../../shared/geo/search.ts';
import type { GeoLocality } from '../../shared/geo/types.ts';
import { coverageAt } from '../../shared/coverage.ts';
import { CITIES } from '../../shared/connectors/registry.ts';
import { GpsIcon, SearchIcon, SpinnerIcon } from '../icons.tsx';

/** Repli si la base nationale n'est pas encore disponible : les villes couvertes. */
const FALLBACK: GeoLocality[] = CITIES.map((c) => ({
  id: c.id, name: c.name, nameAr: null, kind: 'city', provinceId: '', regionId: 'MA-04',
  lat: c.center.lat, lon: c.center.lng, population: null, osmId: 0,
}));

export function LocalitySearch(props: {
  onPick: (l: GeoLocality) => void;
  onLocate: () => void;
  locating: boolean;
  size?: 'lg' | 'md';
  autoFocus?: boolean;
  inputId?: string;
}) {
  const [q, setQ] = useState('');
  const [geo, setGeo] = useState<GeoBase | null>(null);
  const [geoError, setGeoError] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const input = useRef<HTMLInputElement>(null);

  const ensureGeo = () => {
    if (geo || geoError) return;
    loadGeo().then(setGeo).catch(() => setGeoError(true));
  };
  useEffect(() => { if (props.autoFocus) input.current?.focus(); }, [props.autoFocus]);

  const provinceName = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of geo?.regions ?? []) for (const p of r.provinces) m.set(p.id, p.name.replace(/^(Préfecture|Province)\s+(de\s+|d’|d')?/i, ''));
    return m;
  }, [geo]);

  const results = useMemo(() => {
    const list = geo && geo.localities.length > 0 ? geo.localities : FALLBACK;
    return searchLocalities(list, q, 8);
  }, [geo, q]);

  const choose = (l: GeoLocality) => { setQ(l.name); setOpen(false); props.onPick(l); };
  const big = props.size !== 'md';

  return (
    <div className="relative">
      <div className={`flex items-center gap-2 rounded-2xl bg-white shadow-[0_8px_30px_rgba(5,59,39,.18)] ring-1 ring-line focus-within:ring-2 focus-within:ring-brand-500 ${big ? 'p-2' : 'p-1.5'}`}>
        <SearchIcon size={22} className="ml-2 shrink-0 text-brand-600" />
        <input
          ref={input}
          id={props.inputId}
          role="combobox"
          aria-expanded={open && results.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && results[active] ? `${listId}-${active}` : undefined}
          aria-label="Ville, commune ou quartier"
          placeholder="Ville, commune ou quartier…"
          value={q}
          onFocus={() => { ensureGeo(); setOpen(true); }}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); ensureGeo(); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
            else if (e.key === 'Enter' && results[active]) { e.preventDefault(); choose(results[active]); }
            else if (e.key === 'Escape') setOpen(false);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className={`min-w-0 flex-1 bg-transparent font-semibold text-ink outline-none placeholder:font-medium placeholder:text-muted ${big ? 'py-2.5 text-[17px]' : 'py-2 text-[15px]'}`}
        />
        <button type="button" onClick={props.onLocate} className={`inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand-700 font-bold text-white hover:bg-brand-600 ${big ? 'px-4 py-3 text-[15px]' : 'px-3 py-2 text-sm'}`}>
          {props.locating ? <SpinnerIcon size={18} /> : <GpsIcon size={18} />}
          <span className="hidden sm:inline">Autour de moi</span>
          <span className="sm:hidden">Position</span>
        </button>
      </div>
      {open && q.trim().length >= 2 && (
        <ul id={listId} role="listbox" aria-label="Suggestions" className="absolute inset-x-0 top-full z-[1200] mt-2 max-h-[60vh] overflow-auto rounded-2xl bg-white p-1.5 shadow-[0_18px_50px_rgba(5,59,39,.22)] ring-1 ring-line">
          {!geo && !geoError && <li className="flex items-center gap-2 px-3 py-3 text-sm text-muted"><SpinnerIcon size={16} /> Chargement des villes du Maroc…</li>}
          {results.length === 0 && (geo || geoError) && <li className="px-3 py-3 text-sm text-muted">Aucun lieu trouvé pour « {q} ». Essayez l’orthographe française (ex. « Fès », « Kénitra »).</li>}
          {results.map((l, i) => {
            const cov = coverageAt({ lat: l.lat, lng: l.lon });
            return (
              <li
                key={l.id}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => { e.preventDefault(); choose(l); }}
                onMouseEnter={() => setActive(i)}
                className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 ${i === active ? 'bg-brand-50' : ''}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold text-ink">{l.name}{l.nameAr ? <span className="ml-2 font-medium text-muted" lang="ar" dir="rtl">{l.nameAr}</span> : null}</span>
                  <span className="block truncate text-xs text-muted">{KIND_LABEL[l.kind]}{provinceName.get(l.provinceId) ? ` · ${provinceName.get(l.provinceId)}` : ''}</span>
                </span>
                {cov.status === 'covered'
                  ? <span className="shrink-0 rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-bold text-brand-800">Gardes disponibles</span>
                  : <span className="shrink-0 rounded-full bg-bg px-2 py-0.5 text-[11px] font-bold text-muted">Pas encore couverte</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
