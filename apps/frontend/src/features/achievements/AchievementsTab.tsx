import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AchievementTier, type AchievementFamily } from "@pipou/shared";
import { useAchievements, useClaimAllAchievements, useSetTitle } from "../../hooks/useGameData";
import Button from "../../components/Button";
import AchievementTile from "./AchievementTile";
import AchievementSheet from "./AchievementSheet";
import "./Achievements.css";

function ProgressRing({ value, total }: { value: number; total: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const pct = total === 0 ? 0 : value / total;
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" className="ach-ring" aria-hidden="true">
      <circle cx="28" cy="28" r={r} className="ach-ring__track" />
      <circle
        cx="28"
        cy="28"
        r={r}
        className="ach-ring__fill"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct)}
        transform="rotate(-90 28 28)"
      />
      <text x="28" y="32" textAnchor="middle" className="ach-ring__label">
        {value}/{total}
      </text>
    </svg>
  );
}

export default function AchievementsTab() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useAchievements();
  const claimAll = useClaimAllAchievements();
  const setTitle = useSetTitle();
  const [openFamily, setOpenFamily] = useState<AchievementFamily | null>(null);

  if (isError) return <p className="quests-panel__empty">{t("achievements.error")}</p>;
  if (isLoading || !data) return <p className="quests-panel__empty">{t("achievements.loading")}</p>;

  const open = data.families.find((f) => f.family === openFamily) ?? null;
  const titles = data.families
    .filter((f) => f.claimedTier === AchievementTier.GOLD)
    .map((f) => f.family);
  const claimableTiers = data.families.reduce(
    (n, f) => n + f.tiers.filter((tier) => tier.reached && !tier.claimed).length,
    0,
  );

  return (
    <div className="ach">
      <div className="ach-header">
        <ProgressRing value={data.unlocked} total={data.total} />
        <div className="ach-header__info">
          <span className="ach-header__count">
            {t("achievements.unlocked", { count: data.unlocked, total: data.total })}
          </span>
          <label className="ach-header__title">
            <span>{t("achievements.title_label")}</span>
            <select
              value={data.equippedTitle ?? ""}
              disabled={setTitle.isPending}
              onChange={(e) => setTitle.mutate((e.target.value || null) as AchievementFamily | null)}
            >
              <option value="">{t("achievements.no_title")}</option>
              {titles.map((f) => (
                <option key={f} value={f}>
                  {t(`achievements.titles.${f}`)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {claimableTiers > 0 && (
        <Button
          variant="primary-inverse"
          onClick={() => claimAll.mutate(undefined)}
          disabled={claimAll.isPending}
        >
          {claimAll.isPending ? "..." : `${t("achievements.claim_all")} (${claimableTiers})`}
        </Button>
      )}

      <div className="ach-grid">
        {data.families.map((p) => (
          <AchievementTile key={p.family} progress={p} onOpen={() => setOpenFamily(p.family)} />
        ))}
      </div>

      {open && (
        <AchievementSheet
          progress={open}
          claiming={claimAll.isPending}
          onClaim={() => claimAll.mutate(open.family)}
          onClose={() => setOpenFamily(null)}
        />
      )}
    </div>
  );
}
