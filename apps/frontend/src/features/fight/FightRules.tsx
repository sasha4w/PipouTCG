import { useState } from "react";
import {
  DECK_RULES,
  HAND_LIMIT,
  STARTING_HAND,
  STARTING_PRIMES,
} from "@pipou/shared";
import type { TFunction } from "i18next";
import { Trans, useTranslation } from "react-i18next";
import Button from "../../components/Button";
import { IconArrowLeft, IconArrowRight } from "../../components/Icons";
import { KEYWORD_IDS } from "./effectText";
import KeywordIcon from "./KeywordIcon";
import "./FightRules.css";

/** Statuts des monstres : le même glossaire que la fiche d'effet des cartes. */
function StatusGrid() {
  const { t } = useTranslation();
  return (
    <div className="fr-status-grid">
      {KEYWORD_IDS.map((id) => (
        <div key={id} className="fr-status-card">
          <div className="fr-status-icon">
            <KeywordIcon id={id} />
          </div>
          <div>
            <div className="fr-status-name">{t(`keywords.${id}.name`)}</div>
            <div className="fr-status-desc">{t(`keywords.${id}.desc`)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Texte de règle traduit ; `<b>…</b>` dans la traduction devient du gras. */
function RuleText({
  k,
  values,
}: {
  k: string;
  values?: Record<string, string | number>;
}) {
  return (
    <Trans
      i18nKey={`fight.rules.${k}`}
      values={values}
      components={{ b: <strong /> }}
    />
  );
}

function Rule({
  k,
  values,
}: {
  k: string;
  values?: Record<string, string | number>;
}) {
  return (
    <div className="fr-rule">
      <div className="fr-dot" />
      <div className="fr-rule-text">
        <RuleText k={k} values={values} />
      </div>
    </div>
  );
}

type Step = { icon: string; label: string; content: React.ReactNode };

function buildSteps(t: TFunction): Step[] {
  return [
    {
      icon: "🏆",
      label: t("fight.rules.step.goal"),
      content: (
        <>
          <div className="fr-win-banner">
            <span className="fr-win-icon">🏆</span>
            <div>
              <div className="fr-win-sub">{t("fight.rules.winLabel")}</div>
              <div className="fr-win-val">
                {t("fight.rules.winValue", { count: STARTING_PRIMES })}
              </div>
            </div>
          </div>
          <div className="fr-rule-list">
            <Rule k="goal1" />
            <Rule k="goal2" />
            <Rule k="goal3" />
          </div>
        </>
      ),
    },
    {
      icon: "🃏",
      label: t("fight.rules.step.setup"),
      content: (
        <div className="fr-rule-list">
          <Rule
            k="setup1"
            values={{
              min: DECK_RULES.MIN_CARDS,
              max: DECK_RULES.MAX_CARDS,
              copies: DECK_RULES.MAX_COPIES,
            }}
          />
          <Rule k="setup2" values={{ count: STARTING_PRIMES }} />
          <Rule k="setup3" values={{ count: STARTING_HAND }} />
          <Rule k="setup4" />
        </div>
      ),
    },
    {
      icon: "🗺️",
      label: t("fight.rules.step.board"),
      content: (
        <div className="fr-rule-list">
          <Rule k="board1" />
          <Rule k="board2" />
          <Rule k="board3" values={{ count: STARTING_PRIMES }} />
        </div>
      ),
    },
    {
      icon: "🎴",
      label: t("fight.rules.step.cards"),
      content: (
        <div className="fr-rule-list">
          <Rule k="monsters" />
          <div className="fr-rule">
            <div className="fr-dot" />
            <div className="fr-rule-text">
              <RuleText k="supports" />
              <div className="fr-sub">
                <div className="fr-rule-text">
                  <span className="fr-tag fr-tag--support">
                    {t("glossary.kind.EPHEMERAL")}
                  </span>
                  {t("fight.rules.ephemeral")}
                </div>
                <div className="fr-rule-text">
                  <span className="fr-tag fr-tag--support">
                    {t("glossary.kind.TERRAIN")}
                  </span>
                  {t("fight.rules.terrain")}
                </div>
                <div className="fr-rule-text">
                  <span className="fr-tag fr-tag--support">
                    {t("glossary.kind.EQUIPMENT")}
                  </span>
                  {t("fight.rules.equipment")}
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      icon: "✨",
      label: t("fight.rules.step.status"),
      content: <StatusGrid />,
    },
    {
      icon: "⚡",
      label: t("fight.rules.step.energy"),
      content: (
        <div className="fr-rule-list">
          <Rule k="energy1" />
          <Rule k="energy2" />
          <Rule k="energy3" />
        </div>
      ),
    },
    {
      icon: "⚔️",
      label: t("fight.rules.step.combat"),
      content: (
        <div className="fr-rule-list">
          <div className="fr-rule">
            <div className="fr-dot" />
            <div className="fr-rule-text">
              <span className="fr-tag fr-tag--atk">
                {t("fight.rules.atkMode")}
              </span>
              <div className="fr-sub">
                <div className="fr-rule-text">{t("fight.rules.atk1")}</div>
                <div className="fr-rule-text">
                  <RuleText k="atk2" />
                </div>
              </div>
            </div>
          </div>
          <div className="fr-rule">
            <div className="fr-dot" />
            <div className="fr-rule-text">
              <span className="fr-tag fr-tag--guard">
                {t("fight.rules.guardMode")}
              </span>
              <div className="fr-sub">
                <div className="fr-rule-text">{t("fight.rules.guard1")}</div>
                <div className="fr-rule-text">
                  <RuleText k="guard2" />
                </div>
              </div>
            </div>
          </div>
          <Rule k="direct" />
        </div>
      ),
    },
    {
      icon: "🔄",
      label: t("fight.rules.step.primes"),
      content: (
        <div className="fr-rule-list">
          <Rule k="primes1" />
          <Rule k="primes2" />
          <Rule k="primes3" />
        </div>
      ),
    },
    {
      icon: "⏱️",
      label: t("fight.rules.step.turn"),
      content: (
        <div className="fr-phase-list">
          {(
            [
              ["phaseStart", "phaseStartDesc"],
              ["phaseMain", "phaseMainDesc"],
              ["phaseBattle", "phaseBattleDesc"],
              ["phaseEnd", "phaseEndDesc"],
            ] as const
          ).map(([label, desc], i) => (
            <div key={label} className="fr-phase">
              <div className="fr-phase-num">{i + 1}</div>
              <div className="fr-phase-text">
                <strong>{t(`fight.rules.${label}`)}</strong> —{" "}
                {t(`fight.rules.${desc}`, { limit: HAND_LIMIT })}
              </div>
            </div>
          ))}
          <p className="fr-rule-text">⏱ {t("fight.rules.timer")}</p>
        </div>
      ),
    },
  ];
}

export default function FightRules() {
  const { t } = useTranslation();
  const [cur, setCur] = useState(0);
  const steps = buildSteps(t);
  const step = steps[cur];

  return (
    <div className="fr-root">
      {/* Fil d'ariane */}
      <div className="fr-breadcrumb">
        {steps.map((s, i) => (
          <span key={i} className="fr-bc-item">
            <button
              className={`fr-bc-step${i === cur ? " fr-bc-step--active" : i < cur ? " fr-bc-step--done" : ""}`}
              onClick={() => setCur(i)}
            >
              <span className="fr-bc-dot">
                {i < cur ? "✓" : i === cur ? s.icon : i + 1}
              </span>
              <span className="fr-bc-label">{s.label}</span>
            </button>
            {i < steps.length - 1 && <span className="fr-bc-sep">›</span>}
          </span>
        ))}
      </div>

      {/* Slide */}
      <div className="fr-slide" key={cur}>
        <div className="fr-slide-header">
          <div className="fr-slide-icon">{step.icon}</div>
          <div>
            <div className="fr-slide-step">
              {t("fight.rules.stepOf", { n: cur + 1, total: steps.length })}
            </div>
            <div className="fr-slide-title">{step.label}</div>
          </div>
        </div>
        {step.content}
      </div>

      {/* Navigation */}
      <div className="fr-nav">
        <Button
          variant="ghost-bordeaux"
          onClick={() => setCur((c) => c - 1)}
          disabled={cur === 0}
        >
          <IconArrowLeft size={16} />
          {t("fight.rules.prev")}
        </Button>
        <span className="fr-nav-counter">
          {cur + 1} / {steps.length}
        </span>
        <Button
          onClick={() => setCur((c) => c + 1)}
          disabled={cur === steps.length - 1}
        >
          {t("fight.rules.next")}
          <IconArrowRight size={16} />
        </Button>
      </div>
    </div>
  );
}
