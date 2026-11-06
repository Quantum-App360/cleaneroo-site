// Accès aux données : base Supabase « cleaneroo » (Paris). La clé publiable est faite pour être publique :
// la sécurité est assurée par les règles de la base (dépôt libre, lecture réservée au client concerné et à l'administration).
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/+esm";

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
async function reduirePhoto(fichier, taille = 1280, qualite = 0.6) {
  const img = await createImageBitmap(fichier);
  const r = Math.min(1, taille / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return new Promise(ok => c.toBlob(ok, "image/jpeg", qualite));
}

/** Offre de lancement : places restantes (500 moins les dossiers Cleaneurs validés). null si la base ne répond pas. */
export async function placesRestantes() {
  const { data, error } = await supabase.rpc("places_offre_restantes");
  return error || typeof data !== "number" ? null : data;
}

/** Envoie une demande de nettoyage et ses photos. Renvoie { reference, jeton }. */
export async function envoyerDemande(demande, photos = []) {
  const reference = nouvelleReference();
  const jeton = crypto.randomUUID();
  const chemins = [];
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
export async function creerCompte({ email, mdp, role, prenom, nom }) {
  const { data, error } = await supabase.auth.signUp({ email, password: mdp,
    options: { data: { role: role === "cleaneur" ? "cleaneur" : "client", prenom, nom }, emailRedirectTo: retour("compte") } });
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
const CHAMPS_PROFIL = ["prenom", "nom", "telephone", "code_postal", "ville", "siret", "prestations", "zone_km"];
export async function majProfil(champs) {
  const s = await session();
  const maj = Object.fromEntries(Object.entries(champs).filter(([k]) => CHAMPS_PROFIL.includes(k)));
  const { error } = await supabase.from("profils").update(maj).eq("id", s.user.id);
  if (error) throw new Error(error.message);
}
export async function devenirCleaneur() {
  const { error } = await supabase.rpc("devenir_cleaneur");
  if (error) throw new Error(error.message);
}

/** Documents du dossier Cleaneur. Types : identite, siret, rc_pro, urssaf (obligatoires), certibiocide (nuisibles). */
export const DOCUMENTS_CLEANEUR = [
  { type: "identite", nom: "Pièce d'identité", aide: "Carte d'identité ou passeport, recto verso.", obligatoire: true },
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
export async function deposerDocument(type, fichier) {
  const s = await session();
  const pdf = fichier.type === "application/pdf";
  if (fichier.size > 10 * 1024 * 1024) throw new Error("Fichier trop lourd (10 Mo maximum).");
  const contenu = pdf ? fichier : await reduirePhoto(fichier, 2000, 0.8);
  const chemin = `${s.user.id}/${type}-${Date.now()}.${pdf ? "pdf" : "jpg"}`;
  const { error: e1 } = await supabase.storage.from("documents-cleaneurs").upload(chemin, contenu, { contentType: pdf ? "application/pdf" : "image/jpeg" });
  if (e1) throw new Error(e1.message);
  const { error: e2 } = await supabase.from("documents_cleaneur").insert({ cleaneur_id: s.user.id, type, chemin });
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
