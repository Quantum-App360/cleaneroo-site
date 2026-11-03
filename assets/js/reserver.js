// Parcours de réservation en 5 étapes : copie de Reservation.kt (application Android).
// 1 prestation · 2 questionnaire · 3 photos · 4 adresse, accès et créneau · 5 estimation, coordonnées et envoi.
import { RUBRIQUES, rubrique, formulesPour, TYPES_LIEU, TYPES_LOGEMENT, BESOINS_SPECIAUX, ACCUEIL, accueilAutonomeInterdit, photosObligatoires } from "./catalogue.js";
import { calculer, entreeEstimation, SALISSURE, disponibilite } from "./estimation.js";
import { REGLES, euros, duree, heure, dateCourte, estPrelancement, MESSAGE_LANCEMENT } from "./regles.js";
import { envoyerDemande } from "./donnees.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const CLE_BROUILLON = "cleaneroo-brouillon";

function nouveauBrouillon(rubriqueId, espace = "personnel") {
  const r = rubrique(rubriqueId);
  const lieux = TYPES_LIEU[rubriqueId];
  return {
    rubriqueId, espace, etape: 2, typeLogementId: "appartement", surface: 62, chambres: 2, sdb: 1, niveaux: 1, fenetres: 8,
    formuleId: r.toujoursSurDevis ? "" : formulesPour(r)[0].id, typeLieuId: lieux ? lieux[0].id : "", salissure: "NORMAL",
    taches: [], tachesPerso: [], animaux: false, etapesLocation: 8, consommables: true, remarque: "",
    accueil: "", tiersNom: "", tiersTel: "", boiteEmplacement: "", code: "",
    rue: "", codePostal: "", ville: "", jour: "", heure: -1, flexible: false, engagementMois: 0,
    choixCleaneur: "candidatures", prenom: "", nom: "", email: "", telephone: "", cgv: false,
  };
}

let b = null;            // brouillon en cours
let photos = [];         // fichiers choisis (non sauvegardés dans le brouillon)
let racine = null;
let envoi = false;

function sauver() { try { localStorage.setItem(CLE_BROUILLON, JSON.stringify(b)); } catch { /* rien */ } }
function charger() { try { return JSON.parse(localStorage.getItem(CLE_BROUILLON) || "null"); } catch { return null; } }

export function ouvrirReservation(conteneur, rubriqueId) {
  racine = conteneur;
  const ancien = charger();
  if (rubriqueId && rubrique(rubriqueId)) b = ancien && ancien.rubriqueId === rubriqueId ? ancien : nouveauBrouillon(rubriqueId, ancien?.espace);
  else b = ancien && ancien.etape > 1 ? ancien : null;
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
    ${titre("Votre prestation")}
    <div class="grille-3">${RUBRIQUES.map(r => `<button type="button" class="carte prestation" data-rubrique="${r.id}" style="text-align:left">
      <div class="emoji">${r.emoji}</div><h3>${r.nom}</h3><p class="muet" style="margin:4px 0 0">${r.sousTitre}</p></button>`).join("")}</div>`;
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
    if (r.inclus) h += `<div class="carte teintee" style="margin-top:6px"><b style="color:var(--turquoise)">Inclus dans votre forfait</b><p class="muet" style="margin:4px 0 0;font-size:14px">${esc(r.inclus)}</p></div>`;
    h += titre("Dimensions") + `<div class="carte">`
      + (b.rubriqueId === "windows" ? compteur("Nombre de fenêtres", "fenetres", b.fenetres, { min: 1, max: 200 })
        : b.rubriqueId === "textiles" ? compteur("Surface des tapis", "surface", b.surface, { min: 0, max: 500, unite: " m²" })
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
        const actif = p.tacheIds.every(id => b.taches.includes(id));
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
  const ok = !r.toujoursSurDevis || b.formuleId;
  return h + actions(ok, ok ? "" : "Choisissez votre besoin.");
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
    <div class="carte">${champTexte("Adresse", "rue", b.rue, "text", 'autocomplete="street-address" maxlength="200"')}
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
    <p class="muet">${r.emoji} ${r.nom} · ${duree(est.dureeMin)}${est.nombreCleaneurs === 2 ? " · 2 Cleaneurs" : ""}${debut ? ` · ${dateCourte(debut)} à ${heure(debut.getHours())}` : estPrelancement() ? " · créneau fixé à l'ouverture" : " · flexible"}</p>
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
  if (ds.moins) return maj({ [ds.moins]: Math.max(+ds.min, b[ds.moins] - +ds.pas) });
  if (ds.plus) return maj({ [ds.plus]: Math.min(+ds.max, b[ds.plus] + +ds.pas) });
  if (ds.pack) {
    const p = rubrique(b.rubriqueId).packs.find(x => x.id === ds.pack);
    const actif = p.tacheIds.every(id => b.taches.includes(id));
    return maj({ taches: actif ? b.taches.filter(id => !p.tacheIds.includes(id)) : [...new Set([...b.taches, ...p.tacheIds])] });
  }
  if (ds.retirer !== undefined) return maj({ tachesPerso: b.tachesPerso.filter((_, i) => i !== +ds.retirer) });
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
  if (ds.texte) { b = { ...b, [ds.texte]: e.target.value }; sauver(); return rendre(); }
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
    const details = { ...b }; ["prenom", "nom", "email", "telephone", "rue", "codePostal", "ville", "code", "tiersNom", "tiersTel", "boiteEmplacement", "cgv", "etape"].forEach(k => delete details[k]);
    details.lignes = est.lignes;
    const { reference, jeton } = await envoyerDemande({
      rubrique_id: b.rubriqueId, details, estimation_c: est.totalC, credit_impot_c: est.creditImpotC, duree_min: est.dureeMin,
      nombre_cleaneurs: est.nombreCleaneurs, sur_devis: est.devisObligatoire, creneau: debut ? debut.toISOString() : null, flexible: b.flexible || estPrelancement(), prelancement: estPrelancement(),
      choix_cleaneur: estPrelancement() ? "candidatures" : b.choixCleaneur, espace: b.espace, prenom: b.prenom.trim(), nom: b.nom.trim(), email: b.email.trim(), telephone: b.telephone.trim(),
      rue: b.rue.trim(), code_postal: b.codePostal.trim(), ville: b.ville.trim(), accueil: b.accueil || "PRESENT", acces, remarque: b.remarque.trim(),
    }, photos);
    try { localStorage.removeItem(CLE_BROUILLON); } catch { /* rien */ }
    envoi = false; b = null; photos = [];
    location.hash = `#/demande/${reference}/${jeton}`;
  } catch (err) {
    envoi = false; rendre();
    racine.querySelector(".barre-actions").insertAdjacentHTML("afterbegin", `<p class="erreur">L'envoi n'a pas abouti (${esc(err.message)}). Vérifiez votre connexion et réessayez.</p>`);
  }
}
