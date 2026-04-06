import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { userService } from "../services/user.service"; // Utilise ton service si possible
import { QUERY_KEYS } from "../utils/querykeys"; // Utilise tes constantes de clés

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { data, isLoading, isError } = useQuery({
    // 1. Utilise la MÊME clé que dans le Header pour partager le cache
    queryKey: QUERY_KEYS.profile,
    queryFn: () => userService.getMe(),
    retry: false, // Ne pas insister si on reçoit une 401
    // 2. On garde les données "fraîches" pour éviter les clignotements entre les pages
    staleTime: 10 * 60 * 1000,
  });

  // 3. C'est ici qu'on bloque l'écran blanc
  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
          backgroundColor: "#f8f9fa", // Ou ta couleur de fond
        }}
      >
        {/* Tu peux mettre un Spinner ici à la place du texte */}
        <p style={{ fontFamily: "sans-serif", color: "#666" }}>
          Chargement de PipouTCG...
        </p>
      </div>
    );
  }

  // 4. Si erreur (401) ou pas de données, on redirige
  if (isError || !data) {
    return <Navigate to="/login" replace />;
  }

  // 5. Si tout est OK, on affiche les pages protégées
  return <>{children}</>;
};

export default ProtectedRoute;
