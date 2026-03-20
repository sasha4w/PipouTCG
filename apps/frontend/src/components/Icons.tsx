interface IconProps {
  size?: number;
  color?: string;
  className?: string;
}

// ── Icône Collection (tab) ───────────────────────────────────────────────────
export function IconCollection({
  size = 24,
  color = "currentColor",
  className,
}: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      className={className}
      fill={color}
    >
      <rect width="48" height="48" fill="none" />
      <path d="M42,18H30v4a6,6,0,0,1-12,0V18H6a2,2,0,0,0-2,2V42a2,2,0,0,0,2,2H42a2,2,0,0,0,2-2V20A2,2,0,0,0,42,18Z" />
      <path d="M9,14H39a2,2,0,0,0,0-4H9a2,2,0,0,0,0,4Z" />
      <path d="M12,6H36a2,2,0,0,0,0-4H12a2,2,0,0,0,0,4Z" />
    </svg>
  );
}

// ── Icône Stats (tab) ────────────────────────────────────────────────────────
export function IconStats({
  size = 24,
  color = "currentColor",
  className,
}: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 96 96"
      className={className}
      fill="none"
    >
      <rect
        width="88"
        height="88"
        rx="8"
        x="4"
        y="4"
        stroke={color}
        strokeLinecap="round"
        strokeMiterlimit="10"
        strokeWidth="4"
      />
      <line
        x1="40"
        y1="42"
        x2="40"
        y2="76"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="4"
      />
      <line
        x1="73"
        y1="34"
        x2="73"
        y2="76"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="4"
      />
      <line
        x1="56"
        y1="47"
        x2="56"
        y2="76"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="4"
      />
      <line
        x1="23"
        y1="53"
        x2="23"
        y2="76"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="4"
      />
      <path
        d="M23,42l17-14,16,6,17-15"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="4"
      />
    </svg>
  );
}

// ── Icône Gold (pièces) ──────────────────────────────────────────────────────
export function IconGold({
  size = 24,
  color = "currentColor",
  className,
}: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 64 64"
      strokeWidth="3"
      stroke={color}
      fill="none"
      className={className}
    >
      <ellipse
        cx="23.07"
        cy="14.99"
        rx="15.22"
        ry="5.24"
        strokeLinecap="round"
      />
      <path
        d="M38.3,21.8c0,2.89-6.82,5.24-15.23,5.24S7.85,24.69,7.85,21.8"
        strokeLinecap="round"
      />
      <path
        d="M27.38,33.43c-.4,0-3.9,0-4.31,0-8.41,0-15.22-2.35-15.22-5.24"
        strokeLinecap="round"
      />
      <path
        d="M24.91,40c-.6,0-1.22,0-1.84,0-8.41,0-15.22-2.34-15.22-5.24"
        strokeLinecap="round"
      />
      <path
        d="M25.7,46.53a22.48,22.48,0,0,1-2.63.08c-8.41,0-15.22-2.35-15.22-5.24"
        strokeLinecap="round"
      />
      <line x1="7.85" y1="41.42" x2="7.85" y2="15.01" strokeLinecap="round" />
      <line x1="38.3" y1="30.01" x2="38.3" y2="14.99" strokeLinecap="round" />
      <ellipse
        cx="40.93"
        cy="35.82"
        rx="15.22"
        ry="5.24"
        strokeLinecap="round"
      />
      <path
        d="M56.15,42.63c0,2.9-6.81,5.24-15.22,5.24S25.7,45.53,25.7,42.63"
        strokeLinecap="round"
      />
      <path
        d="M56.15,49c0,2.9-6.81,5.25-15.22,5.25S25.7,51.91,25.7,49"
        strokeLinecap="round"
      />
      <line x1="25.7" y1="48.92" x2="25.7" y2="35.07" strokeLinecap="round" />
      <line x1="56.15" y1="49.21" x2="56.15" y2="35.64" strokeLinecap="round" />
    </svg>
  );
}

// ── Icône Booster (cadeau) ───────────────────────────────────────────────────
export function IconBooster({
  size = 24,
  color = "currentColor",
  className,
}: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      <path
        d="M3 17H21M12 8L10 12M12 8L14 12M12 8H7.5C6.83696 8 6.20107 7.73661 5.73223 7.26777C5.26339 6.79893 5 6.16304 5 5.5C5 4.83696 5.26339 4.20107 5.73223 3.73223C6.20107 3.26339 6.83696 3 7.5 3C11 3 12 8 12 8ZM12 8H16.5C17.163 8 17.7989 7.73661 18.2678 7.26777C18.7366 6.79893 19 6.16304 19 5.5C19 4.83696 18.7366 4.20107 18.2678 3.73223C17.7989 3.26339 17.163 3 16.5 3C13 3 12 8 12 8ZM6.2 21H17.8C18.9201 21 19.4802 21 19.908 20.782C20.2843 20.5903 20.5903 20.2843 20.782 19.908C21 19.4802 21 18.9201 21 17.8V11.2C21 10.0799 21 9.51984 20.782 9.09202C20.5903 8.71569 20.2843 8.40973 19.908 8.21799C19.4802 8 18.9201 8 17.8 8H6.2C5.0799 8 4.51984 8 4.09202 8.21799C3.71569 8.40973 3.40973 8.71569 3.21799 9.09202C3 9.51984 3 10.0799 3 11.2V17.8C3 18.9201 3 19.4802 3.21799 19.908C3.40973 20.2843 3.71569 20.5903 4.09202 20.782C4.51984 21 5.07989 21 6.2 21Z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Icône Bundle (hexagone 3D) ────────────────────────────────────────────────
export function IconBundle({
  size = 24,
  color = "currentColor",
  className,
}: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      <path
        d="M21.9844 10C21.9473 8.68893 21.8226 7.85305 21.4026 7.13974C20.8052 6.12523 19.7294 5.56066 17.5777 4.43152L15.5777 3.38197C13.8221 2.46066 12.9443 2 12 2C11.0557 2 10.1779 2.46066 8.42229 3.38197L6.42229 4.43152C4.27063 5.56066 3.19479 6.12523 2.5974 7.13974C2 8.15425 2 9.41667 2 11.9415V12.0585C2 14.5833 2 15.8458 2.5974 16.8603C3.19479 17.8748 4.27063 18.4393 6.42229 19.5685L8.42229 20.618C10.1779 21.5393 11.0557 22 12 22C12.9443 22 13.8221 21.5393 15.5777 20.618L17.5777 19.5685C19.7294 18.4393 20.8052 17.8748 21.4026 16.8603C21.8226 16.1469 21.9473 15.3111 21.9844 14"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M21 7.5L17 9.5M12 12L3 7.5M12 12V21.5M12 12C12 12 14.7426 10.6287 16.5 9.75C16.6953 9.65237 17 9.5 17 9.5M17 9.5V13M17 9.5L7.5 4.5"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ── Icône Cards (stack de cartes) ─────────────────────────────────────────────
export function IconCards({
  size = 24,
  color = "currentColor",
  className,
}: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 384 383.999986"
      className={className}
    >
      {/* Carte inclinée gauche */}
      <path
        d="M329.402344 73.835938 L296.46875 343.015625 C295.890625 347.753906 293.449219 352.070312 289.691406 355.011719 C285.929688 357.949219 281.15625 359.277344 276.417969 358.695312 L67.996094 333.195312 C63.257812 332.617188 58.945312 330.179688 56.003906 326.417969 C53.0625 322.660156 51.738281 317.882812 52.316406 313.144531 L85.25 43.964844 C85.832031 39.226562 88.269531 34.914062 92.027344 31.972656 C95.789062 29.035156 100.5625 27.707031 105.300781 28.285156 L313.722656 53.785156 C318.460938 54.367188 322.773438 56.804688 325.714844 60.566406 C328.65625 64.324219 329.980469 69.101562 329.402344 73.835938Z"
        fill="#fdfbf2"
        stroke={color}
        strokeWidth="6"
        opacity="0.5"
      />
      {/* Carte inclinée droite */}
      <path
        d="M289.84375 44.066406 L306.164062 314.761719 C306.453125 319.527344 304.835938 324.210938 301.667969 327.78125 C298.503906 331.355469 294.046875 333.523438 289.28125 333.808594 L79.6875 346.445312 C74.921875 346.734375 70.238281 345.117188 66.667969 341.949219 C63.09375 338.785156 60.925781 334.328125 60.636719 329.5625 L44.320312 58.867188 C44.03125 54.105469 45.648438 49.417969 48.816406 45.847656 C51.980469 42.273438 56.4375 40.105469 61.199219 39.820312 L270.796875 27.183594 C275.5625 26.894531 280.246094 28.511719 283.816406 31.679688 C287.390625 34.847656 289.558594 39.300781 289.84375 44.066406Z"
        fill="#fdfbf2"
        stroke={color}
        strokeWidth="6"
        opacity="0.75"
      />
      {/* Carte principale */}
      <path
        d="M312.5 57.898438 L312.5 329.085938 C312.5 333.859375 310.601562 338.4375 307.226562 341.8125 C303.851562 345.1875 299.273438 347.082031 294.5 347.082031 L84.523438 347.082031 C79.75 347.082031 75.171875 345.1875 71.796875 341.8125 C68.421875 338.4375 66.527344 333.859375 66.527344 329.085938 L66.527344 57.898438 C66.527344 53.125 68.421875 48.546875 71.796875 45.171875 C75.171875 41.796875 79.75 39.898438 84.523438 39.898438 L294.5 39.898438 C299.273438 39.898438 303.851562 41.796875 307.226562 45.171875 C310.601562 48.546875 312.5 53.125 312.5 57.898438Z"
        fill="#fdfbf2"
        stroke={color}
        strokeWidth="6"
      />
      {/* Lettre C */}
      <g fill={color}>
        <path
          transform="translate(101.684492, 237.590621)"
          d="M 104.609375 -30.90625 C 104.609375 -33.164062 105.507812 -35.085938 107.3125 -36.671875 C 109.125 -38.265625 112.179688 -39.0625 116.484375 -39.0625 C 124.410156 -39.0625 128.375 -35.4375 128.375 -28.1875 L 128.375 -22.421875 C 128.375 -7.472656 119.769531 0 102.5625 0 L 41.4375 0 C 24.90625 0 16.640625 -8.035156 16.640625 -24.109375 L 16.640625 -120.90625 C 16.640625 -137.4375 25.019531 -145.703125 41.78125 -145.703125 L 102.5625 -145.703125 C 119.769531 -145.703125 128.375 -138.226562 128.375 -123.28125 L 128.375 -118.1875 C 128.375 -110.039062 124.410156 -105.96875 116.484375 -105.96875 C 108.566406 -105.96875 104.609375 -108.570312 104.609375 -113.78125 C 104.609375 -126.226562 97.703125 -132.453125 83.890625 -132.453125 L 60.796875 -132.453125 C 47.210938 -132.453125 40.421875 -126.566406 40.421875 -114.796875 L 40.421875 -29.890625 C 40.421875 -18.335938 47.097656 -12.5625 60.453125 -12.5625 L 84.5625 -12.5625 C 97.925781 -12.5625 104.609375 -18.675781 104.609375 -30.90625Z"
        />
      </g>
    </svg>
  );
}

// ── Icône Notification cloche ─────────────────────────────────────────────────
export function IconBell({
  size = 16,
  color = "currentColor",
  className,
}: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      <path
        d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.73 21a2 2 0 0 1-3.46 0"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ── Icône Check ───────────────────────────────────────────────────────────────
export function IconCheck({
  size = 14,
  color = "currentColor",
  className,
}: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      <path
        d="M20 6L9 17l-5-5"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
