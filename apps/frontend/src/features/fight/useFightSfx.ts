import { useEffect, useRef } from "react";
import type { FightEvent } from "@pipou/shared";
import { soundService, type SfxName } from "../../services/sound.service";
import { summonTier, type SummonTier } from "./fightEvents";
import {
  statusRisingEdges,
  type StatusFxId,
} from "./statusFx";
import type { BoardZone, GameState } from "./fight.types";

const SUMMON_SFX: Record<SummonTier, SfxName> = {
  1: "fightSummon1",
  2: "fightSummon2",
  3: "fightSummon3",
  4: "fightSummon4",
};

const STATUS_SFX: Partial<Record<StatusFxId, SfxName>> = {
  freeze: "fightFreeze",
  guardLock: "fightLock",
  stun: "fightStun",
  taunt: "fightTaunt",
  piercing: "fightPiercing",
  supportDestroyImmune: "fightImmune",
  supportDebuffImmune: "fightImmune",
  monsterDebuffImmune: "fightImmune",
  monsterStatusImmune: "fightImmune",
  immuneAll: "fightImmune",
  combatShield: "fightShield",
  combatEndure: "fightShield",
  reflect: "fightReflect",
  charge: "fightCharge",
  hatch: "fightHatch",
  countdown: "fightCountdown",
  evolve: "fightEvolve",
};

function playStatusEdges(
  prev: (BoardZone | null)[],
  next: (BoardZone | null)[],
) {
  const played = new Set<SfxName>();
  next.forEach((zone, idx) => {
    for (const id of statusRisingEdges(prev[idx], zone)) {
      const sfx = STATUS_SFX[id];
      if (sfx && !played.has(sfx)) {
        played.add(sfx);
        soundService.play(sfx);
      }
    }
  });
}

function playSummons(events: readonly FightEvent[]) {
  const played = new Set<SfxName>();
  for (const e of events) {
    if (e.kind !== "monster_summoned") continue;
    const sfx = SUMMON_SFX[summonTier(e.rarity)];
    if (!played.has(sfx)) {
      played.add(sfx);
      soundService.play(sfx);
    }
  }
}

function playHeals(events: readonly FightEvent[]) {
  if (events.some((e) => e.kind === "monster_healed"))
    soundService.play("fightHeal");
}

/** Sons d'invocation, de soin et de statut ; ignore le premier snapshot (reconnexion). */
export function useFightSfx(gs: GameState) {
  const primed = useRef(false);
  const prevMe = useRef<(BoardZone | null)[]>(gs.me.monsterZones);
  const prevOpp = useRef<(BoardZone | null)[]>(gs.opponent.monsterZones);

  useEffect(() => {
    const me = gs.me.monsterZones;
    const opp = gs.opponent.monsterZones;
    if (!primed.current) {
      primed.current = true;
      prevMe.current = me;
      prevOpp.current = opp;
      return;
    }
    playSummons(gs.events ?? []);
    playHeals(gs.events ?? []);
    playStatusEdges(prevMe.current, me);
    playStatusEdges(prevOpp.current, opp);
    prevMe.current = me;
    prevOpp.current = opp;
  }, [gs.events, gs.me.monsterZones, gs.opponent.monsterZones]);
}
