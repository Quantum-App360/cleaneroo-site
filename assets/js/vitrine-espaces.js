// Présentation de chaque espace (rubriques du haut : Particulier, Entreprise, Conciergerie, Hôtels et campings, Cleaneur).
// Un clic sur une rubrique ouvre SA page : ce qu'on y fait, puis « Créer mon espace » ou « Se connecter ».
// Même contenu dans l'application (VitrineEspace dans EspacesCompte.kt).
import { icone } from "./icones.js";
import { guideVideo } from "./guide-video.js";
import { offreConciergerieOuverte } from "./regles.js";
import { texteOffreConciergerie, texteBonusOffreConciergerie } from "./abonnement-pro.js";

export const VITRINES = {
  particulier: { nom: "Espace Particulier", accroche: "Le ménage de votre logement, réservé en deux minutes et suivi en direct.", ico: "logement", points: [
    ["instantane", "Réservation en deux minutes", "Ménage, vitres, canapés et textiles : le prix s'affiche tout de suite."],
    ["position", "Suivi en direct", "Cleaneur en route, arrivée confirmée, compte rendu photo de chaque pièce."],
    ["paiement", "Paiement 100 % sécurisé", "Paiement sécurisé à la réservation, versé au Cleaneur après votre validation."],
    ["calendrier", "Agenda et Cleaneur favori", "Programmez vos ménages et retrouvez le Cleaneur de votre choix."],
    ["garantie", "Factures et attestations", "Crédit d'impôt selon éligibilité, attestation fiscale envoyée chaque mois."]] },
  entreprise: { nom: "Espace Entreprise", accroche: "Bureaux, commerces et locaux : le ménage réservé en deux minutes, facturé à votre société.", ico: "bureaux", points: [
    ["bureaux", "Tous vos locaux", "Bureaux, cabinets, commerces, entrepôts et parties communes."],
    ["calendrier", "Passages réguliers ou ponctuels", "Un planning clair et des Cleaneurs vérifiés."],
    ["photo", "Compte rendu photo", "Chaque intervention est prouvée, pièce par pièce."],
    ["paiement", "Factures au nom de la société", "Factures et relevés téléchargeables à tout moment."]] },
  pro: { nom: "Espace Conciergerie", accroche: "Planning de vos biens relié à Airbnb et Booking, ménages entre deux voyageurs.", ico: "location", points: [
    ["calendrier", "Agenda iCal", "Vos calendriers Airbnb et Booking créent les ménages à programmer."],
    ["valide", "Planning de la semaine", "Tous vos biens et tous les passages au même endroit."],
    ["cle", "Biens et accès", "Photo de la boîte à clés, guide d'accès, linge et consommables."],
    ["photo", "Rapports pour vos propriétaires", "Compte rendu photo, incidents et stock suivis."],
    ["cleaneurs", "Équipe", "Invitez vos collaborateurs et vos propriétaires."]] },
  hotellerie: { nom: "Espace Hôtels et campings", accroche: "Rotations des mobil-homes, chalets et chambres : prix, temps et Cleaneurs nécessaires calculés tout de suite.", ico: "location", points: [
    ["instantane", "Calculateur de rotation", "Nombre de logements : prix, temps de travail et Cleaneurs nécessaires."],
    ["calendrier", "Agenda iCal et planning", "Vos réservations créent les rotations à programmer."],
    ["cleaneurs", "Renforts pour vos pics d'activité", "Des Cleaneurs vérifiés, dans la limite légale chez un même établissement."],
    ["photo", "Compte rendu photo", "Chaque logement est contrôlé, pièce par pièce."]] },
  cleaneur: { nom: "Espace Cleaneur", accroche: "Trouvez des missions près de chez vous, en auto-entrepreneur.", ico: "cleaneurs", video: "cleaneur",
    documents: "Pièce d'identité, SIRET, assurance RC Pro et attestation URSSAF : vous les envoyez après la pré-inscription, depuis « Mon dossier ».", points: [
    ["position", "Missions près de chez vous", "Choisissez votre secteur, vos prestations et vos disponibilités."],
    ["valide", "Déroulé guidé", "Tâches et photos guidées, signature et compte rendu."],
    ["paiement", "Paiement après validation", "Versé après validation du client, pourboires compris."],
    ["avis", "Votre activité", "Chiffre d'affaires, cotisations URSSAF et factures calculés pour vous."],
    ["garantie", "Formations conseillées", "Guides et vidéos pour progresser : seules les formations exigées par la loi sont obligatoires."]] },
  // Société de nettoyage (23/11/2026, retour de Vincent) : sa propre page, jamais la présentation de l'auto-entrepreneur.
  societe: { nom: "Espace Société de nettoyage", accroche: "Référencez votre société de nettoyage : des missions près de chez vous pour vos équipes.", ico: "bureaux", video: "cleaneur",
    documents: "Kbis ou SIRET, assurance RC Pro et attestation URSSAF de la société : vous les envoyez après la pré-inscription, depuis « Mon dossier ».", points: [
    ["cleaneurs", "Vos équipes sur les missions", "Vous attribuez chaque mission à un salarié : photo de vérification du jour, trajet et compte rendu depuis son téléphone."],
    ["calendrier", "Planning de vos salariés", "Toutes les missions de la société et leurs intervenants au même endroit."],
    ["paiement", "Paiement garanti", "Versé à la société après validation du client, chaque semaine."],
    ["avis", "Factures au nom de la société", "Factures, relevés et chiffre d'affaires calculés pour vous."],
    ["garantie", "Formations de vos salariés", "Vous formez vos salariés ; les prestations réglementées ne vont qu'aux salariés qui ont l'attestation exigée."]] },
};
// Vidéo de démonstration de chaque rubrique (23/11/2026) : réserver un ménage pour les espaces clients, devenir Cleaneur sinon.
for (const id of ["particulier", "entreprise", "pro", "hotellerie"]) VITRINES[id].video = "client";

/** Bloc de présentation d'un espace : surtitre, accroche et fonctionnalités. */
export function vitrineEspace(id) {
  const v = VITRINES[id];
  if (!v) return "";
  return `<div class="vitrine-espace">
    <span class="surtitre">${v.nom}</span>
    <h1 class="titre-vitrine">${v.accroche}</h1>
    <div class="vitrine-points">${v.points.map(([ico, t, d]) => `<div class="carte vitrine-point">${icone(ico, { tuile: true })}
      <div><b>${t}</b><p class="petit">${d}</p></div></div>`).join("")}</div>
    ${id === "pro" && offreConciergerieOuverte() ? `<div class="offre-pro offre-fondatrice"><span class="badge-formule">Offre Conciergerie fondatrice</span>
      <b>${texteOffreConciergerie()}</b><span class="petit">${texteBonusOffreConciergerie()}</span></div>` : ""}
    ${v.documents ? `<p class="petit vitrine-documents">${icone("document")} <b>Documents à prévoir</b> : ${v.documents}</p>` : ""}
    ${v.video ? `<div class="vitrine-video">${guideVideo(v.video, `vitrine-${id}`)}</div>` : ""}
  </div>`;
}
