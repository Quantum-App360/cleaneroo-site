// Catalogue des prestations : copie EXACTE de Catalogue.kt et de Reservation.kt (application Android).
const T = (id, nom, prixC, minutes) => ({ id, nom, prixC, minutes });
const F = (id, nom, description = "", m2ParHeure = 0, minimumMin = 0, coef = 1.0) => ({ id, nom, description, m2ParHeure, minimumMin, coef });

const tachesLogement = [
  T("four", "Intérieur du four", 2500, 30), T("frigo", "Intérieur du réfrigérateur", 1500, 20),
  T("hotte", "Hotte et filtres", 1500, 20), T("microondes", "Micro-ondes", 800, 10),
  T("placards_cuisine", "Placards de cuisine", 2000, 30), T("vaisselle", "Vaisselle", 1500, 20),
  T("vitres", "Vitres int. et ext.", 2500, 40), T("hauteurs", "Hauteurs et luminaires", 1500, 20),
  T("plinthes", "Plinthes", 1500, 20), T("placards_armoires", "Placards et armoires", 2500, 35),
  T("draps", "Changement des draps", 800, 10), T("repassage", "Repassage (1 h)", 2800, 60),
  T("lessive", "Lessive et pliage", 1500, 20), T("balcon", "Balcon", 1500, 20),
  T("terrasse", "Terrasse", 2500, 30), T("poubelles", "Sortie des poubelles", 500, 5),
];
const essentiel = ["draps", "poubelles", "hauteurs", "plinthes"];
const confort = [...essentiel, "vitres", "frigo", "microondes", "lessive"];
const prestige = [...confort, "four", "hotte", "placards_cuisine", "repassage", "balcon"];
const packsLogement = [
  { id: "essentiel", nom: "Essentiel", remisePct: 5, tacheIds: essentiel },
  { id: "confort", nom: "Confort", remisePct: 10, tacheIds: confort },
  { id: "prestige", nom: "Prestige", remisePct: 15, tacheIds: prestige },
];

export const RUBRIQUES = [
  { id: "home", nom: "Logement", sousTitre: "Ménage ponctuel ou régulier", emoji: "🏠", tauxHoraireC: 2800, salissureSurTemps: true,
    inclus: "Dépoussiérage des surfaces accessibles, aspiration et lavage des sols, cuisine, salle de bain et WC, poubelles, lits faits.",
    formules: [F("ponctuel", "Ménage ponctuel", "Un ménage complet, une seule fois.", 25, 120),
      F("regulier", "Entretien régulier", "Chaque semaine ou tous les 15 jours, idéalement avec le même Cleaneur.", 30, 90),
      F("grand", "Grand ménage", "Un nettoyage en profondeur, du sol au plafond.", 15, 120)],
    taches: tachesLogement, packs: packsLogement },
  { id: "rental", nom: "Location saisonnière", sousTitre: "Prêt pour vos prochains voyageurs", emoji: "🧳", tauxHoraireC: 3200, salissureSurTemps: true,
    inclus: "Ménage complet entre deux voyageurs, lits faits avec le linge fourni sur place, cuisine et sanitaires désinfectés, contrôle de l'inventaire et des consommables, photos de chaque pièce pour l'hôte.",
    formules: [F("court", "Après un court séjour (1–4 nuits)", "Rotation standard.", 0, 0, 1.0),
      F("semaine", "Après un séjour d'une semaine (5–9 nuits)", "Rotation approfondie.", 0, 0, 1.2),
      F("long", "Après un long séjour (10 nuits et +)", "Rotation complète.", 0, 0, 1.45),
      F("grand", "Grand ménage périodique", "Remise à niveau complète du logement.", 0, 0, 1.8)] },
  { id: "moving", nom: "Déménagement et remise en état", sousTitre: "Un nouveau départ, du sol au plafond", emoji: "📦", tauxHoraireC: 3200, salissureSurTemps: true,
    inclus: "Nettoyage complet du logement vide. Nettoyage uniquement : Cleaneroo ne réalise ni peinture, ni rebouchage, ni réparation.",
    formules: [F("emmenagement", "Nettoyage d'emménagement", "", 15, 180, 1.0), F("depart", "Nettoyage de départ / état des lieux", "", 15, 180, 1.1),
      F("remise", "Remise en état", "", 15, 180, 1.4)],
    packs: packsLogement },
  { id: "car", nom: "Véhicules", sousTitre: "Nettoyage intérieur et extérieur", emoji: "🚗", tauxHoraireC: 4000, salissureSurTemps: false,
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
  { id: "textiles", nom: "Canapés et textiles", sousTitre: "Canapés, matelas et tapis", emoji: "🛋️", tauxHoraireC: 3000, salissureSurTemps: false },
  { id: "construction", nom: "Fin de chantier", sousTitre: "Éliminer la poussière après les travaux", emoji: "🏗️", tauxHoraireC: 3800, salissureSurTemps: true },
  { id: "kitchen", nom: "Cuisines", sousTitre: "Nettoyage approfondi et dégraissage", emoji: "🍳", tauxHoraireC: 3600, salissureSurTemps: true },
  { id: "office", nom: "Bureaux et commerces", sousTitre: "Des locaux propres et accueillants", emoji: "🏢", tauxHoraireC: 2950, salissureSurTemps: false },
  { id: "communal", nom: "Parties communes", sousTitre: "Escaliers, halls et espaces communs", emoji: "🏘️", tauxHoraireC: 2800, salissureSurTemps: false },
  { id: "windows", nom: "Vitres et vitrines", sousTitre: "Fenêtres, vitrines et vérandas", emoji: "🪟", tauxHoraireC: 3000, salissureSurTemps: false },
  { id: "outdoor", nom: "Espaces extérieurs", sousTitre: "Terrasses, balcons et garages", emoji: "🌿", tauxHoraireC: 3200, salissureSurTemps: false },
  { id: "event", nom: "Avant et après événement", sousTitre: "Profitez pleinement de votre événement", emoji: "🎉", tauxHoraireC: 3200, salissureSurTemps: false },
  { id: "special", nom: "Prestations spécialisées", sousTitre: "Une évaluation par un professionnel qualifié", emoji: "🧪", tauxHoraireC: null, salissureSurTemps: false, toujoursSurDevis: true },
].map(r => ({ inclus: "", formules: [], taches: [], packs: [], toujoursSurDevis: false, ...r }));

export const rubrique = id => RUBRIQUES.find(r => r.id === id);

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

const L = (id, nom, coef) => ({ id, nom, coef });
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
    case "textiles": return [F("canape", "Canapé", "", 0, 60), F("matelas", "Matelas", "", 0, 60), F("tapis", "Tapis et moquettes", "", 25, 60)];
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
