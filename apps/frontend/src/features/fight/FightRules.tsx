import { useState } from "react";
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
              Récupérer ses 6 Cartes Primes en premier
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
              La partie se termine dès qu'un joueur récupère toutes ses{" "}
              <strong>6 Primes</strong>.
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
            <strong>Deck :</strong> minimum 30 cartes, max 3 exemplaires par
            carte.
          </div>
        </div>
        <div className="fr-rule">
          <div className="fr-dot" />
          <div className="fr-rule-text">
            <strong>Zone Prime :</strong> retirez les 6 premières cartes et
            placez-les face cachée avant le début.
          </div>
        </div>
        <div className="fr-rule">
          <div className="fr-dot" />
          <div className="fr-rule-text">
            <strong>Main de départ :</strong> piochez 5 cartes.
          </div>
        </div>
        <div className="fr-rule">
          <div className="fr-dot" />
          <div className="fr-rule-text">
            <strong>Limite de main :</strong> max 9 cartes — défaussez
            l'excédent immédiatement.
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
            <strong>3 Zones Support</strong> pour les Terrains et Équipements.
          </div>
        </div>
        <div className="fr-rule">
          <div className="fr-dot" />
          <div className="fr-rule-text">
            <strong>1 Zone Prime</strong> avec 6 cartes face cachée.
          </div>
        </div>
        <div className="fr-rule">
          <div className="fr-dot" />
          <div className="fr-rule-text">
            Chaque joueur a son propre plateau, en miroir de l'adversaire.
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
            <strong>Monstres :</strong> stats ATK / HP, archétype, coût (1–3
            Énergies) et effets passifs ou déclenchés.
          </div>
        </div>
        <div className="fr-rule">
          <div className="fr-dot" />
          <div className="fr-rule-text">
            <strong>Cartes Support :</strong>
            <div className="fr-sub">
              <div className="fr-rule-text">
                <span className="fr-tag fr-tag--support">Éphémère</span>
                Utilisation unique puis défausse.
              </div>
              <div className="fr-rule-text">
                <span className="fr-tag fr-tag--support">Terrain</span>
                Permanent, buff sur vos 3 zones Monstre.
              </div>
              <div className="fr-rule-text">
                <span className="fr-tag fr-tag--support">Équipement</span>
                Permanent, buff sur un monstre spécifique.
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
            "Force les ennemis à attaquer ce monstre en priorité.",
          ],
          [
            "🗡",
            "Perçant",
            "Les dégâts ignorent certaines réductions adverses.",
          ],
          [
            "✨",
            "Immunité débuffs",
            "Le monstre ne peut pas recevoir de débuffs.",
          ],
          [
            "⚡",
            "Double attaque",
            "Attaque deux fois par tour (au prochain tour).",
          ],
          ["✖️", "Attaques ×N", "Peut attaquer plusieurs fois par tour."],
          ["😈", "Attaque forcée", "Le monstre est bloqué en mode Attaque."],
          [
            "🛡",
            "Réduction dégâts",
            "Les dégâts reçus sont divisés par un coefficient.",
          ],
          ["⚡", "ATK temporaire", "Bonus d'ATK actif uniquement ce tour."],
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
            <strong>Générer :</strong> défaussez des cartes pendant la Main
            Phase. <strong>1 carte = 1 Énergie.</strong>
          </div>
        </div>
        <div className="fr-rule">
          <div className="fr-dot" />
          <div className="fr-rule-text">
            <strong>Réinitialisation :</strong> le compteur tombe à 0 en fin de
            tour. L'énergie non utilisée est perdue.
          </div>
        </div>
        <div className="fr-rule">
          <div className="fr-dot" />
          <div className="fr-rule-text">
            Bien gérer sa main est crucial — chaque carte peut devenir de
            l'énergie.
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
                Peut déclarer une attaque par tour. Contre-attaque s'il est
                attaqué.
              </div>
              <div className="fr-rule-text">
                Si détruit → l'adversaire gagne <strong>1 Carte Prime</strong>.
              </div>
            </div>
          </div>
        </div>
        <div className="fr-rule">
          <div className="fr-dot" />
          <div className="fr-rule-text">
            <span className="fr-tag fr-tag--guard">Mode Garde</span>
            <div className="fr-sub">
              <div className="fr-rule-text">Ne peut pas attaquer.</div>
              <div className="fr-rule-text">
                Si détruit → <strong>aucune Prime</strong> pour l'adversaire.
              </div>
            </div>
          </div>
        </div>
        <div className="fr-rule">
          <div className="fr-dot" />
          <div className="fr-rule-text">
            Terrain adverse vide → <strong>attaque directe</strong> pour
            récupérer 1 Prime.
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
            <strong>Destruction :</strong> quand un de vos monstres est détruit,
            piochez 1 carte.
          </div>
        </div>
        <div className="fr-rule">
          <div className="fr-dot" />
          <div className="fr-rule-text">
            <strong>Récupération :</strong> quand vous gagnez une Prime,
            ajoutez-la à votre main.
          </div>
        </div>
        <div className="fr-rule">
          <div className="fr-dot" />
          <div className="fr-rule-text">
            <strong>Double K.O :</strong> deux monstres ATK se détruisent
            mutuellement → les deux joueurs piochent 1 carte et récupèrent 1
            Prime.
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
          ["Draw Phase", "Piochez 1 carte."],
          [
            "Main Phase",
            "Défaussez pour générer de l'Énergie. Invoquez, jouez des Supports, changez la position de vos monstres.",
          ],
          [
            "Battle Phase",
            "Attaquez les monstres adverses. Terrain vide → attaque directe pour 1 Prime.",
          ],
          [
            "Ending Phase",
            "Résolution des effets finaux. Énergie → 0. Vérification limite de main (max 9).",
          ],
        ].map(([label, desc], i) => (
          <div key={i} className="fr-phase">
            <div className="fr-phase-num">{i + 1}</div>
            <div className="fr-phase-text">
              <strong>{label}</strong> — {desc}
            </div>
          </div>
        ))}
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
        <button
          className="fr-nav-btn"
          onClick={() => setCur((c) => c - 1)}
          disabled={cur === 0}
        >
          ← Précédent
        </button>
        <span className="fr-nav-counter">
          {cur + 1} / {STEPS.length}
        </span>
        <button
          className="fr-nav-btn fr-nav-btn--next"
          onClick={() => setCur((c) => c + 1)}
          disabled={cur === STEPS.length - 1}
        >
          Suivant →
        </button>
      </div>
    </div>
  );
}
