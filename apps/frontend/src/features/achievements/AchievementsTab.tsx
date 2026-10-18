import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AchievementTier, type AchievementFamily } from "@pipou/shared";
import { useAchievements, useClaimAchievement, useSetTitle } from "../../hooks/useGameData";
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
  const claim = useClaimAchievement();
  const setTitle = useSetTitle();
  const [openFamily, setOpenFamily] = useState<AchievementFamily | null>(null);

  if (isError) return <p className="quests-panel__empty">{t("achievements.error")}</p>;
  if (isLoading || !data) return <p className="quests-panel__empty">{t("achievements.loading")}</p>;

  const open = data.families.find((f) => f.family === openFamily) ?? null;
  const titles = data.families
    .filter((f) => f.claimedTier === AchievementTier.GOLD)
    .map((f) => f.family);

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

      <div className="ach-grid">
        {data.families.map((p) => (
          <AchievementTile key={p.family} progress={p} onOpen={() => setOpenFamily(p.family)} />
        ))}
      </div>

      {open && (
        <AchievementSheet
          progress={open}
          claiming={claim.isPending}
          onClaim={() => claim.mutate(open.family)}
          onClose={() => setOpenFamily(null)}
        />
      )}
    </div>
  );
}
