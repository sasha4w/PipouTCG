import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import Login from "../../pages/Login";

vi.mock("../../components/SoundButton", () => ({ default: () => null }));
vi.mock("../../api/api", () => ({ api: { post: vi.fn() } }));
vi.mock("../../services/auth.service", () => ({ authService: {} }));

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
    expect(screen.getByRole("button", { pressed: false })).toBeInTheDocument();
  });

  it("bascule entre visible et masqué au clic sur l'œil", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole("button", { pressed: false }));
    expect(passwordInput()).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { pressed: true }));
    expect(passwordInput()).toHaveAttribute("type", "password");
  });
});
