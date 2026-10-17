import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AnimationProvider } from "../../contexts/AnimationContext";
import { useAnimationPrefs } from "../../contexts/useAnimationPrefs";
import AnimationSettings from "../../components/AnimationSettings";

const originalMatchMedia = window.matchMedia;

function mockSystemReduced(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function Probe() {
  const { preference, reduced } = useAnimationPrefs();
  return <span data-testid="prefs">{`${preference}:${reduced}`}</span>;
}

const renderWithProvider = () =>
  render(
    <AnimationProvider>
      <Probe />
      <AnimationSettings />
    </AnimationProvider>,
  );

describe("AnimationContext", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    window.matchMedia = originalMatchMedia;
    vi.restoreAllMocks();
  });

  it("auto suit prefers-reduced-motion", () => {
    mockSystemReduced(true);
    renderWithProvider();
    expect(screen.getByTestId("prefs")).toHaveTextContent("auto:true");
  });

  it("« complètes » ignore la préférence système", () => {
    mockSystemReduced(true);
    localStorage.setItem("pipou_animations", "full");
    renderWithProvider();
    expect(screen.getByTestId("prefs")).toHaveTextContent("full:false");
  });

  it("le sélecteur enregistre le choix", () => {
    mockSystemReduced(false);
    renderWithProvider();

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "reduced" },
    });

    expect(screen.getByTestId("prefs")).toHaveTextContent("reduced:true");
    expect(localStorage.getItem("pipou_animations")).toBe("reduced");
  });

  it("stockage inaccessible : auto, sans planter", () => {
    mockSystemReduced(false);
    vi.spyOn(window.localStorage, "getItem").mockImplementation(() => {
      throw new Error("bloqué");
    });
    renderWithProvider();
    expect(screen.getByTestId("prefs")).toHaveTextContent("auto:false");
  });

  it("sans provider : valeurs par défaut", () => {
    render(<Probe />);
    expect(screen.getByTestId("prefs")).toHaveTextContent("auto:false");
  });
});
