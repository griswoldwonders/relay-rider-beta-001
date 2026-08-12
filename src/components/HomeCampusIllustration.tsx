import React from 'react';

/**
 * Decorative first-visit Home illustration.
 * Emphasizes EV-optimized planned-route coordination, schedule fit, Access Points,
 * and a generic campus destination. No partner or institution logos.
 */
export const HomeCampusIllustration: React.FC = () => (
  <svg
    className="home-entry-illustration"
    viewBox="0 0 640 320"
    role="img"
    aria-label="Illustration of an electric vehicle on an EV-optimized planned corridor toward a campus and Access Point"
  >
    <defs>
      <linearGradient id="rrEvHill" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#d7ffc2" stopOpacity="0.78" />
        <stop offset="1" stopColor="#bce7cd" stopOpacity="0.94" />
      </linearGradient>
      <linearGradient id="rrEvRoad" x1="0" y1="1" x2="1" y2="0">
        <stop offset="0" stopColor="#d9f5df" />
        <stop offset="0.52" stopColor="#7fc596" />
        <stop offset="1" stopColor="#3d9966" />
      </linearGradient>
      <linearGradient id="rrEvCar" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ffffff" />
        <stop offset="1" stopColor="#eef4f0" />
      </linearGradient>
      <filter id="rrEvShadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="7" stdDeviation="7" floodColor="#004449" floodOpacity="0.13" />
      </filter>
      <filter id="rrEvGlow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#483cff" floodOpacity="0.18" />
      </filter>
    </defs>

    <g opacity="0.9">
      <path d="M0 270 C95 224 170 238 250 262 C341 289 432 248 510 225 C566 208 607 213 640 226 L640 320 L0 320 Z" fill="url(#rrEvHill)" />
      <path d="M0 297 C104 267 196 270 289 296 C375 320 485 286 560 267 C594 259 620 259 640 264 L640 320 L0 320 Z" fill="#effbe9" />
      <circle cx="78" cy="248" r="34" fill="#8bc7a0" />
      <rect x="74" y="247" width="7" height="54" rx="3.5" fill="#4c8c70" />
      <path d="M78 264 L60 246 M78 274 L95 257" stroke="#4c8c70" strokeWidth="5" strokeLinecap="round" />
      <circle cx="565" cy="240" r="24" fill="#8fc9a3" />
      <rect x="562" y="239" width="6" height="44" rx="3" fill="#4c8c70" />
    </g>

    <path
      d="M78 306 C151 272 240 279 314 254 C387 230 366 190 436 168 C496 149 535 151 598 120"
      fill="none"
      stroke="#ffffff"
      strokeWidth="76"
      strokeLinecap="round"
      filter="url(#rrEvShadow)"
    />
    <path
      d="M82 303 C154 269 239 276 311 252 C383 228 362 188 433 166 C493 147 532 149 595 118"
      fill="none"
      stroke="url(#rrEvRoad)"
      strokeWidth="54"
      strokeLinecap="round"
    />
    <path
      d="M83 301 C154 268 239 274 309 250 C380 226 360 186 431 164 C490 145 530 147 592 116"
      fill="none"
      stroke="#d7ffc2"
      strokeWidth="3"
      strokeDasharray="11 11"
      strokeLinecap="round"
      opacity="0.9"
    />

    <g transform="translate(471 40)" filter="url(#rrEvShadow)">
      <rect x="0" y="48" width="128" height="73" rx="10" fill="#e7eee9" />
      <rect x="40" y="13" width="50" height="108" rx="7" fill="#dde7e1" />
      <path d="M34 16 L65 -4 L96 16 Z" fill="#b7c9be" />
      <circle cx="65" cy="38" r="12" fill="#fffef0" />
      <path d="M65 38 L65 30 M65 38 L72 41" stroke="#6d8778" strokeWidth="3" strokeLinecap="round" />
      <rect x="52" y="79" width="26" height="42" rx="13" fill="#9eb3a7" />
      <rect x="15" y="68" width="16" height="18" rx="3" fill="#b9c9c0" />
      <rect x="99" y="68" width="16" height="18" rx="3" fill="#b9c9c0" />
      <path d="M65 -4 L65 -21" stroke="#267d55" strokeWidth="4" />
      <path d="M67 -21 C80 -23 84 -17 93 -19 L93 -6 C82 -4 79 -10 67 -7 Z" fill="#3db16b" />
    </g>

    <g transform="translate(133 229)" filter="url(#rrEvShadow)">
      <path d="M6 47 L18 17 Q24 5 40 5 H87 Q101 5 111 19 L124 47 Z" fill="url(#rrEvCar)" stroke="#d8e6df" strokeWidth="2" />
      <path d="M37 9 H80 Q91 9 99 20 H24 Q28 12 37 9 Z" fill="#173f4a" />
      <path d="M99 29 L106 17 L111 30" fill="none" stroke="#40b96f" strokeWidth="4" strokeLinecap="round" />
      <path d="M106 17 L111 12" stroke="#40b96f" strokeWidth="4" strokeLinecap="round" />
      <path d="M61 22 L53 38 H63 L58 51 L76 31 H66 L72 22 Z" fill="#3db16b" />
      <circle cx="28" cy="49" r="11" fill="#23464f" />
      <circle cx="100" cy="49" r="11" fill="#23464f" />
      <circle cx="28" cy="49" r="4.5" fill="#bad6c9" />
      <circle cx="100" cy="49" r="4.5" fill="#bad6c9" />
    </g>

    <g transform="translate(330 184)" filter="url(#rrEvShadow)">
      <circle cx="0" cy="0" r="29" fill="#ffffff" />
      <path d="M-4 -12 C-17 -8 -20 5 -12 14 C-7 20 3 19 9 13 C15 7 14 -2 8 -8 C4 -12 1 -13 -4 -12 Z" fill="#3db16b" />
      <path d="M-12 15 C-5 7 0 1 8 -8" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
      <text x="-48" y="51" fill="#004449" fontSize="12" fontWeight="800" fontFamily="system-ui, sans-serif">EV-optimized</text>
      <text x="-39" y="67" fill="#004449" fontSize="12" fontWeight="800" fontFamily="system-ui, sans-serif">corridor</text>
    </g>

    <g transform="translate(429 212)" filter="url(#rrEvShadow)">
      <circle cx="0" cy="0" r="28" fill="#ffffff" />
      <circle cx="0" cy="0" r="10" fill="none" stroke="#483cff" strokeWidth="3" />
      <path d="M0 -16 C-11 -16 -19 -8 -19 2 C-19 16 0 30 0 30 C0 30 19 16 19 2 C19 -8 11 -16 0 -16 Z" fill="none" stroke="#483cff" strokeWidth="3" />
      <rect x="22" y="-2" width="112" height="40" rx="14" fill="#ffffff" stroke="#e4e5e4" />
      <text x="37" y="16" fill="#004449" fontSize="12" fontWeight="800" fontFamily="system-ui, sans-serif">Access Point</text>
      <text x="37" y="31" fill="#5d7672" fontSize="10" fontWeight="600" fontFamily="system-ui, sans-serif">Eagle Rock area</text>
    </g>

    <g transform="translate(366 73)" filter="url(#rrEvGlow)">
      <circle cx="0" cy="0" r="50" fill="#f1efff" />
      <path d="M0 -28 C-18 -28 -31 -15 -31 2 C-31 23 0 47 0 47 C0 47 31 23 31 2 C31 -15 18 -28 0 -28 Z" fill="#483cff" />
      <circle cx="0" cy="0" r="10" fill="#ffffff" />
      <ellipse cx="0" cy="53" rx="30" ry="8" fill="none" stroke="#8b82ff" strokeWidth="4" opacity="0.68" />
    </g>

    <g transform="translate(266 92)" filter="url(#rrEvShadow)">
      <rect x="0" y="0" width="92" height="36" rx="13" fill="#ffffff" stroke="#e4e5e4" />
      <circle cx="18" cy="18" r="9" fill="#e9f9e7" />
      <path d="M14 18 L17 21 L23 14" fill="none" stroke="#168858" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <text x="33" y="22" fill="#004449" fontSize="11" fontWeight="800" fontFamily="system-ui, sans-serif">Schedule fit</text>
    </g>
  </svg>
);
