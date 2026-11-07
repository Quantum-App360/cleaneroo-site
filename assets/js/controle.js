// Contrôle de fin de mission, pièce par pièce (7 novembre 2026) : pièces (ou zones) et tâches à cocher, calculées
// à partir de la réservation (details). Même calcul dans l'appli (ControlePieces.kt) ; base : outils/base-controle.sql.
import { RUBRIQUES, ETAPES_LOCATION } from "./catalogue.js";

/** Tâches de base de chaque type de pièce (toujours faites, même sans option). */
const BASE = {
  cuisine: [["plans", "Plans de travail et crédence"], ["evier", "Évier et robinetterie"], ["plaques", "Plaques de cuisson"], ["facades", "Façades et électroménager (extérieur)"], ["sol", "Sol aspiré et lavé"], ["poubelle", "Poubelle vidée"]],
  sejour: [["poussiere", "Dépoussiérage des surfaces accessibles"], ["sol", "Sol aspiré et lavé"], ["rangement", "Pièce remise en ordre"]],
  chambre: [["poussiere", "Dépoussiérage des surfaces accessibles"], ["lit", "Lit fait"], ["sol", "Sol aspiré et lavé"]],
  sdb: [["douche", "Douche ou baignoire"], ["lavabo", "Lavabo, robinetterie et miroir"], ["wc", "WC nettoyés et désinfectés"], ["sol", "Sol lavé"]],
  entree: [["sol", "Sol aspiré et lavé"], ["poignees", "Poignées et interrupteurs"]],
  exterieur: [["balayage", "Balayage"], ["mobilier", "Mobilier extérieur essuyé"]],
};
/** Zones des prestations hors logement : [id, nom, tâches de base]. */
const ZONES = {
  car: [["interieur", "Intérieur du véhicule", [["aspiration", "Aspiration des sièges et tapis"], ["tableau", "Tableau de bord et plastiques"], ["vitres_int", "Vitres intérieures"]]],
        ["exterieur", "Extérieur du véhicule", [["carrosserie", "Carrosserie lavée"], ["jantes", "Jantes"], ["vitres_ext", "Vitres extérieures"]]]],
  textiles: [["textiles", "Textiles traités", [["traitement", "Traitement réalisé sur chaque élément"], ["sechage", "Éléments laissés à sécher, protégés"]]]],
  windows: [["vitres", "Vitres", [["vitres", "Vitres sans traces"], ["encadrements", "Encadrements et rebords"]]]],
  office: [["bureaux", "Espaces de travail", [["poussiere", "Bureaux et surfaces dépoussiérés"], ["poubelles", "Poubelles vidées"], ["sol", "Sols aspirés et lavés"]]],
           ["sanitaires", "Sanitaires", [["wc", "WC et lavabos désinfectés"], ["consommables", "Consommables vérifiés"], ["sol", "Sol lavé"]]]],
  commerce: [["surface", "Surface de vente ou de travail", [["poussiere", "Surfaces et présentoirs dépoussiérés"], ["sol", "Sols aspirés et lavés"], ["poubelles", "Poubelles vidées"]]],
             ["sanitaires", "Sanitaires", [["wc", "WC et lavabos désinfectés"], ["sol", "Sol lavé"]]]],
  communal: [["hall", "Hall et entrée", [["sol", "Sol lavé"], ["vitres", "Portes vitrées et boîtes aux lettres"]]],
             ["paliers", "Paliers et escaliers", [["sol", "Marches et paliers balayés et lavés"], ["rampes", "Rampes et interrupteurs"]]]],
  outdoor: [["exterieur", "Espaces extérieurs", [["balayage", "Balayage et nettoyage"], ["mobilier", "Mobilier extérieur"]]]],
  event: [["salle", "Salle", [["sol", "Sol nettoyé"], ["tables", "Tables et surfaces"], ["dechets", "Déchets évacués"]]],
          ["office", "Cuisine ou office", [["plans", "Plans et éviers"], ["sol", "Sol lavé"]]]],
  special: [["zone", "Zone traitée", [["traitement", "Traitement réalisé selon le protocole"], ["securite", "Zone laissée propre et sécurisée"]]]],
  kitchen: [["cuisine", "Cuisine", [["plans", "Plans de travail et crédence"], ["equipements", "Équipements dégraissés"], ["sol", "Sol lavé"]]]],
};
/** Groupe d'une tâche du catalogue → type de pièce. */
const PIECE_DU_GROUPE = g => /cuisine/i.test(g) ? "cuisine" : /bain|sanitaire/i.test(g) ? "sdb" : /linge/i.test(g) ? "chambre" : /ext[ée]rieur/i.test(g) ? "exterieur" : "sejour";
const NOMS = { cuisine: "Cuisine", sejour: "Séjour", chambre: "Chambre", sdb: "Salle de bain", entree: "Entrée", exterieur: "Extérieur" };

/**
 * Pièces à contrôler pour une mission : [{ id, nom, taches: [{ id, nom }] }], dans l'ordre de passage.
 * Logement (ménage, location, déménagement, fin de chantier) : entrée, séjour, cuisine, chambres, salles de bain (+ extérieur) ;
 * autres prestations : leurs zones. Les tâches choisies à la réservation sont rangées dans la bonne pièce.
 */
export function piecesDe(rubriqueId, details = {}) {
  const r = RUBRIQUES.find(x => x.id === rubriqueId);
  const choisies = (r?.taches || []).filter(t => (details.taches || []).includes(t.id));
  const perso = (details.tachesPerso || []).map((t, i) => ({ id: `perso${i}`, nom: String(t).slice(0, 160) }));
  if (ZONES[rubriqueId]) {
    const zones = ZONES[rubriqueId].map(([id, nom, base]) => ({ id, nom, taches: base.map(([tid, tnom]) => ({ id: tid, nom: tnom })) }));
    const sanitaires = zones.find(z => z.id === "sanitaires");
    choisies.forEach(t => (sanitaires && /sanitaire|wc|toilette/i.test(t.nom + t.groupe) ? sanitaires : zones[0]).taches.push({ id: t.id, nom: t.nom }));
    zones[0].taches.push(...perso);
    return zones;
  }
  // Logement : nombre de chambres (un studio compte 1) et de salles de bain
  const chambres = Math.max(1, Number(details.chambres) || 1), sdb = Math.max(1, Number(details.sdb) || 1);
  const liste = [["entree", 1], ["sejour", 1], ["cuisine", 1], ["chambre", chambres], ["sdb", sdb]];
  const pieces = [];
  liste.forEach(([type, n]) => { for (let i = 1; i <= n; i++) pieces.push({ type, id: n > 1 ? `${type}${i}` : type, nom: n > 1 ? `${NOMS[type]} ${i}` : NOMS[type],
    taches: BASE[type].map(([id, nom]) => ({ id, nom })) }); });
  const ajouter = (type, tache, toutes = false) => {
    let cibles = pieces.filter(p => p.type === type);
    if (!cibles.length) { const p = { type, id: type, nom: NOMS[type], taches: BASE[type].map(([id, nom]) => ({ id, nom })) }; pieces.push(p); cibles = [p]; }
    (toutes ? cibles : cibles.slice(0, 1)).forEach(p => { if (!p.taches.some(x => x.id === tache.id)) p.taches.push(tache); });
  };
  choisies.forEach(t => ajouter(PIECE_DU_GROUPE(t.groupe || ""), { id: t.id, nom: t.nom }));
  // Location saisonnière : étapes choisies, faites dans chaque chambre / salle de bain concernée
  if (rubriqueId === "rental") ETAPES_LOCATION.filter(e => (details.etapesChoisies || []).includes(e.id))
    .forEach(e => ajouter(e.piece === "entree" ? "entree" : e.piece, { id: `e_${e.id}`, nom: e.nom }, true));
  (details.etapesPerso || []).forEach((t, i) => ajouter("entree", { id: `ep${i}`, nom: String(t).slice(0, 160) }));
  perso.forEach(t => ajouter("sejour", t));
  return pieces.map(({ type, ...p }) => p);
}

/** Pièce complète (même règle que la base, piece_complete) : photos, tâches cochées, IA d'accord ou écart justifié. */
export const pieceComplete = c => !!c.photo_avant && !!c.photo_apres && (c.taches || []).every(t => t.fait)
  && (c.ia_statut === "ok" || (["ecart", "erreur"].includes(c.ia_statut) && (c.justification || "").trim().length >= 5));
