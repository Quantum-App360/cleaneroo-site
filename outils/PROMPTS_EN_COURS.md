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

## Prompt 4 — Refonte totale du produit (reçu le 24/11, 14 h 44, après les prompts 1 à 3)

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