// Badge « Logement contrôlé Cleaneroo » (18 novembre 2026) : une page publique par bien, à mettre dans son annonce
// (Airbnb, Booking) ou son livret d'accueil. Elle montre la date du dernier ménage validé, les pièces contrôlées en photo
// et la part validée par l'IA du premier coup — jamais l'adresse ni le nom du propriétaire. Même badge dans l'appli (Badge.kt).
import { supabase } from "./donnees.js";
import { dateLongue } from "./regles.js";
import { traduire, tr } from "./langue.js";
import { icone } from "./icones.js";
import { TYPES_LOGEMENT } from "./catalogue.js";

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const lienBadge = code => `https://cleaneroo.fr/#/controle/${code}`;

/** Page publique #/controle/<code>. */
export async function pageBadge(vue, code) {
  let b = null;
  try { ({ data: b } = await supabase.rpc("badge_controle", { p_code: code })); } catch { /* lien invalide */ }
  if (!b) { vue.innerHTML = `<section class="bloc"><div class="etroit"><h1>${tr("Badge introuvable")}</h1><p class="muet">${tr("Ce lien n'est pas valable.")}</p></div></section>`; traduire(vue); return; }
  const taux = b.pieces ? Math.round(b.premier_coup * 100 / b.pieces) : null;
  vue.innerHTML = `<section class="bloc badge-page"><div class="etroit">
    <div class="carte badge-controle">
      <img src="/assets/img/logo-marque.svg?v=2" alt="" width="88" height="88">
      <span class="surtitre">${tr("Logement contrôlé Cleaneroo")}</span>
      <h1>${esc(tr(TYPES_LOGEMENT.find(t => t.id === b.type)?.nom || b.type || "Logement"))}${b.ville ? ` · ${esc(b.ville)}` : ""}</h1>
      ${b.dernier ? `<p class="badge-date">${icone("valide")} ${tr("Dernier ménage validé le")} <b>${dateLongue(new Date(b.dernier))}</b></p>`
        : `<p class="muet">${tr("Le premier ménage contrôlé apparaîtra ici.")}</p>`}
      <div class="badge-chiffres">
        <div><b>${b.menages_90j}</b><span>${tr("ménages validés en 90 jours")}</span></div>
        <div><b>${b.pieces}</b><span>${tr("pièces contrôlées en photo")}</span></div>
        ${taux !== null ? `<div><b>${taux} %</b><span>${tr("validées par l'IA du premier coup")}</span></div>` : ""}
      </div>
      <p class="petit">${tr("Chaque ménage Cleaneroo est contrôlé pièce par pièce, en photo, avant d'être validé et payé.")}</p>
      <a class="bouton plein" href="/#/">${tr("Découvrir Cleaneroo")}</a>
    </div></div></section>`;
  traduire(vue);
}

/** « Mes biens » : bouton qui affiche et copie le lien du badge d'un bien. */
export function brancherBadges(racine) {
  racine.querySelectorAll("[data-badge-bien]").forEach(bt => bt.onclick = async () => {
    let code = null;
    try { ({ data: code } = await supabase.rpc("lien_badge", { p_bien: bt.dataset.badgeBien })); } catch { /* rien */ }
    const zone = bt.closest(".corps")?.querySelector("[data-zone-badge]");
    if (!zone) return;
    if (!code) { zone.innerHTML = `<p class="erreur">${tr("Enregistrez d'abord ce bien, puis réessayez.")}</p>`; traduire(zone); return; }
    const lien = lienBadge(code);
    zone.innerHTML = `<div class="note" style="margin-top:8px"><span>${tr("Mettez ce lien dans votre annonce ou votre livret d'accueil : vos voyageurs voient que le logement est contrôlé à chaque ménage.")}</span></div>
      <input class="texte" readonly value="${esc(lien)}" onclick="this.select()">
      <button type="button" class="lien-bouton" data-copier-badge>${tr("Copier le lien")}</button> · <a href="${esc(lien)}" target="_blank" rel="noopener">${tr("Voir le badge")}</a>`;
    zone.querySelector("[data-copier-badge]").onclick = e => { navigator.clipboard?.writeText(lien); e.target.textContent = tr("Lien copié"); };
    traduire(zone);
  });
}
