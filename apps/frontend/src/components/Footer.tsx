import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { soundService } from "../services/sound.service";
import { IconUser } from "./Icons";
import "./Footer.css";

const NAV_ITEMS = [
  {
    id: "home",
    labelKey: "nav.home",
    path: "/",
    icon: (active: boolean) => (
      <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
        <path
          d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1V9.5z"
          stroke={active ? "#7A1C3B" : "#A08070"}
          strokeWidth="2"
          fill={active ? "rgba(122,28,59,0.13)" : "none"}
          strokeLinejoin="round"
        />
        <path
          d="M9 21V12h6v9"
          stroke={active ? "#7A1C3B" : "#A08070"}
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: "collection",
    labelKey: "nav.collection",
    path: "/collection",
    icon: (active: boolean) => (
      <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
        <rect
          x="8"
          y="3"
          width="12"
          height="16"
          rx="2"
          stroke={active ? "#7A1C3B" : "#A08070"}
          strokeWidth="2"
          fill={active ? "rgba(122,28,59,0.13)" : "none"}
        />
        <path
          d="M4 7v12a2 2 0 002 2h9"
          stroke={active ? "#7A1C3B" : "#A08070"}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    id: "arena",
    labelKey: "nav.arena",
    path: "/arena",
    icon: (active: boolean) => (
      <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
        {/* Crossed swords */}
        <line
          x1="4"
          y1="4"
          x2="20"
          y2="20"
          stroke={active ? "#7A1C3B" : "#A08070"}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <line
          x1="20"
          y1="4"
          x2="4"
          y2="20"
          stroke={active ? "#7A1C3B" : "#A08070"}
          strokeWidth="2"
          strokeLinecap="round"
        />
        <circle
          cx="12"
          cy="12"
          r="3"
          stroke={active ? "#7A1C3B" : "#A08070"}
          strokeWidth="2"
          fill={active ? "rgba(122,28,59,0.13)" : "none"}
        />
      </svg>
    ),
  },
  {
    id: "marketplace",
    labelKey: "nav.marketplace",
    path: "/marketplace",
    icon: (active: boolean) => (
      <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
        {(
          [
            [8, 8],
            [16, 8],
            [8, 16],
            [16, 16],
          ] as [number, number][]
        ).map(([cx, cy]) => (
          <circle
            key={`${cx}-${cy}`}
            cx={cx}
            cy={cy}
            r="2.5"
            stroke={active ? "#7A1C3B" : "#A08070"}
            strokeWidth="2"
            fill={active ? "rgba(122,28,59,0.13)" : "none"}
          />
        ))}
      </svg>
    ),
  },
  {
    id: "profile",
    labelKey: "nav.profile",
    path: "/profile",
    icon: (active: boolean) => (
      <IconUser size={23} color={active ? "#7A1C3B" : "#A08070"} />
    ),
  },
];

/** Écrans atteints depuis l'Arène : ils gardent son onglet allumé. */
const ARENA_PATHS = ["/arena", "/fight", "/decks", "/adventure", "/tutorial"];

export default function Footer() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const { pathname } = location;
  const activeId = ARENA_PATHS.some((p) => pathname.startsWith(p))
    ? "arena"
    : NAV_ITEMS.find((item) =>
        item.path === "/" ? pathname === "/" : pathname.startsWith(item.path),
      )?.id;

  return (
    <footer className="cc-footer">
      {NAV_ITEMS.map((item) => {
        const isActive = activeId === item.id;
        return (
          <button
            key={item.id}
            className={`cc-footer__item${isActive ? " cc-footer__item--active" : ""}`}
            onClick={() => {
              soundService.play("select");
              navigate(item.path);
            }}
            aria-label={t(item.labelKey)}
            aria-current={isActive ? "page" : undefined}
          >
            <span className="cc-footer__icon">{item.icon(isActive)}</span>
            <span className="cc-footer__label">{t(item.labelKey)}</span>
          </button>
        );
      })}
    </footer>
  );
}
