export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <rect width="64" height="64" rx="16" fill="#122235" />
      <rect
        x="0.75"
        y="0.75"
        width="62.5"
        height="62.5"
        rx="15.25"
        fill="none"
        stroke="#8FFFE0"
        strokeOpacity="0.32"
        strokeWidth="1.5"
      />
      <path
        d="M18 41.5 L27 32.5 L32.5 38 L46 24.5"
        fill="none"
        stroke="#8FFFE0"
        strokeWidth="4.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="46" cy="24.5" r="4" fill="#8FFFE0" />
    </svg>
  );
}
