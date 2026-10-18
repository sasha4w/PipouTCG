import i18n from "../../i18n";

/** Les quêtes du pool stockent une clé i18n ; les quêtes admin, un texte libre. */
export function questTitle(title: string): string {
  return i18n.exists(title) ? i18n.t(title) : title;
}
