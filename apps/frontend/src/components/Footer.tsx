import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { soundService } from "../services/sound.service";
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
    id: "profile",
    labelKey: "nav.profile",
    path: "/profile",
    icon: (active: boolean) => (
      <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
        <circle
          cx="12"
          cy="8"
          r="4"
          stroke={active ? "#7A1C3B" : "#A08070"}
          strokeWidth="2"
          fill={active ? "rgba(122,28,59,0.13)" : "none"}
        />
        <path
          d="M4 20c0-3.314 3.582-6 8-6s8 2.686 8 6"
          stroke={active ? "#7A1C3B" : "#A08070"}
          strokeWidth="2"
          strokeLinecap="round"
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
    id: "settings",
    labelKey: "nav.settings",
    path: "/settings",
    icon: (active: boolean) => (
      <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
        <circle
          cx="12"
          cy="12"
          r="3"
          stroke={active ? "#7A1C3B" : "#A08070"}
          strokeWidth="2"
          fill={active ? "rgba(122,28,59,0.13)" : "none"}
        />
        <path
          d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
          stroke={active ? "#7A1C3B" : "#A08070"}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

export default function Footer() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();

  const activeId =
    NAV_ITEMS.find((item) =>
      item.path === "/"
        ? location.pathname === "/"
        : location.pathname.startsWith(item.path),
    )?.id ?? "home";

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
