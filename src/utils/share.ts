// Partage d'une fiche (Web Share API, sinon copie dans le presse-papiers).
import type { Pharmacy } from '../shared/types.ts';
import { formatPhone } from '../shared/text.ts';
import { formatShortDate } from '../shared/dates.ts';
import { CITY_NAME } from '../shared/connectors/registry.ts';

export function mapsUrl(p: Pick<Pharmacy, 'latitude' | 'longitude' | 'name' | 'address'>): string | null {
  if (p.latitude === null || p.longitude === null) return null;
  return `https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}`;
}

export function wazeUrl(p: Pick<Pharmacy, 'latitude' | 'longitude'>): string | null {
  if (p.latitude === null || p.longitude === null) return null;
  return `https://waze.com/ul?ll=${p.latitude},${p.longitude}&navigate=yes`;
}

export function shareText(p: Pharmacy): string {
  return [
    `${p.name} (${[p.district, CITY_NAME[p.city] ?? p.city].filter(Boolean).join(', ')})`,
    `Garde publiée pour le ${formatShortDate(p.dutyStart ?? p.dutyDate)}${p.hoursText ? ` · ${p.hoursText}` : ''}`,
    p.address ?? '',
    p.phone ? `Tél. ${formatPhone(p.phone)}` : '',
    'Appelez avant de vous déplacer. Source : ' + p.sourceName,
  ].filter(Boolean).join('\n');
}

export async function copyText(text: string): Promise<boolean> {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

/** Retourne 'shared', 'copied' ou 'failed'. */
export async function sharePharmacy(p: Pharmacy): Promise<'shared' | 'copied' | 'failed'> {
  const text = shareText(p);
  const url = mapsUrl(p) ?? undefined;
  if (typeof navigator.share === 'function') {
    try { await navigator.share({ title: p.name, text, url }); return 'shared'; }
    catch (e) { if ((e as Error).name === 'AbortError') return 'failed'; }
  }
  return (await copyText(url ? `${text}\n${url}` : text)) ? 'copied' : 'failed';
}
