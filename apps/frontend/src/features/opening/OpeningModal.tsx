import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { OPEN_BOOSTER_QUANTITIES, type OpenBoosterQuantity } from "@pipou/shared";
import { QUERY_KEYS } from "../../utils/querykeys";
import { apiErrorMessage } from "../../utils/errors";
import {
  openingService,
  type OpeningResult,
} from "../../services/opening.service";
import Button from "../../components/Button";
import { IconClose } from "../../components/Icons";
import { soundService } from "../../services/sound.service";
import { BundleContents } from "./BundleContents";
import { CardReveal } from "./CardReveal";
import { PackTear } from "./PackTear";
import { OpeningSummary } from "./OpeningSummary";
import { bestRarity, buildReveal } from "./openingPlan";
import "./OpeningModal.css";

type Phase = "tear" | "wait" | "reveal" | "bundle-reveal" | "results";

export interface OpeningTarget {
  type: "booster" | "bundle";
  id: number;
  name: string;
  /** Quantité à ouvrir d'emblée (booster uniquement). */
  quantity?: OpenBoosterQuantity;
  /** Exemplaires possédés : conditionne l'offre ×5 et ×10. */
  available?: number;
}

interface OpeningModalProps {
  target: OpeningTarget;
  onClose: () => void;
  onDone?: () => void;
}

export default function OpeningModal({
  target,
  onClose,
  onDone,
}: OpeningModalProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>("tear");
  const [result, setResult] = useState<OpeningResult | null>(null);
  const [quantity, setQuantity] = useState<OpenBoosterQuantity>(
    target.quantity ?? 1,
  );
  const [error, setError] = useState("");
  // Change à chaque tentative : remonte PackTear et CardReveal à neuf
  const [attempt, setAttempt] = useState(0);
  const startedRef = useRef(false);

  const isBundle = target.type === "bundle";
  const cards = useMemo(() => result?.cards ?? [], [result]);
  const boosters = result?.boosters ?? [];
  const steps = useMemo(
    () => (cards.length > 0 ? buildReveal(cards, quantity >= 5) : []),
    [cards, quantity],
  );
  const available = target.available ?? 0;
  const quantities = OPEN_BOOSTER_QUANTITIES.filter(
    (q) => q === 1 || q <= available,
  );
  const showQuantity = !isBundle && phase === "tear" && available >= 5;

  const refreshServerState = () => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.quests });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.inventory });
  };

  const handleTorn = async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    setError("");
    setPhase("wait");
    try {
      const res = isBundle
        ? await openingService.openBundle(target.id)
        : await openingService.openBooster(
            target.id,
            quantity === 1 ? undefined : quantity,
          );
      setResult(res);
      refreshServerState();
    } catch (err) {
      // Timeout/réseau : le serveur a pu committer, on évite un stock périmé au retry
      refreshServerState();
      setError(apiErrorMessage(err) ?? t("opening.error"));
      startedRef.current = false;
      setAttempt((a) => a + 1);
      setPhase("tear");
    }
  };

  const handleWaitDone = () => {
    if (isBundle) setPhase("bundle-reveal");
    else setPhase(cards.length > 0 ? "reveal" : "results");
  };

  const handleClose = () => {
    soundService.play("cancel");
    if (result) onDone?.();
    onClose();
  };

  // En révélation, la croix est portée par CardReveal, collée à la carte
  const showClose = phase !== "wait" && phase !== "reveal";

  return (
    <div
      className="opening-overlay"
      onClick={(e) => {
        if (e.target !== e.currentTarget) return;
        if (phase === "tear" || phase === "results") handleClose();
      }}
    >
      <div className="opening-modal">
        {showClose && (
          <Button
            variant="ghost-gold"
            size="icon"
            aria-label={t("opening.closeModal")}
            className="opening-modal__close"
            onClick={handleClose}
          >
            <IconClose size={16} />
          </Button>
        )}

        {(phase === "tear" || phase === "wait") && (
          <div className="opening-pack">
            <PackTear
              key={attempt}
              name={target.name}
              quantity={isBundle ? 1 : quantity}
              bestRarity={result ? bestRarity(result.cards) : null}
              onTorn={handleTorn}
              onWaitDone={handleWaitDone}
            />
            {showQuantity && (
              <div
                className="opening-qty"
                role="group"
                aria-label={t("opening.quantity")}
              >
                {quantities.map((q) => (
                  <Button
                    key={q}
                    size="sm"
                    variant={q === quantity ? "primary-inverse" : "ghost-gold"}
                    aria-pressed={q === quantity}
                    onClick={() => setQuantity(q)}
                  >
                    ×{q}
                  </Button>
                ))}
              </div>
            )}
            {error && <p className="opening-modal__error">{error}</p>}
          </div>
        )}

        {phase === "reveal" && steps.length > 0 && (
          <CardReveal
            key={attempt}
            steps={steps}
            onDone={() => setPhase("results")}
            onSkip={() => setPhase("results")}
            onClose={handleClose}
          />
        )}

        {phase === "bundle-reveal" && (
          <BundleContents
            cards={cards}
            boosters={boosters}
            onContinue={() => setPhase("results")}
          />
        )}

        {phase === "results" && (
          <OpeningSummary cards={cards} boosters={boosters} onClose={handleClose} />
        )}
      </div>
    </div>
  );
}
