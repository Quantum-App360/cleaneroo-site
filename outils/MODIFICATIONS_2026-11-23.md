# Modifications du 23 novembre 2026

## À faire (validé par Michael le 23/11, 10:23) — Inscription : un espace = un parcours (retour vidéo de Vincent)
Site (compte.js, ecranConnexion) et appli (EcranCompte.kt) :
1. Arrivée par un onglet (Particulier, Entreprise, Conciergerie, Hôtels) : plus de liste « Vous êtes : », formulaire de cet espace
   directement (titre « Création de votre espace … », bouton « Créer mon espace … »).
2. Lien discret « Ce n'est pas votre cas ? Changer d'espace » qui ramène au choix (point 3).
3. « Créer un compte » sans onglet : une seule question « Vous êtes : », cinq grandes cartes à choix unique (plus de cases multiples).
4. « Cleaneur » n'est jamais une case d'un formulaire client : il bascule vers la pré-inscription Cleaneur
   (indépendant / société, civilité, téléphone, qualité) — plus aucun compte Cleaneur incomplet.
5. Ajouter un deuxième espace : une fois connecté, « Ajouter un espace » (inchangé).
Partie Cleaneur : demande complémentaire de Vincent à venir (vidéos).

## Fait le 24/11 — « Ma société » · Activité : résumé par période (demande de Vincent du 23/11)
- assets/js/activite-societe.js (nouveau, calculs testés dans tests.html) et assets/js/societe.js (rubrique « Activité » seulement).
- Sélecteur Jour · Semaine (lundi → dimanche, par défaut) · Mois · Année, flèches Précédent / Suivant, bouton Aujourd'hui.
- Date retenue : jour de l'intervention (creneau) en heure de Paris. CA : missions TERMINEE ; A_VALIDER affichées à part.
- Par salarié : montant partagé à parts égales entre chef d'équipe et équipiers, durée prévue comptée pour chacun ;
  sans chef d'équipe → « Moi (gérant) ». Net : commission facturée si la facture existe, sinon taux de la formule.
- Base : outils/base-activite-societe.sql (fonction en lecture seule activite_societe) À APPLIQUER dans Supabase.
  Sans elle, le site retombe sur missions_societe (45 derniers jours) et l'indique.
- Prix, commissions et autres rubriques : inchangés.
