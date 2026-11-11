import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { IconArrowRight, IconScroll } from "../../components/Icons";
import { soundService } from "../../services/sound.service";
import { useTutorialOverview } from "./useTutorialOverview";
import { lessonPath } from "./tutorialView";
import "./Tutorial.css";

/**
 * Raccourci vers la prochaine leçon, posé sur l'accueil et l'arène.
 * Disparaît une fois toutes les leçons terminées : elles restent dans
 * l'onglet Règles.
 */
export default function TutorialEntry() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data } = useTutorialOverview();

  const next = data?.lessons.find((lesson) => !lesson.completed);
  if (!data || !next) return null;
  const done = data.lessons.filter((lesson) => lesson.completed).length;

  return (
    <button
      type="button"
      className="tut-entry"
      onClick={() => {
        soundService.play("select");
        navigate(lessonPath(next.id));
      }}
    >
      <span className="tut-entry__icon">
        <IconScroll size={22} />
      </span>
      <span className="tut-entry__text">
        <span className="tut-entry__title">{t("tutorial.ui.title")}</span>
        <span className="tut-entry__sub">
          {t("tutorial.ui.entryProgress", {
            done,
            total: data.lessons.length,
            lesson: t(`tutorial.ui.lesson.${next.id}.title`),
          })}
        </span>
      </span>
      <IconArrowRight size={16} />
    </button>
  );
}
