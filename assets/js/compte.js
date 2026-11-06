// Comptes : « Mon compte » (client, Cleaneur, administration) et « Mes prestations » (biens, prestations à venir et passées).
// Les comptes s'ouvrent avant l'ouverture ; aucune intervention avant le 1er janvier 2027 (DATE_PREMIERES_INTERVENTIONS).
// Mêmes écrans que l'application (EcranCompte.kt).
import { RUBRIQUES, rubrique, TYPES_LOGEMENT } from "./catalogue.js";
import { euros, dateLongue, heure, REGLES } from "./regles.js";
import { icone } from "./icones.js";
import { traduire, tr } from "./langue.js";
import {
  session, creerCompte, connecter, deconnecter, mdpOublie, nouveauMdp, monProfil, majProfil, devenirCleaneur,
  DOCUMENTS_CLEANEUR, mesDocuments, deposerDocument, retirerDocument, lienDocument, soumettreDossier,
  demandesDuCompte, mesDemandes, synchroniserBiens, enregistrerBien, supprimerBien,
} from "./donnees.js";
import { oublierMesInformations } from "./reserver.js";
import { ONGLETS, ongletParDefaut, barreOnglets, ongletParticulier, ongletPro, brancherPro, ongletCleaneur } from "./espaces.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const OUVERTURE = "Les interventions commencent le 1er janvier 2027.";
const STATUTS = { VERIFICATION: "En cours de vérification", PUBLIEE: "En ligne · candidatures", CONFIRMEE: "Confirmée", EN_ROUTE: "Cleaneur en route",
  SUR_PLACE: "Cleaneur sur place", EN_COURS: "En cours", A_VALIDER: "À valider", TERMINEE: "Terminée", ANNULEE: "Annulée" };
const DOSSIER = {
  BROUILLON: ["À compléter", "Complétez votre profil et ajoutez vos documents, puis envoyez votre dossier."],
  A_VERIFIER: ["En vérification", "Votre dossier est en cours de vérification par l'équipe Cleaneroo. Vous recevrez un e-mail."],
  VALIDE: ["Validé", "Votre dossier est validé. Vous pourrez accepter des missions à partir du 1er janvier 2027."],
  REFUSE: ["À corriger", "Votre dossier doit être corrigé :"],
};
const ROLES = { client: "Client", cleaneur: "Cleaneur", admin: "Administrateur" };
const titre = (t, sous = "") => `<h1>${t}</h1><div class="trait-corail"></div>${sous ? `<p class="muet">${sous}</p>` : ""}`;

/** Après le lien de confirmation ou de nouveau mot de passe reçu par e-mail (?vers=compte / ?vers=mdp). */
export async function retourEmail() {
  const vers = new URLSearchParams(location.search).get("vers");
  if (!vers) return;
  await session(); // lit la connexion contenue dans le lien
  history.replaceState(null, "", `${location.pathname}#/compte${vers === "mdp" ? "/mdp" : ""}`);
}

/** Lien du menu : « Mon compte » ou le prénom de la personne connectée. */
export async function majLienCompte() {
  const p = await monProfil().catch(() => null);
  document.querySelectorAll("[data-lien-compte]").forEach(a => a.textContent = p?.prenom ? p.prenom : tr("Mon compte"));
  // Espace Cleaneur créé (Cleaneur ou administrateur) : « Devenir Cleaneur » devient « Mon espace Cleaneur ».
  const espace = p?.role === "cleaneur" || p?.role === "admin";
  document.querySelectorAll('.nav a[href$="#/devenir-cleaneur"], .nav a[data-espace-cleaneur]').forEach(a => {
    a.dataset.espaceCleaneur = "1";
    const avant = a.getAttribute("href").split("#")[0]; // « / » sur les pages fixes (villes, calculateur…)
    a.setAttribute("href", avant + (espace ? "#/compte/cleaneur" : "#/devenir-cleaneur"));
    a.textContent = tr(espace ? "Mon espace Cleaneur" : "Devenir Cleaneur");
  });
}

/* ------------------------------------------------------------------ Mon compte */

export async function pageCompte(vue, param) {
  param = param ?? location.hash.split("/")[2];
  const ici = location.hash;
  const s = await session();
  if (location.hash !== ici) return;
  if (param === "mdp" && s) return ecranNouveauMdp(vue);
  if (!s) return ecranConnexion(vue, ["creer", "cleaneur", "pro"].includes(param) ? "creer" : "connexion", "", false, param === "cleaneur" || param === "pro" ? param : "client");
  const [p, biens, demandes] = await Promise.all([monProfil().catch(() => null), synchroniserBiens().catch(() => []), demandesDuCompte().catch(() => [])]);
  if (location.hash !== ici) return;
  if (!p) { vue.innerHTML = `<section class="bloc"><div class="etroit">${titre("Mon compte")}<p class="erreur">${tr("Le service est momentanément indisponible. Réessayez dans quelques minutes.")}</p></div></section>`; traduire(vue); return; }
  memoriserCoordonnees(p);
  const cleaneur = p.role === "cleaneur" || p.role === "admin";
  const onglet = ONGLETS.some(o => o[0] === param) ? param : ongletParDefaut(p, biens);
  const docs = cleaneur && onglet === "cleaneur" ? await mesDocuments().catch(() => []) : [];
  if (location.hash !== ici) return;
  const contenu = onglet === "pro" ? ongletPro(p, biens)
    : onglet === "cleaneur" ? ongletCleaneur(p, docs, { dossier: cleaneur ? blocDossier(p, docs) : "", profil: cleaneur ? formulaireProfil(p, true) : "" })
    : ongletParticulier(p, biens, demandes) + formulaireProfil(p, false);
  vue.innerHTML = `<section class="bloc"><div class="etroit large-compte">
    ${titre(`Bonjour ${esc(p.prenom || "")}`.trim())}
    <p><span class="tampon">${ROLES[p.role]}</span> <span class="petit">${esc(p.email)}</span></p>
    <div class="note" style="margin:14px 0"><span><b>Comptes ouverts dès maintenant.</b> ${OUVERTURE}</span></div>
    ${p.role === "admin" ? `<div class="carte teintee" style="margin-bottom:14px"><b>Espace administrateur</b>
      <p class="petit" style="margin:4px 0 10px">Demandes, inscriptions et dossiers des Cleaneurs (documents, validation).</p>
      <a class="bouton secondaire" href="gestion.html">Ouvrir la gestion</a></div>` : ""}
    ${barreOnglets(onglet)}
    <div class="contenu-onglet">${contenu}</div>
    <p style="margin-top:18px"><button type="button" class="lien-bouton" id="deconnexion-compte">Se déconnecter</button></p>
  </div></section>`;
  traduire(vue);
  if (vue.querySelector("#form-profil")) brancherProfil(vue, p, onglet === "cleaneur" && cleaneur);
  if (onglet === "cleaneur" && cleaneur) brancherDossier(vue, p);
  if (onglet === "pro") brancherPro(vue, p, biens, demandes, { majProfil, recharger: () => pageCompte(vue) });
  vue.querySelector("#devenir-cleaneur")?.addEventListener("click", async e => {
    e.target.disabled = true;
    await devenirCleaneur().catch(() => null);
    majLienCompte();
    pageCompte(vue);
  });
  vue.querySelector("#deconnexion-compte").onclick = async () => { await deconnecter(); majLienCompte(); location.hash = "#/compte"; pageCompte(vue); };
}

/** Coordonnées du compte reprises par le parcours de réservation (si l'appareil ne les connaît pas encore). */
function memoriserCoordonnees(p) {
  try {
    const actuel = JSON.parse(localStorage.getItem("cleaneroo-profil") || "null");
    if (!actuel?.email) localStorage.setItem("cleaneroo-profil", JSON.stringify({ prenom: p.prenom, nom: p.nom, email: p.email, telephone: p.telephone }));
  } catch { /* navigation privée */ }
}

function ecranConnexion(vue, mode, message = "", ok = false, roleDefaut = "client") {
  const creer = mode === "creer";
  vue.innerHTML = `<section class="bloc"><div class="etroit">
    ${titre("Mon compte", "Préparez dès maintenant votre espace : profil, biens, demandes ou dossier Cleaneur. " + OUVERTURE)}
    <div class="segments" style="margin:6px 0 14px"><button type="button" data-mode="connexion" class="${creer ? "" : "choisi"}">Se connecter</button>
      <button type="button" data-mode="creer" class="${creer ? "choisi" : ""}">Créer un compte</button></div>
    <form class="carte" id="form-compte" novalidate>
      ${creer ? `<p style="margin:0 0 8px;font-weight:600">Vous êtes :</p>
        <div class="choix" style="margin-bottom:14px"><button type="button" data-role="client" class="${roleDefaut === "client" ? "choisi" : ""}">Client : je cherche un nettoyage</button>
          <button type="button" data-role="pro" class="${roleDefaut === "pro" ? "choisi" : ""}">Conciergerie ou plusieurs biens : je gère des locations</button>
          <button type="button" data-role="cleaneur" class="${roleDefaut === "cleaneur" ? "choisi" : ""}">Cleaneur : je propose mes services</button></div>
        <input type="hidden" name="role" value="${roleDefaut}">
        <div class="grille-2"><label class="champ">Prénom<input name="prenom" required maxlength="80" autocomplete="given-name"></label>
          <label class="champ">Nom<input name="nom" required maxlength="80" autocomplete="family-name"></label></div>` : ""}
      <label class="champ">E-mail<input type="email" name="email" required maxlength="200" autocomplete="username"></label>
      <label class="champ">Mot de passe${creer ? " (10 caractères minimum)" : ""}<input type="password" name="mdp" required minlength="${creer ? 10 : 1}" autocomplete="${creer ? "new-password" : "current-password"}"></label>
      ${creer ? `<label class="case"><input type="checkbox" name="cgu"> <span>J'accepte les <a href="#/conditions">conditions d'utilisation</a> et la <a href="#/confidentialite">politique de confidentialité</a>.</span></label>` : ""}
      ${message ? `<p class="${ok ? "note" : "erreur"}" style="margin:10px 0 0">${message}</p>` : ""}
      <button class="bouton plein" type="submit" style="margin-top:12px">${creer ? "Créer mon compte" : "Se connecter"}</button>
      ${creer ? "" : `<button class="lien-bouton" type="button" id="mdp-oublie">Mot de passe oublié ?</button>`}
    </form></div></section>`;
  traduire(vue);
  vue.querySelectorAll("[data-mode]").forEach(b => b.onclick = () => ecranConnexion(vue, b.dataset.mode, "", false, roleDefaut));
  const f = vue.querySelector("#form-compte");
  f.querySelectorAll("[data-role]").forEach(b => b.onclick = () => {
    f.querySelectorAll("[data-role]").forEach(x => x.classList.toggle("choisi", x === b));
    f.role.value = b.dataset.role;
  });
  const erreur = t => ecranConnexion(vue, mode, tr(t));
  f.onsubmit = async e => {
    e.preventDefault();
    const email = f.email.value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return erreur("Indiquez une adresse e-mail valide.");
    f.querySelector("[type=submit]").disabled = true;
    if (!creer) {
      const r = await connecter(email, f.mdp.value).catch(() => "erreur");
      if (r === "ok") { majLienCompte(); return pageCompte(vue); }
      return erreur(r === "confirmer" ? "Confirmez d'abord votre e-mail : ouvrez le lien reçu, puis connectez-vous." : r === "incorrect" ? "E-mail ou mot de passe incorrect." : "Le service est momentanément indisponible. Réessayez dans quelques minutes.");
    }
    if (!f.prenom.value.trim() || !f.nom.value.trim()) return erreur("Indiquez votre prénom et votre nom.");
    if (f.mdp.value.length < 10) return erreur("Le mot de passe doit contenir au moins 10 caractères.");
    if (!f.cgu.checked) return erreur("Acceptez les conditions d'utilisation pour créer votre compte.");
    try {
      const pro = f.role.value === "pro";   // compte client ouvert sur l'espace Pro
      const r = await creerCompte({ email, mdp: f.mdp.value, role: pro ? "client" : f.role.value, prenom: f.prenom.value.trim(), nom: f.nom.value.trim() });
      if (r === "connecte") { majLienCompte(); if (pro) { location.hash = "#/compte/pro"; return; } return pageCompte(vue); }
      ecranConnexion(vue, "connexion", tr("Compte créé. Ouvrez l'e-mail de confirmation que nous venons de vous envoyer, cliquez sur le lien, puis connectez-vous."), true);
    } catch (err) {
      erreur(/registered|already/i.test(err.message) ? "Un compte existe déjà avec cet e-mail : connectez-vous." : /password/i.test(err.message) ? "Mot de passe trop simple : choisissez-en un plus long ou plus varié." : "Le service est momentanément indisponible. Réessayez dans quelques minutes.");
    }
  };
  vue.querySelector("#mdp-oublie")?.addEventListener("click", async () => {
    const email = f.email.value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return erreur("Indiquez d'abord votre e-mail, puis touchez « Mot de passe oublié ? ».");
    await mdpOublie(email).catch(() => null);
    ecranConnexion(vue, "connexion", tr("Si un compte existe avec cet e-mail, vous allez recevoir un lien pour choisir un nouveau mot de passe."), true);
  });
}

function ecranNouveauMdp(vue, message = "") {
  vue.innerHTML = `<section class="bloc"><div class="etroit">${titre("Nouveau mot de passe")}
    <form class="carte" id="form-mdp"><label class="champ">Nouveau mot de passe (10 caractères minimum)<input type="password" name="mdp" required minlength="10" autocomplete="new-password"></label>
    ${message ? `<p class="erreur">${message}</p>` : ""}<button class="bouton plein" type="submit">Enregistrer</button></form></div></section>`;
  traduire(vue);
  const f = vue.querySelector("#form-mdp");
  f.onsubmit = async e => {
    e.preventDefault();
    if (f.mdp.value.length < 10) return ecranNouveauMdp(vue, tr("Le mot de passe doit contenir au moins 10 caractères."));
    try { await nouveauMdp(f.mdp.value); location.hash = "#/compte"; }
    catch { ecranNouveauMdp(vue, tr("Mot de passe trop simple : choisissez-en un plus long ou plus varié.")); }
  };
}

function formulaireProfil(p, cleaneur) {
  return `<form class="carte" id="form-profil" novalidate style="margin-top:14px"><b>${cleaneur ? "Mon profil de Cleaneur" : "Mes informations"}</b>
    <div class="grille-2" style="margin-top:12px"><label class="champ">Prénom<input name="prenom" maxlength="80" value="${esc(p.prenom)}" autocomplete="given-name"></label>
      <label class="champ">Nom<input name="nom" maxlength="80" value="${esc(p.nom)}" autocomplete="family-name"></label></div>
    <div class="grille-2"><label class="champ">Téléphone<input name="telephone" type="tel" maxlength="20" value="${esc(p.telephone)}" autocomplete="tel"></label>
      <label class="champ">Code postal<input name="code_postal" inputmode="numeric" maxlength="5" value="${esc(p.code_postal)}" autocomplete="postal-code"></label></div>
    <label class="champ">Ville<input name="ville" maxlength="100" value="${esc(p.ville)}" autocomplete="address-level2"></label>
    ${cleaneur ? `<div class="grille-2"><label class="champ">Numéro SIRET (14 chiffres)<input name="siret" inputmode="numeric" maxlength="17" value="${esc(p.siret)}"></label>
      <label class="champ">Périmètre d'intervention<select name="zone_km">${[...new Set([...REGLES.ZONES_KM, p.zone_km || REGLES.ZONE_KM_DEFAUT])].sort((a, b) => a - b)
        .map(km => `<option value="${km}" ${km === (p.zone_km || REGLES.ZONE_KM_DEFAUT) ? "selected" : ""}>${km} km autour de chez moi</option>`).join("")}</select></label></div>
      <div class="carte-perimetre" id="carte-perimetre" aria-label="Carte de votre zone d'intervention"></div>
      <p class="petit" id="legende-perimetre" style="margin:6px 0 12px"></p>
      <p style="margin:6px 0 4px;font-weight:600;font-size:14px">Prestations que je propose</p>
      ${RUBRIQUES.map(r => `<label class="case"><input type="checkbox" name="prestation" value="${r.id}" ${p.prestations?.includes(r.id) ? "checked" : ""}> <span>${icone(r.icone)} ${r.nom}</span></label>`).join("")}` : ""}
    <p class="erreur" id="erreur-profil" style="margin:8px 0 0"></p>
    <button class="bouton plein" type="submit" style="margin-top:10px">Enregistrer</button>
  </form>`;
}

/* Carte du périmètre : cercle de N km autour de la commune du Cleaneur (OpenStreetMap + Base Adresse Nationale). */
let leaflet = null;
function chargerLeaflet() {
  if (leaflet) return leaflet;
  leaflet = new Promise((ok, ko) => {
    const css = document.createElement("link");
    css.rel = "stylesheet"; css.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
    document.head.appendChild(css);
    const js = document.createElement("script");
    js.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    js.onload = () => ok(window.L); js.onerror = ko;
    document.head.appendChild(js);
  });
  return leaflet;
}
/** Position de la commune (code postal, et ville si connue). null si introuvable. */
async function positionCommune(cp, ville) {
  const q = encodeURIComponent(ville || cp);
  const r = await fetch(`https://data.geopf.fr/geocodage/search?q=${q}&postcode=${cp}&type=municipality&limit=1`);
  const f = (await r.json()).features?.[0];
  return f ? { lat: f.geometry.coordinates[1], lon: f.geometry.coordinates[0], nom: f.properties.city || f.properties.label } : null;
}
function brancherCarte(f) {
  const boite = document.getElementById("carte-perimetre"), legende = document.getElementById("legende-perimetre");
  if (!boite) return;
  let carte = null, couche = null, point = null, derniere = "";
  const maj = async () => {
    const cp = f.code_postal.value.trim(), ville = f.ville.value.trim(), km = Number(f.zone_km.value) || REGLES.ZONE_KM_DEFAUT;
    if (!/^[0-9]{5}$/.test(cp)) { boite.hidden = true; legende.textContent = tr("Indiquez votre code postal pour voir votre zone sur la carte."); return; }
    try {
      const cle = cp + "|" + ville.toLowerCase();
      if (cle !== derniere || !point) { point = await positionCommune(cp, ville); derniere = cle; }
      if (!point) { boite.hidden = true; legende.textContent = tr("Code postal introuvable : vérifiez-le pour voir votre zone."); return; }
      const L = await chargerLeaflet();
      boite.hidden = false;
      if (!carte) {
        carte = L.map(boite, { scrollWheelZoom: false, attributionControl: true, dragging: !L.Browser.mobile, touchZoom: false, tap: false });
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap" }).addTo(carte);
      }
      const centre = [point.lat, point.lon];
      carte.fitBounds(L.latLng(centre).toBounds(km * 2000), { padding: [12, 12] });
      if (couche) couche.remove();
      const cercle = L.circle(centre, { radius: km * 1000, color: "#1F8A80", weight: 2, fillColor: "#2EC4B6", fillOpacity: 0.18 });
      couche = L.layerGroup([cercle, L.circleMarker(centre, { radius: 5, color: "#fff", weight: 2, fillColor: "#F27D5B", fillOpacity: 1 })]).addTo(carte);
      setTimeout(() => carte.invalidateSize(), 50);
      legende.textContent = `${km} km autour de ${point.nom}`;
      traduire(legende);
    } catch { boite.hidden = true; legende.textContent = ""; }
  };
  f.zone_km.addEventListener("change", maj);
  f.code_postal.addEventListener("change", maj);
  f.ville.addEventListener("change", maj);
  maj();
}

function brancherProfil(vue, p, cleaneur) {
  const f = vue.querySelector("#form-profil");
  if (cleaneur) brancherCarte(f);
  f.onsubmit = async e => {
    e.preventDefault();
    const err = vue.querySelector("#erreur-profil");
    const tel = f.telephone.value.replace(/\D/g, ""), cp = f.code_postal.value.trim();
    if (tel && !/^0[1-9][0-9]{8}$/.test(tel)) { err.textContent = tr("Indiquez un numéro de téléphone à 10 chiffres."); return; }
    if (cp && !/^[0-9]{5}$/.test(cp)) { err.textContent = tr("Indiquez un code postal à 5 chiffres."); return; }
    const champs = { prenom: f.prenom.value.trim(), nom: f.nom.value.trim(), telephone: tel, code_postal: cp, ville: f.ville.value.trim() };
    if (cleaneur) {
      const siret = f.siret.value.replace(/\D/g, "");
      if (siret && siret.length !== 14) { err.textContent = tr("Le numéro SIRET compte 14 chiffres."); return; }
      Object.assign(champs, { siret, zone_km: Number(f.zone_km.value) || REGLES.ZONE_KM_DEFAUT,
        prestations: [...f.querySelectorAll("[name=prestation]:checked")].map(c => c.value) });
    }
    f.querySelector("[type=submit]").disabled = true;
    try { await majProfil(champs); pageCompte(vue); majLienCompte(); }
    catch { err.textContent = tr("Le service est momentanément indisponible. Réessayez dans quelques minutes."); f.querySelector("[type=submit]").disabled = false; }
  };
}

/* ------------------------------------------------------------------ Dossier Cleaneur : documents scannés avec le téléphone */

const STATUT_DOC = { A_VERIFIER: "En vérification", ACCEPTE: "Accepté", REFUSE: "Refusé" };

function blocDossier(p, docs) {
  const [etat, texte] = DOSSIER[p.dossier] || DOSSIER.BROUILLON;
  const modifiable = p.dossier !== "A_VERIFIER" && p.dossier !== "VALIDE";
  const manquants = DOCUMENTS_CLEANEUR.filter(d => d.obligatoire && !docs.some(x => x.type === d.type && x.statut !== "REFUSE"));
  return `<div class="carte" id="dossier"><div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><b>Mon dossier Cleaneur</b><span class="tampon">${etat}</span></div>
    <p class="petit" style="margin:6px 0 4px">${texte}${p.dossier === "REFUSE" && p.dossier_motif ? ` <b>${esc(p.dossier_motif)}</b>` : ""}</p>
    <p class="petit" style="margin:0 0 10px">Photographiez chaque document avec votre téléphone (bien à plat, lisible en entier) ou ajoutez un fichier PDF.</p>
    ${DOCUMENTS_CLEANEUR.map(d => {
      const liste = docs.filter(x => x.type === d.type);
      return `<div style="border-top:1px solid var(--separateur);padding:12px 0">
        <b>${d.nom}</b>${d.obligatoire ? "" : ` <span class="petit">(facultatif)</span>`}<div class="petit">${d.aide}</div>
        ${liste.map(x => `<div class="petit" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:6px">
          <button type="button" class="lien-bouton" style="padding:0;min-height:36px" data-voir="${esc(x.chemin)}">Voir le document</button>
          <span class="tampon">${STATUT_DOC[x.statut]}</span>${x.motif ? `<span class="erreur">${esc(x.motif)}</span>` : ""}
          ${x.statut !== "ACCEPTE" && modifiable ? `<button type="button" class="lien-bouton" style="padding:0;min-height:36px;color:var(--erreur)" data-retirer="${x.id}">Retirer</button>` : ""}</div>`).join("")}
        ${modifiable ? `<div class="boutons-photo"><label class="bouton secondaire">${icone("photo")} Scanner avec l'appareil photo<input type="file" accept="image/*" capture="environment" hidden data-doc="${d.type}"></label>
          <label class="bouton secondaire">Choisir un fichier<input type="file" accept="image/*,application/pdf" hidden data-doc="${d.type}"></label></div>` : ""}
      </div>`;
    }).join("")}
    <p class="erreur" id="erreur-dossier" style="margin:6px 0 0"></p>
    ${modifiable ? `<button type="button" class="bouton plein" id="envoyer-dossier" style="margin-top:8px" ${manquants.length ? "disabled" : ""}>Envoyer mon dossier pour vérification</button>
      ${manquants.length ? `<p class="petit" style="margin:6px 0 0">Il manque : ${manquants.map(d => d.nom).join(", ")}.</p>` : ""}` : ""}
  </div>`;
}

function brancherDossier(vue, p) {
  const err = vue.querySelector("#erreur-dossier");
  vue.querySelectorAll("[data-doc]").forEach(inp => inp.onchange = async () => {
    const f = inp.files[0];
    if (!f) return;
    err.textContent = tr("Envoi en cours…");
    try { await deposerDocument(inp.dataset.doc, f); pageCompte(vue); }
    catch (e) { err.textContent = /lourd/.test(e.message) ? tr("Fichier trop lourd (10 Mo maximum).") : tr("Le document n'a pas pu être envoyé. Réessayez."); }
  });
  vue.querySelectorAll("[data-voir]").forEach(b => b.onclick = async () => {
    const fen = window.open("", "_blank");
    try { fen.location = await lienDocument(b.dataset.voir); } catch { fen?.close(); }
  });
  vue.querySelectorAll("[data-retirer]").forEach(b => b.onclick = async () => {
    const docs = await mesDocuments().catch(() => []);
    const d = docs.find(x => x.id === b.dataset.retirer);
    if (d && confirm(tr("Retirer ce document ?"))) { await retirerDocument(d).catch(() => null); pageCompte(vue); }
  });
  vue.querySelector("#envoyer-dossier")?.addEventListener("click", async e => {
    e.target.disabled = true;
    const r = await soumettreDossier().catch(() => "erreur");
    if (r === "ok") return pageCompte(vue);
    e.target.disabled = false;
    err.textContent = tr(r === "profil" ? "Complétez d'abord votre profil : prénom, nom, téléphone, code postal, SIRET et au moins une prestation."
      : r === "documents" ? "Ajoutez les 4 documents obligatoires avant d'envoyer votre dossier."
      : "Le service est momentanément indisponible. Réessayez dans quelques minutes.");
  });
}

/* ------------------------------------------------------------------ « Devenir Cleaneur » : accès direct à son espace selon le compte */

export async function afficherAccesCleaneur(racine) {
  const bloc = racine.querySelector("[data-acces-cleaneur]");
  if (!bloc) return;
  const p = await monProfil().catch(() => null);
  const carte = (titre, texte, bouton, lien, second = "") => `<div class="carte teintee" style="margin-bottom:16px"><b>${titre}</b>
    <p class="petit" style="margin:4px 0 10px">${texte}</p><div class="boutons" style="margin-top:0"><a class="bouton" href="${lien}">${bouton}</a>${second}</div></div>`;
  bloc.innerHTML = !p ? carte("Créez votre compte Cleaneur", "Préparez dès maintenant votre profil et votre dossier : tout sera prêt pour vos premières missions le 1er janvier 2027.",
      "Créer mon compte Cleaneur", "#/compte/cleaneur", `<a class="bouton secondaire" href="#/compte">J'ai déjà un compte</a>`)
    : p.role === "admin" ? carte("Accès administrateur", "Votre espace Cleaneur est ouvert sans dossier ni documents.", "Ouvrir mon espace Cleaneur", "#/compte/cleaneur")
    : p.role === "cleaneur" ? carte("Mon espace Cleaneur", "Votre profil, votre dossier et vos missions sont dans votre compte.", "Ouvrir mon espace Cleaneur", "#/compte/cleaneur")
    : carte("Vous avez déjà un compte client", "Ouvrez votre espace Cleaneur avec le même compte pour préparer votre dossier.", "Devenir Cleaneur avec ce compte", "#/compte");
  traduire(bloc);
}

/* ------------------------------------------------------------------ Mes prestations : biens, à venir, passées, ajouter */

const FINIES = ["TERMINEE", "ANNULEE"];

export async function pageMesPrestations(vue) {
  const ici = location.hash;
  const s = await session();
  const [compte, locales, biens] = await Promise.all([
    s ? demandesDuCompte().catch(() => []) : [], mesDemandes().catch(() => []), synchroniserBiens().catch(() => []),
  ]);
  // Demandes du compte et de cet appareil, sans doublon ; le lien de suivi a besoin du jeton.
  const toutes = [...compte];
  locales.forEach(d => { if (!toutes.some(x => x.reference === d.reference)) toutes.push(d); });
  const quand = d => d.creneau ? new Date(d.creneau).getTime() : new Date(d.cree_le).getTime();
  const aVenir = toutes.filter(d => !FINIES.includes(d.statut)).sort((a, b) => quand(a) - quand(b));
  const passees = toutes.filter(d => FINIES.includes(d.statut)).sort((a, b) => quand(b) - quand(a));
  const carte = d => {
    const r = rubrique(d.rubrique_id);
    const date = d.creneau ? `${dateLongue(new Date(d.creneau))} · ${heure(new Date(d.creneau).getHours())}` : tr("Date à fixer");
    const teinte = d.statut === "TERMINEE" ? " vert" : d.statut === "ANNULEE" ? " gris" : "";
    return `<a class="carte ligne-compte" href="#/demande/${esc(d.reference)}/${esc(d.jeton)}">${icone(r.icone, { tuile: true })}
      <div class="corps"><div class="haut"><h3>${r.nom}</h3><span class="tampon${teinte}">${STATUTS[d.statut] || d.statut}</span></div>
      <p class="muet">${date} · ${esc(d.ville)}</p>
      <p class="petit">Réf. ${esc(d.reference)} · ${d.sur_devis ? "Sur devis" : `estimé ${euros(d.estimation_c)}`}</p></div><span class="aller" aria-hidden="true">›</span></a>`;
  };
  const vide = (t, plus = "") => `<div class="vide-compte"><p class="muet">${t}</p>${plus ? `<p class="petit">${plus}</p>` : ""}</div>`;
  if (location.hash !== ici) return;
  vue.innerHTML = `<section class="bloc"><div class="etroit">
    ${titre("Mes prestations")}
    <a class="bouton plein" href="#/reserver" style="margin-bottom:10px">＋ Ajouter une prestation</a>
    ${s ? "" : `<div class="note" style="margin:8px 0 6px"><span>Créez votre compte pour retrouver vos biens et vos prestations sur tous vos appareils et dans l'application. <a href="#/compte/creer">Créer mon compte</a> · <a href="#/compte">Se connecter</a></span></div>`}
    <h2 class="titre-section">${icone("logement", { tuile: true })}Mes biens</h2>
    <p class="petit" style="margin-top:0">Vos adresses déjà renseignées : elles sont proposées automatiquement à la réservation.</p>
    ${biens.length ? biens.map(l => `<div class="carte ligne-compte">${icone("position", { tuile: true })}
      <div class="corps"><b><span>${esc((TYPES_LOGEMENT.find(t => t.id === l.typeLogementId) || {}).nom || tr("Adresse"))}</span> · ${esc(l.ville)}</b><div class="petit">${esc(l.rue)}, ${esc(l.codePostal)} ${esc(l.ville)}${l.surface ? `<span> · ${l.surface} m²</span>` : ""}${l.chambres != null ? `<span> · ${l.chambres} ch.</span>` : ""}</div></div>
      <button type="button" class="lien-bouton" style="color:var(--erreur)" data-retirer-bien="${esc(l.id)}">Retirer</button></div>`).join("") : vide("Aucun bien enregistré pour l'instant.")}
    <details class="carte" style="margin-top:6px"><summary style="cursor:pointer;font-weight:700">＋ Ajouter un bien</summary>
      <form id="form-bien" novalidate style="margin-top:12px">
        <label class="champ">Type<select name="typeLogementId">${TYPES_LOGEMENT.map(t => `<option value="${t.id}">${t.nom}</option>`).join("")}</select></label>
        <label class="champ">Adresse<input name="rue" maxlength="200" autocomplete="street-address"></label>
        <div class="grille-2"><label class="champ">Code postal<input name="codePostal" inputmode="numeric" maxlength="5" autocomplete="postal-code"></label>
          <label class="champ">Ville<input name="ville" maxlength="100" autocomplete="address-level2"></label></div>
        <div class="grille-3"><label class="champ">Surface (m²)<input name="surface" type="number" min="5" max="1000"></label>
          <label class="champ">Chambres<input name="chambres" type="number" min="0" max="20"></label>
          <label class="champ">Salles de bain<input name="sdb" type="number" min="0" max="10"></label></div>
        <p class="erreur" id="erreur-bien"></p>
        <button class="bouton plein" type="submit">Enregistrer ce bien</button></form></details>
    <h2 class="titre-section">${icone("calendrier", { tuile: true })}Mes prestations à venir</h2>
    ${aVenir.length ? aVenir.map(carte).join("") : vide("Aucune prestation à venir.", OUVERTURE)}
    <h2 class="titre-section">${icone("termine", { tuile: true })}Mes prestations passées</h2>
    ${passees.length ? passees.map(carte).join("") : vide("Aucune prestation passée.")}
    ${s ? "" : `<p class="petit" style="margin-top:18px">Vous avez réservé depuis un autre appareil ? Ouvrez le lien de suivi reçu après la réservation : la demande s'ajoutera ici.</p>`}
    ${biens.length ? `<p style="margin-top:18px"><button type="button" class="lien-bouton" style="color:var(--erreur);padding:0" id="oublier">Oublier mes informations sur cet appareil</button></p>` : ""}
  </div></section>`;
  traduire(vue);
  const f = vue.querySelector("#form-bien");
  f.typeLogementId.value = "appartement";
  const defauts = () => { const t = TYPES_LOGEMENT.find(x => x.id === f.typeLogementId.value); f.surface.value = t.surface; f.chambres.value = t.chambres; f.sdb.value = t.sdb; };
  defauts();
  f.typeLogementId.onchange = defauts;
  f.onsubmit = async e => {
    e.preventDefault();
    const err = vue.querySelector("#erreur-bien");
    if (f.rue.value.trim().length < 3 || !/^[0-9]{5}$/.test(f.codePostal.value.trim()) || !f.ville.value.trim()) { err.textContent = tr("Indiquez l'adresse, le code postal et la ville."); return; }
    const t = TYPES_LOGEMENT.find(x => x.id === f.typeLogementId.value);
    await enregistrerBien({ id: "l" + Date.now(), typeLogementId: t.id, surface: Number(f.surface.value) || t.surface, chambres: Number(f.chambres.value) || 0,
      sdb: Number(f.sdb.value) || 0, niveaux: t.niveaux, rue: f.rue.value.trim(), codePostal: f.codePostal.value.trim(), ville: f.ville.value.trim(),
      accueil: "PRESENT", tiersNom: "", tiersTel: "", boiteEmplacement: "" }).catch(() => null);
    pageMesPrestations(vue);
  };
  vue.querySelectorAll("[data-retirer-bien]").forEach(b => b.onclick = async () => {
    if (!confirm(tr("Retirer ce bien ?"))) return;
    await supprimerBien(b.dataset.retirerBien).catch(() => null);
    pageMesPrestations(vue);
  });
  vue.querySelector("#oublier")?.addEventListener("click", () => {
    if (!confirm(tr("Effacer vos coordonnées et vos biens de cet appareil ? Ceux de votre compte sont conservés."))) return;
    oublierMesInformations();
    pageMesPrestations(vue);
  });
}

