// Pages statiques générées après `vite build`, à chaque déploiement (toutes les ~2 h) :
//   - une page par ville couverte, avec la liste de garde du jour en HTML (lisible sans JavaScript) ;
//   - l'annuaire des villes (régions → provinces → villes), les cliniques et hôpitaux couverts ;
//   - les pages d'information (urgences, méthode, FAQ, contact, confidentialité, mentions légales) ;
//   - 404.html, robots.txt, sitemap.xml, et les URL absolues de index.html.
// Aucune page n'est créée pour une ville sans source : pas de pages vides générées pour le référencement.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { selectPharmacies } from '../src/shared/search.ts';
import { addDays, formatFrDate, formatMoroccoDateTime, moroccoDate } from '../src/shared/dates.ts';
import { CITIES, CONNECTORS } from '../src/shared/connectors/registry.ts';
import { DUTY_TYPE_LABEL } from '../src/shared/duty.ts';
import { formatPhone } from '../src/shared/text.ts';
import { fillVars, temporalStatus } from '../src/shared/temporal.ts';
import { coverageAt } from '../src/shared/coverage.ts';
import { slugify } from '../src/shared/geo/slug.ts';
import { usableCoords } from '../src/shared/quality.ts';
import { TYPE_LABEL } from '../src/shared/health/labels.ts';
import type { CollectorStatus, DutySnapshot, Pharmacy } from '../src/shared/types.ts';
import type { GeoLocality, GeoRegion } from '../src/shared/geo/types.ts';
import type { HealthDataset } from '../src/shared/health/types.ts';

const DIST = 'dist';
const DATA = 'public/data';
const BASE = (process.env.BASE_PATH || '/').replace(/\/?$/, '/');
const SITE = (process.env.SITE_URL || 'http://localhost:4173/dabagarde').replace(/\/$/, '');
const NOW = new Date();
const TODAY = moroccoDate(NOW);

const readJson = <T,>(p: string): T | null => (existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as T) : null);
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const href = (path: string) => BASE + path;
const abs = (path: string) => `${SITE}/${path}`;

// ---------- Gabarit commun
const CSS = `
:root{--g9:#053b27;--g8:#08503a;--g7:#0a6b47;--g5:#17a06b;--g2:#bfe6d2;--g1:#dcf2e7;--g0:#eef9f3;--bg:#f4f7f5;--line:#dce5e0;--ink:#0f1f18;--muted:#52645b;--warn:#a54c06;--warnbg:#fff4e5;--red:#b42318;--night:#33408f;--nightbg:#eceefa;--h24:#0e6f68;--h24bg:#e3f4f2}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;font:16px/1.55 "Plus Jakarta Sans",system-ui,-apple-system,"Segoe UI",sans-serif;color:var(--ink);background:var(--bg)}
a{color:var(--g7)}a:hover{color:var(--g8)}
.wrap{max-width:60rem;margin:0 auto;padding:0 max(16px,env(safe-area-inset-left))}
header.top{background:var(--g8);color:#fff}header.top .wrap{display:flex;align-items:center;gap:12px;padding-block:12px;flex-wrap:wrap}
.brand{display:inline-flex;align-items:center;gap:8px;color:#fff;text-decoration:none;font-weight:800;font-size:20px;letter-spacing:-.02em}.brand b{color:var(--g2)}
nav.top{margin-left:auto;display:flex;gap:4px;flex-wrap:wrap}nav.top a{color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:6px 10px;border-radius:999px}nav.top a:hover{background:rgba(255,255,255,.12)}
.hero{background:var(--g8);color:#fff;padding:20px 0 28px}.hero h1{font-size:clamp(28px,5vw,40px);line-height:1.1;margin:0;letter-spacing:-.02em}.hero p{color:rgba(255,255,255,.85);margin:.5rem 0 0}
.cta{display:inline-flex;align-items:center;gap:8px;background:#fff;color:var(--g8);font-weight:800;text-decoration:none;padding:12px 18px;border-radius:14px;margin-top:16px}
.cta.alt{background:var(--g7);color:#fff}
main{padding:24px 0 48px}h2{font-size:22px;letter-spacing:-.01em;margin:32px 0 8px}h3{font-size:17px;margin:0}
.muted{color:var(--muted)}.small{font-size:13px}
.note{background:var(--warnbg);color:var(--warn);border-radius:12px;padding:12px 14px;font-weight:600;font-size:14px}
.urg{background:#fdecea;color:var(--red);border-radius:12px;padding:12px 14px;font-weight:700;font-size:14px}
ul.cards{list-style:none;padding:0;margin:16px 0 0;display:grid;gap:12px}
.card{background:#fff;border:1px solid var(--line);border-radius:16px;padding:16px}
.pills{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.pill{font-size:12px;font-weight:700;border-radius:999px;padding:3px 10px;background:var(--g0);color:var(--g8)}
.pill.night{background:var(--nightbg);color:var(--night)}.pill.h24{background:var(--h24bg);color:var(--h24)}.pill.day{background:var(--warnbg);color:var(--warn)}.pill.grey{background:var(--bg);color:var(--muted)}
.actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}.actions a{font-weight:700;font-size:14px;text-decoration:none;border-radius:10px;padding:8px 12px;background:var(--g0);color:var(--g8)}.actions a.call{background:var(--g7);color:#fff}
.grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fill,minmax(15rem,1fr))}
details{background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px 14px;margin-top:8px}summary{cursor:pointer;font-weight:700}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}.chips a,.chips span{font-size:14px;font-weight:600;text-decoration:none;border-radius:999px;padding:5px 11px;background:#fff;border:1px solid var(--line);color:var(--ink)}.chips a.on{border-color:var(--g5);color:var(--g8)}
table{border-collapse:collapse;width:100%;background:#fff;border-radius:12px;overflow:hidden}td,th{padding:10px 12px;border-bottom:1px solid var(--line);text-align:left;font-size:15px}th{font-size:13px;color:var(--muted)}
footer.bottom{border-top:1px solid var(--line);background:#fff;padding:24px 0;font-size:14px}footer.bottom .cols{display:flex;flex-wrap:wrap;gap:8px 18px}footer.bottom a{color:var(--ink);font-weight:600}
:focus-visible{outline:3px solid var(--g5);outline-offset:2px}
`;

const MARK = `<svg width="28" height="28" viewBox="0 0 512 512" aria-hidden="true"><rect width="512" height="512" rx="120" fill="#17a06b"/><path d="M256 84c-78 0-140 61-140 137 0 101 140 207 140 207s140-106 140-207c0-76-62-137-140-137z" fill="#fff"/><path d="M233 152h46v47h47v46h-47v47h-46v-47h-47v-46h47z" fill="#0a6b47"/></svg>`;

interface PageOpts { path: string; title: string; description: string; h1: string; lead?: string; body: string; jsonLd?: object[]; noindex?: boolean; cta?: { href: string; label: string } }

const pages: { path: string; lastmod: string; priority: string }[] = [];

function page(o: PageOpts): string {
  const canonical = abs(o.path);
  const ld = (o.jsonLd ?? []).map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('');
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>${esc(o.title)}</title><meta name="description" content="${esc(o.description)}">
${o.noindex ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${canonical}">`}
<meta property="og:type" content="website"><meta property="og:site_name" content="DabaGarde"><meta property="og:locale" content="fr_MA">
<meta property="og:title" content="${esc(o.title)}"><meta property="og:description" content="${esc(o.description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${SITE}/og-image.png">
<meta name="twitter:card" content="summary_large_image"><meta name="theme-color" content="#08503a">
<link rel="icon" type="image/svg+xml" href="${href('icons/favicon.svg')}"><style>${CSS}</style>${ld}</head>
<body>
<header class="top"><div class="wrap"><a class="brand" href="${BASE}">${MARK}<span>Daba<b>Garde</b></span></a>
<nav class="top" aria-label="Navigation"><a href="${BASE}">Rechercher</a><a href="${href('villes/')}">Villes</a><a href="${href('cliniques-hopitaux/rabat-sale-temara/')}">Cliniques et hôpitaux</a><a href="${href('urgences/')}">Urgences</a></nav></div></header>
<section class="hero"><div class="wrap"><h1>${o.h1}</h1>${o.lead ? `<p>${o.lead}</p>` : ''}${o.cta ? `<a class="cta" href="${o.cta.href}">${esc(o.cta.label)} →</a>` : ''}</div></section>
<main><div class="wrap">${o.body}</div></main>
<footer class="bottom"><div class="wrap"><p class="urg">Urgence vitale : 141 (SAMU) · 15 (Protection civile)</p>
<div class="cols"><a href="${href('pharmacie-de-garde/rabat/')}">Rabat</a><a href="${href('pharmacie-de-garde/sale/')}">Salé</a><a href="${href('pharmacie-de-garde/temara/')}">Témara</a><a href="${href('villes/')}">Toutes les villes</a><a href="${href('comment-ca-marche/')}">Sources et méthode</a><a href="${href('faq/')}">Questions fréquentes</a><a href="${href('contact/')}">Contact et signalement</a><a href="${href('confidentialite/')}">Confidentialité</a><a href="${href('mentions-legales/')}">Mentions légales</a></div>
<p class="muted small">Données cartographiques © les contributeurs d’OpenStreetMap (ODbL). Informations de garde récupérées sur des listes publiques : appelez avant de vous déplacer.</p></div></footer>
</body></html>
`;
}

function write(o: PageOpts, priority = '0.6', lastmod = TODAY) {
  const file = join(DIST, o.path, 'index.html');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, page(o));
  if (!o.noindex) pages.push({ path: o.path, lastmod, priority });
}

const breadcrumb = (items: { name: string; path: string }[]) => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: abs(it.path) })),
});

// ---------- Données
const status = readJson<CollectorStatus>(join(DATA, 'status.json'));
const day = readJson<DutySnapshot>(join(DATA, 'duty', `${TODAY}.json`));
const prev = readJson<DutySnapshot>(join(DATA, 'duty', `${addDays(TODAY, -1)}.json`));
const regions = readJson<{ regions: GeoRegion[] }>(join(DATA, 'geo', 'regions.json'))?.regions ?? [];
const localities = readJson<{ localities: GeoLocality[] }>(join(DATA, 'geo', 'localities.json'))?.localities ?? [];
const health = readJson<HealthDataset>(join(DATA, 'sante', 'etablissements.json'));
const lastUpdate = status ? formatMoroccoDateTime(status.generatedAt) : null;
const staleH = status ? (NOW.getTime() - new Date(status.generatedAt).getTime()) / 3.6e6 : Infinity;
const all = selectPharmacies(day?.records ?? [], prev?.records ?? [], TODAY, NOW).filter((p) => p.verificationStatus !== 'expired').map(usableCoords);
const sourceNames = CONNECTORS.filter((c) => c.enabled && c.homepage).map((c) => c.name);

// ---------- Pages de ville
const TYPE_CLASS = { day: 'day', night: 'night', continuous: 'h24' } as const;

function pharmacyCard(p: Pharmacy): string {
  const t = temporalStatus(p, NOW);
  const maps = p.latitude !== null && p.longitude !== null ? `https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}` : null;
  const src = p.sources[0];
  return `<li class="card"><h3>${esc(p.name)}</h3>
<p class="muted small" style="margin:2px 0 0">${esc([p.district, p.address].filter(Boolean).join(' · ') || 'Adresse non communiquée par la source')}</p>
<div class="pills"><span class="pill">${esc(fillVars(t.label, t.vars))}</span>${p.dutyType ? `<span class="pill ${TYPE_CLASS[p.dutyType]}">${DUTY_TYPE_LABEL[p.dutyType]}</span>` : ''}${p.hoursText ? `<span class="pill grey">${esc(p.hoursText)}</span>` : ''}${p.verificationStatus !== 'confirmed' ? '<span class="pill day">À confirmer</span>' : ''}</div>
<div class="actions">${p.phone ? `<a class="call" href="tel:${p.phone}">Appeler ${formatPhone(p.phone)}</a>` : '<span class="muted small">Téléphone non publié</span>'}${maps ? `<a href="${maps}" rel="nofollow noopener" target="_blank">Itinéraire</a>` : ''}</div>
<p class="muted small" style="margin:10px 0 0">Source : ${src ? (src.sourceUrl ? `<a href="${esc(src.sourceUrl)}" rel="nofollow noopener" target="_blank">${esc(src.sourceName)}</a>` : esc(src.sourceName)) : '—'}${p.lastCheckedAt ? ` · récupérée le ${formatMoroccoDateTime(p.lastCheckedAt)}` : ''}</p></li>`;
}

for (const c of CITIES) {
  const list = all.filter((p) => p.city === c.id).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  const path = `pharmacie-de-garde/${c.id}/`;
  const others = CITIES.filter((o) => o.id !== c.id);
  const night = list.filter((p) => p.dutyType === 'night').length, h24 = list.filter((p) => p.dutyType === 'continuous').length;
  const summary = list.length ? `${list.length} pharmacie${list.length > 1 ? 's' : ''} de garde publiée${list.length > 1 ? 's' : ''}${night ? `, dont ${night} de nuit` : ''}${h24 ? `, ${h24} en 24 h/24` : ''}.` : 'Aucune garde publiée pour le moment.';
  const body = `
${staleH > 24 ? `<p class="note">Attention : la dernière collecte date du ${lastUpdate ?? 'jour précédent'}. Cette liste peut ne plus être à jour.</p>` : ''}
<p><b>${esc(summary)}</b> <span class="muted">Liste du ${formatFrDate(TODAY)}${lastUpdate ? `, mise à jour le ${lastUpdate} (heure du Maroc)` : ''}. Actualisée environ toutes les 2 heures.</span></p>
${list.length ? `<ul class="cards">${list.map(pharmacyCard).join('')}</ul>` : `<p class="note">Aucune pharmacie de garde n’est publiée par nos sources pour ${c.name} à cette heure. Réessayez plus tard ou appelez le 141 en cas d’urgence.</p>`}
<h2>Comment fonctionne la garde à ${c.name} ?</h2>
<p>Les pharmacies assurent la garde à tour de rôle, selon un tableau établi localement : garde de jour, de nuit ou 24 h/24. Les horaires exacts varient selon les pharmacies et ne sont pas toujours publiés. DabaGarde affiche ce que publient les sources datées (${esc(sourceNames.join(', '))}) et signale ce qui n’est pas confirmé.</p>
<p>Pour la pharmacie la plus proche de vous, avec la distance et l’itinéraire, ouvrez la <a href="${BASE}?ville=${c.id}">recherche autour de moi</a>.</p>
<h2>Questions fréquentes</h2>
<details><summary>La pharmacie est-elle vraiment ouverte ?</summary><p>Nous indiquons ce que la source annonce pour la date et l’heure. Nous ne pouvons pas le garantir : appelez avant de vous déplacer, surtout la nuit.</p></details>
<details><summary>Et le week-end ou un jour férié ?</summary><p>Le tableau de garde couvre aussi les week-ends et jours fériés. Choisissez la date dans la recherche : les plannings sont souvent publiés quelques jours à l’avance.</p></details>
<details><summary>Une information est fausse ?</summary><p>Signalez-la depuis la fiche de la pharmacie dans l’application ou via la <a href="${href('contact/')}">page Contact</a>. Chaque signalement est examiné avant correction.</p></details>
<h2>Autres villes</h2>
<div class="chips">${others.map((o) => `<a href="${href(`pharmacie-de-garde/${o.id}/`)}">Pharmacie de garde ${o.name}</a>`).join('')}<a href="${href('villes/')}">Toutes les villes</a></div>`;
  const items = list.map((p) => ({
    '@type': 'Pharmacy', name: p.name, telephone: p.phone ?? undefined,
    address: { '@type': 'PostalAddress', streetAddress: p.address ?? undefined, addressLocality: c.name, addressCountry: 'MA' },
    geo: p.latitude !== null && p.coordinatesSource !== 'district' ? { '@type': 'GeoCoordinates', latitude: p.latitude, longitude: p.longitude } : undefined,
  }));
  write({
    path,
    title: `Pharmacie de garde ${c.name} aujourd’hui – DabaGarde`,
    description: `Pharmacies de garde à ${c.name} le ${formatFrDate(TODAY)} : liste datée et sourcée, téléphone et itinéraire. ${summary}`,
    h1: `Pharmacie de garde à ${c.name}`,
    lead: `Aujourd’hui, ${formatFrDate(TODAY)}. Appelez avant de vous déplacer.`,
    cta: { href: `${BASE}?ville=${c.id}`, label: 'Trouver la plus proche de moi' },
    body,
    jsonLd: [breadcrumb([{ name: 'Accueil', path: '' }, { name: 'Villes', path: 'villes/' }, { name: c.name, path }]),
      { '@context': 'https://schema.org', '@type': 'ItemList', name: `Pharmacies de garde à ${c.name} le ${formatFrDate(TODAY)}`, itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, item: it })) }],
  }, '0.9');
}

// ---------- Annuaire des villes
{
  const coveredLinks = CITIES.map((c) => `<a class="on" href="${href(`pharmacie-de-garde/${c.id}/`)}">${c.name}</a>`).join('');
  let body = `<p>DabaGarde est conçu pour tout le Maroc. Une ville n’affiche des gardes que lorsqu’une source datée et réutilisable existe ; pour les autres, la recherche vous oriente vers l’information d’origine et les numéros d’urgence.</p>
<h2>Villes couvertes</h2><div class="chips">${coveredLinks}</div>
<h2>Par région</h2>`;
  if (regions.length && localities.length) {
    for (const r of regions) {
      body += `<details><summary>${esc(r.name)} <span class="muted small">(${r.provinces.length} provinces et préfectures)</span></summary>`;
      for (const p of r.provinces) {
        const towns = localities.filter((l) => l.provinceId === p.id && (l.kind === 'city' || l.kind === 'town')).slice(0, 15);
        if (!towns.length) continue;
        body += `<p style="margin:12px 0 4px"><b>${esc(p.name)}</b></p><div class="chips">${towns.map((l) => {
          const cov = coverageAt({ lat: l.lat, lng: l.lon });
          const city = CITIES.find((c) => slugify(c.name) === slugify(l.name));
          if (cov.status === 'covered' && city) return `<a class="on" href="${href(`pharmacie-de-garde/${city.id}/`)}">${esc(l.name)}</a>`;
          return `<a rel="nofollow" href="${BASE}?lieu=${encodeURIComponent(l.name)}&amp;lat=${l.lat.toFixed(4)}&amp;lng=${l.lon.toFixed(4)}">${esc(l.name)}</a>`;
        }).join('')}</div>`;
      }
      body += `</details>`;
    }
  } else {
    body += `<p class="muted">La liste détaillée des régions et provinces est en cours de publication.</p>`;
  }
  write({ path: 'villes/', title: 'Pharmacies de garde par ville au Maroc – DabaGarde', description: 'Villes du Maroc par région et province : villes couvertes par des listes de garde datées et accès à la recherche pour les autres.', h1: 'Pharmacies de garde par ville', lead: 'Régions, provinces et villes du Maroc.', body, jsonLd: [breadcrumb([{ name: 'Accueil', path: '' }, { name: 'Villes', path: 'villes/' }])] }, '0.7');
}

// ---------- Cliniques et hôpitaux
if (health) {
  const byCity = (id: string) => health.establishments.filter((e) => e.city === id).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  let body = `<p class="note">« Urgences déclarées » signifie qu’une source mentionne un service d’urgences : cela ne garantit ni son ouverture ni une garde. Appelez avant de vous déplacer. Urgence vitale : 141 ou 15.</p>`;
  for (const c of CITIES) {
    const list = byCity(c.id);
    if (!list.length) continue;
    body += `<h2>${c.name}</h2><ul class="cards">${list.map((e) => `<li class="card"><h3>${esc(e.name)}</h3><p class="muted small" style="margin:2px 0 0">${esc(e.address ?? 'Adresse non publiée')}</p>
<div class="pills"><span class="pill">${TYPE_LABEL[e.type]}</span>${e.emergency === 'yes' ? '<span class="pill day">Urgences déclarées</span>' : ''}</div>
<div class="actions">${e.phone ? `<a class="call" href="tel:${e.phone}">Appeler ${formatPhone(e.phone)}</a>` : '<span class="muted small">Téléphone non publié</span>'}</div>
<p class="muted small" style="margin:10px 0 0">Sources : ${e.sources.map((s) => esc(s.name)).join(', ')}</p></li>`).join('')}</ul>`;
  }
  // Hôpitaux publics de tout le Maroc (liste officielle), par région et délégation
  const ministryFile = readJson<{ hopitaux: { nom: string; categorieLibelle: string | null; region?: string; delegation: string; commune: string }[] }>(join('data-sources', 'sante', 'ministere-hopitaux-2022.json'));
  if (ministryFile?.hopitaux?.length) {
    const byRegion = new Map<string, typeof ministryFile.hopitaux>();
    for (const h of ministryFile.hopitaux) byRegion.set(h.region ?? '—', [...(byRegion.get(h.region ?? '—') ?? []), h]);
    body += `<h2>Hôpitaux publics de tout le Maroc</h2><p class="muted small">Liste officielle du ministère de la Santé (data.gov.ma, ODbL) : ${ministryFile.hopitaux.length} hôpitaux. La position d’un hôpital n’est affichée dans l’application que lorsqu’elle a pu être rattachée à OpenStreetMap ; sinon il est proposé, sans position, pour une recherche autour de sa commune.</p>`;
    for (const [region, list] of [...byRegion].sort((x, y) => x[0].localeCompare(y[0], 'fr'))) {
      body += `<h3>${esc(region)}</h3><ul>${list.map((h) => `<li>${esc(h.nom)} — ${esc(h.categorieLibelle ?? '')} · ${esc(h.commune.replace(/\s*\((Arrond|Mun)\.\)/, ''))} (${esc(h.delegation)})</li>`).join('')}</ul>`;
    }
  }
  write({ path: 'cliniques-hopitaux/rabat-sale-temara/', title: 'Cliniques et hôpitaux au Maroc – DabaGarde', description: 'Hôpitaux publics de tout le Maroc (liste du ministère de la Santé) et cliniques recensées dans les villes suivies, avec services d’urgences déclarés et téléphones publiés.', h1: 'Cliniques et hôpitaux', lead: 'Par ville, et la liste officielle des hôpitaux publics de tout le Maroc.', cta: { href: `${BASE}?espace=sante`, label: 'Chercher autour de moi' }, body, jsonLd: [breadcrumb([{ name: 'Accueil', path: '' }, { name: 'Cliniques et hôpitaux', path: 'cliniques-hopitaux/rabat-sale-temara/' }])] }, '0.7');
}

// ---------- Pages d'information
write({ path: 'urgences/', title: 'Numéros d’urgence au Maroc – DabaGarde', description: 'Numéros d’urgence au Maroc : SAMU 141, Protection civile 15, Police 19, Gendarmerie royale 177, Centre antipoison.', h1: 'Numéros d’urgence au Maroc', lead: 'Appel gratuit depuis un téléphone au Maroc.', body: `
<table><thead><tr><th>Service</th><th>Numéro</th></tr></thead><tbody>
<tr><td>SAMU (urgence médicale)</td><td><a href="tel:141"><b>141</b></a></td></tr>
<tr><td>Protection civile (pompiers, ambulances)</td><td><a href="tel:15"><b>15</b></a></td></tr>
<tr><td>Police</td><td><a href="tel:19"><b>19</b></a></td></tr>
<tr><td>Gendarmerie royale (hors agglomérations)</td><td><a href="tel:177"><b>177</b></a></td></tr>
<tr><td>Centre antipoison et de pharmacovigilance (numéro vert)</td><td><a href="tel:0801000180"><b>0801 000 180</b></a></td></tr>
</tbody></table>
<p class="muted small">Numéros relevés le 22/10/2026 auprès de sources publiques. En cas de doute, le 15 et le 141 orientent vers le bon service.</p>
<h2>Trouver une pharmacie de garde</h2><p><a href="${BASE}">Recherche autour de moi</a> · <a href="${href('villes/')}">par ville</a>.</p>` }, '0.6');

write({ path: 'comment-ca-marche/', title: 'Sources et méthode – DabaGarde', description: 'Comment DabaGarde collecte, date et contrôle les listes de pharmacies de garde, et ce qu’il ne peut pas garantir.', h1: 'Sources et méthode', lead: 'Ce que nous affichons, d’où cela vient, et ce que nous ne pouvons pas garantir.', body: `
<h2>D’où viennent les gardes ?</h2>
<p>De listes de garde publiques et datées (${esc(sourceNames.join(', '))}), relues automatiquement environ toutes les 2 heures, et de tableaux officiels saisis à la main lorsqu’ils sont disponibles. Nous n’utilisons pas les sites qui interdisent la réutilisation de leurs données.</p>
<h2>Ce que signifie chaque statut</h2>
<ul><li><b>Confirmée</b> : une source publie cette garde pour la date, de façon datée.</li><li><b>À confirmer</b> : présente chez une source, sans date vérifiable.</li><li><b>Sources contradictoires</b> : deux sources ne disent pas la même chose ; nous affichons le désaccord.</li><li><b>Garde terminée</b> : la période publiée est passée.</li></ul>
<p>« Dans sa période de garde » signifie que l’heure actuelle tombe dans les horaires publiés. Cela ne garantit pas que la pharmacie est ouverte.</p>
<h2>Contrôles automatiques</h2>
<ul><li>Dates et périodes de garde : les gardes expirées ne sont pas présentées comme actuelles.</li><li>Téléphones au format marocain ; positions hors du Maroc ignorées ; positions approximatives (centre du quartier) signalées.</li><li>Doublons probables (même numéro, ou même nom à moins de 300 m) signalés.</li></ul>
<h2>Couverture</h2><p>Aujourd’hui : ${CITIES.map((c) => c.name).join(', ')}. La base géographique couvre tout le Maroc (OpenStreetMap) ; une ville est ajoutée dès qu’une source fiable et réutilisable existe.</p>
<h2>Limites</h2><p>Les informations sont récupérées automatiquement : elles ne sont pas vérifiées sur le terrain. Appelez toujours avant de vous déplacer.</p>` }, '0.5');

write({ path: 'faq/', title: 'Questions fréquentes – DabaGarde', description: 'Pharmacies de garde au Maroc : fiabilité, horaires, couverture, confidentialité.', h1: 'Questions fréquentes', body: `
<details open><summary>Qu’est-ce qu’une pharmacie de garde ?</summary><p>Une pharmacie qui reste disponible en dehors des horaires habituels (nuit, week-end, jours fériés), à tour de rôle selon un tableau établi localement.</p></details>
<details><summary>La pharmacie affichée est-elle ouverte ?</summary><p>Nous affichons ce que publient les sources pour la date et, quand ils existent, les horaires. Nous ne pouvons pas le garantir : appelez avant de vous déplacer.</p></details>
<details><summary>Pourquoi ma ville n’apparaît-elle pas ?</summary><p>Nous n’affichons une ville que lorsqu’une source fiable et réutilisable existe. Sinon, la recherche vous oriente vers l’information d’origine.</p></details>
<details><summary>Ma position est-elle enregistrée ?</summary><p>Non. Elle est utilisée sur votre appareil pour trier par distance ; elle est transmise aux services d’itinéraire uniquement au moment du calcul.</p></details>
<details><summary>Comment signaler une erreur ?</summary><p>Depuis la fiche de la pharmacie (« Signaler »), ou via la <a href="${href('contact/')}">page Contact</a>.</p></details>
<details><summary>L’application est-elle gratuite ?</summary><p>Oui, sans inscription.</p></details>`, jsonLd: [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: [
  ['Qu’est-ce qu’une pharmacie de garde ?', 'Une pharmacie qui reste disponible en dehors des horaires habituels (nuit, week-end, jours fériés), à tour de rôle selon un tableau établi localement.'],
  ['La pharmacie affichée est-elle ouverte ?', 'Nous affichons ce que publient les sources pour la date et, quand ils existent, les horaires. Nous ne pouvons pas le garantir : appelez avant de vous déplacer.'],
  ['Pourquoi ma ville n’apparaît-elle pas ?', 'Nous n’affichons une ville que lorsqu’une source fiable et réutilisable existe.'],
].map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) }] }, '0.5');

write({ path: 'contact/', title: 'Contact et signalement – DabaGarde', description: 'Signaler une erreur sur une pharmacie de garde ou proposer une source officielle.', h1: 'Contact et signalement', body: `
<h2>Signaler une information incorrecte</h2>
<p>Numéro erroné, adresse incorrecte, pharmacie fermée, horaires inexacts : utilisez le bouton « Signaler » de la fiche dans l’application, ou ouvrez directement un <a href="https://github.com/milyasse/dabagarde/issues/new?template=signalement.yml" rel="noopener">signalement</a> (compte GitHub gratuit). Chaque signalement est examiné avant toute modification des données.</p>
<h2>Vous êtes une pharmacie, un Ordre ou une autorité sanitaire ?</h2>
<p>Nous intégrons volontiers des tableaux de garde officiels, avec leur source et leur date. Écrivez-nous via un <a href="https://github.com/milyasse/dabagarde/issues/new" rel="noopener">ticket</a>.</p>
<p class="note">N’indiquez jamais de données de santé personnelles dans un signalement.</p>` }, '0.3');

write({ path: 'confidentialite/', title: 'Confidentialité – DabaGarde', description: 'Données traitées par DabaGarde : aucune inscription, position non conservée.', h1: 'Confidentialité', body: `
<p>DabaGarde fonctionne sans compte et sans publicité.</p>
<h2>Votre position</h2><p>Si vous l’autorisez, votre position est utilisée sur votre appareil pour trier les pharmacies par distance. Elle est envoyée au service d’itinéraire (OSRM, serveurs d’OpenStreetMap) uniquement au moment du calcul d’un trajet, et au service de recherche d’adresse (Nominatim) si vous saisissez une adresse. Elle n’est pas conservée par DabaGarde et n’apparaît jamais dans l’adresse des pages.</p>
<h2>Stockage sur l’appareil</h2><p>Vos favoris, vos dernières villes recherchées et vos réglages (rayon, mode de trajet) sont enregistrés uniquement dans votre navigateur. Vous pouvez les effacer en vidant les données du site.</p>
<h2>Services tiers</h2><p>Fonds de carte : OpenStreetMap. Hébergement : GitHub Pages. Ces services reçoivent l’adresse IP technique nécessaire à l’affichage.</p>
<h2>Signalements</h2><p>Les signalements envoyés via GitHub sont publics : n’y indiquez aucune donnée personnelle.</p>
<p class="muted small">Dernière mise à jour : 22/10/2026.</p>` }, '0.3');

write({ path: 'mentions-legales/', title: 'Mentions légales – DabaGarde', description: 'Éditeur, hébergement et licences de DabaGarde.', h1: 'Mentions légales', body: `
<h2>Éditeur</h2><p>DabaGarde est un service d’information indépendant, édité à titre personnel. Contact : <a href="${href('contact/')}">page Contact</a>.</p>
<h2>Hébergement</h2><p>GitHub Pages (GitHub, Inc.).</p>
<h2>Nature du service</h2><p>Service d’information sur les gardes publiées. Il ne fournit aucun conseil médical et ne remplace pas un appel aux urgences (141 ou 15).</p>
<h2>Données et licences</h2><p>Base géographique et fonds de carte © les contributeurs d’OpenStreetMap, sous licence ODbL. Liste des hôpitaux publics : ministère de la Santé (data.gov.ma). Les listes de garde restent la propriété de leurs sources, citées sur chaque fiche.</p>` }, '0.2');

// ---------- 404, index, robots, sitemap
writeFileSync(join(DIST, '404.html'), page({ path: '404', noindex: true, title: 'Page introuvable – DabaGarde', description: 'Page introuvable.', h1: 'Page introuvable', lead: 'Cette adresse n’existe pas ou a changé.', cta: { href: BASE, label: 'Trouver une pharmacie de garde' }, body: `<p><a href="${href('villes/')}">Toutes les villes</a> · <a href="${href('urgences/')}">Numéros d’urgence</a></p>` }));
for (const f of ['index.html']) {
  const p = join(DIST, f);
  writeFileSync(p, readFileSync(p, 'utf8').replaceAll('__SITE__', SITE));
}
pages.unshift({ path: '', lastmod: TODAY, priority: '1.0' });
writeFileSync(join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: ${BASE}data/\nSitemap: ${SITE}/sitemap.xml\n`);
writeFileSync(join(DIST, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map((p) => `  <url><loc>${abs(p.path)}</loc><lastmod>${p.lastmod}</lastmod><priority>${p.priority}</priority></url>`).join('\n')}\n</urlset>\n`);
console.log(`Pages statiques : ${pages.length} pages indexables, 404, robots.txt, sitemap.xml (${all.length} gardes du ${TODAY}, géo : ${regions.length} régions / ${localities.length} localités)`);
