# Corrections graphiques du 22 novembre 2026 (audit graphique, nuit du 21 au 22)

Version de l'appli : **1.0.65 (code 66)**. Mêmes règles appliquées au site (`cleaneroo-site/assets/style.css`, dernière couche « Lisibilité et charte »).
Le logo officiel et les prix ne sont pas modifiés.

## Principe (charte du 18/11/2026, `design/logo-officiel/CHARTE.md`)
- Sur les dégradés du logo (bleu #04BEE5, vert d'eau #0DC88D, vert #1AD934), le texte est à l'**encre du logo #231F20** (`EncreLogo` dans `Charte.kt`) : 7,4 à 8,6:1. Le blanc n'y dépassait pas 2,2:1 (minimum lisible : 4,5:1).
- Les textes colorés utilisent les teintes foncées prévues pour le texte (#0A6F93, #087A69, #A64626…).
- Plus aucun texte sous 12 sp.

## Appli Android
- Bouton principal, avatars, en-têtes des espaces Conciergerie / Entreprise / Hôtels / Ma société, carte « Rechercher une mission », bouton « Réserver » de l'accueil, pastilles et bouton « Regarder » : texte à l'encre du logo.
- Boutons « Programmer » : `C.c.onPrimary` (lisible aussi en mode sombre).
- Gris tertiaire #5F777A → #566C6F (4,5:1).
- Couleurs hors charte retirées : violets (#7A5BD6, #8C7BF2, #9C8CFF, #6B5BD6, #4D57C8) → couleurs du logo ; teinte « ROSE » → corail ; pastel de « LILAS » corrigé (vert pâle au lieu de lilas).
- Dégradés foncés derrière du texte blanc (vitrine, abonnement, formules) : #0AA88F remplacé par #087A69 / #0A6F93.
- Tailles 10 sp → 12 sp (agenda, accueil, étapes de mission, compteurs). Pastille de compteur 18 → 20 dp.
- Frise des étapes d'une intervention : une seule ligne lisible « Étape · n/6 » sous la frise (les six libellés en 10 sp étaient coupés).
- Barre d'onglets : « Mes prestations » → « Prestations » (libellé coupé), libellés sans retour à la ligne.

## Site
- Même encre sur tous les boutons et pastilles en dégradé, bandeau « Crédit d'impôt », en-têtes des espaces.
- Liens colorés des cartes, chiffres clés et titre du héros en teintes foncées.
- Téléphone : « Conciergerie » n'est plus coupé, lancement annoncé une seule fois, plus de bande vide sous le pied de page, onglets « Hôtels et campings » sur deux lignes au lieu de déborder.
- Tailles 11 / 11,5 px → 12 px.

# Réservation et paiement (22 novembre 2026, après-midi)

## Parcours de réservation (site et appli Android)
- **« Quel ménage ? »** (ménage ponctuel du logement) : l'occasion et le niveau réunis en 5 cartes (Ménage classique, Avant de recevoir, Retour de vacances, Grand ménage de printemps, Avant une vente ou une location) avec emoji, badge, prix total, écart de prix et tâches ajoutées. Mobile : cartes compactes.
- **Occasion** : changer d'occasion REMPLACE le niveau (tâches de pack) au lieu de l'ajouter ; les options personnelles restent (`tachesPourOccasion`, site et appli, testé des deux côtés). Autres prestations : pastilles avec le niveau (Confort, Premium).
- Badge « Conseillée » au lieu de « La plus choisie », écart de prix sur les niveaux, « 2 Cleaneurs × durée ».
- Passages multiples : jamais de doublon ni de passage manquant annoncé comme envoyé.
- Accès autonome et boîte à clés possibles pour bureaux, commerces, parties communes et vitrines.
- Déménagement et fin de chantier : « Photos plus tard » (le Cleaneur les prend à son arrivée).
- Urgence « Sous 24 h » retirée.

## Paiement à la réservation, argent bloqué jusqu'à la validation
- Règle : le client paie en envoyant sa demande (page Stripe, débit immédiat) ; le montant reste bloqué par Cleaneroo et n'est libéré pour le versement au Cleaneur qu'après la validation (ou la validation automatique à 48 h) ; demande annulée = remboursée ; demande non payée = invisible pour les Cleaneurs, rappel après 1 h, annulée sans frais après 24 h (pré-réservations : 48 h après l'ouverture).
- Entretien régulier : 1er passage payé à l'envoi, les suivants prélevés automatiquement 3 jours avant (carte enregistrée) ; refus = le client paie depuis son suivi, sinon annulation 24 h avant.
- Supplément accepté sur place et pourboire : prélevés à la validation sur la carte enregistrée.
- Fichiers : `outils/base-paiement-reservation.sql` (base), `supabase/functions/paiement/index.ts` (serveur), `assets/js/paiement.js`, `reserver.js` ; appli : `Paiement.kt`, `Reservation.kt`, `Compte.kt`. Textes (vitrine, garanties, conditions, assistant) mis à jour dans les 4 langues : à faire relire par l'avocat.

## Mise en ligne : dans cet ordre
1. Appliquer `outils/base-paiement-reservation.sql` dans Supabase (SQL Editor). Le site et l'appli envoient la nouvelle colonne `groupe_paiement` : sans ce script, l'envoi d'une demande échoue.
2. Redéployer la fonction `paiement` (supabase/functions/paiement/index.ts), sans vérification JWT (comme avant).
3. Pousser le site (VERSION 2026112204 déjà générée), puis construire et tester l'appli (`lancer-tests-claude.bat`).

## Pilote automatique prépayé, validation par l'IA, versements Stripe Connect (22 novembre 2026, fin d'après-midi)
- Ménages du pilote automatique : prépayés comme les autres (carte du dernier ménage payé du client, prélevée 3 jours avant ; sans carte, rappel puis annulation sans frais à 24 h).
- Validation par l'IA : case « Validation par l'IA » dans le pilote de chaque logement. Toutes les pièces conformes et aucun litige : validée dès la fin, le Cleaneur est payé ; sinon validation du client ou automatique à 48 h.
- Stripe Connect : « Mes versements » dans « Mon activité » (site et appli) : identité et IBAN saisis chez Stripe ; à la validation, la part du Cleaneur (prestation − commission + pourboire + prime d'urgence) est transférée, virement chaque vendredi. Sans compte actif : en attente, versé dès l'activation.
- Fichiers : `outils/base-pilote-connect.sql`, `supabase/functions/paiement/index.ts`, `assets/js/activite.js`, `espaces.js` ; appli : `Activite.kt`, `Badge.kt`, `Compte.kt`.

## Mise en ligne de cette partie
1. Stripe (tableau de bord, mode test puis réel) : activer Connect (profil de plateforme, comptes Express, France).
2. Supabase : appliquer `outils/base-pilote-connect.sql`, puis redéployer la fonction `paiement` (sans vérification JWT).
3. Pousser le site et l'appli depuis le PC (git push), construire l'appli.

## Litiges et moins-values dans les versements (22 novembre 2026, soir)
- Le Cleaneur est versé 48 h après la fin (délai de réclamation du client), jamais avec un litige ouvert ; virement le vendredi.
- Litige décidé « Remboursement de X € » : client remboursé sur sa carte automatiquement ; versement du Cleaneur réduit au prorata (il perd sa part, Cleaneroo rend sa commission sur X).
- Déjà versé (cas exceptionnel) : part reprise sur le compte Stripe du Cleaneur, sinon moins-value « litige ».
- Chaque versement retient les moins-values en cours (pénalités, litiges), au plus 50 % du versement.
- Fichiers : `outils/base-litiges-versements.sql`, fonction `paiement` (action « litige »), `activite.js`, `missions.js`, `Activite.kt`, `EspacesCompte.kt`.
- À faire relire par l'expert-comptable : partage de la commission en cas de remboursement.

## Inscription Cleaneur et refonte de l'espace Cleaneur (22 novembre 2026, soir — retour de Vincent)
- Mode Cleaneur › « Créer un compte » : plus les statuts client. Deux formulaires : **Cleaneur indépendant** (civilité, prénom, nom, téléphone, e-mail)
  et **Société de nettoyage** (raison sociale, SIRET/SIREN, civilité, prénom, nom, qualité dans la société, téléphone, e-mail, engagement de formation).
  Bouton « Valider ma pré-inscription », puis arrivée sur « Profil › Mon dossier » pour envoyer les documents.
- Espace Cleaneur en 4 onglets (une question chacun) : **Aujourd'hui** (prochaine action, alertes seulement si besoin, disponible pour une urgence) ·
  **Missions** (Disponibles · À venir avec Ma journée · Terminées = **comptes rendus** : durée réelle, pièces, photos avant/après, signature,
  validation, avis, montant et versement, bon PDF) · **Gains** (versement, niveau, avis, activité, factures, formule) · **Profil** (dossier,
  profil, disponibilités, formations, aide). Appli : mêmes onglets dans la barre du bas (+ Messages).
- Base : `outils/base-inscription-cleaneur.sql` (appliqué) : `profils.civilite`, `profils.qualite`, `nouveau_profil` (téléphone, société Cleaneur),
  fonction `mes_comptes_rendus`.
- Fichiers : site `compte.js`, `donnees.js`, `missions.js`, `sous-onglets.js`, `langue.js`, `style.css` ; appli `EcranCompte.kt`, `Compte.kt`,
  `EspacesCompte.kt`, `EspaceCleaneurReel.kt`, `SousOnglets.kt`, `App.kt`, `ComptesRendus.kt` (nouveau), `Traductions21.kt`.

## Plan de démarchage clients, partie 5 (22 novembre 2026, nuit)
- Gestion › **Zones et partenaires** (`gestion-zones.js`) : zones (ville, rayon ~20 km), état calculé (En attente · Ouverte · Prioritaire · En pause)
  avec Cleaneurs validés/actifs, couverture logement et location saisonnière, « Être prévenu », partenaires signés, demandes sans Cleaneur ;
  pause à la main ; **Prévenir les inscrits** (notification aux comptes + liste avec liens WhatsApp / e-mail prêts) ; partenaires (codes, comptes,
  clients actifs) ; origine des clients par canal.
- **Codes partenaires et canal** : lien `cleaneroo.fr/?code=CODE` ou code saisi dans « Code de parrainage » ; `?utm_source=` = canal.
- **Inviter mon client** (Cleaneur, onglet Gains, site et appli) : lien `?client=CODE`, partage WhatsApp/SMS, liste des clients apportés.
  Commission : **0 % pendant 12 mois** sur leurs prestations avec ce Cleaneur, puis la moitié (le client paie toujours ses frais de service).
- **Pages ville** : `generer_pages.py` ajoute une page pour chaque zone ouverte qui n'est pas encore dans `villes.js` (texte général à personnaliser).
- **WhatsApp support** : 06 26 87 65 18 (Michael, téléphone de Vincent lié) ; bouton dans l'assistant d'aide et dans Profil (Cleaneur).
- Base : `outils/base-demarchage.sql` (à appliquer).
