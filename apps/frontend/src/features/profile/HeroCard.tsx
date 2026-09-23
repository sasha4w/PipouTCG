import { useTranslation } from "react-i18next";
import type { UserProfile } from "../../services/user.service";
import { IconGold } from "../../components/Icons";
import "./HeroCard.css";

function StarYellow({ width, height }: { width: number; height: number }) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 142 158"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g filter="url(#fy)">
        <mask
          id="m0fy"
          style={{ maskType: "luminance" }}
          maskUnits="userSpaceOnUse"
          x="4"
          y="0"
          width="134"
          height="150"
        >
          <path
            d="M3.99994 6.86646e-05H137.684V149.943H3.99994V6.86646e-05Z"
            fill="white"
          />
        </mask>
        <g mask="url(#m0fy)">
          <mask
            id="m1fy"
            style={{ maskType: "luminance" }}
            maskUnits="userSpaceOnUse"
            x="4"
            y="0"
            width="134"
            height="150"
          >
            <path
              d="M70.8339 6.86646e-05L92.1107 51.1156L137.684 74.9625L92.1107 98.827L70.8339 149.943L49.5728 98.827L3.99994 74.9625L49.5728 51.1156L70.8339 6.86646e-05Z"
              fill="white"
            />
          </mask>
          <g mask="url(#m1fy)">
            <path
              d="M4 0.000167847H137.684V149.943H4V0.000167847Z"
              fill="#EEBC77"
            />
          </g>
        </g>
      </g>
      <defs>
        <filter
          id="fy"
          x="0"
          y="0"
          width="141.684"
          height="157.942"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset dy="4" />
          <feGaussianBlur stdDeviation="2" />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.25 0"
          />
          <feBlend
            mode="normal"
            in2="BackgroundImageFix"
            result="effect1_dropShadow"
          />
          <feBlend
            mode="normal"
            in="SourceGraphic"
            in2="effect1_dropShadow"
            result="shape"
          />
        </filter>
      </defs>
    </svg>
  );
}

export default function HeroCard({ profile }: { profile: UserProfile }) {
  const { t } = useTranslation();
  return (
    <div className="hero-card">
      <div className="hero-card__top">
        <h1 className="hero-card__username">{profile.username}</h1>
        <div className="hero-card__level">
          <StarYellow width={18} height={20} />
          <span className="hero-card__level-badge">
            {t("profile.level")} {profile.level}
          </span>
          <StarYellow width={13} height={15} />
        </div>
      </div>
      <div className="hero-card__gold">
        <IconGold size={18} color="#fff" />
        <span className="hero-card__gold-value">
          {profile.gold.toLocaleString()} {t("profile.gold")}
        </span>
      </div>
      <div className="hero-card__xp">
        <div className="hero-card__xp-labels">
          <span>{t("profile.xp")}</span>
          <span>
            {profile.currentXp} / {profile.xpForNextLevel}
          </span>
        </div>
        <div className="hero-card__xp-bar">
          <div
            className="hero-card__xp-fill"
            style={{ width: `${profile.progressPercent}%` }}
          />
        </div>
      </div>
    </div>
  );
}
