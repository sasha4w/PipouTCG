import { describe, it, expect, beforeAll } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import i18n from "../../i18n";
import GoldChart from "../../features/marketplace/sales-history/GoldChart";

// 30 jours se terminant le 15/10 : 200 G le 14/10, 100 G le 15/10
const DAILY = Array.from({ length: 30 }, (_, i) => {
  const date = new Date(Date.UTC(2026, 8, 16 + i)).toISOString().slice(0, 10);
  return { date, gold: date === "2026-10-14" ? 200 : date === "2026-10-15" ? 100 : 0 };
});

describe("GoldChart", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });

  it("dimensionne les barres par rapport au meilleur jour", () => {
    render(<GoldChart daily={DAILY} bestDay={{ date: "2026-10-14", gold: 200 }} />);
    expect(screen.getByRole("button", { name: "14/10 : 200 G" })).toHaveStyle({
      height: "100%",
    });
    expect(screen.getByRole("button", { name: "15/10 : 100 G" })).toHaveStyle({
      height: "50%",
    });
  });

  it("couronne le meilleur jour", () => {
    render(<GoldChart daily={DAILY} bestDay={{ date: "2026-10-14", gold: 200 }} />);
    const best = screen.getByRole("button", { name: "14/10 : 200 G" });
    expect(best).toHaveClass("gold-chart__bar--best");
    expect(best.closest(".gold-chart__col")).toHaveTextContent("👑");
  });

  it("affiche la bulle de la barre touchée", () => {
    render(<GoldChart daily={DAILY} bestDay={{ date: "2026-10-14", gold: 200 }} />);
    fireEvent.click(screen.getByRole("button", { name: "15/10 : 100 G" }));
    expect(screen.getByRole("status")).toHaveTextContent("15/10 : 100 G");
  });

  it("affiche le message vide sans vente", () => {
    render(
      <GoldChart daily={DAILY.map((d) => ({ ...d, gold: 0 }))} bestDay={null} />,
    );
    expect(
      screen.getByText("Aucune vente sur les 30 derniers jours."),
    ).toBeInTheDocument();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
  });
});
