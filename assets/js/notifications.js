// Centre de notifications (12 novembre 2026, repris de l'appli iPhone de Vincent) : une liste par espace (client, Cleaneur),
// non lues en gras, « Tout marquer comme lu », toucher = ouvrir la prestation. Cloche avec pastille dans l'en-tête.
// Notifications créées par la base à chaque étape (base-notifications.sql). Même écran dans l'appli (Notifications.kt).
import { modeCleaneur } from "./mode.js";
import { icone } from "./icones.js";
import { supabase, monProfil, demandesDuCompte } from "./donnees.js";
import { tr, traduire, LOCALE } from "./langue.js";
import { esc } from "./commun.js";

// Lot 7 du prompt 4 (25/11/2026) : filtres (Toutes, Importantes, Prestations, Messages, Paiements, Avis), regroupement par jour,
// pastille de couleur par type, mention « Urgent » ou « Important », action proposée (Répondre, Voir la prestation) et
// bandeau discret quand une notification importante arrive pendant la navigation.
const ICONE_TYPE = { mission: "calendrier", confirmee: "valide", progression: "position", compte_rendu: "document", paiement: "paiement",
  alerte: "alerte", info: "cloche", avis: "avis", secteur: "position", prix: "paiement", message: "message" };
const estMessage = n => n.titre === "Nouveau message";
/** Catégorie d'une notification pour les filtres. Fonction pure, testée. */
export function categorieNotif(n) {
  if (estMessage(n)) return "messages";
  if (n.type === "paiement" || n.type === "prix") return "paiements";
  if (n.type === "avis") return "avis";
  if (["mission", "confirmee", "progression", "compte_rendu", "alerte"].includes(n.type) || n.reference) return "prestations";
  return "autres";
}
export const FILTRES_NOTIF = [["toutes", "Toutes"], ["importantes", "Importantes"], ["prestations", "Prestations"], ["messages", "Messages"], ["paiements", "Paiements"], ["avis", "Avis"]];
const passeFiltre = (n, f) => f === "toutes" || (f === "importantes" ? ["important", "urgent"].includes(n.niveau) : categorieNotif(n) === f);
/** Groupe de jour d'une date : « Aujourd'hui », « Hier », « Cette semaine », « Plus tôt ». Fonction pure, testée. */
export function groupeJour(iso, maintenant = new Date()) {
  const jour = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime(); };
  const ecart = Math.round((jour(maintenant) - jour(iso)) / 864e5);
  return ecart <= 0 ? "Aujourd'hui" : ecart === 1 ? "Hier" : ecart < 7 ? "Cette semaine" : "Plus tôt";
}
const quand = iso => { const d = new Date(iso), m = Math.round((Date.now() - d) / 60000);
  return m < 1 ? tr("à l'instant") : m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : d.toLocaleDateString(LOCALE, { day: "numeric", month: "short" }); };

/** Pastille de la cloche : nombre de notifications non lues (tous espaces). Une notification importante qui arrive
 *  pendant la navigation s'annonce aussi dans un bandeau (sauf sur la page des notifications). */
let minuterie = null, dernierNombre = null;
export async function majCloche() {
  styles();
  if (!minuterie) minuterie = setInterval(majCloche, 60000);
  const pastille = document.querySelectorAll(".pastille-cloche-notifs");
  if (!pastille.length) return;
  const { data } = await supabase.rpc("notifications_non_lues");
  const n = data ? (data.client || 0) + (data.cleaneur || 0) : 0;
  pastille.forEach(p => { p.textContent = n > 99 ? "99+" : String(n); p.hidden = !n; });
  const avant = dernierNombre;
  dernierNombre = n;
  if (avant !== null && n > avant && !location.hash.startsWith("#/notifications")) annoncer().catch(() => null);
}
async function annoncer() {
  const espace = modeCleaneur() ? "cleaneur" : "client";
  const { data } = await supabase.rpc("mes_notifications", { p_espace: espace });
  const n = (data || []).find(x => !x.lu && ["important", "urgent"].includes(x.niveau) && Date.now() - new Date(x.cree_le) < 5 * 60000);
  if (!n) return;
  document.querySelector(".bandeau-notif")?.remove();
  const b = document.createElement("a");
  b.className = `bandeau-notif ${esc(n.niveau)}`;
  b.href = estMessage(n) && n.reference ? `#/messages/${encodeURIComponent(n.reference)}` : `#/notifications/${espace}`;
  b.setAttribute("role", "status");
  b.innerHTML = `${icone(ICONE_TYPE[estMessage(n) ? "message" : n.type] || "cloche", { tuile: true })}<span><b>${esc(tr(n.titre))}</b>${n.texte ? `<span class="petit">${esc(tr(n.texte))}</span>` : ""}</span>`;
  document.body.appendChild(b);
  const partir = () => { b.classList.add("partie"); setTimeout(() => b.remove(), 300); };
  b.addEventListener("click", partir);
  setTimeout(partir, 7000);
}

/** Page « Notifications » (#/notifications[/client|cleaneur][/archives]).
 * 20 novembre 2026 : une notification se fait glisser à gauche ou à droite pour l'archiver (ou bouton « Archiver ») ;
 * rien n'est supprimé, tout reste dans « Archives », d'où on peut la remettre dans la liste. */
let filtreChoisi = "toutes";
export async function pageNotifications(vue, espaceVoulu) {
  const p = await monProfil().catch(() => null);
  if (!p) { location.hash = "#/compte"; return; }
  const archives = location.hash.split("/")[3] === "archives" || espaceVoulu === "archives";
  if (espaceVoulu === "archives") espaceVoulu = null;
  const cleaneur = (p.statuts || []).includes("cleaneur") || p.role === "cleaneur";
  const client = (p.statuts || []).some(s => s !== "cleaneur");
  const espace = espaceVoulu || (cleaneur && client ? (modeCleaneur() ? "cleaneur" : "client") : cleaneur ? "cleaneur" : "client");
  const [{ data: liste }, demandes] = await Promise.all([supabase.rpc(archives ? "mes_notifications_archivees" : "mes_notifications", { p_espace: espace }),
    espace === "client" ? demandesDuCompte().catch(() => []) : []]);
  const jetons = Object.fromEntries((demandes || []).map(d => [d.reference, d.jeton]));
  const lien = n => estMessage(n) && n.reference ? `#/messages/${encodeURIComponent(n.reference)}` : !n.reference ? "" : espace === "client" ? (jetons[n.reference] ? `#/demande/${encodeURIComponent(n.reference)}/${encodeURIComponent(jetons[n.reference])}` : "#/mes-demandes") : "#/compte/cleaneur";
  const action = n => estMessage(n) ? "Répondre" : n.reference ? (espace === "client" ? "Voir la prestation" : "Voir la mission") : "";
  const base = `#/notifications/${espace}`;
  const toutes = liste || [];
  const compte = f => toutes.filter(n => passeFiltre(n, f)).length;
  const visibles = toutes.filter(n => passeFiltre(n, filtreChoisi));
  const groupes = [];
  visibles.forEach(n => { const g = groupeJour(n.cree_le); const x = groupes.find(y => y[0] === g); x ? x[1].push(n) : groupes.push([g, [n]]); });
  const carte = n => `<div class="notif-glisse" data-id="${esc(n.id)}">
        <div class="notif-fond" aria-hidden="true"><span>${icone("stock")} ${tr(archives ? "Remettre" : "Archiver")}</span><span>${icone("stock")} ${tr(archives ? "Remettre" : "Archiver")}</span></div>
        <a class="carte notification${n.lu ? "" : " non-lue"} ${esc(n.niveau)}" href="${lien(n) || base}">
        ${icone(ICONE_TYPE[estMessage(n) ? "message" : n.type] || "cloche", { tuile: true })}
        <span class="corps-notif"><span class="ligne-titre-notif"><b>${esc(tr(n.titre))}</b>${n.niveau === "urgent" ? `<span class="marque-notif urgent">${tr("Urgent")}</span>` : n.niveau === "important" && !n.lu ? `<span class="marque-notif">${tr("Important")}</span>` : ""}</span>
          ${n.texte ? `<span class="petit">${esc(tr(n.texte))}</span>` : ""}
          ${action(n) && lien(n) ? `<span class="action-notif">${tr(action(n))} ›</span>` : ""}</span>
        <span class="petit quand-notif">${quand(n.cree_le)}</span>
        <button type="button" class="archiver-notif" data-archiver="${esc(n.id)}" title="${tr(archives ? "Remettre dans les notifications" : "Archiver")}" aria-label="${tr(archives ? "Remettre dans les notifications" : "Archiver")}">${icone(archives ? "repeter" : "stock")}</button></a></div>`;
  vue.innerHTML = `<section class="bloc"><div class="etroit">
    <h1>${icone("cloche")} ${tr(archives ? "Notifications archivées" : "Notifications")}</h1><div class="trait-corail"></div>
    ${cleaneur && client ? `<div class="choix-periode" role="tablist">${[["client", "Espace client"], ["cleaneur", "Espace Cleaneur"]].map(([v, t]) =>
      `<a role="tab" class="${v === espace ? "actif" : ""}" aria-selected="${v === espace}" href="#/notifications/${v}${archives ? "/archives" : ""}">${tr(t)}</a>`).join("")}</div>` : ""}
    ${toutes.length ? `<div class="filtres-notifs" role="group" aria-label="${tr("Filtrer les notifications")}">${FILTRES_NOTIF.filter(([f]) => f === "toutes" || compte(f)).map(([f, t]) =>
      `<button type="button" class="puce${f === filtreChoisi ? " choisie" : ""}" aria-pressed="${f === filtreChoisi}" data-filtre-notif="${f}">${tr(t)} <span class="nb-filtre">${compte(f)}</span></button>`).join("")}</div>` : ""}
    <p class="actions-notifs">${archives ? `<a class="lien-bouton" href="${base}">‹ ${tr("Retour aux notifications")}</a>`
      : `${toutes.length ? `<button type="button" class="lien-bouton" id="tout-archiver">${tr("Tout archiver")}</button>` : ""}<a class="lien-bouton" href="${base}/archives">${icone("stock")} ${tr("Archives")}</a>`}</p>
    ${!archives && toutes.length ? `<p class="petit muet aide-glisser">${tr("Glissez une notification vers la gauche ou la droite pour l'archiver. Vous la retrouvez dans « Archives ».")}</p>` : ""}
    ${visibles.length ? groupes.map(([g, ns]) => `<h2 class="jour-notifs">${tr(g)}</h2><div class="liste-notifications">${ns.map(carte).join("")}</div>`).join("")
      : toutes.length ? `<div class="vide-compte"><p class="muet">${tr("Aucune notification dans cette catégorie.")}</p></div>`
      : `<div class="vide-compte">${icone("cloche", { tuile: true })}<p class="muet">${tr(archives ? "Aucune notification archivée." : "Aucune notification pour l'instant.")}</p>${archives ? "" : `<p class="petit">${tr("Vous serez prévenu ici à chaque étape de vos prestations.")}</p>`}</div>`}
  </div></section>`;
  traduire(vue);
  styles();
  vue.querySelectorAll("[data-filtre-notif]").forEach(b => b.onclick = () => { filtreChoisi = b.dataset.filtreNotif; pageNotifications(vue, archives ? "archives" : espace); });
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
  if (!archives && toutes.some(n => !n.lu)) setTimeout(async () => { await supabase.rpc("tout_marquer_lu", { p_espace: espace }); majCloche(); }, 2500);
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
    el.classList.toggle("vers-gauche", dx < 0); el.classList.add("en-glisse");
  });
  const fin = () => {
    if (x0 === null) return;
    x0 = null; carte.style.transition = "";
    if (horizontal && Math.abs(dx) > el.offsetWidth * 0.35) { carte.style.transform = `translateX(${dx > 0 ? "" : "-"}110%)`; action(); }
    else { carte.style.transform = ""; setTimeout(() => el.classList.remove("en-glisse"), 220); }
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
    .notification.urgent{border-left:4px solid var(--erreur,#E0654B)}.notification.urgent.non-lue{border-left-color:var(--erreur,#E0654B)}
    .notification .tuile-ico{flex:none}.ligne-titre-notif{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
    .marque-notif{font-size:.7rem;font-weight:800;padding:2px 8px;border-radius:99px;background:color-mix(in srgb,var(--primaire,#1F8A80) 14%,transparent);color:var(--primaire,#1F8A80)}
    .marque-notif.urgent{background:color-mix(in srgb,var(--erreur,#E0654B) 16%,transparent);color:var(--erreur,#E0654B)}
    .action-notif{font-size:.82rem;font-weight:700;color:var(--primaire,#1F8A80);margin-top:2px}
    .filtres-notifs{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 8px}
    .nb-filtre{opacity:.7;font-weight:600;margin-left:2px}.jour-notifs{font-size:.8rem;text-transform:uppercase;letter-spacing:.06em;opacity:.65;margin:18px 0 8px}
    .vide-compte .tuile-ico{margin:0 auto 8px}
    .bandeau-notif{position:fixed;z-index:1000;left:50%;top:76px;transform:translateX(-50%);width:min(440px,calc(100vw - 24px));display:flex;gap:12px;align-items:flex-start;padding:12px 14px;border-radius:16px;background:var(--surface,#fff);color:inherit;text-decoration:none;box-shadow:0 10px 30px rgba(0,0,0,.18);border-left:4px solid var(--primaire,#1F8A80);animation:arrivee-notif .3s ease-out}
    .bandeau-notif.urgent{border-left-color:var(--erreur,#E0654B)}.bandeau-notif span{display:flex;flex-direction:column;gap:2px}.bandeau-notif.partie{opacity:0;transition:opacity .3s}
    @keyframes arrivee-notif{from{opacity:0;transform:translate(-50%,-10px)}to{opacity:1;transform:translate(-50%,0)}}
    @media (prefers-reduced-motion:reduce){.bandeau-notif{animation:none}}
    .icone-notif{font-size:1.3rem;line-height:1.4}.corps-notif{flex:1;display:flex;flex-direction:column;gap:2px}.quand-notif{white-space:nowrap}
      .notif-glisse{position:relative;border-radius:16px;overflow:hidden;transition:max-height .25s, opacity .25s, margin .25s;max-height:240px}
    .notif-glisse.partie{max-height:0;opacity:0;margin:-4px 0}
    .notif-fond{position:absolute;inset:1px;opacity:0;transition:opacity .15s;display:flex;align-items:center;justify-content:space-between;padding:0 18px;background:linear-gradient(90deg,#0DC88D,#1F8A80);color:#fff;font-weight:800;border-radius:16px}
    .notif-glisse.en-glisse .notif-fond{opacity:1}.notif-glisse .notification{border-radius:16px;position:relative;transition:transform .22s;touch-action:pan-y;user-select:none}
    .archiver-notif{flex:none;border:0;background:none;color:inherit;cursor:pointer;opacity:.55;padding:2px 4px}.archiver-notif .ico{width:18px;height:18px}.archiver-notif:hover{opacity:1}
    .actions-notifs{display:flex;gap:16px;flex-wrap:wrap;align-items:center}.aide-glisser{margin:-4px 0 10px}
    .choix-periode a{text-decoration:none;color:inherit;font-weight:600;padding:7px 16px;border-radius:99px}.choix-periode a.actif{background:var(--fond,#fff);color:var(--primaire,#1F8A80);box-shadow:0 1px 4px rgba(0,0,0,.12)}`;
  document.head.appendChild(s);
}
