# Prompts du site à traiter dans l'ordre (24/11/2026)

Un prompt à la fois, une partie à la fois, point avec Michael à la fin de chaque partie.

## Prompt 1 — Conciergeries (en cours : partie 1 faite, partie 2 suivante)

Ne touche pas aux prix des prestations, aux commissions des Cleaneurs, aux tranches d'abonnement (29 / 69 / 149 € HT, 149 € + 2,50 € par logement de 41 à 100, grands comptes) ni aux autres rubriques. Pas d'emoji dans l'interface : uniquement les icônes de icones.js.

1. OFFRE « CONCIERGERIE FONDATRICE » (remplace « 1er mois offert »)

Supprime partout la mention « 1er mois offert » (bloc « Mon abonnement », page Espace Conciergerie, page d'accueil, conditions d'utilisation, Android) et remplace-la par cette offre. Règles dans regles.js (une seule source de vérité) :
- OFFRE_CONCIERGERIE_FIN_INSCRIPTION : 31 janvier 2027 à 23 h 59, heure de Paris. Sans limite de nombre.
- OFFRE_CONCIERGERIE_MOIS : 3. Les 3 mois démarrent à la PREMIÈRE INTERVENTION TERMINÉE ET VALIDÉE dans un logement de la conciergerie, pas à l'inscription. Une conciergerie inscrite avant la date limite garde l'offre même si sa première intervention a lieu après.
- Pendant la période offerte : abonnement de la tranche correspondant au nombre de logements, gratuit, et 0 % de frais de service.
- OFFRE_CONCIERGERIE_BONUS_MOIS : 1 mois de plus si la conciergerie a invité au moins 3 Cleaneurs (OFFRE_CONCIERGERIE_BONUS_CLEANEURS) dont le dossier est validé et qui ont réalisé au moins une intervention. Ajouté à la fin de la période, une seule fois.
- Prix garanti 12 mois après la fin de la période offerte.
- Fin de période : rappels 30 jours et 7 jours avant (e-mail et notification), puis choix « Continuer avec l'abonnement (tranche X, Y € HT par mois) » ou « Ne pas continuer » (sans abonnement : 8 % de frais de service). AUCUN PRÉLÈVEMENT SANS ACCORD EXPLICITE. Sans réponse : sans abonnement (8 %).

Affichage :
- Espace Conciergerie et « Mon abonnement » : « Offre Conciergerie fondatrice : 3 mois offerts dès votre première intervention, 0 % de frais de service. Inscription jusqu'au 31 janvier 2027. » et « +1 mois si 3 de vos Cleaneurs nous rejoignent ».
- Période démarrée : « Offre en cours : il vous reste N jours (jusqu'au JJ mois AAAA) », compteur « 2 sur 3 Cleaneurs pour le mois offert », bouton « Inviter mes Cleaneurs » (invitation existante).
- Avant la première intervention : « Vos 3 mois offerts démarreront à votre première intervention terminée. »
- Nouvelles inscriptions après le 31 janvier 2027 : l'offre disparaît, grille normale.

Zones sans Cleaneur : si aucun Cleaneur qualifié ne couvre l'adresse d'un logement (secteur_couvert), afficher sur la fiche du logement : « Pas encore de Cleaneur dans ce secteur : vous êtes en liste prioritaire, nous vous prévenons dès l'ouverture. Vous pouvez aussi inviter vos propres Cleaneurs. » et inscrire la conciergerie sur la liste d'attente du secteur (rejoindre_attente). Ne jamais promettre de date.

2. EMOJIS À RETIRER
Remplace les emojis de l'interface par les icônes de icones.js (ou supprime-les) dans conciergerie.js (13), espaces.js (8), equipe.js (2) et import-biens.js (1), par exemple le bouton « Essayer avec un calendrier de démonstration ». Vérifie aussi langue.js.

3. ÉQUIPE : INCOHÉRENCE
L'invitation d'un gestionnaire, d'un assistant ou d'un propriétaire (equipe.js) est ouverte à toutes les conciergeries, mais « Plusieurs utilisateurs » figure seulement dans les avantages des grands comptes (ABONNEMENTS_PRO). Garde l'équipe ouverte à toutes les tranches et retire « Plusieurs utilisateurs » des avantages des grands comptes.

4. FONCTIONS DE L'APP IPHONE ABSENTES DU SITE
4.1 « Programmer tout » : sur « Aujourd'hui » et la liste des ménages, programme tous les départs sans ménage des 14 prochains jours, au prix de chaque logement, total affiché avant confirmation. Un seul ménage par départ.
4.2 Horaires par séjour : départ tardif (6 à 14 h) et arrivée anticipée (12 à 22 h) réglés séjour par séjour, nombre de voyageurs. Le ménage déjà programmé est décalé, le Cleaneur prévenu, le niveau de risque recalculé. Séjour saisi à la main pour un logement sans calendrier.
4.3 Relevé mensuel par propriétaire (PDF) : ses logements, nuits occupées, ménages et leur coût, incidents à sa charge, total à refacturer. Téléchargeable par la conciergerie, visible par le propriétaire invité (vue_proprietaire), jamais les codes d'accès.
4.4 Liste de courses : articles sous le seuil, par logement, case « Racheté » qui remet le stock à jour, partage par lien ou copie.
4.5 Dommages voyageurs : les dommages constatés par le Cleaneur à son arrivée (photos horodatées de constat_arrivee) forment un dossier par séjour ; rappel « demande à déposer avant le … » (14 jours après le départ sur Airbnb), alerte à 5 jours, urgente à 2 jours ; export PDF.

5. VÉRIFICATION DE SÉCURITÉ (avant d'ouvrir à de vraies conciergeries)
Liste les règles d'accès (row level security) des tables biens, demandes, messages, factures, invitations_pro, signalements_arrivee, avis et des fonctions de l'équipe, puis confirme par écrit que :
- une conciergerie ne voit que ses propres logements, ménages, factures et rapports ;
- un membre invité ne voit que ce que son rôle permet ; un propriétaire seulement ses logements, jamais les codes d'accès ni les autres propriétaires ;
- un Cleaneur ne voit l'adresse exacte et le guide d'accès qu'une fois confirmé sur la mission, et plus après la fin de l'intervention ;
- la fonction agenda-ical n'accepte que des liens de calendrier (pas d'adresse interne ni de fichier local).
Donne la liste des tables ou fonctions qui ne respectent pas ces règles, SANS LES MODIFIER avant mon accord.

6. À LA FIN
Résume ce qui a été modifié, fichier par fichier, et ce qui reste à faire.

## Prompt 2 — Confiance, paiement sécurisé, rappel, véhicules, « Qui sommes-nous » (TERMINÉ le 24/11 ; Comment ça marche refait ; emojis retirés)

# PROMPT — Site cleaneroo.fr : confiance, paiement sécurisé, rappel, véhicules, « Qui sommes-nous »

_23 novembre 2026 · établi à partir d'un retour utilisateur et du code en ligne (dépôt `cleaneroo-site`, version du 23 novembre, 13 h 40). À coller tel quel dans l'outil de développement du site._

## 0. Règles pour tout ce prompt

- **Ne touche à aucun prix ni à aucun calcul** (`estimation.js`, `regles.js`, fonctions serveur), sauf ce qui est écrit en partie 7. Le contrôle final le vérifie.
- **Chaque promesse doit être vraie aujourd'hui.** N'écris rien que le site ne fait pas encore (par exemple « remboursé à 100 % », « numéro 1 », « moins cher que… »). Les phrases à utiliser sont données ci-dessous : reprends-les mot pour mot.
- Tout nouveau texte va dans `langue.js`, en français, anglais, italien et espagnol.
- Aucun emoji : uniquement les icônes de `icones.js`. Crée les icônes manquantes dans le même style (`cadenas`, `bouclier-coche`, `carte-bancaire`, `appareil-photo`, `equipe`).
- Ne change pas le parcours de réservation, sauf ce que les parties 3, 6 et 7 demandent.

## 1. Bouton « Être rappelé » : bien plus visible

Constat : sur un écran de 1 024 px de large, le bouton de l'en-tête n'apparaît pas du tout. Entre 861 et 1 240 px, seule l'icône du téléphone s'affiche, sans texte. Sur téléphone, il n'existe que la barre du bas.

- **En-tête, à toutes les largeurs au-dessus de 860 px** : l'icône du téléphone **suivie du texte « Être rappelé »**, toujours affiché. Bouton plein, dégradé corail (`var(--degrade-corail)`), texte blanc, hauteur 40 px. Supprime la règle qui masque le texte entre 861 et 1 240 px. Si la place manque, raccourcis d'abord le reste de l'en-tête, jamais ce bouton.
- **Téléphone (860 px et moins)** : garde la barre fixe du bas. Ajoute aussi l'icône du téléphone dans l'en-tête, à gauche du sélecteur de langue ; elle ouvre la même fenêtre.
- **Accueil, sous le bouton « Commencer »** : un lien bien visible « Une question ? Être rappelé gratuitement », qui ouvre la même fenêtre.
- **Page Prestations et étape 5 de la réservation** : un encart « Besoin d'aide pour choisir ? Un conseiller vous rappelle au créneau de votre choix. » avec le bouton « Être rappelé ».
- La fenêtre reste celle qui existe (prénom, téléphone, profil, créneau, accord). Ajoute seulement sous le titre : « Gratuit, sans engagement. Votre numéro ne sert qu'à vous rappeler. »

## 2. Titre et vocabulaire de confiance

- Titre de l'accueil : **« Le ménage, 100 % digitalisé et sécurisé. »** (avec « 100 % digitalisé et sécurisé » dans la couleur d'accent actuelle). Mets à jour le titre de la page et l'aperçu de partage : « Cleaneroo · Le ménage 100 % digitalisé et sécurisé ».
- Sous le formulaire de l'accueil, remplace les trois repères actuels par quatre repères, chacun avec son icône :
  - « Paiement 100 % sécurisé »
  - « Cleaneurs vérifiés et assurés »
  - « Compte rendu photo avant / après »
  - « Données protégées »
- **Mots à employer partout** dans les titres et les encarts : *sécurisé, protégé, vérifié, assuré, garanti, en toute confiance, transparent*. Remplace les tournures neutres quand c'est naturel (par exemple « Paiement protégé » devient « Paiement 100 % sécurisé »).
- **Nouvelle bande « Vos garanties Cleaneroo »** sur l'accueil, juste après « Comment ça marche ? », avec 5 cartes :
  1. **Paiement 100 % sécurisé** — « Paiement géré par Stripe, leader mondial du paiement en ligne. Votre numéro de carte n'est jamais vu ni conservé par Cleaneroo. Authentification 3-D Secure par votre banque. »
  2. **Cleaneurs vérifiés et assurés** — « Identité, SIRET, attestation URSSAF et assurance responsabilité civile professionnelle contrôlés avant toute mission, puis une mission test. »
  3. **Garantie remplacement** — reprends le texte actuel.
  4. **Preuves photo horodatées** — « Avant et après chaque intervention : un dossier clair en cas de question ou de litige. »
  5. **Données protégées** — « Vos données sont hébergées à Paris et ne sont jamais revendues. » Ajoute un lien vers la page Confidentialité.

## 3. Paiement : dire la vérité, rassurer, ne plus effrayer

Constat : l'accueil dit encore « Vous ne payez qu'une fois le travail validé », « Payé après validation », « 0 € avant validation » et « Seulement après votre validation ». Or le paiement est demandé à la réservation (fonction `paiement` : `mode: "payment"`). Ces phrases sont fausses, et elles surprennent le client au moment où il doit sortir sa carte.

- **Supprime ces quatre formulations partout** : accueil, chiffres clés, tableau « À l'ancienne / Avec Cleaneroo », description de la page, aperçu de partage, pages par ville, `langue.js`.
- **Formulation unique à utiliser** :
  - courte : **« Paiement sécurisé à la réservation, versé au Cleaneur après votre validation »** ;
  - longue : **« Vous réglez en réservant, par paiement sécurisé Stripe. Votre argent est conservé en sécurité et n'est versé au Cleaneur qu'à la fin de l'intervention, une fois que vous l'avez validée. »**
- Chiffres clés de l'accueil : remplace « 0 € avant validation » par **« 100 % — paiement sécurisé »**.
- Tableau comparatif, ligne Paiement : « À l'avance ou en espèces, sans recours » contre **« Sécurisé par Stripe, versé au Cleaneur après votre validation »**.
- **Étape 5 de la réservation**, juste au-dessus du bouton de paiement, un encart avec un cadenas :
  - « Paiement 100 % sécurisé par Stripe ».
  - « Vos coordonnées bancaires sont chiffrées et ne sont jamais conservées par Cleaneroo. »
  - « Le Cleaneur n'est payé qu'après votre validation. »
  - La règle d'annulation, générée depuis `REGLES.ANNULATION_GRATUITE_H` et `ANNULATION_TARDIVE_PCT` (aujourd'hui : « Annulation gratuite jusqu'à 48 h avant, puis 25 % du prix »). Elle doit être identique au texte des conditions générales ; si les deux diffèrent, signale-le au lieu de choisir.
- **Moyens de paiement affichés** (étape 5, pied de page, bande « Vos garanties ») : logos officiels Visa, Mastercard, CB et « Paiement sécurisé par Stripe », plus Apple Pay et Google Pay **seulement si la constante `PORTEFEUILLES_ACTIFS` vaut `true`** (à créer dans `regles.js`, à `false` par défaut). Utilise les fichiers officiels fournis par chaque marque, sans les redessiner ni les modifier.
- **Apple Pay et Google Pay** : la session Stripe Checkout ne restreint pas les moyens de paiement (pas de `payment_method_types`), donc il n'y a rien à coder. Vérifie seulement que cela reste vrai, et indique dans ta réponse qu'il faut les activer dans le tableau de bord Stripe (Réglages → Moyens de paiement).

## 4. Avis clients (affichés quand ils existeront)

- Le site n'a pas encore de vrais avis. **Retire de l'accueil la fausse notification « Nouvel avis ★★★★★ « Impeccable, merci Louise ! » »**, dans l'illustration du téléphone et dans les notifications de démonstration (les 4 langues). Remplace-la par « Compte rendu reçu — 12 photos avant / après ».
- Crée une section **« Ils nous font confiance »** sur l'accueil et la page Prestations. Elle reste **masquée tant qu'il n'y a pas au moins 3 avis publiés**, puis elle s'affiche toute seule.
- Données : une vue en lecture publique qui ne renvoie que les avis publiés (après la période en double aveugle), avec la note globale, le commentaire, le prénom suivi de l'initiale du nom, la ville, la prestation et le mois. Jamais d'adresse, de nom complet ni de référence de demande.
- Affichage : la note moyenne et le nombre d'avis en tête (« 4,8 / 5 · 27 avis vérifiés »), puis jusqu'à 6 avis, les plus récents d'abord. Chaque avis porte la mention « Avis vérifié · prestation réalisée via Cleaneroo ».
- Ajoute la page « Comment nous gérons les avis » (obligation légale pour les avis en ligne). Elle explique que seuls les clients ayant eu une prestation peuvent noter, que les avis sont publiés sans tri, et comment signaler un avis.

## 5. Des prix au juste prix du marché, selon le secteur

- Sur l'accueil et la page Prestations, ajoute un bloc **« Le juste prix, près de chez vous »** :
  - « Nos tarifs sont établis à partir des prix pratiqués par les professionnels du nettoyage dans votre secteur. »
  - « Le prix tient compte de votre code postal, de la prestation et de la surface : vous voyez le montant exact avant de réserver, sans devis ni négociation. »
  - « Pas de frais cachés : déplacement inclus jusqu'à 15 km, frais de service indiqués avant le paiement. »
- **Étape 5 de la réservation**, sous le total : la mention « Prix calculé pour le code postal {cp} ». N'affiche jamais le nom de la zone ni le pourcentage.
- N'emploie jamais « le moins cher » ni « moins cher que » : rien ne permet aujourd'hui de le prouver.

## 6. Photos avant / après : les mettre en avant

- **Accueil** : un bloc **« Avant / après : la preuve en images »** avec un curseur à faire glisser entre deux photos. Prévois 3 exemples (salle de bain, canapé, voiture) dans `assets/img/avant-apres/`. En attendant les vraies photos de Cleaneroo, mets des images neutres avec la mention « Exemple ». **N'utilise pas de photos prises sur Internet.**
- Texte sous le curseur : « Chaque pièce est photographiée avant et après l'intervention. Les photos sont horodatées et rangées dans votre espace avec le compte rendu signé. »
- **Photos avant dans toutes les rubriques** (aujourd'hui, seule la location saisonnière les exige : `PHOTOS_AVANT_PAR_DEFAUT: ["rental"]`). Étends la règle à toutes les rubriques sauf « Prestations spécialisées », avec au moins une photo avant et une photo après par pièce ou par zone contrôlée. Mets à jour la liste de contrôle du Cleaneur en conséquence.

## 7. Véhicules : une formule Standard claire

Constat : la rubrique est « 100 % à la carte », avec 20 tâches à cocher. Le client ne sait pas ce qu'il achète.

- En tête de l'étape 2 Véhicules, affiche trois choix sous forme de cartes, **Standard présélectionnée** :
  - **Standard** (le pack actuel « Confort », remise −10 % inchangée). Badge « Le plus choisi ».
  - **Premium** (le pack actuel « Premium », −15 % inchangé).
  - **Sur mesure** : la liste actuelle de tâches à cocher.
  Renomme le pack `confort` en « Standard » pour la rubrique `car` seulement, dans les 4 langues.
- Sur la carte Standard, en clair :
  - **Compris** : aspiration complète (sièges, tapis, coffre) · dépoussiérage des plastiques et du tableau de bord · vitres intérieures et extérieures · coffre · lavage extérieur sans eau, à la main · jantes et pneus, avec brillant des pneus.
  - **Non compris** : shampoing des sièges, cuir, polissage, compartiment moteur (en option).
  - « Durée indicative : environ 2 h 30 pour une citadine. » Utilise la durée calculée par le catalogue, pas une valeur écrite en dur.
  - « Lavage sans eau, à domicile ou sur votre lieu de travail. Photos des 4 côtés avant l'intervention. »
- Les options (tâches hors formule) restent disponibles sous « Ajouter une option ».
- Pastille de la rubrique (page Prestations et accueil) : **« Formule Standard dès {prix} »**, avec le prix calculé pour une citadine.

## 8. Nouvelle page « Qui sommes-nous ? »

- Route `#/qui-sommes-nous`. Lien dans le menu principal, dans le pied de page et dans le menu des téléphones.
- Contenu (les passages entre crochets sont à faire valider par Vincent avant la mise en ligne ; ne les publie pas tels quels) :
  - **Titre** : « Cleaneroo, une entreprise de terrain avant d'être une application ».
  - **Notre histoire** : « Cleaneroo est née dans le Sud-Est, de [plus de six ans] d'expérience dans la gestion d'équipes d'intervention sur le terrain. Nous savons ce qu'un client attend : quelqu'un de fiable, à l'heure, et la preuve que le travail est fait. Nous avons construit Cleaneroo pour l'offrir au ménage. »
  - **Le fondateur** : [photo], « [Vincent Rhode], fondateur. [Dirigeant de SCOFITEC, entreprise de télécommunications et d'énergie en région PACA et en Corse.] »
  - **Nos engagements** : reprends les 5 cartes de la partie 2.
  - **Où nous intervenons** : « Lancement le 31 décembre 2026 [dans le Var et les Alpes-Maritimes], puis dans toute la France au fil des inscriptions des Cleaneurs. »
  - **Nous contacter** : bouton « Être rappelé », adresse e-mail de contact et lien vers les mentions légales.
  - Encadré « Société » : raison sociale, adresse et SIRET, lus depuis `REGLES.SOCIETE`. **Si ces champs sont vides, l'encadré ne s'affiche pas** (ils sont aujourd'hui vides : voir l'audit P0-01).

## 9. Contrôles avant de rendre la main

- Recherche dans tous les fichiers (`.js`, `.html`, pages par ville, `langue.js`) : **plus aucune occurrence** de « qu'une fois le travail validé », « Payé après validation », « 0 € avant validation », « Seulement après votre validation », ni de leurs traductions.
- Le bouton « Être rappelé » est visible, avec son texte, à 1 440, 1 280, 1 024 et 900 px. À 375 px, la barre du bas et l'icône de l'en-tête sont présentes. Le bouton n'apparaît pas pendant la réservation.
- La section « Ils nous font confiance » est masquée sans avis ; avec 3 avis de test publiés, elle s'affiche avec la note moyenne.
- **Prix inchangés** :
  - Logement 60 m², ménage ponctuel, pack Essentiel, code postal 83600, mardi 10 h : même total qu'avant la modification.
  - Véhicule citadine avec la formule Standard, 83600 : **94,00 €** pour la prestation (hors frais de service), identique à l'ancien pack Confort.
- Les 4 langues affichent les nouveaux textes, sans aucun texte français resté en dur.
- Liste dans ta réponse :
  - les fichiers modifiés ;
  - les textes à faire valider par Vincent (partie 8) ;
  - ce qu'il reste à faire dans le tableau de bord Stripe (Apple Pay, Google Pay).
## Ajout de Michael (24/11, 14 h 30) — à traiter avec le prompt 2
« Comment ça marche » est à reprendre entièrement : accueil (5 étapes), page #/comment-ca-marche (Côté Cleaneur, Vos garanties,
affiche assets/img/affiche.jpg), étapes courtes des pages ville. Textes actuels faux : « Débit seulement après validation »,
« Validez, le Cleaneur est payé » (le paiement a lieu à la réservation). Un parcours par profil.

## Prompt 3 — Vocabulaire et formulations (TERMINÉ le 24/11 : 33 corrections validées par Michael, outils/vocabulaire_2411.py)
Analyse de tous les textes du site (langue.js, pages, écrans) : vocabulaire, formulations, phrases. Certaines sont trop familières :
relever les cas, proposer une version plus professionnelle, appliquer après validation, dans les 4 langues.

## Prompt iOS — Lot 44 (reçu le 24/11, 14 h 30) — pour l'app iPhone (Xcode, Mac de Vincent), pas pour le site
Écran de choix du profil client (et Cleaneur) plus vivant : en-tête en dégradé #0596C4 → #04BEE5 → #0DC88D, cartes avec filet coloré,
tuile en dégradé, étiquette colorée en 3e ligne, apparition en cascade, retour haptique, pastilles « Comment ça marche » reliées.
Texte complet transmis par Michael ; à exécuter par Vincent dans Xcode (build/bak44, build/lot44.diff, ARCHITECTURE.md).

## Prompt iOS — Lot 45 (reçu le 24/11, 14 h 31) — pour l'app iPhone (Mac de Vincent)
Lien « ‹ Accueil Cleaneroo » dans l'espace Cleaneur et les espaces client (fondu simple, 44 pt, VoiceOver) ; journée de démonstration
du Cleaneur crédible (2-3 missions sans chevauchement, 6 à 8 h, statuts cohérents, chiffres = somme) ; test automatique ; build/bak45,
build/lot45.diff, ARCHITECTURE.md.

## Prompt 4 — Refonte totale du produit (TERMINÉ le 25/11 : plan validé le 24/11 à 20 h 45, lots 1 à 9 faits)
Plan validé (Whiteboard « Refonte Cleaneroo — plan du prompt 4 ») : 1 design system · 2 carte signature (MapLibre + OpenFreeMap) ·
3 espace client · 4 réservation · 5 fiches Cleaneur · 6 espace Cleaneur · 7 notifications, messagerie, réputation · 8 finitions · 9 audit.
Décisions : réservation hybride (choisir un Cleaneur ou publier à tous, paiement à la réservation) ; Cleaneurs affichés par secteur
approximatif, jamais d'adresse ni de position exacte. Non-régression : outils/regression.py + outils/compare.py à chaque lot.
Lot 2 (25/11) : moteur MapLibre 5.24.1 hébergé (assets/vendor/maplibre), style Cleaneroo clair (client) et sombre (Cleaneur), relief 3D
sur la tournée, suivi en direct, carte.html (paramètre r = relief), repli Leaflet sans WebGL. Page #/carte « Cleaneroo près de chez vous »
(carte-client.js) : prestation + adresse → disponible (estimer) ou « Être prévenu ». Secteurs publics : fonction secteurs_publics
(outils/base-secteurs-publics.sql, grille ~5 km) appliquée en base le 25/11 avec l'accord de Michael.
Lot 3 (25/11) : accueil du compte « Que souhaitez-vous faire aujourd'hui ? » (recherche prestation + lieu parmi ses biens, disponibilité
locale en direct, raccourcis Près de chez moi / Mes prestations / Mes favoris / Mes biens / Suivre en direct) ; recherche #/recherche
(prestation, lieu, date, heure, fréquence ; résultats liste + carte, côte à côte sur grand écran, bascule sur téléphone ; « Réserver »
pré-remplit la réservation). Budget non proposé : pas de fourchette de prix inventée, le prix exact vient du calcul. La liste des Cleaneurs
eux-mêmes (fiches, disponibilités) arrive au lot 5 : il faudra une fonction publique (prénom + initiale, note, prestations, secteur arrondi).
Lot 4 (25/11) : récapitulatif toujours visible pendant la réservation (étapes 2 à 5) : prestation, durée, date et heure, lieu,
Cleaneur, disponibilité à l'adresse dès qu'elle est connue, total (même règle que l'étape 5), crédit d'impôt, paiement protégé.
Colonne à droite sur grand écran ; sur téléphone, ligne au-dessus des boutons qui ouvre une feuille. Ordre des 5 étapes inchangé
(mêmes étapes que les applis).
Lot 5 (25/11, accord de Michael pour la base) : base-cleaneur-choisi.sql appliquée. Exclusivité du Cleaneur demandé selon la date
(2 h < 48 h, 6 h < 7 jours, 12 h au-delà ; favori_jusqu fixé à la mise en ligne), libérée aussitôt par « Je ne suis pas disponible »
(Cleaneur) ou « Proposer à tous maintenant » (client) : liberer_favori ; favori_de_demande ; mes_demandes_personnelles.
Client : Cleaneur demandé possible depuis sa fiche même hors favoris. Fiches publiques : cleaneurs_publics (prénom + initiale, note,
avis, prestations réalisées, niveau, Pro, prestations, prochains jours ouverts, mois d'inscription, distance arrondie 5/10/20/30/50 km).
Site : « Ou choisissez votre Cleaneur » sous la prestation dans la recherche, fiche en fenêtre, « Réserver avec … », récapitulatif
« Louise M. (demandé) ». À REPORTER PAR VINCENT dans les applis : mêmes paliers d'exclusivité, bouton « Je ne suis pas disponible »
(liberer_favori), « Proposer à tous maintenant » côté client, fiches Cleaneur.
Lot 6 (25/11) fait : onglet « Aujourd'hui » du Cleaneur en Urgent (géolocalisation, avertissements, photo du jour, client qui
l'a demandé, conflits horaires sur 7 jours, dossier) · Aujourd'hui · À venir (3 prochaines) · Performance (missions, note, disponibles,
dossier) ; planning jour/semaine/mois avec heure de fin, adresse, durée et conflits (chevauchement, moins de 30 min entre deux villes) ;
revenus (aujourd'hui, semaine, mois, année, moyenne par mission, graphique 6 mois) ; disponibilités en tête du Profil ;
boutons d'accès « devant le logement » seulement le jour même ; guidage (guidage.js). Correction base : cleaneurs_publics lit
les créneaux par jour de la semaine (clés 1 à 7) et exclut les périodes fermées.
Idées Cleaneur validées le 25/11 (après le lot 6) : combler ma journée, indisponible en un geste, matériel à prévoir, missions en .ics,
objectif de niveau et notes par critère, relevé de chiffre d'affaires PDF, mode mission plein écran + contrôle sans réseau (file-attente.js),
proposer le prochain passage, bouton de sécurité, alertes ciblées : partie base dans outils/base-cleaneur-idees.sql (appliquée le 25/11 avec accord, alertes testées).
Contrat Cleaneur 2026-12-b (25/11) : paiement direct sur le compte Stripe du Cleaneur, commission prélevée, frais Stripe à sa charge.
À REPORTER PAR VINCENT : tout ce qui précède, et l'envoi de lat / lon avec chaque demande.
Lot 6 (accord du 25/11) : Waze par coordonnées GPS, un bouton par étape et dans chaque mission, appli de guidage au choix (Waze, Google Maps, Plans) : FAIT.
Signalé : itineraire() utilise le serveur de démonstration OSRM, pas fait pour la production.
Favoris (25/11, « oui applique ») : prochain passage seulement pour les prestations récurrentes (REGLES.RUBRIQUES_PASSAGE, contrôlé aussi en base) ;
pour les autres (location saisonnière comprise), « Inviter le client à me mettre en favori », une fois par client (invitations_favori,
inviter_favori, invitation_favori, mes_invitations_favori, déclencheur favoris_invitation qui prévient le Cleaneur) : outils/base-favori-invitation.sql,
appliqué et testé (transaction annulée). Côté client, « Ajouter à mes favoris » mis en avant avec le prénom du Cleaneur.
« Programmer tout » et le pilote automatique (pilote-auto v3, déployé) proposent d'abord le ménage au dernier Cleaneur du logement s'il est en favori.
À REPORTER PAR VINCENT : ces trois points dans les applis (même liste de prestations, mêmes fonctions).
Lot 7 (25/11, accord de Michael pour la base : outils/base-lot7.sql appliqué et testé) :
- Notifications : filtres (Toutes, Importantes, Prestations, Messages, Paiements, Avis), regroupement par jour, pastille de couleur par type,
  mentions « Urgent » / « Important », action proposée (Répondre, Voir la prestation), bandeau quand une notification importante arrive.
  Rappel la veille (tâche rappel-missions, 17 h UTC) au client et au Cleaneur. Icônes Messages et Notifications de l'en-tête rétablies
  (perdues au retrait des emojis). Plus d'emoji dans les textes de la base.
- Messagerie : en-tête de la prestation (infos_fil), séparateurs de jour, « Lu », messages rapides selon l'étape (envoyés en français,
  affichés dans la langue de chacun), « Traduire » sur un message reçu (traduction sur l'appareil si le navigateur le permet, sinon
  Google Traduction à la demande). Correctif : bulles en conflit avec les bulles décoratives du fond (classe renommée bulle-msg).
  Correctif de sécurité : la notification « Nouveau message » reprend le texte masqué.
- Réputation (reputation.js) : note, nombre d'avis vérifiés, répartition 5 → 1, satisfaction (4-5 étoiles), notes par critère, avis récents ;
  sur la fiche du Cleaneur (reputation_cleaneur) et dans son espace (« Votre réputation, telle que les clients la voient »).
  Correctif : la note des fiches ne compte que les avis publiés (double aveugle).
À REPORTER PAR VINCENT : infos_fil, reputation_cleaneur, messages rapides (mêmes textes), filtres des notifications, rappel la veille.
Lot 8 (25/11) finitions, sans changement en base :
- Audit automatique (outils/audit_accessibilite.py : axe-core WCAG A/AA + débordements, 21 pages × 390/1280 × clair/sombre) : 0 erreur.
  Corrigé : bouton « Être rappelé » sans nom sur téléphone, onglets actifs illisibles en sombre et en mode Cleaneur (contraste 1,7),
  textes gris trop pâles en sombre, carte de la tournée mal décrite, volets dépliables trop petits au doigt.
- États : page qui plante → message clair avec « Réessayer » (plus d'écran vide) ; retour de Stripe sans payer → « Le paiement n'a pas
  abouti, aucun débit » + « Réessayer le paiement » ; paiement réussi → « Paiement confirmé » ; demande annulée → « Refaire cette demande » ;
  la page de suivi se met à jour seule quand le statut change (message « Mise à jour : … »). Mes demandes robuste aux données absentes.
- Micro-interactions utiles seulement : étape en cours de la progression signalée, confirmation de paiement, message qui arrive dans la
  conversation, appui visible sur les puces et cartes ; tout est coupé si l'appareil demande moins d'animations.
À REPORTER PAR VINCENT : mêmes états (paiement non abouti, annulée, mise à jour du statut) dans les applis.
Lot 9 (25/11) audit :
- Sécurité : conseils Supabase relus. 60 fonctions ouvertes aux visiteurs : toutes voulues (suivi par jeton, fiches publiques, codes
  impossibles à deviner) ou fonctions de déclencheur ; tables sans règle d'accès = accès seulement par fonctions (voulu) ; aucune clé
  secrète dans le site (seulement la clé publique) ; échappement des textes vérifié. À faire par Michael dans Supabase (Authentication,
  réglages des mots de passe) : activer la protection contre les mots de passe compromis. Extension pg_net dans le schéma public : sans risque,
  laissée telle quelle (la déplacer casserait les tâches automatiques).
- Trou corrigé (base-lot9.sql, accord de Michael, testé) : à la fin de l'exclusivité du Cleaneur demandé, les autres Cleaneurs du secteur
  n'étaient jamais prévenus. Maintenant prévenus aussitôt (libération) ou dans les 5 minutes (échéance, tâche ouvrir-favoris), jamais deux fois.
- Performance : traductions sorties de langue.js dans traductions.js, chargé seulement en anglais, italien ou espagnol : 800 Ko de moins
  à chaque visite en français (page d'accueil : 1,9 Mo → environ 1,1 Mo avant compression). MapLibre seulement sur les pages carte, vidéos
  non préchargées, photos des conversations et des contrôles chargées à la demande. Piste suivante (non faite, risque de régression) : charger
  l'espace Cleaneur et l'espace conciergerie à la demande.
  NOUVEAU POUR LES TRADUCTIONS : les entrées se mettent désormais à la fin de assets/js/traductions.js (avant le « ]; » final).
- Itinéraires (choix de Michael : OpenRouteService) : fonction serveur « itineraire » déployée (clé cachée, secret ORS_CLE ; garde-fous :
  France seulement, 300 km au plus, 120 demandes par minute et par adresse). Tant que la clé n'est pas enregistrée : repli temporaire sur
  le serveur de démonstration OSRM, côté serveur. Le site n'appelle plus aucun service d'itinéraire directement ; sans réponse en 7 s,
  estimation à vol d'oiseau.
- Corrigé : bandeau « Les réservations ouvrent très bientôt » non traduit sur les pages ville.
À REPORTER PAR VINCENT : appeler la fonction « itineraire » au lieu d'OSRM dans les applis.

## Retours de Michael du 26/11 (captures, traités un par un)
1. Tableau de bord (gestion.html) vide : erreur de syntaxe dans gestion.js depuis le retrait des emojis. Corrigé et en ligne (version 2026112601).
2. Véhicules : « Accueil du Cleaneur » incohérent pour une voiture. Fait (validé par Michael, base outils/base-cles-vehicule.sql appliquée et testée) :
   - Étape 2 « Remise des clés » selon le lieu : en main propre, une autre personne, accueil de l'entreprise (lieu de travail seulement),
     boîte à clés, « Sans clés : extérieur seulement » (seulement si toutes les tâches sont extérieures) ; puis « Restitution des clés ».
     Mêmes codes en base (PRESENT, TIERS, BOITE, AUTONOME) ; détails dans demandes.acces (cles, restitution, vehicule).
   - Étape 4 « Où trouver le véhicule » : repère sur la carte (déplaçable sur la place), repère écrit, accès au parking, marque/modèle/couleur,
     immatriculation (préremplie depuis Mes biens) ; transmis au Cleaneur une fois la mission confirmée.
   - Cleaneur : bloc véhicule dans la mission, « Clés reçues » puis « Clés rendues » avec photo du tableau de bord (noter_cles), client
     prévenu ; « J'ai terminé » refusé tant que les clés ne sont pas rendues ; « Je suis devant le véhicule » / « Je ne trouve pas le véhicule ».
   - Corrigé au passage (toutes prestations) : en passant d'un champ texte au suivant, la page se redessinait et le nouveau champ perdait
     la saisie ; erreur « node to be removed » au redessin.
   À REPORTER PAR VINCENT : les mêmes écrans et libellés dans les applis, noter_cles, acces.vehicule.


# CLEANEROO — REFONTE TOTALE DU PRODUIT

Tu dois réaliser une **refonte complète de Cleaneroo**, à la fois visuelle, UX, UI, fonctionnelle et structurelle.

Il ne s'agit PAS d'un simple redesign esthétique.

Je veux que tu considères Cleaneroo comme un produit qui doit pouvoir rivaliser visuellement et ergonomiquement avec les meilleures plateformes modernes de réservation et de services.

**Ne te contente pas d'améliorer quelques composants. Analyse l'ensemble du produit et repense-le de manière cohérente.**

---

# 1. OBJECTIF GLOBAL

Transformer Cleaneroo en une plateforme :

- moderne
- premium
- immersive
- vivante
- intuitive
- rapide
- rassurante
- professionnelle
- différenciante
- évolutive

L'application doit donner l'impression d'un produit technologique abouti.

Je veux que l'utilisateur ressente une vraie identité Cleaneroo dès les premières secondes.

**Cleaneroo ne doit pas ressembler à un template SaaS ou à une marketplace générique.**

---

# 2. REFONTE DES DEUX UNIVERS

Il existe deux expériences principales :

## ESPACE CLIENT

Le client vient pour :

**chercher → explorer → comparer → choisir → réserver → payer → suivre → évaluer**

Son interface doit donc être orientée :

- découverte
- simplicité
- confiance
- rapidité
- réservation
- localisation
- transparence
- suivi

## ESPACE CLEANER

Le Cleaner vient pour :

**recevoir → analyser → accepter → organiser → se déplacer → réaliser → suivre ses revenus**

Son interface doit être orientée :

- efficacité
- planning
- missions
- revenus
- disponibilité
- navigation
- communication
- performance

### IMPORTANT

Ne construis PAS deux interfaces identiques avec simplement des menus différents.

Les deux espaces doivent avoir :

- leurs propres dashboards
- leurs propres priorités
- leurs propres composants
- leurs propres parcours
- leurs propres informations importantes
- leurs propres interactions

Mais ils doivent partager la même identité Cleaneroo.

---

# 3. CRÉER UNE VÉRITABLE IDENTITÉ CLEANEROO

Conserve strictement le **code couleur actuel de Cleaneroo**.

Ne change pas arbitrairement les couleurs de la marque.

Tu peux cependant travailler :

- nuances
- gradients
- transparences
- ombres
- profondeurs
- contrastes
- états actifs
- états hover
- effets lumineux

Je veux créer un véritable :

## CLEANEROO DESIGN SYSTEM

avec :

- palette
- typographie
- boutons
- cartes
- badges
- inputs
- menus
- modales
- notifications
- icônes
- illustrations
- composants cartographiques
- animations
- transitions
- rayons
- espacements
- ombres
- effets de profondeur

Tous les écrans doivent utiliser ce système.

---

# 4. LA CARTE DOIT DEVENIR LA SIGNATURE DE CLEANEROO

C'est une priorité absolue.

Je veux que la carte soit l'un des éléments les plus impressionnants du produit.

L'utilisateur doit avoir l'impression de **plonger dans son environnement**.

Évite absolument l'effet :

> "Google Maps intégré dans une application."

La carte doit sembler appartenir à Cleaneroo.

---

## CARTE CLIENT

Elle doit permettre de :

- voir les Cleaners disponibles
- voir les zones couvertes
- explorer son environnement
- rechercher une prestation
- filtrer les résultats
- sélectionner un Cleaner
- voir sa disponibilité
- ouvrir sa fiche
- réserver

Utiliser lorsque possible :

- profondeur
- relief
- bâtiments
- couleurs
- ombres
- effets 3D
- animations
- marqueurs personnalisés
- clusters intelligents
- zones d'intervention
- badges
- indicateurs de disponibilité

Les marqueurs doivent être immédiatement reconnaissables.

Lorsqu'un Cleaner est sélectionné :

**la carte doit réagir.**

Exemples :

- zoom
- animation du marqueur
- mise en évidence
- ouverture d'une fiche
- déplacement de la caméra
- affichage des disponibilités

---

# 5. CARTE CLEANER

Le Cleaner doit disposer d'une expérience cartographique complètement différente.

La carte doit lui permettre de voir :

- missions
- lieux d'intervention
- prochaines prestations
- itinéraires
- zones favorites
- zones d'activité
- disponibilité

Elle doit être conçue comme un **outil de travail**.

Le Cleaner doit comprendre instantanément :

**où je dois aller, quand, pour quelle prestation et dans quel ordre.**

---

# 6. ESPACE CLIENT — REFONTE COMPLÈTE

Repenser entièrement le dashboard client.

La page d'accueil doit être contextuelle.

Exemples :

Bonjour,

**Que souhaitez-vous faire aujourd'hui ?**

Puis :

- rechercher une prestation
- voir les professionnels disponibles
- réserver
- consulter une réservation
- suivre une prestation
- retrouver ses prestations favorites

Afficher intelligemment :

- prochaine réservation
- historique
- favoris
- recommandations
- promotions éventuelles
- prestations proches
- disponibilité locale

Éviter les dashboards remplis de blocs inutiles.

Chaque élément doit avoir une utilité.

---

# 7. RECHERCHE CLIENT

Créer une recherche extrêmement fluide.

Le client doit pouvoir rechercher :

- type de prestation
- lieu
- date
- heure
- fréquence
- budget

Les résultats doivent pouvoir être affichés :

### LISTE

et

### CARTE

avec possibilité de basculer instantanément entre les deux.

---

# 8. FICHES CLEANER

Repenser totalement les profils.

Afficher clairement :

- photo
- nom
- note
- nombre de prestations
- expérience
- prestations proposées
- zone d'intervention
- disponibilité
- prix
- avis
- badges
- informations de confiance

Créer une hiérarchie visuelle très forte.

Le client doit pouvoir répondre rapidement à :

**Puis-je lui faire confiance ?**

**Est-il disponible ?**

**Combien cela coûte ?**

**Que propose-t-il ?**

---

# 9. RÉSERVATION

Repenser le parcours de réservation.

Le parcours idéal :

**Prestation → lieu → date → heure → options → Cleaner → prix → confirmation → paiement**

Afficher constamment :

- prix
- durée
- date
- heure
- lieu
- Cleaner sélectionné

Éviter toute surprise.

---

# 10. ESPACE CLEANER — NOUVEAU DASHBOARD

Le dashboard Cleaner doit être conçu comme un véritable **centre de contrôle professionnel**.

Il doit immédiatement afficher :

- missions du jour
- prochaines missions
- revenus
- disponibilité
- demandes en attente
- notifications
- évaluations
- statistiques

Créer une hiérarchie :

### URGENT
Ce que le Cleaner doit faire maintenant.

### AUJOURD'HUI
Ce qui est prévu aujourd'hui.

### À VENIR
Les prochaines missions.

### PERFORMANCE
Revenus, notes, réservations, etc.

---

# 11. PLANNING CLEANER

Créer un planning extrêmement clair.

Le Cleaner doit pouvoir voir :

- jour
- semaine
- mois

avec :

- horaires
- prestations
- durée
- adresse
- statut
- temps de déplacement

Prévoir la détection des conflits horaires.

---

# 12. MISSIONS CLEANER

Chaque mission doit avoir une page dédiée.

Afficher :

- client
- adresse
- carte
- itinéraire
- type de prestation
- durée
- prix
- instructions
- photos éventuelles
- heure
- statut

Étapes possibles :

**Nouvelle demande**

↓

**Acceptée**

↓

**En route**

↓

**Arrivé**

↓

**Prestation en cours**

↓

**Terminée**

Chaque changement de statut doit être clair et éventuellement accompagné d'une micro-interaction.

---

# 13. REVENUS CLEANER

Créer un véritable dashboard financier.

Afficher :

- revenus du jour
- semaine
- mois
- année
- missions réalisées
- moyenne par mission
- évolution
- paiements
- historique

Utiliser des graphiques modernes mais simples à comprendre.

---

# 14. DISPONIBILITÉS

Le Cleaner doit pouvoir gérer facilement :

- horaires
- jours disponibles
- zones
- périodes d'indisponibilité
- congés
- prestations acceptées

L'expérience doit être extrêmement rapide.

---

# 15. NOTIFICATIONS

Créer un véritable centre de notifications.

Exemples :

- nouvelle demande
- réservation confirmée
- modification
- annulation
- nouveau message
- paiement
- nouvel avis
- rappel de mission

Différencier visuellement les notifications importantes.

---

# 16. MESSAGERIE

Créer une messagerie propre entre :

Client ↔ Cleaner

Elle doit permettre :

- messages
- photos si nécessaire
- informations de rendez-vous
- notifications contextuelles

La conversation doit rester liée à la réservation.

---

# 17. AVIS ET RÉPUTATION

Créer un système de réputation visuellement fort.

Afficher :

- note globale
- nombre d'avis
- répartition
- avis récents
- badges
- taux de satisfaction

Le système doit favoriser la confiance.

---

# 18. MICRO-INTERACTIONS

Ajouter des animations intelligentes :

- transitions
- hover
- sélection
- ouverture de cartes
- changement de statut
- confirmation
- chargement
- réservation
- paiement
- notifications

Mais :

**pas d'animation gratuite.**

Chaque animation doit améliorer la compréhension ou donner du feedback.

---

# 19. ÉTATS À NE PAS OUBLIER

Pour chaque page, prévoir :

- chargement
- skeleton
- vide
- erreur
- succès
- indisponibilité
- réservation annulée
- paiement échoué
- connexion perdue
- aucun résultat
- aucun Cleaner disponible

Une application premium ne doit jamais laisser l'utilisateur face à un écran vide ou incompréhensible.

---

# 20. RESPONSIVE

Optimiser séparément :

### MOBILE CLIENT

### MOBILE CLEANER

### DESKTOP CLIENT

### DESKTOP CLEANER

Ne jamais simplement réduire la version desktop.

Le mobile doit avoir sa propre logique d'interface.

---

# 21. ACCESSIBILITÉ

Vérifier :

- contraste
- tailles de texte
- zones tactiles
- navigation
- lisibilité
- feedback visuel
- états actifs

---

# 22. PERFORMANCE

La refonte doit rester performante.

Optimiser :

- images
- carte
- 3D
- animations
- composants
- chargement
- données
- responsive

La sensation doit rester fluide.

---

# 23. ARCHITECTURE

Avant de modifier le code :

analyse l'architecture actuelle.

Identifie :

- composants réutilisables
- duplication
- incohérences
- dette technique
- problèmes de responsive
- problèmes de performance
- problèmes UX

Ne casse aucune fonctionnalité existante.

Si une refonte technique est nécessaire, procède proprement.

---

# 24. NE PAS INVENTER DES FONCTIONNALITÉS INUTILES

Tu peux proposer de nouvelles fonctionnalités uniquement lorsqu'elles améliorent réellement :

- conversion
- confiance
- réservation
- fidélisation
- productivité du Cleaner

Ne transforme pas Cleaneroo en usine à gaz.

Chaque nouvelle fonctionnalité doit avoir une justification UX ou business.

---

# 25. AUDIT PAGE PAR PAGE

Avant de finaliser la refonte, passe systématiquement sur :

**TOUTES LES PAGES**

et

**TOUTES LES PRESTATIONS**

Pour chacune, vérifie :

- design
- cohérence
- responsive
- navigation
- contenu
- CTA
- couleurs
- accessibilité
- performance
- état vide
- chargement
- erreur
- mobile
- desktop

Aucune page ne doit rester visuellement en arrière par rapport au reste du produit.

---

# 26. COHÉRENCE CLIENT / CLEANER

Les deux univers doivent être connectés.

Une action côté Client doit avoir une conséquence logique côté Cleaner.

Exemple :

Client réserve

↓

Cleaner reçoit la demande

↓

Cleaner accepte

↓

Client reçoit confirmation

↓

Cleaner se rend sur place

↓

Client voit le statut

↓

Prestation terminée

↓

Paiement

↓

Avis

Le design doit rendre cette chaîne évidente.

---

# 27. OBJECTIF BUSINESS

La refonte ne doit pas uniquement être belle.

Elle doit améliorer :

- conversion
- nombre de réservations
- confiance
- rétention
- fréquence d'utilisation
- taux d'acceptation des missions
- productivité des Cleaners

Chaque écran doit avoir un objectif.

---

# 28. DIRECTION ARTISTIQUE

Je veux une esthétique :

**premium + technologie + humain + proximité + propreté**

Éviter :

- design froid
- interface générique
- surcharge
- effets 3D gratuits
- gradients excessifs
- animations inutiles
- aspect "template"

La technologie doit servir l'expérience.

---

# 29. LE NIVEAU DE FINITION ATTENDU

Je veux que tu travailles comme une équipe composée de :

- UX designer
- UI designer
- product designer
- développeur frontend
- développeur mobile
- expert cartographie
- expert responsive
- expert accessibilité
- expert conversion

Ne pense pas uniquement à l'apparence.

Pense à l'ensemble du produit.

---

# 30. PRIORITÉ ABSOLUE

Si tu dois choisir où investir le plus d'efforts :

### 1. CARTE

### 2. ESPACE CLIENT

### 3. ESPACE CLEANER

### 4. RÉSERVATION

### 5. FICHES CLEANER

### 6. DESIGN SYSTEM

### 7. ANIMATIONS / MICRO-INTERACTIONS

### 8. PERFORMANCE

---

# CONSIGNE FINALE

Je ne veux pas une simple amélioration cosmétique.

Je veux que tu **repenses Cleaneroo comme un produit complet**.

Analyse l'existant.

Comprends ce qui fonctionne.

Identifie ce qui doit être amélioré.

Puis réalise une refonte cohérente de l'ensemble.

**Ne détruis pas ce qui fonctionne. Améliore-le.**

Et surtout :

**ne laisse aucune page, aucun espace utilisateur, aucune prestation ou aucun parcours avec un niveau de finition inférieur au reste de l'application.**

Le résultat final doit donner cette sensation :

> **"Cleaneroo est une plateforme moderne, premium, immersive et réellement professionnelle."**

La carte doit être sa signature.

Le parcours Client doit être extrêmement simple.

L'espace Cleaner doit être extrêmement efficace.

Et les deux doivent former un seul écosystème cohérent.
### Retours de Michael du 26/11 — point 3 : distinction côté client (en cours)
- Corrigé (commit local 0404f5f) : raccourci « Mes favoris » du tableau client, qui ouvrait la page d'accueil publique.
- Validé par Michael : site pensé ordinateur d'abord (téléphone = applis) ; menu latéral fixe pour l'espace client (Accueil, Réserver, Mes prestations, Messages, Mes favoris en vraie page, Mes biens, Mon compte) ; pastilles de raccourcis supprimées ; « Près de chez moi » retiré de l'espace client ; rubriques en cartes numérotées, choix avec rond à cocher, onglet actif plein, boutons primaire / contour / lien.
- Validé ensuite (« Oui go ») et réalisé (version 2026112603, commits locaux) : même menu côté Cleaneur ; pages « Aujourd'hui » Cleaneur (chiffres du jour, journée en ligne de temps, carte de tournée, missions proposées) et « Mes prestations » client (tableau + panneau de détail). Prototypes : /tmp/srv/proto2-4, /tmp/srv/maq/.

- Réalisé (26/11, version 2026112603) :
  - assets/js/menu-lateral.js (nouveau) : menu fixe à gauche ≥ 1100 px sur les pages de l'espace ; entrées par espace ; côté Cleaneur, pilote les sous-onglets (événement « cleaneroo:sous-onglet » ajouté dans sous-onglets.js) ; compteur de messages non lus (mes_conversations).
  - entete.js : marquerActif() redessine le menu ; les liens du haut, « Être rappelé » et « Réserver » de l'en-tête sont masqués quand le menu est là.
  - Route #/favoris (pageFavoris dans tableau.js) ; raccourci « Près de chez moi » supprimé ; pastilles de raccourcis masquées avec le menu.
  - reserver.js : rangerEnCartes() — chaque h3 de l'étape devient une carte numérotée.
  - style.css : onglet actif plein, choix avec rond à cocher, bouton secondaire en contour, retour en lien, barre d'actions en bande.
  - missions.js : « Aujourd'hui » Cleaneur en poste de pilotage (chiffresDuJour : missions du jour, prochaine mission + départ conseillé, missions disponibles, note ; journée à gauche ; tournée, À venir, Performance à droite ; urgences en bandeaux).
  - tournee.js : heures au format « 8 h 45 ».
  - demandes-bureau.js (nouveau) : Mes prestations en tableau + panneau de détail (prénom du Cleaneur via infos_fil ; étapes cochées selon le statut, sans date inventée ; actions : Ouvrir le suivi, Écrire au Cleaneur).
  - 25 nouvelles traductions.
- À REPORTER PAR VINCENT (applis) : mêmes règles visuelles (onglet actif plein, rond à cocher, bouton secondaire en contour, rubriques en cartes numérotées) ; le menu latéral et le tableau sont propres au site sur ordinateur.

## Cleaneroo AI « Décrire mon besoin » (cahier des charges du 26/11, version complète validée par Michael)
Ordre : A base de connaissances + fonction serveur · B conversation et fiche · C passage vers réservation/paiement existants · D équipements + brief Cleaneur · E vérification sur place (supplément existant) · F tableau de pilotage + amélioration · G tests (15 + égalité des prix) et documentation.
- Prix : l'IA ne donne que des identifiants du catalogue ; prix = estimation.js (comme la réservation) ; serveur paiement revérifie. Vérifié le 26/11 : le serveur de paiement (prix-serveur.js figé au commit 87ecf7d) et le site actuel donnent les mêmes prix sur 1 080 cas tirés au hasard (0 écart).
- Lot A (fait, 26/11) : tables connaissances_ia (63 entrées de départ) et analyses_ia, fonction lier_analyse_ia (accord de Michael) ; fonction serveur besoin-ia déployée (Claude, schéma imposé, identifiants revérifiés, objets hors catalogue et moisissures → validation humaine, 20 analyses/h et 60/j par visiteur) ; catalogue publié pour l'IA : assets/catalogue-ia.json (généré par outils/generer_catalogue_ia.mjs, lancé par generer_pages.py). Fichiers : outils/base-assistant-ia.sql, outils/base-assistant-ia-contenu.sql, outils/connaissances-ia-initiales.json.
- À vérifier : secret ANTHROPIC_API_KEY présent dans Supabase (jamais encore utilisé en production).
- Lots B à G réalisés en local (26/11, non mis en ligne) : voir outils/CLEANEROO_AI.md (documentation technique complète).
  Base appliquée avec accord : profils.equipements, equipe_pour, maj_equipements, contrôles dans missions_disponibles / missions_incompatibles / prendre_mission / proposer / cibler_cleaneurs (testé : « equipement » renvoyé sans le matériel).
  Reste : clé ANTHROPIC_API_KEY, redéploiement de besoin-ia, tests réels des 15 scénarios, validation de Michael, mise en ligne, message aux Cleaneurs pour « Mon matériel ».

### Inscription (retour de Vincent, 26/11) — EN LIGNE (version 2026112604, commit c8f9bac sur origin/main)
- Adresse déjà inscrite : Supabase n'envoie aucun e-mail (utilisateur sans identité) → écran « Vous avez déjà un compte » (Google / mot de passe / mot de passe oublié) ; saisie gardée 1 h (cleaneroo-inscription-attente) et espace ajouté après connexion (seulement pour la même adresse).
- Nouvelle adresse : écran « Plus qu'une étape » (renvoyer l'e-mail toutes les 60 s, changer d'adresse).
- ATTENTION : la branche locale main contient Cleaneroo AI (non publié) + une copie de cette correction (c55f04b). origin/main a avancé (c8f9bac) : pour publier Cleaneroo AI, partir d'origin/main et y reporter les fichiers de l'IA (pas de rebase commit par commit : conflits sur les pages générées).

### MIS DE CÔTÉ (Michael, 26/11) : vérification du numéro de téléphone (demande de Vincent)
- Besoin : vérifier e-mail (déjà fait par Supabase / Google) ET téléphone des pré-inscrits Cleaneurs ; clients à la 1re réservation.
- Option retenue a priori : Google Firebase (10 SMS gratuits par jour, compte de facturation Blaze avec carte requis) ; Google envoie et vérifie le code, une fonction serveur contrôle le jeton Firebase et marque profils.telephone_verifie_le. Ne PAS activer le fournisseur « Phone » de Supabase (ouvrirait la connexion par SMS sans e-mail).
- Secours : case « Téléphone vérifié (appel fait) » dans le back-office ; au-delà de 10 SMS/jour : Brevo (~0,045 € le SMS, crédits prépayés) via notre propre fonction.
- Base à prévoir (accord de Michael) : profils.telephone_verifie_le, contrôle à l'envoi du dossier Cleaneur, remise à zéro si le numéro change, un même numéro pour un seul compte Cleaneur.

### MIS EN LIGNE le 26/11 (version 2026112606) — Cleaneroo AI, centre de réservation, connexion, pages Cleaneur
- Cleaneroo AI : clé ANTHROPIC_API_KEY enregistrée par Michael, besoin-ia redéployée (version 3, « dernier nettoyage »), 15 scénarios réels testés (fiche, questions, validation humaine pour moisissures / façade / cuir, refus de donner un prix, tentative de détournement refusée, anglais et italien) : aucun identifiant hors catalogue, aucun prix donné par l'IA.
- Vidéos de démo retirées (pub de l'accueil, guide Cleaneur), en attendant les nouvelles : VIDEO_PUB = false (app.js), GUIDES_VIDEO.cleaneur.retire (guide-video.js).
- « Réserver » = centre de réservation (reserver.js, étape 1) : champ Cleaneroo AI avec photos (glisser-déposer), « Vos demandes en cours » (une par prestation, cleaneroo-brouillons, Reprendre / Supprimer, total par le même calcul), « À refaire », « Pour vos biens », catalogue par familles avec recherche. « Réserver » n'ouvre plus d'office la dernière demande.
- Connexion : arrivée sur le tableau de bord de l'espace (ou retour à la page ouverte avant la connexion : réservation, messages…) ; cleaneroo.fr ouvert par un compte connecté → son tableau de bord (à l'ouverture seulement) ; en-tête du compte affiché tout de suite.
- IA aussi sur le tableau de bord (« De quoi avez-vous besoin ? ») et dans « Mes biens » (« Décrire un besoin », adresse du bien reprise).
- Accueil : boutons « Créer mon espace » / « Me connecter » (demande de Vincent).
- Prompt recrutement Cleaneurs (parties 1 à 9) : gainCleaneur et fraisStripeC (regles.js), tableau du vrai gain, accroche « Jusqu'à … €/h », simulateur « après cotisations », règles en clair, étapes, « Bon à savoir » NOVA, « Prêt à commencer ? », page /cleaneur/ (aperçu de lien propre, image assets/img/partage-cleaneur.jpg, sitemap), #/conditions-cleaneurs, case d'inscription Cleaneur, ACRE 15,9 % / 10,6 % (choix dans « Mon activité »), LANCEMENT_ZONE / LANCEMENT_DATE (à remplir), carte en 4 langues, directeur de la publication, signature du contrat bloquée tant que REGLES.SOCIETE.siret est vide.
- POUR VINCENT (applis) : Regles.kt (URSSAF_ACRE_PCT 15.9, URSSAF_ACRE_AVANT_JUILLET_2026_PCT 10.6, FRAIS_STRIPE_PCT 1.5, FRAIS_STRIPE_FIXE_C 25, LANCEMENT_ZONE, LANCEMENT_DATE, gainCleaneur), FormulesCleaneur.kt (« Paiement sécurisé et outils identiques à la formule Pro », ligne « après cotisations URSSAF », mention Stripe), Activite.kt (choix ACRE à 3 options), Dossier.kt (signature indisponible avant l'immatriculation), écran Devenir Cleaneur (tableau, règles, étapes), vitrine société (« Paiement sécurisé · Versé à la société chaque vendredi… »), page indépendant (« Formations de vos prestations »), écran Réserver (centre), arrivée après connexion.
- RÉSERVE DE GARANTIE (à trancher par Vincent) : colonne profils.garantie_c (défaut 0). Aucune fonction ne l'alimente ; remettre_en_urgence y prend min(pénalité, réserve), le reste va dans penalites_cleaneur.reste_a_retenir_c (retenu sur les versements suivants) ; annuler_penalite rend la part non utilisée. Aujourd'hui la réserve vaut 0 pour tout le monde : toute pénalité est retenue sur les versements suivants. Soit on la constitue (montant, quand elle est rendue), soit on retire la mention du contrat et de missions.js.
- FORMATIONS (règle retenue = celle de la base) : formations_manquantes = tous les modules de qualifs_requises de chaque prestation proposée par le Cleaneur (socle + module de la prestation, + hauteur / machines / polissage / biocides selon les tâches). Textes du site alignés. Contrat NON modifié : il présente les formations comme des « conseils de méthode » et ne cite que « certaines prestations » ; le modifier = nouvelle CONTRAT_VERSION, contrat_version_actuelle() en base, nouvelle signature de tous : à voir avec la relecture juridique (risque de requalification si les formations deviennent des directives).

### Contrat 2026-12-c (26/11) — base et fonction paiement v10 en service ; site 2026112608 (accord de Michael, option B)
- Paiement (option B) : le client paie à la réservation, Cleaneroo encaisse via Stripe et reverse après validation. verser() déduit désormais
  les frais Stripe du prix de la prestation (1,5 % + 0,25 €, FRAIS_STRIPE_* identiques au site) et les pénalités en cours, au plus 50 % du
  versement (RETENUE_MAX_PCT), enregistrées par retenir_penalites() dans retenues_penalites (idempotente, testée en transaction annulée).
- Base (outils/base-contrat-2026-12-c.sql) : contrat_version_actuelle() = « 2026-12-c », table retenues_penalites, retenir_penalites (serveur seulement),
  mes_penalites (retenues visibles, plus de réserve). profils.garantie_c n'est plus utilisée.
- Contrat : « Conditions pour recevoir des missions » (seuls les certificats légaux bloquent ; modules facultatifs ; RC Pro doit couvrir, notamment
  le travail en hauteur), « Paiement par le client et commission » (option B), « Annulations et fiabilité » (retenue plafonnée, 60 jours, somme
  reversée en cas de force majeure) ; annexe « exigences par prestation » générée depuis formationsExigees / formationsConseillees.
- POUR VINCENT : Dossier.kt (même texte + annexe), Regles.kt (RETENUE_MAX_PCT), écran Pénalités de l'appli (retenues, plus de réserve), libellé
  « Conseillé à tous » pour le socle de formation.
- RESTE À TRANCHER : la prime d'urgence du remplaçant est calculée sur la part « couverte par la réserve » (remettre_en_urgence) : sans réserve,
  elle vaut toujours 0 (avancer la prime, ou la retirer). Équivalences de formation : sans objet (seuls des certificats légaux bloquent).
  Travail en hauteur : rester « conseillé » ou exiger une RC Pro qui le couvre (rc_pro_activites).
- MISSION DE RENFORT (26/11, accord de Michael, appliquée en base : outils/base-mission-renfort.sql) : plus de prime d'urgence (Cleaneroo n'a pas
  de trésorerie). Mission remise en urgence → 0 % de commission (emettre_factures, testé : aucune facture de commission), plus de réserve dans
  remettre_en_urgence (indemnité entièrement retenue sur les versements suivants), +10 min d'avance pendant 24 h après un renfort (avance_niveau),
  badge « Renfort · n » sur la fiche publique (renforts_de). Contrat 2026-12-c complété (Prix et commission, Paiement, Annulations, Classement).
  POUR VINCENT : même affichage dans l'appli (carte de mission « 0 % de commission », badge Renfort, plus de « prime d'urgence »).
- Traduction ajoutée de l'article « Responsabilité, assurance et garantie » (le texte avait changé sans traduction).

## Pass Entretien véhicule (26/11/2026, décision de Michael) — à reporter dans les applis (Vincent)
- Véhicules seulement. Règles dans `REGLES.PASS_ENTRETIEN` (regles.js) et `outils/base-pass-entretien.sql` (mêmes valeurs, à changer ensemble).
- Paliers : −5 % dès le 3e passage, −10 % dès le 6e (jamais plus) ; deux passages prévus sautés → on redescend d'un palier ; un filleul dont un véhicule a été lavé → +3 passages comptés.
- Passage d'entretien : −15 % de temps et de prix si le même véhicule (immatriculation, sinon adresse) a un passage dans les 45 jours avant (120 en trimestriel).
- Ordre dans le prix : remise pack → passage d'entretien → … → engagement → fidélité → minimum. Frais de service inchangés. Remises arrondies à l'euro.
- Le prix n'est jamais décidé par l'appli : lire `mon_pass_entretien(p_creneau, p_immat, p_rue, p_cp, p_freq)` juste avant d'envoyer CHAQUE passage (le palier monte à chaque passage). La fonction paiement recalcule avec `pass_entretien_calc` (tolère les passages annulés après la création de la demande).
- Carte « Pass Entretien » au tableau de bord client (pass-entretien.js) ; report gratuit 1×/an d'un passage confirmé : `reporter_passage_pass(ref, creneau)` (≥ 48 h avant, ±14 jours, pas le dimanche, garde l'ordre de la série ; le Cleaneur reste prioritaire 24 h).
- Côté Cleaneur : tuiles « déjà réservés sur 30 jours » et « clients fidèles » (missions.js).
- Pas encore fait : adhésion annuelle (9,90 €, phase 2 : paiement + conditions + rétractation) ; « jour de passage du quartier » (seulement quand il y aura 2 clients proches) ; version Flotte.

## Première mission accompagnée (26/11/2026, décision de Michael : Cleaneroo n'a pas de trésorerie) — à reporter dans les applis (Vincent)
- Fini la « mission test rémunérée 40 € par Cleaneroo » (REGLES.MISSION_TEST_C supprimé). À la place : une vraie mission chez un particulier, non urgente, payée par le client au prix normal ; 0 % de commission (le Cleaneur touche 100 %).
- Base (outils/base-premiere-mission-accompagnee.sql) : demandes.mission_accompagnee (posé par déclencheur quand le Cleaneur reçoit la mission), test_autorise(d), cleaneur_actif() (une mission à la fois), prendre_mission / proposer renvoient « mission_test », emettre_factures 0 % de commission, avis ≥ 4/5 → compte activé automatiquement ; sinon decider_mission_test (gestion).
- Contrat 2026-12-d (article « Première mission accompagnée ») ; contrat_version_actuelle() = 2026-12-d.
- Textes à reprendre dans les applis : « Réussir votre première mission accompagnée (… 100 % du prix, sans commission) », plus aucun « 40 € payés par Cleaneroo ».

## Créneaux toutes les 30 minutes, selon la prestation (26/11/2026, Michael et Vincent) — à reporter dans les applis
- heuresProposees(b, dureeMin) dans estimation.js ; réglages REGLES.CRENEAU_PAS_MIN (30), CRENEAUX_PRESTA, FENETRE_ARRIVEE_*.
- Location saisonnière : du départ des voyageurs jusqu'au dernier début qui finit avant l'arrivée suivante, fenêtre d'arrivée de 30 min comprise.
- Ménage et autres : 7 h-11 h 30 et 13 h-18 h 30, fini avant 20 h ; bureaux, commerces, parties communes : 6 h-20 h 30, fini avant 22 h ; extérieurs et piscine : 8 h-17 h 30, fini avant 19 h ; événements : comme avant, à la demi-heure.
- L'heure du brouillon devient décimale (10.5 = 10 h 30). Prix inchangés (créneau malin et forte demande : mêmes plages).

## Créneaux avancés (26/11/2026, accord de Michael) — à reporter dans les applis (Vincent)
- Base (outils/base-creneaux-avances.sql) : creneaux_disponibles(rubrique, lat, lon, jour, durée) → nombre de Cleaneurs libres par demi-heure (jamais d'identité) ; creneaux_tournee(lat, lon, jour) → fins de missions à moins de 5 km ; demandes.plage_fin (plage d'arrivée, 12 h au plus, effacée dès qu'un Cleaneur reçoit la mission) ; plages_missions() ; prendre_mission(ref, p_heure) ; proposer refuse une heure hors plage (« heure ») ; details.creneauPrix posé à la création (prix figé sur l'heure de début, lu par la fonction paiement).
- Réservation : « Heure précise » ou « Plage horaire » (location saisonnière : plage par défaut, jusqu'au dernier début possible) ; sous chaque créneau, « n dispo. » ou « complet », et « tournée ».
- Cleaneur : sur une mission à plage, menu « Mon heure d'arrivée » ; le client est prévenu de l'heure fixée.
- Pilote automatique : plage entre le départ et l'arrivée suivante lue dans le calendrier ; nouveau mode « Proposé » (biens.donnees.pilote.mode = "propose") : une notification par départ sans ménage, rien n'est réservé.

## Parrainage sans trésorerie (26/11/2026, décision de Michael : Cleaneroo ne dépense jamais un euro) — à reporter dans les applis
- Plus de remise de 10 € ni de cagnotte ni de prime de 20 € : base outils/base-parrainage-sans-tresorerie.sql (table avantages, mes_avantages()).
- Filleul client : 3 réservations sans frais de service ; parrain : 1 à la 1re prestation du filleul, 2 à la 3e ; client qui fait venir un Cleaneur : 3 ; Cleaneur parrain : 3 missions sans commission + 10 min d'avance 1 mois ; conciergerie : 1 mois offert ; Ambassadeur (3 / 10 filleuls) : 0 % de frais 3 / 12 mois ; avantages valables 12 mois.
- La base décide au dépôt (demandes.frais_offerts) ; l'appli affiche « Frais de service Cleaneroo · offerts (parrainage) » et un total sans frais, comme le site (estimation : b.fraisOfferts).
- Pas fait : QR code de parrainage (bibliothèque tierce à valider).

## « Ma demande compte » (27/11/2026) — liste d'attente devenue pré-réservation
Base : `outils/base-ma-demande-compte.sql` (appliquée). Fonction serveur `attente` (e-mails, Resend). Site : `assets/js/attente.js`.
À reporter dans les applis :
- « Être prévenu » / réservations fermées : appeler `mettre_en_attente(p_rubrique, p_code_postal, p_ville, p_lat, p_lon, p_prenom, p_email, p_telephone, p_motif 'ouverture'|'secteur', p_regulier, p_libelle, p_langue, p_brouillon, p_source 'appli')`. Position obligatoire : adresse, sinon véhicule (vehLat/vehLon), sinon centre de la commune. Renvoie `{ jeton, rang, total, ville, quartier }`.
- Afficher « n° X sur la liste à Ville · N demandes », le compteur du quartier, le partage WhatsApp aux voisins (avec le code de parrainage si compte).
- Lien `cleaneroo.fr/#/reprendre/<jeton>` (e-mail) : `attente_par_jeton` renvoie le brouillon ; reprendre à l'étape du créneau, `details.attenteJeton` envoyé avec la demande.
- Priorité 24 h : `priorite_secteur(rubrique, lat, lon, jeton)` ; erreur `priorite` à l'envoi = secteur réservé aux inscrits.
- Espace client : `mes_attentes()`. Quitter la liste : `quitter_attente(jeton)`.
- Devenir Cleaneur : `attente_quartier(lat, lon, 20)` (nombres seulement, aucun nom).

## Badge du séjour (27/11/2026) — « Logement contrôlé Cleaneroo » repensé
Base : `outils/base-badge-sejour.sql` (appliquée). Site : `assets/js/badge.js`. À reporter dans l'appli (Badge.kt, Mes biens) :
- `badge_controle(code)` renvoie maintenant `actif` (ménage contrôlé < 30 jours), `dernier` (vraie date), `type` (type de logement, jamais le nom donné au bien), `invitation`, `photos`. Trois états : actif / « Badge en pause » / « Badge en attente » ; jamais « contrôlé » sans ménage récent.
- Bouton du badge : « Vous louez aussi un logement ? Faire contrôler mes ménages » → `cleaneroo.fr/?parrain=<invitation>#/reserver/rental` (le code du bien vaut code de parrainage, `lier_parrain`).
- « Un souci à votre arrivée ? » : photo dans le stockage `alertes-voyageurs/<code>/…`, puis `alerte_voyageur(code, texte, photo)` (ok / texte / trop / introuvable).
- Mes biens : `mon_badge(bien)` (lien, réglage photos, alertes), `regler_badge(bien, photos)`, `alerte_lue(id)`. Affichette A5 : `#/affichette/<code>`.
- Ne jamais conseiller de mettre le lien dans Airbnb ou Booking (interdit par ces plateformes) ; phrase sans lien pour l'annonce.

## Tableau de bord et interrupteur (27/11/2026)
Site : `assets/js/mode.js`, `assets/js/entete.js`, `assets/js/a-faire.js`. À reporter dans les applis (ModeCleaneur.kt, en-tête, accueil) :
- L'espace affiché vient du profil : client seul → son tableau de bord client ; Cleaneur seul → espace Cleaneur. Le mode mémorisé ne compte que pour un double profil (client + Cleaneur), et il est mémorisé par compte, pas par appareil.
- Interrupteur seulement pour un double profil (« Particulier | Cleaneur »), avec une pastille : nombre de choses qui attendent dans l'autre espace.
- Visiteur : pas d'interrupteur ; lien « Devenir Cleaneur » ; l'accueil est toujours l'accueil client (« Accueil clients » depuis les pages Cleaneur).
- « Ce qui vous attend » en tête du tableau de bord : client (prestation à valider, paiement à finaliser — seulement si les réservations sont ouvertes —, Cleaneur qui arrive aujourd'hui, demande en attente réservable) ; Cleaneur (mission du jour, « Démarrer » à moins de 2 h, missions proposées).
- Une notification ou un lien vers l'autre espace y bascule tout seul.

## Confirmation du compte par code (27/11/2026)
Écran « Plus qu'une étape » : champ « Code de confirmation » (6 chiffres, envoi automatique au 6e chiffre) en plus du lien.
Appli : `supabase.auth.verifyOtp(email, token, type = SIGNUP)` puis ouvrir l'espace comme après une connexion. Modèle d'e-mail : `outils/modele-email-confirmation.html`.

## Mes espaces et interrupteur pour tous (27/11/2026)
Site : `assets/js/mes-espaces.js`, `assets/js/mode.js`. À reporter dans les applis :
- Compte à un seul profil : pastille dans l'en-tête « Devenir Cleaneur » (client) ou « Réserver pour moi » (Cleaneur) → page de présentation `#/espace/<id>`.
- Page de présentation : vitrine de l'espace ; pour Cleaneur, simulateur de chiffre d'affaires (molette 1 à 25 missions par semaine, type de mission, Gratuite/Pro ; mêmes calculs que gainCleaneur), 3 étapes, questions fréquentes ; adhésion intégrée (`ajouter_statut`, téléphone mobile demandé s'il manque ; raison sociale + SIRET pour Conciergerie et Hôtellerie ; Entreprise renvoie à Mon compte pour le secteur).
- Mon compte : section « Mes espaces » (espaces ouverts, puis « Ajouter un espace » vers les présentations).
- Double profil : interrupteur inchangé.
