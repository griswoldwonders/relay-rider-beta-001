import React from 'react';

/**
 * Decorative first-visit Home illustration.
 * Uses generic mobility/campus imagery only — no institution or partner logos.
 */
export const HomeCampusIllustration: React.FC = () => (
  <svg
    className="home-entry-illustration"
    viewBox="0 0 640 320"
    role="img"
    aria-label="Illustration of an electric car, bus, bike route, campus, and Access Point"
  >
    <defs>
      <linearGradient id="rrHill" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#d7ffc2" stopOpacity="0.72" />
        <stop offset="1" stopColor="#bce7cd" stopOpacity="0.92" />
      </linearGradient>
      <linearGradient id="rrRoad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="1" stopColor="#f5f2ff" />
      </linearGradient>
      <filter id="rrSoftShadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="6" stdDeviation="7" floodColor="#004449" floodOpacity="0.12" />
      </filter>
    </defs>

    <g opacity="0.72">
      <ellipse cx="180" cy="290" rx="220" ry="84" fill="url(#rrHill)" />
      <ellipse cx="500" cy="292" rx="195" ry="92" fill="#e7f6ec" />
      <circle cx="92" cy="238" r="48" fill="#b9dec4" />
      <rect x="87" y="238" width="8" height="72" rx="4" fill="#4f9175" />
      <path d="M92 257 L70 237 M92 269 L115 246" stroke="#4f9175" strokeWidth="6" strokeLinecap="round" />
      <circle cx="560" cy="224" r="32" fill="#c8ead5" />
      <rect x="557" y="224" width="6" height="60" rx="3" fill="#579477" />
    </g>

    <path
      d="M78 306 C165 260 280 274 343 232 C402 192 365 148 445 125 C500 108 547 120 602 97"
      fill="none"
      stroke="url(#rrRoad)"
      strokeWidth="76"
      strokeLinecap="round"
      filter="url(#rrSoftShadow)"
    />
    <path
      d="M84 302 C168 258 277 271 339 230 C397 192 362 150 442 128 C498 112 546 123 597 100"
      fill="none"
      stroke="#7568ff"
      strokeOpacity="0.72"
      strokeWidth="3"
      strokeDasharray="11 12"
      strokeLinecap="round"
    />

    <g transform="translate(470 42)" filter="url(#rrSoftShadow)">
      <rect x="0" y="42" width="126" height="80" rx="10" fill="#efe7d5" />
      <rect x="43" y="8" width="46" height="114" rx="7" fill="#e4d6bd" />
      <path d="M37 11 L66 -8 L95 11 Z" fill="#cab68f" />
      <circle cx="66" cy="31" r="12" fill="#fffef0" />
      <path d="M66 31 L66 23 M66 31 L73 34" stroke="#9b875f" strokeWidth="3" strokeLinecap="round" />
      <rect x="54" y="78" width="24" height="44" rx="12" fill="#b69a70" />
      <rect x="14" y="63" width="16" height="20" rx="3" fill="#d1c3a9" />
      <rect x="98" y="63" width="16" height="20" rx="3" fill="#d1c3a9" />
      <path d="M66 -8 L66 -25" stroke="#4b8f67" strokeWidth="4" />
      <path d="M68 -25 C82 -27 85 -21 93 -23 L93 -8 C83 -6 79 -12 68 -9 Z" fill="#53b878" />
    </g>

    <g transform="translate(247 197)" filter="url(#rrSoftShadow)">
      <rect x="0" y="9" width="116" height="64" rx="18" fill="#f7faf8" stroke="#d5e8de" strokeWidth="2" />
      <rect x="14" y="18" width="73" height="31" rx="10" fill="#1c5260" />
      <rect x="91" y="20" width="13" height="28" rx="5" fill="#9ccbb3" />
      <rect x="16" y="53" width="83" height="9" rx="4.5" fill="#0d7a4b" />
      <circle cx="25" cy="73" r="11" fill="#22434b" />
      <circle cx="91" cy="73" r="11" fill="#22434b" />
      <circle cx="25" cy="73" r="5" fill="#b7d3c6" />
      <circle cx="91" cy="73" r="5" fill="#b7d3c6" />
    </g>

    <g transform="translate(112 238)" filter="url(#rrSoftShadow)">
      <path d="M5 42 L16 16 Q21 5 36 5 H70 Q82 5 90 16 L101 42 Z" fill="#f9fbfb" stroke="#d7e7e0" strokeWidth="2" />
      <path d="M31 8 H63 Q72 8 78 17 H20 Q23 10 31 8 Z" fill="#184b58" />
      <path d="M86 28 L91 13 L96 29" fill="none" stroke="#39b76c" strokeWidth="4" strokeLinecap="round" />
      <path d="M91 12 L97 6" stroke="#39b76c" strokeWidth="4" strokeLinecap="round" />
      <circle cx="22" cy="43" r="10" fill="#25464f" />
      <circle cx="82" cy="43" r="10" fill="#25464f" />
      <circle cx="22" cy="43" r="4" fill="#bfdbcf" />
      <circle cx="82" cy="43" r="4" fill="#bfdbcf" />
    </g>

    <g transform="translate(525 235)">
      <circle cx="0" cy="0" r="28" fill="#65b985" />
      <circle cx="-10" cy="9" r="9" fill="none" stroke="#fff" strokeWidth="3" />
      <circle cx="12" cy="9" r="9" fill="none" stroke="#fff" strokeWidth="3" />
      <path d="M-10 9 L-2 -6 L8 9 M-2 -6 L14 -6 M-2 -6 L-9 -12" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </g>

    <g transform="translate(342 47)" filter="url(#rrSoftShadow)">
      <circle cx="0" cy="0" r="55" fill="#f1efff" />
      <path d="M0 -29 C-18 -29 -31 -16 -31 1 C-31 23 0 48 0 48 C0 48 31 23 31 1 C31 -16 18 -29 0 -29 Z" fill="#483cff" />
      <circle cx="0" cy="0" r="10" fill="#fff" />
      <ellipse cx="0" cy="55" rx="31" ry="8" fill="none" stroke="#8b82ff" strokeWidth="4" opacity="0.7" />
      <rect x="42" y="-1" width="125" height="42" rx="15" fill="#fff" stroke="#e2e1eb" />
      <circle cx="61" cy="20" r="7" fill="#7568ff" />
      <circle cx="61" cy="20" r="2.5" fill="#fff" />
      <text x="76" y="25" fill="#004449" fontSize="16" fontWeight="700" fontFamily="system-ui, sans-serif">Access Point</text>
    </g>
  </svg>
);
