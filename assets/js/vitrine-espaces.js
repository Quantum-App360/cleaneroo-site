// Présentation de chaque espace (rubriques du haut : Particulier, Entreprise, Conciergerie, Hôtels et campings, Cleaneur).
// Un clic sur une rubrique ouvre SA page : ce qu'on y fait, puis « Créer mon espace » ou « Se connecter ».
// Même contenu dans l'application (VitrineEspace dans EspacesCompte.kt).
import { icone } from "./icones.js";

export const VITRINES = {
  particulier: { nom: "Espace Particulier", accroche: "Le ménage de votre logement, réservé en deux minutes et suivi en direct.", ico: "logement", points: [
    ["instantane", "Réservation en deux minutes", "Ménage, vitres, canapés et textiles : le prix s'affiche tout de suite."],
    ["position", "Suivi en direct", "Cleaneur en route, arrivée confirmée, compte rendu photo de chaque pièce."],
    ["paiement", "Paiement après validation", "Vous n'êtes débité qu'une fois le travail validé."],
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
  cleaneur: { nom: "Espace Cleaneur", accroche: "Trouvez des missions près de chez vous, en auto-entrepreneur.", ico: "cleaneurs", points: [
    ["position", "Missions près de chez vous", "Choisissez votre secteur, vos prestations et vos disponibilités."],
    ["valide", "Déroulé guidé", "Tâches et photos guidées, signature et compte rendu."],
    ["paiement", "Paiement après validation", "Versé après validation du client, pourboires compris."],
    ["avis", "Votre activité", "Chiffre d'affaires, cotisations URSSAF et factures calculés pour vous."],
    ["garantie", "Formations conseillées", "Guides et vidéos pour progresser : seules les formations exigées par la loi sont obligatoires."]] },
};

/** Bloc de présentation d'un espace : surtitre, accroche et fonctionnalités. */
export function vitrineEspace(id) {
  const v = VITRINES[id];
  if (!v) return "";
  return `<div class="vitrine-espace">
    <span class="surtitre">${v.nom}</span>
    <h1 class="titre-vitrine">${v.accroche}</h1>
    <div class="vitrine-points">${v.points.map(([ico, t, d]) => `<div class="carte vitrine-point">${icone(ico, { tuile: true })}
      <div><b>${t}</b><p class="petit">${d}</p></div></div>`).join("")}</div>
  </div>`;
}
