import { useState } from "react";
import {
  COUNTER_OFFENSIVE_PER_TURN,
  DECK_RULES,
  EQUIP_SLOT_CAPACITY,
  EquipmentSlot,
  GUARD_MAX_TURNS,
  HAND_LIMIT,
  STARTING_HAND,
  STARTING_PRIMES,
} from "@pipou/shared";
import type { TFunction } from "i18next";
import { Trans, useTranslation } from "react-i18next";
import Button from "../../components/Button";
import {
  IconArrowLeft,
  IconArrowRight,
  IconBolt,
  IconCards,
  IconCheck,
  IconEvolve,
  IconGem,
  IconHourglass,
  IconMap,
  IconSparkles,
  IconSwords,
  IconTrophy,
  IconUndo,
} from "../../components/Icons";
import TutorialHome from "../tutorial/TutorialHome";
import { STARTER_ORDER, starterTextKey } from "../starter/starterTexts";
import type { KeywordId } from "./effectText";
import KeywordIcon from "./KeywordIcon";
import "./FightRules.css";

/** Statuts classés : ce qu'on subit, le combat, les immunités, l'invocation. */
const STATUS_GROUPS: { id: string; keywords: readonly KeywordId[] }[] = [
  {
    id: "restraint",
    keywords: ["freeze", "guardLock", "forcedAttack", "countdown"],
  },
  {
    id: "combat",
    keywords: [
      "taunt",
      "ignoreTaunt",
      "piercing",
      "damageReduction",
      "reflect",
      "doubleAttack",
      "multiAttack",
      "tempAtk",
    ],
  },
  {
    id: "immunity",
    keywords: [
      "combatImmunity",
      "combatEndure",
      "supportShield",
      "supportDebuffImmunity",
      "monsterDebuffImmunity",
      "monsterStatusImmunity",
      "debuffImmunity",
    ],
  },
  {
    id: "summon",
    keywords: ["hatch", "evolutionJoker", "instantEvolution", "releve"],
  },
];

function StatusGrid() {
  const { t } = useTranslation();
  return (
    <div className="fr-status-groups">
      {STATUS_GROUPS.map((g) => (
        <section key={g.id} data-testid={`status-group-${g.id}`}>
          <h3 className="fr-status-group-title">
            {t(`fight.rules.statusGroup.${g.id}`)}
          </h3>
          <div className="fr-status-grid">
            {g.keywords.map((id) => (
              <div key={id} className="fr-status-card">
                <div className="fr-status-icon">
                  <KeywordIcon id={id} />
                </div>
                <div>
                  <div className="fr-status-name">
                    {t(`keywords.${id}.name`)}
                  </div>
                  <div className="fr-status-desc">
                    {t(`keywords.${id}.desc`)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
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

type Step = { icon: React.ReactNode; label: string; content: React.ReactNode };

function buildSteps(t: TFunction): Step[] {
  return [
    {
      icon: <IconTrophy size={20} />,
      label: t("fight.rules.step.goal"),
      content: (
        <>
          <div className="fr-win-banner">
            <span className="fr-win-icon">
              <IconTrophy size={28} />
            </span>
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
      icon: <IconCards size={20} />,
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
      icon: <IconMap size={20} />,
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
      icon: <IconGem size={20} />,
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
                    {t("glossary.kind.PERSISTENT")}
                  </span>
                  {t("fight.rules.persistent")}
                </div>
                <div className="fr-rule-text">
                  <span className="fr-tag fr-tag--support">
                    {t("glossary.kind.CHARGE")}
                  </span>
                  {t("fight.rules.charge")}
                </div>
                <div className="fr-rule-text">
                  <span className="fr-tag fr-tag--support">
                    {t("glossary.kind.EQUIPMENT")}
                  </span>
                  {t("fight.rules.equipment")}
                  <div className="fr-rule-text" data-testid="equip-slots">
                    {t("fight.rules.equipmentSlots", {
                      offensiveLabel: t("glossary.equipmentSlot.OFFENSIVE"),
                      defensiveLabel: t("glossary.equipmentSlot.DEFENSIVE"),
                      accessoryLabel: t("glossary.equipmentSlot.ACCESSORY"),
                      offensive: EQUIP_SLOT_CAPACITY[EquipmentSlot.OFFENSIVE],
                      defensive: EQUIP_SLOT_CAPACITY[EquipmentSlot.DEFENSIVE],
                      accessory: EQUIP_SLOT_CAPACITY[EquipmentSlot.ACCESSORY],
                    })}
                  </div>
                </div>
              </div>
              <div className="fr-rule-text" data-testid="support-limits">
                {t("fight.rules.supportLimits")}
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      icon: <IconSparkles size={20} />,
      label: t("fight.rules.step.status"),
      content: <StatusGrid />,
    },
    {
      icon: <IconBolt size={20} />,
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
      icon: <IconSwords size={20} />,
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
                <div className="fr-rule-text" data-testid="guard-rules">
                  <RuleText
                    k="guard3"
                    values={{
                      turns: GUARD_MAX_TURNS,
                      atk: COUNTER_OFFENSIVE_PER_TURN,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
          <Rule k="direct" />
        </div>
      ),
    },
    {
      icon: <IconUndo size={20} />,
      label: t("fight.rules.step.primes"),
      content: (
        <div className="fr-rule-list">
          <Rule k="primes1" />
          <Rule k="primes2" />
          <Rule k="primes3" />
          <Rule k="primes4" />
          <Rule k="primes5" />
        </div>
      ),
    },
    {
      icon: <IconEvolve size={20} />,
      label: t("fight.rules.step.special"),
      content: (
        <div className="fr-rule-list">
          {(
            ["evolution", "transform", "releve", "zeta", "origins"] as const
          ).map((k) => (
            <div key={k} className="fr-rule" data-testid={`special-${k}`}>
              <div className="fr-dot" />
              <div className="fr-rule-text">
                <RuleText k={`special.${k}`} />
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      icon: <IconHourglass size={20} />,
      label: t("fight.rules.step.turn"),
      content: (
        <div className="fr-phase-list">
          {(
            [
              ["phaseStart", "phaseStartDesc"],
              ["phaseMain", "phaseMainDesc"],
              ["phaseBattle", "phaseBattleDesc"],
              ["phaseControl", "phaseControlDesc"],
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
          <p className="fr-rule-text">{t("fight.rules.timer")}</p>
        </div>
      ),
    },
    {
      icon: <IconCards size={20} />,
      label: t("fight.rules.step.starters"),
      content: (
        <div className="fr-rule-list">
          {STARTER_ORDER.map((a) => (
            <div key={a} className="fr-rule">
              <div className="fr-dot" />
              <div className="fr-rule-text">
                <strong>{t(`${starterTextKey(a)}.name`)}</strong>
                <div className="fr-sub">
                  <div className="fr-rule-text">
                    {t(`${starterTextKey(a)}.gameplay`)}
                  </div>
                  <div
                    className="fr-rule-text"
                    style={{ whiteSpace: "pre-line" }}
                  >
                    <strong>{t("starter.how_to_play")}</strong>
                    <br />
                    {t(`${starterTextKey(a)}.how_to_play`)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ),
    },
  ];
}

/** Référence des règles, étape par étape. */
export function RulesReference() {
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
                {i < cur ? <IconCheck size={14} /> : i === cur ? s.icon : i + 1}
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

type RulesTab = "tutorial" | "reference";

/** Onglet Règles : leçons jouables (par défaut) et référence. */
export default function FightRules() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<RulesTab>("tutorial");
  return (
    <div className="fr-tabs-root">
      <div className="fr-tabs" role="tablist">
        {(["tutorial", "reference"] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`fr-tab${tab === id ? " fr-tab--active" : ""}`}
            onClick={() => setTab(id)}
          >
            {t(id === "tutorial" ? "tutorial.ui.tab" : "tutorial.ui.reference")}
          </button>
        ))}
      </div>
      {tab === "tutorial" ? <TutorialHome /> : <RulesReference />}
    </div>
  );
}
