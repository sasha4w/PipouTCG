import { useState } from "react";
import { useTranslation } from "react-i18next";
import "./FightHUD.css";
import type { MyState, OppState, Phase } from "./fight.types";
import { HAND_LIMIT, STARTING_PRIMES } from "@pipou/shared";
import {
  IconCards,
  IconChest,
  IconFlag,
  IconHand,
  IconHourglass,
  IconScroll,
  IconSkull,
} from "../../components/Icons";
import PhaseMenu from "./PhaseMenu";
import { phaseOptions, type PhaseOption } from "./phaseOptions";

interface Props {
  me: MyState;
  opponent: OppState;
  phase: Phase;
  turnNumber: number;
  isMyTurn: boolean;
  /** null : pas de timer. */
  timeLeft: number | null;
  /** Taille de ma main : bloque « Finir le tour » au-delà de la limite. */
  handSize: number;
  onPickPhase: (option: PhaseOption) => void;
  onOpenLog: () => void;
  onOpenGraveyard: (side: "me" | "opponent") => void;
  /** Absent : pas de bouton d'abandon. */
  onSurrender?: () => void;
}

/** `primes` = primes restantes à récupérer ; les coffres se colorent à mesure qu'elles sont prises. */
function PrimesRow({ primes }: { primes: number }) {
  const { t } = useTranslation();
  return (
    <span
      className="hud-primes"
      title={t("fight.hud.primes", { count: primes })}
    >
      {Array.from({ length: STARTING_PRIMES }).map((_, i) => {
        const taken = i < STARTING_PRIMES - primes;
        return (
          <span key={i} className={`hud-prime${taken ? " hud-prime--earned" : ""}`}>
            <IconChest size={13} color={taken ? "#7a1c3b" : "#ccc"} />
          </span>
        );
      })}
    </span>
  );
}
export default function FightHUD({
  me,
  opponent,
  phase,
  turnNumber,
  isMyTurn,
  timeLeft,
  handSize,
  onPickPhase,
  onOpenLog,
  onOpenGraveyard,
  onSurrender,
}: Props) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const options = phaseOptions(phase, handSize);
  const canPickPhase = isMyTurn && options.length > 0;
  const chipClass = `hud-phase-chip hud-phase-chip--${isMyTurn ? "mine" : "theirs"}`;
  return (
    <div className="hud">
      {/* ── Ligne adversaire ── */}
      <div className="hud-row hud-row--opp">
        <span className="hud-name hud-name--opp">{opponent.username}</span>
        {opponent.title && (
          <span className="hud-title">
            {t(`achievements.titles.${opponent.title}`)}
          </span>
        )}
        <PrimesRow primes={opponent.primes} />
        <span
          className="hud-stat"
          title={t("fight.hud.deck", { count: opponent.deckCount })}
        >
          <IconCards size={12} color="currentColor" />
          {opponent.deckCount}
        </span>
        <span
          className="hud-stat"
          title={t("fight.hud.hand", { count: opponent.handCount })}
        >
          <IconHand size={12} color="currentColor" />
          {opponent.handCount}
        </span>
      </div>

      {/* ── Ligne centrale : phase + tour + timer ── */}
      <div className="hud-center">
        <span className="hud-phase-wrap">
          {canPickPhase ? (
            <button
              type="button"
              className={chipClass}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
            >
              {t(`fight.phase.${phase}`)}
            </button>
          ) : (
            <span className={chipClass}>{t(`fight.phase.${phase}`)}</span>
          )}
          {menuOpen && canPickPhase && (
            <PhaseMenu
              options={options}
              discardCount={Math.max(0, handSize - HAND_LIMIT)}
              onPick={(o) => {
                setMenuOpen(false);
                onPickPhase(o);
              }}
              onClose={() => setMenuOpen(false)}
            />
          )}
        </span>
        <span className="hud-turn-num">
          {t("fight.hud.turn", { count: turnNumber })}
        </span>
        {isMyTurn && timeLeft !== null && (
          <span
            className={`hud-timer${timeLeft < 20 ? " hud-timer--urgent" : ""}`}
          >
            <span className="hud-timer-icon">
              <IconHourglass size={12} />
            </span>
            {timeLeft}s
          </span>
        )}
        <span className="hud-actions">
          <button
            type="button"
            className="hud-icon-btn"
            aria-label={t("fight.hud.log")}
            onClick={onOpenLog}
          >
            <IconScroll size={16} />
          </button>
          <button
            type="button"
            className="hud-icon-btn"
            aria-label={t("fight.hud.myGraveyard", { count: me.graveyard.length })}
            disabled={me.graveyard.length === 0}
            onClick={() => onOpenGraveyard("me")}
          >
            <IconSkull size={16} />
          </button>
          <button
            type="button"
            className="hud-icon-btn hud-icon-btn--opp"
            aria-label={t("fight.hud.oppGraveyard", {
              count: opponent.graveyard.length,
            })}
            disabled={opponent.graveyard.length === 0}
            onClick={() => onOpenGraveyard("opponent")}
          >
            <IconSkull size={16} />
          </button>
          {onSurrender && (
            <button
              type="button"
              className="hud-icon-btn"
              aria-label={t("fight.hud.surrender")}
              onClick={onSurrender}
            >
              <IconFlag size={16} />
            </button>
          )}
        </span>
      </div>

      {/* ── Ligne moi ── */}
      <div className="hud-row hud-row--me">
        <span className="hud-name hud-name--me">{me.username}</span>
        {me.title && (
          <span className="hud-title">
            {t(`achievements.titles.${me.title}`)}
          </span>
        )}
        <PrimesRow primes={me.primes} />
        <span
          className="hud-stat"
          title={t("fight.hud.deck", { count: me.deckCount })}
        >
          <IconCards size={12} color="currentColor" />
          {me.deckCount}
        </span>
      </div>
    </div>
  );
}
