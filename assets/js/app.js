// Navigation du site et pages simples. Le parcours de réservation est dans reserver.js.
import { champCodeParrain, memoriserCodeParrain } from "./parrainage.js";
import { RUBRIQUES, RACCOURCIS_VITRINE, rubrique, TYPES_LIEU, pastille } from "./catalogue.js";
import { traduire, traduireCatalogue, selecteurLangue, tr, langue } from "./langue.js";
import { barreOnglets } from "./espaces.js";
import { euros, duree, dateLongue, dateHeure, heure, estPrelancement, joursAvantLancement, MESSAGE_LANCEMENT, REGLES } from "./regles.js";

// Langue : catalogue traduit avant tout affichage.
traduireCatalogue(RUBRIQUES, TYPES_LIEU);
import { ouvrirReservation, ouvrirSimulateur, modeles, logements, nomLogement, brouillonExemple } from "./reserver.js";
import { calculer, entreeEstimation } from "./estimation.js";
import { supabase, suivre, annuler, memoriser, inscrire } from "./donnees.js";
import { blocRetardClient, blocRemplacementClient } from "./retards.js";
import { pageNotifications } from "./notifications.js";
import { pageMessages } from "./messages.js";
import { blocPropositionsClient } from "./propositions.js";
import { blocConsommablesClient } from "./consommables.js";
import { blocFavori } from "./favoris.js";
import { blocModifier, boutonBon, brancherBons, blocConstat } from "./demande-actions.js";
import { blocSupplementClient } from "./supplement.js";
import { CONDITIONS, CONFIDENTIALITE, MENTIONS, texteLegal } from "./legal.js";
import { transitionVitre } from "./vitre.js";
import { compterPage } from "./compteur.js";
import { suivreEnDirect, demoSuivi } from "./suivi-live.js";
import { pageCompte, pageMesPrestations, arreterEcouteDemandes, retourEmail, majLienCompte, afficherAccesCleaneur } from "./compte.js";
import { marquerActif, profilMemorise } from "./entete.js";
import { icone, teinte, ICONES_RUBRIQUES, ICONES_INTERFACE } from "./icones.js";
import { pageTableau, arreterTableau } from "./tableau.js";
import { compteRenduPieces } from "./controle-ecran.js";
import { blocFormulesCleaneur, brancherFormulesCleaneur } from "./formules-cleaneur.js";
import { blocEtapes, blocReassurance, installerRappel, bandeauLancement, pageChargement, decorTableau, surveillerFormulaire, envoiRobot, CONTIENT_LIEN } from "./commun.js";
import "./fond-anime.js";
import "./oeil.js";
import "./choix-prestation.js";   // fenêtre animée « Réserver une prestation »   // œil pour afficher le mot de passe
export { bandeauLancement };

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

const TYPES_INSCRIPTION = [["client", "Je cherche un nettoyage"], ["cleaneur", "Je veux devenir Cleaneur"], ["conciergerie", "Je gère des locations / une conciergerie"]];

/** fixe : le type est imposé (page Devenir Cleaneur) et le choix « Je cherche un nettoyage / Je gère des locations » n'est pas montré. */
function formulaireInscription(typeDefaut = "client", fixe = false) {
  return `<form class="carte" id="form-inscription" novalidate><input class="piege" name="site_web" tabindex="-1" autocomplete="off" aria-hidden="true">
    <h3>Inscrivez-vous pour le lancement</h3>
    <p class="muet" style="margin:4px 0 14px">Ouverture le <b>31 décembre 2026</b>. ${MESSAGE_LANCEMENT} Les premiers inscrits sont prévenus en priorité.</p>
    ${fixe ? "" : `<div class="choix" style="margin-bottom:14px">${TYPES_INSCRIPTION.map(([id, lib]) =>
      `<button type="button" data-type-inscription="${id}" class="${id === typeDefaut ? "choisi" : ""}">${lib}</button>`).join("")}</div>`}
    <input type="hidden" name="type" value="${typeDefaut}">
    <div class="grille-2"><label class="champ">Prénom<input name="prenom" required maxlength="80" autocomplete="given-name"></label>
      <label class="champ">Nom<input name="nom" maxlength="80" autocomplete="family-name"></label></div>
    <div class="grille-2"><label class="champ">E-mail<input name="email" type="email" required maxlength="200" autocomplete="email"></label>
      <label class="champ">Téléphone (facultatif)<input name="telephone" type="tel" maxlength="20" autocomplete="tel"></label></div>
    <div class="grille-2"><label class="champ">Code postal<input name="code_postal" required inputmode="numeric" maxlength="5" pattern="[0-9]{5}" autocomplete="postal-code"></label>
      <label class="champ">Ville<input name="ville" maxlength="100" autocomplete="address-level2"></label></div>
    ${champCodeParrain()}
    <label class="champ">Un message ? (facultatif)<textarea name="message" rows="2" maxlength="1000" placeholder="Ex. : 3 appartements Airbnb à Fréjus"></textarea></label>
    <label class="case"><input type="checkbox" name="consentement"> <span>J'accepte d'être contacté par Cleaneroo pour le lancement. <a href="#/confidentialite">Confidentialité</a></span></label>
    <p class="erreur" id="erreur-inscription" style="margin:8px 0 0"></p>
    <button class="bouton plein" type="submit" style="margin-top:10px">Je m'inscris</button>
  </form>`;
}

export function brancherInscription(racine) {
  const f = racine.querySelector("#form-inscription");
  if (!f) return;
  surveillerFormulaire(f);
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
    if (v.telephone.trim() && !/^(\+33|0)[1-9]\d{8}$/.test(v.telephone.replace(/[\s.-]/g, ""))) return err.textContent = tr("Indiquez un numéro de téléphone à 10 chiffres.");
    if (CONTIENT_LIEN.test(`${v.message} ${v.prenom} ${v.nom}`)) return err.textContent = tr("Les liens ne sont pas acceptés dans le message.");
    err.textContent = "";
    // Robot : on affiche le remerciement, sans rien enregistrer.
    if (envoiRobot(f)) { f.innerHTML = `<h3>${tr("Merci, vous êtes inscrit ✓")}</h3>`; return; }
    const bouton = f.querySelector("button[type=submit]");
    bouton.disabled = true; bouton.textContent = tr("Inscription…");
    try {
      const r = await inscrire({ type: v.type, prenom: v.prenom.trim(), nom: v.nom.trim(), email: v.email.trim(), telephone: v.telephone.trim(),
        code_postal: v.code_postal, ville: v.ville.trim(), message: v.message.trim(), consentement: true,
        ...(v.code_parrain?.trim() ? { code_parrain: v.code_parrain.trim().toUpperCase().slice(0, 20) } : {}) });
      f.innerHTML = `<h3>${r === "deja" ? "Vous êtes déjà inscrit ✓" : "Merci, vous êtes inscrit ✓"}</h3>
        <p class="muet" style="margin:6px 0 0">Nous vous préviendrons avant l'ouverture du <b>31 décembre 2026</b>. ${MESSAGE_LANCEMENT}</p>`;
      traduire(f);
    } catch (ex) {
      bouton.disabled = false; bouton.textContent = tr("Je m'inscris");
      err.textContent = tr("L'inscription n'a pas abouti. Vérifiez votre connexion et réessayez.");
    }
  };
}

const titreSection = (titre, sous = "", surtitre = "") => `<div class="titre-section">${surtitre ? `<span class="surtitre">${surtitre}</span>` : ""}<h2>${titre}</h2>${sous ? `<p class="muet">${sous}</p>` : ""}</div>`;

/* ------------------------------------------------------------------ Pages */

/* Bulles qui montent dans le héros (positions fixes : même rendu à chaque visite). */
const MONTANTES = [[6, 14, 13, 0], [14, 8, 17, 4], [27, 20, 15, 9], [38, 10, 19, 2], [52, 16, 14, 7], [63, 9, 18, 11], [74, 22, 16, 5], [86, 12, 20, 1], [94, 18, 15, 8]];
const bullesMontantes = () => MONTANTES.map(([x, t, d, r]) =>
  `<span class="monte" style="left:${x}%;width:${t}px;height:${t}px;animation-duration:${d}s;animation-delay:-${r}s"></span>`).join("");

/* Le ménage à l'ancienne face au ménage digitalisé. */
const COMPARAISON = [
  ["Prix", "Devis, attente, négociation", "Prix affiché tout de suite, sans surprise"],
  ["Réservation", "Appels, messages, relances", "2 minutes en ligne, 3 clics la fois suivante"],
  ["Qui vient chez vous", "On ne sait pas vraiment", "Cleaneur vérifié : identité, SIRET, assurance, selfie du jour"],
  ["Arrivée", "On attend sans nouvelles", "Suivi en direct, arrivée confirmée par géolocalisation"],
  ["Travail réalisé", "Aucune preuve", "Compte rendu photo avant / après, horodaté et signé"],
  ["Paiement", "À l'avance ou en espèces", "Seulement après votre validation"],
  ["En cas de souci", "Votre parole contre la sienne", "Litige en 48 h et Garantie Cleaneroo"],
];
const CHIFFRES = [["2 min", "pour réserver"], [String(RUBRIQUES.length), "prestations"], ["100 %", "digitalisé"], ["0 €", "avant validation"]];

/* ------------------------------------------------------------------ Scène du héros : étoiles et notifications vivantes */
/* Prénoms parmi les plus donnés en France ces dernières années : changent à chaque notification. */
const PRENOMS = ["Louise", "Jade", "Ambre", "Alba", "Emma", "Rose", "Alma", "Alice", "Romy", "Anna", "Lina", "Mia", "Léna", "Iris", "Chloé",
  "Gabriel", "Raphaël", "Louis", "Léo", "Maël", "Noah", "Jules", "Adam", "Arthur", "Sacha", "Lucas", "Hugo", "Isaac", "Gabin", "Liam"];
const VILLES = ["Fréjus", "Saint-Raphaël", "Cannes", "Toulon", "Nice", "Hyères", "Antibes", "Draguignan"];
/* Trois notifications, chacune avec trois messages : [icône, titre, détail] ; {p} prénom, {n} nombre, {v} ville. */
const NOTIFS = {
  fr: [
    [["position", "{p} est en route", "Arrivée dans {n} min"], ["sur-place", "{p} est sur place", "Arrivée confirmée par géolocalisation"], ["termine", "{p} a terminé", "Toutes les tâches sont cochées"]],
    [["photo", "Compte rendu reçu", "{n} photos avant / après"], ["avis", "Nouvel avis {e}", "« Impeccable, merci {p} ! »"], ["valide", "Tâches validées", "{n} tâches cochées et horodatées"]],
    [["paiement", "Payé après validation", "Crédit d'impôt selon éligibilité"], ["instantane", "Prix affiché tout de suite", "Sans devis ni attente"], ["calendrier", "Réservé en 2 minutes", "{v} · créneau confirmé"]],
  ],
  en: [
    [["position", "{p} is on the way", "Arriving in {n} min"], ["sur-place", "{p} is on site", "Arrival confirmed by geolocation"], ["termine", "{p} has finished", "Every task is ticked"]],
    [["photo", "Report received", "{n} before / after photos"], ["avis", "New review {e}", "“Spotless, thank you {p}!”"], ["valide", "Tasks approved", "{n} tasks ticked and time-stamped"]],
    [["paiement", "Paid after approval", "Tax credit subject to eligibility"], ["instantane", "Price shown instantly", "No quote, no waiting"], ["calendrier", "Booked in 2 minutes", "{v} · slot confirmed"]],
  ],
  it: [
    [["position", "{p} è in arrivo", "Arrivo tra {n} min"], ["sur-place", "{p} è sul posto", "Arrivo confermato dalla geolocalizzazione"], ["termine", "{p} ha finito", "Tutti i compiti sono spuntati"]],
    [["photo", "Report ricevuto", "{n} foto prima / dopo"], ["avis", "Nuova recensione {e}", "«Impeccabile, grazie {p}!»"], ["valide", "Compiti convalidati", "{n} compiti spuntati e con orario"]],
    [["paiement", "Pagato dopo la convalida", "Credito d'imposta secondo idoneità"], ["instantane", "Prezzo subito visibile", "Senza preventivo né attesa"], ["calendrier", "Prenotato in 2 minuti", "{v} · fascia confermata"]],
  ],
  es: [
    [["position", "{p} está en camino", "Llega en {n} min"], ["sur-place", "{p} está en el lugar", "Llegada confirmada por geolocalización"], ["termine", "{p} ha terminado", "Todas las tareas marcadas"]],
    [["photo", "Informe recibido", "{n} fotos antes / después"], ["avis", "Nueva reseña {e}", "«Impecable, ¡gracias {p}!»"], ["valide", "Tareas validadas", "{n} tareas marcadas con hora"]],
    [["paiement", "Pagado tras validar", "Crédito fiscal según elegibilidad"], ["instantane", "Precio al instante", "Sin presupuesto ni esperas"], ["calendrier", "Reservado en 2 minutos", "{v} · franja confirmada"]],
  ],
};
const hasard = l => l[Math.floor(Math.random() * l.length)];
function remplir(modele) {
  const n = { "photos": 8 + Math.floor(Math.random() * 10) };
  return modele.replace("{e}", `<span class="cinq-etoiles">${icone("avis").repeat(5)}</span>`).replace("{p}", hasard(PRENOMS)).replace("{v}", hasard(VILLES))
    .replace("{n}", /photo|foto/.test(modele) ? n.photos : /tâche|task|compit|tarea/.test(modele) ? 12 + Math.floor(Math.random() * 14) : 4 + Math.floor(Math.random() * 12));
}
const messagesNotif = () => NOTIFS[langue] || NOTIFS.fr;
const contenuNotif = ([nomIcone, titre, detail]) =>
  `<span class="pastille-notif">${icone(nomIcone)}</span><span><b>${remplir(titre)}</b><small>${remplir(detail)}</small></span>`;

/* Étoile à quatre branches (dégradé or → blanc). */
const ETOILE = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0C12.9 6.6 17.4 11.1 24 12C17.4 12.9 12.9 17.4 12 24C11.1 17.4 6.6 12.9 0 12C6.6 11.1 11.1 6.6 12 0Z"/></svg>`;
const ETOILES = [["e1", 8, 66, 54], ["e2", 20, 80, 78], ["e3", 37, 72, 40], ["e4", 16, 18, 20], ["e5", 74, 12, 16], ["e6", 6, 44, 14], ["e7", 64, 86, 22]];
const etoiles = () => ETOILES.map(([c, haut, gauche, t]) =>
  `<span class="etoile ${c}" style="top:${haut}%;left:${gauche}%;width:${t}px;height:${t}px">${ETOILE}</span>`).join("");

let minuterieNotifs = null;
function animerNotifs(racine) {
  clearInterval(minuterieNotifs);
  const cartes = [...racine.querySelectorAll("[data-notif]")];
  if (!cartes.length) return;
  const etat = cartes.map(() => 0);
  let tour = 0;
  minuterieNotifs = setInterval(() => {
    if (!document.body.contains(cartes[0])) return clearInterval(minuterieNotifs);
    const i = tour++ % cartes.length, carte = cartes[i];
    etat[i] = (etat[i] + 1) % 3;
    carte.classList.add("change");
    setTimeout(() => { carte.innerHTML = contenuNotif(messagesNotif()[i][etat[i]]); carte.classList.remove("change"); }, 380);
  }, 2600);
}

function blocRecommander() {
  const m = modeles()[0];
  if (!m) return "";
  const r = rubrique(m.rubriqueId), l = logements().find(x => x.id === m.logementId);
  return `<a class="recommander" href="#/reserver/${m.rubriqueId}/rapide">${icone(r.icone, { tuile: true })}
    <span style="flex:1"><small>Comme la dernière fois</small><b>${r.nom}</b>${l ? `<span class="lieu">${esc(nomLogement(l))}</span>` : ""}</span>
    <span class="fleche">Recommander ›</span></a>`;
}

/* ------------------------------------------------------------------ Accueil 2026 : clair, structuré, un espace pour chacun */
const ESPACES_ACCUEIL = [
  ["logement", "Particuliers", "Ménage régulier ou ponctuel, vitres, canapés et textiles, avec crédit d'impôt selon éligibilité.", "#/estimer", "Estimer mon prix"],
  ["location", "Conciergeries et multi-biens", "Agenda relié à Airbnb et Booking, ménages entre deux voyageurs, photo de la boîte à clés et carte de tous vos biens.", "#/compte/pro", "Créer mon espace Pro"],
  ["cleaneurs", "Cleaneurs", "Missions près de chez vous, itinéraire, déroulé guidé et paiement sécurisé. 3 mois de formule Pro offerts aux inscrits jusqu'au 31 janvier 2027.", "#/devenir-cleaneur", "Devenir Cleaneur"],
];
/* Inscription inspirante (visiteur) : un espace par profil, chacun avec son avantage offert. Même bloc dans l'appli (Vitrine.kt). */
const INSCRIPTION_ESPACES = () => [
  ["logement", "Particulier", "Votre ménage, sans y penser.", ["Prix affiché tout de suite", "Suivi du Cleaneur en direct", "Crédit d'impôt selon éligibilité"],
    `${euros(REGLES.PARRAINAGE_FILLEUL_C)} ${tr("offerts avec un code de parrainage")}`, "#/compte/creer"],
  ["location", "Conciergerie ou plusieurs biens", "Vos locations, toujours prêtes.", ["Agenda relié à Airbnb et Booking", "Ménages entre deux voyageurs", "Compte rendu photo de chaque logement"],
    `${REGLES.ABONNEMENT_PRO_MOIS_OFFERTS} ${tr("mois d'abonnement offert")}`, "#/compte/pro"],
  ["cleaneurs", "Cleaneur", "Vos missions, votre liberté.", ["Missions près de chez vous", "Paiement sécurisé après chaque mission", "Itinéraire et déroulé guidé"],
    `${REGLES.OFFRE_LANCEMENT_MOIS} ${tr("mois de formule Pro offerts")}`, "#/compte/cleaneur"],
];
function blocInscriptionInspirante() {
  return `<section class="inscription-inspirante"><div class="conteneur">
    <div class="tete-inspirante revele">
      <span class="pastille-lancement sombre"><i></i>${estPrelancement() ? `J-${joursAvantLancement()} · ` : ""}${tr("Gratuit · sans engagement · 1 minute")}</span>
      <h2>${tr("Votre espace Cleaneroo vous attend.")}</h2>
      <p>${tr("Créez-le dès maintenant : tout sera prêt pour le 31 décembre 2026, et vos avantages de lancement sont gardés.")}</p>
    </div>
    <div class="cartes-inspirantes">${INSCRIPTION_ESPACES().map(([ico, titre, accroche, points, cadeau, lien], i) => `
      <a class="carte-inspirante revele" href="${lien}" style="--retard:${i * 90}ms">
        <span class="cadeau-espace">${icone("cadeau")}${cadeau}</span>
        ${icone(ico, { tuile: true })}
        <h3>${tr(titre)}</h3>
        <p class="accroche">${tr(accroche)}</p>
        <ul>${points.map(x => `<li>${icone("valide")}${tr(x)}</li>`).join("")}</ul>
        <span class="bouton plein">${tr("Créer mon espace")}</span>
      </a>`).join("")}</div>
    <p class="pied-inspirant">${tr("Déjà inscrit ?")} <a href="#/compte">${tr("Se connecter")}</a> · ${tr("Juste être prévenu du lancement ?")} <a href="#/inscription/client">${tr("Laisser mon e-mail")}</a></p>
  </div></section>`;
}

const FONCTIONS_DIGITALES = [
  ["position", "Suivi en direct", "Votre Cleaneur sur la carte, comme une livraison, avec son heure d'arrivée."],
  ["photo", "Compte rendu photo", "Chaque pièce photographiée avant et après, horodatée, dans votre espace."],
  ["calendrier", "Agenda connecté", "Calendriers Airbnb et Booking reliés : les ménages se programment en un geste."],
  ["paiement", "Payé après validation", "Vous validez le travail, puis le paiement part. Jamais avant."],
];

/** Maquette de l'application : carte du trajet, statut qui change, compte rendu photo et paiement (aucune image). */
function maquetteAppli(m) {
  return `<div class="telephone">
    <div class="telephone-ecran">
      <div class="tel-haut"><span class="tel-marque"><img src="assets/img/logo-marque.svg" alt="" width="22" height="22"><b>Cleaneroo</b></span><span class="tel-avatar">L</span></div>
      <div class="tel-carte">
        <svg viewBox="0 0 300 170" preserveAspectRatio="xMidYMid slice">
          <rect width="300" height="170" fill="var(--carte-fond)"/>
          <path d="M-10 120 C60 100 90 140 160 118 S260 70 320 84" class="tel-route-grande"/>
          <path d="M40 -10 C60 50 30 90 70 180" class="tel-route"/><path d="M200 -10 C190 60 230 110 210 180" class="tel-route"/>
          <path d="M-10 40 C80 52 150 20 320 36" class="tel-route"/>
          <rect x="226" y="98" width="46" height="34" rx="6" class="tel-parc"/><rect x="18" y="12" width="40" height="26" rx="6" class="tel-parc"/>
          <path d="M52 132 C90 126 108 92 150 96 S214 74 236 58" class="tel-trajet"/>
          <circle cx="236" cy="58" r="9" class="tel-maison"/><path d="M231.5 59.5 236 55.5l4.5 4v4h-9z" fill="#fff"/>
          <g class="tel-cleaneur"><circle cx="150" cy="96" r="13" class="tel-halo"/><circle cx="150" cy="96" r="9"/><text x="150" y="99.5" text-anchor="middle">L</text></g>
        </svg>
        <span class="tel-eta"><b>8 min</b> · arrivée vers 14 h 12</span>
      </div>
      ${m.map((liste, i) => `<div class="notif tel-notif n${i + 1}" data-notif="${i}">${contenuNotif(liste[0])}</div>`).join("")}
    </div>
  </div>`;
}

/** Compte connecté (session Supabase lue avant chaque page, ou profil mémorisé) : l'accueil n'invite plus à s'inscrire. */
let sessionActive = false;
const connecte = () => sessionActive || !!profilMemorise();
function pageAccueil() {
  const m = messagesNotif();
  return `
  <section class="heros-2026">
    <div class="conteneur heros-grille">
      <div class="heros-texte">
        <span class="pastille-lancement"><i></i>Lancement le 31 décembre 2026</span>
        <h1><span>Le ménage</span><span class="ponct">,</span> <span class="degrade-texte"><span>100 % digitalisé</span><span class="ponct">.</span></span></h1>
        <p class="heros-sous">Réservez en deux minutes, suivez votre Cleaneur en direct et recevez un compte rendu photo. Vous ne payez qu'une fois le travail validé.</p>
        <form class="recherche-heros" id="express">
          <label><span>Débuter ma prestation</span><select name="rubrique" required><option value="" disabled selected>Choisir une prestation</option>${RUBRIQUES.map(r => `<option value="${r.id}">${r.nom}</option>`).join("")}</select></label>
          <button class="bouton" type="submit">Commencer</button>
        </form>
        ${blocRecommander()}
        <ul class="preuves"><li>${icone("garantie")}Cleaneurs vérifiés</li><li>${icone("paiement")}Payé après validation</li><li>${icone("credit-impot")}Crédit d'impôt selon éligibilité</li></ul>
      </div>
      <div class="heros-visuel" aria-hidden="true">
        <span class="forme forme-1"></span><span class="forme forme-2"></span><span class="forme forme-3"></span>
        ${maquetteAppli(m)}
        <div class="flottant flottant-1" data-teinte="menthe">${icone("garantie", { tuile: true })}<b>Cleaneurs vérifiés</b></div>
        <div class="flottant flottant-2" data-teinte="soleil">${icone("credit-impot", { tuile: true })}<b>Crédit d'impôt<small>selon éligibilité</small></b></div>
      </div>
    </div>
  </section>
  <section class="bandeau-chiffres"><div class="conteneur">${CHIFFRES.map(([n, l], i) => `<div data-teinte="${["turquoise", "corail", "soleil", "lilas"][i]}"><b>${n}</b><span>${l}</span></div>`).join("")}</div></section>
  ${connecte() ? `<section class="bloc"><div class="conteneur">
    ${titreSection("Un espace pour chacun", "Particuliers, conciergeries et Cleaneurs : chacun a son espace, pensé pour son usage.", "Pour qui ?")}
    <div class="grille-3 espaces-accueil">${ESPACES_ACCUEIL.map(([ico, titre, texte, lien, action]) => `
      <a class="carte espace-carte revele" data-teinte="${teinte(ico)}" href="${lien}">${icone(ico, { tuile: true })}<h3>${titre}</h3><p class="muet">${texte}</p><span class="aller">${action} ›</span></a>`).join("")}</div>
  </div></section>` : blocInscriptionInspirante()}
  <section class="bloc bloc-doux"><div class="conteneur">
    ${titreSection("Nos prestations", "Le prix s'affiche dès que vous décrivez votre besoin.", "Prestations")}
    <div class="grille-3">${RACCOURCIS_VITRINE.map(([id, nom, sous]) => `
      <a class="carte prestation revele" data-teinte="${teinte(rubrique(id).icone)}" href="#/estimer/${id}">${icone(rubrique(id).icone, { tuile: true })}<h3>${nom}</h3><p class="muet">${sous}</p><span class="aller">Estimer ›</span></a>`).join("")}</div>
    <p class="centre" style="margin-top:26px"><a class="bouton secondaire" href="#/prestations">Voir toutes les prestations ›</a></p>
  </div></section>
  <section class="bloc"><div class="conteneur">
    ${titreSection("Tout est digitalisé", "De la réservation au paiement, chaque étape se suit sur votre téléphone.", "Le ménage nouvelle génération")}
    <div class="grille-4 fonctions">${FONCTIONS_DIGITALES.map(([ico, titre, texte]) => `
      <div class="fonction revele" data-teinte="${teinte(ico)}">${icone(ico, { tuile: true })}<h3>${titre}</h3><p class="muet">${texte}</p></div>`).join("")}</div>
    <div class="comparaison revele" role="table" aria-label="Le ménage nouvelle génération" style="margin-top:34px">
      <div class="ligne entete-comp" role="row"><span role="columnheader"></span><span role="columnheader">À l'ancienne</span><span role="columnheader">Avec Cleaneroo</span></div>
      ${COMPARAISON.map(([c, a, n]) => `<div class="ligne" role="row"><b role="rowheader">${c}</b><span class="ancien" role="cell">${a}</span><span class="nouveau" role="cell">${n}</span></div>`).join("")}
    </div>
  </div></section>
  <section class="bloc bloc-doux"><div class="conteneur">
    ${titreSection("Comment ça marche ?", "Du clic à la validation, tout se passe en ligne.", "En 5 étapes")}
    ${blocEtapes()}
    <div class="revele" style="margin-top:34px">${blocReassurance()}</div>
    <div class="credit revele">
      <div class="pastille-credit">${icone("credit-impot")}</div>
      <div><h3>Crédit d'impôt selon éligibilité</h3><p>Possible si le Cleaneur est déclaré « services à la personne » : le ménage, les vitres et les textiles à votre domicile peuvent alors ouvrir droit à un crédit d'impôt, selon votre situation et dans la limite des plafonds légaux. L'attestation fiscale des prestations éligibles vous est envoyée chaque mois.</p></div>
    </div>
  </div></section>
  ${estPrelancement() && !connecte() ? `<section class="appel-2026"><div class="conteneur appel-grille"><div class="revele"><span class="pastille-lancement sombre"><i></i>J-${joursAvantLancement()}</span>
      <h2>Prêts pour le 31 décembre ?</h2><p>Inscrivez-vous maintenant : les premiers inscrits sont prévenus en priorité.</p>
      <div class="boutons"><a class="bouton clair" href="#/estimer">Estimer mon prix</a></div></div>
      <div class="revele" id="inscription">${formulaireInscription()}</div></div></section>` : ""}`;
}

/** Réservation express de l'accueil : prestation + code postal → parcours prérempli. */
function brancherExpress(racine) {
  const f = racine.querySelector("#express");
  if (!f) return;
  f.onsubmit = e => {
    e.preventDefault();
    location.hash = f.rubrique.value ? `#/estimer/${f.rubrique.value}` : "#/estimer";
  };
}

/** Apparition douce des blocs au défilement (désactivée si l'utilisateur limite les animations). */
const observateur = "IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches
  ? new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add("visible"); observateur.unobserve(e.target); } }), { rootMargin: "0px 0px 120px 0px" })
  : null;
function reveler(racine) {
  const enAttente = [...racine.querySelectorAll(".revele, .etape")];
  enAttente.forEach((el, i) => {
    if (!observateur) return el.classList.add("visible");
    el.style.transitionDelay = `${Math.min(i % 4, 3) * 60}ms`;
    observateur.observe(el);
  });
  if (!observateur) return;
  /* Filet de sécurité : au défilement (même un saut direct à une section), tout bloc arrivé à l'écran s'affiche aussitôt. */
  const verifier = () => {
    const bas = innerHeight + 160;
    for (const el of enAttente) if (!el.classList.contains("visible") && el.getBoundingClientRect().top < bas) { el.classList.add("visible"); observateur.unobserve(el); }
    if (enAttente.every(el => el.classList.contains("visible"))) removeEventListener("scroll", auDefilement);
  };
  let dernier = 0;
  const auDefilement = () => { const t = Date.now(); if (t - dernier > 80) { dernier = t; verifier(); } };
  addEventListener("scroll", auDefilement, { passive: true });
  setTimeout(verifier, 300);
}

function pageInscription(type = "client") {
  return `<section class="fond-cleaneroo" style="padding:40px 0 90px">${decor([[90, 20, 90], [4, 60, 60]], [])}
    <div class="conteneur"><span class="etiquette" style="background:#C24A38">J-${joursAvantLancement()}</span>
      <h1 style="margin-top:10px">Lancement le 31 décembre 2026</h1><div class="trait-corail"></div>
      <p class="slogan" style="font-size:20px;font-weight:600;margin:0">${MESSAGE_LANCEMENT}</p></div></section>
  <section class="bloc"><div class="etroit">${formulaireInscription(type, type === "cleaneur")}</div></section>`;
}

function pagePrestations() {
  return `<section class="fond-cleaneroo" style="padding:32px 0 56px">${decor([[90, 20, 90], [72, 70, 44]], [])}
    <div class="conteneur"><h1>Nos prestations</h1><div class="trait-corail"></div><p>${RUBRIQUES.length} univers de nettoyage, un seul parcours de réservation.</p></div></section>
  <section class="bloc" style="padding-top:28px"><div class="conteneur"><div class="grille-3">${RUBRIQUES.map(r => `
    <a class="carte prestation" href="#/estimer/${r.id}">${icone(r.icone, { tuile: true })}<h3>${r.nom}</h3>
      <p class="muet" style="margin:4px 0 8px">${r.sousTitre}</p>
      <span class="tampon">${pastille(r)}</span></a>`).join("")}</div></div></section>`;
}

function pageComment() {
  return `<section class="fond-cleaneroo" style="padding:40px 0 90px">${decor([[90, 20, 90], [4, 60, 60]], [])}
    <div class="conteneur"><h1>Comment ça marche ?</h1><div class="trait-corail"></div><p>Du clic à la validation, tout se passe en ligne.</p></div></section>
  <section class="bloc"><div class="conteneur">${blocEtapes()}
    <div class="grille-2 etroit" style="margin-top:28px">
      <div class="carte fond-cleaneroo" style="border:0"><h3>Côté Cleaneur</h3><div class="trait-corail"></div>
        <p style="margin:0">Je pars, puis j'arrive (géolocalisé) · Selfie du jour · Tâches et photos guidées · Signature et compte rendu · Paiement après validation.</p></div>
      <a class="carte ligne-compte" href="#/suivi-demo" style="grid-column:1/-1">${icone("position", { tuile: true })}
        <div class="corps"><h3 style="margin:0">Suivez votre Cleaneur en direct</h3><p class="muet" style="margin:2px 0 0">Sur une carte, jusqu'à chez vous, comme une livraison. Voir la démonstration.</p></div><span class="aller" aria-hidden="true">›</span></a>
      <div class="carte"><h3>Vos garanties</h3><div class="trait-corail"></div>
        <p class="muet" style="margin:0">Débit seulement après validation · Garantie Cleaneroo · Crédit d'impôt selon éligibilité · Cleaneurs vérifiés · Annulation gratuite jusqu'à 48 h avant.</p></div>
    </div>
    <img src="assets/img/affiche.jpg" alt="Affiche « Comment ça marche ? »" loading="lazy" style="width:min(620px,100%);margin:36px auto 0;border-radius:18px;box-shadow:var(--ombre)">
  </div></section>`;
}

/** Compteur de l'offre de lancement : lu dans la base (dossiers validés), masqué si elle ne répond pas. */

/* Offre de lancement des Cleaneurs (mêmes valeurs que Regles.kt) */
/** « Devenir Cleaneur » : les deux formules (Gratuit / Pro), avantages, inconvénients et offre de lancement. */
function blocOffreCleaneurs() {
  return `<h2 class="titre-section">${icone("paiement", { tuile: true })}Deux formules, à vous de choisir</h2>${blocFormulesCleaneur(null)}`;
}

/** Exemple concret de revenu pour un Cleaneur : un ménage de location de 2 h (prix catalogue), en formule Gratuite et Pro. */
function exempleRevenu() {
  const prixC = calculer(entreeEstimation({ ...brouillonExemple("rental", {}) }, false, null)).totalC;
  const gratuit = Math.round(prixC * (10000 - REGLES.COMMISSION_GRATUIT_PB) / 10000), pro = Math.round(prixC * (10000 - REGLES.COMMISSION_PRO_PB) / 10000);
  return `<div class="carte teintee" style="margin-bottom:16px"><b>💶 ${tr("Exemple : un ménage de location saisonnière")}</b>
    <p style="margin:6px 0 0">${tr("Prix de la prestation")} : <b>${euros(prixC)}</b> · ${tr("vous touchez")} <b>${euros(gratuit)}</b> ${tr("en formule Gratuite")}, <b>${euros(pro)}</b> ${tr("en formule Pro")}.</p>
    <p class="petit" style="margin:4px 0 0">${tr("Pourboires en plus, à 100 % pour vous. Vous déclarez vous-même votre chiffre d'affaires (micro-entreprise).")}</p></div>`;
}
function pageDevenir() {
  const etapes = ["Avoir un statut d'indépendant", "Préparer vos documents (pièce d'identité, SIRET, RC Pro, attestation de vigilance URSSAF)",
    "Pour la dératisation et la désinsectisation : Certibiocide « nuisibles » obligatoire",
    "Déposer votre dossier (zone, prestations ; chaque document vérifié avant activation)", "Signer le contrat de prestataire et valider les formations de vos prestations",
    "Réussir la mission test (rémunérée 40 €, payée par Cleaneroo)",
    "Choisir vos missions (prix et horaires proposés, libre d'accepter)", "Être payé (validation client → commission prélevée → versement)"];
  return `<section class="fond-cleaneroo" style="padding:40px 0 90px">${decor([[90, 20, 90], [4, 60, 60]], [])}
    <div class="conteneur"><h1>Devenir Cleaneur</h1><div class="trait-corail"></div><p>Travaillez à votre rythme, près de chez vous.</p>
      <div class="etiquettes"><span class="etiquette">Missions proches</span><span class="etiquette">Compte rendu guidé</span><span class="etiquette">Paiement sécurisé</span></div></div></section>
  <section class="bloc"><div class="etroit"><div data-acces-cleaneur></div>${exempleRevenu()}${blocOffreCleaneurs()}${etapes.map((t, i) => `<div class="carte" style="margin-bottom:10px"><b style="color:var(--corail-texte)">${i + 1}.</b> ${t}</div>`).join("")}
    <div style="margin-top:18px">${formulaireInscription("cleaneur", true)}</div>
  </div></section>`;
}

const pageTexte = (titre, html) => `<section class="bloc"><div class="etroit"><h1>${titre}</h1><div class="trait-corail"></div>${html}</div></section>`;

/** Pages légales : textes de legal.js (site et appli identiques, 4 langues). */
const pageLegale = (titre, liste, numeros = true) => pageTexte(titre, liste.map(([t, x], i) =>
  `<h3 style="margin:22px 0 6px">${numeros ? `${i + 1}. ` : ""}${esc(tr(t))}</h3><p style="margin:0">${esc(texteLegal(x))}</p>`).join(""));
function pageConfidentialite() { return pageLegale("Confidentialité", CONFIDENTIALITE); }
function pageConditions() { return pageLegale("Conditions générales", CONDITIONS); }
function pageMentions() { return pageLegale("Mentions légales", MENTIONS, false); }

const STATUTS = { VERIFICATION: "En cours de vérification", PUBLIEE: "En ligne · candidatures", CONFIRMEE: "Confirmée", EN_ROUTE: "Cleaneur en route",
  SUR_PLACE: "Cleaneur sur place", EN_COURS: "En cours", A_VALIDER: "À valider", TERMINEE: "Terminée", ANNULEE: "Annulée" };
export const libelleStatut = s => STATUTS[s] || s;

const ETAPES_SUIVI = ["VERIFICATION", "PUBLIEE", "CONFIRMEE", "EN_ROUTE", "SUR_PLACE", "EN_COURS", "A_VALIDER", "TERMINEE"];

/**
 * Sinistre : e-mail pré-rempli pour l'assureur du client (le client choisit l'adresse de son assureur et l'envoie).
 * En français : il s'adresse à un assureur français. Même texte que l'appli (mailAssurance dans EcransClient.kt).
 */
function mailAssurance(d, lien) {
  const quand = d.creneau ? dateLongue(new Date(d.creneau)) : "date à confirmer";
  const corps = [
    "Madame, Monsieur,",
    "",
    "Suite au sinistre survenu dans mon logement, je vous transmets les informations de l'intervention de nettoyage réalisée par Cleaneroo, en vue de sa prise en charge.",
    "",
    `Référence : ${d.reference}`,
    `Adresse : ${d.rue}, ${d.code_postal} ${d.ville}`,
    `Date : ${quand}`,
    `Montant : ${d.sur_devis ? "sur devis" : euros(d.estimation_c)} TTC`,
    `Compte rendu, photos avant / après et facture : ${lien}`,
    "",
    "Je reste à votre disposition pour tout complément.",
    "",
    `${d.prenom || ""} ${d.nom || ""}`.trim(),
  ].join("\n");
  return `mailto:?subject=${encodeURIComponent(`Sinistre : intervention de nettoyage Cleaneroo ${d.reference}`)}&body=${encodeURIComponent(corps)}`;
}

let demandeAffichee = null;   // pour le suivi en direct (carte)
async function pageDemande(ref, jeton) {
  let d = null;
  try { d = await suivre(ref, jeton); } catch { /* lien invalide */ }
  demandeAffichee = d ? { ...d, jeton } : null;
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
    <div class="etroit"><p style="margin:0;opacity:.85">Réf. ${esc(d.reference)}</p><h1>${icone(r.icone)} ${r.nom}</h1><div class="trait-corail"></div>
      <span class="etiquette" style="background:rgba(255,255,255,.22)">${libelleStatut(d.statut)}</span></div></section>
  <section class="bloc" style="padding-top:28px"><div class="etroit">
    <div class="progression">${ETAPES_SUIVI.map((_, i) => `<span class="${d.statut !== "ANNULEE" && i <= idx ? "fait" : ""}"></span>`).join("")}</div>
    <div class="note" style="margin-bottom:14px">${etat}</div>
    ${["PUBLIEE", "CONFIRMEE"].includes(d.statut) ? `<div id="remplacement-client"></div>` : ""}
    ${d.statut === "PUBLIEE" && d.choix_cleaneur !== "directe" ? `<div id="propositions-client"></div>` : ""}
    ${["CONFIRMEE", "EN_ROUTE"].includes(d.statut) ? `<div id="retard-client"></div>` : ""}
    ${d.statut === "EN_ROUTE" ? `<div id="presence-client"></div>` : ""}
    ${["EN_ROUTE", "SUR_PLACE"].includes(d.statut) ? `<div id="suivi-live" style="margin-bottom:14px"></div>`
      : ["VERIFICATION", "PUBLIEE", "CONFIRMEE"].includes(d.statut) ? `<a class="carte ligne-compte" href="#/suivi-demo" style="margin-bottom:14px">${icone("position", { tuile: true })}
        <div class="corps"><b>Suivi en direct le jour J</b><p class="petit" style="margin:2px 0 0">Vous suivrez votre Cleaneur sur une carte jusqu'à chez vous. Voir la démonstration.</p></div><span class="aller" aria-hidden="true">›</span></a>` : ""}
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
    ${d.rubrique_id === "special" ? `<div class="carte" style="margin-bottom:12px"><b>Dossier pour mon assurance</b>
      <p class="petit" style="margin:4px 0 8px">Préparez l'e-mail pour votre assureur : référence, adresse, date et montant de l'intervention, avec le lien vers le compte rendu et les photos.</p>
      <a class="bouton secondaire" href="${mailAssurance(d, lien)}">Préparer l'e-mail à mon assureur</a></div>` : ""}
    ${annulable ? `<div id="modifier-demande"></div>` : ""}
    ${d.statut !== "ANNULEE" ? `<div class="boutons" style="margin:10px 0" id="bon-client">${boutonBon(ref, jeton)}</div>` : ""}
    ${annulable ? `<button type="button" class="bouton danger plein" id="annuler-demande">Annuler la demande</button>
      <p class="petit">Annulation gratuite : aucun Cleaneur n'est encore confirmé.</p>` : ""}
    ${d.rubrique_id === "rental" && ["EN_COURS", "A_VALIDER", "TERMINEE"].includes(d.statut) ? `<div id="consommables-client"></div>` : ""}
    ${["A_VALIDER", "TERMINEE"].includes(d.statut) ? `<div id="favori-client" data-rubrique="${esc(d.rubrique_id)}"></div>` : ""}
    ${["SUR_PLACE", "EN_COURS", "A_VALIDER", "TERMINEE", "ANNULEE"].includes(d.statut) ? `<div id="supplement-client"></div><div id="constat-arrivee"></div>` : ""}
    ${["EN_COURS", "A_VALIDER", "TERMINEE", "ANNULEE"].includes(d.statut) ? `<div id="compte-rendu-pieces"></div>` : ""}
  </div></section>`;
}

/* ------------------------------------------------------------------ Démonstration du suivi en direct (aucune vraie mission avant l'ouverture) */
const DEMO_TRAJET = { depart: { lat: 43.4364, lon: 6.7366 }, arrivee: { lat: 43.4232, lon: 6.7700 }, prenom: "Louise", dureeS: 60 };
function pageSuiviDemo() {
  return `<section class="fond-cleaneroo" style="padding:34px 0 86px">${decor([[90, 18, 90], [5, 55, 60]], [])}
    <div class="etroit"><span class="etiquette" style="background:rgba(255,255,255,.22)">Démonstration</span><h1>Suivez votre Cleaneur en direct</h1><div class="trait-corail"></div>
      <p style="margin:0">Le jour J, vous voyez votre Cleaneur avancer sur la carte jusqu'à chez vous, comme une livraison.</p></div></section>
  <section class="bloc" style="padding-top:28px"><div class="etroit">
    <div id="suivi-live" style="margin-bottom:14px"></div>
    <button type="button" class="bouton secondaire" id="rejouer">↻ Rejouer la démonstration</button>
    <div class="grille-2" style="margin-top:22px">
      <div class="carte"><b>Position en direct</b><p class="petit" style="margin:4px 0 0">Le téléphone du Cleaneur envoie sa position pendant le trajet uniquement. Elle est effacée dès son arrivée.</p></div>
      <div class="carte"><b>Même en arrière-plan</b><p class="petit" style="margin:4px 0 0">Gardez une petite fenêtre de suivi au-dessus de vos autres fenêtres, ou recevez une alerte à son arrivée.</p></div>
    </div>
  </div></section>`;
}

/* ------------------------------------------------------------------ Navigation */
/* Page de contrôle des icônes (#/icones, pas de lien dans le menu) : tuile et en ligne, 3 tailles, fond clair puis sombre. */
function pageIcones() {
  const noms = [...ICONES_RUBRIQUES, ...ICONES_INTERFACE];
  const planche = theme => `<div class="planche-ico ${theme}"><h2>${theme === "ico-clair" ? "Fond clair" : "Fond sombre"}</h2><div class="grille-ico">${noms.map(n => `
    <figure><div class="tailles">${[20, 28, 48].map(t => `<span style="--t:${t}px">${icone(n, { tuile: true })}</span>`).join("")}</div>
      <div class="tailles en-ligne">${[20, 28, 48].map(t => `<span style="font-size:${t / 1.15}px">${icone(n)}</span>`).join("")}</div>
      <figcaption>${n}</figcaption></figure>`).join("")}</div></div>`;
  return `<section class="bloc"><div class="conteneur"><h1>Icônes Cleaneroo</h1><p class="muet">${noms.length} icônes : en tuile et en ligne, à 20, 28 et 48 px.</p>
    ${planche("ico-clair")}${planche("ico-sombre")}</div></section>`;
}

const ROUTES = {
  "": pageAccueil, "vitrine": pageAccueil, "prestations": pagePrestations, "comment-ca-marche": pageComment, "devenir-cleaneur": pageDevenir,
  "inscription": () => pageInscription(), "confidentialite": pageConfidentialite, "conditions": pageConditions, "mentions-legales": pageMentions,
  "icones": pageIcones,
};

let arreterSuivi = () => {};
let espacePrecedent = null;
async function afficherPage() {
  clearInterval(minuterieNotifs);
  arreterEcouteDemandes();
  arreterTableau();
  arreterSuivi(); arreterSuivi = () => {};
  decorTableau(false);
  const chemin = location.hash.replace(/^#\/?/, "");
  const [route, param] = chemin.split("/");
  if (route === "gestion") { location.href = "gestion.html"; return; }
  // Changement d'espace (Particulier, Pro, Cleaneur) : transition « laveur de vitres », comme l'appli.
  const espace = route === "compte" && ["particulier", "entreprise", "pro", "cleaneur"].includes(param) ? param : null;
  if (espace && espacePrecedent && espace !== espacePrecedent) transitionVitre();
  if (espace) espacePrecedent = espace;
  // Accès Cleaneur : l'accueil, les prestations, l'estimation et « Mes prestations » mènent à son espace.
  if (document.body.classList.contains("acces-cleaneur") && ["", "prestations", "reserver", "estimer", "mes-demandes", "mes-biens"].includes(route)) { location.replace("#/compte/cleaneur"); return; }
  compterPage(route, param);
  marquerActif();
  // Barre des espaces sur l'accueil (entre le logo et le bandeau de lancement) : Particulier, Pro, Cleaneur.
  // Connecté : ouvre son espace (ou propose de l'ajouter) ; sinon : création du compte adéquat. Même barre dans l'appli (Vitrine.kt).
  const barre = document.getElementById("barre-espaces");
  if (barre) { barre.innerHTML = route === "" ? `<div class="barre-espaces"><div class="conteneur">${barreOnglets(null)}</div></div>` : ""; traduire(barre); }
  document.body.classList.toggle("sans-rappel", route === "reserver" || route === "estimer");
  // Pages qui attendent le serveur : animation de chargement pendant l'attente.
  if (route === "messages") { window.scrollTo(0, 0); vue.innerHTML = pageChargement(); traduire(vue); await pageMessages(vue, chemin.split("/").slice(1).join("/")); return; }
  if (route === "notifications") { window.scrollTo(0, 0); vue.innerHTML = pageChargement(); traduire(vue); await pageNotifications(vue, param); return; }
  if (route === "compte") { window.scrollTo(0, 0); vue.innerHTML = pageChargement(); traduire(vue); await pageCompte(vue, param); return; }
  if (route === "mes-demandes" || route === "mes-biens") {
    const deja = vue.querySelector(".onglets-demandes") && route === "mes-demandes";
    if (!deja) { vue.innerHTML = pageChargement(); traduire(vue); }
    await pageMesPrestations(vue, route === "mes-biens" ? "biens" : "demandes", param);
    if (!deja) window.scrollTo(0, 0);
    return;
  }
  if (route === "reserver") { ouvrirReservation(vue, param || null, chemin.split("/")[2] || ""); window.scrollTo(0, 0); return; }
  if (route === "estimer") { ouvrirSimulateur(vue, param || null); window.scrollTo(0, 0); return; }
  if (route === "inscription" && param) { vue.innerHTML = pageInscription(param); brancherInscription(vue); traduire(vue); window.scrollTo(0, 0); return; }
  if (route === "suivi-demo") {
    vue.innerHTML = pageSuiviDemo();
    traduire(vue);
    window.scrollTo(0, 0);
    const lancer = () => { arreterSuivi(); demoSuivi(vue.querySelector("#suivi-live"), DEMO_TRAJET).then(f => arreterSuivi = f); };
    lancer();
    vue.querySelector("#rejouer").onclick = lancer;
    return;
  }
  if (route === "demande") {
    const [, ref, jeton] = chemin.split("/");
    vue.innerHTML = pageChargement("Recherche de votre demande…"); traduire(vue);
    vue.innerHTML = await pageDemande(decodeURIComponent(ref || ""), decodeURIComponent(jeton || ""));
    traduire(vue);
    window.scrollTo(0, 0);
    // Compte rendu pièce par pièce (photos avant / après, tâches, avis de l'IA) pour le client connecté.
    const rendu = document.getElementById("compte-rendu-pieces");
    if (rendu) compteRenduPieces(rendu, decodeURIComponent(ref || ""));
    // Présence du Cleaneur à confirmer (sa position n'a pas pu confirmer l'arrivée).
    blocModifier(document.getElementById("modifier-demande"), demandeAffichee || {}, decodeURIComponent(ref || ""), decodeURIComponent(jeton || ""), () => afficher());
    brancherBons(document.getElementById("bon-client"));
    blocSupplementClient(document.getElementById("supplement-client"), decodeURIComponent(ref || ""), decodeURIComponent(jeton || ""));
    blocConstat(document.getElementById("constat-arrivee"), decodeURIComponent(ref || ""), decodeURIComponent(jeton || ""));
    const fav = document.getElementById("favori-client");
    if (fav) blocFavori(fav, decodeURIComponent(ref || ""), fav.dataset.rubrique);
    blocRemplacementClient(document.getElementById("remplacement-client"), decodeURIComponent(ref || ""), decodeURIComponent(jeton || ""));
    blocConsommablesClient(document.getElementById("consommables-client"), decodeURIComponent(ref || ""), decodeURIComponent(jeton || ""));
    blocPropositionsClient(document.getElementById("propositions-client"), decodeURIComponent(ref || ""), decodeURIComponent(jeton || ""));
    blocRetardClient(document.getElementById("retard-client"), decodeURIComponent(ref || ""), decodeURIComponent(jeton || ""));
    const presence = document.getElementById("presence-client");
    if (presence) supabase.rpc("presence_a_confirmer", { p_reference: decodeURIComponent(ref || ""), p_jeton: decodeURIComponent(jeton || "") }).then(({ data }) => {
      if (!data || !presence.isConnected) return;
      presence.innerHTML = `<div class="carte teintee" style="margin-bottom:14px"><b>📍 ${tr("Votre Cleaneur est-il arrivé ?")}</b>
        <p class="petit" style="margin:4px 0 10px">${tr("Sa géolocalisation n'a pas pu le confirmer. Confirmez-vous sa présence chez vous ?")}</p>
        <div class="boutons"><button type="button" class="bouton" data-present="1">${tr("Oui, il est là")}</button>
        <button type="button" class="bouton secondaire" data-present="0">${tr("Non, pas encore")}</button></div></div>`;
      presence.querySelectorAll("[data-present]").forEach(b => b.onclick = async () => {
        b.disabled = true;
        await supabase.rpc("repondre_presence", { p_reference: decodeURIComponent(ref || ""), p_present: b.dataset.present === "1", p_jeton: decodeURIComponent(jeton || "") });
        location.reload();
      });
    });
    const boite = document.getElementById("suivi-live");
    if (boite && demandeAffichee) suivreEnDirect(boite, demandeAffichee).then(f => { if (document.body.contains(boite)) arreterSuivi = f; else f(); });
    document.getElementById("annuler-demande")?.addEventListener("click", async e => {
      if (!confirm(tr("Annuler cette demande ? Aucun frais ne sera appliqué."))) return;
      e.target.disabled = true;
      try { await annuler(ref, jeton); } catch { /* rien */ }
      afficher();
    });
    return;
  }
  // Compte connecté (Particulier, Pro, administrateur) : l'accueil devient son tableau de bord vivant (prochaine prestation, « À faire »).
  // Tableau de bord vivant du compte (prochaine prestation, « À faire ») ; cleaneroo.fr ouvre toujours la page d'accueil.
  if (route === "tableau" && !document.body.classList.contains("acces-cleaneur")) {
    if (await pageTableau(vue)) { window.scrollTo(0, 0); return; }
  }
  const page = ROUTES[route] || pageAccueil;
  sessionActive = !!(await supabase.auth.getSession().catch(() => null))?.data?.session;
  vue.innerHTML = await page();
  brancherInscription(vue);
  brancherExpress(vue);
  traduire(vue);
  reveler(vue);
  animerNotifs(vue);
  afficherAccesCleaneur(vue);
  brancherFormulesCleaneur(vue);
  window.scrollTo(0, 0);
}

/** Transition entre les pages : barre de progression en dégradé en haut, puis la page apparaît en fondu. */
const barre = document.createElement("div");
barre.className = "barre-transition";
barre.setAttribute("aria-hidden", "true");
document.body.append(barre);
let tourPage = 0;
async function afficher() {
  const tour = ++tourPage;
  barre.classList.remove("fini"); void barre.offsetWidth; barre.classList.add("active");
  vue.classList.remove("vue-entree");
  try { await afficherPage(); }
  finally {
    if (tour === tourPage) {
      barre.classList.add("fini");
      setTimeout(() => { if (tour === tourPage) barre.classList.remove("active", "fini"); }, 450);
      void vue.offsetWidth; vue.classList.add("vue-entree");
    }
  }
}

document.getElementById("lancement").innerHTML = bandeauLancement();
document.getElementById("choix-langue").innerHTML = selecteurLangue();
traduire(document.querySelector(".entete"));
traduire(document.getElementById("lancement"));
traduire(document.querySelector("footer"));
document.title = tr(document.title);
installerRappel();
memoriserCodeParrain();
window.addEventListener("hashchange", afficher);
await retourEmail();
// La page s'affiche tout de suite ; le compte est relu ensuite (l'en-tête se met à jour tout seul).
afficher();
// Le profil vient d'être relu : si l'accueil invitait encore à s'inscrire alors que le compte est connecté, on le redessine.
majLienCompte().then(() => { if (connecte() && document.querySelector("#vue .appel-2026, #vue .inscription-inspirante")) afficher(); });
supabase.auth.onAuthStateChange((evt, sess) => { sessionActive = !!sess; });
