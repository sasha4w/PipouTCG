import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  SANDBOX_NAMESPACE,
  type GameAction,
  type SandboxClientEvents,
  type SandboxServerEvents,
  type SandboxSetupCommand,
  type SandboxState,
  type Seat,
} from "@pipou/shared";
import Loading from "../../components/Loading";
import Button from "../../components/Button";
import { apiErrorMessage } from "../../utils/errors";
import FightBoard from "../fight/FightBoard";
import MulliganPanel from "../fight/MulliganPanel";
import CardPickModal from "../fight/CardPickModal";
import { useBoardControls } from "../fight/useBoardControls";
import { sandboxService } from "../../services/sandbox.service";
import { QUERY_KEYS } from "../../utils/querykeys";
import SandboxSetup from "./SandboxSetup";
import SandboxToolbar from "./SandboxToolbar";
import SandboxTools from "./SandboxTools";
import { autoViewSeat } from "./viewSeat";
import "../fight/FightPage.css";
import "./Sandbox.css";

export type SandboxClientSocket = Socket<
  SandboxServerEvents,
  SandboxClientEvents
>;

function finishedLabel(state: SandboxState): string {
  const view = state.views.p1;
  if (view.endReason === "double_ko") return "🤝 Match nul";
  const winner = view.winner === view.me.userId ? "J1" : "J2";
  return `🏆 Victoire de ${winner} (${view.endReason ?? "fin"})`;
}

/** Sandbox de duel : l'admin joue les deux sièges sur un seul écran. */
export default function SandboxPage() {
  const [params] = useSearchParams();
  const scenarioId = Number(params.get("scenario")) || null;
  const queryClient = useQueryClient();

  const [state, setState] = useState<SandboxState | null>(null);
  const [loadingScenario, setLoadingScenario] = useState(scenarioId !== null);
  const [forcedSeat, setForcedSeat] = useState<Seat | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [toast, setToast] = useState<{
    msg: string;
    type: "ok" | "err";
  } | null>(null);
  const socketRef = useRef<SandboxClientSocket | null>(null);
  const scenarioLoadedRef = useRef(false);

  const catalog = useQuery({
    queryKey: QUERY_KEYS.sandbox.catalog,
    queryFn: () => sandboxService.catalog(),
    staleTime: Infinity,
  });

  const seat: Seat = forcedSeat ?? (state ? autoViewSeat(state) : "p1");

  const send = useCallback(
    (action: GameAction) =>
      socketRef.current?.emit("sandbox:action", { seat, action }),
    [seat],
  );
  const controls = useBoardControls(state?.views[seat] ?? null, send);
  const { clearSelection } = controls;

  const sendSetup = (command: SandboxSetupCommand) =>
    socketRef.current?.emit("sandbox:setup", command);

  const showToast = useCallback((msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    const socket: SandboxClientSocket = io(
      `${import.meta.env.VITE_API_URL}${SANDBOX_NAMESPACE}`,
      { withCredentials: true, transports: ["websocket"] },
    );
    socketRef.current = socket;

    // Charge le scénario demandé une seule fois, à la première connexion
    // effective (en StrictMode, le premier socket est fermé avant de se connecter).
    socket.on("connect", () => {
      if (scenarioId === null || scenarioLoadedRef.current) return;
      scenarioLoadedRef.current = true;
      socket.emit("sandbox:load", { scenarioId });
    });
    socket.on("sandbox:state", (next) => {
      setState(next);
      setLoadingScenario(false);
      clearSelection();
    });
    socket.on("sandbox:closed", () => {
      setState(null);
      setForcedSeat(null);
      setToolsOpen(false);
    });
    socket.on("sandbox:saved", () => {
      showToast("💾 Scénario sauvegardé");
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.sandbox.scenarios });
    });
    socket.on("sandbox:error", ({ message }) => {
      setLoadingScenario(false);
      showToast(message, "err");
    });

    return () => {
      socket.disconnect();
    };
  }, [scenarioId, clearSelection, showToast, queryClient]);

  const toastNode = toast && (
    <div className={`sb-toast${toast.type === "err" ? " sb-toast--err" : ""}`}>
      {toast.msg}
    </div>
  );

  if (!state) {
    if (loadingScenario || catalog.isLoading)
      return <Loading message="Préparation du sandbox…" />;
    if (catalog.isError || !catalog.data?.length)
      return (
        <div className="sb-page">
          <div className="sb-setup">
            <Link to="/admin" className="sb-back">
              ← Retour à l'admin
            </Link>
            <div className="sb-card" role="alert">
              <p className="sb-error">
                {catalog.isError
                  ? `Impossible de charger le catalogue : ${apiErrorMessage(catalog.error) ?? "serveur injoignable"}.`
                  : "Le catalogue de cartes est vide."}
              </p>
              <Button
                disabled={catalog.isFetching}
                onClick={() => catalog.refetch()}
              >
                {catalog.isFetching ? "Chargement…" : "Réessayer"}
              </Button>
            </div>
          </div>
        </div>
      );
    return (
      <div className="sb-page">
        {toastNode}
        <SandboxSetup
          back={
            <Link to="/admin" className="sb-back">
              ← Retour à l'admin
            </Link>
          }
          catalog={catalog.data}
          onStart={(payload) =>
            socketRef.current?.emit("sandbox:create", payload)
          }
        />
      </div>
    );
  }

  const view = state.views[seat];

  return (
    <div className="sb-page">
      {toastNode}
      <SandboxToolbar
        seat={seat}
        forcedSeat={forcedSeat}
        onForceSeat={setForcedSeat}
        toolsOpen={toolsOpen}
        onToggleTools={() => setToolsOpen((v) => !v)}
        canUndo={state.canUndo}
        canRedo={state.canRedo}
        onUndo={() => socketRef.current?.emit("sandbox:undo")}
        onRedo={() => socketRef.current?.emit("sandbox:redo")}
        onSave={(name, description) =>
          socketRef.current?.emit("sandbox:save", { name, description })
        }
        onClose={() => socketRef.current?.emit("sandbox:close")}
      />
      {view.phase === "finished" && (
        <div className="sb-banner">{finishedLabel(state)}</div>
      )}

      {view.phase === "mulligan" ? (
        <MulliganPanel
          hand={view.me.hand}
          decided={view.me.mulliganDone}
          opponentDecided={view.opponent.mulliganDone}
          opponentName={view.opponent.username}
          onDecide={controls.decideMulligan}
        />
      ) : (
        <FightBoard gs={view} {...controls.board} timeLeft={null} />
      )}
      {view.pendingChoice && (
        <CardPickModal
          choice={view.pendingChoice}
          onConfirm={controls.pickCards}
        />
      )}
      {toolsOpen && (
        <SandboxTools
          state={state}
          seat={seat}
          onCommand={sendSetup}
          onClose={() => setToolsOpen(false)}
        />
      )}
    </div>
  );
}
