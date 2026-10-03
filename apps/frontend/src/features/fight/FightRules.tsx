import { useState } from "react";
import {
  DECK_RULES,
  HAND_LIMIT,
  STARTING_HAND,
  STARTING_PRIMES,
} from "@pipou/shared";
import Button from "../../components/Button";
import { IconArrowLeft, IconArrowRight } from "../../components/Icons";
import "./FightRules.css";

type Step = { icon: string; label: string; content: React.ReactNode };

const STEPS: Step[] = [
  {
    icon: "🏆",
    label: "But du jeu",
    content: (
      <>
        <div className="fr-win-banner">
          <span className="fr-win-icon">🏆</span>
          <div>
            <div className="fr-win-sub">Condition de victoire</div>
            <div className="fr-win-val">
              Récupérer ses {STARTING_PRIMES} Cartes Primes en premier
            </div>
          </div>
        </div>
        <div className="fr-rule-list">
          <div className="fr-rule">
            <div className="fr-dot" />
            <div className="fr-rule-text">
              Le jeu se joue en <strong>1 contre 1</strong>.
            </div>
          </div>
          <div className="fr-rule">
            <div className="fr-dot" />
            <div className="fr-rule-text">
              Si les deux joueurs récupèrent leur dernière Prime en même temps :{" "}
              <strong>match nul</strong>.
            </div>
          </div>
          <div className="fr-rule">
            <div className="fr-dot" />
            <div className="fr-rule-text">
              Un joueur qui doit piocher avec un deck vide <strong>perd</strong>
              .
            </div>
          </div>
        </div>
      </>
    ),
  },
  {
    icon: "🃏",
    label: "Préparation",
    content: (
      <div className="fr-rule-list">
        <div className="fr-rule">
          <div className="fr-dot" />
          <div className="fr-rule-text">
            <strong>Deck :</strong> {DECK_RULES.MIN_CARDS} à{" "}
            {DECK_RULES.MAX_CARDS} cartes, {DECK_RULES.MAX_COPIES} exemplaires
            max par carte.
          </div>
        </div>
        <div className="fr-rule">
          <div className="fr-dot" />
          <div className="fr-rule-text">
            <strong>Zone Prime :</strong> les {STARTING_PRIMES} premières cartes
            du deck mélangé, face cachée.
          </div>
        </div>
        <div className="fr-rule">
          <div className="fr-dot" />
          <div className="fr-rule-text">
            <strong>Main de départ :</strong> {STARTING_HAND} cartes.{" "}
            <strong>Mulligan :</strong> une fois, tu peux remélanger ta main
            dans le deck et repiocher {STARTING_HAND} cartes.
          </div>
        </div>
        <div className="fr-rule">
          <div className="fr-dot" />
          <div className="fr-rule-text">
            Le premier joueur est <strong>tiré au sort</strong>.
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: "🗺️",
    label: "Plateau",
    content: (
      <div className="fr-rule-list">
        <div className="fr-rule">
          <div className="fr-dot" />
          <div className="fr-rule-text">
            <strong>3 Zones Monstre</strong> pour les invocations.
          </div>
        </div>
        <div className="fr-rule">
          <div className="fr-dot" />
          <div className="fr-rule-text">
            <strong>3 Zones Support</strong> pour les Terrains.
          </div>
        </div>
        <div className="fr-rule">
          <div className="fr-dot" />
          <div className="fr-rule-text">
            <strong>1 Zone Prime</strong> avec {STARTING_PRIMES} cartes face
            cachée.
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: "🎴",
    label: "Types de cartes",
    content: (
      <div className="fr-rule-list">
        <div className="fr-rule">
          <div className="fr-dot" />
          <div className="fr-rule-text">
            <strong>Monstres :</strong> ATK / PV, archétype, coût de 0 à 3
            Énergies, effets passifs ou déclenchés. Un monstre peut attaquer dès
            son invocation, sauf si sa carte dit le contraire.
          </div>
        </div>
        <div className="fr-rule">
          <div className="fr-dot" />
          <div className="fr-rule-text">
            <strong>Cartes Support :</strong>
            <div className="fr-sub">
              <div className="fr-rule-text">
                <span className="fr-tag fr-tag--support">Éphémère</span>
                Utilisation unique puis défausse. Certaines demandent de choisir
                un monstre cible.
              </div>
              <div className="fr-rule-text">
                <span className="fr-tag fr-tag--support">Terrain</span>
                Permanent, agit sur tes monstres uniquement.
              </div>
              <div className="fr-rule-text">
                <span className="fr-tag fr-tag--support">Équipement</span>
                Attaché à un de tes monstres ; certains effets ne s'activent que
                sur un monstre précis.
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: "✨",
    label: "Status monstres",
    content: (
      <div className="fr-status-grid">
        {[
          [
            "🛡",
            "Provocation",
            "Les ennemis doivent attaquer ce monstre en priorité.",
          ],
          [
            "🗡",
            "Perçant",
            "Ignore la réduction de dégâts, et rapporte une Prime en détruisant un monstre en Garde.",
          ],
          [
            "✨",
            "Immunité débuffs",
            "Le monstre ne peut pas recevoir de malus d'ATK temporaire.",
          ],
          ["⚡", "Double attaque", "Deux attaques au prochain tour, puis une."],
          ["✖️", "Attaques ×N", "Peut attaquer plusieurs fois par tour."],
          ["😈", "Attaque forcée", "Le monstre est bloqué en mode Attaque."],
          [
            "🔒",
            "Garde verrouillée",
            "Bloqué en Garde jusqu'à ce qu'il soit attaqué.",
          ],
          ["🧊", "Gel", "Ne peut pas attaquer pendant N de ses tours."],
          [
            "🛡",
            "Réduction dégâts",
            "Les dégâts reçus sont divisés par un coefficient.",
          ],
          ["⚡", "ATK temporaire", "Bonus d'ATK actif jusqu'à la fin du tour."],
        ].map(([ic, name, desc], i) => (
          <div key={i} className="fr-status-card">
            <div className="fr-status-icon">{ic}</div>
            <div>
              <div className="fr-status-name">{name}</div>
              <div className="fr-status-desc">{desc}</div>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: "⚡",
    label: "Énergie",
    content: (
      <div className="fr-rule-list">
        <div className="fr-rule">
          <div className="fr-dot" />
          <div className="fr-rule-text">
            <strong>Générer :</strong> recycle des cartes de ta main pendant la
            Main Phase. <strong>1 carte = 1 Énergie.</strong>
          </div>
        </div>
        <div className="fr-rule">
          <div className="fr-dot" />
          <div className="fr-rule-text">
            Sans assez d'énergie, tu paies le reste en défaussant des cartes au
            moment d'invoquer.
          </div>
        </div>
        <div className="fr-rule">
          <div className="fr-dot" />
          <div className="fr-rule-text">
            <strong>Réinitialisation :</strong> l'énergie retombe à 0 en fin de
            tour.
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: "⚔️",
    label: "Combat",
    content: (
      <div className="fr-rule-list">
        <div className="fr-rule">
          <div className="fr-dot" />
          <div className="fr-rule-text">
            <span className="fr-tag fr-tag--atk">Mode ATK</span>
            <div className="fr-sub">
              <div className="fr-rule-text">
                Une attaque par tour (sauf effet). Riposte s'il est attaqué.
              </div>
              <div className="fr-rule-text">
                Si détruit → l'adversaire gagne <strong>1 Prime</strong>.
              </div>
            </div>
          </div>
        </div>
        <div className="fr-rule">
          <div className="fr-dot" />
          <div className="fr-rule-text">
            <span className="fr-tag fr-tag--guard">Mode Garde</span>
            <div className="fr-sub">
              <div className="fr-rule-text">
                Ne peut pas attaquer ni riposter.
              </div>
              <div className="fr-rule-text">
                Si détruit → <strong>aucune Prime</strong>, sauf contre un
                attaquant Perçant.
              </div>
            </div>
          </div>
        </div>
        <div className="fr-rule">
          <div className="fr-dot" />
          <div className="fr-rule-text">
            <strong>Attaque directe</strong> (pas au tour 1) si l'adversaire n'a
            aucun monstre : tu gagnes 1 Prime et l'adversaire pioche 1 carte.
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: "🔄",
    label: "Primes & Comeback",
    content: (
      <div className="fr-rule-list">
        <div className="fr-rule">
          <div className="fr-dot" />
          <div className="fr-rule-text">
            <strong>Destruction :</strong> quand un de tes monstres est détruit
            en combat ou par un effet adverse, tu pioches 1 carte.
          </div>
        </div>
        <div className="fr-rule">
          <div className="fr-dot" />
          <div className="fr-rule-text">
            <strong>Récupération :</strong> une Prime gagnée rejoint ta main.
          </div>
        </div>
        <div className="fr-rule">
          <div className="fr-dot" />
          <div className="fr-rule-text">
            <strong>Double K.O :</strong> deux monstres ATK se détruisent →
            chaque joueur pioche 1 carte et récupère 1 Prime.
          </div>
        </div>
      </div>
    ),
  },
  {
    icon: "⏱️",
    label: "Structure du tour",
    content: (
      <div className="fr-phase-list">
        {[
          [
            "Début de tour",
            "Effets de début de tour, puis pioche d'1 carte (tour 1 compris).",
          ],
          [
            "Main Phase",
            "Recycle pour l'Énergie, invoque, joue des Supports, change la position de tes monstres.",
          ],
          [
            "Battle Phase",
            "Attaque les monstres adverses, ou directement si le terrain adverse est vide.",
          ],
          [
            "Ending Phase",
            `Effets de fin de tour, Énergie → 0, ${HAND_LIMIT} cartes max en main (défausse l'excédent).`,
          ],
        ].map(([label, desc], i) => (
          <div key={i} className="fr-phase">
            <div className="fr-phase-num">{i + 1}</div>
            <div className="fr-phase-text">
              <strong>{label}</strong> — {desc}
            </div>
          </div>
        ))}
        <p className="fr-rule-text">
          ⏱ 90 s par phase : à l'expiration, la phase suivante commence
          automatiquement.
        </p>
      </div>
    ),
  },
];

export default function FightRules() {
  const [cur, setCur] = useState(0);
  const step = STEPS[cur];

  return (
    <div className="fr-root">
      {/* Fil d'ariane */}
      <div className="fr-breadcrumb">
        {STEPS.map((s, i) => (
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
            {i < STEPS.length - 1 && <span className="fr-bc-sep">›</span>}
          </span>
        ))}
      </div>

      {/* Slide */}
      <div className="fr-slide" key={cur}>
        <div className="fr-slide-header">
          <div className="fr-slide-icon">{step.icon}</div>
          <div>
            <div className="fr-slide-step">
              Étape {cur + 1} / {STEPS.length}
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
          Précédent
        </Button>
        <span className="fr-nav-counter">
          {cur + 1} / {STEPS.length}
        </span>
        <Button
          onClick={() => setCur((c) => c + 1)}
          disabled={cur === STEPS.length - 1}
        >
          Suivant
          <IconArrowRight size={16} />
        </Button>
      </div>
    </div>
  );
}
