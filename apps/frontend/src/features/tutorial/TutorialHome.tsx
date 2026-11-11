import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import Button from "../../components/Button";
import Loading from "../../components/Loading";
import { IconCheck, IconGold, IconStar } from "../../components/Icons";
import { useTutorialOverview } from "./useTutorialOverview";
import { lessonPath } from "./tutorialView";
import "./Tutorial.css";

/** Liste des leçons : coche, récompense, bouton de départ. */
export default function TutorialHome() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isError, isLoading } = useTutorialOverview();

  if (isLoading) return <Loading message={t("tutorial.ui.starting")} />;
  if (isError || !data)
    return <p className="tut-error">{t("tutorial.ui.loadError")}</p>;

  return (
    <div className="tut-home">
      <h2 className="tut-home__title">{t("tutorial.ui.title")}</h2>
      <p className="tut-home__intro">{t("tutorial.ui.intro")}</p>
      <p className="tut-home__reward">
        <IconGold size={16} /> <IconStar size={16} />{" "}
        {t("tutorial.ui.reward", {
          gold: data.reward.gold,
          xp: data.reward.xp,
        })}
      </p>
      <ol className="tut-lessons">
        {data.lessons.map((lesson, i) => (
          <li
            key={lesson.id}
            className={`tut-lesson${lesson.completed ? " tut-lesson--done" : ""}`}
          >
            <span className="tut-lesson__num">
              {lesson.completed ? <IconCheck size={16} /> : i + 1}
            </span>
            <div className="tut-lesson__body">
              <div className="tut-lesson__name">
                {t(`tutorial.ui.lesson.${lesson.id}.title`)}
              </div>
              <div className="tut-lesson__desc">
                {t(`tutorial.ui.lesson.${lesson.id}.desc`)}
              </div>
            </div>
            {lesson.completed ? (
              <Button
                variant="ghost-bordeaux"
                onClick={() => navigate(lessonPath(lesson.id))}
              >
                {t("tutorial.ui.replay")}
              </Button>
            ) : (
              <Button onClick={() => navigate(lessonPath(lesson.id))}>
                {t("tutorial.ui.start")}
              </Button>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
