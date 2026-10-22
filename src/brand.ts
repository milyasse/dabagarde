// Identité et liens publics de l'application (aucun secret).
export const BRAND = {
  name: 'DabaGarde',
  tagline: 'La pharmacie de garde, maintenant.',
  repoUrl: 'https://github.com/milyasse/dabagarde',
  /** Les signalements sont enregistrés comme tickets GitHub, puis examinés avant toute correction. */
  reportUrl: 'https://github.com/milyasse/dabagarde/issues/new',
} as const;

/** Chemins des pages statiques générées au build (relatifs à la base du site). */
export const PAGES = {
  villes: 'villes/',
  urgences: 'urgences/',
  methode: 'comment-ca-marche/',
  faq: 'faq/',
  contact: 'contact/',
  confidentialite: 'confidentialite/',
  mentions: 'mentions-legales/',
  ville: (slug: string) => `pharmacie-de-garde/${slug}/`,
} as const;

export const pageUrl = (path: string) => `${import.meta.env.BASE_URL}${path}`;
