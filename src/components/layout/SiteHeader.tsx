import { tr, useI18n } from '../../i18n/index.tsx';
import { useState } from 'react';
import { Logo } from './Logo.tsx';
import { GpsIcon, MenuIcon, CloseIcon, SpinnerIcon, GearIcon } from '../icons.tsx';
import { PAGES, pageUrl } from '../../brand.ts';
import type { Space } from '../SpaceTabs.tsx';

const LINKS = () => [
  { href: PAGES.villes, label: tr('Villes') },
  { href: PAGES.urgences, label: tr('Urgences') },
  { href: PAGES.methode, label: tr('Comment ça marche') },
  { href: PAGES.faq, label: tr('Questions fréquentes') },
];

export function SiteHeader(props: {
  space: Space;
  onSpace: (s: Space) => void;
  onHome: () => void;
  onLocate: () => void;
  locating: boolean;
  onOpenSettings: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { lang, setLang } = useI18n();
  const tab = (s: Space, label: string) => (
    <button
      type="button"
      onClick={() => props.onSpace(s)}
      aria-current={props.space === s ? 'page' : undefined}
      className={`rounded-full px-3.5 py-2 text-sm font-bold ${props.space === s ? 'bg-white text-brand-800' : 'text-white/85 hover:bg-white/10'}`}
    >
      {label}
    </button>
  );
  return (
    <header className="sticky top-0 z-[1100] bg-brand-800 text-white shadow-[0_1px_0_rgba(255,255,255,.08)]" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2.5 lg:px-6">
        <a href={import.meta.env.BASE_URL} onClick={(e) => { e.preventDefault(); props.onHome(); }} aria-label={tr('DabaGarde, accueil')} className="me-1 rounded-lg">
          <Logo light />
        </a>
        <nav aria-label={tr('Espaces')} className="ms-3 hidden items-center gap-1 md:flex">
          {tab('pharmacies', tr('Pharmacies'))}
          {tab('sante', tr('Cliniques et hôpitaux'))}
        </nav>
        <nav aria-label={tr('Informations')} className="ms-auto hidden items-center gap-1 lg:flex">
          {LINKS().map((l) => (
            <a key={l.href} href={pageUrl(l.href)} className="rounded-full px-3 py-2 text-sm font-semibold text-white/85 hover:bg-white/10">{l.label}</a>
          ))}
        </nav>
        <div className="ms-auto flex items-center gap-1.5 lg:ms-2">
          <button type="button" onClick={props.onLocate} className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-3.5 py-2 text-sm font-bold text-white hover:bg-brand-600" aria-label={tr('Pharmacies autour de ma position')}>
            {props.locating ? <SpinnerIcon size={18} /> : <GpsIcon size={18} />}
            <span className="hidden sm:inline">{tr('Autour de moi')}</span>
          </button>
          <button type="button" onClick={() => setLang(lang === 'ar' ? 'fr' : 'ar')} lang={lang === 'ar' ? 'fr' : 'ar'}
            className="rounded-full px-2.5 py-2 text-sm font-bold text-white/90 ring-1 ring-white/25 hover:bg-white/10" aria-label={lang === 'ar' ? 'Passer en français' : 'التبديل إلى العربية'}>
            {lang === 'ar' ? 'FR' : 'عربي'}
          </button>
          <button type="button" onClick={props.onOpenSettings} className="rounded-full p-2 text-white/90 hover:bg-white/10" aria-label={tr('Sources et réglages')}>
            <GearIcon size={20} />
          </button>
          <button type="button" onClick={() => setOpen((v) => !v)} className="rounded-full p-2 text-white/90 hover:bg-white/10 lg:hidden" aria-expanded={open} aria-controls="menu-mobile" aria-label={tr('Menu')}>
            {open ? <CloseIcon size={22} /> : <MenuIcon size={22} />}
          </button>
        </div>
      </div>
      {/* Onglets d'espace sur téléphone */}
      <nav aria-label={tr('Espaces')} className="flex gap-1 px-4 pb-2.5 md:hidden">
        {tab('pharmacies', tr('Pharmacies'))}
        {tab('sante', tr('Cliniques et hôpitaux'))}
      </nav>
      {open && (
        <nav id="menu-mobile" aria-label={tr('Informations')} className="border-t border-white/10 px-4 py-2 lg:hidden">
          {LINKS().map((l) => (
            <a key={l.href} href={pageUrl(l.href)} className="block rounded-lg px-2 py-2.5 text-[15px] font-semibold text-white/90 hover:bg-white/10">{l.label}</a>
          ))}
        </nav>
      )}
    </header>
  );
}
