import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import FilterPanel from "../../components/FilterPanel";
import type { FilterConfig } from "../../components/FilterPanel";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

const config: FilterConfig[] = [
  {
    key: "type",
    label: "Type",
    options: [
      { value: "all", label: "Tous" },
      { value: "monster", label: "Monstre" },
    ],
  },
];

const renderPanel = (tone?: "light" | "dark") =>
  render(
    <FilterPanel
      config={config}
      values={{ type: "all" }}
      onChange={vi.fn()}
      onReset={vi.fn()}
      tone={tone}
    />,
  );

describe("FilterPanel", () => {
  it("utilise ghost-bordeaux sur fond clair par défaut", () => {
    renderPanel();
    expect(screen.getByRole("button", { name: "Tous" })).toHaveClass(
      "btn--ghost-bordeaux",
      "btn--active",
    );
    expect(
      screen.getByRole("button", { name: "Monstre", pressed: false }),
    ).toBeInTheDocument();
  });

  it("utilise ghost-gold sur fond foncé", () => {
    renderPanel("dark");
    expect(screen.getByRole("button", { name: "Tous" })).toHaveClass(
      "btn--ghost-gold",
      "btn--active",
    );
    expect(screen.getByRole("button", { name: "filter.reset" })).toHaveClass(
      "btn--ghost-gold",
    );
  });
});
