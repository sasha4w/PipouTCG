import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import CardDrawer from "../../features/fight/CardDrawer";
import type { InspectCard } from "../../features/fight/CardInspect";
import i18n from "../../i18n";

const card: InspectCard = {
  id: 3,
  name: "Ogre",
  rarity: "rare",
  type: "monster",
  atk: 200,
  hp: 800,
  cost: 4,
  description: "Écrase tout",
  image: null,
  archetype: null,
  effects: [
    {
      trigger: "ON_SUMMON",
      condition: null,
      actions: [{ type: "SET_TAUNT", target: "SELF" }],
    },
  ],
};

describe("CardDrawer", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });

  it("replié : nom, stats et mot-clé en étiquette, sans le texte complet", () => {
    render(<CardDrawer card={card} onClose={vi.fn()} />);
    expect(screen.getByRole("dialog", { name: "Ogre" })).toBeInTheDocument();
    expect(screen.getByText("200 ATK · 800 PV")).toBeInTheDocument();
    expect(screen.getByText(i18n.t("keywords.taunt.name"))).toBeInTheDocument();
    expect(screen.queryByLabelText(i18n.t("effects.ui.title"))).toBeNull();
  });

  it("Voir tout déplie le texte complet des effets", () => {
    render(<CardDrawer card={card} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Voir tout" }));
    expect(
      screen.getByLabelText(i18n.t("effects.ui.title")),
    ).toBeInTheDocument();
  });

  it("Échap ferme le tiroir", () => {
    const onClose = vi.fn();
    render(<CardDrawer card={card} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("un glissement vers le haut déplie, vers le bas ferme", () => {
    const onClose = vi.fn();
    render(<CardDrawer card={card} onClose={onClose} />);
    const grab = screen.getByTestId("drawer-grab");

    fireEvent.touchStart(grab, { touches: [{ clientY: 400 }] });
    fireEvent.touchEnd(grab, { changedTouches: [{ clientY: 300 }] });
    expect(
      screen.getByLabelText(i18n.t("effects.ui.title")),
    ).toBeInTheDocument();

    fireEvent.touchStart(grab, { touches: [{ clientY: 300 }] });
    fireEvent.touchEnd(grab, { changedTouches: [{ clientY: 420 }] });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
