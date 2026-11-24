// Éléments communs au site (index.html) et aux pages statiques (villes, calculateur, comparatifs) :
// étapes « Comment ça marche », encart de réassurance, bouton et fenêtre « Être rappelé ».
import { REGLES, reservationsFermees, MESSAGE_LANCEMENT, PORTEFEUILLES_ACTIFS, LOGOS_PAIEMENT_OFFICIELS } from "./regles.js";
import { evenement } from "./compteur.js";
import { eurosRond, rubrique, PRIX_FORMULES } from "./catalogue.js";
import { calculer, entreeEstimation } from "./estimation.js";
import { icone } from "./icones.js";
import { inscrire, supabase } from "./donnees.js";
import { traduire, tr, LOCALE, langue } from "./langue.js";

export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

/* ------------------------------------------------------------------ Anti-spam des formulaires publics (13 novembre 2026)
   Un robot remplit tous les champs, va très vite et colle des liens : champ piège invisible, délai minimal, liens refusés.
   La base refait les mêmes contrôles (outils/base-anti-spam.sql), car un robot peut écrire sans passer par la page. */
export const CONTIENT_LIEN = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(online|xyz|top|site|click|link|ru|id|info|biz|shop|store|live|icu|cfd|sbs|win|bond|vip)\b)/i;
const ouvertsLe = new WeakMap();
/** À appeler quand le formulaire s'affiche. */
export const surveillerFormulaire = f => ouvertsLe.set(f, Date.now());
/** Vrai si l'envoi ressemble à un robot : champ piège rempli ou envoi en moins de 3 secondes. */
export const envoiRobot = f => !!f.querySelector("[name=site_web]")?.value || Date.now() - (ouvertsLe.get(f) || 0) < 3000;

/* ------------------------------------------------------------------ Avant l'ouverture des réservations (interrupteur, 24/11/2026) */
export function bandeauLancement() {
  if (!reservationsFermees()) return "";
  return `<div class="lancement"><div class="conteneur">
    <span><b>Les réservations ouvrent très bientôt</b><span class="message-lancement"> · ${MESSAGE_LANCEMENT}</span></span></div></div>`;
}

/* ------------------------------------------------------------------ Chargement (8 novembre 2026) : logo Cleaneroo + silhouette de la page */
export const LOGO_ATTENTE = (petit = false) => `<span class="logo-attente${petit ? " petit" : ""}" aria-hidden="true"><span class="halo"></span><span class="anneau"></span><span class="anneau a2"></span>
  <span class="tuile"><img src="/assets/img/logo-marque.svg" alt="" width="72" height="72"><i class="buee"></i><i class="raclette"></i><i class="reflet"></i></span>
  <i class="bulle b1"></i><i class="bulle b2"></i><i class="bulle b3"></i><i class="bulle b4"></i><i class="etincelle e1"></i><i class="etincelle e2"></i><i class="etincelle e3"></i></span>`;
/** Attente (16 novembre 2026), toujours centrée : le logo se couvre de buée, une raclette l'essuie, étincelles et bulles de savon,
 *  halo, double anneau en dégradé, texte avec points animés et barre de progression. Même animation que l'appli (Chargement.kt).
 *  petit : version compacte, dans une carte. */
export function chargeur(texte = "Chargement…", { petit = false } = {}) {
  const libelle = `<span class="texte-attente">${texte.replace(/…$/, "")}<i class="points"></i></span>`;
  return `<div class="${petit ? "chargeur-ligne" : "chargeur-pro"}" role="status">${LOGO_ATTENTE(petit)}${libelle}<span class="barre-attente" aria-hidden="true"><i></i></span></div>`;
}
/** Silhouette de la page qui arrive (titre, onglets, cartes), avec un balayage lumineux : la mise en page ne saute pas. */
const squelette = () => `<div class="squelette" aria-hidden="true">
  <span class="sq sq-titre"></span><span class="sq sq-ligne" style="width:58%"></span>
  <div class="sq-onglets"><span class="sq sq-pilule"></span><span class="sq sq-pilule"></span><span class="sq sq-pilule"></span></div>
  ${[0, 1, 2].map(i => `<div class="sq-carte" style="--i:${i}"><span class="sq sq-rond"></span><div><span class="sq sq-ligne" style="width:${[64, 48, 56][i]}%"></span>
    <span class="sq sq-ligne fine" style="width:${[86, 72, 80][i]}%"></span></div><span class="sq sq-montant"></span></div>`).join("")}
</div>`;
/** Page entière en attente de données (compte, prestations, suivi d'une demande). */
export const pageChargement = (texte = "Chargement…") => `<div class="chargement-page"><div class="conteneur etroit">${chargeur(texte)}${squelette()}</div></div>`;

/* ------------------------------------------------------------------ Décor animé des tableaux de bord (8 novembre 2026)
   Étoiles qui scintillent, bulles de savon qui montent, éponge qui mousse dans un coin : en fond, discret, jamais cliquable.
   Même décor dans l'appli (DecorTableau dans Chargement.kt). */
const BULLES_DECOR = [[6, 18, 17, 0], [15, 10, 13, 5], [27, 24, 21, 9], [41, 12, 15, 2], [58, 20, 19, 12], [69, 9, 12, 7], [81, 16, 18, 3], [92, 11, 14, 10]];
const ETOILES_DECOR = [[8, 22, "or", 0], [22, 64, "lilas", 1.2], [47, 12, "turquoise", .6], [63, 40, "or", 2.1], [78, 18, "lilas", 1.6], [90, 58, "turquoise", .3], [35, 82, "or", 2.6]];
export function decorTableau(actif = true) {
  document.querySelector(".decor-tableau")?.remove();
  document.body.classList.toggle("avec-decor", actif);
  if (!actif) return;
  const d = document.createElement("div");
  d.className = "decor-tableau";
  d.setAttribute("aria-hidden", "true");
  d.innerHTML = `<span class="tache t1"></span><span class="tache t2"></span><span class="tache t3"></span>
    ${BULLES_DECOR.map(([x, t, duree, retard]) => `<i class="bulle-decor" style="left:${x}%;width:${t}px;height:${t}px;animation-duration:${duree}s;animation-delay:-${retard}s"></i>`).join("")}
    ${ETOILES_DECOR.map(([x, y, c, retard]) => `<b class="etoile-decor ${c}" style="left:${x}%;top:${y}%;animation-delay:${retard}s"></b>`).join("")}
    <div class="eponge-decor"><span class="mousse m1"></span><span class="mousse m2"></span><span class="mousse m3"></span><span class="mousse m4"></span><span class="corps"></span></div>`;
  document.body.prepend(d);
}

/* ------------------------------------------------------------------ Comment ça marche (refonte du 24/11/2026, demande de Michael) */
/* Un parcours par profil. Le paiement a lieu à la réservation (paiement sécurisé, conservé jusqu'à la validation) : aucune étape
   ne dit « validez, puis payez ». Chaque phrase décrit ce que le site fait aujourd'hui. */
export const PARCOURS = {
  particulier: [
    ["calendrier", "Décrivez votre besoin", "Choisissez la prestation, répondez à quelques questions et ajoutez des photos si besoin. Le prix exact s'affiche tout de suite, sans devis."],
    ["carte-bancaire", "Réservez en toute sécurité", "Vous réglez en réservant, par paiement sécurisé Stripe. Votre argent est conservé en sécurité et n'est versé au Cleaneur qu'après votre validation."],
    ["cleaneurs", "Choisissez votre Cleaneur", "Des Cleaneurs vérifiés (identité, SIRET, assurance) se proposent. Comparez leurs avis, leur distance et leur prix : c'est vous qui choisissez. Demande annulée : vous êtes remboursé."],
    ["position", "Suivez l'intervention en direct", "« En route », arrivée confirmée par géolocalisation, photo de vérification du jour : vous savez qui vient, et quand. Chaque pièce est photographiée avant et après."],
    ["valide", "Validez le compte rendu", "Tâches cochées, photos horodatées, signature : vous validez et le Cleaneur est payé. Sans réponse de votre part, la validation se fait automatiquement 48 h après la fin. Pourboire et avis si vous le souhaitez."],
  ],
  entreprise: [
    ["bureaux", "Créez votre espace entreprise", "Renseignez votre société : vos factures sont établies à son nom, au format Factur-X."],
    ["calendrier", "Un passage ou un entretien régulier", "Décrivez vos locaux, voyez le prix tout de suite et planifiez un passage unique ou des passages réguliers."],
    ["carte-bancaire", "Paiement sécurisé", "Le premier passage est réglé à la réservation ; les suivants sont prélevés automatiquement 3 jours avant. Chaque paiement n'est versé au Cleaneur qu'après validation."],
    ["appareil-photo", "Contrôle et compte rendu", "Photos avant / après de chaque zone, tâches cochées et signées : vous savez exactement ce qui a été fait."],
  ],
  conciergerie: [
    ["location", "Ajoutez vos logements", "Un par un ou depuis un fichier, puis reliez leurs calendriers (Airbnb, Booking…) : départs et arrivées apparaissent dans votre planning."],
    ["calendrier", "Programmez les ménages entre voyageurs", "Ménage par ménage, ou tous en une seule fois sur les semaines à venir, avec les horaires de chaque séjour."],
    ["appareil-photo", "Un état des lieux à chaque passage", "Photos avant / après de chaque pièce, consommables suivis, dommages signalés avec photos et délai de déclaration suivi."],
    ["credit-impot", "Des relevés pour vos propriétaires", "Un relevé PDF par propriétaire : séjours, ménages, incidents et montants à refacturer."],
  ],
  cleaneur: [
    ["bouclier-coche", "Inscrivez-vous gratuitement", "Identité, SIRET, attestation URSSAF et assurance RC Pro vérifiées, puis une mission test."],
    ["position", "Choisissez vos missions", "Les missions près de chez vous s'affichent avec le prix, la durée et le trajet. Vous vous proposez ; le client choisit."],
    ["photo", "Laissez-vous guider le jour J", "En route, arrivée géolocalisée, photo avant, tâches cochées, photo après : l'application vous guide pièce par pièce et l'IA vérifie les photos."],
    ["paiement", "Recevez votre paiement après validation", "Le client valide le compte rendu, ou la validation se fait automatiquement 48 h après la fin : votre paiement est alors versé."],
  ],
};
export const PROFILS_PARCOURS = [["particulier", "Particulier"], ["entreprise", "Entreprise"], ["conciergerie", "Conciergerie et hôtels"], ["cleaneur", "Cleaneur"]];
export const ETAPES = PARCOURS.particulier;
/** Les 3 étapes essentielles (pages ville) : décrire, réserver en sécurité, suivre puis valider. */
export const ETAPES_COURTES = [PARCOURS.particulier[0], PARCOURS.particulier[1],
  ["valide", "Suivez, puis validez", "Suivi en direct et compte rendu photo avant / après : vous validez, puis le Cleaneur est payé."]];
/** Onglets « un parcours par profil » (page Comment ça marche). */
export const blocParcours = (actif = "particulier") => `<div class="parcours" data-parcours>
  <div class="aa-onglets parcours-onglets" role="tablist">${PROFILS_PARCOURS.map(([id, nom]) =>
    `<button type="button" role="tab" aria-selected="${id === actif}" data-profil="${id}">${nom}</button>`).join("")}</div>
  ${PROFILS_PARCOURS.map(([id]) => `<div role="tabpanel" data-panneau="${id}" ${id === actif ? "" : "hidden"}>${blocEtapes(PARCOURS[id])}</div>`).join("")}</div>`;
export function brancherParcours(racine = document) {
  racine.querySelectorAll("[data-parcours]").forEach(z => z.querySelectorAll("[data-profil]").forEach(bt => bt.onclick = () => {
    z.querySelectorAll("[data-profil]").forEach(x => x.setAttribute("aria-selected", String(x === bt)));
    z.querySelectorAll("[data-panneau]").forEach(p => { p.hidden = p.dataset.panneau !== bt.dataset.profil; });
  }));
}
export const blocEtapes = (liste = ETAPES) => `<div class="etapes etroit">${liste.map(([e, t, d], i) => `
  <div class="etape"><div class="pastille">${icone(e, { tuile: true })}<b>${i + 1}</b></div>
    <div class="carte"><div class="surtitre">ÉTAPE ${i + 1}</div><h3>${t}</h3><p class="muet" style="margin:6px 0 0">${d}</p></div></div>`).join("")}</div>`;

/* ------------------------------------------------------------------ Vos garanties Cleaneroo (accueil, pages ville, étape 5, Qui sommes-nous) */
/** Les 5 garanties (prompt 2, partie 2) : textes repris mot pour mot, chacun vrai aujourd'hui. */
export const GARANTIES = [
  ["carte-bancaire", "Paiement 100 % sécurisé", "Paiement géré par Stripe, leader mondial du paiement en ligne. Votre numéro de carte n'est jamais vu ni conservé par Cleaneroo. Authentification 3-D Secure par votre banque."],
  ["bouclier-coche", "Cleaneurs vérifiés et assurés", "Identité, SIRET, attestation URSSAF et assurance responsabilité civile professionnelle contrôlés avant toute mission, puis une mission test."],
  ["cleaneurs", "Garantie remplacement", "Votre Cleaneur ne peut pas venir ? Un remplaçant vérifié en priorité, sinon annulation sans frais : vous êtes remboursé."],
  ["appareil-photo", "Preuves photo horodatées", "Avant et après chaque intervention : un dossier clair en cas de question ou de litige."],
  ["cadenas", "Données protégées", "Vos données sont hébergées à Paris et ne sont jamais revendues.", "/#/confidentialite", "Politique de confidentialité"],
];
export function blocReassurance({ compact = false } = {}) {
  return `<div class="reassurance garanties${compact ? " compacte" : ""}">${GARANTIES.map(([ic, t, d, lien, texteLien]) =>
    `<div class="point">${icone(ic, { tuile: !compact })}<div><b>${t}</b><p>${d}${lien ? ` <a href="${lien}">${texteLien}</a>` : ""}</p></div></div>`).join("")}</div>`;
}
/* ------------------------------------------------------------------ Paiement : formulations uniques et moyens acceptés (prompt 2, partie 3) */
export const PAIEMENT_COURT = "Paiement sécurisé à la réservation, versé au Cleaneur après votre validation";
export const PAIEMENT_LONG = "Vous réglez en réservant, par paiement sécurisé Stripe. Votre argent est conservé en sécurité et n'est versé au Cleaneur qu'à la fin de l'intervention, une fois que vous l'avez validée.";
/** Moyens de paiement affichés : cartes toujours, Apple Pay et Google Pay seulement si PORTEFEUILLES_ACTIFS. */
export const moyensPaiement = () => [["visa", "Visa"], ["mastercard", "Mastercard"], ["cb", "CB"],
  ...(PORTEFEUILLES_ACTIFS ? [["apple-pay", "Apple Pay"], ["google-pay", "Google Pay"]] : [])];
/** Rangée des moyens de paiement et mention Stripe (étape 5, pied de page, bande « Vos garanties »). */
export const logosPaiement = ({ classe = "" } = {}) => {
  const logo = ([f, nom]) => LOGOS_PAIEMENT_OFFICIELS
    ? `<img src="/assets/img/paiement/${f}.svg" alt="${nom}" height="24" loading="lazy">` : `<span class="moyen">${nom}</span>`;
  return `<div class="logos-paiement${classe ? " " + classe : ""}"><span class="moyens">${moyensPaiement().map(logo).join("")}</span>
    <span class="stripe">${icone("cadenas")}${LOGOS_PAIEMENT_OFFICIELS ? `<img src="/assets/img/paiement/stripe.svg" alt="Paiement sécurisé par Stripe" height="24" loading="lazy">` : "<span>Paiement sécurisé par Stripe</span>"}</span></div>`;
};
/** Règle d'annulation, générée depuis REGLES (même texte que les conditions générales). */
export const texteAnnulation = () => `Annulation gratuite jusqu'à ${REGLES.ANNULATION_GRATUITE_H} h avant l'intervention ; ensuite, ${REGLES.ANNULATION_TARDIVE_PCT} % du prix accepté restent dus.`;
/** Encart de l'étape 5, juste au-dessus du bouton de paiement. */
export const encartPaiementSecurise = () => `<div class="encart-paiement">${icone("cadenas", { tuile: true })}<div>
  <b>Paiement 100 % sécurisé par Stripe</b>
  <ul><li>Vos coordonnées bancaires sont chiffrées et ne sont jamais conservées par Cleaneroo.</li>
    <li>Le Cleaneur n'est payé qu'après votre validation.</li><li>${texteAnnulation()}</li></ul>
  ${logosPaiement()}</div></div>`;

/** Bande « Vos garanties Cleaneroo » (accueil, juste après « Comment ça marche ? »). */
export const bandeGaranties = () => `<section class="bloc bande-garanties"><div class="conteneur">
  <div class="titre-section revele"><span class="surtitre">En toute confiance</span><h2>Vos garanties Cleaneroo</h2><p class="muet">Sécurisé, vérifié, assuré : ce que Cleaneroo vous garantit à chaque réservation.</p></div>
  <div class="revele">${blocReassurance()}</div>
  <div class="revele" style="margin-top:22px">${logosPaiement({ classe: "centre" })}</div></div></section>`;

/* ------------------------------------------------------------------ Avant / après : la preuve en images (prompt 2, partie 6) */
/** Exemples du curseur : illustrations neutres marquées « Exemple », en attendant les vraies photos de Cleaneroo. */
export const EXEMPLES_AVANT_APRES = [["salle-de-bain", "Salle de bain"], ["canape", "Canapé"], ["voiture", "Voiture"]];
export const blocAvantApres = () => `<section class="bloc avant-apres-bloc"><div class="conteneur">
  <div class="titre-section revele"><span class="surtitre">Preuves photo</span><h2>Avant / après : la preuve en images</h2></div>
  <div class="avant-apres revele" data-avant-apres>
    <div class="aa-onglets" role="tablist">${EXEMPLES_AVANT_APRES.map(([id, nom], i) =>
      `<button type="button" role="tab" aria-selected="${i === 0}" data-aa="${id}">${nom}</button>`).join("")}</div>
    <div class="aa-cadre" style="--pos:50%">
      <img class="aa-avant" src="/assets/img/avant-apres/${EXEMPLES_AVANT_APRES[0][0]}-avant.svg" alt="Exemple : avant l'intervention" width="1200" height="800" loading="lazy">
      <img class="aa-apres" src="/assets/img/avant-apres/${EXEMPLES_AVANT_APRES[0][0]}-apres.svg" alt="Exemple : après l'intervention" width="1200" height="800" loading="lazy">
      <span class="aa-etiquette aa-g">Avant</span><span class="aa-etiquette aa-d">Après</span><span class="aa-exemple">Exemple</span>
      <span class="aa-poignee" aria-hidden="true"><i></i></span>
      <input type="range" min="0" max="100" value="50" aria-label="Comparer avant et après">
    </div>
    <p class="muet aa-texte">Chaque pièce est photographiée avant et après l'intervention. Les photos sont horodatées et rangées dans votre espace avec le compte rendu signé.</p>
  </div></div></section>`;
/** Branche le curseur et les onglets (à appeler après l'affichage). */
export function brancherAvantApres(racine = document) {
  racine.querySelectorAll("[data-avant-apres]").forEach(z => {
    const cadre = z.querySelector(".aa-cadre"), curseur = z.querySelector("input[type=range]");
    curseur.oninput = () => cadre.style.setProperty("--pos", curseur.value + "%");
    z.querySelectorAll("[data-aa]").forEach(bt => bt.onclick = () => {
      z.querySelectorAll("[data-aa]").forEach(x => x.setAttribute("aria-selected", String(x === bt)));
      z.querySelector(".aa-avant").src = `/assets/img/avant-apres/${bt.dataset.aa}-avant.svg`;
      z.querySelector(".aa-apres").src = `/assets/img/avant-apres/${bt.dataset.aa}-apres.svg`;
      curseur.value = 50; curseur.oninput();
    });
  });
}

/* ------------------------------------------------------------------ Le juste prix, près de chez vous (prompt 2, partie 5) */
/** Mention sous le total : le code postal seulement, jamais le nom de la zone ni son pourcentage. */
export const mentionCodePostal = cp => `${tr("Prix calculé pour le code postal")} ${esc(cp)}`;
/** Ligne d'information « Tarif zone … » de l'estimation : jamais affichée au client (le prix l'inclut déjà). */
export const ligneZone = l => /^Tarif zone /.test(l?.libelle || "");
export const JUSTE_PRIX = [
  ["position", "Nos tarifs sont établis à partir des prix pratiqués par les professionnels du nettoyage dans votre secteur."],
  ["instantane", "Le prix tient compte de votre code postal, de la prestation et de la surface : vous voyez le montant exact avant de réserver, sans devis ni négociation."],
  ["valide", "Pas de frais cachés : déplacement inclus jusqu'à 15 km, frais de service indiqués avant le paiement."],
];
export const blocJustePrix = () => `<div class="juste-prix revele"><div class="jp-titre">${icone("paiement", { tuile: true })}<h3>Le juste prix, près de chez vous</h3></div>
  <ul>${JUSTE_PRIX.map(([ic, t]) => `<li>${icone(ic)}<span>${t}</span></li>`).join("")}</ul></div>`;

/* ------------------------------------------------------------------ Ils nous font confiance (prompt 2, partie 4) */
/** Nombre d'avis publiés à partir duquel la section s'affiche. */
export const AVIS_MINIMUM = 3;
const virgule = n => Number(n).toLocaleString(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
/** Contenu de la section à partir de la réponse d'avis_publics ; chaîne vide sous AVIS_MINIMUM avis publiés. */
export function contenuAvisPublics(r) {
  if (!r || !(r.nombre >= AVIS_MINIMUM)) return "";
  const mois = m => { const [a, n] = String(m || "").split("-").map(Number); return a ? new Date(a, n - 1, 15).toLocaleDateString(LOCALE, { month: "long", year: "numeric" }) : ""; };
  const etoiles = n => `<span class="etoiles-avis-publics" role="img" aria-label="${n} / 5">${[1, 2, 3, 4, 5].map(i => `<i class="${i <= n ? "plein" : ""}">${icone("avis")}</i>`).join("")}</span>`;
  const carte = a => `<figure class="carte avis-public">${etoiles(a.note)}
    ${a.commentaire ? `<blockquote>${langue === "en" ? `“${esc(a.commentaire)}”` : `« ${esc(a.commentaire)} »`}</blockquote>` : ""}
    <figcaption><b>${esc(a.auteur || "")}</b><span>${[a.ville, rubrique(a.rubrique)?.nom, mois(a.mois)].filter(Boolean).map(esc).join(" · ")}</span>
      <small>${icone("valide")} ${tr("Avis vérifié · prestation réalisée via Cleaneroo")}</small></figcaption></figure>`;
  return `<div class="conteneur">
    <div class="titre-section"><span class="surtitre">${tr("Avis clients")}</span><h2>${tr("Ils nous font confiance")}</h2>
      <p class="note-globale">${etoiles(Math.round(r.moyenne))}<b>${virgule(r.moyenne)} / 5</b> · ${r.nombre} ${tr("avis vérifiés")}</p></div>
    <div class="grille-3 avis-publics">${(r.avis || []).slice(0, 6).map(carte).join("")}</div>
    <p class="centre petit" style="margin-top:18px"><a href="/#/gestion-des-avis">${tr("Comment nous gérons les avis")}</a></p></div>`;
}
/** Emplacement de la section : masqué tant qu'il n'y a pas assez d'avis publiés. */
export const sectionAvisPublics = () => `<section class="bloc ils-confiance" data-avis-publics hidden></section>`;
/** Lit les avis publiés et affiche la section si elle a au moins AVIS_MINIMUM avis. */
export async function remplirAvisPublics(racine = document) {
  const zones = [...racine.querySelectorAll("[data-avis-publics]")];
  if (!zones.length) return;
  const { data } = await supabase.rpc("avis_publics").then(x => x, () => ({ data: null }));
  const html = contenuAvisPublics(data);
  zones.forEach(z => { if (!z.isConnected) return; z.innerHTML = html; z.hidden = !html; });
}

/* ------------------------------------------------------------------ Être rappelé */
const CRENEAUX = [["matin", "Matin", "Merci, nous vous rappelons le matin."], ["midi", "Midi", "Merci, nous vous rappelons à midi."],
  ["apres_midi", "Après-midi", "Merci, nous vous rappelons l'après-midi."], ["soir", "Soir", "Merci, nous vous rappelons en soirée."]];
const PROFILS = [["particulier", "Particulier"], ["professionnel", "Professionnel"], ["conciergerie", "Conciergerie"]];

/** Bouton qui ouvre la fenêtre « Être rappelé » (ville préremplie si donnée). */
export const boutonRappel = (classe = "", ville = "") =>
  `<button type="button" class="bouton ${classe}" data-rappel data-ville="${esc(ville)}">${icone("telephone")}<span>Être rappelé</span></button>`;

/** Encart « Besoin d'aide pour choisir ? » (page Prestations, étape 5 de la réservation), prompt du 23/11/2026. */
export const encartAideRappel = () => `<div class="encart-rappel">${icone("telephone", { tuile: true })}
  <p><b>Besoin d'aide pour choisir ?</b> <span>Un conseiller vous rappelle au créneau de votre choix.</span></p>
  ${boutonRappel("rappel-encart")}</div>`;

function fenetreRappel() {
  const radios = (nom, liste) => `<div class="segments">${liste.map(([v, l], i) =>
    `<label><input type="radio" name="${nom}" value="${v}" ${i === 0 ? "checked" : ""}><span>${l}</span></label>`).join("")}</div>`;
  return `<dialog class="fenetre-rappel" id="fenetre-rappel" aria-labelledby="titre-rappel">
    <form id="form-rappel" novalidate><input class="piege" name="site_web" tabindex="-1" autocomplete="off" aria-hidden="true">
      <button type="button" class="fermer" data-fermer aria-label="Fermer">${icone("menu").replace('d="M4 7h16M4 12h16M4 17h16"', 'd="M6 6l12 12M18 6 6 18"')}</button>
      <h2 id="titre-rappel">${icone("telephone")} Être rappelé</h2>
      <p class="rappel-garantie">${icone("garantie")} Gratuit, sans engagement. Votre numéro ne sert qu'à vous rappeler.</p>
      <p class="muet">Laissez votre numéro : nous vous rappelons au créneau de votre choix.</p>
      <label class="champ">Prénom<input name="prenom" autocomplete="given-name" maxlength="80" required></label>
      <label class="champ">Téléphone<input name="telephone" type="tel" inputmode="numeric" autocomplete="tel" maxlength="14" placeholder="06 12 34 56 78" required></label>
      <fieldset><legend>Vous êtes</legend>${radios("profil", PROFILS)}</fieldset>
      <fieldset><legend>Créneau de rappel</legend>${radios("creneau", CRENEAUX)}</fieldset>
      <label class="champ">Ville<input name="ville" autocomplete="address-level2" maxlength="100"></label>
      <label class="case"><input type="checkbox" name="accord" required><span>J'accepte d'être rappelé par Cleaneroo au sujet de ma demande. <a href="/#/confidentialite" target="_blank" rel="noopener">Politique de confidentialité</a></span></label>
      <p class="erreur" hidden></p>
      <button class="bouton" type="submit">Être rappelé</button>
    </form></dialog>`;
}

/** Installe le bouton d'en-tête (ordinateur), la barre du bas (mobile) et la fenêtre. À appeler une fois par page. */
export function installerRappel(villeParDefaut = "") {
  if (document.getElementById("fenetre-rappel")) return;
  document.querySelector(".entete .actions-entete")?.insertAdjacentHTML("afterbegin", boutonRappel("rappel-entete", villeParDefaut));
  document.body.insertAdjacentHTML("beforeend", `<div class="rappel-mobile">${boutonRappel("", villeParDefaut)}</div>${fenetreRappel()}`);
  const d = document.getElementById("fenetre-rappel"), f = d.querySelector("form"), erreur = f.querySelector(".erreur");
  traduire(d); traduire(document.querySelector(".rappel-mobile")); traduire(document.querySelector(".rappel-entete") || document.createElement("i"));
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-rappel]");
    if (b) { if (b.dataset.ville && !f.ville.value) f.ville.value = b.dataset.ville; erreur.hidden = true; surveillerFormulaire(f); d.showModal(); f.prenom.focus(); }
    if (e.target.closest("[data-fermer]") || e.target === d) d.close();
  });
  f.addEventListener("submit", async e => {
    e.preventDefault();
    const tel = f.telephone.value.replace(/[\s.-]/g, "");
    const faute = !f.prenom.value.trim() ? "Indiquez votre prénom." : !/^0[1-9]\d{8}$/.test(tel) ? "Indiquez un numéro de téléphone à 10 chiffres." :
      !f.accord.checked ? "Cochez la case pour accepter d'être rappelé." : "";
    const montrer = t => { erreur.textContent = t; erreur.hidden = false; traduire(erreur); };
    if (faute) return montrer(faute);
    // Robot : on fait comme si tout allait bien, sans rien enregistrer.
    if (envoiRobot(f)) { f.innerHTML = `<button type="button" class="fermer" data-fermer aria-label="Fermer">×</button><h2>${icone("valide")} ${CRENEAUX.find(c => c[0] === f.creneau.value)?.[2] || ""}</h2>`; return; }
    const bouton = f.querySelector("[type=submit]"); bouton.disabled = true;
    try {
      await inscrire({ type: "rappel", prenom: f.prenom.value.trim(), telephone: tel, profil: f.profil.value, creneau: f.creneau.value,
        ville: f.ville.value.trim(), email: "", code_postal: "", consentement: true });
      f.innerHTML = `<button type="button" class="fermer" data-fermer aria-label="Fermer">×</button><h2>${icone("valide")} ${CRENEAUX.find(c => c[0] === f.creneau.value)[2]}</h2>`;
      traduire(f);
      evenement("rappel");
    } catch { montrer("Envoi impossible pour le moment. Réessayez dans quelques minutes."); }
    finally { bouton.disabled = false; }
  });
}

/* ------------------------------------------------------------------ Formule Standard des véhicules (prompt 2, partie 7) */
/** Prix et durée de la formule Standard pour une citadine (tâches du pack « confort »), calculés par l'estimation, jamais écrits en dur. */
export function formuleStandardVehicule() {
  const p = rubrique("car")?.packs.find(x => x.id === "confort");
  if (!p) return null;
  const br = { rubriqueId: "car", typeLieuId: "citadine", surface: 0, chambres: 0, sdb: 0, niveaux: 1, fenetres: 0, salissure: "NORMAL",
    taches: p.tacheIds, tachesPerso: [], consommablesChoisis: [], engagementMois: 0, flexible: false, panier: [], nombreVehicules: 1 };
  try { const e = calculer(entreeEstimation(br, true, null)); return { prixC: e.totalC, dureeMin: e.dureeMin }; } catch { return null; }
}
{ const f = formuleStandardVehicule(); if (f) PRIX_FORMULES.car = f; }
