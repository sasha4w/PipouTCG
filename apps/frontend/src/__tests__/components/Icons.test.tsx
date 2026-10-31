import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import {
  IconPencil,
  IconTrash,
  IconClose,
  IconPlus,
  IconMinus,
  IconPause,
  IconPlay,
  IconSwords,
  IconGem,
  IconTaunt,
  IconPierce,
  IconTarget,
  IconHeart,
  IconArmor,
  IconBubble,
  IconBolt,
  IconForward,
  IconSnowflake,
  IconHourglass,
  IconWrench,
  IconImmunity,
} from "../../components/Icons";

const ICONS = {
  IconPencil,
  IconTrash,
  IconClose,
  IconPlus,
  IconMinus,
  IconPause,
  IconPlay,
  IconSwords,
  IconGem,
  IconTaunt,
  IconPierce,
  IconTarget,
  IconHeart,
  IconArmor,
  IconBubble,
  IconBolt,
  IconForward,
  IconSnowflake,
  IconHourglass,
  IconWrench,
};

describe("nouvelles icônes", () => {
  it.each(Object.entries(ICONS))(
    "%s rend un svg 24×24 en currentColor à la taille demandée",
    (_name, Icon) => {
      const { container } = render(<Icon size={16} />);
      const svg = container.querySelector("svg")!;
      expect(svg).toHaveAttribute("width", "16");
      expect(svg).toHaveAttribute("viewBox", "0 0 24 24");
      const stroked = container.querySelector("[stroke]")!;
      expect(stroked).toHaveAttribute("stroke", "currentColor");
    },
  );
});

describe("IconImmunity", () => {
  it("remplit seulement les quarts actifs", () => {
    const { container } = render(
      <IconImmunity size={13} quarters={[true, false, false, true]} />,
    );
    const rects = [...container.querySelectorAll("rect")];
    expect(rects.map((r) => [r.getAttribute("x"), r.getAttribute("y")])).toEqual([
      ["0", "0"],
      ["12", "12"],
    ]);
  });
});
