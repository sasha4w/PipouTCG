import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { useHideAppChrome } from "../../features/fight/useHideAppChrome";

function Probe() {
  useHideAppChrome();
  return null;
}

describe("useHideAppChrome", () => {
  it("pose la classe in-fight au montage et la retire au démontage", () => {
    const { unmount } = render(<Probe />);
    expect(document.body).toHaveClass("in-fight");
    unmount();
    expect(document.body).not.toHaveClass("in-fight");
  });
});
