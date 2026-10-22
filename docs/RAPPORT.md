# Rapport de refonte — DabaGarde 2.0.0-alpha

22/10/2026. Dépôt : `milyasse/dabagarde` (copie de `milyasse/pharmacies-garde-maroc` v1.7.0, commit b6d00dd, sans le dossier marketing). L'app actuelle n'a pas été modifiée.

## 1. Audit

### Dépôt existant (v1.7.0)

- **Technologie adaptée, conservée** : React 19, TypeScript strict, Vite 6, Tailwind 4, Leaflet, PWA (Workbox), collecteur Node 22 en GitHub Actions, JSON statiques sur GitHub Pages. Aucun secret dans le dépôt.
- **Logique de données solide, conservée** : statuts (confirmée, à confirmer, contradictoire, expirée), fuseau Africa/Casablanca, fusion multi-sources, 51 tests.
- **Limites constatées** :
  - Une seule page rendue en JavaScript : aucun contenu lisible par les moteurs sans exécution.
  - Pas de robots.txt, sitemap, canonical, Open Graph ni données structurées.
  - Espace cliniques derrière `#/cliniques`, non indexable.
  - Écran de lancement de ~5,6 s à la première visite.
  - Villes figées à Rabat, Salé et Témara (type `CityId`).
  - Pas de fiche détaillée, de partage, de favoris ni de signalement.
  - Un libellé de rubrique (« Coordonnées ») parfois repris à la place d'une adresse.

### Site de référence garde24.ma (22/10/2026)

- **Fonctionnalités utiles retenues comme idées** :
  - recherche par ville ou « autour de moi » ;
  - pages par ville (75 villes) ;
  - listes datées ;
  - positions approximatives signalées ;
  - signalement d'erreur ;
  - pages méthode, urgences et contact ;
  - version arabe.
- **Conditions d'utilisation** : interdiction explicite de l'extraction automatisée, de la copie, de la republication et de la création d'une API à partir de ses données. **Rien n'a été repris** (ni code, ni texte, ni identité visuelle, ni données). L'app propose seulement un lien vers sa page publique pour une ville non couverte.

### Sources de garde

Détail dans [SOURCES.md](../SOURCES.md). **Aucune source autorisée ne couvre aujourd'hui tout le Maroc.** La couverture nationale est donc préparée dans l'architecture ; elle ne sera effective qu'avec des sources ou partenariats autorisés.

## 2. Diagnostic

| Élément | Décision |
| --- | --- |
| Collecteur, statuts, fusion, fuseau horaire, tests | Conservés |
| Carte Leaflet, itinéraires OSRM, géolocalisation, adresse (Nominatim) | Conservés, intégrés à la nouvelle mise en page |
| Espace cliniques et hôpitaux | Conservé, adresse `?espace=sante`, page statique dédiée |
| Écran de lancement | Retiré du site web (le visuel portait l'ancien nom et « Rabat ») |
| Accueil, en-tête, cartes de résultat, liste | Remplacés |
| Recherche de ville nationale, régions, fiche, partage, favoris, signalement, pages SEO, contrôles de qualité | Ajoutés |

## 3. Conception

- **Interface** : vert et blanc, une seule couleur d'action, typographies Bricolage Grotesque (titres) et Plus Jakarta Sans (texte), hébergées avec l'app.
- **Accueil** : recherche centrale, filtres rapides, villes couvertes et leur nombre de gardes, grandes villes non couvertes, favoris, fiabilité, FAQ.
- **Résultats** :
  - sur téléphone : onglets Liste / Carte ;
  - sur ordinateur : liste et carte côte à côte ;
  - sur chaque carte de résultat : appeler et itinéraire visibles sans ouvrir la fiche.
- **Architecture** : inchangée dans son principe (statique, sans serveur ni base de données). Le nouveau dépôt **reprend les données publiées par l'app actuelle** au lieu de solliciter une seconde fois les sources.

## 4. Fonctionnalités opérationnelles (vérifiées en CI le 22/10/2026)

Branche `refonte-ui`, puis `main`. Toutes les étapes sont passées :

- types ;
- 59 tests unitaires ;
- recherche de secrets ;
- build ;
- **49 contrôles Playwright** ; rapport et captures sur la branche `ci-reports`, dossier `refonte-ui/`.

Parmi les contrôles réellement exécutés :

- **Accueil** : affiché immédiatement, recherche centrale.
- **Recherche de ville** : « Sal » propose Salé ; 16 gardes affichées ; adresse partageable.
- **Fiche** : sources, heure de récupération, précision de la position, mention « non vérifiée sur le terrain ».
- **Signalement** : ticket prérempli.
- **Favoris, filtre texte, carte** : favoris et recherches récentes, filtre texte, carte avec marqueurs.
- **Ville non couverte** (Marrakech) : message explicite et lien d'origine, aucune donnée inventée.
- **Liens et position** :
  - filtre « De nuit » reporté dans l'adresse ;
  - lien `?ville=temara` qui lance la recherche à l'ouverture ;
  - géolocalisation acceptée, et refusée avec un message explicite ;
  - aucune position GPS dans l'adresse.
- **Cliniques** : Rabat, 39 établissements ; aucun établissement « de garde » sans source officielle.
- **Pages statiques** :
  - page Rabat lisible sans JavaScript, avec canonical et données structurées ;
  - 8 pages d'information servies avec un seul H1 ;
  - sitemap, robots, canonical de l'accueil.
- **Accessibilité** : aucun élément interactif sans nom accessible ; lien d'évitement présent.
- **Ordinateur** : liste et carte affichées ensemble.

Ce qui n'a pas été testé : l'envoi réel d'un ticket de signalement, le partage natif sur téléphone (la copie de secours est codée), les performances mesurées (PageSpeed) et le site publié (Pages non activé au moment des tests).

## 5. Ce qui reste à finaliser

1. **Activer GitHub Pages** : Settings → Pages → Source « GitHub Actions » (action du propriétaire du dépôt).
2. **Base géographique** : le workflow « Base géographique » interroge OpenStreetMap. En attendant ses fichiers, la recherche ne propose que les villes couvertes. Relire `data-sources/geo/report.json` (provinces sans code, régions manquantes).
3. **Sources** :
   - demander un accord écrit à annuaire-gratuit.ma (ses CGU interdisent la redistribution) et à guidepharmacies.ma ;
   - contacter les Ordres et syndicats régionaux pour des tableaux officiels ;
   - proposer un partenariat à garde24.ma si souhaité.
4. **Contact sans compte GitHub** : une adresse e-mail de contact est à choisir (aucune n'est publiée aujourd'hui).
5. **Mentions légales** : compléter l'identité de l'éditeur.
6. **Version arabe** de l'interface (non réalisée).
7. **Regroupement des marqueurs** sur la carte au-delà de quelques centaines de résultats (non nécessaire à la couverture actuelle).
8. **Notifications** de changement de garde : nécessitent un service d'envoi ; non réalisées.
9. **Domaine propre** (dabagarde.ma) : sur `github.io/dabagarde/`, le robots.txt n'est pas lu par les moteurs (il doit être à la racine du domaine). Le sitemap peut être soumis dans Search Console avec une propriété « préfixe d'URL ».
10. **Remplacement de l'app actuelle** : réactiver la collecte dans ce dépôt, rediriger l'ancienne adresse, arrêter l'ancien workflow.

## 6. Coûts

- **Aujourd'hui** : 0 MAD. GitHub Actions et Pages sont gratuits pour un dépôt public ; OpenStreetMap, OSRM et Nominatim sont utilisés avec modération.
- **À venir** : domaine (environ 220 MAD/an) et, si le trafic grandit, un fournisseur de tuiles et d'itinéraires (montant non estimé ici). Voir la stratégie de déploiement.

## 7. Configuration

- **Variables d'environnement** : aucune obligatoire.
  - Optionnelles (`.env.example`) : `VITE_DATA_URL`, `VITE_TILE_URL`, `VITE_OSRM_*`, `VITE_NOMINATIM_URL`.
  - En CI : `BASE_PATH` (`/dabagarde/`) et `SITE_URL` (`https://milyasse.github.io/dabagarde`), à remplacer par le domaine le moment venu.
- **Search Console** :
  - ajouter une propriété « préfixe d'URL » `https://milyasse.github.io/dabagarde/` ;
  - la valider par une balise meta (à ajouter dans `index.html`) ;
  - soumettre `sitemap.xml`.
- **Signalements** : onglet Issues du dépôt, libellé `signalement`. Examiner chaque ticket avant de corriger une source ou une saisie manuelle.
