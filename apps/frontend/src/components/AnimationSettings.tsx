import { useTranslation } from "react-i18next";
import { useAnimationPrefs } from "../contexts/useAnimationPrefs";
import type { AnimationPreference } from "../contexts/animation-context";
import "./AnimationSettings.css";

const OPTIONS: AnimationPreference[] = ["auto", "full", "reduced"];

const isPreference = (v: string): v is AnimationPreference =>
  (OPTIONS as string[]).includes(v);

export default function AnimationSettings() {
  const { t } = useTranslation();
  const { preference, setPreference } = useAnimationPrefs();

  return (
    <label className="anim-settings">
      <span className="anim-settings__label">
        {t("settings.animations_label")}
      </span>
      <select
        className="anim-settings__select"
        value={preference}
        onChange={(e) => {
          if (isPreference(e.target.value)) setPreference(e.target.value);
        }}
      >
        {OPTIONS.map((o) => (
          <option key={o} value={o}>
            {t(`settings.animations_${o}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
