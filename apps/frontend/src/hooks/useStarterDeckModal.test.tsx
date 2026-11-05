import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import type { StarterStatus } from "@pipou/shared";
import { starterDeckService } from "../services/starterDeck.service";
import { useStarterDeckModal } from "./useStarterDeckModal";

vi.mock("../services/starterDeck.service", () => ({
  starterDeckService: { getStatus: vi.fn(), claim: vi.fn() },
}));

const status = (available: boolean): StarterStatus => ({
  claimed: !available,
  available,
  decks: [],
});

function setup(userId: number | undefined = 7) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return renderHook(() => useStarterDeckModal(userId), { wrapper });
}

describe("useStarterDeckModal", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(starterDeckService.getStatus).mockReset();
    window.localStorage.clear();
  });

  it("s'ouvre une fois et écrit la clé quand le starter est disponible", async () => {
    vi.mocked(starterDeckService.getStatus).mockResolvedValue(status(true));
    const { result } = setup();
    expect(result.current.isBlocking).toBe(true);
    await waitFor(() => expect(result.current.isOpen).toBe(true));
    expect(window.localStorage.getItem("starter-modal-seen:7")).toBe("1");
    expect(result.current.isBlocking).toBe(true);
  });

  it("reste fermé et ne bloque plus quand la clé existe", async () => {
    window.localStorage.setItem("starter-modal-seen:7", "1");
    vi.mocked(starterDeckService.getStatus).mockResolvedValue(status(true));
    const { result } = setup();
    await waitFor(() => expect(result.current.isBlocking).toBe(false));
    expect(result.current.isOpen).toBe(false);
  });

  it("ne plante pas quand localStorage lève une erreur", async () => {
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.spyOn(window.localStorage, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    vi.mocked(starterDeckService.getStatus).mockResolvedValue(status(true));
    const { result } = setup();
    await waitFor(() => expect(result.current.isOpen).toBe(true));
    result.current.close();
    await waitFor(() => expect(result.current.isOpen).toBe(false));
    expect(result.current.isBlocking).toBe(false);
  });

  it("ne s'ouvre jamais quand le starter n'est pas disponible", async () => {
    vi.mocked(starterDeckService.getStatus).mockResolvedValue(status(false));
    const { result } = setup();
    await waitFor(() => expect(result.current.isBlocking).toBe(false));
    expect(result.current.isOpen).toBe(false);
    result.current.open();
    expect(result.current.isOpen).toBe(false);
  });
});
