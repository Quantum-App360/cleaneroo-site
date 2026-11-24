// Photos témoins (18 novembre 2026) : dans la fiche d'un logement, le client photographie chaque pièce telle qu'elle doit être rendue
// (tapis de bain, serviettes, coussins à leur place…). L'IA du contrôle de fin de ménage s'en sert de référence (fonction controle-ia) ;
// en cas d'écart voulu, le Cleaneur valide avec un commentaire. Photos privées : dossier photos-temoins/<client>/<logement>/<pièce>.jpg.
// Même écran dans l'appli (Temoins.kt).
import { supabase, session, enregistrerBien, reduirePhoto } from "./donnees.js";
import { piecesDe } from "./controle.js";
import { traduire, tr } from "./langue.js";
import { icone } from "./icones.js";

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const piecesDuBien = l => piecesDe("home", { chambres: l.chambres, sdb: l.sdb });

/** Bloc repliable « Photos témoins » d'un logement. */
export function editeurTemoins(l) {
  const temoins = l.temoins || {}, pieces = piecesDuBien(l), n = pieces.filter(p => temoins[p.id]).length;
  return `<details class="temoins-bien" data-temoins="${esc(l.id)}"><summary>${icone("appareil-photo")} ${tr("Photos témoins de l'état attendu")} · ${n}/${pieces.length}</summary>
    <p class="petit" style="margin:8px 0">${tr("Photographiez chaque pièce telle que vous voulez la retrouver (serviettes, tapis de bain, coussins à leur place). L'IA compare chaque ménage à ces photos.")}</p>
    <div class="grille-temoins">${pieces.map(p => `<label class="temoin${temoins[p.id] ? " pris" : ""}">
      <span class="vignette" data-vignette="${esc(temoins[p.id] || "")}">${icone("photo")}</span>
      <span class="nom">${esc(tr(p.nom))}</span>
      <input type="file" accept="image/*" data-temoin-piece="${esc(p.id)}" hidden></label>`).join("")}</div>
    <p class="erreur" data-erreur-temoin></p></details>`;
}

/** Envoi des photos et affichage des vignettes (liens temporaires). */
export function brancherTemoins(racine, biens, recharger) {
  racine.querySelectorAll("[data-temoins]").forEach(async bloc => {
    const l = biens.find(x => x.id === bloc.dataset.temoins);
    if (!l) return;
    bloc.querySelectorAll("[data-vignette]").forEach(async v => {
      if (!v.dataset.vignette) return;
      const { data } = await supabase.storage.from("photos-temoins").createSignedUrl(v.dataset.vignette, 600);
      if (data?.signedUrl) v.innerHTML = `<img src="${data.signedUrl}" alt="">`;
    });
    bloc.querySelectorAll("[data-temoin-piece]").forEach(input => input.onchange = async () => {
      const f = input.files?.[0], err = bloc.querySelector("[data-erreur-temoin]");
      if (!f) return;
      const s = await session();
      if (!s) { err.textContent = tr("Connectez-vous pour enregistrer vos photos témoins."); return; }
      err.textContent = tr("Envoi de la photo…");
      try {
        const photo = await reduirePhoto(f, 1600, 0.75);
        const chemin = `${s.user.id}/${l.id}/${input.dataset.temoinPiece}.jpg`;
        const { error } = await supabase.storage.from("photos-temoins").upload(chemin, photo, { upsert: true, contentType: "image/jpeg" });
        if (error) throw error;
        await enregistrerBien({ ...l, temoins: { ...(l.temoins || {}), [input.dataset.temoinPiece]: chemin } });
        err.textContent = ""; recharger();
      } catch { err.textContent = tr("Le service est momentanément indisponible. Réessayez dans quelques minutes."); }
    });
  });
  traduire(racine);
}
