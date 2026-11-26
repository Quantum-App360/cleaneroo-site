// Navigation du site et pages simples. Le parcours de réservation est dans reserver.js.
import { champCodeParrain, memoriserCodeParrain } from "./parrainage.js";
import { RUBRIQUES, RACCOURCIS_VITRINE, rubrique, TYPES_LIEU, pastille } from "./catalogue.js";
import { traduire, traduireCatalogue, selecteurLangue, tr, langue, LOCALE } from "./langue.js";
import { barreOnglets } from "./espaces.js";
import { modeCleaneur, fixerMode, boutonMode, brancherBascule, blocChoixCleaneur } from "./mode.js";
import { euros, duree, dateLongue, dateHeure, heure, reservationsFermees, MESSAGE_LANCEMENT, REGLES, offreConciergerieOuverte, dateCourte } from "./regles.js";

// Langue : catalogue traduit avant tout affichage.
traduireCatalogue(RUBRIQUES, TYPES_LIEU);
import { ouvrirReservation, ouvrirSimulateur, modeles, logements, nomLogement, brouillonExemple } from "./reserver.js";
import { calculer, entreeEstimation } from "./estimation.js";
import "./tarifs.js";   // dernière version des tarifs gardée sur l'appareil, appliquée avant le premier affichage
import { supabase, suivre, annuler, memoriser, inscrire, chargerOuverture, favoriDeDemande, libererFavori, propositionPassage, repondrePassage } from "./donnees.js";
import { blocRetardClient, blocRemplacementClient } from "./retards.js";
import { guideVideo } from "./guide-video.js";
import { blocApercuTournee, brancherApercuTournee } from "./tournee.js";
import { pageNotifications } from "./notifications.js";
import { pageMessages } from "./messages.js";
import { blocPropositionsClient } from "./propositions.js";
import { blocConsommablesClient } from "./consommables.js";
import { blocFavori } from "./favoris.js";
import { blocModifier, blocReportPass, boutonBon, brancherBons, blocConstat } from "./demande-actions.js";
import { blocSupplementClient } from "./supplement.js";
import { blocPaiement } from "./paiement.js";
import { CONDITIONS, CONFIDENTIALITE, MENTIONS, texteLegal, GESTION_AVIS } from "./legal.js";
import { pageQuiSommesNous } from "./qui-sommes-nous.js";
import { pageDesignSystem, brancherDesignSystem } from "./design-system.js";
import { transitionVitre } from "./vitre.js";
import { compterPage } from "./compteur.js";
import { suivreEnDirect, demoSuivi } from "./suivi-live.js";
import { pageCompte, pageMesPrestations, arreterEcouteDemandes, retourEmail, majLienCompte, afficherAccesCleaneur, noterRetourConnexion } from "./compte.js";
import { marquerActif, profilMemorise, rendreEntete, accueilDuCompte } from "./entete.js";
const rendreEnteteMemorise = () => rendreEntete(profilMemorise());
window.addEventListener("cleaneroo-mode", () => rendreEnteteMemorise());
import { icone, teinte, ICONES_RUBRIQUES, ICONES_INTERFACE } from "./icones.js";
import { pageTableau, arreterTableau, pageFavoris } from "./tableau.js";
import { compteRenduPieces } from "./controle-ecran.js";
import { blocFormulesCleaneur, brancherFormulesCleaneur } from "./formules-cleaneur.js";
import { exempleCleaneur, accrocheGain, tableauGain, reglesEnClair, etapesCleaneur, blocLancementCleaneur, pretACommencer, boutonPartagerCleaneur, pageConditionsCleaneurs } from "./devenir-cleaneur.js";
import { blocEtat, blocEtapes, blocParcours, brancherParcours, surveillerConnexion, bandeGaranties, logosPaiement, blocJustePrix, blocAvantApres, brancherAvantApres, sectionAvisPublics, remplirAvisPublics, installerRappel, encartAideRappel, bandeauLancement, pageChargement, decorTableau, surveillerFormulaire, envoiRobot, CONTIENT_LIEN, afficherToast } from "./commun.js";
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

/* ------------------------------------------------------------------ Avant l'ouverture des réservations */

const TYPES_INSCRIPTION = [["client", "Je cherche un nettoyage"], ["cleaneur", "Je veux devenir Cleaneur"], ["conciergerie", "Je gère des locations / une conciergerie"]];

/** fixe : le type est imposé (page Devenir Cleaneur) et le choix « Je cherche un nettoyage / Je gère des locations » n'est pas montré. */
function formulaireInscription(typeDefaut = "client", fixe = false) {
  return `<form class="carte" id="form-inscription" novalidate><input class="piege" name="site_web" tabindex="-1" autocomplete="off" aria-hidden="true">
    <h3>Inscrivez-vous pour le lancement</h3>
    <p class="muet" style="margin:4px 0 14px">Les réservations ouvrent très bientôt. ${MESSAGE_LANCEMENT} Les premiers inscrits sont prévenus en priorité.</p>
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
        <p class="muet" style="margin:6px 0 0">Nous vous préviendrons dès l'ouverture des réservations. ${MESSAGE_LANCEMENT}</p>`;
      traduire(f);
    } catch (ex) {
      bouton.disabled = false; bouton.textContent = tr("Je m'inscris");
      err.textContent = tr("L'inscription n'a pas abouti. Vérifiez votre connexion et réessayez.");
    }
  };
}

const titreSection = (titre, sous = "", surtitre = "") => `<div class="titre-section revele">${surtitre ? `<span class="surtitre">${surtitre}</span>` : ""}<h2>${titre}</h2>${sous ? `<p class="muet">${sous}</p>` : ""}</div>`;

/* ------------------------------------------------------------------ Pages */

/* Bulles qui montent dans le héros (positions fixes : même rendu à chaque visite). */
const MONTANTES = [[6, 14, 13, 0], [14, 8, 17, 4], [27, 20, 15, 9], [38, 10, 19, 2], [52, 16, 14, 7], [63, 9, 18, 11], [74, 22, 16, 5], [86, 12, 20, 1], [94, 18, 15, 8]];
const bullesMontantes = () => MONTANTES.map(([x, t, d, r]) =>
  `<span class="monte" style="left:${x}%;width:${t}px;height:${t}px;animation-duration:${d}s;animation-delay:-${r}s"></span>`).join("");

/* Le ménage à l'ancienne face au ménage digitalisé. */
const COMPARAISON = [
  ["Prix", "Devis, attente, négociation", "Prix affiché tout de suite, sans surprise"],
  ["Réservation", "Appels, messages, relances", "2 minutes en ligne, 3 clics la fois suivante"],
  ["Qui vient chez vous", "Identité rarement vérifiée", "Cleaneur vérifié : identité, SIRET, assurance, photo de vérification du jour"],
  ["Arrivée", "Attente sans information", "Suivi en direct, arrivée confirmée par géolocalisation"],
  ["Travail réalisé", "Aucune preuve", "Compte rendu photo avant / après, horodaté et signé"],
  ["Paiement", "À l'avance ou en espèces, sans recours", "Sécurisé par Stripe, versé au Cleaneur après votre validation"],
  ["En cas de problème", "Aucune preuve en cas de litige", "Preuves photo horodatées et dossier prêt pour l'assurance"],
];
const CHIFFRES = [["2 min", "pour réserver"], [String(RUBRIQUES.length), "prestations"], ["100 %", "digitalisé"], ["100 %", "paiement sécurisé"]];

/* ------------------------------------------------------------------ Scène du héros : étoiles et notifications vivantes */
/* Prénoms parmi les plus donnés en France ces dernières années : changent à chaque notification. */
const PRENOMS = ["Louise", "Jade", "Ambre", "Alba", "Emma", "Rose", "Alma", "Alice", "Romy", "Anna", "Lina", "Mia", "Léna", "Iris", "Chloé",
  "Gabriel", "Raphaël", "Louis", "Léo", "Maël", "Noah", "Jules", "Adam", "Arthur", "Sacha", "Lucas", "Hugo", "Isaac", "Gabin", "Liam"];
const VILLES = ["Fréjus", "Saint-Raphaël", "Cannes", "Toulon", "Nice", "Hyères", "Antibes", "Draguignan"];
/* Trois notifications, chacune avec trois messages : [icône, titre, détail] ; {p} prénom, {n} nombre, {v} ville. */
const NOTIFS = {
  fr: [
    [["position", "{p} est en route", "Arrivée dans {n} min"], ["sur-place", "{p} est sur place", "Arrivée confirmée par géolocalisation"], ["termine", "{p} a terminé", "Toutes les tâches sont cochées"]],
    [["appareil-photo", "Photos avant reçues", "État des lieux à l'arrivée"], ["photo", "Compte rendu reçu", "12 photos avant / après"], ["valide", "Tâches validées", "{n} tâches cochées et horodatées"]],
    [["paiement", "Paiement 100 % sécurisé", "Crédit d'impôt selon éligibilité"], ["instantane", "Prix affiché tout de suite", "Sans devis ni attente"], ["calendrier", "Réservé en 2 minutes", "{v} · créneau confirmé"]],
  ],
  en: [
    [["position", "{p} is on the way", "Arriving in {n} min"], ["sur-place", "{p} is on site", "Arrival confirmed by geolocation"], ["termine", "{p} has finished", "Every task is ticked"]],
    [["appareil-photo", "Before photos received", "Condition on arrival"], ["photo", "Report received", "12 before / after photos"], ["valide", "Tasks approved", "{n} tasks ticked and time-stamped"]],
    [["paiement", "100% secure payment", "Tax credit subject to eligibility"], ["instantane", "Price shown instantly", "No quote, no waiting"], ["calendrier", "Booked in 2 minutes", "{v} · slot confirmed"]],
  ],
  it: [
    [["position", "{p} è in arrivo", "Arrivo tra {n} min"], ["sur-place", "{p} è sul posto", "Arrivo confermato dalla geolocalizzazione"], ["termine", "{p} ha finito", "Tutti i compiti sono spuntati"]],
    [["appareil-photo", "Foto prima ricevute", "Stato all'arrivo"], ["photo", "Resoconto ricevuto", "12 foto prima / dopo"], ["valide", "Compiti convalidati", "{n} compiti spuntati e con orario"]],
    [["paiement", "Pagamento sicuro al 100%", "Credito d'imposta secondo idoneità"], ["instantane", "Prezzo subito visibile", "Senza preventivo né attesa"], ["calendrier", "Prenotato in 2 minuti", "{v} · fascia confermata"]],
  ],
  es: [
    [["position", "{p} está en camino", "Llega en {n} min"], ["sur-place", "{p} está en el lugar", "Llegada confirmada por geolocalización"], ["termine", "{p} ha terminado", "Todas las tareas marcadas"]],
    [["appareil-photo", "Fotos de antes recibidas", "Estado a la llegada"], ["photo", "Informe recibido", "12 fotos antes / después"], ["valide", "Tareas validadas", "{n} tareas marcadas con hora"]],
    [["paiement", "Pago 100 % seguro", "Crédito fiscal según elegibilidad"], ["instantane", "Precio al instante", "Sin presupuesto ni esperas"], ["calendrier", "Reservado en 2 minutos", "{v} · franja confirmada"]],
  ],
};
const hasard = l => l[Math.floor(Math.random() * l.length)];
function remplir(modele) {
  const n = { "photos": 8 + Math.floor(Math.random() * 10) };
  return modele.replace("{p}", hasard(PRENOMS)).replace("{v}", hasard(VILLES))
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
  ["bureaux", "Entreprises", "Bureaux, commerces, cabinets et parties communes : ménage réservé en deux minutes, facturé à votre société.", "#/compte/entreprise", "Créer mon espace Entreprise"],
  ["location", "Conciergeries et SCI", "Planning de vos biens relié à Airbnb et Booking, ménages entre deux voyageurs, stock, incidents et rapports pour vos propriétaires.", "#/compte/pro", "Créer mon espace Conciergerie"],

  ["location", "Hôtels et campings", "Rotations des mobil-homes, chalets et chambres : prix, temps et Cleaneurs nécessaires calculés tout de suite.", "#/compte/hotellerie", "Créer mon espace Hôtels et campings"],
];
/* Inscription inspirante (visiteur) : un espace par profil, chacun avec son avantage offert. Même bloc dans l'appli (Vitrine.kt). */
const INSCRIPTION_ESPACES = () => [
  ["logement", "Particulier", "Votre ménage, sans y penser.", ["Prix affiché tout de suite", "Un ou plusieurs logements, tous dans votre espace", "Suivi du Cleaneur en direct", "Crédit d'impôt selon éligibilité"],
    `${euros(REGLES.PARRAINAGE_FILLEUL_C)} ${tr("offerts avec un code de parrainage")}`, "#/compte/creer"],
  ["bureaux", "Entreprise", "Vos locaux, toujours impeccables.", ["Bureaux, commerces et cabinets", "Factures au nom de votre société", "Cleaneurs vérifiés et assurés"],
    `${euros(REGLES.PARRAINAGE_FILLEUL_C)} ${tr("offerts avec un code de parrainage")}`, "#/compte/entreprise"],
  ["location", "Conciergerie ou SCI", "Vos locations, toujours prêtes.", ["Agenda relié à Airbnb et Booking", "Ménages entre deux voyageurs", "Compte rendu photo de chaque logement"],
    offreConciergerieOuverte() ? tr("3 mois offerts dès votre première intervention, 0 % de frais de service") : tr("0 % de frais de service avec l'abonnement"), "#/compte/pro"],
  ["location", "Hôtel ou camping", "Vos logements, prêts à temps.", ["Calculateur de rotation", "Agenda iCal et planning", "Renforts pour vos pics d'activité"],
    `${euros(REGLES.PARRAINAGE_FILLEUL_C)} ${tr("offerts avec un code de parrainage")}`, "#/compte/hotellerie"],
];
function blocInscriptionInspirante() {
  return `<section class="inscription-inspirante"><div class="conteneur">
    <div class="tete-inspirante revele">
      <span class="pastille-lancement sombre"><i></i>${tr("Gratuit · sans engagement · 1 minute")}</span>
      <h2>${tr("Votre espace Cleaneroo vous attend.")}</h2>
      <p>${tr("Créez-le dès maintenant : tout sera prêt pour l'ouverture des réservations, et vos avantages de lancement sont gardés.")}</p>
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
    <p class="pied-inspirant">${tr("Déjà inscrit ?")} <a href="#/compte">${tr("Se connecter")}</a> · ${tr("Être informé de l'ouverture des réservations ?")} <a href="#/inscription/client">${tr("Laisser mon e-mail")}</a></p>
  </div></section>`;
}

const FONCTIONS_DIGITALES = [
  ["position", "Suivi en direct", "Votre Cleaneur sur la carte, comme le suivi d'un colis, avec son heure d'arrivée."],
  ["photo", "Compte rendu photo", "Chaque pièce photographiée avant et après, horodatée, dans votre espace."],
  ["calendrier", "Agenda connecté", "Calendriers Airbnb et Booking reliés : les ménages se programment en un geste."],
  ["paiement", "Paiement 100 % sécurisé", "Vous payez en réservant ; l'argent reste bloqué et n'est versé au Cleaneur qu'après votre validation."],
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
/** Repères sous le formulaire de l'accueil (prompt 2, partie 2). */
const REPERES_HEROS = [["carte-bancaire", "Paiement 100 % sécurisé"], ["bouclier-coche", "Cleaneurs vérifiés et assurés"],
  ["appareil-photo", "Compte rendu photo avant / après"], ["cadenas", "Données protégées"]];
function pageAccueil() {
  const m = messagesNotif();
  return `
  <section class="heros-2026">
    <div class="conteneur heros-grille">
      <div class="heros-texte">
        ${reservationsFermees() ? `<span class="pastille-lancement"><i></i>Réservations bientôt ouvertes</span>` : ""}
        <h1><span>Le ménage</span><span class="ponct">,</span> <span class="degrade-texte"><span>100 % digitalisé et sécurisé</span><span class="ponct">.</span></span></h1>
        <p class="heros-sous">Réservez en deux minutes, suivez votre Cleaneur en direct et recevez un compte rendu photo. Paiement sécurisé à la réservation, versé au Cleaneur après votre validation.</p>
        <form class="recherche-heros" id="express">
          <label><span>Débuter ma prestation</span><select name="rubrique" required><option value="" disabled selected>Choisir une prestation</option>${RUBRIQUES.map(r => `<option value="${r.id}">${r.nom}</option>`).join("")}</select></label>
          <button class="bouton" type="submit">Commencer</button>
        </form>
        <div class="besoin-ia-heros"><button type="button" class="bouton secondaire" data-assistant-ia>${icone("instantane")}<span>Décrire mon besoin</span></button>
          <p class="petit">Vous ne savez pas quelle prestation choisir ? Décrivez-nous votre besoin, notre assistant intelligent trouvera la solution adaptée.</p></div>
        ${connecte() ? "" : `<div class="compte-heros"><span class="petit">${tr("Particulier, entreprise, conciergerie ou hôtel :")}</span>
          <a class="bouton plein" href="#/compte/creer">${icone("ajouter")} ${tr("Créer mon espace")}</a><a class="bouton secondaire" href="#/compte">${tr("Me connecter")}</a></div>`}
        <button type="button" class="lien-rappel-heros" data-rappel>${icone("telephone")}<span>Une question ? <b>Être rappelé gratuitement</b></span></button>
        ${blocRecommander()}
        <ul class="preuves">${REPERES_HEROS.map(([ic, t]) => `<li>${icone(ic)}${t}</li>`).join("")}</ul>
      </div>
      <div class="heros-visuel" aria-hidden="true">
        <span class="forme forme-1"></span><span class="forme forme-2"></span><span class="forme forme-3"></span>
        ${maquetteAppli(m)}
        <div class="flottant flottant-1" data-teinte="menthe">${icone("bouclier-coche", { tuile: true })}<b>Cleaneurs vérifiés et assurés</b></div>
        <div class="flottant flottant-2" data-teinte="soleil">${icone("credit-impot", { tuile: true })}<b>Crédit d'impôt<small>selon éligibilité</small></b></div>
      </div>
    </div>
  </section>
  <section class="bandeau-chiffres"><div class="conteneur">${CHIFFRES.map(([n, l], i) => `<div data-teinte="${["turquoise", "corail", "soleil", "lilas"][i]}"><b>${n}</b><span>${l}</span></div>`).join("")}</div></section>
  ${blocVideoPub()}
  ${connecte() ? `<section class="bloc"><div class="conteneur">
    ${titreSection("Un espace pour chacun", "Particuliers, entreprises, conciergeries et Cleaneurs : chacun a son espace, pensé pour son usage.", "Pour qui ?")}
    <div class="grille-4 espaces-accueil">${ESPACES_ACCUEIL.map(([ico, titre, texte, lien, action]) => `
      <a class="carte espace-carte revele" data-teinte="${teinte(ico)}" href="${lien}">${icone(ico, { tuile: true })}<h3>${titre}</h3><p class="muet">${texte}</p><span class="aller">${action} ›</span></a>`).join("")}</div>
  </div></section>` : blocInscriptionInspirante()}
  <section class="bloc bloc-doux"><div class="conteneur">
    ${titreSection("Nos prestations", "Le prix s'affiche dès que vous décrivez votre besoin.", "Prestations")}
    <div class="grille-3">${RACCOURCIS_VITRINE.map(([id, nom, sous]) => `
      <a class="carte prestation revele" data-teinte="${teinte(rubrique(id).icone)}" href="#/estimer/${id}">${icone(rubrique(id).icone, { tuile: true })}<h3>${nom}</h3><p class="muet">${sous}</p><span class="aller">Estimer ›</span></a>`).join("")}</div>
    <p class="centre" style="margin-top:26px"><a class="bouton secondaire" href="#/prestations">Voir toutes les prestations ›</a></p>
    <div style="margin-top:34px">${blocJustePrix()}</div>
  </div></section>
  <section class="bloc"><div class="conteneur">
    ${titreSection("Tout est digitalisé", "De la réservation au paiement, chaque étape se suit sur votre téléphone.", "Un ménage moderne et transparent")}
    <div class="grille-4 fonctions">${FONCTIONS_DIGITALES.map(([ico, titre, texte]) => `
      <div class="fonction revele" data-teinte="${teinte(ico)}">${icone(ico, { tuile: true })}<h3>${titre}</h3><p class="muet">${texte}</p></div>`).join("")}</div>
    <div class="comparaison revele" role="table" aria-label="Un ménage moderne et transparent" style="margin-top:34px">
      <div class="ligne entete-comp" role="row"><span role="columnheader"></span><span role="columnheader">Ménage traditionnel</span><span role="columnheader">Avec Cleaneroo</span></div>
      ${COMPARAISON.map(([c, a, n]) => `<div class="ligne" role="row"><b role="rowheader">${c}</b><span class="ancien" role="cell">${a}</span><span class="nouveau" role="cell">${n}</span></div>`).join("")}
    </div>
  </div></section>
  ${blocAvantApres()}
  <section class="bloc bloc-doux"><div class="conteneur">
    ${titreSection("Comment ça marche ?", "Du clic à la validation, tout se passe en ligne.", "En 5 étapes")}
    ${blocEtapes()}
    <p class="centre" style="margin-top:18px"><a class="lien-bouton" href="#/comment-ca-marche">Entreprise, conciergerie ou Cleaneur : voir votre parcours ›</a></p>
    <div class="credit revele">
      <div class="pastille-credit">${icone("credit-impot")}</div>
      <div><h3>Crédit d'impôt selon éligibilité</h3><p>Possible si le Cleaneur est déclaré « services à la personne » : le ménage, les vitres et les textiles à votre domicile peuvent alors ouvrir droit à un crédit d'impôt, selon votre situation et dans la limite des plafonds légaux. L'attestation fiscale des prestations éligibles vous est envoyée chaque mois.</p></div>
    </div>
  </div></section>
  ${bandeGaranties()}
  ${sectionAvisPublics()}
  ${reservationsFermees() && !connecte() ? `<section class="appel-2026"><div class="conteneur appel-grille"><div class="revele"><span class="pastille-lancement sombre"><i></i>Bientôt</span>
      <h2>Prêts pour l'ouverture ?</h2><p>Inscrivez-vous maintenant : les premiers inscrits sont prévenus en priorité.</p>
      <div class="boutons"><a class="bouton clair" href="#/estimer">Estimer mon prix</a></div></div>
      <div class="revele" id="inscription">${formulaireInscription()}</div></div></section>` : ""}`;
}

/** Vidéo pub (12 s, verticale) : muette en boucle, lancée seulement quand elle est visible ; bouton pour le son.
 *  Retirée le 26/11/2026 (demande de Michael : nouvelles vidéos à venir). Pour la remettre : VIDEO_PUB = true et le fichier dans assets/video. */
const VIDEO_PUB = false;
function blocVideoPub() {
  if (!VIDEO_PUB) return "";
  return `<section class="bloc bloc-video"><div class="conteneur video-grille">
    <div class="video-texte revele">
      <span class="surtitre-video">En vidéo</span>
      <h2>Cleaneroo en 12 secondes</h2>
      <p class="muet">Réservez en deux minutes, suivez votre Cleaneur en direct et recevez un compte rendu photo : tout se passe sur votre téléphone.</p>
      <div class="boutons"><a class="bouton" href="#/estimer">Estimer mon prix</a></div>
    </div>
    <div class="video-cadre revele">
      <video class="video-pub" muted loop playsinline preload="none" width="720" height="1280" poster="assets/video/pub-cleaneroo.jpg?v=1" aria-label="Publicité Cleaneroo">
        <source src="assets/video/pub-cleaneroo.mp4?v=1" type="video/mp4">
      </video>
      <button class="video-son" type="button" aria-pressed="false">Activer le son</button>
    </div>
  </div></section>`;
}
function brancherVideoPub(racine) {
  const v = racine.querySelector(".video-pub");
  if (!v) return;
  const calme = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lire = () => v.play().catch(() => {});
  if (!calme && "IntersectionObserver" in window) {
    new IntersectionObserver(es => es.forEach(e => e.isIntersecting ? lire() : v.pause()), { threshold: .4 }).observe(v);
  } else v.controls = true;
  const b = racine.querySelector(".video-son");
  b.onclick = () => {
    v.muted = !v.muted;
    b.setAttribute("aria-pressed", String(!v.muted));
    b.textContent = v.muted ? "Activer le son" : "Couper le son";
    traduire(b);
    if (!v.muted) { v.currentTime = 0; lire(); }
  };
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
    <div class="conteneur"><h1 style="margin-top:10px">Les réservations ouvrent très bientôt</h1><div class="trait-corail"></div>
      <p class="slogan" style="font-size:20px;font-weight:600;margin:0">${MESSAGE_LANCEMENT}</p></div></section>
  <section class="bloc"><div class="etroit">${formulaireInscription(type, type === "cleaneur")}</div></section>`;
}

function pagePrestations() {
  return `<section class="fond-cleaneroo" style="padding:32px 0 56px">${decor([[90, 20, 90], [72, 70, 44]], [])}
    <div class="conteneur"><h1>Nos prestations</h1><div class="trait-corail"></div><p>${RUBRIQUES.length} univers de nettoyage, un seul parcours de réservation.</p></div></section>
  <section class="bloc" style="padding-top:28px"><div class="conteneur"><div class="grille-3">${RUBRIQUES.map(r => `
    <a class="carte prestation" href="#/estimer/${r.id}">${icone(r.icone, { tuile: true })}<h3>${r.nom}</h3>
      <p class="muet" style="margin:4px 0 8px">${r.sousTitre}</p>
      <span class="tampon">${pastille(r)}</span></a>`).join("")}</div>
    <div style="margin-top:28px">${blocJustePrix()}</div>
    <div style="margin-top:22px">${encartAideRappel()}</div></div></section>
  ${sectionAvisPublics()}`;
}

function pageComment() {
  return `<section class="fond-cleaneroo" style="padding:40px 0 90px">${decor([[90, 20, 90], [4, 60, 60]], [])}
    <div class="conteneur"><h1>Comment ça marche ?</h1><div class="trait-corail"></div><p>Un parcours simple pour chacun : choisissez le vôtre.</p></div></section>
  <section class="bloc"><div class="conteneur">${blocParcours()}
    <div class="etroit" style="margin-top:28px">
      <a class="carte ligne-compte" href="#/suivi-demo">${icone("position", { tuile: true })}
        <div class="corps"><h3 style="margin:0">Suivez votre Cleaneur en direct</h3><p class="muet" style="margin:2px 0 0">Sur une carte, jusqu'à chez vous, comme le suivi d'un colis. Voir la démonstration.</p></div><span class="aller" aria-hidden="true">›</span></a>
      <div style="margin-top:14px">${guideVideo("cleaneur", "page-comment-cleaneur")}</div>
    </div>
  </div></section>
  ${bandeGaranties()}`;
}

/** Compteur de l'offre de lancement : lu dans la base (dossiers validés), masqué si elle ne répond pas. */

/* Offre de lancement des Cleaneurs (mêmes valeurs que Regles.kt) */
/** « Devenir Cleaneur » : les deux formules (Gratuit / Pro), avantages, inconvénients et offre de lancement. */
function blocOffreCleaneurs() {
  return `<h2 class="titre-section">${icone("paiement", { tuile: true })}Deux formules, à vous de choisir</h2>${blocFormulesCleaneur(null)}`;
}

/** Page « Devenir Cleaneur » (recrutement, 26/11/2026) : vrai gain (après commission, frais Stripe et cotisations), formules,
 *  règles du jeu, étapes, un seul parcours d'inscription. Contenu dans devenir-cleaneur.js ; partagée par https://cleaneroo.fr/cleaneur/. */
function pageDevenir() {
  const ex = exempleCleaneur();
  return `<section class="fond-cleaneroo" style="padding:40px 0 90px">${decor([[90, 20, 90], [4, 60, 60]], [])}
    <div class="conteneur"><h1>Devenir Cleaneur</h1><div class="trait-corail"></div>
      <p class="accroche-gain"><b>${accrocheGain(ex)}</b> <button type="button" class="lien-bouton" data-defiler-gain>${tr("Voir le détail")} ›</button></p>
      <p>Travaillez à votre rythme, près de chez vous.</p>
      <div class="etiquettes"><span class="etiquette">Missions proches</span><span class="etiquette">Compte rendu guidé</span><span class="etiquette">Paiement sécurisé</span></div>
      <div class="partage-cleaneur">${boutonPartagerCleaneur()}</div></div></section>
  <section class="bloc"><div class="etroit">${blocChoixCleaneur()}<div data-acces-cleaneur></div>${blocLancementCleaneur()}${guideVideo("cleaneur", "page-devenir")}${blocApercuTournee()}${tableauGain(ex)}${blocOffreCleaneurs()}
    ${reglesEnClair()}${etapesCleaneur()}
    <div style="margin-top:18px">${pretACommencer()}</div>
  </div></section>`;
}

const pageTexte = (titre, html) => `<section class="bloc"><div class="etroit"><h1>${titre}</h1><div class="trait-corail"></div>${html}</div></section>`;

/** Pages légales : textes de legal.js (site et appli identiques, 4 langues). */
const pageLegale = (titre, liste, numeros = true) => pageTexte(titre, liste.map(([t, x], i) =>
  `<h3 style="margin:22px 0 6px">${numeros ? `${i + 1}. ` : ""}${esc(tr(t))}</h3><p style="margin:0">${esc(texteLegal(x))}</p>`).join(""));
function pageConfidentialite() { return pageLegale("Confidentialité", CONFIDENTIALITE); }
function pageConditions() { return pageLegale("Conditions générales", CONDITIONS); }
function pageMentions() { return pageLegale("Mentions légales", MENTIONS, false); }
function pageGestionAvis() { return pageLegale("Comment nous gérons les avis", GESTION_AVIS, false); }

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
    VERIFICATION: d.prelancement ? "Pré-réservation enregistrée : nous vous recontacterons dès l'ouverture des réservations pour fixer le créneau, en priorité." : "Nous vérifions votre demande. Ensuite, les Cleaneurs compatibles sont prévenus.",
    PUBLIEE: "Votre demande est en ligne : les Cleaneurs compatibles peuvent se proposer. Vous choisirez parmi leurs propositions.",
    CONFIRMEE: "Votre nettoyage est réservé. Vous serez prévenu quand le Cleaneur sera en route.",
    A_VALIDER: "La prestation est terminée : consultez le compte rendu et validez-le.",
    TERMINEE: "Prestation terminée et validée. Merci de votre confiance.",
    ANNULEE: "Cette demande est annulée. Si vous aviez déjà payé, vous êtes remboursé (5 à 10 jours selon votre banque).",
  }[d.statut] || "Intervention en cours, suivez-la ici en direct.";
  return `<section class="fond-cleaneroo" style="padding:34px 0 86px">${decor([[90, 18, 90], [5, 55, 60]], [])}
    <div class="etroit"><p style="margin:0;opacity:.85">Réf. ${esc(d.reference)}</p><h1>${icone(r.icone)} ${r.nom}</h1><div class="trait-corail"></div>
      <span class="etiquette" style="background:rgba(255,255,255,.22)">${libelleStatut(d.statut)}</span></div></section>
  <section class="bloc" style="padding-top:28px"><div class="etroit">
    <div class="progression" role="progressbar" aria-label="Avancement" aria-valuemin="0" aria-valuemax="${ETAPES_SUIVI.length}" aria-valuenow="${d.statut === "ANNULEE" ? 0 : idx + 1}">${ETAPES_SUIVI.map((_, i) => `<span class="${d.statut !== "ANNULEE" && i <= idx ? "fait" : ""}${d.statut !== "ANNULEE" && i === idx ? " courant" : ""}"></span>`).join("")}</div>
    <div class="note" style="margin-bottom:14px">${etat}</div>
    ${d.statut === "ANNULEE" ? `<div class="boutons" style="margin:-4px 0 16px"><a class="bouton" href="#/reserver/${encodeURIComponent(d.rubrique_id)}/rapide">${icone("repeter")} Refaire cette demande</a><a class="bouton secondaire" href="#/aide">Une question ?</a></div>` : ""}
    ${!d.sur_devis && d.statut !== "ANNULEE" ? `<div id="paiement-client"></div>` : ""}
    ${["PUBLIEE", "CONFIRMEE"].includes(d.statut) ? `<div id="remplacement-client"></div>` : ""}
    ${d.statut === "PUBLIEE" && d.choix_cleaneur === "favori" ? `<div id="favori-demande"></div>` : ""}
    ${["A_VALIDER", "TERMINEE"].includes(d.statut) ? `<div id="prochain-passage"></div>` : ""}
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
      ${(() => { // Même décompte qu'à l'étape 5 : prestation, frais de service, remises, total à payer, après crédit d'impôt.
        if (d.sur_devis) return `<p style="margin:6px 0 0"><b>Prix :</b> sur devis</p>`;
        const frais = Number(d.details?.fraisServiceC) || 0, remise = (Number(d.remise_parrainage_c) || 0) + (Number(d.cagnotte_c) || 0);
        const total = d.estimation_c + frais - remise;
        return `<p style="margin:6px 0 0"><b>Prix :</b> ${euros(d.estimation_c)}${frais ? ` · ${tr("frais de service")} ${euros(frais)}` : ""}${remise ? ` · ${tr("remise")} −${euros(remise)}` : ""}</p>
          <p style="margin:6px 0 0"><b>${tr("Total à payer")} :</b> ${euros(total)}${d.credit_impot_c ? ` · ${euros(total - d.credit_impot_c)} ${tr("après crédit d'impôt, si éligible")}` : ""}</p>`; })()}
      <p style="margin:6px 0 0"><b>Choix du Cleaneur :</b> ${d.choix_cleaneur === "directe" ? "réservation directe" : d.choix_cleaneur === "favori" ? "proposée d'abord au Cleaneur que vous avez demandé" : "parmi les candidatures"}</p>
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

/* Cleaneur demandé (lot 5) : la demande lui est proposée seul jusqu'à une heure donnée ; le client peut la proposer à tous tout de suite. */
async function blocFavoriDemande(boite, ref, jeton) {
  if (!boite) return;
  const f = await favoriDeDemande(ref, jeton);
  if (!boite.isConnected) return;
  if (!f) { boite.innerHTML = ""; return; }
  const jusqu = new Date(f.jusqu);
  boite.innerHTML = `<div class="carte teintee favori-demande" style="margin-bottom:14px">
      <b>${icone("cleaneurs")} ${tr("Proposée d'abord à")} ${esc(f.prenom)}${f.initiale ? ` ${esc(f.initiale)}.` : ""}</b>
      <p class="petit" style="margin:4px 0 10px">${tr("Seul à la voir jusqu'à")} ${heureMinute(jusqu)}${jusqu.toDateString() === new Date().toDateString() ? "" : ` (${esc(dateCourte(jusqu))})`}.
        ${tr("S'il n'est pas disponible, elle s'ouvre aussitôt aux autres Cleaneurs vérifiés.")}</p>
      <button type="button" class="bouton secondaire" data-liberer-favori>${tr("Proposer à tous maintenant")}</button></div>`;
  boite.querySelector("[data-liberer-favori]").onclick = async e => {
    if (!confirm(tr("Proposer la demande à tous les Cleaneurs vérifiés de votre secteur dès maintenant ?"))) return;
    e.target.disabled = true;
    try { await libererFavori(ref, jeton); afficherToast("Votre demande est proposée à tous les Cleaneurs vérifiés de votre secteur."); boite.innerHTML = ""; }
    catch { e.target.disabled = false; afficherToast("Le service est momentanément indisponible. Réessayez dans quelques minutes.", "erreur"); }
  };
}
/* Prochain passage proposé par le Cleaneur (lot 6) : réserver en un geste (mêmes réglages, même adresse, ce Cleaneur en premier) ou décliner. */
async function blocProchainPassage(boite, d, jeton) {
  if (!boite) return;
  const x = await propositionPassage(d.reference, jeton);
  if (!boite.isConnected || !x) return;
  const quand = new Date(`${x.jour}T12:00`);
  boite.innerHTML = `<div class="carte teintee prochain-passage" style="margin-bottom:14px">
      <b>${icone("repeter")} ${esc(x.prenom)}${x.initiale ? ` ${esc(x.initiale)}.` : ""} ${tr("vous propose un prochain passage")}</b>
      <p style="margin:4px 0 10px">${esc(dateLongue(quand))} ${tr("à")} ${x.heure} h · ${esc(rubrique(d.rubrique_id)?.nom || "")}</p>
      <div class="boutons-ligne"><button type="button" class="bouton" data-accepter-passage>${tr("Réserver ce passage")}</button>
        <button type="button" class="bouton secondaire" data-refuser-passage>${tr("Non merci")}</button></div>
      <p class="petit muet" style="margin:8px 0 0">${tr("Mêmes réglages et même adresse : vous vérifiez, puis vous payez comme d'habitude. La demande lui est proposée en premier.")}</p></div>`;
  boite.querySelector("[data-accepter-passage]").onclick = async () => {
    await repondrePassage(x.id, jeton, true).catch(() => null);
    const { jour, heure, creneau, ...reglages } = d.details || {};
    const { reserverAvecCleaneur } = await import("./reserver.js");
    reserverAvecCleaneur(d.rubrique_id, { cleaneur_id: x.cleaneur_id, prenom: x.prenom, initiale: x.initiale },
      { ...reglages, rue: d.rue || "", codePostal: d.code_postal || "", ville: d.ville || "", jour: x.jour, heure: x.heure });
  };
  boite.querySelector("[data-refuser-passage]").onclick = async e => {
    e.target.disabled = true;
    await repondrePassage(x.id, jeton, false).catch(() => null);
    boite.innerHTML = "";
  };
}
const heureMinute = d => d.toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" });

/* ------------------------------------------------------------------ Démonstration du suivi en direct (aucune vraie mission avant l'ouverture) */
const DEMO_TRAJET = { depart: { lat: 43.4364, lon: 6.7366 }, arrivee: { lat: 43.4232, lon: 6.7700 }, prenom: "Louise", dureeS: 60 };
function pageSuiviDemo() {
  return `<section class="fond-cleaneroo" style="padding:34px 0 86px">${decor([[90, 18, 90], [5, 55, 60]], [])}
    <div class="etroit"><span class="etiquette" style="background:rgba(255,255,255,.22)">Démonstration</span><h1>Suivez votre Cleaneur en direct</h1><div class="trait-corail"></div>
      <p style="margin:0">Le jour J, vous voyez votre Cleaneur avancer sur la carte jusqu'à chez vous, comme le suivi d'un colis.</p></div></section>
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
  "": pageAccueil, "vitrine": pageAccueil, "prestations": pagePrestations, "comment-ca-marche": pageComment, "devenir-cleaneur": pageDevenir, "mode-cleaneur": pageDevenir,
  "inscription": () => pageInscription(), "confidentialite": pageConfidentialite, "conditions": pageConditions, "conditions-cleaneurs": pageConditionsCleaneurs, "mentions-legales": pageMentions,
  "gestion-des-avis": pageGestionAvis,
  "qui-sommes-nous": pageQuiSommesNous,
  "icones": pageIcones,
  "design-system": pageDesignSystem,
};

let arreterSuivi = () => {};
let espacePrecedent = null;
let premierAffichage = true, pagePrecedente = "";
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
  // Deux interfaces séparées : les pages Cleaneur passent en mode Cleaneur, les pages clients en mode client (mode.js).
  brancherBascule();
  if (["devenir-cleaneur", "mode-cleaneur"].includes(route) || (route === "compte" && param === "cleaneur")) { if (!modeCleaneur()) { fixerMode(true); rendreEnteteMemorise(); } }
  else if (["reserver", "estimer", "prestations", "mes-demandes", "mes-biens", "tableau"].includes(route) || (route === "compte" && ["particulier", "entreprise", "pro", "hotellerie"].includes(param))) { if (modeCleaneur()) { fixerMode(false); rendreEnteteMemorise(); } }
  // Compte connecté qui ouvre cleaneroo.fr (26/11/2026, retour de Michael) : il arrive sur son tableau de bord.
  // Seulement à l'ouverture du site : le logo et « Retour à l'accueil » mènent toujours à la page d'accueil publique.
  const ouverture = premierAffichage; premierAffichage = false;
  if (route === "" && ouverture && profilMemorise() && (await supabase.auth.getSession().catch(() => null))?.data?.session) {
    const chez = accueilDuCompte(profilMemorise());
    if (chez !== "#/") { location.replace(chez); return; }
  }
  if (route === "" && modeCleaneur()) { location.replace("#/mode-cleaneur"); return; }
  if (route === "mode-cleaneur" && (profilMemorise()?.statuts || []).includes("cleaneur")) { location.replace("#/compte/cleaneur"); return; }
  // Liens de démarchage (23/11/2026) : #/devenir-cleaneur/independant et #/devenir-cleaneur/societe ouvrent directement le bon formulaire.
  if (route === "devenir-cleaneur" && ["independant", "societe"].includes(param)) { location.replace(`#/compte/cleaneur/${param}`); return; }
  // Connexion demandée depuis une page (réservation en cours, messages…) : on y revient une fois connecté.
  if (route === "compte" && !param && pagePrecedente && !connecte()) noterRetourConnexion(pagePrecedente);
  pagePrecedente = location.hash;
  compterPage(route, param);
  marquerActif();
  // Barre des espaces sur l'accueil (entre le logo et le bandeau de lancement) : Particulier, Pro, Cleaneur.
  // Connecté : ouvre son espace (ou propose de l'ajouter) ; sinon : création du compte adéquat. Même barre dans l'appli (Vitrine.kt).
  const barre = document.getElementById("barre-espaces");
  if (barre) {
    barre.innerHTML = route === "" ? `<div class="barre-espaces"><div class="conteneur">${barreOnglets(null, ["particulier", "entreprise", "pro", "hotellerie"])}${boutonMode()}</div></div>`
      : route === "mode-cleaneur" || route === "devenir-cleaneur" ? `<div class="barre-espaces"><div class="conteneur">${boutonMode()}</div></div>` : "";
    traduire(barre);
  }
  document.body.classList.toggle("sans-rappel", route === "reserver" || route === "estimer" || route === "messages");
  // Pages qui attendent le serveur : animation de chargement pendant l'attente.
  if (route === "messages") { window.scrollTo(0, 0); vue.innerHTML = pageChargement(); traduire(vue); await pageMessages(vue, chemin.split("/").slice(1).join("/")); return; }
  if (route === "notifications") { window.scrollTo(0, 0); vue.innerHTML = pageChargement(); traduire(vue); await pageNotifications(vue, param); return; }
  if (route === "compte") { window.scrollTo(0, 0); vue.innerHTML = pageChargement(); traduire(vue); await pageCompte(vue, param); return; }
  if (route === "rejoindre") { window.scrollTo(0, 0); vue.innerHTML = pageChargement(); traduire(vue); const { pageRejoindre } = await import("./societe.js"); const { session: sessionCompte } = await import("./donnees.js"); await pageRejoindre(vue, param, !!(await sessionCompte().catch(() => null))); return; }
  if (route === "carte" || route === "recherche") { window.scrollTo(0, 0); const { pageCarteClient, brancherCarteClient } = await import("./carte-client.js"); vue.innerHTML = pageCarteClient(); traduire(vue); brancherCarteClient(vue); return; }
  if (route === "aide") { window.scrollTo(0, 0); vue.innerHTML = pageChargement(); traduire(vue); const { pageAssistant } = await import("./assistant.js"); await pageAssistant(vue, param); return; }
  if (route === "garantie") { window.scrollTo(0, 0); const { pageGarantie } = await import("./garantie.js"); pageGarantie(vue); return; }
  if (route === "importer-biens") { window.scrollTo(0, 0); vue.innerHTML = pageChargement(); traduire(vue); const { pageImportBiens } = await import("./import-biens.js"); await pageImportBiens(vue, param); return; }
  if (route === "formation") { window.scrollTo(0, 0); vue.innerHTML = pageChargement(); traduire(vue); const { pageFormation } = await import("./formations.js"); await pageFormation(vue, param); return; }
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
  // Badge public « Logement contrôlé Cleaneroo » (badge.js)
  if (route === "controle" && param) { window.scrollTo(0, 0); vue.innerHTML = pageChargement(); traduire(vue); const { pageBadge } = await import("./badge.js"); await pageBadge(vue, param); return; }
  if (route === "demande") {
    const [, ref, jeton] = chemin.split("/");
    vue.innerHTML = pageChargement("Recherche de votre demande…"); traduire(vue);
    vue.innerHTML = await pageDemande(decodeURIComponent(ref || ""), decodeURIComponent(jeton || ""));
    traduire(vue);
    window.scrollTo(0, 0);
    // Compte rendu pièce par pièce (photos avant / après, tâches, avis de l'IA) pour le client connecté.
    // Cleaneroo AI : prestations suivantes de la même proposition, à réserver ensuite.
    import("./assistant-ia-reservation.js").then(m => {
      const suite = m.suiteIa();
      if (!suite.length || !vue.querySelector("section")) return;
      const z = document.createElement("div");
      z.className = "conteneur"; z.style.marginTop = "16px";
      z.innerHTML = `<div class="carte teintee suite-proposition-ia"><b>${icone("instantane")} ${tr("Votre proposition contient encore")} ${suite.length} ${tr(suite.length > 1 ? "prestations" : "prestation")}</b>
        <p class="petit" style="margin:4px 0 10px">${suite.map(x => esc(x.champs?.diagnosticIa?.libelle || rubrique(x.rubriqueId)?.nom || "")).join(" · ")}</p>
        <button type="button" class="bouton" data-suite-ia>${tr("Réserver la suivante")}</button></div>`;
      vue.querySelector("section").prepend(z); traduire(z);
      z.querySelector("[data-suite-ia]").onclick = () => m.reserverSuivante();
    }).catch(() => null);
    const rendu = document.getElementById("compte-rendu-pieces");
    if (rendu) compteRenduPieces(rendu, decodeURIComponent(ref || ""));
    // Présence du Cleaneur à confirmer (sa position n'a pas pu confirmer l'arrivée).
    blocModifier(document.getElementById("modifier-demande"), demandeAffichee || {}, decodeURIComponent(ref || ""), decodeURIComponent(jeton || ""), () => afficher());
    blocReportPass(document.getElementById("modifier-demande"), demandeAffichee || {}, decodeURIComponent(ref || ""), () => afficher()).catch(() => null);
    brancherBons(document.getElementById("bon-client"));
    blocSupplementClient(document.getElementById("supplement-client"), decodeURIComponent(ref || ""), decodeURIComponent(jeton || ""));
    blocConstat(document.getElementById("constat-arrivee"), decodeURIComponent(ref || ""), decodeURIComponent(jeton || ""));
    const fav = document.getElementById("favori-client");
    if (fav) blocFavori(fav, decodeURIComponent(ref || ""), fav.dataset.rubrique);
    blocPaiement(document.getElementById("paiement-client"), decodeURIComponent(ref || ""), decodeURIComponent(jeton || ""));
    // Prix libre d'une conciergerie (23/11/2026) : détail du prix et « Augmenter le prix », pour la conciergerie connectée.
    // Qui vient (23/11/2026) : photo d'identité vérifiée du Cleaneur et vitrine de sa société, sans aucune coordonnée.
    if (document.getElementById("paiement-client")) import("./vitrine.js").then(m => m.blocQuiVient(document.getElementById("paiement-client"), decodeURIComponent(ref || ""))).catch(() => null);
    if (document.getElementById("paiement-client")) import("./prix-libre.js").then(m => m.blocPrixDemande(document.getElementById("paiement-client"), decodeURIComponent(ref || ""))).catch(() => null);
    blocRemplacementClient(document.getElementById("remplacement-client"), decodeURIComponent(ref || ""), decodeURIComponent(jeton || ""));
    blocConsommablesClient(document.getElementById("consommables-client"), decodeURIComponent(ref || ""), decodeURIComponent(jeton || ""));
    blocPropositionsClient(document.getElementById("propositions-client"), decodeURIComponent(ref || ""), decodeURIComponent(jeton || ""));
    blocFavoriDemande(document.getElementById("favori-demande"), decodeURIComponent(ref || ""), decodeURIComponent(jeton || ""));
    blocProchainPassage(document.getElementById("prochain-passage"), d, decodeURIComponent(jeton || ""));
    blocRetardClient(document.getElementById("retard-client"), decodeURIComponent(ref || ""), decodeURIComponent(jeton || ""));
    const presence = document.getElementById("presence-client");
    if (presence) supabase.rpc("presence_a_confirmer", { p_reference: decodeURIComponent(ref || ""), p_jeton: decodeURIComponent(jeton || "") }).then(({ data }) => {
      if (!data || !presence.isConnected) return;
      presence.innerHTML = `<div class="carte teintee" style="margin-bottom:14px"><b>${icone("position")} ${tr("Votre Cleaneur est-il arrivé ?")}</b>
        <p class="petit" style="margin:4px 0 10px">${tr("Sa géolocalisation n'a pas pu le confirmer. Confirmez-vous sa présence chez vous ?")}</p>
        <div class="boutons"><button type="button" class="bouton" data-present="1">${tr("Oui, il est arrivé")}</button>
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
    // Lot 8 : la page se tient à jour. Quand le statut change (Cleaneur trouvé, en route, terminé…), un message le dit
    // et la page se met à jour, sans avoir à la recharger.
    const statutVu = demandeAffichee?.statut, ici = location.hash;
    if (statutVu && !["TERMINEE", "ANNULEE"].includes(statutVu)) {
      const veille = setInterval(async () => {
        if (location.hash !== ici || document.hidden) { if (location.hash !== ici) clearInterval(veille); return; }
        const n = await suivre(decodeURIComponent(ref || ""), decodeURIComponent(jeton || "")).catch(() => null);
        if (!n || n.statut === statutVu || location.hash !== ici) return;
        clearInterval(veille);
        afficherToast(`${tr("Mise à jour")} : ${tr(libelleStatut(n.statut))}`, "info", 6000);
        afficher();
      }, REGLES.SURVEILLANCE_S * 1000);
    }
    return;
  }
  // Compte connecté (Particulier, Pro, administrateur) : l'accueil devient son tableau de bord vivant (prochaine prestation, « À faire »).
  // Tableau de bord vivant du compte (prochaine prestation, « À faire ») ; cleaneroo.fr ouvre toujours la page d'accueil.
  if (route === "favoris") {
    window.scrollTo(0, 0); vue.innerHTML = pageChargement(); traduire(vue);
    if (!(await supabase.auth.getSession().catch(() => null))?.data?.session) { location.hash = "#/compte"; return; }
    await pageFavoris(vue); return;
  }
  if (route === "tableau" && !document.body.classList.contains("acces-cleaneur")) {
    if (await pageTableau(vue)) { window.scrollTo(0, 0); return; }
  }
  const page = ROUTES[route] || pageAccueil;
  sessionActive = !!(await supabase.auth.getSession().catch(() => null))?.data?.session;
  vue.innerHTML = await page();
  brancherInscription(vue);
  brancherExpress(vue);
  brancherVideoPub(vue);
  traduire(vue);
  reveler(vue);
  animerNotifs(vue);
  afficherAccesCleaneur(vue);
  brancherFormulesCleaneur(vue);
  brancherApercuTournee(vue);
  remplirAvisPublics(vue);
  brancherAvantApres(vue);
  brancherParcours(vue);
  brancherDesignSystem(vue);
  window.scrollTo(0, 0);
}

/** Barre de lecture (19/11/2026) : un fin trait dégradé suit le défilement de la page. */
const lecture = document.createElement("div");
lecture.className = "progression-lecture";
lecture.setAttribute("aria-hidden", "true");
document.body.append(lecture);
let lectureEnAttente = false;
addEventListener("scroll", () => {
  if (lectureEnAttente) return;
  lectureEnAttente = true;
  requestAnimationFrame(() => {
    const max = document.documentElement.scrollHeight - innerHeight;
    lecture.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
    lectureEnAttente = false;
  });
}, { passive: true });

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
  catch (e) {
    // Lot 8 : jamais d'écran vide ou figé. Une page qui n'a pas pu s'afficher le dit et propose de réessayer.
    console.error(e);
    if (tour === tourPage) {
      const hors = navigator.onLine === false;
      vue.innerHTML = `<section class="bloc"><div class="conteneur etroit">${blocEtat({ icone: "alerte", erreur: true,
        titre: tr(hors ? "Connexion perdue" : "Cette page n'a pas pu s'afficher"),
        texte: tr(hors ? "Vérifiez votre réseau, puis réessayez." : "Le service est momentanément indisponible. Réessayez dans quelques minutes."),
        action: `<button type="button" class="bouton" data-reessayer-page>${tr("Réessayer")}</button><a class="bouton secondaire" href="#/">${tr("Retour à l'accueil")}</a>` })}</div></section>`;
      vue.querySelector("[data-reessayer-page]").onclick = () => afficher();
    }
  }
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
document.querySelectorAll("[data-logos-paiement]").forEach(z => { z.innerHTML = logosPaiement({ classe: "pied-logos" }); });
traduire(document.querySelector("footer"));
document.title = tr(document.title);
installerRappel();
surveillerConnexion();
memoriserCodeParrain();
window.addEventListener("hashchange", afficher);
// En-tête du compte affiché tout de suite (profil gardé sur l'appareil) : plus d'en-tête « visiteur » le temps de relire le compte.
if (profilMemorise()) rendreEnteteMemorise();
await Promise.all([retourEmail(), chargerOuverture().catch(() => false)]);
document.getElementById("lancement").innerHTML = bandeauLancement(); traduire(document.getElementById("lancement"));
// La page s'affiche tout de suite ; le compte est relu ensuite (l'en-tête se met à jour tout seul).
afficher();
// Tarifs publiés depuis l'espace de gestion (20/11/2026) : relus en arrière-plan, la page se redessine s'ils ont changé.
import("./tarifs.js").then(({ chargerTarifs }) => chargerTarifs(supabase)).then(change => { if (change) afficher(); }).catch(() => null);
// Le profil vient d'être relu : si l'accueil invitait encore à s'inscrire alors que le compte est connecté, on le redessine.
majLienCompte().then(() => { if (connecte() && document.querySelector("#vue .appel-2026, #vue .inscription-inspirante")) afficher(); });
supabase.auth.onAuthStateChange((evt, sess) => { sessionActive = !!sess; });

// Cleaneroo AI (26/11/2026) : tout bouton « Décrire mon besoin » ouvre l'assistant, chargé à la demande.
document.addEventListener("click", e => {
  const b = e.target.closest("[data-assistant-ia]");
  if (!b) return;
  e.preventDefault();
  import("./assistant-ia.js").then(m => m.ouvrirAssistantIA(b.dataset.assistantIa || "")).catch(() => null);
});
