import { useTranslation } from "react-i18next";
import "./PrivacyButton.css";

interface PrivacyButtonProps {
  isPrivate: boolean;
  onToggle: () => void;
}

function IconLock({ color = "currentColor" }: { color?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="3"
        y="11"
        width="18"
        height="11"
        rx="2"
        stroke={color}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M7 11V7a5 5 0 0 1 10 0v4"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="12" cy="16" r="1.5" fill={color} />
    </svg>
  );
}

function IconGlobe({ color = "currentColor" }: { color?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="2" />
      <path
        d="M12 3c-2.5 3-4 5.5-4 9s1.5 6 4 9M12 3c2.5 3 4 5.5 4 9s-1.5 6-4 9M3 12h18"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function PrivacyButton({
  isPrivate,
  onToggle,
}: PrivacyButtonProps) {
  const { t } = useTranslation();
  return (
    <button
      className={`privacy-btn${isPrivate ? " privacy-btn--private" : ""}`}
      onClick={onToggle}
      aria-label={
        isPrivate ? t("privacy.make_public") : t("privacy.make_private")
      }
    >
      {isPrivate ? (
        <>
          <IconLock color="#7a1c3b" /> {t("privacy.private")}
        </>
      ) : (
        <>
          <IconGlobe color="#7a1c3b" /> {t("privacy.public")}
        </>
      )}
    </button>
  );
}
