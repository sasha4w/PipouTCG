import { useTranslation } from "react-i18next";
import Button from "../../components/Button";
import { IconGift } from "../../components/Icons";
import { useStarterDeck } from "../../contexts/StarterDeckContext";
import { soundService } from "../../services/sound.service";

/** Bouton de Home qui rouvre le choix du starter deck tant qu'il n'est pas réclamé. */
export default function StarterDeckButton() {
  const { t } = useTranslation();
  const { available, openModal } = useStarterDeck();
  if (!available) return null;
  return (
    <Button
      variant="primary"
      size="lg"
      fullWidth
      onClick={() => {
        soundService.play("select");
        openModal();
      }}
    >
      <IconGift size={18} />
      {t("starter.claim_button")}
    </Button>
  );
}
