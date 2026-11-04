import { useTranslation } from "react-i18next";
import { IconDust } from "../../components/Icons";
import "../forge/Forge.css";

/** Solde de poussière du joueur. */
export default function DustBalance({ dust }: { dust: number }) {
  const { t } = useTranslation();
  return (
    <span className="forge-dust" title={t("forge.dust")}>
      <IconDust size={16} color="currentColor" />
      {dust.toLocaleString()}
    </span>
  );
}
