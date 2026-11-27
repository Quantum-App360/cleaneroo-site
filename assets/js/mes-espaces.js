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

export const ESPACES = ["particulier", "cleaneur", "entreprise", "pro", "hotellerie"];
const NOMS = { particulier: "Espace Particulier", cleaneur: "Espace Cleaneur", entreprise: "Espace Entreprise", pro: "Espace Conciergerie", hotellerie: "Espace Hôtels et campings" };
/** Missions types du simulateur : prix et durée calculés comme pour un client. */
const MISSIONS_TYPES = ["rental", "home", "windows"];
const SEMAINES_PAR_MOIS = 52 / 12;

/** Simulation mensuelle (fonction pure, testée) : n missions par semaine du type choisi, formule Gratuite ou Pro. */
export function simulerCA(rubriqueId, missionsParSemaine, formule = "gratuit") {
  const est = calculer(entreeEstimation({ ...brouillonExemple(rubriqueId, {}) }, false, null));
  const g = gainCleaneur(est.totalC, est.dureeMin, formule);
  const n = Math.max(0, Math.round(missionsParSemaine * SEMAINES_PAR_MOIS));
  const abonnementC = formule === "pro" ? REGLES.ABONNEMENT_CLEANEUR_C : 0;
  const resteC = g.resteC * n - abonnementC;
  const heures = (est.dureeMin * n) / 60;
  return { prixC: est.totalC, dureeMin: est.dureeMin, missionsMois: n, caC: est.totalC * n, resteC, abonnementC, heures,
    horaireNetC: heures > 0 ? Math.round(resteC / heures) : 0 };
}

function blocSimulateur() {
  return `<div class="carte teintee simulateur-ca" id="simulateur-ca">
    <h2 class="titre-section" style="margin-top:0">${icone("paiement", { tuile: true })}${tr("Simulez votre chiffre d'affaires")}</h2>
    <label class="champ"><span>${tr("Type de mission")}</span><select data-sim-type>${MISSIONS_TYPES.map(id => `<option value="${id}">${esc(tr(rubrique(id)?.nom || id))}</option>`).join("")}</select></label>
    <label class="champ"><span>${tr("Missions par semaine")} : <b data-sim-n>5</b></span>
      <input type="range" min="1" max="25" step="1" value="5" data-sim-molette aria-label="${tr("Missions par semaine")}"></label>
    <div class="choix-formule" role="radiogroup" aria-label="${tr("Formule")}">
      <label><input type="radio" name="sim-formule" value="gratuit" checked> ${tr("Gratuite")}</label>
      <label><input type="radio" name="sim-formule" value="pro"> ${tr("Pro")}</label></div>
    <div class="sim-resultats" data-sim-resultats aria-live="polite"></div>
    <p class="petit muet" style="margin:10px 0 0">${tr("Estimation par mois, pour une micro-entreprise de services, sans ACRE ni versement libératoire : prix calculés comme pour un client, après commission, frais de paiement et cotisations URSSAF estimées. Le nombre de missions dépend de la demande dans votre secteur et de vos disponibilités : ce n'est pas une garantie. Pourboires en plus, trajets non comptés.")}</p>
  </div>`;
}
function majSimulateur(zone) {
  const type = zone.querySelector("[data-sim-type]").value, n = Number(zone.querySelector("[data-sim-molette]").value);
  const formule = zone.querySelector("[name=sim-formule]:checked")?.value || "gratuit";
  zone.querySelector("[data-sim-n]").textContent = n;
  const s = simulerCA(type, n, formule);
  zone.querySelector("[data-sim-resultats]").innerHTML = `
    <div class="sim-ligne"><span>${tr("Missions par mois")}</span><b>${s.missionsMois}</b></div>
    <div class="sim-ligne"><span>${tr("Prix d'une mission")}</span><b>${euros(s.prixC)} · ${duree(s.dureeMin)}</b></div>
    <div class="sim-ligne"><span>${tr("Chiffre d'affaires")}</span><b>${euros(s.caC)}</b></div>
    ${s.abonnementC ? `<div class="sim-ligne"><span>${tr("Abonnement Pro")}</span><b>−${euros(s.abonnementC)}</b></div>` : ""}
    <div class="sim-ligne total"><span>${tr("Reste pour vous")}</span><b>${euros(s.resteC)}</b></div>
    <div class="sim-ligne"><span>${tr("Soit par heure travaillée")}</span><b>${euros(s.horaireNetC)}</b></div>
    <div class="sim-ligne"><span>${tr("Temps de travail")}</span><b>${duree(Math.round(s.heures * 60))}</b></div>`;
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
    ${id === "cleaneur" ? blocSimulateur() + etapesCleaneur() + faqCleaneur() : ""}
    ${id === "entreprise" ? `<p class="note">${tr("Pour l'espace Entreprise, votre secteur d'activité vous sera demandé dans « Mon compte ».")}</p><a class="bouton plein" href="#/compte/entreprise">${tr("Continuer dans Mon compte")}</a>` : formulaireAdhesion(id, p)}
    <p style="margin-top:16px"><a href="#/compte" class="lien-bouton">‹ ${tr("Mes espaces")}</a></p>
  </div></section>`;
  traduire(vue);
  const sim = vue.querySelector("#simulateur-ca");
  if (sim) { sim.addEventListener("input", () => majSimulateur(sim)); sim.addEventListener("change", () => majSimulateur(sim)); majSimulateur(sim); }
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
