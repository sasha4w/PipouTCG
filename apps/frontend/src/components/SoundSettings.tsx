import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { useSoundStore } from "../contexts/SoundContext";
import "./SoundSettings.css";

interface VolumeRowProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled: boolean;
  muted: boolean;
  onToggleMute: () => void;
}

function VolumeRow({
  label,
  value,
  onChange,
  disabled,
  muted,
  onToggleMute,
}: VolumeRowProps) {
  const { t } = useTranslation();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const step = (delta: number) =>
    onChange(Math.min(1, Math.max(0, Math.round((value + delta) * 100) / 100)));

  const startHold = (delta: number) => {
    step(delta);
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => step(delta), 80);
    }, 400);
  };

  const stopHold = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const handleBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(
      1,
      Math.max(0, (e.clientX - rect.left) / rect.width),
    );
    onChange(Math.round(ratio * 100) / 100);
  };

  const isDisabled = disabled || muted;

  return (
    <div className="sound-row">
      <div className="sound-row__header">
        <span className="sound-row__label">{label}</span>
        <div className="sound-row__header-right">
          <span className="sound-row__value">{Math.round(value * 100)}%</span>
          <label className="sound-mute-check">
            <input
              type="checkbox"
              checked={muted}
              onChange={onToggleMute}
              disabled={disabled}
            />
            <span className="sound-mute-check__text">{t("sound.mute")}</span>
          </label>
        </div>
      </div>
      <div className="sound-row__controls">
        <button
          className="sound-row__btn"
          onMouseDown={() => startHold(-0.05)}
          onMouseUp={stopHold}
          onMouseLeave={stopHold}
          onTouchStart={() => startHold(-0.05)}
          onTouchEnd={stopHold}
          disabled={isDisabled || value <= 0}
          aria-label={t("sound.decrease")}
        >
          −
        </button>
        <div
          className={`sound-row__bar-wrap${isDisabled ? " sound-row__bar-wrap--disabled" : ""}`}
          onClick={handleBarClick}
        >
          <div
            className="sound-row__bar-fill"
            style={{ width: `${value * 100}%` }}
          />
        </div>
        <button
          className="sound-row__btn"
          onMouseDown={() => startHold(0.05)}
          onMouseUp={stopHold}
          onMouseLeave={stopHold}
          onTouchStart={() => startHold(0.05)}
          onTouchEnd={stopHold}
          disabled={isDisabled || value >= 1}
          aria-label={t("sound.increase")}
        >
          +
        </button>
      </div>
    </div>
  );
}

export default function SoundSettings() {
  const { t } = useTranslation();
  const {
    masterVolume,
    bgmVolume,
    sfxVolume,
    muted,
    bgmMuted,
    sfxMuted,
    setMasterVolume,
    setBgmVolume,
    setSfxVolume,
    toggleMute,
    toggleBgmMute,
    toggleSfxMute,
  } = useSoundStore();

  return (
    <div className="sound-volume">
      <div className="sound-mute-row">
        <span className="sound-mute-label">{t("sound.label")}</span>
        <label className="sound-mute-check">
          <input type="checkbox" checked={muted} onChange={toggleMute} />
          <span className="sound-mute-check__text">{t("sound.mute_all")}</span>
        </label>
      </div>

      <div className="sound-row">
        <div className="sound-row__header">
          <span className="sound-row__label">{t("sound.master")}</span>
          <span className="sound-row__value">
            {Math.round(masterVolume * 100)}%
          </span>
        </div>
        <div className="sound-row__controls">
          <button
            className="sound-row__btn"
            disabled={muted || masterVolume <= 0}
            onMouseDown={() =>
              setMasterVolume(
                Math.max(0, Math.round((masterVolume - 0.05) * 100) / 100),
              )
            }
            aria-label={t("sound.decrease")}
          >
            −
          </button>
          <div
            className={`sound-row__bar-wrap${muted ? " sound-row__bar-wrap--disabled" : ""}`}
          >
            <div
              className="sound-row__bar-fill"
              style={{ width: `${masterVolume * 100}%` }}
            />
          </div>
          <button
            className="sound-row__btn"
            disabled={muted || masterVolume >= 1}
            onMouseDown={() =>
              setMasterVolume(
                Math.min(1, Math.round((masterVolume + 0.05) * 100) / 100),
              )
            }
            aria-label={t("sound.increase")}
          >
            +
          </button>
        </div>
      </div>

      <VolumeRow
        label={t("sound.music")}
        value={bgmVolume}
        onChange={setBgmVolume}
        disabled={muted}
        muted={bgmMuted}
        onToggleMute={toggleBgmMute}
      />
      <VolumeRow
        label={t("sound.sfx")}
        value={sfxVolume}
        onChange={setSfxVolume}
        disabled={muted}
        muted={sfxMuted}
        onToggleMute={toggleSfxMute}
      />
    </div>
  );
}
