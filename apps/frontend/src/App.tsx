import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";
import { useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import ProtectedRoute from "./components/ProtectedRoute";
import Header from "./components/Header";
import Footer from "./components/Footer";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Home from "./pages/Home";
import Marketplace from "./pages/Marketplace";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import { SoundProvider } from "./contexts/SoundContext";
import Admin from "./pages/Admin";
import { useScrollRestoration } from "./hooks/useScrollRestoration";
import { AnimatePresence } from "framer-motion";
import { useDailyRewardModal } from "./hooks/Usedailyrewardmodal";
import DailyRewardModal from "./components/DailyRewardModal";
import { useToast, ToastContainer } from "./hooks/useToast";
import { DailyRewardContext } from "./contexts/DailyRewardContext";
import { useSseNotifications } from "./hooks/useSseNotifications";
import { QUERY_KEYS } from "./utils/querykeys";
import FightHub from "./pages/FightHub";
import DeckBuilder from "./features/deck/DeckBuilder";
import FightPage from "./features/fight/FightPage";
import { useQuery } from "@tanstack/react-query";
import { userService } from "./services/user.service";
function AppLayout() {
  const mainRef = useRef<HTMLElement>(null);
  useScrollRestoration(mainRef);
  const { isOpen, open, close } = useDailyRewardModal(true);
  const { toasts, addToast, removeToast } = useToast();
  const queryClient = useQueryClient();

  // ── SSE global : actif sur toutes les pages ──
  useSseNotifications(() => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.myStats });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.inventory });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.myListings });
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.quests });
  });

  return (
    <DailyRewardContext.Provider value={{ openModal: open }}>
      <div className="app-layout">
        <Header />
        <main className="app-main" ref={mainRef}>
          <Outlet />
        </main>
        <Footer />
        <ToastContainer toasts={toasts} onRemove={removeToast} />
        <AnimatePresence>
          {isOpen && <DailyRewardModal onClose={close} addToast={addToast} />}
        </AnimatePresence>
      </div>
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
    <SoundProvider>
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
            <Route path="/settings" element={<Settings />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/arena" element={<FightHub />} />
            <Route path="/decks" element={<DeckBuilder />} />
            <Route path="/fight" element={<FightPageWrapper />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SoundProvider>
  );
}

export default App;
