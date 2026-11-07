// Espaces du compte : onglets « Particulier », « Pro » (conciergeries et multi-biens, agenda iCal) et « Cleaneur » (missions).
// Mêmes écrans que l'application (EspacesCompte.kt). Les valeurs métier sont dans regles.js.
import { TYPES_LOGEMENT, rubrique } from "./catalogue.js";
import { REGLES, euros, dateLongue, sirenSiretValide } from "./regles.js";
import { icone } from "./icones.js";
import { traduire, tr, LOCALE } from "./langue.js";
import { DOCUMENTS_CLEANEUR, enregistrerBien, lireCalendrier } from "./donnees.js";
import { couleurBien, voies, morceau, erreurSejour, sejoursGardes, nuits, versIcs } from "./agenda.js";
import { afficherCarte, coordonnees } from "./cartes.js";
import { chargeur } from "./commun.js";
import { blocFormulesCleaneur } from "./formules-cleaneur.js";
import { preremplir } from "./reserver.js";
export { brancherMissions, demanderGeoloc } from "./missions.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const ONGLETS = [["particulier", "Particulier", "logement"], ["pro", "Pro", "bureaux"], ["cleaneur", "Cleaneur", "cleaneurs"]];

/**
 * Espaces du compte : un par statut coché (particulier, pro, cleaneur ; cumulables). profils.espace = l'espace ouvert,
 * toujours parmi les statuts. Un compte à plusieurs statuts passe de l'un à l'autre ; l'administrateur a les trois.
 */
export const statutsDu = p => (p.statuts && p.statuts.length ? p.statuts : [p.role === "cleaneur" ? "cleaneur" : p.espace === "pro" ? "pro" : "particulier"]);
export function espaceDu(p) {
  const st = statutsDu(p);
  return st.includes(p.espace) ? p.espace : st[0];
}
/** Administrateur : onglet ouvert par défaut. */
export function ongletParDefaut(p, biens) {
  if (p.role === "cleaneur") return "cleaneur";
  if (p.espace === "pro" || p.societe || biens.length >= REGLES.SEUIL_ESPACE_PRO_BIENS) return "pro";
  return "particulier";
}
export const NOMS_ESPACES = { particulier: "Mon espace Particulier", pro: "Mon espace Pro", cleaneur: "Mon espace Cleaneur" };

export function barreOnglets(actif, ids = ONGLETS.map(o => o[0])) {
  return `<nav class="onglets-compte" aria-label="Mes espaces">${ONGLETS.filter(o => ids.includes(o[0])).map(([id, nom, ico]) =>
    `<a href="#/compte/${id}" class="${id === actif ? "actif" : ""}" ${id === actif ? 'aria-current="page"' : ""}>${icone(ico)}<span>${nom}</span></a>`).join("")}</nav>`;
}

/* ------------------------------------------------------------------ Outils de dates (jours AAAA-MM-JJ, heure locale) */
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const jourDe = s => { const [a, m, j] = s.split("-").map(Number); return new Date(a, m - 1, j); };
const plusJours = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const memeAdresse = (d, l) => (d.rue || "").trim().toLowerCase() === (l.rue || "").trim().toLowerCase() && (d.code_postal || d.codePostal) === l.codePostal;
const nomBien = l => l.nom || `${(TYPES_LOGEMENT.find(t => t.id === l.typeLogementId) || {}).nom || tr("Adresse")} · ${l.ville}`;

/* ------------------------------------------------------------------ Particulier */

export function ongletParticulier(p, biens, demandes) {
  const prochaine = demandes.filter(d => !["TERMINEE", "ANNULEE"].includes(d.statut))
    .sort((a, b) => new Date(a.creneau || a.cree_le) - new Date(b.creneau || b.cree_le))[0];
  const r = prochaine && rubrique(prochaine.rubrique_id);
  return `<div class="carte mise-en-avant">
      <span class="surtitre">Ma prochaine prestation</span>
      ${prochaine ? `<div class="ligne-compte" style="padding:0;box-shadow:none;border:0;background:none;margin-top:10px">${icone(r.icone, { tuile: true })}
        <div class="corps"><h3 style="margin:0">${r.nom}</h3><p class="muet" style="margin:2px 0 0">${prochaine.creneau ? dateLongue(new Date(prochaine.creneau)) : tr("Date à fixer")} · ${esc(prochaine.ville)}</p></div></div>
        <div class="boutons"><a class="bouton" href="#/demande/${esc(prochaine.reference)}/${esc(prochaine.jeton)}">Suivre ma prestation</a><a class="bouton secondaire" href="#/reserver">Réserver un ménage</a></div>`
      : `<p class="muet" style="margin:8px 0 0">Aucune prestation prévue pour l'instant.</p>
        <div class="boutons"><a class="bouton" href="#/reserver">Réserver un ménage</a></div>`}
    </div>
    <div class="grille-raccourcis">
      <a class="carte raccourci" href="#/mes-demandes">${icone("calendrier", { tuile: true })}<b>Mes prestations</b><span class="petit">À venir et passées</span></a>
      <a class="carte raccourci" href="#/mes-demandes">${icone("logement", { tuile: true })}<b>Mes biens</b><span class="petit">${biens.length} adresse${biens.length > 1 ? "s" : ""} enregistrée${biens.length > 1 ? "s" : ""}</span></a>
      <a class="carte raccourci" href="#/reserver">${icone("instantane", { tuile: true })}<b>Nouvelle demande</b><span class="petit">Prix immédiat</span></a>
    </div>
`;
}

/* ------------------------------------------------------------------ Pro : conciergeries et multi-propriétaires */

const SOURCES = [["airbnb", "Airbnb"], ["booking", "Booking.com"], ["autre", "Autre calendrier"]];
let moisAffiche = null;      // premier jour du mois de l'agenda
let filtreBien = "";         // agenda : un seul bien ou tous
let vueAgenda = "mois";      // « mois » ou « liste »
let jourChoisi = null;       // jour touché dans le calendrier (détail affiché dessous)

/** Séjours de tous les biens : ceux des calendriers iCal et ceux saisis à la main ; erreurs par lien. */
async function sejoursDes(biens) {
  const sejours = [], erreurs = {};
  biens.forEach(l => (l.sejours || []).forEach(s => sejours.push({ ...s, bienId: l.id, source: "manuel" })));
  await Promise.all(biens.flatMap(l => (l.calendriers || []).filter(c => c.url).map(async c => {
    const r = await lireCalendrier(c.url).catch(() => ({ erreur: "inaccessible" }));
    if (r.erreur) { erreurs[c.url] = r.erreur; return; }
    // Airbnb : « Not available » = dates bloquées par l'hôte, pas un voyageur. Booking marque toutes ses réservations « CLOSED ».
    r.evenements.filter(e => !(c.source === "airbnb" && e.bloque)).forEach(e => sejours.push({ bienId: l.id, source: c.source, debut: e.debut, fin: e.fin }));
  })));
  return { sejours, erreurs };
}

export function ongletPro(p, biens) {
  const relies = biens.filter(l => (l.calendriers || []).some(c => c.url)).length;
  return `<div class="entete-pro carte">
      <div><span class="surtitre">Espace Pro · Conciergeries et multi-propriétaires</span>
        <h2 style="margin:6px 0 2px">${p.societe ? esc(p.societe) : tr("Votre activité de location")}</h2>
        <p class="petit" style="margin:0">Tous vos biens, vos calendriers Airbnb et Booking et les ménages à programmer, au même endroit.</p></div>
      <details class="societe"><summary>Ma société</summary>
        <form id="form-societe" novalidate style="margin-top:10px">
          <label class="champ">Raison sociale<input name="societe" maxlength="120" value="${esc(p.societe)}" autocomplete="organization"></label>
          <label class="champ">SIRET (14 chiffres) ou SIREN (9 chiffres)<input name="siret" inputmode="numeric" maxlength="17" value="${esc(p.siret_societe || "")}"></label>
          <p class="erreur" id="erreur-societe"></p><button class="bouton plein" type="submit">Enregistrer</button></form>
</details>
    </div>
    <div class="grille-raccourcis">
      <a class="carte raccourci" href="#/mes-demandes">${icone("calendrier", { tuile: true })}<b>Mes prestations</b><span class="petit">À venir et passées</span></a>
      <a class="carte raccourci" href="#/reserver/rental">${icone("location", { tuile: true })}<b>Ménage de location</b><span class="petit">Entre deux voyageurs</span></a>
      <a class="carte raccourci" href="#/reserver">${icone("instantane", { tuile: true })}<b>Nouvelle demande</b><span class="petit">Prix immédiat</span></a>
    </div>
    <div class="tuiles-chiffres" id="chiffres-pro">
      <div class="tuile-chiffre"><b>${biens.length}</b><span>Biens gérés</span></div>
      <div class="tuile-chiffre"><b>${relies}</b><span>Calendriers reliés</span></div>
      <div class="tuile-chiffre"><b data-chiffre="departs">…</b><span>Départs sur ${REGLES.AGENDA_HORIZON_JOURS} jours</span></div>
      <div class="tuile-chiffre alerte"><b data-chiffre="aprogrammer">…</b><span>Ménages à programmer</span></div>
    </div>
    <h2 class="titre-section">${icone("calendrier", { tuile: true })}Agenda des locations</h2>
    <p class="petit" style="margin-top:0">Les séjours de vos voyageurs, lus automatiquement dans vos calendriers Airbnb, Booking, Abritel… ou ajoutés à la main si vous n'utilisez pas de calendrier.</p>
    <div class="carte agenda-carte" id="agenda-pro">${chargeur("Lecture de vos calendriers…", { variante: "vitre" })}</div>
    <h2 class="titre-section">${icone("termine", { tuile: true })}Ménages à programmer</h2>
    <p class="petit" style="margin-top:0">Chaque départ des ${REGLES.AGENDA_HORIZON_JOURS} prochains jours sans ménage prévu.</p>
    <div id="a-programmer">${chargeur("Lecture de vos calendriers…", { petit: true, variante: "eponge" })}</div>
    <h2 class="titre-section">${icone("logement", { tuile: true })}Mon parc de biens</h2>
    <p class="petit" style="margin-top:0">Reliez le calendrier de chaque bien, ou ajoutez vos séjours à la main dans l'agenda : les départs de vos voyageurs y apparaissent.</p>
    ${biens.length > 1 ? `<div class="outils-biens"><input type="search" id="cherche-bien" placeholder="${esc(tr("Rechercher un bien, une rue, une ville…"))}" aria-label="Rechercher un bien">
      <select id="tri-biens" aria-label="Trier les biens"><option value="nom">Nom (A → Z)</option><option value="nom-inv">Nom (Z → A)</option><option value="ville">Ville</option><option value="depart">Prochain départ</option></select></div>` : ""}
    ${biens.length ? `<div class="carte-biens" id="carte-biens" role="img" aria-label="Carte de mes biens"></div>` : ""}
    <div id="liste-biens">${biens.length ? biens.slice().sort((a, b) => nomBien(a).localeCompare(nomBien(b), "fr", { sensitivity: "base", numeric: true })).map(l => {
      const cals = (l.calendriers || []).filter(c => c.url);
      return `<div class="carte bien-pro" data-bien="${esc(l.id)}" data-texte="${esc(`${nomBien(l)} ${l.rue} ${l.codePostal} ${l.ville}`.toLowerCase())}">
        <div class="ligne-compte" style="padding:0;box-shadow:none;border:0;background:none">${icone("logement", { tuile: true })}
          <div class="corps"><b>${esc(nomBien(l))}</b><div class="petit">${esc(l.rue)}, ${esc(l.codePostal)} ${esc(l.ville)}${l.surface ? `<span> · ${l.surface} m²</span>` : ""}${l.chambres != null ? `<span> · ${l.chambres} ch.</span>` : ""}</div>
          <div class="pastilles">${cals.length ? cals.map(c => `<span class="pastille ${c.source}" data-etat-cal="${esc(c.url)}">${SOURCES.find(s => s[0] === c.source)?.[1] || ""}</span>`).join("") : `<span class="pastille vide">Aucun calendrier relié</span>`}</div></div></div>
        <details><summary>${cals.length ? tr("Modifier le nom et les calendriers") : tr("Relier un calendrier")}</summary>
          <form data-form-cal="${esc(l.id)}" novalidate style="margin-top:10px">
            <label class="champ">Nom du bien<input name="nom" maxlength="60" value="${esc(l.nom)}" placeholder="${esc(tr("Ex. : Studio Vieux-Port"))}"></label>
            ${SOURCES.map(([id, nom]) => `<label class="champ">Lien du calendrier ${nom}<input name="${id}" type="url" inputmode="url" maxlength="600" placeholder="https://…ics" value="${esc((l.calendriers || []).find(c => c.source === id)?.url)}"></label>`).join("")}
            <p class="erreur" data-erreur-cal></p><button class="bouton plein" type="submit">Enregistrer</button></form></details></div>`;
    }).join("") : `<div class="vide-compte"><p class="muet">Aucun bien enregistré pour l'instant.</p><p class="petit">Ajoutez vos biens dans « Mes prestations » ou lors d'une réservation.</p></div>`}</div>
    <p class="petit" id="aucun-bien" hidden>Aucun bien ne correspond à votre recherche.</p>
    <div class="boutons"><a class="bouton secondaire" href="#/mes-demandes">＋ Ajouter un bien</a><a class="bouton secondaire" href="#/reserver/rental">Réserver un ménage de location</a></div>
    <details class="carte aide-ical"><summary>Où trouver le lien de mon calendrier ?</summary>
      <p><b>Airbnb</b> : Annonces › votre annonce › Disponibilités › Synchroniser les calendriers › Exporter le calendrier. Copiez le lien.</p>
      <p><b>Booking.com</b> : Extranet › Tarifs et disponibilités › Synchronisation des calendriers › Exporter le calendrier. Copiez le lien.</p>
      <p><b>Abritel / Vrbo</b> : Calendrier › Importer et exporter › Exporter. Copiez le lien.</p>
      <p class="petit">Le lien se termine souvent par « .ics ». Il ne donne accès qu'aux dates, jamais aux coordonnées de vos voyageurs.</p></details>`;
}

export function brancherPro(vue, p, biens, demandes, { majProfil, recharger }) {
  const fs = vue.querySelector("#form-societe");
  fs.onsubmit = async e => {
    e.preventDefault();
    const siret = fs.siret.value.replace(/\D/g, "");
    if (!fs.societe.value.trim() || !sirenSiretValide(siret)) { vue.querySelector("#erreur-societe").textContent = tr("Indiquez la raison sociale et un SIRET (14 chiffres) ou un SIREN (9 chiffres) valable."); return; }
    try { await majProfil({ societe: fs.societe.value.trim(), siret_societe: siret }); recharger(); }
    catch { vue.querySelector("#erreur-societe").textContent = tr("Le service est momentanément indisponible. Réessayez dans quelques minutes."); }
  };
  vue.querySelectorAll("[data-form-cal]").forEach(f => f.onsubmit = async e => {
    e.preventDefault();
    const l = biens.find(x => x.id === f.dataset.formCal), err = f.querySelector("[data-erreur-cal]");
    const calendriers = SOURCES.map(([id]) => ({ source: id, url: f[id].value.trim().replace(/^webcal:/i, "https:") })).filter(c => c.url);
    if (calendriers.some(c => !/^https:\/\/\S+$/.test(c.url))) { err.textContent = tr("Collez le lien complet du calendrier (il commence par https://)."); return; }
    err.textContent = tr("Vérification du calendrier…");
    for (const c of calendriers) {
      const r = await lireCalendrier(c.url, true).catch(() => ({ erreur: "inaccessible" }));
      if (r.erreur) { err.textContent = tr(r.erreur === "site" ? "Ce site de calendrier n'est pas encore accepté. Utilisez le lien Airbnb, Booking, Abritel ou Google."
        : r.erreur === "format" ? "Ce lien n'est pas un calendrier (.ics). Vérifiez que vous avez copié le lien d'export." : "Calendrier injoignable. Vérifiez le lien et réessayez."); return; }
    }
    try { await enregistrerBien({ ...l, nom: f.nom.value.trim(), calendriers }); recharger(); }
    catch { err.textContent = tr("Le service est momentanément indisponible. Réessayez dans quelques minutes."); }
  });
  remplirAgenda(vue, biens, demandes, recharger).then(prochains => trierBiens(vue, biens, prochains));
  carteDesBiens(vue.querySelector("#carte-biens"), biens);
  trierBiens(vue, biens, {});
}

/** Carte du parc : une épingle par bien, à la couleur de l'agenda (les adresses sont placées une fois, puis mémorisées). */
export async function carteDesBiens(boite, biens) {
  if (!boite) return;
  const ordre = biens.slice().sort((a, b) => nomBien(a).localeCompare(nomBien(b), "fr", { sensitivity: "base", numeric: true }));
  const marqueurs = [];
  for (const [i, l] of ordre.entries()) {
    const pos = Number.isFinite(l.lat) ? { lat: l.lat, lon: l.lon } : await coordonnees(l.rue, l.codePostal, l.ville);
    if (pos) marqueurs.push({ ...pos, couleur: couleurBien(i), titre: nomBien(l), popup: `<b>${esc(nomBien(l))}</b><br>${esc(l.rue)}, ${esc(l.codePostal)} ${esc(l.ville)}` });
  }
  if (!boite.isConnected) return;
  if (!marqueurs.length) { boite.remove(); return; }
  afficherCarte(boite, { marqueurs, zoom: 15 }).catch(() => boite.remove());
}

/** Recherche (nom, rue, ville) et tri des biens : nom A → Z par défaut, Z → A, ville ou prochain départ. */
function trierBiens(vue, biens, prochains) {
  const liste = vue.querySelector("#liste-biens"), cherche = vue.querySelector("#cherche-bien"), tri = vue.querySelector("#tri-biens");
  if (!liste || !cherche) return;
  const comparer = (a, b) => a.localeCompare(b, "fr", { sensitivity: "base", numeric: true });
  const appliquer = () => {
    const q = cherche.value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const cartes = [...liste.querySelectorAll("[data-bien]")];
    const cle = id => biens.find(x => x.id === id);
    cartes.sort((x, y) => {
      const a = cle(x.dataset.bien), b = cle(y.dataset.bien);
      if (tri.value === "nom-inv") return comparer(nomBien(b), nomBien(a));
      if (tri.value === "ville") return comparer(a.ville, b.ville) || comparer(nomBien(a), nomBien(b));
      if (tri.value === "depart") return (prochains[a.id] || "9999").localeCompare(prochains[b.id] || "9999") || comparer(nomBien(a), nomBien(b));
      return comparer(nomBien(a), nomBien(b));
    }).forEach(c => liste.appendChild(c));
    let visibles = 0;
    cartes.forEach(c => { const ok = !q || c.dataset.texte.normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(q); c.hidden = !ok; visibles += ok; });
    vue.querySelector("#aucun-bien").hidden = visibles > 0;
  };
  cherche.oninput = appliquer; tri.onchange = appliquer;
  appliquer();
}

async function remplirAgenda(vue, biens, demandes, recharger) {
  const { sejours, erreurs } = await sejoursDes(biens);
  if (!vue.querySelector("#agenda-pro")) return {};   // page quittée entre-temps
  // Calendriers injoignables : pastille rouge sur le bien.
  vue.querySelectorAll("[data-etat-cal]").forEach(s => { if (erreurs[s.dataset.etatCal]) { s.classList.add("ko"); s.title = tr("Calendrier injoignable"); } });
  const auj = new Date(); auj.setHours(0, 0, 0, 0);
  const fin = iso(plusJours(auj, REGLES.AGENDA_HORIZON_JOURS)), debut = iso(auj);
  const bienDe = id => biens.find(x => x.id === id);
  const menagePrevu = (bienId, jour) => {
    const l = bienDe(bienId);
    return demandes.some(d => d.statut !== "ANNULEE" && l && memeAdresse(d, l) && d.creneau && iso(new Date(d.creneau)) === jour);
  };
  // Même séjour lu sur deux calendriers (ou saisi aussi à la main) : gardé une seule fois.
  const uniques = sejours.filter((s, i, t) => t.findIndex(x => x.bienId === s.bienId && x.debut === s.debut && x.fin === s.fin) === i);
  const departs = uniques.filter(s => s.fin >= debut && s.fin <= fin).sort((a, b) => a.fin.localeCompare(b.fin));
  // Prochain départ de chaque bien (tri « Prochain départ »).
  const prochains = {};
  uniques.filter(s => s.fin >= debut).forEach(s => { if (!prochains[s.bienId] || s.fin < prochains[s.bienId]) prochains[s.bienId] = s.fin; });
  const rotation = s => uniques.some(x => x.bienId === s.bienId && x.debut === s.fin);
  const aProgrammer = departs.filter(s => !menagePrevu(s.bienId, s.fin))
    .filter((s, i, t) => t.findIndex(x => x.bienId === s.bienId && x.fin === s.fin) === i);
  vue.querySelector('[data-chiffre="departs"]').textContent = new Set(departs.map(s => s.bienId + s.fin)).size;
  vue.querySelector('[data-chiffre="aprogrammer"]').textContent = aProgrammer.length;
  const programmer = b => b.onclick = () => { preremplir({ bienId: b.dataset.programmer, jour: b.dataset.jour }); location.hash = "#/reserver/rental"; };

  const liste = vue.querySelector("#a-programmer");
  const aDesSejours = uniques.length > 0 || biens.some(l => (l.calendriers || []).some(c => c.url));
  liste.innerHTML = aProgrammer.length ? aProgrammer.map(s => {
    const l = bienDe(s.bienId);
    return `<div class="carte ligne-compte">${icone("location", { tuile: true })}
      <div class="corps"><div class="haut"><h3>${esc(nomBien(l))}</h3>${rotation(s) ? `<span class="tampon">Rotation le jour même</span>` : ""}</div>
      <p class="muet">Départ le ${dateLongue(jourDe(s.fin))}</p></div>
      <button type="button" class="bouton" data-programmer="${esc(s.bienId)}" data-jour="${s.fin}">Programmer le ménage</button></div>`;
  }).join("") : `<div class="vide-compte"><p class="muet">${tr(aDesSejours ? "Tous les départs à venir ont leur ménage." : "Reliez un calendrier ou ajoutez vos séjours à la main pour voir les départs ici.")}</p></div>`;
  liste.querySelectorAll("[data-programmer]").forEach(programmer);
  traduire(liste);

  // Couleur de chaque bien : rang dans l'ordre alphabétique (la même dans l'appli).
  const ordre = biens.slice().sort((a, b) => nomBien(a).localeCompare(nomBien(b), "fr", { sensitivity: "base", numeric: true }));
  const couleur = id => couleurBien(ordre.findIndex(l => l.id === id));
  const menagesDu = j => biens.filter(l => (!filtreBien || l.id === filtreBien) && demandes.some(x => x.statut !== "ANNULEE" && memeAdresse(x, l) && x.creneau && iso(new Date(x.creneau)) === j));
  const nomSource = s => s.source === "manuel" ? tr("Saisi à la main") : (SOURCES.find(x => x[0] === s.source)?.[1] || tr("Calendrier"));
  const qui = s => [s.voyageur, s.personnes ? `${s.personnes} ${tr(s.personnes > 1 ? "personnes" : "personne")}` : ""].filter(Boolean).join(" · ");
  const duree = s => `${nuits(s)} ${tr(nuits(s) > 1 ? "nuits" : "nuit")}`;

  moisAffiche = moisAffiche || new Date(auj.getFullYear(), auj.getMonth(), 1);
  let edition = null;   // séjour saisi en cours d'ajout ou de modification

  /** Une ligne d'événement (arrivée, départ, séjour en cours, ménage) dans le détail d'un jour ou la liste. */
  const ligne = (type, s, l) => {
    const libelle = { arrivee: "Arrivée", depart: "Départ", encours: "Séjour en cours", menage: "Ménage prévu" }[type];
    const sansMenage = type === "depart" && !menagePrevu(s.bienId, s.fin);
    return `<div class="evt evt-${type}" style="--c:${couleur(l.id)}">
      <span class="evt-pastille" aria-hidden="true"></span>
      <div class="evt-corps"><div class="evt-haut"><b>${libelle}</b><span class="evt-bien">${esc(nomBien(l))}</span></div>
        ${s ? `<div class="petit muet">${qui(s) ? `<span>${esc(qui(s))}</span> · ` : ""}<span>${duree(s)}</span> · <span>${nomSource(s)}</span>${s.note ? ` · <span>${esc(s.note)}</span>` : ""}</div>` : ""}
        ${type === "depart" && rotation(s) ? `<span class="tampon">Rotation le jour même</span>` : ""}</div>
      <div class="evt-actions">${s && s.source === "manuel" ? `<button type="button" class="lien-bouton" data-modifier="${esc(s.id)}">Modifier</button>` : ""}
        ${sansMenage ? `<button type="button" class="bouton petit" data-programmer="${esc(s.bienId)}" data-jour="${s.fin}">Programmer le ménage</button>` : ""}</div></div>`;
  };
  const evenementsDu = (j, sel, avecEnCours) => {
    const r = [];
    sel.filter(s => s.fin === j).forEach(s => r.push(ligne("depart", s, bienDe(s.bienId))));
    sel.filter(s => s.debut === j).forEach(s => r.push(ligne("arrivee", s, bienDe(s.bienId))));
    if (avecEnCours) sel.filter(s => s.debut < j && j < s.fin).forEach(s => r.push(ligne("encours", s, bienDe(s.bienId))));
    menagesDu(j).forEach(l => r.push(ligne("menage", null, l)));
    return r;
  };

  const formulaire = () => {
    const s = edition;
    return `<form id="form-sejour" class="form-sejour" novalidate>
      <h3 style="margin:0 0 8px">${s.id ? tr("Modifier le séjour") : tr("Ajouter un séjour")}</h3>
      ${biens.length > 1 ? `<label class="champ">Bien<select name="bien">${ordre.map(l => `<option value="${esc(l.id)}" ${l.id === s.bienId ? "selected" : ""}>${esc(nomBien(l))}</option>`).join("")}</select></label>` : ""}
      <div class="deux-champs"><label class="champ">Arrivée<input type="date" name="debut" required value="${esc(s.debut)}"></label>
        <label class="champ">Départ<input type="date" name="fin" required value="${esc(s.fin)}"></label></div>
      <div class="deux-champs"><label class="champ">Voyageur (facultatif)<input name="voyageur" maxlength="60" value="${esc(s.voyageur)}" autocomplete="off"></label>
        <label class="champ">Personnes<input type="number" name="personnes" min="1" max="30" inputmode="numeric" value="${esc(s.personnes || "")}"></label></div>
      <label class="champ">Note (facultatif)<input name="note" maxlength="120" value="${esc(s.note)}" placeholder="${esc(tr("Ex. : arrivée tardive, lit bébé…"))}"></label>
      <p class="erreur" id="erreur-sejour"></p>
      <div class="boutons"><button class="bouton plein" type="submit">Enregistrer</button><button class="bouton secondaire" type="button" data-annuler>Annuler</button>
        ${s.id ? `<button class="bouton danger" type="button" data-supprimer>Supprimer</button>` : ""}</div></form>`;
  };

  const enregistrerSejours = async (bienId, sejoursDuBien) => {
    const l = bienDe(bienId);
    await enregistrerBien({ ...l, sejours: sejoursGardes(sejoursDuBien, debut) });
    recharger();
  };

  const brancherFormulaire = boite => {
    const f = boite.querySelector("#form-sejour");
    if (!f) return;
    const err = f.querySelector("#erreur-sejour");
    f.querySelector("[data-annuler]").onclick = () => { edition = null; dessiner(); };
    f.querySelector("[data-supprimer]")?.addEventListener("click", async () => {
      if (!confirm(tr("Supprimer ce séjour ?"))) return;
      const l = bienDe(edition.bienId);
      try { await enregistrerSejours(l.id, (l.sejours || []).filter(x => x.id !== edition.id)); }
      catch { err.textContent = tr("Le service est momentanément indisponible. Réessayez dans quelques minutes."); }
    });
    f.debut.onchange = () => { if (f.debut.value && (!f.fin.value || f.fin.value <= f.debut.value)) f.fin.value = iso(plusJours(jourDe(f.debut.value), 1)); };
    f.onsubmit = async e => {
      e.preventDefault();
      const bienId = f.bien ? f.bien.value : biens[0].id;
      const s = { id: edition.id || `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, debut: f.debut.value, fin: f.fin.value,
        voyageur: f.voyageur.value.trim(), personnes: Number(f.personnes.value) || null, note: f.note.value.trim() };
      const autres = uniques.filter(x => x.bienId === bienId && !(x.source === "manuel" && x.id === s.id));
      const m = erreurSejour(s, autres);
      if (m) { err.textContent = tr(m); return; }
      const l = bienDe(bienId);
      // Changement de bien : le séjour quitte l'ancien bien.
      const ancien = edition.id && edition.bienId !== bienId ? bienDe(edition.bienId) : null;
      err.textContent = tr("Enregistrement…");
      try {
        if (ancien) await enregistrerBien({ ...ancien, sejours: (ancien.sejours || []).filter(x => x.id !== s.id) });
        await enregistrerSejours(bienId, [...(l.sejours || []).filter(x => x.id !== s.id), s]);
        jourChoisi = s.debut;
      } catch { err.textContent = tr("Le service est momentanément indisponible. Réessayez dans quelques minutes."); }
    };
    f.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const exporter = sel => {
    const evts = sel.map(s => {
      const l = bienDe(s.bienId);
      return { uid: `${s.bienId}-${s.debut}-${s.fin}`, debut: s.debut, fin: s.fin, titre: `${nomBien(l)} · ${qui(s) || tr("Séjour")}`,
        lieu: `${l.rue}, ${l.codePostal} ${l.ville}`, note: [nomSource(s), s.note].filter(Boolean).join(" · ") };
    });
    demandes.filter(d => d.statut !== "ANNULEE" && d.creneau).forEach(d => {
      const l = biens.find(x => memeAdresse(d, x) && (!filtreBien || x.id === filtreBien));
      if (!l) return;
      const j = iso(new Date(d.creneau));
      evts.push({ uid: `menage-${d.reference}`, debut: j, fin: iso(plusJours(jourDe(j), 1)), titre: `${tr("Ménage Cleaneroo")} · ${nomBien(l)}`, lieu: `${l.rue}, ${l.codePostal} ${l.ville}`, note: d.reference });
    });
    const url = URL.createObjectURL(new Blob([versIcs(evts, new Date())], { type: "text/calendar" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "cleaneroo-agenda.ics" });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const dessiner = () => {
    const boite = vue.querySelector("#agenda-pro");
    if (!boite) return;
    const sel = filtreBien ? uniques.filter(s => s.bienId === filtreBien) : uniques;
    const premier = new Date(moisAffiche), decal = (premier.getDay() + 6) % 7;
    const nbJours = new Date(premier.getFullYear(), premier.getMonth() + 1, 0).getDate();
    const nomMois = premier.toLocaleDateString(LOCALE, { month: "long", year: "numeric" });
    const jours = [...Array(7)].map((_, i) => plusJours(new Date(2024, 0, 1), i).toLocaleDateString(LOCALE, { weekday: "short" }).replace(".", ""));
    const ranges = voies(sel);
    let corps = "";
    if (vueAgenda === "mois") {
      let cases = "";
      for (let i = 0; i < decal; i++) cases += `<div class="jour hors" aria-hidden="true"></div>`;
      for (let j = 1; j <= nbJours; j++) {
        const d = iso(new Date(premier.getFullYear(), premier.getMonth(), j));
        const ici = ranges.map(s => ({ s, m: morceau(s, d) })).filter(x => x.m);
        const visibles = ici.filter(x => x.s.voie < REGLES.AGENDA_VOIES_MAX), caches = ici.length - visibles.length;
        const menages = menagesDu(d).length;
        const dep = sel.filter(s => s.fin === d).length, arr = sel.filter(s => s.debut === d).length;
        const resume = [dep && `${dep} ${tr("Départ")}`, arr && `${arr} ${tr("Arrivée")}`, menages && tr("Ménage prévu")].filter(Boolean).join(", ");
        cases += `<button type="button" class="jour${d === debut ? " aujourdhui" : ""}${d === jourChoisi ? " choisi" : ""}${d < debut ? " passe" : ""}" data-jour="${d}" aria-label="${esc(dateLongue(jourDe(d)))}${resume ? ` · ${esc(resume)}` : ""}">
          <span class="num">${j}</span>
          ${visibles.map(({ s, m }) => `<i class="barre ${m}" style="--c:${couleur(s.bienId)};--v:${s.voie}" title="${esc(nomBien(bienDe(s.bienId)))}"></i>`).join("")}
          <span class="badges">${menages ? `<i class="b-menage" title="${esc(tr("Ménage prévu"))}">${icone("termine")}</i>` : ""}${caches > 0 ? `<i class="b-plus">+${caches}</i>` : ""}</span></button>`;
      }
      const sj = jourChoisi && jourChoisi.slice(0, 7) === iso(premier).slice(0, 7) ? jourChoisi : null;
      const detail = sj ? evenementsDu(sj, sel, true) : [];
      corps = `<div class="agenda-grille" role="grid">${jours.map(j => `<div class="jour-sem">${j}</div>`).join("")}${cases}</div>
        <div class="agenda-legende petit">${(filtreBien ? ordre.filter(l => l.id === filtreBien) : ordre).slice(0, 8).map(l => `<span><i class="barre-leg" style="--c:${couleur(l.id)}"></i>${esc(nomBien(l))}</span>`).join("")}
          <span><i class="b-menage">${icone("termine")}</i>Ménage prévu</span></div>
        ${sj ? `<div class="agenda-detail"><div class="agenda-detail-haut"><b>${dateLongue(jourDe(sj))}</b>
            ${biens.length ? `<button type="button" class="lien-bouton" data-ajout="${sj}">＋ Ajouter un séjour</button>` : ""}</div>
          ${detail.length ? detail.join("") : `<p class="muet petit" style="margin:4px 0 0">Rien de prévu ce jour.</p>`}</div>`
        : `<p class="petit muet" style="margin:10px 0 0">Touchez un jour pour voir le détail.</p>`}`;
    } else {
      const jusqua = iso(plusJours(auj, REGLES.AGENDA_LISTE_JOURS));
      const parJour = [];
      for (let d = debut; d <= jusqua; d = iso(plusJours(jourDe(d), 1))) {
        const e = evenementsDu(d, sel, false);
        if (e.length) parJour.push(`<div class="liste-jour"><div class="liste-date"><b>${jourDe(d).getDate()}</b><span>${jourDe(d).toLocaleDateString(LOCALE, { month: "short" }).replace(".", "")}</span><i>${jourDe(d).toLocaleDateString(LOCALE, { weekday: "short" }).replace(".", "")}</i></div><div class="liste-evts">${e.join("")}</div></div>`);
      }
      corps = parJour.length ? parJour.join("") : `<div class="vide-compte"><p class="muet">${tr(`Aucun séjour ni ménage dans les ${REGLES.AGENDA_LISTE_JOURS} prochains jours.`)}</p></div>`;
    }
    boite.innerHTML = `<div class="agenda-haut">
        <div class="agenda-nav">${vueAgenda === "mois" ? `<button type="button" class="agenda-fleche" data-mois="-1" aria-label="Mois précédent">‹</button><b class="agenda-mois">${nomMois}</b><button type="button" class="agenda-fleche" data-mois="1" aria-label="Mois suivant">›</button>
          <button type="button" class="puce-agenda" data-auj>Aujourd'hui</button>` : `<b class="agenda-titre-liste">${tr(`Les ${REGLES.AGENDA_LISTE_JOURS} prochains jours`)}</b>`}</div>
        <div class="agenda-vues" role="tablist" aria-label="Affichage"><button type="button" role="tab" data-vue="mois" aria-selected="${vueAgenda === "mois"}">Mois</button><button type="button" role="tab" data-vue="liste" aria-selected="${vueAgenda === "liste"}">Liste</button></div></div>
      <div class="agenda-outils">${biens.length > 1 ? `<select id="filtre-bien" aria-label="Bien affiché"><option value="">Tous les biens</option>${ordre.map(l => `<option value="${esc(l.id)}" ${l.id === filtreBien ? "selected" : ""}>${esc(nomBien(l))}</option>`).join("")}</select>` : ""}
        ${biens.length ? `<button type="button" class="bouton petit" data-ajout="">＋ Ajouter un séjour</button>` : ""}
        ${sel.length ? `<button type="button" class="bouton secondaire petit" data-export>${icone("calendrier")}Exporter vers mon agenda</button>` : ""}</div>
      ${edition ? formulaire() : ""}
      ${corps}
      ${Object.keys(erreurs).length ? `<p class="erreur petit" style="margin:8px 0 0">${tr("Un calendrier est injoignable : vérifiez son lien dans « Mon parc de biens ».")}</p>` : ""}
      ${!biens.length ? `<p class="petit" style="margin:8px 0 0">${tr("Ajoutez d'abord un bien pour remplir votre agenda.")}</p>`
        : !aDesSejours ? `<p class="petit" style="margin:8px 0 0">${tr("Pas de calendrier Airbnb ou Booking ? Ajoutez vos séjours à la main avec « ＋ Ajouter un séjour » : ils comptent comme les autres.")}</p>` : ""}
      ${sel.length ? `<p class="petit muet" style="margin:8px 0 0">${tr("« Exporter vers mon agenda » crée un fichier .ics à ouvrir avec Google Agenda, le calendrier de l'iPhone ou Outlook.")}</p>` : ""}`;
    traduire(boite);
    boite.querySelectorAll("[data-mois]").forEach(b => b.onclick = () => { moisAffiche = new Date(moisAffiche.getFullYear(), moisAffiche.getMonth() + Number(b.dataset.mois), 1); dessiner(); });
    boite.querySelector("[data-auj]")?.addEventListener("click", () => { moisAffiche = new Date(auj.getFullYear(), auj.getMonth(), 1); jourChoisi = debut; dessiner(); });
    boite.querySelectorAll("[data-vue]").forEach(b => b.onclick = () => { vueAgenda = b.dataset.vue; dessiner(); });
    boite.querySelectorAll(".agenda-grille [data-jour]").forEach(b => b.onclick = () => { jourChoisi = jourChoisi === b.dataset.jour ? null : b.dataset.jour; dessiner(); });
    boite.querySelector("#filtre-bien")?.addEventListener("change", e => { filtreBien = e.target.value; dessiner(); });
    boite.querySelectorAll("[data-ajout]").forEach(b => b.onclick = () => {
      const d = b.dataset.ajout || (jourChoisi && jourChoisi >= debut ? jourChoisi : debut);
      edition = { bienId: filtreBien || ordre[0].id, debut: d, fin: iso(plusJours(jourDe(d), 1)) };
      dessiner();
    });
    boite.querySelectorAll("[data-modifier]").forEach(b => b.onclick = () => {
      const s = uniques.find(x => x.source === "manuel" && x.id === b.dataset.modifier);
      edition = { ...s }; dessiner();
    });
    boite.querySelector("[data-export]")?.addEventListener("click", () => exporter(sel));
    boite.querySelectorAll("[data-programmer]").forEach(programmer);
    brancherFormulaire(boite);
  };
  dessiner();
  return prochains;
}

/* ------------------------------------------------------------------ Cleaneur : se concentrer sur ses missions */

/** Étapes pour être prêt le jour de l'ouverture : [libellé, fait]. */
export function preparationCleaneur(p, docs) {
  const docOk = t => docs.some(x => x.type === t && x.statut !== "REFUSE");
  return [
    ["Profil complet (téléphone, code postal, ville)", !!(p.telephone && p.code_postal && p.ville)],
    ["Numéro SIRET renseigné", (p.siret || "").length === 14],
    ["Prestations proposées choisies", (p.prestations || []).length > 0],
    [`${DOCUMENTS_CLEANEUR.filter(d => d.obligatoire).length} documents obligatoires ajoutés`, DOCUMENTS_CLEANEUR.filter(d => d.obligatoire).every(d => docOk(d.type))],
    ["Dossier envoyé", ["A_VERIFIER", "VALIDE"].includes(p.dossier)],
    ["Dossier validé par Cleaneroo", p.dossier === "VALIDE"],
  ];
}

export function ongletCleaneur(p, docs, { dossier, profil }) {
  if (p.role === "client") return `<div class="carte mise-en-avant"><span class="surtitre">Espace Cleaneur</span>
      <h2 style="margin:6px 0 4px">Devenez Cleaneur en auto-entrepreneur</h2>
      <p class="muet" style="margin:0 0 6px">Missions près de chez vous, à votre rythme, déroulé guidé et paiement sécurisé.</p>
      <ul class="petit" style="margin:0 0 10px;padding-left:18px"><li>Statut d'auto-entrepreneur (micro-entreprise) avec un numéro SIRET</li>
        <li>Assurance responsabilité civile professionnelle et attestation URSSAF</li>
        <li>Vous gardez vos autres espaces : vos missions restent séparées de vos réservations privées.</li></ul>
      <button type="button" class="bouton" id="devenir-cleaneur">Ajouter l'espace Cleaneur</button></div>`;
  const etapes = preparationCleaneur(p, docs), faites = etapes.filter(e => e[1]).length;
  const admin = p.role === "admin";
  return `${admin ? `<p style="margin:0 0 10px"><span class="tampon">Accès administrateur</span></p>` : ""}
    <div id="missions-cleaneur">${chargeur("Chargement de vos missions…")}</div>
    ${admin ? "" : `<h2 class="titre-section">${icone("valide", { tuile: true })}Ma préparation <span class="tampon${faites === etapes.length ? " vert" : ""}" style="margin:0 0 0 auto">${faites}/${etapes.length}</span></h2>
    <div class="carte"><div class="jauge" role="progressbar" aria-valuemin="0" aria-valuemax="${etapes.length}" aria-valuenow="${faites}"><span style="width:${Math.round(faites / etapes.length * 100)}%"></span></div>
      <ul class="liste-preparation">${etapes.map(([t, ok]) => `<li class="${ok ? "fait" : ""}"><span class="coche" aria-hidden="true">${ok ? "✓" : ""}</span><span>${t}</span></li>`).join("")}</ul></div>`}
    <h2 class="titre-section">${icone("paiement", { tuile: true })}Ma formule</h2>
    ${blocFormulesCleaneur(p)}
    <h2 class="titre-section">${icone("termine", { tuile: true })}Le déroulé d'une mission</h2>
    <ol class="deroule-mission">
      <li><b>J'accepte la mission</b><span class="petit">Adresse, horaires, tâches et prix sont connus avant d'accepter.</span></li>
      <li><b>Je suis en route</b><span class="petit">Le client est prévenu automatiquement.</span></li>
      <li><b>Je suis sur place</b><span class="petit">Arrivée confirmée par géolocalisation, photos d'état des lieux.</span></li>
      <li><b>Je coche mes tâches</b><span class="petit">Pièce par pièce : photo avant, tâches, photo après, contrôle par IA.</span></li>
      <li><b>Mission terminée</b><span class="petit">Le client valide, le paiement est versé.</span></li>
    </ol>
    ${admin ? `<details class="carte"><summary>Essayer le dépôt de documents (comme un Cleaneur)</summary><div style="margin-top:12px">${dossier}</div></details>`
      : `<details class="carte" ${p.dossier === "VALIDE" ? "" : "open"}><summary>Mon dossier Cleaneur</summary><div style="margin-top:12px">${dossier}</div></details>`}
    <details class="carte"><summary>Mon profil et mon périmètre</summary>${profil}</details>`;
}
