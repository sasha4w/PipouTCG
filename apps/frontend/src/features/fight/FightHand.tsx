import "./FightHand.css";
import type { Phase, CardInstance } from "./fight.types";
import { RARITY_COLOR, FREE_SUMMON_CARD_ID } from "./fight.types";

export interface HandCard {
  id: number;
  name: string;
  type: string;
  atk: number;
  hp: number;
  cost: number;
  rarity: string;
  supportType?: string;
}

/** Converts a CardInstance (from server) to the flat HandCard shape */
export function toHandCard(c: CardInstance): HandCard {
  return {
    id: c.baseCard.id,
    name: c.baseCard.name,
    type: c.baseCard.type,
    atk: c.baseCard.atk,
    hp: c.baseCard.hp,
    cost: c.baseCard.cost,
    rarity: c.baseCard.rarity,
    supportType: c.baseCard.supportType ?? undefined,
  };
}

interface Props {
  hand: HandCard[];
  phase: Phase;
  isMyTurn: boolean;
  selectedCard: number | null;
  payIndices: number[];
  /** When true, card id=29 (Chevalier Touille) shows a FREE badge */
  freeSummonAvailable?: boolean;
  onCardClick: (idx: number, card: HandCard) => void;
}

export default function FightHand({
  hand,
  phase,
  isMyTurn,
  selectedCard,
  payIndices,
  freeSummonAvailable = false,
  onCardClick,
}: Props) {
  const isInteractive = isMyTurn && (phase === "main" || phase === "end");
  const mustDiscard = phase === "end" && isMyTurn && hand.length > 7;

  return (
    <div className="fhand">
      {hand.map((card, idx) => {
        const isSelected = selectedCard === idx;
        const isPaying = payIndices.includes(idx);
        const isPayable =
          !isSelected && selectedCard !== null && phase === "main";
        const isFree = freeSummonAvailable && card.id === FREE_SUMMON_CARD_ID;

        return (
          <div
            key={`${card.id}-${idx}`}
            className={[
              "fhand-card",
              `fhand-card--${card.type}`,
              isSelected ? "fhand-card--selected" : "",
              isPaying ? "fhand-card--paying" : "",
              isInteractive ? "fhand-card--interactive" : "",
              isPayable && !isPaying ? "fhand-card--payable" : "",
              phase === "end" && isMyTurn ? "fhand-card--discard-hint" : "",
              isFree ? "fhand-card--free" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{ borderColor: RARITY_COLOR[card.rarity] ?? "#666" }}
            onClick={() => isInteractive && onCardClick(idx, card)}
          >
            <div className="fhand-card-cost">
              {isFree ? (
                <span className="fhand-free-label">GRATUIT ⚡</span>
              ) : (
                `${card.cost ?? 0}⚡`
              )}
            </div>

            {isPaying && (
              <div className="fhand-pay-badge" title="Carte de paiement">
                💰
              </div>
            )}

            {isSelected && <div className="fhand-selected-badge">✓</div>}

            <div className="fhand-card-name">{card.name}</div>

            <div className="fhand-card-sub">
              {card.type === "monster"
                ? `${card.atk}⚔ ${card.hp}❤`
                : (card.supportType ?? card.type)}
            </div>

            {mustDiscard && (
              <div className="fhand-discard-label">défausser</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
