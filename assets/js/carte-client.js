// Recherche client « Cleaneroo près de chez vous » (#/recherche, et #/carte ; prompt 4, lots 2 et 3).
// Le client indique une prestation, un lieu et, s'il le souhaite, une date, une heure et une fréquence.
// Résultats en LISTE (prestations proposées à cette adresse) et en CARTE (secteurs couverts), à basculer d'un geste sur téléphone,
// côte à côte sur grand écran. On dit honnêtement ce qui est disponible : un Cleaneur vérifié couvre l'adresse, ou « Être prévenu ».
// Les secteurs viennent de la base (secteurs_publics), arrondis à une grille d'environ 5 km : jamais d'adresse ni de position d'un Cleaneur.
// La date, l'heure et la fréquence sont reprises telles quelles dans la réservation ; le prix exact se calcule à l'étape suivante.
import { RUBRIQUES, rubrique, FREQUENCES } from "./catalogue.js";
import { afficherCarte, chercherAdresse, maPosition, adresseDe } from "./cartes.js";
import { secteurCouvert, secteursPublics, rejoindreAttente, cleaneursPublics, reputationCleaneur } from "./donnees.js";
import { blocReputation } from "./reputation.js";
import { preremplir, reserverAvecCleaneur } from "./reserver.js";
import { badgeNiveau } from "./niveaux.js";
import { blocEtat, afficherToast } from "./commun.js";
import { icone } from "./icones.js";
import { reservationsFermees, REGLES, dateCourte } from "./regles.js";
import { tr, traduire, LOCALE } from "./langue.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const FRANCE = { lat: 46.6, lon: 2.4, zoom: 4.6 };
const CORAIL = "#F2775C";
/** Prestations cherchables (les prestations spécialisées sont toujours sur devis, partout). */
export const PRESTATIONS_RECHERCHE = () => RUBRIQUES.filter(r => r.id !== "special");
/** Heures d'arrivée proposées : celles du planning (7 h-11 h et 13 h-18 h). */
const HEURES = [7, 8, 9, 10, 11, 13, 14, 15, 16, 17, 18];
const CLE = "cleaneroo-recherche";

/** Formule régulière d'une prestation (entretien chaque semaine…), ou null. */
const formuleReguliere = r => (r?.formules || []).find(f => f.genre === "REGULIER") || null;
const lire = () => { try { return JSON.parse(sessionStorage.getItem(CLE) || "null"); } catch { return null; } };
const ecrire = e => { try { sessionStorage.setItem(CLE, JSON.stringify(e)); } catch { /* rien */ } };
/** Demain (réservation au moins 24 h à l'avance), au format AAAA-MM-JJ. */
const demain = () => { const d = new Date(Date.now() + REGLES.DELAI_MIN_RESERVATION_H * 3600e3); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

/** Lance une recherche depuis un autre écran (accueil du compte) : les critères sont repris par la page de recherche. */
export function lancerRecherche(criteres) {
  ecrire({ ...etatVierge(), ...criteres });
  location.hash = "#/recherche";
}
const etatVierge = () => ({ rubriqueId: "home", adresse: null, jour: "", heure: -1, frequence: "unique", vue: "liste" });

/** Sélecteurs partagés (page de recherche et accueil du compte). */
export const champPrestation = (choisie, toutes = false) => `<label class="champ"><span>Prestation</span><select name="rubrique">
    ${toutes ? `<option value=""${choisie ? "" : " selected"}>Toutes les prestations</option>` : ""}
    ${PRESTATIONS_RECHERCHE().map(r => `<option value="${r.id}"${r.id === choisie ? " selected" : ""}>${esc(r.nom)}</option>`).join("")}</select></label>`;

/* ------------------------------------------------------------------ Fiches Cleaneur (prompt 4, lot 5)
   Seulement ce qu'une fiche publique montre (fonction cleaneurs_publics) : prénom et initiale, note et avis, prestations réalisées,
   niveau, Pro, prestations, prochains jours disponibles, mois d'inscription, distance arrondie. Jamais d'adresse ni de position. */
const nomCleaneur = c => `${c.prenom || ""}${c.initiale ? ` ${c.initiale}.` : ""}`.trim();
const noteTxt = c => (c.note ? `★ ${String(c.note).replace(".", ",")} <span class="muet">(${c.nb_avis} ${tr("avis")})</span>` : `<span class="cleaneur-nouveau">${tr("Nouveau sur Cleaneroo")}</span>`);
const distanceTxt = c => `${tr("à moins de")} ${c.distance_km} km`;
const moisTxt = d => new Date(d + "T12:00").toLocaleDateString(LOCALE, { month: "long", year: "numeric" });
const joursTxt = c => (c.prochains_jours || []).slice(0, 4).map(j => `<span class="puce-jour">${esc(dateCourte(new Date(j + "T12:00")))}</span>`).join("");

/** Carte courte d'un Cleaneur dans la liste des résultats. */
export const carteCleaneur = c => `<button type="button" class="carte-cleaneur-mini" data-fiche="${esc(c.cleaneur_id)}" aria-haspopup="dialog">
    <span class="avatar-cleaneur" aria-hidden="true">${esc((c.prenom || "?").charAt(0).toUpperCase())}</span>
    <span class="corps"><b>${esc(nomCleaneur(c))}${c.pro ? ` <span class="badge marque">Pro</span>` : ""}</b>
      <span class="petit">${noteTxt(c)} · ${c.realisees} ${tr(c.realisees > 1 ? "prestations" : "prestation")} · ${distanceTxt(c)}</span>
      ${(c.prochains_jours || []).length ? `<span class="jours-cleaneur">${joursTxt(c)}</span>` : ""}</span>
    <span class="aller" aria-hidden="true">›</span></button>`;

/** Fiche complète, en fenêtre : confiance, disponibilités, prestations, puis « Réserver avec … ». */
function ficheCleaneur(c, rubriqueId) {
  const r = rubrique(rubriqueId);
  const presta = (c.prestations || []).map(id => rubrique(id)).filter(Boolean);
  return `<div class="fiche-cleaneur" role="dialog" aria-modal="true" aria-labelledby="titre-fiche">
    <div class="fiche-fond" data-fermer-fiche></div>
    <article class="fiche-corps carte">
      <button type="button" class="lien-bouton fiche-fermer" data-fermer-fiche>${tr("Fermer")}</button>
      <header class="fiche-tete"><span class="avatar-cleaneur grand" aria-hidden="true">${esc((c.prenom || "?").charAt(0).toUpperCase())}</span>
        <div><h2 id="titre-fiche">${esc(nomCleaneur(c))}</h2>
          <p class="fiche-badges">${c.pro ? `<span class="badge marque">${tr("Cleaneur Pro")}</span>` : ""}${badgeNiveau(c.niveau)}<span class="badge succes">${icone("garantie")} ${tr("Dossier vérifié")}</span></p></div></header>
      <div class="fiche-chiffres">
        <div><b>${c.note ? String(c.note).replace(".", ",") : "–"}</b><span>${c.note ? `${c.nb_avis} ${tr("avis")}` : tr("Pas encore d'avis")}</span></div>
        <div><b>${c.realisees}</b><span>${tr(c.realisees > 1 ? "prestations réalisées" : "prestation réalisée")}</span></div>
        <div><b>${c.distance_km} km</b><span>${tr("au plus, de chez vous")}</span></div>
      </div>
      <p class="petit muet fiche-verif">${tr("Identité, SIRET, assurance RC Pro et attestation URSSAF vérifiés par Cleaneroo.")} ${tr("Sur Cleaneroo depuis")} ${esc(moisTxt(c.inscrit_le))}.</p>
      <div data-reputation-fiche><p class="petit muet">${tr("Chargement des avis…")}</p></div>
      <h3>${tr("Prochaines disponibilités")}</h3>
      ${(c.prochains_jours || []).length ? `<p class="jours-cleaneur">${joursTxt(c)}</p><p class="petit muet" style="margin:4px 0 0">${tr("Jours où ce Cleaneur a ouvert des créneaux. Le créneau exact se choisit à la réservation.")}</p>`
        : `<p class="petit muet">${tr("Pas de créneaux publiés pour les 3 prochaines semaines : votre demande lui est proposée, il répond selon son planning.")}</p>`}
      <h3>${tr("Prestations proposées")}</h3>
      <ul class="fiche-prestas">${presta.map(x => `<li class="${x.id === rubriqueId ? "choisie" : ""}">${icone(x.icone)} ${esc(x.nom)}</li>`).join("")}</ul>
      <div class="fiche-action">
        <button type="button" class="bouton plein" data-reserver-avec="${esc(c.cleaneur_id)}">${tr(reservationsFermees() ? "Estimer avec" : "Réserver avec")} ${esc(c.prenom || "")}</button>
        <p class="petit muet">${esc(r.nom)} · ${tr("La demande lui est proposée d'abord : il est seul à la voir pendant 2 h à 12 h selon la date de la prestation. S'il n'est pas disponible, elle s'ouvre aussitôt aux autres Cleaneurs vérifiés.")}</p>
      </div>
    </article></div>`;
}

export function pageCarteClient() {
  const e = { ...etatVierge(), ...(lire() || {}) };
  const r = rubrique(e.rubriqueId);
  return `<section class="fond-cleaneroo" style="padding:36px 0 64px"><div class="conteneur">
      <h1>Cleaneroo près de chez vous</h1><div class="trait-corail"></div>
      <p>Choisissez une prestation et votre adresse : vous savez tout de suite si un Cleaneur vérifié intervient chez vous.</p></div></section>
    <section class="bloc" style="padding-top:0"><div class="conteneur page-carte">
      <form class="carte carte-client-recherche" data-recherche novalidate>
        <div class="recherche-ligne">
          ${champPrestation(e.rubriqueId, true)}
          <label class="champ champ-adresse"><span>Votre adresse ou votre ville</span><input name="adresse" type="text" autocomplete="street-address" maxlength="160" placeholder="12 rue des Pins, 83700 Saint-Raphaël" value="${esc(e.adresse?.texte || e.adresse?.libelle || "")}"></label>
          <div class="carte-client-actions"><button type="submit" class="bouton">Rechercher</button>
            <button type="button" class="bouton secondaire" data-position aria-label="Utiliser ma position">${icone("position")} <span>Ma position</span></button></div>
        </div>
        <details class="recherche-plus"${e.jour || e.heure >= 0 || e.frequence !== "unique" ? " open" : ""}><summary>Date, heure et fréquence <span class="petit muet">(facultatif)</span></summary>
          <div class="recherche-ligne secondaire">
            <label class="champ"><span>Date</span><input name="jour" type="date" min="${demain()}" value="${esc(e.jour)}"></label>
            <label class="champ"><span>Heure d'arrivée</span><select name="heure"><option value="-1">Indifférente</option>
              ${HEURES.map(h => `<option value="${h}"${h === e.heure ? " selected" : ""}>${h} h</option>`).join("")}</select></label>
            <label class="champ" data-champ-frequence${r && !formuleReguliere(r) ? " hidden" : ""}><span>Fréquence</span><select name="frequence">
              <option value="unique">Une seule fois</option>
              ${FREQUENCES.filter(([id]) => id !== "plusieurs").map(([id, nom]) => `<option value="${id}"${id === e.frequence ? " selected" : ""}>${nom}</option>`).join("")}</select></label>
          </div>
          <p class="petit muet" style="margin:0">Repris tels quels dans votre réservation. Le prix exact se calcule ensuite, selon votre logement.</p>
        </details>
      </form>
      <div class="segments bascule-vue" role="group" aria-label="Affichage des résultats">
        <button type="button" data-vue="liste" aria-pressed="${e.vue !== "carte"}" class="${e.vue !== "carte" ? "choisi" : ""}">Liste</button>
        <button type="button" data-vue="carte" aria-pressed="${e.vue === "carte"}" class="${e.vue === "carte" ? "choisi" : ""}">Carte</button>
      </div>
      <div class="carte-client-corps" data-vue-active="${e.vue === "carte" ? "carte" : "liste"}">
        <div class="carte-client-resultat" data-resultat aria-live="polite"></div>
        <div class="carte-client-cadre"><div class="carte-client-boite" data-boite role="region" aria-label="Carte des secteurs couverts"></div></div>
      </div>
      <p class="petit muet carte-client-note">${icone("garantie")} Les secteurs sont approximatifs (à quelques kilomètres près) : la position d'un Cleaneur n'est jamais affichée.</p>
    </div></section>`;
}

export function brancherCarteClient(vue) {
  const racine = vue.querySelector(".page-carte");
  if (!racine) return;
  const form = racine.querySelector("[data-recherche]"), boite = racine.querySelector("[data-boite]"), zone = racine.querySelector("[data-resultat]");
  const corps = racine.querySelector(".carte-client-corps");
  const etat = { ...etatVierge(), ...(lire() || {}), dispo: null, secteurs: null, attente: {}, ouvert: "", cleaneurs: {} };
  let jeton = 0, jetonSecteurs = 0, carte = null;
  const sauver = () => ecrire({ rubriqueId: etat.rubriqueId, adresse: etat.adresse, jour: etat.jour, heure: etat.heure, frequence: etat.frequence, vue: etat.vue });

  const dessiner = async () => {
    const marqueurs = etat.adresse ? [{ lat: etat.adresse.lat, lon: etat.adresse.lon, couleur: CORAIL, texte: "", titre: tr("Votre adresse") }] : [];
    const zones = (etat.secteurs || []).map(z => ({ lat: z.lat, lon: z.lon, km: Math.min(z.rayon_km || 20, 50) }));
    carte = await afficherCarte(boite, { marqueurs, zones, zoom: 11, vue: FRANCE }).catch(() => null);
  };

  /** Une prestation dans la liste des résultats. */
  const ligne = (r, n, principale) => {
    const fermees = reservationsFermees();
    const statut = n === null ? `<span class="badge info">${tr("Vérification…")}</span>`
      : n < 0 ? `<span class="badge erreur">${tr("Vérification indisponible")}</span>`
      : n > 0 ? `<span class="badge succes">${icone("valide")} ${n} ${tr(n > 1 ? "Cleaneurs vérifiés" : "Cleaneur vérifié")}</span>`
      : `<span class="badge alerte">${tr("Pas encore disponible")}</span>`;
    const att = etat.attente[r.id] || "";
    const formulaire = n === 0 && (principale || etat.ouvert === r.id) ? (att === "ok"
      ? `<p class="succes-ligne">${icone("valide")} ${tr("C'est enregistré. Nous vous prévenons par e-mail dès qu'un Cleaneur qualifié intervient dans votre secteur.")}</p>`
      : `<form data-attente="${r.id}" class="attente-ligne" novalidate>
          <p class="petit" style="margin:0 0 8px">${tr("Nous recrutons dans votre secteur. Laissez votre e-mail : nous vous prévenons dès qu'un Cleaneur qualifié s'installe près de chez vous. Rien à payer.")}</p>
          <div class="grille-2"><label class="champ"><span>${tr("Prénom")}</span><input name="prenom" autocomplete="given-name" maxlength="80"></label>
            <label class="champ"><span>${tr("E-mail")}</span><input name="email" type="email" autocomplete="email" maxlength="200" required></label></div>
          ${att === "erreur" ? `<p class="erreur">${tr("Le service est momentanément indisponible. Réessayez dans quelques minutes.")}</p>` : ""}
          <button type="submit" class="bouton"${att === "envoi" ? " disabled" : ""}>${tr(att === "envoi" ? "Envoi en cours…" : "Être prévenu")}</button></form>`) : "";
    const action = n > 0 ? `<button type="button" class="bouton${principale ? "" : " secondaire"}" data-reserver="${r.id}">${tr(fermees ? "Estimer le prix" : "Réserver")}</button>`
      : n === 0 && !principale && etat.ouvert !== r.id ? `<button type="button" class="lien-bouton" data-ouvrir="${r.id}">${tr("Être prévenu")}</button>`
      : n < 0 ? `<button type="button" class="lien-bouton" data-reessayer>${tr("Réessayer")}</button>` : "";
    return `<article class="carte resultat-presta${principale ? " principale" : ""}${n > 0 ? " dispo" : ""}">
        <div class="resultat-tete">${icone(r.icone, { tuile: true })}<div class="corps"><h3>${esc(r.nom)}</h3><p class="petit muet">${esc(r.sousTitre || "")}</p></div></div>
        <div class="resultat-pied">${statut}${action}</div>${formulaire}${principale && n > 0 ? blocCleaneurs(r.id) : ""}</article>`;
  };

  /** Cleaneurs de la prestation choisie, sous sa carte : « ou choisissez votre Cleaneur ». */
  const blocCleaneurs = id => {
    const l = etat.cleaneurs[id];
    if (l === undefined) { chargerCleaneurs(id); return `<div class="cleaneurs-resultat"><div class="squelette squelette-ligne"></div></div>`; }
    if (l === "chargement") return `<div class="cleaneurs-resultat"><div class="squelette squelette-ligne"></div></div>`;
    if (!l || !l.length) return "";
    return `<div class="cleaneurs-resultat"><p class="titre-cleaneurs">${tr("Ou choisissez votre Cleaneur")}</p>${l.slice(0, 6).map(carteCleaneur).join("")}
      ${l.length > 6 ? `<p class="petit muet">+${l.length - 6} ${tr("autres Cleaneurs vérifiés dans votre secteur")}</p>` : ""}</div>`;
  };
  const chargerCleaneurs = async id => {
    if (!etat.adresse) return;
    etat.cleaneurs[id] = "chargement";
    const cle = `${etat.adresse.lat}|${etat.adresse.lon}`;
    const l = await cleaneursPublics(id, etat.adresse.lat, etat.adresse.lon).catch(() => null);
    if (!etat.adresse || `${etat.adresse.lat}|${etat.adresse.lon}` !== cle) return;
    etat.cleaneurs[id] = l || [];
    resultat();
  };
  const ouvrirFiche = cid => {
    const c = Object.values(etat.cleaneurs).flat().find(x => x && x.cleaneur_id === cid);
    if (!c) return;
    const declencheur = document.activeElement;
    const f = document.createElement("div");
    f.innerHTML = ficheCleaneur(c, etat.rubriqueId);
    const fiche = f.firstElementChild;
    document.body.append(fiche);
    traduire(fiche);
    const fermer = () => { fiche.remove(); document.removeEventListener("keydown", echap); declencheur?.focus?.(); };
    const echap = e => { if (e.key === "Escape") fermer(); };
    document.addEventListener("keydown", echap);
    window.addEventListener("hashchange", fermer, { once: true });
    fiche.addEventListener("click", e => {
      if (e.target.closest("[data-fermer-fiche]")) return fermer();
      if (e.target.closest("[data-reserver-avec]")) { lireCriteres(); reserverAvecCleaneur(etat.rubriqueId, c, champsReservation(etat.rubriqueId)); }
    });
    fiche.querySelector(".fiche-fermer")?.focus();
    // Réputation détaillée (lot 7) : répartition, critères, satisfaction, avis récents.
    reputationCleaneur(c.cleaneur_id).catch(() => null).then(rep => {
      const z = fiche.querySelector("[data-reputation-fiche]");
      if (!z?.isConnected) return;
      z.innerHTML = rep ? blocReputation(rep) : `<p class="petit muet">${tr("Les avis ne peuvent pas être affichés pour le moment.")}</p>`;
      traduire(z);
    });
  };

  const resultat = () => {
    const toutes = !etat.rubriqueId;
    if (!etat.adresse) {
      const n = etat.secteurs?.length || 0;
      zone.innerHTML = blocEtat({ icone: "position", compact: true, titre: tr("Où souhaitez-vous l'intervention ?"),
        texte: n ? `${n} ${tr(n > 1 ? "secteurs couverts" : "secteur couvert")}${toutes ? "" : ` ${tr("pour")} ${esc(rubrique(etat.rubriqueId).nom)}`}. ${tr("Saisissez votre adresse pour vérifier la vôtre.")}`
          : tr("Saisissez votre adresse ou utilisez votre position. Nous vérifions si un Cleaneur vérifié couvre votre secteur.") });
      return;
    }
    const d = etat.dispo || {};
    const liste = PRESTATIONS_RECHERCHE();
    const principale = toutes ? null : rubrique(etat.rubriqueId);
    const autres = liste.filter(r => r !== principale);
    const dispo = autres.filter(r => d[r.id] > 0), pasEncore = autres.filter(r => d[r.id] === 0), enCours = autres.filter(r => d[r.id] === null || d[r.id] === undefined || d[r.id] < 0);
    const chargement = !Object.keys(d).length || liste.some(r => d[r.id] === null || d[r.id] === undefined);
    const panne = !chargement && liste.every(r => d[r.id] < 0);
    zone.innerHTML = `<p class="resultat-adresse">${icone("position")} <b>${esc(etat.adresse.libelle || etat.adresse.texte)}</b>
        ${etat.jour ? ` · ${esc(new Date(etat.jour + "T12:00").toLocaleDateString(LOCALE, { weekday: "long", day: "numeric", month: "long" }))}${etat.heure >= 0 ? ` · ${etat.heure} h` : ""}` : ""}</p>
      ${principale ? ligne(principale, d[principale.id] ?? null, true) : ""}
      ${dispo.length ? `<h2 class="titre-resultats">${tr(principale ? "Aussi proposé à cette adresse" : "Proposé à cette adresse")} <em>${dispo.length}</em></h2>${dispo.map(r => ligne(r, d[r.id], false)).join("")}` : ""}
      ${chargement && enCours.length ? `<div class="squelette-carte" aria-hidden="true"><div class="squelette squelette-titre"></div><div class="squelette squelette-ligne"></div></div>` : ""}
      ${panne && toutes ? blocEtat({ icone: "alerte", erreur: true, compact: true, titre: tr("Vérification indisponible"), texte: tr("Le service ne répond pas pour le moment. Réessayez dans quelques minutes."),
        action: `<button type="button" class="bouton secondaire" data-reessayer>${tr("Réessayer")}</button>` }) : ""}
      ${!chargement && !panne && toutes && !dispo.length ? blocEtat({ icone: "position", compact: true, titre: tr("Pas encore de Cleaneur à cette adresse"),
        texte: tr("Nous recrutons dans votre secteur. Choisissez la prestation qui vous intéresse pour être prévenu dès qu'un Cleaneur qualifié s'installe près de chez vous.") }) : ""}
      ${!chargement && pasEncore.length ? `<details class="pas-encore"><summary>${pasEncore.length} ${tr(pasEncore.length > 1 ? "prestations pas encore proposées ici" : "prestation pas encore proposée ici")}</summary>
        ${pasEncore.map(r => ligne(r, 0, false)).join("")}</details>` : ""}`;
    if (etat.ouvert) { const det = zone.querySelector(".pas-encore"); if (det && det.querySelector(`[data-attente="${etat.ouvert}"]`)) det.open = true; }
  };

  const verifier = async () => {
    if (!etat.adresse) { resultat(); return; }
    const moi = ++jeton;
    etat.dispo = {}; resultat();
    const { lat, lon } = etat.adresse;
    // Une vérification par prestation, en parallèle ; la liste se remplit au fur et à mesure.
    const ordre = [etat.rubriqueId, ...PRESTATIONS_RECHERCHE().map(r => r.id).filter(id => id !== etat.rubriqueId)].filter(Boolean);
    await Promise.all(ordre.map(id => secteurCouvert(id, lat, lon).catch(() => null).then(n => {
      if (moi !== jeton) return;
      etat.dispo[id] = n === null || n === undefined ? -1 : n;
      resultat();
    })));
  };

  const chargerSecteurs = async () => {
    const moi = ++jetonSecteurs;
    const s = await secteursPublics(etat.rubriqueId || null).catch(() => null);
    if (moi !== jetonSecteurs) return;
    etat.secteurs = s || [];
    dessiner(); if (!etat.adresse) resultat();
  };

  const placer = async (a, texte = "") => {
    if (!a) { afficherToast("Adresse introuvable. Précisez la rue ou le code postal.", "erreur"); return; }
    etat.adresse = { lat: a.lat, lon: a.lon, texte, rue: a.rue || "", codePostal: a.codePostal || "", ville: a.ville || "",
      libelle: [a.rue, [a.codePostal, a.ville].filter(Boolean).join(" ")].filter(Boolean).join(", ") };
    if (!form.adresse.value.trim()) form.adresse.value = etat.adresse.libelle;
    etat.attente = {}; etat.ouvert = ""; etat.cleaneurs = {};
    sauver(); dessiner();
    await verifier();
  };

  const lireCriteres = () => {
    etat.jour = form.jour.value && form.jour.value >= demain() ? form.jour.value : "";
    etat.heure = Number(form.heure.value);
    etat.frequence = form.frequence.value;
    sauver();
  };

  const basculer = v => {
    etat.vue = v; sauver();
    corps.dataset.vueActive = v;
    racine.querySelectorAll("[data-vue]").forEach(b => { const oui = b.dataset.vue === v; b.classList.toggle("choisi", oui); b.setAttribute("aria-pressed", String(oui)); });
    if (v === "carte") requestAnimationFrame(() => { try { (carte?.carte || carte)?.resize?.(); (carte?.carte || carte)?.invalidateSize?.(); carte?.recadrer?.(); } catch { /* rien */ } });
  };

  /** Adresse, date, heure et fréquence de la recherche, repris dans la réservation. */
  const champsReservation = id => {
    const r = rubrique(id), a = etat.adresse, reg = formuleReguliere(r);
    return { rue: a.rue || "", codePostal: a.codePostal || "", ville: a.ville || "", lat: a.lat, lon: a.lon,
      jour: etat.jour || "", heure: etat.jour && etat.heure >= 0 ? etat.heure : -1,
      ...(reg && etat.frequence !== "unique" ? { formuleId: reg.id, frequence: etat.frequence } : {}) };
  };
  const reserver = id => {
    if (!rubrique(id) || !etat.adresse) return;
    lireCriteres();
    preremplir({ rubriqueId: id, champs: champsReservation(id) });
    location.hash = `#/reserver/${id}`;
  };

  form.addEventListener("submit", async e => {
    e.preventDefault();
    lireCriteres();
    const q = form.adresse.value.trim();
    if (q.length < 3) { form.adresse.focus(); afficherToast("Saisissez une adresse ou une ville.", "info"); return; }
    if (etat.adresse && q === (etat.adresse.texte || etat.adresse.libelle)) { await verifier(); return; }
    await placer(await chercherAdresse(q), q);
  });
  form.rubrique.addEventListener("change", async () => {
    etat.rubriqueId = form.rubrique.value; etat.secteurs = null; etat.ouvert = "";
    const r = rubrique(etat.rubriqueId);
    form.querySelector("[data-champ-frequence]").hidden = !!r && !formuleReguliere(r);
    sauver();
    chargerSecteurs();
    resultat();   // l'ordre de la liste change tout de suite ; les disponibilités sont déjà connues
  });
  ["jour", "heure", "frequence"].forEach(n => form[n].addEventListener("change", () => { lireCriteres(); if (etat.adresse) resultat(); }));
  form.querySelector("[data-position]").addEventListener("click", async () => {
    try {
      const p = await maPosition();
      const a = await adresseDe(p.lat, p.lon);
      form.adresse.value = "";
      await placer(a || { ...p, rue: "", codePostal: "", ville: "" });
    } catch (err) {
      afficherToast(err?.message === "refus" ? "Position refusée : saisissez votre adresse." : "Position indisponible : saisissez votre adresse.", "info");
    }
  });
  racine.querySelectorAll("[data-vue]").forEach(b => b.addEventListener("click", () => basculer(b.dataset.vue)));
  zone.addEventListener("click", e => {
    const fiche = e.target.closest("[data-fiche]");
    if (fiche) return ouvrirFiche(fiche.dataset.fiche);
    const t = e.target.closest("[data-reserver], [data-ouvrir], [data-reessayer]");
    if (!t) return;
    if (t.dataset.reserver) reserver(t.dataset.reserver);
    else if (t.dataset.ouvrir) { etat.ouvert = t.dataset.ouvrir; resultat(); zone.querySelector(`[data-attente="${etat.ouvert}"] input[name=email]`)?.focus(); }
    else verifier();
  });
  zone.addEventListener("submit", async e => {
    const f = e.target.closest("[data-attente]");
    if (!f) return;
    e.preventDefault();
    const id = f.dataset.attente, email = f.email.value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { f.email.focus(); afficherToast("Saisissez une adresse e-mail valide.", "erreur"); return; }
    etat.attente[id] = "envoi"; resultat();
    try {
      await rejoindreAttente({ rubriqueId: id, codePostal: etat.adresse.codePostal, ville: etat.adresse.ville, lat: etat.adresse.lat, lon: etat.adresse.lon, prenom: f.prenom.value.trim(), email });
      etat.attente[id] = "ok";
    } catch { etat.attente[id] = "erreur"; }
    resultat();
  });

  resultat();
  dessiner();
  chargerSecteurs();
  if (etat.adresse) verifier();
  traduire(racine);
}
