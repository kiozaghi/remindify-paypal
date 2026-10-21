import React from "react";

const P: Record<string, React.ReactNode> = {
  today: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
  sparkle: (
    <>
      <path d="M12 3l1.9 5.2L19 10l-5.1 1.8L12 17l-1.9-5.2L5 10l5.1-1.8L12 3z" />
      <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" />
    </>
  ),
  bot: (
    <>
      <rect x="4" y="8" width="16" height="12" rx="4" />
      <path d="M12 4v4M8 14h.01M16 14h.01M9 18h6" />
    </>
  ),
  store: (
    <>
      <path d="M4 9l1.5-5h13L20 9" />
      <path d="M4 9a2.5 2.5 0 005 0 2.5 2.5 0 005 0 2.5 2.5 0 005 0" />
      <path d="M5 12v8h14v-8M9 20v-5h6v5" />
    </>
  ),
  pulse: <path d="M2 12h4l3-8 5 16 3-8h5" />,
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="M11 12l9-9M17 3l3 3M14 6l3 3" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </>
  ),
  check: <path d="M4 12.5l5 5L20 6" />,
  x: <path d="M6 6l12 12M18 6L6 18" />,
  chevronRight: <path d="M9 5l7 7-7 7" />,
  chevronDown: <path d="M5 9l7 7 7-7" />,
  chevronLeft: <path d="M15 5l-7 7 7 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="3" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3l9.5 17H2.5L12 3z" />
      <path d="M12 9v5M12 17h.01" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  wallet: (
    <>
      <rect x="3" y="6" width="18" height="14" rx="3" />
      <path d="M3 10h18M16 15h2" />
    </>
  ),
  home: (
    <>
      <path d="M4 11l8-7 8 7" />
      <path d="M6 10v10h12V10M10 20v-6h4v6" />
    </>
  ),
  heart: <path d="M12 20S3.5 15 3.5 9.5A4.5 4.5 0 0112 6a4.5 4.5 0 018.5 3.5C20.5 15 12 20 12 20z" />,
  car: (
    <>
      <path d="M5 16l1.5-6h11L19 16" />
      <rect x="3" y="14" width="18" height="5" rx="2" />
      <path d="M7 19v2M17 19v2M7 14h.01M17 14h.01" />
    </>
  ),
  id: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <circle cx="9" cy="11" r="2" />
      <path d="M6 16c.5-1.5 1.5-2.3 3-2.3s2.5.8 3 2.3M14 10h4M14 14h3" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="13" rx="3" />
      <path d="M9 7V5h6v2M3 12h18M10 12v2h4v-2" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5.5a3 3 0 010 5.8M18 20c0-2.2-.8-4.2-2-5.6" />
    </>
  ),
  repeat: <path d="M17 2l4 4-4 4M3 11V9a3 3 0 013-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 01-3 3H3" />,
  play: <path d="M7 4l13 8-13 8V4z" />,
  pause: <path d="M8 5v14M16 5v14" />,
  bolt: <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />,
  link: <path d="M10 13a5 5 0 007 0l2-2a5 5 0 00-7-7l-1 1M14 11a5 5 0 00-7 0l-2 2a5 5 0 007 7l1-1" />,
  copy: (
    <>
      <rect x="8" y="8" width="13" height="13" rx="3" />
      <path d="M16 8V5a2 2 0 00-2-2H5a2 2 0 00-2 2v9a2 2 0 002 2h3" />
    </>
  ),
  send: <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />,
  lock: (
    <>
      <rect x="4" y="10" width="16" height="11" rx="3" />
      <path d="M8 10V7a4 4 0 018 0v3" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M3 7l9 6 9-6" />
    </>
  ),
  file: (
    <>
      <path d="M6 3h8l4 4v14H6V3z" />
      <path d="M14 3v5h4M9 13h6M9 17h4" />
    </>
  ),
  gift: (
    <>
      <rect x="3" y="8" width="18" height="13" rx="2" />
      <path d="M3 12h18M12 8v13M12 8S9 3 6.5 4.5 8 8 12 8zM12 8s3-5 5.5-3.5S16 8 12 8z" />
    </>
  ),
  pill: (
    <>
      <rect x="3" y="8" width="18" height="8" rx="4" transform="rotate(-45 12 12)" />
      <path d="M9 9l6 6" />
    </>
  ),
  wrench: <path d="M14.5 6.5a4.5 4.5 0 116 6L13 20l-3-3 7.5-7.5zM6 9l-3 3 4 4 3-3" />,
  receipt: (
    <>
      <path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2V3z" />
      <path d="M9 8h6M9 12h6" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
    </>
  ),
  filter: <path d="M3 5h18l-7 8v6l-4 2v-8L3 5z" />,
  refresh: <path d="M20 11a8 8 0 10-2.3 5.7M20 5v6h-6" />,
  external: <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" />,
  terminal: <path d="M4 5h16v14H4V5zM8 9l3 3-3 3M13 15h4" />,
  webhook: (
    <>
      <circle cx="6" cy="17" r="3" />
      <circle cx="18" cy="17" r="3" />
      <circle cx="12" cy="6" r="3" />
      <path d="M9 8l-2 6M15 8l2 6M9 17h6" />
    </>
  ),
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 01-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.9.3l-.1.1A2 2 0 013 17l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H2a2 2 0 010-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.9L3.2 7A2 2 0 016 4.2l.1.1a1.7 1.7 0 001.9.3H8a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1A2 2 0 0119 7l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.5 1h.1a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z" />
    </>
  ),
  arrowRight: <path d="M4 12h16M14 6l6 6-6 6" />,
  arrowLeft: <path d="M20 12H4M10 6l-6 6 6 6" />,
  arrowUpRight: <path d="M6 18L18 6M9 6h9v9" />,
  checkCircle: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l2.7 2.7L16 9" />
    </>
  ),
  command: <path d="M9 6a3 3 0 10-3 3h12a3 3 0 10-3-3v12a3 3 0 103-3H6a3 3 0 103 3V6z" />,
  layers: <path d="M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17l9 5 9-5" />,
  inbox: <path d="M3 13h5l2 3h4l2-3h5M4 5h16l1 8v6H3v-6l1-8z" />,
  eye: (
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  mapPin: (
    <>
      <path d="M12 21s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z" />
      <circle cx="12" cy="9" r="2.5" />
    </>
  ),
  phone: <path d="M6 3h4l2 5-2.5 1.5a14 14 0 005 5L16 12l5 2v4a2 2 0 01-2.2 2A17 17 0 014 5.2 2 2 0 016 3z" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  star: <path d="M12 3l2.8 5.8 6.2.9-4.5 4.4 1.1 6.3-5.6-3-5.6 3 1.1-6.3L3 9.7l6.2-.9L12 3z" />,
  book: <path d="M4 5a2 2 0 012-2h13v18H6a2 2 0 01-2-2V5zM19 17H6M8 7h7" />,
  scale: <path d="M12 3v18M7 21h10M5 7h14M5 7l-3 7h6L5 7zM19 7l-3 7h6l-3-7z" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  download: <path d="M12 3v12M7 10l5 5 5-5M4 19h16" />,
  dot: <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />,
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  fingerprint: <path d="M6 11a6 6 0 0112 0c0 4-1 7-1 7M9 11a3 3 0 016 0c0 3-.4 6-1.5 8M4 15a14 14 0 001 4M12 20c.5-2 1-5 1-9" />,
  route: (
    <>
      <circle cx="6" cy="19" r="3" />
      <circle cx="18" cy="5" r="3" />
      <path d="M9 19h6a4 4 0 000-8H9a4 4 0 010-8h6" />
    </>
  ),
  power: <path d="M12 3v9M6.3 6.3a8 8 0 1011.4 0" />,
  circle: <circle cx="12" cy="12" r="8" />,
};

export function Icon({
  name,
  size = 18,
  className = "",
  strokeWidth = 1.7,
  fill = false,
}: {
  name: string;
  size?: number;
  className?: string;
  strokeWidth?: number;
  fill?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`icon ${className}`}
      aria-hidden="true"
    >
      {P[name] || P.circle}
    </svg>
  );
}
