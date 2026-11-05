// Parcours de réservation en 5 étapes : copie de Reservation.kt (application Android).
// 1 prestation · 2 questionnaire · 3 photos · 4 adresse, accès et créneau · 5 estimation, coordonnées et envoi.
import { RUBRIQUES, rubrique, formulesPour, TYPES_LIEU, TYPES_LOGEMENT, BESOINS_SPECIAUX, ACCUEIL, accueilAutonomeInterdit, photosObligatoires,
  ELEMENTS_TEXTILES, TAILLES_CANAPE, prixLigne, minutesLigne, libelleLigne, pastille } from "./catalogue.js";
import { calculer, entreeEstimation, SALISSURE, disponibilite, meilleurPack } from "./estimation.js";
import { REGLES, euros, duree, heure, dateCourte, estPrelancement, MESSAGE_LANCEMENT } from "./regles.js";
import { envoyerDemande } from "./donnees.js";
import { traduire } from "./langue.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const CLE_BROUILLON = "cleaneroo-brouillon";

/* ------------------------------------------------------------------ Mémoire : la 2e commande en quelques secondes (comme l'app : AppData.modeles et logements)
   Gardé sur l'appareil du client uniquement : coordonnées, adresses enregistrées, dernière commande par prestation.
   Jamais le code d'accès ni le créneau. « Oublier mes informations » dans Mes demandes efface tout. */
const CLE_PROFIL = "cleaneroo-profil", CLE_LOGEMENTS = "cleaneroo-logements", CLE_MODELES = "cleaneroo-modeles";
const lire = (cle, defaut) => { try { return JSON.parse(localStorage.getItem(cle) || "null") ?? defaut; } catch { return defaut; } };
const ecrire = (cle, v) => { try { localStorage.setItem(cle, JSON.stringify(v)); } catch { /* rien */ } };
export const profil = () => lire(CLE_PROFIL, null);
export const logements = () => lire(CLE_LOGEMENTS, []);
/** Dernières commandes, la plus récente d'abord : [{ rubriqueId, quand, logementId, ... }]. */
export const modeles = () => Object.values(lire(CLE_MODELES, {})).sort((a, b) => b.quand - a.quand);
export function oublierMesInformations() { [CLE_PROFIL, CLE_LOGEMENTS, CLE_MODELES, CLE_BROUILLON].forEach(k => { try { localStorage.removeItem(k); } catch { /* rien */ } }); }
const CHAMPS_LOGEMENT = ["rue", "codePostal", "ville", "accueil", "tiersNom", "tiersTel", "boiteEmplacement"];
const PRIVES = ["prenom", "nom", "email", "telephone", "code", "jour", "heure", "cgv", "etape", ...CHAMPS_LOGEMENT];
/** Libellé court d'une adresse enregistrée : « Appartement · Fréjus ». */
export const nomLogement = l => `${(TYPES_LOGEMENT.find(t => t.id === l.typeLogementId) || {}).nom || "Adresse"} · ${l.ville}`;

function memoriserCommande(b) {
  ecrire(CLE_PROFIL, { prenom: b.prenom.trim(), nom: b.nom.trim(), email: b.email.trim(), telephone: b.telephone.trim() });
  const liste = logements();
  const meme = l => l.rue.trim().toLowerCase() === b.rue.trim().toLowerCase() && l.codePostal === b.codePostal;
  const ancien = liste.find(meme);
  const log = { id: ancien?.id || "l" + Date.now(), typeLogementId: b.typeLogementId, surface: b.surface, chambres: b.chambres, sdb: b.sdb, niveaux: b.niveaux,
    ...Object.fromEntries(CHAMPS_LOGEMENT.map(k => [k, String(b[k] ?? "").trim()])) };
  ecrire(CLE_LOGEMENTS, [log, ...liste.filter(l => !meme(l))].slice(0, 10));
  const modele = Object.fromEntries(Object.entries(b).filter(([k]) => !PRIVES.includes(k)));
  ecrire(CLE_MODELES, { ...lire(CLE_MODELES, {}), [b.rubriqueId]: { ...modele, logementId: log.id, quand: Date.now() } });
}

/** Applique une adresse enregistrée au brouillon (adresse et accès ; le code est redemandé). */
function avecLogement(br, l) {
  if (!l) return br;
  const dims = ["home", "rental"].includes(br.rubriqueId) ? { typeLogementId: l.typeLogementId, surface: l.surface, chambres: l.chambres, sdb: l.sdb, niveaux: l.niveaux } : {};
  return { ...br, ...dims, ...Object.fromEntries(CHAMPS_LOGEMENT.map(k => [k, l[k] || ""])), logementId: l.id, code: "" };
}

function nouveauBrouillon(rubriqueId, espace = "personnel", rapide = false) {
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

function vierge(rubriqueId, espace, r, lieux) {
  return {
    rubriqueId, espace, etape: 2, typeLogementId: "appartement", surface: 62, chambres: 2, sdb: 1, niveaux: 1, fenetres: 8,
    formuleId: r.toujoursSurDevis ? "" : formulesPour(r)[0].id, typeLieuId: lieux ? lieux[0].id : "", salissure: "NORMAL",
    taches: [], tachesPerso: [], animaux: false, etapesLocation: 8, consommables: true, remarque: "",
    accueil: "", tiersNom: "", tiersTel: "", boiteEmplacement: "", code: "",
    rue: "", codePostal: "", ville: "", jour: "", heure: -1, flexible: false, engagementMois: 0,
    choixCleaneur: "candidatures", prenom: "", nom: "", email: "", telephone: "", cgv: false, logementId: "",
    panier: [], elementTextile: "", tailleCanape: "t15", quantitePanier: 1, surfaceMoquette: 10,
  };
}

let b = null;            // brouillon en cours
let photos = [];         // fichiers choisis (non sauvegardés dans le brouillon)
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
  // Code postal saisi sur l'accueil (« Voir mon prix »).
  const cp = option.match(/^cp-(\d{5})$/)?.[1];
  if (b && cp && !b.rue) b = { ...b, codePostal: cp };
  photos = [];
  rendre();
}

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
  return `<h1>Réserver un nettoyage</h1><p class="muet">Choisissez votre prestation : le prix s'affiche dès que vous décrivez votre besoin.</p>
    ${titre("Pour qui ?")}
    <div class="segments"><button type="button" data-espace="personnel" class="${(b?.espace || "personnel") === "personnel" ? "choisi" : ""}">Personnel</button>
      <button type="button" data-espace="professionnel" class="${b?.espace === "professionnel" ? "choisi" : ""}">Professionnel</button></div>
    ${modeles().length ? titre("Comme la dernière fois") + `<div class="grille-2">${modeles().slice(0, 4).map(m => {
      const r = rubrique(m.rubriqueId), l = logements().find(x => x.id === m.logementId);
      return `<a class="carte prestation rapide" href="#/reserver/${m.rubriqueId}/rapide"><div class="emoji">${r.emoji}</div><h3>${r.nom}</h3>
        <p class="muet" style="margin:4px 0 0">${l ? esc(nomLogement(l)) : ""}</p><span class="tampon vert">Recommander en 3 clics ›</span></a>`; }).join("")}</div>` : ""}
    ${titre("Votre prestation")}
    <div class="grille-3">${RUBRIQUES.map(r => `<button type="button" class="carte prestation" data-rubrique="${r.id}" style="text-align:left">
      <div class="emoji">${r.emoji}</div><h3>${r.nom}</h3><p class="muet" style="margin:4px 0 0">${r.sousTitre}</p><span class="tampon">${pastille(r)}</span></button>`).join("")}</div>`;
}

function etape2() {
  const r = rubrique(b.rubriqueId);
  const formules = formulesPour(r);
  let h = `<h2>${r.emoji} ${r.nom}</h2><p class="muet">Décrivez le besoin</p>`;
  if (r.toujoursSurDevis) {
    h += `<div class="note" style="margin-top:14px">Interventions réalisées par des professionnels qualifiés et équipés, sur devis après évaluation. La désinsectisation et la dératisation relèvent d'entreprises certifiées et ne sont pas proposées.</div>`
      + titre("Votre besoin") + choix(BESOINS_SPECIAUX, b.formuleId, "formuleId");
  }
  if (b.rubriqueId === "home") h += titre("Type de logement") + choix(TYPES_LOGEMENT.map(t => [t.id, t.nom]), b.typeLogementId, "typeLogementId");
  const lieux = TYPES_LIEU[b.rubriqueId];
  if (lieux) h += titre({ car: "Gabarit du véhicule", construction: "Type de sol", kitchen: "Type d'établissement" }[b.rubriqueId] || "Type de lieu")
    + choix(lieux.map(l => [l.id, l.nom]), b.typeLieuId, "typeLieuId");
  if (!r.toujoursSurDevis && b.rubriqueId !== "car") {
    h += titre("Choisissez votre formule") + formules.map(f => `<button type="button" class="option ${f.id === b.formuleId ? "choisi" : ""}" data-champ="formuleId" data-valeur="${f.id}">
      ${esc(f.nom)}${f.description ? `<span class="detail">${esc(f.description)}</span>` : ""}</button>`).join("");
    if (b.rubriqueId === "textiles") h += panierTextiles();
    if (r.inclus) h += `<div class="carte teintee" style="margin-top:6px"><b style="color:var(--turquoise)">Inclus dans votre forfait</b><p class="muet" style="margin:4px 0 0;font-size:14px">${esc(r.inclus)}</p></div>`;
    if (b.rubriqueId !== "textiles") h += titre("Dimensions") + `<div class="carte">`
      + (b.rubriqueId === "windows" ? compteur("Nombre de fenêtres", "fenetres", b.fenetres, { min: 1, max: 200 })
        : compteur("Surface", "surface", b.surface, { min: 5, max: 5000, unite: " m²" }))
      + (["home", "rental"].includes(b.rubriqueId) ? compteur("Chambres", "chambres", b.chambres, { max: 12 }) + compteur("Salles de bain", "sdb", b.sdb, { min: 1, max: 8 }) : "")
      + (b.rubriqueId === "home" ? compteur("Niveaux", "niveaux", b.niveaux, { min: 1, max: 5 }) + (b.niveaux > 1 ? `<p class="petit">+15 min par niveau supplémentaire</p>` : "") : "")
      + (b.surface > REGLES.SEUIL_DEVIS_SURFACE_M2 ? `<p style="color:var(--alerte);font-size:14px">Au-delà de 300 m² : devis obligatoire.</p>` : "")
      + `</div>`;
  }
  if (b.rubriqueId === "rental") {
    h += titre("Étapes à valider en photo") + `<div class="carte">${compteur("Étapes (pack conseillé : 8)", "etapesLocation", b.etapesLocation, { max: 40 })}
      <p class="petit">Une étape « Chambre » est répétée par chambre, « Salle de bain » par salle de bain.</p>
      ${caseCocher("Consommables à contrôler", "consommables", b.consommables, "Café, papier toilette, savon, liquide vaisselle, sacs poubelle (+10 min)")}
      <div class="note alerte" style="margin-top:10px">Le Cleaneur n'apporte jamais de consommables : ils doivent être sur place.</div></div>`;
  }
  if (!r.toujoursSurDevis && b.rubriqueId !== "car" && b.rubriqueId !== "construction") {
    h += titre("État de saleté") + `<div class="segments">${Object.entries(SALISSURE).map(([k, s]) =>
      `<button type="button" data-champ="salissure" data-valeur="${k}" class="${b.salissure === k ? "choisi" : ""}">${s.libelle}</button>`).join("")}</div>`;
  }
  if (b.rubriqueId === "construction") h += `<div class="note" style="margin-top:16px">Fin de chantier : jamais « standard ». Le niveau de salissure sera estimé dès que toutes les photos seront exploitables.</div>`;
  if (r.taches.length) {
    h += titre("Tâches complémentaires");
    if (r.packs.length) {
      h += `<p class="petit"><b>Nos formules</b></p>` + r.packs.map(p => {
        const tp = r.taches.filter(t => p.tacheIds.includes(t.id));
        const brut = tp.reduce((s, t) => s + t.prixC, 0), net = brut - Math.round(brut * p.remisePct / 100);
        const actif = meilleurPack(r.packs, b.taches)?.id === p.id; // une seule formule en vert : celle dont la remise s'applique
        return `<button type="button" class="option ${actif ? "choisi" : ""}" data-pack="${p.id}" style="display:flex;gap:12px;align-items:center">
          <span style="flex:1">${p.nom} <span class="tampon">−${p.remisePct} %</span><span class="detail">${tp.map(t => t.nom.toLowerCase()).join(", ")}</span></span>
          <span style="text-align:right">${euros(net)}<span class="detail" style="text-decoration:line-through">${euros(brut)}</span></span></button>`;
      }).join("") + `<p class="petit">La remise s'applique tant que toutes les tâches de la formule restent cochées. Une seule formule remisée par demande.</p>`;
    }
    h += `<div class="carte">${r.taches.map(t => `<label class="case"><input type="checkbox" data-tache="${t.id}" ${b.taches.includes(t.id) ? "checked" : ""}>
      <span>${t.nom}</span><span class="info">${euros(t.prixC)} · ${duree(t.minutes)}</span></label>`).join("")}</div>`;
  }
  if (!r.toujoursSurDevis) {
    h += titre("Une autre demande ?") + `<div class="carte">${b.tachesPerso.map((t, i) => `<div style="display:flex;align-items:center"><span style="flex:1">• ${esc(t)}</span>
      <button type="button" class="lien-bouton" style="color:var(--erreur)" data-retirer="${i}">Retirer</button></div>`).join("")}
      <div style="display:flex;gap:8px;align-items:center"><input class="texte" id="saisie-perso" maxlength="120" placeholder="Ex. : nettoyer la cage du lapin" style="margin:0">
      <button type="button" class="lien-bouton" id="ajouter-perso">Ajouter</button></div>
      <p class="petit">Chaque tâche particulière compte 15 min dans l'estimation ; le Cleaneur la confirme.</p></div>`;
  }
  if (b.rubriqueId === "home") h += `<div class="carte" style="margin-top:14px">${caseCocher("Des animaux vivent dans le logement", "animaux", b.animaux)}</div>`;
  if (b.formuleId === "regulier" || b.formuleId === "saisonnier") {
    h += titre("Durée d'engagement") + choix([["0", "Sans engagement"], ["3", "3 mois −5 %"], ["6", "6 mois −10 %"], ["12", "12 mois −15 %"]], b.engagementMois, "engagementMois")
      + `<p class="petit">Plus vous vous engagez, moins chaque passage vous coûte. Le même Cleaneur à chaque passage, si possible.</p>`;
  }
  const besoinOk = !r.toujoursSurDevis || b.formuleId;
  const panierOk = b.rubriqueId !== "textiles" || (b.panier || []).length > 0;
  return h + actions(besoinOk && panierOk, !besoinOk ? "Choisissez votre besoin." : !panierOk ? "Ajoutez chaque élément au panier." : "");
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
    + `<p class="petit">Minimum de commande : ${euros(REGLES.MINIMUM_COMMANDE_TEXTILES_C).replace(",00", "")}. Prix forfaitaire par élément, la durée sert au planning.</p></div>`;
}

function etape3() {
  const obl = photosObligatoires(b.rubriqueId);
  return `<h2>Photos et précisions</h2><p class="muet">${obl ? "Photos obligatoires pour cette prestation : elles permettent d'estimer le travail." : "Facultatif, mais les photos aident le Cleaneur à bien préparer l'intervention."}</p>
    ${titre("Vos photos")}
    <div class="carte"><div class="vignettes" id="vignettes">${photos.map((f, i) => `<img alt="Photo ${i + 1}" data-i="${i}">`).join("")}</div>
      <label class="bouton secondaire" style="margin-top:12px;cursor:pointer">+ Ajouter des photos<input type="file" id="photos" accept="image/*" multiple hidden></label>
      <p class="petit">12 photos maximum. Elles sont réduites avant l'envoi.</p></div>
    ${titre("Une précision pour le Cleaneur ?")}
    <label class="champ" style="font-weight:400"><textarea data-texte="remarque" rows="4" maxlength="2000" placeholder="Ex. : arrivée des voyageurs à 16 h">${esc(b.remarque)}</textarea></label>
    ${actions(!obl || photos.length > 0, obl && !photos.length ? "Ajoutez au moins une photo." : "")}`;
}

function joursProposes() {
  const j = []; const d = new Date(); d.setHours(0, 0, 0, 0);
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
  const interdit = accueilAutonomeInterdit(b.rubriqueId, b.typeLieuId);
  const options = Object.entries(ACCUEIL).filter(([k]) => !interdit || ["PRESENT", "TIERS"].includes(k));
  let acces = "";
  if (b.accueil === "TIERS") acces = champTexte("Nom de la personne", "tiersNom", b.tiersNom, "text", 'maxlength="80"') + champTexte("Son téléphone", "tiersTel", b.tiersTel, "tel", 'maxlength="20"');
  if (b.accueil === "BOITE") acces = champTexte("Emplacement de la boîte à clés", "boiteEmplacement", b.boiteEmplacement, "text", 'maxlength="120"') + champTexte("Code de la boîte", "code", b.code, "text", 'maxlength="30" autocomplete="off"');
  if (b.accueil === "AUTONOME") acces = champTexte("Code ou instructions d'accès", "code", b.code, "text", 'maxlength="120" autocomplete="off"');
  const maintenant = new Date();
  const heures = []; for (let h = 7; h <= 20; h++) heures.push(h);
  const jourDate = b.jour ? new Date(b.jour + "T00:00") : null;
  const creneaux = jourDate ? heures.map(h => {
    const c = new Date(jourDate); c.setHours(h);
    const dispo = disponibilite(maintenant, c);
    return `<button type="button" data-heure="${h}" class="${b.heure === h ? "choisi" : ""} ${dispo === "MALIN" ? "malin" : ""}" ${dispo === "INDISPONIBLE" ? "disabled" : ""}
      title="${{ MALIN: "Créneau malin −10 %", FORTE_DEMANDE: "Forte demande", PEU: "Peu de disponibilités" }[dispo] || ""}">${heure(h)}</button>`;
  }).join("") : "";
  const accesOk = b.accueil && ({ TIERS: b.tiersNom.trim() && b.tiersTel.trim().length >= 6, BOITE: b.boiteEmplacement.trim() && b.code.trim(), AUTONOME: b.code.trim(), PRESENT: true }[b.accueil]);
  const adresseOk = b.rue.trim().length >= 3 && /^[0-9]{5}$/.test(b.codePostal) && b.ville.trim();
  const creneauOk = estPrelancement() || b.flexible || (b.jour && b.heure >= 0);
  const manque = !adresseOk ? "Indiquez l'adresse complète." : !accesOk ? "Indiquez comment le Cleaneur accède au lieu." : !creneauOk ? "Choisissez un créneau." : "";
  return `<h2>Adresse et créneau</h2>
    ${titre("Adresse de l'intervention")}
    ${logements().length ? `<p class="petit"><b>Vos adresses enregistrées</b></p>${logements().map(l => `<button type="button" class="option ${b.logementId === l.id ? "choisi" : ""}" data-logement="${l.id}">${esc(nomLogement(l))}<span class="detail">${esc(l.rue)}, ${esc(l.codePostal)} ${esc(l.ville)}</span></button>`).join("")}
      <button type="button" class="option ${b.logementId ? "" : "choisi"}" data-logement="">+ Nouvelle adresse</button>` : ""}
    <div class="carte ${b.logementId ? "masque" : ""}">${champTexte("Adresse", "rue", b.rue, "text", 'autocomplete="street-address" maxlength="200"')}
      <div class="grille-2">${champTexte("Code postal", "codePostal", b.codePostal, "text", 'inputmode="numeric" maxlength="5" autocomplete="postal-code"')}${champTexte("Ville", "ville", b.ville, "text", 'autocomplete="address-level2" maxlength="100"')}</div>
      <p class="petit">Elle sert au calcul du déplacement et à l'arrivée du Cleaneur.</p></div>
    ${titre("Accès au lieu")}
    ${choix(options, b.accueil, "accueil")}
    ${acces ? `<div class="carte" style="margin-top:10px">${acces}<p class="petit">Le code n'est communiqué qu'au Cleaneur retenu, le jour de l'intervention.</p></div>` : ""}
    ${interdit ? `<p class="petit">Chez les professionnels, une personne doit être présente pour accueillir le Cleaneur.</p>` : ""}
    ${titre("Créneau")}
    ${estPrelancement() ? `<div class="note">Les réservations ouvrent le <b>31 décembre 2026</b>. Envoyez votre pré-réservation dès maintenant : nous vous recontacterons en priorité pour fixer le créneau.</div>` : `
    <div class="carte">${caseCocher("Je suis flexible", "flexible", b.flexible, "Vous recevez des candidatures sur 7 jours")}</div>
    ${b.flexible ? "" : `<div class="jours" style="margin-top:12px">${joursProposes().map(d => `<button type="button" data-jour="${iso(d)}" class="${b.jour === iso(d) ? "choisi" : ""}">${dateCourte(d)}</button>`).join("")}</div>
      ${jourDate ? `<div class="creneaux" style="margin-top:12px">${creneaux}</div><p class="petit">Bordure verte : créneau malin, −10 %. Dimanche : +25 %.</p>` : `<p class="petit">Choisissez un jour.</p>`}`}`}
    ${actions(!manque, manque)}`;
}

function etape5() {
  const r = rubrique(b.rubriqueId);
  const debut = debutChoisi();
  const est = calculer(entreeEstimation(b, b.espace === "personnel", debut));
  const contactOk = b.prenom.trim() && b.nom.trim() && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.email) && b.telephone.replace(/\D/g, "").length >= 10;
  const manque = !contactOk ? "Complétez vos coordonnées." : !b.cgv ? "Acceptez les conditions pour envoyer la demande." : "";
  return `<h2>Votre estimation</h2>
    <p class="muet">${r.emoji} ${r.nom} · ${duree(est.dureeMin)}${est.nombreCleaneurs === 2 ? " · 2 Cleaneurs" : ""}${debut ? ` · ${dateCourte(debut)} · ${heure(debut.getHours())}` : estPrelancement() ? " · créneau fixé à l'ouverture" : " · flexible"}</p>
    ${estPrelancement() ? `<div class="note" style="margin-top:10px"><span><b>Lancement le 31 décembre 2026.</b> ${MESSAGE_LANCEMENT} Votre pré-réservation est gratuite et sans engagement.</span></div>` : ""}
    <div class="carte" style="margin-top:12px">
      ${est.devisObligatoire ? `<h3 style="color:var(--turquoise)">Sur devis</h3><p class="muet" style="margin:4px 0 0">Un professionnel qualifié évalue votre besoin et vous propose un devis. Aucun engagement.</p>`
        : est.lignes.map(l => `<div class="ligne-montant"><span>${esc(l.libelle)}${l.note ? `<span class="note-ligne">${l.note}</span>` : ""}</span><span>${euros(l.montantC)}</span></div>`).join("")
          + `<div class="ligne-montant total"><span>Total estimé</span><span>${euros(est.totalC)}</span></div>
             ${est.creditImpotC ? `<div class="ligne-montant" style="color:var(--succes);font-weight:700"><span>Après crédit d'impôt (50 %)</span><span>${euros(est.apresCreditImpotC)}</span></div>` : ""}
             <p class="petit">Prix approximatif : le montant final ne peut pas le dépasser sans votre accord.</p>
             ${est.nombreCleaneurs === 2 ? `<p class="petit">Au-delà de 6 h de travail, la mission est confiée à 2 Cleaneurs.</p>` : ""}`}
    </div>
    ${est.creditImpotC ? `<p class="petit">50 % des dépenses pour les prestations éligibles réalisées à votre domicile (résidence principale ou secondaire), dans la limite des plafonds légaux (12 000 € par an, majorés dans certains cas).</p>` : ""}
    ${titre("Comment choisir votre Cleaneur ?")}
    <button type="button" class="option ${b.choixCleaneur === "candidatures" ? "choisi" : ""}" data-champ="choixCleaneur" data-valeur="candidatures">Je choisis parmi les candidatures
      <span class="detail">Les Cleaneurs vous proposent un horaire et un prix. Vous êtes prévenu à chaque candidature et vous choisissez.</span></button>
    ${b.flexible || estPrelancement() ? "" : `<button type="button" class="option ${b.choixCleaneur === "directe" ? "choisi" : ""}" data-champ="choixCleaneur" data-valeur="directe">Réservation directe
      <span class="detail">Le premier Cleaneur qui se positionne au prix estimé, sans frais supplémentaire, obtient la mission.</span></button>`}
    <p class="petit">Aucun Cleaneur n'est accepté automatiquement sans votre choix.</p>
    ${titre("Vos coordonnées")}
    <div class="carte"><div class="grille-2">${champTexte("Prénom", "prenom", b.prenom, "text", 'autocomplete="given-name" maxlength="80"')}${champTexte("Nom", "nom", b.nom, "text", 'autocomplete="family-name" maxlength="80"')}</div>
      <div class="grille-2">${champTexte("E-mail", "email", b.email, "email", 'autocomplete="email" maxlength="200"')}${champTexte("Téléphone", "telephone", b.telephone, "tel", 'autocomplete="tel" maxlength="20"')}</div></div>
    <div class="note" style="margin-top:14px">Aucun paiement maintenant : vous ne serez débité qu'après avoir validé la prestation. Annulation gratuite jusqu'à 48 h avant ; ensuite 25 % du prix accepté.</div>
    <div class="carte" style="margin-top:12px">${caseCocher(`J'accepte les <a href="#/conditions" target="_blank">conditions d'utilisation</a> et la <a href="#/confidentialite" target="_blank">politique de confidentialité</a>`, "cgv", b.cgv)}</div>
    ${actions(!manque && !envoi, manque, envoi ? "Envoi en cours…" : estPrelancement() ? "Envoyer ma pré-réservation" : "Envoyer ma demande", "envoyer")}`;
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
  if (b) est = calculer(entreeEstimation(b, b.espace === "personnel", debutChoisi()));
  racine.innerHTML = `<section class="bloc" style="padding-top:28px"><div class="etroit">
    <div style="display:flex;justify-content:space-between;gap:10px" class="petit"><span>Étape ${etape} sur 5</span>
      ${est && !est.devisObligatoire ? `<b style="color:var(--turquoise)">Total estimé ${euros(est.totalC)}</b>` : ""}</div>
    <div class="progression">${[1, 2, 3, 4, 5].map(i => `<span class="${i <= etape ? "fait" : ""}"></span>`).join("")}</div>
    ${[etape1, etape2, etape3, etape4, etape5][etape - 1]()}
  </div></section>`;
  traduire(racine);
  // Aperçus des photos
  racine.querySelectorAll("#vignettes img").forEach(img => { img.src = URL.createObjectURL(photos[+img.dataset.i]); });
}

document.addEventListener("click", async e => {
  if (!racine || !racine.contains(e.target)) return;
  const t = e.target.closest("button, [data-rubrique]");
  if (!t) return;
  const ds = t.dataset;
  if (ds.espace) { b = b ? { ...b, espace: ds.espace } : { espace: ds.espace, etape: 1 }; sauver(); return rendre(); }
  if (ds.rubrique) { b = nouveauBrouillon(ds.rubrique, b?.espace || "personnel"); sauver(); rendre(); return window.scrollTo(0, 0); }
  if (ds.champ) {
    let v = ds.valeur;
    if (ds.champ === "engagementMois") v = +v;
    if (ds.champ === "typeLogementId") { const tl = TYPES_LOGEMENT.find(x => x.id === v); return maj({ typeLogementId: v, surface: tl.surface, chambres: tl.chambres, sdb: tl.sdb, niveaux: tl.niveaux }); }
    if (ds.champ === "accueil" && v === b.accueil) return;
    return maj({ [ds.champ]: v });
  }
  if (ds.moins) return maj({ [ds.moins]: Math.max(+ds.min, (b[ds.moins] ?? 1) - +ds.pas) });
  if (ds.plus) return maj({ [ds.plus]: Math.min(+ds.max, (b[ds.plus] ?? 1) + +ds.pas) });
  if (ds.pack) {
    const p = rubrique(b.rubriqueId).packs.find(x => x.id === ds.pack);
    const enCours = meilleurPack(rubrique(b.rubriqueId).packs, b.taches);
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
  if (t.id === "ajouter-panier") return maj({ panier: [...(b.panier || []), ligneEnCours().ligne], quantitePanier: 1 });
  if (ds.jour) return maj({ jour: ds.jour, heure: -1 });
  if (ds.heure) return maj({ heure: +ds.heure });
  if (t.id === "ajouter-perso") {
    const s = document.getElementById("saisie-perso").value.trim();
    if (s) maj({ tachesPerso: [...b.tachesPerso, s].slice(0, 10) });
    return;
  }
  if (t.id === "changer") { b = { espace: b?.espace || "personnel", etape: 1 }; sauver(); rendre(); return window.scrollTo(0, 0); }
  if (t.id === "precedent") return maj({ etape: b.etape - 1 }, true);
  if (t.id === "suivant") return maj({ etape: b.etape + 1, ...(b.etape === 4 && b.flexible ? { choixCleaneur: "candidatures" } : {}) }, true);
  if (t.id === "envoyer") return envoyer();
});

document.addEventListener("change", e => {
  if (!racine || !racine.contains(e.target)) return;
  const ds = e.target.dataset;
  if (ds.texte) { b = { ...b, [ds.texte]: e.target.value }; sauver(); return rendre(); }  // (logementId gardé : seule la saisie d'une nouvelle adresse le vide)
  if (ds.case) return maj({ [ds.case]: e.target.checked });
  if (ds.tache) return maj({ taches: e.target.checked ? [...b.taches, ds.tache] : b.taches.filter(x => x !== ds.tache) });
  if (e.target.id === "photos") { photos = [...photos, ...e.target.files].filter(f => f.type.startsWith("image/")).slice(0, 12); rendre(); }
});
// Les champs texte enregistrent aussi pendant la frappe (sans redessiner, pour garder le curseur).
document.addEventListener("input", e => {
  if (!racine || !racine.contains(e.target) || !e.target.dataset.texte) return;
  b = { ...b, [e.target.dataset.texte]: e.target.value }; sauver();
  const bouton = racine.querySelector("#suivant, #envoyer");
  if (bouton && b.etape >= 4) { clearTimeout(window.__rendreTimer); window.__rendreTimer = setTimeout(() => {
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
    const { reference, jeton } = await envoyerDemande({
      rubrique_id: b.rubriqueId, details, estimation_c: est.totalC, credit_impot_c: est.creditImpotC, duree_min: est.dureeMin,
      nombre_cleaneurs: est.nombreCleaneurs, sur_devis: est.devisObligatoire, creneau: debut ? debut.toISOString() : null, flexible: b.flexible || estPrelancement(), prelancement: estPrelancement(),
      choix_cleaneur: estPrelancement() ? "candidatures" : b.choixCleaneur, espace: b.espace, prenom: b.prenom.trim(), nom: b.nom.trim(), email: b.email.trim(), telephone: b.telephone.trim(),
      rue: b.rue.trim(), code_postal: b.codePostal.trim(), ville: b.ville.trim(), accueil: b.accueil || "PRESENT", acces, remarque: b.remarque.trim(),
    }, photos);
    memoriserCommande(b);
    try { localStorage.removeItem(CLE_BROUILLON); } catch { /* rien */ }
    envoi = false; b = null; photos = [];
    location.hash = `#/demande/${reference}/${jeton}`;
  } catch (err) {
    envoi = false; rendre();
    racine.querySelector(".barre-actions").insertAdjacentHTML("afterbegin", `<p class="erreur">L'envoi n'a pas abouti (${esc(err.message)}). Vérifiez votre connexion et réessayez.</p>`);
  }
}
