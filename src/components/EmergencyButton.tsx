// Bouton « Urgence » toujours visible : numéros nationaux à composer directement.
import { tr } from '../i18n/index.tsx';
import { useState } from 'react';
import { Dialog } from './Dialog.tsx';
import { PhoneIcon } from './icons.tsx';
import { PAGES, pageUrl } from '../brand.ts';

export const EMERGENCY_NUMBERS: { label: string; number: string; tel: string; note?: string }[] = [
  { label: 'SAMU (urgence médicale)', number: '141', tel: '141' },
  { label: 'Protection civile (pompiers, ambulances)', number: '15', tel: '15' },
  { label: 'Police', number: '19', tel: '19' },
  { label: 'Gendarmerie royale', number: '177', tel: '177', note: 'hors agglomérations' },
  { label: 'Centre antipoison', number: '0801 000 180', tel: '0801000180', note: 'numéro vert' },
];

export function EmergencyButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed z-[1400] inline-flex items-center gap-2 rounded-full bg-danger-600 px-4 py-3 text-sm font-extrabold text-white shadow-[0_8px_24px_rgba(180,35,24,.35)] hover:brightness-110"
        style={{ left: 'max(16px, env(safe-area-inset-left, 0px))', bottom: 'max(16px, env(safe-area-inset-bottom, 0px))' }}
        aria-label={tr('Numéros d’urgence')}
      >
        <PhoneIcon size={18} /> {tr('Urgence')}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={tr('Numéros d’urgence')}>
        <p className="text-sm text-muted">{tr('Appel gratuit depuis un téléphone au Maroc. En cas de doute, le 141 ou le 15 vous orientent.')}</p>
        <ul className="mt-3 space-y-2">
          {EMERGENCY_NUMBERS.map((n, i) => (
            <li key={n.tel}>
              <a href={`tel:${n.tel}`} className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${i < 2 ? 'bg-danger-50 text-danger-600' : 'bg-bg text-ink'}`}>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold">{tr(n.label)}</span>
                  {n.note && <span className="block text-xs opacity-80">{tr(n.note)}</span>}
                </span>
                <span className="font-display text-2xl font-extrabold tabular" dir="ltr">{n.number}</span>
                <PhoneIcon size={20} />
              </a>
            </li>
          ))}
        </ul>
        <a href={pageUrl(PAGES.urgences)} className="mt-3 inline-block text-sm font-bold text-brand-700 underline">{tr('Page des numéros d’urgence')}</a>
      </Dialog>
    </>
  );
}
