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

/** Page « Notifications » (#/notifications). */
export async function pageNotifications(vue, espaceVoulu) {
  const p = await monProfil().catch(() => null);
  if (!p) { location.hash = "#/compte"; return; }
  const cleaneur = (p.statuts || []).includes("cleaneur") || p.role === "cleaneur";
  const client = (p.statuts || []).some(s => s === "particulier" || s === "pro");
  const espace = espaceVoulu || (p.espace === "cleaneur" && cleaneur ? "cleaneur" : client ? "client" : "cleaneur");
  const [{ data: liste }, demandes] = await Promise.all([supabase.rpc("mes_notifications", { p_espace: espace }), espace === "client" ? demandesDuCompte().catch(() => []) : []]);
  const jetons = Object.fromEntries((demandes || []).map(d => [d.reference, d.jeton]));
  const lien = n => n.titre === "Nouveau message" && n.reference ? `#/messages/${encodeURIComponent(n.reference)}` : !n.reference ? "" : espace === "client" ? (jetons[n.reference] ? `#/demande/${encodeURIComponent(n.reference)}/${encodeURIComponent(jetons[n.reference])}` : "#/mes-prestations") : "#/compte/cleaneur";
  vue.innerHTML = `<section class="bloc"><div class="etroit">
    <h1>🔔 ${tr("Notifications")}</h1><div class="trait-corail"></div>
    ${cleaneur && client ? `<div class="choix-periode" role="tablist">${[["client", "Espace client"], ["cleaneur", "Espace Cleaneur"]].map(([v, t]) =>
      `<a role="tab" class="${v === espace ? "actif" : ""}" aria-selected="${v === espace}" href="#/notifications/${v}">${tr(t)}</a>`).join("")}</div>` : ""}
    ${liste?.some(n => !n.lu) ? `<p><button type="button" class="lien-bouton" id="tout-lu">${tr("Tout marquer comme lu")}</button></p>` : ""}
    ${liste?.length ? `<div class="liste-notifications">${liste.map(n => `<a class="carte notification${n.lu ? "" : " non-lue"} ${n.niveau}" href="${lien(n) || "#/notifications"}">
        <span class="icone-notif" aria-hidden="true">${ICONES[n.type] || "🔔"}</span>
        <span class="corps-notif"><b>${esc(tr(n.titre))}</b>${n.texte ? `<span class="petit">${esc(tr(n.texte))}</span>` : ""}</span>
        <span class="petit quand-notif">${quand(n.cree_le)}</span></a>`).join("")}</div>`
      : `<div class="vide-compte"><p class="muet">${tr("Aucune notification pour l'instant.")}</p><p class="petit">${tr("Vous serez prévenu ici à chaque étape de vos prestations.")}</p></div>`}
  </div></section>`;
  traduire(vue);
  styles();
  vue.querySelector("#tout-lu")?.addEventListener("click", async () => { await supabase.rpc("tout_marquer_lu", { p_espace: espace }); pageNotifications(vue, espace); majCloche(); });
  // Ouvrir la page marque la liste comme lue après un court instant (les non lues restent visibles en gras).
  if (liste?.some(n => !n.lu)) setTimeout(async () => { await supabase.rpc("tout_marquer_lu", { p_espace: espace }); majCloche(); }, 2500);
}

export function styles() {
  if (document.getElementById("styles-notifications")) return;
  const s = document.createElement("style");
  s.id = "styles-notifications";
  s.textContent = `.choix-periode{display:inline-flex;gap:4px;background:rgba(31,138,128,.08);border-radius:99px;padding:4px;margin-bottom:10px}
    .cloche{position:relative;display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;text-decoration:none;font-size:1.2rem}
    .cloche:hover{background:rgba(31,138,128,.1)}
    .pastille-cloche{position:absolute;top:2px;right:0;min-width:18px;height:18px;padding:0 5px;border-radius:99px;background:#E0654B;color:#fff;font-size:.7rem;font-weight:800;line-height:18px;text-align:center}
    .liste-notifications{display:flex;flex-direction:column;gap:8px}
    .notification{display:flex;align-items:flex-start;gap:12px;text-decoration:none;color:inherit;margin:0}
    .notification.non-lue{border-left:4px solid var(--primaire,#1F8A80)}.notification.non-lue b{font-weight:800}
    .notification.urgent{border-left-color:#E0654B}
    .icone-notif{font-size:1.3rem;line-height:1.4}.corps-notif{flex:1;display:flex;flex-direction:column;gap:2px}.quand-notif{white-space:nowrap}
    .choix-periode a{text-decoration:none;color:inherit;font-weight:600;padding:7px 16px;border-radius:99px}.choix-periode a.actif{background:var(--fond,#fff);color:var(--primaire,#1F8A80);box-shadow:0 1px 4px rgba(0,0,0,.12)}`;
  document.head.appendChild(s);
}
