import { beforeAll, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { I18nextProvider, useTranslation } from "react-i18next";
import {
  ActionType,
  EffectTarget,
  EffectTrigger,
  type CardEffect,
} from "@pipou/shared";
import i18n from "../../i18n";
import EffectEditor from "../../features/cards/card-form/effect-editor/EffectEditor";
import { labelOrName } from "../../features/cards/card-form/effect-editor/labels";

beforeAll(async () => {
  await i18n.changeLanguage("fr");
});

const damage: CardEffect = {
  trigger: EffectTrigger.ON_SUMMON,
  actions: [
    {
      type: ActionType.DEAL_DAMAGE,
      target: EffectTarget.STRONGEST_ENEMY,
      value: 2,
    },
  ],
};

function setup(value: CardEffect[], kind: "monster" | "CHARGE" = "monster") {
  const onChange = vi.fn();
  render(
    <I18nextProvider i18n={i18n}>
      <EffectEditor kind={kind} value={value} onChange={onChange} />
    </I18nextProvider>,
  );
  return onChange;
}

describe("EffectEditor", () => {
  it("renders sentence from i18n labels", () => {
    setup([damage]);
    expect(screen.getByDisplayValue("À l'invocation")).toBeInTheDocument();
    expect(screen.getByDisplayValue("2")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("le monstre adverse le plus fort"),
    ).toBeInTheDocument();
  });

  it("editing a hole calls onChange", () => {
    const onChange = setup([damage]);
    fireEvent.change(screen.getByDisplayValue("2"), { target: { value: "3" } });
    const next = onChange.mock.calls[0][0] as CardEffect[];
    expect(next[0].actions[0].value).toBe(3);
  });

  it("changing the action type drops fields it does not take", () => {
    const onChange = setup([damage]);
    fireEvent.change(screen.getByLabelText("action"), {
      target: { value: ActionType.SET_MONSTER_STATUS_IMMUNITY },
    });
    const a = (onChange.mock.calls[0][0] as CardEffect[])[0].actions[0];
    expect(a.type).toBe(ActionType.SET_MONSTER_STATUS_IMMUNITY);
    expect(a.value).toBeUndefined();
    expect(a.target).toBe(EffectTarget.SELF);
  });

  it("falls back to technical name", () => {
    function Probe() {
      const { t } = useTranslation();
      return <span>{labelOrName(t, "admin.effectEditor.action.NOPE", "NOPE")}</span>;
    }
    render(<Probe />);
    expect(screen.getByText("NOPE")).toBeInTheDocument();
  });

  it("shows issue on line", () => {
    setup([
      {
        trigger: EffectTrigger.ON_SUMMON,
        actions: [
          { type: ActionType.DEAL_DAMAGE, target: EffectTarget.PLAYER, value: 1 },
        ],
      },
    ]);
    expect(
      screen.getByText("Cette action ne peut pas viser cette cible."),
    ).toBeInTheDocument();
  });

  it("adds and removes action and effect", () => {
    const onChange = setup([damage]);
    fireEvent.click(screen.getByText("+ action"));
    expect((onChange.mock.calls[0][0] as CardEffect[])[0].actions).toHaveLength(2);
    fireEvent.click(screen.getByText("+ effet"));
    expect(onChange.mock.calls[1][0]).toHaveLength(2);
    fireEvent.click(screen.getByLabelText("Retirer l'effet"));
    expect(onChange.mock.calls[2][0]).toEqual([]);
  });

  it("keeps advanced fields and flags them", () => {
    const withFilter: CardEffect = {
      trigger: EffectTrigger.ON_SUMMON,
      actions: [
        {
          type: ActionType.DEAL_DAMAGE,
          target: EffectTarget.ENEMY_MONSTER,
          value: 1,
          filter: { excludeName: "X" },
        },
      ],
    };
    const onChange = setup([withFilter]);
    expect(screen.getByText("champ avancé conservé")).toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue("1"), { target: { value: "4" } });
    const a = (onChange.mock.calls[0][0] as CardEffect[])[0].actions[0];
    expect(a.filter).toEqual({ excludeName: "X" });
  });
});
