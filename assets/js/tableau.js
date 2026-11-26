// Accueil « vivant » du compte connecté (Particulier, Pro, administrateur) : la prochaine prestation en direct
// et la boîte « À faire » (tout ce qui attend le client). Se met à jour en temps réel. Même écran dans l'appli (AccueilVivant.kt).
import { guideVideo } from "./guide-video.js";
import { badgeNiveau } from "./niveaux.js";
import { reserverPourLogement, reserverAvecFavori, nomLogement, iconeBien, preremplir } from "./reserver.js";
import { decorTableau } from "./commun.js";
import { agendaParticulier } from "./agenda-particulier.js";
import { rubrique } from "./catalogue.js";
import { REGLES, euros, dateLongue, heure } from "./regles.js";
import { icone } from "./icones.js";
import { traduire, tr, LOCALE } from "./langue.js";
import { supabase, session, monProfil, demandesDuCompte, synchroniserBiens, ecouterDemandes, secteurCouvert } from "./donnees.js";
import { champPrestation, lancerRecherche } from "./carte-client.js";
import { chercherAdresse, coordonnees } from "./cartes.js";
import { afficherToast } from "./commun.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** Étapes affichées sur la frise de la prochaine prestation. */
export const ETAPES_VIVANT = [["PUBLIEE", "En ligne"], ["CONFIRMEE", "Confirmée"], ["EN_ROUTE", "En route"], ["SUR_PLACE", "Sur place"], ["EN_COURS", "Ménage"], ["A_VALIDER", "À valider"]];
const RANG = { VERIFICATION: 0, PUBLIEE: 0, CONFIRMEE: 1, EN_ROUTE: 2, SUR_PLACE: 3, EN_COURS: 4, A_VALIDER: 5 };
const FINIES = ["TERMINEE", "ANNULEE"];
/** Ordre de priorité : ce qui se passe maintenant d'abord, puis la date la plus proche. */
const PRIORITE = { EN_ROUTE: 0, SUR_PLACE: 0, EN_COURS: 0, A_VALIDER: 1, CONFIRMEE: 2, PUBLIEE: 3, VERIFICATION: 3 };

/** Prochaine prestation : en cours d'abord, sinon la plus proche. */
export function prochaine(demandes) {
  const quand = d => new Date(d.creneau || d.cree_le).getTime();
  return demandes.filter(d => !FINIES.includes(d.statut))
    .sort((a, b) => (PRIORITE[a.statut] ?? 4) - (PRIORITE[b.statut] ?? 4) || quand(a) - quand(b))[0] || null;
}

/** « dans 2 j 5 h », « dans 3 h 10 », « dans 12 min », ou "" si passé. */
export function compteARebours(dateIso, maintenant = Date.now()) {
  if (!dateIso) return "";
  const min = Math.round((new Date(dateIso).getTime() - maintenant) / 60000);
  if (min <= 0) return "";
  if (min < 60) return `${tr("dans")} ${min} min`;
  const h = Math.floor(min / 60), j = Math.floor(h / 24);
  if (j >= 2) return `${tr("dans")} ${j} ${tr("jours")}`;
  if (j >= 1) return `${tr("dans")} ${j} ${tr("j")} ${h % 24} h`;
  return `${tr("dans")} ${h} h ${String(min % 60).padStart(2, "0")}`;
}

/** Phrase principale selon l'étape (avec le prénom du Cleaneur quand il est connu). */
function phrase(d, prenom) {
  const qui = prenom || tr("Votre Cleaneur");
  return {
    VERIFICATION: tr("Nous vérifions votre demande"),
    PUBLIEE: tr("En ligne : les Cleaneurs vérifiés de votre secteur sont prévenus"),
    CONFIRMEE: prenom ? `${prenom} ${tr("interviendra chez vous")}` : tr("Votre Cleaneur est confirmé"),
    EN_ROUTE: `${qui} ${tr("est en route")}`,
    SUR_PLACE: `${qui} ${tr("est arrivé(e)")}`,
    EN_COURS: tr("Ménage en cours"),
    A_VALIDER: tr("Ménage terminé : validez-le"),
  }[d.statut] || tr("Votre prestation");
}

/**
 * Boîte « À faire » : tout ce qui attend le client, du plus urgent au moins urgent.
 * Chaque élément : { urgent, icone, titre, detail, lien }.
 */
export function aFaire({ profil, demandes, biens }) {
  const l = [];
  const date = d => d.creneau ? `${dateLongue(new Date(d.creneau))} · ${heure(new Date(d.creneau).getHours())}` : tr("Date à fixer");
  const lien = d => `#/demande/${encodeURIComponent(d.reference)}/${encodeURIComponent(d.jeton)}`;
  demandes.filter(d => d.statut === "A_VALIDER").forEach(d => l.push({ urgent: true, icone: "valide",
    titre: `${tr("Validez le ménage")} · ${rubrique(d.rubrique_id).nom}`, detail: `${date(d)} · ${tr("le paiement ne part qu'après votre accord")}`, lien: lien(d) }));
  demandes.filter(d => !FINIES.includes(d.statut) && ["BOITE", "AUTONOME"].includes(d.accueil) && !(d.acces && d.acces.code)).forEach(d => l.push({ urgent: true, icone: "cle",
    titre: `${tr("Indiquez le code d'accès")} · ${rubrique(d.rubrique_id).nom}`, detail: date(d), lien: lien(d) }));
  if (profil && !(profil.telephone || "").trim()) l.push({ urgent: false, icone: "telephone",
    titre: tr("Ajoutez votre numéro de téléphone"), detail: tr("Votre Cleaneur peut vous joindre le jour J."), lien: "#/compte" });
  const statuts = profil?.statuts || [];
  if (!biens.length && (statuts.includes("particulier") || statuts.includes("pro"))) l.push({ urgent: false, icone: "logement",
    titre: tr("Enregistrez votre logement"), detail: tr("Vos prochaines réservations iront deux fois plus vite."), lien: "#/mes-biens" });
  if (statuts.includes("pro")) biens.filter(b => !(b.calendriers || []).some(c => c.url)).slice(0, 3).forEach(b => l.push({ urgent: false, icone: "calendrier",
    titre: `${tr("Reliez le calendrier Airbnb ou Booking")} · ${b.nom || b.ville}`, detail: tr("Les ménages entre deux voyageurs apparaîtront tout seuls."), lien: "#/compte/pro" }));
  if (statuts.includes("cleaneur") && profil.dossier !== "VALIDE" && profil.role !== "admin") l.push({ urgent: false, icone: "garantie",
    titre: tr("Complétez votre dossier Cleaneur"), detail: tr("Pièce d'identité, SIRET, assurance et URSSAF."), lien: "#/compte/cleaneur" });
  return l;
}

/* ------------------------------------------------------------------ Carnet de Cleaneurs favoris (16 novembre 2026) */
/** Les favoris du client : demandés directement à la réservation (« Mon Cleaneur favori »), ou retirés. Même écran dans l'appli. */
/** Page « Mes favoris » (menu de l'espace, 26/11/2026) : les Cleaneurs favoris, à demander directement. */
export async function pageFavoris(vue) {
  vue.innerHTML = `<section class="bloc page-favoris"><div class="etroit"><h1>${icone("coeur")} ${tr("Mes favoris")}</h1><div class="trait-corail"></div>
    <p class="petit">${tr("Vos Cleaneurs préférés : demandez-les directement pour votre prochaine prestation.")}</p><div id="carnet-favoris"></div></div></section>`;
  traduire(vue);
  await carnetFavoris(vue.querySelector("#carnet-favoris"));
}

export async function carnetFavoris(boite) {
  if (!boite) return;
  const favoris = await supabase.rpc("mes_favoris").then(r => r.data || []).catch(() => []);
  if (!boite.isConnected) return;
  boite.innerHTML = `<h2 class="titre-section">${icone("cleaneurs", { tuile: true })}${tr("Mes Cleaneurs favoris")}</h2>
    ${favoris.length ? `<div class="carnet-favoris">${favoris.map(f => `<div class="carte favori-ligne">
        <span class="avatar-favori grand">${esc((f.prenom || "?").charAt(0).toUpperCase())}</span>
        <div class="corps"><b>${esc(f.prenom)} ${esc(f.initiale ? f.initiale + "." : "")}</b>
          <span class="petit">${f.note ? `★ ${String(f.note).replace(".", ",")} (${f.nb_avis}) · ` : ""}${f.ensemble} ${tr(f.ensemble > 1 ? "prestations ensemble" : "prestation ensemble")}${f.derniere ? ` · ${tr("dernière le")} ${esc(dateLongue(new Date(f.derniere)))}` : ""}</span>
          ${(f.prestations || []).length ? `<span class="pastilles-presta">${f.prestations.filter(id => rubrique(id)).slice(0, 5).map(id => `<i title="${esc(rubrique(id).nom)}">${icone(rubrique(id).icone)}</i>`).join("")}</span>` : ""}</div>
        <div class="actions-favori"><button type="button" class="bouton petit" data-reserver-favori="${esc(f.cleaneur_id)}">${tr("Réserver avec")} ${esc(f.prenom)}</button>
          <button type="button" class="lien-bouton" data-retirer-favori="${esc(f.cleaneur_id)}">${tr("Retirer")}</button></div></div>`).join("")}</div>
      <p class="petit">${tr("Votre favori voit votre demande seul pendant 12 h et peut l'accepter directement ; sans réponse, elle s'ouvre aux autres Cleaneurs.")}</p>`
    : `<div class="carte vide-compte"><p class="muet" style="margin:0">${tr("Aucun Cleaneur favori pour l'instant.")}</p>
        <p class="petit" style="margin:4px 0 0">${tr("Après une prestation, sélectionnez « Ajouter à mes favoris » : vous pourrez ensuite le demander directement.")}</p></div>`}`;
  traduire(boite);
  boite.querySelectorAll("[data-reserver-favori]").forEach(x => x.onclick = () => reserverAvecFavori(x.dataset.reserverFavori));
  boite.querySelectorAll("[data-retirer-favori]").forEach(x => x.onclick = async () => {
    if (!confirm(tr("Retirer ce Cleaneur de vos favoris ?"))) return;
    await supabase.rpc("retirer_favori", { p_cleaneur: x.dataset.retirerFavori }).then(() => null, () => null);
    carnetFavoris(boite);
  });
}

/* ------------------------------------------------------------------ « Que souhaitez-vous faire aujourd'hui ? » (prompt 4, lot 3) */
/** Prestation proposée d'abord : la dernière réservée, sinon le ménage du logement. */
function rubriqueConseillee(demandes) {
  const d = [...demandes].sort((a, b) => new Date(b.cree_le) - new Date(a.cree_le)).find(x => rubrique(x.rubrique_id) && x.rubrique_id !== "special");
  return d ? d.rubrique_id : "home";
}
/** Position d'un bien : enregistrée, sinon retrouvée par son adresse (mémorisée sur l'appareil). */
async function positionBien(l) {
  if (Number.isFinite(l.lat) && Number.isFinite(l.lon)) return { lat: l.lat, lon: l.lon };
  return coordonnees(l.rue || "", l.codePostal || "", l.ville || "").catch(() => null);
}
/** Recherche de l'accueil : ouvre la recherche (liste et carte) avec la prestation et le lieu ; disponibilité locale affichée tout de suite. */
function brancherRechercheAccueil(vue, lieux) {
  const f = vue.querySelector("[data-recherche-accueil]");
  if (!f) return;
  const zone = f.querySelector("[data-dispo-locale]");
  let jeton = 0;
  const lieuChoisi = () => (f.lieu && f.lieu.value !== "autre" ? lieux[Number(f.lieu.value)] : null);
  const dispo = async () => {
    const moi = ++jeton, l = lieuChoisi(), r = rubrique(f.rubrique.value);
    if (!l || !r) { zone.textContent = ""; return; }
    const pos = await positionBien(l);
    if (moi !== jeton || !pos) { if (moi === jeton) zone.textContent = ""; return; }
    const n = await secteurCouvert(r.id, pos.lat, pos.lon).catch(() => null);
    if (moi !== jeton || !f.isConnected) return;
    zone.innerHTML = n === null ? "" : n > 0
      ? `${icone("valide")} <span><b>${n} ${tr(n > 1 ? "Cleaneurs vérifiés" : "Cleaneur vérifié")}</b> ${tr(n > 1 ? "couvrent cette adresse pour" : "couvre cette adresse pour")} ${esc(r.nom)}.</span>`
      : `${icone("alerte")} <span>${tr("Pas encore de Cleaneur à cette adresse pour")} ${esc(r.nom)}. <a href="#/recherche" data-vers-recherche>${tr("Être prévenu")}</a></span>`;
    zone.classList.toggle("ok", n > 0);
  };
  const versRecherche = async () => {
    const l = lieuChoisi(), id = f.rubrique.value;
    if (l) {
      const pos = await positionBien(l);
      if (!pos) { afficherToast("Adresse introuvable. Précisez la rue ou le code postal.", "erreur"); return; }
      lancerRecherche({ rubriqueId: id, adresse: { ...pos, rue: l.rue || "", codePostal: l.codePostal || "", ville: l.ville || "",
        libelle: [l.rue, [l.codePostal, l.ville].filter(Boolean).join(" ")].filter(Boolean).join(", ") } });
      return;
    }
    const q = f.adresse.value.trim();
    if (q.length < 3) { lancerRecherche({ rubriqueId: id }); return; }
    const a = await chercherAdresse(q);
    if (!a) { afficherToast("Adresse introuvable. Précisez la rue ou le code postal.", "erreur"); return; }
    lancerRecherche({ rubriqueId: id, adresse: { lat: a.lat, lon: a.lon, texte: q, rue: a.rue || "", codePostal: a.codePostal || "", ville: a.ville || "",
      libelle: [a.rue, [a.codePostal, a.ville].filter(Boolean).join(" ")].filter(Boolean).join(", ") } });
  };
  f.addEventListener("submit", e => { e.preventDefault(); versRecherche(); });
  zone.addEventListener("click", e => { if (e.target.closest("[data-vers-recherche]")) { e.preventDefault(); versRecherche(); } });
  f.rubrique.addEventListener("change", dispo);
  f.lieu?.addEventListener("change", () => { f.adresse.hidden = f.lieu.value !== "autre"; if (!f.adresse.hidden) f.adresse.focus(); dispo(); });
  dispo();
}

/* ------------------------------------------------------------------ Écran */
let minuterie = null, arret = null;
export function arreterTableau() { clearInterval(minuterie); minuterie = null; if (arret) arret(); arret = null; }

/** Rend l'accueil du compte ; renvoie false si personne n'est connecté (la page d'accueil publique s'affiche alors). */
export async function pageTableau(vue) {
  const ici = location.hash;
  const s = await session();
  if (!s) return false;
  const [profil, demandes, biens, cleaneurs] = await Promise.all([monProfil().catch(() => null), demandesDuCompte().catch(() => []),
    synchroniserBiens().catch(() => []), supabase.rpc("cleaneurs_de_mes_demandes").then(r => r.data || []).catch(() => [])]);
  if (location.hash !== ici) return true;
  const prenoms = Object.fromEntries(cleaneurs.map(c => [c.reference, c.societe ? `${c.prenom} (${c.societe})` : c.prenom]));
  const niveaux = Object.fromEntries(cleaneurs.map(c => [c.reference, c.niveau || 0]));
  const d = prochaine(demandes);
  const autres = demandes.filter(x => !FINIES.includes(x.statut) && x !== d).length;
  const taches = aFaire({ profil, demandes, biens });
  const rang = d ? RANG[d.statut] ?? 0 : -1;
  const enDirect = d && ["EN_ROUTE", "SUR_PLACE", "EN_COURS"].includes(d.statut);
  const r = d && rubrique(d.rubrique_id);
  const pro = (profil?.statuts || []).includes("pro") && profil?.espace === "pro";
  // « Refaire » (20 novembre 2026) : les prestations déjà faites, reprises avec les mêmes réglages (adresse, formule, options) ;
  // il ne reste qu'à choisir la date. Une par prestation et par adresse, les plus récentes d'abord.
  const vus = new Set();
  const refaire = demandes.filter(x => x.statut === "TERMINEE" && rubrique(x.rubrique_id) && !x.sur_devis)
    .sort((a, b) => new Date(b.creneau || b.cree_le) - new Date(a.creneau || a.cree_le))
    .filter(x => { const k = `${x.rubrique_id}|${x.rue}|${x.code_postal}`; if (vus.has(k)) return false; vus.add(k); return true; }).slice(0, 3);
  // Adresses du compte avec leur position (recherche et disponibilité locale) : logements d'abord.
  const lieux = biens.filter(l => l.ville || l.codePostal).slice(0, 8);
  decorTableau(true);
  vue.innerHTML = `<section class="tableau"><div class="conteneur">
    <div class="tableau-entete">
      <div><span class="surtitre">${esc(new Date().toLocaleDateString(LOCALE, { weekday: "long", day: "numeric", month: "long" }).replace(/^./, c => c.toUpperCase()))}</span>
        <h1>${tr("Bonjour")} ${esc(profil?.prenom || "")}</h1>
        <p class="question-accueil">${tr("Que souhaitez-vous faire aujourd'hui ?")}</p></div>
      <a class="bouton" href="#/reserver" data-choisir-prestation>${icone("ajouter")} ${tr("Réserver")}</a>
    </div>
    <form class="carte besoin-tableau" data-besoin-tableau novalidate>
      <span class="tuile-ia">${icone("instantane")}</span>
      <label class="besoin-tableau-champ"><b>${tr("De quoi avez-vous besoin ?")}</b>
        <input name="besoin" type="text" maxlength="400" placeholder="${esc(tr("Ex. : faire nettoyer mon canapé et mes vitres avant samedi"))}"></label>
      <button type="submit" class="bouton">${tr("Analyser mon besoin")}</button>
    </form>
    ${pro ? "" : `<form class="carte recherche-accueil" data-recherche-accueil novalidate>
      ${champPrestation(rubriqueConseillee(demandes))}
      <label class="champ"><span>${tr("Où ?")}</span>${lieux.length ? `<select name="lieu">${lieux.map((l, i) => `<option value="${i}">${esc(nomLogement(l))}</option>`).join("")}<option value="autre">${tr("Une autre adresse")}</option></select>` : ""}
        <input name="adresse" type="text" autocomplete="street-address" maxlength="160" placeholder="${tr("Adresse ou ville")}"${lieux.length ? " hidden" : ""}></label>
      <button type="submit" class="bouton">${tr("Rechercher")}</button>
      <p class="dispo-locale petit" data-dispo-locale aria-live="polite"></p>
    </form>
    <nav class="actions-accueil" aria-label="${tr("Raccourcis")}">
      ${enDirect ? `<a class="action-accueil vive" href="#/demande/${esc(d.reference)}/${esc(d.jeton)}">${icone("position", { tuile: true })}<b>${tr("Suivre en direct")}</b></a>` : ""}
      <a class="action-accueil" href="#/mes-demandes">${icone("calendrier", { tuile: true })}<b>${tr("Mes prestations")}</b></a>
      <a class="action-accueil" href="#/favoris">${icone("coeur", { tuile: true })}<b>${tr("Mes favoris")}</b></a>
      <a class="action-accueil" href="#/mes-biens">${icone("logement", { tuile: true })}<b>${tr("Mes biens")}</b></a>
    </nav>`}
    ${demandes.length ? "" : guideVideo("client", "particulier")}
    ${refaire.length ? `<div class="refaire"><span class="petit muet">${tr("En un geste")} :</span>${refaire.map(x => `<button type="button" class="puce-refaire" data-refaire="${esc(x.reference)}">${icone(rubrique(x.rubrique_id).icone)} ${tr("Refaire")} · ${esc(rubrique(x.rubrique_id).nom)}${x.ville ? ` · ${esc(x.ville)}` : ""}</button>`).join("")}</div>` : ""}
    <div class="tableau-grille">
      <article class="carte vivant${enDirect ? " en-direct" : ""}${d ? "" : " vide"}" data-teinte="${d ? (enDirect ? "corail" : "turquoise") : "lilas"}">
        ${d ? `<div class="vivant-haut"><span class="pastille-etat">${enDirect ? `<i></i>${tr("En direct")}` : esc(tr("Ma prochaine prestation"))}</span>
            <span class="rebours" data-rebours="${esc(d.creneau || "")}">${compteARebours(d.creneau)}</span></div>
          <div class="vivant-corps">${icone(r.icone, { tuile: true })}
            <div><h2>${esc(phrase(d, prenoms[d.reference]))}${badgeNiveau(niveaux[d.reference])}</h2>
              <p class="muet">${r.nom} · ${d.creneau ? `${dateLongue(new Date(d.creneau))} · ${heure(new Date(d.creneau).getHours())}` : tr("Date à fixer")} · ${esc(d.ville)}</p></div></div>
          <ol class="frise">${ETAPES_VIVANT.map(([, nom], i) => `<li class="${i < rang ? "fait" : i === rang ? "actif" : ""}"><span></span><b>${tr(nom)}</b></li>`).join("")}</ol>
          <div class="boutons"><a class="bouton" href="#/demande/${esc(d.reference)}/${esc(d.jeton)}">${enDirect ? tr("Suivre en direct") : tr("Voir ma prestation")}</a>
            ${autres ? `<a class="bouton secondaire" href="#/mes-demandes/a-venir">+${autres} ${tr(autres > 1 ? "autres prestations" : "autre prestation")}</a>` : ""}</div>`
        : `<div class="vivant-corps">${icone("instantane", { tuile: true })}<div><h2>${tr("Aucune prestation prévue")}</h2>
            <p class="muet">${tr("Décrivez votre besoin : le prix s'affiche tout de suite.")}</p></div></div>
          <div class="boutons"><a class="bouton" href="#/reserver" data-choisir-prestation>${tr("Réserver une prestation")}</a></div>`}
      </article>
      <article class="carte a-faire">
        <div class="a-faire-titre"><h2>${tr("À faire")}</h2>${taches.length ? `<em>${taches.length}</em>` : ""}</div>
        ${taches.length ? `<ul>${taches.map(t => `<li><a href="${t.lien}" class="${t.urgent ? "urgent" : ""}">${icone(t.icone, { tuile: true })}
            <span><b>${esc(t.titre)}</b><small>${esc(t.detail)}</small></span><i aria-hidden="true">›</i></a></li>`).join("")}</ul>`
          : `<div class="tout-va-bien">${icone("valide", { tuile: true })}<p><b>${tr("Tout est à jour")}</b><br><span class="muet">${tr("Rien ne vous attend pour l'instant.")}</span></p></div>`}
      </article>
    </div>
    ${pro ? `<div class="grille-raccourcis tableau-raccourcis">
      <a class="carte raccourci" href="#/mes-demandes">${icone("calendrier", { tuile: true })}<b>${tr("Mes prestations")}</b><span class="petit">${tr("En cours, à venir, passées")}</span></a>
      <a class="carte raccourci" href="#/mes-biens">${icone("logement", { tuile: true })}<b>${tr("Mes biens")}</b><span class="petit">${biens.length} ${tr(biens.length > 1 ? "adresses" : "adresse")}</span></a>
      <a class="carte raccourci" href="${pro ? "#/compte/pro" : "#mon-agenda"}">${icone(pro ? "location" : "calendrier", { tuile: true })}<b>${tr(pro ? "Agenda" : "Mon agenda")}</b><span class="petit">${tr(pro ? "Séjours et ménages à programmer" : "Mes prestations jour par jour")}</span></a>
    </div>` : ""}
    ${biens.length && !pro ? `<h2 class="titre-section">${icone("logement", { tuile: true })}${tr("Mes biens")}</h2>
      <div class="logements-suivi">${biens.slice(0, 6).map(l => `<div class="carte logement-suivi">${icone(iconeBien(l), { tuile: true })}
        <div class="corps"><b>${esc(nomLogement(l))}</b><span class="petit">${esc(l.rue)}, ${esc(l.ville)}</span></div>
        <button type="button" class="bouton petit" data-reserver-ici="${esc(l.id)}">${tr("Réserver")}</button></div>`).join("")}</div>` : ""}
    ${!pro && demandes.length ? `<h2 class="titre-section" id="mon-agenda">${icone("calendrier", { tuile: true })}${tr("Mon agenda")}</h2>
      <p class="petit" style="margin-top:0">${tr("Toutes vos prestations demandées, jour par jour. Sélectionnez un jour pour voir le détail.")}</p>
      <div class="carte agenda-carte" id="agenda-particulier"></div>` : ""}
    <div id="carnet-favoris"></div>
    ${pro ? "" : `<h2 class="titre-section">${icone("cle", { tuile: true })}${tr("Mon compte")}</h2>
    <div class="grille-raccourcis tableau-raccourcis">
      <a class="carte raccourci" href="#/compte/particulier" data-sous-voulu="factures">${icone("paiement", { tuile: true })}<b>${tr("Mes factures")}</b><span class="petit">${tr("PDF prêts à envoyer")}</span></a>
      <a class="carte raccourci" href="#/compte/particulier" data-sous-voulu="profil">${icone("logement", { tuile: true })}<b>${tr("Mes informations")}</b><span class="petit">${tr("Coordonnées, préférences")}</span></a>
      <a class="carte raccourci" href="#/compte/particulier" data-sous-voulu="parrainage">${icone("avis", { tuile: true })}<b>${tr("Parrainage")}</b><span class="petit">${tr("Invitez, gagnez des crédits")}</span></a>
    </div>`}
    <p class="petit direct" style="margin-top:14px"><i></i>${tr("Mis à jour en temps réel")} · <a href="#/vitrine">${tr("Voir la page d'accueil du site")}</a></p>
  </div></section>`;
  traduire(vue);
  agendaParticulier(vue.querySelector("#agenda-particulier"), { demandes, biens });
  carnetFavoris(vue.querySelector("#carnet-favoris"));
  brancherRechercheAccueil(vue, lieux);
  vue.querySelectorAll("[data-reserver-ici]").forEach(b => b.onclick = () => reserverPourLogement(b.dataset.reserverIci));
  // Cleaneroo AI depuis le tableau de bord (26/11/2026) : le besoin écrit ici part tout de suite à l'analyse.
  vue.querySelector("[data-besoin-tableau]")?.addEventListener("submit", e => {
    e.preventDefault();
    const texte = e.target.besoin.value.trim();
    import("./assistant-ia.js").then(m => m.ouvrirAssistantIA(texte, texte.length >= 3 ? { nouveau: true, envoyer: true } : {})).catch(() => null);
  });
  vue.querySelectorAll("[data-sous-voulu]").forEach(a => a.addEventListener("click", () => { try { localStorage.setItem("cleaneroo-sous-onglet-particulier", a.dataset.sousVoulu); } catch { /* rien */ } }));
  vue.querySelectorAll("[data-refaire]").forEach(b => b.onclick = () => {
    const x = refaire.find(y => y.reference === b.dataset.refaire); if (!x) return;
    const { jour, heure, creneau, ...reglages } = x.details || {};
    preremplir({ rubriqueId: x.rubrique_id, champs: { ...reglages, rue: x.rue || "", codePostal: x.code_postal || "", ville: x.ville || "", jour: "", heure: -1 } });
    location.hash = `#/reserver/${x.rubrique_id}`;
  });
  // Compte à rebours rafraîchi chaque minute ; écran redessiné à chaque changement d'une demande.
  arreterTableau();
  minuterie = setInterval(() => vue.querySelectorAll("[data-rebours]").forEach(e => { e.textContent = compteARebours(e.dataset.rebours); }), 30000);
  let attente = null;
  ecouterDemandes(() => { clearTimeout(attente); attente = setTimeout(() => { if (location.hash === ici) pageTableau(vue); }, 400); })
    .then(f => { if (location.hash === ici) arret = f; else f(); });
  return true;
}
