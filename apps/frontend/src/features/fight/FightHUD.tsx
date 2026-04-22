import "./FightHUD.css";
import type { MyState, OppState, Phase } from "./fight.types";
import { PHASE_LABEL } from "./fight.types";

interface Props {
  me: MyState;
  opponent: OppState;
  phase: Phase;
  turnNumber: number;
  isMyTurn: boolean;
  timeLeft: number;
}

export default function FightHUD({ me, opponent, phase, turnNumber, isMyTurn, timeLeft }: Props) {
  return (
    <div className="hud">
      <div className="hud-left">
        <span className="hud-name">{opponent.username}</span>
        <span className="hud-primes">
          {"💎".repeat(opponent.primes)}{"○".repeat(Math.max(0, 6 - opponent.primes))}
        </span>
        <span className="hud-secondary">📚 {opponent.deckCount}</span>
        <span className="hud-secondary">🤚 {opponent.handCount}</span>
      </div>

      <div className="hud-center">
        <span className="hud-phase-chip">{PHASE_LABEL[phase]}</span>
        <span className="hud-turn-num">Tour {turnNumber}</span>
        {isMyTurn && (
          <span className={`hud-timer${timeLeft < 20 ? " hud-timer--urgent" : ""}`}>
            ⏱ {timeLeft}s
          </span>
        )}
      </div>

      <div className="hud-right">
        <span className="hud-secondary">📚 {me.deckCount}</span>
        <span className="hud-primes">
          {"💎".repeat(me.primes)}{"○".repeat(Math.max(0, 6 - me.primes))}
        </span>
        <span className="hud-name">{me.username}</span>
      </div>
    </div>
  );
}
