// Accueil : recherche centrale, villes, fraîcheur des données, aide.
import { currentLang, tr } from '../../i18n/index.tsx';
import type { ReactNode } from 'react';
import { LocalitySearch } from '../search/LocalitySearch.tsx';
import type { GeoLocality } from '../../shared/geo/types.ts';
import type { CityCount, DutyFilter } from '../../shared/search.ts';
import type { CityId, CollectorStatus } from '../../shared/types.ts';
import { CITIES, CITY_NAME, CONNECTORS } from '../../shared/connectors/registry.ts';
import { formatFrDate, formatMoroccoDateTime } from '../../shared/dates.ts';
import { PAGES, pageUrl } from '../../brand.ts';
import { ChevronIcon, ClockIcon, MoonIcon, PhoneIcon, PinIcon, StarIcon, WarnIcon } from '../icons.tsx';

export interface RecentPlace { id: string; name: string; lat: number; lon: number }
export interface FavoritePharmacy { id: string; name: string; city: string; phone: string | null }

/** Grandes villes proposées en accès rapide même sans source : la page explique l'absence de données. */
export const MAJOR_CITIES: { name: string; lat: number; lon: number }[] = [
  { name: 'Essaouira', lat: 31.5118, lon: -9.7621 },
  { name: 'Laâyoune', lat: 27.1545, lon: -13.1954 },
  { name: 'Béni Mellal', lat: 32.3373, lon: -6.3498 },
  { name: 'Errachidia', lat: 31.9291, lon: -4.4341 },
  { name: 'Ouarzazate', lat: 30.9202, lon: -6.9109 },
  { name: 'Taza', lat: 34.2302, lon: -4.0101 },
  { name: 'Larache', lat: 35.1951, lon: -6.154 },
  { name: 'Al Hoceïma', lat: 35.245, lon: -3.9313 },
  { name: 'Guelmim', lat: 28.9864, lon: -10.0574 },
  { name: 'Dakhla', lat: 23.6941, lon: -15.9431 },
]

const QUICK: { v: DutyFilter; label: string; icon: ReactNode }[] = [
  { v: 'all', label: 'De garde aujourd’hui', icon: <ClockIcon size={16} /> },
  { v: 'night', label: 'De nuit', icon: <MoonIcon size={16} /> },
  { v: 'continuous', label: '24 h/24', icon: <ClockIcon size={16} /> },
];

const FAQ: { q: string; a: string }[] = [
  { q: 'Les pharmacies affichées sont-elles ouvertes ?', a: 'Nous affichons ce que les sources publient pour la date choisie : type de garde, période et horaires quand ils existent. Nous ne pouvons pas garantir qu’une pharmacie est ouverte à l’instant : appelez avant de vous déplacer.' },
  { q: 'D’où viennent les informations ?', a: 'De listes de garde publiques et datées, relues automatiquement plusieurs fois par jour. Chaque fiche indique sa source et l’heure de la dernière récupération. Une donnée récupérée n’est pas une vérification sur le terrain.' },
  { q: 'Pourquoi ma ville n’est-elle pas couverte ?', a: 'Nous n’affichons une ville que lorsqu’une source fiable et réutilisable existe. Pour les autres villes, nous indiquons où consulter l’information d’origine et les numéros d’urgence.' },
  { q: 'Ma position est-elle enregistrée ?', a: 'Non. Elle sert uniquement sur votre appareil à trier les pharmacies par distance et à calculer l’itinéraire ; elle n’est ni conservée ni partagée à des fins publicitaires.' },
];

type CityRow = { city: CityId; active: number; night: number; continuous: number };
function cityRows(counts: CityCount[] | null): CityRow[] {
  if (counts) return counts.map((c) => ({ city: c.city, active: c.active, night: c.night, continuous: c.continuous }));
  return CITIES.map((c) => ({ city: c.id, active: -1, night: 0, continuous: 0 }));
}

export function Home(props: {
  now: Date;
  date: string;
  status: CollectorStatus | null;
  counts: CityCount[] | null;
  countsLoading: boolean;
  dutyFilter: DutyFilter;
  onDutyFilter: (f: DutyFilter) => void;
  onPickLocality: (l: GeoLocality) => void;
  onPickPlace: (p: RecentPlace) => void;
  onPickCity: (c: CityId) => void;
  onLocate: () => void;
  locating: boolean;
  recents: RecentPlace[];
  favorites: FavoritePharmacy[];
  onRemoveFavorite: (id: string) => void;
  onOpenRegions: () => void;
}) {
  const clockRaw = new Intl.DateTimeFormat(currentLang() === 'ar' ? 'ar-MA-u-nu-latn' : 'fr-FR', { timeZone: 'Africa/Casablanca', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }).format(props.now);
  const clock = clockRaw.charAt(0).toUpperCase() + clockRaw.slice(1);
  const sources = CONNECTORS.filter((c) => c.enabled && c.homepage);
  const rows = cityRows(props.counts).sort((a, b) => b.active - a.active || CITY_NAME[a.city].localeCompare(CITY_NAME[b.city], 'fr'));
  // Villes avec des gardes publiées en cartes ; les autres (suivies mais vides aujourd'hui) en liste compacte
  const visibleCities = props.counts ? rows.filter((r) => r.active !== 0) : rows.slice(0, 6);
  const quietCities = props.counts ? rows.filter((r) => r.active === 0) : [];
  return (
    <div>
      {/* ---------- Recherche */}
      <section className="hero-bg text-white">
        <div className="mx-auto max-w-3xl px-4 pb-10 pt-8 sm:pt-14 lg:pb-14">
          <p className="text-sm font-semibold text-brand-100/90">{clock} · {tr('heure du Maroc')}</p>
          <h1 className="font-display mt-2 text-[34px] font-extrabold leading-[1.05] sm:text-5xl">
            {tr('Une pharmacie de garde,')}<br /><span className="text-brand-200">{tr('maintenant.')}</span>
          </h1>
          <p className="mt-3 max-w-xl text-[15px] text-white/85 sm:text-base">
            {tr('Listes de garde datées et sourcées, avec distance, téléphone et itinéraire. Cherchez une ville ou utilisez votre position.')}
          </p>
          <div className="mt-6">
            <LocalitySearch onPick={props.onPickLocality} onLocate={props.onLocate} locating={props.locating} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label={tr('Type de garde recherché')}>
            {QUICK.map((f) => {
              const on = props.dutyFilter === f.v;
              return (
                <button key={f.v} type="button" aria-pressed={on} onClick={() => props.onDutyFilter(f.v)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-bold ${on ? 'bg-white text-brand-800' : 'bg-white/10 text-white ring-1 ring-white/25 hover:bg-white/15'}`}>
                  {f.icon}{tr(f.label)}
                </button>
              );
            })}
          </div>
          {props.recents.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold text-white/70">{tr('Récemment :')}</span>
              {props.recents.slice(0, 4).map((r) => (
                <button key={r.id} type="button" onClick={() => props.onPickPlace(r)} className="rounded-full bg-white/10 px-3 py-1 font-semibold text-white hover:bg-white/20">{r.name}</button>
              ))}
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-12 px-4 py-10 lg:px-6">
        {/* ---------- Favoris */}
        {props.favorites.length > 0 && (
          <section aria-labelledby="h-fav">
            <h2 id="h-fav" className="font-display text-2xl font-extrabold">{tr('Vos pharmacies')}</h2>
            <p className="mt-1 text-sm text-muted">{tr('Enregistrées sur cet appareil uniquement. Leur statut de garde s’affiche quand elles figurent dans une liste du jour.')}</p>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {props.favorites.map((f) => (
                <li key={f.id} className="flex items-center gap-3 rounded-2xl bg-white p-4 ring-1 ring-line">
                  <StarIcon size={20} filled className="shrink-0 text-brand-600" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{f.name}</p>
                    <p className="text-xs text-muted">{f.city}</p>
                  </div>
                  {f.phone && <a href={`tel:${f.phone}`} className="rounded-full bg-brand-50 p-2 text-brand-700" aria-label={tr('Appeler {nom}', { nom: f.name })}><PhoneIcon size={18} /></a>}
                  <button type="button" onClick={() => props.onRemoveFavorite(f.id)} className="text-xs font-bold text-muted underline">{tr('Retirer')}</button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ---------- Villes */}
        <section aria-labelledby="h-villes">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="h-villes" className="font-display text-2xl font-extrabold">{tr('Villes couvertes')}</h2>
              <p className="mt-1 text-sm text-muted">{props.counts ? tr('{n} villes avec des gardes publiées pour le {date} · {total} villes suivies', { n: visibleCities.length, date: formatFrDate(props.date), total: rows.length }) : tr('Gardes publiées pour le {date}', { date: formatFrDate(props.date) })}.</p>
            </div>
            <button type="button" onClick={props.onOpenRegions} className="inline-flex items-center gap-1 rounded-full bg-white px-4 py-2 text-sm font-bold text-brand-700 ring-1 ring-line hover:bg-brand-50">
              {tr('Parcourir par région')} <ChevronIcon size={16} className="rtl:rotate-180" />
            </button>
          </div>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleCities.map((c) => (
              <li key={c.city}>
                <button type="button" onClick={() => props.onPickCity(c.city)} className="group flex w-full items-center gap-4 rounded-2xl bg-white p-4 text-start ring-1 ring-line transition hover:ring-2 hover:ring-brand-500">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><PinIcon size={24} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-lg font-extrabold">{CITY_NAME[c.city]}</span>
                    <span className="block text-sm text-muted tabular">
                      {c.active < 0 ? tr(props.countsLoading ? 'Chargement…' : 'Données indisponibles') : c.active === 0 ? tr('Aucune garde publiée') : `${tr(c.active > 1 ? '{n} gardes' : '{n} garde', { n: c.active })}${c.night ? ` · ${tr('{n} de nuit', { n: c.night })}` : ''}${c.continuous ? ` · ${tr('{n} en 24 h/24', { n: c.continuous })}` : ''}`}
                    </span>
                  </span>
                  <ChevronIcon size={20} className="text-muted transition group-hover:translate-x-0.5 group-hover:text-brand-700 rtl:rotate-180" />
                </button>
              </li>
            ))}
          </ul>
          {quietCities.length > 0 && (
            <div className="mt-5">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-muted">{tr('Suivies, rien de publié pour l’instant')}</h3>
              <p className="mt-1 text-sm text-muted">{tr('La source n’a pas encore publié la garde du jour pour ces villes : elle apparaîtra ici dès sa publication.')}</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {quietCities.map((c) => (
                  <li key={c.city}><button type="button" onClick={() => props.onPickCity(c.city)} className="rounded-full bg-white px-3.5 py-2 text-sm font-semibold ring-1 ring-line hover:ring-brand-500">{CITY_NAME[c.city]}</button></li>
                ))}
              </ul>
            </div>
          )}
          <h3 className="mt-8 text-sm font-extrabold uppercase tracking-wider text-muted">{tr('Autres grandes villes')}</h3>
          <p className="mt-1 text-sm text-muted">{tr('Pas encore de source fiable réutilisable : nous vous indiquons où trouver l’information d’origine.')}</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {MAJOR_CITIES.map((c) => (
              <li key={c.name}>
                <button type="button" onClick={() => props.onPickPlace({ id: `major-${c.name}`, name: c.name, lat: c.lat, lon: c.lon })} className="rounded-full bg-white px-3.5 py-2 text-sm font-semibold ring-1 ring-line hover:ring-brand-500">{c.name}</button>
              </li>
            ))}
            <li><a href={pageUrl(PAGES.villes)} className="inline-block rounded-full px-3.5 py-2 text-sm font-bold text-brand-700 underline">{tr('Toutes les villes')}</a></li>
          </ul>
        </section>

        {/* ---------- Fiabilité */}
        <section aria-labelledby="h-fiab" className="grid gap-6 rounded-3xl bg-brand-900 p-6 text-white sm:p-8 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <h2 id="h-fiab" className="font-display text-2xl font-extrabold">{tr('Des informations datées, jamais présentées comme certaines')}</h2>
            <p className="mt-3 text-sm text-white/80">
              {tr('Chaque garde indique sa source, sa période et l’heure de sa dernière récupération. Une liste périmée, une position approximative ou un désaccord entre sources sont signalés, pas masqués.')}
            </p>
            <a href={pageUrl(PAGES.methode)} className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-brand-200 underline">{tr('Sources et méthode')} <ChevronIcon size={16} className="rtl:rotate-180" /></a>
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
              <dt className="text-white/70">{tr('Dernière collecte')}</dt>
              <dd className="mt-1 font-bold">{props.status ? formatMoroccoDateTime(props.status.generatedAt) : '—'}</dd>
            </div>
            <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
              <dt className="text-white/70">{tr('Fréquence')}</dt>
              <dd className="mt-1 font-bold">{tr('Environ toutes les 2 heures')}</dd>
            </div>
            <div className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10 sm:col-span-2">
              <dt className="text-white/70">{tr('Sources actives')}</dt>
              <dd className="mt-1 font-bold">{sources.map((s) => s.name).join(' · ') || '—'}</dd>
            </div>
          </dl>
        </section>

        {/* ---------- Aide */}
        <section aria-labelledby="h-faq" className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <h2 id="h-faq" className="font-display text-2xl font-extrabold">{tr('Questions fréquentes')}</h2>
            <p className="mt-2 text-sm text-muted">{tr('Ce que DabaGarde peut et ne peut pas garantir.')}</p>
            <div className="mt-5 flex gap-3 rounded-2xl bg-danger-50 p-4 text-sm text-danger-600">
              <WarnIcon size={20} className="shrink-0" />
              <p><b>{tr('Urgence vitale :')}</b> {tr('appelez le 141 (SAMU) ou le 15 (Protection civile).')} <a href={pageUrl(PAGES.urgences)} className="font-bold underline">{tr('Tous les numéros')}</a></p>
            </div>
          </div>
          <div className="divide-y divide-line rounded-2xl bg-white ring-1 ring-line">
            {FAQ.map((f) => (
              <details key={f.q} className="group p-4">
                <summary className="flex cursor-pointer items-center justify-between gap-3 font-bold">
                  {tr(f.q)}<ChevronIcon size={18} className="chev shrink-0 rotate-90 text-muted transition" />
                </summary>
                <p className="mt-2 text-sm text-muted">{tr(f.a)}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
