// Catalogue des prestations : copie EXACTE de Catalogue.kt et de Reservation.kt (application Android).
import { REGLES, euros } from "./regles.js";
/** Tâche : groupe = intertitre ; parSurface = chiffrée pour la surface de référence, au prorata au-delà ; types = types de lieu (vide = tous). */
const T = (id, nom, prixC, minutes, o = {}) => ({ id, nom, prixC, minutes, groupe: "", parSurface: false, types: [], ...o });
/** Genre de formule : décide des questions affichées sous les formules (GenreFormule dans l'appli). */
export const genreParDefaut = id => ({ regulier: "REGULIER", saisonnier: "REGULIER", ponctuel: "PONCTUEL", remise: "REMISE_EN_ETAT", demoussage: "REMISE_EN_ETAT" })[id] || "AUTRE";
/** avecDernierNettoyage : pose aussi « Dernier nettoyage en profondeur » (ex. Grand ménage, qui garde les occasions). */
const F = (id, nom, description = "", m2ParHeure = 0, minimumMin = 0, coef = 1.0, genre = genreParDefaut(id), avecDernierNettoyage = genre === "REMISE_EN_ETAT") =>
  ({ id, nom, description, m2ParHeure, minimumMin, coef, genre, avecDernierNettoyage });

/* Questions communes des formules (mêmes listes que l'appli : Catalogue.kt). */
export const FREQUENCES = [["semaine", "Chaque semaine"], ["deux_semaines", "Toutes les 2 semaines"], ["quatre_semaines", "Toutes les 4 semaines"], ["plusieurs", "Plusieurs fois par semaine"]];
export const MOMENTS_PAR_DEFAUT = [["matin", "Le matin"], ["apres_midi", "L'après-midi"], ["soiree", "En soirée"], ["indifferent", "Indifférent"]];
export const JOURS_SEMAINE = [[1, "Lun"], [2, "Mar"], [3, "Mer"], [4, "Jeu"], [5, "Ven"], [6, "Sam"], [7, "Dim"]];
/** « Dernier nettoyage en profondeur » (remise en état) : présélectionne l'état de saleté. */
export const DERNIERS_NETTOYAGES = [
  { id: "moins_1_mois", libelle: "Moins d'un mois", salissure: "NORMAL" }, { id: "1_6_mois", libelle: "1 à 6 mois", salissure: "MARQUE" },
  { id: "6_12_mois", libelle: "6 à 12 mois", salissure: "MARQUE" }, { id: "plus_1_an", libelle: "Plus d'un an", salissure: "INTENSE" },
];

/** Logement : 4 groupes ; « à la surface » = chiffré pour 60 m² (surfaceReferenceM2), au prorata au-delà. */
const cuisine = { groupe: "Cuisine" }, vie = { groupe: "Pièces de vie" }, linge = { groupe: "Linge" }, ext = { groupe: "Extérieurs" };
const tachesLogement = [
  T("four", "Intérieur du four", 2500, 30, cuisine), T("frigo", "Intérieur du réfrigérateur", 1500, 20, cuisine),
  T("hotte", "Hotte et filtres", 1500, 20, cuisine), T("microondes", "Micro-ondes (intérieur)", 800, 10, cuisine),
  T("placards_cuisine", "Intérieur des placards de cuisine", 2000, 30, cuisine), T("vaisselle", "Vaisselle", 1500, 20, cuisine),
  T("vitres", "Vitres intérieures et extérieures", 2500, 40, { ...vie, parSurface: true }),
  T("hauteurs", "Dépoussiérage des hauteurs et luminaires", 1500, 20, { ...vie, parSurface: true }),
  T("plinthes", "Plinthes, portes et interrupteurs", 1500, 20, { ...vie, parSurface: true }),
  T("placards_armoires", "Intérieur des placards et armoires", 2500, 35, vie),
  T("draps", "Changement des draps", 800, 10, linge), T("repassage", "Repassage (1 heure)", 2800, 60, linge),
  T("lessive", "Lessive et pliage du linge", 1500, 20, linge),
  T("balcon", "Balcon", 1500, 20, ext), T("terrasse", "Terrasse (balayage et lavage)", 2500, 30, ext), T("poubelles", "Sortie des poubelles", 500, 5, ext),
];
const essentiel = ["draps", "poubelles", "hauteurs", "plinthes"];
const confort = [...essentiel, "vitres", "frigo", "microondes", "lessive"];
const prestige = [...confort, "four", "hotte", "placards_cuisine", "placards_armoires", "repassage", "balcon"];
const packsLogement = [
  { id: "essentiel", nom: "Essentiel", remisePct: 5, tacheIds: essentiel },
  { id: "confort", nom: "Confort", remisePct: 10, tacheIds: confort },
  { id: "prestige", nom: "Prestige", remisePct: 15, tacheIds: prestige },
];

/* ---- Location saisonnière : étapes et consommables (généré) ---- */
/* Bibliothèque d'étapes par pièce et consommables à contrôler : même contenu que Location.kt (appli). */
export const PIECES_LOCATION = [["chambre", "Chambre"], ["sdb", "Salle de bain"], ["cuisine", "Cuisine"], ["sejour", "Séjour"], ["exterieur", "Extérieur"], ["entree", "Entrée et général"]];
/** minutes = temps ajouté (0 = incluse). « Chambre » : une fois par chambre ; « Salle de bain » : une fois par salle de bain. */
export const ETAPES_LOCATION = [
  { id: "lit_draps", nom: "Faire le lit avec des draps propres", piece: "chambre", minutes: 0 },
  { id: "changer_draps", nom: "Changer les draps et taies", piece: "chambre", minutes: 0 },
  { id: "serviettes_lit", nom: "Disposer les serviettes sur le lit", piece: "chambre", minutes: 0 },
  { id: "plaids", nom: "Plier plaids et couvertures", piece: "chambre", minutes: 0 },
  { id: "sous_lit", nom: "Vérifier sous le lit et les meubles", piece: "chambre", minutes: 5 },
  { id: "placards", nom: "Vider et ranger les placards / dressing", piece: "chambre", minutes: 10 },
  { id: "cintres", nom: "Remettre les cintres", piece: "chambre", minutes: 0 },
  { id: "douche", nom: "Nettoyer douche / baignoire et joints", piece: "sdb", minutes: 0 },
  { id: "lavabo", nom: "Nettoyer lavabo, robinetterie et miroir", piece: "sdb", minutes: 0 },
  { id: "wc", nom: "Nettoyer et désinfecter les WC", piece: "sdb", minutes: 0 },
  { id: "serviettes_sdb", nom: "Disposer les serviettes propres", piece: "sdb", minutes: 0 },
  { id: "savon", nom: "Remettre savon, gel douche, shampoing", piece: "sdb", minutes: 0 },
  { id: "seche_cheveux", nom: "Vérifier sèche-cheveux et rangements", piece: "sdb", minutes: 0 },
  { id: "plan_travail", nom: "Nettoyer plan de travail et évier", piece: "cuisine", minutes: 0 },
  { id: "plaques", nom: "Nettoyer plaques, four et micro-ondes", piece: "cuisine", minutes: 20 },
  { id: "frigo", nom: "Vider et nettoyer le réfrigérateur", piece: "cuisine", minutes: 15 },
  { id: "lave_vaisselle", nom: "Vider le lave-vaisselle et ranger la vaisselle", piece: "cuisine", minutes: 10 },
  { id: "controle_vaisselle", nom: "Contrôler la vaisselle (casse, manque)", piece: "cuisine", minutes: 10 },
  { id: "cafe", nom: "Détartrer / nettoyer la machine à café", piece: "cuisine", minutes: 10 },
  { id: "poubelles", nom: "Vider les poubelles et remettre des sacs", piece: "cuisine", minutes: 0 },
  { id: "ranger_sejour", nom: "Ranger le séjour et disposer les coussins", piece: "sejour", minutes: 0 },
  { id: "canape", nom: "Aspirer le canapé", piece: "sejour", minutes: 10 },
  { id: "tv", nom: "Vérifier TV, box et télécommandes", piece: "sejour", minutes: 0 },
  { id: "livret", nom: "Disposer le livret d'accueil", piece: "sejour", minutes: 0 },
  { id: "sols", nom: "Aspirer et laver les sols", piece: "sejour", minutes: 0 },
  { id: "terrasse", nom: "Nettoyer la terrasse / le balcon", piece: "exterieur", minutes: 20 },
  { id: "mobilier", nom: "Ranger et essuyer le mobilier extérieur", piece: "exterieur", minutes: 10 },
  { id: "barbecue", nom: "Nettoyer le barbecue / la plancha", piece: "exterieur", minutes: 20 },
  { id: "piscine", nom: "Vérifier la piscine et les transats", piece: "exterieur", minutes: 15 },
  { id: "plantes", nom: "Arroser les plantes", piece: "exterieur", minutes: 5 },
  { id: "linge", nom: "Lancer et étendre le linge", piece: "entree", minutes: 15 },
  { id: "oublis", nom: "Vérifier les objets oubliés", piece: "entree", minutes: 0 },
  { id: "fenetres", nom: "Fermer fenêtres et volets", piece: "entree", minutes: 0 },
  { id: "chauffage", nom: "Régler chauffage / climatisation", piece: "entree", minutes: 0 },
  { id: "photo_entree", nom: "Photo d'ensemble de l'entrée", piece: "entree", minutes: 0 },
  { id: "cles", nom: "Déposer les clés / refermer la boîte à clés", piece: "entree", minutes: 0 },
];
export const PACK_ETAPES_CONSEILLE = ["lit_draps", "serviettes_sdb", "wc", "plan_travail", "poubelles", "ranger_sejour", "photo_entree"];
export const CONSOMMABLES_LOCATION = [
  ["cafe_capsules", "Capsules / dosettes de café"],
  ["cafe_moulu", "Café moulu et filtres"],
  ["the", "Thé et infusions"],
  ["sucre", "Sucre"],
  ["sel", "Sel, poivre et huile"],
  ["eau", "Bouteille d'eau d'accueil"],
  ["papier", "Papier toilette"],
  ["essuie_tout", "Essuie-tout"],
  ["savon_mains", "Savon pour les mains"],
  ["gel_douche", "Gel douche et shampoing"],
  ["liquide_vaisselle", "Liquide vaisselle"],
  ["pastilles", "Pastilles lave-vaisselle"],
  ["eponges", "Éponges"],
  ["sacs", "Sacs poubelle"],
  ["lessive", "Lessive"],
  ["produits", "Produits ménagers"],
];
export const PACK_CONSOMMABLES_CONSEILLE = ["cafe_capsules", "papier", "savon_mains", "liquide_vaisselle", "sacs"];
export const NATURES_SALISSURE_LOCATION = ["Calcaire", "Graisse", "Traces et marques", "Odeurs", "Moisissures"];
/** Nombre de fois qu'une étape est faite : par chambre (un studio compte 1), par salle de bain, sinon une fois. */
export const repetitionsEtape = (e, chambres, sdb) => (e.piece === "chambre" ? Math.max(1, chambres) : e.piece === "sdb" ? Math.max(1, sdb) : 1);
/** Temps ajouté par les étapes choisies et les étapes personnalisées (minutes). */
export const minutesEtapesLocation = (choisies, perso, chambres, sdb) =>
  ETAPES_LOCATION.filter(e => choisies.includes(e.id)).reduce((s, e) => s + e.minutes * repetitionsEtape(e, chambres, sdb), 0) + perso * REGLES.ETAPE_PERSO_LOCATION_MIN;
/** Nombre d'étapes à valider en photo (répétitions comprises). */
export const nombreEtapesLocation = (choisies, perso, chambres, sdb) =>
  ETAPES_LOCATION.filter(e => choisies.includes(e.id)).reduce((s, e) => s + repetitionsEtape(e, chambres, sdb), 0) + perso;
/* ---- fin location ---- */

export const RUBRIQUES = [
  { id: "home", nom: "Logement", sousTitre: "Ménage ponctuel ou régulier", emoji: "🏠", tauxHoraireC: 2690, salissureSurTemps: true,
    inclus: "Dépoussiérage des surfaces accessibles, aspiration et lavage des sols, cuisine, salle de bain et WC, poubelles, lits faits.",
    formules: [F("ponctuel", "Ménage ponctuel", "Un ménage complet, une seule fois.", 25, 120),
      F("regulier", "Entretien régulier", "Chaque semaine ou tous les 15 jours, idéalement avec le même Cleaneur.", 30, 90),
      F("grand", "Grand ménage", "Un nettoyage en profondeur, du sol au plafond.", 15, 120, 1.0, "PONCTUEL", true)],
    taches: tachesLogement, packs: packsLogement, surfaceReferenceM2: 60,
    occasions: [{ id: "printemps", nom: "Ménage de printemps", packId: "prestige" }, { id: "recevoir", nom: "Avant de recevoir", packId: "confort" },
      { id: "vacances", nom: "Retour de vacances", packId: "essentiel", tachesEnPlus: ["frigo"] }, { id: "vente", nom: "Avant une vente ou une location", packId: "prestige" },
      { id: "autre", nom: "Autre", packId: "" }],
    frequences: [["semaine", "Chaque semaine"], ["deux_semaines", "Toutes les 2 semaines"], ["mois", "Chaque mois"]],
    moments: [["matin", "Le matin"], ["apres_midi", "L'après-midi"], ["peu_importe", "Peu importe"]] },
  { id: "rental", nom: "Location saisonnière", sousTitre: "Prêt pour vos prochains voyageurs", emoji: "🧳", tauxHoraireC: 3000, salissureSurTemps: true, affichagePrix: "PAR_MENAGE",
    inclus: "Ménage complet entre deux voyageurs, lits faits avec le linge fourni sur place, cuisine et sanitaires désinfectés, contrôle de l'inventaire et des consommables, photos de chaque pièce pour l'hôte.",
    formules: [F("court", "Après un court séjour (1–4 nuits)", "Rotation standard.", 0, 0, 1.0),
      F("semaine", "Après un séjour d'une semaine (5–9 nuits)", "Rotation approfondie.", 0, 0, 1.2),
      F("long", "Après un long séjour (10 nuits et +)", "Rotation complète.", 0, 0, 1.45),
      F("grand", "Grand ménage périodique", "Remise à niveau complète du logement.", 0, 0, 1.8, "AUTRE", true)],
    naturesSalissure: NATURES_SALISSURE_LOCATION },
  { id: "moving", nom: "Déménagement et remise en état", sousTitre: "Un nouveau départ, du sol au plafond", emoji: "📦", tauxHoraireC: 3200, salissureSurTemps: true,
    inclus: "Nettoyage complet du logement vide. Nettoyage uniquement : Cleaneroo ne réalise ni peinture, ni rebouchage, ni réparation.",
    formules: [F("emmenagement", "Nettoyage d'emménagement", "", 10, 180, 1.0), F("depart", "Nettoyage de départ / état des lieux", "", 10, 180, 1.1),
      F("remise", "Remise en état", "", 10, 180, 1.4)],
    packs: packsLogement },
  { id: "car", nom: "Véhicules", sousTitre: "Nettoyage intérieur et extérieur", emoji: "🚗", tauxHoraireC: 4000, salissureSurTemps: false, affichagePrix: "MINIMUM_COMMANDE",
    inclus: "100 % à la carte : choisissez les tâches.",
    taches: [T("aspiration", "Aspiration complète", 2500, 30), T("tableau", "Plastiques et tableau de bord", 1000, 15),
      T("vitres_int", "Vitres intérieures", 800, 10), T("plastiques_protection", "Plastiques nettoyage + protection", 1500, 20),
      T("shampoing_sieges", "Shampoing sièges tissu", 3500, 45), T("cuir", "Cuir nettoyé et nourri", 4000, 45),
      T("moquettes", "Moquettes et tapis", 2500, 30), T("coffre", "Coffre", 1000, 15), T("ciel", "Ciel de toit", 2000, 20),
      T("poils", "Poils d'animaux", 2000, 20), T("anti_odeurs", "Anti-odeurs", 2000, 15), T("lavage_main", "Lavage à la main", 2500, 40),
      T("vitres_ext", "Vitres extérieures", 700, 10), T("jantes", "Jantes et pneus", 2000, 25), T("decontamination", "Décontamination des jantes", 3000, 30),
      T("bas_caisse", "Bas de caisse", 1500, 20), T("cire", "Cire", 3500, 30), T("optiques", "Optiques de phares", 4500, 40),
      T("polissage", "Polissage 1 étape", 15000, 180), T("moteur", "Compartiment moteur", 3000, 30)],
    packs: [
      { id: "essentiel", nom: "Essentiel", remisePct: 5, tacheIds: ["aspiration", "tableau", "vitres_int", "coffre"] },
      { id: "confort", nom: "Confort", remisePct: 10, tacheIds: ["aspiration", "tableau", "vitres_int", "coffre", "lavage_main", "vitres_ext", "jantes"] },
      { id: "prestige", nom: "Prestige", remisePct: 15, tacheIds: ["aspiration", "tableau", "vitres_int", "coffre", "lavage_main", "vitres_ext", "jantes", "plastiques_protection", "moquettes", "anti_odeurs", "bas_caisse", "cire"] },
    ] },
  { id: "textiles", nom: "Canapés et textiles", sousTitre: "Canapés, matelas et tapis", emoji: "🛋️", tauxHoraireC: 3000, salissureSurTemps: false, affichagePrix: "PAR_ELEMENT",
    formules: [F("canape", "Canapé"), F("matelas", "Matelas"), F("tapis", "Tapis et moquettes")],
    taches: [T("detachage", "Détachage ciblé", 1500, 15), T("acariens", "Anti-acariens", 2000, 15), T("desodorisation", "Désodorisation", 1000, 10),
      T("protection", "Protection anti-taches", 2500, 15), T("sechage", "Séchage accéléré", 1000, 10)],
    packs: [
      { id: "essentiel", nom: "Essentiel", remisePct: 5, tacheIds: ["detachage", "desodorisation"] },
      { id: "confort", nom: "Confort", remisePct: 10, tacheIds: ["detachage", "desodorisation", "acariens"] },
      { id: "prestige", nom: "Prestige", remisePct: 15, tacheIds: ["detachage", "desodorisation", "acariens", "protection", "sechage"] },
    ] },
  { id: "construction", nom: "Fin de chantier", sousTitre: "Éliminer la poussière après les travaux", emoji: "🏗️", tauxHoraireC: 3800, salissureSurTemps: true },
  { id: "kitchen", nom: "Cuisines", sousTitre: "Nettoyage approfondi et dégraissage", emoji: "🍳", tauxHoraireC: 3600, salissureSurTemps: true },
  { id: "office", nom: "Bureaux et commerces", sousTitre: "Des locaux propres et accueillants", emoji: "🏢", tauxHoraireC: 2950, salissureSurTemps: false },
  { id: "communal", nom: "Parties communes", sousTitre: "Escaliers, halls et espaces communs", emoji: "🏘️", tauxHoraireC: 2800, salissureSurTemps: false },
  { id: "windows", nom: "Vitres et vitrines", sousTitre: "Fenêtres, vitrines et vérandas", emoji: "🪟", tauxHoraireC: 3000, salissureSurTemps: false },
  { id: "outdoor", nom: "Espaces extérieurs", sousTitre: "Terrasses, balcons et garages", emoji: "🌿", tauxHoraireC: 3200, salissureSurTemps: false },
  { id: "event", nom: "Avant et après événement", sousTitre: "Profitez pleinement de votre événement", emoji: "🎉", tauxHoraireC: 3200, salissureSurTemps: false },
  { id: "special", nom: "Prestations spécialisées", sousTitre: "Une évaluation par un professionnel qualifié", emoji: "🧪", tauxHoraireC: null, salissureSurTemps: false, toujoursSurDevis: true },
].map(r => ({ inclus: "", formules: [], taches: [], packs: [], toujoursSurDevis: false, affichagePrix: "HORAIRE",
  surfaceReferenceM2: 0, occasions: [], naturesSalissure: [], moments: MOMENTS_PAR_DEFAUT, frequences: FREQUENCES, ...r }));

export const rubrique = id => RUBRIQUES.find(r => r.id === id);

/** Arrondi à l'euro (prix des tâches et remises de pack, comme l'appli). */
export const arrondiEuro = c => Math.round(c / 100) * 100;
/** Tâches proposées pour le type de lieu choisi (sans liste de types : toujours proposée). */
export const tachesPour = (r, typeLieuId) => r.taches.filter(t => !t.types.length || t.types.includes(typeLieuId));
/** Coefficient des tâches à la surface : max(100 %, surface / surface de référence). */
export const coefSurface = (r, surface) => (r.surfaceReferenceM2 > 0 ? Math.max(1, surface / r.surfaceReferenceM2) : 1);
/** Tâche au prix du client : prorata de surface et coefficient de prix (gabarit), prix arrondi à l'euro. */
export function tacheChiffree(t, r, surface, coefPrix = 1) {
  const k = t.parSurface ? coefSurface(r, surface) : 1;
  return { ...t, prixC: arrondiEuro(t.prixC * k * coefPrix), minutes: Math.round(t.minutes * k) };
}
/** Packs limités aux tâches proposées pour le type : vide → masqué ; deux packs identiques → on garde le plus remisé. */
export function packsPour(r, typeLieuId) {
  const ids = tachesPour(r, typeLieuId).map(t => t.id);
  const garde = new Map();
  for (const p of r.packs.map(p => ({ ...p, tacheIds: p.tacheIds.filter(id => ids.includes(id)) })).filter(p => p.tacheIds.length)) {
    const cle = [...p.tacheIds].sort().join(",");
    if (!garde.has(cle) || garde.get(cle).remisePct < p.remisePct) garde.set(cle, p);
  }
  return [...garde.values()];
}
/** Remise d'un pack : un pourcentage du prix de SES tâches, arrondi à l'euro. */
export const remisePack = (p, chiffrees) => arrondiEuro(chiffrees.filter(t => p.tacheIds.includes(t.id)).reduce((s, t) => s + t.prixC, 0) * p.remisePct / 100);

/* Canapés et textiles : éléments du panier, prix forfaitaires TTC (la durée sert au planning, pas au prix). */
const E = (id, nom, formuleId, prixC, minutes, o = {}) => ({ id, nom, formuleId, prixC, minutes, avecTaille: false, parM2: false, ...o });
export const ELEMENTS_TEXTILES = [
  E("canape_droit", "Canapé droit", "canape", 6900, 60, { avecTaille: true }), E("canape_angle", "Canapé d'angle", "canape", 10900, 105, { avecTaille: true }),
  E("convertible", "Convertible", "canape", 8900, 75, { avecTaille: true }), E("meridienne", "Méridienne", "canape", 8900, 75, { avecTaille: true }),
  E("modulable", "Modulable / panoramique", "canape", 13900, 120, { avecTaille: true }), E("fauteuil", "Fauteuil", "canape", 4500, 30),
  E("matelas_bebe", "Matelas bébé", "matelas", 3900, 30), E("matelas_1", "Matelas 1 personne", "matelas", 5500, 45),
  E("matelas_2", "Matelas 2 personnes", "matelas", 7500, 60), E("matelas_grand", "Matelas grand lit (160 cm et +)", "matelas", 8900, 75),
  E("tapis_2", "Tapis jusqu'à 2 m", "tapis", 4500, 30), E("tapis_3", "Tapis de 2 à 3 m", "tapis", 6500, 45),
  E("tapis_plus", "Tapis de plus de 3 m", "tapis", 8500, 60), E("moquette", "Moquette", "tapis", 600, 4, { parM2: true }),
];
/** Supplément de taille des canapés (prix et durée). */
export const TAILLES_CANAPE = [
  { id: "t15", libelle: "< 1,5 m", prixC: 0, minutes: 0 }, { id: "t20", libelle: "1,5 – 2 m", prixC: 1000, minutes: 15 },
  { id: "t25", libelle: "2 – 2,5 m", prixC: 2000, minutes: 30 }, { id: "t30", libelle: "2,5 – 3 m", prixC: 3000, minutes: 45 },
  { id: "t3p", libelle: "> 3 m", prixC: 4000, minutes: 60 },
];
export const elementTextile = id => ELEMENTS_TEXTILES.find(e => e.id === id);
const tailleCanape = id => TAILLES_CANAPE.find(t => t.id === id);
/** Une ligne du panier : { elementId, tailleId, quantite, surfaceM2 } (LignePanier dans l'appli). */
export function prixLigne(l) {
  const e = elementTextile(l.elementId); if (!e) return 0;
  const u = e.parM2 ? e.prixC * (l.surfaceM2 || 0) : e.prixC + (e.avecTaille ? tailleCanape(l.tailleId)?.prixC || 0 : 0);
  return u * (l.quantite || 1);
}
export function minutesLigne(l) {
  const e = elementTextile(l.elementId); if (!e) return 0;
  const u = e.parM2 ? e.minutes * (l.surfaceM2 || 0) : e.minutes + (e.avecTaille ? tailleCanape(l.tailleId)?.minutes || 0 : 0);
  return u * (l.quantite || 1);
}
/** « Canapé d'angle 2 – 2,5 m × 1 », « Moquette · 12 m² × 1 », « Fauteuil × 2 ». */
export function libelleLigne(l) {
  const e = elementTextile(l.elementId); if (!e) return "";
  const taille = e.avecTaille ? tailleCanape(l.tailleId)?.libelle || "" : "";
  const q = l.quantite || 1;
  return e.parM2 ? `${e.nom} · ${l.surfaceM2} m² × ${q}` : taille ? `${e.nom} ${taille} × ${q}` : `${e.nom} × ${q}`;
}

/** Montant rond sans centimes : 3500 → « 35 € ». */
const eurosRond = c => (c % 100 === 0 ? euros(c).replace(",00", "") : euros(c));
/** Pastille du catalogue : « dès 26,90 € / h », « dès 35 € le ménage », « dès 40 € », « dès 45 € l'élément ». */
export function pastille(r) {
  if (r.toujoursSurDevis || r.tauxHoraireC == null) return "Sur devis";
  switch (r.affichagePrix) {
    case "PAR_MENAGE": return `dès ${eurosRond(REGLES.MINIMUM_MENAGE_LOCATION_C)} le ménage`;
    case "MINIMUM_COMMANDE": return `dès ${eurosRond(REGLES.MINIMUM_COMMANDE_VEHICULE_C)}`;
    case "PAR_ELEMENT": return `dès ${eurosRond(REGLES.PRIX_APPEL_TEXTILES_C)} l'élément`;
    default: return `dès ${euros(r.tauxHoraireC)} / h`;
  }
}

export const RACCOURCIS_VITRINE = [
  ["home", "Ménage", "Ponctuel ou régulier"], ["rental", "Location saisonnière", "Entre deux voyageurs"],
  ["textiles", "Canapé", "Shampoing, détachage"], ["windows", "Vitres", "Fenêtres et baies"],
  ["car", "Voiture", "Intérieur, extérieur — À la carte"], ["office", "Bureaux", "Locaux et commerces"],
];
export const RUBRIQUES_CREDIT_IMPOT = ["home", "windows", "textiles"];
export const TYPES_VITRES_ELIGIBLES = ["fenetres_logement", "baies_veranda"];

export const TYPES_LOGEMENT = [
  { id: "studio", nom: "Studio", surface: 25, chambres: 0, sdb: 1, niveaux: 1 },
  { id: "appartement", nom: "Appartement", surface: 62, chambres: 2, sdb: 1, niveaux: 1 },
  { id: "maison", nom: "Maison", surface: 110, chambres: 3, sdb: 2, niveaux: 2 },
  { id: "duplex", nom: "Duplex / loft", surface: 90, chambres: 2, sdb: 1, niveaux: 2 },
];

/** Type de lieu : coefficient de temps (prix pour les véhicules) et texte « Inclus » propre au type (vide = celui de la rubrique). */
const L = (id, nom, coef, inclus = "") => ({ id, nom, coef, inclus });
export const TYPES_LIEU = {
  office: [L("bureaux", "Bureaux", 1.0), L("boutique", "Local commercial / boutique", 1.1), L("magasin", "Magasin / supérette", 1.15),
    L("medical", "Cabinet médical", 1.2), L("agence", "Agence / accueil du public", 1.05), L("showroom", "Showroom / galerie", 1.1),
    L("entrepot", "Entrepôt", 0.7), L("atelier", "Atelier", 0.9), L("sport", "Salle de sport", 1.15)],
  kitchen: [L("particulier", "Particulier", 1.0), L("restaurant", "Restaurant", 1.1), L("hotel", "Hôtel", 1.1),
    L("collectivite", "Collectivité / cantine", 1.1), L("boulangerie", "Boulangerie, traiteur, labo", 1.15), L("foodtruck", "Food truck", 1.0)],
  communal: [L("copro", "Immeuble résidentiel / copropriété", 1.0), L("residence", "Résidence services", 1.1),
    L("immeuble_bureaux", "Immeuble de bureaux", 1.0), L("parking", "Parking / sous-sol", 0.7)],
  windows: [L("fenetres_logement", "Fenêtres d'un logement", 1.0), L("baies_veranda", "Baies vitrées et véranda", 1.1),
    L("vitrine_commerce", "Vitrine de commerce", 1.0), L("facades", "Bureaux et façades vitrées", 1.1)],
  outdoor: [L("terrasse", "Terrasse / balcon", 1.0), L("jardin", "Jardin, allées et cour", 1.0), L("garage", "Garage, cave ou abri", 0.9),
    L("piscine", "Abords de piscine", 1.1), L("cour_immeuble", "Cour d'immeuble / parking", 0.9)],
  event: [L("mariage", "Mariage / réception", 1.1), L("fete", "Fête privée à domicile", 1.0), L("seminaire", "Séminaire d'entreprise", 1.0),
    L("salon", "Salon / exposition", 1.1), L("anniversaire", "Anniversaire en salle", 1.0)],
  construction: [L("carrelage", "Carrelage", 1.0), L("parquet", "Parquet", 1.15), L("beton", "Béton ciré", 1.0),
    L("lino", "Lino / PVC", 0.9), L("moquette", "Moquette", 1.25), L("pierre", "Pierre naturelle", 1.2)],
  car: [L("citadine", "Citadine", 1.0), L("berline", "Berline", 1.15), L("suv", "SUV", 1.3), L("utilitaire", "Utilitaire", 1.45)],
};

export function formulesPour(r) {
  if (r.formules.length) return r.formules;
  switch (r.id) {
    case "construction": return [F("standard", "Nettoyage de fin de chantier", "Le niveau de salissure sera estimé dès que toutes les photos seront exploitables.", 12, 120)];
    case "kitchen": return [F("apres_service", "Après service", "", 25, 60, 1.0), F("degraissage", "Dégraissage approfondi", "", 25, 60, 1.5), F("controle", "Grand nettoyage avant contrôle sanitaire", "", 25, 60, 1.8)];
    case "office": return [F("regulier", "Entretien régulier", "", 60, 60, 1.0), F("ponctuel", "Nettoyage ponctuel", "", 60, 60, 1.15), F("remise", "Remise en état des locaux", "", 60, 60, 1.6)];
    case "communal": return [F("regulier", "Entretien régulier", "", 80, 60, 1.0), F("ponctuel", "Ponctuel", "", 80, 60, 1.15), F("remise", "Remise en état", "", 80, 60, 1.6)];
    case "windows": return [F("ponctuel", "Ponctuel", "15 min par fenêtre, minimum 1 h 30.", 0, 90, 1.0), F("regulier", "Entretien régulier", "", 0, 90, 0.9), F("travaux", "Après travaux", "", 0, 90, 1.5)];
    case "outdoor": return [F("ponctuel", "Ponctuel", "", 40, 60, 1.0), F("demoussage", "Remise en état et démoussage", "", 40, 60, 1.5), F("saisonnier", "Entretien saisonnier", "", 40, 60, 0.9)];
    case "event": return [F("avant", "Avant l'événement", "", 50, 60, 0.9), F("apres", "Après", "", 50, 60, 1.2), F("avant_apres", "Avant et après (2 passages)", "", 50, 60, 2.0)];
    default: return [F("standard", "Standard", "", 25, 60)];
  }
}

export const BESOINS_SPECIAUX = [["desinfection", "Désinfection approfondie"], ["encombre", "Logement très encombré"], ["sinistre", "Après sinistre"], ["deces", "Nettoyage après décès"]];

export const ACCUEIL = { PRESENT: "Je serai présent", TIERS: "Concierge / tiers", BOITE: "Boîte à clés", AUTONOME: "Accès autonome" };

/** Chez les professionnels : pas d'accès autonome ni de boîte à clés. */
export const accueilAutonomeInterdit = (rubriqueId, typeLieuId) =>
  ["office", "communal", "event"].includes(rubriqueId) || (rubriqueId === "windows" && ["vitrine_commerce", "facades"].includes(typeLieuId));
export const photosObligatoires = rubriqueId => ["moving", "construction", "kitchen"].includes(rubriqueId);
