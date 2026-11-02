import { expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChargeFrame } from "../../features/fight/Zonerow/ChargeFrame";

it("affiche n/max et la progression", () => {
  render(<ChargeFrame counters={2} max={4}><span>art</span></ChargeFrame>);
  expect(screen.getByText("2/4")).toBeInTheDocument();
  expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "2");
});
