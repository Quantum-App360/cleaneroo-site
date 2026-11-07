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
  MINIMUM_MENAGE_LOCATION_C: 2900,
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
  CONVIVES_PAR_TRANCHE: 50,
  PALIERS_MAX: 40,
  SURFACE_PALIER_DEFAUT_M2: 20,
  // Immeubles : hall et entrée + chaque palier compte au moins un quart d'heure (le prix suit toujours le nombre d'étages)
  IMMEUBLE_HALL_MIN: 30,
  IMMEUBLE_MIN_PAR_PALIER: 15,
  // Offre de lancement Cleaneurs (comme Regles.kt) : 500 premiers validés, 12 mois sans abonnement, puis 19,99 €/mois ;
  // impayé : blocage et redistribution des missions réservées 3 jours après la date de facturation prévue.
  OFFRE_LANCEMENT_PLACES: 500,
  OFFRE_LANCEMENT_MOIS: 12,
  ABONNEMENT_CLEANEUR_C: 1999,
  PREAVIS_BLOCAGE_JOURS: 3,
  // Périmètre d'intervention d'un Cleaneur (menu déroulant du profil), en km ; défaut 15 km.
  ZONES_KM: [5, 10, 15, 20, 25, 30, 40, 50, 75, 100],
  ZONE_KM_DEFAUT: 15,
  // Espace Pro : agenda relié aux calendriers iCal (Airbnb, Booking…).
  AGENDA_HORIZON_JOURS: 14,      // départs proposés « à programmer »
  AGENDA_CACHE_MIN: 15,          // calendrier relu au plus toutes les 15 min
  SEUIL_ESPACE_PRO_BIENS: 3,     // à partir de 3 biens, le compte s'ouvre sur l'espace Pro
  BIENS_MAX: 200,
  // Option « Lavage des draps » (location saisonnière) : prix fixe par lit, le même dans toutes les zones.
  LAVAGE_DRAPS_PAR_LIT_C: 1200,
  LAVAGE_DRAPS_MIN_PAR_LIT: 10,   // planning : retirer, lancer, étendre et plier, par lit
  LITS_MAX: 20,
  // Prix selon la ville (pouvoir d'achat) : 3 zones, d'après le code postal de l'adresse du bien (géolocalisée).
  // Prestige +20 % (Monaco, Cannes, Saint-Tropez…), Standard (prix de base), Économique −10 % (Istres, Draguignan…).
  // S'applique à la main-d'œuvre, aux forfaits et aux tâches ; les minimums de commande et l'option draps ne changent pas.
  ZONE_PRESTIGE_PCT: 20,
  ZONE_ECONOMIQUE_PCT: -10,
  ZONE_PRESTIGE_CP: ["98000", "06400", "06150", "06250", "06160", "06230", "06310", "06320", "06360", "06190", "06570", "06590", "83990", "83350", "83580", "83310", "13260", "84220", "20137", "20169", "20260", "75001", "75006", "75007", "75008", "75016", "92200", "74120", "73120", "73150", "64200", "14800", "33970", "62520"],
  ZONE_ECONOMIQUE_CP: ["13800", "13500", "13140", "13110", "13270", "13700", "13127", "13200", "13150", "83300", "83170", "83340", "83490", "83550", "83500", "06130", "06510", "04100", "04000", "84300", "84200", "84100", "84000"],
  // Agenda sans calendrier iCal : séjours saisis à la main dans l'espace Pro.
  SEJOURS_MAX_PAR_BIEN: 300,     // séjours saisis gardés par bien
  SEJOURS_GARDES_JOURS: 90,      // séjours finis depuis plus de 90 jours oubliés
  SEJOUR_DUREE_MAX_JOURS: 365,
  AGENDA_VOIES_MAX: 3,           // barres de séjour visibles par jour (au-delà : « +N »)
  AGENDA_LISTE_JOURS: 60,        // vue « Liste » : les 60 prochains jours
  PALIERS_DEFAUT: 5,
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
  MAJORATION_URGENCE_SPECIALE_PCT: 30,  // prestations spécialisées : intervention urgente (sous 24 à 48 h)
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
  GARANTIE_REMPLACEMENT_OFFERT_C: 1500,
  GARANTIE_DECLARATION_H: 48,
  AVIS_DELAI_JOURS: 14,
  TOLERANCE_RETARD_MIN: 30,
  RAYON_ARRIVEE_KM: 1.0,
  VITESSE_MOYENNE_KMH: 35,
  MARGE_TRAJET_MIN: 10,
  SUIVI_INTERVALLE_S: 10,        // suivi en direct : position envoyée et relue toutes les 10 s
  SURVEILLANCE_S: 30,            // nouvelles missions (Cleaneur) et prises en charge (client) : vérifiées toutes les 30 s, avec un son
};

// ---- Lancement (copie de Regles.DATE_LANCEMENT dans l'application) : ouverture de l'activité et des réservations.
export const DATE_LANCEMENT = new Date(2026, 11, 31, 0, 0, 0);
// Premières interventions (copie de Regles.DATE_PREMIERES_INTERVENTIONS) : les comptes s'ouvrent avant, aucune intervention avant cette date.
export const DATE_PREMIERES_INTERVENTIONS = new Date(2027, 0, 1, 0, 0, 0);
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
// Mois abrégés comme l'appli (format Java « MMM » en français)
const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
export function dateCourte(d) {
  if (langue !== "fr") return d.toLocaleDateString(LOCALE, { weekday: "short", day: "numeric", month: "short" });
  return `${JOURS[d.getDay()].slice(0, 3)}. ${d.getDate()} ${MOIS_COURTS[d.getMonth()]}`;
}
/** « mardi 10 novembre à 14 h » dans la langue choisie. */
export function dateHeure(d) {
  const a = { fr: "à", en: "at", it: "alle", es: "a las" }[langue];
  return `${dateLongue(d)} ${a} ${heure(d.getHours(), d.getMinutes())}`;
}

/** Zone de prix d'une adresse d'après son code postal : "PRESTIGE", "ECONOMIQUE" ou "STANDARD" (zonePrix de Regles.kt). */
export function zonePrix(codePostal) {
  const cp = String(codePostal || "").trim();
  if (REGLES.ZONE_PRESTIGE_CP.includes(cp)) return "PRESTIGE";
  if (REGLES.ZONE_ECONOMIQUE_CP.includes(cp)) return "ECONOMIQUE";
  return "STANDARD";
}
/** Ajustement de prix de la zone, en % (+20, 0 ou −10). */
export const pctZone = codePostal => ({ PRESTIGE: REGLES.ZONE_PRESTIGE_PCT, ECONOMIQUE: REGLES.ZONE_ECONOMIQUE_PCT })[zonePrix(codePostal)] ?? 0;
/** Libellé de la ligne d'estimation (« Tarif zone Prestige (+20 %) »), vide en zone Standard. */
export const libelleZone = pct => (pct > 0 ? `Tarif zone Prestige (+${pct} %)` : pct < 0 ? `Tarif zone Économique (−${-pct} %)` : "");
