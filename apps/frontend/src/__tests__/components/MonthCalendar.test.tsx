import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import MonthCalendar from "../../components/daily-reward/MonthCalendar";

const state = (day: string) =>
  screen.getByText(day, { selector: "[data-state]" }).getAttribute("data-state");

describe("MonthCalendar", () => {
  it("place le 1er octobre 2026 un jeudi", () => {
    render(<MonthCalendar today="2026-10-16" claimedDates={[]} />);
    const cells = document.querySelectorAll(".drm-cal__grid--days > *");
    expect(cells[3]).toHaveTextContent("1");
    expect(cells[2]).toBeEmptyDOMElement();
  });

  it("distingue réclamé, racheté, manqué, aujourd'hui et futur", () => {
    render(
      <MonthCalendar
        today="2026-10-16"
        claimedDates={["2026-09-30", "2026-10-03", "2026-10-04", "2026-10-06"]}
        rescuedDates={["2026-10-05"]}
      />,
    );
    expect(state("2")).toBe("past"); // avant le premier claim du mois
    expect(state("3")).toBe("claimed");
    expect(state("5")).toBe("rescued");
    expect(state("7")).toBe("missed");
    expect(state("16")).toBe("today");
    expect(state("17")).toBe("future");
  });

  it("aujourd'hui réclamé reste marqué comme aujourd'hui", () => {
    render(<MonthCalendar today="2026-10-16" claimedDates={["2026-10-16"]} />);
    const cell = screen.getByText("16", { selector: "[data-state]" });
    expect(cell).toHaveAttribute("data-state", "claimed");
    expect(cell).toHaveAttribute("data-today", "true");
  });
});
