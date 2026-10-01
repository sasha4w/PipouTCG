import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Login from "../../pages/Login";

vi.mock("../../components/SoundButton", () => ({ default: () => null }));
vi.mock("../../api/api", () => ({ api: { post: vi.fn() } }));
vi.mock("../../services/auth.service", () => ({ authService: {} }));

// La bascule garde sa classe (élément non migré) ; Login charge le vrai i18n,
// donc on ne cible pas le libellé traduit.
const eyeButton = () =>
  document.querySelector<HTMLButtonElement>(".login-password-toggle")!;

const renderLogin = () =>
  render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  );

const passwordInput = () =>
  document.querySelector<HTMLInputElement>(".login-input--password")!;

describe("Login — afficher / masquer le mot de passe", () => {
  it("masque le mot de passe par défaut", () => {
    renderLogin();

    expect(passwordInput()).toHaveAttribute("type", "password");
    expect(eyeButton()).toHaveAttribute("aria-pressed", "false");
  });

  it("bascule entre visible et masqué au clic sur l'œil", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(eyeButton());
    expect(passwordInput()).toHaveAttribute("type", "text");
    expect(eyeButton()).toHaveAttribute("aria-pressed", "true");

    await user.click(eyeButton());
    expect(passwordInput()).toHaveAttribute("type", "password");
  });
});
