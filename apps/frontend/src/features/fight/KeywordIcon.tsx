import {
  IconArmor,
  IconBolt,
  IconBubble,
  IconEgg,
  IconEvolve,
  IconForward,
  IconHeart,
  IconHourglass,
  IconImmunity,
  IconJoker,
  IconLock,
  IconPierce,
  IconReflect,
  IconReleve,
  IconSnowflake,
  IconSwords,
  IconTarget,
  IconTaunt,
} from "../../components/Icons";
import type { KeywordId } from "./effectText";

type IconComponent = (props: { size?: number }) => React.JSX.Element;

/** Bouclier d'immunités avec un seul quart rempli (cf. IMMUNITY_QUARTERS). */
const immunityQuarter = (index: 0 | 1 | 2 | 3): IconComponent => {
  const quarters = [
    index === 0,
    index === 1,
    index === 2,
    index === 3,
  ] as const;
  return ({ size }) => <IconImmunity size={size} quarters={quarters} />;
};

const SVG_KEYWORDS: Record<KeywordId, IconComponent> = {
  taunt: IconTaunt,
  piercing: IconPierce,
  debuffImmunity: ({ size }) => (
    <IconImmunity size={size} quarters={[true, true, true, true]} />
  ),
  combatImmunity: IconBubble,
  supportShield: immunityQuarter(0),
  supportDebuffImmunity: immunityQuarter(1),
  monsterDebuffImmunity: immunityQuarter(2),
  monsterStatusImmunity: immunityQuarter(3),
  combatEndure: IconHeart,
  ignoreTaunt: IconTarget,
  doubleAttack: IconBolt,
  multiAttack: IconSwords,
  forcedAttack: IconForward,
  guardLock: IconLock,
  freeze: IconSnowflake,
  damageReduction: IconArmor,
  tempAtk: IconBolt,
  countdown: IconHourglass,
  hatch: IconEgg,
  evolutionJoker: IconJoker,
  instantEvolution: IconEvolve,
  reflect: IconReflect,
  releve: IconReleve,
};

/** Icône SVG d'un mot-clé. */
export default function KeywordIcon({
  id,
  size = 14,
}: {
  id: KeywordId;
  size?: number;
}) {
  const Svg = SVG_KEYWORDS[id];
  return <Svg size={size} />;
}
