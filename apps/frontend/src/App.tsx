import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";
import { lazy, Suspense, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import ProtectedRoute from "./components/ProtectedRoute";
import Header from "./components/Header";
import Footer from "./components/Footer";
import ErrorBoundary from "./components/ErrorBoundary";
import Loading from "./components/Loading";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Home from "./pages/Home";
import Marketplace from "./pages/Marketplace";
import Profile from "./pages/Profile";
import Collection from "./pages/Collection";
import Settings from "./pages/Settings";
import { SoundProvider } from "./contexts/SoundContext";
import { AnimationProvider } from "./contexts/AnimationContext";
import { useScrollRestoration } from "./hooks/useScrollRestoration";
import { AnimatePresence } from "framer-motion";
import { useDailyRewardModal } from "./hooks/Usedailyrewardmodal";
import DailyRewardModal from "./components/DailyRewardModal";
import { useToast } from "./hooks/useToast";
import { ToastContainer } from "./components/ToastContainer";
import { DailyRewardContext } from "./contexts/DailyRewardContext";
import { useSseNotifications } from "./hooks/useSseNotifications";
import { useNotificationEvents } from "./hooks/useNotifications";
import { QUERY_KEYS } from "./utils/querykeys";
import FightHub from "./pages/FightHub";
import DeckBuilder from "./features/deck/DeckBuilder";
import FightPage from "./features/fight/FightPage";
import AdventureWorlds from "./features/adventure/AdventureWorlds";
import AdventurePath from "./features/adventure/AdventurePath";
import AdventureFightRoute from "./features/adventure/AdventureFight";
import { useQuery } from "@tanstack/react-query";
import { userService } from "./services/user.service";
import { useStarterDeckModal } from "./hooks/useStarterDeckModal";
import StarterDeckModal from "./features/starter/StarterDeckModal";
import { StarterDeckContext } from "./contexts/StarterDeckContext";
// Écrans d'administration : hors du lot chargé par tous les joueurs.
const Admin = lazy(() => import("./pages/Admin"));
const AdminSandbox = lazy(() => import("./pages/AdminSandbox"));

function AppLayout() {
  const mainRef = useRef<HTMLElement>(null);
  useScrollRestoration(mainRef);
  const { data: me } = useQuery({
    queryKey: QUERY_KEYS.profile,
    queryFn: () => userService.getMe(),
    staleTime: 10 * 60 * 1000,
  });
  const starter = useStarterDeckModal(me?.id);
  const { isOpen, open, close } = useDailyRewardModal(true, starter.isBlocking);
  const { toasts, addToast, removeToast } = useToast();
  const queryClient = useQueryClient();

  // ── SSE global : actif sur toutes les pages ──
  useSseNotifications(() => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.myStats });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.inventory });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.myListings });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.salesAll });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.quests });
  });
  useNotificationEvents();

  return (
    <DailyRewardContext.Provider value={{ openModal: open }}>
      <StarterDeckContext.Provider
        value={{
          available: starter.status?.available === true,
          openModal: starter.open,
        }}
      >
        <div className="app-layout">
          <Header />
          <main className="app-main" ref={mainRef}>
            <Outlet />
          </main>
          <Footer />
          <ToastContainer toasts={toasts} onRemove={removeToast} />
          <AnimatePresence>
            {starter.isOpen && starter.status && (
              <StarterDeckModal
                status={starter.status}
                onClose={starter.close}
                addToast={addToast}
              />
            )}
          </AnimatePresence>
          <AnimatePresence>
            {isOpen && <DailyRewardModal onClose={close} addToast={addToast} />}
          </AnimatePresence>
        </div>
      </StarterDeckContext.Provider>
    </DailyRewardContext.Provider>
  );
}
function FightPageWrapper() {
  const { data } = useQuery({
    queryKey: QUERY_KEYS.profile,
    queryFn: () => userService.getMe(),
    staleTime: 10 * 60 * 1000,
  });

  if (!data) return null;

  return <FightPage userId={data.id} username={data.username} />;
}
function App() {
  return (
    <ErrorBoundary>
      <SoundProvider>
        <AnimationProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route
                element={
                  <ProtectedRoute>
                    <AppLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="/" element={<Home />} />
                <Route path="/marketplace" element={<Marketplace />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/collection" element={<Collection />} />
                <Route path="/settings" element={<Settings />} />
                <Route
                  path="/admin"
                  element={
                    <Suspense fallback={<Loading />}>
                      <Admin />
                    </Suspense>
                  }
                />
                <Route path="/arena" element={<FightHub />} />
                <Route path="/decks" element={<DeckBuilder />} />
                <Route path="/fight" element={<FightPageWrapper />} />
                <Route path="/adventure" element={<AdventureWorlds />} />
                <Route path="/adventure/:worldId" element={<AdventurePath />} />
                <Route
                  path="/adventure/fight/:opponentId"
                  element={<AdventureFightRoute />}
                />
              </Route>
              <Route
                path="/admin/sandbox"
                element={
                  <ProtectedRoute>
                    <Suspense fallback={<Loading />}>
                      <AdminSandbox />
                    </Suspense>
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </AnimationProvider>
      </SoundProvider>
    </ErrorBoundary>
  );
}

export default App;
