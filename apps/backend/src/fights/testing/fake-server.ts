import type { FightServer } from '../fight-socket.types';

export interface Emitted {
  room: string;
  event: string;
  payload: unknown;
}

/** Serveur Socket.io factice qui enregistre les émissions. */
export function fakeServer(): { server: FightServer; emitted: Emitted[] } {
  const emitted: Emitted[] = [];
  const server = {
    to: (room: string) => ({
      emit: (event: string, payload?: unknown) => {
        emitted.push({ room, event, payload });
        return true;
      },
    }),
  } as unknown as FightServer;
  return { server, emitted };
}
