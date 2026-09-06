const ic = "w-4 h-4";

export const IconPlay = () => (
  <svg className={ic} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
    <path d="M4 2.5v11l9-5.5-9-5.5z" />
  </svg>
);
export const IconPause = () => (
  <svg className={ic} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
    <rect x="3.5" y="2.5" width="3.4" height="11" rx="1" />
    <rect x="9.1" y="2.5" width="3.4" height="11" rx="1" />
  </svg>
);
export const IconRestart = () => (
  <svg className={ic} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
    <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" />
    <path d="M13.7 1.8v3h-3" strokeLinejoin="round" />
  </svg>
);
export const IconHome = () => (
  <svg className={ic} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M2.5 7.5 8 2.5l5.5 5v6h-4v-4h-3v4h-4v-6z" />
  </svg>
);
export const IconSound = ({ muted }: { muted: boolean }) => (
  <svg className={ic} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M2.5 6v4h2.5L8.5 13V3L5 6H2.5z" fill="currentColor" stroke="none" />
    {muted ? (
      <>
        <path d="M10.5 6.5 14 10" />
        <path d="M14 6.5 10.5 10" />
      </>
    ) : (
      <>
        <path d="M10.5 5.5a3.5 3.5 0 0 1 0 5" />
        <path d="M12.3 3.8a6 6 0 0 1 0 8.4" />
      </>
    )}
  </svg>
);
export const IconCrown = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
    <path d="M2 5.5 4.8 8 8 3.5 11.2 8 14 5.5 12.8 12h-9.6L2 5.5z" />
    <rect x="3.2" y="12.6" width="9.6" height="1.6" rx="0.5" />
  </svg>
);
export const IconChevron = ({ rotate }: { rotate: number }) => (
  <svg className="w-6 h-6" style={{ transform: `rotate(${rotate}deg)` }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="m6 14 6-6 6 6" />
  </svg>
);
export const IconExpand = () => (
  <svg className={ic} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M6 2H2v4M10 2h4v4M6 14H2v-4M10 14h4v-4" />
  </svg>
);
export const IconMinimize = () => (
  <svg className={ic} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M6 2v4H2M10 2v4h4M6 14v-4H2M10 14v-4h4" />
  </svg>
);
export const IconShare = () => (
  <svg className={ic} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <circle cx="11.5" cy="4" r="2" />
    <circle cx="4.5" cy="8" r="2" />
    <circle cx="11.5" cy="12" r="2" />
    <path d="M6.2 7 9.8 5M6.2 9l3.6 2" />
  </svg>
);
export const IconTrophy = ({ className = "w-4 h-4" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M4.5 2h7v3.4c0 2.1-1.5 3.6-3.5 3.6S4.5 7.5 4.5 5.4V2z" fill="currentColor" stroke="none" opacity="0.9" />
    <path d="M4.5 3H3a1.6 1.6 0 0 0 1.5 2.8M11.5 3H13a1.6 1.6 0 0 1-1.5 2.8" fill="none" />
    <path d="M6 13.5v-2h4v2M5 14h6M8 8.9v2.6" />
  </svg>
);
export const IconGrid = () => (
  <svg className={ic} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
    <rect x="2" y="2" width="5" height="5" rx="1.2" />
    <rect x="9" y="2" width="5" height="5" rx="1.2" />
    <rect x="2" y="9" width="5" height="5" rx="1.2" />
    <rect x="9" y="9" width="5" height="5" rx="1.2" />
  </svg>
);
export const IconSnake = () => (
  <svg className={ic} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
    <path d="M2 10c0-3 2.5-3 6-3s6 0 6-2.5-2.5-2.5-6-2.5" />
    <circle cx="2" cy="10" r="1.7" fill="currentColor" stroke="none" />
  </svg>
);
export const IconCheck = () => (
  <svg className={ic} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="m2.5 8.5 3.5 3.5 7.5-8" />
  </svg>
);

export const IconPong = () => (
  <svg className={ic} viewBox="0 0 16 16" aria-hidden>
    <rect x="1.5" y="4" width="2.4" height="8" rx="1.2" fill="currentColor" />
    <rect x="12.1" y="4" width="2.4" height="8" rx="1.2" fill="currentColor" opacity="0.75" />
    <circle cx="8" cy="8" r="1.7" fill="currentColor" />
    <line x1="8" y1="1.5" x2="8" y2="14.5" stroke="currentColor" strokeWidth="1" opacity="0.35" strokeDasharray="2 2" />
  </svg>
);

export const LogoMark = ({ size = 38 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden className="shrink-0">
    <defs>
      <linearGradient id="serp" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0" stopColor="#0f7a4d" />
        <stop offset="0.55" stopColor="#3ddc84" />
        <stop offset="1" stopColor="#c8ff70" />
      </linearGradient>
    </defs>
    <path
      d="M32 27c0 5-5 5-12 5S8 32 8 27s5-5 12-5 12 0 12-5-5-5-12-5"
      fill="none"
      stroke="url(#serp)"
      strokeWidth="5"
      strokeLinecap="round"
      strokeDasharray="9 7"
      className="animate-dashmove"
    />
    <circle cx="8" cy="12" r="4.4" fill="#c8ff70" />
    <circle cx="9.6" cy="10.8" r="1.1" fill="#0a1c14" />
    <path d="M3.8 12h-2m2 0 1.2-1.2M3.8 12l1.2 1.2" stroke="#ff6257" strokeWidth="1.3" strokeLinecap="round" />
  </svg>
);