import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { I18nextProvider } from "react-i18next";
import {
  ActionType,
  CardType,
  EffectTarget,
  EffectTrigger,
  Rarity,
  SupportType,
} from "@pipou/shared";
import i18n from "../../i18n";
import CardForm from "../../features/cards/card-form/CardForm";
import { cardService, type Card } from "../../services/card.service";
import { imageService } from "../../services/image.service";

vi.mock("../../services/card.service", async (orig) => ({
  ...(await orig<typeof import("../../services/card.service")>()),
  cardService: { create: vi.fn(), update: vi.fn() },
}));
vi.mock("../../services/card-set.service", () => ({
  cardSetService: {
    findAll: vi.fn().mockResolvedValue({ data: [{ id: 1, name: "Set" }] }),
  },
}));
vi.mock("../../services/image.service", () => ({
  imageService: {
    findAll: vi.fn().mockResolvedValue([]),
    upload: vi.fn().mockResolvedValue({ id: 9 }),
  },
}));
vi.mock("../../features/cards/card-form/svgToWebp", () => ({
  prepareCardImage: vi.fn(
    async () => new File(["w"], "logo.webp", { type: "image/webp" }),
  ),
}));

beforeAll(async () => {
  await i18n.changeLanguage("fr");
  URL.createObjectURL = vi.fn(() => "blob:x");
  URL.revokeObjectURL = vi.fn();
});

beforeEach(() => {
  vi.mocked(cardService.create).mockReset().mockResolvedValue({} as never);
  vi.mocked(cardService.update).mockReset().mockResolvedValue({} as never);
});

function setup(card: Card | null = null) {
  const onDone = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <I18nextProvider i18n={i18n}>
        <CardForm card={card} onDone={onDone} />
      </I18nextProvider>
    </QueryClientProvider>,
  );
  return onDone;
}

const next = () => fireEvent.click(screen.getByText("Suivant"));
const pickSet = async () => {
  await waitFor(() => expect(screen.getByText("Set")).toBeInTheDocument());
  fireEvent.change(screen.getByLabelText("Card Set *"), {
    target: { value: "1" },
  });
};
const fillBase = async (name: string) => {
  fireEvent.change(screen.getByLabelText("Nom *"), { target: { value: name } });
  await pickSet();
};

describe("CardForm", () => {
  it("creates a monster", async () => {
    setup();
    next();
    await fillBase("Gobelin");
    next();
    fireEvent.change(screen.getByLabelText("ATK"), { target: { value: "5" } });
    next(); // effets
    next(); // image
    fireEvent.click(screen.getByText("Créer la carte"));
    await waitFor(() => expect(cardService.create).toHaveBeenCalled());
    const data = vi.mocked(cardService.create).mock.calls[0][0];
    expect(data).toMatchObject({ name: "Gobelin", type: CardType.MONSTER, atk: 5 });
    expect(data.supportType).toBeUndefined();
  });

  it("creates a charge support with ON_CHARGED effect", async () => {
    setup();
    fireEvent.change(screen.getByLabelText("Type de carte"), {
      target: { value: CardType.SUPPORT },
    });
    fireEvent.change(screen.getByLabelText("Type de support"), {
      target: { value: SupportType.CHARGE },
    });
    next();
    await fillBase("Réacteur");
    next();
    expect(screen.getByText("Cyclique (bientôt)")).toBeDisabled();
    next();
    fireEvent.click(screen.getByText("+ effet"));
    fireEvent.change(screen.getByLabelText("Quand", { selector: "select" }), {
      target: { value: EffectTrigger.ON_CHARGED },
    });
    next();
    fireEvent.click(screen.getByText("Créer la carte"));
    await waitFor(() => expect(cardService.create).toHaveBeenCalled());
    const data = vi.mocked(cardService.create).mock.calls[0][0];
    expect(data.supportType).toBe(SupportType.CHARGE);
    expect(data.chargeMax).toBe(3);
    expect(data.effects?.[0].trigger).toBe(EffectTrigger.ON_CHARGED);
  });

  it("skips type fields for ephemeral", async () => {
    setup();
    fireEvent.change(screen.getByLabelText("Type de carte"), {
      target: { value: CardType.SUPPORT },
    });
    fireEvent.change(screen.getByLabelText("Type de support"), {
      target: { value: SupportType.EPHEMERAL },
    });
    next();
    await fillBase("Soin");
    next();
    expect(screen.getByText("+ effet")).toBeInTheDocument();
  });

  const monsterWithAttack = {
    id: 1,
    name: "Carte",
    description: "Lore",
    rarity: Rarity.RARE,
    type: CardType.MONSTER,
    atk: 1,
    hp: 2,
    cost: 1,
    cardSet: { id: 1, name: "Set" },
    effects: [
      {
        trigger: EffectTrigger.ON_ATTACK,
        actions: [
          { type: ActionType.DRAW, target: EffectTarget.PLAYER, value: 1 },
        ],
      },
    ],
  } as Card;

  it("flags effects whose trigger no longer fits", async () => {
    setup(monsterWithAttack);
    fireEvent.change(screen.getByLabelText("Type de carte"), {
      target: { value: CardType.SUPPORT },
    });
    fireEvent.change(screen.getByLabelText("Type de support"), {
      target: { value: SupportType.PERSISTENT },
    });
    next();
    next();
    next();
    next();
    expect(screen.getByText("1 problème(s) dans les effets.")).toBeInTheDocument();
    expect(screen.getByText("Modifier")).toBeDisabled();
  });

  it("edits keep lore", async () => {
    setup(monsterWithAttack);
    next();
    next();
    next();
    next();
    fireEvent.click(screen.getByText("Modifier"));
    await waitFor(() => expect(cardService.update).toHaveBeenCalled());
    expect(vi.mocked(cardService.update).mock.calls[0][1].description).toBe(
      "Lore",
    );
  });

  it("converts svg on submit", async () => {
    setup();
    next();
    await fillBase("Logo");
    next();
    next();
    next();
    fireEvent.change(screen.getByLabelText("Source"), {
      target: { value: "new" },
    });
    fireEvent.change(screen.getByLabelText("Nom de l'image"), {
      target: { value: "logo" },
    });
    const svg = new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" });
    fireEvent.change(screen.getByLabelText("Fichier"), {
      target: { files: [svg] },
    });
    fireEvent.click(screen.getByText("Créer la carte"));
    await waitFor(() => expect(imageService.upload).toHaveBeenCalled());
    const [file] = vi.mocked(imageService.upload).mock.calls[0];
    expect(file.type).toBe("image/webp");
    await waitFor(() => expect(cardService.create).toHaveBeenCalled());
    expect(vi.mocked(cardService.create).mock.calls[0][0].imageId).toBe(9);
  });
});
