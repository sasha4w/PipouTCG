import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import type { AdventureWorldView } from "@pipou/shared";
import Loading from "../../components/Loading";
import { IconArrowLeft, IconCheck, IconGift, IconLock } from "../../components/Icons";
import { sortWorlds, worldTheme } from "./adventureView";
import { useAdventureOverview } from "./useAdventureOverview";
import "./Adventure.css";

/** Écran 1 de l'aventure : la liste des mondes. */
export default function AdventureWorlds() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: overview, isLoading, isError } = useAdventureOverview();

  const renderWorld = (world: AdventureWorldView, index: number) => {
    const total = world.opponents.length;
    const label = t("adventure.world_label", { order: world.order, name: world.name });
    if (!world.unlocked) {
      return (
        <li key={world.id}>
          <div className="adv-world adv-world--locked" aria-disabled="true">
            <h2 className="adv-world__name">
              <IconLock size={15} />
              {t("adventure.world_short", { order: world.order })}
            </h2>
            <p className="adv-world__meta">
              {world.requires.length > 0
                ? t("adventure.requires", {
                    worlds: world.requires.map((r) => r.name).join(", "),
                  })
                : t("adventure.locked")}
            </p>
          </div>
        </li>
      );
    }
    const progress: CSSProperties = {
      width: `${total > 0 ? Math.round((world.beaten / total) * 100) : 0}%`,
    };
    return (
      <li key={world.id}>
        <button
          type="button"
          className={`adv-world adv-world--t${worldTheme(index)}`}
          onClick={() => navigate(`/adventure/${world.id}`)}
        >
          <h2 className="adv-world__name">
            {label}
            {world.completed && <IconCheck size={15} />}
          </h2>
          <p className="adv-world__meta">
            {world.completed
              ? t("adventure.completed", { count: world.beaten, total })
              : t("adventure.beaten", { count: world.beaten, total })}
          </p>
          <div className="adv-world__bar">
            <i style={progress} />
          </div>
        </button>
      </li>
    );
  };

  return (
    <div className="adv-root">
      <header className="adv-top">
        <button type="button" className="adv-back" onClick={() => navigate("/arena")}>
          <IconArrowLeft size={16} />
          {t("adventure.back_arena")}
        </button>
        <h1 className="adv-top__title">{t("adventure.title")}</h1>
        {overview && (
          <span className="adv-top__counter" title={t("adventure.rewards_today")}>
            <IconGift size={15} />
            {overview.farmRewardsToday}/{overview.dailyCap}
          </span>
        )}
      </header>

      <div className="adv-body">
        {isLoading && <Loading message={t("adventure.loading")} />}
        {isError && <p className="adv-msg">{t("adventure.error")}</p>}
        {overview && overview.worlds.length === 0 && (
          <p className="adv-msg">{t("adventure.empty")}</p>
        )}
        {overview && (
          <ul className="adv-worlds">{sortWorlds(overview.worlds).map(renderWorld)}</ul>
        )}
      </div>
    </div>
  );
}
