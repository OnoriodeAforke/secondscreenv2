import React from 'react';

interface BrandIconProps {
  className?: string;
  size?: number | string;
  withBackground?: boolean;
}

/**
 * Exact vector rendition of the stylized electric "S" esports logo from icon.png
 * Features the signature angular lightning cuts, wings, and violet-to-cyan gradient.
 */
export const BrandIcon: React.FC<BrandIconProps> = ({
  className = 'w-9 h-9',
  withBackground = true,
}) => {
  return (
    <svg
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} shrink-0`}
    >
      <defs>
        {/* Violet to Electric Blue / Cyan Gradient matching icon.png */}
        <linearGradient id="ssLogoGradient" x1="20%" y1="10%" x2="80%" y2="95%">
          <stop offset="0%" stopColor="#bf5af2" />
          <stop offset="28%" stopColor="#9333ea" />
          <stop offset="60%" stopColor="#4f46e5" />
          <stop offset="85%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#00d2ff" />
        </linearGradient>

        {/* Ambient neon edge glow */}
        <filter id="ssGlow" x="-25%" y="-25%" width="150%" height="150%">
          <feDropShadow dx="0" dy="4" stdDeviation="8" floodColor="#7c3aed" floodOpacity="0.35" />
          <feDropShadow dx="0" dy="8" stdDeviation="16" floodColor="#2563eb" floodOpacity="0.25" />
        </filter>
      </defs>

      {/* Rounded squircle dark tile matching the icon backdrop */}
      {withBackground && (
        <>
          <rect width="200" height="200" rx="44" fill="#0f1017" />
          <rect
            width="198"
            height="198"
            x="1"
            y="1"
            rx="43"
            fill="none"
            stroke="#212335"
            strokeWidth="2"
          />
        </>
      )}

      {/* Stylized Angular Esports "S" Monogram */}
      <g filter={withBackground ? 'url(#ssGlow)' : undefined}>
        <path
          d="M 88 74
             L 100 48
             L 156 42
             L 136 64
             L 152 64
             L 132 84
             L 104 84
             L 94 102
             L 126 114
             L 112 142
             L 54 150
             L 74 128
             L 58 128
             L 78 108
             L 106 108
             L 116 94
             Z"
          fill="url(#ssLogoGradient)"
        />
      </g>
    </svg>
  );
};

interface BrandLogoProps {
  className?: string;
  iconClassName?: string;
  textClassName?: string;
  showText?: boolean;
}

/**
 * Full SecondScreen Brand Header Component:
 * - Icon: Electric angular "S" monogram
 * - Wordmark: "SECOND" in violet-purple + "SCREEN" in electric-cyan in esports typography
 */
export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = 'flex items-center gap-3',
  iconClassName = 'w-9 h-9',
  textClassName = 'text-xl',
  showText = true,
}) => {
  return (
    <div className={`group inline-flex items-center ${className}`}>
      {/* Icon with hover reactive glow */}
      <div className="relative flex items-center justify-center transition-transform duration-200 group-hover:scale-105">
        <BrandIcon className={iconClassName} withBackground={true} />
      </div>

      {/* Wordmark */}
      {showText && (
        <div className="flex flex-col leading-none select-none">
          <span
            className={`${textClassName} font-black italic tracking-wider uppercase font-['Chakra_Petch',sans-serif]`}
          >
            <span className="bg-gradient-to-r from-purple-400 via-violet-300 to-indigo-300 bg-clip-text text-transparent drop-shadow-[0_2px_10px_rgba(168,85,247,0.35)]">
              Second
            </span>
            <span className="bg-gradient-to-r from-blue-400 via-sky-300 to-cyan-300 bg-clip-text text-transparent drop-shadow-[0_2px_10px_rgba(14,165,233,0.35)] ml-0.5">
              Screen
            </span>
          </span>
        </div>
      )}
    </div>
  );
};

export default BrandLogo;
