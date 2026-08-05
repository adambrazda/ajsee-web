const COVER_CREDIT_LABELS = Object.freeze({
  cs: Object.freeze({
    photo: "Foto",
    visualSource: "Zdroj vizuálu"
  }),

  en: Object.freeze({
    photo: "Photo",
    visualSource: "Visual source"
  }),

  de: Object.freeze({
    photo: "Foto",
    visualSource: "Bildquelle"
  }),

  sk: Object.freeze({
    photo: "Foto",
    visualSource: "Zdroj vizuálu"
  }),

  pl: Object.freeze({
    photo: "Zdjęcie",
    visualSource: "Źródło grafiki"
  }),

  hu: Object.freeze({
    photo: "Fotó",
    visualSource: "A vizuál forrása"
  })
});

const CREDIT_PATTERN =
  /^(Photo|Visual source)\s*:\s*(.+)$/i;

export function localizeCoverCredit(
  rawCredit,
  language
) {
  const credit =
    String(rawCredit || "").trim();

  if (!credit) {
    return "";
  }

  const match =
    credit.match(CREDIT_PATTERN);

  if (!match) {
    return credit;
  }

  const creditType =
    match[1].toLowerCase() === "photo"
      ? "photo"
      : "visualSource";

  const labels =
    COVER_CREDIT_LABELS[language] ||
    COVER_CREDIT_LABELS.en;

  const sourceName =
    match[2].trim();

  return `${labels[creditType]}: ${sourceName}`;
}
