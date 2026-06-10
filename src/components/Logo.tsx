/**
 * CPP logo: a points trajectory that fans out into an uncertainty wedge —
 * the app's own chart motif. Original artwork, no third-party marks.
 */
export function Logo({ size = 38 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label="CPP logo">
      <rect width="48" height="48" rx="10" fill="#1F1F2B" stroke="#2E2E3E" strokeWidth="1.5" />
      {/* secondary (teal) trajectory + fan */}
      <path d="M18 30 L44 16 L44 34 Z" fill="#27F4D2" opacity="0.16" />
      <path d="M6 38 L12 34 L18 30" stroke="#27F4D2" strokeWidth="2" fill="none" opacity="0.8" strokeLinecap="round" />
      {/* primary (red) trajectory + fan */}
      <path d="M18 22 L44 4 L44 26 Z" fill="#E10600" opacity="0.32" />
      <path d="M18 22 L44 4" stroke="#E10600" strokeWidth="2" strokeDasharray="3 2.5" fill="none" />
      <path d="M6 32 L12 27 L18 22" stroke="#E10600" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <circle cx="18" cy="22" r="2.2" fill="#FFFFFF" />
      <text
        x="24"
        y="44.5"
        textAnchor="middle"
        fontSize="13.5"
        fontWeight="800"
        fill="#FFFFFF"
        fontFamily="'Titillium Web', -apple-system, 'Segoe UI', Roboto, sans-serif"
        letterSpacing="1.5"
      >
        CPP
      </text>
    </svg>
  );
}
