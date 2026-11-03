import type { SupportType } from "@pipou/shared";
import type { CreateCardData } from "../../../../services/card.service";

export const SUPPORT_LABELS: Record<SupportType, string> = {
  EPHEMERAL: "Éphémère",
  EQUIPMENT: "Équipement",
  PERSISTENT: "Persistant",
  CHARGE: "Charge",
};

export interface StepProps {
  form: CreateCardData;
  patch: (p: Partial<CreateCardData>) => void;
}
