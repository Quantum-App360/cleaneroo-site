// Guide d'accès en photos (12 novembre 2026, repris de l'appli iPhone de Vincent) : étapes (titre, note, photo) enregistrées avec
// le logement, copiées dans chaque réservation de ce logement ; le Cleaneur ne les voit qu'une fois la mission confirmée.
// Photos : stockage privé « guides » (dossier = compte du client). Même écran dans l'appli (Guides.kt).
import { supabase, enregistrerBien, reduirePhoto } from "./donnees.js";
import { tr, traduire } from "./langue.js";
import { esc } from "./commun.js";

const liens = {};
async function lien(chemin) {
  if (!liens[chemin]) liens[chemin] = (await supabase.storage.from("guides").createSignedUrl(chemin, 3600)).data?.signedUrl || "";
  return liens[chemin];
}

/** Éditeur du guide d'un logement (fiche du bien). */
export function editeurGuide(l) {
  const g = l.guide || [];
  return `<details class="guide-acces"><summary>📸 ${tr("Guide d'accès en photos")} (${g.length})</summary>
    <p class="petit">${tr("Étape par étape : portail, digicode, boîte à clés, compteur… Transmis au Cleaneur seulement une fois la mission confirmée.")}</p>
    ${g.map((e, i) => `<div class="etape-guide"><b>${i + 1}. ${esc(e.titre)}</b>${e.note ? `<span class="petit">${esc(e.note)}</span>` : ""}
      ${e.photo ? `<img alt="" data-photo-guide="${esc(e.photo)}">` : ""}<button type="button" class="lien-bouton" data-retirer-etape="${esc(l.id)}:${i}">${tr("Retirer")}</button></div>`).join("")}
    <form data-form-guide="${esc(l.id)}" novalidate>
      <label class="champ">${tr("Titre de l'étape")}<input name="titre" maxlength="80" placeholder="${esc(tr("Ex. : Portail côté rue"))}"></label>
      <label class="champ">${tr("Note (facultatif)")}<input name="note" maxlength="200"></label>
      <label class="champ">${tr("Photo (facultatif)")}<input name="photo" type="file" accept="image/*"></label>
      <p class="erreur" data-erreur-guide></p><button class="bouton secondaire" type="submit">${tr("Ajouter l'étape")}</button></form></details>`;
}

export function brancherGuides(vue, biens, recharger) {
  vue.querySelectorAll("[data-photo-guide]").forEach(async img => { img.src = await lien(img.dataset.photoGuide); });
  vue.querySelectorAll("[data-form-guide]").forEach(f => f.onsubmit = async e => {
    e.preventDefault();
    const l = biens.find(x => x.id === f.dataset.formGuide), err = f.querySelector("[data-erreur-guide]");
    const titre = f.titre.value.trim();
    if (!titre) { err.textContent = tr("Donnez un titre à l'étape."); return; }
    let photo = "";
    const fichier = f.photo.files[0];
    if (fichier) {
      const { data: { session } } = await supabase.auth.getSession();
      photo = `${session.user.id}/${l.id}-${Date.now()}.jpg`;
      const { error } = await supabase.storage.from("guides").upload(photo, await reduirePhoto(fichier, 1280, 0.7), { contentType: "image/jpeg" });
      if (error) { err.textContent = tr("La photo n'a pas pu être envoyée. Réessayez."); return; }
    }
    try { await enregistrerBien({ ...l, guide: [...(l.guide || []), { titre, note: f.note.value.trim(), photo }] }); recharger(); }
    catch { err.textContent = tr("Le service est momentanément indisponible. Réessayez dans quelques minutes."); }
  });
  vue.querySelectorAll("[data-retirer-etape]").forEach(b => b.onclick = async () => {
    const [id, i] = b.dataset.retirerEtape.split(":");
    const l = biens.find(x => x.id === id);
    await enregistrerBien({ ...l, guide: (l.guide || []).filter((_, k) => k !== Number(i)) }).catch(() => null);
    recharger();
  });
  styles();
}

/** Guide d'accès d'une mission confirmée (Cleaneur). */
export function blocGuideMission(m) {
  const g = m.details?.guide || [];
  if (!g.length) return "";
  return `<details class="guide-acces" style="margin-top:10px"><summary><b>📸 ${tr("Guide d'accès")}</b> (${g.length})</summary>
    ${g.map((e, i) => `<div class="etape-guide"><b>${i + 1}. ${esc(e.titre)}</b>${e.note ? `<span class="petit">${esc(e.note)}</span>` : ""}
      ${e.photo ? `<img alt="" data-photo-guide="${esc(e.photo)}">` : ""}</div>`).join("")}</details>`;
}
export function brancherGuidesMissions(boite) {
  boite.querySelectorAll("[data-photo-guide]").forEach(async img => { const u = await lien(img.dataset.photoGuide); u ? img.src = u : img.remove(); });
  styles();
}

function styles() {
  if (document.getElementById("styles-guides")) return;
  const s = document.createElement("style"); s.id = "styles-guides";
  s.textContent = `.guide-acces summary{cursor:pointer}.etape-guide{display:flex;flex-direction:column;gap:4px;padding:8px 0;border-bottom:1px solid rgba(0,0,0,.06)}
    .etape-guide img{max-width:280px;border-radius:10px}.guide-acces form{margin-top:10px}`;
  document.head.appendChild(s);
}
