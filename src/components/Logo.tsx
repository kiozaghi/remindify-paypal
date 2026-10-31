export function Logo({ small = false }: { small?: boolean }) {
  return (
    <span className={`logo ${small ? "logo-small" : ""}`}>
      <svg width={small ? 24 : 28} height={small ? 24 : 28} viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill="#14140F" />
        <circle cx="16" cy="16" r="6.75" fill="none" stroke="#D9F26A" strokeWidth="2.5" />
        <path
          d="M11.5 16.5 14.5 19.5 21 12.75"
          fill="none"
          stroke="#14140F"
          strokeWidth="3.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M11.5 16.5 14.5 19.5 21 12.75"
          fill="none"
          stroke="#FBF9F3"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
