import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useSoundStore } from "../contexts/SoundContext";
import SoundSettings from "./SoundSettings";
import "./SoundButton.css";

export default function SoundButton() {
  const { muted } = useSoundStore();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Fermer en cliquant en dehors
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className="sound-widget" ref={ref}>
      <button
        className="sound-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("sound.label")}
      >
        {muted ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M11 5L6 9H2v6h4l5 4V5z"
              stroke="#7A1C3B"
              strokeWidth="2"
              strokeLinejoin="round"
              fill="rgba(122,28,59,0.1)"
            />
            <line
              x1="23"
              y1="9"
              x2="17"
              y2="15"
              stroke="#7A1C3B"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <line
              x1="17"
              y1="9"
              x2="23"
              y2="15"
              stroke="#7A1C3B"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M11 5L6 9H2v6h4l5 4V5z"
              stroke="#7A1C3B"
              strokeWidth="2"
              strokeLinejoin="round"
              fill="rgba(122,28,59,0.1)"
            />
            <path
              d="M15.54 8.46a5 5 0 010 7.07"
              stroke="#7A1C3B"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M19.07 4.93a10 10 0 010 14.14"
              stroke="#7A1C3B"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        )}
      </button>

      {open && (
        <div className="sound-widget__dropdown">
          <div className="sound-widget__header">
            <span className="sound-widget__title">{t("sound.label")}</span>
            <button
              className="sound-widget__close"
              onClick={() => setOpen(false)}
              aria-label="Fermer"
            >
              ✕
            </button>
          </div>
          <div className="sound-widget__body">
            <SoundSettings />
          </div>
        </div>
      )}
    </div>
  );
}
