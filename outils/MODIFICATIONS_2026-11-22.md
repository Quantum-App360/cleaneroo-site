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
