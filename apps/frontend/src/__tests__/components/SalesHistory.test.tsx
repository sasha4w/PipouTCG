import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { SalesStats } from "@pipou/shared";
import i18n from "../../i18n";
import SalesHistory from "../../features/marketplace/sales-history/SalesHistory";
import {
  transactionService,
  type Transaction,
} from "../../services/transaction.service";

vi.mock("../../services/transaction.service", () => ({
  transactionService: { getSales: vi.fn(), getSalesStats: vi.fn() },
}));
vi.mock("framer-motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("framer-motion")>()),
  useReducedMotion: () => true,
}));

const ME = { id: 1, username: "moi" };

const STATS: SalesStats = {
  count: 3,
  totalGold: 780,
  unitsTraded: 6,
  avgUnitPrice: 130,
  minUnitPrice: 30,
  maxUnitPrice: 150,
  biggestSale: {
    id: 9,
    itemName: "Brigade de Combat",
    totalPrice: 750,
    quantity: 5,
    date: "2026-10-14T09:00:00.000Z",
  },
  topItem: { itemName: "Brigade de Combat", units: 5 },
  topPartner: { userId: 2, username: "bob", count: 2 },
  bestDay: { date: "2026-10-14", gold: 750 },
  trend: { last7: 780, previous7: 390, percent: 100 },
  daily: Array.from({ length: 30 }, (_, i) => ({
    date: new Date(Date.UTC(2026, 8, 16 + i)).toISOString().slice(0, 10),
    gold: i === 28 ? 750 : 0,
  })),
};

const SALE = {
  id: 9,
  productId: 3,
  productType: "CARD",
  itemName: "Brigade de Combat",
  quantity: 5,
  unitPrice: 150,
  totalPrice: 750,
  status: "COMPLETED",
  seller: { id: 1, username: "moi" },
  buyer: { id: 2, username: "bob" },
  createdAt: "2026-10-14T09:00:00.000Z",
  updatedAt: "2026-10-14T09:00:00.000Z",
} as unknown as Transaction;

function renderHistory(props: Partial<Parameters<typeof SalesHistory>[0]> = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SalesHistory emptyMessage="Rien" me={ME} initialScope="market" {...props} />
    </QueryClientProvider>,
  );
}

describe("SalesHistory", () => {
  beforeAll(async () => {
    await i18n.changeLanguage("fr");
    Element.prototype.scrollIntoView = vi.fn();
  });

  beforeEach(() => {
    vi.mocked(transactionService.getSalesStats).mockReset().mockResolvedValue(STATS);
    vi.mocked(transactionService.getSales)
      .mockReset()
      .mockResolvedValue({ data: [SALE], meta: { total: 1, page: 1, limit: 100, totalPages: 1 } });
  });

  it("affiche les 4 stats clés et ne charge la liste qu'à l'ouverture des détails", async () => {
    renderHistory();
    expect(await screen.findByText("780 G")).toBeInTheDocument();
    expect(screen.getByText("130 G")).toBeInTheDocument();
    expect(transactionService.getSalesStats).toHaveBeenCalledWith({});
    expect(transactionService.getSales).not.toHaveBeenCalled();
    expect(screen.queryByText("Objet le plus vendu")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Détails" }));
    expect(await screen.findByText("Objet le plus vendu")).toBeInTheDocument();
    expect(transactionService.getSales).toHaveBeenCalledWith({}, "date");
    expect(await screen.findByText("+100 %")).toBeInTheDocument();
  });

  it("démarre sur mes ventes dans l'onglet Vendre", async () => {
    renderHistory({ initialScope: "my-sales" });
    await waitFor(() =>
      expect(transactionService.getSalesStats).toHaveBeenCalledWith({
        userId: 1,
        role: "seller",
      }),
    );
  });

  it("ouvre les détails sur la vente venue de l'inbox", async () => {
    renderHistory({ initialScope: "my-sales", highlightSaleId: 9 });
    const item = (await screen.findByText("Brigade de Combat", { selector: ".sales-list__name" })).closest("li");
    expect(item).toHaveClass("sales-list__item--highlight");
  });

  it("filtre sur un joueur au clic sur son pseudo", async () => {
    renderHistory({ highlightSaleId: 9 });
    fireEvent.click(
      await screen.findByRole("button", { name: "Voir les ventes de bob" }),
    );
    await waitFor(() =>
      expect(transactionService.getSalesStats).toHaveBeenLastCalledWith({
        userId: 2,
        role: "both",
      }),
    );
    expect(await screen.findByRole("button", { name: "Retirer le filtre bob" })).toBeInTheDocument();
  });

  it("met en avant la plus grosse vente au clic sur sa tuile", async () => {
    renderHistory();
    fireEvent.click(await screen.findByRole("button", { name: /Plus grosse vente/ }));
    const item = (await screen.findByText("Brigade de Combat", { selector: ".sales-list__name" })).closest("li");
    expect(item).toHaveClass("sales-list__item--highlight");
  });
});
