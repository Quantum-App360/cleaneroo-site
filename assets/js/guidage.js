// Guidage vers une adresse (prompt 4, lot 6, accord de Michael du 25/11) : Waze, Google Maps ou Plans (iPhone), au choix du Cleaneur.
// Le choix est gardé sur l'appareil (c'est l'appli installée sur ce téléphone qui compte). Waze ne prend qu'une destination :
// un bouton par étape ; l'itinéraire de toute la tournée reste sur Google Maps (plusieurs arrêts).
// Coordonnées GPS envoyées quand elles sont connues (arrivée au bon endroit), sinon l'adresse en texte.
import { coordonnees } from "./cartes.js";
import { tr } from "./langue.js";

export const APPLIS_GUIDAGE = [["waze", "Waze"], ["google", "Google Maps"], ["plans", "Plans (iPhone)"]];
const CLE = "cleaneroo-guidage";
export function appliGuidage() {
  try { const a = localStorage.getItem(CLE); if (APPLIS_GUIDAGE.some(x => x[0] === a)) return a; } catch { /* rien */ }
  return "waze";
}
export function choisirAppliGuidage(a) { try { localStorage.setItem(CLE, a); } catch { /* rien */ } }
export const nomAppliGuidage = (a = appliGuidage()) => (APPLIS_GUIDAGE.find(x => x[0] === a) || APPLIS_GUIDAGE[0])[1].replace(" (iPhone)", "");

const enc = s => encodeURIComponent(String(s || "").trim());
/** Lien de guidage : { lat, lon } si connus, sinon l'adresse en texte. */
export function urlGuidage(destination, appli = appliGuidage()) {
  const { lat, lon, adresse } = destination || {};
  const gps = Number.isFinite(lat) && Number.isFinite(lon);
  if (!gps && !String(adresse || "").trim()) return null;
  if (appli === "google") return `https://www.google.com/maps/dir/?api=1&travelmode=driving&destination=${gps ? `${lat},${lon}` : enc(adresse)}`;
  if (appli === "plans") return `https://maps.apple.com/?dirflg=d&daddr=${gps ? `${lat},${lon}` : enc(adresse)}`;
  return gps ? `https://waze.com/ul?ll=${lat},${lon}&navigate=yes` : `https://waze.com/ul?q=${enc(adresse)}&navigate=yes`;
}

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
/** Bouton « Y aller avec Waze » ; brancherGuidage() remplace ensuite l'adresse par les coordonnées GPS. */
export function boutonGuidage({ rue = "", cp = "", ville = "", lat = null, lon = null }, { classe = "bouton secondaire", libelle = "" } = {}) {
  const adresse = `${rue || ""} ${cp || ""} ${ville || ""}`.trim();
  const url = urlGuidage({ lat, lon, adresse });
  if (!url) return "";
  return `<a class="${classe}" target="_blank" rel="noopener" href="${esc(url)}" data-guidage data-rue="${esc(rue)}" data-cp="${esc(cp)}" data-ville="${esc(ville)}"${Number.isFinite(lat) ? ` data-lat="${lat}" data-lon="${lon}"` : ""}>${esc(libelle || `${tr("Y aller avec")} ${nomAppliGuidage()}`)}</a>`;
}
/** Coordonnées GPS (mémorisées sur l'appareil) mises dans les liens de guidage de [racine]. */
export async function brancherGuidage(racine) {
  for (const a of racine?.querySelectorAll("[data-guidage]:not([data-lat])") || []) {
    const p = await coordonnees(a.dataset.rue || "", a.dataset.cp || "", a.dataset.ville || "").catch(() => null);
    if (!p || !a.isConnected) continue;
    a.dataset.lat = p.lat; a.dataset.lon = p.lon;
    a.href = urlGuidage({ lat: p.lat, lon: p.lon });
  }
}
/** Choix de l'appli de guidage (préférences de l'espace Cleaneur). */
export function choixGuidage() {
  const a = appliGuidage();
  return `<label class="champ choix-guidage"><span>${tr("Application de guidage")}</span><select data-choix-guidage>
    ${APPLIS_GUIDAGE.map(([id, nom]) => `<option value="${id}"${id === a ? " selected" : ""}>${esc(tr(nom))}</option>`).join("")}</select>
    <small class="petit muet">${tr("Utilisée par les boutons « Y aller » de vos missions et de votre tournée, sur cet appareil.")}</small></label>`;
}
export function brancherChoixGuidage(racine, apres) {
  racine?.querySelector("[data-choix-guidage]")?.addEventListener("change", e => { choisirAppliGuidage(e.target.value); apres?.(); });
}
