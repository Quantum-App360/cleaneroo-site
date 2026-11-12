// Accès aux données : base Supabase « cleaneroo » (Paris). La clé publiable est faite pour être publique :
// la sécurité est assurée par les règles de la base (dépôt libre, lecture réservée au client concerné et à l'administration).
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/+esm";
import { REGLES } from "./regles.js";

export const CONFIG = {
  supabaseUrl: "https://wmxrmnujuqkdgvdtlnai.supabase.co",
  supabaseCle: "sb_publishable_6hnw_AhmOT7nOnqYJOVaSQ_XQSMSZ_H",
};
export const supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseCle);

// Demandes faites depuis ce navigateur : référence + jeton secret du lien de suivi.
const CLE_LOCALE = "cleaneroo-mes-demandes";
function lireLocal() { try { return JSON.parse(localStorage.getItem(CLE_LOCALE) || "[]"); } catch { return []; } }
function ecrireLocal(l) { try { localStorage.setItem(CLE_LOCALE, JSON.stringify(l.slice(0, 50))); } catch { /* navigation privée */ } }

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
  const { error } = await supabase.from("demandes").insert({
    ...demande, reference, jeton, photos: chemins, client_id: session?.session?.user?.id ?? null,
  });
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
/** "ok", "deja_prise", "ouverture" (avant le 1er janvier 2027), "dossier" ou "connexion". */
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

/* Selfie du jour : identité du Cleaneur avant sa première mission de la journée (relu par l'administration). */
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
 * aucune intervention avant le 1er janvier 2027 (règle de la base : demandes_ouverture_check). */

const retour = vers => `${location.origin}${location.pathname}?vers=${vers}`;

/** Session en cours (null si personne n'est connecté). */
export async function session() {
  const { data } = await supabase.auth.getSession();
  return data.session || null;
}

/** Création de compte : role = "client" ou "cleaneur" (jamais administrateur). Un e-mail de confirmation est envoyé. */
/**
 * Création du compte avec ses statuts cochés (cumulables) : "particulier", "pro" (SCI, conciergerie : société + SIRET/SIREN), "cleaneur".
 * Chaque statut n'ouvre que son espace ; la base vérifie tout (outils/base-statuts.sql).
 */
export async function creerCompte({ email, mdp, statuts, prenom, nom, societe = "", siretSociete = "", codeParrain = "" }) {
  const st = ["particulier", "pro", "cleaneur"].filter(x => statuts.includes(x));
  const { data, error } = await supabase.auth.signUp({ email, password: mdp,
    options: { data: { statuts: st, prenom, nom, societe, siret_societe: siretSociete.replace(/\D/g, ""), code_parrain: codeParrain.trim().toUpperCase().slice(0, 20),
      role: st.includes("cleaneur") ? "cleaneur" : "client", espace: st.includes("pro") ? "pro" : "particulier" }, emailRedirectTo: retour("compte") } });
  if (error) throw new Error(error.message);
  return data.session ? "connecte" : "confirmer";
}

export async function connecter(email, mdp) {
  const { error } = await supabase.auth.signInWithPassword({ email, password: mdp });
  if (!error) return "ok";
  return /not confirmed/i.test(error.message) ? "confirmer" : "incorrect";
}
export const deconnecter = () => supabase.auth.signOut();
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
const CHAMPS_PROFIL = ["prenom", "nom", "telephone", "code_postal", "ville", "siret", "societe", "prestations", "zone_km", "zone_lat", "zone_lon", "espace", "disponibilites"];
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
  { type: "identite", nom: "Pièce d'identité", aide: "Carte d'identité ou passeport en cours de validité, recto verso. Hors Union européenne : titre de séjour qui autorise à travailler.", obligatoire: true },
  { type: "siret", nom: "Justificatif SIRET", aide: "Avis de situation INSEE ou extrait Kbis de moins de 3 mois.", obligatoire: true },
  { type: "rc_pro", nom: "Assurance RC Pro", aide: "Attestation d'assurance responsabilité civile professionnelle en cours de validité.", obligatoire: true },
  { type: "urssaf", nom: "Attestation de vigilance URSSAF", aide: "À télécharger sur votre espace URSSAF, de moins de 6 mois.", obligatoire: true },
  { type: "certibiocide", nom: "Certibiocide « nuisibles »", aide: "Obligatoire pour la dératisation et la désinsectisation.", obligatoire: false },
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
const ecrireBiensLocaux = l => { try { localStorage.setItem(CLE_BIENS, JSON.stringify(l)); } catch { /* rien */ } };
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
  if (nouveaux.length) await supabase.from("biens").upsert(nouveaux.map(l => ({ id: l.id, client_id: s.user.id, donnees: sansCode(l) })));
  const tous = [...nouveaux, ...distants];
  ecrireBiensLocaux(tous);
  return tous;
}
export async function enregistrerBien(bien) {
  ecrireBiensLocaux([bien, ...lireBiensLocaux().filter(l => l.id !== bien.id)]);
  const s = await session();
  if (s) await supabase.from("biens").upsert({ id: bien.id, client_id: s.user.id, donnees: sansCode(bien), maj_le: new Date().toISOString() });
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
export async function lireCalendrier(url, forcer = false) {
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

/* « Être prévenu » (11 novembre 2026, comme l'appli iPhone) : la prestation est-elle disponible à cette adresse ?
   Renvoie le nombre de Cleaneurs validés qui la couvrent (null si le service ne répond pas : on ne bloque alors pas). */
export async function secteurCouvert(rubriqueId, lat, lon) {
  const { data, error } = await supabase.rpc("secteur_couvert", { p_rubrique: rubriqueId, p_lat: lat, p_lon: lon });
  return error ? null : data;
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
