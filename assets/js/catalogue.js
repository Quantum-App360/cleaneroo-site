// Catalogue des prestations : copie EXACTE de Catalogue.kt et de Reservation.kt (application Android).
import { REGLES, euros } from "./regles.js";
/** Tâche : groupe = intertitre ; parSurface = chiffrée pour la surface de référence, au prorata au-delà ; types = types de lieu (vide = tous). */
const T = (id, nom, prixC, minutes, o = {}) => ({ id, nom, prixC, minutes, groupe: "", parSurface: false, types: [], parConvives: false, ...o });
/** Genre de formule : décide des questions affichées sous les formules (GenreFormule dans l'appli). */
export const genreParDefaut = id => ({ regulier: "REGULIER", saisonnier: "REGULIER", ponctuel: "PONCTUEL", remise: "REMISE_EN_ETAT", demoussage: "REMISE_EN_ETAT" })[id] || "AUTRE";
/** avecDernierNettoyage : pose aussi « Dernier nettoyage en profondeur » (ex. Grand ménage) ; avecNatures : « Nature des salissures ». */
const F = (id, nom, description = "", m2ParHeure = 0, minimumMin = 0, coef = 1.0, genre = genreParDefaut(id), avecDernierNettoyage = genre === "REMISE_EN_ETAT", avecNatures = avecDernierNettoyage) =>
  ({ id, nom, description, m2ParHeure, minimumMin, coef, genre, avecDernierNettoyage, avecNatures });
/** Cuisines : types d'établissement professionnels. */
export const PROS_CUISINE = ["restaurant", "hotel", "collectivite", "boulangerie", "foodtruck"];

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
const confort = ["draps", "poubelles", "hauteurs", "plinthes", "vitres", "frigo", "microondes", "lessive"];
const prestige = [...confort, "four", "hotte", "placards_cuisine", "placards_armoires", "repassage", "balcon"];
const packsLogement = [
  { id: "confort", nom: "Confort", remisePct: 10, tacheIds: confort },
  { id: "prestige", nom: "Premium", remisePct: 15, tacheIds: prestige },
];

/* ---- Location saisonnière : étapes et consommables (généré) ---- */
/* Bibliothèque d'étapes par pièce et consommables à contrôler : même contenu que Location.kt (appli). */
export const PIECES_LOCATION = [["chambre", "Chambre"], ["sdb", "Salle de bain"], ["cuisine", "Cuisine"], ["sejour", "Séjour"], ["exterieur", "Extérieur"], ["entree", "Entrée et général"]];
/** minutes = temps ajouté (0 = incluse ; 20/11/2026 : four, micro-ondes, réfrigérateur, lave-vaisselle et dessous des lits inclus dans le Standard). « Chambre » : une fois par chambre ; « Salle de bain » : une fois par salle de bain. */
export const ETAPES_LOCATION = [
  { id: "lit_draps", nom: "Faire le lit avec des draps propres", piece: "chambre", minutes: 0 },
  { id: "changer_draps", nom: "Changer les draps et taies", piece: "chambre", minutes: 0 },
  { id: "serviettes_lit", nom: "Disposer les serviettes sur le lit", piece: "chambre", minutes: 0 },
  { id: "plaids", nom: "Plier plaids et couvertures", piece: "chambre", minutes: 0 },
  { id: "sous_lit", nom: "Vérifier sous le lit et les meubles", piece: "chambre", minutes: 0 },
  { id: "placards", nom: "Vider et ranger les placards / dressing", piece: "chambre", minutes: 10 },
  { id: "cintres", nom: "Remettre les cintres", piece: "chambre", minutes: 0 },
  { id: "douche", nom: "Nettoyer douche / baignoire et joints", piece: "sdb", minutes: 0 },
  { id: "lavabo", nom: "Nettoyer lavabo, robinetterie et miroir", piece: "sdb", minutes: 0 },
  { id: "wc", nom: "Nettoyer et désinfecter les WC", piece: "sdb", minutes: 0 },
  { id: "serviettes_sdb", nom: "Disposer les serviettes propres", piece: "sdb", minutes: 0 },
  { id: "savon", nom: "Remettre savon, gel douche, shampoing", piece: "sdb", minutes: 0 },
  { id: "seche_cheveux", nom: "Vérifier sèche-cheveux et rangements", piece: "sdb", minutes: 0 },
  { id: "plan_travail", nom: "Nettoyer plan de travail et évier", piece: "cuisine", minutes: 0 },
  { id: "plaques", nom: "Nettoyer plaques, four et micro-ondes", piece: "cuisine", minutes: 0 },
  { id: "frigo", nom: "Vider et nettoyer le réfrigérateur", piece: "cuisine", minutes: 0 },
  { id: "lave_vaisselle", nom: "Vider le lave-vaisselle et ranger la vaisselle", piece: "cuisine", minutes: 0 },
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
/** Sélection de départ (7 novembre 2026, demande de l'utilisateur) : toutes les étapes incluses (sans supplément) sont cochées d'office. */
export const ETAPES_DEPART = () => [...new Set([...ETAPES_LOCATION.filter(e => !e.minutes).map(e => e.id), ...PACK_ETAPES_CONSEILLE])];
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
/** Forfait d'une option selon sa durée : petite 2 €, moyenne 4 €, grande 6 € (REGLES.OPTION_*). */
/** Refonte du 20/11/2026 : une étape en plus est payée au temps réel (30 €/h, arrondi à l'euro, 3 € au moins). */
export const forfaitOptionC = minutes => Math.max(REGLES.OPTION_MIN_C, Math.round(minutes * REGLES.OPTION_TAUX_HORAIRE_C / 60 / 100) * 100);
/** Prix d'une étape en plus (centimes) : son forfait, une fois par chambre ou salle de bain concernée ; 0 si incluse. */
export const prixEtapeLocationC = (e, chambres, sdb) => (e.minutes ? forfaitOptionC(e.minutes) * repetitionsEtape(e, chambres, sdb) : 0);
/** Prix de toutes les étapes en plus choisies et des étapes personnalisées (centimes). */
export const prixOptionsLocationC = (choisies, perso, chambres, sdb) =>
  ETAPES_LOCATION.filter(e => choisies.includes(e.id)).reduce((s, e) => s + prixEtapeLocationC(e, chambres, sdb), 0) + perso * forfaitOptionC(REGLES.ETAPE_PERSO_LOCATION_MIN);
/** Temps ajouté par les étapes choisies et les étapes personnalisées (minutes). */
export const minutesEtapesLocation = (choisies, perso, chambres, sdb) =>
  ETAPES_LOCATION.filter(e => choisies.includes(e.id)).reduce((s, e) => s + e.minutes * repetitionsEtape(e, chambres, sdb), 0) + perso * REGLES.ETAPE_PERSO_LOCATION_MIN;
/** Nombre d'étapes à valider en photo (répétitions comprises). */
export const nombreEtapesLocation = (choisies, perso, chambres, sdb) =>
  ETAPES_LOCATION.filter(e => choisies.includes(e.id)).reduce((s, e) => s + repetitionsEtape(e, chambres, sdb), 0) + perso;
/* ---- fin location ---- */

/** « Non inclus » affiché sous chaque formule (lot 4 de la refonte du 20/11/2026) : le client sait ce qu'il n'achète pas. */
const NON_INCLUS = {
  home: "Déplacement de meubles lourds, travaux, nettoyage en hauteur au-delà d'un escabeau, linge fourni par Cleaneroo.",
  car: "Lavage à l'eau à domicile, réparation de carrosserie, carénage.",
  textiles: "Cuir abîmé, tissus non lavables à l'eau (étiquette « S » ou « X »), garantie de disparition des taches anciennes.",
  leisure: "Réparation, vidange des eaux usées hors cassette, mécanique.",
  boat: "Carénage (aire agréée obligatoire), mécanique, gréement.",
  hospitality: "Linge fourni par Cleaneroo, maintenance technique.",
  construction: "Évacuation de gravats, déchets de chantier en benne, décollage de peinture ou de ciment sur de grandes surfaces.",
  kitchen: "Démontage technique des équipements, dégraissage des gaines d'extraction en toiture.",
  office: "Vitres extérieures en hauteur, travaux, désinfection biocide professionnelle.",
  commerce: "Vitres en hauteur sans accès sécurisé, évacuation de déchets volumineux.",
  communal: "Encombrants, traitement des nuisibles, entretien des espaces verts (tonte, taille).",
  windows: "Vitres au-delà de 6 m ou sans accès sécurisé (sur devis), réparation de joints.",
  outdoor: "Tonte, taille, élagage, nettoyage de toitures.",
  event: "Location de vaisselle, service en salle, évacuation de déchets en benne.",
  special: "Travaux de réparation après sinistre, débarras de mobilier volumineux sans visite préalable.",
};
export const RUBRIQUES = [
  { id: "home", nom: "Ménage du logement", sousTitre: "Ménage ponctuel ou régulier", icone: "logement", tauxHoraireC: 2690, salissureSurTemps: true,
    inclus: "Dépoussiérage des surfaces accessibles, aspiration et lavage des sols, cuisine, salle de bain et WC, poubelles, lits faits.",
    formules: [F("ponctuel", "Ménage ponctuel", "Un ménage complet, une seule fois.", 25, 120),
      F("regulier", "Entretien régulier", "Chaque semaine ou tous les 15 jours, idéalement avec le même Cleaneur.", 30, 90)],
    // 18/11/2026 : « Grand ménage » n'est plus un type de ménage, c'est le niveau Premium (plus de doublon entre les deux choix).
    titreFormules: "À quelle fréquence ?", sousTitrePremium: "Le grand ménage, du sol au plafond",
    taches: tachesLogement, packs: packsLogement, surfaceReferenceM2: 60,
    occasions: [{ id: "printemps", nom: "Ménage de printemps", packId: "prestige" }, { id: "recevoir", nom: "Avant de recevoir", packId: "confort" },
      { id: "vacances", nom: "Retour de vacances", packId: "", tachesEnPlus: ["frigo"] }, { id: "vente", nom: "Avant une vente ou une location", packId: "prestige" },
      { id: "autre", nom: "Autre", packId: "" }],
    frequences: [["semaine", "Chaque semaine"], ["deux_semaines", "Toutes les 2 semaines"], ["mois", "Chaque mois"]],
    moments: [["matin", "Le matin"], ["apres_midi", "L'après-midi"], ["peu_importe", "Peu importe"]] },
  { id: "rental", nom: "Location saisonnière", sousTitre: "Prêt pour vos prochains voyageurs", icone: "location", tauxHoraireC: 3000, salissureSurTemps: true, affichagePrix: "PAR_MENAGE",
    inclus: "Ménage complet entre deux voyageurs, lits faits avec le linge fourni sur place, cuisine (four, micro-ondes et réfrigérateur compris) et sanitaires désinfectés, contrôle des consommables, objets oubliés et dégradations signalés, photos de chaque pièce pour l'hôte.",
    // Refonte du 20/11/2026 (audit validé) : trois niveaux de service ; la durée du séjour ajoute du temps (question à part).
    // Temps : Confort ×1,4, Premium ×2,1 ; taux : 30 €/h, 28,50 €/h, 27 €/h (plancher). Studio 37,50 / 52 / 74 €, T3 67,50 / 92 / 128 €.
    formules: [{ ...F("standard", "Standard", "Rotation complète entre deux voyageurs.", 0, 0, 1.0), tauxC: REGLES.TAUX_LOCATION_C.standard },
      { ...F("confort", "Confort", "Standard + finitions approfondies.", 0, 0, 1.4), tauxC: REGLES.TAUX_LOCATION_C.confort },
      { ...F("premium", "Premium", "Remise à niveau du logement, extérieurs compris.", 0, 0, 2.1, "AUTRE", true), tauxC: REGLES.TAUX_LOCATION_C.premium }],
    titreFormules: "Niveau de ménage",
    nonInclus: "Démontage technique, plomberie, ventilation, linge fourni par Cleaneroo, achat des consommables, encombrants.",
    naturesSalissure: NATURES_SALISSURE_LOCATION },
  { id: "moving", nom: "Déménagement", sousTitre: "Un nouveau départ, du sol au plafond", icone: "demenagement", tauxHoraireC: 3200, salissureSurTemps: true,
    // Refonte du 20/11/2026 : l'intérieur du four, du réfrigérateur, des placards de cuisine, le détartrage et les sanitaires sont inclus dès le Standard
    // (un état des lieux les contrôle toujours) ; minimum 149 € (4 h 40).
    inclus: "Logement vide, toutes les pièces : sols, plinthes, portes, poignées, interrupteurs, radiateurs dépoussiérés, vitres intérieures. Cuisine : intérieur du four, du réfrigérateur, des placards et tiroirs. Sanitaires détartrés et désinfectés, joints nettoyés. Traces d'adhésif. Photos avant et après.",
    nonInclus: "Peinture, rebouchage, réparation, débarras de meubles.",
    formules: [F("emmenagement", "Nettoyage d'emménagement", "Logement vide, nettoyé avant votre arrivée", 9, 280, 1.0),
      F("depart", "Nettoyage de départ / état des lieux", "Logement vidé, remis au propre pour l'état des lieux de sortie", 9, 280, 1.1)],
    // Tâches propres au déménagement (« à la surface » = chiffré pour 60 m²) et packs propres
    taches: [
      T("hotte", "Hotte et filtres", 1500, 20, { groupe: "Cuisine" }),
      T("penderies", "Intérieur des placards et penderies", 3000, 40, { groupe: "Pièces et rangements", parSurface: true }),
      T("vitres", "Vitres et encadrements", 3000, 45, { groupe: "Pièces et rangements", parSurface: true }),
      T("volets", "Volets et stores", 2500, 30, { groupe: "Pièces et rangements", parSurface: true }),
      T("murs", "Traces sur les murs (lessivage localisé)", 3500, 45, { groupe: "Pièces et rangements", parSurface: true }),
      T("detartrage", "Détartrage complet des parois et carrelages", 2500, 30, { groupe: "Salle de bains" }),
      T("balcon", "Balcon ou terrasse", 2000, 25, { groupe: "Extérieurs et annexes" }),
      T("cave", "Cave ou garage (balayage, dépoussiérage)", 3500, 45, { groupe: "Extérieurs et annexes" }),
    ],
    packs: [
      { id: "confort", nom: "Confort", remisePct: 10, tacheIds: ["vitres", "penderies", "volets", "hotte", "murs"] },
      { id: "prestige", nom: "Premium", remisePct: 15, tacheIds: ["vitres", "penderies", "volets", "hotte", "murs", "balcon", "detartrage"] },
    ],
    surfaceReferenceM2: 60,
    naturesSalissure: ["Poussière de travaux", "Calcaire", "Graisse", "Traces et marques", "Moisissures", "Odeurs"] },
  { id: "car", nom: "Véhicules", sousTitre: "Nettoyage intérieur et extérieur", icone: "vehicule", tauxHoraireC: 4000, salissureSurTemps: false, affichagePrix: "MINIMUM_COMMANDE",
    inclus: "100 % à la carte : choisissez les tâches. À domicile ou sur la voie publique, lavage sans eau uniquement (produits sans rinçage).",
    // Prix « citadine » ; le gabarit (100 / 115 / 130 / 145 %) s'applique au prix ET à la durée de chaque tâche.
    taches: [
      T("aspiration", "Aspiration complète (sièges, tapis, coffre)", 2500, 30, { groupe: "Intérieur" }),
      T("tableau", "Dépoussiérage plastiques et tableau de bord", 1000, 15, { groupe: "Intérieur" }),
      T("vitres_int", "Vitres intérieures", 800, 10, { groupe: "Intérieur" }),
      T("plastiques_protection", "Plastiques intérieurs : nettoyage + protection", 1500, 20, { groupe: "Intérieur" }),
      T("shampoing_sieges", "Shampoing des sièges tissu", 3500, 45, { groupe: "Intérieur" }),
      T("cuir", "Nettoyage et nourrissage du cuir", 4000, 45, { groupe: "Intérieur" }),
      T("moquettes", "Shampoing moquettes et tapis", 2500, 30, { groupe: "Intérieur" }),
      T("coffre", "Nettoyage du coffre", 1000, 15, { groupe: "Intérieur" }),
      T("ciel", "Ciel de toit", 2000, 20, { groupe: "Intérieur" }),
      T("poils", "Poils d'animaux", 2000, 20, { groupe: "Intérieur" }),
      T("anti_odeurs", "Traitement anti-odeurs", 2000, 15, { groupe: "Intérieur" }),
      T("lavage_main", "Lavage extérieur sans eau, à la main", 2500, 40, { groupe: "Extérieur" }),
      T("vitres_ext", "Vitres extérieures", 700, 10, { groupe: "Extérieur" }),
      T("jantes", "Jantes et pneus (nettoyage + brillant pneus)", 2000, 25, { groupe: "Extérieur" }),
      T("decontamination", "Décontamination des jantes (dépôts de freins)", 3000, 30, { groupe: "Extérieur" }),
      T("bas_caisse", "Bas de caisse et passages de roues", 1500, 20, { groupe: "Extérieur" }),
      T("cire", "Cire de protection carrosserie", 3500, 30, { groupe: "Rénovation et protection" }),
      T("optiques", "Rénovation des optiques de phares", 4500, 40, { groupe: "Rénovation et protection" }),
      T("polissage", "Polissage carrosserie (lustrage 1 étape)", 15000, 180, { groupe: "Rénovation et protection" }),
      T("moteur", "Compartiment moteur (nettoyage à sec)", 3000, 30, { groupe: "Rénovation et protection" }),
    ],
    packs: [
      { id: "confort", nom: "Confort", remisePct: 10, tacheIds: ["aspiration", "tableau", "vitres_int", "coffre", "lavage_main", "vitres_ext", "jantes"] },
      { id: "prestige", nom: "Premium", remisePct: 15, tacheIds: ["aspiration", "tableau", "vitres_int", "coffre", "lavage_main", "vitres_ext", "jantes", "plastiques_protection", "moquettes", "anti_odeurs", "bas_caisse", "cire"] },
    ] },
  { id: "textiles", nom: "Canapés et textiles", sousTitre: "Canapés, matelas et tapis", icone: "canape", tauxHoraireC: 3000, salissureSurTemps: false, affichagePrix: "PAR_ELEMENT",
    inclus: "Aspiration en profondeur · Shampoing par injection-extraction · Traitement des taches courantes",
    formules: [F("canape", "Canapé"), F("matelas", "Matelas"), F("tapis", "Tapis et moquettes")],
    taches: [T("detachage", "Détachage ciblé (taches tenaces)", 1500, 15, { groupe: "Traitements" }), T("acariens", "Traitement anti-acariens", 2000, 15, { groupe: "Traitements" }),
      T("desodorisation", "Désodorisation", 1000, 10, { groupe: "Traitements" }), T("protection", "Protection anti-taches", 2500, 15, { groupe: "Traitements" }),
      T("sechage", "Séchage accéléré (ventilation)", 1000, 10, { groupe: "Traitements" })],
    packs: [
      { id: "confort", nom: "Confort", remisePct: 10, tacheIds: ["detachage", "desodorisation", "acariens"] },
      { id: "prestige", nom: "Premium", remisePct: 15, tacheIds: ["detachage", "desodorisation", "acariens", "protection", "sechage"] },
    ] },
  // Vans, camping-cars et caravanes (16 novembre 2026) : prix au mètre de longueur (36 €/h ; extérieur ≈ 9 €/m, cellule ≈ 12 €/m, complet ≈ 21 €/m).
  { id: "leisure", nom: "Vans, camping-cars et caravanes", sousTitre: "Extérieur et cellule, prix au mètre", icone: "vehicule", tauxHoraireC: 3600, salissureSurTemps: false,
    titreTypes: "Type de véhicule", surfaceReferenceM2: 7,
    inclus: "Carrosserie et jantes lavées à la main · Cellule : cuisine, sanitaires, couchages, sols et vitres · Produits adaptés aux joints et au polyester",
    formules: [F("exterieur", "Extérieur", "Carrosserie, jantes, vitres et marchepied", 4, 135, 1.0, "PONCTUEL", false, false),
      F("interieur", "Cellule intérieure", "Cuisine, sanitaires, couchages, rangements et sols", 4, 100, 1.333, "PONCTUEL", false, false),
      F("complet", "Complet", "Extérieur et cellule intérieure", 4, 60, 2.333, "PONCTUEL", false, false)],
    taches: [T("toit", "Toit et lanterneaux", 2500, 30, { groupe: "Extérieur", parSurface: true }), T("store", "Store et auvent", 2000, 20, { groupe: "Extérieur" }),
      T("demoussage_toit", "Démoussage du toit", 4000, 45, { groupe: "Extérieur", parSurface: true }),
      T("reservoir", "Désinfection du réservoir d'eau propre", 3500, 30, { groupe: "Cellule" }), T("cassette", "Nettoyage de la cassette WC", 2500, 20, { groupe: "Cellule" }),
      T("banquettes", "Banquettes et matelas (shampoing)", 3500, 40, { groupe: "Cellule" }), T("hivernage", "Préparation à l'hivernage", 4500, 45, { groupe: "Cellule" })],
    packs: [] },
  // Bateaux (16 novembre 2026) : prix au mètre de longueur (36 €/h ; rinçage ≈ 6 €/m, entretien ≈ 15 €/m, remise en état ≈ 28 €/m). Carénage exclu.
  { id: "boat", nom: "Bateaux", sousTitre: "Rinçage, entretien et remise en état, prix au mètre", icone: "bateau", tauxHoraireC: 3600, salissureSurTemps: false,
    titreTypes: "Type de bateau", surfaceReferenceM2: 10,
    inclus: "Pont, cockpit et coque au-dessus de la ligne de flottaison · Produits adaptés au gelcoat et au milieu marin · Photos avant et après · Carénage exclu (aire agréée obligatoire)",
    formules: [F("rincage", "Rinçage après sortie", "Rinçage à l'eau douce, pont, cockpit et inox", 6, 80, 1.0, "PONCTUEL", false, false),
      F("entretien", "Entretien complet", "Extérieur et intérieur : cabines, carré, cuisine, sanitaires", 6, 40, 2.5, "PONCTUEL", false, false),
      F("saison", "Entretien régulier en saison", "Pendant votre absence, à la fréquence choisie", 6, 40, 2.25, "REGULIER", false, false),
      F("remise", "Remise en état (début ou fin de saison)", "Nettoyage en profondeur avant la mise à l'eau ou l'hivernage", 6, 30, 4.67, "AUTRE", false, false)],
    taches: [T("lustrage", "Lustrage et polish de la coque (hors carène)", 18000, 300, { groupe: "Coque et pont", parSurface: true }),
      T("teck", "Nettoyage et éclaircissement du teck", 8000, 120, { groupe: "Coque et pont", parSurface: true }),
      T("anti_uv", "Protection anti-UV du gelcoat", 5000, 60, { groupe: "Coque et pont", parSurface: true }), T("inox", "Inox et accastillage", 4000, 60, { groupe: "Coque et pont" }),
      T("sellerie", "Sellerie, coussins et bains de soleil", 4000, 45, { groupe: "Intérieur" }), T("hublots", "Vitres, hublots et plexiglas", 2500, 30, { groupe: "Intérieur" }),
      T("wc_marin", "Toilettes marines désinfectées", 2500, 25, { groupe: "Intérieur" }), T("frigo_bateau", "Réfrigérateur et coffres", 2000, 20, { groupe: "Intérieur" })],
    packs: [] },
  // Hôtels et campings (16 novembre 2026) : rotations, renforts et saisons, au forfait par logement (panier comme les textiles).
  { id: "hospitality", nom: "Hôtels et campings", sousTitre: "Mobil-homes, chalets et chambres au forfait", icone: "location", tauxHoraireC: 3000, salissureSurTemps: false, affichagePrix: "PAR_ELEMENT",
    inclus: "Linge changé (fourni par l'établissement) · Cuisine et sanitaires désinfectés · Sols, poussières et poubelles · Photo de contrôle par logement",
    formules: [F("camping", "Camping"), F("hotel", "Hôtel"), F("communs", "Espaces communs")],
    taches: [T("terrasse", "Terrasse et salon de jardin", 800, 10, { groupe: "Options par intervention" }), T("reassort", "Réassort des produits d'accueil", 500, 5, { groupe: "Options par intervention" }),
      T("vitres_heb", "Vitres et baies vitrées", 1000, 15, { groupe: "Options par intervention" })],
    packs: [] },
  { id: "construction", nom: "Fin de chantier", sousTitre: "Éliminer la poussière après les travaux", icone: "chantier", tauxHoraireC: 3800, salissureSurTemps: true,
    inclus: "Aspiration des poussières de chantier (filtre HEPA) · Sols lavés selon leur nature · Vitres et menuiseries intérieures · Sanitaires et cuisine · Retrait des traces et étiquettes courantes",
    taches: [T("etiquettes", "Retrait des étiquettes et films de protection", REGLES.OPTION_GENERIQUE_C, REGLES.OPTION_GENERIQUE_MIN, { groupe: "Options" }), T("residus", "Résidus de plâtre ou de peinture au sol", REGLES.OPTION_GENERIQUE_C, REGLES.OPTION_GENERIQUE_MIN, { groupe: "Options" }), T("dechets", "Évacuation de déchets légers (sacs)", REGLES.OPTION_GENERIQUE_C, REGLES.OPTION_GENERIQUE_MIN, { groupe: "Options" })] },
  { id: "kitchen", nom: "Cuisines", sousTitre: "Nettoyage approfondi et dégraissage", icone: "cuisine", tauxHoraireC: 3600, salissureSurTemps: true,
    formules: [F("apres_service", "Après service", "", 25, 60, 1.0, "REGULIER"), F("degraissage", "Dégraissage approfondi", "", 25, 60, 1.5, "AUTRE", false, true),
      F("controle", "Grand nettoyage avant contrôle sanitaire", "", 25, 60, 1.8, "AUTRE", false, true)],
    taches: [
    T("murs", "Murs et faïence", 3500, 45, { groupe: "Sols, murs et plafonds", parSurface: true }),
    T("plinthes", "Plinthes, angles et gorges", 1500, 15, { groupe: "Sols, murs et plafonds", parSurface: true, types: PROS_CUISINE }),
    T("siphons", "Siphons et caniveaux de sol (démontage, curage)", 2500, 20, { groupe: "Sols, murs et plafonds", types: PROS_CUISINE }),
    T("plafond", "Plafond et luminaires", 3500, 40, { groupe: "Sols, murs et plafonds", parSurface: true, types: PROS_CUISINE }),
    T("aerations", "Grilles et bouches d'aération", 2000, 20, { groupe: "Sols, murs et plafonds" }),
    T("vitres", "Vitres et portes vitrées", 1500, 20, { groupe: "Sols, murs et plafonds" }),
    T("poignees", "Portes, poignées et interrupteurs (désinfection)", 1200, 15, { groupe: "Sols, murs et plafonds" }),
    T("eviers", "Éviers, robinetterie et détartrage", 1500, 15, { groupe: "Plonge, réserve et annexes" }),
    T("congelateur", "Dégivrage et nettoyage d'un congélateur", 2500, 30, { groupe: "Plonge, réserve et annexes" }),
    T("reserve", "Étagères et rayonnages de la réserve", 3000, 30, { groupe: "Plonge, réserve et annexes", types: PROS_CUISINE }),
    T("chariots", "Chariots, bacs gastro et ustensiles", 2000, 25, { groupe: "Plonge, réserve et annexes", types: PROS_CUISINE }),
    T("poubelles", "Poubelles et local poubelles (lavage, désinfection)", 2500, 25, { groupe: "Plonge, réserve et annexes", types: PROS_CUISINE }),
    T("vestiaires", "Vestiaires et sanitaires du personnel", 3500, 40, { groupe: "Plonge, réserve et annexes", types: PROS_CUISINE }),
    T("salle", "Salle de service : tables, chaises et sols (jusqu'à 40 couverts)", 4500, 60, { groupe: "Plonge, réserve et annexes", types: PROS_CUISINE }),
    T("surfaces", "Désinfection des surfaces en contact alimentaire", 2000, 20, { groupe: "Hygiène et traçabilité" }),
    T("haccp", "Fiche de traçabilité HACCP", 1500, 10, { groupe: "Hygiène et traçabilité", types: PROS_CUISINE }),
    ],
    packs: [
    { id: "confort", nom: "Confort", remisePct: 10, tacheIds: ["surfaces", "eviers", "siphons", "poubelles", "murs", "aerations", "poignees", "reserve"], types: PROS_CUISINE },
    { id: "prestige", nom: "Premium", remisePct: 15, tacheIds: ["surfaces", "eviers", "siphons", "poubelles", "murs", "aerations", "poignees", "reserve", "plafond", "plinthes", "vestiaires", "haccp"], types: PROS_CUISINE },
    { id: "confort", nom: "Confort", remisePct: 10, tacheIds: ["eviers", "surfaces", "murs", "poignees"], types: ["particulier"] },
    { id: "prestige", nom: "Premium", remisePct: 15, tacheIds: ["eviers", "surfaces", "murs", "poignees", "vitres", "aerations", "congelateur"], types: ["particulier"] },
    ],
    surfaceReferenceM2: 30, frequences: [["jour", "Chaque jour (après le service)"], ["plusieurs", "Plusieurs fois par semaine"], ["semaine", "Chaque semaine"], ["deux_semaines", "Toutes les 2 semaines"]], moments: [["midi", "Après le service du midi"], ["soir", "Après le service du soir"], ["avant", "Avant l'ouverture"], ["fermeture", "Jour de fermeture"]],
    naturesSalissure: ["Graisse incrustée", "Carbone et calamine", "Calcaire", "Odeurs", "Moisissures"] },
  { id: "office", nom: "Bureaux et cabinets", sousTitre: "Bureaux, cabinets médicaux et agences", icone: "bureaux", tauxHoraireC: 2950, salissureSurTemps: false,
    titreTypes: "Type de lieu",
    formules: [F("regulier", "Entretien régulier", "", 60, 60, 1.0, "REGULIER", false, false), F("ponctuel", "Nettoyage ponctuel", "", 60, 60, 1.15, "PONCTUEL", false, false), F("remise", "Remise en état des locaux", "", 60, 60, 1.6, "REMISE_EN_ETAT", true, false)],
    taches: [
      T("claviers", "Désinfection claviers, souris et téléphones", 1500, 20, { groupe: "Espaces de travail et accueil", types: ["bureaux", "agence", "medical"] }),
      T("ecrans", "Dépoussiérage des écrans et du matériel informatique", 1200, 15, { groupe: "Espaces de travail et accueil", types: ["bureaux", "agence"] }),
      T("reunion", "Salles de réunion (tables, chaises, écrans)", 2000, 25, { groupe: "Espaces de travail et accueil", types: ["bureaux", "agence"] }),
      T("cloisons", "Cloisons vitrées intérieures", 2500, 30, { groupe: "Espaces de travail et accueil", types: ["bureaux", "agence"] }),
      T("sieges", "Shampoing des sièges tissu", 3500, 45, { groupe: "Espaces de travail et accueil", types: ["bureaux", "agence", "medical"] }),
      T("attente", "Salle d'attente (sièges, tables, présentoirs)", 1500, 15, { groupe: "Espaces de travail et accueil", types: ["medical", "agence"] }),
      T("paillasson", "Paillasson et sas d'entrée", 800, 10, { groupe: "Espaces de travail et accueil", types: ["bureaux", "medical", "agence"] }),
      T("kitchenette", "Kitchenette / coin café (frigo, micro-ondes, cafetière)", 2000, 25, { groupe: "Espaces de travail et accueil", types: ["bureaux", "agence"] }),
      T("vitrine", "Vitrine (faces intérieure et extérieure)", 2500, 25, { groupe: "Espaces de travail et accueil", types: ["agence"] }),
      T("comptoir", "Comptoir, caisses et terminaux de paiement", 1500, 15, { groupe: "Espaces de travail et accueil", types: ["agence"] }),
      T("moquette", "Shampoing moquette", 4000, 50, { groupe: "Sols", parSurface: true, types: ["bureaux", "agence", "medical"] }),
      T("decapage", "Décapage et protection des sols (cire)", 6000, 90, { groupe: "Sols", parSurface: true, types: ["medical"] }),
      T("contact", "Désinfection renforcée des points de contact", 1500, 20, { groupe: "Hygiène et sanitaires" }),
      T("reassort", "Réassort des consommables sanitaires", 800, 10, { groupe: "Hygiène et sanitaires", types: ["bureaux", "agence", "medical"] }),
      T("cabinets", "Désinfection des cabinets (table d'examen, surfaces)", 2500, 25, { groupe: "Hygiène et sanitaires", types: ["medical"] }),
      T("conteneurs", "Sortie et lavage des conteneurs poubelles", 1500, 15, { groupe: "Hygiène et sanitaires" }),
    ],
    packs: [
      { id: "confort", nom: "Confort", remisePct: 10, tacheIds: ["contact", "conteneurs", "paillasson", "reassort", "claviers", "kitchenette", "vitrine", "comptoir", "attente"] },
      { id: "prestige", nom: "Premium", remisePct: 15, tacheIds: ["contact", "conteneurs", "paillasson", "reassort", "claviers", "kitchenette", "vitrine", "comptoir", "attente", "cloisons", "reunion", "ecrans", "moquette", "cabinets"] },
    ],
    surfaceReferenceM2: 100,
    frequences: [["plusieurs", "Plusieurs fois par semaine"], ["semaine", "Chaque semaine"], ["deux_semaines", "Toutes les 2 semaines"], ["mois", "Chaque mois"]],
    moments: [["avant", "Avant l'ouverture"], ["pendant", "Pendant les horaires d'ouverture"], ["apres", "Après la fermeture"], ["weekend", "Le week-end"]],
    occasions: [{ id: "visite", nom: "Visite client ou audit", packId: "confort" }, { id: "inauguration", nom: "Inauguration / réouverture", packId: "prestige" }, { id: "avant_evt", nom: "Avant un événement", packId: "confort" }, { id: "apres_evt", nom: "Après un événement", packId: "" }, { id: "autre", nom: "Autre", packId: "" }] },
  { id: "commerce", nom: "Commerces et entrepôts", sousTitre: "Boutiques, magasins, ateliers et entrepôts", icone: "commerce", tauxHoraireC: 2950, salissureSurTemps: false,
    titreTypes: "Type de lieu",
    formules: [F("regulier", "Entretien régulier", "", 60, 60, 1.0, "REGULIER", false, false), F("ponctuel", "Nettoyage ponctuel", "", 60, 60, 1.15, "PONCTUEL", false, false), F("remise", "Remise en état des locaux", "", 60, 60, 1.6, "REMISE_EN_ETAT", true, false)],
    taches: [
      T("cloisons", "Cloisons vitrées intérieures", 2500, 30, { groupe: "Accueil et espace du personnel", types: ["showroom"] }),
      T("paillasson", "Paillasson et sas d'entrée", 800, 10, { groupe: "Accueil et espace du personnel", types: ["boutique", "magasin", "showroom", "sport"] }),
      T("kitchenette", "Kitchenette / coin café (frigo, micro-ondes, cafetière)", 2000, 25, { groupe: "Accueil et espace du personnel", types: ["atelier", "boutique", "sport"] }),
      T("vitrine", "Vitrine (faces intérieure et extérieure)", 2500, 25, { groupe: "Vente et exposition", types: ["boutique", "magasin", "showroom"] }),
      T("comptoir", "Comptoir, caisses et terminaux de paiement", 1500, 15, { groupe: "Vente et exposition", types: ["boutique", "magasin"] }),
      T("presentoirs", "Présentoirs, étagères et rayonnages de vente", 3000, 35, { groupe: "Vente et exposition", parSurface: true, types: ["boutique", "magasin", "showroom"] }),
      T("cabines", "Cabines d'essayage (miroirs, rideaux)", 1500, 15, { groupe: "Vente et exposition", types: ["boutique"] }),
      T("miroirs", "Miroirs et vitrines d'exposition", 2000, 25, { groupe: "Vente et exposition", types: ["showroom", "boutique", "sport"] }),
      T("reserve", "Réserve / arrière-boutique", 2500, 30, { groupe: "Vente et exposition", types: ["boutique", "magasin", "showroom"] }),
      T("autolaveuse", "Lavage mécanisé des sols (autolaveuse)", 4500, 45, { groupe: "Sols", parSurface: true, types: ["magasin", "entrepot", "atelier", "sport"] }),
      T("decapage", "Décapage et protection des sols (cire)", 6000, 90, { groupe: "Sols", parSurface: true, types: ["boutique", "magasin", "showroom"] }),
      T("degraissage_sols", "Dégraissage des sols d'atelier (huiles, traces)", 4000, 45, { groupe: "Sols", parSurface: true, types: ["atelier"] }),
      T("sols_sport", "Désinfection des tapis et sols de sport", 3000, 30, { groupe: "Sols", parSurface: true, types: ["sport"] }),
      T("contact", "Désinfection renforcée des points de contact", 1500, 20, { groupe: "Hygiène et sanitaires" }),
      T("reassort", "Réassort des consommables sanitaires", 800, 10, { groupe: "Hygiène et sanitaires", types: ["sport", "magasin"] }),
      T("appareils", "Désinfection des appareils de sport", 3000, 35, { groupe: "Hygiène et sanitaires", types: ["sport"] }),
      T("vestiaires", "Vestiaires et douches", 3000, 35, { groupe: "Hygiène et sanitaires", types: ["sport", "atelier", "magasin"] }),
      T("rayonnages", "Dépoussiérage des rayonnages de stockage", 3500, 40, { groupe: "Stockage, atelier et déchets", parSurface: true, types: ["entrepot", "atelier", "magasin"] }),
      T("quais", "Quais de chargement et allées de circulation", 3500, 40, { groupe: "Stockage, atelier et déchets", types: ["entrepot"] }),
      T("etablis", "Établis et postes d'atelier", 2500, 30, { groupe: "Stockage, atelier et déchets", types: ["atelier"] }),
      T("araignees", "Toiles d'araignées et hauteurs accessibles", 2000, 25, { groupe: "Stockage, atelier et déchets", types: ["entrepot", "atelier", "showroom"] }),
      T("cartons", "Évacuation des cartons et déchets légers (sacs)", 1500, 15, { groupe: "Stockage, atelier et déchets", types: ["entrepot", "atelier", "boutique", "magasin"] }),
      T("conteneurs", "Sortie et lavage des conteneurs poubelles", 1500, 15, { groupe: "Stockage, atelier et déchets" }),
    ],
    packs: [
      { id: "confort", nom: "Confort", remisePct: 10, tacheIds: ["contact", "conteneurs", "paillasson", "reassort", "kitchenette", "vitrine", "comptoir", "vestiaires", "etablis", "cartons", "araignees"] },
      { id: "prestige", nom: "Premium", remisePct: 15, tacheIds: ["contact", "conteneurs", "paillasson", "reassort", "kitchenette", "vitrine", "comptoir", "vestiaires", "etablis", "cartons", "araignees", "cloisons", "presentoirs", "miroirs", "reserve", "autolaveuse", "appareils", "rayonnages", "quais"] },
    ],
    surfaceReferenceM2: 100,
    frequences: [["plusieurs", "Plusieurs fois par semaine"], ["semaine", "Chaque semaine"], ["deux_semaines", "Toutes les 2 semaines"], ["mois", "Chaque mois"]],
    moments: [["avant", "Avant l'ouverture"], ["pendant", "Pendant les horaires d'ouverture"], ["apres", "Après la fermeture"], ["weekend", "Le week-end"]],
    occasions: [{ id: "visite", nom: "Visite client ou audit", packId: "confort" }, { id: "inauguration", nom: "Inauguration / réouverture", packId: "prestige" }, { id: "avant_evt", nom: "Avant un événement", packId: "confort" }, { id: "apres_evt", nom: "Après un événement", packId: "" }, { id: "inventaire", nom: "Inventaire ou changement de collection", packId: "confort" }, { id: "autre", nom: "Autre", packId: "" }] },
  { id: "communal", nom: "Immeubles et parties communes", sousTitre: "Étages, hall et annexes : prix selon le nombre d'étages", icone: "parties-communes", tauxHoraireC: 2800, salissureSurTemps: false,
    titreTypes: "Type d'immeuble",
    formules: [F("regulier", "Entretien régulier", "", 80, 60, 1.0, "REGULIER", false, false), F("ponctuel", "Ponctuel", "", 80, 60, 1.15, "PONCTUEL", false, false), F("remise", "Remise en état", "", 80, 60, 1.6, "REMISE_EN_ETAT", true, false)],
    taches: [
      T("vitrerie", "Vitrerie du hall et porte d'entrée", 2000, 25, { groupe: "Hall et entrée", types: ["copro", "residence"] }),
      T("boites", "Boîtes aux lettres et interphone", 1000, 10, { groupe: "Hall et entrée", types: ["copro", "residence"] }),
      T("paillasson", "Paillasson et sas", 800, 10, { groupe: "Hall et entrée", types: ["copro", "residence"] }),
      T("escaliers", "Lavage des escaliers", 3000, 40, { groupe: "Étages", parSurface: true, types: ["copro", "residence"] }),
      T("rampes", "Rampes, mains courantes et interrupteurs (désinfection)", 1500, 15, { groupe: "Étages", types: ["copro", "residence"] }),
      T("ascenseur", "Ascenseur (cabine, miroirs, seuils)", 1500, 15, { groupe: "Étages", types: ["copro", "residence"] }),
      T("portes", "Portes palières et plinthes", 1500, 20, { groupe: "Étages", parSurface: true, types: ["copro", "residence"] }),
      T("araignees", "Toiles d'araignées et hauteurs", 1500, 20, { groupe: "Étages" }),
      T("local_poubelles", "Local poubelles (lavage, désinfection)", 2500, 25, { groupe: "Annexes de l'immeuble" }),
      T("conteneurs", "Sortie et rentrée des conteneurs", 1000, 10, { groupe: "Annexes de l'immeuble", types: ["copro", "residence"] }),
      T("velos", "Local vélos et poussettes", 2000, 20, { groupe: "Annexes de l'immeuble", types: ["copro", "residence"] }),
      T("caves", "Couloirs de caves", 2500, 30, { groupe: "Annexes de l'immeuble", types: ["copro", "parking"] }),
      T("parking_immeuble", "Parking de l'immeuble (balayage, jusqu'à 500 m²)", 4500, 45, { groupe: "Annexes de l'immeuble", types: ["copro", "residence"] }),
      T("cour", "Cour et allées (balayage, lavage)", 2500, 30, { groupe: "Annexes de l'immeuble", types: ["copro", "residence"] }),
      T("espaces_verts", "Espaces verts (ramassage des feuilles et déchets)", 2000, 25, { groupe: "Annexes de l'immeuble", types: ["copro", "residence"] }),
      T("balayage", "Balayage mécanisé du parking", 6000, 60, { groupe: "Parking", parSurface: true, types: ["parking"] }),
      T("huile", "Traitement des taches d'huile", 3000, 30, { groupe: "Parking", types: ["parking"] }),
      T("rampes_acces", "Rampes d'accès et caniveaux", 2500, 30, { groupe: "Parking", types: ["parking"] }),
    ],
    packs: [
      { id: "confort", nom: "Confort", remisePct: 10, tacheIds: ["boites", "paillasson", "conteneurs", "rampes", "araignees", "vitrerie", "ascenseur", "local_poubelles", "huile"] },
      { id: "prestige", nom: "Premium", remisePct: 15, tacheIds: ["boites", "paillasson", "conteneurs", "rampes", "araignees", "vitrerie", "ascenseur", "local_poubelles", "huile", "escaliers", "portes", "velos", "caves", "balayage", "rampes_acces"] },
    ],
    surfaceReferenceM2: 200, noteTaches: "Le hall et chaque annexe (local poubelles, caves, parking, cour…) ont leur propre prix, ajouté au total.",
    occasions: [{ id: "ag", nom: "Assemblée générale", packId: "confort" }, { id: "vente_lot", nom: "Visite ou vente d'un lot", packId: "confort" }, { id: "demenagement", nom: "Après un déménagement dans l'immeuble", packId: "confort" }, { id: "autre", nom: "Autre", packId: "" }] },
  { id: "windows", nom: "Vitres et vitrines", sousTitre: "Fenêtres, vitrines et vérandas", icone: "vitres", tauxHoraireC: 3000, salissureSurTemps: false,
    titreTypes: "Type de vitrage",
    formules: [F("ponctuel", "Ponctuel", "15 min par fenêtre, minimum 1 h 30.", 0, 90, 1.0, "PONCTUEL", false, false), F("regulier", "Entretien régulier", "", 0, 90, 0.9, "REGULIER", false, false), F("travaux", "Après travaux", "", 0, 90, 1.5, "AUTRE", false, true)],
    taches: [
      T("encadrements", "Encadrements et rebords", 1500, 20, { groupe: "Vitrages", parSurface: true }),
      T("rails", "Rails de baie vitrée", 1000, 15, { groupe: "Vitrages", types: ["fenetres_logement", "baies_veranda"] }),
      T("moustiquaires", "Moustiquaires", 1000, 10, { groupe: "Vitrages", types: ["fenetres_logement", "baies_veranda"] }),
      T("etiquettes", "Retrait d'étiquettes et adhésifs", 1500, 20, { groupe: "Vitrages" }),
      T("enseigne", "Enseigne et lettrage de vitrine", 1500, 15, { groupe: "Vitrages", types: ["vitrine_commerce"] }),
      T("toiture", "Toiture de véranda (côté intérieur ou accès sécurisé)", 6000, 60, { groupe: "Accès en hauteur", types: ["baies_veranda"] }),
      T("volets", "Volets et persiennes", 2500, 30, { groupe: "Menuiseries et occultants", types: ["fenetres_logement", "baies_veranda"] }),
      T("stores", "Stores intérieurs", 2000, 25, { groupe: "Menuiseries et occultants", types: ["fenetres_logement", "baies_veranda", "facades"] }),
      T("rideau", "Rideau métallique (face extérieure)", 2000, 20, { groupe: "Menuiseries et occultants", types: ["vitrine_commerce"] }),
      T("hauteur", "Vitrages en hauteur (perche à eau pure, jusqu'à 6 m)", 3000, 30, { groupe: "Accès en hauteur" }),
    ],
    packs: [
      { id: "confort", nom: "Confort", remisePct: 10, tacheIds: ["encadrements", "rails", "moustiquaires", "stores", "enseigne", "rideau"] },
      { id: "prestige", nom: "Premium", remisePct: 15, tacheIds: ["encadrements", "rails", "moustiquaires", "stores", "enseigne", "rideau", "volets", "etiquettes", "hauteur", "toiture"] },
    ],
    surfaceReferenceM2: 20,
    frequences: [["mois", "Chaque mois"], ["deux_mois", "Tous les 2 mois"], ["trimestre", "Chaque trimestre"]],
    occasions: [{ id: "beaux_jours", nom: "Retour des beaux jours", packId: "confort" }, { id: "vente", nom: "Avant une vente ou une location", packId: "prestige" }, { id: "evenement", nom: "Avant un événement", packId: "confort" }, { id: "autre", nom: "Autre", packId: "" }],
    naturesSalissure: ["Peinture", "Plâtre", "Ciment", "Étiquettes et films", "Silicone"],
    noteTaches: "Au-delà de 6 m ou sans accès sécurisé (nacelle, cordiste) : intervention sur devis." },
  { id: "outdoor", nom: "Espaces extérieurs", sousTitre: "Terrasses, balcons et garages", icone: "exterieurs", tauxHoraireC: 3200, salissureSurTemps: false,
    titreTypes: "Espace à nettoyer",
    formules: [F("ponctuel", "Ponctuel", "", 40, 60, 1.0, "PONCTUEL", false, false), F("demoussage", "Remise en état et démoussage", "", 40, 60, 1.5, "AUTRE", false, true), F("saisonnier", "Entretien saisonnier", "", 40, 60, 0.9, "REGULIER", false, false)],
    taches: [
      T("haute_pression", "Nettoyage haute pression des sols", 4000, 45, { groupe: "Sols", parSurface: true, types: ["terrasse", "jardin", "piscine", "cour_immeuble"] }),
      T("demoussage", "Démoussage et traitement anti-mousse", 3500, 40, { groupe: "Sols", parSurface: true, types: ["terrasse", "jardin", "piscine", "cour_immeuble"] }),
      T("joints", "Joints de dallage", 3000, 40, { groupe: "Sols", parSurface: true, types: ["terrasse", "piscine"] }),
      T("huile", "Taches d'huile et de rouille", 2500, 25, { groupe: "Sols", types: ["garage", "cour_immeuble"] }),
      T("mobilier", "Mobilier de jardin", 2000, 25, { groupe: "Équipements", types: ["terrasse", "jardin", "piscine"] }),
      T("garde_corps", "Garde-corps et vitrages de balcon", 1500, 20, { groupe: "Équipements", types: ["terrasse"] }),
      T("barbecue", "Barbecue et plancha", 2000, 25, { groupe: "Équipements", types: ["terrasse", "jardin"] }),
      T("gouttieres", "Gouttières basses (accessibles depuis le sol)", 3000, 30, { groupe: "Équipements", types: ["terrasse", "jardin"] }),
      T("recoins", "Toiles d'araignées et recoins", 1500, 15, { groupe: "Équipements", types: ["garage", "terrasse"] }),
      T("rangement", "Rangement et tri du garage", 4000, 60, { groupe: "Équipements", types: ["garage"] }),
      T("feuilles", "Ramassage des feuilles", 2000, 25, { groupe: "Évacuation", types: ["terrasse", "jardin", "piscine", "cour_immeuble"] }),
      T("dechets_verts", "Évacuation des déchets verts (sacs)", 2000, 20, { groupe: "Évacuation", types: ["jardin", "cour_immeuble"] }),
      T("encombrants", "Évacuation des encombrants légers (sacs)", 2000, 20, { groupe: "Évacuation", types: ["garage"] }),
    ],
    packs: [
      { id: "confort", nom: "Confort", remisePct: 10, tacheIds: ["feuilles", "mobilier", "recoins", "huile", "haute_pression", "barbecue", "garde_corps", "dechets_verts", "encombrants"] },
      { id: "prestige", nom: "Premium", remisePct: 15, tacheIds: ["feuilles", "mobilier", "recoins", "huile", "haute_pression", "barbecue", "garde_corps", "dechets_verts", "encombrants", "demoussage", "joints", "gouttieres", "rangement"] },
    ],
    surfaceReferenceM2: 30,
    frequences: [["saison", "Chaque saison (4 fois par an)"], ["semestre", "Deux fois par an"]],
    occasions: [{ id: "ete", nom: "Avant l'été", packId: "confort" }, { id: "evenement", nom: "Avant un événement", packId: "confort" }, { id: "vente", nom: "Avant une vente ou une location", packId: "prestige" }, { id: "autre", nom: "Autre", packId: "" }],
    naturesSalissure: ["Mousses et lichens", "Traces noires", "Taches d'huile", "Feuilles et débris"],
    noteTaches: "Hors prestation : tonte, taille, élagage et nettoyage de toitures." },
  { id: "event", nom: "Avant et après événement", sousTitre: "Profitez pleinement de votre événement", icone: "evenement", tauxHoraireC: 3200, salissureSurTemps: false,
    titreTypes: "Type d'événement",
    formules: [F("avant", "Avant l'événement", "Passage terminé avant le début", 50, 60, 0.9, "AUTRE", false, false), F("apres", "Après", "Passage à partir de la fin", 50, 60, 1.2, "AUTRE", false, false), F("avant_apres", "Avant et après (2 passages)", "Un passage avant le début, un autre à partir de la fin", 50, 60, 2.0, "AUTRE", false, false)],
    taches: [
      T("tables", "Tables et chaises", 2500, 30, { groupe: "Salle et tables" }),
      T("sols", "Sols : taches de boissons et piétinement", 3500, 40, { groupe: "Salle et tables", parSurface: true }),
      T("desodorisation", "Désodorisation", 1000, 10, { groupe: "Salle et tables" }),
      T("exterieurs", "Extérieurs (mégots, confettis)", 2500, 25, { groupe: "Salle et tables", types: ["mariage", "fete", "anniversaire"] }),
      T("vaisselle", "Vaisselle et verrerie (par tranche de 50 convives)", 3000, 45, { groupe: "Cuisine et vaisselle", types: ["mariage", "fete", "anniversaire"], parConvives: true }),
      T("traiteur", "Cuisine traiteur / office", 3500, 40, { groupe: "Cuisine et vaisselle", types: ["mariage", "seminaire", "salon", "anniversaire"] }),
      T("cuisine_maison", "Cuisine de la maison", 2500, 30, { groupe: "Cuisine et vaisselle", types: ["fete"] }),
      T("tri", "Ramassage et tri des déchets", 2500, 25, { groupe: "Déchets" }),
      T("evacuation", "Évacuation des déchets (sacs)", 2000, 20, { groupe: "Déchets" }),
      T("sanitaires", "Passage sanitaires pendant l'événement", 3000, 30, { groupe: "Pendant l'événement", types: ["mariage", "seminaire", "salon", "anniversaire"] }),
    ],
    packs: [
      { id: "confort", nom: "Confort", remisePct: 10, tacheIds: ["tri", "evacuation", "tables", "sols", "traiteur", "cuisine_maison", "desodorisation"] },
      { id: "prestige", nom: "Premium", remisePct: 15, tacheIds: ["tri", "evacuation", "tables", "sols", "traiteur", "cuisine_maison", "desodorisation", "vaisselle", "exterieurs", "sanitaires"] },
    ],
    surfaceReferenceM2: 100 },
  { id: "special", nom: "Prestations spécialisées", sousTitre: "Nuisibles, sinistres et désinfection", icone: "specialise", tauxHoraireC: null, salissureSurTemps: false,
    affichagePrix: "FORFAIT",
    titreTypes: "Type d'intervention",
    formules: [F("planifiee", "Intervention planifiée", "Intervention à la date de votre choix", 0, 0, 1.0, "AUTRE", false, false), F("urgente", "Intervention urgente", "Intervention sous 24 à 48 h · +30 %", 0, 0, 1.0, "AUTRE", false, false)] },
].map(r => ({ nonInclus: NON_INCLUS[r.id] || "", inclus: "", formules: [], taches: [], packs: [], toujoursSurDevis: false, affichagePrix: "HORAIRE",
  surfaceReferenceM2: 0, occasions: [], naturesSalissure: [], moments: MOMENTS_PAR_DEFAUT, frequences: FREQUENCES, titreTypes: "", noteTaches: "", ...r }));

export const rubrique = id => RUBRIQUES.find(r => r.id === id);

/** Arrondi à l'euro (prix des tâches et remises de pack, comme l'appli). */
export const arrondiEuro = c => Math.round(c / 100) * 100;
/** Tâches proposées pour le type de lieu choisi (sans liste de types : toujours proposée). */
export const tachesPour = (r, typeLieuId) => r.taches.filter(t => !t.types.length || t.types.includes(typeLieuId));
/** Coefficient des tâches à la surface : max(100 %, surface / surface de référence). */
export const coefSurface = (r, surface) => (r.surfaceReferenceM2 > 0 ? Math.max(1, surface / r.surfaceReferenceM2) : 1);
/** Tâche au prix du client : prorata de surface et coefficient de prix (gabarit), prix arrondi à l'euro. */
export function tacheChiffree(t, r, surface, coefPrix = 1, coefMinutes = 1) {
  const k = t.parSurface ? coefSurface(r, surface) : 1;
  return { ...t, prixC: arrondiEuro(t.prixC * k * coefPrix), minutes: Math.round(t.minutes * k * coefMinutes) };
}
/** Véhicules : « Sélection conseillée », lieu d'intervention et fréquence. */
export const SELECTION_CONSEILLEE_VEHICULE = ["aspiration", "tableau", "vitres_int", "lavage_main", "vitres_ext"];
export const LIEUX_VEHICULE = [["domicile", "À domicile"], ["travail", "Sur le lieu de travail"], ["parking", "Parking de résidence ou public"]];
export const FREQUENCES_VEHICULE = [["unique", "Une seule fois"], ["mois", "Chaque mois"], ["trimestre", "Chaque trimestre"]];
/** Packs limités aux tâches proposées pour le type : vide → masqué ; deux packs identiques → on garde le plus remisé. */
export function packsPour(r, typeLieuId) {
  const ids = tachesPour(r, typeLieuId).map(t => t.id);
  const garde = new Map();
  for (const p of r.packs.filter(p => !p.types?.length || p.types.includes(typeLieuId)).map(p => ({ ...p, tacheIds: p.tacheIds.filter(id => ids.includes(id)) })).filter(p => p.tacheIds.length)) {
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
  E("canape_droit", "Canapé droit", "canape", 7500, 60, { avecTaille: true }), E("canape_angle", "Canapé d'angle", "canape", 11900, 105, { avecTaille: true }),
  E("convertible", "Convertible (BZ, clic-clac)", "canape", 9800, 75, { avecTaille: true }), E("meridienne", "Méridienne / chaise longue", "canape", 9800, 75, { avecTaille: true }),
  E("modulable", "Canapé modulable / panoramique", "canape", 15200, 120, { avecTaille: true }), E("fauteuil", "Fauteuil", "canape", 4900, 30),
  E("matelas_bebe", "Matelas bébé", "matelas", 4300, 30), E("matelas_1", "Matelas 1 personne", "matelas", 6000, 45),
  E("matelas_2", "Matelas 2 personnes", "matelas", 8200, 60), E("matelas_grand", "Matelas grand lit (160 cm et +)", "matelas", 9800, 75),
  E("tapis_2", "Tapis jusqu'à 2 m", "tapis", 4900, 30), E("tapis_3", "Tapis de 2 à 3 m", "tapis", 7100, 45),
  E("tapis_plus", "Tapis de plus de 3 m", "tapis", 9300, 60), E("moquette", "Moquette", "tapis", 700, 4, { parM2: true }),
  // Hôtels et campings : prix par logement, base 30 €/h (même taux que la location saisonnière).
  E("mh_2", "Mobil-home 1 à 2 chambres", "camping", 3500, 60), E("mh_3", "Mobil-home 3 chambres et plus", "camping", 4500, 80),
  E("chalet", "Chalet ou bungalow", "camping", 5500, 100), E("lodge", "Tente lodge ou safari", "camping", 2900, 45),
  E("ch_depart", "Chambre d'hôtel · départ (à blanc)", "hotel", 1600, 30), E("ch_recouche", "Chambre d'hôtel · recouche", "hotel", 900, 15),
  E("suite", "Suite ou appartement hôtelier", "hotel", 3500, 60),
  E("sanitaires", "Bloc sanitaire collectif", "communs", 4500, 75), E("salle_commune", "Accueil, salle commune ou club enfants", "communs", 3900, 60),
  E("piscine", "Abords de piscine et douches", "communs", 2900, 45),
];
/** Supplément de taille des canapés (prix et durée). */
export const TAILLES_CANAPE = [
  { id: "t15", libelle: "moins de 1,5 m", prixC: 0, minutes: 0 }, { id: "t20", libelle: "1,5 à 2 m", prixC: 1000, minutes: 15 },
  { id: "t25", libelle: "2 à 2,5 m", prixC: 2000, minutes: 30 }, { id: "t30", libelle: "2,5 à 3 m", prixC: 3000, minutes: 45 },
  { id: "t3p", libelle: "plus de 3 m", prixC: 4000, minutes: 60 },
];
/** Prestations spécialisées : délai souhaité (intervention urgente). */
export const DELAIS_URGENCE = [["24h", "Sous 24 h"], ["48h", "Sous 48 h"], ["semaine", "Dans la semaine"]];
/** Événements : nombre de tranches de 50 convives (au moins 1). */
export const tranchesConvives = convives => Math.max(1, Math.ceil((convives || 0) / REGLES.CONVIVES_PAR_TRANCHE));
/** Immeubles (copropriété, résidence services) : surface totale = surface par palier × nombre de paliers. */
export const TYPES_IMMEUBLE = ["copro", "residence"];
export const surfaceEffective = b => (b.rubriqueId === "communal" && TYPES_IMMEUBLE.includes(b.typeLieuId)
  ? (b.surfacePalier ?? REGLES.SURFACE_PALIER_DEFAUT_M2) * (b.paliers ?? REGLES.PALIERS_DEFAUT) : b.surface);
/** Cuisines : équipements à l'unité (minutes) ; pro = établissements seulement. */
export const EQUIPEMENTS_CUISINE = [
  { id: "plaques", nom: "Plaques de cuisson", minutes: 15, pro: false },
  { id: "four", nom: "Four", minutes: 30, pro: false },
  { id: "microondes", nom: "Micro-ondes", minutes: 10, pro: false },
  { id: "hotte", nom: "Hotte et filtres", minutes: 20, pro: false },
  { id: "frigo", nom: "Réfrigérateur", minutes: 20, pro: false },
  { id: "lave_vaisselle", nom: "Lave-vaisselle", minutes: 15, pro: false },
  { id: "placards", nom: "Placards (intérieur)", minutes: 20, pro: false },
  { id: "piano", nom: "Piano / plaques de cuisson", minutes: 30, pro: true },
  { id: "four_pro", nom: "Four professionnel (mixte, à sole…)", minutes: 40, pro: true },
  { id: "friteuse", nom: "Friteuse", minutes: 30, pro: true },
  { id: "grill", nom: "Grill, plancha ou salamandre", minutes: 25, pro: true },
  { id: "hotte_pro", nom: "Hotte et filtres professionnels", minutes: 45, pro: true },
  { id: "armoire", nom: "Armoire réfrigérée", minutes: 25, pro: true },
  { id: "chambre_froide", nom: "Chambre froide", minutes: 60, pro: true },
  { id: "plonge", nom: "Plonge et lave-vaisselle pro", minutes: 30, pro: true },
  { id: "inox", nom: "Poste de travail inox", minutes: 15, pro: true },
  { id: "petit_materiel", nom: "Petit matériel (trancheuse, robots…)", minutes: 10, pro: true },
];
export const equipementsPour = typeLieuId => EQUIPEMENTS_CUISINE.filter(e => e.pro === PROS_CUISINE.includes(typeLieuId));
/** Fin de chantier : type de chantier. */
export const TYPES_CHANTIER = [["neuve", "Construction neuve"], ["renovation", "Rénovation"], ["amenagement", "Aménagement intérieur"], ["extension", "Extension"]];
/** « Taches à traiter » (choix multiple, indicatif pour le Cleaneur). */
export const TACHES_A_TRAITER = ["Vin", "Café ou thé", "Gras", "Urine", "Sang", "Encre", "Inconnues"];
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
export const eurosRond = c => (c % 100 === 0 ? euros(c).replace(",00", "") : euros(c));
/** Pastille du catalogue : « dès 26,90 € / h », « dès 29 € le ménage », « dès 40 € », « dès 45 € l'élément ». */
export function pastille(r) {
  if (r.affichagePrix === "FORFAIT") return `dès ${eurosRond(prixAppelSpecialC())}`;
  if (r.toujoursSurDevis || r.tauxHoraireC == null) return "Sur devis";
  switch (r.affichagePrix) {
    case "PAR_MENAGE": return `dès ${eurosRond(REGLES.MINIMUM_MENAGE_LOCATION_C)} le ménage`;
    case "MINIMUM_COMMANDE": return `dès ${eurosRond(REGLES.MINIMUM_COMMANDE_VEHICULE_C)}`;
    // 20/11/2026 : prix de l'élément le moins cher de CETTE prestation (les hôtels et campings commencent à 9 €, pas à 45 €).
    case "PAR_ELEMENT": { const ids = (r.formules || []).map(f => f.id); const m = Math.min(...ELEMENTS_TEXTILES.filter(e => ids.includes(e.formuleId) && !e.parM2).map(e => e.prixC));
      return `dès ${eurosRond(Number.isFinite(m) ? m : REGLES.PRIX_APPEL_TEXTILES_C)} l'élément`; }
    default: return `dès ${euros(r.tauxHoraireC)} / h`;
  }
}

export const RACCOURCIS_VITRINE = [
  ["home", "Ménage du logement", "Ponctuel ou régulier"], ["rental", "Location saisonnière", "Entre deux voyageurs"],
  ["textiles", "Canapés et textiles", "Shampoing, détachage"], ["windows", "Vitres et vitrines", "Fenêtres et baies"],
  ["car", "Véhicules", "Intérieur, extérieur — à la carte"], ["office", "Bureaux et cabinets", "Cabinets et agences"],
];
/** Contenu du forfait de chaque formule de location saisonnière (18 novembre 2026, liste de l'utilisateur pour le court séjour) :
 *  chaque formule reprend la précédente et ajoute ses tâches. Même liste dans l'appli (Catalogue.INCLUS_LOCATION). */
export const INCLUS_LOCATION = [
  ["standard", ["Cuisine : plans, crédence, évier, plaque", "Four et micro-ondes, intérieur et extérieur", "Intérieur du réfrigérateur (clayettes, bacs, joints accessibles)",
    "Lave-vaisselle vidé, vaisselle rangée", "Poubelles vidées, lavées, sacs neufs", "WC nettoyés et désinfectés", "Douche ou baignoire, parois, robinetterie, miroir",
    "Cheveux retirés, évacuations contrôlées", "Grilles d'aération dépoussiérées", "Lits faits avec le linge fourni", "Sous les lits aspiré", "Meubles, poignées, interrupteurs, télécommandes",
    "Vitres accessibles de l'intérieur", "Sols aspirés et lavés", "Consommables contrôlés, objets oubliés et dégradations signalés", "Photo de chaque pièce"]],
  ["confort", ["Plinthes, portes et encadrements", "Traces sur les murs accessibles", "Dessous et pieds des meubles accessibles", "Détartrage renforcé et joints de douche",
    "Hotte et filtres", "Joints du réfrigérateur et petits appareils", "Rails accessibles", "Canapé aspiré", "Vaisselle contrôlée (casse, manque)", "Équipements testés (TV, box, plaques)"]],
  ["premium", ["Vitres intérieures et extérieures accessibles, encadrements, rails", "Volets accessibles", "Canapés et fauteuils selon leur revêtement", "Tapis aspirés en profondeur",
    "Radiateurs", "Derrière les meubles déplaçables sans risque", "Four et accessoires dégraissés", "Réfrigérateur et congélateur vidés et nettoyés",
    "Terrasse ou balcon balayés et lavés, mobilier et garde-corps", "Inspection complète des finitions"]],
];
/** Critères de validation avant de terminer (lot 4 de la refonte du 20/11/2026) : ce que le Cleaneur vérifie, par niveau, cumulés. */
export const CRITERES_VALIDATION = {
  rental: [["standard", ["Aucun cheveu visible (bondes, oreillers, sols)", "Miroirs et robinetterie sans traces", "Poubelles vides avec sac neuf", "Lits faits sans pli",
      "Réfrigérateur vide et sans odeur", "Consommables au seuil fixé par l'hôte, ou signalés", "Une photo par pièce, prise après"]],
    ["confort", ["Plinthes et portes sans poussière", "Joints de douche sans dépôt", "Hotte sans film gras", "Équipements testés (TV, box, plaques)"]],
    ["premium", ["Vitres sans traces à contre-jour", "Rails de fenêtres propres", "Terrasse balayée et lavée, photo comprise"]]],
  moving: [["", ["Intérieur du four, du réfrigérateur et des placards photographié", "Joints et robinetterie détartrés", "Aucune trace d'adhésif", "Photos sur les mêmes vues qu'un état des lieux"]]],
  car: [["", ["Lavage sans eau uniquement (domicile ou voie publique)", "Photos des 4 côtés avant intervention"]]],
  textiles: [["", ["Test de tenue des couleurs sur une zone cachée", "Temps de séchage annoncé au client"]]],
  kitchen: [["", ["Fiche de traçabilité HACCP remplie (établissements)"]]],
  windows: [["", ["Pas d'échelle au-delà de 6 m ni sans accès sécurisé : refus et passage sur devis"]]],
  special: [["", ["Numéro de Certibiocide saisi", "Équipements de protection photographiés", "Protocole écrit laissé au client"]]],
};
/** Critères applicables à une mission : communs + ceux du niveau choisi et des niveaux inférieurs. */
export const criteresDe = (rubriqueId, formuleId = "") => {
  const liste = CRITERES_VALIDATION[rubriqueId] || [];
  const niveau = ANCIENNES_FORMULES_LOCATION[formuleId]?.[0] || formuleId || "standard";
  const i = liste.findIndex(([id]) => id === niveau);
  return liste.filter(([id], j) => !id || j <= Math.max(0, i)).flatMap(([, c]) => c);
};
/** Anciennes formules (avant le 20/11/2026) → niveau et durée de séjour (brouillons enregistrés). */
export const ANCIENNES_FORMULES_LOCATION = { court: ["standard", "court"], semaine: ["standard", "semaine"], long: ["standard", "long"], grand: ["premium", "court"] };
/** Durée du séjour qui précède le ménage : ajoute du temps au Standard. */
export const SEJOURS_LOCATION = [["court", "1 à 4 nuits"], ["semaine", "5 à 9 nuits (+20 %)"], ["long", "10 nuits et plus (+35 %)"]];
/** Toutes les tâches du forfait d'une formule (celles des formules précédentes comprises), pour la liste du Cleaneur. */
export const inclusCumuleLocation = formuleId => {
  const i = INCLUS_LOCATION.findIndex(([id]) => id === (ANCIENNES_FORMULES_LOCATION[formuleId]?.[0] || formuleId));
  return INCLUS_LOCATION.slice(0, i < 0 ? 1 : i + 1).flatMap(([, t]) => t);
};
/** Pièce où se fait une tâche du forfait (chambre, salle de bain, cuisine ; sinon le séjour, « toutes pièces »). */
export const pieceDuForfait = t => /\blits?\b|matelas/i.test(t) ? "chambre" : /cheveux|robinetterie|WC|douche|baignoire|détartrage/i.test(t) ? "sdb"
  : /four|micro|réfrigérateur|vaisselle|hotte|électroménager|placards|cuisine|petits appareils|congélateur|poubelles/i.test(t) ? "cuisine"
  : /terrasse|balcon|volets/i.test(t) ? "exterieur" : "sejour";
/** Forfait d'une formule de location : { precedente: nom de la formule précédente ou "", taches: celles qu'elle ajoute }. */
export const inclusLocation = formuleId => {
  const i = INCLUS_LOCATION.findIndex(([id]) => id === (ANCIENNES_FORMULES_LOCATION[formuleId]?.[0] || formuleId));
  return i < 0 ? null : { precedente: i ? INCLUS_LOCATION[i - 1][0] : "", taches: INCLUS_LOCATION[i][1] };
};

export const RUBRIQUES_CREDIT_IMPOT = ["home", "windows", "textiles"];

/** Trois parties de réservation, chacune avec ses prestations (même liste que Catalogue.parties dans l'appli).
 *  Le crédit d'impôt ne concerne que les particuliers (« personnel »). */
export const PARTIES = [
  { id: "personnel", nom: "Particulier", detail: "Crédit d'impôt sur le ménage, les vitres et les textiles (services à la personne)",
    rubriques: ["home", "rental", "moving", "textiles", "windows", "outdoor", "car", "leisure", "boat", "kitchen", "event", "construction", "special"] },
  { id: "conciergerie", nom: "Conciergerie et locations", detail: "Locations saisonnières et logements gérés · facture au nom de votre société",
    rubriques: ["rental", "home", "moving", "textiles", "windows", "outdoor", "leisure", "boat", "construction", "special"] },
  { id: "hotellerie", nom: "Hôtels et campings", detail: "Rotations, renforts et saisons · facture au nom de votre établissement",
    rubriques: ["hospitality", "windows", "outdoor", "textiles", "construction", "special"] },
  { id: "professionnel", nom: "Entreprise", detail: "Bureaux, commerces, immeubles, cuisines pro · facture au nom de votre société",
    rubriques: ["office", "commerce", "communal", "kitchen", "windows", "outdoor", "construction", "car", "leisure", "boat", "event", "textiles", "special"] },
];
export const partie = id => PARTIES.find(p => p.id === id) || PARTIES[0];
/** Partie qui propose cette prestation (la partie demandée si elle la propose, sinon la première qui la propose). */
export const partiePour = (rubriqueId, voulue = "personnel") =>
  partie(voulue).rubriques.includes(rubriqueId) ? partie(voulue).id : (PARTIES.find(p => p.rubriques.includes(rubriqueId)) || PARTIES[0]).id;
/** Partie imposée par l'espace du compte connecté (16 novembre 2026) : plus de question « Pour qui ? » une fois connecté. */
export const PARTIE_DE_L_ESPACE = { particulier: "personnel", pro: "conciergerie", hotellerie: "hotellerie", entreprise: "professionnel" };
/** Prestations au panier (prix forfaitaire par élément) : textiles, hôtels et campings. */
export const RUBRIQUES_PANIER = ["textiles", "hospitality"];
/** Prestations sans objet pour un logement déjà enregistré (véhicule, locaux professionnels, réception). Même liste dans l'appli. */
export const RUBRIQUES_HORS_LOGEMENT = ["car", "leisure", "boat", "event", "office", "commerce", "communal"];
/** Prestations proposées à l'étape 1 : celles de la partie ; pour un logement enregistré (hors Entreprise, dont les adresses sont des locaux), sans celles qui n'ont pas de sens. */
/**
 * Biens enregistrés par catégorie (16 novembre 2026, demande de l'utilisateur) : logements et adresses, voitures,
 * vans / camping-cars / caravanes, bateaux. Chaque prestation ne propose que les biens de sa catégorie, et un bien choisi
 * ne propose que ses prestations. Même règle dans l'appli (Catalogue.categorieDeRubrique).
 */
export const CATEGORIES_BIEN = [["logement", "Logements", "logement"], ["local", "Locaux et établissements", "bureaux"], ["vehicule", "Voitures", "vehicule"],
  ["loisirs", "Vans, camping-cars et caravanes", "vehicule"], ["bateau", "Bateaux", "bateau"]];
/** Catégories de biens acceptées par chaque prestation (une adresse sert aux logements comme aux locaux). */
const ADRESSE = ["logement", "local"];
export const CATEGORIES_DE_RUBRIQUE = { home: ["logement"], rental: ["logement"], moving: ["logement"],
  office: ["local"], commerce: ["local"], communal: ["local"], hospitality: ["local"],
  windows: ADRESSE, outdoor: ADRESSE, construction: ADRESSE, textiles: ADRESSE, special: ADRESSE, kitchen: ADRESSE, event: ADRESSE,
  car: ["vehicule"], leisure: ["loisirs"], boat: ["bateau"] };
export const categorieBien = l => (l && l.categorie) || "logement";
export const categoriesDeRubrique = id => CATEGORIES_DE_RUBRIQUE[id] || ADRESSE;
/** Catégorie d'un nouveau bien créé par une réservation de cette prestation, pour cette partie. */
export const categorieDeRubrique = (id, partieId = "personnel") => { const c = categoriesDeRubrique(id); return c.length === 1 ? c[0] : ["professionnel", "hotellerie"].includes(partieId) ? "local" : "logement"; };
export const bienCompatible = (rubriqueId, l) => !!l && categoriesDeRubrique(rubriqueId).includes(categorieBien(l));
/** Types proposés pour une catégorie de bien (type de logement, de local, gabarit, type de bateau). */
export const TYPES_LOCAL = [{ id: "bureaux", nom: "Bureaux ou cabinet" }, { id: "commerce", nom: "Commerce ou entrepôt" }, { id: "immeuble", nom: "Immeuble (parties communes)" },
  { id: "hotel", nom: "Hôtel" }, { id: "camping", nom: "Camping ou résidence de tourisme" }, { id: "restaurant", nom: "Restaurant" }, { id: "autre_local", nom: "Autre local" }];
export const typesDeCategorie = cat => cat === "vehicule" ? TYPES_LIEU.car : cat === "loisirs" ? TYPES_LIEU.leisure : cat === "bateau" ? TYPES_LIEU.boat : cat === "local" ? TYPES_LOCAL : TYPES_LOGEMENT;
/** Prestations proposées à l'étape 1 : celles de la partie ; avec un bien choisi, seulement celles de sa catégorie
 *  (un logement d'un particulier ou d'une conciergerie ne propose ni réception ni locaux professionnels). [bien] : le bien, true (= un logement) ou null. */
export const rubriquesProposees = (partieId, bien = null, secteurId = null) => {
  const p = partie(partieId), cat = bien === true ? "logement" : bien ? categorieBien(bien) : null;
  const s = partieId === "professionnel" ? secteurEntreprise(secteurId) : null;
  return p.rubriques.filter(id => (!cat || categoriesDeRubrique(id).includes(cat)) && (!s || s.rubriques.includes(id)));
};

/** Secteurs d'activité des comptes Entreprise (18 novembre 2026) : chaque secteur ne voit que les prestations utiles à son métier
 *  (des pompes funèbres ne réservent pas un lavage de voiture, un garage ne réserve pas un nettoyage après décès).
 *  speciaux : interventions spécialisées proposées (désinfection, après décès, nuisibles…). Même liste dans l'appli (Catalogue.SECTEURS). */
const NUISIBLES = ["cafards", "punaises", "rats", "guepes"];
export const SECTEURS_ENTREPRISE = [
  { id: "bureaux", nom: "Bureaux, agence, siège social", rubriques: ["office", "windows", "outdoor", "textiles", "kitchen", "event", "construction", "special"], speciaux: ["desinfection", "sinistre", "cafards", "punaises", "rats"] },
  { id: "medical", nom: "Cabinet médical ou paramédical", rubriques: ["office", "windows", "textiles", "construction", "special"], speciaux: ["desinfection", "sinistre", "cafards", "rats"] },
  { id: "commerce", nom: "Commerce, boutique, showroom", rubriques: ["commerce", "windows", "outdoor", "textiles", "event", "construction", "special"], speciaux: ["desinfection", "sinistre", "cafards", "rats", "guepes"] },
  { id: "restaurant", nom: "Restaurant, bar, traiteur", rubriques: ["kitchen", "commerce", "windows", "outdoor", "textiles", "event", "construction", "special"], speciaux: ["desinfection", "sinistre", "cafards", "rats", "guepes"] },
  { id: "garage", nom: "Garage, carrosserie, concession", rubriques: ["commerce", "office", "car", "leisure", "windows", "outdoor", "construction", "special"], speciaux: ["sinistre", "rats", "guepes"] },
  { id: "funeraire", nom: "Pompes funèbres, funérarium", rubriques: ["office", "commerce", "windows", "outdoor", "textiles", "event", "special"], speciaux: ["deces", "desinfection", "sinistre", "encombre"] },
  { id: "syndic", nom: "Syndic, bailleur, gestion d'immeubles", rubriques: ["communal", "windows", "outdoor", "construction", "special"], speciaux: ["deces", "desinfection", "encombre", "sinistre", ...NUISIBLES] },
  { id: "nautisme", nom: "Port, nautisme, location de bateaux", rubriques: ["boat", "office", "commerce", "windows", "outdoor", "special"], speciaux: ["sinistre", "rats"] },
  { id: "loueur", nom: "Location de véhicules ou de camping-cars", rubriques: ["car", "leisure", "office", "commerce", "windows", "outdoor", "special"], speciaux: ["desinfection", "sinistre"] },
  { id: "evenementiel", nom: "Événementiel, salle de réception", rubriques: ["event", "kitchen", "commerce", "windows", "outdoor", "textiles", "construction", "special"], speciaux: ["desinfection", "sinistre", "guepes"] },
  { id: "btp", nom: "BTP, promoteur, architecte", rubriques: ["construction", "office", "windows", "outdoor", "special"], speciaux: ["sinistre", "encombre"] },
  { id: "industrie", nom: "Industrie, entrepôt, logistique", rubriques: ["commerce", "office", "kitchen", "windows", "outdoor", "construction", "special"], speciaux: ["desinfection", "sinistre", "cafards", "rats"] },
  { id: "autre", nom: "Autre activité", rubriques: null, speciaux: null },
];
/** Secteur d'un compte Entreprise ; null (= tout proposer) si inconnu ou « Autre activité ». */
export const secteurEntreprise = id => { const s = SECTEURS_ENTREPRISE.find(x => x.id === id); return s && s.rubriques ? s : null; };
/** Interventions spécialisées proposées à ce secteur (toutes si aucun secteur). */
export const lieuxDuSecteur = (rubriqueId, lieux, secteurId) => {
  const s = secteurEntreprise(secteurId);
  return rubriqueId === "special" && s && lieux ? lieux.filter(l => s.speciaux.includes(l.id)) : lieux;
};
export const TYPES_VITRES_ELIGIBLES =["fenetres_logement", "baies_veranda"];

export const TYPES_LOGEMENT = [
  { id: "studio", nom: "Studio", surface: 25, chambres: 0, sdb: 1, niveaux: 1 },
  { id: "appartement", nom: "Appartement", surface: 62, chambres: 2, sdb: 1, niveaux: 1 },
  { id: "maison", nom: "Maison", surface: 110, chambres: 3, sdb: 2, niveaux: 2 },
  { id: "duplex", nom: "Duplex / loft", surface: 90, chambres: 2, sdb: 1, niveaux: 2 },
];

/** Type de lieu : coefficient de temps (prix pour les véhicules) et texte « Inclus » propre au type (vide = celui de la rubrique). */
const L = (id, nom, coef, inclus = "") => ({ id, nom, coef, inclus });
export const TYPES_LIEU = {
  kitchen: [L("particulier", "Particulier", 1.0), L("restaurant", "Restaurant", 1.1), L("hotel", "Hôtel", 1.1),
    L("collectivite", "Collectivité / cantine", 1.1), L("boulangerie", "Boulangerie, traiteur, labo", 1.15), L("foodtruck", "Food truck", 1.0)],
  office: [L("bureaux", "Bureaux", 1.0, "Bureaux et open space, sols, corbeilles, sanitaires"), L("medical", "Cabinet médical / paramédical", 1.2, "Cabinets, salle d'attente, sols, sanitaires"), L("agence", "Agence / accueil du public", 1.05, "Accueil, bureaux, sols, corbeilles, sanitaires")],
  commerce: [L("boutique", "Local commercial / boutique", 1.1, "Surface de vente, sols, corbeilles, sanitaires"), L("magasin", "Magasin / supérette", 1.15, "Surface de vente, allées, sols, corbeilles, sanitaires"), L("showroom", "Showroom / galerie", 1.1, "Espace d'exposition, sols, corbeilles, sanitaires"), L("sport", "Salle de sport / studio", 1.15, "Salles, sols, corbeilles, sanitaires"), L("entrepot", "Entrepôt / remise / stockage", 0.7, "Allées et zones de stockage, sols, sanitaires"), L("atelier", "Atelier / local d'activité", 0.9, "Atelier, sols, corbeilles, sanitaires")],
  communal: [L("copro", "Immeuble résidentiel / copropriété", 1.0, "Hall, escaliers, paliers, rampes"), L("residence", "Résidence services (seniors, étudiants)", 1.1), L("parking", "Parking / sous-sol", 0.7)],
  windows: [L("fenetres_logement", "Fenêtres d'un logement", 1.0, "Vitres, faces intérieure et extérieure accessibles"), L("baies_veranda", "Baies vitrées et véranda", 1.1), L("vitrine_commerce", "Vitrine de commerce", 1.0), L("facades", "Bureaux et façades vitrées", 1.1)],
  leisure: [L("van", "Van aménagé ou fourgon", 0.9), L("profile", "Camping-car profilé ou capucine", 1.0), L("integral", "Camping-car intégral", 1.15), L("caravane", "Caravane", 0.9)],
  boat: [L("voilier", "Voilier", 1.0), L("moteur", "Bateau à moteur", 1.0), L("semi_rigide", "Semi-rigide", 0.7), L("vedette", "Vedette ou yacht (flybridge)", 1.2), L("catamaran", "Catamaran", 1.5)],
  outdoor: [L("terrasse", "Terrasse / balcon", 1.0, "Balayage et lavage des sols"), L("jardin", "Jardin, allées et cour", 1.0), L("garage", "Garage, cave ou abri", 0.9), L("piscine", "Abords de piscine", 1.1, "Plages et margelles"), L("cour_immeuble", "Cour d'immeuble / parking extérieur", 0.9)],
  event: [L("mariage", "Mariage / réception", 1.1, "Salle, sols, tables, sanitaires"), L("fete", "Fête privée à domicile", 1.0, "Pièces de réception, cuisine, sanitaires"), L("seminaire", "Séminaire / événement d'entreprise", 1.0), L("salon", "Salon / exposition", 1.1), L("anniversaire", "Anniversaire / fête en salle", 1.0)],
  special: [L("cafards", "Cafards et blattes (désinsectisation)", 1.0, "Diagnostic, traitement gel et pulvérisation ciblée, passage de contrôle"),
    L("punaises", "Punaises de lit", 1.0, "Traitement en 2 passages à 15 jours d'intervalle, conseils de préparation du logement"),
    L("rats", "Rats et souris (dératisation)", 1.0, "Diagnostic, postes d'appâtage sécurisés, 2 passages de contrôle"),
    L("guepes", "Nid de guêpes ou de frelons", 1.0, "Destruction d'un nid accessible (jusqu'à 5 m de hauteur), produit adapté"),
    L("desinfection", "Désinfection approfondie", 1.0, "Évaluation sur place, protocole et produits adaptés"), L("encombre", "Logement très encombré ou insalubre", 1.0, "Visite d'évaluation, tri, désencombrement et nettoyage"), L("sinistre", "Après sinistre (dégât des eaux, suies)", 1.0, "Évaluation des dégâts, nettoyage des surfaces et des suies"), L("deces", "Nettoyage après décès", 1.0, "Intervention discrète, désinfection et remise en état")],
  construction: [L("carrelage", "Carrelage", 1.0), L("parquet", "Parquet", 1.15), L("beton", "Béton ciré", 1.0),
    L("lino", "Lino / PVC", 0.9), L("moquette", "Moquette", 1.25), L("pierre", "Pierre naturelle", 1.2)],
  car: [L("citadine", "Citadine", 1.0), L("berline", "Berline", 1.15), L("suv", "SUV", 1.3), L("utilitaire", "Utilitaire", 1.45)],
};

export function formulesPour(r) {
  if (r.formules.length) return r.formules;
  switch (r.id) {
    case "construction": return [F("standard", "Nettoyage de fin de chantier", "Le niveau de salissure sera estimé dès que toutes les photos seront exploitables.", 12, 120)];
    default: return [F("standard", "Standard", "", 25, 60)];
  }
}

/**
 * Prestations spécialisées : prix fixé à l'avance (copie de TARIFS_SPECIAUX dans Catalogue.kt).
 * Forfait jusqu'à [jusquaM2], puis prix au m² au-delà ; durée de base + minutes par m² au-delà.
 * Prix moyens du marché relevés en novembre 2026 (comparateurs de travaux, sites spécialisés).
 * certibiocide : réservé aux Cleaneurs titulaires du Certibiocide « nuisibles ». surface : la surface est demandée.
 */
export const TARIFS_SPECIAUX = {
  cafards: { prixC: 16000, jusquaM2: 50, prixM2C: 200, minutes: 90, minutesParM2: 1, certibiocide: true, surface: true },
  punaises: { prixC: 30000, jusquaM2: 30, prixM2C: 800, minutes: 120, minutesParM2: 2, certibiocide: true, surface: true },
  rats: { prixC: 22000, jusquaM2: 100, prixM2C: 100, minutes: 90, minutesParM2: 0.5, certibiocide: true, surface: true },
  guepes: { prixC: 13000, jusquaM2: 0, prixM2C: 0, minutes: 60, minutesParM2: 0, certibiocide: true, surface: false },
  desinfection: { prixC: 15000, jusquaM2: 25, prixM2C: 600, minutes: 90, minutesParM2: 2, certibiocide: false, surface: true },
  encombre: { prixC: 40000, jusquaM2: 16, prixM2C: 2500, minutes: 240, minutesParM2: 6, certibiocide: false, surface: true },
  sinistre: { prixC: 30000, jusquaM2: 8, prixM2C: 4000, minutes: 180, minutesParM2: 5, certibiocide: false, surface: true },
  deces: { prixC: 40000, jusquaM2: 10, prixM2C: 3500, minutes: 180, minutesParM2: 4, certibiocide: false, surface: true },
};
const tarifSpecial = id => TARIFS_SPECIAUX[id] || TARIFS_SPECIAUX.desinfection;
const auDela = (t, surface) => (t.surface ? Math.max(0, surface - t.jusquaM2) : 0);
/** Prix TTC d'une prestation spécialisée (urgente : +30 %), arrondi à l'euro. */
export function prixSpecialC(typeId, surface, urgent) {
  const t = tarifSpecial(typeId);
  const base = t.prixC + auDela(t, surface) * t.prixM2C;
  return arrondiEuro(urgent ? base * (100 + REGLES.MAJORATION_URGENCE_SPECIALE_PCT) / 100 : base);
}
/** Durée de base (minutes) d'une prestation spécialisée. */
export const minutesSpeciales = (typeId, surface) => { const t = tarifSpecial(typeId); return t.minutes + auDela(t, surface) * t.minutesParM2; };
/** Prix d'appel de la pastille (« dès 130 € »). */
export const prixAppelSpecialC = () => Math.min(...Object.values(TARIFS_SPECIAUX).map(t => t.prixC));

export const BESOINS_SPECIAUX = [["desinfection", "Désinfection approfondie"], ["encombre", "Logement très encombré"], ["sinistre", "Après sinistre"], ["deces", "Nettoyage après décès"]];

export const ACCUEIL = { PRESENT: "Je serai présent", TIERS: "Concierge / tiers", BOITE: "Boîte à clés", AUTONOME: "Accès autonome" };

/** Chez les professionnels : pas d'accès autonome ni de boîte à clés. */
export const accueilAutonomeInterdit = (rubriqueId, typeLieuId) =>
  ["office", "commerce", "communal", "event", "special"].includes(rubriqueId) || (rubriqueId === "windows" && ["vitrine_commerce", "facades"].includes(typeLieuId));
export const photosObligatoires = rubriqueId => ["moving", "construction", "kitchen"].includes(rubriqueId);
/** Rubriques qui décrivent un logement : type, chambres, salles de bain et niveaux (+15 min par niveau supplémentaire). */
export const RUBRIQUES_LOGEMENT = ["home", "moving"];
/** Étape 3 : vues à photographier (une photo par vue) ; obligatoires pour déménagement, fin de chantier, cuisines ; suggérées pour les bureaux. */
export function vuesPhotos(b) {
  const n = (k, f) => Array.from({ length: Math.max(1, k || 1) }, (_, i) => f(i + 1));
  switch (b.rubriqueId) {
    case "moving": return ["Séjour", "Cuisine", ...n(b.chambres, i => `Chambre ${i}`), ...n(b.sdb, i => `Salle de bain ${i}`), "WC", "Sols et plinthes", "Fenêtres"];
    case "construction": return [...n(b.pieces ?? 3, i => `Pièce ${i} · vue d'ensemble`), "Sols (gros plan)", "Vitres et menuiseries", "Poussières et résidus (gros plan)"];
    case "kitchen": return ["Angle 1 (vue depuis l'entrée)", "Angle 2 (face à l'entrée)", "Angle 3 (côté gauche)", "Angle 4 (côté droit)"];
    case "office": case "commerce": return ["Vue d'ensemble côté entrée", "Vue d'ensemble côté opposé", "Zone la plus encrassée", "Sols (gros plan)"];
    default: return [];
  }
}
/** Toutes les vues obligatoires ont-elles leur photo ? (prises = noms des vues photographiées) */
export const vuesCompletes = (b, prises) => !photosObligatoires(b.rubriqueId) || vuesPhotos(b).every(v => prises.includes(v));
