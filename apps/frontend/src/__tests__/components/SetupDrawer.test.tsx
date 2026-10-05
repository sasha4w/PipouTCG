import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { SandboxState } from "@pipou/shared";
import SetupDrawer from "../../features/sandbox/SetupDrawer";

const base = (name: string) => ({
  id: 1,
  name,
  rarity: "common",
  type: "monster",
  atk: 100,
  hp: 500,
  cost: 1,
  supportType: null,
  archetype: null,
  effects: null,
  description: null,
  image: null,
});

const monster = {
  instanceId: "m1",
  card: { instanceId: "m1", ownerId: 1, baseCard: base("Gobelin") },
  currentHp: 500,
  mode: "attack",
  equipments: [],
  perm: {
    atk: 0,
    hp: 0,
    taunt: false,
    piercing: false,
    debuffImmune: false,
    attacksPerTurn: 1,
  },
  attacksPerTurn: 1,
  summonedThisTurn: false,
};

const state = {
  views: {
    p1: {
      phase: "main",
      turnNumber: 3,
      isMyTurn: true,
      me: {
        username: "Admin (J1)",
        primes: 6,
        recycleEnergy: 0,
        hand: [{ instanceId: "h1", ownerId: 1, baseCard: base("Ogre") }],
        monsterZones: [monster, null, null],
        supportZones: [null, null, null],
      },
    },
    p2: {
      phase: "main",
      turnNumber: 3,
      isMyTurn: false,
      me: {
        username: "Admin (J2)",
        primes: 6,
        recycleEnergy: 0,
        hand: [],
        monsterZones: [null, null, null],
        supportZones: [null, null, null],
      },
    },
  },
  decks: { p1: [], p2: [] },
  canUndo: false,
  canRedo: false,
  timer: false,
} as unknown as SandboxState;

describe("SetupDrawer", () => {
  it("pose une carte de la main sur une zone monstre, sans coût", async () => {
    const onCommand = vi.fn();
    render(<SetupDrawer state={state} seat="p1" onCommand={onCommand} />);

    await userEvent.selectOptions(screen.getByLabelText("Carte"), "h1");
    await userEvent.selectOptions(screen.getByLabelText("Vers"), "monster:1");
    await userEvent.click(screen.getByRole("button", { name: "Placer" }));

    expect(onCommand).toHaveBeenCalledWith({
      type: "move_card",
      seat: "p1",
      instanceId: "h1",
      to: { zone: "monster", index: 1, mode: "attack" },
    });
  });

  it("modifie les PV et le bonus d'ATK d'un monstre", async () => {
    const onCommand = vi.fn();
    render(<SetupDrawer state={state} seat="p1" onCommand={onCommand} />);

    await userEvent.selectOptions(screen.getByLabelText("Monstre"), "p1:m1");
    const hp = screen.getByLabelText("PV actuels");
    await userEvent.clear(hp);
    await userEvent.type(hp, "120");
    const atk = screen.getByLabelText("Bonus ATK");
    await userEvent.clear(atk);
    await userEvent.type(atk, "300");
    await userEvent.click(
      screen.getByRole("button", { name: "Appliquer au monstre" }),
    );

    expect(onCommand).toHaveBeenCalledWith({
      type: "edit_monster",
      seat: "p1",
      instanceId: "m1",
      patch: expect.objectContaining({ currentHp: 120, atkBonus: 300 }),
    });
  });

  it("change le joueur actif et la phase", async () => {
    const onCommand = vi.fn();
    render(<SetupDrawer state={state} seat="p1" onCommand={onCommand} />);

    await userEvent.selectOptions(screen.getByLabelText("Joueur actif"), "p2");
    await userEvent.selectOptions(screen.getByLabelText("Phase"), "battle");
    await userEvent.click(
      screen.getByRole("button", { name: "Appliquer à la partie" }),
    );

    expect(onCommand).toHaveBeenCalledWith({
      type: "edit_game",
      patch: { phase: "battle", turnNumber: 3, activeSeat: "p2" },
    });
  });
});
