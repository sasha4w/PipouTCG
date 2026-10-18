import { useEffect, useRef, useState } from "react";

export type Translate = (key: string, options?: Record<string, unknown>) => string;

/** Durée compacte (« 1h 32min »), sans suffixe ; vide quand l'échéance est passée. */
export function formatDuration(diffMs: number, t: Translate): string {
  if (diffMs <= 0) return "";
  const totalSec = Math.floor(diffMs / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (d > 0) return t("quests.duration_days", { d, h });
  if (h > 0) return t("quests.duration_hours", { h, m });
  if (m > 0) return t("quests.duration_mins", { m, s });
  return t("quests.duration_secs", { s });
}

export interface Countdown {
  label: string;
  expired: boolean;
}

/**
 * Temps restant avant `resetAt`, rafraîchi chaque seconde (l'horloge avance, le libellé est dérivé).
 * `onExpire` part une seule fois par valeur de `resetAt`, quand l'échéance est atteinte.
 */
export function useCountdown(
  resetAt: string | null,
  t: Translate,
  onExpire?: () => void,
): Countdown {
  const [now, setNow] = useState(() => Date.now());
  const firedFor = useRef<string | null>(null);
  const onExpireRef = useRef(onExpire);
  useEffect(() => {
    onExpireRef.current = onExpire;
  });

  useEffect(() => {
    if (!resetAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [resetAt]);

  const diff = resetAt ? new Date(resetAt).getTime() - now : 0;
  const expired = resetAt !== null && diff <= 0;

  useEffect(() => {
    if (!expired || firedFor.current === resetAt) return;
    firedFor.current = resetAt;
    onExpireRef.current?.();
  }, [expired, resetAt]);

  return { label: formatDuration(diff, t), expired };
}
