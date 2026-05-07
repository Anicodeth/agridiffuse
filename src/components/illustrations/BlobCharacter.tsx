import type { CSSProperties } from "react";

export type BlobColor = "ember" | "meadow" | "sky" | "sunburst" | "flamingo" | "violet";

const palette: Record<BlobColor, { fill: string; stroke: string }> = {
  ember: { fill: "#ff3e00", stroke: "#c93000" },
  meadow: { fill: "#00ca48", stroke: "#00963a" },
  sky: { fill: "#0090ff", stroke: "#0070cc" },
  sunburst: { fill: "#ffbb26", stroke: "#d48f00" },
  flamingo: { fill: "#ff58ae", stroke: "#cc3a86" },
  violet: { fill: "#9f4fff", stroke: "#7a32cc" },
};

interface BlobCharacterProps {
  color?: BlobColor;
  size?: number;
  mood?: "happy" | "wink" | "surprised";
  className?: string;
  style?: CSSProperties;
}

/**
 * Family-style blob creature: organic shape, dot eyes, stick limbs.
 * Sized 60–120px in the wild — anything smaller and the face dissolves.
 */
export function BlobCharacter({
  color = "ember",
  size = 96,
  mood = "happy",
  className,
  style,
}: BlobCharacterProps) {
  const { fill, stroke } = palette[color];

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={className}
      style={style}
      aria-hidden
    >
      {/* stick limbs — drawn first so the body covers their base */}
      <g stroke={stroke} strokeWidth="3" strokeLinecap="round" fill="none">
        <line x1="32" y1="92" x2="22" y2="112" />
        <line x1="88" y1="92" x2="98" y2="112" />
        <line x1="20" y1="56" x2="6" y2="44" />
        <line x1="100" y1="56" x2="114" y2="44" />
      </g>

      {/* organic blob body */}
      <path
        d="M60 16 C92 16 104 44 100 70 C97 92 80 102 60 102 C40 102 23 92 20 70 C16 44 28 16 60 16 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth="3"
      />

      {/* dot eyes */}
      {mood === "wink" ? (
        <>
          <circle cx="46" cy="56" r="4" fill="#121212" />
          <path d="M68 56 Q74 52 80 56" stroke="#121212" strokeWidth="3" fill="none" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="46" cy="56" r="4" fill="#121212" />
          <circle cx="74" cy="56" r="4" fill="#121212" />
        </>
      )}

      {/* mouth */}
      {mood === "surprised" ? (
        <ellipse cx="60" cy="74" rx="5" ry="6" fill="#121212" />
      ) : (
        <path
          d="M50 72 Q60 82 70 72"
          stroke="#121212"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
      )}

      {/* cheek blush */}
      <circle cx="38" cy="68" r="3" fill="#fff" opacity="0.4" />
      <circle cx="82" cy="68" r="3" fill="#fff" opacity="0.4" />
    </svg>
  );
}

interface CoinProps {
  size?: number;
  className?: string;
  style?: CSSProperties;
}

export function Coin({ size = 64, className, style }: CoinProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      style={style}
      aria-hidden
    >
      <circle cx="32" cy="32" r="26" fill="#ffbb26" stroke="#d48f00" strokeWidth="3" />
      <circle cx="32" cy="32" r="18" fill="none" stroke="#d48f00" strokeWidth="2" />
      <text
        x="32"
        y="40"
        textAnchor="middle"
        fontFamily="Inter, sans-serif"
        fontWeight="700"
        fontSize="20"
        fill="#d48f00"
      >
        ₳
      </text>
    </svg>
  );
}

export function StarShape({ size = 36, className, style }: CoinProps) {
  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      className={className}
      style={style}
      aria-hidden
    >
      <path
        d="M20 4 L24 16 L36 17 L27 26 L29 38 L20 32 L11 38 L13 26 L4 17 L16 16 Z"
        fill="#ffbb26"
        stroke="#d48f00"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Sprout({ size = 56, className, style }: CoinProps) {
  return (
    <svg
      viewBox="0 0 56 56"
      width={size}
      height={size}
      className={className}
      style={style}
      aria-hidden
    >
      <path
        d="M28 50 L28 28"
        stroke="#00963a"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M28 32 C18 28 14 18 18 10 C26 14 30 22 28 32 Z"
        fill="#00ca48"
        stroke="#00963a"
        strokeWidth="2"
      />
      <path
        d="M28 32 C38 28 42 18 38 10 C30 14 26 22 28 32 Z"
        fill="#00c978"
        stroke="#00963a"
        strokeWidth="2"
      />
    </svg>
  );
}
