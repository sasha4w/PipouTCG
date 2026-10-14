import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import type { NotificationsResponse } from "@pipou/shared";
import i18n from "../../i18n";
import InboxWidget from "../../features/inbox/InboxWidget";
import { notificationService } from "../../services/notification.service";
import { questService } from "../../services/quest.service";

vi.mock("../../services/notification.service", () => ({
  notificationService: { list: vi.fn(), markAllRead: vi.fn() },
}));
vi.mock("../../services/quest.service", () => ({
  questService: {
    claimReward: vi.fn(),
    claimAllRewards: vi.fn(),
    getMyQuests: vi.fn(),
  },
}));

const NOW = "2026-10-11T10:00:00.000Z";

const ALL: NotificationsResponse = {
  unread: { all: 3, reward: 1, information: 2 },
  items: [
    {
      id: "n:1",
      type: "QUEST_COMPLETED",
      category: "reward",
      createdAt: NOW,
      read: false,
      payload: {
        userQuestId: 42,
        title: "Ouvre 3 boosters",
        rewardType: "GOLD",
        rewardAmount: 100,
      },
    },
    {
      id: "n:2",
      type: "LISTING_SOLD",
      category: "information",
      createdAt: NOW,
      read: false,
      payload: {
        buyerUsername: "bob",
        itemName: "Alpha",
        totalPrice: 120,
        transactionId: 3,
      },
    },
    {
      id: "p:5",
      type: "PATCHNOTE",
      category: "information",
      createdAt: NOW,
      read: false,
      payload: { title: "Patch 1.2", body: "Équilibrage des légendaires" },
    },
  ],
};

function Where() {
  const location = useLocation();
  return <div data-testid="where">{location.pathname + location.search}</div>;
}

function renderWidget() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <InboxWidget />
        <Routes>
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("InboxWidget", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(notificationService.list).mockImplementation(
      async (category) => ({
        unread: ALL.unread,
        items: category
          ? ALL.items.filter((i) => i.category === category)
          : ALL.items,
      }),
    );
    vi.mocked(notificationService.markAllRead).mockResolvedValue();
    vi.mocked(questService.claimReward).mockResolvedValue({});
  });

  it("affiche le nombre de messages non lus sur l'icône", async () => {
    renderWidget();
    expect(await screen.findByText("3")).toBeInTheDocument();
  });

  it("liste les trois types de messages dans l'onglet Tout", async () => {
    renderWidget();
    await userEvent.click(
      await screen.findByRole("button", { name: /boîte/i }),
    );
    expect(await screen.findByText("Ouvre 3 boosters")).toBeInTheDocument();
    expect(screen.getByText(/bob/)).toBeInTheDocument();
    expect(screen.getByText("Patch 1.2")).toBeInTheDocument();
  });

  it("filtre par onglet Information", async () => {
    renderWidget();
    await userEvent.click(
      await screen.findByRole("button", { name: /boîte/i }),
    );
    await userEvent.click(
      await screen.findByRole("tab", { name: /information/i }),
    );
    await waitFor(() =>
      expect(notificationService.list).toHaveBeenCalledWith("information"),
    );
    expect(await screen.findByText("Patch 1.2")).toBeInTheDocument();
    expect(screen.queryByText("Ouvre 3 boosters")).not.toBeInTheDocument();
  });

  it("réclame une quête depuis son message", async () => {
    renderWidget();
    await userEvent.click(
      await screen.findByRole("button", { name: /boîte/i }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Réclamer" }),
    );
    await waitFor(() =>
      expect(questService.claimReward).toHaveBeenCalledWith(42),
    );
  });

  it("ouvre la vente concernée dans Mes Ventes Récentes", async () => {
    renderWidget();
    await userEvent.click(
      await screen.findByRole("button", { name: /boîte/i }),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Voir mes ventes" }),
    );
    expect(screen.getByTestId("where")).toHaveTextContent(
      "/marketplace?tab=sell&sale=3",
    );
  });

  it("déplie le texte d'un patchnote", async () => {
    renderWidget();
    await userEvent.click(
      await screen.findByRole("button", { name: /boîte/i }),
    );
    await screen.findByText("Patch 1.2");
    expect(
      screen.queryByText("Équilibrage des légendaires"),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByText("Patch 1.2"));
    expect(
      await screen.findByText("Équilibrage des légendaires"),
    ).toBeInTheDocument();
  });

  it("marque les messages lus à la fermeture", async () => {
    renderWidget();
    const trigger = await screen.findByRole("button", { name: /boîte/i });
    await userEvent.click(trigger);
    await screen.findByText("Patch 1.2");
    await userEvent.click(trigger);
    await waitFor(() =>
      expect(notificationService.markAllRead).toHaveBeenCalledTimes(1),
    );
  });

  it("propose de réessayer quand le chargement échoue", async () => {
    vi.mocked(notificationService.list).mockRejectedValue(new Error("boom"));
    renderWidget();
    await userEvent.click(
      await screen.findByRole("button", { name: /boîte/i }),
    );
    expect(
      await screen.findByRole("button", { name: /réessayer/i }),
    ).toBeInTheDocument();
  });
});
