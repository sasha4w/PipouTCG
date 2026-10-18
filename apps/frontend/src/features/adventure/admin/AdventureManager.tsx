import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import type { AdminAdventureWorld } from "@pipou/shared";
import { adventureService } from "../../../services/adventure.service";
import { cardService } from "../../../services/card.service";
import { cardSetService } from "../../../services/card-set.service";
import { boosterService } from "../../../services/booster.service";
import { QUERY_KEYS } from "../../../utils/querykeys";
import { apiErrorMessage } from "../../../utils/errors";
import Button from "../../../components/Button";
import { IconArrowLeft, IconPencil } from "../../../components/Icons";
import WorldForm from "./WorldForm";
import OpponentForm from "./OpponentForm";
import OpponentDeckEditor from "./OpponentDeckEditor";
import { useAdminAdventureMutation } from "./useAdminAdventureMutation";
import "../../../components/manager.css";
import "./AdventureManager.css";

const DAILY_CAP_MAX = 1000;

type Selection =
  | { view: "list" }
  | { view: "world"; worldId: number | null }
  | { view: "opponent"; worldId: number; opponentId: number }
  | { view: "deck"; worldId: number; opponentId: number };

export default function AdventureManager() {
  const { t } = useTranslation();
  const [selection, setSelection] = useState<Selection>({ view: "list" });
  const [capDraft, setCapDraft] = useState<string | null>(null);

  const overviewQuery = useQuery({
    queryKey: QUERY_KEYS.adminAdventure,
    queryFn: () => adventureService.adminOverview(),
  });
  const cardSetsQuery = useQuery({
    queryKey: QUERY_KEYS.cardSetOptions,
    queryFn: () => cardSetService.findAll(1, 100),
  });
  const boostersQuery = useQuery({
    queryKey: QUERY_KEYS.boosterOptions,
    queryFn: () => boosterService.findAll(1, 100),
  });

  const worlds = overviewQuery.data?.worlds ?? [];
  const selectedWorld =
    selection.view === "opponent" || selection.view === "deck"
      ? worlds.find((w) => w.id === selection.worldId)
      : undefined;
  const selectedOpponent =
    selectedWorld && (selection.view === "opponent" || selection.view === "deck")
      ? selectedWorld.opponents.find((o) => o.id === selection.opponentId)
      : undefined;

  const setCardsQuery = useQuery({
    queryKey: QUERY_KEYS.setCardOptions(selectedWorld?.cardSetId ?? 0),
    queryFn: () => cardService.findBySet(selectedWorld?.cardSetId ?? 0, 1, 500),
    enabled: selectedWorld !== undefined,
  });
  const setCards = setCardsQuery.data?.data ?? [];

  const saveCap = useAdminAdventureMutation(
    (dailyCap: number) => adventureService.updateSettings({ dailyCap }),
    () => setCapDraft(null),
  );

  const backToList = () => setSelection({ view: "list" });

  // ── Plafond journalier ──────────────────────────────────────────────────────
  const capText = capDraft ?? String(overviewQuery.data?.dailyCap ?? 0);
  const capValue = Number(capText);
  const capValid =
    capText.trim() !== "" &&
    Number.isInteger(capValue) &&
    capValue >= 0 &&
    capValue <= DAILY_CAP_MAX;

  // ── Vues ────────────────────────────────────────────────────────────────────
  if (overviewQuery.isPending) {
    return (
      <div className="manager">
        <p className="manager-empty">{t("adventure_admin.loading")}</p>
      </div>
    );
  }
  if (overviewQuery.isError) {
    return (
      <div className="manager">
        <p className="manager-error">{t("adventure_admin.load_error")}</p>
      </div>
    );
  }

  if (selection.view !== "list") {
    let title = t("adventure_admin.title");
    let body = <p className="manager-empty">{t("adventure_admin.loading")}</p>;

    if (selection.view === "world") {
      const world = worlds.find((w) => w.id === selection.worldId) ?? null;
      title = world ? world.name : t("adventure_admin.new_world");
      body = (
        <WorldForm
          key={world?.id ?? "new"}
          world={world}
          worlds={worlds}
          cardSets={cardSetsQuery.data?.data ?? []}
          boosters={boostersQuery.data?.data ?? []}
          onDone={backToList}
        />
      );
    } else if (selectedWorld && selectedOpponent && setCardsQuery.isSuccess) {
      title = selectedOpponent.name;
      body =
        selection.view === "opponent" ? (
          <OpponentForm
            key={selectedOpponent.id}
            opponent={selectedOpponent}
            cards={setCards}
            onDone={backToList}
          />
        ) : (
          <OpponentDeckEditor
            key={selectedOpponent.id}
            opponent={selectedOpponent}
            cards={setCards}
            onDone={backToList}
          />
        );
    } else if (setCardsQuery.isError) {
      body = <p className="manager-error">{t("adventure_admin.load_error")}</p>;
    }

    return (
      <div className="manager">
        <div className="manager__header">
          <Button variant="ghost-bordeaux" onClick={backToList}>
            <IconArrowLeft size={16} />
            {t("adventure_admin.back")}
          </Button>
          <h2 className="manager__title">{title}</h2>
        </div>
        {body}
      </div>
    );
  }

  return (
    <div className="manager">
      <div className="manager__header">
        <h2 className="manager__title">{t("adventure_admin.title")}</h2>
        <Button
          size="sm"
          onClick={() => setSelection({ view: "world", worldId: null })}
        >
          + {t("adventure_admin.new_world")}
        </Button>
      </div>

      <div className="manager-form">
        <p className="manager-form__title">{t("adventure_admin.cap.title")}</p>
        {saveCap.error && (
          <p className="manager-error" role="alert">
            {apiErrorMessage(saveCap.error) ?? t("adventure_admin.error_generic")}
          </p>
        )}
        <div className="adv-admin__cap">
          <div className="manager-form__row">
            <label className="manager-form__label" htmlFor="adv-cap">
              {t("adventure_admin.cap.label")}
            </label>
            <input
              id="adv-cap"
              className="manager-form__input"
              type="number"
              min={0}
              max={DAILY_CAP_MAX}
              value={capText}
              onChange={(e) => setCapDraft(e.target.value)}
            />
            {!capValid && (
              <span className="adv-admin__reason">
                {t("adventure_admin.cap.invalid")}
              </span>
            )}
          </div>
          <Button
            disabled={!capValid || capDraft === null || saveCap.isPending}
            onClick={() => saveCap.mutate(capValue)}
          >
            {t("adventure_admin.save")}
          </Button>
        </div>
      </div>

      {worlds.length === 0 ? (
        <p className="manager-empty">{t("adventure_admin.empty")}</p>
      ) : (
        <div className="manager-list">
          {worlds.map((world) => (
            <div key={world.id} className="manager-item adv-admin__world">
              {renderWorld(world)}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  function renderWorld(world: AdminAdventureWorld) {
    return (
      <>
        <div className="manager-item__info">
          <div className="manager-item__name">
            {world.name}
            <span
              className={`manager-item__badge manager-item__badge--${world.isActive ? "active" : "inactive"}`}
            >
              {world.isActive
                ? t("adventure_admin.status_active")
                : t("adventure_admin.status_inactive")}
            </span>
          </div>
          <div className="manager-item__meta">
            {t("adventure_admin.world_meta", {
              set: world.cardSetName,
              order: world.order,
            })}
          </div>
          {world.inactiveReason && (
            <div className="adv-admin__reason">
              {t("adventure_admin.inactive_reason", { reason: world.inactiveReason })}
            </div>
          )}
          <div className="adv-admin__opponents">
            {world.opponents.map((opponent) => (
              <div key={opponent.id} className="manager-item">
                <div className="manager-item__info">
                  <div className="manager-item__name">
                    {opponent.position}. {opponent.name}
                  </div>
                  <div className="manager-item__meta">
                    {t("adventure_admin.deck_count", { count: opponent.deckSize })}
                  </div>
                  {opponent.deckError && (
                    <div className="adv-admin__reason">
                      {t("adventure_admin.deck_error", { reason: opponent.deckError })}
                    </div>
                  )}
                </div>
                <div className="manager-item__actions">
                  <Button
                    variant="ghost-bordeaux"
                    size="sm"
                    onClick={() =>
                      setSelection({
                        view: "opponent",
                        worldId: world.id,
                        opponentId: opponent.id,
                      })
                    }
                  >
                    {t("adventure_admin.edit_opponent")}
                  </Button>
                  <Button
                    variant="ghost-bordeaux"
                    size="sm"
                    onClick={() =>
                      setSelection({
                        view: "deck",
                        worldId: world.id,
                        opponentId: opponent.id,
                      })
                    }
                  >
                    {t("adventure_admin.edit_deck")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="manager-item__actions">
          <Button
            variant="ghost-bordeaux"
            size="icon"
            aria-label={t("adventure_admin.edit_world")}
            title={t("adventure_admin.edit_world")}
            onClick={() => setSelection({ view: "world", worldId: world.id })}
          >
            <IconPencil size={16} />
          </Button>
        </div>
      </>
    );
  }
}
