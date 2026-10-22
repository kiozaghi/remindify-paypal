export function Logo({ small = false }: { small?: boolean }) {
  return (
    <span className={`logo ${small ? "logo-small" : ""}`}>
      <svg width={small ? 24 : 28} height={small ? 24 : 28} viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill="#14140F" />
        <path d="M8 18.5c0-4.5 3.4-8 8-8 3.4 0 6.2 1.8 7.4 4.7" stroke="#D9F26A" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        <circle cx="23.4" cy="15.2" r="2" fill="#D9F26A" />
        <path d="M24 21.5c0 4.5-3.4 8-8 8-3.4 0-6.2-1.8-7.4-4.7" stroke="#FBF9F3" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        <circle cx="8.6" cy="24.8" r="2" fill="#FBF9F3" />
      </svg>
    </span>
  );
}
