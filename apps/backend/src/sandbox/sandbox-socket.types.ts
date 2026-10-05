import type { DefaultEventsMap, Server, Socket } from 'socket.io';
import type { SandboxClientEvents, SandboxServerEvents } from '@pipou/shared';

/** Renseigné par SandboxGateway.handleConnection (admins uniquement). */
export interface SandboxSocketData {
  userId: number;
  username: string;
  isAdmin: boolean;
}

export type SandboxServer = Server<
  SandboxClientEvents,
  SandboxServerEvents,
  DefaultEventsMap,
  SandboxSocketData
>;

export type SandboxSocket = Socket<
  SandboxClientEvents,
  SandboxServerEvents,
  DefaultEventsMap,
  SandboxSocketData
>;
