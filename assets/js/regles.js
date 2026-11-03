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
  TACHE_PERSO_MIN: 15,
  OPTION_GENERIQUE_C: 1200,
  OPTION_GENERIQUE_MIN: 15,
  LINGE_PAR_PARURE_C: 400,
  CONSOMMABLES_MIN: 10,
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
export function heure(h, m = 0) { return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, "0")}`; }
const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export function dateLongue(d) { return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`; }
export function dateCourte(d) { return `${JOURS[d.getDay()].slice(0, 3)}. ${d.getDate()} ${MOIS[d.getMonth()].slice(0, 4)}.`; }
