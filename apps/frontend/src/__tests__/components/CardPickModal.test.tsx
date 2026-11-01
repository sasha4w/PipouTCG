import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import CardPickModal from "../../features/fight/CardPickModal";
import type { PendingChoice } from "../../features/fight/fight.types";
import i18n from "../../i18n";

const choice: PendingChoice = {
  count: 1,
  prompt: "Récupérer une carte",
  resolution: "pick_to_hand",
  candidates: ["Gobelin", "Ogre"].map((name, i) => ({
    instanceId: `c${i}`,
    source: "graveyard" as const,
    baseCard: {
      id: i + 1,
      name,
      type: "monster" as const,
      atk: 100,
      hp: 500,
      rarity: "rare" as const,
      supportType: null,
      cost: 2,
      image: null,
      description: `Texte de ${name}`,
      element: null,
      stage: null,
    },
  })),
};

describe("CardPickModal", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sélectionne une carte au tap puis confirme", () => {
    const onConfirm = vi.fn();
    render(<CardPickModal choice={choice} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByRole("button", { name: /Ogre/ }));
    fireEvent.click(screen.getByRole("button", { name: /Récupérer \(1\/1\)/ }));

    expect(onConfirm).toHaveBeenCalledWith(["c1"]);
  });

  it("un tap sélectionne la carte et montre i, qui ouvre le tiroir", () => {
    render(<CardPickModal choice={choice} onConfirm={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Gobelin/ }));
    fireEvent.click(screen.getByRole("button", { name: "Informations" }));

    expect(screen.getByRole("dialog", { name: "Gobelin" })).toBeInTheDocument();
  });

  it("invocation depuis le deck : bouton « Invoquer »", async () => {
    await i18n.changeLanguage("fr");
    render(
      <CardPickModal
        choice={{ ...choice, resolution: "summon_to_zone" }}
        onConfirm={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: /^Invoquer \(0\/1\)$/ }),
    ).toBeInTheDocument();
  });

  it("traduit la consigne du serveur à partir de sa clé", async () => {
    const discard: PendingChoice = {
      ...choice,
      count: 2,
      prompt: "Choisissez 2 carte(s) à défausser",
      promptKey: "discard",
      promptParams: { count: 2 },
      resolution: "discard",
    };
    await i18n.changeLanguage("en");
    try {
      render(<CardPickModal choice={discard} onConfirm={vi.fn()} />);
      expect(screen.getByText(/Choose 2 cards to discard/)).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /Discard \(0\/2\)/ }),
      ).toBeInTheDocument();
      expect(screen.getAllByText(/Graveyard/)).toHaveLength(2);
    } finally {
      await i18n.changeLanguage("fr");
    }
  });

  it("sans clé, affiche la consigne telle que reçue", () => {
    render(<CardPickModal choice={choice} onConfirm={vi.fn()} />);
    expect(screen.getByText(/Récupérer une carte/)).toBeInTheDocument();
  });
});
