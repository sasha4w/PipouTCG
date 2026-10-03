import { useId, useState } from "react";
import type {
  CardInstance,
  CombatMode,
  GamePhase,
  MonsterOnBoard,
  SandboxDestination,
  SandboxMonsterPatch,
  SandboxSetupCommand,
  SandboxState,
  Seat,
} from "@pipou/shared";
import Button from "../../components/Button";

type OnCommand = (command: SandboxSetupCommand) => void;

const SEAT_LABEL: Record<Seat, string> = { p1: "J1", p2: "J2" };
const PHASES: GamePhase[] = ["main", "battle", "end"];

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        value={Number.isNaN(value) ? "" : value}
        onChange={(e) => onChange(e.target.valueAsNumber)}
      />
    </>
  );
}

/** Destination encodée dans une option de <select> : "hand", "monster:1"… */
function parseDestination(
  value: string,
  mode: CombatMode,
): SandboxDestination | null {
  const [zone, arg] = value.split(":");
  if (zone === "hand") return { zone: "hand" };
  if (zone === "graveyard") return { zone: "graveyard" };
  if (zone === "deck") return { zone: "deck", index: 0 };
  if (zone === "monster") return { zone: "monster", index: Number(arg), mode };
  if (zone === "support") return { zone: "support", index: Number(arg) };
  if (zone === "equipment") return { zone: "equipment", hostInstanceId: arg };
  return null;
}

/** Poser une carte de la main ou du deck n'importe où, sans coût ni effet. */
function PlaceCardForm({
  seat,
  hand,
  deck,
  monsters,
  supportCount,
  onCommand,
}: {
  seat: Seat;
  hand: CardInstance[];
  deck: CardInstance[];
  monsters: (MonsterOnBoard | null)[];
  supportCount: number;
  onCommand: OnCommand;
}) {
  const [instanceId, setInstanceId] = useState("");
  const [destination, setDestination] = useState(() => {
    const free = monsters.findIndex((m) => m === null);
    return free >= 0 ? `monster:${free}` : "hand";
  });
  const [mode, setMode] = useState<CombatMode>("attack");

  const place = () => {
    const to = parseDestination(destination, mode);
    if (instanceId && to)
      onCommand({ type: "move_card", seat, instanceId, to });
  };

  return (
    <div className="sb-form">
      <label htmlFor="sb-place-card">Carte</label>
      <select
        id="sb-place-card"
        value={instanceId}
        onChange={(e) => setInstanceId(e.target.value)}
      >
        <option value="">— choisir —</option>
        <optgroup label="Main">
          {hand.map((c) => (
            <option key={c.instanceId} value={c.instanceId}>
              {c.baseCard.name}
            </option>
          ))}
        </optgroup>
        <optgroup label="Deck">
          {deck.map((c, i) => (
            <option key={c.instanceId} value={c.instanceId}>
              {i + 1}. {c.baseCard.name}
            </option>
          ))}
        </optgroup>
      </select>

      <label htmlFor="sb-place-to">Vers</label>
      <select
        id="sb-place-to"
        value={destination}
        onChange={(e) => setDestination(e.target.value)}
      >
        {monsters.map((m, i) => (
          <option key={`m${i}`} value={`monster:${i}`} disabled={m !== null}>
            Zone monstre {i + 1}
          </option>
        ))}
        {Array.from({ length: supportCount }, (_, i) => (
          <option key={`s${i}`} value={`support:${i}`}>
            Zone support {i + 1}
          </option>
        ))}
        {monsters.map(
          (m) =>
            m && (
              <option
                key={`e${m.instanceId}`}
                value={`equipment:${m.instanceId}`}
              >
                Équiper sur {m.card.baseCard.name}
              </option>
            ),
        )}
        <option value="hand">Main</option>
        <option value="deck">Dessus du deck</option>
        <option value="graveyard">Cimetière</option>
      </select>

      <label htmlFor="sb-place-mode">Mode</label>
      <select
        id="sb-place-mode"
        value={mode}
        onChange={(e) => setMode(e.target.value as CombatMode)}
      >
        <option value="attack">Attaque</option>
        <option value="guard">Garde</option>
      </select>

      <span />
      <Button size="sm" disabled={!instanceId} onClick={place}>
        Placer
      </Button>
    </div>
  );
}

function initialPatch(
  m: MonsterOnBoard,
): Required<
  Pick<
    SandboxMonsterPatch,
    | "currentHp"
    | "atkBonus"
    | "hpBonus"
    | "attacksPerTurn"
    | "mode"
    | "taunt"
    | "piercing"
    | "summonedThisTurn"
  >
> & { blockAttackTurns: number } {
  return {
    currentHp: m.currentHp,
    atkBonus: m.perm.atk,
    hpBonus: m.perm.hp,
    attacksPerTurn: m.perm.attacksPerTurn,
    mode: m.mode,
    taunt: m.perm.taunt,
    piercing: m.perm.piercing,
    summonedThisTurn: m.summonedThisTurn,
    blockAttackTurns: m.blockAttackTurns ?? 0,
  };
}

/** Valeurs d'un monstre posé ; remonté (key) à chaque changement de monstre. */
function MonsterForm({
  seat,
  monster,
  onCommand,
}: {
  seat: Seat;
  monster: MonsterOnBoard;
  onCommand: OnCommand;
}) {
  const [patch, setPatch] = useState(() => initialPatch(monster));
  const set = <K extends keyof typeof patch>(
    key: K,
    value: (typeof patch)[K],
  ) => setPatch((p) => ({ ...p, [key]: value }));

  return (
    <div className="sb-form">
      <NumberField
        label="PV actuels"
        value={patch.currentHp}
        onChange={(v) => set("currentHp", v)}
      />
      <NumberField
        label="Bonus ATK"
        value={patch.atkBonus}
        onChange={(v) => set("atkBonus", v)}
      />
      <NumberField
        label="Bonus PV max"
        value={patch.hpBonus}
        onChange={(v) => set("hpBonus", v)}
      />
      <NumberField
        label="Attaques par tour"
        value={patch.attacksPerTurn}
        onChange={(v) => set("attacksPerTurn", v)}
      />
      <NumberField
        label="Tours de gel"
        value={patch.blockAttackTurns}
        onChange={(v) => set("blockAttackTurns", v)}
      />
      <label htmlFor="sb-monster-mode">Mode</label>
      <select
        id="sb-monster-mode"
        value={patch.mode}
        onChange={(e) => set("mode", e.target.value as CombatMode)}
      >
        <option value="attack">Attaque</option>
        <option value="guard">Garde</option>
      </select>
      {(
        [
          ["taunt", "Provocation"],
          ["piercing", "Perçant"],
          ["summonedThisTurn", "Invoqué ce tour"],
        ] as const
      ).map(([key, label]) => (
        <label key={key} style={{ gridColumn: "1 / -1" }}>
          <input
            type="checkbox"
            checked={patch[key]}
            onChange={(e) => set(key, e.target.checked)}
          />{" "}
          {label}
        </label>
      ))}
      <span />
      <Button
        size="sm"
        onClick={() =>
          onCommand({
            type: "edit_monster",
            seat,
            instanceId: monster.instanceId,
            patch: {
              ...patch,
              blockAttackTurns:
                patch.blockAttackTurns > 0 ? patch.blockAttackTurns : null,
            },
          })
        }
      >
        Appliquer au monstre
      </Button>
    </div>
  );
}

/** Primes et énergie de chaque joueur, phase, tour et joueur actif. */
function GameForm({
  state,
  onCommand,
}: {
  state: SandboxState;
  onCommand: OnCommand;
}) {
  const p1 = state.views.p1;
  const [players, setPlayers] = useState({
    p1: { primes: p1.me.primes, recycleEnergy: p1.me.recycleEnergy },
    p2: {
      primes: state.views.p2.me.primes,
      recycleEnergy: state.views.p2.me.recycleEnergy,
    },
  });
  const [phase, setPhase] = useState<GamePhase>(p1.phase);
  const [turnNumber, setTurnNumber] = useState(p1.turnNumber);
  const [activeSeat, setActiveSeat] = useState<Seat>(p1.isMyTurn ? "p1" : "p2");

  return (
    <div className="sb-form">
      {(["p1", "p2"] as const).map((s) => (
        <PlayerFields
          key={s}
          seat={s}
          value={players[s]}
          onChange={(v) => setPlayers((p) => ({ ...p, [s]: v }))}
          onApply={() =>
            onCommand({ type: "edit_player", seat: s, patch: players[s] })
          }
        />
      ))}
      <label htmlFor="sb-game-active">Joueur actif</label>
      <select
        id="sb-game-active"
        value={activeSeat}
        onChange={(e) => setActiveSeat(e.target.value as Seat)}
      >
        <option value="p1">J1</option>
        <option value="p2">J2</option>
      </select>
      <label htmlFor="sb-game-phase">Phase</label>
      <select
        id="sb-game-phase"
        value={phase}
        onChange={(e) => setPhase(e.target.value as GamePhase)}
      >
        {PHASES.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
      <NumberField label="Tour" value={turnNumber} onChange={setTurnNumber} />
      <span />
      <Button
        size="sm"
        onClick={() =>
          onCommand({
            type: "edit_game",
            patch: { phase, turnNumber, activeSeat },
          })
        }
      >
        Appliquer à la partie
      </Button>
    </div>
  );
}

function PlayerFields({
  seat,
  value,
  onChange,
  onApply,
}: {
  seat: Seat;
  value: { primes: number; recycleEnergy: number };
  onChange: (value: { primes: number; recycleEnergy: number }) => void;
  onApply: () => void;
}) {
  return (
    <>
      <NumberField
        label={`Primes ${SEAT_LABEL[seat]}`}
        value={value.primes}
        onChange={(primes) => onChange({ ...value, primes })}
      />
      <NumberField
        label={`Énergie ${SEAT_LABEL[seat]}`}
        value={value.recycleEnergy}
        onChange={(recycleEnergy) => onChange({ ...value, recycleEnergy })}
      />
      <span />
      <Button size="sm" variant="ghost-gold" onClick={onApply}>
        Appliquer à {SEAT_LABEL[seat]}
      </Button>
    </>
  );
}

interface Props {
  state: SandboxState;
  /** Siège affiché : la carte posée vient de sa main ou de son deck. */
  seat: Seat;
  onCommand: OnCommand;
}

/** Outils « mode dieu » : aucun effet déclenché, aucun coût. */
export default function SetupDrawer({ state, seat, onCommand }: Props) {
  const [monsterKey, setMonsterKey] = useState("");
  const me = state.views[seat].me;

  const allMonsters = (["p1", "p2"] as const).flatMap((s) =>
    state.views[s].me.monsterZones
      .filter((m): m is MonsterOnBoard => m !== null)
      .map((m) => ({ seat: s, monster: m, key: `${s}:${m.instanceId}` })),
  );
  const selected = allMonsters.find((m) => m.key === monsterKey);

  return (
    <section className="sb-panel" aria-label="Mise en place">
      <h3>🛠 Placer une carte ({SEAT_LABEL[seat]})</h3>
      <PlaceCardForm
        seat={seat}
        hand={me.hand}
        deck={state.decks[seat]}
        monsters={me.monsterZones}
        supportCount={me.supportZones.length}
        onCommand={onCommand}
      />

      <h3>🧬 Modifier un monstre</h3>
      <div className="sb-form">
        <label htmlFor="sb-monster">Monstre</label>
        <select
          id="sb-monster"
          value={monsterKey}
          onChange={(e) => setMonsterKey(e.target.value)}
        >
          <option value="">— choisir —</option>
          {allMonsters.map((m) => (
            <option key={m.key} value={m.key}>
              {SEAT_LABEL[m.seat]} · {m.monster.card.baseCard.name}
            </option>
          ))}
        </select>
      </div>
      {selected && (
        <MonsterForm
          key={selected.key}
          seat={selected.seat}
          monster={selected.monster}
          onCommand={onCommand}
        />
      )}

      <h3>🎲 Joueurs et partie</h3>
      <GameForm
        key={`${state.views.p1.turnNumber}-${state.views.p1.phase}-${state.views.p1.isMyTurn}`}
        state={state}
        onCommand={onCommand}
      />
    </section>
  );
}
