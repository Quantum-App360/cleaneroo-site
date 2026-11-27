// « Mes espaces » (27/11/2026, validé par Michael) : un compte à un seul profil découvre l'autre espace (#/espace/<id>) et y adhère
// sans recréer de compte. Présentation (vitrine-espaces.js), simulateur de chiffre d'affaires pour devenir Cleaneur (molette),
// étapes, questions fréquentes et adhésion intégrée (ajouter_statut). Tous les montants viennent du moteur de prix (estimation.js)
// et de gainCleaneur (regles.js) : aucun chiffre écrit à la main, et aucune promesse de volume de missions.
import { monProfil, majProfil, ajouterStatut } from "./donnees.js";
import { memoriserProfil, rendreEntete } from "./entete.js";
import { fixerMode } from "./mode.js";
import { REGLES, euros, duree, gainCleaneur, sirenSiretValide } from "./regles.js";
import { calculer, entreeEstimation } from "./estimation.js";
import { brouillonExemple } from "./reserver.js";
import { vitrineEspace } from "./vitrine-espaces.js";
import { rubrique } from "./catalogue.js";
import { icone } from "./icones.js";
import { tr, traduire } from "./langue.js";
import { esc } from "./commun.js";
import { blocQuiAttendent } from "./attente.js";

export const ESPACES = ["particulier", "cleaneur", "entreprise", "pro", "hotellerie"];
const NOMS = { particulier: "Espace Particulier", cleaneur: "Espace Cleaneur", entreprise: "Espace Entreprise", pro: "Espace Conciergerie", hotellerie: "Espace Hôtels et campings" };
/** Missions types du simulateur : prix et durée calculés comme pour un client (moteur de prix). */
export const MISSIONS_TYPES = ["rental", "home", "windows", "car"];
const SEMAINES_PAR_MOIS = 52 / 12;
/** Hypothèse affichée du mode « Mon planning » : une demi-journée = 4 h, 30 min de trajet entre deux missions. */
export const DEMI_JOURNEE_MIN = 240, TRAJET_MIN = 30;

const unites = {};
/** Prix, durée et gain d'une mission type, pour les deux formules (centimes). */
export function uniteMission(id) {
  if (!unites[id]) {
    const est = calculer(entreeEstimation({ ...brouillonExemple(id, {}) }, false, null));
    unites[id] = { prixC: est.totalC, dureeMin: est.dureeMin, gratuit: gainCleaneur(est.totalC, est.dureeMin, "gratuit"), pro: gainCleaneur(est.totalC, est.dureeMin, "pro") };
  }
  return unites[id];
}

/** Bilan d'un mois (fonction pure, testée) : missions par type → chiffre d'affaires, commission, frais, cotisations, reste, heures,
 *  pour la formule Gratuite et la formule Pro (abonnement déduit). */
export function bilanMensuel(missionsMois) {
  const b = f => {
    let caC = 0, verseC = 0, stripeC = 0, cotisationsC = 0, resteC = 0, minutes = 0, n = 0;
    for (const [id, nb] of Object.entries(missionsMois)) {
      if (!nb) continue;
      const u = uniteMission(id), g = u[f];
      caC += u.prixC * nb; verseC += g.verseC * nb; stripeC += g.stripeC * nb; cotisationsC += g.cotisationsC * nb; resteC += g.resteC * nb;
      minutes += u.dureeMin * nb; n += nb;
    }
    const abonnementC = f === "pro" && n ? REGLES.ABONNEMENT_CLEANEUR_C : 0;
    resteC -= abonnementC;
    return { missions: n, caC, commissionC: caC - verseC, stripeC, cotisationsC, abonnementC, resteC, minutes, horaireNetC: minutes ? Math.round(resteC * 60 / minutes) : 0 };
  };
  const gratuit = b("gratuit"), pro = b("pro");
  return { gratuit, pro, meilleure: pro.resteC > gratuit.resteC ? "pro" : "gratuit" };
}

/** Mode « Mon objectif » : missions par mois nécessaires pour garder `objectifC` par mois avec ce type de mission. */
export function missionsPourObjectif(id, objectifC) {
  const u = uniteMission(id);
  const g = Math.ceil(objectifC / Math.max(1, u.gratuit.resteC));
  const p = Math.ceil((objectifC + REGLES.ABONNEMENT_CLEANEUR_C) / Math.max(1, u.pro.resteC));
  return Math.min(g, p);
}
/** Mode « Mon planning » : missions par mois selon les demi-journées libres d'une semaine type. */
export function missionsPourPlanning(id, demiJournees) {
  const u = uniteMission(id);
  const parDemi = Math.max(1, Math.floor(DEMI_JOURNEE_MIN / (u.dureeMin + TRAJET_MIN)));
  return Math.round(demiJournees * parDemi * SEMAINES_PAR_MOIS);
}
/** Plus petit nombre de missions par mois à partir duquel la formule Pro rapporte plus (même type de mission), ou null. */
export function seuilPro(id) {
  for (let n = 1; n <= 200; n++) { const b = bilanMensuel({ [id]: n }); if (b.pro.resteC > b.gratuit.resteC) return n; }
  return null;
}

// Compatibilité (tests du 27/11/2026) : simulation simple d'un type de mission.
export function simulerCA(rubriqueId, missionsParSemaine, formule = "gratuit") {
  const n = Math.max(0, Math.round(missionsParSemaine * SEMAINES_PAR_MOIS));
  const u = uniteMission(rubriqueId), b = bilanMensuel({ [rubriqueId]: n })[formule];
  return { prixC: u.prixC, dureeMin: u.dureeMin, missionsMois: n, caC: b.caC, resteC: b.resteC, abonnementC: b.abonnementC, heures: b.minutes / 60, horaireNetC: b.horaireNetC };
}

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const nomType = id => esc(tr(rubrique(id)?.nom || id));
const choixType = attr => `<select ${attr}>${MISSIONS_TYPES.map(id => `<option value="${id}">${nomType(id)}</option>`).join("")}</select>`;

function blocSimulateur() {
  return `<div class="carte teintee simulateur-ca" id="simulateur-ca">
    <h2 class="titre-section" style="margin-top:0">${icone("paiement", { tuile: true })}${tr("Simulez votre chiffre d'affaires")}</h2>
    <div class="onglets-sim" role="tablist">${[["objectif", "Mon objectif"], ["planning", "Mon planning"], ["mix", "Mon mix"]].map(([id, n], i) =>
      `<button type="button" role="tab" data-sim-mode="${id}" aria-selected="${i === 0}" class="${i === 0 ? "choisi" : ""}">${tr(n)}</button>`).join("")}</div>
    <div data-panneau="objectif">
      <label class="champ"><span>${tr("Ce que je veux garder par mois")} : <b data-val-objectif></b></span>
        <input type="range" min="300" max="4000" step="50" value="1500" data-sim-objectif aria-label="${tr("Ce que je veux garder par mois")}"></label>
      <label class="champ"><span>${tr("Type de mission")}</span>${choixType("data-sim-type-objectif")}</label></div>
    <div data-panneau="planning" hidden>
      <p class="petit" style="margin:0 0 6px">${tr("Touchez vos demi-journées libres dans une semaine type.")}</p>
      <div class="planning-sim">${JOURS.map((j, d) => `<div class="jour-sim"><b>${tr(j)}</b>${["matin", "apres-midi"].map(m =>
        `<button type="button" data-demi="${d}-${m}" aria-pressed="false">${tr(m === "matin" ? "Matin" : "Après-midi")}</button>`).join("")}</div>`).join("")}</div>
      <label class="champ"><span>${tr("Type de mission")}</span>${choixType("data-sim-type-planning")}</label>
      <p class="petit muet" style="margin:0">${tr("Une demi-journée compte 4 h, avec 30 min de trajet entre deux missions.")}</p></div>
    <div data-panneau="mix" hidden>${MISSIONS_TYPES.map((id, i) => `<label class="champ"><span>${nomType(id)} : <b data-val-mix="${id}">${i === 0 ? 5 : 0}</b> ${tr("par semaine")}</span>
      <input type="range" min="0" max="15" step="1" value="${i === 0 ? 5 : 0}" data-sim-mix="${id}"></label>`).join("")}</div>
    <div class="sim-resultats" data-sim-resultats aria-live="polite"></div>
    <p class="petit muet" style="margin:10px 0 0">${tr("Estimation par mois, pour une micro-entreprise de services, sans ACRE ni versement libératoire : prix calculés comme pour un client, après commission, frais de paiement et cotisations URSSAF estimées. Le nombre de missions dépend de la demande dans votre secteur et de vos disponibilités : ce n'est pas une garantie. Pourboires en plus, trajets non comptés.")}</p>
  </div>`;
}

function graphiqueAnnuel(b) {
  const f = b[b.meilleure];
  const mois = Array.from({ length: 12 }, (_, i) => i + 1);
  const max = Math.max(1, f.caC * 12);
  return `<div class="graph-annuel"><p class="petit" style="margin:12px 0 6px"><b>${tr("Sur 12 mois")}</b> (${tr(b.meilleure === "pro" ? "formule Pro" : "formule Gratuite")}) : ${euros(f.resteC * 12)} ${tr("pour vous")}, ${euros(f.caC * 12)} ${tr("de chiffre d'affaires")}</p>
    <div class="barres-annee">${mois.map(m => `<div class="barre-mois" title="${tr("Mois")} ${m}"><span class="b-reste" style="height:${Math.max(0, f.resteC * m) / max * 100}%"></span><span class="b-charges" style="height:${(f.stripeC + f.cotisationsC + f.abonnementC) * m / max * 100}%"></span><span class="b-commission" style="height:${f.commissionC * m / max * 100}%"></span></div>`).join("")}</div>
    <p class="petit muet" style="margin:4px 0 0"><span class="leg b-reste"></span>${tr("Pour vous")} <span class="leg b-charges"></span>${tr("Cotisations et frais")} <span class="leg b-commission"></span>${tr("Commission Cleaneroo")} · ${tr("cumul mois après mois")}</p></div>`;
}

function majSimulateur(zone) {
  const mode = zone.querySelector("[data-sim-mode][aria-selected=true]")?.dataset.simMode || "objectif";
  zone.querySelectorAll("[data-panneau]").forEach(p => p.hidden = p.dataset.panneau !== mode);
  let missions = {}, intro = "";
  if (mode === "objectif") {
    const obj = Number(zone.querySelector("[data-sim-objectif]").value) * 100, id = zone.querySelector("[data-sim-type-objectif]").value;
    zone.querySelector("[data-val-objectif]").textContent = euros(obj);
    const n = missionsPourObjectif(id, obj);
    missions = { [id]: n };
    intro = `<p class="sim-phrase">${tr("Pour garder")} <b>${euros(obj)}</b> ${tr("par mois, il vous faut environ")} <b>${n} ${tr("missions par mois")}</b>, ${tr("soit")} <b>${(n / SEMAINES_PAR_MOIS).toFixed(1).replace(".", ",")} ${tr("par semaine")}</b>.</p>`;
  } else if (mode === "planning") {
    const id = zone.querySelector("[data-sim-type-planning]").value, d = zone.querySelectorAll("[data-demi][aria-pressed=true]").length;
    missions = { [id]: missionsPourPlanning(id, d) };
    intro = `<p class="sim-phrase">${d} ${tr(d > 1 ? "demi-journées libres par semaine" : "demi-journée libre par semaine")} : ${tr("environ")} <b>${missions[id]} ${tr("missions par mois")}</b>.</p>`;
  } else {
    zone.querySelectorAll("[data-sim-mix]").forEach(r => { zone.querySelector(`[data-val-mix="${r.dataset.simMix}"]`).textContent = r.value; missions[r.dataset.simMix] = Math.round(Number(r.value) * SEMAINES_PAR_MOIS); });
  }
  const b = bilanMensuel(missions);
  const ligne = (lib, f, cl = "") => `<div class="sim-ligne ${cl}"><span>${tr(lib)}</span><b>${f(b.gratuit)}</b><b>${f(b.pro)}</b></div>`;
  const principal = Object.keys(missions).find(k => missions[k]) || "rental";
  const seuil = seuilPro(principal);
  const ecart = b.pro.resteC - b.gratuit.resteC;
  zone.querySelector("[data-sim-resultats]").innerHTML = intro + (b.gratuit.missions ? `
    <div class="sim-ligne entete"><span></span><b>${tr("Gratuite")}</b><b>${tr("Pro")}</b></div>
    ${ligne("Missions par mois", x => x.missions)}
    ${ligne("Chiffre d'affaires", x => euros(x.caC))}
    ${ligne("Commission Cleaneroo", x => `−${euros(x.commissionC)}`)}
    ${ligne("Cotisations et frais", x => `−${euros(x.cotisationsC + x.stripeC)}`)}
    ${ligne("Abonnement Pro", x => x.abonnementC ? `−${euros(x.abonnementC)}` : "—")}
    ${ligne("Reste pour vous", x => euros(x.resteC), "total")}
    ${ligne("Soit par heure travaillée", x => euros(x.horaireNetC))}
    ${ligne("Temps de travail", x => duree(x.minutes))}
    <p class="note sim-conseil">${icone("valide")} <span>${ecart > 0 ? `${tr("À ce rythme, la formule Pro vous rapporte")} <b>${euros(ecart)}</b> ${tr("de plus par mois.")}`
      : `${tr("À ce rythme, la formule Gratuite vous convient mieux.")}${seuil ? ` ${tr("La formule Pro devient plus intéressante à partir de")} ${seuil} ${tr("missions par mois")} (${nomType(principal)}).` : ""}`}</span></p>
    ${graphiqueAnnuel(b)}` : `<p class="petit">${tr("Choisissez au moins une mission pour voir la simulation.")}</p>`);
}
function brancherSimulateur(zone) {
  zone.addEventListener("input", () => majSimulateur(zone));
  zone.addEventListener("change", () => majSimulateur(zone));
  zone.addEventListener("click", e => {
    const m = e.target.closest("[data-sim-mode]");
    if (m) { zone.querySelectorAll("[data-sim-mode]").forEach(x => { x.setAttribute("aria-selected", String(x === m)); x.classList.toggle("choisi", x === m); }); majSimulateur(zone); return; }
    const d = e.target.closest("[data-demi]");
    if (d) { d.setAttribute("aria-pressed", String(d.getAttribute("aria-pressed") !== "true")); majSimulateur(zone); }
  });
  // Planning de départ : 5 matinées en semaine.
  ["0", "1", "2", "3", "4"].forEach(j => zone.querySelector(`[data-demi="${j}-matin"]`)?.setAttribute("aria-pressed", "true"));
  majSimulateur(zone);
}

/** Demande réelle près de chez soi (liste d'attente « Ma demande compte » : nombres seulement). */
const blocDemandeLocale = () => `<div style="margin-top:14px">${blocQuiAttendent()}</div>`;

/** Niveaux du Cleaneur, avec le temps estimé pour atteindre chacun à son rythme (missions seulement ; la note compte aussi). */
function blocNiveaux() {
  return `<h2 class="titre-section">${icone("avis", { tuile: true })}${tr("Votre progression")}</h2>
    <div class="niveaux-espace">${REGLES.NIVEAUX.map(n => `<div class="carte niveau-espace"><b>${tr(n.nom)}</b>
      <span class="petit muet">${n.missions ? `${n.missions} ${tr("missions")}${n.note ? ` · ${tr("note")} ${String(n.note).replace(".", ",")}+` : ""}` : tr("Dès la validation du dossier")}</span>
      <ul class="petit">${n.avantages.map(a => `<li>${tr(a)}</li>`).join("")}</ul></div>`).join("")}</div>
    <p class="petit">${tr("Missions de renfort : vous remplacez un Cleaneur qui a annulé au dernier moment, sans commission.")}</p>`;
}

/** « Ce qu'il vous faut » : ce qui est déjà prêt dans le compte, ce qui reste à prévoir, avec l'aide officielle. */
function blocCeQuIlFaut(p) {
  const items = [
    [true, "Prénom, nom et e-mail", "Repris de votre compte."],
    [!!p.telephone, "Téléphone mobile", p.telephone ? "Déjà enregistré." : "Demandé ci-dessous."],
    [false, "SIRET de micro-entrepreneur", "Création gratuite sur le site officiel de l'URSSAF.", "https://autoentrepreneur.urssaf.fr"],
    [false, "Assurance RC Pro", "À votre nom, couvrant vos activités de ménage."],
    [false, "Attestation URSSAF et pièce d'identité", "À envoyer dans « Mon dossier »."],
  ];
  return `<h2 class="titre-section">${icone("document", { tuile: true })}${tr("Ce qu'il vous faut")}</h2>
    <div class="carte ce-qu-il-faut">${items.map(([ok, t, x, lien]) => `<div class="item-pret ${ok ? "ok" : ""}">${icone(ok ? "valide" : "horloge")}
      <div><b>${tr(t)}</b><span class="petit">${tr(x)}${lien ? ` <a href="${lien}" target="_blank" rel="noopener">${tr("Ouvrir le site officiel")} ›</a>` : ""}</span></div></div>`).join("")}</div>`;
}

/** Espace Particulier pour un Cleaneur : exemple de prix calculé par le moteur. */
function blocExempleClient() {
  const u = uniteMission("home");
  return `<div class="carte teintee" style="margin:14px 0"><b>${icone("paiement")} ${tr("Exemple : le ménage d'un appartement")}</b>
    <p style="margin:6px 0 0"><b style="font-size:22px">${euros(u.prixC)}</b> · ${duree(u.dureeMin)}</p>
    <p class="petit muet" style="margin:4px 0 0">${tr("Prix de la prestation, calculé comme sur la page de réservation. Payé à la réservation, versé au Cleaneur après votre validation.")}</p></div>`;
}

const etapesCleaneur = () => `<h2 class="titre-section">${icone("valide", { tuile: true })}${tr("Comment ça marche")}</h2>
  <ol class="etapes-espace">
    <li><b>${tr("Ajoutez l'espace Cleaneur")}</b><span>${tr("Vos prénom, nom et e-mail sont repris : rien à ressaisir.")}</span></li>
    <li><b>${tr("Envoyez vos documents")}</b><span>${tr("Pièce d'identité, SIRET, RC Pro et attestation URSSAF : dans « Mon dossier », puis vous signez le contrat.")}</span></li>
    <li><b>${tr("Recevez vos premières missions")}</b><span>${tr("Dossier validé : vous choisissez les missions près de chez vous, aux horaires qui vous conviennent.")}</span></li>
  </ol>`;
const faqCleaneur = () => `<h2 class="titre-section">${icone("document", { tuile: true })}${tr("Questions fréquentes")}</h2>
  ${[["Faut-il être auto-entrepreneur ?", "Oui : vous travaillez en indépendant, avec un SIRET. Une société peut aussi devenir Cleaneur, en l'indiquant dans « Mon dossier »."],
     ["Mes deux espaces sont-ils séparés ?", "Oui : vos réservations de client et vos missions de Cleaneur restent séparées. Vous passez de l'un à l'autre avec l'interrupteur en haut."],
     ["Quand suis-je payé ?", "Chaque vendredi, pour les missions validées par le client jusqu'au mercredi minuit."]]
    .map(([q, r]) => `<details class="carte faq-espace"><summary>${tr(q)}</summary><p class="petit">${tr(r)}</p></details>`).join("")}`;

function formulaireAdhesion(id, p) {
  if (id === "cleaneur") return `<form class="carte adhesion" data-adhesion="cleaneur" novalidate>
    <h2 style="margin:0 0 6px;font-size:18px">${tr("Ajouter l'espace Cleaneur à mon compte")}</h2>
    ${p.telephone ? "" : `<label class="champ"><span>${tr("Téléphone mobile")}</span><input name="telephone" type="tel" inputmode="tel" autocomplete="tel" maxlength="20" required></label>`}
    <p class="petit muet">${tr("Vous lirez et signerez le contrat de prestataire dans « Mon dossier », avant votre première mission.")}</p>
    <button type="submit" class="bouton plein">${tr("Ajouter l'espace Cleaneur")}</button><p class="erreur" data-erreur-adhesion></p></form>`;
  if (id === "particulier") return `<form class="carte adhesion" data-adhesion="particulier" novalidate>
    <h2 style="margin:0 0 6px;font-size:18px">${tr("Ajouter l'espace Particulier à mon compte")}</h2>
    <p class="petit muet">${tr("Vos coordonnées sont reprises : un clic suffit.")}</p>
    <button type="submit" class="bouton plein">${tr("Ajouter l'espace Particulier")}</button><p class="erreur" data-erreur-adhesion></p></form>`;
  return `<form class="carte adhesion" data-adhesion="${id}" novalidate>
    <h2 style="margin:0 0 6px;font-size:18px">${tr("Ajouter cet espace à mon compte")}</h2>
    <label class="champ"><span>${tr("Raison sociale")}</span><input name="societe" maxlength="120" autocomplete="organization" value="${esc(p.societe || "")}"></label>
    <label class="champ"><span>${tr("SIRET (14 chiffres) ou SIREN (9 chiffres)")}</span><input name="siret" inputmode="numeric" maxlength="17" value="${esc(p.siret_societe || "")}"></label>
    <button type="submit" class="bouton plein">${tr("Ajouter cet espace")}</button><p class="erreur" data-erreur-adhesion></p></form>`;
}

/** #/espace/<id> : présentation de l'espace et adhésion intégrée. */
export async function pageEspace(vue, id) {
  if (!ESPACES.includes(id)) id = "cleaneur";
  const p = await monProfil().catch(() => null);
  if (!p) { location.hash = id === "cleaneur" ? "#/devenir-cleaneur" : "#/compte/creer"; return; }
  if ((p.statuts || []).includes(id)) { location.hash = `#/compte/${id}`; return; }
  // Entreprise : le secteur d'activité se choisit dans le formulaire habituel de « Mon compte ».
  window.scrollTo(0, 0);
  vue.innerHTML = `<section class="bloc page-espace"><div class="etroit">
    <span class="surtitre">${tr("Ajouter un espace")}</span>
    ${vitrineEspace(id)}
    ${id === "cleaneur" ? blocSimulateur() + blocDemandeLocale() + blocNiveaux() + blocCeQuIlFaut(p) + etapesCleaneur() + faqCleaneur() : id === "particulier" ? blocExempleClient() : ""}
    ${id === "entreprise" ? `<p class="note">${tr("Pour l'espace Entreprise, votre secteur d'activité vous sera demandé dans « Mon compte ».")}</p><a class="bouton plein" href="#/compte/entreprise">${tr("Continuer dans Mon compte")}</a>` : formulaireAdhesion(id, p)}
    <p style="margin-top:16px"><a href="#/compte" class="lien-bouton">‹ ${tr("Mes espaces")}</a></p>
  </div></section>`;
  traduire(vue);
  const sim = vue.querySelector("#simulateur-ca");
  if (sim) brancherSimulateur(sim);
  const f = vue.querySelector("[data-adhesion]");
  if (!f) return;
  f.onsubmit = async e => {
    e.preventDefault();
    const err = f.querySelector("[data-erreur-adhesion]"), bt = f.querySelector("[type=submit]");
    err.textContent = "";
    try {
      if (id === "cleaneur" && f.telephone) {
        const tel = f.telephone.value.replace(/[\s.-]/g, "");
        if (!/^(\+33|0)[67]\d{8}$/.test(tel)) { err.textContent = tr("Indiquez un numéro de mobile valable."); return; }
        bt.disabled = true; await majProfil({ telephone: tel });
      }
      if (["pro", "hotellerie"].includes(id)) {
        const siret = f.siret.value.replace(/\D/g, "");
        if (!f.societe.value.trim() || !sirenSiretValide(siret)) { err.textContent = tr("Indiquez la raison sociale et un SIRET (14 chiffres) ou un SIREN (9 chiffres) valable."); return; }
        bt.disabled = true; await majProfil({ societe: f.societe.value.trim(), siret_societe: siret });
      }
      bt.disabled = true;
      const r = await ajouterStatut(id);
      if (r !== "ok") throw new Error(String(r));
      const np = await monProfil().catch(() => null);
      if (np) { memoriserProfil(np); rendreEntete(np); }
      fixerMode(id === "cleaneur");
      if (id === "cleaneur") { try { localStorage.setItem("cleaneroo-sous-onglet-cleaneur", "dossier"); } catch { /* rien */ } }
      location.hash = `#/compte/${id}`;
    } catch {
      bt.disabled = false;
      err.textContent = tr("Le service est momentanément indisponible. Réessayez dans quelques minutes.");
    }
  };
}

/** Section « Mes espaces » de Mon compte : espaces ouverts, puis ceux à ajouter (vers leur présentation). */
export function blocMesEspaces(p, ouverts) {
  const manquants = ESPACES.filter(x => !ouverts.includes(x));
  return `<div class="carte mes-espaces" id="mes-espaces" style="margin-top:16px">
    <h2 style="margin:0 0 8px;font-size:18px">${icone("equipe")} ${tr("Mes espaces")}</h2>
    <div class="espaces-ouverts">${ouverts.map(x => `<a class="tampon" href="#/compte/${x}">${tr(NOMS[x])}</a>`).join(" ")}</div>
    ${manquants.length ? `<p class="petit" style="margin:12px 0 6px"><b>${tr("Ajouter un espace")}</b></p>
      ${manquants.map(x => `<a class="carte ligne-compte" href="#/espace/${x}">${icone(x === "cleaneur" ? "cleaneurs" : x === "entreprise" ? "bureaux" : x === "particulier" ? "logement" : "location", { tuile: true })}
        <div class="corps"><b>${tr(NOMS[x])}</b><p class="petit" style="margin:2px 0 0">${tr(x === "cleaneur" ? "Simulez votre chiffre d'affaires et proposez vos services." : "Découvrir cet espace et l'ajouter à mon compte.")}</p></div><span class="aller" aria-hidden="true">›</span></a>`).join("")}` : ""}
  </div>`;
}
