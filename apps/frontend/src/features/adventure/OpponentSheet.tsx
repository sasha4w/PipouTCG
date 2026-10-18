import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import type { AdventureOpponentView } from "@pipou/shared";
import BottomSheet from "../../components/BottomSheet";
import Button from "../../components/Button";
import DeckWidget from "../deck/DeckWidget";
import {
  IconBooster,
  IconCheck,
  IconCrown,
  IconGift,
  IconGold,
  IconRobot,
  IconSparkles,
  IconStar,
  IconSwords,
} from "../../components/Icons";
import { deckService } from "../../services/deck.service";
import { QUERY_KEYS } from "../../utils/querykeys";
import { capReached } from "./adventureView";

interface Props {
  opponent: AdventureOpponentView;
  farmRewardsToday: number;
  dailyCap: number;
  deckId: number | null;
  onSelectDeck: (deckId: number) => void;
  onFight: (deckId: number) => void;
  onClose: () => void;
}

function rewardRow(icon: ReactNode, label: string, value: ReactNode) {
  return (
    <li className="adv-sheet__row" key={label}>
      <span className="adv-sheet__row-label">
        {icon}
        {label}
      </span>
      {value}
    </li>
  );
}

/** Fiche d'une IA : récompenses, choix du deck, lancement du combat. */
export default function OpponentSheet({
  opponent,
  farmRewardsToday,
  dailyCap,
  deckId,
  onSelectDeck,
  onFight,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const { data: decks } = useQuery({
    queryKey: QUERY_KEYS.decks,
    queryFn: () => deckService.getMyDecks(),
    enabled: deckId !== null,
  });
  const deckName = decks?.find((d) => d.id === deckId)?.name;

  const neverBeaten = opponent.wins === 0;
  const capped = capReached({ farmRewardsToday, dailyCap });
  const { firstWin, farm } = opponent;
  const iconProps = { size: 16, className: "adv-sheet__icon" };

  return (
    <BottomSheet title={opponent.name} closeLabel={t("adventure.sheet.close")} onClose={onClose}>
      <div className="adv-sheet">
        <div className="adv-sheet__head">
          <div className={`adv-sheet__portrait${opponent.isBoss ? " adv-sheet__portrait--boss" : ""}`}>
            {opponent.portrait.imageUrl ? (
              <img
                src={opponent.portrait.imageUrl}
                alt={t("adventure.sheet.portrait_alt", { name: opponent.name })}
              />
            ) : (
              <IconRobot size={32} />
            )}
          </div>
          <div className="adv-sheet__id">
            <span className="adv-sheet__level">
              {opponent.isBoss && <IconCrown size={13} />}
              {t(opponent.isBoss ? "adventure.sheet.level_boss" : "adventure.sheet.level", {
                level: opponent.level,
              })}
            </span>
            {!neverBeaten && (
              <span className="adv-sheet__wins">
                <IconCheck size={12} />
                {t("adventure.sheet.wins", { count: opponent.wins })}
              </span>
            )}
            <p className="adv-sheet__quote">
              {t("adventure.sheet.quote", { quote: opponent.quote })}
            </p>
          </div>
        </div>

        {neverBeaten ? (
          <section>
            <h4 className="adv-sheet__section">{t("adventure.sheet.first_win")}</h4>
            <ul className="adv-sheet__rows">
              {rewardRow(<IconGold {...iconProps} />, t("adventure.sheet.gold"), <b>{firstWin.gold}</b>)}
              {rewardRow(<IconSparkles {...iconProps} />, t("adventure.sheet.xp"), <b>{firstWin.xp}</b>)}
              {firstWin.boosterName &&
                rewardRow(<IconBooster {...iconProps} />, firstWin.boosterName, <b>×1</b>)}
              {firstWin.legendary &&
                rewardRow(<IconStar {...iconProps} />, t("adventure.sheet.legendary"), <b>×1</b>)}
            </ul>
          </section>
        ) : (
          <>
            <section>
              <h4 className="adv-sheet__section">{t("adventure.sheet.farm")}</h4>
              <ul className="adv-sheet__rows">
                {rewardRow(<IconGold {...iconProps} />, t("adventure.sheet.gold"), <b>{farm.gold}</b>)}
                {rewardRow(<IconSparkles {...iconProps} />, t("adventure.sheet.xp"), <b>{farm.xp}</b>)}
              </ul>
            </section>
            <section>
              <h4 className="adv-sheet__section">{t("adventure.sheet.drops")}</h4>
              <ul className="adv-sheet__rows">
                {farm.boosterPct > 0 &&
                  rewardRow(
                    <IconBooster {...iconProps} />,
                    firstWin.boosterName ?? t("adventure.sheet.booster"),
                    <span className="adv-sheet__pill">{t("adventure.sheet.pct", { pct: farm.boosterPct })}</span>,
                  )}
                {farm.legendaryPct > 0 &&
                  rewardRow(
                    <IconStar {...iconProps} />,
                    t("adventure.sheet.legendary"),
                    <span className="adv-sheet__pill">{t("adventure.sheet.pct", { pct: farm.legendaryPct })}</span>,
                  )}
              </ul>
            </section>
            <p className="adv-sheet__today">
              <IconGift size={13} />
              {t("adventure.sheet.today", { count: farmRewardsToday, cap: dailyCap })}
            </p>
            {capped && <p className="adv-sheet__capped">{t("adventure.sheet.capped")}</p>}
          </>
        )}

        <div className="adv-sheet__deck">
          <p className="adv-sheet__deck-name">
            {deckName ? (
              <>
                {t("adventure.sheet.deck")} <b>{deckName}</b>
              </>
            ) : (
              t("adventure.sheet.no_deck")
            )}
          </p>
          <DeckWidget selectedDeckId={deckId ?? undefined} onSelectDeck={onSelectDeck} />
        </div>

        <Button
          size="lg"
          fullWidth
          disabled={deckId === null}
          onClick={() => deckId !== null && onFight(deckId)}
        >
          <IconSwords size={18} />
          {neverBeaten ? t("adventure.sheet.fight") : t("adventure.sheet.replay")}
        </Button>
      </div>
    </BottomSheet>
  );
}
