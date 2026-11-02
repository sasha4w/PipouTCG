import { beforeAll, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ReplaceSupportDialog } from "../../features/fight/ReplaceSupportDialog";
import i18n from "../../i18n";

beforeAll(async () => {
  await i18n.changeLanguage("fr");
});

const c = (id: string, name: string) => ({ instanceId: id, baseCard: { name } }) as never;

it("un seul candidat : bouton de confirmation", () => {
  const onConfirm = vi.fn();
  render(<ReplaceSupportDialog card="Canon" candidates={[c("p", "Processeur")]} onConfirm={onConfirm} onCancel={() => {}} />);
  expect(screen.getByText("Remplacer Processeur par Canon ?")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /confirmer/i }));
  expect(onConfirm).toHaveBeenCalledWith("p");
});

it("deux accessoires : le joueur choisit lequel", () => {
  const onConfirm = vi.fn();
  render(<ReplaceSupportDialog card="Module" candidates={[c("a", "Réparation"), c("b", "Autre")]} onConfirm={onConfirm} onCancel={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: /Autre/ }));
  expect(onConfirm).toHaveBeenCalledWith("b");
});
