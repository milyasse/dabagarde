# Couverture nationale — étude des sources (22/10/2026)

Objectif : couvrir tout le Maroc **sans jamais présenter une ville comme couverte sans source exploitable**.

| Source | Couverture observée | Conditions de réutilisation | Décision |
|---|---|---|---|
| **garde24.ma** | 75 villes publiées (page d'accueil, 22/10/2026) | Conditions d'utilisation : interdiction explicite de « scraper, crawler, moissonner, extraire ou copier systématiquement » et de « copier, republier, vendre ou exploiter les données », y compris via JSON/API. Aucune API publique. | **Aucune donnée reprise.** Lien vers la page publique de la ville quand elle existe (`src/shared/coverage.ts`). Demande de partenariat possible. |
| **annuaire-gratuit.ma** | Rabat, Salé, Témara, Agadir, Tanger, Fès, Aït Melloul, Inezgane, Ben Guerir, Berrechid, Settat… | Conditions générales : interdiction de reproduire le site ou une partie sur un autre serveur, de produire des travaux dérivés et de redistribuer l'information. | **Utilisée pour toutes ses villes (décision du porteur, 22/10/2026, en connaissance du risque).** Risque juridique à régulariser par une demande d'accord écrite. Le 22/10/2026 à 9 h 40, 12 villes publiaient des gardes ; les autres pages étaient vides. |
| **guidepharmacies.ma** | Rabat, Salé, Témara-Tamesna, Aïn Aouda, Kénitra-Mehdia, Casablanca | Aucune condition d'utilisation publiée ; mention « © Santeservice Maroc ». robots.txt n'interdit pas les pages de garde. | Déclarée pour Rabat, Salé, Témara, Aïn Aouda, Kénitra et Casablanca. **Le 22/10/2026, le site affichait une erreur serveur** (version PHP non prise en charge) : aucune donnée lisible, y compris pour l'app actuelle. Reprise automatique dès que le site revient. |
| Ordres et syndicats régionaux de pharmaciens | Variable (certaines villes publient un tableau, souvent en PDF ou sur les réseaux sociaux) | Information publique ; réutilisation à confirmer avec l'émetteur | Saisie manuelle possible (`manual/`), source et date citées. Priorité 1 : partenariats. |
| OpenStreetMap | Tout le Maroc (régions, provinces, localités, quartiers) | ODbL : réutilisation libre avec attribution | **Base géographique nationale** (`scripts/build-geo.ts`). Ne contient pas les gardes. |

# Sources des gardes — étude de faisabilité (13/10/2026)

Zone de démarrage : **Rabat, Salé, Témara**.

| Source | Statut | Ce qu'elle publie | Limites |
|---|---|---|---|
| Conseils régionaux / Ordre des pharmaciens | Non trouvée en ligne | Aucun tableau de garde ni API publique identifiés pour Rabat-Salé-Témara | Saisie manuelle possible (`manual/`) si un tableau officiel est obtenu |
| **annuaire-gratuit.ma** | **Active** | Liste par ville (`/pharmacie-garde-<ville>.html`) avec date « mise à jour le … » ou « Aujourd'hui … », type de garde, quartier, adresse, souvent les coordonnées ; **fiche par pharmacie** avec téléphone, coordonnées et **historique de garde daté (début/fin)** | Site d'annuaire, non officiel. Pendant l'étude, certaines pages servaient une liste d'une **autre date** que le jour même (ex. Rabat « 28 septembre » consultée le 13 octobre) : le collecteur lit la date de chaque page et ne confirme jamais une garde sur une page périmée. Téléphone masqué sur la liste, lu sur la fiche. |
| **guidepharmacies.ma** | **Active (depuis v1.3.0)** | Planning hebdomadaire par ville (`/pharmacies-de-garde/<ville>.html`, `?date=<lundi>` pour les semaines suivantes) : jour, quartier, horaires, nom, téléphone ; fiche avec adresse | Les coordonnées publiées sont celles du **centre du quartier** : affichées comme approximatives, remplacées par la position exacte d'une autre source ou par l'adresse géocodée. Gardes sans horaire publiées sans type. |
| lematin.ma | Désactivée | Dates début/fin par pharmacie (Rabat) | Rabat uniquement ; la liste est chargée par un point d'accès interdit par son robots.txt (`/ajax/`, `/api/`). |
| wadifapublic.ma | Désactivée | Listes par ville (dont Témara, Salé, Harhoura), coordonnées | Aucune date de validité explicite ; dispositif anti-robot (« honeypot ») présent : on ne contourne pas. |
| med.ma | Non utilisée | Annuaire par ville et type | Pas de date de validité ni d'horodatage : ne permet pas d'affirmer une garde. |

## Règles de fiabilité appliquées

- **Confirmée** : la date demandée est couverte par l'historique daté de la fiche (début ≤ date ≤ fin), et/ou la pharmacie figure sur une liste **datée du jour même de la collecte**.
  - confiance **élevée** : deux sources indépendantes concordantes (ex. annuaire + tableau officiel saisi) ;
  - **moyenne** : liste datée du jour + historique de la fiche ;
  - **faible** : un seul de ces deux signaux.
- **À confirmer** : trouvée, mais page sans date, page périmée, ou historique muet.
- **Sources contradictoires** : type de garde ou période différents selon les sources.
- **Expirée** : date de fin publiée passée, plage horaire publiée terminée, ou garde de nuit de la veille après midi.
- Aucun horaire, téléphone ou coordonnée n'est inventé : champ inconnu = `null`, affiché « non publié ».

## Respect des sites

- Pages autorisées par les robots.txt (vérifiés le 13/10/2026), en-tête `User-Agent` identifiant le projet.
- ≥ 1,5 s entre deux requêtes, au plus ~50 pages par passage, toutes les ~2 h.
- Les fiches déjà connues ne sont re-téléchargées que si leur historique ne couvre pas encore la date (ou après 7 jours).
- Géocodage Nominatim seulement pour les adresses sans coordonnées, 8 au plus par passage, résultats mis en cache.

## Si la source change ou bloque

Le collecteur marque la source « en erreur » (fichier `public/data/status.json`, visible dans l'app → Paramètres) et le workflow affiche un avertissement. Lancez `npm run check:sources` en local pour voir le détail. Les parseurs sont dans `src/shared/connectors/annuaireGratuit.ts` et s'appuient sur des motifs stables (liens de fiche `-s<id>.html`, liens `destination=lat,lng`, dates ISO de l'historique) plutôt que sur des classes CSS.

# Cliniques et hôpitaux — sources (21/10/2026)

| Source | Statut | Ce qu'elle publie | Limites |
|---|---|---|---|
| **Ministère de la Santé — « Liste des hôpitaux 2022 »** ([data.gov.ma](https://data.gov.ma/data/fr/dataset/la-liste-des-hopitaux), ODbL) | **Active** | Liste nominative officielle des hôpitaux publics de tout le Maroc par région, délégation, commune et catégorie (170 hôpitaux) | Ni adresse, ni coordonnées, ni téléphone, ni urgences. Données de 2022 (mises à jour le 14/11/2023). Téléchargée chaque semaine (workflow « Base géographique ») et recopiée telle quelle dans `data-sources/sante/ministere-hopitaux-2022.json` (`scripts/ministry-hospitals.py`) ; en cas de format inattendu, le fichier précédent est conservé. |
| **OpenStreetMap** (Overpass API, ODbL) | **Active** | Position, nom (français/arabe), parfois adresse, téléphone, site, spécialités (`healthcare:speciality`), présence d'urgences (`emergency=yes/no`), horaires (`opening_hours`) | Données contributives : complètes pour certains établissements, absentes pour d'autres. Interrogé **au plus une fois par jour** (usage raisonnable). Cabinets, laboratoires, centres de dialyse et objets sans nom sont écartés. |
| Correspondances ministère ↔ OSM | Vérifiées à la main, puis automatiques | `data-sources/sante/correspondances-osm.json` : 7 rapprochements vérifiés à la main (Rabat, Salé, Témara). Ailleurs, rapprochement automatique (`src/shared/health/ministry.ts`) seulement si l'objet OSM porte tous les mots significatifs du nom officiel, se trouve à moins de 15 km de la commune (35 km si seule la délégation est connue), n'est ni privé, ni militaire, ni un centre de santé, est cohérent avec la catégorie (oncologie, psychiatrie, CHU) et qu'aucun autre objet ne convient aussi bien : 47 au 22/10/2026, signalés « à confirmer » sur la fiche. | Un hôpital officiel non rapproché est listé « position non publiée » et n'apparaît que pour une recherche autour de sa commune (centre de la commune d'après la base géographique, jamais affiché comme position). |
| Saisie manuelle (`manual/sante.json`) | Disponible, vide | Horaires vérifiés, urgences confirmées, désignations officielles de garde — chaque entrée avec source et date | Rien n'est affiché sans source. |
| Ministère de la Santé — établissements de soins de santé primaire 2024 | Non utilisée | Centres de santé (urbains et ruraux) | Hors du périmètre « cliniques et hôpitaux » ; peut être ajoutée plus tard. |
| Liste officielle des hôpitaux / cliniques « de garde » | **Non trouvée** | — | Aucune source officielle en ligne ne désigne des hôpitaux ou cliniques « de garde » à Rabat, Salé ou Témara. L'application n'affiche donc jamais ce statut, sauf désignation officielle saisie dans `manual/sante.json`. |

## Niveaux d'information affichés (jamais confondus)

1. **Répertorié** : présent dans au moins une source identifiable (ministère, OpenStreetMap).
2. **Urgences déclarées** : une source mentionne un service d'urgences (OSM `emergency=yes` ou vérification manuelle). Cela ne garantit ni l'ouverture ni une garde.
3. **Horaires vérifiés** : uniquement après une vérification datée et sourcée (`manual/sante.json`). Les horaires OSM sont affichés « non vérifiés ».
4. **De garde (désignation officielle)** : uniquement si une source officielle le désigne pour la date du jour.

Le type (hôpital public, clinique privée…) vient du ministère, de l'opérateur déclaré dans OSM ou, à défaut, du nom (« Clinique … », « CHU … ») — dans ce cas la fiche indique « d'après le nom ». Les services déduits du nom (ex. « Maternité … ») sont marqués d'un astérisque.
