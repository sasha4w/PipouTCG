/** Hôtes considérés comme une base locale (machine ou service `db` du docker-compose). */
const LOCAL_DB_HOSTS = ['localhost', '127.0.0.1', '::1', 'db'];

/**
 * `synchronize` réécrit le schéma pour coller aux entités, quitte à supprimer
 * des colonnes et leurs données. Il n'est donc autorisé que sur une base locale
 * et hors production : un `.env` de dev pointant sur Aiven ne touche jamais au schéma.
 */
export function shouldSynchronize(env: {
  NODE_ENV?: string;
  DB_HOST?: string;
}): boolean {
  return (
    env.NODE_ENV !== 'production' && LOCAL_DB_HOSTS.includes(env.DB_HOST ?? '')
  );
}
