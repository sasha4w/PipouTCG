import type { QuestRewardType } from "@pipou/shared";
import { IconBooster, IconBundle, IconGold } from "../../components/Icons";

const ICONS = { GOLD: IconGold, BOOSTER: IconBooster, BUNDLE: IconBundle } as const;

export default function RewardLabel({ type, amount }: { type: QuestRewardType; amount: number }) {
  const Icon = ICONS[type];
  return (
    <span className="quest-item__reward">
      <Icon size={13} color="#eebc77" /> +{amount}
    </span>
  );
}
