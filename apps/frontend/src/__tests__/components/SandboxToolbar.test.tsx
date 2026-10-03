import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SandboxToolbar from "../../features/sandbox/SandboxToolbar";

function renderToolbar(
  over: Partial<Parameters<typeof SandboxToolbar>[0]> = {},
) {
  const props = {
    seat: "p1" as const,
    forcedSeat: null,
    onForceSeat: vi.fn(),
    showOpponentHand: false,
    onToggleOpponentHand: vi.fn(),
    canUndo: true,
    canRedo: false,
    onUndo: vi.fn(),
    onRedo: vi.fn(),
    onSave: vi.fn(),
    onClose: vi.fn(),
    ...over,
  };
  render(<SandboxToolbar {...props} />);
  return props;
}

describe("SandboxToolbar", () => {
  it("force la vue sur un joueur, puis revient en automatique", async () => {
    const props = renderToolbar();

    await userEvent.click(screen.getByRole("button", { name: "J2" }));
    await userEvent.click(screen.getByRole("button", { name: /Auto/ }));

    expect(props.onForceSeat).toHaveBeenNthCalledWith(1, "p2");
    expect(props.onForceSeat).toHaveBeenNthCalledWith(2, null);
  });

  it("désactive Refaire quand il n'y a rien à refaire", () => {
    renderToolbar();

    expect(screen.getByRole("button", { name: /Annuler/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Refaire/ })).toBeDisabled();
  });

  it("demande un nom, et une description facultative, avant de sauvegarder", async () => {
    vi.spyOn(window, "prompt")
      .mockReturnValueOnce("Combo Zeta")
      .mockReturnValueOnce("");
    const props = renderToolbar();

    await userEvent.click(screen.getByRole("button", { name: /Sauver/ }));

    expect(props.onSave).toHaveBeenCalledWith("Combo Zeta", undefined);
  });
});
