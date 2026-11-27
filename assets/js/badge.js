// Badge « Logement contrôlé Cleaneroo » (18/11/2026), repensé le 27/11/2026 (validé par Michael) : la preuve de propreté du séjour,
// pour le voyageur. Page publique par bien (#/controle/<code>) et affichette à imprimer (#/affichette/<code>).
// - Toujours vrai : actif seulement si un ménage contrôlé a été fait dans les 30 derniers jours, à sa vraie date ; sinon « en pause ».
// - Jamais l'adresse, le nom du propriétaire ni le nom qu'il a donné à son bien : seulement le type de logement et la ville.
// - Jamais de lien dans Airbnb ou Booking (interdit par ces plateformes) : livret d'accueil, affichette, site de réservation directe.
// - Options : photos « après » du dernier ménage (si le propriétaire l'active) ; « Un souci à votre arrivée ? » (alerte au propriétaire,
//   seulement une notification : ni argent ni engagement de Cleaneroo).
// - « Vous louez aussi un logement ? » : code d'invitation du bien, reconnu comme un code de parrainage (base-badge-sejour.sql).
import { supabase, reduirePhoto } from "./donnees.js";
import { dateLongue } from "./regles.js";
import { traduire, tr } from "./langue.js";
import { icone } from "./icones.js";
import { TYPES_LOGEMENT } from "./catalogue.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const lienBadge = code => `https://cleaneroo.fr/#/controle/${code}`;
/** Phrase sans lien que le propriétaire peut écrire dans son annonce (aucun nom de société, aucun lien). */
export const PHRASE_ANNONCE = "Ménage contrôlé pièce par pièce en photo après chaque séjour.";
/** Un badge n'est actif que si le dernier ménage contrôlé date de moins de ce nombre de jours (même règle que la base). */
export const BADGE_ACTIF_JOURS = 30;

const nomType = b => tr(TYPES_LOGEMENT.find(t => t.id === b.type)?.nom || "Logement");
/** État du badge : "actif", "pause" (dernier ménage trop ancien) ou "attente" (aucun ménage contrôlé). */
export const etatBadge = b => !b?.dernier ? "attente" : b.actif ? "actif" : "pause";
/** Lien « Vous louez aussi un logement ? » : la location saisonnière, avec le code d'invitation du bien. */
export const lienInvitation = invitation => `${location.origin}/${invitation ? `?parrain=${encodeURIComponent(invitation)}` : ""}#/reserver/rental`;

async function chargerBadge(code) {
  try { const { data } = await supabase.rpc("badge_controle", { p_code: code }); return data || null; } catch { return null; }
}

/** En-tête du badge selon son état (jamais « contrôlé » sans ménage contrôlé récent). */
function enteteBadge(b) {
  const etat = etatBadge(b);
  const titre = `${esc(nomType(b))}${b.ville ? ` · ${esc(b.ville)}` : ""}`;
  if (etat === "actif") return `<span class="surtitre">${tr("Logement contrôlé Cleaneroo")}</span><h1>${titre}</h1>
    <p class="badge-date">${icone("valide")} ${tr("Dernier ménage contrôlé le")} <b>${dateLongue(new Date(b.dernier))}</b></p>`;
  if (etat === "pause") return `<span class="surtitre">${tr("Badge en pause")}</span><h1>${titre}</h1>
    <p class="badge-date pause">${icone("horloge")} ${tr("Pas de ménage contrôlé depuis le")} <b>${dateLongue(new Date(b.dernier))}</b></p>`;
  return `<span class="surtitre">${tr("Badge en attente")}</span><h1>${titre}</h1>
    <p class="muet">${tr("Ce badge s'activera après le premier ménage contrôlé en photo.")}</p>`;
}

/** Page publique #/controle/<code>. */
export async function pageBadge(vue, code) {
  const b = await chargerBadge(code);
  if (!b) { vue.innerHTML = `<section class="bloc"><div class="etroit"><h1>${tr("Badge introuvable")}</h1><p class="muet">${tr("Ce lien n'est pas valable.")}</p></div></section>`; traduire(vue); return; }
  const etat = etatBadge(b);
  const taux = b.pieces ? Math.round(b.premier_coup * 100 / b.pieces) : null;
  const photos = Array.isArray(b.photos) ? b.photos : [];
  vue.innerHTML = `<section class="bloc badge-page"><div class="etroit">
    <div class="carte badge-controle${etat !== "actif" ? " inactif" : ""}">
      <img src="/assets/img/logo-marque.svg?v=3" alt="" width="88" height="88">
      ${enteteBadge(b)}
      ${etat === "actif" ? `<div class="badge-chiffres">
        <div><b>${b.menages_90j}</b><span>${tr("ménages contrôlés en 90 jours")}</span></div>
        <div><b>${b.pieces}</b><span>${tr("pièces contrôlées en photo")}</span></div>
        ${taux !== null ? `<div><b>${taux} %</b><span>${tr("validées par l'IA du premier coup")}</span></div>` : ""}
      </div>` : ""}
      ${photos.length ? `<div class="badge-photos"><h2>${tr("Photos du dernier ménage")}</h2><div class="badge-galerie">${photos.map((p, i) =>
        `<figure><img data-photo-badge="${i}" alt="${esc(p.nom || "")}" loading="lazy"><figcaption>${esc(p.nom || "")}</figcaption></figure>`).join("")}</div></div>` : ""}
      <p class="petit">${tr("Chaque ménage Cleaneroo est contrôlé pièce par pièce, en photo, avant d'être validé.")}</p>
    </div>
    <div class="carte badge-souci">
      <h2 class="titre-section" style="margin-top:0">${icone("cloche", { tuile: true })}${tr("Un souci à votre arrivée ?")}</h2>
      <p class="petit muet" style="margin:0 0 10px">${tr("Prévenez votre hôte : il reçoit tout de suite votre message et votre photo. Pour une urgence, contactez-le directement.")}</p>
      <form data-alerte-voyageur novalidate>
        <label class="champ"><span>${tr("Ce que vous constatez")}</span><textarea name="texte" rows="3" maxlength="600" required placeholder="${tr("Ex. : il manque des serviettes dans la salle de bain")}"></textarea></label>
        <label class="champ"><span>${tr("Photo (facultatif)")}</span><input type="file" name="photo" accept="image/*" capture="environment"></label>
        <button type="submit" class="bouton">${icone("message")} ${tr("Prévenir mon hôte")}</button>
        <p class="petit" data-alerte-retour aria-live="polite"></p>
      </form>
    </div>
    <div class="carte badge-hote">
      <h2 class="titre-section" style="margin-top:0">${icone("location", { tuile: true })}${tr("Vous louez aussi un logement ?")}</h2>
      <p class="petit" style="margin:0 0 10px">${tr("Faites contrôler vos ménages en photo, comme ici.")}${b.invitation ? ` ${tr("Avec ce lien, vos 3 premières réservations avec un compte particulier sont sans frais de service.")}` : ""}</p>
      <a class="bouton plein" href="${esc(lienInvitation(b.invitation))}">${tr("Faire contrôler mes ménages")}</a>
    </div></div></section>`;
  traduire(vue);
  // Photos « après » : liens temporaires, lisibles sans compte seulement pour ce dernier ménage (règle de la base).
  photos.forEach(async (p, i) => {
    try {
      const { data } = await supabase.storage.from("photos-controles").createSignedUrl(p.chemin, 3600);
      const img = vue.querySelector(`[data-photo-badge="${i}"]`);
      if (img && data?.signedUrl) img.src = data.signedUrl; else img?.closest("figure")?.remove();
    } catch { vue.querySelector(`[data-photo-badge="${i}"]`)?.closest("figure")?.remove(); }
    if (!vue.querySelector(".badge-galerie figure")) vue.querySelector(".badge-photos")?.remove();
  });
  const f = vue.querySelector("[data-alerte-voyageur]");
  f.onsubmit = async e => {
    e.preventDefault();
    const retour = f.querySelector("[data-alerte-retour]"), bt = f.querySelector("button");
    const texte = f.texte.value.trim();
    if (texte.length < 3) { retour.className = "petit erreur"; retour.textContent = tr("Décrivez le souci en quelques mots."); return; }
    bt.disabled = true; retour.className = "petit"; retour.textContent = tr("Envoi en cours…");
    let chemin = null;
    const fichier = f.photo.files?.[0];
    if (fichier) {
      try {
        const nom = `${code}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
        const { error } = await supabase.storage.from("alertes-voyageurs").upload(nom, await reduirePhoto(fichier, 1600, 0.7), { contentType: "image/jpeg" });
        if (!error) chemin = nom;
      } catch { /* le message part sans photo */ }
    }
    let r = null;
    try { ({ data: r } = await supabase.rpc("alerte_voyageur", { p_code: code, p_texte: texte, p_photo: chemin })); } catch { r = null; }
    bt.disabled = false;
    if (r === "ok") { f.innerHTML = `<p class="note">${icone("valide")} ${tr("Votre hôte est prévenu. Merci !")}</p>`; traduire(f); return; }
    retour.className = "petit erreur";
    retour.textContent = tr(r === "trop" ? "Plusieurs messages ont déjà été envoyés. Contactez votre hôte directement." : "Le service est momentanément indisponible. Réessayez dans quelques minutes.");
  };
}

/** Affichette à imprimer (#/affichette/<code>) : livret d'accueil, frigo, entrée. Aucun lien dans Airbnb ou Booking. */
export async function pageAffichette(vue, code) {
  const b = await chargerBadge(code);
  if (!b) { vue.innerHTML = `<section class="bloc"><div class="etroit"><h1>${tr("Badge introuvable")}</h1></div></section>`; traduire(vue); return; }
  const court = `cleaneroo.fr/#/controle/${code}`;
  vue.innerHTML = `<section class="bloc"><div class="etroit">
    <p class="sans-impression"><button type="button" class="bouton" data-imprimer>${icone("document")} ${tr("Imprimer l'affichette")}</button>
      <span class="petit muet"> ${tr("Format A5. À glisser dans le livret d'accueil, sur le frigo ou à l'entrée.")}</span></p>
    <div class="affichette">
      <img src="/assets/img/logo-marque.svg?v=3" alt="" width="72" height="72">
      <p class="affichette-titre">${tr("Les ménages Cleaneroo de ce logement sont contrôlés en photo")}</p>
      <p>${tr("Chaque pièce est photographiée et vérifiée avant que le ménage soit validé.")}</p>
      <p class="affichette-lien">${tr("Date du dernier contrôle, photos et souci à signaler à votre hôte :")}<br><b>${esc(court)}</b></p>
      <p class="petit">Cleaneroo</p>
    </div></div></section>`;
  traduire(vue);
  vue.querySelector("[data-imprimer]").onclick = () => window.print();
}

const dateCourteAlerte = d => new Date(d).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** « Mes biens » : le badge d'un bien (lien, conseils, affichette, photos, alertes des voyageurs). */
function panneauBadge(bienId, m) {
  const lien = lienBadge(m.code), etat = etatBadge(m.badge);
  const alertes = Array.isArray(m.alertes) ? m.alertes : [];
  return `<div class="panneau-badge">
    <p class="note" style="margin-top:8px">${icone(etat === "actif" ? "valide" : "horloge")} <span>${tr(etat === "actif" ? "Badge actif : dernier ménage contrôlé il y a moins de 30 jours." : etat === "pause" ? "Badge en pause : aucun ménage contrôlé depuis plus de 30 jours. Il se réactive au prochain ménage contrôlé." : "Badge en attente : il s'activera après le premier ménage contrôlé.")}</span></p>
    <p class="petit" style="margin:8px 0 4px"><b>${tr("Où le montrer")}</b> : ${tr("livret d'accueil, affichette dans le logement, votre site de réservation directe.")}</p>
    <p class="petit erreur" style="margin:0 0 8px">${icone("alerte")} ${tr("Ne mettez jamais ce lien dans votre annonce ou vos messages Airbnb ou Booking : ces plateformes interdisent les liens externes et peuvent suspendre l'annonce.")}</p>
    <input class="texte" readonly value="${esc(lien)}" onclick="this.select()">
    <p class="petit" style="margin:6px 0"><button type="button" class="lien-bouton" data-copier="${esc(lien)}">${tr("Copier le lien")}</button> · <a href="${esc(lien)}" target="_blank" rel="noopener">${tr("Voir le badge")}</a> · <a href="#/affichette/${esc(m.code)}">${tr("Imprimer l'affichette")}</a></p>
    <p class="petit" style="margin:10px 0 4px"><b>${tr("Phrase à écrire dans votre annonce, sans lien")}</b></p>
    <p class="petit citation">« ${tr(PHRASE_ANNONCE)} » <button type="button" class="lien-bouton" data-copier="${esc(tr(PHRASE_ANNONCE))}">${tr("Copier")}</button></p>
    <label class="case" style="margin-top:10px"><input type="checkbox" data-badge-photos="${esc(bienId)}" ${m.photos ? "checked" : ""}> <span>${tr("Montrer sur le badge les photos « après » du dernier ménage")}</span></label>
    <p class="petit muet" style="margin:2px 0 0">${tr("Les photos ne montrent que les pièces nettoyées, jamais l'adresse. Vous pouvez les retirer à tout moment.")}</p>
    ${alertes.length ? `<div class="alertes-voyageurs"><p class="petit" style="margin:12px 0 4px"><b>${tr("Messages de vos voyageurs")}</b></p>${alertes.map(a => `<div class="carte alerte-voyageur${a.lu_le ? "" : " non-lue"}">
      <p class="petit muet" style="margin:0">${esc(dateCourteAlerte(a.cree_le))}</p><p style="margin:4px 0">${esc(a.texte)}</p>
      ${a.photo ? `<button type="button" class="lien-bouton" data-photo-alerte="${esc(a.photo)}">${tr("Voir la photo")}</button> · ` : ""}<a href="#/reserver/rental">${tr("Réserver une retouche")}</a>${a.lu_le ? "" : ` · <button type="button" class="lien-bouton" data-alerte-lue="${esc(a.id)}">${tr("Marquer comme lu")}</button>`}
    </div>`).join("")}</div>` : ""}
  </div>`;
}

export function brancherBadges(racine) {
  racine.querySelectorAll("[data-badge-bien]").forEach(bt => bt.onclick = async () => {
    const zone = bt.closest(".corps")?.querySelector("[data-zone-badge]");
    if (!zone) return;
    if (zone.dataset.ouvert) { zone.innerHTML = ""; delete zone.dataset.ouvert; return; }
    let m = null;
    try { ({ data: m } = await supabase.rpc("mon_badge", { p_bien: bt.dataset.badgeBien })); } catch { /* rien */ }
    if (!m?.code) { zone.innerHTML = `<p class="erreur">${tr("Enregistrez d'abord ce bien, puis réessayez.")}</p>`; traduire(zone); return; }
    zone.dataset.ouvert = "1";
    zone.innerHTML = panneauBadge(bt.dataset.badgeBien, m);
    traduire(zone);
    zone.querySelectorAll("[data-copier]").forEach(c => c.onclick = () => { navigator.clipboard?.writeText(c.dataset.copier); c.textContent = tr("Copié"); });
    const cb = zone.querySelector("[data-badge-photos]");
    cb.onchange = async () => { cb.disabled = true; try { await supabase.rpc("regler_badge", { p_bien: cb.dataset.badgePhotos, p_photos: cb.checked }); } catch { cb.checked = !cb.checked; } cb.disabled = false; };
    zone.querySelectorAll("[data-alerte-lue]").forEach(x => x.onclick = async () => {
      try { await supabase.rpc("alerte_lue", { p_id: x.dataset.alerteLue }); x.closest(".alerte-voyageur")?.classList.remove("non-lue"); x.remove(); } catch { /* rien */ }
    });
    zone.querySelectorAll("[data-photo-alerte]").forEach(x => x.onclick = async () => {
      try { const { data } = await supabase.storage.from("alertes-voyageurs").createSignedUrl(x.dataset.photoAlerte, 600); if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener"); } catch { /* rien */ }
    });
  });
}

