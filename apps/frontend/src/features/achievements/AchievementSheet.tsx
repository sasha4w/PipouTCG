import { useTranslation } from "react-i18next";
import { nextAchievementTier, type AchievementProgress } from "@pipou/shared";
import BottomSheet from "../../components/BottomSheet";
import Button from "../../components/Button";
import { IconCheck } from "../../components/Icons";
import RewardLabel from "../quests/RewardLabel";
import "./Achievements.css";

interface Props {
  progress: AchievementProgress;
  claiming: boolean;
  onClaim: () => void;
  onClose: () => void;
}

export default function AchievementSheet({ progress, claiming, onClaim, onClose }: Props) {
  const { t } = useTranslation();
  const { family, value, tiers } = progress;
  const next = nextAchievementTier(progress);
  const pct = next ? Math.min(100, Math.round((value / Math.max(1, next.threshold)) * 100)) : 100;

  return (
    <BottomSheet
      title={t(`achievements.families.${family}`)}
      closeLabel={t("achievements.close")}
      onClose={onClose}
    >
      {next && (
        <div className="ach-sheet__progress">
          <div className="quest-item__bar">
            <div className="quest-item__bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <span className="quest-item__progress-text">
            {Math.min(value, next.threshold).toLocaleString()} / {next.threshold.toLocaleString()}
          </span>
        </div>
      )}

      <ol className="ach-sheet__tiers">
        {tiers.map((tier) => (
          <li
            key={tier.tier}
            className={`ach-sheet__tier${tier.claimed ? " ach-sheet__tier--claimed" : ""}${tier.reached && !tier.claimed ? " ach-sheet__tier--ready" : ""}`}
          >
            <span className={`ach-pip ach-pip--${tier.tier.toLowerCase()} ach-pip--on`} aria-hidden="true" />
            <span className="ach-sheet__goal">
              <span className="ach-sheet__tier-name">{t(`achievements.tiers.${tier.tier}`)}</span>
              <span>{t(`achievements.goals.${family}`, { n: tier.threshold.toLocaleString() })}</span>
            </span>
            <RewardLabel type={tier.reward.type} amount={tier.reward.amount} />
            <span className="ach-sheet__state">
              {tier.claimed ? (
                <IconCheck size={14} color="#eebc77" />
              ) : tier.reached ? null : (
                t("achievements.locked")
              )}
            </span>
          </li>
        ))}
      </ol>

      <p className="ach-sheet__title-reward">
        {t("achievements.unlocks_title", { title: t(`achievements.titles.${family}`) })}
      </p>

      {next ? (
        <Button variant="primary-inverse" onClick={onClaim} disabled={!next.reached || claiming}>
          {claiming ? "..." : t("achievements.claim")}
        </Button>
      ) : (
        <p className="ach-sheet__done">{t("achievements.all_done")}</p>
      )}
    </BottomSheet>
  );
}
