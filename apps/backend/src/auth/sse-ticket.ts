import { createHmac } from 'crypto';

/** Durée de vie d'un ticket SSE : juste de quoi ouvrir le flux. */
export const SSE_TICKET_TTL = '2m';

/**
 * Secret dédié aux tickets SSE, dérivé de JWT_SECRET. Un ticket n'est donc
 * jamais valide comme JWT de session, ni l'inverse : un jeton de session passé
 * en query est rejeté.
 */
export function sseTicketSecret(jwtSecret: string): string {
  return createHmac('sha256', jwtSecret).update('sse-ticket').digest('hex');
}
