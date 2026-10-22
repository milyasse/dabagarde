// Fiche d'un établissement de santé — même structure visuelle que la fiche pharmacie.
import { tr } from '../../i18n/index.tsx';
import { forwardRef } from 'react';
import type { EstablishmentResult } from '../../shared/health/types.ts';
import { INFO_SOURCE_LABEL, SERVICE_LABEL, TYPE_LABEL } from '../../shared/health/labels.ts';
import { formatKm, formatMinutes, type LatLng } from '../../shared/distance.ts';
import { formatShortDate, moroccoDate } from '../../shared/dates.ts';
import { formatPhone } from '../../shared/text.ts';
import { CITY_NAME } from '../../shared/connectors/registry.ts';
import { rankColor } from '../../utils/colors.ts';
import { googleMapsDirectionsUrl, type TravelMode } from '../../services/routing.ts';
import type { RouteState } from '../PharmacyCard.tsx';
import { ExternalIcon, PhoneIcon, RouteIcon, SpinnerIcon } from '../icons.tsx';

/** Niveaux d'information, du plus fort au plus faible (cahier des charges §5). */
export function LevelBadges({ e, compact = false }: { e: EstablishmentResult; compact?: boolean }) {
  const badges: { label: string; cls: string; dot: string }[] = [];
  if (e.levels.officialOnDuty) badges.push({ label: tr('De garde (désignation officielle)'), cls: 'bg-brand-700 text-white', dot: 'bg-white' });
  if (e.levels.hoursVerified) badges.push({ label: tr('Horaires vérifiés'), cls: 'bg-brand-50 text-brand-700', dot: 'bg-brand-600' });
  if (e.levels.emergencyDeclared) badges.push({ label: tr('Urgences déclarées'), cls: 'bg-danger-50 text-danger-600', dot: 'bg-danger-600' });
  badges.push({ label: 'Répertorié', cls: 'bg-[#F1F2F4] text-neutral-500', dot: 'bg-neutral-500' });
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {(compact ? badges.slice(0, 2) : badges).map((b) => (
        <span key={b.label} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${b.cls}`}>
          <span className={`h-2 w-2 rounded-full ${b.dot}`} aria-hidden="true" />
          {b.label}
        </span>
      ))}
    </span>
  );
}

/** Libellé court pour la bulle de la carte. */
export function levelLabel(e: EstablishmentResult): string {
  if (e.levels.officialOnDuty) return tr('De garde (désignation officielle)');
  if (e.levels.emergencyDeclared) return `${tr(TYPE_LABEL[e.type])} · ${tr('urgences déclarées')}`;
  return TYPE_LABEL[e.type];
}

export const EstablishmentCard = forwardRef<HTMLElement, {
  e: EstablishmentResult;
  selected: boolean;
  origin: LatLng | null;
  mode: TravelMode;
  route: RouteState | undefined;
  onSelect: () => void;
  onShowOnMap: () => void;
  onRoute: () => void;
}>(function EstablishmentCard({ e, selected, origin, mode, route, onSelect, onShowOnMap, onRoute }, ref) {
  const c = rankColor(e.rank);
  const located = e.latitude !== null && e.longitude !== null;
  const place = [e.district, e.city ? CITY_NAME[e.city] : null].filter(Boolean).join(' · ');
  const today = moroccoDate();
  const nextDuty = e.duty.filter((d) => d.to >= today).sort((a, b) => a.from.localeCompare(b.from))[0];
  return (
    <article
      ref={ref}
      onClick={onSelect}
      aria-current={selected ? 'true' : undefined}
      className={`rounded-2xl border bg-white p-4 shadow-[0_2px_8px_rgba(13,26,20,0.06)] transition ${selected ? 'border-2' : 'border-line'}`}
      style={selected ? { borderColor: e.rank ? c.bg : '#1d6fd8' } : undefined}
    >
      <div className="flex items-start gap-3">
        {e.rank ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[3px] border-white text-[15px] font-extrabold shadow" style={{ background: c.bg, color: c.fg }} aria-label={tr('Rang {n}', { n: e.rank })}>
            {e.rank}
          </span>
        ) : (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg text-xs font-bold text-muted" aria-label={tr('Non classé')}>—</span>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-extrabold leading-snug">{e.name}</h3>
          {e.nameAr && <p dir="rtl" lang="ar" className="text-[13px] font-semibold text-muted">{e.nameAr}</p>}
          <p className="text-[13px] font-semibold text-brand-700">
            {tr(TYPE_LABEL[e.type])}
            {e.officialCategory && <span className="font-medium text-muted"> · {tr(e.officialCategory)}</span>}
            {e.typeSource === 'nom' && <span className="font-medium text-muted"> ({tr('d’après le nom')})</span>}
          </p>
          {place && <p className="text-[13px] font-medium text-muted">{place}</p>}
          <div className="mt-1"><LevelBadges e={e} /></div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-bg px-2.5 py-2">
          <p className="text-[15px] font-extrabold">{formatKm(e.distanceStraightLineKm)}</p>
          <p className="text-[11px] font-medium text-muted">{tr('à vol d’oiseau')}</p>
        </div>
        <div className="rounded-lg bg-bg px-2.5 py-2">
          <p className="text-[15px] font-extrabold">{route?.loading ? <SpinnerIcon size={15} /> : formatKm(e.distanceRoadKm)}</p>
          <p className="text-[11px] font-medium text-muted">{tr('par la route')}</p>
        </div>
        <div className="rounded-lg bg-bg px-2.5 py-2">
          <p className="text-[15px] font-extrabold">{route?.loading ? <SpinnerIcon size={15} /> : formatMinutes(e.estimatedTravelMinutes)}</p>
          <p className="text-[11px] font-medium text-muted">{tr(mode === 'car' ? 'en voiture' : 'à pied')}</p>
        </div>
      </div>
      {route?.error && <p role="alert" className="mt-2 text-xs font-semibold text-danger-600">{tr(route.error)}</p>}

      <p className="mt-3 text-[13px]">{e.address ?? <span className="italic text-muted">{tr('Adresse non publiée par les sources')}</span>}</p>

      <dl className="mt-2 space-y-1 text-[13px]">
        <div className="flex gap-1.5">
          <dt className="shrink-0 font-bold">{tr('Urgences :')}</dt>
          <dd>
            {e.emergency === 'yes' ? <>{tr('service d’urgences déclaré')} <span className="text-muted">({tr(INFO_SOURCE_LABEL[e.emergencySource ?? 'osm'])})</span></>
              : e.emergency === 'no' ? <>{tr('pas de service d’urgences')} <span className="text-muted">({tr('selon {source}', { source: tr(INFO_SOURCE_LABEL[e.emergencySource ?? 'osm']) })})</span></>
              : <span className="text-muted">{tr('information non publiée')}</span>}
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="shrink-0 font-bold">{tr('Horaires :')}</dt>
          <dd>
            {e.hours ? (
              e.hours.verified
                ? <>{e.hours.text} <span className="text-muted">({tr('vérifiés le {date}', { date: formatShortDate(e.hours.verifiedAt) })})</span></>
                : <>{e.hours.text} <span className="text-muted">({tr('indiqués sur {source}, non vérifiés', { source: tr(INFO_SOURCE_LABEL[e.hours.source]) })})</span></>
            ) : <span className="text-muted">{tr('non publiés')}</span>}
          </dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="shrink-0 font-bold">{tr('Garde :')}</dt>
          <dd>
            {e.levels.officialOnDuty || nextDuty
              ? <>{e.levels.officialOnDuty ? tr('désigné de garde aujourd’hui') : tr('désigné de garde du {debut} au {fin}', { debut: formatShortDate(nextDuty!.from), fin: formatShortDate(nextDuty!.to) })} — <a href={(nextDuty ?? e.duty[0]).sourceUrl} target="_blank" rel="noopener noreferrer" className="underline" onClick={(ev) => ev.stopPropagation()}>{(nextDuty ?? e.duty[0]).sourceName}</a></>
              : <span className="text-muted">{tr('aucune désignation officielle publiée')}</span>}
          </dd>
        </div>
      </dl>

      {e.services.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5" aria-label={tr('Spécialités et services')}>
          {e.services.slice(0, 6).map((s) => (
            <li key={s.id} className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${s.id === 'emergency' ? 'bg-danger-50 text-danger-600' : 'bg-brand-50 text-brand-700'}`}
              title={`${tr('Source :')} ${tr(INFO_SOURCE_LABEL[s.source])}`}>
              {SERVICE_LABEL[s.id]}{s.source === 'nom' ? ' *' : ''}
            </li>
          ))}
          {e.services.length > 6 && <li className="rounded-full bg-bg px-2.5 py-0.5 text-xs font-bold text-muted">+{e.services.length - 6}</li>}
        </ul>
      )}
      {e.notes.map((n) => <p key={n} className="mt-1 text-xs font-semibold text-warn-600">• {tr(n)}</p>)}

      <details className="mt-2 rounded-xl bg-bg px-3 py-2" onClick={(ev) => ev.stopPropagation()}>
        <summary className="flex cursor-pointer items-center justify-between text-xs font-bold text-muted">
          {tr('Détails et sources')}
          <svg className="chev h-4 w-4 transition-transform" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
        </summary>
        <div className="mt-2 space-y-1.5 text-[12px]">
          {e.services.length > 6 && (
            <p><b>{tr('Tous les services :')}</b> {e.services.map((s) => tr(SERVICE_LABEL[s.id]) + (s.source === 'nom' ? ' *' : '')).join(', ')}</p>
          )}
          {e.services.some((s) => s.source === 'nom') && <p className="text-muted">* {tr('déduit du nom de l’établissement')}</p>}
          {located && <p><b>{tr('Coordonnées :')}</b> {e.latitude!.toFixed(5)}, {e.longitude!.toFixed(5)}</p>}
          {e.phone && <p><b>{tr('Téléphone :')}</b> <span dir="ltr">{formatPhone(e.phone)}</span></p>}
          <p className="text-muted">
            <b className="text-ink">{tr(e.sources.length > 1 ? 'Sources :' : 'Source :')}</b>{' '}
            {e.sources.map((s, i) => (
              <span key={s.url + i}>
                {i > 0 && ', '}
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline">{s.name}</a>
                {s.dataDate ? ` (${tr('données du {date}', { date: formatShortDate(s.dataDate) })})` : ''}
                {s.license ? ` — ${s.license}` : ''}
              </span>
            ))}
          </p>
        </div>
      </details>

      <div className="mt-3 grid grid-cols-3 gap-2" onClick={(ev) => ev.stopPropagation()}>
        <button type="button" disabled={!located} onClick={onShowOnMap} className="rounded-xl bg-brand-50 py-2.5 text-sm font-bold text-brand-700 disabled:opacity-40">
          {tr('Voir sur la carte')}
        </button>
        <button type="button" disabled={!located || !origin} onClick={onRoute} className="inline-flex items-center justify-center gap-1 rounded-xl bg-brand-700 py-2.5 text-sm font-bold text-white disabled:opacity-40">
          <RouteIcon size={16} /> {tr('Itinéraire')}
        </button>
        {e.phone ? (
          <a href={`tel:${e.phone}`} className="inline-flex items-center justify-center gap-1 rounded-xl border-[1.5px] border-brand-700 py-2.5 text-sm font-bold text-brand-700" aria-label={tr('Appeler {nom} au {tel}', { nom: e.name, tel: formatPhone(e.phone) })}>
            <PhoneIcon size={16} /> {tr('Appeler')}
          </a>
        ) : (
          <span className="flex items-center justify-center rounded-xl border border-dashed border-line px-1 text-center text-[11px] font-semibold text-muted">{tr('Tél. non publié')}</span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1" onClick={(ev) => ev.stopPropagation()}>
        {located && (
          <a href={googleMapsDirectionsUrl(origin, { lat: e.latitude!, lng: e.longitude! }, mode)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-muted underline">
            {tr('Ouvrir dans Google Maps')} <ExternalIcon size={13} />
          </a>
        )}
        <a href={`https://wa.me/?text=${encodeURIComponent([e.name, TYPE_LABEL[e.type], e.address, e.phone ? `Tél. ${formatPhone(e.phone)}` : null, located ? `Itinéraire : https://www.google.com/maps/search/?api=1&query=${e.latitude},${e.longitude}` : null, 'Appelez avant de vous déplacer. Urgence : 141 ou 15.'].filter(Boolean).join('\n'))}`}
          target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-[#1f8f4e] underline">
          {tr('Envoyer par WhatsApp')}
        </a>
        {e.website && /^https?:\/\//.test(e.website) && (
          <a href={e.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-muted underline">
            {tr('Site de l’établissement')} <ExternalIcon size={13} />
          </a>
        )}
      </div>
    </article>
  );
});
