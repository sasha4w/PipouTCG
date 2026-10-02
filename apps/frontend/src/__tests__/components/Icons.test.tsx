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
} from "../../components/Icons";

const ICONS = {
  IconPencil,
  IconTrash,
  IconClose,
  IconPlus,
  IconMinus,
  IconPause,
  IconPlay,
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
