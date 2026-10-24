import type { ReactNode } from 'react'

const P: Record<string, ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  dumbbell: <path d="M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11" />,
  food: <path d="M5 3v7a2 2 0 0 0 2 2v9M9 3v7a2 2 0 0 1-2 2M19 3c-2 1.5-3 4-3 7v3h3v8" />,
  shield: <><path d="M12 3 4 6v6c0 4.5 3.2 8 8 9 4.8-1 8-4.5 8-9V6z" /><path d="m9 12 2 2 4-4" /></>,
  pill: <><path d="m10.5 20.5-7-7a4.95 4.95 0 0 1 7-7l7 7a4.95 4.95 0 0 1-7 7z" /><path d="m8.5 8.5 7 7" /></>,
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" /></>,
  chart: <path d="M4 20h16M7 16v-4M12 16V8M17 16v-7" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  chevron: <path d="m9 6 6 6-6 6" />,
  check: <path d="m5 12 5 5 9-10" />,
  drop: <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />,
  logout: <path d="M9 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h4M16 8l4 4-4 4M20 12H9" />,
  list: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
    down: <path d="m6 9 6 6 6-6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  pencil: <path d="M4 20h4L19 9l-4-4L4 16z" />,
  skip: <path d="M5 5l9 7-9 7zM18 5v14" />,
    spark: <path d="M12 3l2.2 5.8L20 11l-5.8 2.2L12 19l-2.2-5.8L4 11l5.8-2.2z" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  up: <path d="m6 15 6-6 6 6" />,
  trash: <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />,
  swap: <path d="M7 7h12l-3-3M17 17H5l3 3" />,
    alert: <><path d="M12 3 2 20h20z" /><path d="M12 10v5M12 18h.01" /></>,
  calendar: <><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></>,
    flame: <path d="M12 3c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-6 1-10z" />,
  walk: <><circle cx="13" cy="4.5" r="1.8" /><path d="m10 21 2-6-2-3 1-4 3 2 2 3M8 12l3-4M12 15l3 2 1 4" /></>,
}

export default function Icon({ name, size = 22 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {P[name]}
    </svg>
  )
}