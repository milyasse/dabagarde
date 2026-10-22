import { tr } from '../../i18n/index.tsx';
import { BRAND, PAGES, pageUrl } from '../../brand.ts';
import { APP_VERSION, BUILD_SHA } from '../../version.ts';
import { Logo } from './Logo.tsx';

const COLS: { title: string; links: { href: string; label: string; external?: boolean }[] }[] = [
  { title: 'Trouver', links: [
    { href: PAGES.ville('rabat'), label: 'Pharmacie de garde Rabat' },
    { href: PAGES.ville('sale'), label: 'Pharmacie de garde Salé' },
    { href: PAGES.ville('temara'), label: 'Pharmacie de garde Témara' },
    { href: PAGES.villes, label: 'Toutes les villes' },
  ] },
  { title: 'Comprendre', links: [
    { href: PAGES.methode, label: 'Sources et méthode' },
    { href: PAGES.faq, label: 'Questions fréquentes' },
    { href: PAGES.urgences, label: 'Numéros d’urgence' },
  ] },
  { title: 'Le service', links: [
    { href: PAGES.contact, label: 'Contact et signalement' },
    { href: PAGES.confidentialite, label: 'Confidentialité' },
    { href: PAGES.mentions, label: 'Mentions légales' },
  ] },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4 lg:px-6">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm text-muted">{tr(BRAND.tagline)} {tr('Listes datées et sourcées ; appelez toujours avant de vous déplacer.')}</p>
          <p className="text-sm font-bold text-danger-600">{tr('Urgence vitale : 141 (SAMU) · 15 (Protection civile)')}</p>
        </div>
        {COLS.map((c) => (
          <div key={c.title}>
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-muted">{tr(c.title)}</h2>
            <ul className="mt-3 space-y-2">
              {c.links.map((l) => (
                <li key={l.href}><a href={pageUrl(l.href)} className="text-sm font-semibold text-ink hover:text-brand-700 hover:underline">{tr(l.label)}</a></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <p className="mx-auto max-w-7xl px-4 pb-24 pt-4 text-xs text-muted lg:px-6">
          {tr('Fonds de carte et base géographique © les contributeurs d’OpenStreetMap (ODbL). Itinéraires : OSRM.')} ·{' '}
          <a href={BRAND.repoUrl} className="underline" target="_blank" rel="noopener noreferrer">{tr('Code source')}</a> · v{APP_VERSION} ({BUILD_SHA})
        </p>
      </div>
    </footer>
  );
}
