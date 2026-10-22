// Statut temporel d'une garde, calculé dans le fuseau du Maroc. On ne dit jamais « ouverte » :
// seulement ce que la source annonce, et si l'heure actuelle tombe dans la période publiée.
import type { Pharmacy } from './types.ts';
import { formatShortDate, moroccoDate, moroccoMinutes, parseHours } from './dates.ts';

export type TemporalKind = 'in_window' | 'announced_today' | 'upcoming' | 'ended';

/** label et detail sont des modèles ({date}, {heure}, {horaires}) à compléter avec vars (traduisibles). */
export interface Temporal { kind: TemporalKind; label: string; detail: string | null; vars?: Record<string, string> }

const hhmm = (m: number) => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, '0')}`;

export function temporalStatus(
  p: Pick<Pharmacy, 'verificationStatus' | 'dutyType' | 'dutyDate' | 'hoursText' | 'dutyStart' | 'dutyEnd'>,
  now: Date = new Date(),
): Temporal {
  if (p.verificationStatus === 'expired') return { kind: 'ended', label: 'Garde terminée', detail: 'Période de garde publiée passée.' };
  const today = moroccoDate(now);
  const start = p.dutyStart ?? p.dutyDate;
  const end = p.dutyEnd ?? p.dutyDate;
  if (start > today) return { kind: 'upcoming', label: 'Garde prévue le {date}', detail: null, vars: { date: formatShortDate(start) } };
  if (end < today) return { kind: 'ended', label: 'Garde terminée', detail: null };

  const h = parseHours(p.hoursText);
  if (h) {
    const m = moroccoMinutes(now);
    const overnight = h.endMin <= h.startMin;
    const inside = overnight ? m >= h.startMin || m < h.endMin : m >= h.startMin && m < h.endMin;
    if (inside) return { kind: 'in_window', label: 'Dans sa période de garde', detail: 'Horaires publiés : {horaires}. Appelez pour confirmer.', vars: { horaires: h.text } };
    if (!overnight && m < h.startMin) return { kind: 'upcoming', label: 'Garde à partir de {heure}', detail: 'Horaires publiés : {horaires}.', vars: { heure: hhmm(h.startMin), horaires: h.text } };
    if (!overnight && m >= h.endMin) return { kind: 'ended', label: 'Plage horaire terminée', detail: 'Horaires publiés : {horaires}.', vars: { horaires: h.text } };
    return { kind: 'announced_today', label: 'Annoncée aujourd’hui', detail: 'Horaires publiés : {horaires}.', vars: { horaires: h.text } };
  }
  if (p.dutyType === 'continuous') return { kind: 'announced_today', label: 'Annoncée aujourd’hui', detail: 'Garde 24 h/24 selon la source ; appelez avant de vous déplacer.' };
  if (p.dutyType) return { kind: 'announced_today', label: 'Annoncée aujourd’hui', detail: 'Heures exactes non publiées par la source.' };
  return { kind: 'announced_today', label: 'Annoncée aujourd’hui', detail: 'Type et horaires non publiés par la source.' };
}

/** Remplace les variables {x} d'un libellé (pages statiques, sans traduction). */
export function fillVars(s: string, vars?: Record<string, string>): string {
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m) : s;
}
