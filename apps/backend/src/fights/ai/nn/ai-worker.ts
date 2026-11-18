import { parentPort, workerData } from 'node:worker_threads';
import type { Card } from '../../../cards/card.entity';
import { setEvolutionCatalog } from '../../helpers/evolution-catalog';
import { createAiEngine } from '../ai-engine';
import type { FromWorker, ToWorker } from '../ai-mover';
import type { AiPlayer } from '../ai-player';
import type { DecisionRecord } from '../decision-log';
import { createLevelAi } from '../level-brains';

/**
 * Thread de réflexion de l'IA d'aventure : un AiPlayer par partie (il garde son
 * plan d'un coup à l'autre), poids du réseau chargés une fois.
 */
const port = parentPort!;
setEvolutionCatalog((workerData as { catalog: Card[] }).catalog);
const engine = createAiEngine();
const players = new Map<number, AiPlayer>();
let records: DecisionRecord[] = [];

port.on('message', (msg: ToWorker) => {
  if (msg.type === 'dispose') {
    players.delete(msg.matchId);
    return;
  }
  let ai = players.get(msg.matchId);
  if (!ai) {
    ai = createLevelAi(engine, msg.level);
    if (msg.log !== null) ai.setDecisionSink((r) => records.push(r), msg.log);
    players.set(msg.matchId, ai);
  }
  records = [];
  let reply: FromWorker;
  try {
    const action = ai.chooseAction(msg.game, msg.seat, msg.profile);
    reply = { type: 'decided', id: msg.id, action, records };
  } catch (err) {
    reply = {
      type: 'failed',
      id: msg.id,
      message: err instanceof Error ? err.message : String(err),
    };
  }
  port.postMessage(reply);
});
