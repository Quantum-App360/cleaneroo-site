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
