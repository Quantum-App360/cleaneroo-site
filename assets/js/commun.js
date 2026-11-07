// Éléments communs au site (index.html) et aux pages statiques (villes, calculateur, comparatifs) :
// étapes « Comment ça marche », encart de réassurance, bouton et fenêtre « Être rappelé ».
import { REGLES, estPrelancement, joursAvantLancement, MESSAGE_LANCEMENT } from "./regles.js";
import { evenement } from "./compteur.js";
import { eurosRond } from "./catalogue.js";
import { icone } from "./icones.js";
import { inscrire } from "./donnees.js";
import { traduire } from "./langue.js";

export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/* ------------------------------------------------------------------ Pré-lancement (ouverture le 31 décembre 2026) */
export function bandeauLancement() {
  if (!estPrelancement()) return "";
  const j = joursAvantLancement();
  return `<div class="lancement"><div class="conteneur">
    <span class="compte">J-${j}</span>
    <span><b>Lancement le 31 décembre 2026</b><span class="message-lancement"> · ${MESSAGE_LANCEMENT}</span></span></div></div>`;
}

/* ------------------------------------------------------------------ Chargement (8 novembre 2026) : logo Cleaneroo + silhouette de la page */
const LOGO_ATTENTE = (petit = false) => `<span class="logo-attente${petit ? " petit" : ""}" aria-hidden="true"><span class="anneau"></span>
  <span class="tuile"><img src="/assets/img/logo-marque.svg" alt="" width="64" height="64"><i class="reflet"></i></span></span>`;
/** Attente : logo de la marque dans un anneau en dégradé qui tourne, reflet d'essuyage qui passe sur le logo, texte avec points animés.
 *  Même animation que l'appli (Chargement.kt). petit : version en ligne, dans une carte. */
export function chargeur(texte = "Chargement…", { petit = false } = {}) {
  const libelle = `<span class="texte-attente">${texte.replace(/…$/, "")}<i class="points"></i></span>`;
  return petit ? `<div class="chargeur-ligne" role="status">${LOGO_ATTENTE(true)}${libelle}</div>`
    : `<div class="chargeur-pro" role="status">${LOGO_ATTENTE()}${libelle}</div>`;
}
/** Silhouette de la page qui arrive (titre, onglets, cartes), avec un balayage lumineux : la mise en page ne saute pas. */
const squelette = () => `<div class="squelette" aria-hidden="true">
  <span class="sq sq-titre"></span><span class="sq sq-ligne" style="width:58%"></span>
  <div class="sq-onglets"><span class="sq sq-pilule"></span><span class="sq sq-pilule"></span><span class="sq sq-pilule"></span></div>
  ${[0, 1, 2].map(i => `<div class="sq-carte" style="--i:${i}"><span class="sq sq-rond"></span><div><span class="sq sq-ligne" style="width:${[64, 48, 56][i]}%"></span>
    <span class="sq sq-ligne fine" style="width:${[86, 72, 80][i]}%"></span></div><span class="sq sq-montant"></span></div>`).join("")}
</div>`;
/** Page entière en attente de données (compte, prestations, suivi d'une demande). */
export const pageChargement = (texte = "Chargement…") => `<div class="chargement-page"><div class="conteneur etroit">${chargeur(texte)}${squelette()}</div></div>`;

/* ------------------------------------------------------------------ Comment ça marche */
export const ETAPES = [
  ["calendrier", "Réservez en 2 minutes", "Choisissez la prestation, répondez à quelques questions, ajoutez des photos et choisissez votre créneau. Le prix s'affiche tout de suite."],
  ["cleaneurs", "Choisissez votre Cleaneur", "Des Cleaneurs vérifiés (identité, SIRET, assurance) se proposent. Comparez prix, note et distance : c'est vous qui choisissez."],
  ["position", "Suivez l'intervention en direct", "« En route », arrivée confirmée par géolocalisation, selfie du jour : vous savez qui vient, et quand."],
  ["photo", "Recevez le compte rendu", "Tâches cochées et horodatées, photos avant / après, signature du Cleaneur : tout est dans votre espace."],
  ["valide", "Validez, puis payez", "Vous n'êtes débité qu'après avoir validé. Crédit d'impôt de 50 % déduit tout de suite ; pourboire et avis si vous le souhaitez."],
];
/** Les 3 étapes essentielles (pages ville) : réserver, suivre, valider puis payer. */
export const ETAPES_COURTES = [ETAPES[0], ETAPES[2], ETAPES[4]];
export const blocEtapes = (liste = ETAPES) => `<div class="etapes etroit">${liste.map(([e, t, d], i) => `
  <div class="etape"><div class="pastille">${icone(e, { tuile: true })}<b>${i + 1}</b></div>
    <div class="carte"><div class="surtitre">ÉTAPE ${i + 1}</div><h3>${t}</h3><p class="muet" style="margin:6px 0 0">${d}</p></div></div>`).join("")}</div>`;

/* ------------------------------------------------------------------ Réassurance (accueil, pages ville, étape 5 de la réservation) */
export function blocReassurance({ compact = false } = {}) {
  const lignes = [
    ["cleaneurs", "Cleaneurs vérifiés", "Identité, SIRET, attestation URSSAF et assurance RC Pro contrôlés avant activation, puis une mission test."],
    ["garantie", "Garantie remplacement", `Votre Cleaneur ne peut pas venir ? Remplaçant en priorité, sinon annulation sans frais et ${eurosRond(REGLES.GARANTIE_REMPLACEMENT_OFFERT_C)} offerts.`],
    ["paiement", "Payé après validation", "Simple empreinte bancaire à la réservation, débit après votre accord."],
    ["photo", "Preuves photo avant et après", "L'état du logement à l'arrivée et au départ du Cleaneur (location saisonnière)."],
  ];
  return `<div class="reassurance${compact ? " compacte" : ""}">${lignes.map(([ic, t, d]) =>
    `<div class="point">${icone(ic, { tuile: !compact })}<div><b>${t}</b><p>${d}</p></div></div>`).join("")}</div>`;
}

/* ------------------------------------------------------------------ Être rappelé */
const CRENEAUX = [["matin", "Matin", "Merci, nous vous rappelons le matin."], ["midi", "Midi", "Merci, nous vous rappelons à midi."],
  ["apres_midi", "Après-midi", "Merci, nous vous rappelons l'après-midi."], ["soir", "Soir", "Merci, nous vous rappelons en soirée."]];
const PROFILS = [["particulier", "Particulier"], ["professionnel", "Professionnel"], ["conciergerie", "Conciergerie"]];

/** Bouton qui ouvre la fenêtre « Être rappelé » (ville préremplie si donnée). */
export const boutonRappel = (classe = "", ville = "") =>
  `<button type="button" class="bouton ${classe}" data-rappel data-ville="${esc(ville)}">${icone("telephone")}<span>Être rappelé</span></button>`;

function fenetreRappel() {
  const radios = (nom, liste) => `<div class="segments">${liste.map(([v, l], i) =>
    `<label><input type="radio" name="${nom}" value="${v}" ${i === 0 ? "checked" : ""}><span>${l}</span></label>`).join("")}</div>`;
  return `<dialog class="fenetre-rappel" id="fenetre-rappel" aria-labelledby="titre-rappel">
    <form id="form-rappel" novalidate>
      <button type="button" class="fermer" data-fermer aria-label="Fermer">${icone("menu").replace('d="M4 7h16M4 12h16M4 17h16"', 'd="M6 6l12 12M18 6 6 18"')}</button>
      <h2 id="titre-rappel">${icone("telephone")} Être rappelé</h2>
      <p class="muet">Laissez votre numéro : nous vous rappelons au créneau de votre choix.</p>
      <label class="champ">Prénom<input name="prenom" autocomplete="given-name" maxlength="80" required></label>
      <label class="champ">Téléphone<input name="telephone" type="tel" inputmode="numeric" autocomplete="tel" maxlength="14" placeholder="06 12 34 56 78" required></label>
      <fieldset><legend>Vous êtes</legend>${radios("profil", PROFILS)}</fieldset>
      <fieldset><legend>Créneau de rappel</legend>${radios("creneau", CRENEAUX)}</fieldset>
      <label class="champ">Ville<input name="ville" autocomplete="address-level2" maxlength="100"></label>
      <label class="case"><input type="checkbox" name="accord" required><span>J'accepte d'être rappelé par Cleaneroo au sujet de ma demande. <a href="/#/confidentialite" target="_blank" rel="noopener">Politique de confidentialité</a></span></label>
      <p class="erreur" hidden></p>
      <button class="bouton" type="submit">Être rappelé</button>
    </form></dialog>`;
}

/** Installe le bouton d'en-tête (ordinateur), la barre du bas (mobile) et la fenêtre. À appeler une fois par page. */
export function installerRappel(villeParDefaut = "") {
  if (document.getElementById("fenetre-rappel")) return;
  document.querySelector(".entete .actions-entete")?.insertAdjacentHTML("afterbegin", boutonRappel("rappel-entete", villeParDefaut));
  document.body.insertAdjacentHTML("beforeend", `<div class="rappel-mobile">${boutonRappel("", villeParDefaut)}</div>${fenetreRappel()}`);
  const d = document.getElementById("fenetre-rappel"), f = d.querySelector("form"), erreur = f.querySelector(".erreur");
  traduire(d); traduire(document.querySelector(".rappel-mobile")); traduire(document.querySelector(".rappel-entete") || document.createElement("i"));
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-rappel]");
    if (b) { if (b.dataset.ville && !f.ville.value) f.ville.value = b.dataset.ville; erreur.hidden = true; d.showModal(); f.prenom.focus(); }
    if (e.target.closest("[data-fermer]") || e.target === d) d.close();
  });
  f.addEventListener("submit", async e => {
    e.preventDefault();
    const tel = f.telephone.value.replace(/[\s.-]/g, "");
    const faute = !f.prenom.value.trim() ? "Indiquez votre prénom." : !/^0[1-9]\d{8}$/.test(tel) ? "Indiquez un numéro de téléphone à 10 chiffres." :
      !f.accord.checked ? "Cochez la case pour accepter d'être rappelé." : "";
    const montrer = t => { erreur.textContent = t; erreur.hidden = false; traduire(erreur); };
    if (faute) return montrer(faute);
    const bouton = f.querySelector("[type=submit]"); bouton.disabled = true;
    try {
      await inscrire({ type: "rappel", prenom: f.prenom.value.trim(), telephone: tel, profil: f.profil.value, creneau: f.creneau.value,
        ville: f.ville.value.trim(), email: "", code_postal: "", consentement: true });
      f.innerHTML = `<button type="button" class="fermer" data-fermer aria-label="Fermer">×</button><h2>${icone("valide")} ${CRENEAUX.find(c => c[0] === f.creneau.value)[2]}</h2>`;
      traduire(f);
      evenement("rappel");
    } catch { montrer("Envoi impossible pour le moment. Réessayez dans quelques minutes."); }
    finally { bouton.disabled = false; }
  });
}
