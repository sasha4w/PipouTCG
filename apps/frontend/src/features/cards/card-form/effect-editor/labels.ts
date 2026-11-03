import type { TFunction } from "i18next";
import i18n from "../../../../i18n";

/** Libellé i18n, ou le nom technique quand la clé n'existe pas encore. */
export function labelOrName(t: TFunction, key: string, name: string): string {
  return i18n.exists(key) ? t(key) : name;
}
