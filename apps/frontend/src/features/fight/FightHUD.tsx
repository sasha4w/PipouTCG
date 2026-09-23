import "./FightHUD.css";
import type { MyState, OppState, Phase } from "./fight.types";
import { PHASE_LABEL } from "./fight.types";
import { IconChest, IconCards, IconHand } from "../../components/Icons";

interface Props {
  me: MyState;
  opponent: OppState;
  phase: Phase;
  turnNumber: number;
  isMyTurn: boolean;
  timeLeft: number;
}

function PrimesRow({ primes }: { primes: number }) {
  return (
    <span
      className="hud-primes"
      title={`${primes} prime${primes > 1 ? "s" : ""}`}
    >
      {Array.from({ length: 6 }).map((_, i) => (
        <span
          key={i}
          className={`hud-prime${i < primes ? " hud-prime--earned" : ""}`}
        >
          <IconChest size={13} color={i < primes ? "#7a1c3b" : "#ccc"} />
        </span>
      ))}
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
  return (
    <div className="hud">
      {/* ── Ligne adversaire ── */}
      <div className="hud-row hud-row--opp">
        <span className="hud-name hud-name--opp">{opponent.username}</span>
        <PrimesRow primes={opponent.primes} />
        <span
          className="hud-stat"
          title={`${opponent.deckCount} cartes dans le deck`}
        >
          <IconCards size={12} color="currentColor" />
          {opponent.deckCount}
        </span>
        <span
          className="hud-stat"
          title={`${opponent.handCount} cartes en main`}
        >
          <IconHand size={12} color="currentColor" />
          {opponent.handCount}
        </span>
      </div>

      {/* ── Ligne centrale : phase + tour + timer ── */}
      <div className="hud-center">
        <span className="hud-phase-chip">{PHASE_LABEL[phase]}</span>
        <span className="hud-turn-num">Tour {turnNumber}</span>
        {isMyTurn && (
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
        <PrimesRow primes={me.primes} />
        <span
          className="hud-stat"
          title={`${me.deckCount} cartes dans le deck`}
        >
          <IconCards size={12} color="currentColor" />
          {me.deckCount}
        </span>
      </div>
    </div>
  );
}
