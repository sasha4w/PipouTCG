import { useEffect, useRef } from "react";
import type { MouseEvent, PointerEvent } from "react";

/** Durée d'appui avant déclenchement (ms). */
export const LONG_PRESS_MS = 400;
/** Déplacement au-delà duquel l'appui long est annulé (px). */
export const LONG_PRESS_MOVE_PX = 8;

export interface LongPressOptions {
  onLongPress: () => void;
  /**
   * Relâchement d'un appui long déclenché à la souris ou au stylet. Pas appelé
   * au toucher (tenir le doigt immobile est peu fiable : l'inspection reste
   * ouverte) ni pour le menu contextuel.
   */
  onLongPressEnd?: () => void;
}

export interface LongPressHandlers {
  onPointerDown: (e: PointerEvent<HTMLElement>) => void;
  onPointerMove: (e: PointerEvent<HTMLElement>) => void;
  onPointerUp: () => void;
  onPointerCancel: () => void;
  onClickCapture: (e: MouseEvent<HTMLElement>) => void;
  onContextMenu: (e: MouseEvent<HTMLElement>) => void;
}

/** Appui long tactile ou souris ; le clic qui suit un appui long est avalé. */
export function useLongPress({
  onLongPress,
  onLongPressEnd,
}: LongPressOptions): LongPressHandlers {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const firedRef = useRef(false);
  const touchRef = useRef(false);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  // Nettoyage au démontage (même motif que CardDisplay)
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const release = () => {
    clearTimer();
    if (firedRef.current && !touchRef.current) onLongPressEnd?.();
  };

  return {
    onPointerDown: (e) => {
      firedRef.current = false;
      if (e.button !== 0) return;
      touchRef.current = e.pointerType === "touch";
      startRef.current = { x: e.clientX, y: e.clientY };
      // Le relâchement revient à cet élément même si un overlay s'ouvre dessus
      e.currentTarget.setPointerCapture?.(e.pointerId);
      clearTimer();
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        firedRef.current = true;
        onLongPress();
      }, LONG_PRESS_MS);
    },
    onPointerMove: (e) => {
      if (!timerRef.current || !startRef.current) return;
      const moved = Math.hypot(
        e.clientX - startRef.current.x,
        e.clientY - startRef.current.y,
      );
      if (moved > LONG_PRESS_MOVE_PX) clearTimer();
    },
    onPointerUp: release,
    onPointerCancel: release,
    onClickCapture: (e) => {
      if (!firedRef.current) return;
      firedRef.current = false;
      e.preventDefault();
      e.stopPropagation();
    },
    onContextMenu: (e) => {
      e.preventDefault();
      // Pendant un appui tactile, le menu natif arrive en double : le minuteur s'en charge
      if (!firedRef.current && !timerRef.current) onLongPress();
    },
  };
}
