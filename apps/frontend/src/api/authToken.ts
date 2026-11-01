/**
 * Repli du cookie `token` pour les navigateurs qui bloquent les cookies tiers
 * (Opera GX, Safari) : l'API est sur un autre domaine que le front.
 *
 * Sans « se souvenir de moi », le jeton vit en sessionStorage (effacé à la
 * fermeture de l'onglet) ; avec, en localStorage. Les accès sont protégés :
 * le stockage peut être indisponible (navigation privée, données bloquées).
 */
const KEY = "authToken";

export function getAuthToken(): string | null {
  try {
    return sessionStorage.getItem(KEY) ?? localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string, persistent: boolean): void {
  clearAuthToken();
  try {
    (persistent ? localStorage : sessionStorage).setItem(KEY, token);
  } catch {
    // Pas de stockage : on reste sur le cookie seul.
  }
}

export function clearAuthToken(): void {
  try {
    sessionStorage.removeItem(KEY);
    localStorage.removeItem(KEY);
  } catch {
    // rien à effacer
  }
}
