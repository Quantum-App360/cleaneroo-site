// Centre de notifications (12 novembre 2026, repris de l'appli iPhone de Vincent) : une liste par espace (client, Cleaneur),
// non lues en gras, « Tout marquer comme lu », toucher = ouvrir la prestation. Cloche avec pastille dans l'en-tête.
// Notifications créées par la base à chaque étape (base-notifications.sql). Même écran dans l'appli (Notifications.kt).
import { supabase, monProfil, demandesDuCompte } from "./donnees.js";
import { tr, traduire } from "./langue.js";
import { esc } from "./commun.js";

const ICONES = { mission: "🧽", confirmee: "✅", progression: "🚗", compte_rendu: "📋", paiement: "💶", alerte: "⚠️", info: "ℹ️", avis: "⭐" };
const quand = iso => { const d = new Date(iso), m = Math.round((Date.now() - d) / 60000);
  return m < 1 ? tr("à l'instant") : m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }); };

/** Pastille de la cloche : nombre de notifications non lues (tous espaces). */
let minuterie = null;
export async function majCloche() {
  styles();
  if (!minuterie) minuterie = setInterval(majCloche, 60000);
  const pastille = document.querySelectorAll(".pastille-cloche");
  if (!pastille.length) return;
  const { data } = await supabase.rpc("notifications_non_lues");
  const n = data ? (data.client || 0) + (data.cleaneur || 0) : 0;
  pastille.forEach(p => { p.textContent = n > 99 ? "99+" : String(n); p.hidden = !n; });
}

/** Page « Notifications » (#/notifications[/client|cleaneur][/archives]).
 * 20 novembre 2026 : une notification se fait glisser à gauche ou à droite pour l'archiver (ou bouton « Archiver ») ;
 * rien n'est supprimé, tout reste dans « Archives », d'où on peut la remettre dans la liste. */
export async function pageNotifications(vue, espaceVoulu) {
  const p = await monProfil().catch(() => null);
  if (!p) { location.hash = "#/compte"; return; }
  const archives = location.hash.split("/")[3] === "archives" || espaceVoulu === "archives";
  if (espaceVoulu === "archives") espaceVoulu = null;
  const cleaneur = (p.statuts || []).includes("cleaneur") || p.role === "cleaneur";
  const client = (p.statuts || []).some(s => s !== "cleaneur");
  const espace = espaceVoulu || (p.espace === "cleaneur" && cleaneur ? "cleaneur" : client ? "client" : "cleaneur");
  const [{ data: liste }, demandes] = await Promise.all([supabase.rpc(archives ? "mes_notifications_archivees" : "mes_notifications", { p_espace: espace }),
    espace === "client" ? demandesDuCompte().catch(() => []) : []]);
  const jetons = Object.fromEntries((demandes || []).map(d => [d.reference, d.jeton]));
  const lien = n => n.titre === "Nouveau message" && n.reference ? `#/messages/${encodeURIComponent(n.reference)}` : !n.reference ? "" : espace === "client" ? (jetons[n.reference] ? `#/demande/${encodeURIComponent(n.reference)}/${encodeURIComponent(jetons[n.reference])}` : "#/mes-demandes") : "#/compte/cleaneur";
  const base = `#/notifications/${espace}`;
  vue.innerHTML = `<section class="bloc"><div class="etroit">
    <h1>🔔 ${tr(archives ? "Notifications archivées" : "Notifications")}</h1><div class="trait-corail"></div>
    ${cleaneur && client ? `<div class="choix-periode" role="tablist">${[["client", "Espace client"], ["cleaneur", "Espace Cleaneur"]].map(([v, t]) =>
      `<a role="tab" class="${v === espace ? "actif" : ""}" aria-selected="${v === espace}" href="#/notifications/${v}${archives ? "/archives" : ""}">${tr(t)}</a>`).join("")}</div>` : ""}
    <p class="actions-notifs">${archives ? `<a class="lien-bouton" href="${base}">‹ ${tr("Retour aux notifications")}</a>`
      : `${liste?.length ? `<button type="button" class="lien-bouton" id="tout-archiver">${tr("Tout archiver")}</button>` : ""}<a class="lien-bouton" href="${base}/archives">🗂 ${tr("Archives")}</a>`}</p>
    ${!archives && liste?.length ? `<p class="petit muet aide-glisser">${tr("Glissez une notification vers la gauche ou la droite pour l'archiver. Vous la retrouvez dans « Archives ».")}</p>` : ""}
    ${liste?.length ? `<div class="liste-notifications">${liste.map(n => `<div class="notif-glisse" data-id="${esc(n.id)}">
        <div class="notif-fond" aria-hidden="true"><span>🗂 ${tr(archives ? "Remettre" : "Archiver")}</span><span>🗂 ${tr(archives ? "Remettre" : "Archiver")}</span></div>
        <a class="carte notification${n.lu ? "" : " non-lue"} ${esc(n.niveau)}" href="${lien(n) || base}">
        <span class="icone-notif" aria-hidden="true">${ICONES[n.type] || "🔔"}</span>
        <span class="corps-notif"><b>${esc(tr(n.titre))}</b>${n.texte ? `<span class="petit">${esc(tr(n.texte))}</span>` : ""}</span>
        <span class="petit quand-notif">${quand(n.cree_le)}</span>
        <button type="button" class="archiver-notif" data-archiver="${esc(n.id)}" title="${tr(archives ? "Remettre dans les notifications" : "Archiver")}" aria-label="${tr(archives ? "Remettre dans les notifications" : "Archiver")}">${archives ? "↩" : "🗂"}</button></a></div>`).join("")}</div>`
      : `<div class="vide-compte"><p class="muet">${tr(archives ? "Aucune notification archivée." : "Aucune notification pour l'instant.")}</p>${archives ? "" : `<p class="petit">${tr("Vous serez prévenu ici à chaque étape de vos prestations.")}</p>`}</div>`}
  </div></section>`;
  traduire(vue);
  styles();
  const retirer = async (el) => {
    const id = el.dataset.id;
    el.classList.add("partie");
    setTimeout(() => { el.remove(); if (!vue.querySelector(".notif-glisse")) pageNotifications(vue, espace); }, 260);
    await supabase.rpc("archiver_notification", { p_id: id, p_archiver: !archives }).then(() => null, () => null);
    majCloche();
  };
  vue.querySelectorAll("[data-archiver]").forEach(b => b.onclick = e => { e.preventDefault(); e.stopPropagation(); retirer(b.closest(".notif-glisse")); });
  vue.querySelectorAll(".notif-glisse").forEach(el => glisser(el, () => retirer(el)));
  vue.querySelector("#tout-archiver")?.addEventListener("click", async () => {
    await supabase.rpc("tout_archiver", { p_espace: espace }); majCloche(); pageNotifications(vue, espace);
  });
  // Ouvrir la page marque la liste comme lue après un court instant (les non lues restent visibles en gras).
  if (!archives && liste?.some(n => !n.lu)) setTimeout(async () => { await supabase.rpc("tout_marquer_lu", { p_espace: espace }); majCloche(); }, 2500);
}

/** Glisser au doigt (ou à la souris) : au-delà de 35 % de la largeur, la carte part et l'action est faite ; sinon elle revient. */
function glisser(el, action) {
  const carte = el.querySelector(".notification");
  let x0 = null, y0 = 0, dx = 0, horizontal = null, bouge = false;
  carte.addEventListener("pointerdown", e => { if (e.button > 0 || e.target.closest("[data-archiver]")) return; x0 = e.clientX; y0 = e.clientY; dx = 0; horizontal = null; bouge = false; });
  carte.addEventListener("pointermove", e => {
    if (x0 === null) return;
    const ddx = e.clientX - x0, ddy = e.clientY - y0;
    if (horizontal === null && (Math.abs(ddx) > 8 || Math.abs(ddy) > 8)) { horizontal = Math.abs(ddx) > Math.abs(ddy); if (horizontal) carte.setPointerCapture?.(e.pointerId); }
    if (!horizontal) return;
    dx = ddx; bouge = true;
    carte.style.transition = "none"; carte.style.transform = `translateX(${dx}px)`;
    el.classList.toggle("vers-gauche", dx < 0);
  });
  const fin = () => {
    if (x0 === null) return;
    x0 = null; carte.style.transition = "";
    if (horizontal && Math.abs(dx) > el.offsetWidth * 0.35) { carte.style.transform = `translateX(${dx > 0 ? "" : "-"}110%)`; action(); }
    else carte.style.transform = "";
  };
  carte.addEventListener("pointerup", fin); carte.addEventListener("pointercancel", fin);
  // Un glissement n'ouvre pas la notification.
  carte.addEventListener("click", e => { if (bouge) { e.preventDefault(); bouge = false; } }, true);
}

export function styles() {
  if (document.getElementById("styles-notifications")) return;
  const s = document.createElement("style");
  s.id = "styles-notifications";
  s.textContent = `.choix-periode{display:inline-flex;gap:4px;background:rgba(31,138,128,.08);border-radius:99px;padding:4px;margin-bottom:10px}
    .cloche{position:relative;display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;text-decoration:none;font-size:1.2rem}
    .cloche:hover{background:rgba(31,138,128,.1)}
    .pastille-cloche{position:absolute;top:2px;right:0;min-width:18px;height:18px;padding:0 5px;border-radius:99px;background:#E5383B;color:#fff;font-size:.7rem;font-weight:800;line-height:18px;text-align:center}
    .liste-notifications{display:flex;flex-direction:column;gap:8px}
    .notification{display:flex;align-items:flex-start;gap:12px;text-decoration:none;color:inherit;margin:0}
    .notification.non-lue{border-left:4px solid var(--primaire,#1F8A80)}.notification.non-lue b{font-weight:800}
    .notification.urgent{border-left-color:#E0654B}
    .icone-notif{font-size:1.3rem;line-height:1.4}.corps-notif{flex:1;display:flex;flex-direction:column;gap:2px}.quand-notif{white-space:nowrap}
      .notif-glisse{position:relative;border-radius:16px;overflow:hidden;transition:max-height .25s, opacity .25s, margin .25s;max-height:240px}
    .notif-glisse.partie{max-height:0;opacity:0;margin:-4px 0}
    .notif-fond{position:absolute;inset:0;display:flex;align-items:center;justify-content:space-between;padding:0 18px;background:linear-gradient(90deg,#0DC88D,#1F8A80);color:#fff;font-weight:800;border-radius:16px}
    .notif-glisse .notification{position:relative;transition:transform .22s;touch-action:pan-y;user-select:none}
    .archiver-notif{flex:none;border:0;background:none;font-size:1rem;cursor:pointer;opacity:.55;padding:2px 4px}.archiver-notif:hover{opacity:1}
    .actions-notifs{display:flex;gap:16px;flex-wrap:wrap;align-items:center}.aide-glisser{margin:-4px 0 10px}
    .choix-periode a{text-decoration:none;color:inherit;font-weight:600;padding:7px 16px;border-radius:99px}.choix-periode a.actif{background:var(--fond,#fff);color:var(--primaire,#1F8A80);box-shadow:0 1px 4px rgba(0,0,0,.12)}`;
  document.head.appendChild(s);
}
