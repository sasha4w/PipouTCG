import { useTranslation } from "react-i18next";
import {
  describeCardEffects,
  type EffectSourceCard,
  type KeywordId,
} from "./effectText";
import KeywordIcon from "./KeywordIcon";
import "./CardEffectSheet.css";

export interface EffectSheetSource {
  card: EffectSourceCard;
  /** Titre de la sous-partie (ex. nom d'un équipement) ; absent = la carte elle-même. */
  title?: string;
}

interface Props {
  sources: EffectSheetSource[];
}

/** `**mot-clé**` → <strong>. */
function renderText(text: string) {
  return text
    .split(/\*\*(.+?)\*\*/g)
    .map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part));
}

/** Texte de règle des effets d'une carte (et de ses équipements) + glossaire. */
export default function CardEffectSheet({ sources }: Props) {
  const { t } = useTranslation();
  const described = sources
    .map((s) => ({ title: s.title, ...describeCardEffects(s.card, t) }))
    .filter((d) => d.rules.length > 0);
  if (described.length === 0) return null;

  const keywords = [...new Set(described.flatMap((d) => d.keywords))];

  return (
    <section className="ces" aria-label={t("effects.ui.title")}>
      {described.map((d, i) => (
        <div key={i} className="ces-source">
          {d.title && <h4 className="ces-source-title">🔧 {d.title}</h4>}
          {d.rules.map((rule, j) => (
            <div key={j} className="ces-rule">
              <div className="ces-trigger">
                <span className="ces-trigger-icon" aria-hidden="true">
                  {rule.icon}
                </span>
                <span>{rule.trigger}</span>
              </div>
              {rule.condition && (
                <div className="ces-condition">{rule.condition}</div>
              )}
              {rule.lines.map((line, k) => (
                <p key={k} className={`ces-line ces-line--${line.tone}`}>
                  {renderText(line.text)}
                </p>
              ))}
            </div>
          ))}
        </div>
      ))}

      {keywords.length > 0 && (
        <div className="ces-glossary">
          <div className="ces-glossary-title">{t("effects.ui.keywords")}</div>
          <dl>
            {keywords.map((id: KeywordId) => (
              <div key={id} className="ces-keyword">
                <dt>
                  <span aria-hidden="true">
                    <KeywordIcon id={id} />
                  </span>{" "}
                  {t(`keywords.${id}.name`)}
                </dt>
                <dd>{t(`keywords.${id}.desc`)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </section>
  );
}
