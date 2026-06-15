import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import fr from "./fr.json";
import ar from "./ar.json";

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    fr: { translation: fr },
    ar: { translation: ar },
  },
  lng: localStorage.getItem("spitar_lang") ?? "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

i18n.on("languageChanged", (lng) => {
  localStorage.setItem("spitar_lang", lng);
  const isRtl = lng === "ar";
  document.documentElement.dir = isRtl ? "rtl" : "ltr";
  document.documentElement.lang = lng;
});

const isRtl = (i18n.language ?? "en") === "ar";
document.documentElement.dir = isRtl ? "rtl" : "ltr";
document.documentElement.lang = i18n.language ?? "en";

export default i18n;
