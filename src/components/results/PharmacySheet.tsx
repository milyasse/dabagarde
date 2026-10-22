// Fiche détaillée d'une pharmacie : garde, position, sources, qualité, actions.
import type { ReactNode } from 'react';
import type { Pharmacy } from '../../shared/types.ts';
import { Dialog } from '../Dialog.tsx';
import { temporalStatus } from '../../shared/temporal.ts';
import { TEMPORAL_STYLE } from '../PharmacyCard.tsx';
import { DUTY_TYPE_LABEL } from '../../shared/duty.ts';
import { CONFIDENCE_LABEL, STATUS_LABEL } from '../../shared/status.ts';
import { formatMoroccoDateTime, formatShortDate } from '../../shared/dates.ts';
import { formatKm, formatMinutes } from '../../shared/distance.ts';
import { formatPhone } from '../../shared/text.ts';
import { CITY_NAME } from '../../shared/connectors/registry.ts';
import { GEO_PRECISION_LABEL, QUALITY_LABEL, geoPrecision, type QualityFlag } from '../../shared/quality.ts';
import { mapsUrl, wazeUrl } from '../../utils/share.ts';
import { ExternalIcon, FlagIcon, MapIcon, PhoneIcon, ShareIcon, StarIcon } from '../icons.tsx';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[8.5rem_1fr] gap-3 py-2 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 font-semibold">{children}</dd>
    </div>
  );
}

export function PharmacySheet(props: {
  p: Pharmacy | null;
  now: Date;
  flags: QualityFlag[];
  favorite: boolean;
  onClose: () => void;
  onShowOnMap: () => void;
  onShare: () => void;
  onReport: () => void;
  onToggleFavorite: () => void;
}) {
  const p = props.p;
  return (
    <Dialog open={!!p} onClose={props.onClose} title={p?.name ?? ''} wide>
      {p && (() => {
        const t = temporalStatus(p, props.now);
        const gm = mapsUrl(p), wz = wazeUrl(p);
        const period = p.dutyStart && p.dutyEnd && p.dutyStart !== p.dutyEnd
          ? `du ${formatShortDate(p.dutyStart)} au ${formatShortDate(p.dutyEnd)}`
          : `le ${formatShortDate(p.dutyStart ?? p.dutyDate)}`;
        return (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-sm font-bold ${TEMPORAL_STYLE[t.kind]}`}>{t.label}</span>
              <span className="text-sm text-muted">{[p.district, CITY_NAME[p.city] ?? p.city].filter(Boolean).join(' · ')}</span>
            </div>
            {t.detail && <p className="-mt-3 text-sm text-muted">{t.detail}</p>}

            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {p.phone
                ? <a href={`tel:${p.phone}`} className="col-span-3 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-700 py-3 font-bold text-white sm:col-span-1"><PhoneIcon size={18} /> Appeler</a>
                : <span className="col-span-3 flex items-center justify-center rounded-xl border border-dashed border-line py-3 text-sm text-muted sm:col-span-1">Téléphone non publié</span>}
              <button type="button" onClick={props.onShowOnMap} disabled={p.latitude === null} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-50 py-3 font-bold text-brand-800 disabled:opacity-40"><MapIcon size={18} /> Carte</button>
              <button type="button" onClick={props.onShare} className="inline-flex items-center justify-center gap-2 rounded-xl bg-bg py-3 font-bold"><ShareIcon size={18} /> Partager</button>
              <button type="button" onClick={props.onToggleFavorite} aria-pressed={props.favorite} className="inline-flex items-center justify-center gap-2 rounded-xl bg-bg py-3 font-bold"><StarIcon size={18} filled={props.favorite} /> {props.favorite ? 'Retirer' : 'Favori'}</button>
            </div>

            <section>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted">Garde</h3>
              <dl className="mt-1 divide-y divide-line">
                <Row label="Type">{p.dutyType ? DUTY_TYPE_LABEL[p.dutyType] : p.dutyLabel ?? 'Non publié par la source'}</Row>
                <Row label="Période">{period}</Row>
                <Row label="Horaires">{p.hoursText ?? 'Non publiés : appelez pour confirmer'}</Row>
                <Row label="Statut">{STATUS_LABEL[p.verificationStatus]} · {CONFIDENCE_LABEL[p.confidenceLevel].toLowerCase()}</Row>
              </dl>
              {p.notes.length > 0 && <ul className="mt-2 space-y-1 text-sm text-warn-600">{p.notes.map((n) => <li key={n}>• {n}</li>)}</ul>}
            </section>

            <section>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted">Adresse et accès</h3>
              <dl className="mt-1 divide-y divide-line">
                <Row label="Adresse">{p.address ?? 'Non communiquée par la source'}</Row>
                {p.phone && <Row label="Téléphone"><a href={`tel:${p.phone}`} className="underline">{formatPhone(p.phone)}</a></Row>}
                <Row label="Position">{GEO_PRECISION_LABEL[geoPrecision(p)]}</Row>
                {p.distanceStraightLineKm !== null && <Row label="Distance">{formatKm(p.distanceStraightLineKm)} à vol d’oiseau{p.estimatedTravelMinutes !== null ? ` · ${formatMinutes(p.estimatedTravelMinutes)} (${formatKm(p.distanceRoadKm)} par la route)` : ''}</Row>}
              </dl>
              {(gm || wz) && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {gm && <a href={gm} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full bg-bg px-3 py-1.5 text-sm font-bold">Google Maps <ExternalIcon size={14} /></a>}
                  {wz && <a href={wz} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full bg-bg px-3 py-1.5 text-sm font-bold">Waze <ExternalIcon size={14} /></a>}
                </div>
              )}
            </section>

            <section>
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted">Sources</h3>
              <ul className="mt-2 space-y-2 text-sm">
                {p.sources.map((s) => (
                  <li key={s.sourceId + s.sourceUrl} className="rounded-xl bg-bg p-3">
                    <p className="font-bold">{s.sourceUrl ? <a href={s.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline">{s.sourceName}</a> : s.sourceName}</p>
                    <p className="text-muted">
                      {s.sourcePublishedAt ? `Page datée du ${formatShortDate(s.sourcePublishedAt)} · ` : 'Page sans date · '}
                      récupérée le {formatMoroccoDateTime(s.lastCheckedAt)}
                    </p>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-muted">Informations récupérées automatiquement : elles n’ont pas été vérifiées sur le terrain par DabaGarde.</p>
            </section>

            {props.flags.length > 0 && (
              <section>
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-muted">Points d’attention</h3>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {props.flags.map((f) => <li key={f} className="rounded-full bg-warn-50 px-2.5 py-1 text-xs font-bold text-warn-600">{QUALITY_LABEL[f]}</li>)}
                </ul>
              </section>
            )}

            <button type="button" onClick={props.onReport} className="inline-flex w-full items-center justify-center gap-2 rounded-xl border-[1.5px] border-line py-3 text-sm font-bold text-ink hover:border-brand-500">
              <FlagIcon size={16} /> Signaler une information incorrecte
            </button>
          </div>
        );
      })()}
    </Dialog>
  );
}
