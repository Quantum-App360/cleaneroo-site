// Messagerie (12 novembre 2026, reprise de l'appli iPhone de Vincent) : une conversation par prestation entre le client et
// son Cleaneur (dès que la mission est confirmée) + « Cleaneroo · Support ». Photos jointes. #/messages et #/messages/<fil>.
// Même écran dans l'appli (Messages.kt). Base : outils/base-messagerie.sql.
import { icone } from "./icones.js";
import { supabase, reduirePhoto, demandesDuCompte } from "./donnees.js";
import { rubrique } from "./catalogue.js";
import { tr, traduire, LOCALE, langue } from "./langue.js";
import { esc } from "./commun.js";
import { majCloche, groupeJour } from "./notifications.js";
import { dateLongue, heure as heureFr } from "./regles.js";

// Lot 7 du prompt 4 (25/11/2026) : en-tête de la conversation (prestation, date, statut, lien), séparateurs de jour,
// « Lu » sous mon dernier message (infos_fil, outils/base-lot7.sql), messages rapides selon l'étape de la prestation
// (affichés dans la langue de chacun), traduction d'un message reçu (sur l'appareil quand le navigateur le permet,
// sinon dans Google Traduction, à la demande).
const heure = iso => { const d = new Date(iso); return d.toDateString() === new Date().toDateString()
  ? d.toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit" }) : d.toLocaleDateString(LOCALE, { day: "numeric", month: "short" }); };
const heureSeule = iso => { const d = new Date(iso); return heureFr(d.getHours(), d.getMinutes()); };

/** Messages rapides (texte en français envoyé tel quel, affiché traduit chez chacun). */
export const MESSAGES_RAPIDES = {
  cleaneur: {
    CONFIRMEE: ["Bonjour, c'est bien noté pour la prestation.", "Je suis en route.", "J'aurai quelques minutes de retard, je vous tiens informé."],
    EN_ROUTE: ["J'arrive dans 10 minutes.", "Je suis devant le logement.", "J'aurai quelques minutes de retard, je vous tiens informé."],
    SUR_PLACE: ["Je suis devant le logement.", "Je commence la prestation.", "Je ne trouve pas l'accès, pouvez-vous m'aider ?"],
    EN_COURS: ["Tout se passe bien.", "La prestation est terminée, le compte rendu est disponible."],
    FIN: ["Merci pour votre accueil, à bientôt !", "La prestation est terminée, le compte rendu est disponible."],
  },
  client: {
    CONFIRMEE: ["Merci, à bientôt !", "La clé est à l'endroit indiqué dans les consignes.", "Je serai sur place à votre arrivée."],
    EN_ROUTE: ["Merci, je vous attends.", "La clé est à l'endroit indiqué dans les consignes."],
    SUR_PLACE: ["J'arrive, je vous ouvre.", "La clé est à l'endroit indiqué dans les consignes."],
    EN_COURS: ["Merci, prenez votre temps."],
    FIN: ["Merci beaucoup, c'est parfait !", "Merci, à bientôt !"],
  },
};
const TOUS_RAPIDES = new Set(Object.values(MESSAGES_RAPIDES).flatMap(r => Object.values(r).flat()));
/** Messages rapides proposés selon mon rôle et l'étape de la prestation. Fonction pure, testée. */
export function messagesRapides(moi, statut) {
  const r = MESSAGES_RAPIDES[moi === "cleaneur" ? "cleaneur" : "client"];
  if (["A_VALIDER", "TERMINEE"].includes(statut)) return r.FIN;
  return r[statut] || [];
}
/** Texte affiché : un message rapide est montré dans la langue du lecteur, les autres tels quels. */
export const texteAffiche = t => TOUS_RAPIDES.has(t) ? tr(t) : t;
const nomFil = c => c.fil.startsWith("support:") ? tr("Cleaneroo · Support") : `${c.avec || tr("Votre Cleaneur")} · ${rubrique(c.rubrique_id)?.nom || ""}`;
let minuterie = null;

/** Liste des conversations (#/messages). */
export async function pageMessages(vue, fil) {
  clearInterval(minuterie);
  if (fil) return pageFil(vue, decodeURIComponent(fil));
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { location.hash = "#/compte"; return; }
  const { data: liste } = await supabase.rpc("mes_conversations");
  vue.innerHTML = `<section class="bloc"><div class="etroit"><h1>${icone("message")} ${tr("Messages")}</h1><div class="trait-corail"></div>
    <p class="petit">${tr("Une conversation s'ouvre avec votre Cleaneur (ou votre client) dès que la prestation est confirmée.")}</p>
    <div class="liste-conversations"><a class="carte conversation" href="#/aide"><span class="avatar-conv">${icone("message")}</span>
      <span class="corps-conv"><b>${tr("Assistant Cleaneroo")}</b><span class="petit">${tr("Réponse immédiate · une demande à l'équipe si besoin (48 h)")}</span></span><span class="droite-conv">›</span></a>
    ${(liste || []).map(c => `<a class="carte conversation${c.non_lus ? " non-lue" : ""}" href="#/messages/${encodeURIComponent(c.fil)}">
      <span class="avatar-conv">${c.fil.startsWith("support:") ? icone("message") : esc((c.avec || "?").charAt(0).toUpperCase())}</span>
      <span class="corps-conv"><b>${esc(nomFil(c))}</b><span class="petit">${c.dernier ? esc(c.dernier === "Photo" ? tr("Photo") : texteAffiche(c.dernier)) : tr("Aucun message pour l'instant.")}</span></span>
      <span class="droite-conv"><span class="petit">${c.dernier_le ? heure(c.dernier_le) : ""}</span>${c.non_lus ? `<span class="pastille-cloche">${c.non_lus}</span>` : ""}</span></a>`).join("")}</div>
    ${(liste || []).some(c => !c.fil.startsWith("support:")) ? "" : `<p class="petit muet" style="margin-top:14px">${tr("Pas encore de conversation avec un Cleaneur : elle apparaîtra ici dès qu'une prestation sera confirmée.")}</p>`}
  </div></section>`;
  traduire(vue);
  styles();
}

/** Une conversation : en-tête de la prestation, bulles par jour, messages rapides, réponse, photo. */
async function pageFil(vue, fil) {
  styles();
  vue.innerHTML = `<section class="bloc"><div class="etroit fil-messages">
    <p><a class="lien-bouton" href="#/messages">‹ ${tr("Toutes les conversations")}</a></p>
    <div class="entete-fil" data-entete-fil></div>
    <div class="fil-bulles" aria-live="polite"><p class="muet chargement-fil">${tr("Chargement de la conversation…")}</p></div>
    <p class="petit lu-fil" data-lu hidden></p>
    <div class="rapides" data-rapides></div>
    <form class="saisie-message" autocomplete="off">
      <label class="joindre" title="${tr("Joindre une photo")}" aria-label="${tr("Joindre une photo")}">${icone("appareil-photo")}<input type="file" accept="image/*" hidden data-photo-message></label>
      <textarea rows="1" maxlength="2000" placeholder="${tr("Votre message…")}" aria-label="${tr("Votre message…")}" data-texte-message></textarea>
      <button class="bouton" type="submit">${tr("Envoyer")}</button></form>
    <p class="petit muet" style="margin:6px 0 0">${icone("cadenas")} ${tr("Numéros, e-mails, liens et réseaux sont masqués automatiquement : tout passe par Cleaneroo (paiement protégé, assurance, remplaçant).")}</p>
    <p class="erreur" data-erreur-message></p></div></section>`;
  traduire(vue);
  const bulles = vue.querySelector(".fil-bulles");
  const liens = {}, traductions = {};
  let infos = null, signature = "";
  const enTete = async () => {
    infos = await supabase.rpc("infos_fil", { p_fil: fil }).then(r => r.data).catch(() => null);
    const z = vue.querySelector("[data-entete-fil]");
    if (!z?.isConnected) return;
    if (fil.startsWith("support:")) { z.innerHTML = `${icone("message", { tuile: true })}<div><b>${tr("Cleaneroo · Support")}</b><span class="petit">${tr("Réponse de l'équipe sous 48 h")}</span></div>`; }
    else if (infos?.rubrique_id) {
      let href = "#/compte/cleaneur";
      if (infos.moi === "client") { const d = (await demandesDuCompte().catch(() => [])).find(x => x.reference === fil); href = d ? `#/demande/${encodeURIComponent(fil)}/${encodeURIComponent(d.jeton)}` : "#/mes-demandes"; }
      const r = rubrique(infos.rubrique_id);
      const { libelleStatut } = await import("./app.js");   // import à la demande : app.js charge déjà ce module
      z.innerHTML = `${icone(r?.icone || "logement", { tuile: true })}<div><b>${esc(infos.avec || "")}${infos.avec ? " · " : ""}${esc(r?.nom || "")}</b>
        <span class="petit">${infos.creneau ? `${esc(dateLongue(new Date(infos.creneau)))} · ${heureSeule(infos.creneau)}` : tr("Date à convenir")}${infos.ville ? ` · ${esc(infos.ville)}` : ""}</span>
        <span class="tampon statut-fil">${esc(tr(libelleStatut(infos.statut)))}</span></div>
        <a class="lien-bouton voir-prestation" href="${href}">${tr(infos.moi === "client" ? "Voir la prestation" : "Voir la mission")} ›</a>`;
    } else z.innerHTML = "";
    traduire(z);
    const rapides = fil.startsWith("support:") || !infos ? [] : messagesRapides(infos.moi, infos.statut);
    const zr = vue.querySelector("[data-rapides]");
    zr.innerHTML = rapides.length ? `<span class="petit muet">${tr("Messages rapides")}</span>${rapides.map(t => `<button type="button" class="puce" data-rapide="${esc(t)}">${esc(tr(t))}</button>`).join("")}` : "";
    zr.querySelectorAll("[data-rapide]").forEach(b => b.onclick = async () => { b.disabled = true; await envoyer(b.dataset.rapide); b.disabled = false; });
  };
  const bulle = m => {
    const texte = m.texte ? texteAffiche(m.texte) : "";
    const traduisible = !m.de_moi && m.texte && !TOUS_RAPIDES.has(m.texte) && m.role !== "support";
    return `<div class="bulle-msg ${m.de_moi ? "moi" : m.role === "support" ? "support" : "autre"}" data-id="${esc(m.id)}">
      ${m.role === "support" && !m.de_moi ? `<small>${tr("Cleaneroo · Support")}</small>` : ""}
      ${m.photo ? `<img alt="${tr("Photo envoyée")}" loading="lazy" data-photo-chemin="${esc(m.photo)}">` : ""}${texte ? `<p>${esc(texte).replace(/\n/g, "<br>")}</p>` : ""}
      ${traductions[m.id] ? `<p class="traduction"><span class="petit">${tr("Traduction")} :</span> ${esc(traductions[m.id])}</p>` : ""}
      <small>${heureSeule(m.cree_le)}${traduisible && !traductions[m.id] ? ` · <button type="button" class="lien-traduire" data-traduire="${esc(m.id)}">${tr("Traduire")}</button>` : ""}</small></div>`;
  };
  let derniers = [], connus = null;
  const charger = async (forcer = false) => {
    if (!bulles.isConnected) return clearInterval(minuterie);
    const { data } = await supabase.rpc("messages_du_fil", { p_fil: fil });
    if (!data) { if (!derniers.length) bulles.innerHTML = `<p class="erreur">${tr("La conversation n'a pas pu être chargée. Réessayez dans quelques minutes.")}</p>`; return; }
    const sig = data.map(m => m.id).join() + Object.keys(traductions).join();
    if (sig === signature && !forcer) return;
    signature = sig; derniers = data;
    const bas = bulles.scrollHeight - bulles.scrollTop - bulles.clientHeight < 60;
    let jour = "";
    bulles.innerHTML = data.length ? data.map(m => {
      const j = new Date(m.cree_le).toDateString(), sep = j !== jour;
      jour = j;
      const g = groupeJour(m.cree_le);
      return `${sep ? `<div class="jour-fil"><span>${g === "Aujourd'hui" || g === "Hier" ? tr(g) : esc(new Date(m.cree_le).toLocaleDateString(LOCALE, { weekday: "long", day: "numeric", month: "long" }))}</span></div>` : ""}${bulle(m)}`;
    }).join("") : `<div class="vide-fil">${icone("message", { tuile: true })}<p class="muet">${tr("Écrivez le premier message.")}</p></div>`;
    bulles.querySelectorAll("[data-photo-chemin]").forEach(async img => {
      const c = img.dataset.photoChemin;
      if (!liens[c]) liens[c] = (await supabase.storage.from("messages").createSignedUrl(c, 3600)).data?.signedUrl;
      if (liens[c]) img.src = liens[c]; else img.remove();
    });
    // Un message qui vient d'arriver (envoyé ou reçu) glisse en place : on voit ce qui est nouveau.
    if (connus) bulles.querySelectorAll(".bulle-msg[data-id]").forEach(x => { if (!connus.has(x.dataset.id)) x.classList.add("arrivee"); });
    connus = new Set(data.map(m => m.id));
    bulles.querySelectorAll("[data-traduire]").forEach(b => b.onclick = () => traduireMessage(data.find(m => m.id === b.dataset.traduire)));
    if (bas || forcer) bulles.scrollTop = bulles.scrollHeight;
    // « Lu » sous mon dernier message, s'il est le dernier de la conversation
    const zl = vue.querySelector("[data-lu]"), dernier = data[data.length - 1];
    const lu = dernier?.de_moi && !fil.startsWith("support:") && (await supabase.rpc("infos_fil", { p_fil: fil }).then(r => r.data?.dernier_lu).catch(() => false));
    zl.hidden = !lu; zl.innerHTML = lu ? `${icone("valide")} ${tr("Lu")}` : "";
    majCloche().catch(() => null);
  };
  const traduireMessage = async m => {
    if (!m) return;
    const t = await traductionLocale(m.texte).catch(() => null);
    if (t) { traductions[m.id] = t; charger(true); return; }
    window.open(`https://translate.google.com/?sl=auto&tl=${langue}&op=translate&text=${encodeURIComponent(m.texte)}`, "_blank", "noopener");
  };
  await Promise.all([enTete(), charger(true)]);
  bulles.scrollTop = bulles.scrollHeight;
  minuterie = setInterval(() => charger(), 10000);
  const envoyer = async (texte, photo = "") => {
    const { data } = await supabase.rpc("envoyer_message", { p_fil: fil, p_texte: texte, p_photo: photo });
    if (data !== "ok") { vue.querySelector("[data-erreur-message]").textContent = tr("Le service est momentanément indisponible. Réessayez dans quelques minutes."); return false; }
    vue.querySelector("[data-erreur-message]").textContent = "";
    await charger(true); return true;
  };
  const zone = vue.querySelector("[data-texte-message]");
  zone.oninput = () => { zone.style.height = "auto"; zone.style.height = Math.min(zone.scrollHeight, 160) + "px"; };
  zone.onkeydown = e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); vue.querySelector(".saisie-message").requestSubmit(); } };
  vue.querySelector(".saisie-message").onsubmit = async e => {
    e.preventDefault();
    const t = zone.value.trim();
    if (!t) return;
    const b = e.target.querySelector("button"); b.disabled = true;
    if (await envoyer(t)) { zone.value = ""; zone.style.height = ""; }
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

/** Traduction sur l'appareil (API Translator du navigateur, sans envoi du texte) ; null si indisponible ou déjà dans la langue. */
async function traductionLocale(texte) {
  if (!("Translator" in self) || !("LanguageDetector" in self)) return null;
  const detecteur = await self.LanguageDetector.create();
  const source = (await detecteur.detect(texte))[0]?.detectedLanguage;
  if (!source || source === "und" || source === langue) return null;
  if ((await self.Translator.availability({ sourceLanguage: source, targetLanguage: langue })) === "unavailable") return null;
  const t = await self.Translator.create({ sourceLanguage: source, targetLanguage: langue });
  return t.translate(texte);
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
    .fil-bulles{flex:1;display:flex;flex-direction:column;gap:8px;max-height:62vh;overflow-y:auto;padding:8px 2px}
    .bulle-msg{max-width:78%;padding:9px 13px;border-radius:16px;background:#EEF3F3;align-self:flex-start}
    .bulle-msg.moi{align-self:flex-end;background:var(--primaire,#1F8A80);color:var(--fond,#fff)}.bulle-msg.support{background:#FFF4D6}
    .bulle-msg p{margin:0;white-space:normal;word-wrap:break-word}.bulle-msg small{display:block;opacity:.7;font-size:.72rem;margin-top:3px}
    .bulle-msg.arrivee{animation:bulle-arrivee .28s ease-out}@keyframes bulle-arrivee{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
    @media (prefers-reduced-motion:reduce){.bulle-msg.arrivee{animation:none}}
    .bulle-msg img{max-width:100%;border-radius:10px;display:block;margin:2px 0}
    .saisie-message{display:flex;gap:8px;align-items:flex-end;margin-top:10px}
    .saisie-message textarea{flex:1;resize:none;border:1px solid var(--separateur,#ccd);border-radius:14px;padding:10px 12px;font:inherit;min-height:44px;background:var(--surface,#fff);color:inherit}
    .joindre{cursor:pointer;padding:10px;display:grid;place-items:center;border-radius:50%;color:var(--primaire,#1F8A80)}.joindre:hover{background:rgba(31,138,128,.1)}.joindre .ico{width:24px;height:24px}
    .entete-fil{display:flex;gap:12px;align-items:flex-start;padding:12px;border:1px solid var(--separateur,#ccd);border-radius:16px;margin-bottom:8px}
    .entete-fil:empty{display:none}.entete-fil > div{flex:1;display:flex;flex-direction:column;gap:2px;min-width:0}.entete-fil .statut-fil{align-self:flex-start;margin-top:4px}
    .voir-prestation{white-space:nowrap;align-self:center}
    .jour-fil{text-align:center;margin:8px 0 2px}.jour-fil span{font-size:.75rem;font-weight:700;opacity:.65;padding:3px 10px;border-radius:99px;background:rgba(31,138,128,.08)}
    .lu-fil{text-align:right;margin:2px 4px 0;opacity:.75}.lu-fil .ico{width:14px;height:14px;vertical-align:-2px}
    .rapides{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:8px}.rapides:empty{display:none}.rapides .puce{font-size:.85rem}
    .bulle-msg .traduction{margin-top:6px;padding-top:6px;border-top:1px solid rgba(0,0,0,.1)}
    .lien-traduire{border:0;background:none;padding:0;color:inherit;text-decoration:underline;cursor:pointer;font:inherit}
    .vide-fil{text-align:center;margin:auto}.vide-fil .tuile-ico{margin:0 auto 6px}
    @media (max-width:520px){.entete-fil{flex-wrap:wrap}.voir-prestation{align-self:flex-start;flex-basis:100%;padding-left:60px}}
    @media (prefers-color-scheme:dark){.bulle-msg{background:rgba(255,255,255,.08)}.bulle-msg.support{background:rgba(245,179,1,.15)}}`;
  document.head.appendChild(s);
}
