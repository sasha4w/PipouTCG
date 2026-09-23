import type { DefaultEventsMap, Socket } from 'socket.io';

/** Renseigné par FightsGateway.handleConnection à partir du cookie JWT. */
export interface FightSocketData {
  userId: number;
  username: string;
}

export type FightSocket = Socket<
  DefaultEventsMap,
  DefaultEventsMap,
  DefaultEventsMap,
  FightSocketData
>;
