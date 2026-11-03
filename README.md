# Site Cleaneroo

Site web de Cleaneroo : vitrine, réservation (même parcours et mêmes prix que l'application Android), suivi des demandes et gestion.

- HTML, CSS et JavaScript sans outil de compilation, publié sur GitHub Pages (cleaneroo.fr).
- Données : Supabase (projet `cleaneroo`, Paris). La clé du fichier `assets/js/donnees.js` est la clé publique : la sécurité repose sur les règles de la base.
- Prix : `assets/js/regles.js`, `catalogue.js` et `estimation.js` sont des copies exactes de `Regles.kt`, `Catalogue.kt` et `Estimation.kt`. Vérification : `tests.html`.
