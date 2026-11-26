// Parcours de réservation en 5 étapes : copie de Reservation.kt (application Android).
// 1 prestation · 2 questionnaire · 3 photos · 4 adresse, accès et créneau · 5 estimation, coordonnées et envoi.
import { PARTIES, partie, partiePour, PARTIE_DE_L_ESPACE, rubriquesProposees, lieuxDuSecteur, inclusLocation, SEJOURS_LOCATION, categorieBien, categorieDeRubrique, categoriesDeRubrique, bienCompatible, typesDeCategorie, CATEGORIES_BIEN, TARIFS_SPECIAUX, RUBRIQUES, rubrique, formulesPour, TYPES_LIEU, TYPES_LOGEMENT, BESOINS_SPECIAUX, ACCUEIL, accueilAutonomeInterdit, photosObligatoires,
  ELEMENTS_TEXTILES, TAILLES_CANAPE, prixLigne, minutesLigne, libelleLigne, pastille,
  FREQUENCES, JOURS_SEMAINE, DERNIERS_NETTOYAGES, packsPour, remisePack,
  TACHES_A_TRAITER, TYPES_CHANTIER, photosPlusTardPossibles, equipementsPour, DELAIS_URGENCE, TYPES_IMMEUBLE, surfaceEffective, SELECTION_CONSEILLEE_VEHICULE, LIEUX_VEHICULE, FREQUENCES_VEHICULE, RUBRIQUES_LOGEMENT, vuesPhotos, vuesCompletes, PIECES_LOCATION, ETAPES_LOCATION, PACK_ETAPES_CONSEILLE, ETAPES_DEPART, prixEtapeLocationC, repetitionsEtape, CONSOMMABLES_LOCATION, PACK_CONSOMMABLES_CONSEILLE, PRIX_FORMULES, FORMULE_STANDARD_VEHICULE } from "./catalogue.js";
import { calculer, entreeEstimation, SALISSURE, disponibilite, meilleurPack, tachesChiffrees, formuleDe, niveauLocation, passagesPlanifies, datesPassages,
  etapesDe, etapesChoisiesDe, etapesIncluses, consommablesDe, menageTientEntreVoyageurs, frequenceDe, minutesEquipements, prixIndicatifEquipement, heuresEvenement, litsDe, litsTailles, prixDrapsC, prixLingeC, heuresProposees, fenetreArriveeH,
  tachesPourOccasion, niveauOccasion } from "./estimation.js";
import { REGLES, euros, duree, heure, dateCourte, dateLongue, reservationsFermees, MESSAGE_LANCEMENT, photosAvantObligatoires, delaiFavoriH, palierPass } from "./regles.js";
import { envoyerDemande, secteurCouvert, rejoindreAttente, enregistrerBien, synchroniserBiens, marquerDonneesInvite } from "./donnees.js";
import { etapesPhotoDe, etapesPersoDe } from "./etapes-bien.js";
import { maPosition, adresseDe, chercherAdresse, afficherCarte } from "./cartes.js";
import { traduire, langue, tr } from "./langue.js";
import { profilMemorise } from "./entete.js";
import { icone } from "./icones.js";
import { blocReassurance, encartAideRappel, encartPaiementSecurise, mentionCodePostal, ligneZone } from "./commun.js";
import { monParrainage } from "./parrainage.js";
import { lancerPaiement } from "./paiement.js";
import { session, monProfil, majProfil, supabase } from "./donnees.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const CLE_BROUILLON = "cleaneroo-brouillon";

/* ------------------------------------------------------------------ Mémoire : la 2e commande en quelques secondes (comme l'app : AppData.modeles et logements)
   Gardé sur l'appareil du client uniquement : coordonnées, adresses enregistrées, dernière commande par prestation.
   Jamais le code d'accès ni le créneau. « Oublier mes informations » dans Mes prestations efface tout. */
const CLE_PROFIL = "cleaneroo-profil", CLE_LOGEMENTS = "cleaneroo-logements", CLE_MODELES = "cleaneroo-modeles";
const lire = (cle, defaut) => { try { return JSON.parse(localStorage.getItem(cle) || "null") ?? defaut; } catch { return defaut; } };
const ecrire = (cle, v) => { marquerDonneesInvite(); try { localStorage.setItem(cle, JSON.stringify(v)); } catch { /* rien */ } };
export const profil = () => lire(CLE_PROFIL, null);
export const logements = () => lire(CLE_LOGEMENTS, []);
/** Dernières commandes, la plus récente d'abord : [{ rubriqueId, quand, logementId, ... }]. */
export const modeles = () => Object.values(lire(CLE_MODELES, {})).sort((a, b) => b.quand - a.quand);
export function oublierMesInformations() { [CLE_PROFIL, CLE_LOGEMENTS, CLE_MODELES, CLE_BROUILLON, "cleaneroo-brouillons"].forEach(k => { try { localStorage.removeItem(k); } catch { /* rien */ } }); }
const CHAMPS_LOGEMENT = ["rue", "codePostal", "ville", "accueil", "tiersNom", "tiersTel", "boiteEmplacement"];
const PRIVES = ["prenom", "nom", "email", "telephone", "code", "jour", "heure", "cgv", "etape", "sansPhotos", "flexible", ...CHAMPS_LOGEMENT];
/** Libellé court d'une adresse enregistrée : « Appartement · Fréjus ». */
export const nomLogement = l => {
  const cat = categorieBien(l);
  const type = cat === "logement" ? (TYPES_LOGEMENT.find(t => t.id === l.typeLogementId) || {}).nom : (typesDeCategorie(cat).find(t => t.id === (cat === "local" ? l.typeLocal : l.typeLieuId)) || {}).nom;
  return l.nom ? `${l.nom} · ${l.ville}` : `${type || "Adresse"} · ${l.ville}`;
};
/** Icône d'un bien selon sa catégorie. */
export const iconeBien = l => (CATEGORIES_BIEN.find(c => c[0] === categorieBien(l)) || CATEGORIES_BIEN[0])[2];
const ADRESSES = ["logement", "local"];
/** Biens enregistrés utilisables pour cette prestation (même catégorie). */
const biensPour = rubriqueId => logements().filter(l => bienCompatible(rubriqueId, l));

function memoriserCommande(b) {
  ecrire(CLE_PROFIL, { prenom: b.prenom.trim(), nom: b.nom.trim(), email: b.email.trim(), telephone: b.telephone.trim() });
  const liste = logements();
  const meme = l => l.rue.trim().toLowerCase() === b.rue.trim().toLowerCase() && l.codePostal === b.codePostal;
  // Bien de la catégorie de la prestation (16 novembre 2026) : un bateau ou un véhicule n'est jamais fusionné avec un logement de même adresse.
  const choisi = liste.find(l => l.id === b.logementId && bienCompatible(b.rubriqueId, l));
  const cat = choisi ? categorieBien(choisi) : categorieDeRubrique(b.rubriqueId, b.espace);
  const ancien = choisi || (ADRESSES.includes(cat) ? liste.find(l => categorieBien(l) === cat && meme(l)) : null);
  const description = cat === "local" ? { categorie: "local" } : cat === "logement" ? { typeLogementId: b.typeLogementId, surface: b.surface, chambres: b.chambres, sdb: b.sdb, niveaux: b.niveaux }
    : { categorie: cat, typeLieuId: b.typeLieuId, ...(cat === "vehicule" ? { immatriculation: String(b.vehImmat || "").trim().toUpperCase(), modele: String(b.vehModele || "").trim() } : { surface: b.surface }),
        ...(cat === "bateau" ? { port: String(b.port || "").trim(), place: String(b.place || "").trim(), accesPonton: String(b.accesPonton || "").trim() } : {}) };
  const log = { ...(ancien || {}), id: ancien?.id || "l" + Date.now(), ...description,
    ...Object.fromEntries(CHAMPS_LOGEMENT.map(k => [k, String(b[k] ?? "").trim()])),
    ...(Number.isFinite(b.lat) ? { lat: b.lat, lon: b.lon } : {}) };
  // Location saisonnière : les étapes à valider en photo sont gardées avec le logement (et dans le compte).
  if (b.rubriqueId === "rental" && b.memoriserEtapes !== false) {
    log.etapesPhoto = { etapes: etapesChoisiesDe(b), perso: b.etapesPerso || [] };
    if (b.logementId === log.id || ancien) enregistrerBien(log).catch(() => null);
  }
  ecrire(CLE_LOGEMENTS, [log, ...liste.filter(l => l.id !== log.id && !(ADRESSES.includes(cat) && categorieBien(l) === cat && meme(l)))].slice(0, REGLES.BIENS_MAX));
  const modele = Object.fromEntries(Object.entries(b).filter(([k]) => !PRIVES.includes(k)));
  // « Mémoriser ces étapes pour ce logement » décoché : les étapes ne sont pas reprises la prochaine fois.
  if (b.rubriqueId === "rental" && b.memoriserEtapes === false) { delete modele.etapesChoisies; delete modele.etapesPerso; delete modele.consommablesChoisis; }
  ecrire(CLE_MODELES, { ...lire(CLE_MODELES, {}), [b.rubriqueId]: { ...modele, logementId: log.id, quand: Date.now() } });
}

/** Applique une adresse enregistrée au brouillon (adresse et accès ; le code est redemandé). */
function avecLogement(br, l) {
  // Un bien d'une autre catégorie n'est jamais repris (un appartement dans une réservation de bateau, par exemple).
  if (!l || !bienCompatible(br.rubriqueId, l)) return br;
  const cat = categorieBien(l);
  if (cat === "local") return { ...br, ...Object.fromEntries(CHAMPS_LOGEMENT.map(k => [k, l[k] || ""])), logementId: l.id, code: "", guide: Array.isArray(l.guide) ? l.guide : [],
    lat: Number.isFinite(l.lat) ? l.lat : null, lon: Number.isFinite(l.lon) ? l.lon : null };
  if (cat !== "logement") {
    const types = typesDeCategorie(cat).map(t => t.id);
    return { ...br, ...Object.fromEntries(CHAMPS_LOGEMENT.map(k => [k, l[k] || ""])), logementId: l.id, code: "", guide: [], modifierLogement: false,
      ...(types.includes(l.typeLieuId) ? { typeLieuId: l.typeLieuId } : {}), ...(Number(l.surface) > 0 && cat !== "vehicule" ? { surface: Number(l.surface) } : {}),
      ...(cat === "bateau" ? { port: l.port || "", place: l.place || "", accesPonton: l.accesPonton || "" } : {}),
      ...(cat === "vehicule" ? { vehImmat: l.immatriculation || br.vehImmat || "", vehModele: br.vehModele || l.modele || "" } : {}),
      lat: Number.isFinite(l.lat) ? l.lat : null, lon: Number.isFinite(l.lon) ? l.lon : null };
  }
  // Description du logement reprise (ménage, location, déménagement) quand elle est connue : elle n'est plus redemandée.
  const dims = ["home", "rental", "moving"].includes(br.rubriqueId) && Number(l.surface) > 0
    ? { typeLogementId: l.typeLogementId || "appartement", surface: l.surface, chambres: l.chambres ?? 0, sdb: l.sdb || 1, niveaux: l.niveaux || 1, modifierLogement: false } : {};
  // Étapes à valider en photo fixées pour ce bien (espace Pro) : reprises en location saisonnière.
  const etapes = br.rubriqueId === "rental" && l.etapesPhoto ? { etapesChoisies: etapesPhotoDe(l), etapesPerso: etapesPersoDe(l) } : {};
  return { ...br, ...dims, ...etapes, ...Object.fromEntries(CHAMPS_LOGEMENT.map(k => [k, l[k] || ""])), logementId: l.id, code: "", guide: Array.isArray(l.guide) ? l.guide : [],
    lat: Number.isFinite(l.lat) ? l.lat : null, lon: Number.isFinite(l.lon) ? l.lon : null };
}

/* ------------------------------------------------------------------ Pré-remplissage depuis le calculateur ou une page ville
   La page écrit { rubriqueId, champs } (calculateur) ou { lieu: { codePostal, ville } } (page ville), puis ouvre la réservation. */
const CLE_PREREMPLI = "cleaneroo-prerempli";
let lieuEnAttente = null;   // ville choisie sur une page ville : appliquée dès que la prestation est choisie
function lirePrerempli() { const p = lire(CLE_PREREMPLI, null); try { localStorage.removeItem(CLE_PREREMPLI); } catch { /* rien */ } return p; }
export function preremplir(donnees) { ecrire(CLE_PREREMPLI, donnees); }

/** Brouillon d'exemple (pages ville, calculateur) : mêmes valeurs par défaut qu'une vraie réservation, donc mêmes prix. */
export function brouillonExemple(rubriqueId, champs = {}) {
  const r = rubrique(rubriqueId);
  return { ...vierge(rubriqueId, "personnel", r, TYPES_LIEU[rubriqueId]), ...champs };
}

function nouveauBrouillon(rubriqueId, espace = "personnel", rapide = false) {
  const br = brouillonInitial(rubriqueId, partiePour(rubriqueId, espace), rapide);
  return lieuEnAttente && !br.rue ? { ...br, ...lieuEnAttente } : br;
}

/** Fenêtre « Réserver une prestation » : réservation de cette prestation pour cette partie (brouillon en cours gardé s'il correspond). */
export function reserverPrestation(rubriqueId, espace = "personnel") {
  const ancien = charger(), pour = partiePour(rubriqueId, espace);
  if (!(ancien && ancien.rubriqueId === rubriqueId && ancien.espace === pour && ancien.etape >= 2)) {
    try { localStorage.setItem(CLE_BROUILLON, JSON.stringify({ ...nouveauBrouillon(rubriqueId, pour), etape: 2 })); } catch { /* rien */ }
  }
  location.hash = `#/reserver/${rubriqueId}`;
}

/** « Réserver avec ce Cleaneur » (carnet de favoris) : le favori est repris dans la réservation jusqu'à son envoi. */
const CLE_FAVORI_VOULU = "cleaneroo-favori-voulu";
export function reserverAvecFavori(cleaneurId) {
  try { localStorage.setItem(CLE_FAVORI_VOULU, JSON.stringify(cleaneurId)); localStorage.removeItem(CLE_BROUILLON); } catch { /* rien */ }
  if (location.hash === "#/reserver") dispatchEvent(new HashChangeEvent("hashchange")); else location.hash = "#/reserver";
}
/** « Réserver avec ce Cleaneur » depuis sa fiche (lot 5) : prestation et lieu repris, demande proposée d'abord à lui. */
export function reserverAvecCleaneur(rubriqueId, cleaneur, champs = {}) {
  const choisi = { cleaneur_id: cleaneur.cleaneur_id, prenom: cleaneur.prenom, initiale: cleaneur.initiale || "", note: cleaneur.note ?? null, nb_avis: cleaneur.nb_avis || 0, fiche: true };
  preremplir({ rubriqueId, champs: { ...champs, choixCleaneur: "favori", cleaneurFavori: choisi.cleaneur_id, cleaneurChoisi: choisi } });
  if (location.hash === `#/reserver/${rubriqueId}`) dispatchEvent(new HashChangeEvent("hashchange")); else location.hash = `#/reserver/${rubriqueId}`;
}
const avecFavoriVoulu = br => { const id = lire(CLE_FAVORI_VOULU, null); return id ? { ...br, choixCleaneur: "favori", cleaneurFavori: id } : br; };

function brouillonInitial(rubriqueId, espace = "personnel", rapide = false) {
  return avecFavoriVoulu(brouillonInitialSansFavori(rubriqueId, espace, rapide));
}
function brouillonInitialSansFavori(rubriqueId, espace = "personnel", rapide = false) {
  const r = rubrique(rubriqueId);
  const lieux = lieuxDuSecteur(rubriqueId, TYPES_LIEU[rubriqueId], profilMemorise()?.secteur);
  const p = profil() || {};
  const m = lire(CLE_MODELES, {})[rubriqueId];
  const log = biensPour(rubriqueId).find(l => l.id === m?.logementId) || biensPour(rubriqueId)[0];
  // Déjà commandé : tout est repris ; « rapide » ouvre directement l'adresse et le créneau.
  if (m) return avecLogement({ ...vierge(rubriqueId, espace, r, lieux), ...m, prenom: p.prenom || "", nom: p.nom || "", email: p.email || "", telephone: p.telephone || "",
    etape: rapide && log ? 4 : 2, jour: "", heure: -1, cgv: false }, log);
  return avecLogement({ ...vierge(rubriqueId, espace, r, lieux), prenom: p.prenom || "", nom: p.nom || "", email: p.email || "", telephone: p.telephone || "" }, log);
}

/** Surface proposée au départ, selon la prestation (comme nouveauBrouillon dans l'appli). */
const SURFACE_DEPART = { office: 120, commerce: 120, communal: 200, kitchen: 30, outdoor: 40, event: 100, construction: 80, leisure: 7, boat: 10 };
function vierge(rubriqueId, espace, r, lieux) {
  return {
    photosAvantExigees: photosAvantObligatoires(rubriqueId),
    rubriqueId, espace, etape: 2, typeLogementId: "appartement", surface: SURFACE_DEPART[rubriqueId] ?? 62, chambres: 2, sdb: 1, niveaux: 1, fenetres: 8,
    formuleId: formulesPour(r)[0]?.id || "", typeLieuId: lieux ? lieux[0].id : "", salissure: "NORMAL",
    // Véhicules : formule Standard présélectionnée (prompt 2, partie 7).
    taches: rubriqueId === "car" ? [...(r?.packs?.find(p => p.id === "confort")?.tacheIds || [])] : [], tachesPerso: [], animaux: false, etapesLocation: 8, consommables: true, remarque: "",
    accueil: "", tiersNom: "", tiersTel: "", boiteEmplacement: "", code: "",
    rue: "", codePostal: "", ville: "", jour: "", heure: -1, flexible: false, engagementMois: 0,
    choixCleaneur: "candidatures", prenom: "", nom: "", email: "", telephone: "", cgv: false, logementId: "",
    panier: [], elementTextile: "", tailleCanape: "t15", quantitePanier: 1, surfaceMoquette: 10,
    frequence: "semaine", moment: "", memeCleaneur: true, passages: REGLES.PASSAGES_DEFAUT, jours: [],
    occasion: "", dernierNettoyage: "", natures: [],
    etapesChoisies: ETAPES_DEPART(), etapesPerso: [], consommablesChoisis: [...PACK_CONSOMMABLES_CONSEILLE],
    departVoyageursH: REGLES.DEPART_VOYAGEURS_DEFAUT_H, arriveeSuivanteH: REGLES.ARRIVEE_SUIVANTE_DEFAUT_H, aChaqueDepart: false, memoriserEtapes: true,
  };
}

/** Prix libre des conciergeries (23/11/2026, montage B) : pour un ménage de location réservé depuis l'espace Conciergerie
 *  (ou Hôtels et campings) sur un logement dont le prix est fixé, ce prix remplace la grille. Le prix de la grille reste affiché
 *  comme « prix conseillé » ; sous 80 % de celui-ci, seuls les Cleaneurs invités par la conciergerie voient le ménage. */
export const ESPACES_PRIX_LIBRE = ["conciergerie", "hotellerie"];
export const PLANCHER_PRIX_LIBRE = 0.8;
function prixLibreDe(br) {
  if (!br || br.rubriqueId !== "rental" || !ESPACES_PRIX_LIBRE.includes(br.espace) || !br.logementId) return 0;
  const l = logements().find(x => x.id === br.logementId);
  const prix = Math.round(Number(l?.prixMenageC) || 0);
  return prix >= 1000 ? prix : 0;
}
/** Estimation d'une réservation : la grille, ou le prix fixé par la conciergerie pour ce logement. */
function estimer(br, debut) {
  const est = calculer(entreeEstimation(br, br.espace === "personnel", debut));
  const prix = prixLibreDe(br);
  if (!prix || est.devisObligatoire) return est;
  const frais = Math.round(prix * (est.fraisServicePct || 0) / 100);
  const remise = Math.min(est.remiseParrainageC || 0, prix), cagnotte = Math.max(0, Math.min(est.cagnotteC || 0, prix - remise));
  const aPayer = prix + frais - remise - cagnotte;
  return { ...est, prixLibre: true, prixConseilleC: est.totalC, totalC: prix,
    lignes: [{ libelle: tr("Ménage de location · prix fixé pour ce logement"), montantC: prix }],
    creditImpotC: 0, fraisServiceC: frais, remiseParrainageC: remise, cagnotteC: cagnotte, totalAPayerC: aPayer, apresCreditImpotC: aPayer };
}
/** Cleaneroo AI (26/11/2026) : brouillon de réservation construit comme celui du parcours (mêmes valeurs de départ),
 *  complété par les choix de la fiche ; et son estimation par le MÊME calcul que l'écran de réservation (sans date choisie). */
export function brouillonPour(rubriqueId, champs = {}, espace = "personnel") {
  return { ...nouveauBrouillon(rubriqueId, espace), ...champs, etape: 2 };
}
export const estimerBrouillon = br => estimer(br, null);
/** Montant affiché « Total à payer », comme le récapitulatif de la réservation. */
export const totalAffiche = est => est.devisObligatoire ? null : (est.fraisServicePct || est.remiseParrainageC || est.cagnotteC ? est.totalAPayerC : est.totalC);

/** Prix conseillé Cleaneroo (grille) d'un ménage de location pour ce logement, en centimes. */
export function prixConseilleBien(l) {
  const br = avecLogement(vierge("rental", "conciergerie", rubrique("rental"), TYPES_LIEU.rental), l);
  return calculer(entreeEstimation(br, false, null)).totalC;
}
/** Prix fixé sous le plancher : message pour la conciergerie, sinon "". */
export const messagePlancher = (prixC, conseilC) => conseilC && prixC < conseilC * PLANCHER_PRIX_LIBRE
  ? tr("Sous 80 % du prix conseillé : seuls les Cleaneurs que vous avez invités verront ce ménage.") : "";

let b = null;            // brouillon en cours
let photosFournies = []; // photos transmises par Cleaneroo AI, reprises à l'ouverture de la réservation
/** Cleaneroo AI : photos du client (Blob JPEG) jointes à la prochaine réservation ouverte. */
export function fournirPhotos(blobs) { photosFournies = blobs.map((x, i) => new File([x], `photo-${i + 1}.jpg`, { type: "image/jpeg" })); }
let photos = [];         // fichiers choisis (non sauvegardés dans le brouillon)
let vuesPrises = {};     // étape 3 : vue → fichier (une photo par vue)
let photoBoite = null;   // photo de la boîte à clés (accueil « Boîte à clés »), non sauvegardée dans le brouillon
let messageGeoloc = "";  // « Me géolocaliser » : recherche en cours ou erreur
let adresseCherchee = ""; // dernière adresse saisie placée sur la carte
let racine = null;
let envoi = false;

/** Logement choisi à l'étape 1 : identifiant, "" pour un nouveau logement. Par défaut : celui du brouillon, sinon le premier enregistré. */
/** Bien choisi depuis « Mes biens » (« Réserver ») : seules ses prestations sont proposées à l'étape 1 ; sinon aucun (toutes les prestations). */
function logementDepart() {
  return b && b.logementDepart ? b.logementDepart : "";
}
/** Compte connecté (hors administrateur) : la partie suit l'espace ouvert (Particulier, Conciergerie, Entreprise), la question « Pour qui ? » disparaît. */
function partieImposee() {
  const p = profilMemorise();
  if (!p || p.role === "admin") return null;
  const e = PARTIE_DE_L_ESPACE[p.espace] ? p.espace : (p.statuts || []).find(s => PARTIE_DE_L_ESPACE[s]);
  return e ? PARTIE_DE_L_ESPACE[e] : null;
}
const partieCourante = () => partieImposee() || b?.espace || "personnel";

/** Applique le logement de l'étape 1 au brouillon (ou vide l'adresse pour un nouveau logement). */
function avecLogementDepart(br, id) {
  const l = id ? logements().find(x => x.id === id) : null;
  if (l && bienCompatible(br.rubriqueId, l)) return { ...avecLogement(br, l), logementDepart: id };
  return { ...br, logementDepart: "", logementId: "", rue: "", codePostal: "", ville: "", accueil: "", tiersNom: "", tiersTel: "", boiteEmplacement: "", code: "", lat: null, lon: null };
}

/** « Réserver ici » (Mon suivi, Mes biens) : la réservation s'ouvre avec ce logement déjà choisi. */
export function reserverPourLogement(id) {
  ecrire(CLE_BROUILLON, { etape: 1, espace: "personnel", logementDepart: id });
  if (location.hash === "#/reserver") dispatchEvent(new HashChangeEvent("hashchange")); else location.hash = "#/reserver";
}

function sauver() { try { localStorage.setItem(sim ? CLE_SIMULATION : CLE_BROUILLON, JSON.stringify(b)); } catch { /* rien */ } if (!sim) garderBrouillon(b); }
/* Simulateur « Estimer mon prix » (12 novembre 2026) : toutes les prestations dans un menu, les questions qui font le prix,
   le prix détaillé mis à jour à chaque choix. Sans compte ni connexion : tout est calculé dans le navigateur.
   « Réserver avec ces choix » reprend la simulation à l'étape 2 de la réservation. Même écran dans l'appli (Simulateur.kt). */
let sim = false;
const CLE_SIMULATION = "cleaneroo-simulation";
export function ouvrirSimulateur(conteneur, rubriqueId) {
  racine = conteneur; sim = true;
  const ancien = lire(CLE_SIMULATION, null);
  const id = rubrique(rubriqueId) ? rubriqueId : ancien?.rubriqueId && rubrique(ancien.rubriqueId) ? ancien.rubriqueId : "home";
  b = ancien && ancien.rubriqueId === id ? ancien : nouveauBrouillon(id, ancien?.espace || "personnel");
  b = { ...b, etape: 2, espace: partiePour(id, b.espace), abonnePro: !!profilMemorise()?.abonnePro };
  photos = []; vuesPrises = {}; photoBoite = null;
  rendre();
}
function rendreSimulation() {
  const p = partie(b.espace), r = rubrique(b.rubriqueId);
  const est = calculer(entreeEstimation(b, b.espace === "personnel", null));
  const lignes = est.devisObligatoire ? "" : est.lignes.filter(l => !ligneZone(l)).map(l => { const inclus = l.montantC === 0 && l.note === "inclus";
    return `<div class="ligne-montant"><span>${esc(l.libelle)}${l.note && !inclus ? `<span class="note-ligne">${l.note}</span>` : ""}</span><span>${inclus ? "Inclus" : euros(l.montantC)}</span></div>`; }).join("");
  const prix = est.devisObligatoire
    ? `<h3 style="color:var(--primaire);margin:0">Sur devis</h3><p class="muet" style="margin:4px 0 0">Un professionnel qualifié évalue votre besoin et vous propose un devis. Aucun engagement.</p>`
    : `${lignes}<div class="ligne-montant total"><span>Prix de la prestation</span><span>${euros(est.totalC)}</span></div>
       ${est.fraisServicePct ? `<div class="ligne-montant"><span>${tr("Frais de service Cleaneroo")} (${est.fraisServicePct} %)</span><span>${euros(est.fraisServiceC)}</span></div>
         <div class="ligne-montant total"><span>${tr("Total à payer")}</span><span>${euros(est.totalAPayerC)}</span></div>` : ""}
       ${est.creditImpotC ? `<div class="ligne-montant" style="color:var(--succes);font-weight:700"><span>soit ${euros(est.apresCreditImpotC)} après crédit d'impôt, si éligible</span></div>` : ""}`;
  racine.innerHTML = `<section class="bloc" style="padding-top:28px"><div class="etroit simulateur">
    <h1>Estimer mon prix</h1>
    <p class="muet">Choisissez une prestation et vos options : le prix se met à jour à chaque choix. Sans inscription et sans engagement.</p>
    ${titre("Pour qui ?")}
    <div class="segments trois">${PARTIES.map(x => `<button type="button" data-espace="${x.id}" class="${p.id === x.id ? "choisi" : ""}">${x.nom}</button>`).join("")}</div>
    <p class="petit" style="margin:6px 0 0">${p.detail}</p>
    ${titre("Prestation")}
    <label class="champ choix-prestation">${icone(r.icone, { tuile: true })}<select id="sim-rubrique" aria-label="Prestation">
      ${p.rubriques.map(id => `<option value="${id}" ${id === b.rubriqueId ? "selected" : ""}>${esc(rubrique(id).nom)} · ${esc(rubrique(id).sousTitre)}</option>`).join("")}</select></label>
    ${questionnaire(false)}
    ${titre("Code postal (facultatif)")}
    <div class="carte">${champTexte("Le prix peut varier selon la ville", "codePostal", b.codePostal || "", "text", 'inputmode="numeric" maxlength="5" placeholder="Ex. : 83600"')}
      ${/^[0-9]{5}$/.test(b.codePostal || "") ? `<p class="petit" style="margin:0">${mentionCodePostal(b.codePostal)}</p>` : ""}</div>
    <div class="carte resultat-simulation" id="resultat-simulation" style="margin-top:22px">
      <p class="surtitre">Votre prix estimé</p>
      <p class="prix-simulation">${est.devisObligatoire ? "Sur devis" : euros(est.fraisServicePct ? est.totalAPayerC : est.totalC)}</p>
      <p class="muet" style="margin:0 0 12px">${icone(r.icone)} ${esc(r.nom)}${est.dureeMin ? ` · ${duree(est.dureeMin)}` : ""}${est.nombreCleaneurs === 2 ? " · 2 Cleaneurs" : ""}</p>
      ${prix}
      <p class="petit">Prix maximum : le montant final ne peut pas le dépasser sans votre accord. Le jour et l'heure choisis ensuite peuvent encore le baisser (créneau malin −${REGLES.CRENEAU_MALIN_PCT} %).</p>
      ${reservationsFermees() ? `<p class="petit"><b>Les réservations ouvrent très bientôt.</b> ${MESSAGE_LANCEMENT}</p>` : ""}
    </div>
    <div class="barre-actions"><div class="barre-prix">
      <a class="prix-barre" href="#resultat-simulation" data-voir-prix><span>Votre prix estimé</span><b>${est.devisObligatoire ? "Sur devis" : euros(est.fraisServicePct ? est.totalAPayerC : est.totalC)}</b><span class="lien">Voir le détail</span></a>
      <button type="button" class="bouton plein" id="sim-reserver">Réserver avec ces choix</button></div></div>
  </div></section>`;
  traduire(racine);
}
function charger() { try { return JSON.parse(localStorage.getItem(CLE_BROUILLON) || "null"); } catch { return null; } }

/* Demandes en cours (26/11/2026, retour de Michael) : une réservation commencée par prestation est gardée sur l'appareil.
   « Réserver » ouvre toujours le choix de la prestation ; les demandes commencées y sont proposées (Reprendre, Supprimer). */
const CLE_BROUILLONS = "cleaneroo-brouillons";
const brouillons = () => lire(CLE_BROUILLONS, {});
function garderBrouillon(br) {
  if (!br?.rubriqueId || !rubrique(br.rubriqueId) || !(br.etape >= 2)) return;
  try { localStorage.setItem(CLE_BROUILLONS, JSON.stringify({ ...brouillons(), [br.rubriqueId]: { ...br, majLe: Date.now() } })); } catch { /* rien */ }
}
function oublierBrouillon(rubriqueId) {
  const l = brouillons(); delete l[rubriqueId];
  try { localStorage.setItem(CLE_BROUILLONS, JSON.stringify(l)); if (charger()?.rubriqueId === rubriqueId) localStorage.removeItem(CLE_BROUILLON); } catch { /* rien */ }
}
/** Demandes commencées, la plus récente d'abord, avec leur total (même calcul que l'écran de réservation). */
function demandesEnCours() {
  return Object.values(brouillons()).filter(x => rubrique(x.rubriqueId)).sort((a, z) => (z.majLe || 0) - (a.majLe || 0)).map(x => {
    let total = null;
    try { const est = estimer(x, null); total = est.devisObligatoire ? null : (est.fraisServicePct || est.remiseParrainageC || est.cagnotteC ? est.totalAPayerC : est.totalC); } catch { /* brouillon ancien */ }
    return { br: x, total };
  });
}

export function ouvrirReservation(conteneur, rubriqueId, option = "") {
  racine = conteneur; sim = false;
  const ancien = charger();
  garderBrouillon(ancien);   // demande commencée avant le 26/11/2026 : elle rejoint « Vos demandes en cours »
  const rapide = option === "rapide";
  const garde = ancien && ancien.rubriqueId === rubriqueId ? ancien : brouillons()[rubriqueId];
  if (rubriqueId && rubrique(rubriqueId)) b = !rapide && garde ? garde : nouveauBrouillon(rubriqueId, ancien?.espace, rapide);
  // « Réserver » sans prestation : toujours le choix de la prestation (la demande commencée est proposée, pas imposée).
  else b = ancien && ancien.etape === 1 && ancien.logementDepart ? { espace: ancien.espace || "personnel", etape: 1, logementDepart: ancien.logementDepart }
    : ancien ? { espace: ancien.espace || "personnel", etape: 1 } : null;
  if (b?.rubriqueId) b = { ...b, espace: partiePour(b.rubriqueId, partieImposee() || b.espace) };
  // Conciergerie abonnée : 0 % de frais de service (profil mémorisé par l'en-tête).
  if (b) b = { ...b, abonnePro: !!profilMemorise()?.abonnePro };
  chargerParrainage();
  // Code postal saisi sur l'accueil (« Voir mon prix »).
  const cp = option.match(/^cp-(\d{5})$/)?.[1];
  if (b && cp && !b.rue) b = { ...b, codePostal: cp };
  // Calculateur : étape 2 préremplie. Page ville : étape 1, la ville sera reprise à l'adresse.
  const pr = lirePrerempli();
  if (pr?.lieu) { lieuEnAttente = pr.lieu; if (!rubriqueId) b = null; else if (b && !b.rue) b = { ...b, ...pr.lieu }; }
  // Espace Pro : « Programmer le ménage » après un départ (bien et jour repris).
  if (pr?.bienId && rubrique(rubriqueId)) {
    const l = logements().find(x => x.id === pr.bienId);
    b = { ...avecLogement(nouveauBrouillon(rubriqueId, "conciergerie"), l), jour: pr.jour || "", heure: -1, etape: 2,
      // Horaires du séjour (24/11/2026) : départ tardif et arrivée anticipée réglés séjour par séjour.
      ...(Number.isFinite(pr.departH) ? { departVoyageursH: pr.departH } : {}), ...(Number.isFinite(pr.arriveeH) ? { arriveeSuivanteH: pr.arriveeH } : {}) };
  }
  if (pr?.champs && pr.rubriqueId === rubriqueId && rubrique(rubriqueId)) {
    b = { ...nouveauBrouillon(rubriqueId, ancien?.espace || "personnel"), ...pr.champs, etape: Math.min(4, Math.max(2, pr.etape || 2)) };
    // Besoin décrit depuis « Mes biens » : l'adresse et l'accès de ce bien sont repris (s'il convient à la prestation proposée).
    const l = pr.champs.bienIa ? logements().find(x => x.id === pr.champs.bienIa) : null;
    if (l && bienCompatible(rubriqueId, l)) b = avecLogement(b, l);
    delete b.bienIa;
  }
  photos = photosFournies.splice(0);
  vuesPrises = {};
  photoBoite = null;
  // Historique : une entrée par étape, pour que la touche retour du téléphone revienne à l'étape précédente.
  const n = b ? b.etape : 1;
  history.replaceState({ ...(history.state || {}), cleanerooEtape: 1 }, "");
  for (let i = 2; i <= n; i++) history.pushState({ cleanerooEtape: i }, "");
  rendre();
  // Compte connecté : les biens du compte (autre appareil, « Mes biens ») sont proposés eux aussi.
  const avant = logements().length;
  session().then(s => s ? synchroniserBiens() : null).then(l => { if (l && l.length !== avant && racine === conteneur && b && !sim) rendre(); }).catch(() => null);
}

/** Nouvelle étape vers l'avant : une entrée d'historique de plus. */
function noterEtape() { history.pushState({ cleanerooEtape: b ? b.etape : 1 }, ""); }

/** « ‹ Retour » à l'écran : comme la touche retour du téléphone. */
function retour() {
  if (history.state?.cleanerooEtape > 1) return history.back();
  if (b && b.etape > 2) return maj({ etape: b.etape - 1 }, true);
  b = { ...(b || {}), espace: b?.espace || "personnel", etape: 1 }; sauver(); rendre(); window.scrollTo(0, 0);
}

window.addEventListener("popstate", e => {
  const n = e.state?.cleanerooEtape;
  if (!n || !racine || !document.body.contains(racine) || !location.hash.startsWith("#/reserver")) return;
  // Étape 1 : la prestation est gardée, on la retrouve telle quelle si on la choisit de nouveau.
  b = n === 1 ? { ...(b || {}), espace: b?.espace || "personnel", etape: 1 } : { ...b, etape: n };
  sauver(); rendre(); window.scrollTo(0, 0);
});

function maj(changes, defiler = false) {
  b = { ...b, ...changes };
  sauver();
  rendre();
  if (defiler) window.scrollTo({ top: 0, behavior: "smooth" });
}

/* ------------------------------------------------------------------ Composants (même rendu que l'app) */
const titre = t => `<h3 style="margin:26px 0 10px">${t}</h3>`;
const choix = (liste, actuel, champ) => `<div class="choix">${liste.map(([id, lib]) =>
  `<button type="button" data-champ="${champ}" data-valeur="${esc(id)}" class="${String(actuel) === String(id) ? "choisi" : ""}">${esc(lib)}</button>`).join("")}</div>`;
const compteur = (lib, champ, val, { min = 0, max = 999, pas = 1, unite = "" } = {}) => `
  <div class="compteur"><span>${lib}</span><span class="regle">
    <button type="button" data-moins="${champ}" data-min="${min}" data-pas="${pas}" aria-label="Moins" ${val <= min ? "disabled" : ""}>−</button>
    <output>${val}${unite}</output>
    <button type="button" data-plus="${champ}" data-max="${max}" data-pas="${pas}" aria-label="Plus" ${val >= max ? "disabled" : ""}>+</button></span></div>`;
const caseCocher = (lib, champ, val, info = "") => `<label class="case"><input type="checkbox" data-case="${champ}" ${val ? "checked" : ""}><span>${lib}${info ? `<span class="petit" style="display:block">${info}</span>` : ""}</span></label>`;
/** Badge à cocher (20 novembre 2026, linge de la location) : un mot court au lieu d'une longue phrase ; le détail en info-bulle. */
const badgeCase = (emoji, lib, champ, val, info = "") => `<label class="badge-case" title="${esc(tr(info))}"><input type="checkbox" data-case="${champ}" ${val ? "checked" : ""}><span>${emoji} ${tr(lib)}</span></label>`;
const champTexte = (lib, champ, val, type = "text", extra = "") => `<label class="champ">${lib}<input type="${type}" data-texte="${champ}" value="${esc(val)}" ${extra}></label>`;

/* ------------------------------------------------------------------ Étapes */
function etape1() {
  // Logement choisi en premier (13 novembre 2026) : adresse, description et étapes photo sont reprises dans toute la réservation.
  // Compte connecté (16 novembre 2026) : la partie suit l'espace ouvert, sans question ; un logement enregistré ne propose que les prestations qui le concernent.
  const depart = logementDepart();
  const pid = partieCourante(), p = partie(pid), imposee = !!partieImposee(), entreprise = p.id === "professionnel";
  // Prestation d'abord (16 novembre 2026) : les biens s'affichent à l'étape 2, seulement ceux de la prestation choisie.
  // Venu de « Réserver » sur un bien (Mes biens, Mon suivi) : ce bien est rappelé et seules ses prestations sont proposées.
  const bienChoisi = depart ? logements().find(l => l.id === depart) : null;
  const logEnr = !!bienChoisi;
  const choixLogement = bienChoisi ? `<p class="logement-choisi">${icone(iconeBien(bienChoisi))} <b>${esc(nomLogement(bienChoisi))}</b>
      <button type="button" class="lien-bouton" data-logement-depart="">${tr("Autre chose à nettoyer")}</button></p>` : "";
  const proposees = rubriquesProposees(pid, bienChoisi, profilMemorise()?.secteur);   // Entreprise : selon son secteur d'activité
  const pourQui = imposee
    ? `<p class="pour-qui-fixe">${icone({ personnel: "logement", conciergerie: "location", professionnel: "bureaux" }[p.id], { tuile: true })}<span><b>${p.nom}</b><span class="petit">${p.detail}</span></span></p>`
    : `<div class="centre-bloc">${bienChoisi ? titre("Pour qui ?") : `<h3 class="titre-centre">${tr("Pour qui ?")}</h3>`}
    <div class="segments trois">${PARTIES.map(x => `<button type="button" data-espace="${x.id}" class="${p.id === x.id ? "choisi" : ""}">${x.nom}</button>`).join("")}</div>
    <p class="petit" style="margin:6px 0 0">${p.detail}</p></div>`;
  const derniers = modeles().filter(m => proposees.includes(m.rubriqueId) && rubrique(m.rubriqueId));
  // Centre de réservation (26/11/2026, retour de Michael) : l'assistant, les demandes en cours, « À refaire », vos biens, puis tout le catalogue.
  const centre = !bienChoisi;
  const enCours = centre ? demandesEnCours().filter(x => proposees.includes(x.br.rubriqueId)) : [];
  return `<h1>Que souhaitez-vous nettoyer ?</h1><p class="muet">Décrivez votre besoin à notre assistant, reprenez une demande, ou choisissez directement une prestation : le prix s'affiche dès que vous décrivez votre besoin.</p>
    ${choixLogement}
    ${pourQui}
    ${centre ? blocAssistantCentre() : ""}
    ${enCours.length || (centre && derniers.length) ? `<div class="centre-colonnes">${enCours.length ? blocEnCours(enCours) : ""}${centre && derniers.length ? blocRefaire(derniers) : ""}</div>` : ""}
    ${!centre && derniers.length ? blocRefaire(derniers) : ""}
    ${centre ? blocMesBiensCentre(pid) : ""}
    ${centre ? `<div class="centre-bloc">${titreCentre("Toutes nos prestations")}${catalogueCentre(proposees, centre)}</div>`
      : `${titre("Votre prestation")}${logEnr ? `<p class="petit" style="margin:-4px 0 12px">${tr(categorieBien(bienChoisi) === "logement" ? "Prestations adaptées à ce logement." : "Prestations adaptées à ce bien.")}</p>` : ""}${catalogueCentre(proposees, centre)}`}`;
}

/** « Reprendre » : la demande commencée s'ouvre à l'étape où elle avait été laissée. */
function reprendreBrouillon(rubriqueId) {
  const br = brouillons()[rubriqueId];
  if (!br) return rendre();
  try { localStorage.setItem(CLE_BROUILLON, JSON.stringify(br)); } catch { /* rien */ }
  const cible = `#/reserver/${rubriqueId}`;
  if (location.hash === cible) ouvrirReservation(racine, rubriqueId); else location.hash = cible;
}
/** Le besoin écrit (et les photos) sur la page part à l'assistant : la fenêtre s'ouvre avec l'analyse lancée. */
async function analyserCentre() {
  const err = racine.querySelector("[data-erreur-centre]");
  const texte = (racine.querySelector("[data-texte-centre]")?.value || "").trim();
  if (texte.length < 3) { if (err) err.textContent = tr("Décrivez votre besoin en quelques mots."); return; }
  if (photosCentre.length && !accordCentre) { if (err) err.textContent = tr("Cochez l'accord pour l'analyse des photos, ou retirez-les."); return; }
  const m = await import("./assistant-ia.js");
  m.ouvrirAssistantIA(texte, { nouveau: true, envoyer: true, photos: photosCentre.slice(), consentement: accordCentre });
  texteCentre = ""; photosCentre = []; accordCentre = false;
  rendre();
}
async function ajouterPhotosCentre(fichiers) {
  const images = [...fichiers].filter(f => /^image\//.test(f.type)).slice(0, PHOTOS_CENTRE - photosCentre.length);
  if (!images.length) return;
  photosCentre.push(...images); rendre();
}
function brancherCentre() {
  const z = racine.querySelector("[data-texte-centre]");
  z?.addEventListener("input", () => { texteCentre = z.value; });
  z?.addEventListener("keydown", e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); analyserCentre(); } });
  racine.querySelector("[data-photos-centre]")?.addEventListener("change", e => ajouterPhotosCentre(e.target.files));
  racine.querySelector("[data-accord-centre]")?.addEventListener("change", e => { accordCentre = e.target.checked; });
  racine.querySelectorAll("[data-photo-centre]").forEach(img => { const f = photosCentre[+img.dataset.photoCentre]; if (f) img.src = URL.createObjectURL(f); });
  // Ordinateur : les photos se glissent directement dans la zone.
  const depot = racine.querySelector("[data-depot-ia]");
  if (depot) {
    ["dragenter", "dragover"].forEach(t => depot.addEventListener(t, e => { e.preventDefault(); depot.classList.add("survol"); }));
    ["dragleave", "drop"].forEach(t => depot.addEventListener(t, () => depot.classList.remove("survol")));
    depot.addEventListener("drop", e => { e.preventDefault(); ajouterPhotosCentre(e.dataTransfer?.files || []); });
  }
  // Recherche dans le catalogue : filtre les cartes sans redessiner la page.
  const champ = racine.querySelector("[data-recherche-prestation]");
  champ?.addEventListener("input", () => {
    const mots = sansAccents(champ.value).split(/\s+/).filter(Boolean);
    let visibles = 0;
    racine.querySelectorAll("[data-famille]").forEach(f => {
      let n = 0;
      f.querySelectorAll("[data-mots]").forEach(c => { const ok = mots.every(m => c.dataset.mots.includes(m)); c.hidden = !ok; if (ok) n++; });
      f.hidden = !n; visibles += n;
    });
    racine.querySelector("[data-aucune-prestation]").hidden = visibles > 0;
  });
}

/* ------------------------------------------------------------------ Centre de réservation (étape 1) */
let texteCentre = "", photosCentre = [], accordCentre = false;
/** Titre d'une partie du centre (sans numéro : ce ne sont pas des étapes à suivre dans l'ordre). */
const titreCentre = t => `<h3 class="titre-centre">${t}</h3>`;
const PHOTOS_CENTRE = 4;
/** Cleaneroo AI en tête : le besoin se décrit directement sur la page (texte et photos), l'assistant s'ouvre avec l'analyse lancée. */
function blocAssistantCentre() {
  let reprise = false;
  try { reprise = (JSON.parse(localStorage.getItem("cleaneroo-assistant-ia") || "null")?.conversation || []).length > 0; } catch { /* rien */ }
  return `<div class="centre-ia carte">
    <div class="centre-ia-tete"><span class="tuile-ia">${icone("instantane")}</span><div><b>${tr("Décrivez votre besoin, notre assistant prépare votre réservation")}</b>
      <span class="petit muet">${tr("Avec vos mots, même sans connaître le nom de la prestation. Avec des photos, l'analyse est plus précise. Les prix restent ceux de Cleaneroo.")}</span></div>
      ${reprise ? `<button type="button" class="lien-bouton" data-reprendre-ia>${tr("Reprendre ma proposition en cours")}</button>` : ""}</div>
    <div class="centre-ia-saisie" data-depot-ia>
      <textarea data-texte-centre rows="3" maxlength="2000" placeholder="${esc(tr("Ex. : mon canapé d'angle en tissu a des taches de café et des poils de chat…"))}" aria-label="${esc(tr("Décrivez votre besoin"))}">${esc(texteCentre)}</textarea>
      ${photosCentre.length ? `<div class="vignettes-ia">${photosCentre.map((f, i) => `<span class="vignette-ia"><img data-photo-centre="${i}" alt=""><button type="button" data-retirer-centre="${i}" aria-label="${esc(tr("Retirer la photo"))}">×</button></span>`).join("")}</div>
        <label class="consentement-ia"><input type="checkbox" data-accord-centre ${accordCentre ? "checked" : ""}> <span class="petit">${tr("J'accepte que mes photos soient analysées par l'assistant pour préparer ma proposition. Elles ne sont conservées qu'avec ma réservation.")}</span></label>` : ""}
      <div class="centre-ia-actions">
        <label class="bouton secondaire petit${photosCentre.length >= PHOTOS_CENTRE ? " desactive" : ""}">${icone("photo")} ${tr("Ajouter des photos")}<input type="file" accept="image/*" multiple hidden data-photos-centre ${photosCentre.length >= PHOTOS_CENTRE ? "disabled" : ""}></label>
        <span class="petit muet depot-indication">${tr("ou glissez-les ici")}</span>
        <button type="button" class="bouton" data-analyser-centre>${icone("instantane")} ${tr("Analyser mon besoin")}</button>
      </div>
      <p class="erreur" data-erreur-centre></p>
    </div>
    <div class="exemples-ia">${["Mon canapé en tissu a plusieurs taches", "Les sièges de ma voiture sont très sales", "Je viens de récupérer une maison à nettoyer entièrement", "Je souhaite faire nettoyer un matelas"].map(x => `<button type="button" class="puce-exemple" data-exemple-centre="${esc(tr(x))}">${tr(x)}</button>`).join("")}</div>
  </div>`;
}
/** « il y a 3 heures », dans la langue du site. */
const depuisQuand = t => {
  if (!t) return "";
  const min = Math.max(1, Math.round((Date.now() - t) / 60000));
  const rtf = new Intl.RelativeTimeFormat(langue || "fr", { numeric: "auto" });
  return min < 60 ? rtf.format(-min, "minute") : min < 1440 ? rtf.format(-Math.round(min / 60), "hour") : rtf.format(-Math.round(min / 1440), "day");
};
function blocEnCours(liste) {
  return `<div class="centre-bloc">${titreCentre("Vos demandes en cours")}<div class="liste-en-cours">${liste.slice(0, 4).map(({ br, total }) => {
    const r = rubrique(br.rubriqueId), l = br.logementId ? logements().find(x => x.id === br.logementId) : null;
    return `<div class="carte en-cours">${icone(r.icone, { tuile: true })}<div class="en-cours-texte"><b>${tr(r.nom)}</b>
      <span class="petit muet">${tr("Étape")} ${br.etape} ${tr("sur 5")}${l ? ` · ${esc(nomLogement(l))}` : br.ville ? ` · ${esc(br.ville)}` : ""} · ${depuisQuand(br.majLe)}</span>
      ${total != null ? `<span class="en-cours-total">${euros(total)}</span>` : `<span class="petit">${tr("Sur devis")}</span>`}</div>
      <div class="en-cours-actions"><button type="button" class="bouton petit" data-reprendre="${br.rubriqueId}">${tr("Reprendre")}</button>
        <button type="button" class="lien-bouton" data-supprimer-brouillon="${br.rubriqueId}">${tr("Supprimer")}</button></div></div>`;
  }).join("")}</div></div>`;
}
function blocRefaire(derniers) {
  return `<div class="centre-bloc">${titreCentre("À refaire")}<div class="liste-refaire">${derniers.slice(0, 4).map(m => {
    const r = rubrique(m.rubriqueId), l = logements().find(x => x.id === m.logementId);
    return `<a class="carte prestation rapide" href="#/reserver/${m.rubriqueId}/rapide">${icone(r.icone, { tuile: true })}<span><b>${tr(r.nom)}</b>
      <span class="petit muet" style="display:block">${l ? esc(nomLogement(l)) : tr("Mêmes réglages que la dernière fois")}</span></span><span class="tampon vert">${tr("Refaire")} ›</span></a>`; }).join("")}</div></div>`;
}
/** Vos biens enregistrés : pour chacun, ses prestations les plus courantes en un clic. */
function blocMesBiensCentre(pid) {
  const biens = logements().slice(0, 4);
  if (!biens.length) return "";
  return `<div class="centre-bloc">${titreCentre("Pour vos biens")}<div class="grille-biens-centre">${biens.map(l => {
    const rubs = rubriquesProposees(pid, l, profilMemorise()?.secteur).slice(0, 3);
    return `<div class="carte bien-centre"><p class="bien-centre-nom">${icone(iconeBien(l))} <b>${esc(nomLogement(l))}</b></p>
      <div class="bien-centre-choix">${rubs.map(id => `<button type="button" class="puce-exemple" data-rubrique="${id}" data-pour-bien="${esc(l.id)}">${icone(rubrique(id).icone)} ${tr(rubrique(id).nom)}</button>`).join("")}
      <button type="button" class="lien-bouton" data-logement-depart="${esc(l.id)}">${tr("Toutes ses prestations")} ›</button></div></div>`;
  }).join("")}</div></div>`;
}
/** Familles du catalogue (affichage seulement : les prestations et leurs prix ne changent pas). */
const FAMILLES = [["Maison et logement", ["home", "rental", "moving", "textiles", "windows", "kitchen"]],
  ["Véhicules et loisirs", ["car", "leisure", "boat"]], ["Extérieurs", ["outdoor", "pool"]],
  ["Professionnels et locaux", ["office", "commerce", "communal", "hospitality"]], ["Interventions spécifiques", ["construction", "event", "special"]]];
/** Mots du quotidien → prestation, pour la recherche (« matelas » trouve Canapés et textiles). */
const MOTS_CLES = { textiles: "canape sofa fauteuil matelas tapis moquette rideau tissu mattress carpet divano materasso tappeto sofa colchon alfombra",
  car: "voiture auto siege interieur car voiture vehicule coche auto macchina", windows: "fenetre vitre baie vitrine window finestra ventana",
  home: "menage maison appartement logement house cleaning casa pulizia limpieza", rental: "airbnb booking location saisonniere voyageurs gite",
  moving: "demenagement etat des lieux depart moving trasloco mudanza", kitchen: "cuisine four hotte frigo kitchen cucina cocina",
  outdoor: "terrasse jardin allee garage balcon terrace", pool: "piscine pool piscina", boat: "bateau voilier pont boat barca barco",
  leisure: "camping car van caravane camper", office: "bureau cabinet agence office ufficio oficina", commerce: "magasin boutique entrepot shop",
  communal: "immeuble copropriete escalier hall", construction: "chantier travaux renovation poussiere", event: "fete mariage soiree evenement party",
  special: "desinfection nuisibles punaises deces sinistre", hospitality: "hotel camping mobil-home chalet" };
const sansAccents = t => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
function carteRubrique(r) {
  const mots = sansAccents([r.nom, tr(r.nom), r.sousTitre, tr(r.sousTitre), MOTS_CLES[r.id] || ""].join(" "));
  return `<button type="button" class="carte prestation" data-rubrique="${r.id}" data-mots="${esc(mots)}" style="text-align:left">
    ${icone(r.icone, { tuile: true })}<h4>${r.nom}</h4><p class="muet" style="margin:4px 0 0">${r.sousTitre}</p><span class="tampon">${pastille(r)}</span></button>`;
}
function catalogueCentre(proposees, centre) {
  const liste = RUBRIQUES.filter(r => proposees.includes(r.id));
  if (!centre || liste.length < 7) return `<div class="grille-3">${liste.map(carteRubrique).join("")}</div>`;
  const familles = FAMILLES.map(([nom, ids]) => [nom, liste.filter(r => ids.includes(r.id))]).filter(([, l]) => l.length);
  const rangees = liste.filter(r => !FAMILLES.some(([, ids]) => ids.includes(r.id)));
  if (rangees.length) familles.push(["Autres prestations", rangees]);
  return `<label class="recherche-prestation">${icone("recherche")}<input type="search" data-recherche-prestation placeholder="${esc(tr("Rechercher : canapé, vitres, voiture, Airbnb…"))}" aria-label="${esc(tr("Rechercher une prestation"))}"></label>
    <p class="petit muet" data-aucune-prestation hidden>${tr("Aucune prestation ne correspond. Décrivez votre besoin à l'assistant ci-dessus : il trouvera la bonne prestation.")}</p>
    ${familles.map(([nom, l]) => `<div class="famille-prestations" data-famille><h4 class="titre-famille">${tr(nom)}</h4><div class="grille-centre">${l.map(carteRubrique).join("")}</div></div>`).join("")}`;
}

function etape2() {
  let h = questionnaire();
  h += blocAccueil();
  const accueilOk = accueilValide(b);
  const tachesOk = b.rubriqueId !== "car" || b.taches.length > 0;
  const panierOk = !["textiles", "hospitality"].includes(b.rubriqueId) || (b.panier || []).length > 0;
  const chantierOk = b.rubriqueId !== "construction" || !!b.artisansPartis;
  const equipementsOk = b.rubriqueId !== "kitchen" || minutesEquipements(b) > 0;
  const joursOk = !(formuleDe(b)?.genre === "REGULIER" && b.frequence === "plusieurs") || (b.jours || []).length >= REGLES.JOURS_MIN_PLUSIEURS_PAR_SEMAINE;
  const ok = accueilOk && tachesOk && panierOk && joursOk && chantierOk && equipementsOk;
  return h + actions(ok, ok ? "" : !equipementsOk ? "Ajoutez au moins un équipement."
    : !chantierOk ? "Cochez « Les artisans auront quitté les lieux » pour continuer."
    : !panierOk ? "Ajoutez chaque élément au panier."
    : !joursOk ? "Choisissez au moins deux jours de passage."
    : !tachesOk ? "Choisissez au moins une tâche." : b.rubriqueId === "car" ? "Précisez la remise et la restitution des clés pour continuer." : "Précisez l'accueil du Cleaneur pour continuer.");
}

/** Étape 2 : les biens enregistrés de la catégorie de la prestation (« Mes bateaux »…), et « + Nouveau ». */
const LIBELLES_BIENS = { logement: ["Mes logements", "+ Nouveau logement"], local: ["Mes locaux", "+ Nouveau local"], vehicule: ["Mes voitures", "+ Nouvelle voiture"],
  loisirs: ["Mes vans et camping-cars", "+ Nouveau van, camping-car ou caravane"], bateau: ["Mes bateaux", "+ Nouveau bateau"] };
function choixDuBien() {
  const liste = biensPour(b.rubriqueId);
  if (!liste.length) return "";
  const cats = categoriesDeRubrique(b.rubriqueId);
  const [titreListe, nouveau] = cats.length > 1 ? (["professionnel", "hotellerie"].includes(b.espace) ? ["Mes adresses", "+ Nouvelle adresse"] : ["Mes logements et adresses", "+ Nouvelle adresse"]) : LIBELLES_BIENS[cats[0]];
  return titre(titreListe) + liste.map(l => `<button type="button" class="option option-bien ${b.logementId === l.id ? "choisi" : ""}" data-bien-etape2="${esc(l.id)}">${icone(iconeBien(l))}
      <span><b>${esc(nomLogement(l))}</b><span class="detail">${esc(l.immatriculation ? `${l.immatriculation} · ` : "")}${esc(categorieBien(l) === "bateau" && l.port ? [l.port, l.place].filter(Boolean).join(", ") : `${l.rue}, ${l.codePostal} ${l.ville}`)}</span></span></button>`).join("")
    + `<button type="button" class="option ${b.logementId ? "" : "choisi"}" data-bien-etape2="">${tr(nouveau)}</button>`;
}

/** Questions qui font le prix (étape 2 de la réservation, et simulateur « Estimer mon prix » sans l'en-tête). */
function questionnaire(enTete = true) {
  const r = rubrique(b.rubriqueId);
  const formules = formulesPour(r);
  let h = enTete ? `<h2>${icone(r.icone)} ${r.nom}</h2><p class="muet">Décrivez le besoin</p>` : "";
  // Logement déjà renseigné (réservation ou « Mes biens ») : choisi dès le début, sa description et son adresse sont reprises.
  // Logement choisi à l'étape 1 : rappelé ici (on peut en changer en revenant à l'étape 1).
  const logChoisi = enTete && b.logementId && logements().find(l => l.id === b.logementId && bienCompatible(b.rubriqueId, l));
  if (enTete) h += choixDuBien();
  if (b.rubriqueId === "special") {
    h += `<div class="note" style="margin-top:14px">Prix fixé à l'avance selon le type d'intervention et la surface : forfait, puis prix au m² au-delà.</div>`
      + (TARIFS_SPECIAUX[b.typeLieuId]?.certibiocide ? `<div class="note" style="margin-top:8px">Intervention réalisée par un Cleaneur titulaire du Certibiocide « nuisibles », vérifié avant activation.</div>` : "");
  }
  // Logement enregistré dont la description est connue : plus de questions, un rappel avec « Modifier » (16 novembre 2026).
  const logFixe = enTete && !!logChoisi && [...RUBRIQUES_LOGEMENT, "rental"].includes(b.rubriqueId) && Number(b.surface) > 0 && !b.modifierLogement;
  if (logFixe) h += titre("Votre logement") + `<div class="carte recap-logement"><span>${icone("logement")}<b>${esc((TYPES_LOGEMENT.find(t => t.id === b.typeLogementId) || {}).nom || "Logement")}</b>
      <span>· ${b.surface} m²</span><span>· ${b.chambres} ${tr(b.chambres > 1 ? "chambres" : "chambre")}</span><span>· ${b.sdb} ${tr(b.sdb > 1 ? "salles de bain" : "salle de bain")}</span>${b.niveaux > 1 ? `<span>· ${b.niveaux} ${tr("niveaux")}</span>` : ""}</span>
      <button type="button" class="lien-bouton" data-modifier-logement>Modifier</button></div>`;
  // Véhicule, camping-car ou bateau enregistré : sa description n'est plus redemandée (type, longueur, port).
  const bienFixe = enTete && !!logChoisi && !ADRESSES.includes(categorieBien(logChoisi)) && !b.modifierLogement;
  if (bienFixe) {
    const typeNom = (typesDeCategorie(categorieBien(logChoisi)).find(t => t.id === b.typeLieuId) || {}).nom || "";
    const nature = { vehicule: "Votre véhicule", loisirs: "Votre véhicule", bateau: "Votre bateau" }[categorieBien(logChoisi)];
    h += titre(nature) + `<div class="carte recap-logement"><span>${icone(iconeBien(logChoisi))}<b>${esc(typeNom)}</b>
      ${categorieBien(logChoisi) !== "vehicule" ? `<span>· ${b.surface} m</span>` : ""}${logChoisi.immatriculation ? `<span>· ${esc(logChoisi.immatriculation)}</span>` : ""}
      ${categorieBien(logChoisi) === "bateau" && b.port ? `<span>· ${esc([b.port, b.place].filter(Boolean).join(", "))}</span>` : ""}</span>
      <button type="button" class="lien-bouton" data-modifier-logement>Modifier</button></div>`;
  }
  if (RUBRIQUES_LOGEMENT.includes(b.rubriqueId) && !logFixe) h += titre("Type de logement") + choix(TYPES_LOGEMENT.map(t => [t.id, t.nom]), b.typeLogementId, "typeLogementId");
  const lieux = lieuxDuSecteur(b.rubriqueId, TYPES_LIEU[b.rubriqueId], profilMemorise()?.secteur);
  if (lieux && !bienFixe) h += titre(r.titreTypes || { car: "Gabarit du véhicule", construction: "Type de sol", kitchen: "Type d'établissement" }[b.rubriqueId] || "Type de lieu")
    + choix(lieux.map(l => [l.id, l.nom]), b.typeLieuId, "typeLieuId");
  if (b.rubriqueId !== "car") {
    h += titre(r.titreFormules || "Choisissez votre formule") + formules.map(f => `<button type="button" class="option ${f.id === formuleDe(b).id ? "choisi" : ""}" data-champ="formuleId" data-valeur="${f.id}">
      ${esc(f.nom)}${f.description ? `<span class="detail">${esc(f.description)}</span>` : ""}</button>`).join("");
    h += questionsFormule(r);
    if (b.rubriqueId === "special" && b.formuleId === "urgente") h += titre("Délai souhaité") + choix(DELAIS_URGENCE, b.delai || "48h", "delai");
    // Location saisonnière : le forfait change avec la formule (chaque formule plus chère comprend davantage de tâches).
    const forfait = b.rubriqueId === "rental" ? inclusLocation(niveauLocation(b).formuleId) : null;
    // Location : la durée du séjour qui précède ajoute du temps au Standard (20/11/2026).
    if (b.rubriqueId === "rental") h += titre("Durée du séjour qui se termine") + choix(SEJOURS_LOCATION, niveauLocation(b).sejour, "sejour");
    const inclus = (lieux || []).find(l => l.id === b.typeLieuId)?.inclus || r.inclus;
    if (forfait) h += `<div class="carte teintee" style="margin-top:6px"><b style="color:var(--primaire)">${tr("Inclus dans votre forfait")}</b>
      ${forfait.precedente ? `<p class="muet" style="margin:4px 0 0;font-size:14px">${tr("Tout le forfait")} « ${esc(tr(formules.find(f => f.id === forfait.precedente)?.nom || ""))} », ${tr("plus :")}</p>` : ""}
      <ul class="liste-forfait">${forfait.taches.map(t => `<li>${esc(tr(t))}</li>`).join("")}</ul>${r.nonInclus ? `<p class="petit" style="margin:6px 0 0"><b>${tr("Non inclus :")}</b> ${esc(tr(r.nonInclus))}</p>` : ""}</div>`;
    else if (inclus) h += `<div class="carte teintee" style="margin-top:6px"><b style="color:var(--primaire)">${packsPour(r, b.typeLieuId).some(p => p.id === "prestige") ? "Inclus dans tous les niveaux" : "Inclus dans votre forfait"}</b><p class="muet" style="margin:4px 0 0;font-size:14px">${esc(inclus)}</p>${r.nonInclus ? `<p class="petit" style="margin:6px 0 0"><b>${tr("Non inclus :")}</b> ${esc(tr(r.nonInclus))}</p>` : ""}</div>`;
  }
  if (["textiles", "hospitality"].includes(b.rubriqueId)) h += panierTextiles();
  if (b.rubriqueId !== "car") {
    if (b.rubriqueId === "special" && TARIFS_SPECIAUX[b.typeLieuId]?.surface !== false) h += titre("Dimensions") + `<div class="carte">${compteur("Surface à traiter", "surface", b.surface, { min: 5, max: 5000, unite: " m²" })}`
      + (surfaceEffective(b) > REGLES.SEUIL_DEVIS_SURFACE_M2 ? `<p style="color:var(--alerte);font-size:14px">Au-delà de 300 m² : devis obligatoire.</p>` : "") + `</div>`;
    if (!["textiles", "hospitality", "special", "pool"].includes(b.rubriqueId) && !logFixe && !(bienFixe && ["leisure", "boat"].includes(b.rubriqueId))) h += titre("Dimensions") + `<div class="carte">`
      + (b.rubriqueId === "windows" ? compteur("Nombre de fenêtres", "fenetres", b.fenetres, { min: 1, max: 200 })
          + compteur("Surface vitrée approximative", "surfaceVitree", b.surfaceVitree ?? 20, { min: 1, max: 500, unite: " m²" })
          + `<p class="petit">La surface vitrée sert uniquement aux tâches à la surface.</p>`
        : b.rubriqueId === "communal" && TYPES_IMMEUBLE.includes(b.typeLieuId)
          ? compteur("Surface par palier", "surfacePalier", b.surfacePalier ?? REGLES.SURFACE_PALIER_DEFAUT_M2, { min: 5, max: 300, unite: " m²" })
          + compteur("Nombre de paliers (étages)", "paliers", b.paliers ?? REGLES.PALIERS_DEFAUT, { min: 1, max: REGLES.PALIERS_MAX })
          + `<p class="petit">Surface totale : ${surfaceEffective(b)} m² (${b.surfacePalier ?? REGLES.SURFACE_PALIER_DEFAUT_M2} m² × ${b.paliers ?? REGLES.PALIERS_DEFAUT} paliers).</p>`
        : ["leisure", "boat"].includes(b.rubriqueId) && bienFixe ? ""
        : ["leisure", "boat"].includes(b.rubriqueId) ? compteur(b.rubriqueId === "boat" ? "Longueur du bateau" : "Longueur du véhicule", "surface", b.surface, { min: 3, max: b.rubriqueId === "boat" ? 40 : 14, unite: " m" })
        : compteur("Surface", "surface", b.surface, { min: 5, max: 5000, unite: " m²" }))
      + ([...RUBRIQUES_LOGEMENT, "rental"].includes(b.rubriqueId) ? compteur("Chambres", "chambres", b.chambres, { max: 12 }) + compteur("Salles de bain", "sdb", b.sdb, { min: 1, max: 8 }) : "")
      + (RUBRIQUES_LOGEMENT.includes(b.rubriqueId) ? compteur("Niveaux", "niveaux", b.niveaux, { min: 1, max: 5 }) + (b.niveaux > 1 ? `<p class="petit">+15 min par niveau supplémentaire</p>` : "") : "")
      + (b.rubriqueId === "office" && ["bureaux", "agence"].includes(b.typeLieuId) ? compteur("Postes de travail", "postes", b.postes ?? 10, { min: 1, max: 500 }) : "")
      + (b.rubriqueId === "event" ? compteur("Nombre de convives", "convives", b.convives ?? 50, { min: 1, max: 2000 }) : "")
      + (surfaceEffective(b) > REGLES.SEUIL_DEVIS_SURFACE_M2 ? `<p style="color:var(--alerte);font-size:14px">Au-delà de 300 m² : devis obligatoire.</p>` : "")
      + `</div>`;
  }
  // Bateaux : accès au port et capitainerie (16 novembre 2026).
  if (b.rubriqueId === "boat" && !bienFixe) h += titre("Au port") + `<div class="carte">${champTexte("Port", "port", b.port || "", "text", 'maxlength="80" placeholder="Ex. : Port-Fréjus"')}
      ${champTexte("Ponton et numéro de place", "place", b.place || "", "text", 'maxlength="60" placeholder="Ex. : ponton C, place 42"')}
      ${champTexte("Accès au ponton (badge, code du portail)", "accesPonton", b.accesPonton || "", "text", 'maxlength="120"')}
      <p class="petit" style="margin:0">${tr("Conseil : prévenez la capitainerie de votre port. Le Cleaneur reçoit un bon d'intervention à présenter sur place (bateau, place, autorisation du propriétaire, assurance). Le carénage n'est pas proposé : il se fait uniquement sur une aire agréée.")}</p></div>`;
  if (b.rubriqueId === "rental") h += etapesLocation();
  if (b.rubriqueId === "car") h += questionsVehicule();
  if (!r.toujoursSurDevis && !["car", "construction", "special", "leisure", "boat", "hospitality"].includes(b.rubriqueId)) {
    // 18/11/2026 : plus d'« État de saleté » (subjectif) : la question objective « Dernier nettoyage en profondeur » règle le prix de départ,
    // et le Cleaneur peut proposer un supplément sur place si l'état réel dépasse ce qui est décrit (le client accepte ou refuse).
    if (!formuleDe(b).avecDernierNettoyage) h += titre("Dernier nettoyage en profondeur") + choix(DERNIERS_NETTOYAGES.map(d => [d.id, d.libelle]), b.dernierNettoyage, "dernierNettoyage");
    h += `<p class="petit">${tr("Si l'état réel dépasse ce qui est décrit, le Cleaneur peut vous proposer sur place un supplément (15 à 60 min, au plus +25 %), avec photo. Vous l'acceptez ou le refusez.")}</p>`;
  }
  if (b.rubriqueId === "construction") h += questionsChantier();
  if (b.rubriqueId === "kitchen") h += equipementsCuisine();
  const chiffrees = tachesChiffrees(b), packs = packsPour(r, b.typeLieuId);
  if (chiffrees.length) {
    // Trois formules (Standard · Confort · Premium) : prix total de chaque formule, ce qu'elle ajoute, puis les options en plus.
    const confort = packs.find(p => p.id === "confort"), premium = packs.find(p => p.id === "prestige");
    const vehicule = b.rubriqueId === "car";
    // Véhicules (prompt 2, partie 7) : Standard (pack « confort », −10 %) · Premium (−15 %) · Sur mesure (tâches à cocher).
    const formules = !(confort && premium) ? [] : vehicule
      ? [{ ...confort, nom: "Standard" }, { ...premium, nom: "Premium" }, { id: "sur-mesure", nom: "Sur mesure", tacheIds: [] }]
      : [{ id: "standard", nom: "Standard", tacheIds: [] }, { ...confort, nom: "Confort" }, { ...premium, nom: "Premium" }];
    const dansPacks = new Set(packs.flatMap(p => p.tacheIds));
    const actifBrut = formuleActive(b, packs, chiffrees), actif = vehicule && actifBrut === "standard" ? "sur-mesure" : actifBrut;
    const incluses = new Set((formules.find(f => f.id === actif)?.tacheIds) || []);
    const menuMenage = b.rubriqueId === "home" && formuleDe(b).genre === "PONCTUEL" && r.occasions.length > 0;
    if (menuMenage) h += quelMenage(r, chiffrees, actif);
    else if (formules.length) {
      const prixFormule = f => calculer(entreeEstimation({ ...b, taches: f.tacheIds.filter(id => chiffrees.some(t => t.id === id)) }, b.espace === "personnel", debutChoisi())).totalC;
      const prixStandard = prixFormule(formules[0]);
      if (vehicule) h += titre("Votre formule") + cartesFormulesVehicule(formules, actif, prixFormule);
      else h += titre("Votre niveau de ménage") + `<div class="formules">${formules.map((f, i) => {
        const avant = i ? formules[i - 1].tacheIds : [];
        const ajouts = chiffrees.filter(t => f.tacheIds.includes(t.id) && !avant.includes(t.id));
        const p = prixFormule(f);
        return `<button type="button" class="formule${f.id === actif ? " choisie" : ""}${f.id === "confort" ? " conseillee" : ""}" data-formule="${f.id}">
          ${f.id === "confort" ? `<span class="badge-formule">${tr("Conseillée")}</span>` : ""}
          <b class="nom-formule">${tr(f.nom)}</b>${f.id === "prestige" && r.sousTitrePremium ? `<span class="sous-formule">${tr(r.sousTitrePremium)}</span>` : ""}
          <span class="prix-formule">${euros(p)}</span>${i && p > prixStandard ? `<span class="ecart-formule">+${euros(p - prixStandard)}</span>` : ""}
          ${f.remisePct ? `<span class="remise-formule">−${f.remisePct} % ${tr("sur les tâches incluses")}</span>` : `<span class="remise-formule">${tr("Le ménage de base")}</span>`}
          <ul>${i === 0 ? `<li>${esc(r.inclus || tr("Ménage complet"))}</li>`
            : `<li class="tout">${tr(i === 1 ? "Tout Standard, plus :" : "Tout Confort, plus :")}</li>${ajouts.map(t => `<li>${esc(t.nom)}</li>`).join("")}`}</ul>
        </button>`; }).join("")}</div>`;
    }
    // Options en plus : celles de la formule sont cochées et incluses ; les autres s'ajoutent à l'unité.
    const groupes = [...new Set(chiffrees.map(t => t.groupe))];
    // L'essentiel d'abord (18 novembre 2026) : les tâches déjà comprises dans la formule ne sont plus listées ; on montre au plus
    // 6 options utiles (celles des formules Confort et Premium, ou déjà cochées), le reste est rangé dans « Autres options ».
    const ligneOption = t => `<label class="case"><input type="checkbox" data-tache="${t.id}" ${b.taches.includes(t.id) ? "checked" : ""}>
      <span>${t.nom}</span><span class="info"><b>+${euros(t.prixC)}</b><small>${duree(t.minutes)}</small></span></label>`;
    const libres = chiffrees.filter(t => !incluses.has(t.id));
    const utiles = libres.filter(t => b.taches.includes(t.id) || dansPacks.has(t.id));
    const essentielles = (utiles.length ? utiles : libres).slice(0, Math.max(6, libres.filter(t => b.taches.includes(t.id)).length));
    const autres = libres.filter(t => !essentielles.includes(t));
    let options = (essentielles.length ? `<div class="carte">${essentielles.map(ligneOption).join("")}</div>` : `<p class="petit">${tr("Tout est déjà compris dans votre formule.")}</p>`)
      + (autres.length ? `<details class="autres-options"><summary class="petit">${tr("Autres options")} (${autres.length})</summary><div class="carte">${autres.map(ligneOption).join("")}</div></details>` : "");
    if (formules.length) options += `<p class="petit">${tr("Les tâches de la formule bénéficient de sa remise ; les options en plus sont au prix indiqué.")}</p>`;
    if (r.noteTaches) options += `<div class="note alerte" style="margin-top:10px">${esc(r.noteTaches)}</div>`;
    if (r.surfaceReferenceM2 > 0 && chiffrees.some(t => t.parSurface)) options += `<p class="petit">Tâches marquées à la surface : prix pour ${r.surfaceReferenceM2} ${["leisure", "boat"].includes(b.rubriqueId) ? "m de longueur" : "m²"}, au prorata au-delà.</p>`;
    const enPlus = b.taches.filter(id => !incluses.has(id)).length;
    h += repli("options", vehicule ? (actif === "sur-mesure" ? "Choisir mes tâches" : "Ajouter une option") : formules.length ? "Ajouter des options (facultatif)" : "Tâches complémentaires (facultatif)",
      enPlus ? `${enPlus} ${tr(enPlus > 1 ? "options ajoutées" : "option ajoutée")}` : tr(formules.length ? "La formule suffit dans la plupart des cas" : "Aucune pour l'instant"), options);
  }
  if (!r.toujoursSurDevis && b.rubriqueId !== "special") {
    h += repli("perso", "Une demande spécifique ? (facultatif)", b.tachesPerso.length ? `${b.tachesPerso.length} ${tr(b.tachesPerso.length > 1 ? "demandes" : "demande")}` : "", `<div class="carte">${b.tachesPerso.map((t, i) => `<div style="display:flex;align-items:center"><span style="flex:1">• ${esc(t)}</span>
      <button type="button" class="lien-bouton" style="color:var(--erreur)" data-retirer="${i}">Retirer</button></div>`).join("")}
      <div style="display:flex;gap:8px;align-items:center"><input class="texte" id="saisie-perso" maxlength="120" placeholder="Ex. : nettoyer l'intérieur du lave-linge" style="margin:0">
      <span style="white-space:nowrap;font-weight:800;color:var(--primaire)">+${euros(Math.round((r.tauxHoraireC || 0) * REGLES.TACHE_PERSO_MIN / 60))}</span>
      <button type="button" class="lien-bouton" id="ajouter-perso">Ajouter</button></div>
      <p class="petit">Pour un besoin vraiment particulier : chaque demande compte 15 min dans l'estimation et le Cleaneur la confirme.</p></div>`);
  }
  if (b.rubriqueId === "home") h += `<div class="carte" style="margin-top:14px">${caseCocher("Des animaux vivent dans le logement", "animaux", b.animaux)}</div>`;
  if (b.rubriqueId === "office" || b.rubriqueId === "commerce") h += `<div class="carte" style="margin-top:14px">${caseCocher("Les lieux seront vides pendant l'intervention", "lieuxVides", !!b.lieuxVides)}</div>`;
  if (b.rubriqueId === "event") h += horairesEvenement();
  if (b.rubriqueId === "moving") h += `<div class="carte" style="margin-top:14px">${caseCocher("Le logement sera entièrement vide (meubles et cartons sortis)", "lieuxVides", !!b.lieuxVides)}</div>`;
  return h;
}

/** Téléphone : au moins 10 chiffres (Validation.telephoneValide dans l'appli). */
const telephoneValide = t => (t || "").replace(/\D/g, "").length >= 10;
function accueilValide(b) {
  if (b.rubriqueId === "car") return clesValides(b);
  return !!b.accueil && ({ TIERS: b.tiersNom.trim() && telephoneValide(b.tiersTel), BOITE: b.boiteEmplacement.trim() && b.code.trim(), AUTONOME: b.code.trim(), PRESENT: true }[b.accueil]);
}

/* Véhicules (26/11/2026, validé par Michael) : pas d'« accueil » mais la remise ET la restitution des clés, selon le lieu choisi.
   Mêmes codes en base (PRESENT, TIERS, BOITE, AUTONOME) ; « Sans clés » seulement si toutes les tâches sont extérieures
   (l'intérieur et le compartiment moteur demandent les clés). À reporter dans les applis (Vincent). */
export const TACHES_SANS_CLES = new Set(["lavage_main", "vitres_ext", "jantes", "decontamination", "bas_caisse", "cire", "optiques", "polissage"]);
export const exterieurSeul = b => (b.taches || []).length > 0 && b.taches.every(t => TACHES_SANS_CLES.has(t));
const CODE_CLES = { MAIN: "PRESENT", PERSONNE: "TIERS", ACCUEIL: "TIERS", BOITE: "BOITE", SANS: "AUTONOME" };
const DEPUIS_CODE = { PRESENT: "MAIN", TIERS: "PERSONNE", BOITE: "BOITE", AUTONOME: "SANS" };
/** Choix de remise des clés proposés (fonction pure, testée). */
export function optionsCles(b) {
  return [["MAIN", "Je remets les clés en main propre"], ["PERSONNE", "Une autre personne remet les clés"],
    ...(b.lieuVehicule === "travail" ? [["ACCUEIL", "Clés à l'accueil de l'entreprise"]] : []),
    ["BOITE", "Clés dans une boîte à clés"], ...(exterieurSeul(b) ? [["SANS", "Sans clés : extérieur seulement"]] : [])];
}
const remiseCles = b => { const r = b.remiseCles || DEPUIS_CODE[b.accueil] || ""; return optionsCles(b).some(([k]) => k === r) ? r : ""; };
const RESTITUTIONS = [["MEME", "Au même endroit que la remise"], ["MAIN", "En main propre"], ["ACCUEIL", "À l'accueil de l'entreprise"], ["BOITE", "Dans la boîte à clés"]];
function clesValides(b) {
  const r = remiseCles(b);
  if (!r) return false;
  const ok = { MAIN: true, PERSONNE: b.tiersNom.trim() && telephoneValide(b.tiersTel), ACCUEIL: b.tiersNom.trim(), BOITE: b.boiteEmplacement.trim() && b.code.trim(), SANS: true }[r];
  const rest = r === "SANS" || !b.restitution || b.restitution === "MEME" || b.restitution === "MAIN"
    || (b.restitution === "ACCUEIL" && (r === "ACCUEIL" || (b.accueilRestitution || "").trim()))
    || (b.restitution === "BOITE" && (r === "BOITE" || ((b.boiteEmplacement || "").trim() && (b.code || "").trim())));
  return !!ok && !!rest;
}
function photoBoiteHtml() {
  return `<div class="photo-boite"><p class="titre-photo-boite">Photo de la boîte à clés <span class="petit">(facultatif)</span></p>
        ${photoBoite ? `<img class="apercu-boite" alt="Boîte à clés" data-apercu-boite>` : ""}
        <div class="boutons-photo"><label class="bouton secondaire" style="cursor:pointer">${icone("photo")} ${photoBoite ? "Reprendre la photo" : "Prendre une photo"}<input type="file" id="photo-boite-appareil" accept="image/*" capture="environment" hidden></label>
          <label class="bouton secondaire" style="cursor:pointer">Galerie<input type="file" id="photo-boite-galerie" accept="image/*" hidden></label>
          ${photoBoite ? `<button type="button" class="lien-bouton" data-retirer-photo-boite>Retirer</button>` : ""}</div>
        <p class="petit">Elle aide le Cleaneur à trouver la boîte du premier coup.</p></div>`;
}
function blocCles() {
  const r = remiseCles(b), rest = b.restitution || "MEME";
  let champs = "";
  if (r === "MAIN") champs = `<p class="petit" style="margin:0">Vous remettez les clés à l'arrivée du Cleaneur. Il vous prévient 10 minutes avant la fin pour vous les rendre.</p>`;
  if (r === "PERSONNE") champs = champTexte("Prénom et nom", "tiersNom", b.tiersNom, "text", 'maxlength="80"') + champTexte("Téléphone", "tiersTel", b.tiersTel, "tel", 'maxlength="20"')
    + (b.tiersTel && !telephoneValide(b.tiersTel) ? `<p class="erreur" style="margin:0">Au moins 10 chiffres.</p>` : "");
  if (r === "ACCUEIL") champs = champTexte("Entreprise et accueil (bâtiment, étage)", "tiersNom", b.tiersNom, "text", 'maxlength="80" placeholder="Ex. : Société Martin, accueil du bâtiment B"')
    + champTexte("Téléphone de l'accueil (facultatif)", "tiersTel", b.tiersTel, "tel", 'maxlength="20"');
  if (r === "BOITE") champs = champTexte("Emplacement de la boîte", "boiteEmplacement", b.boiteEmplacement, "text", 'maxlength="120"') + champTexte("Code", "code", b.code, "text", 'maxlength="30" autocomplete="off"') + photoBoiteHtml();
  if (r === "SANS") champs = `<p class="petit" style="margin:0">Vos tâches sont toutes extérieures : le Cleaneur n'a pas besoin des clés. Le véhicule reste fermé.</p>`;
  const restOptions = RESTITUTIONS.filter(([k]) => k === "MEME" || k === "MAIN" || k === "BOITE" || (k === "ACCUEIL" && b.lieuVehicule === "travail"));
  let restChamps = "";
  if (rest === "ACCUEIL" && r !== "ACCUEIL") restChamps = champTexte("Accueil (bâtiment, étage)", "accueilRestitution", b.accueilRestitution || "", "text", 'maxlength="80"');
  if (rest === "BOITE" && r !== "BOITE") restChamps = champTexte("Emplacement de la boîte", "boiteEmplacement", b.boiteEmplacement, "text", 'maxlength="120"') + champTexte("Code", "code", b.code, "text", 'maxlength="30" autocomplete="off"');
  if (rest === "MAIN" && r !== "MAIN") restChamps = `<p class="petit" style="margin:0">Le Cleaneur vous prévient 10 minutes avant la fin pour vous rendre les clés.</p>`;
  return titre("Remise des clés") + choix(optionsCles(b), r, "remiseCles")
    + (champs ? `<div class="carte" style="margin-top:10px">${champs}</div>` : "")
    + (r && r !== "SANS" ? titre("Restitution des clés") + choix(restOptions, rest, "restitution") + (restChamps ? `<div class="carte" style="margin-top:10px">${restChamps}</div>` : "") : "")
    + `<p class="petit">Les clés, codes et consignes ne sont transmis au Cleaneur qu'une fois la mission confirmée. Il confirme dans l'appli quand il reçoit puis rend les clés.</p>`;
}
/** « Accueil du Cleaneur » : mêmes choix, champs et textes que l'appli (fin de l'étape 2). */
function blocAccueil() {
  if (b.rubriqueId === "car") return blocCles();
  const interdit = accueilAutonomeInterdit(b.rubriqueId, b.typeLieuId);
  const options = Object.entries(ACCUEIL).filter(([k]) => (b.rubriqueId === "special" ? k === "PRESENT" : !interdit || ["PRESENT", "TIERS"].includes(k)));
  let acces = "";
  if (b.accueil === "TIERS") acces = champTexte("Prénom et nom", "tiersNom", b.tiersNom, "text", 'maxlength="80"') + champTexte("Téléphone", "tiersTel", b.tiersTel, "tel", 'maxlength="20"')
    + (b.tiersTel && !telephoneValide(b.tiersTel) ? `<p class="erreur" style="margin:0">Au moins 10 chiffres.</p>` : "");
  if (b.accueil === "BOITE") acces = champTexte("Emplacement de la boîte", "boiteEmplacement", b.boiteEmplacement, "text", 'maxlength="120"') + champTexte("Code", "code", b.code, "text", 'maxlength="30" autocomplete="off"')
    + photoBoiteHtml()
    + `<p class="petit">Le code et la photo ne sont transmis au Cleaneur qu'une fois la mission confirmée.</p>`;
  if (b.accueil === "AUTONOME") acces = champTexte("Consignes et code d'arrivée", "code", b.code, "text", 'maxlength="120" autocomplete="off"');
  return titre("Accueil du Cleaneur")
    + (interdit ? `<div class="note" style="margin-bottom:10px">Accueil par une personne sur place, sans accès autonome.</div>` : "")
    + choix(options, b.accueil, "accueil")
    + (acces ? `<div class="carte" style="margin-top:10px">${acces}</div>` : "");
}

/** Événements : jour, heures de début et de fin, règles de passage (HorairesEvenement dans l'appli). */
function horairesEvenement() {
  const regle = { apres: "Après : le passage commence à partir de la fin de l'événement.",
    avant_apres: "Avant et après : deux passages, l'un terminé avant le début, l'autre à partir de la fin." }[b.formuleId]
    || "Avant : le passage est terminé avant le début de l'événement.";
  return titre("Horaires de l'événement") + `<div class="carte">${champTexte("Jour de l'événement", "evtDate", b.evtDate || "", "date")}
      ${compteur("Début de l'événement", "evtDebutH", b.evtDebutH ?? 18, { min: 6, max: 23, unite: " h" })}
      ${compteur("Fin de l'événement", "evtFinH", b.evtFinH ?? 23, { min: 7, max: 23, unite: " h" })}
      <p class="petit">${regle}</p></div>`;
}

/** Cuisines : équipements à l'unité, prix indicatif, note sur les produits (EquipementsCuisine dans l'appli). */
function equipementsCuisine() {
  const eq = b.equipements || {};
  return titre("Équipements à nettoyer") + `<div class="carte">${equipementsPour(b.typeLieuId).map(e =>
      `<div class="compteur"><span><span>${e.nom}</span> · ${euros(prixIndicatifEquipement(e, b))}</span><span class="regle">
        <button type="button" data-equip-moins="${e.id}" aria-label="Moins" ${(eq[e.id] || 0) <= 0 ? "disabled" : ""}>−</button>
        <output>${eq[e.id] || 0}</output>
        <button type="button" data-equip-plus="${e.id}" aria-label="Plus" ${(eq[e.id] || 0) >= 20 ? "disabled" : ""}>+</button></span></div>`).join("")}
      <p class="petit">Au moins un équipement. Prix indicatif par équipement, selon l'établissement et l'intensité.</p></div>`
    + `<div class="note" style="margin-top:10px">Produits compatibles contact alimentaire.</div>`;
}

/** Fin de chantier : fenêtres, pièces, type de chantier, départ des artisans, réception des travaux (QuestionsChantier dans l'appli). */
function questionsChantier() {
  return `<div class="carte" style="margin-top:14px">${compteur("Nombre de fenêtres", "fenetres", b.fenetres ?? 8, { min: 0, max: 100 })}
      ${compteur("Nombre de pièces", "pieces", b.pieces ?? 3, { min: 1, max: REGLES.CHANTIER_PIECES_MAX })}
      <p class="petit">+15 min par fenêtre ; une photo par pièce à l'étape suivante.</p></div>`
    + titre("Type de chantier") + choix(TYPES_CHANTIER, b.typeChantier || "", "typeChantier")
    + `<div class="carte" style="margin-top:10px">${caseCocher("Les artisans auront quitté les lieux", "artisansPartis", !!b.artisansPartis)}</div>`
    + titre("Réception ou livraison des travaux") + champTexte("Date (facultatif)", "dateReception", b.dateReception || "", "date")
    + `<p class="petit">Le Cleaneur planifie son passage pour que tout soit prêt avant cette date.</p>`
    + `<div class="note" style="margin-top:14px">Fin de chantier : jamais « standard ». Le niveau de salissure sera estimé dès que toutes les photos seront exploitables.</div>`;
}

/** Véhicules : nombre, lieu, eau et électricité, fréquence, animaux, sélection conseillée (QuestionsVehicule dans l'appli). */
/** Véhicules (prompt 2, partie 7) : trois cartes Standard (présélectionnée) · Premium · Sur mesure. */
function cartesFormulesVehicule(formules, actif, prixFormule) {
  const std = formules[0], prixStd = prixFormule(std), f = PRIX_FORMULES.car;
  const chiffrees = tachesChiffrees(b);
  return `<div class="formules formules-vehicule">${formules.map((x, i) => {
    const surMesure = x.id === "sur-mesure", p = surMesure ? null : prixFormule(x);
    const ajouts = i === 1 ? chiffrees.filter(t => x.tacheIds.includes(t.id) && !std.tacheIds.includes(t.id)) : [];
    return `<button type="button" class="formule${x.id === actif ? " choisie" : ""}${i === 0 ? " conseillee" : ""}" data-formule="${x.id}">
      ${i === 0 ? `<span class="badge-formule">${tr("Conseillée")}</span>` : ""}
      <b class="nom-formule">${tr(x.nom)}</b>
      <span class="prix-formule">${surMesure ? `dès ${euros(REGLES.MINIMUM_COMMANDE_VEHICULE_C)}` : euros(p)}</span>${i === 1 && p > prixStd ? `<span class="ecart-formule">+${euros(p - prixStd)}</span>` : ""}
      ${x.remisePct ? `<span class="remise-formule">−${x.remisePct} % ${tr("sur les tâches incluses")}</span>` : `<span class="remise-formule">${tr("100 % à la carte")}</span>`}
      ${i === 0 ? `<p class="compris-titre">${tr("Compris")}</p><ul>${FORMULE_STANDARD_VEHICULE.compris.map(t => `<li>${tr(t)}</li>`).join("")}</ul>
        <p class="non-compris"><b>${tr("Non compris")}</b> ${tr(FORMULE_STANDARD_VEHICULE.nonCompris)}</p>
        ${f ? `<p class="petit">${tr("Durée indicative : environ")} ${duree(f.dureeMin)} ${tr("pour une citadine.")}</p>` : ""}
        <p class="petit">${tr("Lavage sans eau, à domicile ou sur votre lieu de travail. Photos des 4 côtés avant l'intervention.")}</p>`
      : i === 1 ? `<ul><li class="tout">${tr("Tout Standard, plus :")}</li>${ajouts.map(t => `<li>${esc(t.nom)}</li>`).join("")}</ul>`
      : `<ul><li>${tr("Choisissez vos tâches une à une dans la liste.")}</li></ul>`}
    </button>`; }).join("")}</div>`;
}

function questionsVehicule() {
  const freq = b.frequenceVehicule || "unique";
  return `<div class="carte" style="margin-top:14px">${compteur("Nombre de véhicules", "nombreVehicules", b.nombreVehicules || 1, { min: REGLES.VEHICULES_MIN, max: REGLES.VEHICULES_MAX })}
      <p class="petit">Tâches et remise multipliées par le nombre de véhicules.</p></div>`
    + titre("Lieu d'intervention") + choix(LIEUX_VEHICULE, b.lieuVehicule || "domicile", "lieuVehicule")
    + `<div class="carte" style="margin-top:10px">${caseCocher("Eau et électricité disponibles sur place", "eauElectricite", b.eauElectricite !== false)}</div>`
    + titre("Fréquence") + choix(FREQUENCES_VEHICULE, freq, "frequenceVehicule")
    + (freq !== "unique" ? `<div class="note" style="margin-top:10px">Idéal pour une flotte d'entreprise : chaque passage est planifié et facturé séparément.</div>
      <div class="carte" style="margin-top:10px">${compteur("Passages à planifier", "passages", b.passages || REGLES.PASSAGES_DEFAUT, { min: REGLES.PASSAGES_MIN, max: REGLES.PASSAGES_MAX })}</div>` : "")
    + blocPass()
    + `<div class="carte" style="margin-top:10px">${caseCocher("Des animaux voyagent dans le véhicule", "animaux", !!b.animaux)}
      ${b.animaux && !b.taches.includes("poils") ? `<button type="button" class="lien-bouton" id="ajouter-poils">Ajouter « Poils d'animaux »</button>` : ""}</div>`
    ;
}

/** Location saisonnière : étapes par pièce, étapes personnalisées, consommables, horaires, mémoire (EtapesLocation dans l'appli). */
const titreAction = (t, id, action) => `<div style="display:flex;align-items:baseline;gap:10px;margin:26px 0 10px"><h3 style="margin:0;flex:1">${t}</h3>`
  + `<button type="button" class="lien-bouton" id="${id}">${action}</button></div>`;
/** Formule en cours : Premium ou Confort quand toutes ses tâches sont cochées (la plus complète d'abord), sinon Standard. */
/** Niveaux, pour les pastilles d'occasion et les badges. */
const NOMS_NIVEAUX = { standard: "Standard", confort: "Confort", prestige: "Premium" };
/** « À quelle occasion ? » (hors ménage du logement) : pastilles avec le niveau qu'elles cochent. */
function choixOccasions(r) {
  const niveau = b.occasion ? niveauOccasion(r, b.occasion) : "";
  return `<div class="choix">${r.occasions.map(o => `<button type="button" data-champ="occasion" data-valeur="${esc(o.id)}" class="${b.occasion === o.id ? "choisi" : ""}">
      <span>${esc(tr(o.nom))}</span>${o.packId ? `<span class="tag-niveau">${tr(NOMS_NIVEAUX[o.packId])}</span>` : ""}</button>`).join("")}</div>`
    + (niveau && niveau !== "standard" ? `<p class="petit note-occasion">${icone("termine")} <span>${tr("Niveau présélectionné pour cette occasion :")}</span> <b>${tr(NOMS_NIVEAUX[niveau])}</b>. <span>${tr("Ajustez-le plus bas si besoin.")}</span></p>` : "");
}
/** « Quel ménage ? » (ménage ponctuel du logement, 22/11/2026) : l'occasion et le niveau en un seul choix. Chaque carte parle d'elle-même :
 *  emoji, badge, prix total, écart avec le ménage classique, ce qu'elle ajoute. Les options restent ajustables juste en dessous. */
function quelMenage(r, chiffrees, actif) {
  const occ = r.occasions;
  const choisie = occ.some(o => o.id === b.occasion) ? b.occasion : ({ prestige: "printemps", confort: "recevoir" }[actif] || occ[0].id);
  const prix = id => calculer(entreeEstimation({ ...b, taches: tachesPourOccasion(b, id) }, b.espace === "personnel", debutChoisi())).totalC;
  const base = prix(occ[0].id), deBase = new Set(tachesPourOccasion(b, occ[0].id));
  const nomTache = id => chiffrees.find(t => t.id === id)?.nom;
  const ajuste = niveauOccasion(r, choisie) !== actif;
  return titre("Quel ménage ?") + `<p class="petit" style="margin:-4px 0 12px">${tr("Choisissez votre moment : le niveau et les tâches se règlent tout seuls. Vous pourrez ajuster les options juste en dessous.")}</p>
    <div class="formules menages">${occ.map(o => {
      const p = prix(o.id);
      // Ce qui distingue la carte d'abord (four, placards… pour le grand ménage), puis ce qu'elle partage avec les autres.
      const partage = id => occ.filter(x => tachesPourOccasion(b, x.id).includes(id)).length;
      const ajouts = tachesPourOccasion(b, o.id).filter(id => !deBase.has(id)).sort((x, y) => partage(x) - partage(y)).map(nomTache).filter(Boolean);
      return `<button type="button" class="formule menage${o.id === choisie ? " choisie" : ""}${o.conseille ? " conseillee" : ""}" data-champ="occasion" data-valeur="${esc(o.id)}">
        <span class="badge-formule">${tr(o.badge)}</span>
        <span class="emoji-menage" aria-hidden="true">${o.emoji}</span>
        <b class="nom-formule">${tr(o.nom)}</b>
        <span class="prix-formule">${euros(p)}</span>
        <span class="ecart-formule">${p > base ? `+${euros(p - base)}` : tr("Le ménage de base")}</span>
        <span class="detail-menage">${tr(o.description)}</span>
        ${ajouts.length ? `<ul>${ajouts.slice(0, 3).map(n => `<li>${esc(n)}</li>`).join("")}${ajouts.length > 3 ? `<li class="tout">+ ${ajouts.length - 3} ${tr(ajouts.length - 3 > 1 ? "autres tâches" : "autre tâche")}</li>` : ""}</ul>` : ""}
      </button>`; }).join("")}</div>
    ${ajuste ? `<p class="petit ajuste-menage">${tr("Ajusté selon vos options : le prix tient compte de ce que vous avez coché ou décoché.")}</p>` : ""}`;
}
function formuleActive(b, packs, chiffrees) {
  const complet = id => { const p = packs.find(x => x.id === id); const ids = p ? p.tacheIds.filter(t => chiffrees.some(c => c.id === t)) : [];
    return ids.length > 0 && ids.every(t => b.taches.includes(t)); };
  return complet("prestige") ? "prestige" : complet("confort") ? "confort" : "standard";
}

/** Bloc repliable « pour aller plus loin » (18 novembre 2026) : l'essentiel reste visible, le détail est rangé ici.
 *  Il reste ouvert ou fermé quand la page se redessine. resume : ce qui est déjà choisi, visible même fermé. */
const REPLIS_OUVERTS = new Set();
function repli(cle, titreRepli, resume, contenu) {
  return `<details class="repli-reservation" ${REPLIS_OUVERTS.has(cle) ? "open" : ""} data-repli="${cle}">
    <summary><span class="titre-repli">${tr(titreRepli)}</span>${resume ? `<span class="resume-repli">${resume}</span>` : ""}</summary>
    <div class="contenu-repli">${contenu}</div></details>`;
}
document.addEventListener("toggle", e => {
  const d = e.target;
  if (d?.dataset?.repli) d.open ? REPLIS_OUVERTS.add(d.dataset.repli) : REPLIS_OUVERTS.delete(d.dataset.repli);
}, true);

function etapesLocation() {
  const etapes = etapesDe(b), incluses = etapesIncluses(b), perso = b.etapesPerso || [], conso = consommablesDe(b);
  const motifInclus = b.drapsLieu === "laverie" ? "Incluse · lavage en laverie" : "Incluse · lavage sur place";
  const detail = titreAction("Étapes à valider en photo", "pack-etapes", "Pack conseillé")
    + `<p class="petit">Une étape « Chambre » compte une fois par chambre, « Salle de bain » une fois par salle de bain.</p>`
    + PIECES_LOCATION.map(([piece, nom]) => `<p class="petit" style="margin:12px 0 4px"><b>${nom}</b></p><div class="carte">`
      + ETAPES_LOCATION.filter(e => e.piece === piece).map(e => incluses.includes(e.id) ? `<label class="case"><input type="checkbox" checked disabled>
        <span>${e.nom}</span><span class="info">${tr(motifInclus)}</span></label>` : `<label class="case"><input type="checkbox" data-etape="${e.id}" ${etapes.includes(e.id) ? "checked" : ""}>
        <span>${e.nom}</span><span class="info">${e.minutes ? `<b>+${euros(prixEtapeLocationC(e, b.chambres, b.sdb))}</b><small>${duree(e.minutes * repetitionsEtape(e, b.chambres, b.sdb))}</small>` : "Incluse"}</span></label>`).join("")
      + perso.map((p, i) => p.piece === piece ? `<div style="display:flex;align-items:center;gap:8px"><span style="flex:1">• ${esc(p.texte)}</span>
        <span class="info"><b>+${euros(prixEtapeLocationC({ minutes: REGLES.ETAPE_PERSO_LOCATION_MIN, piece: "entree" }, 1, 1))}</b><small>${duree(REGLES.ETAPE_PERSO_LOCATION_MIN)}</small></span><button type="button" class="lien-bouton" style="color:var(--erreur)" data-retirer-etape="${i}">Retirer</button></div>` : "").join("")
      + `</div>`).join("")
    + `<div class="carte" style="margin-top:10px"><b>Ajouter une étape</b>
      <div style="display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap"><select id="piece-perso" class="texte" style="margin:0;flex:0 1 190px">${PIECES_LOCATION.map(([id, nom]) => `<option value="${id}">${nom}</option>`).join("")}</select>
      <input class="texte" id="saisie-etape" maxlength="120" placeholder="Ex. : arroser l'olivier" style="margin:0;flex:1 1 180px">
      <button type="button" class="lien-bouton" id="ajouter-etape">Ajouter</button></div><p class="petit">Étape personnalisée : +10 min.</p></div>`
    + titreAction("Consommables à contrôler", "pack-conso", "Pack conseillé")
    + `<div class="carte">${CONSOMMABLES_LOCATION.map(([id, nom]) => `<label class="case"><input type="checkbox" data-conso="${id}" ${conso.includes(id) ? "checked" : ""}><span>${nom}</span></label>`).join("")}
      <p class="petit">+10 min si la liste n'est pas vide.</p></div>`
    + `<div class="note alerte" style="margin-top:10px">Le Cleaneur n'apporte jamais de consommables : ils doivent être sur place.</div>`;
  return titre("Horaires des voyageurs") + `<div class="carte">`
    + compteur("Départ des voyageurs", "departVoyageursH", b.departVoyageursH ?? REGLES.DEPART_VOYAGEURS_DEFAUT_H, { min: REGLES.DEPART_VOYAGEURS_MIN_H, max: REGLES.DEPART_VOYAGEURS_MAX_H, unite: " h" })
    + compteur("Arrivée suivante", "arriveeSuivanteH", b.arriveeSuivanteH ?? REGLES.ARRIVEE_SUIVANTE_DEFAUT_H, { min: REGLES.ARRIVEE_SUIVANTE_MIN_H, max: REGLES.ARRIVEE_SUIVANTE_MAX_H, unite: " h" })
    + `<p class="petit">Le ménage commence au départ des voyageurs et doit finir avant l'arrivée suivante.</p>`
    + caseCocher("Je souhaite cette prestation à chaque départ de voyageurs", "aChaqueDepart", !!b.aChaqueDepart) + `</div>`
    + titre("Linge") + `<div class="carte"><div class="badges-linge">${badgeCase(icone("logement"), "Linge propre sur place", "drapsFournis", b.drapsFournis !== false, "Le Cleaneur fait les lits et installe serviettes et tapis avec votre linge.")}
      ${badgeCase(icone("stock"), "Laver les draps", "lavageDraps", !!b.lavageDraps, "Draps et housses lavés, séchés et pliés.")}
      ${badgeCase(icone("stock"), "Laver serviettes et torchons", "lavageLinge", !!b.lavageLinge, "Serviettes de bain, tapis de bain et de WC, torchons de cuisine.")}</div>
      <p class="petit muet" style="margin:8px 0 0">${tr(b.drapsFournis !== false ? "Lits faits et serviettes installées avec votre linge." : "Pas de linge à installer.")}${b.lavageDraps ? " " + tr("Draps lavés, séchés, pliés.") : ""}${b.lavageLinge ? " " + tr("Serviettes, tapis et torchons lavés.") : ""}</p>
      ${b.lavageDraps || b.lavageLinge ? (() => { const t = litsTailles(b), p = REGLES.DRAPS_LAVERIE_C, laverie = b.drapsLieu === "laverie";
        // Prix affiché = prix facturé (26/11/2026) : 5 € par lit sur place (et non l'ancien forfait), + serviettes et tapis.
        const surPlace = { ...b, drapsLieu: "sur_place" };
        const prixSurPlace = (b.lavageDraps ? prixDrapsC(surPlace) : 0) + (b.lavageLinge ? prixLingeC(surPlace) : 0);
        return `<p style="margin:10px 0 4px"><b>${tr("Machine à laver et sèche-linge dans le logement ?")}</b></p>`
          + choix([["sur_place", `${tr("Oui : lavés et séchés sur place")} · ${euros(prixSurPlace)}`], ["laverie", tr("Non : lavés en laverie")]], laverie ? "laverie" : "sur_place", "drapsLieu")
          + (laverie && b.lavageLinge ? `<p class="petit">${tr("Serviettes et tapis")} : ${euros(REGLES.LINGE_LAVERIE_PAR_SDB_C)} ${tr("par salle de bain")} · ${tr("torchons")} : ${euros(REGLES.TORCHONS_LAVERIE_C)}</p>` : "")
          + (b.lavageDraps ? (laverie ? "" : `<p class="petit" style="margin:8px 0 0">${tr("Draps lavés sur place")} : ${euros(REGLES.DRAPS_SUR_PLACE_PAR_LIT_C)} ${tr("par lit")}</p>`)
            + compteur(`${tr("Lits 1 place")}${laverie ? ` · ${euros(p.un)}` : ""}`, "lits1", t.un, { min: 0, max: REGLES.LITS_MAX })
            + compteur(`${tr("Lits 2 places")}${laverie ? ` · ${euros(p.deux)}` : ""}`, "lits2", t.deux, { min: 0, max: REGLES.LITS_MAX })
            + compteur(`${tr("Lits king size")}${laverie ? ` · ${euros(p.king)}` : ""}`, "litsKing", t.king, { min: 0, max: REGLES.LITS_MAX })
            : "")
          + `<p class="petit">${tr(laverie ? "Sans sèche-linge, le Cleaneur porte le linge à la laverie : trajet et machines compris." : "Le Cleaneur lance les machines, refait les lits et remet serviettes et tapis.")}</p>`; })() : ""}</div>`
    + repli("etapes-location", "Étapes photo et consommables", `${tr("Pack conseillé appliqué")} · ${etapes.length + perso.length} ${tr("étapes")}`,
        detail + `<div class="carte" style="margin-top:10px">${caseCocher("Mémoriser ces étapes pour ce logement", "memoriserEtapes", b.memoriserEtapes !== false)}</div>`);
}

/** Questions affichées sous les formules, selon leur genre (QuestionsFormule dans l'appli). */
function questionsFormule(r) {
  const f = formuleDe(b);
  if (f.genre === "REGULIER") {
    const jours = b.jours || [];
    return titre("Fréquence de passage") + choix(r.frequences, b.frequence || "semaine", "frequence")
      + (b.frequence === "plusieurs" ? titre("Jours de passage") + `<div class="choix">${JOURS_SEMAINE.map(([n, nom]) =>
        `<button type="button" data-jour-passage="${n}" class="${jours.includes(n) ? "choisi" : ""}">${nom}</button>`).join("")}</div><p class="petit">Au moins deux jours.</p>` : "")
      + titre("Moment de passage") + choix(r.moments, b.moment, "moment")
      + titre("Durée d'engagement") + choix([["0", "Sans engagement"], ["3", "3 mois −5 %"], ["6", "6 mois −10 %"], ["12", "12 mois −15 %"]], b.engagementMois, "engagementMois")
      + `<p class="petit">Plus vous vous engagez, moins chaque passage vous coûte.</p>`
      + `<div class="carte" style="margin-top:10px">${caseCocher("Le même Cleaneur à chaque passage, si possible", "memeCleaneur", b.memeCleaneur !== false)}
        ${compteur("Passages à planifier", "passages", b.passages || REGLES.PASSAGES_DEFAUT, { min: REGLES.PASSAGES_MIN, max: REGLES.PASSAGES_MAX })}
        <p class="petit">Chaque passage est une demande séparée, au même prix.</p></div>`;
  }
  // Ménage du logement : l'occasion se choisit dans « Quel ménage ? » (cartes, avec le niveau) ; ailleurs, en pastilles avec leur niveau.
  let h = f.genre === "PONCTUEL" && r.occasions.length && r.id !== "home" ? titre("À quelle occasion ?") + choixOccasions(r) : "";
  // Remise en état (et Grand ménage) : dernier nettoyage en profondeur
  if (f.avecDernierNettoyage) h += titre("Dernier nettoyage en profondeur") + choix(DERNIERS_NETTOYAGES.map(d => [d.id, d.libelle]), b.dernierNettoyage, "dernierNettoyage");
  // Nature des salissures (choix multiple, liste propre à la rubrique)
  if (f.avecNatures) {
    const natures = b.natures || [];
    h += (r.naturesSalissure.length ? titre("Nature des salissures") + `<div class="carte">${r.naturesSalissure.map(n =>
        `<label class="case"><input type="checkbox" data-nature="${esc(n)}" ${natures.includes(n) ? "checked" : ""}><span>${esc(n)}</span></label>`).join("")}</div>` : "");
  }
  if (b.rubriqueId === "kitchen" && f.id === "controle") h += titre("Date du contrôle (si connue)") + champTexte("Date (facultatif)", "dateControle", b.dateControle || "", "date");
  return h;
}

/** Canapés et textiles : choix d'un élément de la formule, taille, quantité, puis ajout au panier (PanierTextiles dans l'appli). */
function ligneEnCours() {
  const elements = ELEMENTS_TEXTILES.filter(e => e.formuleId === (b.formuleId || (b.rubriqueId === "hospitality" ? "camping" : "canape")));
  const e = elements.find(x => x.id === b.elementTextile) || elements[0];
  return { elements, e, ligne: { elementId: e.id, tailleId: e.avecTaille ? b.tailleCanape || "t15" : "", quantite: b.quantitePanier || 1, surfaceM2: e.parM2 ? b.surfaceMoquette || 1 : 0 } };
}
function panierTextiles() {
  const { elements, e, ligne } = ligneEnCours();
  const panier = b.panier || [];
  const heb = b.rubriqueId === "hospitality";
  return titre("Votre panier")
    + `<div class="note">${heb ? "Ajoutez chaque type de logement avec son nombre : par exemple 24 mobil-homes 2 chambres et 6 chalets pour la rotation du samedi."
      : "Choisir un élément ne suffit pas : ajoutez chaque canapé, fauteuil, matelas ou tapis au panier."}</div>`
    + `<div class="carte" style="margin-top:10px">${choix(elements.map(x => [x.id, x.nom]), e.id, "elementTextile")}`
    + (e.avecTaille ? `<p class="petit"><b>Taille</b></p>${choix(TAILLES_CANAPE.map(t => [t.id, t.libelle]), b.tailleCanape || "t15", "tailleCanape")}` : "")
    + (e.parM2 ? compteur("Surface de moquette", "surfaceMoquette", b.surfaceMoquette || 10, { min: 1, max: 300, unite: " m²" }) : "")
    + compteur("Quantité", "quantitePanier", b.quantitePanier || 1, { min: 1, max: heb ? 300 : 20, pas: 1 })
    + `<div style="display:flex;align-items:center;margin-top:8px"><b style="flex:1">${euros(prixLigne(ligne))}</b>
      <button type="button" class="lien-bouton" id="ajouter-panier">Ajouter au panier</button></div></div>`
    + `<div class="carte ${panier.length ? "teintee" : ""}" style="margin-top:10px">${panier.length ? "" : `<p class="muet" style="margin:0">Votre panier est vide.</p>`}`
    + panier.map((l, i) => `<div style="display:flex;align-items:center;gap:8px"><span style="flex:1">${esc(libelleLigne(l))}<span class="petit" style="display:block">${duree(minutesLigne(l))}</span></span>
      <span>${euros(prixLigne(l))}</span><button type="button" class="lien-bouton" style="color:var(--erreur)" data-retirer-panier="${i}">Retirer</button></div>`).join("")
    + `<p class="petit">Minimum de commande : ${euros(heb ? REGLES.MINIMUM_COMMANDE_HEBERGEMENT_C : REGLES.MINIMUM_COMMANDE_TEXTILES_C).replace(",00", "")}. Prix forfaitaire par élément, la durée sert au planning.</p>
      ${heb ? `<p class="petit">${tr("Au-delà de 6 h de travail, plusieurs Cleaneurs se partagent la rotation. Un même Cleaneur intervient au plus 4 jours sur 7 chez vous : Cleaneroo assure des renforts et des pics, pas un emploi permanent.")}</p>` : ""}</div>`
    + (heb ? "" : titre("Taches à traiter") + `<div class="choix">${TACHES_A_TRAITER.map(t =>
      `<button type="button" data-tache-a-traiter="${esc(t)}" class="${(b.tachesATraiter || []).includes(t) ? "choisi" : ""}">${esc(t)}</button>`).join("")}</div>`);
}

function etape3() {
  const obl = photosObligatoires(b.rubriqueId);
  const vues = vuesPhotos(b);
  const blocVues = vues.length ? `<p class="petit"><b>${obl ? "Une photo obligatoire par vue :" : "Vues suggérées :"}</b></p><div class="carte">${vues.map(v => {
    const prise = !!vuesPrises[v];
    return `<div style="display:flex;align-items:center;gap:8px;padding:4px 0"><b style="width:20px;color:${prise ? "var(--succes)" : "var(--muet, #999)"}">${prise ? "✓" : "○"}</b>
      <span style="flex:1">${esc(v)}</span>
      <label class="lien-bouton" style="cursor:pointer">${icone("photo")} ${prise ? "Reprendre" : "Photo"}<input type="file" accept="image/*" capture="environment" data-vue="${esc(v)}" hidden></label>
      <label class="lien-bouton" style="cursor:pointer">Galerie<input type="file" accept="image/*" data-vue="${esc(v)}" hidden></label></div>`;
  }).join("")}</div>` : "";
  const location = b.rubriqueId === "rental";
  // 22/11/2026 : déménagement et fin de chantier : « Photos plus tard » (le Cleaneur les prend à son arrivée) ne bloque plus.
  const plusTard = obl && photosPlusTardPossibles(b.rubriqueId);
  const pret = obl ? (vues.length ? vuesCompletes(b, Object.keys(vuesPrises)) : photos.length > 0) || (plusTard && !!b.sansPhotos) : (location || photos.length > 0 || !!b.sansPhotos);
  return `<h2>${location ? "Une dernière remarque ?" : "Ajoutez des photos pour préciser votre besoin"}</h2>
    ${obl ? `<div class="note alerte" style="margin:10px 0">${b.rubriqueId === "kitchen" ? "4 photos obligatoires de la cuisine (4 angles)." : "Photos obligatoires de l'état actuel, pré-analysées (luminosité, pièce reconnue)."}</div>` : ""}
    ${location ? `<label class="champ" style="font-weight:400"><textarea data-texte="remarque" rows="4" maxlength="2000" placeholder="Ex. : arrivée des voyageurs à 16 h">${esc(b.remarque)}</textarea></label>` : ""}
    ${blocVues}
    <div class="carte ${vues.length ? "masque" : ""}"><div class="vignettes" id="vignettes">${photos.map((f, i) => `<img alt="Photo ${i + 1}" data-i="${i}">`).join("")}</div>
      <div class="boutons-photo"><label class="bouton secondaire" style="cursor:pointer">${icone("photo")} Prendre une photo<input type="file" id="photos-appareil" accept="image/*" capture="environment" hidden></label>
      <label class="bouton secondaire" style="cursor:pointer">+ Choisir dans la galerie<input type="file" id="photos" accept="image/*" multiple hidden></label></div>
      <p class="petit">12 photos maximum. Elles sont réduites avant l'envoi.</p></div>
    ${obl ? (plusTard ? `<div class="carte" style="margin-top:10px">${caseCocher("Photos plus tard : le Cleaneur les prendra à son arrivée", "sansPhotos", !!b.sansPhotos, "Pour un logement ou un chantier pas encore accessible. Le prix reste une estimation : le Cleaneur peut proposer un supplément sur place, avec photo.")}</div>` : "")
      : `<div class="carte" style="margin-top:10px">${caseCocher("Je ne peux pas encore photographier l'état actuel", "sansPhotos", !!b.sansPhotos)}</div>`}
    ${actions(pret, pret ? "" : obl ? (plusTard ? "Ajoutez une photo pour chaque vue, ou choisissez « Photos plus tard »." : "Ajoutez une photo pour chaque vue.") : "Ajoutez une photo ou cochez la case.")}`;
}

function joursProposes() {
  const j = []; const d = new Date(); d.setHours(0, 0, 0, 0);
  for (let i = 1; i <= 21; i++) { const x = new Date(d); x.setDate(d.getDate() + i); j.push(x); }
  return j;
}
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function debutChoisi() {
  if (!b.jour || b.heure < 0 || b.flexible) return null;
  const [a, m, j] = b.jour.split("-").map(Number);
  return new Date(a, m - 1, j, Math.floor(b.heure), Math.round((b.heure % 1) * 60), 0);
}

let changerLogement = false;   // étape 4 : liste des logements dépliée pour en changer
/** Étape 4 : logement choisi à l'étape 1, rappelé en une ligne (« Changer » rouvre la liste). */
function logementChoisiEtape4() {
  const l = b.logementId && biensPour(b.rubriqueId).find(x => x.id === b.logementId);
  if (!l || changerLogement) return "";
  return `<div class="logement-choisi">${icone(iconeBien(l))} <b>${esc(nomLogement(l))}</b> <span class="petit">${esc(l.rue)}, ${esc(l.codePostal)} ${esc(l.ville)}</span>
    <button type="button" class="lien-bouton" data-changer-logement>${tr("Changer")}</button></div>`;
}

/** Accès protégé d'un véhicule (colonne acces : visible du Cleaneur une fois la mission confirmée). Fonction pure, testée. */
export function accesVehicule(b) {
  const r = remiseCles(b), rest = r === "SANS" ? "" : (b.restitution || "MEME");
  const arrondi = x => Number.isFinite(x) ? Math.round(x * 1e6) / 1e6 : null;
  return {
    cles: r, accueilEntreprise: r === "ACCUEIL" || undefined,
    restitution: rest || undefined,
    restitutionLieu: rest === "ACCUEIL" && r !== "ACCUEIL" ? (b.accueilRestitution || "").trim() : undefined,
    vehicule: { repere: (b.vehRepere || "").trim(), modele: (b.vehModele || "").trim(), immat: (b.vehImmat || "").trim().toUpperCase(),
      accesParking: (b.vehAccesParking || "").trim() || undefined, lat: arrondi(b.vehLat), lon: arrondi(b.vehLon) },
  };
}
/** Véhicules (26/11/2026) : où trouver la voiture. Transmis au Cleaneur une fois la mission confirmée. */
function blocOuVehicule() {
  return titre("Où trouver le véhicule") + `<div class="carte">
      ${champTexte("Repère précis", "vehRepere", b.vehRepere || "", "text", 'maxlength="120" placeholder="Ex. : parking sous-sol, niveau -2, place 47"')}
      ${["parking", "travail"].includes(b.lieuVehicule) ? champTexte("Accès au parking (code du portail, badge, interphone)", "vehAccesParking", b.vehAccesParking || "", "text", 'maxlength="120" autocomplete="off"') : ""}
      <div class="grille-2">${champTexte("Marque, modèle et couleur", "vehModele", b.vehModele || "", "text", 'maxlength="80" placeholder="Ex. : Peugeot 208 grise"')}
        ${champTexte("Immatriculation", "vehImmat", b.vehImmat || "", "text", 'maxlength="20" autocapitalize="characters" placeholder="AB-123-CD"')}</div>
      <p class="petit" style="margin:0">Ces informations ne sont transmises au Cleaneur qu'une fois la mission confirmée.</p></div>`;
}

/** Heure décimale affichée (10.5 → « 10 h 30 »). */
const heureDec = h => heure(Math.floor(h), Math.round((h % 1) * 60));
function etape4() {
  const maintenant = new Date();
  const location = b.rubriqueId === "rental";
  // Créneaux toutes les 30 minutes, selon la prestation (26/11/2026) ; location saisonnière : entre le départ et l'arrivée des voyageurs.
  const dureeEst = calculer(entreeEstimation(b, b.espace === "personnel", null)).dureeMin;
  const heures = heuresProposees(b, dureeEst);
  const tient = !location || menageTientEntreVoyageurs(b, dureeEst);
  const jourDate = b.jour ? new Date(b.jour + "T00:00") : null;
  const creneaux = jourDate ? heures.map(h => {
    const c = new Date(jourDate); c.setHours(Math.floor(h), Math.round((h % 1) * 60));
    const dispo = disponibilite(maintenant, c);
    return `<button type="button" data-heure="${h}" class="${b.heure === h ? "choisi" : ""} ${{ MALIN: "malin", FORTE_DEMANDE: "forte", PEU: "peu" }[dispo] || ""}" ${dispo === "INDISPONIBLE" ? "disabled" : ""}
      title="${{ MALIN: "Créneau malin −10 %", FORTE_DEMANDE: "Forte demande", PEU: "Peu de Cleaneurs" }[dispo] || ""}">${heureDec(h)}</button>`;
  }).join("") : "";
  const adresseOk = b.rue.trim().length >= 3 && /^[0-9]{5}$/.test(b.codePostal) && b.ville.trim();
  const creneauOk = b.flexible || (b.jour && b.heure >= 0 && heures.includes(b.heure));
  const vehicule = b.rubriqueId === "car";
  const vehiculeOk = !vehicule || ((b.vehRepere || "").trim() && (b.vehModele || "").trim() && (b.vehImmat || "").trim());
  const manque = !adresseOk ? "Vérifiez l'adresse pour continuer."
    : !vehiculeOk ? "Indiquez où trouver le véhicule (repère, modèle et couleur, immatriculation)."
    : !tient ? "Le ménage ne tient pas entre le départ et l'arrivée suivante : avancez le départ ou retardez l'arrivée." : !creneauOk ? "Choisissez un créneau." : "";
  return `<h2>Adresse et créneau</h2>
    ${logementChoisiEtape4()}
    ${biensPour(b.rubriqueId).length && (!b.logementId || changerLogement) ? `${titre(categoriesDeRubrique(b.rubriqueId).includes("logement") ? "Choisissez une adresse déjà renseignée" : "Choisissez un bien déjà enregistré")}${biensPour(b.rubriqueId).map(l => `<button type="button" class="option ${b.logementId === l.id ? "choisi" : ""}" data-logement="${l.id}">${esc(nomLogement(l))}<span class="detail">${esc(l.rue)}, ${esc(l.codePostal)} ${esc(l.ville)}</span></button>`).join("")}
      <button type="button" class="option ${b.logementId ? "" : "choisi"}" data-logement="">+ Ajouter une nouvelle adresse</button>` : ""}
    <div class="carte ${b.logementId ? "masque" : ""}" style="margin-top:14px">
      <button type="button" class="bouton secondaire plein bouton-geoloc" data-geoloc>${icone("position")}<span>Me géolocaliser</span></button>
      <p class="petit centre" style="margin:6px 0 2px">Vous êtes dans le logement ? Sélectionnez « Me géolocaliser » : l'adresse se remplit toute seule. Sinon, saisissez-la.</p>
      ${messageGeoloc ? `<p class="${messageGeoloc.startsWith("Recherche") ? "petit" : "erreur"}" style="margin:6px 0 0">${messageGeoloc}</p>` : ""}
      ${champTexte("Rue", "rue", b.rue, "text", 'autocomplete="street-address" maxlength="200"')}
      <div class="grille-2">${champTexte("Code postal", "codePostal", b.codePostal, "text", 'inputmode="numeric" maxlength="5" autocomplete="postal-code"')}${champTexte("Ville", "ville", b.ville, "text", 'autocomplete="address-level2" maxlength="100"')}</div>
      <p class="petit">Elle sert au calcul du déplacement et à l'arrivée du Cleaneur.</p></div>
    ${Number.isFinite(b.lat) ? `<div class="carte-adresse" id="carte-adresse" role="img" aria-label="${vehicule ? "Carte : position du véhicule" : "Carte de l'adresse"}"></div>
      <p class="petit" style="margin:6px 0 0">${vehicule ? "Déplacez le repère exactement sur la place du véhicule." : b.logementId ? "Position enregistrée du logement." : "Déplacez le repère sur l'entrée du logement si besoin."}</p>` : ""}
    ${vehicule ? blocOuVehicule() : ""}
    ${/^[0-9]{5}$/.test(b.codePostal) ? `<div class="note" style="margin-top:10px"><span>${mentionCodePostal(b.codePostal)}</span></div>` : ""}
    ${titre("Sélectionnez un créneau dans le planning")}${`
    <div class="carte">${caseCocher("Je suis flexible", "flexible", b.flexible, "Vous recevez des candidatures sur 7 jours")}</div>
    ${b.flexible ? "" : `<div class="jours" style="margin-top:12px">${joursProposes().map(d => `<button type="button" data-jour="${iso(d)}" class="${b.jour === iso(d) ? "choisi" : ""}">${dateCourte(d)}</button>`).join("")}</div>
      ${jourDate ? `<div class="creneaux" style="margin-top:12px">${creneaux}</div>
        <div class="legende-creneaux petit"><span class="dispo">Disponible</span><span class="malin">Créneau malin −10 %</span><span class="forte">Forte demande</span><span class="peu">Peu de Cleaneurs</span></div>` : `<p class="petit">Choisissez un jour.</p>`}
      ${jourDate && b.heure >= 0 ? `<div class="note" style="margin-top:10px">Arrivée entre ${heureDec(b.heure)} et ${heureDec(b.heure + fenetreArriveeH(b))} · ${dateLongue(jourDate)}</div>`
        + (disponibilite(maintenant, new Date(jourDate.getFullYear(), jourDate.getMonth(), jourDate.getDate(), Math.floor(b.heure), Math.round((b.heure % 1) * 60))) === "PEU" ? `<div class="note alerte" style="margin-top:8px">Peu de Cleaneurs sur ce créneau : prévoyez une solution de repli.</div>` : "") : ""}
      <p class="petit">Réservation au moins 24 h à l'avance. Pour une urgence, la nuit ou un événement : horaire particulier (bientôt).</p>`}`}
    ${location ? `<div class="note ${tient ? "" : "alerte"}" style="margin-top:10px">Départ des voyageurs à ${b.departVoyageursH ?? 10} h · fin avant ${b.arriveeSuivanteH ?? 16} h</div>`
      + (tient ? "" : `<div class="note alerte" style="margin-top:8px">Le ménage ne tient pas entre le départ et l'arrivée suivante : avancez le départ ou retardez l'arrivée.</div>`) : ""}
    ${actions(!manque, manque)}`;
}

/* « Être prévenu » : après le lancement, une prestation ne se réserve que si un Cleaneur validé couvre l'adresse. */
let couverture = { cle: "", n: null }, attente = "";
function verifierCouverture() {
  if (!b || !Number.isFinite(b.lat)) return null;
  const cle = `${b.rubriqueId}|${b.lat.toFixed(3)}|${b.lon.toFixed(3)}`;
  if (couverture.cle !== cle) {
    couverture = { cle, n: null }; attente = "";
    secteurCouvert(b.rubriqueId, b.lat, b.lon).then(n => {
      if (couverture.cle !== cle || !racine?.isConnected) return;
      couverture.n = n;
      if (b?.etape === 5) rendre();
      else if (b?.etape >= 2) majRecap();   // seul le récapitulatif change : la saisie en cours n'est pas interrompue
    }).catch(() => {});
  }
  return couverture.n;
}
/** Réservations pas encore ouvertes (interrupteur, 24/11/2026) : rien n'est envoyé ni payé ; être prévenu de l'ouverture. */
function blocFermees(contactOk) {
  if (attente === "ok") return `<div class="carte" style="margin-top:14px;border-color:var(--primaire)"><h3 style="margin:0 0 6px">C'est enregistré.</h3>
    <p class="muet" style="margin:0">Nous vous prévenons dès l'ouverture des réservations. Votre estimation est gardée en brouillon.</p></div>`;
  return `<div class="carte" style="margin-top:14px"><h3 style="margin:0 0 6px">Les réservations ouvrent très bientôt</h3>
    <p class="muet" style="margin:0 0 6px">Rien n'est envoyé ni payé pour l'instant. Laissez vos coordonnées : nous vous prévenons dès l'ouverture, et votre estimation est gardée.</p>
    ${attente === "erreur" ? `<p class="erreur" style="margin:6px 0 0">Le service est momentanément indisponible. Réessayez dans quelques minutes.</p>` : ""}</div>
    ${actions(contactOk && attente !== "envoi", contactOk ? "" : "Complétez vos coordonnées.", attente === "envoi" ? "Envoi en cours…" : "Être prévenu de l'ouverture", "prevenir")}`;
}
function blocAttente(r, contactOk) {
  if (attente === "ok") return `<div class="carte" style="margin-top:14px;border-color:var(--primaire)"><h3 style="margin:0 0 6px">C'est enregistré.</h3>
    <p class="muet" style="margin:0">Nous vous prévenons par e-mail dès qu'un Cleaneur qualifié intervient dans votre secteur. Votre demande est gardée en brouillon.</p></div>`;
  return `<div class="carte" style="margin-top:14px"><h3 style="margin:0 0 6px">Pas encore de Cleaneur dans votre secteur</h3>
    <p class="muet" style="margin:0 0 6px">Cette prestation n'est pas encore proposée à votre adresse : nous recrutons. Laissez vos coordonnées, nous vous prévenons dès qu'un Cleaneur qualifié s'installe près de chez vous.</p>
    ${attente === "erreur" ? `<p class="erreur" style="margin:6px 0 0">Le service est momentanément indisponible. Réessayez dans quelques minutes.</p>` : ""}</div>
    ${actions(contactOk && attente !== "envoi", contactOk ? "" : "Complétez vos coordonnées.", attente === "envoi" ? "Envoi en cours…" : "Être prévenu", "prevenir")}`;
}
async function prevenir() {
  attente = "envoi"; rendre();
  try { await rejoindreAttente({ ...b }); attente = "ok"; } catch { attente = "erreur"; }
  rendre();
}

function etape5() {
  const r = rubrique(b.rubriqueId);
  const debut = debutChoisi();
  const est = estimer(b, debut);
  const contactOk = b.prenom.trim() && b.nom.trim() && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.email) && b.telephone.replace(/\D/g, "").length >= 10;
  const manque = !contactOk ? "Complétez vos coordonnées." : !b.cgv ? "Acceptez les conditions pour envoyer la demande." : "";
  return `<h2>Votre estimation</h2>
    <p class="muet">${icone(r.icone)} ${r.nom} · ${est.nombreCleaneurs === 2 ? `2 Cleaneurs × ${duree(est.dureeMin)}` : duree(est.dureeMin)}</p>
    ${reservationsFermees() ? `<div class="note" style="margin-top:10px"><span><b>Les réservations ouvrent très bientôt.</b> ${MESSAGE_LANCEMENT} Votre estimation est gardée : vous pourrez l'envoyer dès l'ouverture.</span></div>` : ""}
    <div class="carte" style="margin-top:12px">
      ${est.devisObligatoire ? `<h3 style="color:var(--primaire)">Sur devis</h3><p class="muet" style="margin:4px 0 0">Un professionnel qualifié évalue votre besoin et vous propose un devis. Aucun engagement.</p>`
        : est.lignes.filter(l => !ligneZone(l)).map(l => { const inclus = l.montantC === 0 && l.note === "inclus";
            return `<div class="ligne-montant"><span>${esc(l.libelle)}${l.note && !inclus ? `<span class="note-ligne">${l.note}</span>` : ""}</span><span>${inclus ? "Inclus" : euros(l.montantC)}</span></div>`; }).join("")
          + `<div class="ligne-montant total"><span>Total estimé</span><span>${euros(est.totalC)}</span></div>
             ${est.prixLibre ? `<p class="petit">${tr("Prix conseillé Cleaneroo pour ce logement")} : <b>${euros(est.prixConseilleC)}</b>. ${tr("Les frais Cleaneroo sont compris dans ce prix : le Cleaneur reçoit le reste.")}</p>
               ${messagePlancher(est.totalC, est.prixConseilleC) ? `<div class="note"><span>${messagePlancher(est.totalC, est.prixConseilleC)}</span></div>` : ""}` : ""}
             ${est.fraisServicePct ? `<div class="ligne-montant"><span>${tr("Frais de service Cleaneroo")} (${est.fraisServicePct} %)</span><span>${euros(est.fraisServiceC)}</span></div>`
               : b.abonnePro ? `<div class="ligne-montant"><span>${tr("Frais de service Cleaneroo")}</span><span>${tr("0 € (abonné)")}</span></div>` : ""}
             ${est.remiseParrainageC ? `<div class="ligne-montant remise"><span>${tr("Remise de parrainage")}</span><span>−${euros(est.remiseParrainageC)}</span></div>` : ""}
             ${est.cagnotteC ? `<div class="ligne-montant remise"><span>${tr("Ma cagnotte")}</span><span>−${euros(est.cagnotteC)}</span></div>` : ""}
             ${est.fraisServicePct || est.remiseParrainageC || est.cagnotteC ? `<div class="ligne-montant total"><span>${tr("Total à payer")}</span><span>${euros(est.totalAPayerC)}</span></div>` : ""}
             ${/^[0-9]{5}$/.test(b.codePostal || "") ? `<p class="petit mention-cp">${icone("position")} ${mentionCodePostal(b.codePostal)}</p>` : ""}
             ${b.remiseParrainageC && !est.remiseParrainageC ? `<p class="petit">${tr("Votre remise de parrainage de")} ${euros(b.remiseParrainageC)} ${tr("s'applique dès")} ${euros(REGLES.PARRAINAGE_MIN_COMMANDE_C)}.</p>` : ""}
             ${b.cagnotteDispoC > 0 ? caseCocher(`${tr("Utiliser ma cagnotte")} (${euros(b.cagnotteDispoC)} ${tr("disponibles")})`, "utiliserCagnotte", !!b.utiliserCagnotte) : ""}
             ${est.creditImpotC ? `<div class="ligne-montant" style="color:var(--succes);font-weight:700"><span>soit ${euros(est.apresCreditImpotC)} après crédit d'impôt, si éligible</span></div>` : ""}
             <p class="petit">Prix approximatif : le montant final ne peut pas le dépasser sans votre accord.</p>
             ${est.nombreCleaneurs === 2 ? `<p class="petit">Au-delà de 6 h de travail, la mission est confiée à 2 Cleaneurs.</p>` : ""}
             ${passagesPlanifies(b) > 1 && !(b.rubriqueId === "car" && b.pass) ? `<p class="petit">${passagesPlanifies(b)} passages planifiés : chaque passage est une demande séparée, au même prix.</p>` : ""}`}
    </div>
    ${est.devisObligatoire ? "" : blocPass(true)}
    ${est.creditImpotC ? `<p class="petit">50 % des dépenses pour les prestations éligibles réalisées à votre domicile (résidence principale ou secondaire), dans la limite des plafonds légaux (12 000 € par an, majorés dans certains cas).</p>` : ""}
    ${titre("Choix du Cleaneur")}${blocChoixCleaneur(est)}
    ${titre("Vos garanties")}${blocReassurance({ compact: true })}
    ${titre("Vos coordonnées")}
    <div class="carte"><div class="grille-2">${champTexte("Prénom", "prenom", b.prenom, "text", 'autocomplete="given-name" maxlength="80"')}${champTexte("Nom", "nom", b.nom, "text", 'autocomplete="family-name" maxlength="80"')}</div>
      <div class="grille-2">${champTexte("E-mail", "email", b.email, "email", 'autocomplete="email" maxlength="200"')}${champTexte("Téléphone", "telephone", b.telephone, "tel", 'autocomplete="tel" maxlength="20"')}</div></div>
    ${titre("Suivi par SMS")}
    <div class="carte">${caseCocher("Suivi par SMS", "suiviSms", !!b.suiviSms, `${euros(REGLES.OPTION_SMS_C)} : un SMS au nom de Cleaneroo à chaque étape (confirmation, « en route » avec l'heure d'arrivée, arrivée, fin avec le compte rendu), dans la langue de votre réservation.`)}
      ${b.suiviSms && b.accueil === "TIERS" && b.tiersNom.trim() ? caseCocher(`Envoyer aussi les SMS à ${esc(b.tiersNom.trim())}`, "smsTiers", !!b.smsTiers) : ""}</div>
    ${titre("Photos avant le ménage")}
    <div class="carte">${photosAvantObligatoires(b.rubriqueId) ? `<p class="photos-obligatoires">${icone("appareil-photo")} <span>${tr("Le Cleaneur photographie chaque pièce ou zone avant et après l'intervention. Les photos sont horodatées et rangées dans votre espace avec le compte rendu signé.")}</span></p>` : caseCocher("Photos avant exigées", "photosAvantExigees", !!b.photosAvantExigees, "Le Cleaneur photographie chaque pièce avant et après le ménage. Conseillé pour les locations saisonnières et les états des lieux. Sinon, il photographie chaque pièce après le ménage et signale tout problème constaté à son arrivée.")}</div>
    <div style="margin-top:14px">${encartAideRappel()}</div>
    ${notePaiement(est)}
    <div class="carte" style="margin-top:12px">${caseCocher(`J'accepte les <a href="#/conditions" target="_blank">conditions d'utilisation</a> et la <a href="#/confidentialite" target="_blank">politique de confidentialité</a>`, "cgv", b.cgv)}</div>
    ${reservationsFermees() ? blocFermees(contactOk) : verifierCouverture() === 0 ? blocAttente(r, contactOk) : actions(!manque && !envoi, manque, envoi ? "Envoi en cours…" : est.devisObligatoire ? "Envoyer ma demande de devis" : "Payer et envoyer ma demande", "envoyer")}`;
}

/** Paiement (22/11/2026, règle de l'utilisateur) : payé à l'envoi, bloqué jusqu'à la validation, versé ensuite au Cleaneur. */
function notePaiement(est) {
  if (est.devisObligatoire) return `<div class="note" style="margin-top:14px">${icone("paiement")} <span>${tr("Aucun paiement maintenant : le paiement vous sera proposé avec le devis.")}</span></div>`;
  return `<div style="margin-top:14px">${encartPaiementSecurise()}</div>`
    + `<p class="petit muet" style="margin:8px 0 0">${tr("Votre demande est transmise aux Cleaneurs dès le paiement. Demande annulée : vous êtes remboursé.")}</p>`
    + (passagesPlanifies(b) > 1 ? `<p class="petit" style="margin:6px 0 0">${icone("calendrier")} ${tr("Entretien régulier : le 1er passage est payé maintenant ; les suivants sont prélevés automatiquement sur la même carte, 3 jours avant chaque passage.")}</p>` : "");
}

/* ------------------------------------------------------------------ Récapitulatif toujours visible (prompt 4, lot 4)
   Prix, durée, date et heure, lieu, Cleaneur et disponibilité à l'adresse, du 2e écran jusqu'au paiement : aucune surprise.
   Grand écran : colonne à droite, qui suit le défilement. Téléphone : une ligne au-dessus des boutons, qui déplie le détail. */
function valeursRecap(est) {
  const r = rubrique(b.rubriqueId), f = formuleDe(b);
  const debut = debutChoisi();
  const prix = est.devisObligatoire ? tr("Sur devis") : euros(est.fraisServicePct || est.remiseParrainageC || est.cagnotteC ? est.totalAPayerC : est.totalC);
  const dureeTxt = est.dureeMin ? (est.nombreCleaneurs === 2 ? `2 Cleaneurs × ${duree(est.dureeMin)}` : duree(est.dureeMin)) : "";
  const quand = b.flexible ? tr("Date flexible") : debut ? `${dateCourte(debut)} · ${heure(debut.getHours())}-${heure(debut.getHours() + 1)}` : b.jour ? `${dateCourte(new Date(b.jour + "T00:00"))} · ${tr("heure à choisir")}` : "";
  const logement = b.logementId ? logements().find(l => l.id === b.logementId) : null;
  const lieu = logement ? nomLogement(logement) : [b.rue, b.ville].filter(x => String(x || "").trim()).join(", ");
  const c = b.choixCleaneur || "candidatures";
  const fav = c === "favori" ? demandables().find(x => x.cleaneur_id === b.cleaneurFavori) : null;
  const cleaneur = fav ? `${fav.prenom}${fav.initiale ? ` ${fav.initiale}.` : ""} ${tr(fav.fiche ? "(demandé)" : "(favori)")}` : c === "directe" ? tr("Attribué automatiquement") : tr("Vous choisissez parmi les candidats");
  const n = Number.isFinite(b.lat) ? verifierCouverture() : null;
  return { r, f, prix, dureeTxt, quand, lieu, cleaneur, n };
}
function recapitulatif(est) {
  if (!b || b.etape < 2 || !est) return "";
  const v = valeursRecap(est);
  const ligne = (ic, libelle, valeur, manque) => `<li class="${valeur ? "" : "a-choisir"}">${icone(ic)}<span><small>${tr(libelle)}</small><b>${valeur ? esc(valeur) : tr(manque)}</b></span></li>`;
  return `<aside class="recap-resa carte" aria-label="${tr("Récapitulatif de votre réservation")}">
      <button type="button" class="recap-fermer lien-bouton" data-fermer-recap>${tr("Fermer")}</button>
      <div class="recap-tete">${icone(v.r.icone, { tuile: true })}<div><b>${esc(v.r.nom)}</b>${v.f && formulesPour(v.r).length > 1 ? `<span class="petit muet">${esc(v.f.nom)}</span>` : ""}</div></div>
      <ul class="recap-lignes">
        ${ligne("horloge", "Durée estimée", v.dureeTxt, "Selon vos réponses")}
        ${ligne("calendrier", "Date et heure d'arrivée", v.quand, "À choisir à l'étape 4")}
        ${ligne("position", "Lieu", v.lieu, "À indiquer à l'étape 4")}
        ${ligne("cleaneurs", "Cleaneur", b.etape >= 5 ? v.cleaneur : "", "À choisir à l'étape 5")}
      </ul>
      ${v.n === null ? "" : v.n > 0 ? `<p class="recap-dispo ok">${icone("valide")} ${v.n} ${tr(v.n > 1 ? "Cleaneurs vérifiés couvrent votre secteur." : "Cleaneur vérifié couvre votre secteur.")}</p>`
        : v.n === 0 ? `<p class="recap-dispo">${icone("alerte")} ${tr("Pas encore de Cleaneur dans votre secteur")}</p>` : ""}
      <div class="recap-prix"><span>${tr(est.devisObligatoire ? "Prix" : est.fraisServicePct || est.remiseParrainageC || est.cagnotteC ? "Total à payer" : "Total estimé")}</span><b>${v.prix}</b></div>
      ${est.creditImpotC ? `<p class="petit recap-credit">${tr("soit")} ${euros(est.apresCreditImpotC)} ${tr("après crédit d'impôt, si éligible")}</p>` : ""}
      <p class="petit muet recap-paiement">${icone("cadenas")} ${tr(est.devisObligatoire ? "Aucun paiement avant le devis." : "Payé à la réservation, versé au Cleaneur seulement après votre validation.")}</p>
    </aside>`;
}
/** Remet à jour le récapitulatif seul (disponibilité connue après coup). */
function majRecap() {
  const a = racine?.querySelector(".recap-resa");
  if (!a || !b) return;
  a.outerHTML = recapitulatif(estimer(b, debutChoisi()));
  traduire(racine.querySelector(".recap-resa"));
  const f = document.querySelector(".feuille-recap .recap-resa");
  if (f) { f.outerHTML = recapitulatif(estimer(b, debutChoisi())); traduire(document.querySelector(".feuille-recap")); }
}
/** Feuille du récapitulatif (téléphone) : posée sur la page entière, fermée par « Fermer », le fond ou Échap. */
function ouvrirFeuilleRecap() {
  if (!b || document.querySelector(".feuille-recap")) return;
  const declencheur = racine.querySelector("[data-voir-recap]");
  const f = document.createElement("div");
  f.className = "feuille-recap";
  f.setAttribute("role", "dialog"); f.setAttribute("aria-modal", "true"); f.setAttribute("aria-label", tr("Récapitulatif de votre réservation"));
  f.innerHTML = `<div class="feuille-fond" data-fermer-recap></div>${recapitulatif(estimer(b, debutChoisi()))}`;
  document.body.append(f);
  traduire(f);
  declencheur?.setAttribute("aria-expanded", "true");
  const fermer = () => { f.remove(); document.removeEventListener("keydown", echap); declencheur?.setAttribute("aria-expanded", "false"); declencheur?.focus(); };
  const echap = e => { if (e.key === "Escape") fermer(); };
  f.addEventListener("click", e => { if (e.target.closest("[data-fermer-recap]")) fermer(); });
  document.addEventListener("keydown", echap);
  window.addEventListener("hashchange", fermer, { once: true });
  f.querySelector(".recap-fermer")?.focus();
}
/** Ligne courte du récapitulatif (téléphone), au-dessus des boutons : touchez-la pour voir le détail. */
function recapMini() {
  if (!b || b.etape < 2) return "";
  const est = estimer(b, debutChoisi()), v = valeursRecap(est);
  return `<button type="button" class="recap-mini" data-voir-recap aria-expanded="false" aria-label="${tr("Voir le récapitulatif")}"><b>${v.prix}</b>
    <span>${[v.dureeTxt, v.quand, v.lieu ? v.lieu.split(",").pop().trim() : ""].filter(Boolean).map(esc).join(" · ")}</span>${icone("document")}</button>`;
}

function actions(ok, message = "", libelle = "Continuer", id = "suivant") {
  return `<div class="barre-actions">${recapMini()}${message ? `<p class="erreur" style="margin:0 0 8px">${message}</p>` : ""}
    <div style="display:flex;gap:10px">${b.etape > 2 ? `<button type="button" class="bouton secondaire" id="precedent">‹ Retour</button>` : `<button type="button" class="bouton secondaire" id="changer">‹ Prestations</button>`}
    <button type="button" class="bouton plein" id="${id}" ${ok ? "" : "disabled"}>${libelle}</button></div></div>`;
}

/** Chaque question de l'étape (un titre h3 et ce qui le suit) devient une carte numérotée (26/11/2026) : on voit où commence
 *  et où finit chaque rubrique. Les éléments sont déplacés tels quels : leurs écouteurs restent branchés. */
export function rangerEnCartes(etape) {
  if (!etape) return;
  let n = 0;
  [...etape.querySelectorAll(":scope > h3")].forEach(h => {
    const carte = document.createElement("div");
    carte.className = "rubrique-carte";
    h.dataset.n = String(++n);
    h.before(carte);
    const bloc = [];
    for (let x = h; x && (x === h || !(x.tagName === "H3" || x.classList.contains("barre-actions") || x.classList.contains("rubrique-carte"))); x = x.nextElementSibling) bloc.push(x);
    bloc.forEach(x => carte.appendChild(x));
  });
}

/* ------------------------------------------------------------------ Rendu et événements */
/* Parrainage : remise de bienvenue et cagnotte du compte connecté (la base revérifie tout à l'envoi). */
let infosParrain = null;
/** Carnet de Cleaneurs favoris du compte connecté (choix « Mon Cleaneur favori » à l'étape 5). */
let favoris = [];
async function chargerParrainage() {
  infosParrain = null; passCle = ""; passValeur = null;
  if (!(await session().catch(() => null))) { favoris = []; return; }
  favoris = await supabase.rpc("mes_favoris").then(r => r.data || []).catch(() => []);
  infosParrain = await monParrainage().catch(() => null);
  if (infosParrain && b && b.etape === 5 && racine?.isConnected) rendre();
}
/* Choix du Cleaneur (16 novembre 2026) : attribué automatiquement, validé par le client, ou demandé à un Cleaneur favori. */
const directePossible = est => !b.flexible && !est.devisObligatoire;
/** Cleaneurs qu'on peut demander : le carnet de favoris, plus celui choisi sur sa fiche (lot 5). */
const demandables = () => [...favoris, ...(b?.cleaneurChoisi && !favoris.some(f => f.cleaneur_id === b.cleaneurChoisi.cleaneur_id) ? [b.cleaneurChoisi] : [])];
const favoriChoisi = () => demandables().find(f => f.cleaneur_id === b.cleaneurFavori);
/** Choix réellement envoyé : sans favori valable ni réservation directe possible, ce sont les candidatures. */
function choixEnvoye() {
  if (b.choixCleaneur === "favori") return favoriChoisi() ? "favori" : "candidatures";
  if (b.choixCleaneur === "directe") return b.flexible ? "candidatures" : "directe";
  return "candidatures";
}
function blocChoixCleaneur(est) {
  const liste = demandables();
  const c = b.choixCleaneur === "favori" ? (liste.length ? "favori" : "candidatures") : b.choixCleaneur === "directe" && !directePossible(est) ? "candidatures" : b.choixCleaneur || "candidatures";
  const etoiles = f => f.note ? `★ ${String(f.note).replace(".", ",")} · ` : "";
  const h = delaiFavoriH(debutChoisi());
  const surFiche = !!b.cleaneurChoisi;
  const detailListe = f => f.fiche ? (f.nb_avis ? `${etoiles(f)}${f.nb_avis} ${tr(f.nb_avis > 1 ? "avis" : "avis")}` : tr("Choisi sur sa fiche")) : `${etoiles(f)}${f.ensemble} ${tr(f.ensemble > 1 ? "prestations ensemble" : "prestation ensemble")}`;
  return `${directePossible(est) ? `<button type="button" class="option ${c === "directe" ? "choisi" : ""}" data-champ="choixCleaneur" data-valeur="directe">Cleaneur attribué automatiquement
      <span class="detail">Le premier Cleaneur vérifié qui accepte au prix estimé obtient la mission. Le plus rapide, sans rien à faire.</span></button>` : ""}
    <button type="button" class="option ${c === "candidatures" ? "choisi" : ""}" data-champ="choixCleaneur" data-valeur="candidatures">Je valide mon Cleaneur
      <span class="detail">Les Cleaneurs se proposent avec leur horaire et leur prix. Vous êtes prévenu à chaque candidature et vous choisissez.</span></button>
    ${liste.length ? `<button type="button" class="option ${c === "favori" ? "choisi" : ""}" data-champ="choixCleaneur" data-valeur="favori">${tr(surFiche ? "Le Cleaneur que j'ai choisi" : "Mon Cleaneur favori")}
      <span class="detail">${tr("La demande lui est proposée d'abord : il est seul à la voir pendant")} ${h} h. ${tr("S'il n'est pas disponible ou sans réponse, elle s'ouvre aux autres Cleaneurs et vous validez.")}</span></button>
    ${c === "favori" ? `<div class="favoris-choix">${liste.map(f => `<button type="button" class="favori-carte ${f.cleaneur_id === b.cleaneurFavori ? "choisi" : ""}" data-favori-choisi="${esc(f.cleaneur_id)}">
        <span class="avatar-favori">${esc((f.prenom || "?").charAt(0).toUpperCase())}</span><span><b>${esc(f.prenom)} ${esc(f.initiale ? f.initiale + "." : "")}</b>
        <small>${detailListe(f)}</small></span></button>`).join("")}</div>
      ${favoriChoisi() ? "" : `<p class="petit" style="color:var(--alerte)">Choisissez le Cleaneur à qui proposer la demande.</p>`}` : ""}`
    : `<p class="petit">Ajoutez un Cleaneur à vos favoris après une prestation, ou choisissez-le sur sa fiche depuis la recherche : vous pourrez ensuite le demander directement.</p>`}
    `;
}

function appliquerParrainage() {
  if (!b) return;
  b.remiseParrainageC = b.espace === "personnel" || b.espace === "conciergerie" || b.espace === "professionnel" ? infosParrain?.remise_bienvenue_c || 0 : 0;
  b.cagnotteDispoC = infosParrain?.soldes?.[b.espace === "personnel" ? "particulier" : "pro"] || 0;
}

/* Pass Entretien véhicule (26/11/2026, décision de Michael) : palier de fidélité et passage d'entretien calculés par la base
   (mon_pass_entretien, base-pass-entretien.sql), jamais par le navigateur ; le serveur les recalcule avant chaque paiement. */
let passCle = "", passValeur = null;
const argsPass = (br, creneau) => ({ p_creneau: creneau ? creneau.toISOString() : null, p_immat: String(br.vehImmat || "").trim(), p_rue: String(br.rue || "").trim(),
  p_cp: String(br.codePostal || "").trim(), p_freq: br.frequenceVehicule || "unique" });
async function lirePass(args) {
  if (!(await session().catch(() => null))) return null;
  const { data, error } = await supabase.rpc("mon_pass_entretien", args);
  return error || !data ? null : data;
}
const passDe = v => (v ? { n: v.n || 0, bonus: v.bonus || 0, entretien: !!v.entretien } : null);
function appliquerPass() {
  if (!b) return;
  if (b.rubriqueId !== "car") { if (b.pass) b.pass = null; return; }
  const args = argsPass(b, debutChoisi()), cle = JSON.stringify(args);
  b.pass = passCle === cle ? passDe(passValeur) : null;
  if (passCle === cle) return;
  passCle = cle; passValeur = null;
  lirePass(args).then(v => { if (passCle !== cle || !v) return; passValeur = v; if (b && racine?.isConnected) rendre(); }).catch(() => null);
}
/** Passages de la réservation, chacun avec son Pass (le palier monte à chaque passage) et son prix. */
function passagesAvecPass(debut) {
  const nb = passagesPlanifies(b);
  const dates = debut && nb > 1 ? datesPassages(debut, frequenceDe(b), b.jours || [], nb) : [debut];
  return dates.map((d, i) => {
    const pass = b.pass ? { ...b.pass, n: b.pass.n + i, entretien: i > 0 || b.pass.entretien } : null;
    return { d, pass, est: estimer({ ...b, pass }, d) };
  });
}
/** Encart « Pass Entretien » (véhicules) : palier atteint, prochain palier, prix de chaque passage. */
function blocPass(avecPassages = false) {
  if (b.rubriqueId !== "car") return "";
  const P = REGLES.PASS_ENTRETIEN, [p1, p2] = P.PALIERS;
  if (!b.pass) {
    if (profilMemorise()) return "";   // compte connecté : Pass en cours de lecture
    return `<div class="note pass-note" style="margin-top:10px">${icone("repeter")} <span><b>${tr("Pass Entretien")}</b> · ${tr("Avec un compte, vos lavages réguliers coûtent moins cher :")} <span>${tr("passage d'entretien")} −${P.ENTRETIEN_PCT} %</span>, <span>−${p1.pct} % ${tr("dès le 3e passage")}</span>, <span>−${p2.pct} % ${tr("dès le 6e")}</span>.</span></div>`;
  }
  const n = b.pass.n + b.pass.bonus, pal = palierPass(n);
  const ligneSuivant = pal.suivant
    ? `<p class="petit" style="margin:4px 0 0">${pal.suivant.reste > 1 ? `<span>${tr("Encore")} ${pal.suivant.reste} ${tr("passages pour")} −${pal.suivant.pct} %</span>` : `<span>${tr("Plus qu'un passage pour")} −${pal.suivant.pct} %</span>`}</p>`
    : `<p class="petit" style="margin:4px 0 0">${tr("Palier maximal atteint : vous gardez cette remise tant que vous ne sautez pas deux passages de suite.")}</p>`;
  const lignes = avecPassages && passagesPlanifies(b) > 1 ? passagesAvecPass(debutChoisi()) : [];
  return `<div class="carte pass-carte" style="margin-top:10px">
    <p style="margin:0"><b>${icone("repeter")} ${tr("Pass Entretien")}</b> · ${pal.pct ? `<span>${tr("palier")} −${pal.pct} %</span>` : `<span>${tr("pas encore de palier")}</span>`}${b.pass.bonus ? ` · <span>${tr("bonus de parrainage inclus")}</span>` : ""}</p>
    ${ligneSuivant}
    ${b.pass.entretien ? `<p class="petit" style="margin:4px 0 0">${tr("Votre véhicule a été lavé récemment : ce passage d'entretien est plus court, donc moins cher")} (−${P.ENTRETIEN_PCT} %).</p>` : ""}
    ${lignes.length ? `<div style="margin-top:8px">${lignes.map((x, i) => `<div class="ligne-montant"><span>${tr("Passage")} ${i + 1}${x.d ? ` · ${esc(dateCourte(x.d))}` : ""}</span><span>${euros(x.est.totalC + x.est.fraisServiceC - (i ? 0 : x.est.remiseParrainageC + x.est.cagnotteC))}</span></div>`).join("")}</div>` : ""}
    <p class="petit muet" style="margin:6px 0 0">${tr("Chaque passage réservé compte pour le palier ; un passage annulé ne compte plus. Deux passages prévus sautés : vous redescendez d'un palier.")}</p>
  </div>`;
}

/** Le prix « respire » quand il change, avec l'écart affiché un instant (+7,50 €, −3,00 €) : chaque choix montre son effet. */
let prixPrecedent = null;
function signalerPrix() {
  if (!racine) return;
  const els = [...racine.querySelectorAll(".prix-simulation, .prix-barre b, .tete-etape b")];
  const m = els[0]?.textContent.replace(/[\s\u202f\u00a0]/g, "").match(/(\d+),(\d{2})/);
  if (!m) { prixPrecedent = null; return; }
  const c = +m[1] * 100 + +m[2];
  if (prixPrecedent != null && c !== prixPrecedent) {
    els.forEach(el => { el.classList.remove("prix-change"); void el.offsetWidth; el.classList.add("prix-change"); });
    const d = c - prixPrecedent, pastille = document.createElement("span");
    pastille.className = `prix-delta${d < 0 ? " baisse" : ""}`;
    pastille.textContent = `${d > 0 ? "+" : "−"}${euros(Math.abs(d))}`;
    (racine.querySelector(".prix-simulation") || els[0]).append(pastille);
  }
  prixPrecedent = c;
}

// Pas de rendu imbriqué (26/11/2026) : remplacer la page retire le champ en cours de saisie, ce qui déclenche son « change »,
// lequel redemandait un rendu pendant le premier (erreur « The node to be removed is no longer a child »). Il est repoussé juste après.
let enRendu = false;
function rendre() {
  if (enRendu) { queueMicrotask(rendre); return; }
  enRendu = true;
  try { rendreSansReentree(); } finally { enRendu = false; }
}
function rendreSansReentree() {
  queueMicrotask(signalerPrix);
  // Anciens brouillons « Grand ménage » du logement : ménage ponctuel au niveau Premium (le grand ménage, depuis le 18/11/2026).
  if (b && b.rubriqueId === "home" && b.formuleId === "grand") {
    const premium = packsPour(rubrique("home"), b.typeLieuId).find(p => p.id === "prestige");
    b = { ...b, formuleId: "ponctuel", taches: [...new Set([...(b.taches || []), ...(premium ? premium.tacheIds : [])])] };
  }
  // Plus d'« État de saleté » à choisir : seul « Dernier nettoyage en profondeur » règle la salissure.
  if (b && !b.dernierNettoyage && b.salissure !== "NORMAL") b = { ...b, salissure: "NORMAL" };
  if (sim) return rendreSimulation();
  appliquerParrainage();
  appliquerPass();
  const etape = b ? b.etape : 1;
  let est = null;
  if (b && b.rubriqueId && etape > 1) est = estimer(b, debutChoisi());
  racine.innerHTML = `<section class="bloc" style="padding-top:28px"><div class="${est ? "resa-avec-recap" : etape === 1 ? "etroit resa-centre" : "etroit"}"><div class="resa-etape">
    <div class="tete-etape petit">${etape > 1 ? `<button type="button" class="retour-haut" data-retour>‹ Retour</button>` : ""}<span>Étape ${etape} sur 5</span>
      ${est && !est.devisObligatoire ? `<b style="color:var(--primaire)">${est.fraisServicePct || est.remiseParrainageC || est.cagnotteC ? `${tr("Total à payer")} ${euros(est.totalAPayerC)}` : `Total estimé ${euros(est.totalC)}`}</b>` : ""}</div>
    <div class="progression">${[1, 2, 3, 4, 5].map(i => `<span class="${i <= etape ? "fait" : ""}"></span>`).join("")}</div>
    ${[etape1, etape2, etape3, etape4, etape5][etape - 1]()}
  </div>${recapitulatif(est)}</div></section>`;
  traduire(racine);
  rangerEnCartes(racine.querySelector(".resa-etape"));
  if (etape === 1) brancherCentre();
  // Aperçus des photos
  racine.querySelectorAll("#vignettes img").forEach(img => { img.src = URL.createObjectURL(photos[+img.dataset.i]); });
  racine.querySelectorAll("[data-apercu-boite]").forEach(img => { if (photoBoite) img.src = URL.createObjectURL(photoBoite); });
  // Étape 4 : carte de l'adresse (repère déplaçable pour une nouvelle adresse) ; adresse saisie placée sur la carte.
  const boiteCarte = racine.querySelector("#carte-adresse");
  if (boiteCarte && Number.isFinite(b.lat) && b.rubriqueId === "car") afficherCarte(boiteCarte, {
    marqueurs: [{ lat: Number.isFinite(b.vehLat) ? b.vehLat : b.lat, lon: Number.isFinite(b.vehLon) ? b.vehLon : b.lon, couleur: "#1F8A80" }], deplacable: true, zoom: 18,
    vue: { lat: Number.isFinite(b.vehLat) ? b.vehLat : b.lat, lon: Number.isFinite(b.vehLon) ? b.vehLon : b.lon, zoom: 17 },
    onDeplace: (lat, lon) => { b = { ...b, vehLat: lat, vehLon: lon }; sauver(); },   // sans redessiner : la carte garde son état
  }).catch(() => {});
  else if (boiteCarte && Number.isFinite(b.lat)) afficherCarte(boiteCarte, {
    marqueurs: [{ lat: b.lat, lon: b.lon, couleur: "#1F8A80" }], deplacable: !b.logementId,
    onDeplace: async (lat, lon) => {
      const a = await adresseDe(lat, lon);
      maj({ lat, lon, ...(a ? { rue: a.rue || b.rue, codePostal: a.codePostal, ville: a.ville } : {}) });
    },
  }).catch(() => {});
  if (b && b.etape === 4 && !b.logementId && !Number.isFinite(b.lat) && b.rue.trim().length >= 3 && /^[0-9]{5}$/.test(b.codePostal) && b.ville.trim()) {
    const cle = `${b.rue}|${b.codePostal}|${b.ville}`;
    if (cle !== adresseCherchee) {
      adresseCherchee = cle;
      chercherAdresse(`${b.rue} ${b.codePostal} ${b.ville}`, b.codePostal).then(a => {
        if (a && b && `${b.rue}|${b.codePostal}|${b.ville}` === cle) maj({ lat: a.lat, lon: a.lon });
      });
    }
  }
}

document.addEventListener("click", async e => {
  if (!racine || !racine.contains(e.target)) return;
  if (sim && e.target.closest("[data-voir-prix]")) { e.preventDefault(); return racine.querySelector("#resultat-simulation")?.scrollIntoView({ behavior: "smooth", block: "start" }); }
  const t = e.target.closest("button, [data-rubrique]");
  if (!t) return;
  const ds = t.dataset;
  // Récapitulatif sur téléphone : la ligne au-dessus des boutons ouvre le détail en feuille, au premier plan.
  if (ds.voirRecap !== undefined) { ouvrirFeuilleRecap(); return; }
  if (ds.retirerPhotoBoite !== undefined) { photoBoite = null; return rendre(); }
  if (ds.geoloc !== undefined) return geolocaliser();
  if (sim && ds.espace) {
    const p = partie(ds.espace);
    b = p.rubriques.includes(b.rubriqueId) ? { ...b, espace: p.id } : { ...nouveauBrouillon(p.rubriques[0], p.id), etape: 2 };
    sauver(); return rendre();
  }
  if (sim && t.id === "sim-reserver") {
    try { localStorage.setItem(CLE_BROUILLON, JSON.stringify({ ...b, etape: 2 })); } catch { /* rien */ }
    sim = false; location.hash = `#/reserver/${b.rubriqueId}`; return;
  }
  if (ds.espace) { b = b ? { ...b, espace: ds.espace } : { espace: ds.espace, etape: 1 }; sauver(); return rendre(); }
  if (ds.modifierLogement !== undefined) return maj({ modifierLogement: true });
  if (ds.bienEtape2 !== undefined) {
    const l = logements().find(x => x.id === ds.bienEtape2);
    if (l) return maj({ ...avecLogement(b, l), modifierLogement: false });
    // Nouveau bien : description et adresse à saisir (il sera enregistré à l'envoi de la demande).
    return maj({ logementId: "", modifierLogement: true, rue: "", codePostal: "", ville: "", accueil: "", tiersNom: "", tiersTel: "", boiteEmplacement: "", code: "", lat: null, lon: null, port: "", place: "", accesPonton: "" });
  }
  if (ds.favoriChoisi) return maj({ choixCleaneur: "favori", cleaneurFavori: ds.favoriChoisi });
  if (ds.champ === "choixCleaneur" && ds.valeur === "favori") return maj({ choixCleaneur: "favori", cleaneurFavori: favoriChoisi() ? b.cleaneurFavori : demandables()[0]?.cleaneur_id || "" });
  if (ds.logementDepart !== undefined) { b = { ...(b || { etape: 1, espace: "personnel" }), logementDepart: ds.logementDepart }; sauver(); return rendre(); }
  if (ds.reprendre) return reprendreBrouillon(ds.reprendre);
  if (ds.supprimerBrouillon) { oublierBrouillon(ds.supprimerBrouillon); if (b?.rubriqueId === ds.supprimerBrouillon) b = { espace: b.espace || "personnel", etape: 1 }; return rendre(); }
  if (ds.reprendreIa !== undefined) return import("./assistant-ia.js").then(m => m.ouvrirAssistantIA());
  if (ds.exempleCentre) { texteCentre = ds.exempleCentre; const z = racine.querySelector("[data-texte-centre]"); if (z) { z.value = texteCentre; z.focus(); } return; }
  if (ds.retirerCentre !== undefined) { photosCentre.splice(+ds.retirerCentre, 1); return rendre(); }
  if (ds.analyserCentre !== undefined) return analyserCentre();
  if (ds.rubrique) {
    const dep = ds.pourBien || logementDepart();
    const garde = brouillons()[ds.rubrique];
    const nb = b?.rubriqueId === ds.rubrique && b.espace === partieCourante() ? { ...b, etape: 2 }
      : !ds.pourBien && garde && garde.espace === partieCourante() ? { ...garde, etape: 2 } : nouveauBrouillon(ds.rubrique, partieCourante());
    // L'adresse suit la prestation choisie : un rechargement de la page rouvre cette réservation, et non le choix des prestations.
    if (!location.hash.startsWith(`#/reserver/${ds.rubrique}`)) history.replaceState(history.state, "", `#/reserver/${ds.rubrique}`);
    // Bien venu de « Mes biens » ; sinon le brouillon a déjà le dernier bien compatible (choix à l'étape 2).
    b = dep ? avecLogementDepart(nb, dep) : nb;
    sauver(); noterEtape(); rendre(); return window.scrollTo(0, 0);
  }
  if (ds.retour !== undefined) return retour();
  if (ds.champ) {
    let v = ds.valeur;
    if (ds.champ === "engagementMois") v = +v;
    if (ds.champ === "typeLogementId") { const tl = TYPES_LOGEMENT.find(x => x.id === v); return maj({ typeLogementId: v, surface: tl.surface, chambres: tl.chambres, sdb: tl.sdb, niveaux: tl.niveaux }); }
    if (ds.champ === "accueil" && v === b.accueil) return;
    if (ds.champ === "remiseCles") return maj({ remiseCles: v, accueil: CODE_CLES[v] });
    // L'occasion REMPLACE le niveau (tâches de pack) par celui qu'elle indique ; les options personnelles restent (22/11/2026).
    if (ds.champ === "occasion") return maj({ occasion: v, taches: tachesPourOccasion(b, v) });
    // Le dernier nettoyage présélectionne l'état de saleté.
    if (ds.champ === "dernierNettoyage") return maj({ dernierNettoyage: v, salissure: DERNIERS_NETTOYAGES.find(d => d.id === v).salissure });
    return maj({ [ds.champ]: v });
  }
  if (ds.moins) return maj({ [ds.moins]: Math.max(+ds.min, (b[ds.moins] ?? 1) - +ds.pas) });
  if (ds.plus) return maj({ [ds.plus]: Math.min(+ds.max, (b[ds.plus] ?? 1) + +ds.pas) });
  if (ds.formule === "sur-mesure") REPLIS_OUVERTS.add("options");
  if (ds.formule) {
    const r = rubrique(b.rubriqueId), packs = packsPour(r, b.typeLieuId), chiffrees = tachesChiffrees(b);
    const dansPacks = new Set(packs.flatMap(p => p.tacheIds));
    const f = packs.find(p => p.id === ds.formule);
    const ids = (f ? f.tacheIds : []).filter(id => chiffrees.some(t => t.id === id));
    return maj({ taches: [...new Set([...ids, ...b.taches.filter(id => !dansPacks.has(id))])] });
  }
  if (ds.pack) {
    const packs = packsPour(rubrique(b.rubriqueId), b.typeLieuId);
    const p = packs.find(x => x.id === ds.pack);
    const enCours = meilleurPack(packs, b.taches, tachesChiffrees(b));
    // Formule en vert : on la retire. Sinon on remplace la formule en cours par celle-ci.
    if (enCours?.id === p.id) return maj({ taches: b.taches.filter(id => !p.tacheIds.includes(id)) });
    const base = enCours ? b.taches.filter(id => !enCours.tacheIds.includes(id)) : b.taches;
    return maj({ taches: [...new Set([...base, ...p.tacheIds])] });
  }
  if (ds.changerLogement !== undefined) { changerLogement = true; return rendre(); }
  if (ds.logement !== undefined) {
    const l = logements().find(x => x.id === ds.logement);
    changerLogement = false;
    return maj(l ? avecLogement(b, l) : { logementId: "", rue: "", codePostal: "", ville: "", accueil: "", tiersNom: "", tiersTel: "", boiteEmplacement: "", code: "", lat: null, lon: null });
  }
  if (ds.retirer !== undefined) return maj({ tachesPerso: b.tachesPerso.filter((_, i) => i !== +ds.retirer) });
  if (ds.retirerPanier !== undefined) return maj({ panier: (b.panier || []).filter((_, i) => i !== +ds.retirerPanier) });
  if (ds.equipPlus || ds.equipMoins) {
    const id = ds.equipPlus || ds.equipMoins, eq = { ...(b.equipements || {}) };
    eq[id] = Math.max(0, Math.min(20, (eq[id] || 0) + (ds.equipPlus ? 1 : -1)));
    if (!eq[id]) delete eq[id];
    return maj({ equipements: eq });
  }
  if (ds.tacheATraiter) { const l = b.tachesATraiter || [], v = ds.tacheATraiter; return maj({ tachesATraiter: l.includes(v) ? l.filter(x => x !== v) : [...l, v] }); }
  if (t.id === "ajouter-poils") return maj({ taches: [...new Set([...b.taches, "poils"])] });
  if (t.id === "selection-conseillee") return maj({ taches: [...new Set([...b.taches, ...SELECTION_CONSEILLEE_VEHICULE])] });
  if (t.id === "pack-etapes") return maj({ etapesChoisies: [...new Set([...etapesChoisiesDe(b), ...PACK_ETAPES_CONSEILLE])] });
  if (t.id === "pack-conso") return maj({ consommablesChoisis: [...new Set([...consommablesDe(b), ...PACK_CONSOMMABLES_CONSEILLE])] });
  if (ds.retirerEtape !== undefined) return maj({ etapesPerso: (b.etapesPerso || []).filter((_, i) => i !== +ds.retirerEtape) });
  if (t.id === "ajouter-etape") {
    const texte = document.getElementById("saisie-etape").value.trim(), piece = document.getElementById("piece-perso").value;
    if (texte) maj({ etapesPerso: [...(b.etapesPerso || []), { piece, texte }].slice(0, 20) });
    return;
  }
  if (t.id === "ajouter-panier") return maj({ panier: [...(b.panier || []), ligneEnCours().ligne], quantitePanier: 1 });
  if (ds.jourPassage) { const n = +ds.jourPassage, j = b.jours || []; return maj({ jours: j.includes(n) ? j.filter(x => x !== n) : [...j, n].sort() }); }
  if (ds.jour) return maj({ jour: ds.jour, heure: -1 });
  if (ds.heure) return maj({ heure: +ds.heure });
  if (t.id === "ajouter-perso") {
    const s = document.getElementById("saisie-perso").value.trim();
    if (s) maj({ tachesPerso: [...b.tachesPerso, s].slice(0, 10) });
    return;
  }
  if (t.id === "changer" || t.id === "precedent") return retour();
  if (t.id === "suivant") { maj({ etape: b.etape + 1, ...(b.etape === 4 && b.flexible ? { choixCleaneur: "candidatures" } : {}) }, true); return noterEtape(); }
  if (t.id === "envoyer") return envoyer();
  if (t.id === "prevenir") return prevenir();
});

document.addEventListener("change", e => {
  if (!racine || !racine.contains(e.target)) return;
  const ds = e.target.dataset;
  if (sim && e.target.id === "sim-rubrique") { b = { ...nouveauBrouillon(e.target.value, b.espace), etape: 2, codePostal: b.codePostal || "" }; sauver(); return rendre(); }
  // (logementId gardé : seule la saisie d'une nouvelle adresse le vide). Rendu repoussé d'un instant et curseur rendu au champ
  // où l'on vient de cliquer (26/11/2026 : en passant d'un champ au suivant, le nouveau champ perdait le focus et la saisie).
  if (ds.texte) { b = { ...b, [ds.texte]: e.target.value }; sauver(); clearTimeout(window.__rendreTimer); window.__rendreTimer = setTimeout(rendreEnGardantLeCurseur, 0); return; }
  if (ds.case === "lavageDraps") { const t = litsTailles(b); return maj({ lavageDraps: e.target.checked, lits1: t.un, lits2: t.deux || (t.total ? 0 : litsDe(b)), litsKing: t.king }); }
  if (ds.case) return maj({ [ds.case]: e.target.checked });
  if (ds.tache) return maj({ taches: e.target.checked ? [...b.taches, ds.tache] : b.taches.filter(x => x !== ds.tache) });
  if (ds.etape) { const l = etapesChoisiesDe(b); return maj({ etapesChoisies: e.target.checked ? [...l, ds.etape] : l.filter(x => x !== ds.etape) }); }
  if (ds.conso) { const l = consommablesDe(b); return maj({ consommablesChoisis: e.target.checked ? [...l, ds.conso] : l.filter(x => x !== ds.conso) }); }
  if (ds.nature) { const n = b.natures || []; return maj({ natures: e.target.checked ? [...n, ds.nature] : n.filter(x => x !== ds.nature) }); }
  if ((e.target.id === "photo-boite-appareil" || e.target.id === "photo-boite-galerie") && e.target.files?.[0]) {
    if (e.target.files[0].type.startsWith("image/")) photoBoite = e.target.files[0];
    return rendre();
  }
  if (ds.vue !== undefined && e.target.files?.[0]) {
    vuesPrises = { ...vuesPrises, [ds.vue]: e.target.files[0] };
    photos = Object.values(vuesPrises).slice(0, 12);
    return rendre();
  }
  if (e.target.id === "photos" || e.target.id === "photos-appareil") { photos = [...photos, ...e.target.files].filter(f => f.type.startsWith("image/")).slice(0, 12); rendre(); }
});
/** « Me géolocaliser » : position de l'appareil → adresse la plus proche (Base Adresse Nationale), placée sur la carte. */
async function geolocaliser() {
  messageGeoloc = "Recherche de votre position…"; rendre();
  try {
    const p = await maPosition();
    const a = await adresseDe(p.lat, p.lon);
    messageGeoloc = a ? "" : "Adresse introuvable à cet endroit : saisissez-la, le repère reste sur la carte.";
    maj({ logementId: "", lat: p.lat, lon: p.lon, ...(a ? { rue: a.rue || b.rue, codePostal: a.codePostal, ville: a.ville } : {}) });
  } catch (e) {
    messageGeoloc = e.message === "refus" ? "Localisation refusée : autorisez-la dans votre navigateur, ou saisissez l'adresse." : "Position introuvable pour le moment : saisissez l'adresse.";
    rendre();
  }
}

// Les champs texte enregistrent aussi pendant la frappe (sans redessiner, pour garder le curseur).
document.addEventListener("input", e => {
  if (!racine || !racine.contains(e.target) || !e.target.dataset.texte) return;
  b = { ...b, [e.target.dataset.texte]: e.target.value };
  // Adresse modifiée à la main : elle sera replacée sur la carte.
  if (["rue", "codePostal", "ville"].includes(e.target.dataset.texte) && !b.logementId) b = { ...b, lat: null, lon: null };
  sauver();
  const bouton = racine.querySelector("#suivant, #envoyer");
  if (bouton && b.etape >= 2) { clearTimeout(window.__rendreTimer); window.__rendreTimer = setTimeout(rendreEnGardantLeCurseur, 500); }
});
function rendreEnGardantLeCurseur() {
  const actif = document.activeElement?.dataset?.texte, pos = document.activeElement?.selectionStart;
  rendre();
  if (actif) { const el = racine.querySelector(`[data-texte="${actif}"]`); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch { /* email */ } } }
}

let totalPassages = 0;   // nombre de passages de l'envoi en cours (message en cas d'échec partiel)
async function envoyer() {
  if (reservationsFermees()) { rendre(); return; }   // interrupteur fermé : rien n'est envoyé (la base refuse aussi)
  const debut = debutChoisi();
  const est = estimer(b, debut);
  envoi = true; rendre();
  try {
    const acces = { TIERS: { nom: b.tiersNom, telephone: b.tiersTel }, BOITE: { emplacement: b.boiteEmplacement, code: b.code }, AUTONOME: { code: b.code } }[b.accueil] || {};
    if (b.rubriqueId === "car") Object.assign(acces, accesVehicule(b));
    const details = { ...b }; ["prenom", "nom", "email", "telephone", "rue", "codePostal", "ville", "code", "tiersNom", "tiersTel", "boiteEmplacement", "cgv", "etape", "passagesEnvoyes", "groupePaiement",
      "vehRepere", "vehAccesParking", "vehModele", "vehImmat", "vehLat", "vehLon", "accueilRestitution"].forEach(k => delete details[k]);
    details.lignes = est.lignes;
    details.photosAvantExigees = photosAvantObligatoires(b.rubriqueId) || !!b.photosAvantExigees;
    if (b.rubriqueId === "rental") details.etapesInclusesLinge = etapesIncluses(b);   // étapes incluses d'office (lavage du linge) : visibles du Cleaneur   // prompt 2, partie 6
    details.langue = langue;
    details.fraisServicePct = est.fraisServicePct; details.fraisServiceC = est.fraisServiceC;
    delete details.prixLibre; delete details.prixConseilleC;
    if (est.prixLibre) { details.prixLibre = true; details.prixConseilleC = est.prixConseilleC; }   // prix fixé par la conciergerie   // frais de service Cleaneroo (à part)   // langue des SMS et des messages : celle de la réservation
    const nombre = passagesPlanifies(b);
    details.passages = nombre;
    const dates = debut && nombre > 1 ? datesPassages(debut, frequenceDe(b), b.jours || [], nombre) : [debut];
    // Passages déjà créés lors d'un essai précédent (22/11/2026) : jamais renvoyés, pour éviter les doublons.
    totalPassages = dates.length;
    // Paiement (22/11/2026) : tous les passages d'une même réservation partagent la carte du 1er (prélevés 3 jours avant chacun).
    if (!b.groupePaiement) { b = { ...b, groupePaiement: crypto.randomUUID() }; sauver(); }
    let premiere = (b.passagesEnvoyes || []).find(x => x.n === 0) || null;
    for (const [n, d] of dates.entries()) {
    if ((b.passagesEnvoyes || []).some(x => x.n === n)) continue;
    // Pass Entretien (véhicules) : chaque passage a son propre palier, lu dans la base juste avant son envoi
    // (les passages précédents de la série sont déjà enregistrés : même calcul que le serveur au paiement).
    let estN = est, detailsN = details;
    if (b.rubriqueId === "car" && !est.devisObligatoire) {
      const pass = passDe(await lirePass(argsPass(b, d)).catch(() => null));
      estN = estimer({ ...b, pass }, d);
      detailsN = { ...details, pass, lignes: estN.lignes, fraisServicePct: estN.fraisServicePct, fraisServiceC: estN.fraisServiceC };
    }
    const envoi1 = await envoyerDemande({
      rubrique_id: b.rubriqueId, details: detailsN, estimation_c: estN.totalC, credit_impot_c: estN.creditImpotC, duree_min: estN.dureeMin,
      remise_parrainage_c: n === 0 ? estN.remiseParrainageC : 0, cagnotte_c: n === 0 ? estN.cagnotteC : 0,
      nombre_cleaneurs: estN.nombreCleaneurs, sur_devis: estN.devisObligatoire, creneau: d ? d.toISOString() : null, flexible: !!b.flexible, prelancement: false,
      choix_cleaneur: choixEnvoye(), cleaneur_favori: choixEnvoye() === "favori" ? b.cleaneurFavori : null, espace: b.espace, prenom: b.prenom.trim(), nom: b.nom.trim(), email: b.email.trim(), telephone: b.telephone.trim(),
      rue: b.rue.trim(), code_postal: b.codePostal.trim(), ville: b.ville.trim(), accueil: b.accueil || "PRESENT", acces, groupe_paiement: b.groupePaiement,
      ...(Number.isFinite(b.lat) && Number.isFinite(b.lon) ? { lat: b.lat, lon: b.lon } : {}),   // alertes ciblées des Cleaneurs (base-cleaneur-idees.sql)
      remarque: (dates.length > 1 ? `Passage ${n + 1}/${dates.length}. ` : "")
        + (photosPlusTardPossibles(b.rubriqueId) && b.sansPhotos && !vuesCompletes(b, Object.keys(vuesPrises)) ? "Photos de l'état actuel à prendre à l'arrivée. " : "")
        + (b.rubriqueId === "boat" && (b.port || b.place) ? `Port : ${[b.port, b.place].filter(Boolean).join(", ")}${b.accesPonton ? ` · accès : ${b.accesPonton}` : ""}. ` : "") + b.remarque.trim(),
    }, n === 0 ? photos : [], b.accueil === "BOITE" || (b.rubriqueId === "car" && b.restitution === "BOITE") ? photoBoite : null);
    premiere = premiere || envoi1;
    b = { ...b, passagesEnvoyes: [...(b.passagesEnvoyes || []), { n, reference: envoi1.reference, jeton: envoi1.jeton }] };
    sauver();
    }
    const { reference, jeton } = premiere;
    const aPayer = !est.devisObligatoire;
    // Réservation préparée par Cleaneroo AI : l'analyse est rattachée à la demande, avec les options retirées et l'avertissement lu.
    if (b.diagnosticIa?.analyseId) await supabase.rpc("lier_analyse_ia", { p_analyse: b.diagnosticIa.analyseId, p_reference: reference, p_jeton: jeton,
      p_options_retirees: b.diagnosticIa.retirees || [] }).then(() => null, () => null);
    const tel = b.telephone.trim();
    if (tel) session().then(x => x ? monProfil() : null).then(p => { if (p && !p.telephone) majProfil({ telephone: tel }); }).catch(() => null);
    memoriserCommande(b);
    oublierBrouillon(b.rubriqueId);
    try { localStorage.removeItem(CLE_BROUILLON); localStorage.removeItem(CLE_FAVORI_VOULU); } catch { /* rien */ }
    envoi = false; b = null; photos = []; photoBoite = null; infosParrain = null;
    // Paiement tout de suite sur la page sécurisée Stripe ; sinon (service indisponible), le suivi propose « Payer ma réservation ».
    if (aPayer) {
      const url = await lancerPaiement(reference, jeton).catch(() => null);
      if (url) { location.href = url; return; }
    }
    location.hash = `#/demande/${reference}/${jeton}`;
  } catch (err) {
    envoi = false; rendre();
    const faits = (b?.passagesEnvoyes || []).length;
    racine.querySelector(".barre-actions").insertAdjacentHTML("afterbegin", faits
      ? `<p class="erreur">${faits} ${tr(faits > 1 ? "passages enregistrés" : "passage enregistré")} ${tr("sur")} ${totalPassages}. ${tr("Réessayez : seuls les passages manquants seront envoyés, sans doublon.")}</p>`
      : `<p class="erreur">L'envoi n'a pas abouti (${esc(err.message)}). Vérifiez votre connexion et réessayez.</p>`);
  }
}
