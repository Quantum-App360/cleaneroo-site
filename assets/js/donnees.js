// Accès aux données : base Supabase « cleaneroo » (Paris). La clé publiable est faite pour être publique :
// la sécurité est assurée par les règles de la base (dépôt libre, lecture réservée au client concerné et à l'administration).
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/+esm";
import { REGLES, fixerOuverture } from "./regles.js";

export const CONFIG = {
  supabaseUrl: "https://wmxrmnujuqkdgvdtlnai.supabase.co",
  supabaseCle: "sb_publishable_6hnw_AhmOT7nOnqYJOVaSQ_XQSMSZ_H",
};
export const supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseCle);

// Demandes faites depuis ce navigateur : référence + jeton secret du lien de suivi.
const CLE_LOCALE = "cleaneroo-mes-demandes";
function lireLocal() { try { return JSON.parse(localStorage.getItem(CLE_LOCALE) || "[]"); } catch { return []; } }
function ecrireLocal(l) { marquerDonneesInvite(); try { localStorage.setItem(CLE_LOCALE, JSON.stringify(l.slice(0, 50))); } catch { /* navigation privée */ } }

/** Référence lisible, comme dans l'application : CLN-XXXX-XXXX. */
export function nouvelleReference() {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bloc = () => Array.from(crypto.getRandomValues(new Uint8Array(4)), v => a[v % a.length]).join("");
  return `CLN-${bloc()}-${bloc()}`;
}

/** Réduit une photo à 1 280 px, JPEG qualité 0,6 (comme l'application). */
export async function reduirePhoto(fichier, taille = 1280, qualite = 0.6) {
  const img = await createImageBitmap(fichier);
  const r = Math.min(1, taille / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return new Promise(ok => c.toBlob(ok, "image/jpeg", qualite));
}

/** Ancienne offre (500 places) : compteur conservé pour l'historique, plus affiché depuis l'offre « 3 mois offerts » du 7 novembre 2026. */
export async function placesRestantes() {
  const { data, error } = await supabase.rpc("places_offre_restantes");
  return error || typeof data !== "number" ? null : data;
}

/** Envoie une demande de nettoyage et ses photos. Renvoie { reference, jeton }. */
export async function envoyerDemande(demande, photos = [], photoBoite = null) {
  const reference = nouvelleReference();
  const jeton = crypto.randomUUID();
  const chemins = [];
  // Photo de la boîte à clés : rangée à part, transmise au Cleaneur avec le code une fois la mission confirmée.
  if (photoBoite) {
    const chemin = `${reference}/boite-a-cles.jpg`;
    const { error } = await supabase.storage.from("photos-demandes").upload(chemin, await reduirePhoto(photoBoite, 1600, 0.7), { contentType: "image/jpeg" });
    if (!error) demande = { ...demande, acces: { ...(demande.acces || {}), photo: chemin } };
  }
  for (const [i, f] of photos.slice(0, 12).entries()) {
    const blob = await reduirePhoto(f);
    const chemin = `${reference}/photo-${i + 1}.jpg`;
    const { error } = await supabase.storage.from("photos-demandes").upload(chemin, blob, { contentType: "image/jpeg" });
    if (!error) chemins.push(chemin);
  }
  const { data: session } = await supabase.auth.getSession();
  const ligne = { ...demande, reference, jeton, photos: chemins, client_id: session?.session?.user?.id ?? null };
  let { error } = await supabase.from("demandes").insert(ligne);
  // Position de la demande (lat / lon) : ignorée tant que la base n'a pas ces colonnes (base-cleaneur-idees.sql).
  if (error && /\b(lat|lon)\b/.test(error.message || "") && "lat" in ligne) {
    const { lat, lon, ...sans } = ligne;
    ({ error } = await supabase.from("demandes").insert(sans));
  }
  if (error) throw new Error(error.message);
  const l = lireLocal();
  l.unshift({ reference, jeton, rubriqueId: demande.rubrique_id, creeLe: new Date().toISOString() });
  ecrireLocal(l);
  return { reference, jeton };
}

/** Demandes faites depuis ce navigateur, avec leur statut à jour. */
export async function mesDemandes() {
  const locales = lireLocal();
  const res = await Promise.all(locales.map(d => suivre(d.reference, d.jeton).catch(() => null)));
  return res.filter(Boolean).map((d, i) => ({ ...d, jeton: locales[i].jeton }));
}

/* Missions des Cleaneurs : le Cleaneur est rattaché automatiquement à la demande quand il prend la mission. */
const rpc = async (nom, args = {}) => { const { data, error } = await supabase.rpc(nom, args); if (error) throw new Error(error.message); return data; };
export const missionsDisponibles = () => rpc("missions_disponibles");
export const mesMissions = () => rpc("mes_missions");
/** Photo d'une demande (boîte à clés…) : lien valable 1 heure, réservé au Cleaneur de la mission et à l'administration. */
export async function lienPhotoDemande(chemin) {
  const { data, error } = await supabase.storage.from("photos-demandes").createSignedUrl(chemin, 3600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
/** "ok", "deja_prise", "ouverture" (réservations pas encore ouvertes), "dossier" ou "connexion". */
export const prendreMission = reference => rpc("prendre_mission", { p_reference: reference });
export const avancerMission = (reference, statut) => rpc("avancer_mission", { p_reference: reference, p_statut: statut });

/* ------------------------------------------------------------------ Contrôle de fin de mission, pièce par pièce (outils/base-controle.sql) */
/** Pièces de la mission avec leurs photos, tâches et résultat du contrôle IA (Cleaneur de la mission, client, administration). */
export async function controlesDe(reference) {
  const { data, error } = await supabase.from("controles_pieces").select("*").eq("reference", reference).order("ordre");
  if (error) throw new Error(error.message);
  return data || [];
}
/** Enregistre une seule fois les pièces de la mission (calculées par controle.js). */
export const enregistrerPieces = (reference, pieces) => rpc("enregistrer_pieces", { p_reference: reference, p_pieces: pieces });
/** Met à jour une pièce : tâches cochées ({id: true}), photos, justification. */
export const majPiece = (reference, piece, champs) => rpc("maj_piece", { p_reference: reference, p_piece: piece,
  p_taches: champs.taches ?? null, p_photo_avant: champs.photoAvant ?? null, p_photo_apres: champs.photoApres ?? null, p_justification: champs.justification ?? null });
/** Photo avant / après d'une pièce : réduite (1 600 px), déposée dans le stockage privé ; renvoie son chemin. */
export async function deposerPhotoControle(reference, piece, moment, fichier) {
  const photo = await reduirePhoto(fichier, 1600, 0.75);
  const chemin = `${reference}/${piece}/${moment}-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from("photos-controles").upload(chemin, photo, { contentType: "image/jpeg", upsert: false });
  if (error) throw new Error(error.message);
  return chemin;
}
/** « Signaler un problème à l'arrivée » (dégât, saleté exceptionnelle, objet cassé), avec une photo facultative. */
export async function signalerArrivee(reference, type, texte, fichier = null) {
  const photo = fichier ? await deposerPhotoControle(reference, "arrivee", "signal", fichier) : "";
  return rpc("signaler_arrivee", { p_reference: reference, p_type: type, p_texte: texte, p_photo: photo });
}
export async function signalementsDe(reference) {
  const { data, error } = await supabase.from("signalements_arrivee").select("*").eq("reference", reference).order("cree_le");
  if (error) throw new Error(error.message);
  return data;
}
/** Lien temporaire (1 h) vers une photo du contrôle. */
export async function lienPhotoControle(chemin) {
  const { data, error } = await supabase.storage.from("photos-controles").createSignedUrl(chemin, 3600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
/** Contrôle IA d'une pièce (comparaison avant / après) : { statut: "ok" | "ecart" | "erreur", resultat }. */
export async function controleIA(reference, piece) {
  const { data, error } = await supabase.functions.invoke("controle-ia", { body: { reference, piece } });
  if (error) return { statut: "erreur", raison: "panne" };
  return data;
}
/** Position du Cleaneur pendant son trajet ("ok", "statut", "interdit"…). */
export const envoyerPosition = (reference, lat, lon, cap = null) =>
  rpc("envoyer_position", { p_reference: reference, p_lat: lat, p_lon: lon, p_cap: Number.isFinite(cap) ? cap : null });

/* Photo de vérification du jour : identité du Cleaneur avant sa première mission de la journée (relu par l'administration). */
/** "aucun", "A_VERIFIER", "VALIDE" ou "REFUSE". */
export const selfieDuJour = () => rpc("selfie_du_jour");
export async function deposerSelfie(fichier) {
  const s = await session();
  const contenu = await reduirePhoto(fichier, REGLES.SELFIE_MAX_PX, 0.8);
  const chemin = `${s.user.id}/${new Date().toISOString().slice(0, 10)}-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from("selfies-cleaneurs").upload(chemin, contenu, { contentType: "image/jpeg" });
  if (error) throw new Error(error.message);
  const r = await rpc("enregistrer_selfie", { p_chemin: chemin });
  if (r !== "ok") throw new Error(r);
}
/** Administration : selfies des 7 derniers jours, avec la pièce d'identité à côté. */
export const selfiesAVerifier = () => rpc("selfies_a_verifier");
export const deciderSelfie = (id, valide, motif = "") => rpc("decider_selfie", { p_id: id, p_valide: valide, p_motif: motif });
export async function lienSelfie(chemin) {
  const { data, error } = await supabase.storage.from("selfies-cleaneurs").createSignedUrl(chemin, 600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
/* Avertissements des Cleaneurs : 2 autorisés, banni au suivant. */
export const mesAvertissements = () => rpc("mes_avertissements");
export const avertissementsCleaneurs = () => rpc("avertissements_cleaneurs");
export const avertirCleaneur = (id, motif) => rpc("avertir_cleaneur", { p_cleaneur: id, p_motif: motif });
export const leverBannissement = id => rpc("lever_bannissement", { p_cleaneur: id });
/* Plan d'urgence : confirmation, annulation (pénalité et avertissement selon le délai), pénalités. */
export const confirmerMission = reference => rpc("confirmer_mission", { p_reference: reference });
export const coutAnnulation = reference => rpc("cout_annulation", { p_reference: reference });
export const annulerMissionCleaneur = reference => rpc("annuler_mission_cleaneur", { p_reference: reference });
export const mesPenalites = () => rpc("mes_penalites");
/* Tableau de bord du Cleaneur (comme l'appli iOS) : niveau, formule, disponibilité urgence. */
export const tableauCleaneur = () => rpc("tableau_cleaneur");
/** Disponible pour une urgence pendant Regles.URGENCE_DISPO_H heures (true) ou plus (false). Renvoie la fin, ou null. */
export const dispoUrgence = actif => rpc("dispo_urgence", { p_actif: actif });
/** Dernière étape de la mission : le Cleaneur quitte le logement. */
export const quitterLogement = reference => rpc("quitter_logement", { p_reference: reference });

/** Suivi en direct : dernière position du Cleaneur (en route ou sur place), ou null. */
export async function suivrePosition(reference, jeton) {
  const { data, error } = await supabase.rpc("position_suivi", { p_reference: reference, p_jeton: jeton });
  if (error) throw new Error(error.message);
  return data?.[0] || null;
}

export async function suivre(reference, jeton) {
  const { data, error } = await supabase.rpc("suivi_demande", { p_reference: reference, p_jeton: jeton });
  if (error) throw new Error(error.message);
  return data?.[0] || null;
}

export async function annuler(reference, jeton) {
  const { data, error } = await supabase.rpc("annuler_demande", { p_reference: reference, p_jeton: jeton });
  if (error) throw new Error(error.message);
  // Montant réservé par Stripe : la réservation est levée (fonction serveur « paiement »).
  if (data === true) await supabase.functions.invoke("paiement", { body: { action: "annuler", reference, jeton } }).catch(() => null);
  return data === true;
}

/** Pré-inscription avant le lancement. Renvoie "ok" ou "deja" (déjà inscrit avec cet e-mail). */
export async function inscrire(inscription) {
  const { error } = await supabase.from("inscriptions").insert({ ...inscription, source: "site" });
  if (!error) return "ok";
  if (error.code === "23505") return "deja";
  throw new Error(error.message);
}

/** Ajoute à « Mes prestations » une demande ouverte par son lien de suivi (autre appareil). */
export function memoriser(reference, jeton, rubriqueId) {
  const l = lireLocal();
  if (!l.some(d => d.reference === reference)) { l.unshift({ reference, jeton, rubriqueId, creeLe: new Date().toISOString() }); ecrireLocal(l); }
}

/* ------------------------------------------------------------------ Comptes (clients, Cleaneurs, administration)
 * Comptes ouverts avant l'ouverture : profil, documents et demandes se préparent maintenant,
 * aucune demande tant que les réservations sont fermées (interrupteur en base, verifier_ouverture). */

const retour = vers => `${location.origin}${location.pathname}?vers=${vers}`;

/* Données gardées sur cet appareil (biens, coordonnées, dernières commandes, demandes suivies, brouillons) : elles n'appartiennent qu'à un
   seul compte (13 novembre 2026). Si un autre compte se connecte sur le même appareil, elles sont effacées ; à la déconnexion aussi. */
const CLE_PROPRIETAIRE = "cleaneroo-donnees-de";
const CLES_PERSONNELLES = ["cleaneroo-logements", "cleaneroo-profil", "cleaneroo-modeles", "cleaneroo-brouillon", "cleaneroo-mes-demandes",
  "cleaneroo-prerempli", "cleaneroo-simulation", "cleaneroo-agenda"];
export function oublierDonneesLocales() {
  [...CLES_PERSONNELLES, CLE_PROPRIETAIRE].forEach(k => { try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch { /* navigation privée */ } });
}
/** Données écrites sans être connecté : marquées « invité », elles pourront être rattachées au compte qui se connecte ensuite. */
export function marquerDonneesInvite() {
  try { if (!localStorage.getItem(CLE_PROPRIETAIRE)) localStorage.setItem(CLE_PROPRIETAIRE, "invite"); } catch { /* navigation privée */ }
}
function rattacherDonneesLocales(idCompte) {
  let proprietaire = null;
  try { proprietaire = localStorage.getItem(CLE_PROPRIETAIRE); } catch { /* navigation privée */ }
  // Données d'un autre compte, ou d'origine inconnue (avant cette protection) : effacées. Seules celles d'un invité sont gardées.
  if (proprietaire !== idCompte && proprietaire !== "invite") oublierDonneesLocales();
  try { localStorage.setItem(CLE_PROPRIETAIRE, idCompte); } catch { /* navigation privée */ }
}

/** Session en cours (null si personne n'est connecté). */
export async function session() {
  const { data } = await supabase.auth.getSession();
  if (data.session) rattacherDonneesLocales(data.session.user.id);
  return data.session || null;
}

/** Création de compte : role = "client" ou "cleaneur" (jamais administrateur). Un e-mail de confirmation est envoyé. */
/**
 * Création du compte avec ses statuts cochés (cumulables) : "particulier", "pro" (SCI, conciergerie : société + SIRET/SIREN), "cleaneur".
 * Chaque statut n'ouvre que son espace ; la base vérifie tout (outils/base-statuts.sql).
 */
export async function creerCompte({ email, mdp, statuts, prenom, nom, societe = "", siretSociete = "", codeParrain = "", secteur = "",
  civilite = "", telephone = "", qualite = "", typeCleaneur = "", engagement = false }) {
  const st = ["particulier", "entreprise", "pro", "hotellerie", "cleaneur"].filter(x => statuts.includes(x));
  const { data, error } = await supabase.auth.signUp({ email, password: mdp,
    options: { data: { canal: (() => { try { return localStorage.getItem("cleaneroo-canal") || ""; } catch { return ""; } })(), statuts: st, prenom, nom, societe, secteur, civilite, telephone, qualite, type_cleaneur: typeCleaneur, engagement_formation: engagement ? "true" : "", siret_societe: siretSociete.replace(/\D/g, ""), code_parrain: codeParrain.trim().toUpperCase().slice(0, 20),
      role: st.includes("cleaneur") ? "cleaneur" : "client", espace: st.includes("pro") ? "pro" : st.includes("entreprise") ? "entreprise" : "particulier" }, emailRedirectTo: retour("compte") } });
  if (error) throw new Error(error.message);
  // Adresse déjà inscrite (par e-mail ou avec Google) : Supabase ne renvoie pas d'erreur et n'envoie AUCUN e-mail (protection
  // contre la recherche d'adresses) ; il le signale par un utilisateur sans identité. Le site ne doit pas annoncer d'e-mail (26/11/2026).
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) return "existe";
  return data.session ? "connecte" : "confirmer";
}

/** Renvoie l'e-mail de confirmation d'une inscription (écran « Plus qu'une étape »). */
export async function renvoyerConfirmation(email) {
  const { error } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: retour("compte") } });
  if (error) throw new Error(error.message);
}

/* Inscription en attente (26/11/2026) : ce qui a été saisi est gardé sur l'appareil (1 h) quand l'adresse a déjà un compte ou que
   l'e-mail doit être confirmé ; une fois connecté, l'espace demandé s'ajoute au compte avec ces informations (compte.js). */
const CLE_ATTENTE = "cleaneroo-inscription-attente";
export function garderInscription(infos) { try { localStorage.setItem(CLE_ATTENTE, JSON.stringify({ ...infos, le: Date.now() })); } catch { /* rien */ } }
export function inscriptionEnAttente() {
  try { const x = JSON.parse(localStorage.getItem(CLE_ATTENTE) || "null"); return x && Date.now() - x.le < 3600e3 ? x : null; } catch { return null; }
}
export function oublierInscription() { try { localStorage.removeItem(CLE_ATTENTE); } catch { /* rien */ } }

export async function connecter(email, mdp) {
  const { error } = await supabase.auth.signInWithPassword({ email, password: mdp });
  if (!error) return "ok";
  return /not confirmed/i.test(error.message) ? "confirmer" : "incorrect";
}
/** Déconnexion : si le serveur refuse (session déjà expirée…), la session est quand même effacée de cet appareil. */
export async function deconnecter() {
  const { error } = await supabase.auth.signOut().catch(e => ({ error: e }));
  if (error) await supabase.auth.signOut({ scope: "local" }).catch(() => null);
  try { Object.keys(localStorage).filter(k => /^sb-.*-auth-token$/.test(k)).forEach(k => localStorage.removeItem(k)); } catch { /* navigation privée */ }
  oublierDonneesLocales();
}
export async function mdpOublie(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: retour("mdp") });
  if (error) throw new Error(error.message);
}
export async function nouveauMdp(mdp) {
  const { error } = await supabase.auth.updateUser({ password: mdp });
  if (error) throw new Error(error.message);
}

export async function monProfil() {
  const s = await session();
  if (!s) return null;
  const { data, error } = await supabase.from("profils").select("*").eq("id", s.user.id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? { ...data, email: s.user.email } : null;
}
const CHAMPS_PROFIL = ["prenom", "nom", "telephone", "civilite", "qualite", "siret_societe", "code_postal", "ville", "siret", "societe", "prestations", "zone_km", "zone_lat", "zone_lon", "espace", "disponibilites", "adresse", "sap_numero", "sap_date"];
export async function majProfil(champs) {
  const s = await session();
  const maj = Object.fromEntries(Object.entries(champs).filter(([k]) => CHAMPS_PROFIL.includes(k)));
  const { error } = await supabase.from("profils").update(maj).eq("id", s.user.id);
  if (error) throw new Error(error.message);
}
export async function devenirCleaneur() { return ajouterStatut("cleaneur"); }

/** Ajoute un statut au compte (particulier, pro, cleaneur) et ouvre son espace. Réponses : ok, societe, invalide. */
export async function ajouterStatut(statut) {
  const { data, error } = await supabase.rpc("ajouter_statut", { s: statut });
  if (error) throw new Error(error.message);
  return data;
}

/** Temps réel : appelle surChangement() à chaque création ou changement d'une demande du compte. Renvoie la fonction d'arrêt. */
export async function ecouterDemandes(surChangement) {
  const s = await session();
  if (!s) return () => {};
  const canal = supabase.channel(`demandes-${s.user.id}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "demandes", filter: `client_id=eq.${s.user.id}` }, () => surChangement())
    .subscribe();
  return () => supabase.removeChannel(canal);
}

/** Documents du dossier Cleaneur. Types : identite, siret, rc_pro, urssaf (obligatoires), certibiocide (nuisibles). */
export const DOCUMENTS_CLEANEUR = [
  // Photo d'identité (23/11/2026) : prise avec l'appareil photo, montrée au client avant le ménage et comparée à la photo de vérification du jour.
  { type: "photo_identite", nom: "Photo d'identité", aide: "Visage de face, sans lunettes de soleil ni casquette, sur un fond neutre, prise maintenant avec l'appareil photo. Elle est montrée à vos clients avant chaque ménage.", obligatoire: true, camera: true },
  { type: "identite", nom: "Pièce d'identité", aide: "Carte d'identité ou passeport en cours de validité, recto verso. Hors Union européenne : titre de séjour qui autorise à travailler.", obligatoire: true },
  { type: "siret", nom: "Justificatif SIRET", aide: "Avis de situation INSEE ou extrait Kbis de moins de 3 mois.", obligatoire: true },
  { type: "rc_pro", nom: "Assurance RC Pro", aide: "Attestation d'assurance responsabilité civile professionnelle en cours de validité.", obligatoire: true },
  { type: "urssaf", nom: "Attestation de vigilance URSSAF", aide: "À télécharger sur votre espace URSSAF, de moins de 6 mois.", obligatoire: true },
  { type: "certibiocide", nom: "Certibiocide « nuisibles »", aide: "Obligatoire pour la dératisation et la désinsectisation.", obligatoire: false },
  { type: "sap", nom: "Déclaration « services à la personne » (SAP)", aide: "Facultative : elle permet à vos clients particuliers de bénéficier de 50 % de crédit d'impôt (ménage, vitres, textiles au domicile). Récépissé de déclaration SAP (nova.entreprises.gouv.fr).", obligatoire: false },
];
export async function mesDocuments() {
  const { data, error } = await supabase.from("documents_cleaneur").select("*").order("cree_le", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}
/** Dépose un document : photo réduite (2 000 px, nette pour la lecture) ou PDF tel quel. */
export async function deposerDocument(type, fichier, expireLe = null) {
  const s = await session();
  const pdf = fichier.type === "application/pdf";
  if (fichier.size > 10 * 1024 * 1024) throw new Error("Fichier trop lourd (10 Mo maximum).");
  const contenu = pdf ? fichier : await reduirePhoto(fichier, 2000, 0.8);
  const chemin = `${s.user.id}/${type}-${Date.now()}.${pdf ? "pdf" : "jpg"}`;
  const { error: e1 } = await supabase.storage.from("documents-cleaneurs").upload(chemin, contenu, { contentType: pdf ? "application/pdf" : "image/jpeg" });
  if (e1) throw new Error(e1.message);
  const { error: e2 } = await supabase.from("documents_cleaneur").insert({ cleaneur_id: s.user.id, type, chemin, ...(expireLe ? { expire_le: expireLe } : {}) });
  if (e2) throw new Error(e2.message);
}
export async function retirerDocument(doc) {
  await supabase.storage.from("documents-cleaneurs").remove([doc.chemin]);
  const { error } = await supabase.from("documents_cleaneur").delete().eq("id", doc.id);
  if (error) throw new Error(error.message);
}
/** Lien temporaire (10 min) pour ouvrir un document (le Cleaneur pour les siens, l'administration pour tous). */
export async function lienDocument(chemin) {
  const { data, error } = await supabase.storage.from("documents-cleaneurs").createSignedUrl(chemin, 600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
/** Envoie le dossier à la vérification. Renvoie "ok", "profil" (profil incomplet), "documents" (document manquant) ou "role". */
export async function soumettreDossier() {
  const { data, error } = await supabase.rpc("soumettre_dossier");
  if (error) throw new Error(error.message);
  return data;
}

/** Demandes du compte connecté (y compris celles faites depuis un autre appareil). */
export async function demandesDuCompte() {
  const s = await session();
  if (!s) return [];
  const { data, error } = await supabase.from("demandes").select("*").eq("client_id", s.user.id).order("cree_le", { ascending: false }).limit(200);
  if (error) throw new Error(error.message);
  return data;
}

/* « Mes biens » : adresses enregistrées, synchronisées entre l'appareil (parcours de réservation) et le compte. */
const CLE_BIENS = "cleaneroo-logements";
const lireBiensLocaux = () => { try { return JSON.parse(localStorage.getItem(CLE_BIENS) || "[]"); } catch { return []; } };
const ecrireBiensLocaux = l => { marquerDonneesInvite(); try { localStorage.setItem(CLE_BIENS, JSON.stringify(l)); } catch { /* rien */ } };
const sansCode = ({ code, ...reste }) => reste;
/** Réunit les biens de cet appareil et ceux du compte ; les deux côtés repartent avec la même liste. */
export async function synchroniserBiens() {
  const s = await session();
  const locaux = lireBiensLocaux();
  if (!s) return locaux;
  const { data, error } = await supabase.from("biens").select("id, donnees").eq("client_id", s.user.id);
  if (error) return locaux;
  const distants = data.map(r => ({ ...r.donnees, id: r.id }));
  const nouveaux = locaux.filter(l => !distants.some(d => d.id === l.id));
  // Biens saisis sur cet appareil avant la connexion : rattachés au compte, sauf s'ils appartiennent déjà à un autre compte (alors oubliés ici).
  const gardes = [];
  for (const l of nouveaux) {
    const { error: e } = await supabase.from("biens").insert({ id: l.id, client_id: s.user.id, donnees: sansCode(l) });
    if (!e) gardes.push(l);
  }
  const tous = [...gardes, ...distants];
  ecrireBiensLocaux(tous);
  return tous;
}
export async function enregistrerBien(bien) {
  ecrireBiensLocaux([bien, ...lireBiensLocaux().filter(l => l.id !== bien.id)]);
  const s = await session();
  if (s) await supabase.from("biens").upsert({ id: bien.id, client_id: s.user.id, donnees: sansCode(bien), maj_le: new Date().toISOString() });
}
/** Import en masse (20/11/2026) : écrit tous les biens d'un coup sur l'appareil, puis dans le compte par paquets de 100. */
export async function enregistrerBiens(biens) {
  const ids = new Set(biens.map(b => b.id));
  ecrireBiensLocaux([...biens, ...lireBiensLocaux().filter(l => !ids.has(l.id))]);
  const s = await session();
  if (!s) return { horsLigne: true };
  const maintenant = new Date().toISOString();
  for (let i = 0; i < biens.length; i += 100) {
    const { error } = await supabase.from("biens").upsert(biens.slice(i, i + 100).map(b => ({ id: b.id, client_id: s.user.id, donnees: sansCode(b), maj_le: maintenant })));
    if (error) throw new Error(error.message);
  }
  return { ok: biens.length };
}
/** Demande de connexion directe à un logiciel de gestion (connecteurs activés avec la conciergerie, après le lancement). */
export async function demanderConnexionLogiciel({ logiciel, logements, telephone, message }) {
  const s = await session();
  if (!s) throw new Error("connexion");
  const { error } = await supabase.from("demandes_connexion").insert({ client_id: s.user.id, logiciel: String(logiciel).slice(0, 80), logements, telephone: telephone.slice(0, 20), message: message.slice(0, 500) });
  if (error) throw new Error(error.message);
}
export async function supprimerBien(id) {
  ecrireBiensLocaux(lireBiensLocaux().filter(l => l.id !== id));
  const s = await session();
  if (s) await supabase.from("biens").delete().eq("client_id", s.user.id).eq("id", id);
}

/* Administration : dossiers des Cleaneurs inscrits avec un compte. */
export async function dossiersCleaneurs() {
  const { data, error } = await supabase.rpc("dossiers_cleaneurs");
  if (error) throw new Error(error.message);
  return data;
}
export async function documentsDe(cleaneurId) {
  const { data, error } = await supabase.from("documents_cleaneur").select("*").eq("cleaneur_id", cleaneurId).order("cree_le", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}
export async function deciderDossier(id, valide, motif = "") {
  const { error } = await supabase.rpc("decider_dossier_cleaneur", { p_id: id, p_valide: valide, p_motif: motif });
  if (error) throw new Error(error.message);
}
export async function deciderDocument(id, accepte, motif = "") {
  const { error } = await supabase.rpc("decider_document", { p_id: id, p_accepte: accepte, p_motif: motif });
  if (error) throw new Error(error.message);
}

/* Espace Pro : agenda relié aux calendriers iCal (Airbnb, Booking…). Lecture par le serveur (fonction agenda-ical). */
const CLE_AGENDA = "cleaneroo-agenda";
/** Réservations d'un calendrier : [{ debut, fin, titre, bloque }] (dates AAAA-MM-JJ). Erreur : { erreur }. */
/** Calendrier de démonstration (20 novembre 2026) : un lien fixe, lu sans réseau, dont les séjours se recalculent chaque jour
 * (départs dans 1, 3, 6, 9… jours) : on essaie l'agenda, le planning et le pilote automatique sans avoir d'annonce. */
export const URL_CALENDRIER_DEMO = "https://cleaneroo.fr/demo/calendrier.ics";
export function calendrierDemo(aujourdhui = new Date()) {
  const j = n => { const d = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const sejours = [[-2, 1], [1, 3], [4, 6], [6, 9], [10, 14], [15, 17], [18, 22], [23, 25], [26, 30]];
  return { evenements: sejours.map(([a, b], i) => ({ debut: j(a), fin: j(b), titre: `Réservation démo ${i + 1}`, bloque: false })) };
}
export async function lireCalendrier(url, forcer = false) {
  if (url === URL_CALENDRIER_DEMO) return calendrierDemo();
  let cache = {};
  try { cache = JSON.parse(sessionStorage.getItem(CLE_AGENDA) || "{}"); } catch { /* rien */ }
  const c = cache[url];
  if (!forcer && c && Date.now() - c.quand < REGLES.AGENDA_CACHE_MIN * 60000) return c.r;
  const { data, error } = await supabase.functions.invoke("agenda-ical", { body: { url } });
  let r;
  if (error) { let corps = null; try { corps = await error.context?.json(); } catch { /* rien */ } r = { erreur: corps?.erreur || "inaccessible" }; }
  else r = data;
  if (!r.erreur) { cache[url] = { quand: Date.now(), r }; try { sessionStorage.setItem(CLE_AGENDA, JSON.stringify(cache)); } catch { /* rien */ } }
  return r;
}

/** Ouverture des réservations (24/11/2026) : interrupteur lu en base ; service muet ou fonction absente : fermées. */
export async function chargerOuverture() {
  const { data, error } = await supabase.rpc("reservations_ouvertes");
  fixerOuverture(!error && data === true);
  return !error && data === true;
}

/* « Être prévenu » (11 novembre 2026, comme l'appli iPhone) : la prestation est-elle disponible à cette adresse ?
   Renvoie le nombre de Cleaneurs validés qui la couvrent (null si le service ne répond pas : on ne bloque alors pas). */
export async function secteurCouvert(rubriqueId, lat, lon) {
  const { data, error } = await supabase.rpc("secteur_couvert", { p_rubrique: rubriqueId, p_lat: lat, p_lon: lon });
  return error ? null : data;
}
/* Carte client (prompt 4, lot 2) : secteurs couverts par des Cleaneurs validés, arrondis à une grille d'environ 5 km par la base.
   Jamais d'adresse ni de position exacte. Renvoie [{ lat, lon, rayon_km, cleaneurs }], ou null si la base n'est pas encore à jour. */
export async function secteursPublics(rubriqueId) {
  const { data, error } = await supabase.rpc("secteurs_publics", { p_rubrique: rubriqueId || null });
  return error ? null : data || [];
}
/* Fiches Cleaneur et Cleaneur demandé (lot 5, base-cleaneur-choisi.sql). */
/** Cleaneurs validés qui couvrent l'adresse pour cette prestation (fiche publique uniquement), ou null si le service ne répond pas. */
export async function cleaneursPublics(rubriqueId, lat, lon) {
  const { data, error } = await supabase.rpc("cleaneurs_publics", { p_rubrique: rubriqueId, p_lat: lat, p_lon: lon });
  return error ? null : data || [];
}
/** Proposer la demande à tous maintenant (client) ou « Je ne suis pas disponible » (Cleaneur demandé). */
export async function libererFavori(reference, jeton = null) {
  const { data, error } = await supabase.rpc("liberer_favori", { p_reference: reference, p_jeton: jeton });
  if (error) throw error;
  return data;
}
/** Cleaneur à qui la demande est proposée en premier, et jusqu'à quand ; null s'il n'y en a pas (ou plus). */
export async function favoriDeDemande(reference, jeton) {
  const { data, error } = await supabase.rpc("favori_de_demande", { p_reference: reference, p_jeton: jeton });
  return error ? null : (data || [])[0] || null;
}
/** Demandes réservées au Cleaneur connecté pendant leur exclusivité. */
export async function mesDemandesPersonnelles() {
  const { data, error } = await supabase.rpc("mes_demandes_personnelles");
  return error ? [] : data || [];
}
/* Idées validées le 25/11 (base-cleaneur-idees.sql) : prochain passage proposé par le Cleaneur, bouton de sécurité. */
export async function proposerProchainPassage(reference, jour, heure) {
  const { data, error } = await supabase.rpc("proposer_prochain_passage", { p_reference: reference, p_jour: jour, p_heure: heure });
  if (error) throw error;
  return data;
}
export async function mesPropositionsPassage() {
  const { data, error } = await supabase.rpc("mes_propositions_passage");
  return error ? null : data || [];
}
export async function propositionPassage(reference, jeton) {
  const { data, error } = await supabase.rpc("proposition_passage", { p_reference: reference, p_jeton: jeton });
  return error ? null : (data || [])[0] || null;
}
export async function repondrePassage(id, jeton, accepte) {
  const { data, error } = await supabase.rpc("repondre_passage", { p_id: id, p_jeton: jeton, p_accepte: accepte });
  if (error) throw error;
  return data;
}
/** Réputation publique d'un Cleaneur (avis publiés seulement, base-lot7.sql) ; null si indisponible. */
export async function reputationCleaneur(id) {
  const { data, error } = await supabase.rpc("reputation_cleaneur", { p_cleaneur: id });
  return error ? null : data || null;
}
/* Invitation « Cleaneur favori » (25/11, base-favori-invitation.sql) : une fois par client, pour les prestations sans prochain passage. */
export async function inviterFavori(reference) {
  const { data, error } = await supabase.rpc("inviter_favori", { p_reference: reference });
  if (error) throw error;
  return data;
}
export async function mesInvitationsFavori() {
  const { data, error } = await supabase.rpc("mes_invitations_favori");
  return error ? null : data || [];
}
/** Côté client connecté : prénom du Cleaneur qui l'a invité à le mettre en favori (null sinon). */
export async function invitationFavori(reference) {
  const { data, error } = await supabase.rpc("invitation_favori", { p_reference: reference });
  return error ? null : data || null;
}
export async function alerteSecurite(reference, lat, lon, message) {
  const { data, error } = await supabase.rpc("alerte_securite", { p_reference: reference || "", p_lat: lat, p_lon: lon, p_message: message || "" });
  if (error) throw error;
  return data;
}
/** Inscrit le client sur la liste d'attente de son secteur ; il est prévenu dès qu'un Cleaneur qualifié s'y installe. */
export async function rejoindreAttente(a) {
  const { error } = await supabase.rpc("rejoindre_attente", { p_rubrique: a.rubriqueId, p_code_postal: a.codePostal || "", p_ville: a.ville,
    p_lat: a.lat, p_lon: a.lon, p_prenom: a.prenom || "", p_email: a.email || "", p_telephone: a.telephone || "", p_source: "site" });
  if (error) throw error;
}
/** Administration : où recruter (demandes en attente et pré-réservations par ville et prestation). */
export async function secteursARecruter() {
  const { data, error } = await supabase.rpc("secteurs_a_recruter");
  if (error) throw error;
  return data || [];
}
