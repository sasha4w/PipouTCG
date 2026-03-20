import { useSoundStore } from "../contexts/SoundContext";
import "./SoundButton.css";

export default function SoundButton() {
  const { muted, toggleMute } = useSoundStore();

  return (
    <button
      className="sound-btn"
      onClick={toggleMute}
      aria-label={muted ? "Activer le son" : "Couper le son"}
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
  );
}
