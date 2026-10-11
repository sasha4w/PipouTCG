import { useState, type ReactNode } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { userService } from "../services/user.service";
import { QUERY_KEYS } from "../utils/querykeys";
import Loading from "../components/Loading";
import Button from "../components/Button";
import CardSetManager from "../features/cards/CardSetManager";
import CardManager from "../features/cards/CardManager";
import BoosterManager from "../features/boosters/BoosterManager";
import BundleManager from "../features/bundles/BundleManager";
import QuestManager from "../features/quests/QuestManager";
import BannerManager from "../features/shop/BannerManager";
import ScenarioList from "../features/sandbox/ScenarioList";
import PatchnoteManager from "../features/inbox/PatchnoteManager";
import {
  IconUndo,
  IconBell,
  IconBooster,
  IconBundle,
  IconCards,
  IconCollection,
  IconFlask,
  IconQuest,
  IconTag,
} from "../components/Icons";
import "./Admin.css";

type AdminTab =
  | "cardsets"
  | "cards"
  | "boosters"
  | "bundles"
  | "quests"
  | "banners"
  | "patchnotes"
  | "sandbox";

const TABS: { key: AdminTab; icon: ReactNode }[] = [
  { key: "cardsets", icon: <IconCollection size={22} /> },
  { key: "cards", icon: <IconCards size={22} /> },
  { key: "boosters", icon: <IconBooster size={22} /> },
  { key: "bundles", icon: <IconBundle size={22} /> },
  { key: "quests", icon: <IconQuest size={22} /> },
  { key: "banners", icon: <IconTag size={22} /> },
  { key: "patchnotes", icon: <IconBell size={22} /> },
  { key: "sandbox", icon: <IconFlask size={22} /> },
];

export default function Admin() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tab, setTab] = useState<AdminTab>("cardsets");

  const { data: user, isLoading } = useQuery({
    queryKey: QUERY_KEYS.profile,
    queryFn: () => userService.getMe(),
  });

  if (isLoading) return <Loading message={t("admin.checking")} />;
  if (!user || !user.is_admin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="admin-page">
      <div className="admin-page__head">
        <Button
          variant="ghost-bordeaux"
          size="icon"
          aria-label={t("admin.back")}
          onClick={() => navigate("/")}
        >
          <IconUndo />
        </Button>
        <h1 className="admin-page__title">{t("admin.title")}</h1>
      </div>
      <div className="admin-tabs">
        {TABS.map((item) => (
          <Button
            key={item.key}
            variant="ghost-bordeaux"
            active={tab === item.key}
            className="admin-tab-btn"
            onClick={() => setTab(item.key)}
          >
            <span className="admin-tab-btn__icon">{item.icon}</span>
            {t(`admin.tabs.${item.key}`)}
          </Button>
        ))}
      </div>
      {tab === "cardsets" && <CardSetManager />}
      {tab === "cards" && <CardManager />}
      {tab === "boosters" && <BoosterManager />}
      {tab === "bundles" && <BundleManager />}
      {tab === "quests" && <QuestManager />}
      {tab === "banners" && <BannerManager />}
      {tab === "patchnotes" && <PatchnoteManager />}
      {tab === "sandbox" && <ScenarioList />}
    </div>
  );
}
