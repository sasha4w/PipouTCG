import {
  IconEgg,
  IconEvolve,
  IconJoker,
  IconReflect,
  IconReleve,
} from "../../components/Icons";
import { KEYWORD_ICON, type KeywordId } from "./effectText";

const SVG_KEYWORDS: Partial<Record<KeywordId, typeof IconEgg>> = {
  hatch: IconEgg,
  evolutionJoker: IconJoker,
  instantEvolution: IconEvolve,
  reflect: IconReflect,
  releve: IconReleve,
};

/** Icône d'un mot-clé : SVG pour les mots-clés récents, symbole historique sinon. */
export default function KeywordIcon({
  id,
  size = 14,
}: {
  id: KeywordId;
  size?: number;
}) {
  const Svg = SVG_KEYWORDS[id];
  if (Svg) return <Svg size={size} />;
  return <>{KEYWORD_ICON[id]}</>;
}
