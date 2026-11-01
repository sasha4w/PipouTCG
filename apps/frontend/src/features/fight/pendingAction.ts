import { paymentBalance } from "./payment";

/** Action de carte en attente de confirmation par le joueur. */
export type PendingAction =
  | {
      kind: "summon";
      handIndex: number;
      zoneIndex: number;
      payIndices: number[];
    }
  | {
      kind: "summonZeta";
      handIndex: number;
      oppZoneIndex: number;
      payIndices: number[];
    }
  | {
      kind: "evolve";
      handIndex: number;
      targetInstanceId: string;
      payIndices: number[];
    }
  | {
      kind: "playSupport";
      handIndex: number;
      zoneIndex?: number;
      targetInstanceId?: string;
    }
  | { kind: "transform"; handIndex: number }
  | { kind: "recycle"; handIndex: number }
  | { kind: "discard"; handIndex: number };

/** Clés i18n et paramètres : le texte est traduit par l'appelant. */
export interface ConfirmText {
  key: string;
  params: Record<string, string | number>;
  warning?: { key: string; params: Record<string, number> };
}

interface ConfirmContext {
  /** Noms des cartes de la main, indexés comme la main. */
  handNames: string[];
  targetName?: string;
  /** Coût à payer (invocation ou évolution), 0 si gratuit. */
  cost: number;
  reserve: number;
  /** Langue de la liste des cartes recyclées. */
  locale?: string;
}

function joinNames(names: string[], locale: string): string {
  return new Intl.ListFormat(locale, {
    style: "long",
    type: "conjunction",
  }).format(names);
}

export function confirmText(
  action: PendingAction,
  ctx: ConfirmContext,
): ConfirmText {
  const card = ctx.handNames[action.handIndex] ?? "";

  switch (action.kind) {
    case "summon":
    case "summonZeta":
    case "evolve": {
      const recycledNames = action.payIndices.map((i) => ctx.handNames[i] ?? "");
      const { surplus } = paymentBalance(
        ctx.cost,
        ctx.reserve,
        action.payIndices.length,
      );
      const warning =
        surplus > 0
          ? { key: "fight.confirm.surplus", params: { count: surplus } }
          : undefined;
      if (action.kind === "evolve") {
        return {
          key: "fight.confirm.evolve",
          params: { card, target: ctx.targetName ?? "" },
          ...(warning && { warning }),
        };
      }
      return {
        key:
          recycledNames.length > 0
            ? "fight.confirm.summonRecycling"
            : "fight.confirm.summon",
        params:
          recycledNames.length > 0
            ? { card, recycled: joinNames(recycledNames, ctx.locale ?? "fr") }
            : { card },
        ...(warning && { warning }),
      };
    }
    case "playSupport":
      return { key: "fight.confirm.play", params: { card } };
    case "transform":
      return { key: "fight.confirm.transform", params: { card } };
    case "recycle":
      return { key: "fight.confirm.recycle", params: { card } };
    case "discard":
      return { key: "fight.confirm.discard", params: { card } };
  }
}
