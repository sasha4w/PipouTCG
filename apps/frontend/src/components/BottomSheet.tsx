import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconClose } from "./Icons";
import "./BottomSheet.css";

interface Props {
  title: string;
  closeLabel: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Panneau ancré en bas du cadre de l'app (#root, qui porte les coins arrondis
 * et le zoom grand écran), fermé par le fond, la croix ou Échap.
 */
export default function BottomSheet({ title, closeLabel, onClose, children }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="bsheet" onClick={onClose}>
      <div
        className="bsheet__panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bsheet__head">
          <h3 className="bsheet__title">{title}</h3>
          <button type="button" className="bsheet__close" onClick={onClose} aria-label={closeLabel}>
            <IconClose size={18} color="currentColor" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.getElementById("root") ?? document.body,
  );
}
