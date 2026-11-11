import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import fr from "./locales/fr.json";
import en from "./locales/en.json";
import ko from "./locales/ko.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      fr: { translation: fr },
      en: { translation: en },
      ko: { translation: ko },
    },
    fallbackLng: "fr",
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
    interpolation: { escapeValue: false },
  });

// Lecteurs d’écran et césure suivent la langue affichée.
const syncHtmlLang = (lng: string) => {
  document.documentElement.lang = lng.split("-")[0];
};
syncHtmlLang(i18n.language ?? "fr");
i18n.on("languageChanged", syncHtmlLang);

export default i18n;
