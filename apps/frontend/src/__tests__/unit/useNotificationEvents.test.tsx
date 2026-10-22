import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useNotificationEvents } from "../../hooks/useNotifications";
import { QUERY_KEYS } from "../../utils/querykeys";

/** EventSource factice : on déclenche les événements à la main. */
class FakeEventSource {
  static last: FakeEventSource;
  listeners = new Map<string, () => void>();
  onerror: (() => void) | null = null;
  constructor() {
    FakeEventSource.last = this;
  }
  addEventListener(type: string, cb: () => void) {
    this.listeners.set(type, cb);
  }
  close() {}
  fire(type: string) {
    this.listeners.get(type)?.();
  }
}

function setup() {
  vi.stubGlobal("EventSource", FakeEventSource);
  const client = new QueryClient();
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  renderHook(() => useNotificationEvents(), { wrapper });
  return invalidate;
}

describe("useNotificationEvents", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("recharge la boîte à l'arrivée d'un message", () => {
    const invalidate = setup();
    FakeEventSource.last.fire("notification.created");
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: QUERY_KEYS.notifications.all,
    });
  });

  it("recharge les quêtes quand leur progression change côté serveur", () => {
    const invalidate = setup();
    FakeEventSource.last.fire("quests.updated");
    expect(invalidate).toHaveBeenCalledWith({ queryKey: QUERY_KEYS.quests });
  });
});
