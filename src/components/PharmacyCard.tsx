// Carte de résultat : l'essentiel (statut, distance, appel, itinéraire) visible sans ouvrir la fiche.
import { tr } from '../i18n/index.tsx';
import { forwardRef } from 'react';
import type { Pharmacy } from '../shared/types.ts';
import { formatKm, formatMinutes } from '../shared/distance.ts';
import { formatPhone } from '../shared/text.ts';
import { CITY_NAME } from '../shared/connectors/registry.ts';
import { rankColor } from '../utils/colors.ts';
import type { TravelMode } from '../services/routing.ts';
import type { LatLng } from '../shared/distance.ts';
import { temporalStatus, type TemporalKind } from '../shared/temporal.ts';
import { DUTY_TYPE_LABEL } from '../shared/duty.ts';
import { STATUS_LABEL } from '../shared/status.ts';
import { PhoneIcon, RouteIcon, ShareIcon, SpinnerIcon, StarIcon, InfoIcon } from './icons.tsx';

export interface RouteState {
  loading?: boolean;
  error?: string;
}

export const TEMPORAL_STYLE: Record<TemporalKind, string> = {
  in_window: 'bg-brand-100 text-brand-800',
  announced_today: 'bg-brand-50 text-brand-800',
  upcoming: 'bg-night-50 text-night-700',
  ended: 'bg-bg text-muted',
};

const TYPE_STYLE = { day: 'bg-warn-50 text-warn-600', night: 'bg-night-50 text-night-700', continuous: 'bg-h24-50 text-h24-700' } as const;

export const PharmacyCard = forwardRef<HTMLElement, {
  p: Pharmacy;
  now: Date;
  selected: boolean;
  origin: LatLng | null;
  mode: TravelMode;
  route: RouteState | undefined;
  favorite: boolean;
  onSelect: () => void;
  onRoute: () => void;
  onDetails: () => void;
  onShare: () => void;
  onToggleFavorite: () => void;
}>(function PharmacyCard({ p, now, selected, origin, mode, route, favorite, onSelect, onRoute, onDetails, onShare, onToggleFavorite }, ref) {
  const c = rankColor(p.rank);
  const located = p.latitude !== null && p.longitude !== null;
  const approx = p.coordinatesSource === 'district';
  const t = temporalStatus(p, now);
  const ended = t.kind === 'ended';
  return (
    <article
      ref={ref}
      onClick={onSelect}
      aria-current={selected ? 'true' : undefined}
      aria-label={p.name}
      className={`rounded-2xl bg-white p-4 transition ${selected ? 'ring-2 ring-brand-500 shadow-[0_6px_24px_rgba(5,59,39,.12)]' : 'ring-1 ring-line'} ${ended ? 'opacity-70' : ''}`}
    >
      <div className="flex items-start gap-3">
        {p.rank ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[15px] font-extrabold tabular" style={{ background: c.bg, color: c.fg }} aria-label={tr('Rang {n}', { n: p.rank })}>{p.rank}</span>
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg text-xs font-bold text-muted" aria-label={tr('Non classée')}>—</span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-[16px] font-extrabold leading-snug">{p.name}</h3>
          <p className="text-[13px] text-muted">{[p.district, CITY_NAME[p.city] ?? p.city].filter(Boolean).join(' · ')}</p>
        </div>
        <button type="button" onClick={(e) => { e.stopPropagation(); onToggleFavorite(); }} aria-pressed={favorite} aria-label={tr(favorite ? 'Retirer des favoris' : 'Ajouter aux favoris')} className={`-me-1 -mt-1 rounded-full p-2 ${favorite ? 'text-brand-600' : 'text-muted hover:text-ink'}`}>
          <StarIcon size={20} filled={favorite} />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${TEMPORAL_STYLE[t.kind]}`}>{tr(t.label, t.vars)}</span>
        {p.dutyType && <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${TYPE_STYLE[p.dutyType]}`}>{tr(DUTY_TYPE_LABEL[p.dutyType])}</span>}
        {p.hoursText && !(p.dutyType === 'continuous' && /24\s*h?\s*\/\s*24/i.test(p.hoursText)) && <span className="rounded-full bg-bg px-2.5 py-1 text-xs font-semibold text-ink">{p.hoursText}</span>}
        {p.verificationStatus !== 'confirmed' && p.verificationStatus !== 'expired' && (
          <span className="rounded-full bg-warn-50 px-2.5 py-1 text-xs font-bold text-warn-600">{tr(STATUS_LABEL[p.verificationStatus])}</span>
        )}
      </div>

      <p className="mt-3 text-[14px] leading-snug">{p.address ?? <span className="italic text-muted">{tr('Adresse non communiquée par la source')}</span>}</p>

      <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-muted tabular">
        {p.distanceStraightLineKm !== null && <span><b className="text-ink">{approx ? '≈ ' : ''}{formatKm(p.distanceStraightLineKm)}</b> {tr('à vol d’oiseau')}</span>}
        {route?.loading && <span className="inline-flex items-center gap-1"><SpinnerIcon size={13} /> {tr('trajet…')}</span>}
        {p.estimatedTravelMinutes !== null && <span><b className="text-ink">{formatMinutes(p.estimatedTravelMinutes)}</b> {tr(mode === 'car' ? 'en voiture' : 'à pied')} ({formatKm(p.distanceRoadKm)})</span>}
        {!located && <span className="font-semibold text-warn-600">{tr('Position non publiée')}</span>}
        {approx && <span className="font-semibold text-warn-600">{tr('Position approximative')}</span>}
      </p>
      {route?.error && <p role="alert" className="mt-1 text-xs font-semibold text-danger-600">{route.error}</p>}

      <div className="mt-3 grid grid-cols-[1.3fr_1.2fr_auto_auto] gap-2" onClick={(e) => e.stopPropagation()}>
        {p.phone ? (
          <a href={`tel:${p.phone}`} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-700 px-2 py-2.5 text-sm font-bold text-white hover:bg-brand-600" aria-label={tr('Appeler {nom} au {tel}', { nom: p.name, tel: formatPhone(p.phone) })}>
            <PhoneIcon size={16} /> {tr('Appeler')}
          </a>
        ) : (
          <span className="flex items-center justify-center rounded-xl border border-dashed border-line px-1 text-center text-[11px] font-semibold text-muted">{tr('Tél. non publié')}</span>
        )}
        <button type="button" disabled={!located || !origin} onClick={onRoute} className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-50 px-2 py-2.5 text-sm font-bold text-brand-800 hover:bg-brand-100 disabled:opacity-40">
          <RouteIcon size={16} /> {tr('Itinéraire')}
        </button>
        <button type="button" onClick={onShare} className="rounded-xl bg-bg p-2.5 text-ink hover:bg-brand-50" aria-label={tr('Partager {nom}', { nom: p.name })}><ShareIcon size={18} /></button>
        <button type="button" onClick={onDetails} className="rounded-xl bg-bg p-2.5 text-ink hover:bg-brand-50" aria-label={tr('Fiche détaillée de {nom}', { nom: p.name })}><InfoIcon size={18} /></button>
      </div>
    </article>
  );
});
