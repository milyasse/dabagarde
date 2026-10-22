// Fenêtre modale accessible (élément <dialog> natif : focus piégé, Échap pour fermer).
import { useEffect, useRef, type ReactNode } from 'react';
import { CloseIcon } from './icons.tsx';

export function Dialog(props: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (props.open && !d.open) d.showModal();
    if (!props.open && d.open) d.close();
  }, [props.open]);
  return (
    <dialog
      ref={ref}
      onClose={props.onClose}
      onClick={(e) => { if (e.target === ref.current) props.onClose(); }}
      aria-label={props.title}
      className={`m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-3xl bg-white p-0 text-ink shadow-2xl backdrop:bg-ink/50 sm:m-auto sm:rounded-3xl ${props.wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'}`}
    >
      {props.open && (
        <div className="flex max-h-[92dvh] flex-col">
          <div className="flex items-center gap-3 border-b border-line px-5 py-3.5">
            <h2 className="min-w-0 flex-1 truncate font-display text-lg font-extrabold">{props.title}</h2>
            <button type="button" onClick={props.onClose} className="rounded-full p-2 text-muted hover:bg-bg" aria-label="Fermer"><CloseIcon size={20} /></button>
          </div>
          <div className="overflow-y-auto px-5 py-4">{props.children}</div>
        </div>
      )}
    </dialog>
  );
}
