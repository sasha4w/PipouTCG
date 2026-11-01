import { useTranslation } from "react-i18next";
import "./FightHUD.css";
import type { MyState, OppState, Phase } from "./fight.types";
import { STARTING_PRIMES } from "@pipou/shared";
import { IconChest, IconCards, IconHand } from "../../components/Icons";

interface Props {
  me: MyState;
  opponent: OppState;
  phase: Phase;
  turnNumber: number;
  isMyTurn: boolean;
  /** null : pas de timer. */
  timeLeft: number | null;
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
}: Props) {
  const { t } = useTranslation();
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
        <span className="hud-phase-chip">{t(`fight.phase.${phase}`)}</span>
        <span className="hud-turn-num">
          {t("fight.hud.turn", { count: turnNumber })}
        </span>
        {isMyTurn && timeLeft !== null && (
          <span
            className={`hud-timer${timeLeft < 20 ? " hud-timer--urgent" : ""}`}
          >
            <span className="hud-timer-icon">⏱</span>
            {timeLeft}s
          </span>
        )}
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
