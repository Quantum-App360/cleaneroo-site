// Tarifs administrables (lot 3 de la refonte du 20 novembre 2026) : les prix ne sont plus figés dans le code.
// La table « tarifs » (Supabase) garde des versions ; la dernière publiée corrige les valeurs par défaut du code (regles.js, catalogue.js)
// au démarrage du site, de l'espace de gestion et de la fonction serveur qui vérifie le prix avant paiement. Sans réseau : la dernière
// version reçue (gardée sur l'appareil), sinon les valeurs du code.
// Format : { regles: { CLE: valeur }, taux: { rubriqueId: centimes }, taches: { "rubriqueId/tacheId": { prixC, minutes } },
//            elements: { elementId: prixC }, speciaux: { typeId: { prixC, prixM2C } } }
import { REGLES } from "./regles.js";
import { RUBRIQUES, ELEMENTS_TEXTILES, TARIFS_SPECIAUX } from "./catalogue.js";

/** Valeurs du code, gardées pour pouvoir revenir en arrière et pour l'aperçu de l'écran Tarifs. */
const ORIGINE = JSON.parse(JSON.stringify({
  regles: REGLES, taux: Object.fromEntries(RUBRIQUES.map(r => [r.id, r.tauxHoraireC])),
  taches: Object.fromEntries(RUBRIQUES.flatMap(r => r.taches.map(t => [`${r.id}/${t.id}`, { prixC: t.prixC, minutes: t.minutes }]))),
  elements: Object.fromEntries(ELEMENTS_TEXTILES.map(e => [e.id, e.prixC])), speciaux: TARIFS_SPECIAUX,
}));
export const valeursDuCode = () => JSON.parse(JSON.stringify(ORIGINE));
export let versionTarifs = 0;

/** Clés de REGLES modifiables depuis l'écran Tarifs (les autres restent dans le code). */
export const CLES_MODIFIABLES = ["MINIMUM_MENAGE_LOCATION_C", "MINIMUM_COMMANDE_VEHICULE_C", "MINIMUM_COMMANDE_TEXTILES_C", "MINIMUM_COMMANDE_HEBERGEMENT_C",
  "MINIMUM_COMMANDE_BATEAU_C", "MINIMUM_COMMANDE_LOISIRS_C", "PLANCHER_HORAIRE_C", "FORMULE_CONFORT_PLUS_PCT", "FORMULE_PREMIUM_PLUS_PCT", "OPTION_TAUX_HORAIRE_C", "OPTION_MIN_C",
  "DRAPS_SUR_PLACE_PAR_LIT_C", "DRAPS_LAVERIE_C", "LAVERIE_TRAJET_C", "LINGE_SUR_PLACE_FORFAIT_C", "LINGE_LAVERIE_PAR_SDB_C", "TORCHONS_LAVERIE_C",
  "FRAIS_SERVICE_PARTICULIER_PCT", "FRAIS_SERVICE_PRO_PCT", "MAJORATION_DIMANCHE_PCT", "CRENEAU_MALIN_PCT", "ZONE_PRESTIGE_PCT", "ZONE_ECONOMIQUE_PCT",
  "ABONNEMENTS_PRO", "SEJOUR_PCT", "TAUX_LOCATION_C", "COMMISSION_GRATUIT_PB", "COMMISSION_PRO_PB", "ABONNEMENT_CLEANEUR_C"];

/** Applique une version de tarifs par-dessus les valeurs du code (toujours repartir du code : une clé retirée revient à sa valeur d'origine). */
export function appliquerTarifs(donnees = {}, version = 0) {
  const o = ORIGINE, d = donnees || {};
  for (const k of CLES_MODIFIABLES) {
    const v = d.regles && k in d.regles ? d.regles[k] : o.regles[k];
    REGLES[k] = JSON.parse(JSON.stringify(v));
  }
  RUBRIQUES.forEach(r => {
    r.tauxHoraireC = d.taux && d.taux[r.id] != null ? d.taux[r.id] : o.taux[r.id];
    r.taches.forEach(t => { const x = (d.taches || {})[`${r.id}/${t.id}`] || o.taches[`${r.id}/${t.id}`]; t.prixC = x.prixC; t.minutes = x.minutes; });
    // Formules de location : taux propres au niveau (Standard / Confort / Premium), REGLES.TAUX_LOCATION_C.
    if (r.id === "rental") r.formules.forEach(f => { if (REGLES.TAUX_LOCATION_C[f.id]) f.tauxC = REGLES.TAUX_LOCATION_C[f.id]; });
  });
  ELEMENTS_TEXTILES.forEach(e => { e.prixC = d.elements && d.elements[e.id] != null ? d.elements[e.id] : o.elements[e.id]; });
  Object.keys(TARIFS_SPECIAUX).forEach(k => Object.assign(TARIFS_SPECIAUX[k], o.speciaux[k], (d.speciaux || {})[k] || {}));
  versionTarifs = version;
}

const CLE = "cleaneroo-tarifs";
// Au chargement du module : la dernière version reçue sur cet appareil, tout de suite (pas d'attente réseau).
try { const c = JSON.parse(localStorage.getItem(CLE) || "null"); if (c && c.donnees) appliquerTarifs(c.donnees, c.version); } catch { /* rien */ }

/** Relit la version publiée (au plus 2,5 s d'attente) ; renvoie true si les tarifs ont changé. */
export async function chargerTarifs(supabase) {
  try {
    const lecture = supabase.from("tarifs").select("version, donnees").eq("actif", true).order("version", { ascending: false }).limit(1).maybeSingle();
    const { data } = await Promise.race([lecture, new Promise(r => setTimeout(() => r({ data: undefined }), 2500))]);
    if (data === undefined) return false;
    const version = data?.version || 0;
    if (version === versionTarifs) return false;
    appliquerTarifs(data?.donnees || {}, version);
    try { localStorage.setItem(CLE, JSON.stringify({ version, donnees: data?.donnees || {} })); } catch { /* rien */ }
    return true;
  } catch { return false; }
}
