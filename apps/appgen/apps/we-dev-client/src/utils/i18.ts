import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "../locale/en.json";
import fr from "../locale/fr.json";
import {
  resolveInitialLocale,
  readLocaleCookie,
  writeLocaleCookie,
  isSupportedLocale,
} from "./localeCookie";

const resources = {
  en: {
    translation: {
      ...en,
    },
  },
  fr: {
    translation: {
      ...fr,
    },
  },
};

i18n.use(initReactI18next).init({
  resources,
  // Initial language comes from the shared cross-app cookie so the choice made in
  // any other Idem app (landing, dashboard…) is honored here.
  lng: resolveInitialLocale(),
  fallbackLng: "en",

  interpolation: {
    escapeValue: false,
  },
});

// Persist every language change to the shared cookie (source of truth across apps).
i18n.on("languageChanged", (lng) => {
  if (isSupportedLocale(lng)) {
    writeLocaleCookie(lng);
  }
});

// When returning to this tab, pick up a language another Idem app may have set.
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") {
      return;
    }
    const cookieLang = readLocaleCookie();
    if (cookieLang && cookieLang !== i18n.language) {
      i18n.changeLanguage(cookieLang);
    }
  });
}

export default i18n;
