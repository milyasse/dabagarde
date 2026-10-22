// Ville sans source exploitable : on le dit clairement et on oriente vers l'information d'origine.
import { tr } from '../../i18n/index.tsx';
import type { Coverage } from '../../shared/coverage.ts';
import { externalLinks } from '../../shared/coverage.ts';
import { ExternalIcon, InfoIcon, WarnIcon } from '../icons.tsx';
import { PAGES, pageUrl } from '../../brand.ts';

export function CoverageNotice(props: { placeName: string; coverage: Coverage; onGoCovered: () => void }) {
  const { coverage: c } = props;
  if (c.status === 'covered') return null;
  return (
    <section aria-label={tr('Couverture')} className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-line">
      <div className="flex gap-3">
        <InfoIcon size={22} className="mt-0.5 shrink-0 text-night-700" />
        <div className="text-sm">
          <p className="font-bold">{tr('Pas encore de liste de garde fiable pour {lieu}.', { lieu: props.placeName })}</p>
          <p className="mt-1 text-muted">
            {tr('Nous n’affichons une ville que lorsqu’une source datée et réutilisable existe.')}
            {c.status === 'near' && c.cityName ? ` ${tr('La ville couverte la plus proche est {ville}, à environ {km} km.', { ville: c.cityName, km: c.distanceKm ?? '' })}` : ''}
          </p>
        </div>
      </div>
      <ul className="space-y-2">
        {externalLinks(props.placeName).map((l) => (
          <li key={l.url}>
            <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-center justify-between gap-2 rounded-xl bg-bg px-3 py-2.5 text-sm font-bold hover:bg-brand-50">
              <span>{tr(l.label, { lieu: props.placeName })}<span className="block text-xs font-medium text-muted">{tr(l.note)}</span></span>
              <ExternalIcon size={16} className="shrink-0" />
            </a>
          </li>
        ))}
      </ul>
      {c.status === 'near' && c.cityName && (
        <button type="button" onClick={props.onGoCovered} className="w-full rounded-xl bg-brand-700 py-2.5 text-sm font-bold text-white">{tr('Voir les gardes de {ville}', { ville: c.cityName })}</button>
      )}
      <p className="flex gap-2 text-xs font-semibold text-danger-600"><WarnIcon size={16} className="shrink-0" />{tr('Urgence vitale : 141 (SAMU) · 15 (Protection civile)')}. <a href={pageUrl(PAGES.urgences)} className="underline">{tr('Autres numéros')}</a></p>
    </section>
  );
}
