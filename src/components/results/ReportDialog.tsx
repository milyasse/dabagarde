// Signalement d'une erreur. Les signalements deviennent des tickets publics, examinés avant toute
// correction des données (aucune modification automatique).
import { tr } from '../../i18n/index.tsx';
import { useEffect, useState } from 'react';
import type { Pharmacy } from '../../shared/types.ts';
import { Dialog } from '../Dialog.tsx';
import { BRAND } from '../../brand.ts';
import { CITY_NAME } from '../../shared/connectors/registry.ts';
import { copyText } from '../../utils/share.ts';
import { ExternalIcon } from '../icons.tsx';

export const REPORT_REASONS = [
  'Numéro de téléphone erroné',
  'Adresse incorrecte',
  'Pharmacie fermée',
  'Horaires de garde inexacts',
  'Pharmacie introuvable sur place',
  'Autre',
] as const;

export function reportUrl(p: Pharmacy, reason: string, details: string, date: string): string {
  const q = new URLSearchParams({
    template: 'signalement.yml',
    title: `[Signalement] ${p.name} – ${reason}`,
    pharmacie: `${p.name} (${CITY_NAME[p.city] ?? p.city}) – identifiant ${p.id}`,
    probleme: reason,
    date: date,
    details: details,
  });
  return `${BRAND.reportUrl}?${q.toString()}`;
}

export function ReportDialog(props: { p: Pharmacy | null; date: string; onClose: () => void }) {
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]);
  const [details, setDetails] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => { setReason(REPORT_REASONS[0]); setDetails(''); setCopied(false); }, [props.p?.id]);
  const p = props.p;
  return (
    <Dialog open={!!p} onClose={props.onClose} title={tr('Signaler une information incorrecte')}>
      {p && (
        <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
          <p className="text-sm"><b>{p.name}</b> · {CITY_NAME[p.city] ?? p.city}</p>
          <fieldset>
            <legend className="text-sm font-bold">{tr('Quel est le problème ?')}</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {REPORT_REASONS.map((r) => (
                <label key={r} className={`flex cursor-pointer items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold ring-1 ${reason === r ? 'bg-brand-50 ring-brand-500' : 'ring-line'}`}>
                  <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} className="accent-[#0a6b47]" />
                  {tr(r)}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="report-details" className="text-sm font-bold">{tr('Précisions (facultatif)')}</label>
            <textarea id="report-details" value={details} onChange={(e) => setDetails(e.target.value)} rows={3} maxLength={800}
              placeholder={tr('Ex. : le numéro correct est…, la pharmacie était fermée à 23 h…')}
              className="mt-1 w-full rounded-xl border-[1.5px] border-line p-3 text-sm outline-none focus:border-brand-500" />
            <p className="mt-1 text-xs text-muted">{tr('N’indiquez aucune donnée personnelle (nom, téléphone personnel, état de santé).')}</p>
          </div>
          <a href={reportUrl(p, reason, details, props.date)} target="_blank" rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 py-3 font-bold text-white hover:bg-brand-600">
            {tr('Envoyer le signalement')} <ExternalIcon size={16} />
          </a>
          <p className="text-xs text-muted">
            {tr('Le signalement s’ouvre sur GitHub (compte gratuit nécessaire) et reste public. Il est examiné avant toute modification des données.')}
            {' '}{tr('Sans compte :')}{' '}
            <button type="button" className="font-bold underline" onClick={async () => setCopied(await copyText(`${reason} – ${p.name} (${p.id}) – ${props.date}\n${details}`))}>
              {tr(copied ? 'texte copié' : 'copier le texte')}
            </button>{' '}
            {tr('et l’envoyer via la page Contact.')}
          </p>
        </form>
      )}
    </Dialog>
  );
}
