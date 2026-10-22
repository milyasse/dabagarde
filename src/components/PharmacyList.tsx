// Liste des résultats : tri, filtre texte, avertissements de données, cartes synchronisées avec la carte.
import { tr } from '../i18n/index.tsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Pharmacy } from '../shared/types.ts';
import type { LatLng } from '../shared/distance.ts';
import type { TravelMode } from '../services/routing.ts';
import { formatFrDate } from '../shared/dates.ts';
import { normalizeQuery } from '../shared/geo/search.ts';
import { temporalStatus } from '../shared/temporal.ts';
import { PharmacyCard, type RouteState } from './PharmacyCard.tsx';
import { RefreshIcon, SearchIcon, SpinnerIcon, WarnIcon } from './icons.tsx';

export type SortBy = 'distance' | 'status' | 'duration';
const SORT_LABEL: Record<SortBy, string> = { distance: 'Distance', status: 'Statut', duration: 'Durée' };
const T_ORDER = { in_window: 0, announced_today: 1, upcoming: 2, ended: 3 } as const;

export function PharmacyList(props: {
  now: Date;
  date: string;
  radiusKm: number;
  placeLabel: string;
  list: Pharmacy[];
  expired: Pharmacy[];
  unlocated: Pharmacy[];
  outside: number;
  filteredOutByType: number;
  dataNotice: string | null;
  sortBy: SortBy;
  onSort: (s: SortBy) => void;
  selectedId: string | null;
  origin: LatLng | null;
  mode: TravelMode;
  routeStates: Record<string, RouteState>;
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (p: Pharmacy) => void;
  onSelect: (id: string) => void;
  onRoute: (id: string) => void;
  onDetails: (p: Pharmacy) => void;
  onShare: (p: Pharmacy) => void;
  onComputeAll: () => void;
  computingAll: boolean;
  showAllRoutes: boolean;
  onShowAllRoutes: (v: boolean) => void;
  onRefresh: () => void;
  onEnlarge: () => void;
  onChangePlace: () => void;
  alternative: { id: string; name: string; count: number; km: number } | null;
  onGoAlternative: (cityId: string) => void;
}) {
  const refs = useRef(new Map<string, HTMLElement>());
  const [showExpired, setShowExpired] = useState(false);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (!props.selectedId) return;
    refs.current.get(props.selectedId)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [props.selectedId]);

  const match = useMemo(() => {
    const q = normalizeQuery(filter);
    if (!q) return () => true;
    return (p: Pharmacy) => normalizeQuery([p.name, p.address ?? '', p.district ?? ''].join(' ')).includes(q);
  }, [filter]);

  const shown = useMemo(() => {
    const l = props.list.filter(match);
    if (props.sortBy === 'status') return [...l].sort((a, b) => T_ORDER[temporalStatus(a, props.now).kind] - T_ORDER[temporalStatus(b, props.now).kind] || (a.rank ?? 99) - (b.rank ?? 99));
    return l;
  }, [props.list, props.sortBy, props.now, match]);
  const unlocated = props.unlocated.filter(match);
  const expired = props.expired.filter(match);

  const card = (p: Pharmacy) => (
    <PharmacyCard
      key={p.id}
      ref={(el) => { if (el) refs.current.set(p.id, el); else refs.current.delete(p.id); }}
      p={p}
      now={props.now}
      selected={p.id === props.selectedId}
      origin={props.origin}
      mode={props.mode}
      route={props.routeStates[p.id]}
      favorite={props.isFavorite(p.id)}
      onSelect={() => props.onSelect(p.id)}
      onRoute={() => props.onRoute(p.id)}
      onDetails={() => props.onDetails(p)}
      onShare={() => props.onShare(p)}
      onToggleFavorite={() => props.onToggleFavorite(p)}
    />
  );

  const n = props.list.length;
  return (
    <section aria-label={tr('Résultats')} className="space-y-3 p-4 lg:px-5">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-extrabold" aria-live="polite">
            {n === 0 ? tr('Aucune pharmacie de garde') : tr(n > 1 ? '{n} pharmacies de garde' : '{n} pharmacie de garde', { n })}
          </h2>
          <p className="text-[13px] text-muted">
            {props.placeLabel} · {formatFrDate(props.date)} · {props.radiusKm} {tr('km')} ·{' '}
            <button type="button" onClick={props.onChangePlace} className="font-bold text-brand-700 underline">{tr('Changer de ville')}</button>
          </p>
        </div>
        <button type="button" onClick={props.onRefresh} className="rounded-full bg-white p-2.5 text-brand-700 ring-1 ring-line" aria-label={tr('Actualiser les résultats')} title={tr('Actualiser')}>
          <RefreshIcon size={18} />
        </button>
      </div>

      {props.dataNotice && (
        <div role="status" className="flex gap-2 rounded-xl bg-warn-50 p-3 text-sm font-semibold text-warn-600">
          <WarnIcon size={18} className="mt-0.5 shrink-0" />
          <p>{tr(props.dataNotice)}</p>
        </div>
      )}

      {n > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-grid grid-cols-3 gap-1 rounded-full bg-white p-1 text-sm ring-1 ring-line" role="group" aria-label={tr('Trier par')}>
              {(['distance', 'status', 'duration'] as SortBy[]).map((s) => (
                <button key={s} type="button" aria-pressed={props.sortBy === s} onClick={() => props.onSort(s)}
                  className={`rounded-full px-3 py-1.5 ${props.sortBy === s ? 'bg-brand-700 font-bold text-white' : 'font-semibold text-muted'}`}>
                  {tr(SORT_LABEL[s])}
                </button>
              ))}
            </div>
            <button type="button" onClick={props.onComputeAll} disabled={props.computingAll || !props.origin}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-2 text-sm font-bold text-brand-800 disabled:opacity-50">
              {props.computingAll && <SpinnerIcon size={15} />} {tr('Calculer les trajets')}
            </button>
            <label className="inline-flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={props.showAllRoutes} onChange={(e) => props.onShowAllRoutes(e.target.checked)} className="h-4 w-4 accent-[#0a6b47]" />
              {tr('Tous les itinéraires')}
            </label>
          </div>
          <label className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-line focus-within:ring-2 focus-within:ring-brand-500">
            <SearchIcon size={16} className="text-muted" />
            <span className="sr-only">{tr('Filtrer par nom, adresse ou quartier')}</span>
            <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={tr('Filtrer par nom, adresse ou quartier')} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </label>
          {props.sortBy === 'duration' && props.list.some((p) => p.estimatedTravelMinutes === null) && (
            <p className="text-xs text-muted">{tr('Les pharmacies dont la durée n’est pas encore calculée sont placées à la fin. Les numéros restent ceux du classement par proximité.')}</p>
          )}
        </div>
      )}

      {n === 0 && (
        <div className="rounded-2xl bg-white p-4 text-sm ring-1 ring-line">
          <p className="font-semibold">{tr('Aucune pharmacie de garde trouvée dans un rayon de {n} km pour cette date.', { n: props.radiusKm })}</p>
          {props.outside > 0 && <p className="mt-1 text-muted">{tr('{n} pharmacie(s) de garde se trouvent au-delà de ce rayon.', { n: props.outside })}</p>}
          {props.filteredOutByType > 0 && <p className="mt-1 text-muted">{tr('{n} pharmacie(s) masquée(s) par le filtre « type de garde ».', { n: props.filteredOutByType })}</p>}
          {props.alternative && (
            <p className="mt-2">{tr('Ville la plus proche avec des gardes publiées :')} <b>{props.alternative.name}</b>, {tr('à environ {km} km', { km: props.alternative.km })} ({tr(props.alternative.count > 1 ? '{n} gardes' : '{n} garde', { n: props.alternative.count })}).</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {props.alternative && (
              <button type="button" onClick={() => props.onGoAlternative(props.alternative!.id)} className="rounded-xl bg-brand-700 px-4 py-2.5 font-bold text-white">{tr('Voir {nom}', { nom: props.alternative.name })}</button>
            )}
            <button type="button" onClick={props.onEnlarge} className={`rounded-xl px-4 py-2.5 font-bold ${props.alternative ? 'bg-brand-50 text-brand-800' : 'bg-brand-700 text-white'}`}>{tr('Élargir le rayon')}</button>
          </div>
          <p className="mt-3 text-xs text-muted">{tr('Urgence vitale : 141 (SAMU) ou 15 (Protection civile).')}</p>
        </div>
      )}
      {n > 0 && shown.length === 0 && <p className="rounded-xl bg-white p-3 text-sm text-muted ring-1 ring-line">{tr('Aucun résultat ne correspond à « {q} ».', { q: filter })}</p>}

      <div className="space-y-3">{shown.map(card)}</div>

      {unlocated.length > 0 && (
        <details className="rounded-2xl bg-white p-3 ring-1 ring-line" open={n === 0}>
          <summary className="cursor-pointer text-sm font-bold">
            {tr('{n} pharmacie(s) de garde sans position publiée (non classées, distance inconnue)', { n: unlocated.length })}
          </summary>
          <div className="mt-3 space-y-3">{unlocated.map(card)}</div>
        </details>
      )}

      {expired.length > 0 && (
        <div>
          <button type="button" onClick={() => setShowExpired((v) => !v)} className="text-sm font-bold text-muted underline">
            {tr(showExpired ? 'Masquer les gardes terminées dans le rayon ({n})' : 'Afficher les gardes terminées dans le rayon ({n})', { n: expired.length })}
          </button>
          {showExpired && <div className="mt-3 space-y-3">{expired.map(card)}</div>}
        </div>
      )}

      <p className="flex gap-2 rounded-xl bg-white p-3 text-xs text-muted ring-1 ring-line">
        <WarnIcon size={16} className="shrink-0 text-warn-600" />
        <span>{tr('Informations récupérées automatiquement sur des listes publiques, non vérifiées sur le terrain. Appelez la pharmacie avant de vous déplacer.')} {tr('Urgence vitale : 141 (SAMU) ou 15 (Protection civile).')}</span>
      </p>
    </section>
  );
}
