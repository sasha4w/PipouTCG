import { describe, it, expect, vi, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import i18n from "../../i18n";
import SalesFilterBar from "../../features/marketplace/sales-history/SalesFilterBar";
import { MARKET_SCOPE } from "../../features/marketplace/sales-history/salesScope";

const ME = { id: 1, username: "moi" };
const BOB = { id: 2, username: "bob" };

describe("SalesFilterBar", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });

  it("n'affiche pas les rôles sur tout le marché", () => {
    render(<SalesFilterBar scope={MARKET_SCOPE} me={ME} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Tout le marché" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.queryByRole("button", { name: "Vendeur" })).not.toBeInTheDocument();
  });

  it("passe à mes ventes et achats", () => {
    const onChange = vi.fn();
    render(<SalesFilterBar scope={MARKET_SCOPE} me={ME} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Moi" }));
    expect(onChange).toHaveBeenCalledWith({ kind: "player", player: ME, role: "both" });
  });

  it("montre le joueur choisi, ses rôles, et le retire", () => {
    const onChange = vi.fn();
    const scope = { kind: "player" as const, player: BOB, role: "both" as const };
    render(<SalesFilterBar scope={scope} me={ME} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Acheteur" }));
    expect(onChange).toHaveBeenLastCalledWith({ ...scope, role: "buyer" });

    fireEvent.click(screen.getByRole("button", { name: "Retirer le filtre bob" }));
    expect(onChange).toHaveBeenLastCalledWith(MARKET_SCOPE);
  });

  it("désactive « Moi » tant que le profil n'est pas chargé", () => {
    render(<SalesFilterBar scope={MARKET_SCOPE} me={undefined} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Moi" })).toBeDisabled();
  });
});
