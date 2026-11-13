import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { PuzzleStatus } from "@pipou/shared";
import type { AdminPuzzle, PuzzleSaveBody, PuzzleVerifyResult } from "@pipou/shared";
import { puzzleService } from "../../../services/puzzle.service";
import { QUERY_KEYS } from "../../../utils/querykeys";
import { apiErrorMessage, apiErrorStatus } from "../../../utils/errors";
import Button from "../../../components/Button";
import Loading from "../../../components/Loading";
import { IconAlert } from "../../../components/Icons";
import { objectiveText, PUZZLE_PLAY_PATH } from "../puzzleView";
import PuzzleForm from "./PuzzleForm";
import PuzzleCalendar from "./PuzzleCalendar";
import "../../../components/manager.css";
import "./PuzzleAdmin.css";

/** Après toute mutation : liste, calendrier et défi du jour sont potentiellement périmés. */
function invalidatePuzzles(queryClient: QueryClient): Promise<unknown> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.admin.puzzles }),
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.admin.puzzleSchedule }),
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.puzzleToday }),
  ]);
}

const HTTP_CONFLICT = 409;

function formatDate(iso: string, lang: string): string {
  return new Date(iso).toLocaleDateString(lang);
}

function VerifyResult({ result }: { result: PuzzleVerifyResult }) {
  const { t } = useTranslation();
  if (result.status === "solved")
    return (
      <div className="pz-verify" role="status">
        <p>
          {t("puzzle.admin.verify_solved", { ms: result.ms, nodes: result.nodes })}
        </p>
        <ol className="pz-verify__moves">
          {result.solution.map((move, i) => (
            <li key={`${i}-${move}`}>{move}</li>
          ))}
        </ol>
      </div>
    );
  return (
    <p className="pz-verify" role="status">
      {t(
        result.status === "not_found"
          ? "puzzle.admin.verify_not_found"
          : "puzzle.admin.verify_timeout",
      )}
    </p>
  );
}

/** Une ligne de la liste : état, résultat de vérification et actions. */
function PuzzleRow({ puzzle }: { puzzle: AdminPuzzle }) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [override, setOverride] = useState(false);

  const onSuccess = () => invalidatePuzzles(queryClient);
  const verify = useMutation({
    mutationFn: () => puzzleService.verify(puzzle.id),
    onSuccess,
  });
  const publish = useMutation({
    mutationFn: () =>
      puzzleService.publish(puzzle.id, override ? { manualOverride: true } : {}),
    onSuccess,
  });
  const unpublish = useMutation({
    mutationFn: () => puzzleService.unpublish(puzzle.id),
    onSuccess,
  });
  const remove = useMutation({
    mutationFn: () => puzzleService.remove(puzzle.id),
    onSuccess,
  });
  const update = useMutation({
    mutationFn: (body: PuzzleSaveBody) => puzzleService.update(puzzle.id, body),
    onSuccess: async () => {
      setEditing(false);
      setOverride(false);
      await onSuccess();
    },
  });
  const toScenario = useMutation({
    mutationFn: () => puzzleService.toScenario(puzzle.id),
    onSuccess: ({ scenarioId }) =>
      navigate(`/admin/sandbox?scenario=${scenarioId}`),
  });

  const published = puzzle.status === PuzzleStatus.PUBLISHED;
  const verified = puzzle.verifiedAt !== null;
  const busy =
    verify.isPending ||
    publish.isPending ||
    unpublish.isPending ||
    remove.isPending ||
    toScenario.isPending;

  const error = [publish, unpublish, remove, toScenario]
    .map((m) => m.error)
    .find((e) => e != null);
  const objective = objectiveText(puzzle.objective);

  return (
    <li className="pz-row">
      <div className="pz-row__head">
        <div className="manager-item__info">
          <div className="manager-item__name">{puzzle.title}</div>
          <div className="manager-item__meta">
            {t(objective.key, objective.vars)}
          </div>
        </div>
        <span
          className={`manager-item__badge ${published ? "manager-item__badge--active" : "manager-item__badge--pending"}`}
        >
          {published ? t("puzzle.admin.published") : t("puzzle.admin.draft")}
        </span>
      </div>
      <div className="manager-item__meta">
        {puzzle.verifiedAt
          ? t("puzzle.admin.verified", {
              date: formatDate(puzzle.verifiedAt, i18n.language),
            })
          : t("puzzle.admin.unverified")}
        {" · "}
        {puzzle.lastPlayed
          ? t("puzzle.admin.last_played", {
              date: formatDate(puzzle.lastPlayed, i18n.language),
            })
          : t("puzzle.admin.never_played")}
      </div>

      {verify.data && <VerifyResult result={verify.data} />}
      {verify.isPending && (
        <p className="sb-muted">{t("puzzle.admin.verify_hint")}</p>
      )}
      {verify.isError && (
        <p className="manager-error" role="alert">
          {apiErrorStatus(verify.error) === HTTP_CONFLICT
            ? t("puzzle.admin.verify_busy")
            : apiErrorMessage(verify.error)}
        </p>
      )}
      {error != null && (
        <p className="manager-error" role="alert">
          {apiErrorMessage(error)}
        </p>
      )}

      {editing ? (
        <>
          <p className="pz-warning">
            <IconAlert size={14} /> {t("puzzle.admin.edit_warning")}
          </p>
          <PuzzleForm
            initial={{
              title: puzzle.title,
              description: puzzle.description ?? "",
              objective: puzzle.objective,
              rewardGold: puzzle.rewardGold,
              rewardXp: puzzle.rewardXp,
            }}
            targets={puzzle.enemyMonsters}
            pending={update.isPending}
            error={update.isError ? apiErrorMessage(update.error) : null}
            submitLabel={t("puzzle.admin.save")}
            onSubmit={(body) => update.mutate(body)}
            onCancel={() => setEditing(false)}
          />
        </>
      ) : (
        <div className="pz-row__actions">
          <Button size="sm" disabled={busy} onClick={() => verify.mutate()}>
            {verify.isPending
              ? t("puzzle.admin.verifying")
              : t("puzzle.admin.verify")}
          </Button>
          {published ? (
            <Button
              size="sm"
              variant="danger"
              disabled={busy}
              onClick={() => unpublish.mutate()}
            >
              {t("puzzle.admin.unpublish")}
            </Button>
          ) : (
            <>
              {!verified && (
                <label className="pz-override">
                  <input
                    type="checkbox"
                    checked={override}
                    onChange={(e) => setOverride(e.target.checked)}
                  />
                  {t("puzzle.admin.manual_override")}
                </label>
              )}
              <Button
                size="sm"
                disabled={busy || (!verified && !override)}
                onClick={() => publish.mutate()}
              >
                {t("puzzle.admin.publish")}
              </Button>
            </>
          )}
          <Link
            className="btn btn--ghost-bordeaux btn--sm"
            to={`${PUZZLE_PLAY_PATH}?test=${puzzle.id}`}
          >
            {t("puzzle.admin.test")}
          </Link>
          <Button
            size="sm"
            variant="ghost-bordeaux"
            disabled={busy}
            onClick={() => toScenario.mutate()}
          >
            {t("puzzle.admin.open_sandbox")}
          </Button>
          <Button
            size="sm"
            variant="ghost-bordeaux"
            disabled={busy}
            onClick={() => setEditing(true)}
          >
            {t("puzzle.admin.edit")}
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={busy}
            onClick={() => {
              if (
                window.confirm(
                  t("puzzle.admin.delete_confirm", { title: puzzle.title }),
                )
              )
                remove.mutate();
            }}
          >
            {t("puzzle.admin.delete")}
          </Button>
        </div>
      )}
    </li>
  );
}

/** Onglet admin : défis (liste, vérification, publication) et calendrier. */
export default function PuzzleManager() {
  const { t } = useTranslation();
  const puzzles = useQuery({
    queryKey: QUERY_KEYS.admin.puzzles,
    queryFn: () => puzzleService.adminList(),
  });

  return (
    <div className="manager">
      {puzzles.isLoading && <Loading message={t("puzzle.admin.loading")} />}
      {puzzles.isError && (
        <p className="manager-error" role="alert">
          {apiErrorMessage(puzzles.error)}
        </p>
      )}
      {puzzles.data?.length === 0 && (
        <p className="manager-empty">{t("puzzle.admin.empty")}</p>
      )}
      <ul className="manager-list">
        {puzzles.data?.map((p) => <PuzzleRow key={p.id} puzzle={p} />)}
      </ul>
      <PuzzleCalendar puzzles={puzzles.data ?? []} />
    </div>
  );
}
