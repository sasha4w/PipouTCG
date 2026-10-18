import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Rarity, type AdventureResultPayload } from "@pipou/shared";
import Button from "../../components/Button";
import {
  IconBooster,
  IconCrown,
  IconGold,
  IconSparkles,
  IconStar,
  IconTrophy,
  IconUnlock,
} from "../../components/Icons";

interface Props {
  /** null : partie terminée sans résultat d'aventure (inattendu). */
  result: AdventureResultPayload | null;
  won: boolean;
  draw: boolean;
  worldOrder: number | null;
  /** Noms des mondes débloqués par cette victoire. */
  unlockedWorlds: string[];
  /** Absent : pas de deck connu, on ne propose que le retour. */
  onReplay?: () => void;
  onBack: () => void;
}

/** Fin d'un combat d'aventure : victoire avec butin, ou défaite. */
export default function AdventureResult({
  result,
  won,
  draw,
  worldOrder,
  unlockedWorlds,
  onReplay,
  onBack,
}: Props) {
  const { t } = useTranslation();
  const loot = won ? (result?.loot ?? null) : null;
  const title = won
    ? t("adventure.result.victory")
    : draw
      ? t("adventure.result.draw")
      : t("adventure.result.defeat");

  return (
    <div className="adv-result">
      <h2 className={`adv-result__title${won ? " adv-result__title--win" : ""}`}>{title}</h2>

      {won && result?.worldCompleted && worldOrder !== null && (
        <span className="adv-result__badge">
          <IconCrown size={15} />
          {t("adventure.result.world_completed", { order: worldOrder })}
        </span>
      )}

      {!won && !draw && <p className="adv-result__hint">{t("adventure.result.defeat_hint")}</p>}

      {won && !result && (
        <p className="adv-result__hint">{t("adventure.result.unavailable")}</p>
      )}

      {won && result && (
        <ul className="adv-loot">
          {loot && loot.gold > 0 && (
            <li className="adv-loot__tile">
              <IconGold size={26} />
              {t("adventure.result.gold", { n: loot.gold })}
            </li>
          )}
          {loot && loot.xp > 0 && (
            <li className="adv-loot__tile">
              <IconSparkles size={26} />
              {t("adventure.result.xp", { n: loot.xp })}
            </li>
          )}
          {loot?.boosters.map((b) => (
            <li key={`b${b.boosterId}`} className="adv-loot__tile">
              <IconBooster size={26} />
              {t("adventure.result.booster", { name: b.name, qty: b.quantity })}
            </li>
          ))}
          {result.worldCompleted && (
            <li className="adv-loot__tile">
              <Link to="/profile?tab=achievements" className="adv-loot__link">
                <IconTrophy size={26} />
                {t("adventure.result.achievement")}
              </Link>
            </li>
          )}
          {loot?.cards.map((c) => (
            <li
              key={`c${c.cardId}`}
              className={`adv-loot__tile${c.rarity === Rarity.LEGENDARY ? " adv-loot__tile--legend" : ""}`}
            >
              {c.imageUrl ? (
                <img className="adv-loot__card" src={c.imageUrl} alt="" />
              ) : (
                <IconStar size={26} />
              )}
              {c.rarity === Rarity.LEGENDARY
                ? t("adventure.result.legendary", { name: c.name })
                : c.name}
            </li>
          ))}
        </ul>
      )}

      {loot?.capped && <p className="adv-result__capped">{t("adventure.result.capped")}</p>}

      {unlockedWorlds.map((name) => (
        <p key={name} className="adv-result__unlock">
          <IconUnlock size={15} />
          {t("adventure.result.unlocked", { name })}
        </p>
      ))}

      <div className="adv-result__actions">
        {onReplay && (
          <Button variant="ghost-bordeaux" onClick={onReplay}>
            {t("adventure.result.replay")}
          </Button>
        )}
        <Button onClick={onBack}>{t("adventure.result.back")}</Button>
      </div>
    </div>
  );
}
