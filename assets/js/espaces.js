// Espaces du compte : « Particulier », « Entreprise » (bureaux, commerces), « Conciergerie » (statut pro : conciergeries et SCI, agenda iCal, planning) et « Cleaneur ».
// Mêmes écrans que l'application (EspacesCompte.kt). Les valeurs métier sont dans regles.js.
import { TYPES_LOGEMENT, rubrique } from "./catalogue.js";
import { REGLES, euros, dateLongue, dateCourte, sirenSiretValide } from "./regles.js";
import { icone } from "./icones.js";
import { traduire, tr, LOCALE } from "./langue.js";
import { DOCUMENTS_CLEANEUR, enregistrerBien, lireCalendrier } from "./donnees.js";
import { couleurBien, voies, morceau, erreurSejour, sejoursGardes, nuits, versIcs, sourceCalendrier } from "./agenda.js";
import { afficherCarte, coordonnees } from "./cartes.js";
import { guideVideo } from "./guide-video.js";
import { chargeur } from "./commun.js";
import { blocFormulesCleaneur } from "./formules-cleaneur.js";
import { preremplir } from "./reserver.js";
import { editeurGuide, brancherGuides } from "./guides.js";
import { editeurEtapesPhoto, brancherEtapesPhoto, etapesPhotoDe, etapesPersoDe } from "./etapes-bien.js";
import { editeurStock, editeurIncidents, brancherOutilsBiens, blocAujourdhui, blocMenages, blocRapports, stockBas, incidentsDe, consommerStock } from "./conciergerie.js";
export { brancherMissions, demanderGeoloc } from "./missions.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
// Quatre espaces (13 novembre 2026) : Particulier, Entreprise (bureaux, commerces), Conciergerie (statut « pro » : conciergeries et SCI), Cleaneur.
export const ONGLETS = [["particulier", "Particulier", "logement"], ["entreprise", "Entreprise", "bureaux"], ["pro", "Conciergerie", "location"], ["cleaneur", "Cleaneur", "cleaneurs"]];

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
export const NOMS_ESPACES = { particulier: "Mon espace Particulier", entreprise: "Mon espace Entreprise", pro: "Mon espace Conciergerie", cleaneur: "Mon espace Cleaneur" };

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
  // Refonte (13 novembre 2026) : un seul tableau de bord, « Mon suivi » ; « Mon espace » rassemble le compte (informations, factures, parrainage).
  const aVenir = demandes.filter(d => !["TERMINEE", "ANNULEE"].includes(d.statut)).length;
  return `<div class="grille-raccourcis acces-particulier">
      <a class="carte raccourci" href="#/tableau">${icone("sur-place", { tuile: true })}<b>Mon suivi</b><span class="petit">Ma prochaine prestation en direct</span></a>
      <a class="carte raccourci" href="#/mes-demandes">${icone("calendrier", { tuile: true })}<b>Mes prestations</b><span class="petit">${aVenir} ${tr(aVenir > 1 ? "à venir" : "à venir")}</span></a>
      <a class="carte raccourci" href="#/mes-biens">${icone("logement", { tuile: true })}<b>Mes biens</b><span class="petit">${biens.length} ${tr(biens.length > 1 ? "logements" : "logement")}</span></a>
    </div>
`;
}

/* ------------------------------------------------------------------ Entreprise : bureaux, commerces, cabinets (13 novembre 2026) */

/** Prestations proposées aux entreprises, dans l'ordre des raccourcis. */
/** Prestations propres aux entreprises (pour compter leurs demandes ; même liste dans l'appli). */
const RUBRIQUES_ENTREPRISE = ["office", "commerce", "communal", "kitchen", "construction", "event"];
const estEntreprise = d => d.espace === "professionnel" || RUBRIQUES_ENTREPRISE.includes(d.rubrique_id);
const RACCOURCIS_ENTREPRISE = [["office", "Bureaux et cabinets"], ["commerce", "Commerces et entrepôts"], ["communal", "Immeubles et parties communes"], ["windows", "Vitres"]];

export function ongletEntreprise(p, biens, demandes) {
  const enCours = demandes.filter(d => !["TERMINEE", "ANNULEE"].includes(d.statut) && estEntreprise(d))
    .sort((a, b) => new Date(a.creneau || a.cree_le) - new Date(b.creneau || b.cree_le));
  const prochaine = enCours[0], r = prochaine && rubrique(prochaine.rubrique_id);
  const faites = demandes.filter(d => d.statut === "TERMINEE" && estEntreprise(d)).length;
  return `${guideVideo("client", "entreprise")}<div class="entete-pro entete-entreprise carte">
      <div><span class="surtitre">Espace Entreprise · Bureaux, commerces et locaux</span>
        <h2 style="margin:6px 0 2px">${p.societe ? esc(p.societe) : tr("Votre entreprise")}</h2>
        <p class="petit" style="margin:0">Le ménage de vos locaux, réservé en deux minutes, suivi en direct et facturé à votre société.</p></div>
      ${formulaireSociete(p)}
    </div>
    <div class="tuiles-chiffres">
      <div class="tuile-chiffre"><b>${enCours.length}</b><span>Prestations à venir</span></div>
      <div class="tuile-chiffre"><b>${faites}</b><span>Prestations réalisées</span></div>
      <div class="tuile-chiffre"><b>${biens.length}</b><span>Adresses enregistrées</span></div>
    </div>
    <div class="carte mise-en-avant">
      <span class="surtitre">Ma prochaine prestation</span>
      ${prochaine ? `<div class="ligne-compte" style="padding:0;box-shadow:none;border:0;background:none;margin-top:10px">${icone(r.icone, { tuile: true })}
        <div class="corps"><h3 style="margin:0">${r.nom}</h3><p class="muet" style="margin:2px 0 0">${prochaine.creneau ? dateLongue(new Date(prochaine.creneau)) : tr("Date à fixer")} · ${esc(prochaine.ville)}</p></div></div>
        <div class="boutons"><a class="bouton" href="#/demande/${esc(prochaine.reference)}/${esc(prochaine.jeton)}">Suivre ma prestation</a></div>`
      : `<p class="muet" style="margin:8px 0 0">Aucune prestation prévue pour l'instant.</p>`}
    </div>
    <h2 class="titre-section">${icone("instantane", { tuile: true })}Réserver pour vos locaux</h2>
    <div class="grille-raccourcis">${RACCOURCIS_ENTREPRISE.map(([id, nom]) => rubrique(id) ? `<a class="carte raccourci" href="#/reserver/${id}">${icone(rubrique(id).icone, { tuile: true })}<b>${nom}</b><span class="petit">${esc(rubrique(id).sousTitre)}</span></a>` : "").join("")}
      <a class="carte raccourci" href="#/mes-demandes">${icone("calendrier", { tuile: true })}<b>Mes prestations</b><span class="petit">À venir et passées</span></a></div>
    <p class="petit">Prix affiché tout de suite, Cleaneurs vérifiés, paiement après validation. Factures au nom de votre société, au format Factur-X.</p>`;
}

/** Raison sociale et SIRET/SIREN (partagés par les espaces Entreprise et Conciergerie). */
function formulaireSociete(p) {
  return `<details class="societe"><summary>Ma société</summary>
        <form id="form-societe" novalidate style="margin-top:10px">
          <label class="champ">Raison sociale<input name="societe" maxlength="120" value="${esc(p.societe)}" autocomplete="organization"></label>
          <label class="champ">SIRET (14 chiffres) ou SIREN (9 chiffres)<input name="siret" inputmode="numeric" maxlength="17" value="${esc(p.siret_societe || "")}"></label>
          <p class="erreur" id="erreur-societe"></p><button class="bouton plein" type="submit">Enregistrer</button></form>
</details>`;
}

/* ------------------------------------------------------------------ Conciergerie (statut « pro ») : locations saisonnières et multi-propriétaires */

const SOURCES = [["airbnb", "Airbnb"], ["booking", "Booking.com"], ["autre", "Autre calendrier"]];
let moisAffiche = null;      // premier jour du mois de l'agenda
let filtreBien = "";         // agenda : un seul bien ou tous
let vueAgenda = "mois";      // « mois » ou « liste »
let jourChoisi = null;       // jour touché dans le calendrier (détail affiché dessous)


/** Séjours de tous les biens : ceux des calendriers iCal et ceux saisis à la main ; erreurs et séjours lus par lien. */
async function sejoursDes(biens) {
  const sejours = [], erreurs = {}, lus = {};
  biens.forEach(l => (l.sejours || []).forEach(s => sejours.push({ ...s, bienId: l.id, source: "manuel" })));
  await Promise.all(biens.flatMap(l => (l.calendriers || []).filter(c => c.url).map(async c => {
    const r = await lireCalendrier(c.url).catch(() => ({ erreur: "inaccessible" }));
    if (r.erreur) { erreurs[c.url] = r.erreur; return; }
    // Airbnb : « Not available » = dates bloquées par l'hôte, pas un voyageur. Booking marque toutes ses réservations « CLOSED » :
    // la plateforme est donc reconnue d'après le lien, pas d'après le champ où il a été collé.
    const src = sourceCalendrier(c.url, c.source);
    const gardes = r.evenements.filter(e => !(src === "airbnb" && e.bloque));
    lus[c.url] = gardes.filter(e => e.fin >= new Date().toISOString().slice(0, 10)).length;
    gardes.forEach(e => sejours.push({ bienId: l.id, source: src, debut: e.debut, fin: e.fin }));
  })));
  return { sejours, erreurs, lus };
}

export function ongletPro(p, biens) {
  const relies = biens.filter(l => (l.calendriers || []).some(c => c.url)).length;
  return `${guideVideo("client", "conciergerie")}<div class="entete-pro carte">
      <div><span class="surtitre">Espace Conciergerie · Locations saisonnières et SCI</span>
        <h2 style="margin:6px 0 2px">${p.societe ? esc(p.societe) : tr("Votre conciergerie")}</h2>
        <p class="petit" style="margin:0">Vos biens, les séjours de vos voyageurs et chaque ménage entre deux départs, pilotés d'un seul écran.</p></div>
      ${formulaireSociete(p)}
    </div>
    <div class="tuiles-chiffres tuiles-conciergerie" id="chiffres-pro">
      <div class="tuile-chiffre"><b>${biens.length}</b><span>Biens gérés</span></div>
      <div class="tuile-chiffre"><b>${relies}/${biens.length}</b><span>Calendriers reliés</span></div>
      <div class="tuile-chiffre"><b data-chiffre="departs">…</b><span>Départs sur ${REGLES.AGENDA_HORIZON_JOURS} jours</span></div>
      <div class="tuile-chiffre succes"><b data-chiffre="couverts">…</b><span>Ménages prévus</span></div>
      <div class="tuile-chiffre alerte"><b data-chiffre="aprogrammer">…</b><span>Ménages à programmer</span></div>
    </div>
    <div class="grille-raccourcis raccourcis-conciergerie">
      <a class="carte raccourci" href="#/reserver/rental">${icone("location", { tuile: true })}<b>Programmer un ménage</b><span class="petit">Entre deux voyageurs</span></a>
      <a class="carte raccourci" href="#agenda-pro">${icone("calendrier", { tuile: true })}<b>Ajouter un séjour</b><span class="petit">Sans calendrier relié</span></a>
      <a class="carte raccourci" href="#liste-biens">${icone("logement", { tuile: true })}<b>Mes biens</b><span class="petit">Calendriers, accès, étapes photo</span></a>
      <a class="carte raccourci" href="#liste-invitations">${icone("cleaneurs", { tuile: true })}<b>Mes Cleaneurs</b><span class="petit">Inviter vos habitués</span></a>
    </div>
    <h2 class="titre-section">${icone("sur-place", { tuile: true })}Aujourd'hui et demain</h2>
    <p class="petit" style="margin-top:0">Alertes et rotations : départs, ménages, arrivées. Tout ce qui demande votre attention, au même endroit.</p>
    <div id="pro-aujourdhui">${chargeur("Lecture de vos calendriers…", { petit: true, variante: "vitre" })}</div>
    <h2 class="titre-section">${icone("calendrier", { tuile: true })}Planning de la semaine</h2>
    <p class="petit" style="margin-top:0">Chaque bien, jour par jour : départs, arrivées et ménages. Touchez un départ orange pour programmer son ménage.</p>
    <div class="carte planning-semaine" id="semaine-pro">${chargeur("Lecture de vos calendriers…", { petit: true, variante: "vitre" })}</div>
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
          <div class="corps"><b>${esc(nomBien(l))}</b><div class="petit">${esc(l.rue)}, ${esc(l.codePostal)} ${esc(l.ville)}${l.surface ? `<span> · ${l.surface} m²</span>` : ""}${l.chambres ? `<span> · ${l.chambres} ch.</span>` : ""}</div>
          <div class="etat-bien"><span data-prochain="${esc(l.id)}">${tr("Prochain départ")} : …</span>
            <span>📸 ${(l.guide || []).length} ${tr("étapes d'accès")}</span><span>📷 ${etapesPhotoDe(l).length + etapesPersoDe(l).length} ${tr("étapes photo")}</span></div>
          <div class="pastilles">${cals.length ? cals.map(c => { const src = sourceCalendrier(c.url, c.source); return `<span class="pastille ${src}" data-etat-cal="${esc(c.url)}" data-nom="${esc(SOURCES.find(s => s[0] === src)?.[1] || "")}">${SOURCES.find(s => s[0] === src)?.[1] || ""} · ${tr("synchronisation…")}</span>`; }).join("") : `<span class="pastille vide">Aucun calendrier relié</span>`}</div></div></div>
        <details><summary>${cals.length ? tr("Modifier le nom et les calendriers") : tr("Relier un calendrier")}</summary>
          <form data-form-cal="${esc(l.id)}" novalidate style="margin-top:10px">
            <label class="champ">Nom du bien<input name="nom" maxlength="60" value="${esc(l.nom)}" placeholder="${esc(tr("Ex. : Studio Vieux-Port"))}"></label>
            ${SOURCES.map(([id, nom]) => `<label class="champ">Lien du calendrier ${nom}<input name="${id}" type="url" inputmode="url" maxlength="600" placeholder="https://…ics" value="${esc((l.calendriers || []).find(c => c.source === id)?.url)}"></label>`).join("")}
            <p class="erreur" data-erreur-cal></p><button class="bouton plein" type="submit">Enregistrer</button></form></details>
        ${editeurGuide(l)}${editeurEtapesPhoto(l)}${editeurStock(l)}${editeurIncidents(l)}</div>`;
    }).join("") : `<div class="vide-compte"><p class="muet">Aucun bien enregistré pour l'instant.</p><p class="petit">Ajoutez vos biens dans « Mes prestations » ou lors d'une réservation.</p></div>`}</div>
    <p class="petit" id="aucun-bien" hidden>Aucun bien ne correspond à votre recherche.</p>
    <div class="boutons"><a class="bouton secondaire" href="#/mes-demandes">＋ Ajouter un bien</a><a class="bouton secondaire" href="#/reserver/rental">Réserver un ménage de location</a></div>
    <h2 class="titre-section" id="titre-menages">${icone("termine", { tuile: true })}Tous les ménages</h2>
    <div id="pro-menages">${chargeur("Chargement…", { petit: true })}</div>
    <h2 class="titre-section" id="titre-rapports">${icone("avis", { tuile: true })}Rapports mensuels</h2>
    <p class="petit" style="margin-top:0">Par bien : séjours, nuits occupées, taux d'occupation, ménages et leur coût. À exporter ou imprimer pour vos propriétaires.</p>
    <div id="pro-rapports">${chargeur("Lecture de vos calendriers…", { petit: true })}</div>
    <details class="carte aide-ical"><summary>Où trouver le lien de mon calendrier ?</summary>
      <p><b>Airbnb</b> : Annonces › votre annonce › Disponibilités › Synchroniser les calendriers › Exporter le calendrier. Copiez le lien.</p>
      <p><b>Booking.com</b> : Extranet › Tarifs et disponibilités › Synchronisation des calendriers › Exporter le calendrier. Copiez le lien.</p>
      <p><b>Abritel / Vrbo</b> : Calendrier › Importer et exporter › Exporter. Copiez le lien.</p>
      <p class="petit">Le lien se termine souvent par « .ics ». Il ne donne accès qu'aux dates, jamais aux coordonnées de vos voyageurs.</p></details>`;
}

/** « Ma société » (espaces Entreprise et Conciergerie). */
export function brancherSociete(vue, majProfil, recharger) {
  const fs = vue.querySelector("#form-societe");
  if (!fs) return;
  fs.onsubmit = async e => {
    e.preventDefault();
    const siret = fs.siret.value.replace(/\D/g, "");
    if (!fs.societe.value.trim() || !sirenSiretValide(siret)) { vue.querySelector("#erreur-societe").textContent = tr("Indiquez la raison sociale et un SIRET (14 chiffres) ou un SIREN (9 chiffres) valable."); return; }
    try { await majProfil({ societe: fs.societe.value.trim(), siret_societe: siret }); recharger(); }
    catch { vue.querySelector("#erreur-societe").textContent = tr("Le service est momentanément indisponible. Réessayez dans quelques minutes."); }
  };
}

export function brancherPro(vue, p, biens, demandes, { majProfil, recharger }) {
  brancherSociete(vue, majProfil, recharger);
  vue.querySelectorAll("[data-form-cal]").forEach(f => f.onsubmit = async e => {
    e.preventDefault();
    const l = biens.find(x => x.id === f.dataset.formCal), err = f.querySelector("[data-erreur-cal]");
    const calendriers = SOURCES.map(([id]) => ({ source: id, url: f[id].value.trim().replace(/^webcal:/i, "https:") })).filter(c => c.url)
      .map(c => ({ ...c, source: sourceCalendrier(c.url, c.source) }))
      .filter((c, i, t) => t.findIndex(x => x.url === c.url) === i);
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
  brancherGuides(vue, biens, recharger);
  brancherEtapesPhoto(vue, biens, recharger);
  brancherOutilsBiens(vue, biens, recharger);
  // Stock : chaque ménage terminé retire la consommation « par ménage » (une seule fois par ménage), puis l'espace se redessine.
  const consommes = consommerStock(biens, demandes);
  if (consommes.length) Promise.all(consommes.map(b => enregistrerBien(b))).then(recharger).catch(() => null);
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
  const { sejours, erreurs, lus } = await sejoursDes(biens);
  if (!vue.querySelector("#agenda-pro")) return {};   // page quittée entre-temps
  // Calendriers injoignables : pastille rouge sur le bien.
  // État de chaque calendrier : séjours à venir lus, ou injoignable (avec la raison).
  vue.querySelectorAll("[data-etat-cal]").forEach(s => {
    const u = s.dataset.etatCal, e = erreurs[u], n = lus[u] ?? 0;
    if (e) { s.classList.add("ko"); s.textContent = `${s.dataset.nom} · ${tr(e === "site" ? "site non accepté" : e === "format" ? "lien non valable" : "injoignable")}`;
      s.title = tr(e === "site" ? "Ce site de calendrier n'est pas encore accepté. Utilisez le lien Airbnb, Booking, Abritel ou Google." : e === "format" ? "Ce lien n'est pas un calendrier (.ics). Vérifiez que vous avez copié le lien d'export." : "Calendrier injoignable. Vérifiez le lien et réessayez."); }
    else { s.classList.add("ok-cal"); s.textContent = `${s.dataset.nom} ✓ · ${n} ${tr(n > 1 ? "séjours à venir" : "séjour à venir")}`; s.title = tr("Calendrier synchronisé"); }
  });
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
  const couverts = new Set(departs.filter(s => menagePrevu(s.bienId, s.fin)).map(s => s.bienId + s.fin)).size;
  const tc = vue.querySelector('[data-chiffre="couverts"]'); if (tc) tc.textContent = couverts;
  // Prochain départ affiché sur chaque fiche de bien.
  vue.querySelectorAll("[data-prochain]").forEach(e => { const j = prochains[e.dataset.prochain];
    e.textContent = `${tr("Prochain départ")} : ${j ? dateCourte(jourDe(j)) : tr("aucun")}`; });
  const menageDe = (bienId, jour) => { const l = bienDe(bienId); return l && demandes.find(d => d.statut !== "ANNULEE" && memeAdresse(d, l) && d.creneau && iso(new Date(d.creneau)) === jour); };
  planningSemaine(vue.querySelector("#semaine-pro"), biens, uniques, menageDe, auj, couleurBien);
  const ordreBiens = biens.slice().sort((a, b) => nomBien(a).localeCompare(nomBien(b), "fr", { sensitivity: "base", numeric: true }));
  const couleurDe = id => couleurBien(ordreBiens.findIndex(l => l.id === id));
  const programmerMenage = (bienId, jour) => { preremplir({ bienId, jour }); location.hash = "#/reserver/rental"; };
  blocAujourdhui(vue.querySelector("#pro-aujourdhui"), { biens, sejours: uniques, demandes, menageDe, erreurs, nomBien, couleur: couleurDe, programmer: programmerMenage });
  blocMenages(vue.querySelector("#pro-menages"), { biens, demandes, nomBien });
  blocRapports(vue.querySelector("#pro-rapports"), { biens, sejours: uniques, demandes, nomBien, societe: vue.querySelector(".entete-pro h2")?.textContent || "" });
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
  // Ménages prévus d'un jour (demandes), pour leurs icônes de prestation et leur état.
  const demandesDuJour = j => demandes.filter(x => x.statut !== "ANNULEE" && x.creneau && iso(new Date(x.creneau)) === j
    && biens.some(l => (!filtreBien || l.id === filtreBien) && memeAdresse(x, l)));
  const ETATS = { VERIFICATION: "En vérification", PUBLIEE: "Recherche d'un Cleaneur", CONFIRMEE: "Cleaneur confirmé", EN_ROUTE: "Cleaneur en route",
    SUR_PLACE: "Cleaneur sur place", EN_COURS: "Ménage en cours", A_VALIDER: "À valider", TERMINEE: "Terminé" };
  const iconePresta = (x, classe = "") => `<i class="b-menage b-presta etat-${esc(x.statut)} ${classe}" title="${esc(`${rubrique(x.rubrique_id)?.nom || ""} · ${tr(ETATS[x.statut] || "")}`)}">${icone(rubrique(x.rubrique_id)?.icone || "termine")}</i>`;
  const ligneMenage = x => {
    const l = biens.find(b => memeAdresse(x, b));
    return `<div class="evt evt-menage" style="--c:${couleur(l?.id)}">${iconePresta(x, "grand")}
      <div class="evt-corps"><div class="evt-haut"><b>${esc(rubrique(x.rubrique_id)?.nom || tr("Ménage prévu"))}</b><span class="evt-bien">${l ? esc(nomBien(l)) : ""}</span></div>
        <div class="petit muet"><span>${new Date(x.creneau).toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" })}</span> · <span class="etat-texte etat-${esc(x.statut)}">${tr(ETATS[x.statut] || "")}</span></div></div>
      <div class="evt-actions">${x.reference && x.jeton ? `<a class="lien-bouton" href="#/demande/${esc(x.reference)}/${esc(x.jeton)}">${tr("Suivre")}</a>` : ""}</div></div>`;
  };
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
    demandesDuJour(j).forEach(x => r.push(ligneMenage(x)));
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
        const menages = menagesDu(d).length, prestas = demandesDuJour(d);
        const sansMenage = sel.some(s => s.fin === d && d >= debut && !menagePrevu(s.bienId, d));
        const dep = sel.filter(s => s.fin === d).length, arr = sel.filter(s => s.debut === d).length;
        const resume = [dep && `${dep} ${tr("Départ")}`, arr && `${arr} ${tr("Arrivée")}`, menages && tr("Ménage prévu")].filter(Boolean).join(", ");
        cases += `<button type="button" class="jour${d === debut ? " aujourdhui" : ""}${d === jourChoisi ? " choisi" : ""}${d < debut ? " passe" : ""}" data-jour="${d}" aria-label="${esc(dateLongue(jourDe(d)))}${resume ? ` · ${esc(resume)}` : ""}">
          <span class="num">${j}</span>
          ${visibles.map(({ s, m }) => `<i class="barre ${m}" style="--c:${couleur(s.bienId)};--v:${s.voie}" title="${esc(nomBien(bienDe(s.bienId)))}"></i>`).join("")}
          <span class="badges">${prestas.slice(0, 2).map(x => iconePresta(x)).join("")}${prestas.length > 2 ? `<i class="b-plus">+${prestas.length - 2}</i>` : ""}${sansMenage ? `<i class="b-depart" title="${esc(tr("Départ sans ménage"))}">!</i>` : ""}${caches > 0 ? `<i class="b-plus">+${caches}</i>` : ""}</span></button>`;
      }
      const sj = jourChoisi && jourChoisi.slice(0, 7) === iso(premier).slice(0, 7) ? jourChoisi : null;
      const detail = sj ? evenementsDu(sj, sel, true) : [];
      corps = `<div class="agenda-grille" role="grid">${jours.map(j => `<div class="jour-sem">${j}</div>`).join("")}${cases}</div>
        <div class="agenda-legende petit">${(filtreBien ? ordre.filter(l => l.id === filtreBien) : ordre).slice(0, 8).map(l => `<span><i class="barre-leg" style="--c:${couleur(l.id)}"></i>${esc(nomBien(l))}</span>`).join("")}
          <span><i class="b-menage b-presta">${icone("logement")}</i>Ménage prévu (icône de la prestation)</span><span><i class="b-depart">!</i>Départ sans ménage</span></div>
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
    ["Téléphone", !!p.telephone],
    ["Adresse (code postal et ville)", !!(p.code_postal && p.ville)],
    ["Numéro SIRET", (p.siret || "").length === 14],
    ["Prestations proposées", (p.prestations || []).length > 0],
    ["Pièce d'identité", docOk("identite")],
    ["Justificatif SIRET", docOk("siret")],
    ["Assurance RC Pro", docOk("rc_pro")],
    ["Attestation de vigilance URSSAF", docOk("urssaf")],
    ["Dossier envoyé", ["A_VERIFIER", "VALIDE"].includes(p.dossier)],
    ["Dossier validé par Cleaneroo", p.dossier === "VALIDE"],
  ];
}

export function ongletCleaneur(p, docs, { dossier, profil }) {
  if (p.role === "client") return `${guideVideo("cleaneur", "devenir")}<div class="carte mise-en-avant"><span class="surtitre">Espace Cleaneur</span>
      <h2 style="margin:6px 0 4px">Devenez Cleaneur en auto-entrepreneur</h2>
      <p class="muet" style="margin:0 0 6px">Missions près de chez vous, à votre rythme, déroulé guidé et paiement sécurisé.</p>
      <ul class="petit" style="margin:0 0 10px;padding-left:18px"><li>Statut d'auto-entrepreneur (micro-entreprise) avec un numéro SIRET</li>
        <li>Assurance responsabilité civile professionnelle et attestation URSSAF</li>
        <li>Vous gardez vos autres espaces : vos missions restent séparées de vos réservations privées.</li></ul>
      <button type="button" class="bouton" id="devenir-cleaneur">Ajouter l'espace Cleaneur</button></div>`;
  const admin = p.role === "admin";
  return `${admin ? `<p style="margin:0 0 10px"><span class="tampon">Accès administrateur</span></p>` : ""}
    ${guideVideo("cleaneur", "cleaneur")}
    <div id="missions-cleaneur">${chargeur("Chargement de vos missions…")}</div>
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

/* ------------------------------------------------------------------ Planning de la semaine (conciergerie, 13 novembre 2026) */
/** Une ligne par bien, une colonne par jour : séjour en cours, arrivée, départ (vert : ménage prévu ; orange : à programmer). */
export function planningSemaine(boite, biens, sejours, menageDe, auj, couleur) {
  if (!boite) return;
  if (!biens.length) { boite.innerHTML = `<div class="vide-compte"><p class="muet">${tr("Ajoutez votre premier bien pour voir son planning.")}</p></div>`; return; }
  const jours = Array.from({ length: 7 }, (_, i) => plusJours(auj, i));
  const ordre = biens.slice().sort((a, b) => nomBien(a).localeCompare(nomBien(b), "fr", { sensitivity: "base", numeric: true }));
  const libJour = d => d.toLocaleDateString(LOCALE, { weekday: "short", day: "numeric" });
  const cellule = (l, d) => {
    const j = iso(d), dep = sejours.find(s => s.bienId === l.id && s.fin === j), arr = sejours.find(s => s.bienId === l.id && s.debut === j);
    const occupe = sejours.some(s => s.bienId === l.id && s.debut < j && j < s.fin);
    const marques = [];
    const m = dep && menageDe(l.id, j);
    if (dep) marques.push(m ? `<span class="pl-menage etat-${esc(m.statut)}" title="${esc(rubrique(m.rubrique_id)?.nom || tr("Ménage prévu"))}">${icone(rubrique(m.rubrique_id)?.icone || "termine")} ${tr("Ménage")}</span>`
      : `<button type="button" class="pl-programmer" data-programmer="${esc(l.id)}" data-jour="${j}" title="${esc(tr("Programmer le ménage"))}">${tr("Départ")} ›</button>`);
    if (arr) marques.push(`<span class="pl-arrivee">${tr("Arrivée")}</span>`);
    return `<td class="${occupe || arr ? "pl-occupe" : ""}">${marques.join("")}</td>`;
  };
  boite.innerHTML = `<div class="planning-defile"><table class="planning"><thead><tr><th>${tr("Bien")}</th>${jours.map((d, i) => `<th class="${i === 0 ? "pl-auj" : ""}">${libJour(d)}</th>`).join("")}</tr></thead>
    <tbody>${ordre.map((l, i) => `<tr style="--c:${couleur(i)}"><th><span class="pl-pastille"></span>${esc(nomBien(l))}</th>${jours.map(d => cellule(l, d)).join("")}</tr>`).join("")}</tbody></table></div>
    <p class="petit legende-planning"><span class="pl-menage">✓ ${tr("Ménage")}</span> ${tr("prévu")} · <span class="pl-programmer">${tr("Départ")} ›</span> ${tr("à programmer")} · <span class="pl-arrivee">${tr("Arrivée")}</span> · <span class="pl-occupe-ex"></span> ${tr("occupé")}</p>`;
  boite.querySelectorAll("[data-programmer]").forEach(b => b.onclick = () => { preremplir({ bienId: b.dataset.programmer, jour: b.dataset.jour }); location.hash = "#/reserver/rental"; });
}
