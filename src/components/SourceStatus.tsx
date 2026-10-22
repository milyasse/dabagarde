import { tr } from '../i18n/index.tsx';
import type { CollectorStatus } from '../shared/types.ts';
import { CITY_NAME, CONNECTORS } from '../shared/connectors/registry.ts';
import { formatMoroccoDateTime, formatShortDate } from '../shared/dates.ts';
import type { TravelMode } from '../services/routing.ts';
import { CloseIcon } from './icons.tsx';
import { BRAND } from '../brand.ts';
import { APP_VERSION, BUILD_SHA, BUILD_TIME } from '../version.ts';

export function SourceStatus(props: {
  open: boolean;
  onClose: () => void;
  status: CollectorStatus | null;
  statusError: string | null;
  mode: TravelMode;
  onMode: (m: TravelMode) => void;
}) {
  if (!props.open) return null;
  const connectors = props.status?.connectors ?? CONNECTORS;
  return (
    <div className="fixed inset-0 z-[1000] flex justify-end bg-black/40" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={props.onClose}>
      <div className="h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 id="settings-title" className="text-lg font-extrabold">{tr('Paramètres et méthode')}</h2>
          <button type="button" onClick={props.onClose} className="rounded-lg p-2 hover:bg-bg" aria-label={tr('Fermer')}><CloseIcon /></button>
        </div>

        <section className="mt-4 space-y-2">
          <h3 className="text-sm font-extrabold">{tr('Mode de trajet')}</h3>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-bg p-1">
            {(['car', 'foot'] as TravelMode[]).map((m) => (
              <button key={m} type="button" aria-pressed={props.mode === m} onClick={() => props.onMode(m)}
                className={`rounded-lg py-2 text-sm ${props.mode === m ? 'bg-white font-extrabold text-brand-700 shadow-sm' : 'font-semibold text-muted'}`}>
                {tr(m === 'car' ? 'Voiture' : 'À pied')}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-5 space-y-2 text-sm">
          <h3 className="font-extrabold">{tr('Comment les gardes sont trouvées')}</h3>
          <p>{tr('Un collecteur automatique (GitHub Actions) consulte les sources publiques toutes les deux heures environ et publie les résultats datés. L’application ne présente jamais une pharmacie comme étant de garde sans qu’une source la rattache à la date demandée.')}</p>
          <ul className="list-disc space-y-1 ps-5">
            <li><b>{tr('Confirmée')}</b> : {tr('une source publie cette garde pour la date (liste du jour datée et/ou historique daté de la fiche).')}</li>
            <li><b>{tr('À confirmer')}</b> : {tr('trouvée, mais la date n’a pas pu être vérifiée.')}</li>
            <li><b>{tr('Sources contradictoires')}</b> : {tr('les sources ne disent pas la même chose.')}</li>
            <li><b>{tr('Expirée')}</b> : {tr('la période de garde est terminée.')}</li>
          </ul>
          <p>{tr('La distance « à vol d’oiseau » sert au filtrage par rayon et au classement. La distance « par la route » et la durée viennent du moteur d’itinéraire OSRM, uniquement quand vous les demandez.')}</p>
        </section>

        <section className="mt-5 space-y-2 text-sm">
          <h3 className="font-extrabold">{tr('Dernière collecte')}</h3>
          {props.statusError && <p className="font-semibold text-danger-600">{props.statusError}</p>}
          {props.status ? (
            <>
              <p>{tr('Le {date} (heure du Maroc).', { date: formatMoroccoDateTime(props.status.generatedAt) })}</p>
              <ul className="divide-y divide-line rounded-xl border border-line">
                {props.status.runs.map((r) => (
                  <li key={r.sourceId + r.city} className="flex items-start justify-between gap-2 px-3 py-2">
                    <span>
                      <b>{CITY_NAME[r.city]}</b> · <a className="underline" href={r.url} target="_blank" rel="noopener noreferrer">{r.sourceName}</a>
                      <br />
                      <span className="text-xs text-muted">
                        {r.ok ? `${tr('{n} pharmacie(s)', { n: r.count })} · ${r.pageDate ? tr('page datée {date}', { date: formatShortDate(r.pageDate) }) : tr('page sans date')}` : r.error}
                      </span>
                    </span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${r.ok ? 'bg-brand-50 text-brand-700' : 'bg-danger-50 text-danger-600'}`}>{r.ok ? 'OK' : tr('Erreur')}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : !props.statusError && <p className="text-muted">{tr('Aucune collecte publiée pour l’instant.')}</p>}
        </section>

        <section className="mt-5 space-y-2 text-sm">
          <h3 className="font-extrabold">{tr('Sources')}</h3>
          <ul className="space-y-2">
            {connectors.map((c) => (
              <li key={c.id} className="rounded-xl border border-line p-3">
                <div className="flex items-center justify-between gap-2">
                  <b>{c.homepage ? <a className="underline" href={c.homepage} target="_blank" rel="noopener noreferrer">{c.name}</a> : c.name}</b>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${c.enabled ? 'bg-brand-50 text-brand-700' : 'bg-[#F1F2F4] text-neutral-500'}`}>{tr(c.enabled ? 'Active' : 'Désactivée')}</span>
                </div>
                <p className="mt-1 text-xs text-muted">{c.reason}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-5 space-y-2 text-sm">
          <h3 className="font-extrabold">{tr('Confidentialité')}</h3>
          <p>{tr('Votre position reste dans votre navigateur. Elle n’est transmise qu’aux services nécessaires : OpenStreetMap (fond de carte), OSRM (itinéraire, seulement à la demande) et Nominatim (seulement si vous cherchez une adresse). Elle n’est jamais enregistrée.')}</p>
          <p className="text-xs text-muted">Fond de carte © contributeurs OpenStreetMap · Itinéraires OSRM (FOSSGIS / Project OSRM) · Géocodage Nominatim.</p>
        </section>

        <section className="mt-5 space-y-1 border-t border-line pt-4 text-sm">
          <h3 className="font-extrabold">{tr('À propos')}</h3>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-muted">{tr('Version de l’application')}</dt><dd className="font-bold">{APP_VERSION}</dd>
            <dt className="text-muted">Build</dt><dd className="font-mono">{BUILD_SHA}{BUILD_TIME ? ` · ${formatMoroccoDateTime(BUILD_TIME)}` : ''}</dd>
            <dt className="text-muted">{tr('Données de garde')}</dt><dd>{props.status ? tr('collecte du {date}', { date: formatMoroccoDateTime(props.status.generatedAt) }) : '—'}</dd>
          </dl>
          <p className="text-xs"><a className="underline" href={BRAND.repoUrl} target="_blank" rel="noopener noreferrer">{tr('Code source et historique des versions')}</a></p>
        </section>
      </div>
    </div>
  );
}
