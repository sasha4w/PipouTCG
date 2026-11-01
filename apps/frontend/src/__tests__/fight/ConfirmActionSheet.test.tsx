import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ConfirmActionSheet from "../../features/fight/ConfirmActionSheet";
import type { ConfirmText } from "../../features/fight/pendingAction";
import i18n from "../../i18n";

beforeAll(async () => {
  await i18n.changeLanguage("fr");
});

const text: ConfirmText = {
  key: "fight.confirm.recycle",
  params: { card: "Goblin" },
};

describe("ConfirmActionSheet", () => {
  it("affiche le message traduit", () => {
    render(
      <ConfirmActionSheet text={text} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.getByText("Recycler Goblin ?")).toBeTruthy();
  });

  it("affiche l'avertissement de surplus dans un role=alert", () => {
    render(
      <ConfirmActionSheet
        text={{
          ...text,
          warning: { key: "fight.confirm.surplus", params: { count: 2 } },
        }}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "2 énergie en trop, gardée en réserve",
    );
  });

  it("pas de role=alert sans avertissement", () => {
    render(
      <ConfirmActionSheet text={text} onConfirm={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("deux clics rapides sur Confirmer n'appellent onConfirm qu'une fois", () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmActionSheet text={text} onConfirm={onConfirm} onCancel={vi.fn()} />,
    );
    const btn = screen.getByRole("button", { name: "Confirmer" });
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("Annuler appelle onCancel et pas onConfirm", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmActionSheet text={text} onConfirm={onConfirm} onCancel={onCancel} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("Échap appelle onCancel", () => {
    const onCancel = vi.fn();
    render(
      <ConfirmActionSheet text={text} onConfirm={vi.fn()} onCancel={onCancel} />,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onCancel).toHaveBeenCalled();
  });
});
