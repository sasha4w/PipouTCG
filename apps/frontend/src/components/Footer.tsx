import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { soundService } from "../services/sound.service";

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
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700&display=swap');
        .cc-footer { background: #F5EFE0; border-top: 1.5px solid rgba(61,16,32,0.10); display: flex; justify-content: space-around; align-items: center; padding: 8px 0 14px; }
        .cc-footer__item { display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer; background: none; border: none; padding: 6px 12px; border-radius: 14px; transition: background 0.18s ease, transform 0.12s ease; position: relative; }
        .cc-footer__item:hover { background: rgba(122,28,59,0.07); }
        .cc-footer__item--active { background: rgba(122,28,59,0.11); }
        .cc-footer__item--active::after { content: ''; position: absolute; bottom: -2px; left: 50%; transform: translateX(-50%); width: 4px; height: 4px; border-radius: 50%; background: #7A1C3B; }
        .cc-footer__item:active { transform: scale(0.90); }
        .cc-footer__label { font-family: 'Nunito', sans-serif; font-size: 10px; font-weight: 700; color: #A08070; transition: color 0.18s; letter-spacing: 0.15px; }
        .cc-footer__item--active .cc-footer__label { color: #7A1C3B; }
        .cc-footer__icon { transition: transform 0.18s ease; }
        .cc-footer__item--active .cc-footer__icon { transform: translateY(-2px); }
      `}</style>
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
    </>
  );
}
