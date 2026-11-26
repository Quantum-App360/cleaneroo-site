# Cleaneroo AI — « Décrire mon besoin » : documentation technique (26/11/2026)

## Principe
Le client décrit son besoin (texte, dictée, jusqu'à 4 photos). L'IA (Claude, fonction serveur `besoin-ia`) joue l'expert du nettoyage
et renvoie une **proposition faite uniquement d'identifiants du catalogue**. Le site en fait une fiche chiffrée par **le moteur de la
réservation** (`estimation.js`), puis ouvre **le parcours de réservation existant**, prérempli. Le serveur de paiement recalcule le prix
comme pour toute réservation. **L'IA ne donne jamais de prix.**

## Fichiers
| Rôle | Fichier |
|---|---|
| Fenêtre, conversation, fiche, avertissements | `assets/js/assistant-ia.js` |
| Passage vers la réservation, prestations suivantes | `assets/js/assistant-ia-reservation.js` |
| Brouillon et estimation identiques au parcours | `assets/js/reserver.js` (`brouillonPour`, `estimerBrouillon`, `totalAffiche`, `fournirPhotos`, rattachement `lier_analyse_ia`) |
| Matériel des Cleaneurs, brief de mission, écart sur place | `assets/js/equipements.js` |
| Pilotage (back-office › Cleaneroo AI) | `assets/js/gestion-ia.js` |
| Fonction serveur IA | `supabase/functions/besoin-ia/index.ts` |
| Catalogue lu par l'IA (publié avec le site) | `assets/catalogue-ia.json`, généré par `outils/generer_catalogue_ia.mjs` (lancé par `generer_pages.py`) |
| Base de connaissances de départ | `outils/connaissances-ia-initiales.json` → `outils/base-assistant-ia-contenu.sql` |
| Base de données | `outils/base-assistant-ia.sql`, `outils/base-equipements.sql` |

## Base de données
- `connaissances_ia` (id, type, donnees jsonb, actif) : objets (→ prestation, éléments, options, matériel, questions), matières (eau oui/test/non,
  précautions), étiquettes W/S/WS/X, salissures (options conseillées, résultat à annoncer, validation humaine), avertissements (par option),
  équipements, règles. Lecture publique des entrées actives ; écriture : administrateurs. Modifiable dans le back-office.
- `analyses_ia` : chaque analyse (texte, nombre de photos — les photos ne sont pas gardées —, réponse, identifiants écartés, options retirées,
  demande créée, traitement). Écrite par la fonction serveur ; le client voit les siennes, l'administration toutes.
- `lier_analyse_ia(analyse, reference, jeton, options_retirees)` : rattache l'analyse à la demande créée.
- `profils.equipements` + `maj_equipements(text[])` ; `equipe_pour(demande, cleaneur)` ; contrôle ajouté à `missions_disponibles`,
  `missions_incompatibles` (raison « equipement »), `prendre_mission`, `proposer` (réponse « equipement ») et `cibler_cleaneurs`.
  Une demande sans `details.equipementsRequis` n'a aucune condition : les réservations classiques ne changent pas.

## Fonction serveur `besoin-ia` (verify_jwt désactivé, contrôles internes)
- Entrée : `{ langue, conversation: [{role: client|assistant, texte}], photos: [base64 JPEG ≤ 4], consentement_photos }`.
- Limites : 20 analyses par heure et 60 par jour par visiteur (empreinte de l'IP), 4 photos, 4 000 caractères par message.
- Schéma de réponse imposé (`output_config.format`) : les identifiants de prestation, option, élément, type, taille, dernier nettoyage
  sont des listes fermées tirées du catalogue publié. Puis `nettoyer()` revérifie chaque identifiant contre la prestation choisie
  (option hors prestation ou hors type de lieu retirée et notée dans `analyses_ia.ecartes`).
- Objet hors catalogue (canapé en cuir, chaises, tête de lit) ou moisissures → `validation_humaine` ; le client peut envoyer sa demande
  à l'équipe (table `demandes_support`, onglet Support du back-office).
- Secret requis : `ANTHROPIC_API_KEY`. Sans clé : `{ etat: "indisponible" }` et le site propose de réserver directement.
- Modèle : `claude-opus-5-5` (repli automatique côté serveur Anthropic).

## Prix : garanties
1. La fiche appelle `estimerBrouillon(brouillonPour(rubrique, champs))` : exactement le calcul de l'écran de réservation.
2. La réservation ouverte depuis la fiche reprend ces mêmes champs : même prix affiché (vérifié : 161,70 € des deux côtés).
3. Le serveur de paiement (`prix-serveur.js` figé au commit 87ecf7d) recalcule : 0 écart sur 1 080 cas comparés le 26/11 entre ce commit
   et le site actuel. Après tout changement des règles de prix dans `assets/js`, mettre à jour ce commit dans la fonction `paiement`.
4. Tests (`tests.html`, bloc « Cleaneroo AI ») : canapé, véhicule, logement, matelas, moquette au m², vitres, retrait d'option,
   tarif d'option modifié depuis la gestion puis rétabli — fiche = réservation = serveur.

## Parcours client
Accueil › « Décrire mon besoin » → questions si nécessaire → fiche (diagnostic, options Nécessaire / Recommandé / Facultatif avec prix et
raison, « À quoi vous attendre », détail du prix) → retrait d'une option recommandée : avertissement « Conserver / Retirer quand même »,
enregistré (`details.diagnosticIa.retirees` et `analyses_ia.options_retirees`) → « Continuer la réservation » : étape 3 (photos jointes),
puis adresse, créneau, Cleaneur, paiement existants. Plusieurs prestations : la suivante est proposée sur la page de suivi
(« Réserver la suivante ») — chaque demande se paie séparément, comme aujourd'hui.

## Côté Cleaneur
- Profil › « Mon matériel » : cases à cocher (équipements actifs de la base de connaissances).
- Carte de mission › « Brief de la mission » : objet, matière et précautions, salissures, vu sur photo / indiqué par le client, options
  retenues et retirées, matériel nécessaire, résultat annoncé. Sur place : « La réalité ne correspond pas à la fiche » ouvre le
  signalement à l'arrivée existant (type « Autre », texte prérempli), qui donne accès au supplément pour imprévu.

## Pilotage (back-office › Cleaneroo AI)
Chiffres sur 30 jours, cas « À reprendre », demandes hors catalogue, identifiants écartés, options retirées, écarts après mission
(signalements « Cleaneroo AI » et avis ≤ 3/5), base de connaissances modifiable (JSON, activer / désactiver, ajouter).

## À faire avant la mise en ligne
- Ajouter le secret `ANTHROPIC_API_KEY` (Supabase › Edge Functions › Secrets), puis tester les 15 scénarios avec le vrai modèle.
- Redéployer `besoin-ia` (version locale avec « dernier nettoyage ») et pousser le site (le catalogue publié doit contenir `derniersNettoyages`).
- Prévenir les Cleaneurs de remplir « Mon matériel » : sans cela, une mission qui exige un injecteur-extracteur n'est proposée à personne.

## À reporter par Vincent (applis)
Bouton et fenêtre « Décrire mon besoin » (même fonction serveur, même préremplissage), « Mon matériel » dans le profil Cleaneur
(`maj_equipements`), brief de mission (`details.diagnosticIa`), réponse « equipement » de `prendre_mission` et `proposer`.
