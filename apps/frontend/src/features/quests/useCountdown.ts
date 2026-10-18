import { useEffect, useState } from "react";

export type Translate = (key: string, options?: Record<string, unknown>) => string;

export function formatTimeRemaining(resetAt: string | null, t: Translate, now: number): string {
  if (!resetAt) return t("quests.permanent");
  const diff = new Date(resetAt).getTime() - now;
  if (diff <= 0) return t("quests.expired");
  const totalSec = Math.floor(diff / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (d > 0) return t("quests.remaining_days", { d, h });
  if (h > 0) return t("quests.remaining_hours", { h, m });
  if (m > 0) return t("quests.remaining_mins", { m, s });
  return t("quests.remaining_secs", { s });
}

/** Libellé du temps restant, rafraîchi chaque seconde (l'horloge avance, le libellé est dérivé). */
export function useCountdown(resetAt: string | null, t: Translate): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!resetAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [resetAt]);
  return formatTimeRemaining(resetAt, t, now);
}
