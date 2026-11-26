// Catalogue lu par l'assistant « Décrire mon besoin » (Cleaneroo AI, 26/11/2026) : les MÊMES fichiers que le site
// (assets/js/catalogue.js), exportés en JSON pour la fonction serveur besoin-ia. AUCUN prix ici : l'IA choisit des identifiants,
// le prix est calculé par le moteur du site (estimation.js) puis revérifié au paiement.
// Lancé par outils/generer_pages.py : le catalogue de l'IA suit chaque mise en ligne du site, sans redéployer la fonction.
import { writeFileSync } from "node:fs";
const C = await import("../assets/js/catalogue.js");
const sans = o => JSON.parse(JSON.stringify(o));
const rubriques = C.RUBRIQUES.map(r => ({
  id: r.id, nom: r.nom, sousTitre: r.sousTitre || "", inclus: r.inclus || "", nonInclus: r.nonInclus || "", toujoursSurDevis: !!r.toujoursSurDevis,
  formules: (r.formules || []).map(f => ({ id: f.id, nom: f.nom, description: f.description || "" })),
  typesLieu: (C.TYPES_LIEU[r.id] || []).map(t => ({ id: t.id, nom: t.nom || t.libelle || t.id })),
  taches: (r.taches || []).map(t => ({ id: t.id, nom: t.nom, groupe: t.groupe || "", types: t.types || [], parSurface: !!t.parSurface })),
  packs: (r.packs || []).map(p => ({ id: p.id, nom: p.nom, tacheIds: p.tacheIds })),
  occasions: (r.occasions || []).map(o => ({ id: o.id, nom: o.nom || o.libelle || o.id })),
}));
const donnees = {
  genere_le: new Date().toISOString(),
  rubriques,
  elementsTextiles: C.ELEMENTS_TEXTILES.map(e => ({ id: e.id, nom: e.nom, formuleId: e.formuleId, avecTaille: !!e.avecTaille, parM2: !!e.parM2 })),
  taillesCanape: C.TAILLES_CANAPE.map(t => ({ id: t.id, libelle: t.libelle })),
  typesLogement: (C.TYPES_LOGEMENT || []).map(t => ({ id: t.id, nom: t.nom })),
  tachesATraiter: C.TACHES_A_TRAITER,
};
writeFileSync(new URL("../assets/catalogue-ia.json", import.meta.url), JSON.stringify(sans(donnees)));
console.log(rubriques.length, "prestations,", donnees.elementsTextiles.length, "éléments textiles");
