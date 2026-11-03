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
async function reduirePhoto(fichier) {
  const img = await createImageBitmap(fichier);
  const r = Math.min(1, 1280 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
  c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
  return new Promise(ok => c.toBlob(ok, "image/jpeg", 0.6));
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

/** Ajoute à « Mes demandes » une demande ouverte par son lien de suivi (autre appareil). */
export function memoriser(reference, jeton, rubriqueId) {
  const l = lireLocal();
  if (!l.some(d => d.reference === reference)) { l.unshift({ reference, jeton, rubriqueId, creeLe: new Date().toISOString() }); ecrireLocal(l); }
}
