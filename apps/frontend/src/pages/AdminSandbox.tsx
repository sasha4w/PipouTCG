import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { userService } from "../services/user.service";
import { QUERY_KEYS } from "../utils/querykeys";
import Loading from "../components/Loading";
import SandboxPage from "../features/sandbox/SandboxPage";

/** Sandbox de duel, réservé aux admins (le serveur le vérifie aussi). */
export default function AdminSandbox() {
  const { data: user, isLoading } = useQuery({
    queryKey: QUERY_KEYS.profile,
    queryFn: () => userService.getMe(),
  });

  if (isLoading) return <Loading message="Vérification des droits..." />;
  if (!user?.is_admin) return <Navigate to="/" replace />;
  return <SandboxPage />;
}
