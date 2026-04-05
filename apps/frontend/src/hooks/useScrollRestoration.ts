import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

const scrollPositions = new Map<string, number>();

export function useScrollRestoration(
  scrollRef: React.RefObject<HTMLElement | null>,
) {
  const { pathname } = useLocation();
  const prevPath = useRef<string>(pathname);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      scrollPositions.set(prevPath.current, el.scrollTop);
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [pathname, scrollRef]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    prevPath.current = pathname;

    const saved = scrollPositions.get(pathname) ?? 0;
    el.scrollTop = saved;
  }, [pathname, scrollRef]);
}
