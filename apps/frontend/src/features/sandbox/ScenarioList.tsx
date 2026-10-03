import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import Button from "../../components/Button";
import Loading from "../../components/Loading";
import { sandboxService } from "../../services/sandbox.service";
import { QUERY_KEYS } from "../../utils/querykeys";
import { apiErrorMessage } from "../../utils/errors";
import "./Sandbox.css";

/** Onglet admin : scénarios partagés et accès au sandbox. */
export default function ScenarioList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const scenarios = useQuery({
    queryKey: QUERY_KEYS.sandbox.scenarios,
    queryFn: () => sandboxService.listScenarios(),
  });
  const remove = useMutation({
    mutationFn: (id: number) => sandboxService.deleteScenario(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.sandbox.scenarios }),
  });

  return (
    <div className="sb-scenarios">
      <div className="sb-scenarios__head">
        <p>
          Joue les deux joueurs avec des decks libres, pour tester les combos.
          Rien n'est enregistré (ni match, ni ELO), sauf les scénarios.
        </p>
        <Button onClick={() => navigate("/admin/sandbox")}>
          🧪 Nouveau sandbox
        </Button>
      </div>

      {scenarios.isLoading && <Loading message="Chargement des scénarios…" />}
      {scenarios.isError && (
        <p className="sb-error">{apiErrorMessage(scenarios.error)}</p>
      )}
      {remove.isError && (
        <p className="sb-error">{apiErrorMessage(remove.error)}</p>
      )}
      {scenarios.data?.length === 0 && <p>Aucun scénario sauvegardé.</p>}

      <ul className="sb-scenarios__list">
        {scenarios.data?.map((s) => (
          <li key={s.id} className="sb-scenarios__item">
            <div>
              <strong>{s.name}</strong>
              {s.description && <p>{s.description}</p>}
              <small>
                {s.createdBy} · {new Date(s.updatedAt).toLocaleString("fr-FR")}
              </small>
            </div>
            <div className="sb-scenarios__actions">
              <Button
                size="sm"
                onClick={() => navigate(`/admin/sandbox?scenario=${s.id}`)}
              >
                Charger
              </Button>
              <Button
                size="sm"
                variant="danger"
                disabled={remove.isPending}
                onClick={() => {
                  if (window.confirm(`Supprimer « ${s.name} » ?`))
                    remove.mutate(s.id);
                }}
              >
                Supprimer
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
