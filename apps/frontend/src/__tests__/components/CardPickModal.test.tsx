import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
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

  it("inspecte une carte par appui long sans la sélectionner", () => {
    vi.useFakeTimers();
    render(<CardPickModal choice={choice} onConfirm={vi.fn()} />);
    const card = screen.getByRole("button", { name: /Gobelin/ });

    fireEvent.pointerDown(card, { clientX: 0, clientY: 0, button: 0 });
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(screen.getByRole("dialog", { name: "Gobelin" })).toBeInTheDocument();
    expect(screen.getByText("Texte de Gobelin")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /\(0\/1\)/ })).toBeDisabled();
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
});
