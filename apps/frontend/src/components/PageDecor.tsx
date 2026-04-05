import "./PageDecor.css";

// Réutilise tes étoiles du Header
function StarYellow({
  width,
  height,
  style,
}: {
  width: number;
  height: number;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 51 58"
      fill="none"
      style={style}
    >
      <path
        d="M25.4616 0L33.5674 19.4734L50.9292 28.5583L33.5674 37.6499L25.4616 57.1233L17.3618 37.6499L0 28.5583L17.3618 19.4734L25.4616 0Z"
        fill="#EEBC77"
      />
    </svg>
  );
}

function StarPink({
  width,
  height,
  style,
}: {
  width: number;
  height: number;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 68 68"
      fill="none"
      style={style}
    >
      <path
        d="M33.8903 0L44.6691 23.1016L67.7707 33.8903L44.6691 44.6691L33.8903 67.7707L23.1016 44.6691L0 33.8903L23.1016 23.1016L33.8903 0Z"
        fill="#F27AAA"
      />
    </svg>
  );
}

// Configs par page — bulles et étoiles alternées
const CONFIGS: Record<
  string,
  {
    bubbles: { className: string }[];
    stars: {
      type: "yellow" | "pink";
      width: number;
      height: number;
      className: string;
      delay: string;
    }[];
  }
> = {
  default: {
    bubbles: [
      { className: "page-decor__bubble--1" },
      { className: "page-decor__bubble--2" },
      { className: "page-decor__bubble--3" },
    ],
    stars: [
      {
        type: "yellow",
        width: 28,
        height: 32,
        className: "page-decor__star--1",
        delay: "0s",
      },
      {
        type: "pink",
        width: 20,
        height: 20,
        className: "page-decor__star--2",
        delay: "0.7s",
      },
      {
        type: "yellow",
        width: 16,
        height: 18,
        className: "page-decor__star--3",
        delay: "1.3s",
      },
      {
        type: "pink",
        width: 24,
        height: 24,
        className: "page-decor__star--4",
        delay: "0.4s",
      },
    ],
  },
  // Variante B — positions miroir pour les pages paires
  alt: {
    bubbles: [
      { className: "page-decor__bubble--alt-1" },
      { className: "page-decor__bubble--alt-2" },
      { className: "page-decor__bubble--alt-3" },
    ],
    stars: [
      {
        type: "pink",
        width: 26,
        height: 26,
        className: "page-decor__star--alt-1",
        delay: "0.2s",
      },
      {
        type: "yellow",
        width: 18,
        height: 20,
        className: "page-decor__star--alt-2",
        delay: "0.9s",
      },
      {
        type: "pink",
        width: 14,
        height: 14,
        className: "page-decor__star--alt-3",
        delay: "1.5s",
      },
      {
        type: "yellow",
        width: 22,
        height: 25,
        className: "page-decor__star--alt-4",
        delay: "0.5s",
      },
    ],
  },
};

interface PageDecorProps {
  variant?: "default" | "alt";
}

export default function PageDecor({ variant = "default" }: PageDecorProps) {
  const config = CONFIGS[variant];

  return (
    <div className="page-decor" aria-hidden="true">
      {/* Bulles */}
      {config.bubbles.map((b, i) => (
        <div key={i} className={`page-decor__bubble ${b.className}`} />
      ))}

      {/* Étoiles */}
      {config.stars.map((s, i) => (
        <span
          key={i}
          className={s.className}
          style={{ animationDelay: s.delay }}
        >
          {s.type === "yellow" ? (
            <StarYellow width={s.width} height={s.height} />
          ) : (
            <StarPink width={s.width} height={s.height} />
          )}
        </span>
      ))}
    </div>
  );
}
