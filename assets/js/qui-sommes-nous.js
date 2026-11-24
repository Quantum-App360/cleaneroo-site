// Page « Qui sommes-nous ? » (#/qui-sommes-nous) : prompt 2, partie 8, réécrite le 24/11/2026 selon le prompt de Michael.
// Projet anonyme : aucune identité personnelle (nom, photo, parcours, autre entreprise). L'histoire passe par la vision,
// les valeurs et la mission. Chaque phrase décrit ce que le site fait vraiment aujourd'hui (l'avenir est dit comme une intention).
import { REGLES } from "./regles.js";
import { icone } from "./icones.js";
import { blocReassurance, boutonRappel, esc } from "./commun.js";

const EMAIL = "contact@cleaneroo.fr";

/** Textes de la page (traduits par langue.js). */
export const QUI_SOMMES_NOUS = {
  titre: "Le ménage, d'égal à égal",
  accroche: "Cleaneroo rapproche les clients et les Cleaneurs, et place la qualité de la prestation au cœur de la relation.",
  constat: [
    "Trouver quelqu'un de fiable pour faire le ménage ressemble souvent à un pari : on cherche longtemps, on compare mal, et on espère tomber sur la bonne personne.",
    "De l'autre côté, beaucoup de Cleaneurs indépendants et de petites équipes font un excellent travail sans parvenir à se faire connaître. Face aux grandes enseignes et à leurs budgets publicitaires, ils restent souvent invisibles.",
  ],
  pourquoi: [
    "Cleaneroo est un projet construit entre amis, à partir d'une idée simple : ces deux besoins se répondent. Le client cherche quelqu'un de fiable ; le Cleaneur cherche des clients qui reconnaissent la qualité de son travail.",
    "Notre rôle est de les rapprocher, sur un pied d'égalité, avec des règles claires et les mêmes pour tous.",
  ],
  cotes: [
    ["cleaneurs", "Pour les clients", "Décrivez votre besoin, voyez le prix tout de suite, puis choisissez votre Cleaneur en comparant ses avis, sa distance et son tarif. Vous suivez l'intervention et recevez un compte rendu photo."],
    ["bouclier-coche", "Pour les Cleaneurs", "Une inscription gratuite, des missions près de chez vous et aucune publicité à acheter pour être vu : ce sont vos avis et la qualité de votre travail qui parlent pour vous."],
    ["valide", "Pour tous", "Des prix affichés à l'avance, un paiement sécurisé, des preuves photo et des avis vérifiés : la confiance repose sur des faits, pas sur des promesses."],
  ],
  technologie: "Cleaneroo s'appuie sur l'intelligence artificielle et sur des outils automatiques comme des assistants, jamais comme des remplaçants. Le ménage reste un métier fait par des personnes, pour des personnes. Concrètement :",
  aides: [
    "l'IA vérifie les photos avant / après pour s'assurer que chaque pièce est bien faite ;",
    "nos outils prennent en charge une partie de la gestion : planning, rappels, factures et documents ;",
    "un assistant guide chacun dans ses démarches et répond aux questions les plus fréquentes ;",
    "et, au fil du temps, l'IA nous aidera à mieux rapprocher chaque client du Cleaneur qui lui correspond.",
  ],
  technologieFin: "Moins de démarches, plus de temps pour l'essentiel : un travail bien fait et une relation de confiance.",
  conclusion: "Nous voulons que la qualité du travail compte davantage que la taille du budget publicitaire. Un endroit simple, où chaque client trouve la bonne personne et où chaque Cleaneur, seul ou en petite équipe, peut trouver sa place.",
};

/** Encadré « Société » : affiché seulement si la raison sociale, l'adresse et le SIRET sont renseignés (REGLES.SOCIETE). */
export function encadreSociete(s = REGLES.SOCIETE || {}) {
  if (!s.nom || !s.adresse || !s.siret) return "";
  return `<div class="carte qsn-societe"><h3>Société</h3><p>${esc(s.nom)}<br>${esc(s.adresse)}<br>SIRET ${esc(s.siret)}</p></div>`;
}

export function pageQuiSommesNous() {
  const t = QUI_SOMMES_NOUS;
  return `<section class="fond-cleaneroo qsn-tete"><div class="conteneur">
      <span class="surtitre-qsn">Qui sommes-nous ?</span>
      <h1>${t.titre}</h1><div class="trait-corail"></div>
      <p class="qsn-accroche">${t.accroche}</p></div></section>
    <section class="bloc"><div class="etroit qsn">
      <h2>Notre constat</h2>${t.constat.map(p => `<p>${p}</p>`).join("")}
      <h2>Pourquoi Cleaneroo existe</h2>${t.pourquoi.map(p => `<p>${p}</p>`).join("")}
    </div></section>
    <section class="bloc bloc-doux"><div class="conteneur">
      <div class="titre-section"><h2>Une plateforme pensée pour les deux côtés</h2></div>
      <div class="grille-3 qsn-cotes">${t.cotes.map(([ic, titre, texte]) => `<div class="carte">${icone(ic, { tuile: true })}<h3>${titre}</h3><p class="muet">${texte}</p></div>`).join("")}</div>
    </div></section>
    <section class="bloc"><div class="etroit qsn">
      <h2>La technologie au service de l'humain</h2><p>${t.technologie}</p>
      <ul class="qsn-aides">${t.aides.map(a => `<li>${icone("valide")}<span>${a}</span></li>`).join("")}</ul>
      <p>${t.technologieFin}</p>
      <blockquote class="qsn-conclusion">${t.conclusion}</blockquote>
    </div></section>
    <section class="bloc bloc-doux"><div class="conteneur">
      <div class="titre-section"><h2>Nos engagements</h2></div>${blocReassurance()}
    </div></section>
    <section class="bloc"><div class="etroit qsn">
      <h2>Une question ?</h2>
      <div class="qsn-contact">${boutonRappel()}<a class="bouton secondaire" href="mailto:${EMAIL}">${EMAIL}</a></div>
      <p class="petit"><a href="#/mentions-legales">Mentions légales</a></p>
      ${encadreSociete()}
    </div></section>`;
}
