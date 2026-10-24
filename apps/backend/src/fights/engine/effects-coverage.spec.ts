import {
  ActionType,
  CardType,
  EffectConditionType,
  EffectTarget,
  EffectTrigger,
  SupportType,
  canSummonFromHand,
  canSummonOnEnemySide,
  ephemeralTargetSide,
  isTargetableByEphemeral,
} from '@pipou/shared';
import type { Card } from '../../cards/card.entity';
import { createEngine } from '../testing/engine';
import { monsterCard } from '../testing/cards';
import { allRealCards } from '../testing/real-cards';
import { P1_ID, monsterNamed, scenario } from '../testing/scenario';
import {
  SUPPORTED_ACTIONS,
  SUPPORTED_CONDITIONS,
  SUPPORTED_TARGETS,
  SUPPORTED_TRIGGERS,
} from './supported-effects';

const sorted = (values: Iterable<string>) => [...values].sort();

describe('couverture des effets', () => {
  it("le moteur déclare gérer chaque valeur des enums d'effets", () => {
    expect(sorted(SUPPORTED_TRIGGERS)).toEqual(
      sorted(Object.values(EffectTrigger)),
    );
    expect(sorted(SUPPORTED_CONDITIONS)).toEqual(
      sorted(Object.values(EffectConditionType)),
    );
    expect(sorted(SUPPORTED_ACTIONS)).toEqual(
      sorted(Object.values(ActionType)),
    );
    expect(sorted(SUPPORTED_TARGETS)).toEqual(
      sorted(Object.values(EffectTarget)),
    );
  });

  it("les vraies cartes n'utilisent que des effets gérés", () => {
    const problems: string[] = [];
    for (const card of allRealCards()) {
      for (const eff of card.effects ?? []) {
        if (!SUPPORTED_TRIGGERS.has(eff.trigger))
          problems.push(`${card.name} : déclencheur ${eff.trigger}`);
        if (eff.condition && !SUPPORTED_CONDITIONS.has(eff.condition.type))
          problems.push(`${card.name} : condition ${eff.condition.type}`);
        for (const a of eff.actions) {
          if (!SUPPORTED_ACTIONS.has(a.type))
            problems.push(`${card.name} : action ${a.type}`);
          if (!SUPPORTED_TARGETS.has(a.target))
            problems.push(`${card.name} : cible ${a.target}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  describe('chaque vraie carte se joue sans erreur', () => {
    const engine = createEngine();

    function play(card: Card) {
      // Jeune / Adulte Drakon : il n'arrive que par évolution, sur le stade
      // précédent de sa lignée
      const evolvesOnly = !canSummonFromHand(card);
      const allyName = card.name === 'Force Plasma' ? 'Noyau Delta' : 'Allié';
      const base = monsterCard('Base', {
        archetype: 'dragon',
        lineage: card.lineage,
        stage:
          card.stage === 'ancestral'
            ? 'adult'
            : card.stage === 'adult'
              ? 'young'
              : 'baby',
      });
      const game = scenario({
        p1: {
          hand: [card],
          // Cimetière et deck garnis : les cartes de récupération ont de quoi faire
          graveyard: allRealCards(),
          deck: allRealCards(),
          // 4 : coût des Ancestraux et du Drakon des Origines
          recycleEnergy: 4,
          monsters: [
            // Force Plasma exige un Noyau en jeu
            monsterCard(allyName, { hp: 5000, archetype: 'dragon' }),
            // Drakon posé ce tour : cible utile pour les accélérateurs (Incubation)
            {
              card: monsterCard('Drakon posé', {
                archetype: 'dragon',
                stage: 'baby',
              }),
              summonedThisTurn: true,
            },
            ...(evolvesOnly ? [base] : []),
          ],
        },
        p2: {
          monsters: [
            monsterCard('Ennemi', { hp: 5000 }),
            // Mise à jour .patch exige un Zeta implanté par p1, compteur en cours
            ...(card.name === 'Mise à jour .patch'
              ? [
                  {
                    card: monsterCard('Zeta implanté'),
                    patch: { ownerUserId: P1_ID, turnCounter: 2 },
                  },
                ]
              : []),
          ],
        },
      });
      const ally = monsterNamed(game, 'p1', allyName);
      const allyTarget = (c: Card) =>
        game.player1.monsterZones.find(
          (m) => !!m && isTargetableByEphemeral(m, 'ally', c.effects),
        ) ?? ally;
      const enemy = monsterNamed(game, 'p2', 'Ennemi');

      if (evolvesOnly)
        return engine.dispatch(game, 'p1', {
          type: 'evolve',
          handIndex: 0,
          targetInstanceId: monsterNamed(game, 'p1', 'Base').instanceId,
          paymentHandIndices: [],
        });
      if (card.type === CardType.MONSTER)
        return engine.dispatch(game, 'p1', {
          type: 'summon',
          handIndex: 0,
          zoneIndex: 2,
          paymentHandIndices: [],
          onOpponentSide: canSummonOnEnemySide(card.effects),
        });
      if (card.supportType === SupportType.EQUIPMENT)
        return engine.dispatch(game, 'p1', {
          type: 'play_support',
          handIndex: 0,
          targetInstanceId: ally.instanceId,
        });
      if (card.supportType === SupportType.TERRAIN)
        return engine.dispatch(game, 'p1', {
          type: 'play_support',
          handIndex: 0,
          zoneIndex: 0,
        });

      const side = ephemeralTargetSide(card.effects);
      return engine.dispatch(game, 'p1', {
        type: 'play_support',
        handIndex: 0,
        targetInstanceId:
          side === 'ally'
            ? allyTarget(card).instanceId
            : side === 'enemy'
              ? enemy.instanceId
              : undefined,
      });
    }

    it.each(allRealCards().map((c) => [`#${c.id} ${c.name}`, c] as const))(
      '%s',
      (_label, card) => {
        expect(play(card)).toEqual({});
      },
    );
  });
});
