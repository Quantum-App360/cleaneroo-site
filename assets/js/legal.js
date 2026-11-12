// Pages légales (12 novembre 2026) : conditions générales clients, confidentialité, mentions légales. Même texte dans l'appli (Legal.kt),
// traduit dans les 4 langues ; les montants {entre accolades} viennent de REGLES, la société de REGLES.SOCIETE.
import { REGLES, euros } from "./regles.js";
import { tr } from "./langue.js";

export const CONDITIONS = [
  ["Objet", "Cleaneroo exploite une plateforme de mise en relation entre des clients (particuliers, conciergeries, entreprises) et des prestataires de nettoyage indépendants et vérifiés, les « Cleaneurs ». La prestation est conclue entre le client et le Cleaneur ; Cleaneroo organise la réservation, le suivi, le paiement et la facturation pour le compte du Cleaneur."],
  ["Compte", "On peut réserver sans compte ; un compte permet de suivre ses prestations, ses biens et ses factures. Le client garantit l'exactitude de ses informations et garde ses identifiants confidentiels. Il peut supprimer son compte à tout moment depuis son espace."],
  ["Prix et frais", "Le prix est calculé avant la réservation d'après la description du besoin (surface, tâches, options, créneau) et affiché toutes taxes comprises. C'est un prix maximum : il ne peut pas être dépassé sans l'accord du client. Les Cleaneurs peuvent proposer un autre prix ou un autre horaire ; rien n'est retenu sans le choix du client. Des frais de service Cleaneroo s'ajoutent : {fraisPart} % pour un particulier, {fraisPro} % pour une conciergerie ou une entreprise sans abonnement, 0 % avec abonnement."],
  ["Paiement et factures", "Une empreinte bancaire est prise à la réservation ; le client n'est débité qu'après avoir validé le compte rendu, ou automatiquement {validationAuto} h après la fin de la prestation sans réclamation. Le paiement est encaissé par Cleaneroo au nom et pour le compte du Cleaneur, par un prestataire de paiement agréé. Les factures, les attestations fiscales (particuliers) et les relevés comptables mensuels (professionnels) sont disponibles dans l'espace du client."],
  ["Crédit d'impôt", "Le ménage, les vitres du logement et les textiles réalisés au domicile d'un particulier par un Cleaneur déclaré « services à la personne » ouvrent droit à un crédit d'impôt de 50 % (article 199 sexdecies du Code général des impôts), dans les limites légales. Cleaneroo n'avance pas ce crédit : il fournit chaque mois une attestation et chaque année une attestation annuelle à déclarer ; l'administration fiscale rembourse le crédit."],
  ["Accès et déroulement", "Le client indique comment le Cleaneur accède aux lieux ; le code, la photo de la boîte à clés et le guide d'accès ne sont transmis qu'une fois la mission confirmée. Le Cleaneur annonce son départ et son arrivée ; sa position n'est partagée que pendant le trajet. Un compte rendu avec photos est remis à la fin de la prestation."],
  ["Annulation et modification", "Annulation gratuite jusqu'à {annulH} h avant l'intervention ; ensuite, {annulPct} % du prix accepté restent dus. Une demande publiée sans Cleaneur confirmé peut être modifiée ou annulée sans frais."],
  ["Retard, absence et accès impossible", "Si le Cleaneur annonce plus de {retard} min de retard, le client peut annuler sans frais. Si le Cleaneur ne peut pas entrer ou si le client est absent, après {attente} min d'attente, une indemnité de {indemnitePct} % du prix (entre {indemniteMin} € et {indemniteMax} €) est due au Cleaneur. Si le Cleaneur ne peut plus venir, Cleaneroo cherche un remplaçant ; à défaut, la prestation est annulée sans frais et le client reçoit un avoir de {avoir} €."],
  ["Réclamations et Garantie Cleaneroo", "Le client peut signaler un problème ou déclarer un dommage dans les {garantieH} h suivant l'intervention, depuis son espace. La Garantie Cleaneroo couvre les dommages causés lors d'une intervention jusqu'à {garantie} €, après examen des preuves (photos, compte rendu) et selon les conditions affichées lors de la déclaration ; l'assurance responsabilité civile professionnelle du Cleaneur intervient en premier."],
  ["Avis", "Après la prestation, le client et le Cleaneur peuvent se noter pendant {avisJours} jours ; les deux avis sont publiés ensemble. Un avis doit refléter une expérience réelle ; Cleaneroo peut retirer un avis injurieux ou sans lien avec la prestation."],
  ["Droit de rétractation", "Le particulier qui réserve en ligne dispose de 14 jours pour se rétracter, sans motif (article L221-18 du Code de la consommation), en écrivant à contact@cleaneroo.fr. S'il demande expressément que la prestation commence avant la fin de ce délai, il doit le prix de la partie déjà réalisée en cas de rétractation ; une prestation entièrement réalisée avant la fin du délai à sa demande expresse ne peut plus faire l'objet d'une rétractation (article L221-28)."],
  ["Rôle de Cleaneroo", "Cleaneroo vérifie les Cleaneurs avant de les activer (identité, SIRET, attestation URSSAF, assurance, contrat, mission test) et assure le bon fonctionnement du service. Le Cleaneur, professionnel indépendant, est responsable de la prestation qu'il réalise."],
  ["Cleaneurs", "Les Cleaneurs exercent selon le contrat de prestataire qu'ils signent dans leur espace : formule Gratuite (commission de {commissionGratuit} %) ou Pro ({abonnementPro} par mois, commission de {commissionPro} %), 3 mois de Pro offerts aux inscrits jusqu'au 31 janvier 2027."],
  ["Lancement", "Avant le 31 décembre 2026, les réservations sont des pré-réservations gratuites et sans engagement ; aucune intervention n'a lieu avant le 1er janvier 2027."],
  ["Réclamations, médiation et droit applicable", "Toute réclamation peut être adressée à contact@cleaneroo.fr. À défaut d'accord sous 30 jours, le consommateur peut recourir gratuitement au médiateur de la consommation (article L612-1 du Code de la consommation) : {mediateur}. Il peut ensuite saisir le tribunal compétent. Les présentes conditions sont soumises au droit français ; la version applicable est celle acceptée lors de la réservation."],
];
export const CONFIDENTIALITE = [
  ["Responsable", "Cleaneroo (coordonnées dans les mentions légales) est responsable des traitements décrits ici. Contact : contact@cleaneroo.fr."],
  ["Données collectées", "Clients : identité, coordonnées, adresses, description du besoin, photos ajoutées, consignes, code et guide d'accès, réservations, messages, avis et factures. Cleaneurs : identité, documents du dossier (identité, SIRET, URSSAF, assurance, déclaration services à la personne), signature du contrat, photo du jour, position pendant le trajet et l'arrivée, photos et comptes rendus de mission, avis et versements."],
  ["Pourquoi", "Organiser et suivre les prestations (exécution du contrat), assurer la sécurité des clients et prévenir la fraude (intérêt légitime), facturer et respecter nos obligations fiscales et sociales (obligation légale), prévenir chacun des étapes de ses prestations. Les données ne sont jamais vendues ni utilisées pour de la publicité."],
  ["Codes d'accès et position", "Le code, la photo de la boîte à clés et le guide d'accès ne sont communiqués qu'au Cleaneur retenu, une fois la mission confirmée. La position du Cleaneur n'est partagée que pendant le trajet et l'arrivée d'une mission, jamais en dehors."],
  ["Destinataires et prestataires", "Le Cleaneur retenu (pour la mission) ; Supabase (comptes et base de données, serveurs à Paris) ; GitHub Pages (site) ; OpenStreetMap et la Base Adresse Nationale de l'IGN (cartes et adresses : seuls l'adresse ou le code postal sont envoyés) ; Google, uniquement si vous choisissez « Continuer avec Google » ; le prestataire de paiement, à l'ouverture des paiements."],
  ["Durées de conservation", "Tant que le compte est actif, puis suppression à sa clôture ; factures : 10 ans (obligation légale) ; documents des Cleaneurs : le temps du contrat puis la durée de prescription légale ; photos et comptes rendus : le temps nécessaire au traitement des réclamations."],
  ["Sur votre appareil", "Pour aller plus vite, votre appareil garde vos coordonnées, vos adresses et votre dernière commande (jamais le code d'accès). Ni traceur publicitaire ni cookie de mesure : la fréquentation est comptée sans donnée personnelle (page, type d'appareil, site d'origine)."],
  ["Vos droits", "Vous pouvez demander l'accès, la rectification, l'effacement, la limitation ou la portabilité de vos données et vous opposer à un traitement en écrivant à contact@cleaneroo.fr, et supprimer votre compte depuis votre espace. Vous pouvez saisir la CNIL (cnil.fr)."],
];
export const MENTIONS = [
  ["Éditeur", "{societe}"],
  ["Directeur de la publication", "{directeur}"],
  ["Contact", "contact@cleaneroo.fr"],
  ["Hébergement du site", "GitHub Pages — GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, États-Unis."],
  ["Hébergement des données", "Supabase, Inc. — serveurs situés à Paris (Union européenne)."],
  ["Nom de domaine", "cleaneroo.fr, enregistré chez IONOS."],
];

const societe = () => { const s = REGLES.SOCIETE || {};
  return s.nom ? [s.nom, s.adresse, s.siret ? `SIRET ${s.siret}` : ""].filter(Boolean).join(" — ") : tr("Cleaneroo, société par actions simplifiée (SAS) en cours de création : siège, SIRET et capital publiés ici avant l'ouverture du 31 décembre 2026."); };
const mediateur = () => { const m = REGLES.MEDIATEUR || {};
  return m.actif ? `${m.nom}, ${m.adresse} — ${m.site}` : tr("désigné avant l'ouverture du 31 décembre 2026, ses coordonnées seront indiquées ici"); };
const valeurs = () => ({ fraisPart: REGLES.FRAIS_SERVICE_PARTICULIER_PCT, fraisPro: REGLES.FRAIS_SERVICE_PRO_PCT, validationAuto: REGLES.VALIDATION_AUTO_H,
  annulH: REGLES.ANNULATION_GRATUITE_H, annulPct: REGLES.ANNULATION_TARDIVE_PCT, retard: REGLES.RETARD_TOLERE_MIN, attente: REGLES.ATTENTE_ACCES_IMPOSSIBLE_MIN,
  indemnitePct: REGLES.INDEMNITE_PCT, indemniteMin: REGLES.INDEMNITE_MIN_C / 100, indemniteMax: REGLES.INDEMNITE_MAX_C / 100, avoir: REGLES.GARANTIE_REMPLACEMENT_OFFERT_C / 100,
  garantieH: REGLES.GARANTIE_DECLARATION_H, garantie: euros(REGLES.GARANTIE_PLAFOND_C).replace(/,00\s*€$/, " €"), avisJours: REGLES.AVIS_DELAI_JOURS,
  commissionGratuit: REGLES.COMMISSION_GRATUIT_PB / 100, commissionPro: REGLES.COMMISSION_PRO_PB / 100, abonnementPro: euros(REGLES.ABONNEMENT_CLEANEUR_C),
  mediateur: mediateur(), societe: societe(), directeur: (REGLES.SOCIETE || {}).directeur || societe() });
/** Texte traduit puis valeurs remplies. */
export const texteLegal = x => tr(x).replace(/\{(\w+)\}/g, (m, k) => String(valeurs()[k] ?? m));
