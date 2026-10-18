import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AdventureOverview, GameOverPayload } from "@pipou/shared";
import i18n from "../../i18n";
import { QUERY_KEYS } from "../../utils/querykeys";

type Handler = (payload?: unknown) => void;
const fake = vi.hoisted(() => ({
  handlers: new Map<string, (payload?: unknown) => void>(),
  emit: vi.fn(),
}));

vi.mock("socket.io-client", () => ({
  io: () => ({
    on: (event: string, h: Handler) => fake.handlers.set(event, h),
    emit: fake.emit,
    disconnect: vi.fn(),
  }),
}));

import AdventureFightRoute from "./AdventureFight";

const serverSends = (event: string, payload?: unknown) =>
  act(() => fake.handlers.get(event)?.(payload));

const overview = {
  worlds: [
    {
      id: 1,
      name: "Brigade",
      cardSetId: 1,
      cardSetName: "Brigade",
      order: 1,
      unlocked: true,
      requires: [],
      beaten: 4,
      completed: false,
      opponents: [{ id: 4, name: "Capitaine Griffe" }],
    },
    { id: 2, name: "Drakon", order: 2, opponents: [] },
  ],
  farmRewardsToday: 0,
  dailyCap: 20,
} as unknown as AdventureOverview;

/** URL courante, pour vérifier les remplacements d'historique. */
function LocationDisplay() {
  const location = useLocation();
  return <output data-testid="location">{location.pathname + location.search}</output>;
}

function renderFight(url = "/adventure/fight/4?deck=8") {
  const client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false } },
  });
  client.setQueryData(QUERY_KEYS.profile, { id: 1, username: "Moi" });
  client.setQueryData(QUERY_KEYS.adventure, overview);
  const invalidate = vi.spyOn(client, "invalidateQueries");
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/adventure/fight/:opponentId" element={<AdventureFightRoute />} />
          <Route path="/fight" element={<p>écran JcJ</p>} />
          <Route path="/adventure/:worldId" element={<p>écran monde</p>} />
        </Routes>
        <LocationDisplay />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { invalidate };
}

describe("AdventureFight", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });

  beforeEach(() => {
    fake.handlers.clear();
    fake.emit.mockClear();
  });

  it("lance le combat contre l'IA avec le deck choisi", () => {
    renderFight();
    expect(fake.emit).toHaveBeenCalledWith("adventure:start", { opponentId: 4, deckId: 8 });
    expect(screen.getByText("Préparation du combat contre Capitaine Griffe…")).toBeInTheDocument();
  });

  it("ne lance rien sans deck", () => {
    renderFight("/adventure/fight/4");
    expect(fake.emit).not.toHaveBeenCalled();
    expect(screen.getByText("Choisis d'abord un deck sur la fiche de l'IA.")).toBeInTheDocument();
  });

  it("reprend en silence une partie contre la même IA", () => {
    renderFight();
    serverSends("fight:resumed", { matchId: 3, opponentName: "Capitaine Griffe", adventureOpponentId: 4 });
    serverSends("fight:error", { message: "Tu as déjà une partie en cours" });
    expect(screen.queryByText(/déjà une partie/)).not.toBeInTheDocument();
  });

  it("tait le refus qui suit l'état de la partie reprise", () => {
    renderFight();
    serverSends("fight:resumed", { matchId: 3, opponentName: "Capitaine Griffe", adventureOpponentId: 4 });
    serverSends("fight:state", { isMyTurn: false, phase: "mulligan", me: { hand: [], mulliganDone: false }, opponent: { username: "Capitaine Griffe", mulliganDone: false } });
    serverSends("fight:error", { message: "Tu as déjà une partie en cours" });
    expect(screen.queryByText("Tu as déjà une partie en cours")).not.toBeInTheDocument();
  });

  it("montre une erreur de jeu après une reconnexion (pas de lancement en attente)", () => {
    renderFight();
    const state = { isMyTurn: false, phase: "mulligan", me: { hand: [], mulliganDone: false }, opponent: { username: "Capitaine Griffe", mulliganDone: false } };
    serverSends("fight:resumed", { matchId: 3, opponentName: "Capitaine Griffe", adventureOpponentId: 4 });
    serverSends("fight:state", state);
    serverSends("fight:resumed", { matchId: 3, opponentName: "Capitaine Griffe", adventureOpponentId: 4 });
    serverSends("fight:error", { message: "Action refusée" });
    expect(screen.getByText("Action refusée")).toBeInTheDocument();
  });

  it("affiche un refus de lancement sans partie reprise", () => {
    renderFight();
    serverSends("fight:error", { message: "Deck invalide" });
    expect(screen.getByText("Le combat n'a pas pu démarrer : Deck invalide")).toBeInTheDocument();
  });

  it("renvoie vers le duel JcJ si la partie reprise n'est pas contre une IA", () => {
    renderFight();
    serverSends("fight:resumed", { matchId: 3, opponentName: "Bob" });
    expect(screen.getByText("écran JcJ")).toBeInTheDocument();
  });

  it("renvoie vers l'écran de l'autre IA si la partie reprise est contre elle", () => {
    renderFight();
    serverSends("fight:resumed", { matchId: 3, opponentName: "IA", adventureOpponentId: 9 });
    expect(fake.emit).not.toHaveBeenCalledWith("adventure:start", expect.objectContaining({ opponentId: 9 }));
    // nouvelle IA, sans deck : la partie reprise arrive par sa propre connexion
    expect(screen.getByText("Choisis d'abord un deck sur la fiche de l'IA.")).toBeInTheDocument();
  });

  it("affiche le butin en fin de partie et rafraîchit les données", () => {
    const { invalidate } = renderFight();
    const payload: GameOverPayload = {
      winner: 1,
      endReason: "primes_depleted",
      adventure: {
        opponentId: 4,
        worldId: 1,
        won: true,
        firstWin: true,
        worldCompleted: true,
        unlockedWorldIds: [2],
        loot: {
          gold: 500,
          xp: 300,
          boosters: [{ boosterId: 1, name: "Booster Brigade", quantity: 1 }],
          cards: [{ cardId: 7, name: "Dragon Impérial", rarity: "legendary", imageUrl: null }],
          capped: false,
        },
      },
    };
    serverSends("fight:game_over", payload);
    expect(screen.getByText("VICTOIRE !")).toBeInTheDocument();
    expect(screen.getByText("Monde 1 terminé")).toBeInTheDocument();
    expect(screen.getByText("+500 or")).toBeInTheDocument();
    expect(screen.getByText("Booster Brigade ×1")).toBeInTheDocument();
    expect(screen.getByText("Légendaire : Dragon Impérial")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Succès à réclamer" })).toHaveAttribute(
      "href",
      "/profile?tab=achievements",
    );
    expect(screen.getByText("Drakon débloqué !")).toBeInTheDocument();
    expect(document.body.textContent ?? "").not.toMatch(/\p{Extended_Pictographic}/u);
    for (const key of ["adventure", "profile", "myStats", "inventory", "collection", "achievements", "quests"] as const)
      expect(invalidate).toHaveBeenCalledWith({ queryKey: QUERY_KEYS[key] });
  });

  it("affiche la défaite avec Rejouer et Retour", () => {
    renderFight();
    serverSends("fight:game_over", {
      winner: 2,
      endReason: "primes_depleted",
      adventure: {
        opponentId: 4,
        worldId: 1,
        won: false,
        firstWin: false,
        worldCompleted: false,
        unlockedWorldIds: [],
        loot: null,
      },
    });
    expect(screen.getByText("Défaite")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rejouer" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retour au monde" })).toBeInTheDocument();
  });

  it("victoire sans résultat d'aventure : récompenses indisponibles", () => {
    renderFight();
    serverSends("fight:game_over", { winner: 1, endReason: "primes_depleted" });
    expect(screen.getByText("VICTOIRE !")).toBeInTheDocument();
    expect(screen.getByText("Récompenses indisponibles")).toBeInTheDocument();
    expect(screen.queryByRole("list")).not.toBeInTheDocument();
  });

  it("sans deck, la fin de partie ne propose que le retour", () => {
    renderFight("/adventure/fight/4");
    serverSends("fight:game_over", { winner: 2, endReason: "primes_depleted" });
    expect(screen.queryByRole("button", { name: "Rejouer" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retour au monde" })).toBeInTheDocument();
  });

  it("signale une victoire de farm sans récompense (plafond)", () => {
    renderFight();
    serverSends("fight:game_over", {
      winner: 1,
      endReason: "primes_depleted",
      adventure: {
        opponentId: 4,
        worldId: 1,
        won: true,
        firstWin: false,
        worldCompleted: false,
        unlockedWorldIds: [],
        loot: { gold: 0, xp: 0, boosters: [], cards: [], capped: true },
      },
    });
    expect(screen.getByText("Plus de récompenses aujourd'hui")).toBeInTheDocument();
  });

  describe("URL du lancement (?deck)", () => {
    const state = { isMyTurn: false, phase: "mulligan", me: { hand: [], mulliganDone: false }, opponent: { username: "Capitaine Griffe", mulliganDone: false } };
    const loss = { winner: 2, endReason: "primes_depleted", adventure: { opponentId: 4, worldId: 1, won: false, firstWin: false, worldCompleted: false, unlockedWorldIds: [], loot: null } };
    const location = () => screen.getByTestId("location").textContent;

    it("garde ?deck tant que le lancement n'est pas accepté", () => {
      renderFight();
      serverSends("fight:error", { message: "Deck invalide" });
      expect(location()).toBe("/adventure/fight/4?deck=8");
    });

    it("retire ?deck dès le premier état de la partie lancée", () => {
      renderFight();
      serverSends("fight:state", state);
      expect(location()).toBe("/adventure/fight/4");
      expect(fake.emit).toHaveBeenCalledTimes(1);
    });

    it("retire ?deck dès la mise en relation", () => {
      renderFight();
      serverSends("fight:matched", { matchId: -3, opponentName: "Capitaine Griffe", adventureOpponentId: 4 });
      expect(location()).toBe("/adventure/fight/4");
    });

    it("après le retrait, Rejouer et Retour gardent le deck choisi", () => {
      renderFight();
      serverSends("fight:state", state);
      serverSends("fight:game_over", loss);
      act(() => screen.getByRole("button", { name: "Rejouer" }).click());
      expect(fake.emit).toHaveBeenLastCalledWith("adventure:start", { opponentId: 4, deckId: 8 });
      serverSends("fight:game_over", loss);
      act(() => screen.getByRole("button", { name: "Retour au monde" }).click());
      expect(location()).toBe("/adventure/1?deck=8");
    });

    it("recharger sans ?deck pendant la partie la reprend sans relancer", () => {
      renderFight("/adventure/fight/4");
      serverSends("fight:resumed", { matchId: -3, opponentName: "Capitaine Griffe", adventureOpponentId: 4 });
      serverSends("fight:state", state);
      expect(fake.emit).not.toHaveBeenCalledWith("adventure:start", expect.anything());
      expect(screen.queryByText("Choisis d'abord un deck sur la fiche de l'IA.")).not.toBeInTheDocument();
    });
  });
});
