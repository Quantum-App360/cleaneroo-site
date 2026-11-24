// Confiance et anti-contournement (23 novembre 2026, version 1.0.69 — base-confiance-2311.sql) :
// • Vitrine des professionnels (conciergerie, hôtel, entreprise, société de nettoyage) : logo, nom commercial, ville, description.
//   Aucune coordonnée : numéros, e-mails, liens et réseaux sont masqués par le serveur (enregistrer_vitrine).
// • Côté client, « Qui vient » : prénom et photo d'identité du Cleaneur (pièce de son dossier), vitrine de sa société.
// • Côté Cleaneur, « Chez qui » : vitrine du client professionnel, sur la mission.
// Mêmes écrans dans l'application (Vitrines.kt).
import { icone } from "./icones.js";
import { supabase, reduirePhoto } from "./donnees.js";
import { tr, traduire } from "./langue.js";

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const urlLogo = chemin => chemin ? supabase.storage.from("vitrines").getPublicUrl(chemin).data.publicUrl : "";
const initiales = nom => String(nom || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(m => m[0].toUpperCase()).join("");

/** Carte de présentation d'une vitrine (lecture seule). */
export function carteVitrine(v, surtitre = "") {
  if (!v || !v.nom) return "";
  const infos = [v.ville, v.depuis ? `${tr("depuis")} ${v.depuis}` : "", v.effectif, v.note ? `★ ${String(v.note).replace(".", ",")}` : ""].filter(Boolean);
  return `<div class="carte vitrine-carte">
    ${v.logo ? `<img class="vitrine-logo" src="${esc(urlLogo(v.logo))}" alt="">` : `<span class="vitrine-logo vide" aria-hidden="true">${esc(initiales(v.nom))}</span>`}
    <div>${surtitre ? `<span class="surtitre">${esc(surtitre)}</span>` : ""}<b>${esc(v.nom)}</b>${v.verifie ? ` <span class="tampon vert">✓ ${tr("Vérifié Cleaneroo")}</span>` : ""}
      ${infos.length ? `<p class="petit" style="margin:2px 0 0">${infos.map(esc).join(" · ")}</p>` : ""}
      ${v.description ? `<p class="petit" style="margin:6px 0 0">${esc(v.description)}</p>` : ""}</div></div>`;
}

/** Éditeur de la vitrine (espace Conciergerie, Hôtels, Entreprise, et Société de nettoyage). */
export function blocVitrine(p) {
  const v = p.vitrine || {};
  return `<div id="vitrine-pro"><h2 class="titre-section">${icone("commerce")} ${tr("Ma vitrine")}</h2>
    <p class="petit" style="margin-top:0">${tr("Ce que voient les Cleaneurs (ou vos clients) avant de travailler avec vous : logo, nom, ville et quelques mots. Pas de numéro, d'e-mail ni de site : ils sont masqués automatiquement, tout passe par Cleaneroo.")}</p>
    <form class="carte" id="form-vitrine" novalidate>
      <div class="vitrine-edition"><label class="vitrine-logo-choix">${v.logo ? `<img class="vitrine-logo" src="${esc(urlLogo(v.logo))}" alt="">` : `<span class="vitrine-logo vide">＋</span>`}
        <span class="petit">${tr("Logo")}</span><input type="file" accept="image/*" hidden data-logo></label>
        <div style="flex:1"><label class="champ">${tr("Nom commercial")}<input name="nom" maxlength="80" value="${esc(v.nom || p.societe || "")}"></label>
          <div class="grille-2"><label class="champ">${tr("Ville")}<input name="ville" maxlength="60" value="${esc(v.ville || p.ville || "")}"></label>
            <label class="champ">${tr("En activité depuis (année)")}<input name="depuis" inputmode="numeric" maxlength="4" value="${esc(v.depuis || "")}"></label></div></div></div>
      <label class="champ">${tr("Taille (ex. : 12 biens gérés, 8 salariés)")}<input name="effectif" maxlength="40" value="${esc(v.effectif || "")}"></label>
      <label class="champ">${tr("Présentation (400 caractères)")}<textarea name="description" maxlength="400" rows="4">${esc(v.description || "")}</textarea></label>
      <input type="hidden" name="logo" value="${esc(v.logo || "")}">
      <p class="erreur" data-erreur-vitrine></p>
      <button class="bouton plein" type="submit">${tr("Enregistrer ma vitrine")}</button>
      <div data-apercu-vitrine style="margin-top:12px">${v.nom ? `<p class="petit muet" style="margin:0 0 6px">${tr("Aperçu")}</p>${carteVitrine(v)}` : ""}</div>
    </form></div>`;
}

export function brancherVitrine(vue, p, recharger) {
  const f = vue.querySelector("#form-vitrine");
  if (!f) return;
  const err = f.querySelector("[data-erreur-vitrine]");
  f.querySelector("[data-logo]").onchange = async e => {
    const fichier = e.target.files?.[0]; if (!fichier) return;
    err.textContent = tr("Envoi du logo…");
    try {
      const chemin = `${p.id}/logo-${Date.now()}.jpg`;
      const { error } = await supabase.storage.from("vitrines").upload(chemin, await reduirePhoto(fichier, 400, 0.85), { contentType: "image/jpeg", upsert: true });
      if (error) throw error;
      f.logo.value = chemin;
      f.querySelector(".vitrine-logo-choix .vitrine-logo").outerHTML = `<img class="vitrine-logo" src="${esc(urlLogo(chemin))}" alt="">`;
      err.textContent = "";
    } catch { err.textContent = tr("Le logo n'a pas pu être envoyé. Réessayez."); }
  };
  f.onsubmit = async e => {
    e.preventDefault();
    if (!f.nom.value.trim()) { err.textContent = tr("Indiquez le nom commercial."); return; }
    const { data, error } = await supabase.rpc("enregistrer_vitrine", { p_vitrine: {
      nom: f.nom.value, ville: f.ville.value, depuis: f.depuis.value, effectif: f.effectif.value, description: f.description.value, logo: f.logo.value } });
    if (error || !data) { err.textContent = tr("Le service est momentanément indisponible. Réessayez dans quelques minutes."); return; }
    const masque = JSON.stringify(data).includes("[coordonnées masquées]");
    err.textContent = masque ? tr("Enregistré. Les coordonnées ont été masquées : tout passe par Cleaneroo.") : "";
    if (!masque) recharger(); else f.querySelector("[data-apercu-vitrine]").innerHTML = carteVitrine({ ...data, verifie: false });
  };
}

/** Client : qui vient faire la prestation (photo d'identité, prénom, société). Inséré avant « avant ». */
export async function blocQuiVient(avant, reference) {
  if (!avant || !reference) return;
  const { data: q } = await supabase.rpc("qui_vient", { p_reference: reference }).catch(() => ({ data: null }));
  if (!q || !avant.isConnected) return;
  let photo = "";
  if (q.photo) { const { data } = await supabase.storage.from("documents-cleaneurs").createSignedUrl(q.photo, 3600).catch(() => ({ data: null })); photo = data?.signedUrl || ""; }
  const boite = document.createElement("div");
  boite.className = "carte qui-vient";
  boite.style.marginBottom = "14px";
  boite.innerHTML = `<div class="qui-vient-tete">${photo ? `<img class="photo-identite" src="${esc(photo)}" alt="">` : `<span class="photo-identite vide">${esc(initiales(q.prenom))}</span>`}
      <div><span class="surtitre">${tr("Votre Cleaneur")}</span><b>${esc(q.prenom || "")}</b>
        <p class="petit" style="margin:2px 0 0">${tr(photo ? "Photo vérifiée par Cleaneroo : c'est bien cette personne qui vient." : "Cleaneur vérifié par Cleaneroo.")}</p></div></div>
    ${q.societe && q.societe.nom ? carteVitrine(q.societe, tr("Sa société")) : ""}
    <p class="petit muet" style="margin:8px 0 0">${icone("message")} ${tr("Pour échanger, utilisez la messagerie de la prestation : vos coordonnées restent privées.")}</p>`;
  avant.parentNode.insertBefore(boite, avant);
  traduire(boite);
}

/** Cleaneur : vitrine du client professionnel sur chaque carte de mission (data-chez-qui). */
export function remplirChezQui(vue) {
  vue.querySelectorAll("[data-chez-qui]").forEach(async boite => {
    if (boite.dataset.rempli) return;
    boite.dataset.rempli = "1";
    const { data } = await supabase.rpc("chez_qui", { p_reference: boite.dataset.chezQui }).catch(() => ({ data: null }));
    if (data && data.nom && boite.isConnected) { boite.innerHTML = carteVitrine(data, tr("Chez")); traduire(boite); }
  });
}
