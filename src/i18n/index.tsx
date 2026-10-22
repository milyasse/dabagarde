// Langue de l'interface (français / arabe). Les textes sont écrits en français dans le code ;
// tr() renvoie leur traduction arabe quand l'arabe est choisi (repli sur le français sinon).
// Les données des sources (noms, adresses) restent telles qu'elles sont publiées.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AR } from './ar.ts';
import { setDateLocale } from '../shared/dates.ts';

export type Lang = 'fr' | 'ar';
let current: Lang = 'fr';

export function tr(s: string, vars?: Record<string, string | number>): string {
  let out = current === 'ar' ? (AR[s] ?? s) : s;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}

export const currentLang = () => current;

/** Nom d'un lieu dans la langue choisie (nom arabe d'OpenStreetMap quand il existe). */
export const localName = (o: { name: string; nameAr?: string | null }) => (current === 'ar' && o.nameAr ? o.nameAr : o.name);

function apply(l: Lang) {
  current = l;
  setDateLocale(l === 'ar' ? 'ar-MA' : 'fr-FR');
}

function initialLang(): Lang {
  try {
    const q = new URLSearchParams(window.location.search).get('lang');
    if (q === 'ar' || q === 'fr') return q;
    const s = localStorage.getItem('dg.lang');
    if (s === 'ar' || s === 'fr') return s;
  } catch { /* stockage indisponible */ }
  return typeof navigator !== 'undefined' && /^ar\b/i.test(navigator.language) ? 'ar' : 'fr';
}

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: 'fr', setLang: () => {} });

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => { const l = initialLang(); apply(l); return l; });
  apply(lang);
  useEffect(() => {
    document.documentElement.lang = lang === 'ar' ? 'ar' : 'fr';
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    try { localStorage.setItem('dg.lang', lang); } catch { /* stockage indisponible */ }
  }, [lang]);
  const value = useMemo(() => ({ lang, setLang }), [lang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
