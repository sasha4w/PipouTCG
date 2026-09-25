export const ProductType = {
  CARD: "CARD",
  BOOSTER: "BOOSTER",
  BUNDLE: "BUNDLE",
} as const;
export type ProductType = (typeof ProductType)[keyof typeof ProductType];

export const TransactionStatus = {
  PENDING: "PENDING", // mise en vente
  COMPLETED: "COMPLETED", // vendue
  CANCELLED: "CANCELLED", // retirée
} as const;
export type TransactionStatus =
  (typeof TransactionStatus)[keyof typeof TransactionStatus];

export const BannerItemType = {
  BOOSTER: "BOOSTER",
  BUNDLE: "BUNDLE",
} as const;
export type BannerItemType = (typeof BannerItemType)[keyof typeof BannerItemType];

export const CardNumber = {
  ONE: 1,
  FIVE: 5,
  EIGHT: 8,
  TEN: 10,
} as const;
export type CardNumber = (typeof CardNumber)[keyof typeof CardNumber];
