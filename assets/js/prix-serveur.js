// Point d'entrée unique des règles de prix pour le serveur (fonction « paiement ») : un seul module,
// pour que les tarifs publiés (appliquerTarifs) modifient bien les règles utilisées par le calcul.
export { calculer, entreeEstimation } from "./estimation.js";
export { appliquerTarifs } from "./tarifs.js";
