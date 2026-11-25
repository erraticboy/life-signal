interface BrandLogoProps {
  compact?: boolean;
}

export function BrandLogo({ compact = false }: BrandLogoProps) {
  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      <span className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-slate-950 text-white shadow-sm ring-1 ring-slate-800 dark:bg-blue-600 dark:ring-blue-400/40">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
          className="text-cyan-400 dark:text-white"
        >
          <path
            d="M3 12h4l2.5-6 4 12 2.5-6H21"
            stroke="currentColor"
            strokeWidth="2.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeOpacity="0.28" strokeWidth="1.2" />
        </svg>
      </span>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="font-display text-sm font-bold tracking-tight text-slate-950 dark:text-white">
            LIFE SIGNAL
          </span>
          <span className="text-[10px] font-medium tracking-wider text-slate-500 uppercase dark:text-slate-400">
            Urban Intelligence
          </span>
        </span>
      )}
    </span>
  );
}

