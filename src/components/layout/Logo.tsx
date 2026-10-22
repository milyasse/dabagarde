// Marque DabaGarde : repère (épingle + croix) et logotype.
export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true">
      <rect width="512" height="512" rx="120" fill="#17a06b" />
      <path d="M256 84c-78 0-140 61-140 137 0 101 140 207 140 207s140-106 140-207c0-76-62-137-140-137z" fill="#fff" />
      <path d="M233 152h46v47h47v46h-47v47h-46v-47h-47v-46h47z" fill="#0a6b47" />
    </svg>
  );
}

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark size={30} />
      <span className={`font-display text-[21px] font-extrabold leading-none ${light ? 'text-white' : 'text-ink'}`}>
        Daba<span className={light ? 'text-brand-200' : 'text-brand-600'}>Garde</span>
      </span>
    </span>
  );
}
