// Mission sans réseau (prompt 4, lot 6, validé par Michael le 25/11) : caves, immeubles, campagne.
// Les tâches cochées, les photos avant / après et les justifications du contrôle pièce par pièce sont gardées sur l'appareil
// (IndexedDB) quand le réseau manque, puis envoyées dans l'ordre dès qu'il revient. La liste des pièces est aussi gardée,
// pour rouvrir la mission hors connexion. « J'ai terminé » attend que tout soit envoyé (le contrôle se fait côté serveur).
import { majPiece, deposerPhotoControle, controleIA } from "./donnees.js";

const BASE = "cleaneroo-hors-ligne", MAGASIN = "envois";
let ouverture = null;
function base() {
  if (ouverture) return ouverture;
  ouverture = new Promise((ok, ko) => {
    if (!("indexedDB" in self)) return ko(new Error("indexedDB"));
    const r = indexedDB.open(BASE, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(MAGASIN, { keyPath: "id", autoIncrement: true });
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
  return ouverture;
}
const transaction = async (mode, f) => {
  const db = await base();
  return new Promise((ok, ko) => {
    const t = db.transaction(MAGASIN, mode), s = t.objectStore(MAGASIN);
    const r = f(s);
    t.oncomplete = () => ok(r?.result);
    t.onerror = () => ko(t.error);
  });
};

/** Erreur due au réseau (et non refus du serveur) : on garde l'envoi pour plus tard. */
export const erreurReseau = e => !navigator.onLine || e instanceof TypeError || /fetch|network|réseau|Failed to fetch|Load failed/i.test(String(e?.message || e));

/** Garde un envoi : { type: "tache" | "photo" | "justif", reference, piece, tache?, valeur?, moment?, blob?, texte? }. */
export async function garder(envoi) {
  await transaction("readwrite", s => s.add({ ...envoi, cree: Date.now() }));
  signaler();
}
/** Envois en attente (d'une mission, ou tous). */
export async function enAttente(reference = null) {
  const tous = await transaction("readonly", s => s.getAll()).catch(() => []);
  return (tous || []).filter(e => !reference || e.reference === reference).sort((a, b) => a.id - b.id);
}
const retirer = id => transaction("readwrite", s => s.delete(id));

let enCours = false;
/** Envoie tout ce qui attend, dans l'ordre ; s'arrête au premier échec réseau. Renvoie le nombre d'envois restants. */
export async function vider() {
  if (enCours || !navigator.onLine) return (await enAttente()).length;
  enCours = true;
  try {
    for (const e of await enAttente()) {
      try {
        if (e.type === "tache") { if ((await majPiece(e.reference, e.piece, { taches: { [e.tache]: e.valeur } })) !== "ok") throw new Error("refus"); }
        else if (e.type === "justif") { if ((await majPiece(e.reference, e.piece, { justification: e.texte })) !== "ok") throw new Error("refus"); }
        else if (e.type === "photo") {
          const chemin = await deposerPhotoControle(e.reference, e.piece, e.moment, new File([e.blob], "photo.jpg", { type: e.blob.type || "image/jpeg" }));
          if ((await majPiece(e.reference, e.piece, e.moment === "avant" ? { photoAvant: chemin } : { photoApres: chemin })) !== "ok") throw new Error("refus");
          if (e.moment === "apres") await controleIA(e.reference, e.piece).catch(() => null);
        }
        await retirer(e.id);
      } catch (err) {
        if (erreurReseau(err)) break;
        await retirer(e.id);   // refusé par le serveur (mission terminée, pièce supprimée) : inutile de réessayer
      }
    }
  } finally { enCours = false; }
  const reste = (await enAttente()).length;
  signaler();
  return reste;
}
const signaler = () => dispatchEvent(new CustomEvent("cleaneroo-file-attente"));
addEventListener("online", () => { vider(); });

/** Liste des pièces gardée pour rouvrir la mission sans réseau. */
export const garderListe = (reference, liste) => { try { localStorage.setItem(`cleaneroo-pieces-${reference}`, JSON.stringify(liste)); } catch { /* rien */ } };
export const listeGardee = reference => { try { return JSON.parse(localStorage.getItem(`cleaneroo-pieces-${reference}`) || "null"); } catch { return null; } };
