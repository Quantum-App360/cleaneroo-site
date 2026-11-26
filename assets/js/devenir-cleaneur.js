// Pages Cleaneur prêtes pour le recrutement (26/11/2026) : vrai gain du Cleaneur (après commission, frais Stripe et cotisations),
// règles du jeu en clair, étapes, zone de lancement, partage du lien https://cleaneroo.fr/cleaneur/, contrat lisible avant l'inscription.
// Tous les chiffres viennent de regles.js (REGLES, gainCleaneur) et du moteur de prix (estimation.js) : aucun montant écrit à la main.
// Même contenu à reporter dans l'appli (Regles.kt, écran « Devenir Cleaneur »).
import { REGLES, euros, duree, gainCleaneur } from "./regles.js";
import { calculer, entreeEstimation } from "./estimation.js";
import { brouillonExemple } from "./reserver.js";
import { CONTRAT, CONTRAT_VERSION, texteContrat } from "./dossier.js";
import { icone } from "./icones.js";
import { tr, traduire } from "./langue.js";

export const LIEN_CLEANEUR = "https://cleaneroo.fr/cleaneur/";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pct = n => `${String(n).replace(".", ",")} %`;

/** Exemple de la page : un ménage de location saisonnière au prix et à la durée calculés par le moteur de réservation. */
export function exempleCleaneur() {
  const est = calculer(entreeEstimation({ ...brouillonExemple("rental", {}) }, false, null));
  return { prixC: est.totalC, dureeMin: est.dureeMin, gratuit: gainCleaneur(est.totalC, est.dureeMin, "gratuit"), pro: gainCleaneur(est.totalC, est.dureeMin, "pro") };
}

/** Accroche du titre : le taux horaire Pro avant cotisations de l'exemple ci-dessous (jamais écrit à la main). */
export const accrocheGain = (ex = exempleCleaneur()) =>
  `${tr("Jusqu'à")} ${euros(ex.pro.horaireAvantC)}${tr("/h avant cotisations, calculé sur l'exemple ci-dessous")}`;

/** Tableau « ce qui vous reste vraiment » : Gratuite et Pro, du prix payé par le client au taux horaire net. */
export function tableauGain(ex = exempleCleaneur()) {
  const lignes = [
    ["Prix payé par le client", x => euros(x.prixC)],
    ["Versé après commission", x => euros(x.verseC)],
    ["Frais de paiement Stripe", x => `−${euros(x.stripeC)}`],
    [`${tr("Cotisations URSSAF estimées")} (${pct(REGLES.URSSAF_SERVICES_PCT)})`, x => `−${euros(x.cotisationsC)}`],
    ["Reste pour vous", x => `<b>${euros(x.resteC)}</b>`, "total"],
    ["Par heure avant cotisations", x => euros(x.horaireAvantC)],
    ["Par heure après cotisations et frais", x => `<b>${euros(x.horaireNetC)}</b>`, "fort"],
  ];
  return `<div class="carte teintee gain-cleaneur" id="exemple-gain">
    <b>${icone("paiement")} ${tr("Exemple : un ménage de location saisonnière")}</b>
    <p class="petit" style="margin:4px 0 10px">${tr("Prix calculé comme pour un client")} : ${euros(ex.prixC)} · ${tr("durée estimée")} ${duree(ex.dureeMin)}</p>
    <div class="table-gain" role="table" aria-label="${esc(tr("Ce qui vous reste, formule Gratuite et formule Pro"))}">
      <div class="ligne-gain entete" role="row"><span role="columnheader"></span><span role="columnheader">${tr("Gratuite")}</span><span role="columnheader">${tr("Pro")}</span></div>
      ${lignes.map(([lib, f, cl]) => `<div class="ligne-gain${cl ? ` ${cl}` : ""}" role="row"><span role="rowheader">${tr(lib)}</span><span role="cell">${f(ex.gratuit)}</span><span role="cell">${f(ex.pro)}</span></div>`).join("")}
    </div>
    <p class="petit" style="margin:10px 0 0">${tr("Estimation pour une micro-entreprise de services, sans ACRE ni versement libératoire. Pourboires en plus, à 100 % pour vous (soumis aux cotisations). Le temps de trajet n'est pas compté.")}</p>
    <p class="petit muet" style="margin:4px 0 0">${tr("Commission")} ${pct(REGLES.COMMISSION_GRATUIT_PB / 100)} ${tr("en Gratuite")}, ${pct(REGLES.COMMISSION_PRO_PB / 100)} ${tr("en Pro (abonnement de")} ${euros(REGLES.ABONNEMENT_CLEANEUR_C)} ${tr("par mois, non déduit ici)")} · ${tr("frais Stripe des cartes européennes standard :")} ${pct(REGLES.FRAIS_STRIPE_PCT)} + ${euros(REGLES.FRAIS_STRIPE_FIXE_C)}.</p>
  </div>`;
}

/** « Les règles, en clair » : liberté, paiement, fiabilité, accès impossible, assurance (valeurs de REGLES, conformes au contrat). */
export function reglesEnClair() {
  const regles = [
    ["valide", "Libre", "Vous acceptez les missions que vous voulez. Aucun minimum, aucune exclusivité, aucune sanction si vous refusez."],
    ["calendrier", "Payé chaque vendredi", `${tr("Pour les missions validées par le client jusqu'au mercredi minuit (validation automatique")} ${REGLES.VALIDATION_AUTO_H} ${tr("h après la fin sans réclamation).")}`],
    ["horloge", "Fiabilité", `${tr("Annulation gratuite plus de 24 h avant. À moins de 24 h :")} ${euros(REGLES.PENALITE_24H_C)}. ${tr("À moins de 2 h ou absence :")} ${euros(REGLES.PENALITE_2H_C)} ${tr("ou")} ${REGLES.PENALITE_2H_PCT} % ${tr("du prix. Aucune pénalité en cas de force majeure justifiée sous 72 h.")}`],
    ["cle", "Client absent ou accès impossible", `${tr("Après")} ${REGLES.ATTENTE_ACCES_IMPOSSIBLE_MIN} ${tr("min d'attente, vous repartez avec")} ${REGLES.INDEMNITE_PCT} % ${tr("du prix")} (${euros(REGLES.INDEMNITE_MIN_C)} ${tr("à")} ${euros(REGLES.INDEMNITE_MAX_C)}).`],
    ["garantie", "Votre assurance", "Une RC Pro à votre nom, qui couvre vos activités, est obligatoire. Cleaneroo vous fournit les preuves photo de chaque mission en cas de sinistre."],
  ];
  return `<h2 class="titre-section">${icone("document", { tuile: true })}${tr("Les règles, en clair")}</h2>
    <div class="regles-clair">${regles.map(([ic, t, x]) => `<div class="carte regle-clair">${icone(ic, { tuile: true })}<div><b>${tr(t)}</b><p class="petit" style="margin:4px 0 0">${tr(x)}</p></div></div>`).join("")}</div>
    <p class="petit"><a href="#/conditions-cleaneurs">${tr("Lire le contrat de prestataire")} ›</a></p>`;
}

/** Étapes pour devenir Cleaneur. Formations : seule la loi bloque une mission (qualifie / formations_exigees en base : Certibiocide « nuisibles »
 *  et « désinfection ») ; les modules Cleaneroo sont conseillés, jamais imposés (décision du 16/11/2026, base-formations-loi.sql). */
export function etapesCleaneur() {
  const etapes = [
    `${tr("Avoir un statut d'indépendant (pas encore auto-entrepreneur ? Création gratuite en ligne sur")} <a href="https://www.autoentrepreneur.urssaf.fr" target="_blank" rel="noopener">autoentrepreneur.urssaf.fr</a>, ${tr("environ 15 minutes)")}`,
    tr("Préparer vos documents (pièce d'identité, SIRET, RC Pro, attestation de vigilance URSSAF)"),
    tr("Déposer votre dossier (zone, prestations ; chaque document vérifié avant activation)"),
    tr("Signer le contrat de prestataire (les modules de formation sont conseillés, gratuits et facultatifs)"),
    `${tr("Réussir la mission test (rémunérée")} ${euros(REGLES.MISSION_TEST_C)}, ${tr("payée par Cleaneroo)")}`,
    tr("Choisir vos missions (prix et horaires proposés, libre d'accepter)"),
    tr("Être payé chaque vendredi (validation du client, commission prélevée, versement)"),
  ];
  return `<h2 class="titre-section">${icone("valide", { tuile: true })}${tr("Les étapes")}</h2>
    ${etapes.map((t, i) => `<div class="carte etape-cleaneur"><b>${i + 1}.</b> <span>${t}</span></div>`).join("")}
    <p class="petit" style="margin:4px 0 14px">${tr("Seules les prestations qui exigent un certificat imposé par la loi (Certibiocide pour les nuisibles et la désinfection) ne vous sont proposées qu'avec ce certificat.")}</p>
    <div class="note bon-a-savoir"><b>${tr("Bon à savoir")}</b> ${tr("Vous ne faites que du ménage chez des particuliers ? Déclarez-vous aussi « services à la personne » (gratuit, en ligne sur la plateforme NOVA) : vos clients pourront bénéficier du crédit d'impôt, ce qui rend vos missions plus attractives. Attention, cette déclaration impose de n'exercer que des services à la personne (pas de bureaux ni de véhicules).")}</div>`;
}

/** Zone et date de lancement (REGLES.LANCEMENT_ZONE et LANCEMENT_DATE, remplies par Vincent). */
export function blocLancementCleaneur() {
  const z = REGLES.LANCEMENT_ZONE, d = REGLES.LANCEMENT_DATE;
  return `<p class="note lancement-cleaneur"><span>${z
    ? `${tr("Premières missions :")} <b>${esc(z)}</b>${d ? `, ${tr("à partir du")} ${esc(d)}` : ""}. ${tr("Ailleurs ? Inscrivez-vous : nous vous prévenons dès que votre secteur ouvre.")}`
    : tr("Inscrivez-vous : nous vous prévenons dès que des missions arrivent dans votre secteur.")}</span></p>`;
}

/** Fin de page : un seul parcours, celui de la création du compte Cleaneur. */
export function pretACommencer() {
  return `<div class="carte pret-commencer"><div><b>${tr("Prêt à commencer ?")}</b>
    <p class="petit" style="margin:4px 0 0">${tr("Pré-inscription en quelques minutes ; vous envoyez ensuite vos documents depuis votre dossier.")}</p></div>
    <div class="boutons"><a class="bouton" href="#/compte/cleaneur/independant">${tr("Créer mon compte Cleaneur")}</a>
      <a class="bouton secondaire" href="#/compte">${tr("J'ai déjà un compte")}</a></div></div>`;
}

/** « Partager à un Cleaneur » : partage du téléphone, ou lien copié sur ordinateur. */
export const boutonPartagerCleaneur = () =>
  `<button type="button" class="bouton secondaire partager-cleaneur" data-partager-cleaneur>${icone("partager")} ${tr("Partager à un Cleaneur")}</button><span class="petit" data-partage-ok aria-live="polite"></span>`;
document.addEventListener("click", async e => {
  if (e.target.closest("[data-defiler-gain]")) return document.getElementById("exemple-gain")?.scrollIntoView({ behavior: "smooth", block: "start" });
  const b = e.target.closest("[data-partager-cleaneur]");
  if (!b) return;
  const texte = tr("Missions de ménage près de chez vous, en auto-entrepreneur. Libre d'accepter, sans minimum ni exclusivité.");
  const ok = b.parentElement?.querySelector("[data-partage-ok]");
  if (navigator.share && matchMedia("(pointer: coarse)").matches) { try { await navigator.share({ title: tr("Devenir Cleaneur"), text: texte, url: LIEN_CLEANEUR }); return; } catch { /* annulé */ } }
  try { await navigator.clipboard.writeText(LIEN_CLEANEUR); if (ok) ok.textContent = tr("Lien copié :") + " " + LIEN_CLEANEUR; }
  catch { if (ok) ok.textContent = LIEN_CLEANEUR; }
});

/** #/conditions-cleaneurs : le contrat de prestataire, lisible sans compte, sans zone de signature. */
export function pageConditionsCleaneurs() {
  return `<section class="bloc"><div class="etroit">
    <h1>${tr("Contrat de prestataire")}</h1><div class="trait-corail"></div>
    <p class="muet">${tr("Contrat de prestataire Cleaneroo")} · ${tr("version")} ${CONTRAT_VERSION}</p>
    <p class="note">${tr("Lecture seule. Vous signerez le contrat plus tard, depuis votre dossier, après votre pré-inscription.")}</p>
    ${CONTRAT.map(([t, x], i) => `<h3 style="margin:22px 0 6px">${i + 1}. ${esc(tr(t))}</h3><p style="margin:0">${esc(texteContrat(x))}</p>`).join("")}
    <div style="margin-top:26px">${pretACommencer()}</div>
  </div></section>`;
}

export function brancherDevenirCleaneur(vue) { traduire(vue); }
