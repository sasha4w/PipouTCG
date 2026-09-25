import type { DefaultEventsMap, Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@pipou/shared';

/** Renseigné par FightsGateway.handleConnection à partir du cookie JWT. */
export interface FightSocketData {
  userId: number;
  username: string;
}

/** Serveur du namespace /fight : événements typés par le contrat partagé. */
export type FightServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  DefaultEventsMap,
  FightSocketData
>;

export type FightSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  DefaultEventsMap,
  FightSocketData
>;
