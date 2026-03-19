import { useNavigate } from "react-router-dom";
import { authService } from "../services/auth.service";

const Settings = () => {
  const navigate = useNavigate();

  const handleLogout = () => {
    authService.logout();
    navigate("/login");
  };

  return (
    <div>
      <h1>Settings</h1>
      <button onClick={handleLogout}>Se déconnecter</button>
    </div>
  );
};

export default Settings;
