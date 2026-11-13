import type { DefaultEventsMap, Server, Socket } from 'socket.io';
import type { PuzzleClientEvents, PuzzleServerEvents } from '@pipou/shared';

/** Renseigné par PuzzleGateway.handleConnection (tout joueur connecté). */
export interface PuzzleSocketData {
  userId: number;
  username: string;
  isAdmin: boolean;
}

export type PuzzleServer = Server<
  PuzzleClientEvents,
  PuzzleServerEvents,
  DefaultEventsMap,
  PuzzleSocketData
>;

export type PuzzleSocket = Socket<
  PuzzleClientEvents,
  PuzzleServerEvents,
  DefaultEventsMap,
  PuzzleSocketData
>;
