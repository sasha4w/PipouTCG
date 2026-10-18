import { useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import type { AdventureOpponentView } from "@pipou/shared";
import Loading from "../../components/Loading";
import { IconArrowLeft, IconCheck, IconCrown, IconLock } from "../../components/Icons";
import OpponentSheet from "./OpponentSheet";
import { pathLayout } from "./adventureView";
import { useAdventureOverview } from "./useAdventureOverview";
import "./Adventure.css";

function nodeContent(opponent: AdventureOpponentView) {
  if (opponent.isBoss) return <IconCrown size={28} />;
  if (opponent.state === "beaten") return <IconCheck size={22} />;
  if (opponent.state === "locked") return <IconLock size={18} />;
  return opponent.position;
}

/** Écran 2 de l'aventure : le chemin des 5 IA d'un monde. */
export default function AdventurePath() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { worldId } = useParams();
  const [searchParams] = useSearchParams();
  const { data: overview, isLoading, isError } = useAdventureOverview();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  // Le deck choisi survit à un aller-retour par le combat (?deck=)
  const [deckId, setDeckId] = useState<number | null>(() => {
    const fromUrl = Number(searchParams.get("deck"));
    return Number.isInteger(fromUrl) && fromUrl > 0 ? fromUrl : null;
  });

  const world = overview?.worlds.find((w) => w.id === Number(worldId));
  const opponents = world ? [...world.opponents].sort((a, b) => a.position - b.position) : [];
  const layout = pathLayout(opponents.length);
  const selected = opponents.find((o) => o.id === selectedId && o.state !== "locked");

  const renderNode = (opponent: AdventureOpponentView, index: number) => {
    const style = { "--adv-offset": layout[index].offset } as CSSProperties;
    const classes = ["adv-node", `adv-node--${opponent.state}`];
    if (opponent.isBoss) classes.push("adv-node--boss");
    return (
      <li key={opponent.id} className="adv-path__step" style={style}>
        <button
          type="button"
          className={classes.join(" ")}
          disabled={opponent.state === "locked"}
          onClick={() => setSelectedId(opponent.id)}
          aria-label={t("adventure.node_label", {
            name: opponent.name,
            level: opponent.level,
            state: t(`adventure.state.${opponent.state}`),
          })}
        >
          {nodeContent(opponent)}
        </button>
      </li>
    );
  };

  return (
    <div className="adv-root">
      <header className="adv-top">
        <button type="button" className="adv-back" onClick={() => navigate("/adventure")}>
          <IconArrowLeft size={16} />
          {t("adventure.back_worlds")}
        </button>
        <h1 className="adv-top__title">
          {world ? t("adventure.world_label", { order: world.order, name: world.name }) : t("adventure.title")}
        </h1>
        {world && (
          <span className="adv-top__counter">
            {world.beaten}/{opponents.length}
          </span>
        )}
      </header>

      <div className="adv-body">
        {isLoading && <Loading message={t("adventure.loading")} />}
        {isError && <p className="adv-msg">{t("adventure.error")}</p>}
        {overview && (!world || !world.unlocked) && (
          <p className="adv-msg">{t("adventure.not_found")}</p>
        )}
        {world?.unlocked && (
          <>
            {/* Boss en haut : on affiche le chemin du dernier au premier */}
            <ol className="adv-path">
              {opponents.map(renderNode).reverse()}
            </ol>
            <p className="adv-path__hint">{t("adventure.path_hint")}</p>
          </>
        )}
      </div>

      {overview && selected && (
        <OpponentSheet
          opponent={selected}
          farmRewardsToday={overview.farmRewardsToday}
          dailyCap={overview.dailyCap}
          deckId={deckId}
          onSelectDeck={setDeckId}
          onFight={(deck) => navigate(`/adventure/fight/${selected.id}?deck=${deck}`)}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}
