# DabaGarde

**La pharmacie de garde, maintenant.** Version **2.0.0-alpha** (refonte de [Pharmacies de Garde Maroc](https://github.com/milyasse/pharmacies-garde-maroc) v1.7.0) — voir [CHANGELOG.md](CHANGELOG.md) et le [rapport de refonte](docs/RAPPORT.md).

Application web installable (PWA) qui affiche les **pharmacies de garde** et les **cliniques et hôpitaux** autour de vous, à partir de sources publiques datées. Architecture **nationale** (12 régions, provinces, communes, quartiers) ; gardes affichées **uniquement là où une source fiable et réutilisable existe** (aujourd'hui Rabat, Salé, Témara).

- Recherche instantanée de ville, commune ou quartier ; « Autour de moi » ; adresse ; point sur la carte ; navigation par région → province → ville
- Filtres : de garde aujourd'hui, de nuit, 24 h/24 ; date ; rayon ; tri par distance, statut ou durée de trajet ; filtre par nom, adresse ou quartier
- Résultats en liste et carte (onglets sur téléphone, côte à côte sur ordinateur) ; positions exactes et approximatives distinguées
- Fiche : statut temporel calculé à l'heure du Maroc (jamais « ouverte »), type et période de garde, horaires publiés, sources et heure de récupération, précision de la position, points d'attention ; appeler, itinéraire (OSRM, Google Maps, Waze), partager, favori, **signaler une erreur**
- Ville sans source : message explicite, lien vers la page publique d'origine, numéros d'urgence — aucune donnée inventée
- Pages statiques indexables régénérées à chaque déploiement : une page par ville couverte (liste du jour lisible sans JavaScript), annuaire des villes, cliniques et hôpitaux, urgences, méthode, FAQ, contact, confidentialité, mentions légales, sitemap, robots, 404

> Les informations sont récupérées automatiquement sur des listes publiques et ne sont pas vérifiées sur le terrain. Appelez la pharmacie avant de vous déplacer. Urgence vitale : 141 (SAMU) ou 15 (Protection civile).

## Architecture

```
milyasse/pharmacies-garde-maroc (app actuelle)        milyasse/dabagarde (ce dépôt)
GitHub Actions, toutes les ~2 h                        GitHub Actions « Déploiement », ~30 min après
  collecte des gardes + santé  ──► public/data/*.json ──► reprise des données (sans 2e collecte)
                                                        ├─ vite build (application React, PWA)
                                                        ├─ scripts/build-pages.ts (pages statiques SEO)
                                                        └─ GitHub Pages : https://milyasse.github.io/dabagarde/
GitHub Actions « Base géographique » (mensuel) : OpenStreetMap → public/data/geo/*.json
GitHub Actions « Vérifications » (chaque branche) : types, tests, secrets, build, parcours Playwright
  → rapports et captures publiés sur la branche ci-reports
```

Pas de serveur, pas de base de données, **aucune clé secrète**. Les signalements sont des tickets GitHub (modèle `.github/ISSUE_TEMPLATE/signalement.yml`), examinés avant toute correction.

Quand DabaGarde remplacera l'app actuelle, la collecte sera réactivée ici (scripts `collect` et `collect:sante` déjà présents) et l'ancien dépôt arrêté.

## Démarrer en local

Prérequis : Node.js ≥ 22.6.

```bash
npm install
npm test                 # tests unitaires et de bout en bout (sans réseau)
npm run dev              # http://localhost:5173
npm run build:site       # application + pages statiques dans dist/
npm run geo              # base géographique (requêtes Overpass, quelques minutes)
npm run typecheck
```

## Paramètres d'adresse

`?ville=rabat|sale|temara` · `?lieu=<nom>&lat=…&lng=…` (centre d'une ville, jamais une position GPS) · `?type=night|continuous|day` · `?espace=sante`. L'ancien lien `#/cliniques` reste accepté.

## Configuration

Aucune clé n'est nécessaire. Les services publics utilisés peuvent être remplacés via `.env.local` (voir [.env.example](.env.example)) :

| Service | Usage | Coût | Politique d'usage |
|---|---|---|---|
| Tuiles OpenStreetMap | fond de carte | gratuit | usage raisonnable + attribution |
| OSRM (routing.openstreetmap.de, secours router.project-osrm.org) | itinéraires à la demande | gratuit | usage raisonnable, pas de calcul massif |
| Nominatim | adresse de départ (à la validation, jamais à la frappe) | gratuit | ≤ 1 requête/s, cache |
| GitHub Actions / Pages | collecte + hébergement | gratuit (dépôt public) | quotas GitHub |

Pour un trafic important, remplacez tuiles/OSRM/Nominatim par une instance dédiée ou un fournisseur commercial (MapTiler, openrouteservice…) — sans exposer de clé secrète : une clé côté navigateur doit être restreinte par domaine chez le fournisseur.

## Ajouter une ville ou une source

- **Ville** : seulement si une source fiable et réutilisable la couvre. Ajouter l'identifiant dans `CityId` (`src/shared/types.ts`), dans `CITIES` (`src/shared/connectors/registry.ts`) et dans le connecteur concerné. La couverture (`src/shared/coverage.ts`), la page de ville, le sitemap et l'annuaire suivent automatiquement.
- **Source** : écrire un parseur pur dans `src/shared/connectors/`, des tests sur des pages modèles, l'appeler dans `scripts/collect.ts`, et la déclarer dans `CONNECTORS`. Une source qui ne peut pas être lue légalement ou de façon fiable reste déclarée **désactivée** avec sa raison.
- **Tableau officiel / jours à venir** : déposer un CSV dans `manual/` (voir [manual/README.md](manual/README.md)). Les sites en ligne ne publient les gardes que le jour même.

## Structure

```
src/
  shared/                 logique pure, partagée app + collecteur (testée)
    types.ts              modèle normalisé (Pharmacy, DutyRecord…)
    dates.ts              fuseau Africa/Casablanca, dates FR, plages horaires
    distance.ts           Haversine, filtrage par rayon, classement
    duty.ts               types de garde
    status.ts             statuts de fiabilité, expiration, sélection par date
    merge.ts              doublons, fusion multi-sources, contradictions
    search.ts             recherche (date + type + rayon + rang)
    connectors/           registre des sources + parseurs
    geo/                  base géographique nationale : types, régions, recherche de localités
    coverage.ts           villes couvertes, liens vers l'information d'origine
    temporal.ts           statut temporel (heure du Maroc, jamais « ouverte »)
    quality.ts            contrôles de qualité (téléphone, position, doublons)
  services/               géolocalisation, géocodage, routage, chargement des données
  components/             layout (en-tête, pied de page), home (accueil), search (ville, régions), results (fiche, signalement, couverture), PharmacyMap, PharmacyList, PharmacyCard…
  utils/colors.ts         couleurs de rang (= tokens Figma)
scripts/collect.ts        collecteur (Node 22, sans dépendance)
scripts/build-geo.ts      base géographique nationale (OpenStreetMap, en CI)
scripts/build-pages.ts    pages statiques SEO (villes, informations, sitemap)
scripts/verify-ui.mjs     parcours d'interface (Playwright, en CI)
tests/                    tests node:test + pages modèles
public/data/              données produites par le collecteur
manual/                   saisie manuelle de tableaux officiels
.github/workflows/        collecte planifiée + déploiement Pages
```

## Tests

`npm test` (60 tests, Node `node:test`, sans dépendance ni réseau) couvre : Haversine, filtrage par rayon, classement et rangs, dates/fuseau/plages horaires, types de garde, téléphones, parseurs liste/fiche, statuts de fiabilité, expiration, gardes de nuit de la veille, doublons et contradictions, collecteur de bout en bout, couleurs de rang.

Les pages modèles de `tests/fixtures/` reproduisent la structure observée des pages sources ; elles ne remplacent pas un essai réel (`npm run check:sources`).

## Confidentialité

La position reste dans le navigateur ; elle n'est envoyée qu'aux services nécessaires (tuiles, OSRM à la demande, Nominatim si vous cherchez une adresse) et n'est jamais enregistrée ni placée dans l'adresse des pages. Seuls des préférences non sensibles, les favoris et les dernières villes recherchées sont mémorisés localement.
