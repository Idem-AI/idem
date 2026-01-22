export enum Language {
  English = "en",
  "Chinese(Simplified)" = "zh-CN",
}

export const LanguageNativeNames: { name: string; locale: Language }[] = [
  {
    name: "English",
    locale: Language.English,
  },
  {
    name: "Simplified Chinese",
    locale: Language["Chinese(Simplified)"],
  },
];

export const locales = LanguageNativeNames.map((item) => item.locale);
