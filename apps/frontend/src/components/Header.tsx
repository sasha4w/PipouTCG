import { useEffect, useState } from "react";

// ── Étoile jaune (Figma node 4008-56) ──────────────────────────────────────
function StarYellow({ width, height }: { width: number; height: number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 51 58" fill="none" xmlns="http://www.w3.org/2000/svg">
      <mask id="mask0_y" style={{ maskType: "luminance" }} maskUnits="userSpaceOnUse" x="0" y="0" width="51" height="58">
        <path d="M0 0H50.9292V57.1233H0V0Z" fill="white"/>
      </mask>
      <g mask="url(#mask0_y)">
        <mask id="mask1_y" style={{ maskType: "luminance" }} maskUnits="userSpaceOnUse" x="0" y="0" width="51" height="58">
          <path d="M25.4616 0L33.5674 19.4734L50.9292 28.5583L33.5674 37.6499L25.4616 57.1233L17.3618 37.6499L0 28.5583L17.3618 19.4734L25.4616 0Z" fill="white"/>
        </mask>
        <g mask="url(#mask1_y)">
          <mask id="mask2_y" style={{ maskType: "luminance" }} maskUnits="userSpaceOnUse" x="-2" y="-2" width="54" height="60">
            <path d="M51.2364 -1.14825H-1.1803V57.6434H51.2364V-1.14825Z" fill="white"/>
          </mask>
          <g mask="url(#mask2_y)">
            <mask id="mask3_y" style={{ maskType: "luminance" }} maskUnits="userSpaceOnUse" x="0" y="0" width="51" height="58">
              <path d="M3.05176e-05 0H50.9292V57.1233H3.05176e-05V0Z" fill="white"/>
            </mask>
            <g mask="url(#mask3_y)">
              <mask id="mask4_y" style={{ maskType: "luminance" }} maskUnits="userSpaceOnUse" x="0" y="0" width="51" height="58">
                <path d="M25.4616 0L33.5674 19.4734L50.9292 28.5583L33.5674 37.6499L25.4616 57.1233L17.3618 37.6499L3.05176e-05 28.5583L17.3618 19.4734L25.4616 0Z" fill="white"/>
              </mask>
              <g mask="url(#mask4_y)">
                <path d="M3.05176e-05 0H50.9292V57.1233H3.05176e-05V0Z" fill="#EEBC77"/>
              </g>
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}

// ── Étoile rose (Figma node 4008-101) ──────────────────────────────────────
function StarPink({ width, height }: { width: number; height: number }) {
  return (
    <svg width={width} height={height} viewBox="0 0 68 68" fill="none" xmlns="http://www.w3.org/2000/svg">
      <mask id="mask0_p" style={{ maskType: "luminance" }} maskUnits="userSpaceOnUse" x="0" y="0" width="68" height="68">
        <path d="M0 0H67.7707V67.7707H0V0Z" fill="white"/>
      </mask>
      <g mask="url(#mask0_p)">
        <mask id="mask1_p" style={{ maskType: "luminance" }} maskUnits="userSpaceOnUse" x="0" y="0" width="68" height="68">
          <path d="M33.8903 0L44.6691 23.1016L67.7707 33.8903L44.6691 44.6691L33.8903 67.7707L23.1016 44.6691L0 33.8903L23.1016 23.1016L33.8903 0Z" fill="white"/>
        </mask>
        <g mask="url(#mask1_p)">
          <mask id="mask2_p" style={{ maskType: "luminance" }} maskUnits="userSpaceOnUse" x="-3" y="-2" width="72" height="72">
            <path d="M68.7506 -1.85092H-2.19733V69.097H68.7506V-1.85092Z" fill="white"/>
          </mask>
          <g mask="url(#mask2_p)">
            <mask id="mask3_p" style={{ maskType: "luminance" }} maskUnits="userSpaceOnUse" x="0" y="0" width="68" height="68">
              <path d="M0 -3.05176e-05H67.7707V67.7707H0V-3.05176e-05Z" fill="white"/>
            </mask>
            <g mask="url(#mask3_p)">
              <mask id="mask4_p" style={{ maskType: "luminance" }} maskUnits="userSpaceOnUse" x="0" y="0" width="68" height="68">
                <path d="M33.8903 -3.05176e-05L44.6691 23.1016L67.7707 33.8903L44.6691 44.669L33.8903 67.7707L23.1016 44.669L0 33.8903L23.1016 23.1016L33.8903 -3.05176e-05Z" fill="white"/>
              </mask>
              <g mask="url(#mask4_p)">
                <path d="M0 -3.05176e-05H67.7707V67.7707H0V-3.05176e-05Z" fill="#F27AAA"/>
              </g>
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}

// ── Groupe des 3 étoiles (disposition comme dans l'image Figma) ────────────
function TitleStars() {
  return (
    <span
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "flex-start",
        width: 52,
        height: 54,
        marginLeft: 6,
        flexShrink: 0,
      }}
    >
      {/* Grande étoile jaune — haut droite */}
      <span style={{ position: "absolute", top: 0, right: 0, animation: "starFloat 3s ease-in-out infinite", animationDelay: "0s" }}>
        <StarYellow width={30} height={34} />
      </span>

      {/* Petite étoile jaune — milieu gauche */}
      <span style={{ position: "absolute", top: 16, right: 24, animation: "starFloat 3s ease-in-out infinite", animationDelay: "0.6s" }}>
        <StarYellow width={15} height={17} />
      </span>

      {/* Étoile rose — bas droite */}
      <span style={{ position: "absolute", bottom: 0, right: 3, animation: "starFloat 3s ease-in-out infinite", animationDelay: "1.1s" }}>
        <StarPink width={22} height={22} />
      </span>
    </span>
  );
}

// ── Header ─────────────────────────────────────────────────────────────────
export default function Header() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Lilita+One&display=swap');

        .cc-header {
          background: #F5EFE0;
          padding: 16px 24px 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-bottom: 1.5px solid rgba(61, 16, 32, 0.09);
          min-height: 68px;
        }

        .cc-header__title-row {
          display: inline-flex;
          align-items: center;
          opacity: ${mounted ? 1 : 0};
          transform: ${mounted ? "translateY(0)" : "translateY(-8px)"};
          transition: opacity 0.5s ease, transform 0.5s ease;
        }

        .cc-header__title {
          font-family: 'Lilita One', cursive;
          font-size: 27px;
          color: #7A1C3B;
          letter-spacing: 0.4px;
          text-shadow: 0 2px 0 rgba(122, 28, 59, 0.10);
          margin: 0;
        }

        @keyframes starFloat {
          0%, 100% { transform: translateY(0px)  rotate(0deg);  }
          50%       { transform: translateY(-4px) rotate(10deg); }
        }
      `}</style>

      <header className="cc-header">
        <div className="cc-header__title-row">
          <h1 className="cc-header__title">Card &amp; Collect</h1>
          <TitleStars />
        </div>
      </header>
    </>
  );
}
