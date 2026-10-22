// Partage d'une fiche (Web Share API, sinon copie dans le presse-papiers).
import { tr } from '../i18n/index.tsx';
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
    `${tr('Garde publiée pour le {date}', { date: formatShortDate(p.dutyStart ?? p.dutyDate) })}${p.hoursText ? ` · ${p.hoursText}` : ''}`,
    p.address ?? '',
    p.phone ? `${tr('Tél.')} ${formatPhone(p.phone)}` : '',
    `${tr('Appelez avant de vous déplacer. Source :')} ${p.sourceName}`,
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

/** Lien WhatsApp avec le message prêt (nom, garde, adresse, téléphone, itinéraire). */
export function whatsappUrl(p: Pharmacy): string {
  const url = mapsUrl(p);
  const lines = [shareText(p), url ? `${tr('Itinéraire :')} ${url}` : '', tr('Urgence vitale : 141 (SAMU) ou 15 (Protection civile).')].filter(Boolean);
  return `https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`;
}
