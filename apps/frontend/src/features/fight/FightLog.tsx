import { useTranslation } from "react-i18next";
import BottomSheet from "../../components/BottomSheet";
import "./FightLog.css";

interface Props {
  log: string[];
  onClose: () => void;
}

/** Journal du combat, dans une feuille ouverte depuis le HUD. */
export default function FightLog({ log, onClose }: Props) {
  const { t } = useTranslation();
  return (
    <BottomSheet
      title={t("fight.hud.log")}
      closeLabel={t("fight.graveyard.close")}
      onClose={onClose}
    >
      <div className="flog-box">
        {[...log].reverse().map((entry, i) => (
          <div key={i} className="flog-entry" style={{ opacity: 1 - i * 0.06 }}>
            {entry}
          </div>
        ))}
      </div>
    </BottomSheet>
  );
}
