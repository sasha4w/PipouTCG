import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdventureResult from "../../features/adventure/AdventureResult";
import i18n from "../../i18n";

beforeAll(async () => {
  await i18n.changeLanguage("fr");
});

function renderResult(over: Partial<Parameters<typeof AdventureResult>[0]> = {}) {
  const props = {
    result: null,
    won: false,
    draw: false,
    worldOrder: 1,
    unlockedWorlds: [],
    onReplay: vi.fn(),
    onBack: vi.fn(),
    onWorlds: vi.fn(),
    ...over,
  };
  render(
    <MemoryRouter>
      <AdventureResult {...props} />
    </MemoryRouter>,
  );
  return props;
}

describe("AdventureResult", () => {
  it("propose de changer de monde en plus du retour au monde", () => {
    const props = renderResult();
    fireEvent.click(screen.getByRole("button", { name: "Changer de monde" }));
    expect(props.onWorlds).toHaveBeenCalledTimes(1);
    expect(props.onBack).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Retour au monde" }));
    expect(props.onBack).toHaveBeenCalledTimes(1);
  });

  it("remet le défilement de la page en haut à l'affichage", () => {
    const main = document.createElement("main");
    main.className = "app-main";
    let top = 240;
    Object.defineProperty(main, "scrollTop", {
      get: () => top,
      set: (v: number) => {
        top = v;
      },
    });
    document.body.appendChild(main);
    render(
      <MemoryRouter>
        <AdventureResult
          result={null}
          won={false}
          draw={false}
          worldOrder={1}
          unlockedWorlds={[]}
          onBack={vi.fn()}
          onWorlds={vi.fn()}
        />
      </MemoryRouter>,
      { container: main.appendChild(document.createElement("div")) },
    );
    expect(top).toBe(0);
    main.remove();
  });
});
