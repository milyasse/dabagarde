import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SiteHeader } from './components/layout/SiteHeader.tsx';
import { SiteFooter } from './components/layout/SiteFooter.tsx';
import { Home, type FavoritePharmacy, type RecentPlace } from './components/home/Home.tsx';
import { SearchPanel, type Origin } from './components/SearchPanel.tsx';
import { PharmacyList, type SortBy } from './components/PharmacyList.tsx';
import { MapLegend } from './components/MapLegend.tsx';
import { SourceStatus } from './components/SourceStatus.tsx';
import { type Space } from './components/SpaceTabs.tsx';
import { LocalitySearch } from './components/search/LocalitySearch.tsx';
import { RegionBrowser } from './components/search/RegionBrowser.tsx';
import { PharmacySheet } from './components/results/PharmacySheet.tsx';
import { ReportDialog } from './components/results/ReportDialog.tsx';
import { CoverageNotice } from './components/results/CoverageNotice.tsx';
import type { RouteState } from './components/PharmacyCard.tsx';
import { ResultsSkeleton } from './components/ResultsSkeleton.tsx';
import { ListIcon, MapIcon, PinIcon } from './components/icons.tsx';
import { getCurrentPosition, type GeoError } from './services/geolocation.ts';
import { searchPlace } from './services/geocoding.ts';
import { getRoute, type RouteResult, type TravelMode } from './services/routing.ts';
import { loadSnapshots, loadStatus } from './services/pharmacySearch.ts';
import { buildResults, countByCity, selectPharmacies, sortByDuration, type CityCount, type DutyFilter, type SearchOutcome } from './shared/search.ts';
import type { CityId, CollectorStatus, Pharmacy } from './shared/types.ts';
import { addDays, formatFrDate, formatMoroccoDateTime, isIsoDate, moroccoDate } from './shared/dates.ts';
import { CITIES, CITY_NAME } from './shared/connectors/registry.ts';
import { coverageAt, type Coverage } from './shared/coverage.ts';
import { haversineKm } from './shared/distance.ts';
import { findDuplicates, qualityFlags, usableCoords } from './shared/quality.ts';
import type { GeoLocality } from './shared/geo/types.ts';
import { sharePharmacy } from './utils/share.ts';
import { useStoredList } from './hooks/useStoredList.ts';
import { useInstall, useOnline } from './hooks/useInstall.ts';
import { useMediaQuery, DESKTOP } from './hooks/useMediaQuery.ts';
import { CONFIG } from './config.ts';

// Chargés à la demande : la carte (Leaflet) et l'espace santé ne pèsent pas sur l'ouverture de l'accueil.
const PharmacyMap = lazy(() => import('./components/PharmacyMap.tsx').then((m) => ({ default: m.PharmacyMap })));
const HealthSpace = lazy(() => import('./components/health/HealthSpace.tsx').then((m) => ({ default: m.HealthSpace })));
const Loading = ({ label }: { label: string }) => <div role="status" className="flex h-full min-h-[200px] items-center justify-center text-sm font-semibold text-muted">{label}</div>;

// Préférences non sensibles uniquement (jamais la position)
function pref<T>(k: string, fallback: T): T {
  try {
    const v = localStorage.getItem('dg.' + k);
    return v === null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}
function savePref(k: string, v: unknown) {
  try { localStorage.setItem('dg.' + k, JSON.stringify(v)); } catch { /* stockage indisponible */ }
}

const FILTER_LABEL: Record<DutyFilter, string> = { all: 'tous types', day: 'garde de jour', night: 'garde de nuit', continuous: 'garde 24 h/24' };
const FILTERS = new Set<DutyFilter>(['all', 'day', 'night', 'continuous']);

type SearchState =
  | { state: 'idle' }
  | { state: 'loading' }
  | { state: 'error'; error: string }
  | { state: 'done'; outcome: SearchOutcome; notice: string | null; date: string; radiusKm: number; dutyFilter: DutyFilter; originKey: string; coverage: Coverage };

const originKey = (o: Origin | null) => (o ? `${o.lat.toFixed(5)},${o.lng.toFixed(5)}` : '');

/** Lecture des paramètres d'adresse partageables : ?ville=rabat, ?lieu=Fès&lat=…&lng=…, ?type=night, ?espace=sante. Jamais de position GPS. */
function readUrl(): { space: Space; origin: Origin | null; filter: DutyFilter | null } {
  const q = new URLSearchParams(window.location.search);
  const space: Space = q.get('espace') === 'sante' || window.location.hash.startsWith('#/cliniques') ? 'sante' : 'pharmacies';
  const type = q.get('type') as DutyFilter | null;
  const filter = type && FILTERS.has(type) ? type : null;
  const v = q.get('ville');
  const city = CITIES.find((c) => c.id === v);
  if (city) return { space, filter, origin: { lat: city.center.lat, lng: city.center.lng, label: city.name, kind: 'city', city: city.id } };
  const lat = Number(q.get('lat')), lng = Number(q.get('lng')), lieu = q.get('lieu');
  if (lieu && Number.isFinite(lat) && Number.isFinite(lng) && lat > 20 && lat < 36.5 && lng > -17.5 && lng < -0.5) {
    return { space, filter, origin: { lat, lng, label: lieu.slice(0, 80), kind: 'address' } };
  }
  return { space, filter, origin: null };
}

function writeUrl(space: Space, origin: Origin | null, filter: DutyFilter) {
  const q = new URLSearchParams();
  if (space === 'sante') q.set('espace', 'sante');
  else if (origin?.kind === 'city' && origin.city) q.set('ville', origin.city);
  else if (origin && origin.kind === 'address') { q.set('lieu', origin.label); q.set('lat', origin.lat.toFixed(4)); q.set('lng', origin.lng.toFixed(4)); }
  if (space === 'pharmacies' && origin && filter !== 'all') q.set('type', filter);
  const s = q.toString();
  window.history.replaceState(null, '', window.location.pathname + (s ? `?${s}` : ''));
}

export default function App() {
  const initial = useMemo(readUrl, []);
  const [space, setSpace] = useState<Space>(initial.space);
  const [healthSignal, setHealthSignal] = useState(0);
  const isDesktop = useMediaQuery(DESKTOP);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(t); }, []);

  const [origin, setOrigin] = useState<Origin | null>(initial.origin);
  const [originError, setOriginError] = useState<string | null>(null);
  const [geoHelp, setGeoHelp] = useState<{ message: string; help: string[] } | null>(null);
  const [locating, setLocating] = useState(false);
  const [picking, setPicking] = useState(false);
  const [date, setDate] = useState(() => moroccoDate());
  const [radiusKm, setRadiusKm] = useState<number>(() => (initial.origin ? 10 : pref('radius', 5)));
  const [dutyFilter, setDutyFilter] = useState<DutyFilter>(() => initial.filter ?? pref('filter', 'all'));
  const [mode, setMode] = useState<TravelMode>(() => pref('mode', 'car'));
  const [sortBy, setSortBy] = useState<SortBy>('distance');
  const [status, setStatus] = useState<CollectorStatus | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [search, setSearch] = useState<SearchState>({ state: 'idle' });
  const [searchNonce, setSearchNonce] = useState(0);
  const requestSearch = useCallback(() => setSearchNonce((n) => n + 1), []);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<'list' | 'map'>('list');
  const [routes, setRoutes] = useState<Record<string, RouteResult>>({});
  const [routeStates, setRouteStates] = useState<Record<string, RouteState>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focus, setFocus] = useState<{ id: string | null; n: number }>({ id: null, n: 0 });
  const [routesShown, setRoutesShown] = useState(true);
  const [showAllRoutes, setShowAllRoutes] = useState(false);
  const [computingAll, setComputingAll] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [regionsOpen, setRegionsOpen] = useState(false);
  const [sheet, setSheet] = useState<Pharmacy | null>(null);
  const [report, setReport] = useState<Pharmacy | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const searchSeq = useRef(0);
  const [cityCounts, setCityCounts] = useState<CityCount[] | null>(null);
  const [cityLoading, setCityLoading] = useState(false);
  const routeAbort = useRef<AbortController | null>(null);
  const resultsTop = useRef<HTMLDivElement>(null);

  const recents = useStoredList<RecentPlace>('dg.recents', 6);
  const installer = useInstall();
  const online = useOnline();
  const favorites = useStoredList<FavoritePharmacy>('dg.favoris', 30);

  useEffect(() => savePref('radius', radiusKm), [radiusKm]);
  useEffect(() => savePref('filter', dutyFilter), [dutyFilter]);
  useEffect(() => savePref('mode', mode), [mode]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 2800); return () => clearTimeout(t); }, [toast]);

  const refreshStatus = useCallback(async (force = false) => {
    try { setStatus(await loadStatus(force)); setStatusError(null); }
    catch (e) { setStatusError((e as Error).message); }
  }, []);
  useEffect(() => { void refreshStatus(); }, [refreshStatus]);

  // Synthèse par ville couverte (accueil)
  const loadCityCounts = useCallback(async (force = false) => {
    if (!isIsoDate(date)) return;
    setCityLoading(true);
    try {
      const { day, prev } = await loadSnapshots(date, force);
      const list = selectPharmacies(day?.records ?? [], prev?.records ?? [], date);
      setCityCounts(countByCity(list, CITIES.map((c) => c.id)));
    } catch {
      setCityCounts(null);
    } finally {
      setCityLoading(false);
    }
  }, [date]);
  useEffect(() => { void loadCityCounts(); }, [loadCityCounts]);
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === 'visible') { setNow(new Date()); void loadCityCounts(); } };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [loadCityCounts]);

  // ---------- Recherche
  const runSearch = useCallback(async (force = false) => {
    if (!origin) {
      setOriginError('Indiquez une ville, utilisez « Autour de moi » ou choisissez un point sur la carte.');
      setEditing(true);
      return;
    }
    if (!isIsoDate(date)) { setSearch({ state: 'error', error: 'Date invalide.' }); return; }
    if (!(radiusKm > 0 && radiusKm <= 100)) { setSearch({ state: 'error', error: 'Rayon invalide (entre 0,1 et 100 km).' }); return; }
    const seq = ++searchSeq.current;
    setOriginError(null);
    setSearch({ state: 'loading' });
    setRoutes({});
    setRouteStates({});
    routeAbort.current?.abort();
    try {
      const [{ day, prev }, st] = await Promise.all([loadSnapshots(date, force), loadStatus(force).catch(() => null)]);
      if (seq !== searchSeq.current) return;
      if (st) setStatus(st);
      if (force) void loadCityCounts(true);
      const today = moroccoDate();
      const clean = (recs: typeof day) => recs?.records ?? [];
      const outcome = buildResults({ dayRecords: clean(day), previousDayRecords: clean(prev), date, origin, radiusKm, dutyFilter });
      const fix = (l: Pharmacy[]) => l.map(usableCoords);
      const fixed: SearchOutcome = { ...outcome, ranked: fix(outcome.ranked), expired: fix(outcome.expired), unlocated: fix(outcome.unlocated) };
      const notices: string[] = [];
      const coverage = coverageAt(origin);
      if (coverage.status === 'covered') {
        if (!day && !prev) {
          if (date > today) notices.push(`Aucune garde publiée pour le ${formatFrDate(date)}. Les plannings sont en général disponibles jusqu’à la fin de la semaine suivante.`);
          else notices.push(`Aucune garde n’a été collectée pour le ${formatFrDate(date)} (historique conservé 60 jours).`);
        } else if (date > today) {
          notices.push('Date à venir : gardes issues du planning publié à l’avance, à revérifier le jour même.');
        }
        if (date === today && st) {
          const ageH = (Date.now() - new Date(st.generatedAt).getTime()) / 3.6e6;
          if (ageH > 6) notices.push(`Dernière collecte le ${formatMoroccoDateTime(st.generatedAt)} : les données peuvent ne pas être à jour.`);
          const failed = st.runs.filter((r) => !r.ok && !st.runs.some((o) => o.ok && o.city === r.city));
          if (failed.length) notices.push(`Source indisponible lors de la dernière collecte pour : ${[...new Set(failed.map((r) => CITY_NAME[r.city] ?? r.city))].join(', ')}.`);
          const stale = st.runs.filter((r) => r.ok && r.sourceId === 'annuaire-gratuit' && r.pageDate && r.pageDate < addDays(st.todayMorocco, -1));
          if (stale.length) notices.push(`La liste du jour de ${[...new Set(stale.map((r) => CITY_NAME[r.city]))].join(', ')} affichait une date ancienne.`);
        }
      }
      setSearch({ state: 'done', outcome: fixed, notice: notices.join(' ') || null, date, radiusKm, dutyFilter, originKey: originKey(origin), coverage });
      setSelectedId(fixed.ranked[0]?.id ?? null);
      setEditing(false);
      setTimeout(() => resultsTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    } catch (e) {
      if (seq !== searchSeq.current) return;
      setSearch({ state: 'error', error: (e as Error).message });
    }
  }, [origin, date, radiusKm, dutyFilter, loadCityCounts]);

  const runSearchRef = useRef(runSearch);
  runSearchRef.current = runSearch;
  useEffect(() => { if (searchNonce > 0) void runSearchRef.current(); }, [searchNonce]);
  // Lien partagé (?ville=…) : la recherche démarre à l'ouverture
  useEffect(() => { if (initial.origin && initial.space === 'pharmacies') requestSearch(); }, [initial, requestSearch]);
  useEffect(() => { writeUrl(space, search.state === 'idle' ? null : origin, dutyFilter); }, [space, origin, dutyFilter, search.state]);

  const criteriaChanged = search.state === 'done' && (search.date !== date || search.radiusKm !== radiusKm || search.dutyFilter !== dutyFilter || search.originKey !== originKey(origin));

  const goSearch = useCallback((o: Origin, radius: number) => {
    setOrigin(o);
    setRadiusKm(radius);
    setPicking(false);
    setTab('list');
    setSpace('pharmacies');
    requestSearch();
  }, [requestSearch]);

  const pickCity = useCallback((id: CityId) => {
    const c = CITIES.find((x) => x.id === id);
    if (c) goSearch({ lat: c.center.lat, lng: c.center.lng, label: c.name, kind: 'city', city: id }, 10);
  }, [goSearch]);

  const pickPlace = useCallback((r: RecentPlace) => {
    const cov = coverageAt({ lat: r.lat, lng: r.lon });
    const city = CITIES.find((c) => c.name === r.name);
    recents.add(r);
    if (city && cov.status === 'covered') pickCity(city.id);
    else goSearch({ lat: r.lat, lng: r.lon, label: r.name, kind: 'address' }, 10);
  }, [goSearch, pickCity, recents]);

  const pickLocality = useCallback((l: GeoLocality) => {
    pickPlace({ id: l.id, name: l.name, lat: l.lat, lon: l.lon });
    if (l.kind === 'district') setRadiusKm(3);
  }, [pickPlace]);

  // ---------- Position
  const locate = useCallback(async (andSearch = false): Promise<boolean> => {
    setLocating(true);
    setOriginError(null);
    setGeoHelp(null);
    try {
      const g = await getCurrentPosition();
      const o: Origin = { lat: g.lat, lng: g.lng, label: 'Ma position', kind: 'gps', accuracyM: g.accuracyM };
      if (andSearch) goSearch(o, pref('radius', 5));
      else { setOrigin(o); setPicking(false); }
      return true;
    } catch (e) {
      const err = e as GeoError;
      setGeoHelp({ message: err.message, help: err.help ?? [] });
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return false;
    } finally {
      setLocating(false);
    }
  }, [goSearch]);

  // ---------- Itinéraires
  const allResults: Pharmacy[] = useMemo(() => {
    if (search.state !== 'done') return [];
    return [...search.outcome.ranked, ...search.outcome.expired, ...search.outcome.unlocated];
  }, [search]);
  const duplicates = useMemo(() => findDuplicates(allResults), [allResults]);

  const computeRoute = useCallback(async (id: string, signal?: AbortSignal) => {
    const p = allResults.find((x) => x.id === id);
    if (!p || !origin || p.latitude === null || p.longitude === null) return;
    if (routes[id]) return;
    setRouteStates((s) => ({ ...s, [id]: { loading: true } }));
    try {
      const r = await getRoute(origin, { lat: p.latitude, lng: p.longitude }, mode, signal);
      setRoutes((m) => ({ ...m, [id]: r }));
      setRouteStates((s) => ({ ...s, [id]: {} }));
    } catch (e) {
      if ((e as Error).name === 'AbortError') { setRouteStates((s) => ({ ...s, [id]: {} })); return; }
      setRouteStates((s) => ({ ...s, [id]: { error: `${(e as Error).message} Utilisez Google Maps ou Waze depuis la fiche.` } }));
    }
  }, [allResults, origin, mode, routes]);

  useEffect(() => {
    if (!selectedId || !origin || search.state !== 'done') return;
    if (routes[selectedId] || routeStates[selectedId]?.loading || routeStates[selectedId]?.error) return;
    void computeRoute(selectedId);
  }, [selectedId, origin, search, routes, routeStates, computeRoute]);

  useEffect(() => { setRoutes({}); setRouteStates({}); }, [mode]);

  async function computeAll() {
    if (search.state !== 'done' || !origin) return;
    routeAbort.current?.abort();
    const ac = new AbortController();
    routeAbort.current = ac;
    setComputingAll(true);
    for (const p of search.outcome.ranked.slice(0, CONFIG.maxRoutesBatch)) {
      if (ac.signal.aborted) break;
      if (routes[p.id]) continue;
      await computeRoute(p.id, ac.signal);
      await new Promise((r) => setTimeout(r, 350)); // ménage le service public
    }
    setComputingAll(false);
  }

  const withRoutes = useCallback(
    (list: Pharmacy[]) => list.map((p) => (routes[p.id] ? { ...p, distanceRoadKm: routes[p.id].distanceKm, estimatedTravelMinutes: routes[p.id].durationMin } : p)),
    [routes],
  );

  const view = useMemo(() => {
    if (search.state !== 'done') return null;
    const ranked = withRoutes(search.outcome.ranked);
    return { list: sortBy === 'duration' ? sortByDuration(ranked) : ranked, ranked, expired: withRoutes(search.outcome.expired), unlocated: search.outcome.unlocated };
  }, [search, withRoutes, sortBy]);

  // Aucune garde ici pour la date : la ville la plus proche où la source en publie
  const alternative = useMemo(() => {
    if (search.state !== 'done' || !origin || !cityCounts || search.date !== date) return null;
    if (search.outcome.ranked.length || search.outcome.unlocated.length) return null;
    const list = cityCounts.filter((c) => c.active > 0).map((c) => {
      const city = CITIES.find((x) => x.id === c.city)!;
      return { id: c.city, name: city.name, count: c.active, km: Math.round(haversineKm(origin, city.center)) };
    }).filter((c) => c.km > 3).sort((a, b) => a.km - b.km);
    return list[0] ?? null;
  }, [search, origin, cityCounts, date]);

  const mapPharmacies = useMemo(() => (view ? [...view.ranked, ...view.expired] : []), [view]);
  const visibleRouteIds = useMemo(() => (showAllRoutes ? Object.keys(routes) : selectedId ? [selectedId] : []), [showAllRoutes, routes, selectedId]);

  const showOnMap = (id: string) => {
    setSelectedId(id);
    setFocus((f) => ({ id, n: f.n + 1 }));
    setSheet(null);
    if (!isDesktop) setTab('map');
  };
  const traceRoute = (id: string) => {
    setSelectedId(id);
    setRoutesShown(true);
    setRouteStates((s) => { const n = { ...s }; delete n[id]; return n; });
    if (!isDesktop) setTab('map');
  };
  const toggleFavorite = (p: Pharmacy) => {
    const was = favorites.has(p.id);
    favorites.toggle({ id: p.id, name: p.name, city: CITY_NAME[p.city] ?? p.city, phone: p.phone });
    setToast(was ? 'Retirée des favoris' : 'Ajoutée aux favoris (sur cet appareil)');
  };
  const share = async (p: Pharmacy) => {
    const r = await sharePharmacy(p);
    if (r === 'copied') setToast('Fiche copiée dans le presse-papiers');
    else if (r === 'failed') setToast('Partage indisponible sur cet appareil');
  };
  /** Remonte à la barre de recherche et y place le curseur, pour changer de ville sans revenir à l'accueil. */
  const changePlace = () => {
    setTab('list');
    resultsTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(() => { const el = document.getElementById('recherche-ville') as HTMLInputElement | null; el?.focus(); el?.select(); }, 350);
  };
  const goHome = () => {
    setSpace('pharmacies');
    setSearch({ state: 'idle' });
    setEditing(false);
    setSheet(null);
    window.scrollTo({ top: 0 });
  };
  const changeSpace = (s: Space) => { setSpace(s); window.scrollTo({ top: 0 }); };

  const placeLabel = origin?.kind === 'gps' ? 'Autour de ma position' : origin?.kind === 'map' ? 'Point choisi sur la carte' : origin?.label.split(',')[0] ?? '';
  const showResults = space === 'pharmacies' && search.state !== 'idle';

  return (
    <div className="flex min-h-full flex-col">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[2000] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:font-bold">Aller au contenu</a>
      <SiteHeader
        space={space}
        onSpace={changeSpace}
        onHome={goHome}
        onLocate={() => { if (space === 'pharmacies') void locate(true); else void locate(false).then((ok) => ok && setHealthSignal((n) => n + 1)); }}
        locating={locating}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      {!online && (
        <div role="status" className="border-b border-warn-600/30 bg-warn-50 px-4 py-2.5 text-sm font-semibold text-warn-600 lg:px-6">
          <p className="mx-auto max-w-7xl">Hors connexion : les dernières données enregistrées sur cet appareil sont affichées{status ? ` (collecte du ${formatMoroccoDateTime(status.generatedAt)})` : ''}. Itinéraires et carte indisponibles. Urgence : 141 ou 15.</p>
        </div>
      )}
      {geoHelp && (
        <div role="alert" className="border-b border-warn-600/30 bg-warn-50 px-4 py-3 text-sm text-warn-600 lg:px-6">
          <div className="mx-auto flex max-w-7xl items-start gap-2">
            <div className="flex-1">
              <p className="font-extrabold">{geoHelp.message}</p>
              {geoHelp.help.length > 0 && (
                <ul className="mt-1 list-disc space-y-1 pl-5 text-[13px] font-semibold text-ink">{geoHelp.help.map((h) => <li key={h}>{h}</li>)}</ul>
              )}
              <p className="mt-2 text-[13px] text-ink">Vous pouvez aussi saisir une ville ci-dessous.</p>
            </div>
            <button type="button" onClick={() => setGeoHelp(null)} className="rounded-lg px-2 font-bold" aria-label="Fermer">✕</button>
          </div>
        </div>
      )}

      <main id="contenu" className="flex-1">
        {space === 'sante' ? (
          <Suspense fallback={<Loading label="Chargement des cliniques et hôpitaux…" />}>
            <HealthSpace origin={origin} setOrigin={setOrigin} locating={locating} onLocate={() => locate(false)} mode={mode} searchSignal={healthSignal} />
          </Suspense>
        ) : !showResults ? (
          <Home
            now={now}
            date={date}
            status={status}
            counts={cityCounts}
            countsLoading={cityLoading}
            dutyFilter={dutyFilter}
            onDutyFilter={setDutyFilter}
            onPickLocality={pickLocality}
            onPickPlace={pickPlace}
            onPickCity={pickCity}
            onLocate={() => void locate(true)}
            locating={locating}
            recents={recents.items}
            favorites={favorites.items}
            onRemoveFavorite={favorites.remove}
            onOpenRegions={() => setRegionsOpen(true)}
          />
        ) : (
          <div ref={resultsTop} className="scroll-mt-28">
            {/* Barre de recherche compacte */}
            <div className="border-b border-line bg-white">
              <div className="flex flex-wrap items-center gap-3 px-4 py-3 lg:px-5">
                <div className="min-w-[16rem] flex-1">
                  <LocalitySearch size="md" inputId="recherche-ville" onPick={pickLocality} onLocate={() => void locate(true)} locating={locating} />
                </div>
                <p className="text-sm text-muted">
                  <b className="text-ink">{placeLabel}</b> · {formatFrDate(date)} · {radiusKm} km · {FILTER_LABEL[dutyFilter]}
                </p>
                <button type="button" onClick={() => setEditing((v) => !v)} aria-expanded={editing} className="rounded-full bg-brand-50 px-4 py-2 text-sm font-bold text-brand-800">
                  {editing ? 'Fermer les critères' : 'Date, rayon, type'}
                </button>
              </div>
              {editing && (
                <div className="mx-auto max-w-3xl">
                  <SearchPanel
                    origin={origin}
                    locating={locating}
                    onLocate={() => void locate(false)}
                    onAddressSearch={(q) => searchPlace(q)}
                    onChoosePlace={(p) => { setOrigin({ lat: p.lat, lng: p.lng, label: p.label, kind: 'address' }); setPicking(false); }}
                    picking={picking}
                    onTogglePick={() => { setPicking((v) => !v); setTab('map'); }}
                    date={date}
                    onDate={setDate}
                    radiusKm={radiusKm}
                    onRadius={setRadiusKm}
                    dutyFilter={dutyFilter}
                    onDutyFilter={setDutyFilter}
                    onSearch={requestSearch}
                    criteriaChanged={criteriaChanged}
                    searching={search.state === 'loading'}
                    originError={originError}
                    availableDates={status?.dates ?? []}
                    today={moroccoDate()}
                  />
                </div>
              )}
              {criteriaChanged && !editing && (
                <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 pb-3 lg:px-5">
                  <p className="text-[13px] font-semibold text-warn-600">Critères modifiés.</p>
                  <button type="button" onClick={requestSearch} className="rounded-full bg-brand-700 px-3 py-1.5 text-sm font-bold text-white">Mettre à jour</button>
                </div>
              )}
            </div>

            {/* Onglets Liste / Carte sur téléphone */}
            {!isDesktop && (
              <div className="sticky top-[calc(env(safe-area-inset-top,0px)+100px)] z-[1000] flex gap-1 border-b border-line bg-bg/95 px-4 py-2 backdrop-blur md:top-[calc(env(safe-area-inset-top,0px)+56px)]">
                <button type="button" onClick={changePlace} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-2 text-sm font-bold text-brand-800 ring-1 ring-line" aria-label="Changer de ville">
                  <PinIcon size={16} /> Ville
                </button>
                <div className="flex flex-1 gap-1" role="tablist" aria-label="Affichage des résultats">
                  {(['list', 'map'] as const).map((t) => (
                    <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                      className={`inline-flex flex-1 items-center justify-center gap-2 rounded-full py-2 text-sm font-bold ${tab === t ? 'bg-brand-700 text-white' : 'bg-white text-ink ring-1 ring-line'}`}>
                      {t === 'list' ? <ListIcon size={16} /> : <MapIcon size={16} />}{t === 'list' ? 'Liste' : 'Carte'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="lg:grid lg:grid-cols-[minmax(0,480px)_1fr]">
              {(isDesktop || tab === 'list') && (
                <div className="min-w-0">
                  {search.state === 'done' && !installer.dismissed && (installer.canInstall || installer.ios) && (
                    <div className="mx-4 mt-4 flex items-center gap-3 rounded-2xl bg-brand-50 p-3 text-sm lg:mx-5">
                      <p className="min-w-0 flex-1 text-brand-900">
                        <b>Installer DabaGarde</b> pour l’ouvrir en un geste, même avec une connexion faible.
                        {installer.ios && !installer.canInstall ? ' Sur iPhone : bouton Partager, puis « Sur l’écran d’accueil ».' : ''}
                      </p>
                      {installer.canInstall && <button type="button" onClick={() => void installer.install()} className="shrink-0 rounded-full bg-brand-700 px-3 py-1.5 font-bold text-white">Installer</button>}
                      <button type="button" onClick={installer.dismiss} className="shrink-0 rounded-full px-2 py-1 font-bold text-muted" aria-label="Masquer la proposition d’installation">✕</button>
                    </div>
                  )}
                  {search.state === 'done' && <div className="px-4 pt-4 lg:px-5"><CoverageNotice placeName={placeLabel} coverage={search.coverage} onGoCovered={() => search.coverage.cityId && pickCity(search.coverage.cityId)} /></div>}
                  {search.state === 'done' && search.coverage.status === 'none' ? null : renderResults()}
                </div>
              )}
              {(isDesktop || tab === 'map') && (
                <div className="lg:sticky lg:top-[calc(env(safe-area-inset-top,0px)+57px)] lg:h-[calc(100dvh-57px)] lg:self-start">
                  <div className="relative h-[calc(100dvh-170px)] min-h-[320px] lg:h-[calc(100%-44px)]">
                    <Suspense fallback={<Loading label="Chargement de la carte…" />}>
                    <PharmacyMap
                      origin={origin}
                      radiusKm={radiusKm}
                      pharmacies={mapPharmacies}
                      selectedId={selectedId}
                      routes={routes}
                      visibleRouteIds={visibleRouteIds}
                      mode={mode}
                      picking={picking}
                      onPick={(lat, lng) => { setOrigin({ lat, lng, label: 'Point choisi sur la carte', kind: 'map' }); setPicking(false); }}
                      onSelect={setSelectedId}
                      focusSignal={focus}
                      routesShown={routesShown}
                      onToggleRoutes={() => setRoutesShown((v) => !v)}
                      canShowRoutes={Object.keys(routes).length > 0}
                    />
                    </Suspense>
                  </div>
                  <div className="bg-white px-4 py-2"><MapLegend count={view?.ranked.length ?? 5} /></div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {!(showResults && !isDesktop && tab === 'map') && <SiteFooter />}

      <SourceStatus open={settingsOpen} onClose={() => setSettingsOpen(false)} status={status} statusError={statusError} mode={mode} onMode={setMode} />
      <RegionBrowser open={regionsOpen} onClose={() => setRegionsOpen(false)} onPick={pickLocality} />
      <PharmacySheet
        p={sheet}
        now={now}
        flags={sheet ? qualityFlags(sheet, duplicates) : []}
        favorite={sheet ? favorites.has(sheet.id) : false}
        onClose={() => setSheet(null)}
        onShowOnMap={() => sheet && showOnMap(sheet.id)}
        onShare={() => sheet && void share(sheet)}
        onReport={() => { setReport(sheet); setSheet(null); }}
        onToggleFavorite={() => sheet && toggleFavorite(sheet)}
      />
      <ReportDialog p={report} date={date} onClose={() => setReport(null)} />
      {toast && (
        <div role="status" className="fixed inset-x-0 bottom-[max(env(safe-area-inset-bottom),16px)] z-[1500] mx-auto w-fit max-w-[90vw] rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-white shadow-lg">{toast}</div>
      )}
    </div>
  );

  function renderResults() {
    if (search.state === 'loading') return <ResultsSkeleton label="Recherche des gardes publiées…" />;
    if (search.state === 'error') {
      return (
        <div role="alert" className="m-4 rounded-xl bg-danger-50 p-3 text-sm font-semibold text-danger-600">
          {search.error}{' '}
          <button type="button" className="underline" onClick={() => void runSearch()}>Réessayer</button>
        </div>
      );
    }
    if (!view || search.state !== 'done') return null;
    return (
      <PharmacyList
        now={now}
        date={search.date}
        radiusKm={search.radiusKm}
        placeLabel={placeLabel}
        list={view.list}
        expired={view.expired}
        unlocated={view.unlocated}
        outside={search.outcome.outside}
        filteredOutByType={search.outcome.filteredOutByType}
        dataNotice={search.notice}
        sortBy={sortBy}
        onSort={(s) => { setSortBy(s); if (s === 'duration') void computeAll(); }}
        selectedId={selectedId}
        origin={origin}
        mode={mode}
        routeStates={routeStates}
        isFavorite={favorites.has}
        onToggleFavorite={toggleFavorite}
        onSelect={setSelectedId}
        onRoute={traceRoute}
        onDetails={setSheet}
        onShare={(p) => void share(p)}
        onComputeAll={() => void computeAll()}
        computingAll={computingAll}
        showAllRoutes={showAllRoutes}
        onShowAllRoutes={setShowAllRoutes}
        onRefresh={() => void runSearch(true)}
        onChangePlace={changePlace}
        alternative={alternative}
        onGoAlternative={(id) => pickCity(id)}
        onEnlarge={() => { setRadiusKm((r) => Math.min(100, r < 5 ? 5 : r < 10 ? 10 : r < 20 ? 20 : r < 30 ? 30 : r * 2)); requestSearch(); }}
      />
    );
  }
}
