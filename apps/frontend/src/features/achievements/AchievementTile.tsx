import { useTranslation } from "react-i18next";
import { isAchievementClaimable, type AchievementProgress } from "@pipou/shared";
import { FAMILY_ICON } from "./achievementIcons";
import "./Achievements.css";

interface Props {
  progress: AchievementProgress;
  onOpen: () => void;
}

export default function AchievementTile({ progress, onOpen }: Props) {
  const { t } = useTranslation();
  const Icon = FAMILY_ICON[progress.family];
  const claimable = isAchievementClaimable(progress);

  return (
    <button
      type="button"
      className={`ach-tile${claimable ? " ach-tile--claimable" : ""}`}
      onClick={onOpen}
    >
      <span className="ach-tile__icon">
        <Icon size={22} color="#eebc77" />
      </span>
      <span className="ach-tile__name">{t(`achievements.families.${progress.family}`)}</span>
      <span className="ach-tile__pips" aria-hidden="true">
        {progress.tiers.map((tier) => (
          <span
            key={tier.tier}
            className={`ach-pip ach-pip--${tier.tier.toLowerCase()}${tier.claimed ? " ach-pip--on" : ""}`}
          />
        ))}
      </span>
    </button>
  );
}
