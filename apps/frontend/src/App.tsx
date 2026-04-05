import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";
import { useRef } from "react";
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
function AppLayout() {
  const mainRef = useRef<HTMLElement>(null);
  useScrollRestoration(mainRef);
  return (
    <div className="app-layout">
      <Header />
      <main className="app-main" ref={mainRef}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <SoundProvider>
      <BrowserRouter>
        <Routes>
          {/* Pages publiques — sans Header/Footer */}
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          {/* Pages protégées — avec Header/Footer */}
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
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </SoundProvider>
  );
}

export default App;
