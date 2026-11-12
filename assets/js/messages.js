// Messagerie (12 novembre 2026, reprise de l'appli iPhone de Vincent) : une conversation par prestation entre le client et
// son Cleaneur (dès que la mission est confirmée) + « Cleaneroo · Support ». Photos jointes. #/messages et #/messages/<fil>.
// Même écran dans l'appli (Messages.kt). Base : outils/base-messagerie.sql.
import { supabase, reduirePhoto } from "./donnees.js";
import { rubrique } from "./catalogue.js";
import { tr, traduire } from "./langue.js";
import { esc } from "./commun.js";
import { majCloche } from "./notifications.js";

const heure = iso => { const d = new Date(iso); return d.toDateString() === new Date().toDateString()
  ? d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }); };
const nomFil = c => c.fil.startsWith("support:") ? tr("Cleaneroo · Support") : `${c.avec || tr("Votre Cleaneur")} · ${rubrique(c.rubrique_id)?.nom || ""}`;
let minuterie = null;

/** Liste des conversations (#/messages). */
export async function pageMessages(vue, fil) {
  clearInterval(minuterie);
  if (fil) return pageFil(vue, decodeURIComponent(fil));
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { location.hash = "#/compte"; return; }
  const { data: liste } = await supabase.rpc("mes_conversations");
  vue.innerHTML = `<section class="bloc"><div class="etroit"><h1>💬 ${tr("Messages")}</h1><div class="trait-corail"></div>
    <p class="petit">${tr("Une conversation s'ouvre avec votre Cleaneur (ou votre client) dès que la prestation est confirmée.")}</p>
    <div class="liste-conversations">${(liste || []).map(c => `<a class="carte conversation${c.non_lus ? " non-lue" : ""}" href="#/messages/${encodeURIComponent(c.fil)}">
      <span class="avatar-conv">${c.fil.startsWith("support:") ? "🛟" : esc((c.avec || "?").charAt(0).toUpperCase())}</span>
      <span class="corps-conv"><b>${esc(nomFil(c))}</b><span class="petit">${c.dernier ? esc(c.dernier) : tr("Aucun message pour l'instant.")}</span></span>
      <span class="droite-conv"><span class="petit">${c.dernier_le ? heure(c.dernier_le) : ""}</span>${c.non_lus ? `<span class="pastille-cloche">${c.non_lus}</span>` : ""}</span></a>`).join("")}</div>
  </div></section>`;
  traduire(vue);
  styles();
}

/** Une conversation : bulles, réponse, photo. */
async function pageFil(vue, fil) {
  styles();
  vue.innerHTML = `<section class="bloc"><div class="etroit fil-messages">
    <p><a class="lien-bouton" href="#/messages">‹ ${tr("Toutes les conversations")}</a></p>
    <div class="bulles" aria-live="polite"></div>
    <form class="saisie-message" autocomplete="off">
      <label class="joindre" title="${tr("Joindre une photo")}">📷<input type="file" accept="image/*" hidden data-photo-message></label>
      <textarea rows="1" maxlength="2000" placeholder="${tr("Votre message…")}" data-texte-message></textarea>
      <button class="bouton" type="submit">${tr("Envoyer")}</button></form>
    <p class="erreur" data-erreur-message></p></div></section>`;
  traduire(vue);
  const bulles = vue.querySelector(".bulles");
  const liens = {};
  const charger = async () => {
    if (!bulles.isConnected) return clearInterval(minuterie);
    const { data } = await supabase.rpc("messages_du_fil", { p_fil: fil });
    if (!data) return;
    const bas = bulles.scrollHeight - bulles.scrollTop - bulles.clientHeight < 60;
    bulles.innerHTML = data.length ? data.map(m => `<div class="bulle ${m.de_moi ? "moi" : m.role === "support" ? "support" : "autre"}">
      ${m.role === "support" && !m.de_moi ? `<small>${tr("Cleaneroo · Support")}</small>` : ""}
      ${m.photo ? `<img alt="" data-photo-chemin="${esc(m.photo)}">` : ""}${m.texte ? `<p>${esc(m.texte).replace(/\n/g, "<br>")}</p>` : ""}
      <small>${heure(m.cree_le)}</small></div>`).join("") : `<p class="muet" style="text-align:center">${tr("Écrivez le premier message.")}</p>`;
    bulles.querySelectorAll("[data-photo-chemin]").forEach(async img => {
      const c = img.dataset.photoChemin;
      if (!liens[c]) liens[c] = (await supabase.storage.from("messages").createSignedUrl(c, 3600)).data?.signedUrl;
      if (liens[c]) img.src = liens[c]; else img.remove();
    });
    if (bas) bulles.scrollTop = bulles.scrollHeight;
    majCloche().catch(() => null);
  };
  await charger();
  bulles.scrollTop = bulles.scrollHeight;
  minuterie = setInterval(charger, 10000);
  const envoyer = async (texte, photo = "") => {
    const { data } = await supabase.rpc("envoyer_message", { p_fil: fil, p_texte: texte, p_photo: photo });
    if (data !== "ok") { vue.querySelector("[data-erreur-message]").textContent = tr("Le service est momentanément indisponible. Réessayez dans quelques minutes."); return false; }
    await charger(); bulles.scrollTop = bulles.scrollHeight; return true;
  };
  const zone = vue.querySelector("[data-texte-message]");
  zone.onkeydown = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); vue.querySelector(".saisie-message").requestSubmit(); } };
  vue.querySelector(".saisie-message").onsubmit = async e => {
    e.preventDefault();
    const t = zone.value.trim();
    if (!t) return;
    const b = e.target.querySelector("button"); b.disabled = true;
    if (await envoyer(t)) zone.value = "";
    b.disabled = false;
  };
  vue.querySelector("[data-photo-message]").onchange = async e => {
    const f = e.target.files[0];
    if (!f) return;
    const chemin = `${fil.replace(":", "-")}/${Date.now()}.jpg`;
    const { error } = await supabase.storage.from("messages").upload(chemin, await reduirePhoto(f, 1280, 0.7), { contentType: "image/jpeg" });
    if (error) { vue.querySelector("[data-erreur-message]").textContent = tr("La photo n'a pas pu être envoyée. Réessayez."); return; }
    await envoyer("", chemin);
  };
}

function styles() {
  if (document.getElementById("styles-messages")) return;
  const s = document.createElement("style");
  s.id = "styles-messages";
  s.textContent = `.liste-conversations{display:flex;flex-direction:column;gap:8px;margin-top:12px}
    .conversation{display:flex;align-items:center;gap:12px;text-decoration:none;color:inherit;margin:0}
    .conversation.non-lue b{font-weight:800}.avatar-conv{flex:none;width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:rgba(31,138,128,.12);font-weight:800;color:var(--primaire,#1F8A80)}
    .corps-conv{flex:1;min-width:0;display:flex;flex-direction:column}.corps-conv .petit{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .droite-conv{display:flex;flex-direction:column;align-items:flex-end;gap:4px}.droite-conv .pastille-cloche{position:static}
    .fil-messages{display:flex;flex-direction:column;min-height:70vh}
    .bulles{flex:1;display:flex;flex-direction:column;gap:8px;max-height:62vh;overflow-y:auto;padding:8px 2px}
    .bulle{max-width:78%;padding:9px 13px;border-radius:16px;background:#EEF3F3;align-self:flex-start}
    .bulle.moi{align-self:flex-end;background:var(--primaire,#1F8A80);color:#fff}.bulle.support{background:#FFF4D6}
    .bulle p{margin:0;white-space:normal;word-wrap:break-word}.bulle small{display:block;opacity:.7;font-size:.72rem;margin-top:3px}
    .bulle img{max-width:100%;border-radius:10px;display:block;margin:2px 0}
    .saisie-message{display:flex;gap:8px;align-items:flex-end;margin-top:10px}
    .saisie-message textarea{flex:1;resize:none;border:1px solid var(--separateur,#ccd);border-radius:14px;padding:10px 12px;font:inherit;min-height:44px;background:var(--surface,#fff);color:inherit}
    .joindre{cursor:pointer;font-size:1.4rem;padding:6px}
    @media (prefers-color-scheme:dark){.bulle{background:rgba(255,255,255,.08)}.bulle.support{background:rgba(245,179,1,.15)}}`;
  document.head.appendChild(s);
}
