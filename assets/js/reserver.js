// Parcours de réservation en 5 étapes : copie de Reservation.kt (application Android).
// 1 prestation · 2 questionnaire · 3 photos · 4 adresse, accès et créneau · 5 estimation, coordonnées et envoi.
import { PARTIES, partie, partiePour, TARIFS_SPECIAUX, RUBRIQUES, rubrique, formulesPour, TYPES_LIEU, TYPES_LOGEMENT, BESOINS_SPECIAUX, ACCUEIL, accueilAutonomeInterdit, photosObligatoires,
  ELEMENTS_TEXTILES, TAILLES_CANAPE, prixLigne, minutesLigne, libelleLigne, pastille,
  FREQUENCES, JOURS_SEMAINE, DERNIERS_NETTOYAGES, packsPour, remisePack,
  TACHES_A_TRAITER, TYPES_CHANTIER, equipementsPour, DELAIS_URGENCE, TYPES_IMMEUBLE, surfaceEffective, SELECTION_CONSEILLEE_VEHICULE, LIEUX_VEHICULE, FREQUENCES_VEHICULE, RUBRIQUES_LOGEMENT, vuesPhotos, vuesCompletes, PIECES_LOCATION, ETAPES_LOCATION, PACK_ETAPES_CONSEILLE, CONSOMMABLES_LOCATION, PACK_CONSOMMABLES_CONSEILLE } from "./catalogue.js";
import { calculer, entreeEstimation, SALISSURE, disponibilite, meilleurPack, tachesChiffrees, formuleDe, passagesPlanifies, datesPassages,
  etapesDe, consommablesDe, menageTientEntreVoyageurs, frequenceDe, minutesEquipements, prixIndicatifEquipement, heuresEvenement } from "./estimation.js";
import { REGLES, euros, duree, heure, dateCourte, dateLongue, estPrelancement, MESSAGE_LANCEMENT, DATE_PREMIERES_INTERVENTIONS } from "./regles.js";
import { envoyerDemande } from "./donnees.js";
import { traduire } from "./langue.js";
import { icone } from "./icones.js";
import { blocReassurance } from "./commun.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const CLE_BROUILLON = "cleaneroo-brouillon";

/* ------------------------------------------------------------------ Mémoire : la 2e commande en quelques secondes (comme l'app : AppData.modeles et logements)
   Gardé sur l'appareil du client uniquement : coordonnées, adresses enregistrées, dernière commande par prestation.
   Jamais le code d'accès ni le créneau. « Oublier mes informations » dans Mes prestations efface tout. */
const CLE_PROFIL = "cleaneroo-profil", CLE_LOGEMENTS = "cleaneroo-logements", CLE_MODELES = "cleaneroo-modeles";
const lire = (cle, defaut) => { try { return JSON.parse(localStorage.getItem(cle) || "null") ?? defaut; } catch { return defaut; } };
const ecrire = (cle, v) => { try { localStorage.setItem(cle, JSON.stringify(v)); } catch { /* rien */ } };
export const profil = () => lire(CLE_PROFIL, null);
export const logements = () => lire(CLE_LOGEMENTS, []);
/** Dernières commandes, la plus récente d'abord : [{ rubriqueId, quand, logementId, ... }]. */
export const modeles = () => Object.values(lire(CLE_MODELES, {})).sort((a, b) => b.quand - a.quand);
export function oublierMesInformations() { [CLE_PROFIL, CLE_LOGEMENTS, CLE_MODELES, CLE_BROUILLON].forEach(k => { try { localStorage.removeItem(k); } catch { /* rien */ } }); }
const CHAMPS_LOGEMENT = ["rue", "codePostal", "ville", "accueil", "tiersNom", "tiersTel", "boiteEmplacement"];
const PRIVES = ["prenom", "nom", "email", "telephone", "code", "jour", "heure", "cgv", "etape", "sansPhotos", "flexible", ...CHAMPS_LOGEMENT];
/** Libellé court d'une adresse enregistrée : « Appartement · Fréjus ». */
export const nomLogement = l => l.nom ? `${l.nom} · ${l.ville}` : `${(TYPES_LOGEMENT.find(t => t.id === l.typeLogementId) || {}).nom || "Adresse"} · ${l.ville}`;

function memoriserCommande(b) {
  ecrire(CLE_PROFIL, { prenom: b.prenom.trim(), nom: b.nom.trim(), email: b.email.trim(), telephone: b.telephone.trim() });
  const liste = logements();
  const meme = l => l.rue.trim().toLowerCase() === b.rue.trim().toLowerCase() && l.codePostal === b.codePostal;
  const ancien = liste.find(meme);
  const log = { ...(ancien || {}), id: ancien?.id || "l" + Date.now(), typeLogementId: b.typeLogementId, surface: b.surface, chambres: b.chambres, sdb: b.sdb, niveaux: b.niveaux,
    ...Object.fromEntries(CHAMPS_LOGEMENT.map(k => [k, String(b[k] ?? "").trim()])) };
  ecrire(CLE_LOGEMENTS, [log, ...liste.filter(l => !meme(l))].slice(0, REGLES.BIENS_MAX));
  const modele = Object.fromEntries(Object.entries(b).filter(([k]) => !PRIVES.includes(k)));
  // « Mémoriser ces étapes pour ce logement » décoché : les étapes ne sont pas reprises la prochaine fois.
  if (b.rubriqueId === "rental" && b.memoriserEtapes === false) { delete modele.etapesChoisies; delete modele.etapesPerso; delete modele.consommablesChoisis; }
  ecrire(CLE_MODELES, { ...lire(CLE_MODELES, {}), [b.rubriqueId]: { ...modele, logementId: log.id, quand: Date.now() } });
}

/** Applique une adresse enregistrée au brouillon (adresse et accès ; le code est redemandé). */
function avecLogement(br, l) {
  if (!l) return br;
  const dims = ["home", "rental"].includes(br.rubriqueId) ? { typeLogementId: l.typeLogementId, surface: l.surface, chambres: l.chambres, sdb: l.sdb, niveaux: l.niveaux } : {};
  return { ...br, ...dims, ...Object.fromEntries(CHAMPS_LOGEMENT.map(k => [k, l[k] || ""])), logementId: l.id, code: "" };
}

/* ------------------------------------------------------------------ Pré-remplissage depuis le calculateur ou une page ville
   La page écrit { rubriqueId, champs } (calculateur) ou { lieu: { codePostal, ville } } (page ville), puis ouvre la réservation. */
const CLE_PREREMPLI = "cleaneroo-prerempli";
let lieuEnAttente = null;   // ville choisie sur une page ville : appliquée dès que la prestation est choisie
function lirePrerempli() { const p = lire(CLE_PREREMPLI, null); try { localStorage.removeItem(CLE_PREREMPLI); } catch { /* rien */ } return p; }
export function preremplir(donnees) { ecrire(CLE_PREREMPLI, donnees); }

/** Brouillon d'exemple (pages ville, calculateur) : mêmes valeurs par défaut qu'une vraie réservation, donc mêmes prix. */
export function brouillonExemple(rubriqueId, champs = {}) {
  const r = rubrique(rubriqueId);
  return { ...vierge(rubriqueId, "personnel", r, TYPES_LIEU[rubriqueId]), ...champs };
}

function nouveauBrouillon(rubriqueId, espace = "personnel", rapide = false) {
  const br = brouillonInitial(rubriqueId, partiePour(rubriqueId, espace), rapide);
  return lieuEnAttente && !br.rue ? { ...br, ...lieuEnAttente } : br;
}

function brouillonInitial(rubriqueId, espace = "personnel", rapide = false) {
  const r = rubrique(rubriqueId);
  const lieux = TYPES_LIEU[rubriqueId];
  const p = profil() || {};
  const m = lire(CLE_MODELES, {})[rubriqueId];
  const log = logements().find(l => l.id === m?.logementId) || logements()[0];
  // Déjà commandé : tout est repris ; « rapide » ouvre directement l'adresse et le créneau.
  if (m) return avecLogement({ ...vierge(rubriqueId, espace, r, lieux), ...m, prenom: p.prenom || "", nom: p.nom || "", email: p.email || "", telephone: p.telephone || "",
    etape: rapide && log ? 4 : 2, jour: "", heure: -1, cgv: false }, log);
  return avecLogement({ ...vierge(rubriqueId, espace, r, lieux), prenom: p.prenom || "", nom: p.nom || "", email: p.email || "", telephone: p.telephone || "" }, log);
}

/** Surface proposée au départ, selon la prestation (comme nouveauBrouillon dans l'appli). */
const SURFACE_DEPART = { office: 120, commerce: 120, communal: 200, kitchen: 30, outdoor: 40, event: 100, construction: 80 };
function vierge(rubriqueId, espace, r, lieux) {
  return {
    rubriqueId, espace, etape: 2, typeLogementId: "appartement", surface: SURFACE_DEPART[rubriqueId] ?? 62, chambres: 2, sdb: 1, niveaux: 1, fenetres: 8,
    formuleId: formulesPour(r)[0]?.id || "", typeLieuId: lieux ? lieux[0].id : "", salissure: "NORMAL",
    taches: [], tachesPerso: [], animaux: false, etapesLocation: 8, consommables: true, remarque: "",
    accueil: "", tiersNom: "", tiersTel: "", boiteEmplacement: "", code: "",
    rue: "", codePostal: "", ville: "", jour: "", heure: -1, flexible: false, engagementMois: 0,
    choixCleaneur: "candidatures", prenom: "", nom: "", email: "", telephone: "", cgv: false, logementId: "",
    panier: [], elementTextile: "", tailleCanape: "t15", quantitePanier: 1, surfaceMoquette: 10,
    frequence: "semaine", moment: "", memeCleaneur: true, passages: REGLES.PASSAGES_DEFAUT, jours: [],
    occasion: "", dernierNettoyage: "", natures: [],
    etapesChoisies: [...PACK_ETAPES_CONSEILLE], etapesPerso: [], consommablesChoisis: [...PACK_CONSOMMABLES_CONSEILLE],
    departVoyageursH: REGLES.DEPART_VOYAGEURS_DEFAUT_H, arriveeSuivanteH: REGLES.ARRIVEE_SUIVANTE_DEFAUT_H, aChaqueDepart: false, memoriserEtapes: true,
  };
}

let b = null;            // brouillon en cours
let photos = [];         // fichiers choisis (non sauvegardés dans le brouillon)
let vuesPrises = {};     // étape 3 : vue → fichier (une photo par vue)
let photoBoite = null;   // photo de la boîte à clés (accueil « Boîte à clés »), non sauvegardée dans le brouillon
let racine = null;
let envoi = false;

function sauver() { try { localStorage.setItem(CLE_BROUILLON, JSON.stringify(b)); } catch { /* rien */ } }
function charger() { try { return JSON.parse(localStorage.getItem(CLE_BROUILLON) || "null"); } catch { return null; } }

export function ouvrirReservation(conteneur, rubriqueId, option = "") {
  racine = conteneur;
  const ancien = charger();
  const rapide = option === "rapide";
  if (rubriqueId && rubrique(rubriqueId)) b = !rapide && ancien && ancien.rubriqueId === rubriqueId ? ancien : nouveauBrouillon(rubriqueId, ancien?.espace, rapide);
  else b = ancien && ancien.etape > 1 ? ancien : null;
  if (b?.rubriqueId) b = { ...b, espace: partiePour(b.rubriqueId, b.espace) };
  // Code postal saisi sur l'accueil (« Voir mon prix »).
  const cp = option.match(/^cp-(\d{5})$/)?.[1];
  if (b && cp && !b.rue) b = { ...b, codePostal: cp };
  // Calculateur : étape 2 préremplie. Page ville : étape 1, la ville sera reprise à l'adresse.
  const pr = lirePrerempli();
  if (pr?.lieu) { lieuEnAttente = pr.lieu; if (!rubriqueId) b = null; else if (b && !b.rue) b = { ...b, ...pr.lieu }; }
  // Espace Pro : « Programmer le ménage » après un départ (bien et jour repris).
  if (pr?.bienId && rubrique(rubriqueId)) {
    const l = logements().find(x => x.id === pr.bienId);
    b = { ...avecLogement(nouveauBrouillon(rubriqueId, "conciergerie"), l), jour: pr.jour || "", heure: -1, etape: 2 };
  }
  if (pr?.champs && pr.rubriqueId === rubriqueId && rubrique(rubriqueId)) b = { ...nouveauBrouillon(rubriqueId, ancien?.espace || "personnel"), ...pr.champs, etape: 2 };
  photos = [];
  vuesPrises = {};
  photoBoite = null;
  // Historique : une entrée par étape, pour que la touche retour du téléphone revienne à l'étape précédente.
  const n = b ? b.etape : 1;
  history.replaceState({ ...(history.state || {}), cleanerooEtape: 1 }, "");
  for (let i = 2; i <= n; i++) history.pushState({ cleanerooEtape: i }, "");
  rendre();
}

/** Nouvelle étape vers l'avant : une entrée d'historique de plus. */
function noterEtape() { history.pushState({ cleanerooEtape: b ? b.etape : 1 }, ""); }

/** « ‹ Retour » à l'écran : comme la touche retour du téléphone. */
function retour() {
  if (history.state?.cleanerooEtape > 1) return history.back();
  if (b && b.etape > 2) return maj({ etape: b.etape - 1 }, true);
  b = { ...(b || {}), espace: b?.espace || "personnel", etape: 1 }; sauver(); rendre(); window.scrollTo(0, 0);
}

window.addEventListener("popstate", e => {
  const n = e.state?.cleanerooEtape;
  if (!n || !racine || !document.body.contains(racine) || !location.hash.startsWith("#/reserver")) return;
  // Étape 1 : la prestation est gardée, on la retrouve telle quelle si on la choisit de nouveau.
  b = n === 1 ? { ...(b || {}), espace: b?.espace || "personnel", etape: 1 } : { ...b, etape: n };
  sauver(); rendre(); window.scrollTo(0, 0);
});

function maj(changes, defiler = false) {
  b = { ...b, ...changes };
  sauver();
  rendre();
  if (defiler) window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ------------------------------------------------------------------ Composants (même rendu que l'app) */
const titre = t => `<h3 style="margin:26px 0 10px">${t}</h3>`;
const choix = (liste, actuel, champ) => `<div class="choix">${liste.map(([id, lib]) =>
  `<button type="button" data-champ="${champ}" data-valeur="${esc(id)}" class="${String(actuel) === String(id) ? "choisi" : ""}">${esc(lib)}</button>`).join("")}</div>`;
const compteur = (lib, champ, val, { min = 0, max = 999, pas = 1, unite = "" } = {}) => `
  <div class="compteur"><span>${lib}</span><span class="regle">
    <button type="button" data-moins="${champ}" data-min="${min}" data-pas="${pas}" aria-label="Moins" ${val <= min ? "disabled" : ""}>−</button>
    <output>${val}${unite}</output>
    <button type="button" data-plus="${champ}" data-max="${max}" data-pas="${pas}" aria-label="Plus" ${val >= max ? "disabled" : ""}>+</button></span></div>`;
const caseCocher = (lib, champ, val, info = "") => `<label class="case"><input type="checkbox" data-case="${champ}" ${val ? "checked" : ""}><span>${lib}${info ? `<span class="petit" style="display:block">${info}</span>` : ""}</span></label>`;
const champTexte = (lib, champ, val, type = "text", extra = "") => `<label class="champ">${lib}<input type="${type}" data-texte="${champ}" value="${esc(val)}" ${extra}></label>`;

/* ------------------------------------------------------------------ Étapes */
function etape1() {
  return `<h1>Que souhaitez-vous nettoyer ?</h1><p class="muet">Choisissez votre prestation : le prix s'affiche dès que vous décrivez votre besoin.</p>
    ${titre("Pour qui ?")}
    <div class="segments trois">${PARTIES.map(p => `<button type="button" data-espace="${p.id}" class="${partie(b?.espace).id === p.id ? "choisi" : ""}">${p.nom}</button>`).join("")}</div>
    <p class="petit" style="margin:6px 0 0">${partie(b?.espace).detail}</p>
    ${modeles().length ? titre("Comme la dernière fois") + `<div class="grille-2">${modeles().slice(0, 4).map(m => {
      const r = rubrique(m.rubriqueId), l = logements().find(x => x.id === m.logementId);
      return `<a class="carte prestation rapide" href="#/reserver/${m.rubriqueId}/rapide">${icone(r.icone, { tuile: true })}<h3>${r.nom}</h3>
        <p class="muet" style="margin:4px 0 0">${l ? esc(nomLogement(l)) : ""}</p><span class="tampon vert">Recommander en 3 clics ›</span></a>`; }).join("")}</div>` : ""}
    ${titre("Votre prestation")}
    <div class="grille-3">${RUBRIQUES.filter(r => partie(b?.espace).rubriques.includes(r.id)).map(r => `<button type="button" class="carte prestation" data-rubrique="${r.id}" style="text-align:left">
      ${icone(r.icone, { tuile: true })}<h3>${r.nom}</h3><p class="muet" style="margin:4px 0 0">${r.sousTitre}</p><span class="tampon">${pastille(r)}</span></button>`).join("")}</div>`;
}

function etape2() {
  const r = rubrique(b.rubriqueId);
  const formules = formulesPour(r);
  let h = `<h2>${icone(r.icone)} ${r.nom}</h2><p class="muet">Décrivez le besoin</p>`;
  if (b.rubriqueId === "special") {
    h += `<div class="note" style="margin-top:14px">Prix fixé à l'avance selon le type d'intervention et la surface : forfait, puis prix au m² au-delà.</div>`
      + (TARIFS_SPECIAUX[b.typeLieuId]?.certibiocide ? `<div class="note" style="margin-top:8px">Intervention réalisée par un Cleaneur titulaire du Certibiocide « nuisibles », vérifié avant activation.</div>` : "");
  }
  if (RUBRIQUES_LOGEMENT.includes(b.rubriqueId)) h += titre("Type de logement") + choix(TYPES_LOGEMENT.map(t => [t.id, t.nom]), b.typeLogementId, "typeLogementId");
  const lieux = TYPES_LIEU[b.rubriqueId];
  if (lieux) h += titre(r.titreTypes || { car: "Gabarit du véhicule", construction: "Type de sol", kitchen: "Type d'établissement" }[b.rubriqueId] || "Type de lieu")
    + choix(lieux.map(l => [l.id, l.nom]), b.typeLieuId, "typeLieuId");
  if (b.rubriqueId !== "car") {
    h += titre("Choisissez votre formule") + formules.map(f => `<button type="button" class="option ${f.id === b.formuleId ? "choisi" : ""}" data-champ="formuleId" data-valeur="${f.id}">
      ${esc(f.nom)}${f.description ? `<span class="detail">${esc(f.description)}</span>` : ""}</button>`).join("");
    h += questionsFormule(r);
    if (b.rubriqueId === "special" && b.formuleId === "urgente") h += titre("Délai souhaité") + choix(DELAIS_URGENCE, b.delai || "48h", "delai");
    const inclus = (lieux || []).find(l => l.id === b.typeLieuId)?.inclus || r.inclus;
    if (inclus) h += `<div class="carte teintee" style="margin-top:6px"><b style="color:var(--primaire)">Inclus dans votre forfait</b><p class="muet" style="margin:4px 0 0;font-size:14px">${esc(inclus)}</p></div>`;
  }
  if (b.rubriqueId === "textiles") h += panierTextiles();
  if (b.rubriqueId !== "car") {
    if (b.rubriqueId === "special" && TARIFS_SPECIAUX[b.typeLieuId]?.surface !== false) h += titre("Dimensions") + `<div class="carte">${compteur("Surface à traiter", "surface", b.surface, { min: 5, max: 5000, unite: " m²" })}`
      + (surfaceEffective(b) > REGLES.SEUIL_DEVIS_SURFACE_M2 ? `<p style="color:var(--alerte);font-size:14px">Au-delà de 300 m² : devis obligatoire.</p>` : "") + `</div>`;
    if (!["textiles", "special"].includes(b.rubriqueId)) h += titre("Dimensions") + `<div class="carte">`
      + (b.rubriqueId === "windows" ? compteur("Nombre de fenêtres", "fenetres", b.fenetres, { min: 1, max: 200 })
          + compteur("Surface vitrée approximative", "surfaceVitree", b.surfaceVitree ?? 20, { min: 1, max: 500, unite: " m²" })
          + `<p class="petit">La surface vitrée sert uniquement aux tâches à la surface.</p>`
        : b.rubriqueId === "communal" && TYPES_IMMEUBLE.includes(b.typeLieuId)
          ? compteur("Surface par palier", "surfacePalier", b.surfacePalier ?? REGLES.SURFACE_PALIER_DEFAUT_M2, { min: 5, max: 300, unite: " m²" })
          + compteur("Nombre de paliers (étages)", "paliers", b.paliers ?? REGLES.PALIERS_DEFAUT, { min: 1, max: REGLES.PALIERS_MAX })
          + `<p class="petit">Surface totale : ${surfaceEffective(b)} m² (${b.surfacePalier ?? REGLES.SURFACE_PALIER_DEFAUT_M2} m² × ${b.paliers ?? REGLES.PALIERS_DEFAUT} paliers).</p>`
        : compteur("Surface", "surface", b.surface, { min: 5, max: 5000, unite: " m²" }))
      + ([...RUBRIQUES_LOGEMENT, "rental"].includes(b.rubriqueId) ? compteur("Chambres", "chambres", b.chambres, { max: 12 }) + compteur("Salles de bain", "sdb", b.sdb, { min: 1, max: 8 }) : "")
      + (RUBRIQUES_LOGEMENT.includes(b.rubriqueId) ? compteur("Niveaux", "niveaux", b.niveaux, { min: 1, max: 5 }) + (b.niveaux > 1 ? `<p class="petit">+15 min par niveau supplémentaire</p>` : "") : "")
      + (b.rubriqueId === "office" && ["bureaux", "agence"].includes(b.typeLieuId) ? compteur("Postes de travail", "postes", b.postes ?? 10, { min: 1, max: 500 }) : "")
      + (b.rubriqueId === "event" ? compteur("Nombre de convives", "convives", b.convives ?? 50, { min: 1, max: 2000 }) : "")
      + (surfaceEffective(b) > REGLES.SEUIL_DEVIS_SURFACE_M2 ? `<p style="color:var(--alerte);font-size:14px">Au-delà de 300 m² : devis obligatoire.</p>` : "")
      + `</div>`;
  }
  if (b.rubriqueId === "rental") h += etapesLocation();
  if (b.rubriqueId === "car") h += questionsVehicule();
  if (!r.toujoursSurDevis && !["car", "construction", "special"].includes(b.rubriqueId)) {
    h += titre("État de saleté") + `<div class="segments">${Object.entries(SALISSURE).map(([k, s]) =>
      `<button type="button" data-champ="salissure" data-valeur="${k}" class="${b.salissure === k ? "choisi" : ""}">${s.libelle}</button>`).join("")}</div>`;
  }
  if (b.rubriqueId === "construction") h += questionsChantier();
  if (b.rubriqueId === "kitchen") h += equipementsCuisine();
  const chiffrees = tachesChiffrees(b), packs = packsPour(r, b.typeLieuId);
  if (chiffrees.length) {
    h += titre("Tâches complémentaires");
    if (packs.length) {
      h += `<p class="petit"><b>Nos formules</b></p>` + packs.map(p => {
        const tp = chiffrees.filter(t => p.tacheIds.includes(t.id));
        const brut = tp.reduce((s, t) => s + t.prixC, 0), net = brut - remisePack(p, chiffrees);
        const actif = meilleurPack(packs, b.taches, chiffrees)?.id === p.id; // une seule formule en vert : celle dont la remise s'applique
        return `<button type="button" class="option ${actif ? "choisi" : ""}" data-pack="${p.id}" style="display:flex;gap:12px;align-items:center">
          <span style="flex:1">${p.nom} <span class="tampon">−${p.remisePct} %</span><span class="detail">${tp.map(t => t.nom.toLowerCase()).join(", ")}</span></span>
          <span style="text-align:right">${euros(net)}<span class="detail" style="text-decoration:line-through">${euros(brut)}</span></span></button>`;
      }).join("") + `<p class="petit">La remise s'applique tant que toutes les tâches de la formule restent cochées. Une seule formule remisée par demande.</p>`;
    }
    // Une carte par groupe, avec son intertitre
    const groupes = [...new Set(chiffrees.map(t => t.groupe))];
    h += groupes.map(g => (g ? `<p class="petit" style="margin:12px 0 4px"><b>${esc(g)}</b></p>` : "")
      + `<div class="carte">${chiffrees.filter(t => t.groupe === g).map(t => `<label class="case"><input type="checkbox" data-tache="${t.id}" ${b.taches.includes(t.id) ? "checked" : ""}>
      <span>${t.nom}</span><span class="info">${euros(t.prixC)} · ${duree(t.minutes)}</span></label>`).join("")}</div>`).join("");
    if (r.noteTaches) h += `<div class="note alerte" style="margin-top:10px">${esc(r.noteTaches)}</div>`;
    if (r.surfaceReferenceM2 > 0 && chiffrees.some(t => t.parSurface)) h += `<p class="petit">Tâches marquées à la surface : prix pour ${r.surfaceReferenceM2} m², au prorata au-delà.</p>`;
  }
  if (!r.toujoursSurDevis && b.rubriqueId !== "special") {
    h += titre("Une autre demande ?") + `<div class="carte">${b.tachesPerso.map((t, i) => `<div style="display:flex;align-items:center"><span style="flex:1">• ${esc(t)}</span>
      <button type="button" class="lien-bouton" style="color:var(--erreur)" data-retirer="${i}">Retirer</button></div>`).join("")}
      <div style="display:flex;gap:8px;align-items:center"><input class="texte" id="saisie-perso" maxlength="120" placeholder="Ex. : nettoyer l'intérieur du lave-linge" style="margin:0">
      <button type="button" class="lien-bouton" id="ajouter-perso">Ajouter</button></div>
      <p class="petit">Chaque tâche particulière compte 15 min dans l'estimation ; le Cleaneur la confirme.</p></div>`;
  }
  if (b.rubriqueId === "home") h += `<div class="carte" style="margin-top:14px">${caseCocher("Des animaux vivent dans le logement", "animaux", b.animaux)}</div>`;
  if (b.rubriqueId === "office" || b.rubriqueId === "commerce") h += `<div class="carte" style="margin-top:14px">${caseCocher("Les lieux seront vides pendant l'intervention", "lieuxVides", !!b.lieuxVides)}</div>`;
  if (b.rubriqueId === "event") h += horairesEvenement();
  if (b.rubriqueId === "moving") h += `<div class="carte" style="margin-top:14px">${caseCocher("Le logement sera entièrement vide (meubles et cartons sortis)", "lieuxVides", !!b.lieuxVides)}</div>`;
  h += blocAccueil();
  const accueilOk = accueilValide(b);
  const tachesOk = b.rubriqueId !== "car" || b.taches.length > 0;
  const panierOk = b.rubriqueId !== "textiles" || (b.panier || []).length > 0;
  const chantierOk = b.rubriqueId !== "construction" || !!b.artisansPartis;
  const equipementsOk = b.rubriqueId !== "kitchen" || minutesEquipements(b) > 0;
  const joursOk = !(formuleDe(b)?.genre === "REGULIER" && b.frequence === "plusieurs") || (b.jours || []).length >= REGLES.JOURS_MIN_PLUSIEURS_PAR_SEMAINE;
  const ok = accueilOk && tachesOk && panierOk && joursOk && chantierOk && equipementsOk;
  return h + actions(ok, ok ? "" : !equipementsOk ? "Ajoutez au moins un équipement."
    : !chantierOk ? "Cochez « Les artisans auront quitté les lieux » pour continuer."
    : !panierOk ? "Ajoutez chaque élément au panier."
    : !joursOk ? "Choisissez au moins deux jours de passage."
    : !tachesOk ? "Choisissez au moins une tâche." : "Précisez l'accueil du Cleaneur pour continuer.");
}

/** Téléphone : au moins 10 chiffres (Validation.telephoneValide dans l'appli). */
const telephoneValide = t => (t || "").replace(/\D/g, "").length >= 10;
function accueilValide(b) {
  return !!b.accueil && ({ TIERS: b.tiersNom.trim() && telephoneValide(b.tiersTel), BOITE: b.boiteEmplacement.trim() && b.code.trim(), AUTONOME: b.code.trim(), PRESENT: true }[b.accueil]);
}
/** « Accueil du Cleaneur » : mêmes choix, champs et textes que l'appli (fin de l'étape 2). */
function blocAccueil() {
  const interdit = accueilAutonomeInterdit(b.rubriqueId, b.typeLieuId);
  const options = Object.entries(ACCUEIL).filter(([k]) => (b.rubriqueId === "special" ? k === "PRESENT" : !interdit || ["PRESENT", "TIERS"].includes(k)));
  let acces = "";
  if (b.accueil === "TIERS") acces = champTexte("Prénom et nom", "tiersNom", b.tiersNom, "text", 'maxlength="80"') + champTexte("Téléphone", "tiersTel", b.tiersTel, "tel", 'maxlength="20"')
    + (b.tiersTel && !telephoneValide(b.tiersTel) ? `<p class="erreur" style="margin:0">Au moins 10 chiffres.</p>` : "");
  if (b.accueil === "BOITE") acces = champTexte("Emplacement de la boîte", "boiteEmplacement", b.boiteEmplacement, "text", 'maxlength="120"') + champTexte("Code", "code", b.code, "text", 'maxlength="30" autocomplete="off"')
    + `<div class="photo-boite"><p class="titre-photo-boite">Photo de la boîte à clés <span class="petit">(facultatif)</span></p>
        ${photoBoite ? `<img class="apercu-boite" alt="Boîte à clés" data-apercu-boite>` : ""}
        <div class="boutons-photo"><label class="bouton secondaire" style="cursor:pointer">${icone("photo")} ${photoBoite ? "Reprendre la photo" : "Prendre une photo"}<input type="file" id="photo-boite-appareil" accept="image/*" capture="environment" hidden></label>
          <label class="bouton secondaire" style="cursor:pointer">Galerie<input type="file" id="photo-boite-galerie" accept="image/*" hidden></label>
          ${photoBoite ? `<button type="button" class="lien-bouton" data-retirer-photo-boite>Retirer</button>` : ""}</div>
        <p class="petit">Elle aide le Cleaneur à trouver la boîte du premier coup.</p></div>`
    + `<p class="petit">Le code et la photo ne sont transmis au Cleaneur qu'une fois la mission confirmée.</p>`;
  if (b.accueil === "AUTONOME") acces = champTexte("Consignes et code d'arrivée", "code", b.code, "text", 'maxlength="120" autocomplete="off"');
  return titre("Accueil du Cleaneur")
    + (interdit ? `<div class="note" style="margin-bottom:10px">Accueil par une personne sur place, sans accès autonome.</div>` : "")
    + choix(options, b.accueil, "accueil")
    + (acces ? `<div class="carte" style="margin-top:10px">${acces}</div>` : "");
}

/** Événements : jour, heures de début et de fin, règles de passage (HorairesEvenement dans l'appli). */
function horairesEvenement() {
  const regle = { apres: "Après : le passage commence à partir de la fin de l'événement.",
    avant_apres: "Avant et après : deux passages, l'un terminé avant le début, l'autre à partir de la fin." }[b.formuleId]
    || "Avant : le passage est terminé avant le début de l'événement.";
  return titre("Horaires de l'événement") + `<div class="carte">${champTexte("Jour de l'événement", "evtDate", b.evtDate || "", "date")}
      ${compteur("Début de l'événement", "evtDebutH", b.evtDebutH ?? 18, { min: 6, max: 23, unite: " h" })}
      ${compteur("Fin de l'événement", "evtFinH", b.evtFinH ?? 23, { min: 7, max: 23, unite: " h" })}
      <p class="petit">${regle}</p></div>`;
}

/** Cuisines : équipements à l'unité, prix indicatif, note sur les produits (EquipementsCuisine dans l'appli). */
function equipementsCuisine() {
  const eq = b.equipements || {};
  return titre("Équipements à nettoyer") + `<div class="carte">${equipementsPour(b.typeLieuId).map(e =>
      `<div class="compteur"><span><span>${e.nom}</span> · ${euros(prixIndicatifEquipement(e, b))}</span><span class="regle">
        <button type="button" data-equip-moins="${e.id}" aria-label="Moins" ${(eq[e.id] || 0) <= 0 ? "disabled" : ""}>−</button>
        <output>${eq[e.id] || 0}</output>
        <button type="button" data-equip-plus="${e.id}" aria-label="Plus" ${(eq[e.id] || 0) >= 20 ? "disabled" : ""}>+</button></span></div>`).join("")}
      <p class="petit">Au moins un équipement. Prix indicatif par équipement, selon l'établissement et l'intensité.</p></div>`
    + `<div class="note" style="margin-top:10px">Produits compatibles contact alimentaire.</div>`;
}

/** Fin de chantier : fenêtres, pièces, type de chantier, départ des artisans, réception des travaux (QuestionsChantier dans l'appli). */
function questionsChantier() {
  return `<div class="carte" style="margin-top:14px">${compteur("Nombre de fenêtres", "fenetres", b.fenetres ?? 8, { min: 0, max: 100 })}
      ${compteur("Nombre de pièces", "pieces", b.pieces ?? 3, { min: 1, max: REGLES.CHANTIER_PIECES_MAX })}
      <p class="petit">+15 min par fenêtre ; une photo par pièce à l'étape suivante.</p></div>`
    + titre("Type de chantier") + choix(TYPES_CHANTIER, b.typeChantier || "", "typeChantier")
    + `<div class="carte" style="margin-top:10px">${caseCocher("Les artisans auront quitté les lieux", "artisansPartis", !!b.artisansPartis)}</div>`
    + titre("Réception ou livraison des travaux") + champTexte("Date (facultatif)", "dateReception", b.dateReception || "", "date")
    + `<p class="petit">Le Cleaneur planifie son passage pour que tout soit prêt avant cette date.</p>`
    + `<div class="note" style="margin-top:14px">Fin de chantier : jamais « standard ». Le niveau de salissure sera estimé dès que toutes les photos seront exploitables.</div>`;
}

/** Véhicules : nombre, lieu, eau et électricité, fréquence, animaux, sélection conseillée (QuestionsVehicule dans l'appli). */
function questionsVehicule() {
  const freq = b.frequenceVehicule || "unique";
  return `<div class="carte" style="margin-top:14px">${compteur("Nombre de véhicules", "nombreVehicules", b.nombreVehicules || 1, { min: REGLES.VEHICULES_MIN, max: REGLES.VEHICULES_MAX })}
      <p class="petit">Tâches et remise multipliées par le nombre de véhicules.</p></div>`
    + titre("Lieu d'intervention") + choix(LIEUX_VEHICULE, b.lieuVehicule || "domicile", "lieuVehicule")
    + `<div class="carte" style="margin-top:10px">${caseCocher("Eau et électricité disponibles sur place", "eauElectricite", b.eauElectricite !== false)}</div>`
    + titre("Fréquence") + choix(FREQUENCES_VEHICULE, freq, "frequenceVehicule")
    + (freq !== "unique" ? `<div class="note" style="margin-top:10px">Idéal pour une flotte d'entreprise : chaque passage est planifié et facturé séparément.</div>
      <div class="carte" style="margin-top:10px">${compteur("Passages à planifier", "passages", b.passages || REGLES.PASSAGES_DEFAUT, { min: REGLES.PASSAGES_MIN, max: REGLES.PASSAGES_MAX })}</div>` : "")
    + `<div class="carte" style="margin-top:10px">${caseCocher("Des animaux voyagent dans le véhicule", "animaux", !!b.animaux)}
      ${b.animaux && !b.taches.includes("poils") ? `<button type="button" class="lien-bouton" id="ajouter-poils">Ajouter « Poils d'animaux »</button>` : ""}</div>`
    + `<p style="margin:12px 0 0"><button type="button" class="lien-bouton" id="selection-conseillee">Sélection conseillée ›</button></p>`;
}

/** Location saisonnière : étapes par pièce, étapes personnalisées, consommables, horaires, mémoire (EtapesLocation dans l'appli). */
const titreAction = (t, id, action) => `<div style="display:flex;align-items:baseline;gap:10px;margin:26px 0 10px"><h3 style="margin:0;flex:1">${t}</h3>`
  + `<button type="button" class="lien-bouton" id="${id}">${action}</button></div>`;
function etapesLocation() {
  const etapes = etapesDe(b), perso = b.etapesPerso || [], conso = consommablesDe(b);
  return titreAction("Étapes à valider en photo", "pack-etapes", "Pack conseillé")
    + `<p class="petit">Une étape « Chambre » compte une fois par chambre, « Salle de bain » une fois par salle de bain.</p>`
    + PIECES_LOCATION.map(([piece, nom]) => `<p class="petit" style="margin:12px 0 4px"><b>${nom}</b></p><div class="carte">`
      + ETAPES_LOCATION.filter(e => e.piece === piece).map(e => `<label class="case"><input type="checkbox" data-etape="${e.id}" ${etapes.includes(e.id) ? "checked" : ""}>
        <span>${e.nom}</span><span class="info">${e.minutes ? `+${e.minutes} min` : "Incluse"}</span></label>`).join("")
      + perso.map((p, i) => p.piece === piece ? `<div style="display:flex;align-items:center;gap:8px"><span style="flex:1">• ${esc(p.texte)}</span>
        <span class="info">+${REGLES.ETAPE_PERSO_LOCATION_MIN} min</span><button type="button" class="lien-bouton" style="color:var(--erreur)" data-retirer-etape="${i}">Retirer</button></div>` : "").join("")
      + `</div>`).join("")
    + `<div class="carte" style="margin-top:10px"><b>Ajouter une étape</b>
      <div style="display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap"><select id="piece-perso" class="texte" style="margin:0;flex:0 1 190px">${PIECES_LOCATION.map(([id, nom]) => `<option value="${id}">${nom}</option>`).join("")}</select>
      <input class="texte" id="saisie-etape" maxlength="120" placeholder="Ex. : arroser l'olivier" style="margin:0;flex:1 1 180px">
      <button type="button" class="lien-bouton" id="ajouter-etape">Ajouter</button></div><p class="petit">Étape personnalisée : +10 min.</p></div>`
    + titreAction("Consommables à contrôler", "pack-conso", "Pack conseillé")
    + `<div class="carte">${CONSOMMABLES_LOCATION.map(([id, nom]) => `<label class="case"><input type="checkbox" data-conso="${id}" ${conso.includes(id) ? "checked" : ""}><span>${nom}</span></label>`).join("")}
      <p class="petit">+10 min si la liste n'est pas vide.</p></div>`
    + `<div class="note alerte" style="margin-top:10px">Le Cleaneur n'apporte jamais de consommables : ils doivent être sur place.</div>`
    + titre("Horaires des voyageurs") + `<div class="carte">`
    + compteur("Départ des voyageurs", "departVoyageursH", b.departVoyageursH ?? REGLES.DEPART_VOYAGEURS_DEFAUT_H, { min: REGLES.DEPART_VOYAGEURS_MIN_H, max: REGLES.DEPART_VOYAGEURS_MAX_H, unite: " h" })
    + compteur("Arrivée suivante", "arriveeSuivanteH", b.arriveeSuivanteH ?? REGLES.ARRIVEE_SUIVANTE_DEFAUT_H, { min: REGLES.ARRIVEE_SUIVANTE_MIN_H, max: REGLES.ARRIVEE_SUIVANTE_MAX_H, unite: " h" })
    + `<p class="petit">Le ménage commence au départ des voyageurs et doit finir avant l'arrivée suivante.</p></div>`
    + `<div class="carte" style="margin-top:10px">${caseCocher("Je souhaite cette prestation à chaque départ de voyageurs", "aChaqueDepart", !!b.aChaqueDepart)}
      ${caseCocher("Mémoriser ces étapes pour ce logement", "memoriserEtapes", b.memoriserEtapes !== false)}</div>`;
}

/** Questions affichées sous les formules, selon leur genre (QuestionsFormule dans l'appli). */
function questionsFormule(r) {
  const f = formuleDe(b);
  if (f.genre === "REGULIER") {
    const jours = b.jours || [];
    return titre("Fréquence de passage") + choix(r.frequences, b.frequence || "semaine", "frequence")
      + (b.frequence === "plusieurs" ? titre("Jours de passage") + `<div class="choix">${JOURS_SEMAINE.map(([n, nom]) =>
        `<button type="button" data-jour-passage="${n}" class="${jours.includes(n) ? "choisi" : ""}">${nom}</button>`).join("")}</div><p class="petit">Au moins deux jours.</p>` : "")
      + titre("Moment de passage") + choix(r.moments, b.moment, "moment")
      + titre("Durée d'engagement") + choix([["0", "Sans engagement"], ["3", "3 mois −5 %"], ["6", "6 mois −10 %"], ["12", "12 mois −15 %"]], b.engagementMois, "engagementMois")
      + `<p class="petit">Plus vous vous engagez, moins chaque passage vous coûte.</p>`
      + `<div class="carte" style="margin-top:10px">${caseCocher("Le même Cleaneur à chaque passage, si possible", "memeCleaneur", b.memeCleaneur !== false)}
        ${compteur("Passages à planifier", "passages", b.passages || REGLES.PASSAGES_DEFAUT, { min: REGLES.PASSAGES_MIN, max: REGLES.PASSAGES_MAX })}
        <p class="petit">Chaque passage est une demande séparée, au même prix.</p></div>`;
  }
  let h = f.genre === "PONCTUEL" && r.occasions.length ? titre("À quelle occasion ?") + choix(r.occasions.map(o => [o.id, o.nom]), b.occasion, "occasion") : "";
  // Remise en état (et Grand ménage) : dernier nettoyage en profondeur
  if (f.avecDernierNettoyage) h += titre("Dernier nettoyage en profondeur") + choix(DERNIERS_NETTOYAGES.map(d => [d.id, d.libelle]), b.dernierNettoyage, "dernierNettoyage");
  // Nature des salissures (choix multiple, liste propre à la rubrique)
  if (f.avecNatures) {
    const natures = b.natures || [];
    h += (r.naturesSalissure.length ? titre("Nature des salissures") + `<div class="carte">${r.naturesSalissure.map(n =>
        `<label class="case"><input type="checkbox" data-nature="${esc(n)}" ${natures.includes(n) ? "checked" : ""}><span>${esc(n)}</span></label>`).join("")}</div>` : "");
  }
  if (b.rubriqueId === "kitchen" && f.id === "controle") h += titre("Date du contrôle (si connue)") + champTexte("Date (facultatif)", "dateControle", b.dateControle || "", "date");
  return h;
}

/** Canapés et textiles : choix d'un élément de la formule, taille, quantité, puis ajout au panier (PanierTextiles dans l'appli). */
function ligneEnCours() {
  const elements = ELEMENTS_TEXTILES.filter(e => e.formuleId === (b.formuleId || "canape"));
  const e = elements.find(x => x.id === b.elementTextile) || elements[0];
  return { elements, e, ligne: { elementId: e.id, tailleId: e.avecTaille ? b.tailleCanape || "t15" : "", quantite: b.quantitePanier || 1, surfaceM2: e.parM2 ? b.surfaceMoquette || 1 : 0 } };
}
function panierTextiles() {
  const { elements, e, ligne } = ligneEnCours();
  const panier = b.panier || [];
  return titre("Votre panier")
    + `<div class="note">Choisir un élément ne suffit pas : ajoutez chaque canapé, fauteuil, matelas ou tapis au panier.</div>`
    + `<div class="carte" style="margin-top:10px">${choix(elements.map(x => [x.id, x.nom]), e.id, "elementTextile")}`
    + (e.avecTaille ? `<p class="petit"><b>Taille</b></p>${choix(TAILLES_CANAPE.map(t => [t.id, t.libelle]), b.tailleCanape || "t15", "tailleCanape")}` : "")
    + (e.parM2 ? compteur("Surface de moquette", "surfaceMoquette", b.surfaceMoquette || 10, { min: 1, max: 300, unite: " m²" }) : "")
    + compteur("Quantité", "quantitePanier", b.quantitePanier || 1, { min: 1, max: 20 })
    + `<div style="display:flex;align-items:center;margin-top:8px"><b style="flex:1">${euros(prixLigne(ligne))}</b>
      <button type="button" class="lien-bouton" id="ajouter-panier">Ajouter au panier</button></div></div>`
    + `<div class="carte ${panier.length ? "teintee" : ""}" style="margin-top:10px">${panier.length ? "" : `<p class="muet" style="margin:0">Votre panier est vide.</p>`}`
    + panier.map((l, i) => `<div style="display:flex;align-items:center;gap:8px"><span style="flex:1">${esc(libelleLigne(l))}<span class="petit" style="display:block">${duree(minutesLigne(l))}</span></span>
      <span>${euros(prixLigne(l))}</span><button type="button" class="lien-bouton" style="color:var(--erreur)" data-retirer-panier="${i}">Retirer</button></div>`).join("")
    + `<p class="petit">Minimum de commande : ${euros(REGLES.MINIMUM_COMMANDE_TEXTILES_C).replace(",00", "")}. Prix forfaitaire par élément, la durée sert au planning.</p></div>`
    + titre("Taches à traiter") + `<div class="choix">${TACHES_A_TRAITER.map(t =>
      `<button type="button" data-tache-a-traiter="${esc(t)}" class="${(b.tachesATraiter || []).includes(t) ? "choisi" : ""}">${esc(t)}</button>`).join("")}</div>`;
}

function etape3() {
  const obl = photosObligatoires(b.rubriqueId);
  const vues = vuesPhotos(b);
  const blocVues = vues.length ? `<p class="petit"><b>${obl ? "Une photo obligatoire par vue :" : "Vues suggérées :"}</b></p><div class="carte">${vues.map(v => {
    const prise = !!vuesPrises[v];
    return `<div style="display:flex;align-items:center;gap:8px;padding:4px 0"><b style="width:20px;color:${prise ? "var(--succes)" : "var(--muet, #999)"}">${prise ? "✓" : "○"}</b>
      <span style="flex:1">${esc(v)}</span>
      <label class="lien-bouton" style="cursor:pointer">${icone("photo")} ${prise ? "Reprendre" : "Photo"}<input type="file" accept="image/*" capture="environment" data-vue="${esc(v)}" hidden></label>
      <label class="lien-bouton" style="cursor:pointer">Galerie<input type="file" accept="image/*" data-vue="${esc(v)}" hidden></label></div>`;
  }).join("")}</div>` : "";
  const location = b.rubriqueId === "rental";
  const pret = obl ? (vues.length ? vuesCompletes(b, Object.keys(vuesPrises)) : photos.length > 0) : (location || photos.length > 0 || !!b.sansPhotos);
  return `<h2>${location ? "Une dernière remarque ?" : "Ajoutez des photos pour préciser votre besoin"}</h2>
    ${obl ? `<div class="note alerte" style="margin:10px 0">${b.rubriqueId === "kitchen" ? "4 photos obligatoires de la cuisine (4 angles)." : "Photos obligatoires de l'état actuel, pré-analysées (luminosité, pièce reconnue)."}</div>` : ""}
    ${location ? `<label class="champ" style="font-weight:400"><textarea data-texte="remarque" rows="4" maxlength="2000" placeholder="Ex. : arrivée des voyageurs à 16 h">${esc(b.remarque)}</textarea></label>` : ""}
    ${blocVues}
    <div class="carte ${vues.length ? "masque" : ""}"><div class="vignettes" id="vignettes">${photos.map((f, i) => `<img alt="Photo ${i + 1}" data-i="${i}">`).join("")}</div>
      <div class="boutons-photo"><label class="bouton secondaire" style="cursor:pointer">${icone("photo")} Prendre une photo<input type="file" id="photos-appareil" accept="image/*" capture="environment" hidden></label>
      <label class="bouton secondaire" style="cursor:pointer">+ Choisir dans la galerie<input type="file" id="photos" accept="image/*" multiple hidden></label></div>
      <p class="petit">12 photos maximum. Elles sont réduites avant l'envoi.</p></div>
    ${obl ? "" : `<div class="carte" style="margin-top:10px">${caseCocher("Je ne peux pas encore photographier l'état actuel", "sansPhotos", !!b.sansPhotos)}</div>`}
    ${actions(pret, pret ? "" : obl ? "Ajoutez une photo pour chaque vue." : "Ajoutez une photo ou cochez la case.")}`;
}

function joursProposes() {
  const j = []; const d = new Date(); d.setHours(0, 0, 0, 0);
  // Aucune intervention avant le 1er janvier 2027 : le planning commence au plus tôt ce jour-là.
  const veille = new Date(DATE_PREMIERES_INTERVENTIONS); veille.setDate(veille.getDate() - 1);
  if (d < veille) d.setTime(veille.getTime());
  for (let i = 1; i <= 21; i++) { const x = new Date(d); x.setDate(d.getDate() + i); j.push(x); }
  return j;
}
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function debutChoisi() {
  if (estPrelancement() || !b.jour || b.heure < 0 || b.flexible) return null;
  const [a, m, j] = b.jour.split("-").map(Number);
  return new Date(a, m - 1, j, b.heure, 0, 0);
}

function etape4() {
  const maintenant = new Date();
  const location = b.rubriqueId === "rental";
  // Mêmes heures que le planning de l'appli : 7 h-11 h et 13 h-18 h (jusqu'à 23 h pour les événements).
  const grille = [7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
  let heures = location ? [b.departVoyageursH ?? REGLES.DEPART_VOYAGEURS_DEFAUT_H] : grille.slice(0, 11);
  // Événements : créneaux selon la formule (fini avant le début, ou à partir de la fin)
  if (b.rubriqueId === "event") heures = heuresEvenement(b, calculer(entreeEstimation(b, b.espace === "personnel", null)).dureeMin, grille);
  const tient = !location || menageTientEntreVoyageurs(b, calculer(entreeEstimation(b, b.espace === "personnel", null)).dureeMin);
  const jourDate = b.jour ? new Date(b.jour + "T00:00") : null;
  const creneaux = jourDate ? heures.map(h => {
    const c = new Date(jourDate); c.setHours(h);
    const dispo = disponibilite(maintenant, c);
    return `<button type="button" data-heure="${h}" class="${b.heure === h ? "choisi" : ""} ${{ MALIN: "malin", FORTE_DEMANDE: "forte", PEU: "peu" }[dispo] || ""}" ${dispo === "INDISPONIBLE" ? "disabled" : ""}
      title="${{ MALIN: "Créneau malin −10 %", FORTE_DEMANDE: "Forte demande", PEU: "Peu de Cleaneurs" }[dispo] || ""}">${heure(h)}</button>`;
  }).join("") : "";
  const adresseOk = b.rue.trim().length >= 3 && /^[0-9]{5}$/.test(b.codePostal) && b.ville.trim();
  const creneauOk = estPrelancement() || b.flexible || (b.jour && b.heure >= 0 && (!location || b.heure === (b.departVoyageursH ?? REGLES.DEPART_VOYAGEURS_DEFAUT_H)));
  const manque = !adresseOk ? "Vérifiez l'adresse pour continuer."
    : !tient ? "Le ménage ne tient pas entre le départ et l'arrivée suivante : avancez le départ ou retardez l'arrivée." : !creneauOk ? "Choisissez un créneau." : "";
  return `<h2>Adresse et créneau</h2>
    ${logements().length ? `${titre("Choisissez un logement déjà renseigné")}${logements().map(l => `<button type="button" class="option ${b.logementId === l.id ? "choisi" : ""}" data-logement="${l.id}">${esc(nomLogement(l))}<span class="detail">${esc(l.rue)}, ${esc(l.codePostal)} ${esc(l.ville)}</span></button>`).join("")}
      <button type="button" class="option ${b.logementId ? "" : "choisi"}" data-logement="">+ Ajouter une nouvelle adresse</button>` : ""}
    <div class="carte ${b.logementId ? "masque" : ""}" style="margin-top:14px">${champTexte("Rue", "rue", b.rue, "text", 'autocomplete="street-address" maxlength="200"')}
      <div class="grille-2">${champTexte("Code postal", "codePostal", b.codePostal, "text", 'inputmode="numeric" maxlength="5" autocomplete="postal-code"')}${champTexte("Ville", "ville", b.ville, "text", 'autocomplete="address-level2" maxlength="100"')}</div>
      <p class="petit">Elle sert au calcul du déplacement et à l'arrivée du Cleaneur.</p></div>
    ${estPrelancement() ? "" : titre("Touchez un créneau dans le planning")}
    ${estPrelancement() ? `<div class="note" style="margin-top:14px">Les réservations ouvrent le <b>31 décembre 2026</b>. Envoyez votre pré-réservation dès maintenant : nous vous recontacterons en priorité pour fixer le créneau.</div>` : `
    <div class="carte">${caseCocher("Je suis flexible", "flexible", b.flexible, "Vous recevez des candidatures sur 7 jours")}</div>
    ${b.flexible ? "" : `<div class="jours" style="margin-top:12px">${joursProposes().map(d => `<button type="button" data-jour="${iso(d)}" class="${b.jour === iso(d) ? "choisi" : ""}">${dateCourte(d)}</button>`).join("")}</div>
      ${jourDate ? `<div class="creneaux" style="margin-top:12px">${creneaux}</div>
        <div class="legende-creneaux petit"><span class="dispo">Disponible</span><span class="malin">Créneau malin −10 %</span><span class="forte">Forte demande</span><span class="peu">Peu de Cleaneurs</span></div>` : `<p class="petit">Choisissez un jour.</p>`}
      ${jourDate && b.heure >= 0 ? `<div class="note" style="margin-top:10px">Arrivée entre ${heure(b.heure)} et ${heure(b.heure + 1)} · ${dateLongue(jourDate)}</div>`
        + (disponibilite(maintenant, new Date(jourDate.getFullYear(), jourDate.getMonth(), jourDate.getDate(), b.heure)) === "PEU" ? `<div class="note alerte" style="margin-top:8px">Peu de Cleaneurs sur ce créneau : prévoyez une solution de repli.</div>` : "") : ""}
      <p class="petit">Réservation au moins 24 h à l'avance. Pour une urgence, la nuit ou un événement : horaire particulier (bientôt).</p>`}`}
    ${location ? `<div class="note ${tient ? "" : "alerte"}" style="margin-top:10px">Départ des voyageurs à ${b.departVoyageursH ?? 10} h · fin avant ${b.arriveeSuivanteH ?? 16} h</div>`
      + (tient ? "" : `<div class="note alerte" style="margin-top:8px">Le ménage ne tient pas entre le départ et l'arrivée suivante : avancez le départ ou retardez l'arrivée.</div>`) : ""}
    ${actions(!manque, manque)}`;
}

function etape5() {
  const r = rubrique(b.rubriqueId);
  const debut = debutChoisi();
  const est = calculer(entreeEstimation(b, b.espace === "personnel", debut));
  const contactOk = b.prenom.trim() && b.nom.trim() && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.email) && b.telephone.replace(/\D/g, "").length >= 10;
  const manque = !contactOk ? "Complétez vos coordonnées." : !b.cgv ? "Acceptez les conditions pour envoyer la demande." : "";
  return `<h2>Votre estimation</h2>
    <p class="muet">${icone(r.icone)} ${r.nom} · ${duree(est.dureeMin)}${est.nombreCleaneurs === 2 ? " · 2 Cleaneurs" : ""}</p>
    ${estPrelancement() ? `<div class="note" style="margin-top:10px"><span><b>Lancement le 31 décembre 2026.</b> ${MESSAGE_LANCEMENT} Votre pré-réservation est gratuite et sans engagement.</span></div>` : ""}
    <div class="carte" style="margin-top:12px">
      ${est.devisObligatoire ? `<h3 style="color:var(--primaire)">Sur devis</h3><p class="muet" style="margin:4px 0 0">Un professionnel qualifié évalue votre besoin et vous propose un devis. Aucun engagement.</p>`
        : est.lignes.map(l => { const inclus = l.montantC === 0 && l.note === "inclus";
            return `<div class="ligne-montant"><span>${esc(l.libelle)}${l.note && !inclus ? `<span class="note-ligne">${l.note}</span>` : ""}</span><span>${inclus ? "Inclus" : euros(l.montantC)}</span></div>`; }).join("")
          + `<div class="ligne-montant total"><span>Total estimé</span><span>${euros(est.totalC)}</span></div>
             ${est.creditImpotC ? `<div class="ligne-montant" style="color:var(--succes);font-weight:700"><span>soit ${euros(est.apresCreditImpotC)} après crédit d'impôt</span></div>` : ""}
             <p class="petit">Prix approximatif : le montant final ne peut pas le dépasser sans votre accord.</p>
             ${est.nombreCleaneurs === 2 ? `<p class="petit">Au-delà de 6 h de travail, la mission est confiée à 2 Cleaneurs.</p>` : ""}
             ${passagesPlanifies(b) > 1 ? `<p class="petit">${passagesPlanifies(b)} passages planifiés : chaque passage est une demande séparée, au même prix.</p>` : ""}`}
    </div>
    ${est.creditImpotC ? `<p class="petit">50 % des dépenses pour les prestations éligibles réalisées à votre domicile (résidence principale ou secondaire), dans la limite des plafonds légaux (12 000 € par an, majorés dans certains cas).</p>` : ""}
    ${titre("Choix du Cleaneur")}
    <button type="button" class="option ${b.choixCleaneur === "candidatures" ? "choisi" : ""}" data-champ="choixCleaneur" data-valeur="candidatures">Je choisis parmi les candidatures
      <span class="detail">Les Cleaneurs vous proposent un horaire et un prix. Vous êtes notifié à chaque candidature et vous choisissez.</span></button>
    ${b.flexible || estPrelancement() || est.devisObligatoire ? "" : `<button type="button" class="option ${b.choixCleaneur === "directe" ? "choisi" : ""}" data-champ="choixCleaneur" data-valeur="directe">Réservation directe
      <span class="detail">Le premier Cleaneur qui se positionne au prix estimé, sans frais supplémentaire, obtient la mission.</span></button>`}
    <p class="petit">Aucun Cleaneur n'est accepté automatiquement sans votre choix.</p>
    ${titre("Vos garanties")}${blocReassurance({ compact: true })}
    ${titre("Vos coordonnées")}
    <div class="carte"><div class="grille-2">${champTexte("Prénom", "prenom", b.prenom, "text", 'autocomplete="given-name" maxlength="80"')}${champTexte("Nom", "nom", b.nom, "text", 'autocomplete="family-name" maxlength="80"')}</div>
      <div class="grille-2">${champTexte("E-mail", "email", b.email, "email", 'autocomplete="email" maxlength="200"')}${champTexte("Téléphone", "telephone", b.telephone, "tel", 'autocomplete="tel" maxlength="20"')}</div></div>
    <div class="note" style="margin-top:14px">Aucun paiement maintenant : vous ne serez débité qu'après avoir validé la prestation. Annulation gratuite jusqu'à 48 h avant ; ensuite 25 % du prix accepté.</div>
    <div class="carte" style="margin-top:12px">${caseCocher(`J'accepte les <a href="#/conditions" target="_blank">conditions d'utilisation</a> et la <a href="#/confidentialite" target="_blank">politique de confidentialité</a>`, "cgv", b.cgv)}</div>
    ${actions(!manque && !envoi, manque, envoi ? "Envoi en cours…" : estPrelancement() ? "Envoyer ma pré-réservation" : est.devisObligatoire ? "Envoyer ma demande de devis" : "Envoyer ma demande", "envoyer")}`;
}

function actions(ok, message = "", libelle = "Continuer", id = "suivant") {
  return `<div class="barre-actions">${message ? `<p class="erreur" style="margin:0 0 8px">${message}</p>` : ""}
    <div style="display:flex;gap:10px">${b.etape > 2 ? `<button type="button" class="bouton secondaire" id="precedent">‹ Retour</button>` : `<button type="button" class="bouton secondaire" id="changer">‹ Prestations</button>`}
    <button type="button" class="bouton plein" id="${id}" ${ok ? "" : "disabled"}>${libelle}</button></div></div>`;
}

/* ------------------------------------------------------------------ Rendu et événements */
function rendre() {
  const etape = b ? b.etape : 1;
  let est = null;
  if (b && b.rubriqueId && etape > 1) est = calculer(entreeEstimation(b, b.espace === "personnel", debutChoisi()));
  racine.innerHTML = `<section class="bloc" style="padding-top:28px"><div class="etroit">
    <div class="tete-etape petit">${etape > 1 ? `<button type="button" class="retour-haut" data-retour>‹ Retour</button>` : ""}<span>Étape ${etape} sur 5</span>
      ${est && !est.devisObligatoire ? `<b style="color:var(--primaire)">Total estimé ${euros(est.totalC)}</b>` : ""}</div>
    <div class="progression">${[1, 2, 3, 4, 5].map(i => `<span class="${i <= etape ? "fait" : ""}"></span>`).join("")}</div>
    ${[etape1, etape2, etape3, etape4, etape5][etape - 1]()}
  </div></section>`;
  traduire(racine);
  // Aperçus des photos
  racine.querySelectorAll("#vignettes img").forEach(img => { img.src = URL.createObjectURL(photos[+img.dataset.i]); });
  racine.querySelectorAll("[data-apercu-boite]").forEach(img => { if (photoBoite) img.src = URL.createObjectURL(photoBoite); });
}

document.addEventListener("click", async e => {
  if (!racine || !racine.contains(e.target)) return;
  const t = e.target.closest("button, [data-rubrique]");
  if (!t) return;
  const ds = t.dataset;
  if (ds.retirerPhotoBoite !== undefined) { photoBoite = null; return rendre(); }
  if (ds.espace) { b = b ? { ...b, espace: ds.espace } : { espace: ds.espace, etape: 1 }; sauver(); return rendre(); }
  if (ds.rubrique) { b = b?.rubriqueId === ds.rubrique ? { ...b, etape: 2 } : nouveauBrouillon(ds.rubrique, b?.espace || "personnel"); sauver(); noterEtape(); rendre(); return window.scrollTo(0, 0); }
  if (ds.retour !== undefined) return retour();
  if (ds.champ) {
    let v = ds.valeur;
    if (ds.champ === "engagementMois") v = +v;
    if (ds.champ === "typeLogementId") { const tl = TYPES_LOGEMENT.find(x => x.id === v); return maj({ typeLogementId: v, surface: tl.surface, chambres: tl.chambres, sdb: tl.sdb, niveaux: tl.niveaux }); }
    if (ds.champ === "accueil" && v === b.accueil) return;
    // L'occasion coche le pack indiqué (le client peut ensuite décocher) ; « Autre » ne coche rien.
    if (ds.champ === "occasion") {
      const o = rubrique(b.rubriqueId).occasions.find(x => x.id === v);
      const p = packsPour(rubrique(b.rubriqueId), b.typeLieuId).find(x => x.id === o?.packId);
      const proposees = tachesChiffrees(b).map(t => t.id);
      const enPlus = (o?.tachesEnPlus || []).filter(id => proposees.includes(id));
      return maj({ occasion: v, taches: [...new Set([...b.taches, ...(p ? p.tacheIds : []), ...enPlus])] });
    }
    // Le dernier nettoyage présélectionne l'état de saleté.
    if (ds.champ === "dernierNettoyage") return maj({ dernierNettoyage: v, salissure: DERNIERS_NETTOYAGES.find(d => d.id === v).salissure });
    return maj({ [ds.champ]: v });
  }
  if (ds.moins) return maj({ [ds.moins]: Math.max(+ds.min, (b[ds.moins] ?? 1) - +ds.pas) });
  if (ds.plus) return maj({ [ds.plus]: Math.min(+ds.max, (b[ds.plus] ?? 1) + +ds.pas) });
  if (ds.pack) {
    const packs = packsPour(rubrique(b.rubriqueId), b.typeLieuId);
    const p = packs.find(x => x.id === ds.pack);
    const enCours = meilleurPack(packs, b.taches, tachesChiffrees(b));
    // Formule en vert : on la retire. Sinon on remplace la formule en cours par celle-ci.
    if (enCours?.id === p.id) return maj({ taches: b.taches.filter(id => !p.tacheIds.includes(id)) });
    const base = enCours ? b.taches.filter(id => !enCours.tacheIds.includes(id)) : b.taches;
    return maj({ taches: [...new Set([...base, ...p.tacheIds])] });
  }
  if (ds.logement !== undefined) {
    const l = logements().find(x => x.id === ds.logement);
    return maj(l ? avecLogement(b, l) : { logementId: "", rue: "", codePostal: "", ville: "", accueil: "", tiersNom: "", tiersTel: "", boiteEmplacement: "", code: "" });
  }
  if (ds.retirer !== undefined) return maj({ tachesPerso: b.tachesPerso.filter((_, i) => i !== +ds.retirer) });
  if (ds.retirerPanier !== undefined) return maj({ panier: (b.panier || []).filter((_, i) => i !== +ds.retirerPanier) });
  if (ds.equipPlus || ds.equipMoins) {
    const id = ds.equipPlus || ds.equipMoins, eq = { ...(b.equipements || {}) };
    eq[id] = Math.max(0, Math.min(20, (eq[id] || 0) + (ds.equipPlus ? 1 : -1)));
    if (!eq[id]) delete eq[id];
    return maj({ equipements: eq });
  }
  if (ds.tacheATraiter) { const l = b.tachesATraiter || [], v = ds.tacheATraiter; return maj({ tachesATraiter: l.includes(v) ? l.filter(x => x !== v) : [...l, v] }); }
  if (t.id === "ajouter-poils") return maj({ taches: [...new Set([...b.taches, "poils"])] });
  if (t.id === "selection-conseillee") return maj({ taches: [...new Set([...b.taches, ...SELECTION_CONSEILLEE_VEHICULE])] });
  if (t.id === "pack-etapes") return maj({ etapesChoisies: [...new Set([...etapesDe(b), ...PACK_ETAPES_CONSEILLE])] });
  if (t.id === "pack-conso") return maj({ consommablesChoisis: [...new Set([...consommablesDe(b), ...PACK_CONSOMMABLES_CONSEILLE])] });
  if (ds.retirerEtape !== undefined) return maj({ etapesPerso: (b.etapesPerso || []).filter((_, i) => i !== +ds.retirerEtape) });
  if (t.id === "ajouter-etape") {
    const texte = document.getElementById("saisie-etape").value.trim(), piece = document.getElementById("piece-perso").value;
    if (texte) maj({ etapesPerso: [...(b.etapesPerso || []), { piece, texte }].slice(0, 20) });
    return;
  }
  if (t.id === "ajouter-panier") return maj({ panier: [...(b.panier || []), ligneEnCours().ligne], quantitePanier: 1 });
  if (ds.jourPassage) { const n = +ds.jourPassage, j = b.jours || []; return maj({ jours: j.includes(n) ? j.filter(x => x !== n) : [...j, n].sort() }); }
  if (ds.jour) return maj({ jour: ds.jour, heure: -1 });
  if (ds.heure) return maj({ heure: +ds.heure });
  if (t.id === "ajouter-perso") {
    const s = document.getElementById("saisie-perso").value.trim();
    if (s) maj({ tachesPerso: [...b.tachesPerso, s].slice(0, 10) });
    return;
  }
  if (t.id === "changer" || t.id === "precedent") return retour();
  if (t.id === "suivant") { maj({ etape: b.etape + 1, ...(b.etape === 4 && b.flexible ? { choixCleaneur: "candidatures" } : {}) }, true); return noterEtape(); }
  if (t.id === "envoyer") return envoyer();
});

document.addEventListener("change", e => {
  if (!racine || !racine.contains(e.target)) return;
  const ds = e.target.dataset;
  if (ds.texte) { b = { ...b, [ds.texte]: e.target.value }; sauver(); return rendre(); }  // (logementId gardé : seule la saisie d'une nouvelle adresse le vide)
  if (ds.case) return maj({ [ds.case]: e.target.checked });
  if (ds.tache) return maj({ taches: e.target.checked ? [...b.taches, ds.tache] : b.taches.filter(x => x !== ds.tache) });
  if (ds.etape) { const l = etapesDe(b); return maj({ etapesChoisies: e.target.checked ? [...l, ds.etape] : l.filter(x => x !== ds.etape) }); }
  if (ds.conso) { const l = consommablesDe(b); return maj({ consommablesChoisis: e.target.checked ? [...l, ds.conso] : l.filter(x => x !== ds.conso) }); }
  if (ds.nature) { const n = b.natures || []; return maj({ natures: e.target.checked ? [...n, ds.nature] : n.filter(x => x !== ds.nature) }); }
  if ((e.target.id === "photo-boite-appareil" || e.target.id === "photo-boite-galerie") && e.target.files?.[0]) {
    if (e.target.files[0].type.startsWith("image/")) photoBoite = e.target.files[0];
    return rendre();
  }
  if (ds.vue !== undefined && e.target.files?.[0]) {
    vuesPrises = { ...vuesPrises, [ds.vue]: e.target.files[0] };
    photos = Object.values(vuesPrises).slice(0, 12);
    return rendre();
  }
  if (e.target.id === "photos" || e.target.id === "photos-appareil") { photos = [...photos, ...e.target.files].filter(f => f.type.startsWith("image/")).slice(0, 12); rendre(); }
});
// Les champs texte enregistrent aussi pendant la frappe (sans redessiner, pour garder le curseur).
document.addEventListener("input", e => {
  if (!racine || !racine.contains(e.target) || !e.target.dataset.texte) return;
  b = { ...b, [e.target.dataset.texte]: e.target.value }; sauver();
  const bouton = racine.querySelector("#suivant, #envoyer");
  if (bouton && b.etape >= 2) { clearTimeout(window.__rendreTimer); window.__rendreTimer = setTimeout(() => {
    const actif = document.activeElement?.dataset?.texte, pos = document.activeElement?.selectionStart;
    rendre();
    if (actif) { const el = racine.querySelector(`[data-texte="${actif}"]`); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch { /* email */ } } }
  }, 500); }
});

async function envoyer() {
  const debut = debutChoisi();
  const est = calculer(entreeEstimation(b, b.espace === "personnel", debut));
  envoi = true; rendre();
  try {
    const acces = { TIERS: { nom: b.tiersNom, telephone: b.tiersTel }, BOITE: { emplacement: b.boiteEmplacement, code: b.code }, AUTONOME: { code: b.code } }[b.accueil] || {};
    const details = { ...b }; ["prenom", "nom", "email", "telephone", "rue", "codePostal", "ville", "code", "tiersNom", "tiersTel", "boiteEmplacement", "cgv", "etape", "logementId"].forEach(k => delete details[k]);
    details.lignes = est.lignes;
    const nombre = passagesPlanifies(b);
    details.passages = nombre;
    const dates = debut && nombre > 1 && !estPrelancement() ? datesPassages(debut, frequenceDe(b), b.jours || [], nombre) : [debut];
    let premiere = null;
    for (const [n, d] of dates.entries()) {
    const envoi1 = await envoyerDemande({
      rubrique_id: b.rubriqueId, details, estimation_c: est.totalC, credit_impot_c: est.creditImpotC, duree_min: est.dureeMin,
      nombre_cleaneurs: est.nombreCleaneurs, sur_devis: est.devisObligatoire, creneau: d ? d.toISOString() : null, flexible: b.flexible || estPrelancement(), prelancement: estPrelancement(),
      choix_cleaneur: estPrelancement() ? "candidatures" : b.choixCleaneur, espace: b.espace, prenom: b.prenom.trim(), nom: b.nom.trim(), email: b.email.trim(), telephone: b.telephone.trim(),
      rue: b.rue.trim(), code_postal: b.codePostal.trim(), ville: b.ville.trim(), accueil: b.accueil || "PRESENT", acces,
      remarque: (dates.length > 1 ? `Passage ${n + 1}/${dates.length}. ` : "") + b.remarque.trim(),
    }, n === 0 ? photos : [], b.accueil === "BOITE" ? photoBoite : null);
    premiere = premiere || envoi1;
    }
    const { reference, jeton } = premiere;
    memoriserCommande(b);
    try { localStorage.removeItem(CLE_BROUILLON); } catch { /* rien */ }
    envoi = false; b = null; photos = []; photoBoite = null;
    location.hash = `#/demande/${reference}/${jeton}`;
  } catch (err) {
    envoi = false; rendre();
    racine.querySelector(".barre-actions").insertAdjacentHTML("afterbegin", `<p class="erreur">L'envoi n'a pas abouti (${esc(err.message)}). Vérifiez votre connexion et réessayez.</p>`);
  }
}
