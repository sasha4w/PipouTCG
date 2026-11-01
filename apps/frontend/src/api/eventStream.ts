import { api } from "./api";
import { getAuthToken } from "./authToken";

const API_URL = import.meta.env.VITE_API_URL;
const RETRY_MIN_MS = 3000;
const RETRY_MAX_MS = 30000;

/** URL du flux ; avec un jeton de repli, passe par un ticket SSE de 2 min. */
async function streamUrl(path: string): Promise<string> {
  const url = `${API_URL}${path}`;
  if (!getAuthToken()) return url;
  const { data } = await api.post<{ ticket: string }>("/auth/sse-ticket");
  return `${url}?token=${encodeURIComponent(data.ticket)}`;
}

/**
 * Ouvre un flux SSE authentifié et le rouvre (avec un ticket neuf) s'il tombe :
 * l'auto-reconnexion native rejouerait l'URL au ticket expiré.
 * `setup` pose les écouteurs sur chaque nouvelle connexion. Retourne la
 * fonction de fermeture.
 */
export function openEventStream(
  path: string,
  setup: (es: EventSource) => void,
): () => void {
  let es: EventSource | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let closed = false;
  let delay = RETRY_MIN_MS;

  const retry = () => {
    if (closed) return;
    timer = setTimeout(connect, delay);
    delay = Math.min(delay * 2, RETRY_MAX_MS);
  };

  const connect = async () => {
    try {
      const url = await streamUrl(path);
      if (closed) return;
      es = new EventSource(url, { withCredentials: true });
      es.onopen = () => {
        delay = RETRY_MIN_MS;
      };
      setup(es);
      const previousOnError = es.onerror;
      es.onerror = (event) => {
        previousOnError?.call(es as EventSource, event);
        es?.close();
        retry();
      };
    } catch {
      retry();
    }
  };

  void connect();

  return () => {
    closed = true;
    clearTimeout(timer);
    es?.close();
  };
}
