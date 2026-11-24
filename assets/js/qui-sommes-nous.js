// Page « Qui sommes-nous ? » (#/qui-sommes-nous), prompt 2, partie 8 (24/11/2026).
// Les passages entre crochets du prompt doivent être validés par Vincent avant d'être publiés : tant que A_VALIDER.valide
// vaut false, la page affiche une version neutre, sans ces passages (aucune durée, aucun nom, aucune zone, aucune date).
// Pour publier : vérifier chaque champ ci-dessous, ajouter la photo (assets/img/fondateur.jpg) puis passer valide à true.
import { REGLES } from "./regles.js";
import { icone } from "./icones.js";
import { blocReassurance, boutonRappel, esc } from "./commun.js";

export const A_VALIDER = {
  valide: false,
  experience: "plus de six ans",
  fondateur: "Vincent Rhode",
  parcours: "Dirigeant de SCOFITEC, entreprise de télécommunications et d'énergie en région PACA et en Corse.",
  photo: "",                                   // ex. "/assets/img/fondateur.jpg"
  zones: "dans le Var et les Alpes-Maritimes",
};

const EMAIL = "contact@cleaneroo.fr";

/** Encadré « Société » : affiché seulement si la raison sociale, l'adresse et le SIRET sont renseignés (REGLES.SOCIETE). */
export function encadreSociete(s = REGLES.SOCIETE || {}) {
  if (!s.nom || !s.adresse || !s.siret) return "";
  return `<div class="carte qsn-societe"><h3>Société</h3><p>${esc(s.nom)}<br>${esc(s.adresse)}<br>SIRET ${esc(s.siret)}</p></div>`;
}

/** Textes de la page, version validée ou version neutre. */
export function textesQuiSommesNous(v = A_VALIDER) {
  return {
    histoire: v.valide
      ? `Cleaneroo est née dans le Sud-Est, de ${v.experience} d'expérience dans la gestion d'équipes d'intervention sur le terrain. Nous savons ce qu'un client attend : quelqu'un de fiable, à l'heure, et la preuve que le travail est fait. Nous avons construit Cleaneroo pour l'offrir au ménage.`
      : "Cleaneroo est née dans le Sud-Est, de l'expérience de la gestion d'équipes d'intervention sur le terrain. Nous savons ce qu'un client attend : quelqu'un de fiable, à l'heure, et la preuve que le travail est fait. Nous avons construit Cleaneroo pour l'offrir au ménage.",
    zones: v.valide
      ? `Lancement ${v.zones}, puis dans toute la France au fil des inscriptions des Cleaneurs.`
      : "Lancement dès l'ouverture des réservations, puis dans toute la France au fil des inscriptions des Cleaneurs.",
    fondateur: v.valide && v.fondateur ? { nom: v.fondateur, parcours: v.parcours, photo: v.photo } : null,
  };
}

export function pageQuiSommesNous() {
  const t = textesQuiSommesNous();
  return `<section class="fond-cleaneroo" style="padding:40px 0 70px"><div class="conteneur">
      <h1>Qui sommes-nous ?</h1><div class="trait-corail"></div>
      <p class="qsn-titre">Cleaneroo, une entreprise de terrain avant d'être une application</p></div></section>
    <section class="bloc"><div class="etroit qsn">
      <h2>Notre histoire</h2><p>${t.histoire}</p>
      ${t.fondateur ? `<h2>Le fondateur</h2><div class="carte qsn-fondateur">
        ${t.fondateur.photo ? `<img src="${esc(t.fondateur.photo)}" alt="${esc(t.fondateur.nom)}" width="120" height="120">` : icone("cleaneurs", { tuile: true })}
        <p><b>${esc(t.fondateur.nom)}, fondateur.</b> ${esc(t.fondateur.parcours)}</p></div>` : ""}
    </div></section>
    <section class="bloc bloc-doux"><div class="conteneur">
      <div class="titre-section"><h2>Nos engagements</h2></div>${blocReassurance()}
    </div></section>
    <section class="bloc"><div class="etroit qsn">
      <h2>Où nous intervenons</h2><p>${t.zones}</p>
      <h2>Nous contacter</h2>
      <div class="qsn-contact">${boutonRappel()}<a class="bouton secondaire" href="mailto:${EMAIL}">${EMAIL}</a></div>
      <p class="petit"><a href="#/mentions-legales">Mentions légales</a></p>
      ${encadreSociete()}
    </div></section>`;
}
