import { describe, expect, it } from "vitest";
import { paymentBalance } from "../../features/fight/payment";

describe("paymentBalance", () => {
  it("la réserve paie en premier, puis les cartes recyclées", () => {
    expect(paymentBalance(3, 1, 2)).toEqual({ missing: 0, surplus: 0 });
  });

  it("manque d'énergie", () => {
    expect(paymentBalance(4, 1, 1)).toEqual({ missing: 2, surplus: 0 });
  });

  it("surplus : seule l'énergie des cartes recyclées compte", () => {
    expect(paymentBalance(2, 1, 3)).toEqual({ missing: 0, surplus: 2 });
  });

  it("coût 0 ou gratuit : tout recyclage est en surplus", () => {
    expect(paymentBalance(0, 0, 1)).toEqual({ missing: 0, surplus: 1 });
  });

  it("réserve supérieure au coût : rien à payer", () => {
    expect(paymentBalance(2, 5, 0)).toEqual({ missing: 0, surplus: 0 });
  });
});
