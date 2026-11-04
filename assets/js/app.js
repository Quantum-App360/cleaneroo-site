// Navigation du site et pages simples. Le parcours de réservation est dans reserver.js.
import { RUBRIQUES, RACCOURCIS_VITRINE, rubrique, TYPES_LIEU } from "./catalogue.js";
import { traduire, traduireCatalogue, selecteurLangue, tr } from "./langue.js";
import { euros, duree, dateLongue, dateHeure, heure, estPrelancement, joursAvantLancement, MESSAGE_LANCEMENT } from "./regles.js";

// Langue : catalogue traduit avant tout affichage.
traduireCatalogue(RUBRIQUES, TYPES_LIEU);
import { ouvrirReservation, modeles, logements, nomLogement, oublierMesInformations } from "./reserver.js";
import { mesDemandes, suivre, annuler, memoriser, inscrire } from "./donnees.js";

const vue = document.getElementById("vue");
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ------------------------------------------------------------------ Décor des bannières */
const VAGUES = `<svg class="vagues" viewBox="0 0 1440 90" preserveAspectRatio="none" aria-hidden="true">
  <path d="M0,40 C240,80 480,0 720,30 C960,60 1200,10 1440,40 L1440,90 L0,90 Z" fill="rgba(94,214,203,.22)"/>
  <path d="M0,62 C200,40 420,88 700,64 C980,40 1220,80 1440,58 L1440,90 L0,90 Z" fill="rgba(255,255,255,.14)"/></svg>`;
export function decor(bulles = [[88, 18, 120], [6, 62, 90], [72, 78, 40], [16, 8, 46]], etincelles = [[60, 10, 22, "#fff"], [93, 84, 26, ""]]) {
  return bulles.map(([x, y, t]) => `<span class="bulle" style="left:${x}%;top:${y}%;width:${t}px;height:${t}px"></span>`).join("")
    + etincelles.map(([x, y, t, c]) => `<span class="etincelle" style="left:${x}%;top:${y}%;font-size:${t}px;${c ? `color:${c}` : ""}">✦</span>`).join("")
    + VAGUES;
}

/* ------------------------------------------------------------------ Pré-lancement (ouverture le 31 décembre 2026) */
export function bandeauLancement() {
  if (!estPrelancement()) return "";
  const j = joursAvantLancement();
  return `<div class="lancement"><div class="conteneur">
    <span class="compte">J-${j}</span>
    <span><b>Lancement le 31 décembre 2026</b> · ${MESSAGE_LANCEMENT}</span></div></div>`;
}

const TYPES_INSCRIPTION = [["client", "Je cherche un nettoyage"], ["cleaneur", "Je veux devenir Cleaneur"], ["conciergerie", "Je gère des locations / une conciergerie"]];

function formulaireInscription(typeDefaut = "client") {
  return `<form class="carte" id="form-inscription" novalidate>
    <h3>Inscrivez-vous pour le lancement</h3>
    <p class="muet" style="margin:4px 0 14px">Ouverture le <b>31 décembre 2026</b>. ${MESSAGE_LANCEMENT} Les premiers inscrits sont prévenus en priorité.</p>
    <div class="choix" style="margin-bottom:14px">${TYPES_INSCRIPTION.map(([id, lib]) =>
      `<button type="button" data-type-inscription="${id}" class="${id === typeDefaut ? "choisi" : ""}">${lib}</button>`).join("")}</div>
    <input type="hidden" name="type" value="${typeDefaut}">
    <div class="grille-2"><label class="champ">Prénom<input name="prenom" required maxlength="80" autocomplete="given-name"></label>
      <label class="champ">Nom<input name="nom" maxlength="80" autocomplete="family-name"></label></div>
    <div class="grille-2"><label class="champ">E-mail<input name="email" type="email" required maxlength="200" autocomplete="email"></label>
      <label class="champ">Téléphone (facultatif)<input name="telephone" type="tel" maxlength="20" autocomplete="tel"></label></div>
    <div class="grille-2"><label class="champ">Code postal<input name="code_postal" required inputmode="numeric" maxlength="5" pattern="[0-9]{5}" autocomplete="postal-code"></label>
      <label class="champ">Ville<input name="ville" maxlength="100" autocomplete="address-level2"></label></div>
    <label class="champ">Un message ? (facultatif)<textarea name="message" rows="2" maxlength="1000" placeholder="Ex. : 3 appartements Airbnb à Fréjus"></textarea></label>
    <label class="case"><input type="checkbox" name="consentement"> <span>J'accepte d'être contacté par Cleaneroo pour le lancement. <a href="#/confidentialite">Confidentialité</a></span></label>
    <p class="erreur" id="erreur-inscription" style="margin:8px 0 0"></p>
    <button class="bouton plein" type="submit" style="margin-top:10px">Je m'inscris</button>
  </form>`;
}

export function brancherInscription(racine) {
  const f = racine.querySelector("#form-inscription");
  if (!f) return;
  f.querySelectorAll("[data-type-inscription]").forEach(b => b.onclick = () => {
    f.querySelectorAll("[data-type-inscription]").forEach(x => x.classList.toggle("choisi", x === b));
    f.type.value = b.dataset.typeInscription;
  });
  f.onsubmit = async e => {
    e.preventDefault();
    const err = f.querySelector("#erreur-inscription");
    const v = Object.fromEntries(new FormData(f));
    if (!v.prenom.trim()) return err.textContent = tr("Indiquez votre prénom.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v.email)) return err.textContent = tr("Adresse e-mail invalide.");
    if (!/^[0-9]{5}$/.test(v.code_postal)) return err.textContent = tr("Code postal à 5 chiffres.");
    if (!f.consentement.checked) return err.textContent = tr("Cochez la case pour que nous puissions vous prévenir.");
    err.textContent = "";
    const bouton = f.querySelector("button[type=submit]");
    bouton.disabled = true; bouton.textContent = tr("Inscription…");
    try {
      const r = await inscrire({ type: v.type, prenom: v.prenom.trim(), nom: v.nom.trim(), email: v.email.trim(), telephone: v.telephone.trim(),
        code_postal: v.code_postal, ville: v.ville.trim(), message: v.message.trim(), consentement: true });
      f.innerHTML = `<h3>${r === "deja" ? "Vous êtes déjà inscrit ✓" : "Merci, vous êtes inscrit ✓"}</h3>
        <p class="muet" style="margin:6px 0 0">Nous vous préviendrons avant l'ouverture du <b>31 décembre 2026</b>. ${MESSAGE_LANCEMENT}</p>`;
      traduire(f);
    } catch (ex) {
      bouton.disabled = false; bouton.textContent = tr("Je m'inscris");
      err.textContent = tr("L'inscription n'a pas abouti. Vérifiez votre connexion et réessayez.");
    }
  };
}

const titreSection = (titre, sous = "") => `<div class="titre-section"><h2>${titre}</h2><div class="trait-corail"></div>${sous ? `<p class="muet">${sous}</p>` : ""}</div>`;

/* ------------------------------------------------------------------ Pages */
const ETAPES = [
  ["📅", "Réservez en 2 minutes", "Choisissez la prestation, répondez à quelques questions, ajoutez des photos et choisissez votre créneau. Le prix s'affiche tout de suite."],
  ["👥", "Choisissez votre Cleaneur", "Des Cleaneurs vérifiés (identité, SIRET, assurance) se proposent. Comparez prix, note et distance : c'est vous qui choisissez."],
  ["📍", "Suivez l'intervention en direct", "« En route », arrivée confirmée par géolocalisation, selfie du jour : vous savez qui vient, et quand."],
  ["📸", "Recevez le compte rendu", "Tâches cochées et horodatées, photos avant / après, signature du Cleaneur : tout est dans votre espace."],
  ["✅", "Validez, puis payez", "Vous n'êtes débité qu'après avoir validé. Crédit d'impôt de 50 % déduit tout de suite ; pourboire et avis si vous le souhaitez."],
];
const blocEtapes = () => `<div class="etapes etroit">${ETAPES.map(([e, t, d], i) => `
  <div class="etape"><div class="pastille">${e}<b>${i + 1}</b></div>
    <div class="carte"><div class="surtitre">ÉTAPE ${i + 1}</div><h3>${t}</h3><p class="muet" style="margin:6px 0 0">${d}</p></div></div>`).join("")}</div>`;

/* Bulles qui montent dans le héros (positions fixes : même rendu à chaque visite). */
const MONTANTES = [[6, 14, 13, 0], [14, 8, 17, 4], [27, 20, 15, 9], [38, 10, 19, 2], [52, 16, 14, 7], [63, 9, 18, 11], [74, 22, 16, 5], [86, 12, 20, 1], [94, 18, 15, 8]];
const bullesMontantes = () => MONTANTES.map(([x, t, d, r]) =>
  `<span class="monte" style="left:${x}%;width:${t}px;height:${t}px;animation-duration:${d}s;animation-delay:-${r}s"></span>`).join("");

/* Le ménage à l'ancienne face au ménage digitalisé. */
const COMPARAISON = [
  ["Prix", "Devis, attente, négociation", "Prix affiché tout de suite, crédit d'impôt compris"],
  ["Réservation", "Appels, messages, relances", "2 minutes en ligne, 3 clics la fois suivante"],
  ["Qui vient chez vous", "On ne sait pas vraiment", "Cleaneur vérifié : identité, SIRET, assurance, selfie du jour"],
  ["Arrivée", "On attend sans nouvelles", "Suivi en direct, arrivée confirmée par géolocalisation"],
  ["Travail réalisé", "Aucune preuve", "Compte rendu photo avant / après, horodaté et signé"],
  ["Paiement", "À l'avance ou en espèces", "Seulement après votre validation"],
  ["En cas de souci", "Votre parole contre la sienne", "Litige en 48 h et Garantie Cleaneroo"],
];
const CHIFFRES = [["2 min", "pour réserver"], ["13", "prestations"], ["−50 %", "de crédit d'impôt"], ["0 €", "avant validation"]];

function blocRecommander() {
  const m = modeles()[0];
  if (!m) return "";
  const r = rubrique(m.rubriqueId), l = logements().find(x => x.id === m.logementId);
  return `<a class="recommander" href="#/reserver/${m.rubriqueId}/rapide"><span class="emoji">${r.emoji}</span>
    <span style="flex:1"><small>Comme la dernière fois</small><b>${r.nom}</b>${l ? `<span class="lieu">${esc(nomLogement(l))}</span>` : ""}</span>
    <span class="fleche">Recommander ›</span></a>`;
}

function pageAccueil() {
  return `
  <section class="fond-cleaneroo heros">${decor()}${bullesMontantes()}
    <div class="conteneur grille">
      <div class="revele">
        <h1 class="titre-heros"><span>Le ménage passe</span> <span class="brille">au digital.</span></h1>
        <p class="sous">Réservez en 2 minutes, suivez votre Cleaneur en direct, recevez le compte rendu photo. Vous ne payez qu'après validation.</p>
        <form class="express" id="express">
          <label><span>Quelle prestation ?</span><select name="rubrique">${RUBRIQUES.map(r => `<option value="${r.id}">${r.emoji} ${r.nom}</option>`).join("")}</select></label>
          <label><span>Code postal</span><input name="cp" inputmode="numeric" maxlength="5" pattern="[0-9]{5}" placeholder="83600" autocomplete="postal-code"></label>
          <button class="bouton" type="submit">Voir mon prix</button>
        </form>
        ${blocRecommander()}
        <div class="etiquettes"><span class="etiquette">Réservation</span><span class="etiquette">Suivi en direct</span><span class="etiquette">Compte rendu photo</span></div>
      </div>
      <div class="scene revele" aria-label="Aperçu de l'application">
        <img class="eponge-grande" src="assets/img/logo_eponge.webp" alt="Éponge Cleaneroo">
        <div class="notif n1"><span class="pastille-notif">📍</span><span><b>Sofia est en route</b><small>Arrivée dans 8 min</small></span></div>
        <div class="notif n2"><span class="pastille-notif">📸</span><span><b>Compte rendu reçu</b><small>12 photos avant / après</small></span></div>
        <div class="notif n3"><span class="pastille-notif">✅</span><span><b>Payé après validation</b><small>Crédit d'impôt déduit : −50 %</small></span></div>
      </div>
    </div>
  </section>
  <section class="chiffres"><div class="conteneur">${CHIFFRES.map(([n, l]) => `<div class="revele"><b>${n}</b><span>${l}</span></div>`).join("")}</div></section>
  <section class="bloc"><div class="conteneur">
    ${titreSection("Nos prestations", "Le prix s'affiche dès que vous décrivez votre besoin.")}
    <div class="grille-3">${RACCOURCIS_VITRINE.map(([id, nom, sous]) => `
      <a class="carte prestation revele" href="#/reserver/${id}"><div class="emoji">${rubrique(id).emoji}</div><h3>${nom}</h3><p class="muet" style="margin:4px 0 0">${sous}</p></a>`).join("")}</div>
    <p style="text-align:center;margin-top:20px"><a href="#/prestations">Voir les 13 prestations ›</a></p>
    <div class="carte revele" style="display:flex;gap:16px;align-items:center;margin-top:24px;background:color-mix(in srgb,var(--corail) 12%,var(--surface))">
      <div style="flex:none;width:64px;height:64px;border-radius:50%;background:var(--corail);color:#fff;display:grid;place-items:center;font-weight:800">−50 %</div>
      <div><h3>Le propre, à moitié prix.</h3><p class="muet" style="margin:2px 0 0">50 % de crédit d'impôt sur le ménage à domicile, déduit tout de suite avec l'avance immédiate.</p></div>
    </div>
  </div></section>
  <section class="bloc" style="padding-top:0"><div class="conteneur">
    ${titreSection("Le ménage nouvelle génération", "Ce qui change quand tout est digitalisé.")}
    <div class="comparaison revele" role="table" aria-label="Le ménage nouvelle génération">
      <div class="ligne entete-comp" role="row"><span role="columnheader"></span><span role="columnheader">À l'ancienne</span><span role="columnheader">Avec Cleaneroo</span></div>
      ${COMPARAISON.map(([c, a, n]) => `<div class="ligne" role="row"><b role="rowheader">${c}</b><span class="ancien" role="cell">${a}</span><span class="nouveau" role="cell">${n}</span></div>`).join("")}
    </div>
  </div></section>
  <section class="bloc" style="padding-top:0"><div class="conteneur">
    ${titreSection("Comment ça marche ?", "Du clic à la validation, tout se passe en ligne.")}
    ${blocEtapes()}
  </div></section>
  ${estPrelancement() ? `<section class="bloc" id="inscription" style="padding-top:0"><div class="etroit revele">${formulaireInscription()}</div></section>` : ""}`;
}

/** Réservation express de l'accueil : prestation + code postal → parcours prérempli. */
function brancherExpress(racine) {
  const f = racine.querySelector("#express");
  if (!f) return;
  f.onsubmit = e => {
    e.preventDefault();
    const cp = /^[0-9]{5}$/.test(f.cp.value.trim()) ? `/cp-${f.cp.value.trim()}` : "";
    location.hash = `#/reserver/${f.rubrique.value}${cp}`;
  };
}

/** Apparition douce des blocs au défilement (désactivée si l'utilisateur limite les animations). */
const observateur = "IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches
  ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("visible"); observateur.unobserve(e.target); } }), { rootMargin: "0px 0px -8% 0px" })
  : null;
function reveler(racine) {
  racine.querySelectorAll(".revele, .etape").forEach((el, i) => {
    if (!observateur) return el.classList.add("visible");
    el.style.transitionDelay = `${Math.min(i % 4, 3) * 70}ms`;
    observateur.observe(el);
  });
}

function pageInscription(type = "client") {
  return `<section class="fond-cleaneroo" style="padding:40px 0 90px">${decor([[90, 20, 90], [4, 60, 60]], [])}
    <div class="conteneur"><span class="etiquette" style="background:var(--corail)">J-${joursAvantLancement()}</span>
      <h1 style="margin-top:10px">Lancement le 31 décembre 2026</h1><div class="trait-corail"></div>
      <p class="slogan" style="font-size:20px;font-weight:600;margin:0">${MESSAGE_LANCEMENT}</p></div></section>
  <section class="bloc"><div class="etroit">${formulaireInscription(type)}</div></section>`;
}

function pagePrestations() {
  return `<section class="fond-cleaneroo" style="padding:40px 0 90px">${decor([[90, 20, 90], [4, 60, 60]], [])}
    <div class="conteneur"><h1>Nos prestations</h1><div class="trait-corail"></div><p>13 univers de nettoyage, un seul parcours de réservation.</p></div></section>
  <section class="bloc"><div class="conteneur"><div class="grille-3">${RUBRIQUES.map(r => `
    <a class="carte prestation" href="#/reserver/${r.id}"><div class="emoji">${r.emoji}</div><h3>${r.nom}</h3>
      <p class="muet" style="margin:4px 0 8px">${r.sousTitre}</p>
      <span class="tampon">${r.toujoursSurDevis ? "Sur devis" : `dès ${euros(r.tauxHoraireC)} / h`}</span></a>`).join("")}</div></div></section>`;
}

function pageComment() {
  return `<section class="fond-cleaneroo" style="padding:40px 0 90px">${decor([[90, 20, 90], [4, 60, 60]], [])}
    <div class="conteneur"><h1>Comment ça marche ?</h1><div class="trait-corail"></div><p>Du clic à la validation, tout se passe en ligne.</p></div></section>
  <section class="bloc"><div class="conteneur">${blocEtapes()}
    <div class="grille-2 etroit" style="margin-top:28px">
      <div class="carte fond-cleaneroo" style="border:0"><h3>Côté Cleaneur</h3><div class="trait-corail"></div>
        <p style="margin:0">Je pars, puis j'arrive (géolocalisé) · Selfie du jour · Tâches et photos guidées · Signature et compte rendu · Paiement après validation.</p></div>
      <div class="carte"><h3>Vos garanties</h3><div class="trait-corail"></div>
        <p class="muet" style="margin:0">Débit seulement après validation · Garantie Cleaneroo · Crédit d'impôt de 50 % · Cleaneurs vérifiés · Annulation gratuite jusqu'à 48 h avant.</p></div>
    </div>
    <img src="assets/img/affiche.jpg" alt="Affiche « Comment ça marche ? »" loading="lazy" style="width:min(620px,100%);margin:36px auto 0;border-radius:18px;box-shadow:var(--ombre)">
  </div></section>`;
}

function pageDevenir() {
  const etapes = ["Avoir un statut d'indépendant", "Préparer vos documents (pièce d'identité, SIRET, RC Pro, attestation de vigilance URSSAF)",
    "Déposer votre dossier (zone, prestations ; chaque document vérifié avant activation)", "Suivre la charte qualité",
    "Choisir vos missions (prix et horaires proposés, libre d'accepter)", "Être payé (validation client → commission prélevée → versement)"];
  return `<section class="fond-cleaneroo" style="padding:40px 0 90px">${decor([[90, 20, 90], [4, 60, 60]], [])}
    <div class="conteneur"><h1>Devenir Cleaneur</h1><div class="trait-corail"></div><p>Travaillez à votre rythme, près de chez vous.</p>
      <div class="etiquettes"><span class="etiquette">Missions proches</span><span class="etiquette">Compte rendu guidé</span><span class="etiquette">Paiement sécurisé</span></div></div></section>
  <section class="bloc"><div class="etroit">${etapes.map((t, i) => `<div class="carte" style="margin-bottom:10px"><b style="color:var(--corail)">${i + 1}.</b> ${t}</div>`).join("")}
    <div style="margin-top:18px">${formulaireInscription("cleaneur")}</div>
  </div></section>`;
}

const pageTexte = (titre, html) => `<section class="bloc"><div class="etroit"><h1>${titre}</h1><div class="trait-corail"></div>${html}</div></section>`;

function pageConfidentialite() {
  return pageTexte("Confidentialité", `
    <p>Cleaneroo collecte uniquement les informations nécessaires à votre demande de nettoyage : nom, coordonnées, adresse d'intervention, description du besoin, photos que vous ajoutez et créneau choisi.</p>
    <p>Ces informations servent à trouver un Cleaneur, à organiser l'intervention et à vous en rendre compte. Elles ne sont jamais vendues ni utilisées pour de la publicité. Les données sont hébergées dans l'Union européenne.</p>
    <p>Le code d'accès à votre logement n'est communiqué qu'au Cleaneur retenu, le jour de l'intervention.</p>
    <p>Vous pouvez à tout moment demander l'accès, la correction ou la suppression de vos données en écrivant à <a href="mailto:contact@cleaneroo.fr">contact@cleaneroo.fr</a>. Les factures sont conservées le temps imposé par la loi.</p>
    <p>Pour aller plus vite à la commande suivante, votre navigateur garde sur cet appareil vos coordonnées, vos adresses enregistrées et votre dernière commande (jamais le code d'accès). Vous pouvez tout effacer depuis « Mes demandes ».</p>
    <p>Le site n'utilise ni traceur publicitaire ni cookie de mesure d'audience.</p>`);
}
function pageConditions() {
  return pageTexte("Conditions d'utilisation", `
    <p>Cleaneroo met en relation des clients et des Cleaneurs indépendants vérifiés. Rien n'est ajouté à votre commande sans votre accord ; vous n'êtes débité qu'après avoir validé le compte rendu de l'intervention.</p>
    <p>Annulation gratuite jusqu'à 48 h avant l'intervention, puis 25 % du prix accepté. Un litige ou une déclaration de dommage (Garantie Cleaneroo) peut être ouvert dans les 48 h suivant l'intervention.</p>
    <p>Le prix affiché est une estimation : le montant final ne peut pas la dépasser sans votre accord.</p>`);
}
function pageMentions() {
  return pageTexte("Mentions légales", `
    <p><b>Éditeur :</b> Cleaneroo — [raison sociale, adresse et numéro SIRET à compléter].</p>
    <p><b>Contact :</b> <a href="mailto:contact@cleaneroo.fr">contact@cleaneroo.fr</a></p>
    <p><b>Hébergement :</b> GitHub Pages (GitHub, Inc.) ; données de réservation hébergées dans l'Union européenne.</p>
    <p><b>Nom de domaine :</b> cleaneroo.fr, enregistré chez IONOS.</p>`);
}

const STATUTS = { VERIFICATION: "En cours de vérification", PUBLIEE: "En ligne · candidatures", CONFIRMEE: "Confirmée", EN_ROUTE: "Cleaneur en route",
  SUR_PLACE: "Cleaneur sur place", EN_COURS: "En cours", A_VALIDER: "À valider", TERMINEE: "Terminée", ANNULEE: "Annulée" };
export const libelleStatut = s => STATUTS[s] || s;

async function pageMesDemandes() {
  let liste = [];
  try { liste = await mesDemandes(); } catch { /* hors ligne */ }
  const carte = d => {
    const r = rubrique(d.rubrique_id);
    const quand = d.creneau ? `${dateLongue(new Date(d.creneau))} · ${heure(new Date(d.creneau).getHours())}` : "Flexible (7 jours)";
    return `<a class="carte prestation" href="#/demande/${esc(d.reference)}/${esc(d.jeton)}" style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><h3>${r.emoji} ${r.nom}</h3><span class="tampon">${libelleStatut(d.statut)}</span></div>
      <p class="muet" style="margin:6px 0 0">${quand} · ${esc(d.ville)}</p>
      <p class="petit" style="margin:4px 0 0">Réf. ${esc(d.reference)} · ${d.sur_devis ? "Sur devis" : `estimé ${euros(d.estimation_c)}`}</p></a>`;
  };
  return pageTexte("Mes demandes", (liste.length ? liste.map(carte).join("")
    : `<p class="muet">Aucune demande depuis ce navigateur.</p><p><a class="bouton" href="#/reserver">Réserver un nettoyage</a></p>`)
    + `<p class="petit" style="margin-top:18px">Vous avez réservé depuis un autre appareil ? Ouvrez le lien de suivi reçu après la réservation : la demande s'ajoutera ici.</p>`
    + (logements().length || modeles().length ? `<div class="carte" style="margin-top:18px"><b>Vos informations enregistrées</b>
      <p class="petit" style="margin:4px 0 8px">${logements().length} adresse(s) et vos coordonnées sont gardées sur cet appareil pour commander plus vite.</p>
      <button type="button" class="lien-bouton" style="color:var(--erreur);padding:0" id="oublier">Oublier mes informations</button></div>` : ""));
}

const ETAPES_SUIVI = ["VERIFICATION", "PUBLIEE", "CONFIRMEE", "EN_ROUTE", "SUR_PLACE", "EN_COURS", "A_VALIDER", "TERMINEE"];

async function pageDemande(ref, jeton) {
  let d = null;
  try { d = await suivre(ref, jeton); } catch { /* lien invalide */ }
  if (!d) return pageTexte("Demande introuvable", `<p class="muet">Ce lien de suivi n'est pas valable. Vérifiez qu'il est complet.</p>`);
  memoriser(ref, jeton, d.rubrique_id);
  const r = rubrique(d.rubrique_id);
  const idx = ETAPES_SUIVI.indexOf(d.statut);
  const lien = `${location.origin}${location.pathname}#/demande/${ref}/${jeton}`;
  const annulable = ["VERIFICATION", "PUBLIEE"].includes(d.statut);
  const etat = {
    VERIFICATION: estPrelancement() ? "Pré-réservation enregistrée. Les réservations ouvrent le 31 décembre 2026 : nous vous recontacterons pour fixer le créneau, en priorité." : "Nous vérifions votre demande. Ensuite, les Cleaneurs compatibles sont prévenus.",
    PUBLIEE: "Votre demande est en ligne : les Cleaneurs compatibles peuvent se proposer. Vous choisirez parmi leurs propositions.",
    CONFIRMEE: "Votre nettoyage est réservé. Vous serez prévenu quand le Cleaneur sera en route.",
    A_VALIDER: "La prestation est terminée : consultez le compte rendu et validez-le.",
    TERMINEE: "Prestation terminée et validée. Merci de votre confiance !",
    ANNULEE: "Cette demande est annulée. Aucun débit n'a été effectué.",
  }[d.statut] || "Intervention en cours, suivez-la ici en direct.";
  return `<section class="fond-cleaneroo" style="padding:34px 0 86px">${decor([[90, 18, 90], [5, 55, 60]], [])}
    <div class="etroit"><p style="margin:0;opacity:.85">Réf. ${esc(d.reference)}</p><h1>${r.emoji} ${r.nom}</h1><div class="trait-corail"></div>
      <span class="etiquette" style="background:rgba(255,255,255,.22)">${libelleStatut(d.statut)}</span></div></section>
  <section class="bloc" style="padding-top:28px"><div class="etroit">
    <div class="progression">${ETAPES_SUIVI.map((_, i) => `<span class="${d.statut !== "ANNULEE" && i <= idx ? "fait" : ""}"></span>`).join("")}</div>
    <div class="note" style="margin-bottom:14px">${etat}</div>
    <div class="carte" style="margin-bottom:12px">
      <p style="margin:0"><b>Quand :</b> ${d.creneau ? dateHeure(new Date(d.creneau)) : "Flexible, candidatures sur 7 jours"}</p>
      <p style="margin:6px 0 0"><b>Où :</b> ${esc(d.rue)}, ${esc(d.code_postal)} ${esc(d.ville)}</p>
      <p style="margin:6px 0 0"><b>Durée estimée :</b> ${duree(d.duree_min)}${d.nombre_cleaneurs === 2 ? " · 2 Cleaneurs" : ""}</p>
      <p style="margin:6px 0 0"><b>Prix :</b> ${d.sur_devis ? "sur devis" : euros(d.estimation_c)}${d.credit_impot_c ? ` · après crédit d'impôt ${euros(d.estimation_c - d.credit_impot_c)}` : ""}</p>
      <p style="margin:6px 0 0"><b>Choix du Cleaneur :</b> ${d.choix_cleaneur === "directe" ? "réservation directe" : "parmi les candidatures"}</p>
    </div>
    <div class="carte teintee" style="margin-bottom:12px"><b>Votre lien de suivi</b>
      <p class="petit" style="margin:4px 0 8px">Gardez-le : il permet de suivre et d'annuler votre demande depuis n'importe quel appareil.</p>
      <input class="texte" readonly value="${esc(lien)}" onclick="this.select()">
      <button type="button" class="lien-bouton" onclick="navigator.clipboard.writeText('${esc(lien)}');this.textContent='Lien copié ✓'">Copier le lien</button></div>
    ${annulable ? `<button type="button" class="bouton danger plein" id="annuler-demande">Annuler la demande</button>
      <p class="petit">Annulation gratuite : aucun Cleaneur n'est encore confirmé.</p>` : ""}
  </div></section>`;
}

/* ------------------------------------------------------------------ Navigation */
const ROUTES = {
  "": pageAccueil, "prestations": pagePrestations, "comment-ca-marche": pageComment, "devenir-cleaneur": pageDevenir,
  "inscription": () => pageInscription(), "confidentialite": pageConfidentialite, "conditions": pageConditions, "mentions-legales": pageMentions, "mes-demandes": pageMesDemandes,
};

async function afficher() {
  const chemin = location.hash.replace(/^#\/?/, "");
  const [route, param] = chemin.split("/");
  if (route === "gestion") { location.href = "gestion.html"; return; }
  document.querySelector(".nav")?.classList.remove("ouvert");
  document.querySelectorAll(".nav a").forEach(a => a.classList.toggle("actif", a.getAttribute("href") === `#/${route}`));
  if (route === "reserver") { ouvrirReservation(vue, param || null, chemin.split("/")[2] || ""); window.scrollTo(0, 0); return; }
  if (route === "inscription" && param) { vue.innerHTML = pageInscription(param); brancherInscription(vue); traduire(vue); window.scrollTo(0, 0); return; }
  if (route === "demande") {
    const [, ref, jeton] = chemin.split("/");
    vue.innerHTML = await pageDemande(decodeURIComponent(ref || ""), decodeURIComponent(jeton || ""));
    traduire(vue);
    window.scrollTo(0, 0);
    document.getElementById("annuler-demande")?.addEventListener("click", async e => {
      if (!confirm(tr("Annuler cette demande ? Aucun frais ne sera appliqué."))) return;
      e.target.disabled = true;
      try { await annuler(ref, jeton); } catch { /* rien */ }
      afficher();
    });
    return;
  }
  const page = ROUTES[route] || pageAccueil;
  vue.innerHTML = await page();
  brancherInscription(vue);
  brancherExpress(vue);
  vue.querySelector("#oublier")?.addEventListener("click", () => {
    oublierMesInformations();
    vue.querySelector("#oublier").closest(".carte").innerHTML = `<p class="muet" style="margin:0">${tr("Vos informations ont été effacées de cet appareil.")}</p>`;
  });
  traduire(vue);
  reveler(vue);
  window.scrollTo(0, 0);
}

document.querySelector(".burger").addEventListener("click", e => {
  const nav = document.querySelector(".nav");
  nav.classList.toggle("ouvert");
  e.currentTarget.setAttribute("aria-expanded", nav.classList.contains("ouvert"));
});
document.getElementById("lancement").innerHTML = bandeauLancement();
document.getElementById("choix-langue").innerHTML = selecteurLangue();
traduire(document.querySelector(".entete"));
traduire(document.getElementById("lancement"));
traduire(document.querySelector("footer"));
document.title = tr(document.title);
window.addEventListener("hashchange", afficher);
afficher();
