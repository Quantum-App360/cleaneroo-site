# Modifications du 24 novembre 2026

Prompt « Conciergeries » de Michael (outils/PROMPTS_EN_COURS.md, prompt 1), décision « plus de date de lancement », demande de Vincent
(Ma société · Activité). Ni prix des prestations, ni commissions des Cleaneurs, ni tranches d'abonnement modifiés. 442 tests sur 442.

## Fait

### Ma société · Activité (demande de Vincent du 23/11)
- assets/js/activite-societe.js (nouveau) : calculs par période (jour, semaine lundi → dimanche, mois, année), heure de Paris, testés.
- assets/js/societe.js : résumé en tête de « Activité » (4 chiffres, par salarié, jour par jour), sélecteur et flèches.
- outils/base-activite-societe.sql : fonction activite_societe (lecture seule) — **pas encore appliquée** (sans elle : 45 derniers jours).

### 1. Offre « Conciergerie fondatrice » (remplace « 1er mois offert »)
- assets/js/regles.js : OFFRE_CONCIERGERIE_* (seule source de vérité), etatOffreConciergerie, « Plusieurs utilisateurs » retiré des grands comptes.
- assets/js/abonnement-pro.js : encart selon l'état (avant, en cours, fin), compteur des Cleaneurs, « Inviter mes Cleaneurs »,
  choix de fin d'offre (continuer / ne pas continuer), aucun prélèvement sans accord.
- assets/js/compte.js, entete.js : état de l'offre lu en base, 0 % de frais pendant l'offre.
- assets/js/vitrine-espaces.js, app.js : offre sur la page Espace Conciergerie et l'accueil. legal.js : conditions.
- assets/js/espaces.js : zones sans Cleaneur (message sur la fiche du logement, liste d'attente du secteur, jamais de date).
- Base (appliqué) : outils/base-offre-conciergerie.sql (colonnes, démarrage à la 1re intervention validée, rappels 30 / 7 jours, tâche
  quotidienne 8 h 17). Fonction « paiement » v8 : 0 % de frais de service pendant l'offre.

### 2. Emojis
- conciergerie.js, espaces.js, equipe.js, import-biens.js : icônes de icones.js ; 7 icônes ajoutées (stock, outil, alerte, horloge,
  valise, ajouter, importer) ; pastilles de risque en couleur. langue.js : traductions associées.

### 3. Équipe
- Déjà ouverte à toutes les tranches (site et base) ; « Plusieurs utilisateurs » retiré des grands comptes (regles.js).

### 4. Fonctions de l'app iPhone
- 4.1 « Programmer tout » (conciergerie.js, espaces.js) : départs sans ménage des 14 jours, prix de chaque logement, total avant
  confirmation, un ménage par départ, 1er payé par Stripe et suivants prélevés 3 jours avant (groupe de paiement).
- 4.2 Horaires par séjour (espaces.js, conciergerie.js, reserver.js) : départ tardif 6-14 h, arrivée anticipée 12-22 h, voyageurs,
  séjour saisi à la main ; ménage décalé et Cleaneur prévenu (base : decaler_menage, appliqué et testé) ; risque recalculé.
- 4.3 Relevé mensuel par propriétaire (conciergerie.js, pdf.js, equipe.js) : PDF aux couleurs de Cleaneroo, partage au propriétaire
  invité (base : releves_proprietaires, appliqué et testé), coût et charge des incidents.
- 4.4 Liste de courses (conciergerie.js, espaces.js) : articles sous le seuil par logement, « Racheté » remet le stock à jour, partage.
- 4.5 Dommages voyageurs (conciergerie.js, pdf.js, regles.js) : dossier par séjour, délai de 14 jours, alertes 5 et 2 jours, PDF avec photos.

### Plus de date de lancement (décision de Michael, 24/11)
- regles.js, donnees.js, commun.js, app.js, reserver.js, compte.js, missions.js, propositions.js, paiement.js, legal.js, gestion.js,
  conciergerie.js, estimation.js, agenda-particulier.js, langue.js, generer_pages.py : plus aucune date du 31/12/2026 ni du 1/1/2027 ;
  interrupteur « Réservations ouvertes » (gestion › Ouverture des réservations), fermé tant que SAS (raison sociale, SIRET, adresse)
  et Stripe réel ne sont pas prêts. Base (appliqué) : outils/base-ouverture-reservations.sql ; fonction « paiement » v8.

## Reste à faire
- Mettre en ligne le site (accès en écriture au dépôt, ou correctifs appliqués par Vincent).
- Audit de sécurité (partie 5) : corrections prêtes (outils/base-securite-audit-2411.sql, supabase/functions/agenda-ical), à appliquer
  après accord explicite. Protection des mots de passe divulgués : à activer dans Supabase (Authentication › Policies).
- outils/base-activite-societe.sql à appliquer (vues Mois et Année de « Ma société »).
- E-mail des rappels de fin d'offre (aujourd'hui : notification).
- Android et iPhone : retirer « 1er mois offert » et la date de lancement, ajouter l'offre et les fonctions (Vincent).
- Pour ouvrir les réservations : SIRET, adresse du siège, Stripe en mode réel, puis « Ouvrir les réservations » dans la gestion.
