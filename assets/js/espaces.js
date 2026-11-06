// Espaces du compte : onglets « Particulier », « Pro » (conciergeries et multi-biens, agenda iCal) et « Cleaneur » (missions).
// Mêmes écrans que l'application (EspacesCompte.kt). Les valeurs métier sont dans regles.js.
import { TYPES_LOGEMENT, rubrique } from "./catalogue.js";
import { REGLES, euros, dateLongue } from "./regles.js";
import { icone } from "./icones.js";
import { traduire, tr, LOCALE } from "./langue.js";
import { DOCUMENTS_CLEANEUR, enregistrerBien, lireCalendrier } from "./donnees.js";
import { preremplir } from "./reserver.js";
export { brancherMissions, demanderGeoloc } from "./missions.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const ONGLETS = [["particulier", "Particulier", "logement"], ["pro", "Pro", "bureaux"], ["cleaneur", "Cleaneur", "cleaneurs"]];

/** Onglet ouvert par défaut : Cleaneur pour un Cleaneur, Pro pour une société ou à partir de 3 biens, sinon Particulier. */
export function ongletParDefaut(p, biens) {
  if (p.role === "cleaneur") return "cleaneur";
  if (p.societe || biens.length >= REGLES.SEUIL_ESPACE_PRO_BIENS) return "pro";
  return "particulier";
}

export function barreOnglets(actif) {
  return `<nav class="onglets-compte" aria-label="Mes espaces">${ONGLETS.map(([id, nom, ico]) =>
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
    ${p.role === "client" ? `<a class="carte ligne-compte" href="#/compte/cleaneur">${icone("cleaneurs", { tuile: true })}
      <div class="corps"><b>Vous êtes auto-entrepreneur ?</b><p class="petit" style="margin:2px 0 0">Devenez Cleaneur : missions près de chez vous, à votre rythme.</p></div><span class="aller" aria-hidden="true">›</span></a>` : ""}`;
}

/* ------------------------------------------------------------------ Pro : conciergeries et multi-propriétaires */

const SOURCES = [["airbnb", "Airbnb"], ["booking", "Booking.com"], ["autre", "Autre calendrier"]];
let moisAffiche = null;      // premier jour du mois de l'agenda
let filtreBien = "";         // agenda : un seul bien ou tous

/** Lit les calendriers de tous les biens : séjours [{ bienId, source, debut, fin }] et erreurs par lien. */
async function sejoursDes(biens) {
  const sejours = [], erreurs = {};
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
          <label class="champ">Numéro SIRET (14 chiffres)<input name="siret" inputmode="numeric" maxlength="17" value="${esc(p.siret)}"></label>
          <p class="erreur" id="erreur-societe"></p><button class="bouton plein" type="submit">Enregistrer</button></form></details>
    </div>
    <div class="tuiles-chiffres" id="chiffres-pro">
      <div class="tuile-chiffre"><b>${biens.length}</b><span>Biens gérés</span></div>
      <div class="tuile-chiffre"><b>${relies}</b><span>Calendriers reliés</span></div>
      <div class="tuile-chiffre"><b data-chiffre="departs">…</b><span>Départs sur ${REGLES.AGENDA_HORIZON_JOURS} jours</span></div>
      <div class="tuile-chiffre alerte"><b data-chiffre="aprogrammer">…</b><span>Ménages à programmer</span></div>
    </div>
    <h2 class="titre-section">${icone("calendrier", { tuile: true })}Agenda des locations</h2>
    <p class="petit" style="margin-top:0">Les arrivées et départs de vos voyageurs, lus automatiquement dans vos calendriers Airbnb, Booking, Abritel…</p>
    <div class="carte" id="agenda-pro"><p class="muet">Lecture de vos calendriers…</p></div>
    <h2 class="titre-section">${icone("termine", { tuile: true })}Ménages à programmer</h2>
    <p class="petit" style="margin-top:0">Chaque départ des ${REGLES.AGENDA_HORIZON_JOURS} prochains jours sans ménage prévu.</p>
    <div id="a-programmer"><div class="vide-compte"><p class="muet">Lecture de vos calendriers…</p></div></div>
    <h2 class="titre-section">${icone("logement", { tuile: true })}Mon parc de biens</h2>
    <p class="petit" style="margin-top:0">Reliez le calendrier de chaque bien : les départs de vos voyageurs apparaissent dans l'agenda.</p>
    ${biens.length > 1 ? `<div class="outils-biens"><input type="search" id="cherche-bien" placeholder="${esc(tr("Rechercher un bien, une rue, une ville…"))}" aria-label="Rechercher un bien">
      <select id="tri-biens" aria-label="Trier les biens"><option value="nom">Nom (A → Z)</option><option value="nom-inv">Nom (Z → A)</option><option value="ville">Ville</option><option value="depart">Prochain départ</option></select></div>` : ""}
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
    if (siret && siret.length !== 14) { vue.querySelector("#erreur-societe").textContent = tr("Le numéro SIRET compte 14 chiffres."); return; }
    try { await majProfil({ societe: fs.societe.value.trim(), siret }); recharger(); }
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
  remplirAgenda(vue, biens, demandes).then(prochains => trierBiens(vue, biens, prochains));
  trierBiens(vue, biens, {});
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

async function remplirAgenda(vue, biens, demandes) {
  const { sejours, erreurs } = await sejoursDes(biens);
  if (!vue.querySelector("#agenda-pro")) return {};   // page quittée entre-temps
  // Calendriers injoignables : pastille rouge sur le bien.
  vue.querySelectorAll("[data-etat-cal]").forEach(s => { if (erreurs[s.dataset.etatCal]) { s.classList.add("ko"); s.title = tr("Calendrier injoignable"); } });
  const auj = new Date(); auj.setHours(0, 0, 0, 0);
  const fin = iso(plusJours(auj, REGLES.AGENDA_HORIZON_JOURS)), debut = iso(auj);
  const menagePrevu = (bienId, jour) => {
    const l = biens.find(x => x.id === bienId);
    return demandes.some(d => d.statut !== "ANNULEE" && l && memeAdresse(d, l) && d.creneau && iso(new Date(d.creneau)) === jour);
  };
  const departs = sejours.filter(s => s.fin >= debut && s.fin <= fin).sort((a, b) => a.fin.localeCompare(b.fin));
  // Prochain départ de chaque bien (tri « Prochain départ »).
  const prochains = {};
  sejours.filter(s => s.fin >= debut).forEach(s => { if (!prochains[s.bienId] || s.fin < prochains[s.bienId]) prochains[s.bienId] = s.fin; });
  const rotation = s => sejours.some(x => x.bienId === s.bienId && x.debut === s.fin);
  const aProgrammer = departs.filter(s => !menagePrevu(s.bienId, s.fin))
    .filter((s, i, t) => t.findIndex(x => x.bienId === s.bienId && x.fin === s.fin) === i);   // même départ sur deux calendriers
  vue.querySelector('[data-chiffre="departs"]').textContent = new Set(departs.map(s => s.bienId + s.fin)).size;
  vue.querySelector('[data-chiffre="aprogrammer"]').textContent = aProgrammer.length;

  const liste = vue.querySelector("#a-programmer");
  const relies = biens.some(l => (l.calendriers || []).some(c => c.url));
  liste.innerHTML = aProgrammer.length ? aProgrammer.map(s => {
    const l = biens.find(x => x.id === s.bienId);
    return `<div class="carte ligne-compte">${icone("location", { tuile: true })}
      <div class="corps"><div class="haut"><h3>${esc(nomBien(l))}</h3>${rotation(s) ? `<span class="tampon">Rotation le jour même</span>` : ""}</div>
      <p class="muet">Départ le ${dateLongue(jourDe(s.fin))}</p></div>
      <button type="button" class="bouton" data-programmer="${esc(s.bienId)}" data-jour="${s.fin}">Programmer le ménage</button></div>`;
  }).join("") : `<div class="vide-compte"><p class="muet">${tr(relies ? "Tous les départs à venir ont leur ménage." : "Reliez un calendrier à vos biens pour voir les départs ici.")}</p></div>`;
  liste.querySelectorAll("[data-programmer]").forEach(b => b.onclick = () => {
    preremplir({ bienId: b.dataset.programmer, jour: b.dataset.jour });
    location.hash = "#/reserver/rental";
  });
  traduire(liste);

  moisAffiche = moisAffiche || new Date(auj.getFullYear(), auj.getMonth(), 1);
  const dessiner = () => {
    const boite = vue.querySelector("#agenda-pro");
    if (!boite) return;
    const sel = filtreBien ? sejours.filter(s => s.bienId === filtreBien) : sejours;
    const premier = new Date(moisAffiche), decal = (premier.getDay() + 6) % 7;
    const nbJours = new Date(premier.getFullYear(), premier.getMonth() + 1, 0).getDate();
    const nomMois = premier.toLocaleDateString(LOCALE, { month: "long", year: "numeric" });
    const jours = [...Array(7)].map((_, i) => plusJours(new Date(2024, 0, 1), i).toLocaleDateString(LOCALE, { weekday: "narrow" }));
    let cases = "";
    for (let i = 0; i < decal; i++) cases += `<div class="jour hors"></div>`;
    for (let j = 1; j <= nbJours; j++) {
      const d = iso(new Date(premier.getFullYear(), premier.getMonth(), j));
      const occupe = sel.some(s => s.debut <= d && d < s.fin);
      const dep = sel.filter(s => s.fin === d), arr = sel.filter(s => s.debut === d);
      const menage = biens.some(l => (!filtreBien || l.id === filtreBien) && demandes.some(x => x.statut !== "ANNULEE" && memeAdresse(x, l) && x.creneau && iso(new Date(x.creneau)) === d));
      cases += `<div class="jour${occupe ? " occupe" : ""}${d === debut ? " aujourdhui" : ""}">
        <span class="num">${j}</span><span class="marques">${dep.length ? `<i class="m-depart">${dep.length > 1 ? dep.length : ""}</i>` : ""}${arr.length ? `<i class="m-arrivee">${arr.length > 1 ? arr.length : ""}</i>` : ""}${menage ? `<i class="m-menage"></i>` : ""}</span></div>`;
    }
    boite.innerHTML = `<div class="agenda-haut">
        <button type="button" class="lien-bouton" data-mois="-1" aria-label="Mois précédent">‹</button><b class="agenda-mois">${nomMois}</b><button type="button" class="lien-bouton" data-mois="1" aria-label="Mois suivant">›</button>
        ${biens.length > 1 ? `<select id="filtre-bien" aria-label="Bien affiché"><option value="">Tous les biens</option>${biens.map(l => `<option value="${esc(l.id)}" ${l.id === filtreBien ? "selected" : ""}>${esc(nomBien(l))}</option>`).join("")}</select>` : ""}</div>
      <div class="agenda-grille">${jours.map(j => `<div class="jour-sem">${j}</div>`).join("")}${cases}</div>
      <div class="agenda-legende petit"><span><i class="m-depart"></i>Départ</span><span><i class="m-arrivee"></i>Arrivée</span><span><i class="m-menage"></i>Ménage prévu</span><span><i class="occupe"></i>Logement occupé</span></div>
      ${Object.keys(erreurs).length ? `<p class="erreur petit" style="margin:8px 0 0">${tr("Un calendrier est injoignable : vérifiez son lien dans « Mon parc de biens ».")}</p>` : ""}
      ${!relies ? `<p class="petit" style="margin:8px 0 0">${tr("Aucun calendrier relié : ajoutez le lien Airbnb ou Booking de vos biens ci-dessous.")}</p>` : ""}`;
    traduire(boite);
    boite.querySelectorAll("[data-mois]").forEach(b => b.onclick = () => { moisAffiche = new Date(moisAffiche.getFullYear(), moisAffiche.getMonth() + Number(b.dataset.mois), 1); dessiner(); });
    boite.querySelector("#filtre-bien")?.addEventListener("change", e => { filtreBien = e.target.value; dessiner(); });
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
        <li>Votre compte devient un compte Cleaneur : il ne sert plus à réserver des ménages.</li></ul>
      <button type="button" class="bouton" id="devenir-cleaneur">Devenir Cleaneur avec ce compte</button></div>`;
  const etapes = preparationCleaneur(p, docs), faites = etapes.filter(e => e[1]).length;
  const admin = p.role === "admin";
  return `${admin ? `<p style="margin:0 0 10px"><span class="tampon">Accès administrateur</span></p>` : ""}
    <div id="missions-cleaneur"><div class="vide-compte"><p class="muet">Chargement…</p></div></div>
    ${admin ? "" : `<h2 class="titre-section">${icone("valide", { tuile: true })}Ma préparation <span class="tampon${faites === etapes.length ? " vert" : ""}" style="margin:0 0 0 auto">${faites}/${etapes.length}</span></h2>
    <div class="carte"><div class="jauge" role="progressbar" aria-valuemin="0" aria-valuemax="${etapes.length}" aria-valuenow="${faites}"><span style="width:${Math.round(faites / etapes.length * 100)}%"></span></div>
      <ul class="liste-preparation">${etapes.map(([t, ok]) => `<li class="${ok ? "fait" : ""}"><span class="coche" aria-hidden="true">${ok ? "✓" : ""}</span><span>${t}</span></li>`).join("")}</ul></div>`}
    <h2 class="titre-section">${icone("termine", { tuile: true })}Le déroulé d'une mission</h2>
    <ol class="deroule-mission">
      <li><b>J'accepte la mission</b><span class="petit">Adresse, horaires, tâches et prix sont connus avant d'accepter.</span></li>
      <li><b>Je suis en route</b><span class="petit">Le client est prévenu automatiquement.</span></li>
      <li><b>Je suis sur place</b><span class="petit">Arrivée confirmée par géolocalisation, photos d'état des lieux.</span></li>
      <li><b>Je coche mes tâches</b><span class="petit">Pièce par pièce, avec les photos de fin.</span></li>
      <li><b>Mission terminée</b><span class="petit">Le client valide, le paiement est versé.</span></li>
    </ol>
    ${admin ? `<details class="carte"><summary>Essayer le dépôt de documents (comme un Cleaneur)</summary><div style="margin-top:12px">${dossier}</div></details>`
      : `<details class="carte" ${p.dossier === "VALIDE" ? "" : "open"}><summary>Mon dossier Cleaneur</summary><div style="margin-top:12px">${dossier}</div></details>`}
    <details class="carte"><summary>Mon profil et mon périmètre</summary>${profil}</details>`;
}
