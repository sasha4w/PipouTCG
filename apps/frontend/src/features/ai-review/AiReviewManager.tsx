import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AI_OUTCOMES,
  AI_PROBLEM_CATEGORIES,
  AI_VERDICTS,
  type AiOutcome,
  type AiProblemCategory,
  type AiVerdict,
} from "@pipou/shared";
import Button from "../../components/Button";
import Loading from "../../components/Loading";
import { IconUndo } from "../../components/Icons";
import { aiReviewService } from "../../services/ai-review.service";
import type {
  AiReviewDecision,
  AiReviewDecisionSummary,
  AiReviewGame,
} from "../../services/ai-review.service";
import { QUERY_KEYS } from "../../utils/querykeys";
import { apiErrorMessage } from "../../utils/errors";
import "./AiReview.css";

/** Regret à partir duquel une décision est affichée comme suspecte (même seuil que le serveur). */
const SUSPECT_REGRET = 5;

const VERDICT_LABELS: Record<AiVerdict, string> = {
  good: "Bon coup",
  better_action: "Il y avait mieux",
  tactical_error: "Erreur tactique",
  missing_candidate: "Coup absent des choix",
  uncertain: "Pas sûr",
};

const CATEGORY_LABELS: Record<AiProblemCategory, string> = {
  candidate_generation: "Génération des coups",
  heuristic_evaluation: "Évaluation heuristique",
  lookahead: "Manque d'anticipation",
  combat_calculation: "Calcul de combat",
  threat_priority: "Priorité des menaces",
  card_synergy: "Synergie entre cartes",
  opportunity_cost: "Coût d'opportunité",
  other: "Autre",
};

const OUTCOME_LABELS: Record<AiOutcome, string> = {
  win: "L'IA a gagné",
  loss: "L'IA a perdu",
  draw: "Égalité",
};

/** Onglet admin : relire les décisions de l'IA sur tes combats d'aventure et les annoter. */
export default function AiReviewManager() {
  const [gameId, setGameId] = useState<string | null>(null);
  const [decisionId, setDecisionId] = useState<string | null>(null);

  if (gameId && decisionId)
    return (
      <DecisionDetail id={decisionId} onBack={() => setDecisionId(null)} />
    );
  if (gameId)
    return (
      <DecisionList
        gameId={gameId}
        onOpen={setDecisionId}
        onBack={() => setGameId(null)}
      />
    );
  return <GameList onOpen={setGameId} />;
}

function GameList({ onOpen }: { onOpen: (gameId: string) => void }) {
  const games = useQuery({
    queryKey: QUERY_KEYS.aiReview.games,
    queryFn: () => aiReviewService.games(),
  });

  return (
    <div className="air">
      <p className="air__intro">
        Les décisions de l'IA sont enregistrées quand tu joues un combat
        d'aventure avec un compte admin. Ouvre un combat, repère les coups
        suspects, puis annote-les.
      </p>
      {games.isLoading && <Loading message="Chargement des combats…" />}
      {games.isError && (
        <p className="air__error">{apiErrorMessage(games.error)}</p>
      )}
      {games.data?.length === 0 && (
        <p className="air__muted">Aucun combat enregistré pour l'instant.</p>
      )}
      <ul className="air__list">
        {games.data?.map((g) => (
          <GameRow key={g.gameId} game={g} onOpen={onOpen} />
        ))}
      </ul>
    </div>
  );
}

function GameRow({
  game,
  onOpen,
}: {
  game: AiReviewGame;
  onOpen: (gameId: string) => void;
}) {
  return (
    <li className="air__item">
      <div className="air__item-main">
        <span className="air__title">
          IA {game.archetype}, niveau {game.level}
        </span>
        <span className="air__muted">
          {new Date(game.createdAt).toLocaleString("fr-FR")}
        </span>
        <span className="air__muted">
          {game.decisions} coups, {game.suspects} suspects, {game.annotated}{" "}
          annotés
        </span>
      </div>
      <Button size="sm" onClick={() => onOpen(game.gameId)}>
        Ouvrir
      </Button>
    </li>
  );
}

function DecisionList({
  gameId,
  onOpen,
  onBack,
}: {
  gameId: string;
  onOpen: (id: string) => void;
  onBack: () => void;
}) {
  const [onlySuspects, setOnlySuspects] = useState(true);
  const decisions = useQuery({
    queryKey: QUERY_KEYS.aiReview.decisions(gameId),
    queryFn: () => aiReviewService.decisions(gameId),
  });
  const shown = (decisions.data ?? []).filter(
    (d) => !onlySuspects || d.regret >= SUSPECT_REGRET,
  );

  return (
    <div className="air">
      <BackButton onBack={onBack} />
      <label className="air__check">
        <input
          type="checkbox"
          checked={onlySuspects}
          onChange={(e) => setOnlySuspects(e.target.checked)}
        />
        Seulement les coups suspects
      </label>
      <p className="air__muted">
        L'écart est un indicateur approximatif : il dit « à regarder », pas «
        erreur ».
      </p>
      {decisions.isLoading && <Loading message="Chargement des coups…" />}
      {decisions.isError && (
        <p className="air__error">{apiErrorMessage(decisions.error)}</p>
      )}
      {decisions.data && shown.length === 0 && (
        <p className="air__muted">Aucun coup à afficher.</p>
      )}
      <ul className="air__list">
        {shown.map((d) => (
          <DecisionRow key={d.id} decision={d} onOpen={onOpen} />
        ))}
      </ul>
    </div>
  );
}

function DecisionRow({
  decision,
  onOpen,
}: {
  decision: AiReviewDecisionSummary;
  onOpen: (id: string) => void;
}) {
  return (
    <li className="air__item">
      <div className="air__item-main">
        <span className="air__title">{decision.chosenText}</span>
        <span className="air__muted">
          Tour {decision.turn}, phase {decision.phase}, {decision.source},
          écart {decision.regret.toFixed(0)}
          {decision.annotated ? ", annoté" : ""}
        </span>
      </div>
      <Button size="sm" onClick={() => onOpen(decision.id)}>
        Voir
      </Button>
    </li>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <Button
      variant="ghost-bordeaux"
      size="icon"
      aria-label="Retour"
      onClick={onBack}
    >
      <IconUndo />
    </Button>
  );
}

function DecisionDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const decision = useQuery({
    queryKey: QUERY_KEYS.aiReview.decision(id),
    queryFn: () => aiReviewService.decision(id),
  });

  return (
    <div className="air">
      <BackButton onBack={onBack} />
      {decision.isLoading && <Loading message="Chargement du coup…" />}
      {decision.isError && (
        <p className="air__error">{apiErrorMessage(decision.error)}</p>
      )}
      {decision.data && <DecisionBody decision={decision.data} />}
    </div>
  );
}

function DecisionBody({ decision }: { decision: AiReviewDecision }) {
  return (
    <>
      <p className="air__title">{decision.chosenText}</p>
      <p className="air__muted">
        Tour {decision.turn}, phase {decision.phase}, IA {decision.archetype}{" "}
        niveau {decision.level}, choix : {decision.source}
      </p>
      <ol className="air__candidates">
        {decision.candidates.map((c) => (
          <li
            key={c.index}
            className={c.chosen ? "air__cand air__cand--chosen" : "air__cand"}
          >
            <span>{c.text}</span>
            <span className="air__score">{c.score.toFixed(0)}</span>
          </li>
        ))}
      </ol>
      {decision.simulationCrashes.map((c) => (
        <p key={c.text} className="air__error">
          Simulation en erreur : {c.text} ({c.message})
        </p>
      ))}
      {decision.annotations.length > 0 && (
        <ul className="air__list">
          {decision.annotations.map((a) => (
            <li key={a.id} className="air__item">
              <div className="air__item-main">
                <span className="air__title">{VERDICT_LABELS[a.verdict]}</span>
                <span className="air__muted">
                  {a.category ? CATEGORY_LABELS[a.category] : ""}
                  {a.comment ? `, ${a.comment}` : ""}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
      <AnnotationForm decision={decision} />
    </>
  );
}

function AnnotationForm({ decision }: { decision: AiReviewDecision }) {
  const queryClient = useQueryClient();
  const [verdict, setVerdict] = useState<AiVerdict>("better_action");
  const [preferred, setPreferred] = useState("");
  const [category, setCategory] = useState("");
  const [outcome, setOutcome] = useState("");
  const [comment, setComment] = useState("");

  const save = useMutation({
    mutationFn: () =>
      aiReviewService.annotate(decision.id, {
        verdict,
        ...(preferred !== "" && { preferredIndex: Number(preferred) }),
        ...(category !== "" && { category: category as AiProblemCategory }),
        ...(outcome !== "" && { outcome: outcome as AiOutcome }),
        ...(comment.trim() !== "" && { comment }),
      }),
    onSuccess: () => {
      setComment("");
      queryClient.invalidateQueries({ queryKey: ["admin", "ai-review"] });
    },
  });

  return (
    <form
      className="air__form"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <label className="air__field">
        Verdict
        <select
          value={verdict}
          onChange={(e) => setVerdict(e.target.value as AiVerdict)}
        >
          {AI_VERDICTS.map((v) => (
            <option key={v} value={v}>
              {VERDICT_LABELS[v]}
            </option>
          ))}
        </select>
      </label>
      <label className="air__field">
        Coup qu'il fallait jouer
        <select value={preferred} onChange={(e) => setPreferred(e.target.value)}>
          <option value="">Aucun</option>
          {decision.candidates.map((c) => (
            <option key={c.index} value={c.index}>
              {c.text}
            </option>
          ))}
        </select>
      </label>
      <label className="air__field">
        Type de problème
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Non précisé</option>
          {AI_PROBLEM_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </label>
      <label className="air__field">
        Résultat du combat
        <select value={outcome} onChange={(e) => setOutcome(e.target.value)}>
          <option value="">Inconnu</option>
          {AI_OUTCOMES.map((o) => (
            <option key={o} value={o}>
              {OUTCOME_LABELS[o]}
            </option>
          ))}
        </select>
      </label>
      <label className="air__field">
        Pourquoi
        <textarea
          rows={3}
          maxLength={2000}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />
      </label>
      {save.isError && (
        <p className="air__error">{apiErrorMessage(save.error)}</p>
      )}
      {save.isSuccess && <p className="air__muted">Annotation enregistrée.</p>}
      <Button type="submit" fullWidth disabled={save.isPending}>
        Enregistrer l'annotation
      </Button>
    </form>
  );
}
