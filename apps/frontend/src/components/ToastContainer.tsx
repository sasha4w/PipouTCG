import type { Toast, ToastType } from "../hooks/useToast";
import Button from "./Button";
import { IconClose } from "./Icons";
import "../hooks/useToast.css";

export const ToastContainer = ({
  toasts,
  onRemove,
}: {
  toasts: Toast[];
  onRemove: (id: number) => void;
}) => {
  const icons: Record<ToastType, string> = {
    success: "✓",
    error: "✕",
    warning: "⚠",
  };

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast toast--${toast.type}`}
          onClick={() => onRemove(toast.id)}
        >
          <span className="toast__icon">{icons[toast.type]}</span>
          <span className="toast__message">{toast.message}</span>
          <Button
            variant="ghost-gold"
            size="icon"
            aria-label="Fermer"
            onClick={() => onRemove(toast.id)}
          >
            <IconClose size={16} />
          </Button>
        </div>
      ))}
    </div>
  );
};
