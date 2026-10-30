import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { GUARD_MAX_TURNS } from "@pipou/shared";
import {
  IconArmor,
  IconEgg,
  IconEvolve,
  IconGuard,
  IconHeart,
  IconHourglass,
  IconImmunity,
  IconPierce,
  IconReflect,
  IconSwords,
  IconTarget,
} from "../../../components/Icons";
import type { MonsterOnBoard } from "../fight.types";
import {
  immunityText,
  monsterBadges,
  splitBadges,
  type StatusBadge,
} from "../statusBadges";

const ICON_SIZE = 11;

function badgeIcon(badge: StatusBadge): ReactNode {
  switch (badge.id) {
    case "guard":
      return <IconGuard size={ICON_SIZE} />;
    case "endure":
      return <IconHeart size={ICON_SIZE} />;
    case "reflect":
      return <IconReflect size={ICON_SIZE} />;
    case "reduce":
      return <IconArmor size={ICON_SIZE} />;
    case "attacks":
      return <IconSwords size={ICON_SIZE} />;
    case "piercing":
      return <IconPierce size={ICON_SIZE} />;
    case "ignoreTaunt":
      return <IconTarget size={ICON_SIZE} />;
    case "immunity":
      return <IconImmunity size={ICON_SIZE + 2} quarters={badge.quarters!} />;
    case "hatch":
      return <IconEgg size={ICON_SIZE} />;
    case "countdown":
      return <IconHourglass size={ICON_SIZE} />;
    case "evolve":
      return <IconEvolve size={ICON_SIZE} />;
  }
}

/** Badges sous le nom : 3 au plus, puis « +N » (détail à l'inspection). */
export default function StatusBadges({ monster }: { monster: MonsterOnBoard }) {
  const { t, i18n } = useTranslation();
  const { shown, hidden } = splitBadges(monsterBadges(monster));
  if (shown.length === 0) return null;

  const title = (badge: StatusBadge): string => {
    switch (badge.id) {
      case "guard":
        return t("effects.status.guard", {
          turns: badge.count,
          max: GUARD_MAX_TURNS,
        });
      case "endure":
        return t("keywords.combatEndure.name");
      case "reflect":
        return t("effects.status.reflect", { value: monster.reflectPercent });
      case "reduce":
        return t("effects.status.damageReduction", {
          value: monster.damageReduction,
        });
      case "attacks":
        return monster.doubleAtkNextTurn
          ? t("effects.status.doubleAttack")
          : t("fight.badge.attacksLeft", { count: badge.count });
      case "piercing":
        return t("keywords.piercing.name");
      case "ignoreTaunt":
        return t("keywords.ignoreTaunt.name");
      case "immunity":
        return immunityText(badge.quarters!, t, i18n.language);
      case "hatch":
        return t("effects.status.hatch", { count: badge.count });
      case "countdown":
        return t("effects.status.countdown", { count: badge.count });
      case "evolve":
        return t("effects.status.canEvolve");
    }
  };

  return (
    <>
      {shown.map((badge) => {
        const full = badge.quarters?.every(Boolean);
        return (
          <span
            key={badge.id}
            className={[
              "zr-badge",
              `zr-badge--${badge.id}`,
              badge.urgent ? "zr-badge--urgent" : "",
              full ? "zr-badge--immunity-full" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            title={title(badge)}
          >
            {badgeIcon(badge)}
            {badge.id === "guard"
              ? `${badge.count}/${GUARD_MAX_TURNS}`
              : badge.count}
          </span>
        );
      })}
      {hidden > 0 && (
        <span
          className="zr-badge zr-badge--more"
          title={t("fight.badge.more", { count: hidden })}
        >
          +{hidden}
        </span>
      )}
    </>
  );
}
