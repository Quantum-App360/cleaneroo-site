import { langue, LOCALE } from "./langue.js";

// Valeurs métier : copie EXACTE de app/.../Regles.kt (application Android). Toute modification se fait des deux côtés.
// Montants en centimes, durées en minutes.
export const REGLES = {
  COMMISSION_BASE_PB: 1500,
  DELAI_MIN_RESERVATION_H: 24,
  PLANNING_HEURE_DEBUT: 5,
  PLANNING_HEURE_FIN: 23,
  ARRONDI_DUREE_MIN: 15,
  DUREE_PAR_NIVEAU_SUPP_MIN: 15,
  SEUIL_DEUX_CLEANEURS_MIN: 6 * 60,
  SEUIL_DEVIS_SURFACE_M2: 300,
  MINIMUM_COMMANDE_VEHICULE_C: 4000,
  MINIMUM_COMMANDE_TEXTILES_C: 5900,
  VEHICULES_MIN: 1,
  VEHICULES_MAX: 20,
  DUREE_MIN_VEHICULE_MIN: 30,
  MINIMUM_MENAGE_LOCATION_C: 3500,
  DUREE_MIN_TEXTILES_MIN: 60,
  PRIX_APPEL_TEXTILES_C: 4500,
  ROTATION_BASE_MIN: 20,
  ROTATION_PAR_CHAMBRE_MIN: 20,
  ROTATION_PAR_SDB_MIN: 20,
  ROTATION_PAR_M2_MIN: 0.35,
  PASSAGES_MIN: 2,
  PASSAGES_MAX: 12,
  PASSAGES_DEFAUT: 4,
  JOURS_MIN_PLUSIEURS_PAR_SEMAINE: 2,
  TACHE_PERSO_MIN: 15,
  OPTION_GENERIQUE_C: 1200,
  OPTION_GENERIQUE_MIN: 15,
  LINGE_PAR_PARURE_C: 400,
  CONSOMMABLES_MIN: 10,
  CHANTIER_MIN_PAR_FENETRE: 15,
  CHANTIER_MINIMUM_MIN: 120,
  CHANTIER_PIECES_MAX: 8,
  ETAPE_PERSO_LOCATION_MIN: 10,
  DEPART_VOYAGEURS_MIN_H: 6,
  DEPART_VOYAGEURS_MAX_H: 14,
  DEPART_VOYAGEURS_DEFAUT_H: 10,
  ARRIVEE_SUIVANTE_MIN_H: 12,
  ARRIVEE_SUIVANTE_MAX_H: 22,
  ARRIVEE_SUIVANTE_DEFAUT_H: 16,
  MAJORATION_DIMANCHE_PCT: 25,
  CRENEAU_MALIN_PCT: 10,
  ENGAGEMENT_PCT: { 0: 0, 3: 5, 6: 10, 12: 15 },
  CREDIT_IMPOT_PCT: 50,
  CREDIT_IMPOT_PLAFOND_C: 1200000,
  MAX_PROPOSITIONS: 5,
  REMISE_CLEANEUR_MAX_PCT: 10,
  HAUSSE_CLEANEUR_MAX_PCT: 50,
  ANNULATION_GRATUITE_H: 48,
  ANNULATION_TARDIVE_PCT: 25,
  VALIDATION_AUTO_H: 48,
  GARANTIE_PLAFOND_C: 300000,
  GARANTIE_DECLARATION_H: 48,
  AVIS_DELAI_JOURS: 14,
  TOLERANCE_RETARD_MIN: 30,
  RAYON_ARRIVEE_KM: 1.0,
};

// ---- Lancement (copie de Regles.DATE_LANCEMENT dans l'application) : ouverture de l'activité et des réservations.
export const DATE_LANCEMENT = new Date(2026, 11, 31, 0, 0, 0);
export const MESSAGE_LANCEMENT = "Soyez prêts pour une nouvelle dimension du nettoyage, 100 % digitalisé.";
export const estPrelancement = (maintenant = new Date()) => maintenant < DATE_LANCEMENT;
export const joursAvantLancement = (maintenant = new Date()) => Math.max(0, Math.ceil((DATE_LANCEMENT - maintenant) / 864e5));

// ---- Formats français (copie de Formats.kt)
export function euros(c) {
  const neg = c < 0, a = Math.abs(Math.round(c));
  const entier = Math.floor(a / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return (neg ? "−" : "") + entier + "," + String(a % 100).padStart(2, "0") + " €";
}
export function duree(min) {
  const h = Math.floor(min / 60), m = min % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${String(m).padStart(2, "0")}`;
}
export function heure(h, m = 0) {
  if (langue !== "fr") return `${h}:${String(m).padStart(2, "0")}`;
  return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`;
}
const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export function dateLongue(d) {
  if (langue !== "fr") return d.toLocaleDateString(LOCALE, { weekday: "long", day: "numeric", month: "long" });
  return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`;
}
export function dateCourte(d) {
  if (langue !== "fr") return d.toLocaleDateString(LOCALE, { weekday: "short", day: "numeric", month: "short" });
  return `${JOURS[d.getDay()].slice(0, 3)}. ${d.getDate()} ${MOIS[d.getMonth()].slice(0, 4)}.`;
}
/** « mardi 10 novembre à 14 h » dans la langue choisie. */
export function dateHeure(d) {
  const a = { fr: "à", en: "at", it: "alle", es: "a las" }[langue];
  return `${dateLongue(d)} ${a} ${heure(d.getHours(), d.getMinutes())}`;
}
